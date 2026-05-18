# Gradient Checkpointing 与 Activation Recomputation

> 反向传播会保存所有中间激活。在 70B 参数和 128K 上下文的规模下，每个 rank 的激活占用高达 3 TB。Checkpointing 用 FLOPs 换内存：不保存，而是重新计算。问题是该丢弃哪些段，而答案不是"全部"。

**类型：** Build
**语言：** Python（使用 numpy，可选 torch）
**前置知识：** Phase 10 Lesson 04（Pre-Training Mini-GPT）、Phase 10 Lesson 05（Scaling & Distributed）
**时间：** ~70 分钟

## The Problem

训练 transformer 时，每一层都需要保存每个可微操作的输入：attention 输入、Q/K/V 投影、softmax 输出、FFN 输入、norm 输出以及残差流。对于隐藏维度为 `d`、序列长度为 `L`、batch 为 `B` 的一层，每个层的激活量约为 `12 * B * L * d` 个浮点数。

对于 `d=8192, L=8192, B=1`，BF16 下每层就是 800 MB。一个 64 层模型的激活达到 51 GB——这还没乘以 microbatch size，还没加上 attention-softmax 的中间量（每 head 是 `L^2`），也没考虑 tensor-parallel 的局部副本。

两面账单：BF16 权重加优化器状态也许能塞进 80GB，但激活会让你爆显存。Gradient checkpointing（又称 activation recomputation）是标准解法。丢弃大部分激活；在反向时重新做 forward 把它们算回来。代价：额外 FLOPs。收益：内存按 checkpoint 段数与总层数的比例下降。

如果做得 naive，checkpointing 每步大约多花 33% 的 forward-pass FLOPs。如果做得好——按照 Korthikanti 等人的 "smart selection"——可以用不到 5% 的 FLOP 开销换来 5 倍内存节省。而且随着 FP8 matmul、FSDP offload 和 expert-parallel MoE 的普及，这真的很重要：你既承受不起内存，也承受不起浪费的算力。

## The Concept

### Backward 到底需要什么

`output = layer(input)`。Backward 需要 `grad_input` 和 `grad_params`。为了计算它们，它需要：

- `input`（用于计算线性层的 `grad_params = input.T @ grad_output`）
- 一些激活导数的中间量（ReLU/GELU/softmax 的导数依赖于激活值本身）

Forward pass 会自动在 autograd 图中保存这些。每个 `tensor.retain_grad()` 和每个需要输入的 op 都会保留引用。

### Naive Full Checkpointing

把网络分成 `N` 个段。Forward 时只保存每个段的 *输入*。当 backward 需要中间量时，重新跑一遍该段的 forward 来生成它们，然后再求导。

示例：32 层 transformer，每层作为一个段，共 32 段。

- 内存：32 个 layer-input（很小） vs 32 *（每层的激活量）（巨大）。
- 额外计算：每个段多一次 forward，即总共约 33% 的额外 forward FLOPs（因为 backward 是 forward 的 2 倍，完整 step 从 1 + 2 = 3 单位变成 1 + 1 + 2 = 4 单位）。

这是 Chen 等人 2016 年的原始方案：每 `sqrt(L)` 层一个 checkpoint，以平衡内存和计算。对于 L=64，就是 8 个 checkpoints。

### Selective Checkpointing（Korthikanti 2022）

并非所有激活的代价都一样。Attention softmax 输出是 `B*L*L*heads`，随序列长度 *二次方* 增长。FFN 隐藏激活是 `B*L*4d`，随序列长度线性增长。对于长序列，softmax 占主导。

Selective checkpointing 保留存储代价低的激活（线性投影、残差），只重新计算昂贵的那些（attention）。你付出极少的重算 FLOPs，但省下了 O(L^2) 的内存。

Megatron-Core 将其实现为 "selective" activation recomputation。在大多数 2024+ 的前沿训练中被使用。

### Offload

