# 推理优化

> LLM 推理由两个阶段定义。Prefill 并行处理你的 prompt —— 计算受限。Decode 逐个生成 token —— 内存受限。每个优化都针对一个或两个阶段。

**类型：** 构建
**语言：** Python
**前置要求：** 第 10 阶段，第 01-08 课（Transformer 架构、注意力）
**时间：** ~120 分钟

## 学习目标

- 实现 KV 缓存，以消除自回归 token 生成期间的冗余计算
- 解释 LLM 推理的 prefill 与 decode 阶段，以及为什么每个阶段有不同的瓶颈（计算受限 vs 内存受限）
- 实现连续批处理和 PagedAttention 概念，以在并发请求下最大化 GPU 利用率
- 比较推理优化技术（KV 缓存、推测解码、flash attention）及其吞吐/延迟权衡

## 问题

你在 4xA100 GPU 上部署 Llama 3 70B。单个用户获得约 50 token/秒。感觉很快。然后 100 个用户同时命中端点。吞吐降至每个用户 3 token/秒。你每月 $25,000 的 GPU 账单正在以比人类打字更慢的速度提供响应。

模型本身在 1 个用户和 100 个用户之间没有变化。相同的权重、相同的架构、相同的数学。变化的是你调度工作的方式。朴素推理浪费了 90%+ 的可用 GPU 计算。一个等待第 47 个 token 的用户占据整个批处理槽位，而 GPU 内存总线在矩阵乘法之间空闲。同时，一个新用户的 2,000 token prompt 本可以用有用的计算填满那段死时间。

这不是扩展问题。这是调度问题。本课中的技术 —— KV 缓存、连续批处理、PagedAttention、推测解码、前缀缓存 —— 区分了每月 $25k 的推理账单和每月 $5k 但服务相同流量的账单。

vLLM 在 4xA100-80GB 上服务 Llama 3 70B，在低并发时达到约 50 token/秒/用户，在 100 个并发请求时通过连续批处理和 PagedAttention 维持 15-25 TPS/用户。没有这些优化，相同硬件在该并发下仅提供 5 TPS/用户。相同 GPU、相同模型、4 倍吞吐。

## 核心概念

### Prefill vs Decode

每个 LLM 推理请求有两个不同的阶段。

**Prefill** 处理整个输入 prompt。所有 token 都已知，因此注意力可以在整个序列上并行计算。这是一个大型矩阵乘法 —— GPU 核心保持忙碌。瓶颈是计算：你的硬件每秒能交付多少 FLOPS。A100 在 BF16 下达到 312 TFLOPS。在单张 A100 上，70B 模型的 4,096 token prompt 的 prefill 耗时约 400ms。

**Decode** 逐个生成输出 token。每个新 token 关注所有先前的 token，但每次前向传播只产生一个 token。权重矩阵与 prefill 期间大小相同，但你是用单个向量而非矩阵去乘它们。GPU 核心在微秒内完成，然后等待下一批权重从内存到达。瓶颈是内存带宽：你能以多快的速度将模型权重从 HBM 流式传输到计算单元。A100 有 2 TB/s 带宽。FP16 中的 70B 模型是 140 GB。读取完整模型一次需要 70ms —— 这是单步 decode 的下限。

```mermaid
graph LR
    subgraph "Prefill (计算受限)"
        P1["所有 prompt token"] --> P2["并行注意力"]
        P2 --> P3["完整 matmul 利用率"]
    end

    subgraph "Decode (内存受限)"
        D1["一次一个 token"] --> D2["顺序生成"]
        D2 --> D3["等待内存读取"]
    end

    P3 --> D1
```

**ops:byte 比率**（也称为算术强度）捕捉这种权衡。它衡量每从内存读取一个字节执行多少操作。

```
ops:byte 比率 = 每 token 的 FLOPs / 从内存读取的字节数
```

在 batch 为 4,096 token 的 prefill 期间，你每加载一个权重执行约 4,096 次乘加操作。比率很高 —— 你是计算受限。在 batch size 为 1 的 decode 期间，你每加载一个权重执行约 1 次操作。比率很低 —— 你是内存受限。

基本洞察：*decode 是内存受限的，因为你读取整个模型来生成单个 token*。下面的每个优化要么减少你读取的内容，要么增加每次读取处理的 token batch，要么完全避免读取。

### KV 缓存

在注意力期间，每个 token 的 query 关注每个先前 token 的 key 和 value 向量。没有缓存，生成 token N 需要重新计算所有 N-1 个先前 token 的 key 和 value 投影。Token 1 在生成 token 2 时被投影，然后在 token 3 时再次投影，在 token 4 时再次投影。到 token 1,000 时，你总共投影了 token 1 共 999 次。

