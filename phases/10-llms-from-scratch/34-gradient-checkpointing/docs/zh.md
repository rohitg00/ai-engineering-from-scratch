# Gradient Checkpointing 与激活重计算（Gradient Checkpointing and Activation Recomputation）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Backprop（反向传播）会保留每一个中间 activation。70B 参数、128K context 下，单卡（rank）的 activation 体量是 3 TB。Checkpointing 用 FLOPs 换内存：不存就重算。问题是：哪些段（segment）应该丢掉？答案不是「全丢」。

**Type:** Build
**Languages:** Python（带 numpy，可选 torch）
**Prerequisites:** Phase 10 Lesson 04（Pre-Training Mini-GPT）、Phase 10 Lesson 05（Scaling & Distributed）
**Time:** ~70 分钟

## 问题（The Problem）

训练一个 transformer 时，每一层都要存下所有反向需要求导的 op 的输入：attention 的输入、Q/K/V projections、softmax 输出、FFN 输入、norm 输出，以及残差流（residual stream）。对一个 hidden size 为 `d`、序列长度为 `L`、batch 为 `B` 的层来说，这大致是每层 `12 * B * L * d` 个浮点数。

`d=8192, L=8192, B=1` 时，BF16 下每层就是 800 MB。一个 64 层的模型就是 51 GB 的 activations——而且这还没乘上 microbatch 大小、还没加上 attention-softmax 的中间结果（每个 head 是 `L^2`），也没考虑 tensor-parallel 的部分副本。

两头夹击的账本：BF16 权重加上 optimizer 状态也许还能塞进 80GB，但 activations 把你顶出去了。Gradient checkpointing（又叫 activation recomputation，激活重计算）是标准解法。把大多数 activations 丢掉；反向时再跑一次前向把它们拿回来。代价：多花 FLOPs。收益：内存按 checkpoint 段数与总层数之比下降。

笨办法实现的话，checkpointing 大约让每步前向 FLOPs 多花 33%。聪明地做——按 Korthikanti 等人提出的「smart selection」做选择性 checkpointing——只用不到 5% 的 FLOP 开销就能省下 5 倍内存。再叠加上 FP8 matmul、FSDP offload、专家并行（expert-parallel）的 MoE，这件事就更要紧了：内存和被浪费的算力，你哪一头都吃不消。

## 概念（The Concept）

### 反向到底需要什么（What Backward Actually Needs）

`output = layer(input)`。反向需要 `grad_input` 和 `grad_params`。要算这两个，它需要：

- `input`（线性层里 `grad_params = input.T @ grad_output` 要用它）
- 一些激活函数导数的中间量（ReLU/GELU/softmax 的导数依赖于激活值本身）

前向时这些会自动存进 autograd 图。每个 `tensor.retain_grad()`、每个需要其输入的 op 都会持有引用。

### 朴素版全量 checkpointing（Naive Full Checkpointing）

把网络切成 `N` 段。前向时只存每段的*输入*。反向需要中间量时，重跑这一段的前向把它们 materialize 出来，再求导。

举例：32 层 transformer 切成 32 段，每段 1 层。

- 内存：32 个 layer-input（小） vs 32 *（每层 activation 体积）（大）。
- 多花的算力：每段多一次前向，也就是总前向 FLOPs 多 ~33%（因为反向是前向的 2 倍，整步从 1 + 2 = 3 单位变成 1 + 1 + 2 = 4 单位）。

这就是 Chen 等人 2016 年的原始配方：每 `sqrt(L)` 层放一个 checkpoint，让内存与算力达到平衡。L=64 时就是 8 个 checkpoint。

### 选择性 checkpointing（Selective Checkpointing, Korthikanti 2022）

不是所有 activation 代价都一样。Attention 的 softmax 输出是 `B*L*L*heads`，随序列长度*二次*增长。FFN 的 hidden activation 是 `B*L*4d`，线性增长。长序列下 softmax 占主导。

选择性 checkpointing 把存起来便宜的 activation（线性投影、residual）留住，只重算贵的那部分（attention）。重算花的 FLOPs 微乎其微，但能省下 O(L^2) 的内存。

