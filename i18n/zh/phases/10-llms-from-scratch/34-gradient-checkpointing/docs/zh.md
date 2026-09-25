# 梯度检查点与激活重计算

> 反向传播会保留每一个中间激活值。在 70B 参数、128K 上下文的规模下，每个 rank 需要存储 3 TB 的激活值。检查点机制用 FLOPs 换取内存：重计算而非保存。问题在于应该丢弃哪些分段，答案并不是"全部丢弃"。

**Type:** Build
**Languages:** Python（含 numpy，可选 torch）
**Prerequisites:** Phase 10 Lesson 04（Pre-Training Mini-GPT）、Phase 10 Lesson 05（Scaling & Distributed）
**Time:** ~70 分钟

## 问题所在

训练 Transformer 时，每一层都会存储反向传播中每个被求导操作的输入：注意力输入、Q/K/V 投影、softmax 输出、FFN 输入、norm 输出以及残差流。对于隐藏层大小为 `d`、序列长度为 `L`、批大小为 `B` 的层，每个层的存储量约为 `12 * B * L * d` 个浮点数。

对于 `d=8192, L=8192, B=1`，BF16 下每层占用 800 MB。一个 64 层模型的激活值达 51 GB——这还没乘以微批大小，还没加上注意力 softmax 的中间值（每个头 `L^2`），也还没考虑张量并行的部分副本。

这笔账是双向的：BF16 权重加优化器状态或许能装进 80GB，但激活值会把你挤爆。梯度检查点（又称激活重计算）是标准解法：丢弃大部分激活值，在反向传播时重跑前向计算将其复原。代价：额外的 FLOPs。收益：内存按检查点分段数与总层数之比下降。

若朴素地实现，检查点机制每步大约增加 33% 的前向 FLOPs。若实现得当——按 Korthikanti 等人提出的"智能选择"进行选择性检查点——可以以不到 5% 的 FLOP 开销节省 5 倍内存。而在 FP8 矩阵乘法、FSDP offload 和专家并行 MoE 的背景下，这一点尤为重要：内存和浪费的算力你都承担不起。

## 核心概念

### 反向传播到底需要什么

`output = layer(input)`。反向传播需要 `grad_input` 和 `grad_params`。要计算它们，需要：

- `input`（用于计算线性层的 `grad_params = input.T @ grad_output`）
- 一些激活导数的中间值（ReLU/GELU/softmax 的导数依赖于激活值本身）

前向传播会自动将这些存储在 autograd 图中。每个 `tensor.retain_grad()` 以及每个需要其输入的操作都会保留一个引用。

### 朴素的全量检查点

将网络切分为 `N` 个分段。前向传播时，只保存每个分段的*输入*。当反向传播需要中间值时，重跑该分段的前向计算将其重新生成，然后再求导。

示例：32 层 Transformer 切分为 32 个每层一个的分段。

- 内存：32 个层输入（很小）对比 32 *（每层激活体量）（巨大）。
- 额外计算：每个分段额外一次前向，即总共约多 33% 的前向 FLOPs（由于反向是前向的 2 倍，完整一步从 1 + 2 = 3 个单位变成 1 + 1 + 2 = 4 个单位）。

这就是 Chen 等人 2016 年的原始方案：每 `sqrt(L)` 层设一个检查点，以平衡内存与计算。对于 L=64，即 8 个检查点。

### 选择性检查点（Korthikanti 2022）

并非所有激活值的代价都相同。注意力 softmax 输出为 `B*L*L*heads`，且随序列长度*二次方*增长。FFN 隐藏激活为 `B*L*4d`，随序列长度线性增长。对于长序列，softmax 占主导。

选择性检查点保留存储代价低的激活值（线性投影、残差），只重计算代价高的（注意力）。你只需为重计算付出极少的 FLOPs，却省下了 O(L^2) 的内存。

Megatron-Core 将此实现为"选择性"激活重计算。大多数 2024 年后的前沿训练都在使用。

### Offload

重计算之外的替代方案：在前向和反向之间把激活值转移到 CPU 内存。需要 PCIe 带宽；当空闲带宽超过重生成（rematerialization）的代价时才有利。混合策略很常见：部分层做检查点，其他层做 offload。

FSDP2 将 offload 作为一等选项提供。当 GPU 受内存瓶颈限制而 CPU-GPU 传输尚有余量时，offload 表现出色。

### 重计算代价模型

每 `k` 层做一次朴素检查点（共 `L` 层）时，每步的 FLOPs：

```
flops_fwd_normal = L * f_layer
flops_bwd_normal = 2 * L * f_layer
flops_total_normal = 3 * L * f_layer

flops_fwd_ckpt = L * f_layer
flops_recompute = L * f_layer  # one extra forward per layer in the segment
flops_bwd_ckpt = 2 * L * f_layer
flops_total_ckpt = 4 * L * f_layer
overhead = 4 / 3 - 1 = 0.33 = 33%
```

使用选择性检查点时，只重计算注意力核心，而非整个层：

```
flops_recompute_selective = L * f_attention ~= L * f_layer * 0.15
overhead_selective = (3 + 0.15) / 3 - 1 = 0.05 = 5%
```

### 内存节省模型

每层激活体量：`A`。对于 `L` 层，总激活内存为：`L * A`。

全量检查点（分段大小为 1）：只保存 `L * input_volume`（标准 Transformer 约为 `L * 1/10 A`）。节省约 `9 * L * A * 1/10`。

每 `k` 层设一个检查点：保存 `L/k * A` 加上活跃分段内 `k-1` 层的激活量。

在 `k = sqrt(L)` 时，内存与重计算代价均随 `sqrt(L)` 缩放——这是等代价层下的最优折中。

### 何时不该做检查点

