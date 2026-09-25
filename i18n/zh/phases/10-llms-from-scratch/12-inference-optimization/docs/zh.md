# 推理优化

> 两个阶段定义了 LLM 推理。Prefill 并行处理你的提示词——受计算限制。Decode 一次生成一个 token——受内存限制。每一项优化都针对其中之一或两者。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lessons 01-08（Transformer 架构、注意力机制）
**Time:** ~120 分钟

## 学习目标

- 实现 KV-cache，消除自回归 token 生成中的冗余计算
- 解释 LLM 推理的 prefill 与 decode 阶段，以及为什么各自有不同的瓶颈（计算受限 vs 内存受限）
- 实现连续批处理（continuous batching）和 PagedAttention 概念，以在并发请求下最大化 GPU 利用率
- 比较推理优化技术（KV-cache、投机解码、flash attention）及其吞吐量/延迟权衡

## 问题所在

你在 4xA100 GPU 上部署 Llama 3 70B。单个用户可获得约 50 token/秒。感觉很快。然后 100 个用户同时访问端点。吞吐量降到 3 token/秒/用户。你每月 25,000 美元的 GPU 账单，响应速度却比人打字还慢。

从 1 个用户到 100 个用户，模型本身并没有变化。同样的权重、同样的架构、同样的数学。变化的是你如何调度工作。朴素的推理会浪费 90% 以上的可用 GPU 算力。一个等待第 47 个 token 的用户占用着整个批处理槽位，而 GPU 内存总线在矩阵乘法之间处于空闲状态。与此同时，一个新用户的 2,000-token 提示词本可以用有用的计算填满这段空闲时间。

这不是扩展性问题。这是调度问题。本课中的技术——KV 缓存、连续批处理、PagedAttention、投机解码、前缀缓存——正是区分一个 $25k/month inference bill from a $5k/月 服务相同流量的关键。

vLLM 在 4xA100-80GB 上服务 Llama 3 70B，在低并发下达到约 50 token/秒/用户，并通过连续批处理和 PagedAttention 在 100 个并发请求下维持 15-25 TPS/用户。没有这些优化，同样的硬件在该并发下只能提供 5 TPS/用户。同样的 GPU，同样的模型，4 倍的吞吐量。

## 核心概念

### Prefill 与 Decode

每个 LLM 推理请求都有两个不同的阶段。

**Prefill** 处理整个输入提示词。所有 token 都是已知的，因此注意力可以在整个序列上并行计算。这是一次大型矩阵乘法——GPU 核心保持忙碌。瓶颈是计算：你的硬件每秒能提供多少 FLOPS。一块 A100 可达 312 TFLOPS（BF16）。在单块 A100 上，对 70B 模型处理 4,096-token 提示词的 prefill 约需 400ms。

**Decode** 一次生成一个输出 token。每个新 token 都要关注所有之前的 token，但每次前向传播只产生一个 token。权重矩阵与 prefill 时相同大小，但你是在用单个向量而非矩阵与之相乘。GPU 核心在微秒内完成，然后等待下一批权重从内存到达。瓶颈是内存带宽：你从 HBM 向计算单元流式传输模型权重的速度。一块 A100 有 2 TB/s 带宽。一个 FP16 的 70B 模型是 140 GB。完整读取一次模型需要 70ms——这就是单个 decode 步骤的下限。

```mermaid
graph LR
    subgraph "Prefill (compute-bound)"
        P1["All prompt tokens"] --> P2["Parallel attention"]
        P2 --> P3["Full matmul utilization"]
    end

    subgraph "Decode (memory-bound)"
        D1["One token at a time"] --> D2["Sequential generation"]
        D2 --> D3["Waiting on memory reads"]
    end

    P3 --> D1
```

**ops:byte 比率**（也称算术强度）刻画了这一权衡。它衡量你每从内存加载一个字节执行多少操作。

```
ops:byte ratio = FLOPs per token / bytes read from memory
```

在批大小为 4,096 个 token 的 prefill 期间，你每加载一个权重执行约 4,096 次乘加运算。比率很高——你受计算限制。在批大小为 1 的 decode 期间，你每加载一个权重执行约 1 次操作。比率很低——你受内存限制。

根本洞见：*decode 是内存受限的，因为你读取整个模型只为产生一个 token*。下面的每一项优化要么减少你读取的内容，要么增加每次读取处理的 token 批量，要么完全避免读取。