KV 缓存存储所有先前 token 的 key 和 value 投影。生成 token N 时，你只计算 token N 的 key 和 value，然后将它们与 token 1 到 N-1 的缓存 K/V 拼接。

```mermaid
graph TD
    subgraph "没有 KV 缓存"
        A1["Token 5: 重新计算 token 1-4 的 K,V"]
        A2["Token 6: 重新计算 token 1-5 的 K,V"]
        A3["Token 7: 重新计算 token 1-6 的 K,V"]
    end

    subgraph "有 KV 缓存"
        B1["Token 5: 计算 K5,V5, 从缓存读取 K1-4,V1-4"]
        B2["Token 6: 计算 K6,V6, 从缓存读取 K1-5,V1-5"]
        B3["Token 7: 计算 K7,V7, 从缓存读取 K1-6,V1-6"]
    end
```

**KV 缓存内存公式：**

```
KV 缓存大小 = 2 * 层数 * KV 头数 * 头维度 * 序列长度 * 每参数字节数
```

对于 Llama 3 70B（80 层，GQA 8 个 KV 头，head_dim=128，BF16）：

```
每 token: 2 * 80 * 8 * 128 * 2 字节 = 327,680 字节 = 320 KB
在 4,096 token: 320 KB * 4,096 = 1.28 GB
在 128K token: 320 KB * 131,072 = 40 GB
```

Llama 3 70B 的单个 128K 上下文对话消耗 40 GB KV 缓存 —— 半张 A100 的内存。100 个并发用户各 4K token，仅 KV 缓存就需要 128 GB。这就是 KV 缓存管理是推理优化核心挑战的原因。

### 连续批处理

静态批处理等待 N 个请求的 batch 到达，一起处理它们，并等到*所有*请求完成后才接受新请求。如果一个请求需要 500 个 token，另一个需要 10 个，短请求在完成后空闲 490 个 decode 步。

连续批处理（也称为迭代级批处理）在任何请求完成时立即将新请求插入 batch。Batch 在每个 decode 步重新评估。在 10 个 token 后完成的请求立即被等待的请求替换。

```mermaid
sequenceDiagram
    participant GPU
    participant R1 as Request 1 (50 token)
    participant R2 as Request 2 (10 token)
    participant R3 as Request 3 (30 token)
    participant R4 as Request 4 (等待中)

    Note over GPU: 静态批处理
    GPU->>R1: 处理 batch [R1, R2, R3]
    Note over R2: R2 在第 10 步完成
    Note over R2: 浪费 40 步...
    Note over R3: R3 在第 30 步完成
    Note over R3: 浪费 20 步...
    GPU->>R4: 终于在第 50 步启动 R4

    Note over GPU: 连续批处理
    GPU->>R1: 处理 batch [R1, R2, R3]
    Note over R2: R2 在第 10 步完成
    GPU->>R4: 在第 11 步插入 R4
    Note over R3: R3 在第 30 步完成
```

吞吐改进取决于输出长度的变化程度。长度均匀时，连续批处理与静态批处理匹配。长度变化时（常见情况），连续批处理可以提供 2-5 倍更高吞吐，因为 GPU 槽位永远不会空闲。

### PagedAttention

每个请求的 KV 缓存是内存的连续块。随着请求到达和离开，内存碎片化 —— 完全像操作系统中的 RAM 碎片化。一个 4K token 的请求需要 1.28 GB 连续空间。即使你总共有 2 GB 空闲，你可能没有 1.28 GB *连续*。你要么浪费内存，要么拒绝请求。

PagedAttention（来自 vLLM）将操作系统风格的虚拟内存应用于 KV 缓存。不是为每个请求分配一个连续块，而是分配固定大小的"页"（通常每个 16 个 token）。页可以位于 GPU 物理内存的任何位置。页表将每个请求的逻辑序列位置映射到物理页位置。

```mermaid
graph TD
    subgraph "连续分配"
        C1["请求 A: 2GB 块"]
        C2["[空闲: 0.5GB]"]
        C3["请求 B: 1GB 块"]
        C4["[空闲: 1.5GB -- 但已碎片化]"]
    end

    subgraph "PagedAttention"
        P1["页池: 256 页，每页 16 个 token"]
        P2["请求 A: 页 3,7,12,45,88..."]
        P3["请求 B: 页 1,4,9,22,67..."]
        P4["无碎片化，无浪费"]
    end
```

