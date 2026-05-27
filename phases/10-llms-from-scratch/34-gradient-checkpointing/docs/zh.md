# 梯度检查点（Gradient Checkpointing）与激活重计算（Activation Recomputation）

> 反向传播会保留每一个中间激活值。在70B参数和128K上下文的规模下，每个rank的激活值高达3 TB。检查点（Checkpointing）用FLOPs换取内存：不保存而是重新计算。问题在于选择丢弃哪些片段，答案并非“全部丢弃”。

**类型：** 构建
**语言：** Python（使用numpy，可选torch）
**先决条件：** 阶段10 第04课（预训练迷你GPT），阶段10 第05课（伸缩与分布式）
**时间：** ~70分钟

## 问题

训练一个Transformer时，每一层都会存储反向传播所需每个运算的输入：注意力输入、Q/K/V投影、softmax输出、FFN输入、归一化输出和残差流（Residual Stream）。对于隐藏层大小 `d`、序列长度 `L`、批量 `B` 的层，每层约为 `12 * B * L * d` 个浮点数。

对于 `d=8192, L=8192, B=1`，BF16下每层为800 MB。64层模型就是51 GB的激活值——这还没有乘以微批大小，没有加上注意力softmax中间值（每头 `L^2`），也没有考虑张量并行（Tensor-Parallel）产生的部分副本。

双方账单：BF16权重加上优化器状态可能适合80GB显存，但激活值会超过限制。梯度检查点（Gradient Checkpointing，又名激活重计算（Activation Recomputation））是标准解决方法：丢弃大部分激活值；在反向传播时重新执行前向传播以重新获取它们。代价：额外的FLOPs。收益：内存按检查点段数与总层数的比例下降。

简单实现下，检查点每步大约增加33%的前向FLOPs。若做得巧妙——根据Korthikanti等人的“智能选择”进行选择性检查点——可在不到5%的FLOPs开销下节省5倍内存。配合FP8矩阵乘法、FSDP卸载（Offload）和专家并行MoE，这一点至关重要：你既无法承受内存的浪费，也无法承受计算的无谓消耗。

## 概念

### 反向传播实际需要什么

`output = layer(input)`。反向传播需要 `grad_input` 和 `grad_params`。计算它们需要：

- `input`（计算线性层的 `grad_params = input.T @ grad_output`）
- 某些激活导数中间值（ReLU/GELU/softmax的导数依赖于激活值）

前向传播会在自动微分图（Autograd Graph）中自动存储这些值。每个 `tensor.retain_grad()` 以及每个需要其输入的运算都会保留一个引用。

### 朴素的全量检查点（Naive Full Checkpointing）

将网络拆分为 `N` 个段。在前向传播中，只存储每个段的*输入*。当反向传播需要中间值时，重新运行该段的前向传播以具体化它们，然后进行微分。

示例：32层Transformer拆分为32个段，每段1层。

- 内存：32个层输入（小） vs 32 *（每层激活体积）（巨大）。
- 额外计算：每段额外一次前向，即总前向FLOPs增加约33%（因为反向传播是前向的2倍，完整步骤变为1 + 1 + 2 = 4个单位，而非1 + 2 = 3）。

这是原始的Chen et al. 2016方案：每 `sqrt(L)` 层设置一个检查点，以平衡内存和计算。对于L=64，即8个检查点。

### 选择性检查点（Selective Checkpointing，Korthikanti 2022）

并非所有激活的成本相同。注意力softmax输出是 `B*L*L*heads`，随序列长度呈*二次*增长。FFN隐藏激活是 `B*L*4d`，线性增长。对于长序列，softmax占据主导。

选择性检查点保留廉价存储的激活值（线性投影、残差），仅重新计算代价高的部分（注意力）。你付出极少的FLOPs进行重计算，但节省了 O(L^2) 的内存。

Megatron-Core将其实现为“选择性”激活重计算。2024年以后的大部分前沿训练中都在使用。

### 卸载（Offload）

重计算的替代方案：在前向与反向之间将激活值传输到CPU内存。需要PCIe带宽；在空闲带宽超过重新具体化（Rematerialization）成本时有利。混合策略很常见：检查点一部分层，卸载另一部分。

FSDP2将卸载作为一级选项。当GPU受内存瓶颈限制但CPU-GPU传输仍有裕量时，卸载表现出色。

### 重计算成本模型

每 `L` 层中每 `k` 层一个朴素检查点时的每步FLOPs：