### KV Cache

在注意力计算中，每个 token 的 query 都要关注所有之前 token 的 key 和 value 向量。如果不缓存，生成第 N 个 token 需要为所有前 N-1 个 token 重新计算 key 和 value 投影。Token 1 在生成 token 2 时被投影一次，生成 token 3 时再来一次，生成 token 4 时又来一次。到第 1,000 个 token 时，token 1 已被投影了总计 999 次。

KV cache 存储所有之前 token 的 key 和 value 投影。生成第 N 个 token 时，你只计算 token N 的 key 和 value，然后将它们与缓存的 token 1 到 N-1 的 K/V 拼接。

```mermaid
graph TD
    subgraph "Without KV Cache"
        A1["Token 5: recompute K,V for tokens 1-4"]
        A2["Token 6: recompute K,V for tokens 1-5"]
        A3["Token 7: recompute K,V for tokens 1-6"]
    end

    subgraph "With KV Cache"
        B1["Token 5: compute K5,V5, read K1-4,V1-4 from cache"]
        B2["Token 6: compute K6,V6, read K1-5,V1-5 from cache"]
        B3["Token 7: compute K7,V7, read K1-6,V1-6 from cache"]
    end
```

**KV cache 的内存公式：**

```
KV cache size = 2 * num_layers * num_kv_heads * head_dim * seq_len * bytes_per_param
```

对于 Llama 3 70B（80 层、GQA 的 8 个 KV 头、head_dim=128、BF16）：

```
per token: 2 * 80 * 8 * 128 * 2 bytes = 327,680 bytes = 320 KB
at 4,096 tokens: 320 KB * 4,096 = 1.28 GB
at 128K tokens: 320 KB * 131,072 = 40 GB
```

Llama 3 70B 的一次 128K 上下文对话消耗 40 GB KV cache——半个 A100 的内存。100 个并发用户各 4K token 时，仅 KV cache 就需要 128 GB。这就是为什么 KV cache 管理是推理优化的核心挑战。

### Continuous Batching

静态批处理等待一批 N 个请求到达，一起处理它们，并等到*全部*完成才接受新请求。如果一个请求需要 500 个 token 而另一个需要 10 个，短请求在完成后会闲置 490 个 decode 步骤。

连续批处理（也称迭代级批处理）在任何请求完成的瞬间就向批次中插入新请求。批次在每个 decode 步骤都被重新评估。一个在 10 个 token 后完成的请求立即被一个等待中的请求替换。

```mermaid
sequenceDiagram
    participant GPU
    participant R1 as Request 1 (50 tokens)
    participant R2 as Request 2 (10 tokens)
    participant R3 as Request 3 (30 tokens)
    participant R4 as Request 4 (waiting)

    Note over GPU: Static batching
    GPU->>R1: Process batch [R1, R2, R3]
    Note over R2: R2 done at step 10
    Note over R2: Wasting 40 steps...
    Note over R3: R3 done at step 30
    Note over R3: Wasting 20 steps...
    GPU->>R4: Finally start R4 at step 50

    Note over GPU: Continuous batching
    GPU->>R1: Process batch [R1, R2, R3]
    Note over R2: R2 done at step 10
    GPU->>R4: Insert R4 at step 11
    Note over R3: R3 done at step 30
```

吞吐量提升取决于输出长度的差异程度。长度均匀时，连续批处理与静态批处理相当。长度可变时（常见情况），连续批处理可提供 2-5 倍的更高吞吐量，因为 GPU 槽位从不清空。

### PagedAttention

每个请求的 KV cache 是一块连续内存。随着请求的到来和离开，内存碎片化——与操作系统中的 RAM 碎片完全一样。一个 4K-token 请求需要 1.28 GB 连续内存。即使你总共有 2 GB 空闲，也可能没有 1.28 GB *连续*空间。你要么浪费内存，要么拒绝该请求。

PagedAttention（来自 vLLM）将操作系统式的虚拟内存应用于 KV cache。它不为每个请求分配一个连续块，而是分配固定大小的"页"（通常每页 16 个 token）。页可以位于物理 GPU 内存的任何位置。一个页表将每个请求的逻辑序列位置映射到物理页位置。

