# 规模化：分布式训练、FSDP、DeepSpeed

> 你的 124M 模型在单个 GPU 上训练完成。现在试试 70 亿参数。模型放不进内存。数据在单机上要训练数周。在大规模场景下，分布式训练不是可选项，而是唯一的出路。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lesson 04 (Pre-Training a Mini GPT)
**Time:** ~120 分钟

## 学习目标

- 解释三种并行方式(数据并行、张量并行、流水线并行)以及根据模型和集群规模判断各自何时必要
- 使用 PyTorch DDP 实现数据并行训练，跨多个 GPU 进行梯度同步
- 计算给定模型规模的内存预算(权重 + 优化器状态 + 梯度 + 激活值)，以确定最低硬件需求
- 配置 FSDP 或 DeepSpeed ZeRO 各阶段，将模型状态分片到多个 GPU,使超出单 GPU 内存的模型得以训练

## 问题

一个 70 亿参数的 FP16 模型仅权重就需要 14GB。Adam 优化器会为每个参数额外存储两份副本(一阶矩和二阶矩估计)，又是 28GB。反向传播期间的梯度再加 14GB。还没存任何激活值，你就已经用了 56GB。

一块 NVIDIA A100 有 80GB 显存。

80GB 中已消耗 56GB,只剩 24GB 留给激活值——即前向传播中计算出的、必须保留到反向传播时使用的中间值。对于一个 2048 token 序列、4096 维模型，单层激活值约 64MB。32 层意味着每个样本需要 2GB。batch size 为 8 时需要 16GB。你有 24GB。batch size 为 12 就会爆掉。

现在试试 700 亿参数。仅权重：FP16 下 140GB。单块 GPU 装不下。光是存放权重你至少需要 2 块 A100(2 x 80GB = 160GB)。再加上优化器状态和梯度，需要的远不止：至少 3 块 GPU,现实中根据分片策略需要 8 到 16 块。

Llama 3 405B 在 16,384 块 NVIDIA H100 GPU 上训练。通过巧妙的架构设计(Mixture of Experts 意味着每个 token 只激活一小部分参数)和训练效率优化，这次训练的估算成本为 $100 million in compute. DeepSeek V3 trained a comparable model for roughly $560 万美元。

本课涵盖使大规模训练成为可能的四种策略：数据并行、张量并行、流水线并行和全分片数据并行。你将用纯 Python 模拟每一种策略以理解其机制，然后才接触分布式训练框架。

## 概念

### 为什么必须分布式

以下是真实模型的内存计算。每个数字都是算出来的，不是估的。

| 模型 | 参数量 | 权重 (FP16) | Adam 状态 | 梯度 (FP16) | 总计(不含激活值) |
|-------|--------|----------------|-------------|------------------|----------------------|
| GPT-2 Small | 124M | 248 MB | 992 MB | 248 MB | 1.5 GB |
| Llama 3 8B | 8B | 16 GB | 64 GB | 16 GB | 96 GB |
| Llama 3 70B | 70B | 140 GB | 560 GB | 140 GB | 840 GB |
| Llama 3 405B | 405B | 810 GB | 3,240 GB | 810 GB | 4,860 GB |

"Adam 状态”这一列才是致命的。Adam 为每个参数维护一个滑动均值 (m) 和一个滑动方差 (v),均为 FP32。对 700 亿参数的模型，即 700 亿 x 4 字节 x 2 = 560GB。仅优化器就需要 7 块 A100。

单块 H100 有 80GB。Llama 3 405B 至少需要 61 块 H100 来存放权重、优化器和梯度。加上激活值，数字还会继续增长。Meta 使用 16,384 块 GPU 不是因为他们想——而是因为他们不得不。

### 数据并行

最简单的分布式策略。将整个模型复制到 N 块 GPU。把每个训练 batch 分成 N 等份。每块 GPU 对自己那份的数据执行前向和反向传播。反向传播后，对所有 GPU 的梯度取平均。每块 GPU 用相同的平均梯度更新自己的权重副本，从而保持所有副本同步。

