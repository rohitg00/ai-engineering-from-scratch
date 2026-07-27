# 梯度检查点与激活重计算

> 反向传播会保留每一层的中间激活值。对于 70B 参数、128K 上下文长度的模型，每张卡上的激活值高达 3 TB。检查点技术用 FLOPs 换内存：不保存激活值，而是重计算。问题在于应该丢弃哪些片段——答案并非"全部丢弃"。

**类型：** 构建
**语言：** Python（使用 numpy，可选 torch）
**前置知识：** 阶段 10 课程 04（预训练迷你 GPT）、阶段 10 课程 05（缩放与分布式）
**时间：** 约 70 分钟

## 问题

训练 Transformer 时，需要为每一层存储在反向传播中被微分的每个运算的输入：注意力输入、Q/K/V 投影、softmax 输出、FFN 输入、归一化输出以及残差流。对于隐藏维度 `d`、序列长度 `L`、批次 `B` 的一层，每层约有 `12 * B * L * d` 个浮点数。

当 `d=8192, L=8192, B=1` 时，每层在 BF16 下为 800 MB。一个 64 层模型就是 51 GB 的激活值——这还只是乘以微批次大小之前、加上注意力 softmax 中间值（每头 `L^2`）之前、以及考虑张量并行部分副本之前的数据。

两面账本：BF16 权重量加上优化器状态可能装得进 80 GB，但激活值会让你超限。梯度检查点（又称激活重计算）是标准的解决办法：丢弃大部分激活值，在反向传播时重新执行前向传播来恢复它们。代价是额外的 FLOPs。收益是内存消耗按检查点段数与总层数的比例下降。

简单粗暴地做，检查点每步大约增加 33% 的前向传播 FLOPs。做得好——按照 Korthikanti 等人的"智能选择"进行选择性检查点——可以在不到 5% 的 FLOP 开销下节省 5 倍内存。配合 FP8 矩阵乘法、FSDP 卸载和专家并行 MoE，这一点至关重要：你既承受不起内存的浪费，也承受不起计算资源的浪费。

## 概念

### 反向传播真正需要什么

`output = layer(input)`。反向传播需要 `grad_input` 和 `grad_params`。为了计算它们，需要：

- `input`（用来计算线性层的 `grad_params = input.T @ grad_output`）
- 一些激活函数的导数中间值（ReLU/GELU/softmax 的导数依赖于激活值本身）

前向传播会自动将这些值存储在 autograd 计算图中。每个 `tensor.retain_grad()` 以及每个需要其输入的运算都会保留一个引用。

### 朴素的全检查点

将网络分为 `N` 个段。在前向传播时，只保存每个段的*输入*。当反向传播需要中间值时，重新执行该段的前向传播来物化这些中间值，然后再求导。

示例：一个 32 层 Transformer 分成 32 个段，每段 1 层。

- 内存：32 个层输入（小） vs 32 *（每层激活体积）（巨大）。
- 额外计算：每个段多一次前向传播，即总前向 FLOPs 增加约 33%（因为反向传播是前向传播的 2 倍，完整步骤从 1 + 2 = 3 变为 1 + 1 + 2 = 4 个单位）。

这就是 Chen 等人 2016 年原始方案的思路：每 `sqrt(L)` 层设置一个检查点，以平衡内存和计算。对于 L=64，就是 8 个检查点。

### 选择性检查点（Korthikanti 2022）

并非所有激活值的代价相同。注意力 softmax 输出为 `B*L*L*heads`，随序列长度*二次*增长。FFN 隐藏层激活值为 `B*L*4d`，线性增长。对于长序列，softmax 占主导地位。

选择性检查点保留存储成本低的激活值（线性投影、残差连接），只重计算成本高的激活值（注意力）。你以极少的 FLOPs 进行重计算，却节省了 O(L²) 的内存。

Megatron-Core 将其实现为"选择性"激活重计算。2024 年及以后的大多数前沿训练运行都采用了这一方法。

### 卸载