```mermaid
graph TD
    subgraph "Contiguous allocation"
        C1["Request A: 2GB block"]
        C2["[free: 0.5GB]"]
        C3["Request B: 1GB block"]
        C4["[free: 1.5GB -- but fragmented]"]
    end

    subgraph "PagedAttention"
        P1["Page pool: 256 pages of 16 tokens each"]
        P2["Request A: pages 3,7,12,45,88..."]
        P3["Request B: pages 1,4,9,22,67..."]
        P4["No fragmentation, no waste"]
    end
```

PagedAttention 还为共享前缀启用了**写时复制**（copy-on-write）。如果 50 个请求共享同一个系统提示词，该系统提示词的 KV cache 页只存储一次，由所有 50 个请求引用。只有当请求分叉时（不同的用户消息），它才获得自己的页。对于具有共享系统提示词的应用，这大幅削减了内存使用。

vLLM 报告通过 PagedAttention 实现接近零的内存浪费（约 4%，而朴素分配约为 60-80%）。

### Speculative Decoding

Decode 之所以慢，是因为它是串行的——你生成一个 token，喂回去，再生成下一个。但如果你能廉价地猜测接下来的 5 个 token，然后一次性验证它们呢？

投机解码使用一个小而快的**草稿模型**生成 K 个候选 token。然后大型**目标模型**在单次前向传播中处理所有 K 个候选（这看起来像一次 prefill——并行、计算受限、高效）。如果目标模型同意草稿模型的预测，你在一次目标前向传播的时间内接受全部 K 个 token。如果它在位置 j 上不同意，你接受 token 1 到 j-1，丢弃其余的。

```mermaid
graph LR
    D["Draft model (1B)"] -->|"Generate 5 tokens<br/>~5ms"| C["Candidates: the cat sat on the"]
    C --> T["Target model (70B)"]
    T -->|"Verify all 5 in one pass<br/>~70ms"| V{"Match?"}
    V -->|"4 of 5 match"| A["Accept 4 tokens in 75ms<br/>vs 280ms sequential"]
    V -->|"Mismatch at pos 5"| R["Reject token 5<br/>Resample from target"]
```

加速取决于**接受率**——草稿模型的预测与目标匹配的频率。对于用 Llama 3 8B 为 Llama 3 70B 起草，在自然语言上接受率通常为 70-85%。这转化为 2-3 倍的 decode 加速。

投机解码的三种方法：

| 方法 | 草稿来源 | 接受率 | 开销 |
|--------|-------------|-----------------|----------|
| Draft-target（Leviathan 等人） | 独立的小模型 | 70-85% | 草稿模型内存 |
| EAGLE（Li 等人） | 目标模型上的轻量头 | 75-90% | ~1% 额外参数 |
| N-gram 查找 | Token n-gram 表 | 40-60% | 可忽略 |

**EAGLE** 在目标模型的隐藏状态之上训练一个小的自回归头。它使用目标模型的倒数第二层特征预测下一个 token 的嵌入。由于它作用于目标模型自身的表示（而非独立模型的），它以最小的额外内存实现更高的接受率。EAGLE-2 增加了一个动态草稿树，根据上下文调整候选数量。

**N-gram 投机解码**维护一个来自当前上下文或预构建语料的 n-gram 续写表。如果草稿与同一对话中之前出现的内容匹配（重复模式、代码、结构化输出），它以零神经网络开销触发。接受率平均较低，但每次推测的成本几乎为零。

投机解码在*数学上是精确的*——输出分布与目标模型的分布完全相同。它不是近似。验证步骤确保每个被接受的 token 恰好具有目标模型本会赋予的概率。

### Prefix Caching

许多请求共享相同的前缀。聊天机器人的系统提示词。RAG 上下文块。少样本示例集。没有前缀缓存，每个请求都要从头重新计算这些共享 token 的 KV cache。

前缀缓存存储公共前缀的 KV cache 并跨请求复用。当新请求带着已知前缀到达时，系统复制（或引用）缓存的 KV 条目，只为唯一的后缀计算 KV。

对于跨所有请求共享的 2,000-token 系统提示词，前缀缓存为每个请求消除约 400ms 的 prefill。在每秒 100 个请求下，每秒节省 40 秒 GPU 计算——超过一块 GPU 的工作量。

SGLang 的 RadixAttention 使用基数树（trie）实现前缀缓存，按 token 内容索引前缀。任何匹配已存储前缀的请求免费获得其 KV cache。树支持部分前缀匹配——如果你与某个缓存条目共享 2,000 个前缀 token 中的 1,500 个，你复用这 1,500 个，只重新计算 500 个。