**优点：** 吞吐量线性扩展。N 块 GPU 每步处理 N 倍的数据。通信仅限于梯度平均，可以与计算重叠。

**缺点：** 每块 GPU 都持有模型、优化器状态和梯度的完整副本。对 700 亿参数的模型，每块 GPU 需要 840GB。数据并行丝毫不能降低单 GPU 内存，只能缩短训练时间。

**数学：** 有效 batch size = per_gpu_batch_size x N。N=64 块 GPU、每 GPU batch 为 16 时，有效 batch 为 1,024。Llama 3 每步使用的有效 batch size 为 1600 万 token。

```mermaid
graph TD
    subgraph DataParallel["Data Parallelism (N=4 GPUs)"]
        B["Full Batch\n(1024 samples)"] --> S["Split"]
        S --> G1["GPU 1\nFull Model Copy\n256 samples"]
        S --> G2["GPU 2\nFull Model Copy\n256 samples"]
        S --> G3["GPU 3\nFull Model Copy\n256 samples"]
        S --> G4["GPU 4\nFull Model Copy\n256 samples"]
        G1 --> AR["AllReduce\nAverage Gradients"]
        G2 --> AR
        G3 --> AR
        G4 --> AR
        AR --> U["Update\n(identical on all GPUs)"]
    end

    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style G1 fill:#1a1a2e,stroke:#0f3460,color:#fff
    style G2 fill:#1a1a2e,stroke:#0f3460,color:#fff
    style G3 fill:#1a1a2e,stroke:#0f3460,color:#fff
    style G4 fill:#1a1a2e,stroke:#0f3460,color:#fff
    style AR fill:#1a1a2e,stroke:#51cf66,color:#fff
    style U fill:#1a1a2e,stroke:#51cf66,color:#fff
```

### 张量并行

将单个层拆分到多块 GPU 上。一次矩阵乘法被分给多块 GPU,每块计算结果的一部分。

考虑一个前馈层中形状为 (8192, 8192) 的权重矩阵。采用 4 路张量并行时，每块 GPU 持有一个 (8192, 2048) 的分片。每块 GPU 将输入与其分片相乘，得到部分结果。部分结果通过 all-reduce 或 all-gather 合并，得到完整输出。

**优点：** 降低模型权重的单 GPU 内存占用。70B 模型拆到 8 块 GPU 上，每块 GPU 只需承载约 87.5 亿参数的权重。

**缺点：** 每层之后都需要快速的 GPU 间通信。每次矩阵乘法后的 all-reduce 会增加延迟。这在 NVLink(同节点 GPU 间 900 GB/s)上表现良好，但在通过 InfiniBand(400 Gb/s,约 50 GB/s)连接的节点间表现很差。张量并行几乎总是限制在单节点内(8 块 GPU)。

**实际使用：** Megatron-LM 开创了张量并行。Llama 3 405B 在每个节点内使用 8 路张量并行。

### 流水线并行

按层拆分模型。GPU 1 运行第 1-8 层。GPU 2 运行第 9-16 层。GPU 3 运行第 17-24 层。GPU 4 运行第 25-32 层。数据沿流水线流动:GPU 1 计算自己的层并把激活值发给 GPU 2,GPU 2 计算自己的层再发给 GPU 3,依此类推。

**优点：** GPU 间通信极少——只有层边界的激活值，相比梯度或权重很小。带宽需求低，因此可以跨节点工作。

**缺点：** 流水线气泡。当 GPU 4 在对 micro-batch 1 计算前向传播时，GPU 1、2、3 都在空闲(它们已经前向传播完了自己负责的部分)。反向传播时模式反过来。朴素流水线下，N 个流水线阶段的 GPU 利用率只有 1/N。

**GPipe 和 PipeDream** 通过将 batch 拆分为 micro-batch 来解决气泡问题。GPU 1 一完成 micro-batch 1 的前向传播，就立刻开始 micro-batch 2。这样使计算在各流水线阶段之间重叠。有 M 个 micro-batch 和 N 个阶段时，气泡占比降到 (N-1)/M。使用 M=16 个 micro-batch 和 N=4 个阶段，气泡为 3/16 = 18.75% 的空闲时间。

