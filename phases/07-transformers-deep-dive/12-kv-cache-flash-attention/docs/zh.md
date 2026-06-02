# KV Cache、Flash Attention 与推理优化

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 训练是并行的、受 FLOP 限制的；inference（推理）是串行的、受内存限制的。瓶颈不一样，玩法也不一样。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 minutes

## 问题（The Problem）

一个朴素的 autoregressive decoder 要生成 `N` 个 token，得做 `O(N²)` 的工作量：每一步都对整个前缀重新计算 attention。生成 4K token 的回复就是 1600 万次 attention 操作，其中绝大多数是冗余的。前缀里每个 token 的隐藏状态一旦算出来就固定了——你只需要拿新 token 的 query 去对前面所有缓存好的 keys 和 values 做一次运算。

不光如此，attention 自身还会搬运大量数据。标准 attention 要把 N×N 的分数矩阵、N×d 的 softmax 输出、N×d 的最终输出都物化出来——HBM 的读写次数太多了。当 N≥2K 时，attention 在变成 FLOP-bound 之前就已经是 memory-bound 了。经典 attention kernel 对现代 GPU 的利用率会差 4–10 倍。

两项优化（都来自 Dao 等人）把前沿 inference 从「慢」推到了「快」：

1. **KV cache。** 把每个前缀 token 的 K 和 V 向量存起来。每个新 token 的 attention 只需要拿一个 query 去查缓存好的 keys。每一步生成的 inference 复杂度从 `O(N²)` 降到 `O(N)`。
2. **Flash Attention。** 把 attention 计算切块（tile），让完整的 N×N 矩阵永远不进 HBM。softmax + matmul 整个过程都在 SRAM 里完成。在 A100 上 wall-clock 提速 2–4 倍；H100 配 FP8 提速 5–10 倍。

到了 2026 年，这两者已经无处不在。每个生产级 inference 栈（vLLM、TensorRT-LLM、SGLang、llama.cpp）都默认它们存在。每个前沿模型都自带 Flash Attention。

## 概念（The Concept）

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### KV cache 算账（KV cache math）

每个 decoder layer、每个 token、每个 head：

```
bytes_per_token_per_layer = 2 * d_head * dtype_size
                          ^
                          K and V
```

以一个 32 层、32 个 head、d_head=128、fp16 的 7B 模型为例：

```
per token per layer = 2 * 128 * 2 = 512 bytes
per token (32 layers) = 16 KB
per 32K context = 512 MB
```

Llama 3 70B（80 层、d_head=128、GQA 8 个 KV head）：

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KB)
per 32K context = 10.4 GB
```

这 10 GB 就是为什么 Llama 3 70B 在 128K context 下，batch size 1 都得吃掉一张 40 GB A100 的大半张——光 KV cache 就这么多。

**GQA 是 KV cache 上的胜利。** 64 个 head 的 MHA 会要 32 GB。MLA 还能压得更狠。

### Flash Attention —— 切块的把戏（Flash Attention — the tiling trick）

标准 attention：

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

三趟 HBM 往返。在 H100 上，HBM 带宽是 3 TB/s；SRAM 是 30 TB/s。每一趟 HBM 都比把数据留在片上慢 10 倍。

Flash Attention：

```
for each block of Q (tile size ~128 × 128):
    load Q_tile into SRAM
    for each block of K, V:
        load K_tile, V_tile into SRAM
        compute S_tile = Q_tile @ K_tile^T     (SRAM)
        running softmax aggregation             (SRAM)
        accumulate into O_tile                  (SRAM)
    write O_tile to HBM
```

每个 tile 只走一趟 HBM。总的内存占用从 `O(N²)` 降到 `O(N)`。反向传播时一些值不存而是从前向重新算——又省一笔内存。

**数值上的小技巧。** running softmax 在跨 tile 间维护 `(max, sum)`，最终归一化是精确的。这不是近似——Flash Attention 输出和标准 attention 是按位相同的（除了 fp16 非结合性带来的差异）。

**版本演进：**

| Version | Year | Key change | Speedup on reference hardware |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | Tiled SRAM kernel | 2× on A100 |
| Flash 2 | 2023 | Better parallelism, causal-first ordering | 3× on A100 |
| Flash 3 | 2024 | Hopper asynchrony, FP8 | 1.5–2× on H100 (~740 TFLOPs FP16) |
| Flash 4 | 2026 | Blackwell 5-stage pipeline, software exp2 | Inference-first (forward only initially) |

Flash 4 发布时只支持前向传播。训练仍然用 Flash 3。Flash 4 的 GQA 和 varlen 支持还在路上（2026 年中）。

### Speculative decoding —— 另一种延迟优化（Speculative decoding — the other latency win）

便宜的小模型先提议 N 个 token。大模型并行验证这 N 个。如果验证通过 k 个，那你就用一次大模型 forward 拿到了 k 个生成。在代码和散文上 k 通常是 3–5。

2026 年的默认配置：
- **EAGLE 2 / Medusa。** 集成式 draft head，和 verifier 共享隐藏状态。提速 2–3 倍，没有质量损失。
- **配 draft model 的 speculative decoding。** 在消费级硬件上提速 2–4 倍。
- **Lookahead decoding。** Jacobi 迭代，不需要 draft model。小众但白嫖。

### Continuous batching（连续批处理）

经典的批处理 inference：等最慢的序列跑完，再开新一批。短回复早早完工时 GPU 就闲着浪费了。

Continuous batching（最早在 Orca 上发布，现在 vLLM、TensorRT-LLM、SGLang 都用）：旧的一完成立刻把新请求塞进 batch。在典型聊天负载上吞吐能涨 5–10 倍。

### PagedAttention —— 把 KV cache 当虚拟内存（PagedAttention — KV cache as virtual memory）

vLLM 的招牌功能。KV cache 按 16-token 一块来分配；用一张页表把逻辑位置映射到物理块。这样可以在并行采样里共享 KV（beam search、并行采样）、为 prompt caching 热切换前缀、做内存碎片整理。相比朴素的连续分配，吞吐能提升 4 倍。

## 动手实现（Build It）

参见 `code/main.py`。我们实现：

1. 一个朴素的 `O(N²)` 增量 decoder。
2. 一个 `O(N)` 的带 KV cache 的 decoder。
3. 一个分块 softmax，模拟 Flash Attention 的 running-max 算法。

### 第 1 步：KV cache（Step 1: KV cache）

```python
class KVCache:
    def __init__(self, n_layers, n_heads, d_head):
        self.K = [[[] for _ in range(n_heads)] for _ in range(n_layers)]
        self.V = [[[] for _ in range(n_heads)] for _ in range(n_layers)]

    def append(self, layer, head, k, v):
        self.K[layer][head].append(k)
        self.V[layer][head].append(v)

    def read(self, layer, head):
        return self.K[layer][head], self.V[layer][head]