### 推理引擎

三个引擎主导生产级 LLM 服务：

| 引擎 | 关键创新 | 最适合 |
|--------|---------------|----------|
| vLLM | PagedAttention、连续批处理 | 通用服务，最高兼容性 |
| SGLang | RadixAttention（前缀缓存）、结构化生成 | 多轮聊天机器人、受约束解码 |
| TensorRT-LLM | NVIDIA 内核融合、FP8 量化 | NVIDIA 硬件上的最大单 GPU 吞吐量 |

**vLLM** 是默认起点。它支持最广泛的模型，可在任何 GPU 厂商（NVIDIA、AMD、Intel）上运行，并通过 PagedAttention + 连续批处理实现强大吞吐量。其 OpenAI 兼容 API 意味着你可以直接将它作为任何 OpenAI API 调用的替代品。

**SGLang** 建立在 vLLM 相同的基础之上，但增加了用于前缀缓存的 RadixAttention 和一种用于结构化 LLM 程序的领域特定语言。如果你的工作负载涉及多轮对话、工具使用或受约束解码（JSON 输出、正则引导生成），SGLang 通过前缀复用通常比 vLLM 高出 2-5 倍。

**TensorRT-LLM** 将模型编译为优化的 NVIDIA GPU 内核。它融合操作（注意力 + 线性 + 激活在单个内核中），在 H100 GPU 上使用 FP8，并与 NVIDIA Triton Inference Server 集成以进行生产部署。它在 NVIDIA 硬件上实现最高的单 GPU 吞吐量，但需要更多设置且只在 NVIDIA GPU 上工作。

Llama 3 70B 的真实世界数据（4xA100-80GB、BF16）：

| 指标 | vLLM | SGLang | TensorRT-LLM |
|--------|------|--------|---------------|
| 吞吐量（1 用户） | ~50 TPS | ~55 TPS | ~65 TPS |
| 吞吐量（100 用户） | ~2,500 总 TPS | ~3,200 总 TPS | ~3,000 总 TPS |
| 首 token 时间 | ~400ms | ~300ms（前缀命中） | ~350ms |
| 最大上下文 | 128K | 128K | 128K |

### Ops:Byte 框架

你无法优化你没有度量的东西。ops:byte 比率告诉你自己是计算受限还是内存受限，这决定了哪些优化才是重要的。

```
Compute roof: peak FLOPS of the GPU
Memory roof:  peak bandwidth * ops:byte ratio
```

当 ops:byte 低时（decode、小批次），你会撞上内存带宽天花板。增加更多算力（更高时钟频率、更多核心）无济于事。你需要减少内存读取（量化、KV cache 压缩）或增加批大小以将读取分摊到更多有用工作上。

当 ops:byte 高时（prefill、大批次），你会撞上计算天花板。内存带宽优化无济于事。你需要更快的 GPU、内核融合或降低精度以挤出更多 FLOPS。

| 场景 | ops:byte | 受限 | 优化手段 |
|----------|----------|-------|---------------|
| Prefill, batch=1 | ~4,096 | 计算 | 内核融合、FP8 |
| Decode, batch=1 | ~1 | 内存 | 量化、KV 压缩 |
| Decode, batch=32 | ~32 | 内存 | 更大批次、连续批处理 |
| Decode, batch=256 | ~256 | 过渡 | 两者都重要 |
| Decode, batch=1024 | ~1,024 | 计算 | 内核融合、张量并行 |

A100 上的交叉点在 ops:byte = 156 左右（312 TFLOPS / 2 TB/s）。低于 156，你受内存限制。高于 156，你受计算限制。连续批处理通过在每次迭代中打包更多 token，将 decode 推向这个交叉点。

```figure
context-window-slide
```

## 动手构建

### 步骤 1：从零实现 KV Cache

我们构建一个多头 KV cache，按层、按头存储 key 和 value 投影，并展示内存增长模式。

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

### 步骤 2：带 KV Cache 的注意力

一个在 decode 步骤中使用 KV cache 的简化多头注意力。

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

这模拟了静态批处理与连续批处理之间的调度差异。

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

### 步骤 5：投机解码模拟器

我们模拟可配置接受率的 draft-target 投机解码。

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