### FSDP:全分片数据并行

FSDP 结合了数据并行的可扩展性与分片的内存效率。每块 GPU 不再持有模型的完整副本，而是只持有 1/N 的参数、梯度和优化器状态。

在一层做前向传播之前，FSDP 执行一次 **all-gather**,从所有 GPU 收集完整参数到每块 GPU 的内存中。前向传播后，每块 GPU 丢弃非本地参数。反向传播时再次执行 all-gather 重建参数以计算梯度。反向传播后，一次 **reduce-scatter** 分发梯度分片，使每块 GPU 只存储 1/N 的梯度。

**以 70B 模型在 8 块 GPU 上为例：**

| 组成部分 | 无 FSDP | 有 FSDP |
|-----------|-------------|-----------|
| 权重 (FP16) | 每GPU 140 GB | 每GPU 17.5 GB |
| Adam 状态 (FP32) | 每GPU 560 GB | 每GPU 70 GB |
| 梯度 (FP16) | 每GPU 140 GB | 每GPU 17.5 GB |
| **总计** | **每GPU 840 GB** | **每GPU 105 GB** |

没有 FSDP,70B 模型无法装进单块 80GB GPU。用 FSDP 在 8 块 GPU 上，每块 GPU 用 105GB——等等，还是装不下。你需要至少 16 块 GPU 才能降到每块 80GB 以下，或者把 FSDP 与激活值检查点(反向传播时重算激活值而不是存储它们)结合使用。

通信开销高于朴素数据并行，因为每层之前都有 all-gather。但内存上的节省使原本不可能的训练成为可能。

```mermaid
graph TD
    subgraph FSDP["FSDP: Fully Sharded Data Parallel (4 GPUs)"]
        direction TB
        S["Model: 4 layers, sharded"]

        subgraph GPU1["GPU 1"]
            G1S["Shard: 1/4 params\n1/4 optimizer\n1/4 gradients"]
        end
        subgraph GPU2["GPU 2"]
            G2S["Shard: 1/4 params\n1/4 optimizer\n1/4 gradients"]
        end
        subgraph GPU3["GPU 3"]
            G3S["Shard: 1/4 params\n1/4 optimizer\n1/4 gradients"]
        end
        subgraph GPU4["GPU 4"]
            G4S["Shard: 1/4 params\n1/4 optimizer\n1/4 gradients"]
        end

        AG["All-Gather\n(reconstruct full params\nbefore each layer)"]
        FW["Forward Pass\n(full params temporarily)"]
        RS["Reduce-Scatter\n(distribute gradient shards\nafter backward)"]

        S --> GPU1
        S --> GPU2
        S --> GPU3
        S --> GPU4
        GPU1 --> AG
        GPU2 --> AG
        GPU3 --> AG
        GPU4 --> AG
        AG --> FW
        FW --> RS
    end

    style G1S fill:#1a1a2e,stroke:#0f3460,color:#fff
    style G2S fill:#1a1a2e,stroke:#0f3460,color:#fff
    style G3S fill:#1a1a2e,stroke:#0f3460,color:#fff
    style G4S fill:#1a1a2e,stroke:#0f3460,color:#fff
    style AG fill:#1a1a2e,stroke:#e94560,color:#fff
    style FW fill:#1a1a2e,stroke:#51cf66,color:#fff
    style RS fill:#1a1a2e,stroke:#e94560,color:#fff
```

### DeepSpeed ZeRO

DeepSpeed 的 ZeRO(Zero Redundancy Optimizer)在概念上与 FSDP 完全相同，但由 Microsoft 独立开发。它定义了三个阶段，每个阶段分片更激进：

| 阶段 | 分片对象 | 内存节省 | 通信 |
|-------|--------|---------------|---------------|
| ZeRO-1 | 仅优化器状态 | 约 4 倍缩减 | 与数据并行相同 |
| ZeRO-2 | + 梯度 | 约 8 倍缩减 | 略多 |
| ZeRO-3 | + 参数 | 约 N 倍缩减(N 块 GPU) | 每层一次 all-gather |