- 流水线阶段中已在执行中的最内层。它们无论如何都要跑完。
- 若首尾层主导该阶段的计算（在 Transformer 中很少见），则不对它们做检查点。
- 已使用 FlashAttention 的注意力核心——Flash 本身已经在快速重计算 softmax，因此额外的层级检查点收益甚微。

### 实现模式

1. **函数包装器：** 用 `torch.utils.checkpoint.checkpoint(fn, input)` 包装一个分段。PyTorch 只保存 `input`，其余在反向传播时重计算。

2. **基于装饰器：** 将层标记为可检查点；训练器在配置阶段决定包装哪些分段。

3. **手动显式重计算：** 自己编写反向传播，调用自定义的 `recompute_forward`，用保存的输入复制前向计算。

三者的功能结果相同。包装器是标准惯用法。

### 与 TP / PP / FP8 的交互

- **张量并行：** 检查点输入在重计算时必须重新 gather 或 rescatter；需处理通信开销。
- **流水线并行：** 典型模式是对每个流水线阶段的前向做检查点，使逆序微批可以复用激活内存。
- **FP8 重计算：** 重计算期间更新的 amax 历史必须与原始前向一致，否则 FP8 缩放因子会漂移。大多数框架会对缩放因子做快照。

```figure
activation-recompute
```

## 动手构建

### 步骤 1：带分段的玩具模型

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

### 步骤 2：需要全部激活值的朴素反向传播

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

### 步骤 4：代价模型

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

### 步骤 6：最优分段大小

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

## 使用它

- **torch.utils.checkpoint**: `from torch.utils.checkpoint import checkpoint` — PyTorch 中的标准包装器。包装一个函数；只保存输入，在反向传播时重计算。
- **Megatron-Core 激活重计算**：支持 `selective`、`full` 和 `block` 模式。2024 年后前沿训练的标准配置。
- **FSDP2 offload**: `module.to_empty(device="cpu")` 配合 `offload_policy`，在 FSDP2 中将激活分片转移到 CPU 而非重计算。
- **DeepSpeed ZeRO-Offload**: 将优化器状态和激活值 offload 到 CPU，与检查点机制互补。

## 交付它

本课产出 `outputs/prompt-activation-recompute-policy.md`——一个提示词，它接收你的模型配置（层数、隐藏维度、序列长度、批大小）和可用 GPU 内存，并输出逐层的重计算策略（无 / 选择性 / 全量 / offload）。

## 练习

1. 验证正确性。运行 `model_forward` + `model_backward`（全量激活）对比 `model_forward_checkpointed` + `model_backward_checkpointed`（分段）。参数梯度必须精确到机器精度完全一致。

2. 扫描分段大小 `k` 从 1 到 `L`。绘制 FLOP 开销与内存曲线。找到曲线的拐点。

3. 实现选择性检查点：保存注意力模块的输入但不保存其中间值。在 seq=8192 下，测量 32 层模型中该方式相对全层检查点的 FLOP 开销。

4. 添加 offload。将分段输入保存到模拟的"CPU 缓冲区"（一个单独的列表）。用字节/时间模拟"PCIe 带宽"，找出 offload 与重计算之间的盈亏平衡点。

5. 对一个真实的 PyTorch Transformer 在启用与不启用 `torch.utils.checkpoint` 的情况下进行基准测试。测量内存（通过 `torch.cuda.max_memory_allocated`）和每步耗时。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|----------------------|
| 梯度检查点 | "重跑前向来省内存" | 只保存分段输入；在反向传播时重计算中间值以获得支撑梯度的张量 |
| 激活重计算 | "和检查点一回事" | 同一技术的 HPC 风格叫法 |
| 分段大小 (k) | "每个检查点覆盖多少层" | 其中间值被一起丢弃并一起重新生成的层数 |
| 选择性检查点 | "Korthikanti 的技巧" | 只重计算存储代价高的激活值（注意力 softmax）；保留代价低的 |
| 全量检查点 | "朴素版本" | 每个分段中的每一层中间值都重计算 |
| 块检查点 | "粗粒度" | 对整个 Transformer 块做检查点；粒度最大 |
| FLOP 开销 | "算力税" | 每步额外 FLOPs =（重计算 FLOPs）/（前向 + 反向 FLOPs）；朴素为 33%，选择性为 5% |
| 激活 offload | "搬到 CPU" | 在前向到反向之间将激活值移至 CPU 内存；重计算的替代方案 |
| sqrt-L 规则 | "经典最优解" | 对于等代价层，最优检查点间隔为 sqrt(L) 层 |
| 注意力 softmax 体量 | "O(L^2) 问题" | L^2 * heads * batch 个浮点数；长上下文下主导激活内存 |

## 延伸阅读

- [Chen et al., 2016 -- "Training Deep Nets with Sublinear Memory Cost"](https://arxiv.org/abs/1604.06174) — 形式化梯度检查点的原始论文
- [Korthikanti et al., 2022 -- "Reducing Activation Recomputation in Large Transformer Models"](https://arxiv.org/abs/2205.05198) — 选择性激活重计算及形式化代价分析
- [Pudipeddi et al., 2020 -- "Training Large Neural Networks with Constant Memory using a New Execution Algorithm"](https://arxiv.org/abs/2002.05645) — 基于逆向模式重生成的恒定内存替代方案
- [Ren et al., 2021 -- "ZeRO-Offload: Democratizing Billion-Scale Model Training"](https://arxiv.org/abs/2101.06840) — 规模化激活 offload
- [PyTorch torch.utils.checkpoint docs](https://pytorch.org/docs/stable/checkpoint.html) — 标准 API
- [Megatron-Core activation recomputation documentation](https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/features/memory_optimizations.html) — 选择性、全量与块模式