```

很简单：在按层、按 head 的列表里，不断追加每个 token 的 K、V 向量。

### 第 2 步：分块 softmax（Step 2: tiled softmax）

```python
def tiled_softmax_dot(q, K, V, tile=4):
    """Flash-attention-style softmax(qK^T)V with running max/sum."""
    m = float("-inf")
    s = 0.0
    out = [0.0] * len(V[0])
    for start in range(0, len(K), tile):
        k_block = K[start:start + tile]
        v_block = V[start:start + tile]
        scores = [sum(qi * ki for qi, ki in zip(q, k)) for k in k_block]
        new_m = max(m, *scores)
        exp_old = math.exp(m - new_m) if m != float("-inf") else 0.0
        exp_new = [math.exp(sc - new_m) for sc in scores]
        s = s * exp_old + sum(exp_new)
        for j in range(len(out)):
            out[j] = out[j] * exp_old + sum(e * v[j] for e, v in zip(exp_new, v_block))
        m = new_m
    return [o / s for o in out]
```

输出和一次性算 `softmax(qK) V` 是按位一致的，但在任何时刻 working set 只是 `tile × d_head` 这么大，而不是完整的 `N × d_head`。

### 第 3 步：在生成 100 个 token 上对比朴素 vs cached decoding（Step 3: compare naive vs cached decoding on 100-token generation）

数 attention 操作次数。朴素：`O(N²)` = 5050。带 cache：`O(N)` = 100。代码会把两者都打印出来。

## 用起来（Use It）

```python
# HuggingFace transformers auto-enables KV cache on decoder-only generate().
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # use FA3 if Hopper
    torch_dtype="bfloat16",
)
# generate() uses KV cache automatically
```

vLLM 生产环境：

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

跨请求的 prefix caching 是 2026 年的一大胜利——同一段 system prompt、few-shot 示例、长 context 文档可以在多次调用间复用 KV。对于反复带工具 prompt 的 agent 负载，prefix caching 通常能稳定提升 5 倍吞吐。

## 上线部署（Ship It）

参见 `outputs/skill-inference-optimizer.md`。这个 skill 会为新的 inference 部署挑选 attention 实现、KV cache 策略、量化方式和 speculative decoding。

## 练习（Exercises）

1. **简单。** 跑 `code/main.py`。确认朴素 decoder 和带 cache 的 decoder 输出一致；记下操作数差异。
2. **中等。** 实现 prefix caching：给定 prompt P 和若干补全，先对 P 跑一遍 forward 把 KV cache 填好，然后按补全分支。测一下相比每次重新对 P 编码的提速。
3. **困难。** 实现一个玩具版 PagedAttention：KV cache 按固定 16-token 块分配，配一个 free-list。序列结束时把它的块回收到池里。模拟 1,000 个长度不一的聊天补全。对比内存碎片化情况和连续分配。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| KV cache | "The trick that makes decoding fast" | Stored K and V from every prefix token; new queries attend to them instead of recomputing. |
| HBM | "GPU main memory" | High Bandwidth Memory; 80 GB on H100, 192 GB on B200. ~3 TB/s bandwidth. |
| SRAM | "On-chip memory" | Per-SM fast memory, ~256 KB per SM on H100. ~30 TB/s bandwidth. |
| Flash Attention | "Tiled attention kernel" | Computes attention without materializing N×N in HBM. |
| Continuous batching | "No-wait batching" | Swap finished sequences out, new ones in, without draining the batch. |
| PagedAttention | "vLLM's headline" | KV cache allocated in fixed blocks with a page table; eliminates fragmentation. |
| Prefix caching | "Reuse long prompts" | Cache KV for a shared prefix across requests; major cost cut for agents. |
| Speculative decoding | "Draft + verify" | Cheap draft model proposes tokens; big model verifies k in one pass. |

## 延伸阅读（Further Reading）

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) —— Flash 1。
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) —— Flash 2。
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) —— Flash 3。
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) —— Blackwell 5 段流水线 + software-exp2 的小技巧；本课提到的 forward-only 发布说明可以在 repo README 里读到。
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180) —— vLLM 论文。
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) —— speculative decoding。
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) —— 本课提到的集成 draft 思路对应的 EAGLE-1/2 论文。
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) —— 和 EAGLE 并列引用的 Medusa 方法。
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) —— 关于 16-token 块和页表设计的权威深度解读。