ZeRO-3 等价于 FSDP。名字不同，机制相同。PyTorch 在 DeepSpeed 证明了这一概念之后，将 FSDP 作为原生实现加入。

DeepSpeed 还推出了 ZeRO-Offload(把优化器状态卸载到更便宜、更大的 CPU 内存)和 ZeRO-Infinity(卸载到 NVMe SSD)。这些以计算速度换内存容量——被卸载的操作更慢，但释放了 GPU 内存。

### 混合精度训练

现代训练同时使用多种浮点格式：

- **前向传播**： FP16 或 BF16(16 位)。内存是 FP32 的一半。矩阵乘法在 tensor core 上快 2 倍。
- **主权重**： FP32(32 位)。由优化器维护，以保证权重更新时的数值精度。
- **损失缩放**： 反向传播前将损失乘以一个大常数，防止 FP16 梯度下溢为零。优化器更新前再除以同一常数。

BF16(Brain Float 16)的指数范围与 FP32 相同(8 位指数)，但精度降低(7 位尾数，FP32 是 23 位)。它很少需要损失缩放，因为它能表示同样的数值范围。FP16 有 5 位指数和 10 位尾数——能表示细粒度数值，但在极端大小处会上溢/下溢。

Google 的 TPU 原生使用 BF16。NVIDIA 的 A100 和 H100 同时支持 FP16 和 BF16。业界已大多转向 BF16,因为它免除了损失缩放的麻烦。

**7B 模型的内存对比：**

| 精度 | 权重 | 优化器 | 梯度 | 总计 |
|-----------|---------|-----------|-----------|-------|
| 全 FP32 | 28 GB | 56 GB | 28 GB | 112 GB |
| 混合 (BF16 + FP32 主权重) | 14 GB | 56 GB | 14 GB | 84 GB |

混合精度在这个模型上节省 28GB。优化器状态无论如何都保持 FP32——大部分内存正是消耗在这里。

### Megatron-LM 与 3D 并行

真实的大规模训练组合全部三种并行：

- **数据并行**跨节点组(扩展 batch size)
- **张量并行**在节点内(将层拆分到 8 块 GPU)
- **流水线并行**跨节点(将层组拆分到多台机器)

Llama 3 405B 在 16,384 块 H100 上：
- 每个节点内 8 路张量并行(每节点 8 块 GPU)
- 跨节点 16 路流水线并行(16 个流水线阶段)
- 剩余维度上 128 路数据并行(16,384 / 8 / 16 = 128)

这种 3D 分解(8 x 16 x 128 = 16,384)就是扩展到数千块 GPU 的方式。每块 GPU 处理不同的数据分片(数据并行)，持有每层的一个切片(张量并行)，并计算不同的层组(流水线并行)。

DeepSeek V3 采用了不同的路线。其 Mixture of Experts 架构每个 token 只激活 6710 亿参数中的 370 亿。这意味着每块 GPU 只需计算(并为)活跃参数(存储激活值)。他们在 2,048 块 H800 GPU 上训练——不到 Meta GPU 数量的 1/8——花费 $5.6M vs Meta's estimated $1 亿美元。

```mermaid
graph TD
    subgraph ThreeD["3D Parallelism (Llama 3 405B)"]
        direction TB
        subgraph DP["Data Parallel (128-way)\nSplit batch across 128 groups"]
            subgraph PP["Pipeline Parallel (16-way)\nSplit layers across 16 stages"]
                subgraph TP["Tensor Parallel (8-way)\nSplit each layer across 8 GPUs"]
                    G1["GPU 1\nSlice of layers 1-N"]
                    G2["GPU 2\nSlice of layers 1-N"]
                    G8["GPU 8\nSlice of layers 1-N"]
                end
            end
        end
    end

    N1["Total: 8 x 16 x 128 = 16,384 GPUs"]

    style G1 fill:#1a1a2e,stroke:#0f3460,color:#fff
    style G2 fill:#1a1a2e,stroke:#0f3460,color:#fff
    style G8 fill:#1a1a2e,stroke:#0f3460,color:#fff
    style N1 fill:#1a1a2e,stroke:#e94560,color:#fff
```