重算的替代方案：在 forward 和 backward 之间把激活搬到 CPU RAM。需要 PCIe 带宽；当空闲带宽超过 rematerialization 的代价时才有收益。混合策略很常见：一些层 checkpoint，另一些 offload。

FSDP2 将 offload 作为一等选项提供。当 GPU 受限于内存但 CPU-GPU 传输仍有余量时，offload 特别有效。

### Recompute Cost Model

Naive checkpointing 每 `k` 层一个 checkpoint，共 `L` 层的每步 FLOPs：

```
flops_fwd_normal = L * f_layer
flops_bwd_normal = 2 * L * f_layer
flops_total_normal = 3 * L * f_layer

flops_fwd_ckpt = L * f_layer
flops_recompute = L * f_layer  # 每个段内多一次 forward
flops_bwd_ckpt = 2 * L * f_layer
flops_total_ckpt = 4 * L * f_layer
overhead = 4 / 3 - 1 = 0.33 = 33%
```

Selective checkpointing 只重算 attention kernel，而不是整层：

```
flops_recompute_selective = L * f_attention ~= L * f_layer * 0.15
overhead_selective = (3 + 0.15) / 3 - 1 = 0.05 = 5%
```

### Memory Savings Model

每层激活量：`A`。`L` 层总激活内存：`L * A`。

Full checkpoint（段大小为 1）：只存 `L * input_volume`（标准 transformer 中约 `L * 1/10 A`）。节省约 `9 * L * A * 1/10`。

每 `k` 层一个 checkpoint：存 `L/k * A` 加上活跃段内 `k-1` 层的量。

当 `k = sqrt(L)` 时，内存和重算代价都按 `sqrt(L)` 缩放——对于代价均匀的层，这是最优权衡。

### When Not to Checkpoint

- Pipeline stage 最内层已经在运行中的层。反正它们必须算完。
- 如果首层和末层主导了该 stage 的计算（在 transformer 中很少见）。
- 已经使用 FlashAttention 的 attention kernel——Flash 已经快速重算了 softmax，因此额外的层级别 checkpointing 收益很小。

### Implementation Patterns

1. **Function wrapper：** 用 `torch.utils.checkpoint.checkpoint(fn, input)` 包裹一个段。PyTorch 只存 `input`，backward 时重算其他所有内容。

2. **Decorator-based：** 将层标记为可 checkpoint；trainer 在配置时决定哪些段被包裹。

3. **Manual explicit recompute：** 自己写 backward pass，调用自定义的 `recompute_forward`，用保存的输入复制 forward 过程。

三种方式功能结果相同。Wrapper 是标准写法。

### Interaction with TP / PP / FP8

- **Tensor parallel：** checkpoint 输入必须在重算时 gather 或 rescatter；要考虑通信代价。
- **Pipeline parallel：** 典型模式是每个 pipeline stage 的 forward 都做 checkpoint，以便逆序的 microbatch 可以复用激活内存。
- **FP8 recompute：** 重算时更新的 amax history 必须与原始 forward 匹配，否则 FP8 scale 会漂移。大多数框架会 snapshot scale。

## Build It

### Step 1: A Toy Model With Segments

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

### Step 2: Naive Backward Needing All Activations

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

### Step 3: Checkpoint-Every-k Memory

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

### Step 4: Cost Model

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

### Step 5: Memory Estimator

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

### Step 6: Optimal Segment Size

```python
def optimal_segment(n_layers):
    return int(round(np.sqrt(n_layers)))
```

### Step 7: Selective Checkpoint Decision

```python
def should_recompute(layer_type, activation_bytes, recompute_flops_ratio):
    if layer_type == "attention" and activation_bytes > 100 * 1e6:
        return True
    if layer_type == "ffn" and activation_bytes > 500 * 1e6:
        return recompute_flops_ratio < 0.1
    return False
```

## Use It

