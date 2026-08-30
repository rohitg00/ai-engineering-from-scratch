# 34 · 梯度检查点与激活重计算

> 反向传播会保留每一个中间激活值。在 70B 参数、128K 上下文的规模下，每个 rank 的激活值高达 3 TB。检查点用算力换内存：与其保存，不如重算。问题在于该丢弃哪些段，而答案绝不是「全部丢掉」。

**类型：** 构建
**语言：** Python（搭配 numpy，可选 torch）
**前置：** 阶段 10 第 04 课（预训练 Mini-GPT），阶段 10 第 05 课（扩展与分布式）
**时长：** 约 70 分钟

## 问题所在

训练一个 Transformer 时，需要为每一层保存反向传播中会被求导的每个算子的输入：注意力输入、Q/K/V 投影、softmax 输出、FFN 输入、归一化输出以及残差流。对于隐藏维度为 `d`、序列长度为 `L`、批大小为 `B` 的一层，这大约是每层 `12 * B * L * d` 个浮点数。

对于 `d=8192, L=8192, B=1`，在 BF16 下就是每层 800 MB。一个 64 层的模型就是 51 GB 的激活值——而这还没乘上微批大小（microbatch），还没加上注意力-softmax 的中间量（每个头 `L^2`），也还没考虑张量并行（tensor-parallel）的部分副本。

两头都吃紧：BF16 权重加上优化器状态也许能塞进 80GB，但激活值会把你顶出去。梯度检查点（gradient checkpointing，又称激活重计算 activation recomputation）是标准解法。丢弃大部分激活值；在反向传播期间重跑前向以把它们找回来。代价：额外的 FLOPs。收益：内存按「检查点段数 / 总层数」的比例下降。

朴素地做检查点，每一步大约多花 33% 的前向 FLOPs。做得好——按 Korthikanti 等人的「智能选择」做选择性检查点——你能省下 5 倍内存，而 FLOP 开销不到 5%。而且在用上 FP8 矩阵乘法、FSDP offload 以及专家并行（expert-parallel）MoE 时，这一点至关重要：你既承受不起那份内存，也浪费不起那份算力。

## 概念

### 反向传播究竟需要什么

`output = layer(input)`。反向传播想要 `grad_input` 和 `grad_params`。要计算它们，它需要：

- `input`（对于线性层，用于计算 `grad_params = input.T @ grad_output`）
- 一些激活函数的导数中间量（ReLU/GELU/softmax 的导数取决于激活值本身）

前向传播会把这些自动存进自动求导（autograd）图中。每个 `tensor.retain_grad()`，以及每个需要其输入的算子，都会保留一份引用。

### 朴素的全量检查点

把网络切成 `N` 段。前向时，只保存每一段的*输入*。当反向需要中间量时，重跑该段的前向以重新生成这些中间量，然后再求导。

例子：一个 32 层的 Transformer 切成 32 段，每段 1 层。

- 内存：32 个段输入（小）对 32 *（每层激活体积）（巨大）。
- 额外算力：每段多算 1 次前向，即总前向 FLOPs 多约 33%（因为反向是前向的 2 倍，整个 step 从 1 + 2 = 3 个单位变为 1 + 1 + 2 = 4 个单位）。

这就是最初 Chen 等人 2016 年的配方：每 `sqrt(L)` 层放一个检查点，以平衡内存与算力。对于 L=64，就是 8 个检查点。

### 选择性检查点（Korthikanti 2022）

并非所有激活值的成本都相同。注意力的 softmax 输出是 `B*L*L*heads`，随序列长度*平方增长*。FFN 的隐藏激活是 `B*L*4d`，呈线性增长。对于长序列，softmax 占主导。

选择性检查点保留那些「存起来便宜」的激活值（线性投影、残差），只重计算那些昂贵的（注意力）。你只付出极少的 FLOPs 去重算，却省下了 O(L^2) 的内存。