PagedAttention 还为共享前缀启用**写时复制**。如果 50 个请求共享相同的系统 prompt，该系统 prompt 的 KV 缓存页存储一次并被所有 50 个请求引用。只有当请求分叉时（不同的用户消息），它才获得自己的页。这大幅削减了具有共享系统 prompt 的应用程序的内存使用。

vLLM 报告通过 PagedAttention 实现接近零的内存浪费（约 4% vs 朴素分配中的约 60-80%）。

### 推测解码

Decode 很慢，因为它是顺序的 —— 你生成一个 token，反馈回去，生成下一个。但如果你能廉价地猜测接下来的 5 个 token，然后一次性验证它们呢？

推测解码使用一个小的、快速的**草稿模型**来生成 K 个候选 token。然后大型**目标模型**在单次前向传播中处理所有 K 个候选（这看起来像 prefill —— 并行、计算受限、高效）。如果目标模型同意草稿模型的预测，你在一次目标前向传播的时间内接受所有 K 个 token。如果它在位置 j 不同意，你接受 token 1 到 j-1 并丢弃其余。

```mermaid
graph LR
    D["草稿模型 (1B)"] -->|"生成 5 个 token\n~5ms"| C["候选: the cat sat on the"]
    C --> T["目标模型 (70B)"]
    T -->|"一次验证全部 5 个\n~70ms"| V{"匹配?"}
    V -->|"5 个中 4 个匹配"| A["在 75ms 内接受 4 个 token\n对比顺序 280ms"]
    V -->|"位置 5 不匹配"| R["拒绝 token 5\n从目标模型重采样"]
```

加速取决于**接受率** —— 草稿模型的预测与目标模型匹配的频率。对于为 Llama 3 70B 起草的 Llama 3 8B，自然语言上的接受率通常为 70-85%。这转化为 2-3 倍 decode 加速。

推测解码的三种方法：

| 方法 | 草稿来源 | 接受率 | 开销 |
|--------|-------------|-----------------|----------|
| Draft-target (Leviathan et al.) | 单独的小模型 | 70-85% | 草稿模型内存 |
| EAGLE (Li et al.) | 目标模型上的轻量级头 | 75-90% | 约 1% 额外参数 |
| N-gram 查找 | Token n-gram 表 | 40-60% | 可忽略 |

**EAGLE** 在目标模型的隐藏状态之上训练一个小型自回归头。它使用目标模型倒数第二层的特征预测下一个 token 的嵌入。因为它在目标模型自己的表示上操作（而非单独模型的表示），它以最小额外内存实现更高接受率。EAGLE-2 添加了一个动态草稿树，根据上下文调整候选数量。

**N-gram 推测解码** 维护一个 n-gram 延续表，来自当前上下文或预构建的语料库。如果草稿与同一对话中之前出现的内容匹配（重复模式、代码、结构化输出），它以零神经网络开销触发。平均接受率较低，但每次推测的成本基本免费。

推测解码是*数学上精确的* —— 输出分布与目标模型的分布相同。它不是近似。验证步骤确保每个接受的 token 具有目标模型会分配的精确概率。

### 前缀缓存

许多请求共享相同的前缀。聊天机器人系统 prompt。RAG 上下文块。少样本示例集。没有前缀缓存，每个请求从头开始重新计算这些共享 token 的 KV 缓存。

前缀缓存存储常见前缀的 KV 缓存并在请求之间复用它。当带有已知前缀的新请求到达时，系统复制（或引用）缓存的 KV 条目，只计算唯一后缀的 KV。

对于在所有请求间共享的 2,000 token 系统 prompt，前缀缓存消除每个请求约 400ms 的 prefill。在 100 请求/秒时，这每秒节省 40 秒 GPU 计算 —— 超过一张 GPU 的工作量。

SGLang 的 RadixAttention 用基数树（trie）实现前缀缓存，按 token 内容索引前缀。任何匹配存储前缀的请求免费获得其 KV 缓存。该树启用部分前缀匹配 —— 如果你与缓存条目共享 2,000 个前缀 token 中的 1,500 个，你复用那 1,500 个并只重新计算 500 个。

### 推理引擎

三个引擎主导生产级 LLM 服务：

| 引擎 | 关键创新 | 最适合 |
|--------|---------------|----------|
| vLLM | PagedAttention, 连续批处理 | 通用服务，最高兼容性 |
| SGLang | RadixAttention (前缀缓存), 结构化生成 | 多轮聊天机器人，约束解码 |
| TensorRT-LLM | NVIDIA 内核融合, FP8 量化 | NVIDIA 硬件上的最大单 GPU 吞吐 |

**vLLM** 是默认起点。它支持最广泛的模型范围，运行在任何 GPU 供应商（NVIDIA、AMD、Intel）上，并通过 PagedAttention + 连续批处理实现强大吞吐。OpenAI 兼容 API 意味着你可以将其作为任何 OpenAI API 调用的替代品。