重计算的替代方案：在前向传播和反向传播之间将激活值传输到 CPU 内存。需要 PCIe 带宽；当空闲带宽超过重计算成本时，卸载更优。混合策略很常见：对某些层进行检查点，对另一些层进行卸载。

FSDP2 将卸载作为一等公民提供。当 GPU 受内存瓶颈限制而 CPU-GPU 传输仍有余量时，卸载表现出色。

### 重计算成本模型

每 `k` 层设置一个朴素检查点时，每步 FLOPs（共 `L` 层）为：

```
flops_fwd_normal = L * f_layer
flops_bwd_normal = 2 * L * f_layer
flops_total_normal = 3 * L * f_layer

flops_fwd_ckpt = L * f_layer
flops_recompute = L * f_layer  # 段内每层多一次前向传播
flops_bwd_ckpt = 2 * L * f_layer
flops_total_ckpt = 4 * L * f_layer
overhead = 4 / 3 - 1 = 0.33 = 33%
```

使用选择性检查点时，只重计算注意力核，而非整个层：

```
flops_recompute_selective = L * f_attention ~= L * f_layer * 0.15
overhead_selective = (3 + 0.15) / 3 - 1 = 0.05 = 5%
```

### 内存节省模型

每层激活体积：`A`。对于 `L` 层，总激活内存：`L * A`。

全检查点（段大小 1）：只保存 `L * input_volume`（约为标准 Transformer 的 `L * 1/10 A`）。节省约 `9 * L * A * 1/10`。

每 `k` 层一个检查点：保存 `L/k * A` 加上活跃段内的 `k-1` 层的量。

当 `k = sqrt(L)` 时，内存和重计算成本都按 `sqrt(L)` 缩放——这是对均匀成本层的最优权衡。

### 何时不需要检查点

- 流水线阶段中已在执行的最内层。它们无论如何都要完成。
- 第一阶段和最后阶段，如果它们主导了该阶段的计算（在 Transformer 中很少见）。
- 已使用 FlashAttention 的注意力核——Flash 已经快速地重计算了 softmax，因此额外的层级检查点带来的收益很小。

### 实现模式

1. **函数包装器：** 将一段代码包装在 `torch.utils.checkpoint.checkpoint(fn, input)` 中。PyTorch 只保存 `input`，在反向传播时重计算其他所有内容。

2. **装饰器方式：** 将层标记为可检查点；训练器在配置时决定哪些段被包装。

3. **手动显式重计算：** 自己编写反向传播，调用自定义的 `recompute_forward` 函数，该函数使用保存的输入重复前向传播。

三种方式产生相同的功能结果。包装器是标准用法。

### 与 TP / PP / FP8 的交互

- **张量并行：** 检查点输入在重计算时必须进行 gather 或 rescatter；需处理通信开销。
- **流水线并行：** 典型模式是对每个流水线阶段的前向传播进行检查点，以便反向顺序的微批次可以重用激活内存。
- **FP8 重计算：** 重计算期间更新的 amax 历史必须与原始前向传播一致，否则 FP8 缩放会漂移。大多数框架会对缩放进行快照。

## 动手构建

### 步骤 1：带段的玩具模型

```python
import numpy as np


def linear_forward(x, w, b):
    return x @ w + b


def relu(x):
    return np.maximum(x, 0)


def layer_forward(x, w1, b1, w2, b2):
    h = relu(linear_forward(x, w1, b1))
    return linear_forward(h, w2, b2)


def model_forward(x, params):
    activations = [x]
    h = x
    for w1, b1, w2, b2 in params:
        h = layer_forward(h, w1, b1, w2, b2)
        activations.append(h)
    return h, activations
```

### 步骤 2：需要所有激活值的朴素反向传播