Megatron-Core 将此实现为「selective」激活重计算。在 2024 年以后的大多数前沿训练任务中都有使用。

### Offload（卸载）

重计算的替代方案：在前向和反向之间把激活值搬到 CPU 内存。这需要 PCIe 带宽；当空闲带宽超过重新生成（rematerialization）的成本时才划算。混合策略很常见：一部分层做检查点，另一部分做卸载。

FSDP2 把卸载作为一等公民选项提供。当 GPU 被内存卡住、而 CPU-GPU 传输还有余量时，卸载就大放异彩。

### 重计算成本模型

朴素地每 `k` 层（共 `L` 层）做一次检查点时，每一步的 FLOPs：

```
flops_fwd_normal = L * f_layer
flops_bwd_normal = 2 * L * f_layer
flops_total_normal = 3 * L * f_layer

flops_fwd_ckpt = L * f_layer
flops_recompute = L * f_layer  # 段内每层多算一次前向
flops_bwd_ckpt = 2 * L * f_layer
flops_total_ckpt = 4 * L * f_layer
overhead = 4 / 3 - 1 = 0.33 = 33%
```

采用选择性检查点时，你只重算注意力核（attention kernel），而非整层：

```
flops_recompute_selective = L * f_attention ~= L * f_layer * 0.15
overhead_selective = (3 + 0.15) / 3 - 1 = 0.05 = 5%
```

### 内存节省模型

每层的激活体积为 `A`。对于 `L` 层，总激活内存为 `L * A`。

全量检查点（段大小为 1）：只保存 `L * input_volume`（对标准 Transformer 约为 `L * 1/10 A`）。可省下约 `9 * L * A * 1/10`。

每 `k` 层做一次检查点：保存 `L/k * A`，加上当前活跃段内 `k-1` 层的量。

当 `k = sqrt(L)` 时，内存和重计算成本都随 `sqrt(L)` 缩放——这是层成本均匀时的最优折中。

### 何时不该做检查点

- 流水线阶段中已在执行（in-flight）的最内层。它们反正都得算完。
- 当首层和末层主导该阶段的算力时的这两层（在 Transformer 中很罕见）。
- 已经使用 FlashAttention 的注意力核——Flash 本身就能快速重算 softmax，所以在它之上再加层级检查点收益甚微。

### 实现模式

1. **函数包装器：** 用 `torch.utils.checkpoint.checkpoint(fn, input)` 包住一段。PyTorch 只保存 `input`，其余在反向时重算。

2. **装饰器式：** 把层标记为可检查点；训练器在配置阶段决定哪些段被包装。

3. **手动显式重计算：** 自己编写反向传播，调用一个自定义的 `recompute_forward`，用保存的输入复现前向。

这三种方式给出相同的功能结果。包装器是标准惯用法。

### 与 TP / PP / FP8 的交互

- **张量并行（Tensor parallel）：** 检查点输入在重算时必须重新 gather 或 rescatter；要处理好通信开销。
- **流水线并行（Pipeline parallel）：** 典型做法是对每个流水线阶段的前向做检查点，使逆序的微批可以复用激活内存。
- **FP8 重计算：** 重计算期间更新的 amax 历史必须与原始前向一致，否则 FP8 的 scale 会漂移。大多数框架会对 scale 做快照。

## 动手构建

### 步骤 1：一个带分段的玩具模型

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

### 步骤 2：需要全部激活值的朴素反向

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

### 步骤 3：每 k 层检查点的内存

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

## 实际使用

- **torch.utils.checkpoint**：`from torch.utils.checkpoint import checkpoint`——PyTorch 中的标准包装器。包住一个函数；只保存输入，反向时重算。
- **Megatron-Core 激活重计算**：支持 `selective`、`full` 和 `block` 三种模式。是 2024 年以后前沿训练的标配。
- **FSDP2 offload**：在 FSDP2 中用 `module.to_empty(device="cpu")` 搭配 `offload_policy`，把激活值分片到 CPU 而非重算。
- **DeepSpeed ZeRO-Offload**：对优化器状态和激活值做 CPU 卸载，与检查点互补。