**SGLang** 建立在 vLLM 相同基础上，但增加了 RadixAttention 用于前缀缓存和用于结构化 LLM 程序的 DSL。如果你的工作负载涉及多轮对话、工具使用或约束解码（JSON 输出、正则引导生成），SGLang 通常通过前缀复用比 vLLM 快 2-5 倍。

**TensorRT-LLM** 将模型编译成优化的 NVIDIA GPU 内核。它融合操作（注意力 + 线性 + 激活在一个内核中），在 H100 GPU 上使用 FP8，并与 NVIDIA Triton Inference Server 集成用于生产部署。它在 NVIDIA 硬件上实现最高单 GPU 吞吐，但需要更多设置且仅在 NVIDIA GPU 上工作。

Llama 3 70B 的真实数字（4xA100-80GB，BF16）：

| 指标 | vLLM | SGLang | TensorRT-LLM |
|--------|------|--------|---------------|
| 吞吐 (1 用户) | ~50 TPS | ~55 TPS | ~65 TPS |
| 吞吐 (100 用户) | ~2,500 总 TPS | ~3,200 总 TPS | ~3,000 总 TPS |
| 首 token 时间 | ~400ms | ~300ms (前缀命中) | ~350ms |
| 最大上下文 | 128K | 128K | 128K |

### Ops:Byte 框架

你无法优化你不衡量的东西。Ops:byte 比率告诉你是在计算受限还是内存受限，这决定了哪些优化重要。

```
计算上限: GPU 的峰值 FLOPS
内存上限: 峰值带宽 * ops:byte 比率
```

当 ops:byte 低时（decode、小 batch），你命中内存带宽上限。添加更多计算（更高时钟、更多核心）没有帮助。你需要减少内存读取（量化、KV 缓存压缩）或增加 batch size 以在更多有用工作上摊销读取。

当 ops:byte 高时（prefill、大 batch），你命中计算上限。内存带宽优化没有帮助。你需要更快的 GPU、内核融合或降低精度以挤压更多 FLOPS。

| 场景 | ops:byte | 受限 | 优化方式 |
|----------|----------|-------|---------------|
| Prefill, batch=1 | ~4,096 | 计算 | 内核融合, FP8 |
| Decode, batch=1 | ~1 | 内存 | 量化, KV 压缩 |
| Decode, batch=32 | ~32 | 内存 | 更大 batch, 连续批处理 |
| Decode, batch=256 | ~256 | 过渡 | 两者都重要 |
| Decode, batch=1024 | ~1,024 | 计算 | 内核融合, 张量并行 |

A100 上的交叉点大约在 ops:byte = 156（312 TFLOPS / 2 TB/s）。低于 156，你是内存受限。高于 156，你是计算受限。连续批处理通过每次迭代打包更多 token，将 decode 推向这个交叉点。

## 构建

### 步骤 1：从零构建 KV 缓存

我们构建一个多头 KV 缓存，按层、按头存储 key 和 value 投影，并展示内存增长模式。

```python
import numpy as np

class KVCache:
    def __init__(self, num_layers, num_heads, head_dim, max_seq_len, dtype=np.float16):
        self.num_layers = num_layers
        self.num_heads = num_heads
        self.head_dim = head_dim
        self.max_seq_len = max_seq_len
        self.dtype = dtype

        self.k_cache = np.zeros(
            (num_layers, num_heads, max_seq_len, head_dim), dtype=dtype
        )
        self.v_cache = np.zeros(
            (num_layers, num_heads, max_seq_len, head_dim), dtype=dtype
        )
        self.seq_len = 0

    def update(self, layer_idx, new_keys, new_values):
        num_new = new_keys.shape[1]
        end = self.seq_len + num_new
        self.k_cache[layer_idx, :, self.seq_len:end, :] = new_keys
        self.v_cache[layer_idx, :, self.seq_len:end, :] = new_values
        return (
            self.k_cache[layer_idx, :, :end, :],
            self.v_cache[layer_idx, :, :end, :]
        )

    def advance(self, num_tokens):
        self.seq_len += num_tokens

    def memory_bytes(self):
        return self.k_cache.nbytes + self.v_cache.nbytes

    def used_bytes(self):
        per_token = 2 * self.num_layers * self.num_heads * self.head_dim * np.dtype(self.dtype).itemsize
        return per_token * self.seq_len
```

### 步骤 2：带 KV 缓存的注意力

一个简化的多头注意力，在 decode 步骤中使用 KV 缓存。