```
flops_fwd_normal = L * f_layer
flops_bwd_normal = 2 * L * f_layer
flops_total_normal = 3 * L * f_layer

flops_fwd_ckpt = L * f_layer
flops_recompute = L * f_layer  # 段内每层额外一次前向
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

全量检查点（段大小为1）：只存储 `L * input_volume`（标准Transformer约为 `L * 1/10 A`）。节省 ~`9 * L * A * 1/10`。

每 `k` 层一个检查点：存储 `L/k * A` 加上活动段内 `k-1` 层的值。

当 `k = sqrt(L)` 时，内存和重计算成本均与 `sqrt(L)` 成正比——对于成本均匀的层，这是最优权衡。

### 何时不使用检查点

- 流水线阶段（Pipeline Stage）中最内层的层已经在进行中。它们无论如何都要完成。
- 第一层和最后一层，如果它们主导了阶段的计算（Transformer中很少见）。
- 已经使用FlashAttention的注意力核——Flash已经快速重计算softmax，因此额外的层级检查点增加甚少。

### 实现模式

1. **函数包装器：** 将段包装在 `torch.utils.checkpoint.checkpoint(fn, input)` 中。PyTorch仅存储 `input`，在反向传播时重新计算其他所有内容。

2. **基于装饰器：** 将层标注为可检查点；训练器在配置时决定哪些段被包装。

3. **手动显式重计算：** 自己编写反向传播，调用自定义的 `recompute_forward`，它使用存储的输入重复前向传播。

三种方法产生相同的功能结果。包装器是标准习惯用法。

### 与TP / PP / FP8的交互

- **张量并行（Tensor Parallel）：** 检查点输入必须在重计算时进行集合（Gather）或重新分散（Rescatter）；处理好通信成本。
- **流水线并行（Pipeline Parallel）：** 典型模式是对每个流水线阶段的前向进行检查点，以便反向顺序的微批可以重用激活内存。
- **FP8重计算：** 重计算期间更新的amax历史必须与原始前向的匹配，否则FP8缩放会漂移。大多数框架会保存缩放值。

## 构建它

### 第1步：带段的玩具模型

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

### 第2步：需要所有激活值的朴素反向传播

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

### 第3步：每k层检查点内存

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

### 第4步：成本模型

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

### 第5步：内存估计器

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

### 第6步：最优段大小

```python
def optimal_segment(n_layers):
    return int(round(np.sqrt(n_layers)))
```

### 第7步：选择性检查点决策

```python
def should_recompute(layer_type, activation_bytes, recompute_flops_ratio):
    if layer_type == "attention" and activation_bytes > 100 * 1e6:
        return True
    if layer_type == "ffn" and activation_bytes > 500 * 1e6:
        return recompute_flops_ratio < 0.1
    return False
```

## 使用它

- **torch.utils.checkpoint**：`from torch.utils.checkpoint import checkpoint` —— PyTorch 中的标准包装器。包装一个函数；仅存储输入，在反向传播时重计算。
- **Megatron-Core 激活重计算**：支持 `selective`（选择性）、`full`（全量）和 `block`（块）模式。是 2024 年后前沿训练的标准。
- **FSDP2 卸载**：`module.to_empty(device="cpu")` 配合 FSDP2 的 `offload_policy`，将激活值分片到 CPU 而非重计算。
- **DeepSpeed ZeRO-Offload**：优化器状态和激活值的 CPU 卸载，与检查点互补。

## 交付它

本课程生成 `outputs/prompt-activation-recompute-policy.md` —— 一份提示词，接受你的模型配置（层数、隐藏大小、序列长度、批量大小）和可用 GPU 内存，输出每层的重计算策略（无 / 选择性 / 全量 / 卸载）。

## 练习

1. 验证正确性。运行 `model_forward` + `model_backward`（全量激活） vs `model_forward_checkpointed` + `model_backward_checkpointed`（分段）。参数梯度必须在机器精度内一致。

2. 扫描段大小 `k` 从 1 到 `L`。绘制 FLOP 开销和内存曲线。找到曲线转折点。

3. 实现选择性检查点：存储注意力模块的输入但不存储其中间值。对一个 32 层、seq=8192 的模型，测量 FLOP 开销与全层检查点的差异。

4. 添加卸载。将段输入保存到模拟的“CPU 缓冲区”（一个单独的列表）。以字节/时间测量“PCIe 带宽”，找到卸载与重计算之间的平衡点。

5. 对一个真实的 PyTorch Transformer 进行基准测试，对比使用和不使用 `torch.utils.checkpoint`。测量内存（通过 `torch.cuda.max_memory_allocated`）和每步时间。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| 梯度检查点（Gradient checkpointing） | “通过重做前向来节省内存” | 仅存储段输入；在反向传播时重计算中间值以获取梯度支撑张量 |
| 激活重计算（Activation recomputation） | “和检查点一样” | HPC 风格的命名，指同一技术 |
| 段大小（k） | “每个检查点多少层” | 被丢弃并一起重新具体化的中间值所属的层数 |
| 选择性检查点（Selective checkpointing） | “Korthikanti的窍门” | 仅重计算存储成本高的激活值（注意力softmax）；保留廉价的 |
| 全量检查点（Full checkpointing） | “朴素版本” | 重计算每个段中每一层的中间值 |
| 块检查点（Block checkpointing） | “粗粒度” | 检查点整个Transformer块；粒度最大 |
| FLOP 开销（FLOP overhead） | “计算税” | 每步额外FLOPs =（重计算FLOPs）/（前向+反向FLOPs）；朴素33%，选择性5% |
| 激活卸载（Activation offload） | “发送到CPU” | 在前向->反向之间将激活值移动到CPU内存；替代重计算 |
| sqrt-L 规则（sqrt-L rule） | “经典最优” | 对于成本均匀的层，最优检查点间隔为 sqrt(L) 层 |
| 注意力softmax体积（Attention-softmax volume） | “O(L^2)问题” | L^2 * 头数 * 批量个浮点数；在长上下文下主导激活内存 |

## 延伸阅读

- [Chen et al., 2016 —— "Training Deep Nets with Sublinear Memory Cost"](https://arxiv.org/abs/1604.06174) —— 正式提出梯度检查点的原始论文
- [Korthikanti et al., 2022