```figure
paged-kv-cache
```

## 动手构建

### 步骤 1:模拟数据并行

将一个 batch 拆分到模拟的 GPU 上。每块 GPU 对自己的数据分片执行前向传播。对“梯度”取平均(我们用损失值模拟它们)。

```python
import numpy as np

def simulate_data_parallelism(data, num_gpus, model_fn):
    batch_size = len(data)
    shard_size = batch_size // num_gpus
    remainder = batch_size % num_gpus

    gpu_losses = []
    gpu_gradients = []

    offset = 0
    for gpu_id in range(num_gpus):
        extra = 1 if gpu_id < remainder else 0
        shard = data[offset:offset + shard_size + extra]
        offset += shard_size + extra

        loss, grad = model_fn(shard)
        gpu_losses.append(loss)
        gpu_gradients.append(grad)

    avg_loss = np.mean(gpu_losses)
    avg_gradient = np.mean(gpu_gradients, axis=0)

    return avg_loss, avg_gradient
```

all-reduce 操作(梯度平均)是数据并行中唯一的通信。实践中，这使用 NVIDIA GPU 上的 NCCL 库，它实现环形 all-reduce:每块 GPU 把自己梯度的 1/N 发给邻居，从另一个邻居接收 1/N,经过 N-1 步后每块 GPU 都拥有完整的平均值。总通信量为 2 x gradient_size x (N-1)/N,N 很大时接近 2 倍梯度大小。

### 步骤 2:模拟张量并行

将权重矩阵拆分到多块 GPU 上。每块 GPU 计算部分矩阵乘法。合并结果。

```python
def simulate_tensor_parallelism(input_data, weight_matrix, num_gpus):
    d_in, d_out = weight_matrix.shape
    assert d_out % num_gpus == 0, f"d_out {d_out} not divisible by num_gpus {num_gpus}"
    shard_size = d_out // num_gpus

    partial_results = []
    for gpu_id in range(num_gpus):
        start = gpu_id * shard_size
        end = start + shard_size
        weight_shard = weight_matrix[:, start:end]

        partial = input_data @ weight_shard
        partial_results.append(partial)

    full_output = np.concatenate(partial_results, axis=-1)

    direct_output = input_data @ weight_matrix
    error = np.abs(full_output - direct_output).max()

    return full_output, error
```

误差应当恰好为零(或机器精度)。张量并行在数学上是精确的——结果与在单块 GPU 上计算完整矩阵乘法相同。拆分沿输出维度进行，每块 GPU 产生不同的列块，拼接后重建完整结果。

对于列并行线性层(拆分输出维度)，你做拼接。对于行并行(拆分输入维度)，你做求和。在 transformer 的 FFN 中，第一个线性层(扩展)用列并行，第二个线性层(收缩)用行并行。这避免了两个层之间的一次 all-reduce。

### 步骤 3:模拟流水线并行

将模型的层拆分到虚拟 GPU 上。展示气泡问题：早期阶段在后期阶段计算时闲置。