```python
def scaled_dot_product_attention(query, keys, values):
    head_dim = query.shape[-1]
    scores = np.matmul(query, keys.transpose(0, 1, 3, 2)) / np.sqrt(head_dim)
    seq_len_q = scores.shape[-2]
    seq_len_k = scores.shape[-1]
    if seq_len_q > 1:
        mask = np.triu(np.ones((seq_len_q, seq_len_k), dtype=np.float32), k=seq_len_k - seq_len_q + 1)
        scores = scores + mask * (-1e9)
    max_scores = np.max(scores, axis=-1, keepdims=True)
    exp_scores = np.exp(scores - max_scores)
    attn_weights = exp_scores / np.sum(exp_scores, axis=-1, keepdims=True)
    return np.matmul(attn_weights, values)


class MultiHeadAttention:
    def __init__(self, d_model, num_heads):
        self.num_heads = num_heads
        self.head_dim = d_model // num_heads
        scale = np.sqrt(2.0 / d_model)
        self.W_q = np.random.randn(d_model, d_model).astype(np.float32) * scale
        self.W_k = np.random.randn(d_model, d_model).astype(np.float32) * scale
        self.W_v = np.random.randn(d_model, d_model).astype(np.float32) * scale
        self.W_o = np.random.randn(d_model, d_model).astype(np.float32) * scale

    def forward(self, x, kv_cache=None, layer_idx=0):
        batch, seq_len, d_model = x.shape
        Q = np.matmul(x, self.W_q).reshape(batch, seq_len, self.num_heads, self.head_dim).transpose(0, 2, 1, 3)
        K = np.matmul(x, self.W_k).reshape(batch, seq_len, self.num_heads, self.head_dim).transpose(0, 2, 1, 3)
        V = np.matmul(x, self.W_v).reshape(batch, seq_len, self.num_heads, self.head_dim).transpose(0, 2, 1, 3)

        if kv_cache is not None:
            K_full, V_full = kv_cache.update(layer_idx, K[0], V[0])
            K = K_full[np.newaxis, :, :, :]
            V = V_full[np.newaxis, :, :, :]
            if seq_len == 1:
                kv_cache.advance(1)

        attn_out = scaled_dot_product_attention(Q, K, V)
        attn_out = attn_out.transpose(0, 2, 1, 3).reshape(batch, -1, d_model)
        return np.matmul(attn_out, self.W_o)
```

### 步骤 3：连续批处理模拟器

这模拟了静态批处理和连续批处理之间的调度差异。

```python
import heapq

class Request:
    def __init__(self, request_id, prompt_tokens, output_tokens, arrival_step):
        self.request_id = request_id
        self.prompt_tokens = prompt_tokens
        self.output_tokens = output_tokens
        self.arrival_step = arrival_step
        self.tokens_generated = 0
        self.start_step = None
        self.end_step = None

    def is_done(self):
        return self.tokens_generated >= self.output_tokens


def simulate_static_batching(requests, batch_size):
    step = 0
    completed = []
    queue = list(requests)
    queue.sort(key=lambda r: r.arrival_step)

    while queue:
        batch = []
        while queue and len(batch) < batch_size:
            r = queue.pop(0)
            r.start_step = max(step, r.arrival_step)
            batch.append(r)

        if batch:
            step = max(step, max(r.start_step for r in batch))
            max_output = max(r.output_tokens for r in batch)
            for r in batch:
                r.tokens_generated = r.output_tokens
                r.end_step = step + max_output
            step += max_output
            completed.extend(batch)

    return completed


def simulate_continuous_batching(requests, batch_size):
    step = 0
    completed = []
    queue = sorted(requests, key=lambda r: r.arrival_step)
    queue_idx = 0
    active = []
    waiting = []

    while queue_idx < len(queue) or active or waiting:
        while queue_idx < len(queue) and queue[queue_idx].arrival_step <= step:
            waiting.append(queue[queue_idx])
            queue_idx += 1

        while waiting and len(active) < batch_size:
            r = waiting.pop(0)
            r.start_step = step
            active.append(r)

        if not active:
            if waiting:
                step += 1
                continue
            elif queue_idx < len(queue):
                step = queue[queue_idx].arrival_step
                continue
            else:
                break

        for r in active:
            r.tokens_generated += 1

        done = [r for r in active if r.is_done()]
        for r in done:
            r.end_step = step + 1
            completed.append(r)
        active = [r for r in active if not r.is_done()]

        step += 1

    return completed


def batching_stats(completed):
    latencies = [r.end_step - r.arrival_step for r in completed]
    total_time = max(r.end_step for r in completed) - min(r.arrival_step for r in completed)
    total_tokens = sum(r.output_tokens for r in completed)
    return {
        "avg_latency": np.mean(latencies),
        "p50_latency": np.median(latencies),
        "p99_latency": np.percentile(latencies, 99),
        "total_time": total_time,
        "throughput": total_tokens / total_time if total_time > 0 else 0,
    }
```