Megatron-Core 把这种做法实现为「selective」激活重计算。2024 年以来大多数前沿训练任务都在用。

### Offload

重计算之外的另一条路：把 activation 在前向到反向之间搬到 CPU RAM 上。这要吃 PCIe 带宽；当空闲带宽超过重物化（rematerialization）的代价时划算。混合策略很常见：一部分层 checkpoint，另一部分 offload。

FSDP2 把 offload 当作一等公民。GPU 卡在内存上、但 CPU-GPU 传输还有富余时，offload 大放异彩。

### 重计算成本模型（Recompute Cost Model）

朴素 checkpointing、`L` 层中每 `k` 层一个 checkpoint 时的每步 FLOPs：

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

选择性 checkpointing 下只重算 attention kernel，不重算整层：

```
flops_recompute_selective = L * f_attention ~= L * f_layer * 0.15
overhead_selective = (3 + 0.15) / 3 - 1 = 0.05 = 5%
```

### 内存节省模型（Memory Savings Model）

每层 activation 体积：`A`。`L` 层时总 activation 内存：`L * A`。

全量 checkpoint（段大小为 1）：只存 `L * input_volume`（标准 transformer 大约 `L * 1/10 A`）。省下大约 `9 * L * A * 1/10`。

每 `k` 层一个 checkpoint：存 `L/k * A`，加上当前活跃段内 `k-1` 层的量。

`k = sqrt(L)` 时，内存与重算开销都按 `sqrt(L)` 放缩——这是各层代价均匀时的最优折中。

### 什么时候不该 checkpoint（When Not to Checkpoint）

- 流水线（pipeline）阶段里已经在飞行中的最内层。它们反正得跑完。
- 占该 stage 算力主导的首层和末层（在 transformer 里很少见）。
- 已经用了 FlashAttention 的 attention kernel——Flash 已经把 softmax 重算得很快，再加一层 layer 级别的 checkpointing 收益寥寥。

### 实现模式（Implementation Patterns）

1. **函数包装器：** 用 `torch.utils.checkpoint.checkpoint(fn, input)` 包住一段。PyTorch 只存 `input`，反向时把别的全部重算。

2. **基于装饰器：** 给某些层打上「可 checkpoint」标签；trainer 在配置阶段决定哪些段要被包起来。

3. **手写显式重算：** 自己写反向，调用一个自定义的 `recompute_forward`，用保存的 input 复刻前向。

三种方式功能上等价。包装器是标准写法。

### 与 TP / PP / FP8 的相互作用（Interaction with TP / PP / FP8）

- **Tensor parallel：** checkpoint 的输入在重算时必须重新 gather 或 rescatter；要算上通信开销。
- **Pipeline parallel：** 典型做法是对每个 pipeline-stage 的前向做 checkpoint，让倒序的 microbatch 能复用 activation 内存。
- **FP8 重算：** 重算时更新的 amax 历史必须和原始前向一致，否则 FP8 scale 会漂移。多数框架会对 scale 做快照。

## 动手实现（Build It）

### Step 1：带分段的玩具模型（A Toy Model With Segments）

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

### Step 2：需要全部 activation 的朴素反向（Naive Backward Needing All Activations）

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

### Step 3：每 k 层一个 checkpoint 的内存版本（Checkpoint-Every-k Memory）

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

### Step 4：成本模型（Cost Model）

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

### Step 5：内存估算器（Memory Estimator）

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

### Step 6：最优段大小（Optimal Segment Size）

```python
def optimal_segment(n_layers):
    return int(round(np.sqrt(n_layers)))
```

### Step 7：选择性 checkpoint 决策（Selective Checkpoint Decision）

```python
def should_recompute(layer_type, activation_bytes, recompute_flops_ratio):
    if layer_type == "attention" and activation_bytes > 100 * 1e6:
        return True
    if layer_type == "ffn" and activation_bytes > 500 * 1e6:
        return recompute_flops_ratio < 0.1
    return False
```

## 用起来（Use It）