```python
def simulate_pipeline_parallelism(num_layers, num_stages, num_microbatches):
    layers_per_stage = num_layers // num_stages

    timeline = {}
    clock = 0

    for mb in range(num_microbatches):
        for stage in range(num_stages):
            start_time = max(
                timeline.get((stage, mb - 1, "fwd"), (0, 0))[1] if mb > 0 else 0,
                timeline.get((stage - 1, mb, "fwd"), (0, 0))[1] if stage > 0 else 0,
            )
            end_time = start_time + layers_per_stage
            timeline[(stage, mb, "fwd")] = (start_time, end_time)

    last_fwd_end = max(v[1] for v in timeline.values())

    for mb in range(num_microbatches - 1, -1, -1):
        for stage in range(num_stages - 1, -1, -1):
            deps = [last_fwd_end]
            if mb < num_microbatches - 1 and (stage, mb + 1, "bwd") in timeline:
                deps.append(timeline[(stage, mb + 1, "bwd")][1])
            if stage < num_stages - 1 and (stage + 1, mb, "bwd") in timeline:
                deps.append(timeline[(stage + 1, mb, "bwd")][1])
            start_time = max(deps)
            end_time = start_time + layers_per_stage
            timeline[(stage, mb, "bwd")] = (start_time, end_time)

    total_time = max(v[1] for v in timeline.values())
    compute_time = num_microbatches * num_stages * layers_per_stage * 2
    bubble_fraction = 1.0 - compute_time / (total_time * num_stages)

    return timeline, total_time, bubble_fraction
```

4 个阶段、1 个 micro-batch 时，气泡占比为 75%——任意时刻四分之三的 GPU 在空闲。16 个 micro-batch 时，降到约 19%。消除气泡的代价是内存：你必须同时为所有在途 micro-batch 存储激活值。

### 步骤 4:内存计算器

为任意模型规模计算训练所需的精确内存。

```python
def memory_calculator(
    params_billions,
    precision_bytes=2,
    optimizer="adam",
    num_gpus=1,
    sharding="none",
    sequence_length=2048,
    batch_size_per_gpu=1,
    hidden_dim=None,
    num_layers=None,
):
    params = params_billions * 1e9

    weight_memory = params * precision_bytes

    if optimizer == "adam":
        optimizer_memory = params * 4 * 2
    elif optimizer == "sgd":
        optimizer_memory = params * 4
    else:
        optimizer_memory = 0

    gradient_memory = params * precision_bytes

    total_no_activation = weight_memory + optimizer_memory + gradient_memory

    if hidden_dim and num_layers:
        activation_per_layer = (
            sequence_length * batch_size_per_gpu * hidden_dim * precision_bytes * 4
        )
        activation_memory = activation_per_layer * num_layers
    else:
        activation_memory = params * precision_bytes * 0.5

    if sharding == "fsdp" or sharding == "zero3":
        weight_memory /= num_gpus
        optimizer_memory /= num_gpus
        gradient_memory /= num_gpus
    elif sharding == "zero2":
        optimizer_memory /= num_gpus
        gradient_memory /= num_gpus
    elif sharding == "zero1":
        optimizer_memory /= num_gpus

    per_gpu_total = weight_memory + optimizer_memory + gradient_memory + activation_memory

    return {
        "params_billions": params_billions,
        "weights_gb": weight_memory / 1e9,
        "optimizer_gb": optimizer_memory / 1e9,
        "gradients_gb": gradient_memory / 1e9,
        "activations_gb": activation_memory / 1e9,
        "per_gpu_total_gb": per_gpu_total / 1e9,
        "total_across_gpus_gb": per_gpu_total * num_gpus / 1e9,
        "fits_on_80gb": per_gpu_total / 1e9 <= 80,
        "num_gpus": num_gpus,
        "sharding": sharding,
    }
```

这个计算器回答每个 ML 工程师都会问的问题：“我需要多少块 GPU?" 输入模型规模，看它是否能装下。调整分片策略，直到单 GPU 总量降到 80GB 以下。

### 步骤 5:混合精度模拟

比较 FP32、FP16 和混合精度训练的内存使用。

```python
def mixed_precision_comparison(params_billions):
    params = params_billions * 1e9

    fp32_weights = params * 4
    fp32_optimizer = params * 4 * 2
    fp32_gradients = params * 4
    fp32_total = fp32_weights + fp32_optimizer + fp32_gradients

    fp16_weights = params * 2
    fp16_master = params * 4
    fp16_optimizer = params * 4 * 2
    fp16_gradients = params * 2
    fp16_total = fp16_weights + fp16_master + fp16_optimizer + fp16_gradients

    mixed_weights = params * 2
    mixed_optimizer = params * 4 * 2
    mixed_gradients = params * 2
    mixed_total = mixed_weights + mixed_optimizer + mixed_gradients

    return {
        "fp32_total_gb": fp32_total / 1e9,
        "fp16_with_master_gb": fp16_total / 1e9,
        "mixed_bf16_gb": mixed_total / 1e9,
        "savings_vs_fp32": 1 - mixed_total / fp32_total,
    }
```