### 步骤 4：前缀缓存

一个基于 trie 的前缀缓存，存储共享前缀的 KV 条目。

```python
class TrieNode:
    def __init__(self):
        self.children = {}
        self.kv_data = None
        self.hit_count = 0


class PrefixCache:
    def __init__(self, max_entries=1000):
        self.root = TrieNode()
        self.max_entries = max_entries
        self.total_entries = 0
        self.hits = 0
        self.misses = 0

    def _walk(self, token_ids):
        node = self.root
        depth = 0
        for tid in token_ids:
            if tid not in node.children:
                break
            node = node.children[tid]
            depth += 1
        return node, depth

    def lookup(self, token_ids):
        node, depth = self._walk(token_ids)
        if depth > 0:
            self.hits += 1
            current = self.root
            for tid in token_ids[:depth]:
                current = current.children[tid]
                current.hit_count += 1
            kv_entries = []
            current = self.root
            for tid in token_ids[:depth]:
                current = current.children[tid]
                if current.kv_data is not None:
                    kv_entries.append(current.kv_data)
            return depth, kv_entries
        self.misses += 1
        return 0, []

    def insert(self, token_ids, kv_per_token):
        node = self.root
        for i, tid in enumerate(token_ids):
            if tid not in node.children:
                if self.total_entries >= self.max_entries:
                    return i
                node.children[tid] = TrieNode()
                self.total_entries += 1
            node = node.children[tid]
            if i < len(kv_per_token):
                node.kv_data = kv_per_token[i]
        return len(token_ids)

    def hit_rate(self):
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0
```

### 步骤 5：推测解码模拟器

我们用可配置的接受率模拟草稿-目标推测解码。

```python
class DraftModel:
    def __init__(self, vocab_size, acceptance_rate=0.8):
        self.vocab_size = vocab_size
        self.acceptance_rate = acceptance_rate

    def generate(self, context, num_tokens):
        tokens = np.random.randint(0, self.vocab_size, size=num_tokens)
        return tokens

    def get_probs(self, context, token):
        probs = np.random.dirichlet(np.ones(self.vocab_size))
        return probs


class TargetModel:
    def __init__(self, vocab_size):
        self.vocab_size = vocab_size

    def get_probs(self, context, tokens=None):
        if tokens is not None:
            return [np.random.dirichlet(np.ones(self.vocab_size)) for _ in tokens]
        return np.random.dirichlet(np.ones(self.vocab_size))


def speculative_decode(draft_model, target_model, context, num_speculative=5,
                       draft_cost=1.0, target_cost=10.0, verify_cost=12.0):
    total_tokens = 0
    total_cost = 0.0
    accepted_counts = []
    context = list(context)

    max_tokens = 100

    while total_tokens < max_tokens:
        draft_tokens = draft_model.generate(context, num_speculative)
        total_cost += draft_cost * num_speculative

        target_probs = target_model.get_probs(context, draft_tokens)
        total_cost += verify_cost

        accepted = 0
        for i, token in enumerate(draft_tokens):
            draft_p = draft_model.get_probs(context + list(draft_tokens[:i]), token)
            target_p = target_probs[i]

            r = np.random.random()
            acceptance_prob = min(1.0, target_p[token] / (draft_p[token] + 1e-10))

            if r < draft_model.acceptance_rate:
                accepted += 1
                context.append(token)
                total_tokens += 1
            else:
                new_token = np.random.choice(draft_model.vocab_size, p=target_p)
                context.append(new_token)
                total_tokens += 1
                break

        accepted_counts.append(accepted)

        if accepted == num_speculative:
            bonus_probs = target_model.get_probs(context)
            bonus_token = np.random.choice(draft_model.vocab_size, p=bonus_probs)
            context.append(bonus_token)
            total_tokens += 1

    sequential_cost = total_tokens * target_cost
    return {
        "total_tokens": total_tokens,
        "speculative_cost": total_cost,
        "sequential_cost": sequential_cost,
        "speedup": sequential_cost / total_cost if total_cost > 0 else 1.0,
        "avg_accepted": np.mean(accepted_counts),
        "acceptance_rate": np.mean(accepted_counts) / num_speculative,
    }


def compare_speculation_strategies(vocab_size=1000, num_trials=20):
    results = {}

    for name, acceptance_rate, spec_tokens in [
        ("Draft-target (8B->70B)", 0.78, 5),
        ("EAGLE", 0.85, 6),
        ("N-gram", 0.50, 4),
        ("No speculation", 0.0, 0),
    ]:
        if spec_tokens == 0:
            results[name] = {
                "speedup": 1.0,
                "acceptance_rate": 0.0,
                "avg_accepted": 0.0,
            }
            continue

        trial_results = []
        for _ in range(num_trials):
            draft = DraftModel(vocab_size, acceptance_rate=acceptance_rate)
            target = TargetModel(vocab_size)
            context = list(np.random.randint(0, vocab_size, size=10))
            result = speculative_decode(draft, target, context, num_speculative=spec_tokens)
            trial_results.append(result)

        results[name] = {
            "speedup": np.mean([r["speedup"] for r in trial_results]),
            "acceptance_rate": np.mean([r["acceptance_rate"] for r in trial_results]),
            "avg_accepted": np.mean([r["avg_accepted"] for r in trial_results]),
        }

    return results
```