- **torch.utils.checkpoint**：`from torch.utils.checkpoint import checkpoint` —— PyTorch 中的标准 wrapper。包裹一个函数；只存输入，backward 时重算。
- **Megatron-Core activation recomputation**：支持 `selective`、`full` 和 `block` 模式。2024+ 前沿训练的标准配置。
- **FSDP2 offload**：`module.to_empty(device="cpu")` 配合 FSDP2 中的 `offload_policy` 将激活 shard 到 CPU 而不是重算。
- **DeepSpeed ZeRO-Offload**：CPU offload 用于优化器状态和激活，与 checkpointing 互补。

## Ship It

本课产出 `outputs/prompt-activation-recompute-policy.md` —— 一个 prompt，接收你的模型配置（层数、隐藏维度、序列长度、batch）和可用 GPU 内存，输出每层重算策略（none / selective / full / offload）。

## Exercises

1. 验证正确性。运行 `model_forward` + `model_backward`（完整激活）与 `model_forward_checkpointed` + `model_backward_checkpointed`（分段）。参数梯度必须在机器精度下相同。

2. 扫描段大小 `k` 从 1 到 `L`。绘制 FLOP 开销和内存。找到曲线的拐点。

3. 实现 selective checkpointing：保存 attention module 的输入但不保存其中间量。在 seq=8192 的 32 层模型上测量 FLOP 开销与 full-layer checkpointing 的对比。

4. 添加 offload。将段输入保存到模拟的 "CPU buffer"（一个单独的 list）。将 "PCIe 带宽" 量化为 bytes/time，找到 offload 与 recompute 的盈亏平衡点。

5. 在真实 PyTorch transformer 上 benchmark，对比使用与不使用 `torch.utils.checkpoint` 的情况。测量内存（通过 `torch.cuda.max_memory_allocated`）和 step 时间。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Gradient checkpointing | "Save memory by redoing forward" | 只存段输入；backward 时重算中间量以获得梯度所需的张量 |
| Activation recomputation | "Same as checkpointing" | 同一技术的 HPC 风格名称 |
| Segment size (k) | "How many layers per checkpoint" | 被一起丢弃并 rematerialized 的层数 |
| Selective checkpointing | "Korthikanti's trick" | 只重算存储昂贵的激活（attention softmax）；保留便宜的 |
| Full checkpointing | "The naive version" | 在每个段内重算每层的中间量 |
| Block checkpointing | "Coarse-grained" | 对整个 transformer block 做 checkpoint；粒度最大 |
| FLOP overhead | "The compute tax" | 每步额外 FLOPs =（重算 FLOPs）/（fwd + bwd FLOPs）；naive 为 33%，selective 为 5% |
| Activation offload | "Ship to CPU" | 在 forward->backward 之间将激活搬到 CPU RAM；重算的替代方案 |
| sqrt-L rule | "The classical optimum" | 对于代价均匀的层，最优 checkpoint 间隔为 sqrt(L) 层 |
| Attention-softmax volume | "The O(L^2) problem" | L^2 * heads * batch 个浮点数；在长上下文下主导激活内存 |

## Further Reading

- [Chen et al., 2016 -- "Training Deep Nets with Sublinear Memory Cost"](https://arxiv.org/abs/1604.06174) -- 形式化 gradient checkpointing 的原始论文
- [Korthikanti et al., 2022 -- "Reducing Activation Recomputation in Large Transformer Models"](https://arxiv.org/abs/2205.05198) -- selective activation recomputation 与形式化代价分析
- [Pudipeddi et al., 2020 -- "Training Large Neural Networks with Constant Memory using a New Execution Algorithm"](https://arxiv.org/abs/2002.05645) -- 通过 reverse-mode rematerialization 实现常数内存训练的替代方案
- [Ren et al., 2021 -- "ZeRO-Offload: Democratizing Billion-Scale Model Training"](https://arxiv.org/abs/2101.06840) -- 大规模 activation offload
- [PyTorch torch.utils.checkpoint docs](https://pytorch.org/docs/stable/checkpoint.html) -- 标准 API
- [Megatron-Core activation recomputation documentation](https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/features/memory_optimizations.html) -- selective、full 和 block 模式