### 步骤 6：KV Cache 内存分析器

为真实模型配置计算 KV cache 内存需求。

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

## 交付它

本课产出：
- `outputs/skill-inference-optimization.md` —— 一个用于诊断和优化 LLM 推理服务的技能

## 练习

1. 修改 KV cache 分析器，比较 FP16 vs FP8 vs INT4 KV cache 量化。对于 4K 上下文的 Llama 3 70B，在 4xA100-80GB 上计算每种情况的最大并发用户数。KV 量化到 INT4 应使用户容量大约提升 4 倍。

2. 扩展连续批处理模拟器以跟踪 GPU 利用率（每步批处理槽位被填充的比例）。对 50 个输出长度服从 Pareto 分布（shape=1.5, scale=20）的请求，绘制静态和连续批处理的利用率随时间的变化。连续批处理应保持 >80% 的利用率。

3. 实现 KV cache 的分组查询注意力（GQA）版本，其中 `num_kv_heads < num_query_heads`。Llama 3 70B 使用 64 个 query 头但只有 8 个 KV 头。计算相对于完整多头注意力的内存节省（KV cache 大小减少 8 倍）。

4. 构建一个使用 LRU 淘汰的前缀缓存。将 max_entries 设为 500，生成 1,000 个请求，其中 60% 共享 5 个公共前缀之一。测量命中率并与无限制缓存比较。良好的淘汰策略下，命中率应保持在 55% 以上。

5. 扩展投机解码模拟器以实现基于树的推测（EAGLE-2 风格）。不是生成 K 个草稿 token 的单条链，而是生成一棵候选树（例如 3 层每层 2 个分支 = 8 个叶候选）。比较每轮验证接受的总 token 数与线性推测。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|----------------------|
| Prefill | "处理提示词" | 并行计算所有输入 token 上的注意力——计算受限，因为完整的矩阵乘法使 GPU 核心保持忙碌 |
| Decode | "生成 token" | 每次前向传播产生一个 token，每次都读取完整模型权重——内存受限，因为计算在下一次权重到达之前就完成了 |
| KV cache | "缓存注意力状态" | 存储所有之前 token 的 key 和 value 投影，使其在每个 decode 步骤不被重新计算——用内存换计算 |
| Continuous batching | "动态批处理" | 任何请求一完成就向运行中的批次插入新请求，在每个 decode 迭代时评估，而不是等待整批完成 |
| PagedAttention | "KV cache 的虚拟内存" | 以固定大小的页而非连续块分配 KV cache，消除内存碎片并为共享前缀启用写时复制 |
| Speculative decoding | "草稿与验证" | 使用快速草稿模型提出多个 token，然后在一次目标模型前向传播中全部验证——数学上精确，2-3 倍加速 |
| EAGLE | "自投机解码" | 一种投机解码变体，在目标模型自身的隐藏状态上训练轻量头，实现比独立草稿模型更高的接受率 |
| Prefix caching | "复用系统提示词 KV" | 存储公共前缀（系统提示词、少样本示例）的计算过的 KV cache 条目并跨请求复用，以跳过冗余 prefill |
| Ops:byte 比率 | "算术强度" | 计算操作数与读取内存字节数之比——决定工作负载是计算受限（高比率）还是内存受限（低比率） |
| Time to first token | "TTFT" | 从接收请求到产生第一个输出 token 的延迟——长提示词时由 prefill 时间主导 |

## 延伸阅读

- Kwon 等人，"Efficient Memory Management for Large Language Model Serving with PagedAttention"（2023）——引入分页 KV cache 管理的 vLLM 论文，如今是推理服务的行业标准
- Leviathan 等人，"Fast Inference from Transformers via Speculative Decoding"（2023）——奠基性论文，证明 draft-verify 推测产生精确的目标模型分布，同时实现 2-3 倍加速
- Li 等人，"EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"（2024）——通过在目标模型自身特征上训练头而非使用独立草稿模型，实现更高的接受率
- Zheng 等人，"SGLang: Efficient Execution of Structured Language Model Programs"（2024）——引入用于前缀缓存的 RadixAttention 和面向多次调用 LLM 程序的编程模型
- Williams 等人，"Roofline: An Insightful Visual Performance Model for Multicore Architectures"（2009）——原始 roofline 论文，将 ops:byte 框架形式化，用于推理计算与内存瓶颈