### 步骤 6：KV 缓存内存分析器

计算真实模型配置的 KV 缓存内存需求。

```python
MODEL_CONFIGS = {
    "Llama-3-8B": {
        "num_layers": 32, "num_kv_heads": 8, "head_dim": 128,
        "model_params_b": 8, "gqa": True,
    },
    "Llama-3-70B": {
        "num_layers": 80, "num_kv_heads": 8, "head_dim": 128,
        "model_params_b": 70, "gqa": True,
    },
    "Llama-3-405B": {
        "num_layers": 126, "num_kv_heads": 8, "head_dim": 128,
        "model_params_b": 405, "gqa": True,
    },
    "Mistral-7B": {
        "num_layers": 32, "num_kv_heads": 8, "head_dim": 128,
        "model_params_b": 7, "gqa": True,
    },
    "GPT-4-est": {
        "num_layers": 120, "num_kv_heads": 96, "head_dim": 128,
        "model_params_b": 1800, "gqa": False,
    },
}


def kv_cache_memory(config, seq_len, dtype_bytes=2):
    per_token = 2 * config["num_layers"] * config["num_kv_heads"] * config["head_dim"] * dtype_bytes
    total = per_token * seq_len
    return {
        "per_token_bytes": per_token,
        "per_token_kb": per_token / 1024,
        "total_bytes": total,
        "total_mb": total / (1024 ** 2),
        "total_gb": total / (1024 ** 3),
    }


def memory_budget(config, gpu_memory_gb, model_dtype_bytes=2, kv_dtype_bytes=2):
    model_memory_gb = config["model_params_b"] * 1e9 * model_dtype_bytes / (1024 ** 3)
    overhead_gb = gpu_memory_gb * 0.1
    available_for_kv = gpu_memory_gb - model_memory_gb - overhead_gb

    if available_for_kv <= 0:
        return {"error": "Model does not fit in GPU memory", "model_memory_gb": model_memory_gb}

    per_token = 2 * config["num_layers"] * config["num_kv_heads"] * config["head_dim"] * kv_dtype_bytes
    max_tokens = int(available_for_kv * (1024 ** 3) / per_token)

    return {
        "gpu_memory_gb": gpu_memory_gb,
        "model_memory_gb": round(model_memory_gb, 1),
        "overhead_gb": round(overhead_gb, 1),
        "available_for_kv_gb": round(available_for_kv, 1),
        "max_total_tokens": max_tokens,
        "max_users_at_2k": max_tokens // 2048,
        "max_users_at_4k": max_tokens // 4096,
        "max_users_at_32k": max_tokens // 32768,
    }
```

## 使用它

使用 vLLM：

```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="meta-llama/Llama-3-70B-Instruct",
    tensor_parallel_size=4,
    enable_prefix_caching=True,
    max_model_len=8192,
    gpu_memory_utilization=0.9,
)

params = SamplingParams(temperature=0.7, max_tokens=256)
outputs = llm.generate(["Explain inference optimization in one paragraph."], params)
```

使用 SGLang 进行前缀缓存 + 结构化输出：

```python
import sglang as sgl

@sgl.function
def classify(s, text):
    s += sgl.system("You are a classifier. Output JSON only.")
    s += sgl.user(f"Classify this text: {text}")
    s += sgl.assistant(sgl.gen("result", regex=r'\{"label": "(positive|negative|neutral)"\}'))

runtime = sgl.Runtime(model_path="meta-llama/Llama-3-70B-Instruct", tp_size=4)
sgl.set_default_backend(runtime)

results = classify.run_batch([
    {"text": "This product is amazing!"},
    {"text": "Terrible experience."},
    {"text": "It was okay I guess."},
])
```