对大多数人来说最大的意外是：混合精度并不会把内存减半。优化器状态(Adam 的 m 和 v)无论精度如何都保持 FP32。对 7B 模型，FP32 训练用 112GB。混合精度用 84GB。这是 25% 的缩减，不是 50%。优化器是大头。

## 使用它

### 运行全部模拟

```python
def run_all_demos():
    print("=" * 70)
    print("DATA PARALLELISM SIMULATION")
    print("=" * 70)

    np.random.seed(42)
    data = np.random.randn(64, 32)
    weight = np.random.randn(32, 16)

    def model_fn(batch):
        output = batch @ weight
        loss = np.mean(output ** 2)
        grad = 2 * batch.T @ (batch @ weight) / len(batch)
        return loss, grad

    for n_gpus in [1, 2, 4, 8]:
        loss, grad = simulate_data_parallelism(data, n_gpus, model_fn)
        print(f"  {n_gpus} GPUs: loss={loss:.4f}, grad_norm={np.linalg.norm(grad):.4f}")

    print()
    print("=" * 70)
    print("TENSOR PARALLELISM SIMULATION")
    print("=" * 70)

    x = np.random.randn(4, 8192)
    W = np.random.randn(8192, 8192)

    for n_gpus in [1, 2, 4, 8]:
        output, error = simulate_tensor_parallelism(x, W, n_gpus)
        print(f"  {n_gpus} GPUs: output_shape={output.shape}, max_error={error:.2e}")

    print()
    print("=" * 70)
    print("PIPELINE PARALLELISM SIMULATION")
    print("=" * 70)

    for n_mb in [1, 4, 8, 16, 32]:
        _, total_t, bubble = simulate_pipeline_parallelism(32, 4, n_mb)
        print(f"  {n_mb:2d} micro-batches: total_time={total_t:4d}, bubble={bubble:.1%}")

    print()
    print("=" * 70)
    print("MEMORY CALCULATOR")
    print("=" * 70)

    configs = [
        (7, "none", 1),
        (7, "fsdp", 8),
        (70, "none", 1),
        (70, "fsdp", 8),
        (70, "fsdp", 16),
        (405, "fsdp", 64),
        (405, "fsdp", 128),
    ]

    print(f"  {'Model':>8} {'Sharding':>8} {'GPUs':>5} {'Per-GPU':>10} {'Fits 80GB':>10}")
    print("  " + "-" * 50)
    for params, shard, gpus in configs:
        result = memory_calculator(params, num_gpus=gpus, sharding=shard)
        fits = "Yes" if result["fits_on_80gb"] else "No"
        print(f"  {params:>6}B {shard:>8} {gpus:>5} {result['per_gpu_total_gb']:>8.1f}GB {fits:>10}")

    print()
    print("=" * 70)
    print("MIXED PRECISION COMPARISON")
    print("=" * 70)

    for params_b in [7, 13, 70, 405]:
        result = mixed_precision_comparison(params_b)
        print(f"  {params_b}B: FP32={result['fp32_total_gb']:.0f}GB, "
              f"Mixed BF16={result['mixed_bf16_gb']:.0f}GB, "
              f"Savings={result['savings_vs_fp32']:.0%}")
```

## 发布它

本课产出 `outputs/prompt-distributed-training-planner.md`——一个 prompt,输入模型规模和可用硬件，然后产出一个完整的分布式训练计划：并行策略、内存预算、通信开销和预期吞吐量。

## 练习

1. 修改内存计算器，加入激活值检查点。启用检查点后，只在每第 K 层存储激活值(典型 K=1,即全部重算)。展示内存与计算的权衡：检查点节省多少内存，又使训练慢多少(完整检查点约多 33% 的计算量)？