```python
def model_backward(grad_output, activations, params):
    grads = [None] * len(params)
    g = grad_output
    for i in range(len(params) - 1, -1, -1):
        w1, b1, w2, b2 = params[i]
        x_in = activations[i]
        h_pre = linear_forward(x_in, w1, b1)
        h = relu(h_pre)
        gh = g @ w2.T
        gw2 = h.T @ g
        gb2 = g.sum(axis=0)
        g_pre = gh * (h_pre > 0)
        gx = g_pre @ w1.T
        gw1 = x_in.T @ g_pre
        gb1 = g_pre.sum(axis=0)
        grads[i] = (gw1, gb1, gw2, gb2)
        g = gx
    return g, grads
```

### 步骤 3：每 k 层检查点的内存方案

```python
def model_forward_checkpointed(x, params, k=4):
    saved_inputs = [x]
    h = x
    for i, (w1, b1, w2, b2) in enumerate(params):
        h = layer_forward(h, w1, b1, w2, b2)
        if (i + 1) % k == 0:
            saved_inputs.append(h)
    return h, saved_inputs


def model_backward_checkpointed(grad_output, saved_inputs, params, k=4):
    grads = [None] * len(params)
    g = grad_output
    segments = [(j * k, min((j + 1) * k, len(params))) for j in range(len(saved_inputs))]
    for seg_idx in range(len(saved_inputs) - 1, -1, -1):
        start, end = segments[seg_idx]
        if start >= end:
            continue
        x_in = saved_inputs[seg_idx]
        _, seg_acts = model_forward(x_in, params[start:end])
        g, seg_grads = model_backward(g, seg_acts, params[start:end])
        for j, gr in enumerate(seg_grads):
            grads[start + j] = gr
    return g, grads
```

### 步骤 4：成本模型

```python
def checkpoint_cost(n_layers, segment_size, flops_per_layer=1.0):
    fwd = n_layers * flops_per_layer
    recompute = n_layers * flops_per_layer
    bwd = 2 * n_layers * flops_per_layer
    return {
        "fwd": fwd,
        "recompute": recompute,
        "bwd": bwd,
        "total": fwd + recompute + bwd,
        "overhead_vs_no_ckpt": (fwd + recompute + bwd) / (fwd + bwd) - 1.0,
    }


def selective_checkpoint_cost(n_layers, attention_fraction=0.15,
                              flops_per_layer=1.0):
    fwd = n_layers * flops_per_layer
    recompute = n_layers * attention_fraction * flops_per_layer
    bwd = 2 * n_layers * flops_per_layer
    return {
        "fwd": fwd,
        "recompute": recompute,
        "bwd": bwd,
        "total": fwd + recompute + bwd,
        "overhead_vs_no_ckpt": (fwd + recompute + bwd) / (fwd + bwd) - 1.0,
    }
```

### 步骤 5：内存估算器

```python
def activation_memory_mb(n_layers, hidden=8192, seq=8192,
                        batch=1, bytes_per_value=2):
    per_layer = 12 * batch * seq * hidden * bytes_per_value
    return n_layers * per_layer / 1e6


def memory_after_checkpoint(n_layers, segment_size, hidden=8192,
                           seq=8192, batch=1, bytes_per_value=2):
    n_seg = max(1, n_layers // segment_size)
    saved = (n_seg + segment_size) * 1 * batch * seq * hidden * bytes_per_value
    return saved / 1e6
```

### 步骤 6：最优段大小

```python
def optimal_segment(n_layers):
    return int(round(np.sqrt(n_layers)))
```

### 步骤 7：选择性检查点决策

```python
def should_recompute(layer_type, activation_bytes, recompute_flops_ratio):
    if layer_type == "attention" and activation_bytes > 100 * 1e6:
        return True
    if layer_type == "ffn" and activation_bytes > 500 * 1e6:
        return recompute_flops_ratio < 0.1
    return False
```

## 使用建议

- **torch.utils.checkpoint**：`from torch.utils.checkpoint import checkpoint`——PyTorch 中的标准包装器。包装一个函数；只保存输入，在反向传播时重计算。
- **Megatron-Core 激活重计算**：支持 `selective`、`full` 和 `block` 模式。2024 年及以后前沿训练的标准配置。
- **FSDP2 卸载**：`module.to_empty(device="cpu")` 配合 FSDP2 中的 `offload_policy` 将激活值分片到 CPU 而不是重计算。
- **DeepSpeed ZeRO-Offload**：对优化器状态和激活值进行 CPU 卸载，作为检查点的补充。