使用 TensorRT-LLM：

```python
import tensorrt_llm
from tensorrt_llm.runtime import ModelRunner

runner = ModelRunner.from_dir("./llama-70b-trt-engine/", rank=0)

outputs = runner.generate(
    batch_input_ids=[tokenizer.encode("Explain KV caching.")],
    max_new_tokens=256,
    temperature=0.7,
)
```

## 交付

本课程生成：
- `outputs/skill-inference-optimization.md` —— 诊断和优化 LLM 推理服务的技能

## 练习

1. 修改 KV 缓存分析器以比较 FP16 vs FP8 vs INT4 KV 缓存量化。对于 4K 上下文的 Llama 3 70B，计算每种在 4xA100-80GB 上的最大并发用户数。KV 量化到 INT4 应该大致将用户容量提升 4 倍。

2. 扩展连续批处理模拟器以跟踪 GPU 利用率（每步填充的 batch 槽位比例）。为输出长度遵循帕累托分布（shape=1.5, scale=20）的 50 个请求绘制静态和连续批处理随时间的利用率。连续批处理应保持 >80% 利用率。

3. 实现分组查询注意力（GQA）版本的 KV 缓存，其中 `num_kv_heads < num_query_heads`。Llama 3 70B 使用 64 个 query 头但只有 8 个 KV 头。计算与完整多头注意力相比的内存节省（KV 缓存大小减少 8 倍）。

4. 构建一个使用 LRU 驱逐的前缀缓存。将 max_entries 设为 500，生成 1,000 个请求，其中 60% 共享 5 个常见前缀之一。测量命中率并与无限缓存比较。通过良好的驱逐，命中率应保持在 55% 以上。

5. 扩展推测解码模拟器以实现基于树的推测（EAGLE-2 风格）。不是单个 K 个草稿 token 链，而是生成候选树（例如，在 3 个级别各分 2 个分支 = 8 个叶候选）。与线性推测相比，每轮验证接受的总 token 数。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Prefill | "处理 prompt" | 在所有输入 token 上并行计算注意力 —— 计算受限，因为完整矩阵乘法让 GPU 核心保持忙碌 |
| Decode | "生成 token" | 每次前向传播产生一个 token，每次读取完整模型权重 —— 内存受限，因为计算在下一批权重到达前完成 |
| KV 缓存 | "缓存注意力状态" | 存储所有先前 token 的 key 和 value 投影，使它们在每次 decode 步骤中不被重新计算 —— 用内存换计算 |
| 连续批处理 | "动态批处理" | 在任何请求完成时立即将新请求插入运行中的 batch，在每个 decode 迭代时评估，而非等待整个 batch |
| PagedAttention | "KV 缓存的虚拟内存" | 以固定大小的页而非连续块分配 KV 缓存，消除内存碎片化并为共享前缀启用写时复制 |
| 推测解码 | "起草和验证" | 使用快速草稿模型提出多个 token，然后在一次目标模型前向传播中全部验证 —— 数学上精确，2-3 倍加速 |
| EAGLE | "自推测解码" | 推测解码的一种变体，在目标模型自己的隐藏状态上训练轻量级头，比单独草稿模型实现更高接受率 |
| 前缀缓存 | "复用系统 prompt KV" | 存储常见前缀（系统 prompt、少样本示例）的计算 KV 缓存条目，并在请求间复用以跳过冗余 prefill |
| Ops:byte 比率 | "算术强度" | 计算操作与内存读取字节数的比率 —— 决定工作负载是计算受限（高比率）还是内存受限（低比率） |
| 首 token 时间 | "TTFT" | 从接收请求到产生第一个输出 token 的延迟 —— 对长 prompt 由 prefill 时间主导 |

## 延伸阅读

- Kwon et al., "Efficient Memory Management for Large Language Model Serving with PagedAttention" (2023) —— 引入分页 KV 缓存管理的 vLLM 论文，现已成为推理服务的行业标准
- Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023) —— 基础论文，证明草稿-验证推测在实现 2-3 倍加速的同时产生精确的目标模型分布
- Li et al., "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty" (2024) —— 通过在目标模型自己的特征上训练头而非使用单独草稿模型，实现更高接受率
- Zheng et al., "SGLang: Efficient Execution of Structured Language Model Programs" (2024) —— 引入 RadixAttention 用于前缀缓存和用于多调用 LLM 程序的编程模型
- Williams et al., "Roofline: An Insightful Visual Performance Model for Multicore Architectures" (2009) —— 原始的 roofline 论文，形式化了 ops:byte 框架，用于推理计算与内存瓶颈