## 交付产物

本课产出 `outputs/prompt-activation-recompute-policy.md`——一个提示词，它接收你的模型配置（层数、隐藏维度、序列长度、批大小）以及可用的 GPU 内存，并输出一份逐层的重计算策略（none / selective / full / offload）。

## 练习

1. 验证正确性。运行 `model_forward` + `model_backward`（全量激活）对比 `model_forward_checkpointed` + `model_backward_checkpointed`（分段）。参数梯度必须在机器精度内完全一致。

2. 把段大小 `k` 从 1 扫到 `L`。绘制 FLOP 开销和内存曲线。找出曲线的拐点。

3. 实现选择性检查点：保存注意力模块的输入，但不保存其中间量。在 seq=8192、32 层的模型上，测量它相对于全层检查点的 FLOP 开销。

4. 加入卸载。把段输入保存到一个模拟的「CPU 缓冲区」（一个单独的列表）。把「PCIe 带宽」测量为字节/时间，找出卸载与重计算之间的盈亏平衡点。

5. 对一个真实的 PyTorch Transformer，在用与不用 `torch.utils.checkpoint` 的情况下做基准测试。测量内存（通过 `torch.cuda.max_memory_allocated`）和单步耗时。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| 梯度检查点（Gradient checkpointing） | 「靠重做前向来省内存」 | 只保存段输入；在反向期间重计算中间量，以得到支撑梯度的张量 |
| 激活重计算（Activation recomputation） | 「跟检查点一回事」 | 同一技术的 HPC 风格叫法 |
| 段大小（Segment size, k） | 「每个检查点管几层」 | 中间量被一起丢弃并一起重新生成的层数 |
| 选择性检查点（Selective checkpointing） | 「Korthikanti 的技巧」 | 只重算那些存起来昂贵的激活值（注意力 softmax）；保留便宜的 |
| 全量检查点（Full checkpointing） | 「朴素版本」 | 在每一段中重算每一层的中间量 |
| 块检查点（Block checkpointing） | 「粗粒度」 | 对整个 Transformer 块做检查点；最大粒度 |
| FLOP 开销（FLOP overhead） | 「算力税」 | 每步的额外 FLOPs =（重计算 FLOPs）/（fwd + bwd FLOPs）；朴素 33%，选择性 5% |
| 激活卸载（Activation offload） | 「搬到 CPU 去」 | 在前向到反向之间把激活值移到 CPU 内存；重计算的替代方案 |
| sqrt-L 法则（sqrt-L rule） | 「经典最优」 | 对成本均匀的层，最优检查点间距为 sqrt(L) 层 |
| 注意力-softmax 体积（Attention-softmax volume） | 「O(L^2) 问题」 | L^2 * heads * batch 个浮点数；在长上下文下主导激活内存 |

## 延伸阅读

- [Chen et al., 2016 -- "Training Deep Nets with Sublinear Memory Cost"](https://arxiv.org/abs/1604.06174) -- 最初形式化梯度检查点的论文
- [Korthikanti et al., 2022 -- "Reducing Activation Recomputation in Large Transformer Models"](https://arxiv.org/abs/2205.05198) -- 选择性激活重计算与形式化的成本分析
- [Pudipeddi et al., 2020 -- "Training Large Neural Networks with Constant Memory using a New Execution Algorithm"](https://arxiv.org/abs/2002.05645) -- 通过反向模式重新生成实现恒定内存的替代方案
- [Ren et al., 2021 -- "ZeRO-Offload: Democratizing Billion-Scale Model Training"](https://arxiv.org/abs/2101.06840) -- 大规模下的激活卸载
- [PyTorch torch.utils.checkpoint docs](https://pytorch.org/docs/stable/checkpoint.html) -- 标准 API
- [Megatron-Core activation recomputation documentation](https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/features/memory_optimizations.html) -- selective、full 和 block 模式