2. 扩展流水线并行模拟，实现 PipeDream 使用的 1F1B(一次前向、一次反向)调度。对 4 个阶段和 8 个 micro-batch,比较其气泡占比与朴素调度。1F1B 调度的峰值内存应更小，因为它更早开始反向传播。

3. 实现一个梯度累积模拟器。不是在每个 micro-batch 后都 all-reduce,而是在本地累积梯度 K 步，然后一次 all-reduce。展示这如何将通信量减少 K 倍，同时产生完全相同的最终梯度(从而得到完全相同的训练结果)。

4. 构建一个成本估算器。给定模型规模、目标 token 数、GPU 类型(A100 按 $2/hr, H100 at $3.50/小时)和并行策略，估算以美元计的总训练成本。与已知成本对照验证：据报道 Llama 3 405B 成本约 $100M, DeepSeek V3 cost ~$560 万美元。

5. 在内存计算器中加入 ZeRO-Offload。假设每节点 CPU 内存为 512GB,NVMe 为 2TB。展示把优化器状态卸载到 CPU 如何让 70B 模型用 4 块 GPU 而非 16 块来训练，代价是优化器步进慢 30-50%。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| 数据并行 | “把模型复制到每块 GPU" | 每块 GPU 处理不同的数据分片；每步之后通过 all-reduce 对梯度取平均 |
| 张量并行 | “把一层拆到多块 GPU" | 划分权重矩阵，使每块 GPU 计算矩阵乘法的一部分；需要高速 NVLink 互连 |
| 流水线并行 | “把各层拆到多块 GPU" | 每块 GPU 运行不同的层组；数据沿流水线以 micro-batch 流动以减少气泡 |
| FSDP | “全部分片" | 全分片数据并行——每块 GPU 持有 1/N 的权重、梯度和优化器状态；计算前执行 all-gather |
| ZeRO | “DeepSpeed 版的 FSDP" | Zero Redundancy Optimizer,分 3 个阶段：分片优化器(阶段 1)、+ 梯度(阶段 2)、+ 参数(阶段 3) |
| All-reduce | “跨 GPU 取平均" | 一种集合通信操作，每块 GPU 最终得到所有 GPU 输入的和(或平均)——通常实现为环形 all-reduce |
| All-gather | “从所有 GPU 收集" | 一种集合通信操作，每块 GPU 最终得到所有 GPU 数据的拼接——FSDP 用它重建完整参数 |
| Reduce-scatter | “求和并分发" | 一种集合通信操作，对数据归约(求和)并把不同块分发给不同 GPU——FSDP 用它做梯度分片 |
| 混合精度 | “用半精度训练" | 前向/反向用 FP16/BF16,优化器状态用 FP32——节省约 25% 而非 50% 的内存，因为优化器是大头 |
| 流水线气泡 | “流水线中的空闲时间" | GPU 等待上一阶段数据而闲置的时间比例——通过使用更多 micro-batch 来降低 |

## 延伸阅读

- [Rajbhandari et al., 2020 -- "ZeRO: Memory Optimizations Toward Training Trillion Parameter Models"](https://arxiv.org/abs/1910.02054) —— 定义了三个分片阶段的 DeepSpeed ZeRO 论文
- [Shoeybi et al., 2020 -- "Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism"](https://arxiv.org/abs/1909.08053) —— NVIDIA 面向 transformer 的张量并行
- [Narayanan et al., 2021 -- "Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM"](https://arxiv.org/abs/2104.04473) —— 结合数据、张量与流水线的 3D 并行
- [Zhao et al., 2023 -- "PyTorch FSDP: Experiences on Scaling Fully Sharded Data Parallel"](https://arxiv.org/abs/2304.11277) —— PyTorch 原生 FSDP 实现
- [Llama 3 Technical Report](https://arxiv.org/abs/2407.21783) —— 16,384 块 GPU 训练及 3D 并行细节
- [DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) —— MoE 架构如何将训练成本降低一个数量级