- **torch.utils.checkpoint**：`from torch.utils.checkpoint import checkpoint`——PyTorch 里的标准包装器。包住一个函数；只存输入，反向时重算。
- **Megatron-Core 激活重计算**：支持 `selective`、`full`、`block` 三种模式。2024 年以来前沿训练的标配。
- **FSDP2 offload**：在 FSDP2 里搭配 `offload_policy` 使用 `module.to_empty(device="cpu")`，把 activation 切片到 CPU 而不是重算。
- **DeepSpeed ZeRO-Offload**：把 optimizer 状态和 activation 都 offload 到 CPU，与 checkpointing 互补。

## 上线部署（Ship It）

本课会产出 `outputs/prompt-activation-recompute-policy.md`——一个 prompt：输入你的模型配置（层数、hidden、seq、batch）和可用 GPU 内存，产出每层的重算策略（none / selective / full / offload）。

## 练习（Exercises）

1. 验证正确性。跑 `model_forward` + `model_backward`（全量 activation）对比 `model_forward_checkpointed` + `model_backward_checkpointed`（分段）。参数 gradient 必须在机器精度下完全一致。

2. 把段大小 `k` 从 1 扫到 `L`。画出 FLOP 开销和内存。找出曲线的拐点。

3. 实现选择性 checkpointing：保存 attention 模块的输入但不保存其中间量。在 32 层模型、seq=8192 的设置下，测量与全层 checkpointing 相比的 FLOP 开销。

4. 加上 offload。把段输入存到一个模拟的「CPU buffer」（一个独立列表）。把「PCIe 带宽」按 字节/时间 度量，找到 offload 与重算之间的盈亏平衡点。

5. 用真实的 PyTorch transformer 跑一组 benchmark：开 / 不开 `torch.utils.checkpoint`。用 `torch.cuda.max_memory_allocated` 量内存、量步耗时。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Gradient checkpointing | 「靠重跑前向省内存」 | 只存段输入；反向时重算中间量以拿到反向所需的张量 |
| Activation recomputation | 「就是 checkpointing」 | 同一技术的 HPC 风味叫法 |
| Segment size (k) | 「每个 checkpoint 含几层」 | 一组被一起丢弃并重物化的层数 |
| Selective checkpointing | 「Korthikanti 的小技巧」 | 只重算存起来贵的 activation（attention softmax）；便宜的留住 |
| Full checkpointing | 「朴素版」 | 每段里每层的中间量都重算 |
| Block checkpointing | 「粗粒度」 | 对整个 transformer block 做 checkpoint；粒度最粗 |
| FLOP overhead | 「算力税」 | 每步多花的 FLOPs =（重算 FLOPs）/（fwd + bwd FLOPs）；朴素 33%，选择性 5% |
| Activation offload | 「搬去 CPU」 | 把 activation 在 forward→backward 之间搬到 CPU RAM；重算的替代品 |
| sqrt-L rule | 「经典最优」 | 各层代价均匀时，最优 checkpoint 间距是 sqrt(L) 层 |
| Attention-softmax volume | 「O(L^2) 问题」 | L^2 * heads * batch 个浮点；长 context 下主导 activation 内存 |

## 延伸阅读（Further Reading）

- [Chen et al., 2016 -- "Training Deep Nets with Sublinear Memory Cost"](https://arxiv.org/abs/1604.06174) -- 把 gradient checkpointing 形式化的开山论文
- [Korthikanti et al., 2022 -- "Reducing Activation Recomputation in Large Transformer Models"](https://arxiv.org/abs/2205.05198) -- 选择性激活重计算与正式的成本分析
- [Pudipeddi et al., 2020 -- "Training Large Neural Networks with Constant Memory using a New Execution Algorithm"](https://arxiv.org/abs/2002.05645) -- 通过反向模式重物化实现的常数内存替代方案
- [Ren et al., 2021 -- "ZeRO-Offload: Democratizing Billion-Scale Model Training"](https://arxiv.org/abs/2101.06840) -- 大规模 activation offload
- [PyTorch torch.utils.checkpoint docs](https://pytorch.org/docs/stable/checkpoint.html) -- 标准 API
- [Megatron-Core activation recomputation documentation](https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/features/memory_optimizations.html) -- selective、full、block 模式