## 交付物

本课程产出 `outputs/prompt-activation-recompute-policy.md`——一个提示词模板，接收你的模型配置（层数、隐藏维度、序列长度、批次大小）和可用 GPU 内存，输出每层的重计算策略（无 / 选择性 / 全量 / 卸载）。

## 练习

1. 验证正确性。运行 `model_forward` + `model_backward`（全激活值）与 `model_forward_checkpointed` + `model_backward_checkpointed`（分段）。参数梯度必须精确到机器精度。

2. 遍历段大小 `k` 从 1 到 `L`。绘制 FLOP 开销和内存使用图。找到曲线的拐点。

3. 实现选择性检查点：保存注意力模块的输入但不保存其中间值。对于 seq=8192 的 32 层模型，测量其 FLOP 开销与全层检查点的对比。

4. 添加卸载。将段输入保存到模拟的"CPU 缓冲区"（一个单独的列表）。以字节/时间度量"PCIe 带宽"，找到卸载与重计算之间的盈亏平衡点。

5. 使用真实的 PyTorch Transformer，在有和没有 `torch.utils.checkpoint` 的情况下进行基准测试。测量内存（通过 `torch.cuda.max_memory_allocated`）和每步时间。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|---------|
| 梯度检查点（Gradient checkpointing） | "通过重做前向传播来节省内存" | 只保存段输入；在反向传播期间重计算中间值以获得支持梯度的张量 |
| 激活重计算（Activation recomputation） | "和检查点一样" | 同一技术的高性能计算风味名称 |
| 段大小（Segment size, k） | "每个检查点包含多少层" | 其中间值被丢弃并一起重新物化的层数 |
| 选择性检查点（Selective checkpointing） | "Korthikanti 的技巧" | 只重计算存储成本高的激活值（注意力 softmax）；保留成本低的 |
| 全检查点（Full checkpointing） | "朴素版本" | 每个段中重计算每一层的中间值 |
| 块检查点（Block checkpointing） | "粗粒度" | 对整个 Transformer 块进行检查点；粒度最大 |
| FLOP 开销（FLOP overhead） | "计算税" | 每步额外 FLOPs =（重计算 FLOPs）/（前向 + 反向 FLOPs）；朴素版本 33%，选择性 5% |
| 激活卸载（Activation offload） | "发送到 CPU" | 在前向传播到反向传播之间将激活值移到 CPU 内存；重计算的替代方案 |
| sqrt-L 规则（sqrt-L rule） | "经典最优值" | 对于均匀成本的层，最优检查点间隔为 sqrt(L) 层 |
| 注意力 softmax 体积（Attention-softmax volume） | "O(L²) 问题" | L² * 头数 * 批次 个浮点数；在长上下文时主导激活内存 |

## 延伸阅读

- [Chen 等人，2016 —— "Training Deep Nets with Sublinear Memory Cost"](https://arxiv.org/abs/1604.06174) —— 正式提出梯度检查点的原始论文
- [Korthikanti 等人，2022 —— "Reducing Activation Recomputation in Large Transformer Models"](https://arxiv.org/abs/2205.05198) —— 选择性激活重计算及其形式化成本分析
- [Pudipeddi 等人，2020 —— "Training Large Neural Networks with Constant Memory using a New Execution Algorithm"](https://arxiv.org/abs/2002.05645) —— 通过逆向模式重新物化实现恒定内存的替代方法
- [Ren 等人，2021 —— "ZeRO-Offload: Democratizing Billion-Scale Model Training"](https://arxiv.org/abs/2101.06840) —— 大规模激活卸载
- [PyTorch torch.utils.checkpoint 文档](https://pytorch.org/docs/stable/checkpoint.html) —— 标准 API
- [Megatron-Core 激活重计算文档](https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/features/memory_optimizations.html) —— selective、full 和 block 模式
