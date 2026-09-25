# KV 缓存、Flash Attention 与推理优化

> 训练是并行的、受 FLOP 限制的。推理是串行的、受内存限制的。瓶颈不同，技巧也不同。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 分钟

## 问题所在

朴素的自回归解码器生成 `N` 个 token 需要 `O(N²)` 的工作量：每一步都要对完整前缀重新计算注意力。对于一个 4K token 的回复，这意味着 1600 万次注意力操作，其中大部分是冗余的。前缀 token 的每个隐藏状态一旦计算出来就是确定的——你只需要将新 token 的 query 与之前所有 token 的缓存 key 和 value 进行计算即可。

除此之外，注意力本身也会搬运大量数据。标准注意力会物化一个 N×N 的分数矩阵、N×d 的 softmax 输出、N×d 的最终输出——对 HBM 的读写次数太多。当 N≥2K 时，注意力在受 FLOP 限制之前就已先变成受内存限制。经典注意力内核对现代 GPU 的利用率低了 4–10 倍。

两项优化（均来自 Dao 等人）将前沿推理从“慢”推向了“快”：

1. **KV 缓存。** 存储每个前缀 token 的 K 和 V 向量。每个新 token 的注意力只需一个 query 对缓存的 key 进行计算。推理从每步 `O(N²)` 降低到 `O(N)`。
2. **Flash Attention。** 对注意力计算进行分块，使完整的 N×N 矩阵永远不会进入 HBM。全部 softmax + matmul 都在 SRAM 中完成。在 A100 上获得 2–4 倍的实际运行加速；在 H100 上配合 FP8 获得 5–10 倍加速。

到 2026 年，这两项技术已成为通用标准。每个生产级推理框架（vLLM、TensorRT-LLM、SGLang、llama.cpp）都默认使用它们。每个前沿模型出厂时都启用 Flash Attention。

## 核心概念

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### KV 缓存计算

每个解码器层、每个 token、每个注意力头：

```
bytes_per_token_per_layer = 2 * d_head * dtype_size
                          ^
                          K and V
```

对于一个 7B 模型，32 层、32 个注意力头、d_head=128、fp16：

```
per token per layer = 2 * 128 * 2 = 512 bytes
per token (32 layers) = 16 KB
per 32K context = 512 MB
```

对于 Llama 3 70B（80 层、d_head=128、采用 8 个 KV 头的 GQA）：

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KB)
per 32K context = 10.4 GB
```

这 10 GB 就是为什么 Llama 3 70B 在 128K 上下文下，即使批大小为 1，KV 缓存也需要占满 40 GB A100 的大部分显存。

**GQA 是 KV 缓存的关键优势。** 使用 64 个注意力头的 MHA 会占用 32 GB。MLA 的压缩效果更甚。

拖动各维度参数，观察缓存大小的变化。增大序列长度或批大小，看看它多快就会超出单张 GPU 的容量：

```figure
kv-cache-sizer
```

### Flash Attention —— 分块技巧

标准注意力：

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

三次 HBM 往返。在 H100 上，HBM 带宽为 3 TB/s；SRAM 为 30 TB/s。与将所有数据保持在片上相比，每次 HBM 往返都会带来 10 倍的性能下降。

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

每个分块只需一次 HBM 往返。总内存占用从 `O(N²)` 降低到 `O(N)`。反向传播会重新计算前向传播中的某些值而不是存储它们——又一次内存上的胜利。

**数值技巧。** 运行 softmax 时会跨分块维护 `(max, sum)`，因此最终归一化是精确的。这不是近似——Flash Attention 计算出的输出与标准注意力逐位一致（fp16 非结合性除外）。

**版本演进：**

| 版本 | 年份 | 关键变化 | 参考硬件上的加速 |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | 基于 SRAM 的分块内核 | A100 上 2 倍 |
| Flash 2 | 2023 | 更好的并行性、causal 优先排序 | A100 上 3 倍 |
| Flash 3 | 2024 | Hopper 异步、FP8 | H100 上 1.5–2 倍（约 740 TFLOPs FP16） |
| Flash 4 | 2026 | Blackwell 5 级流水线、软件 exp2 | 推理优先（初期仅前向） |

Flash 4 发布时仅支持前向传播。训练仍使用 Flash 3。Flash 4 对 GQA 和 varlen 的支持尚待推出（2026 年中）。

### 投机解码 —— 另一个延迟优化

廉价模型提出 N 个 token。大模型并行验证全部 N 个。如果验证接受了 k 个 token，你就用 1 次大模型前向传播换取了 k 个 token 的生成。在代码和普通文本上典型的 k=3–5。

2026 年的默认选择：
- **EAGLE 2 / Medusa。** 集成的草稿头，共享验证器的隐藏状态。2–3 倍加速且无质量损失。
- **带草稿模型的投机解码。** 在消费级硬件上 2–4 倍加速。
- **Lookahead 解码。** Jacobi 迭代；无需草稿模型。小众但免费。

### 连续批处理

经典批处理推理：等待最慢的序列完成，然后开始新的一批。当短回复提前完成时会浪费 GPU。

连续批处理（最早由 Orca 实现，现已在 vLLM、TensorRT-LLM、SGLang 中提供）：一旦旧序列完成，立即将新请求换入批次。对于典型的聊天工作负载，可带来 5–10 倍的吞吐量提升。

### PagedAttention —— 作为虚拟内存的 KV 缓存

vLLM 的招牌特性。KV 缓存以 16-token 的块为单位分配；页表将逻辑位置映射到物理块。让你可以在并行采样（束搜索、并行采样）之间共享 KV、为提示缓存热替换前缀，并对内存进行碎片整理。相比朴素连续分配，吞吐量提升 4 倍。

```figure
flash-attention-memory
```

## 动手构建

参见 `code/main.py`。我们将实现：

1. 一个朴素的 `O(N²)` 增量解码器。
2. 一个 `O(N)` 基于 KV 缓存的解码器。
3. 一个模拟 Flash Attention 运行最大值算法的分块 softmax。

### 步骤 1：KV 缓存

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

很简单：在每个层、每个注意力头的列表中持续追加每个 token 的 K、V 向量。

### 步骤 2：分块 softmax

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

一次性输出与 `softmax(qK) V` 逐位一致的结果，但任意时刻的工作集都只是一个 `tile × d_head` 的分块，而不是完整的 `N × d_head`。

### 步骤 3：在 100-token 生成上比较朴素解码与缓存解码

统计注意力操作次数。朴素：`O(N²)` = 5050。缓存：`O(N)` = 100。代码会打印这两个数字。

## 使用

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

vLLM 生产部署：

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

跨请求的前缀缓存是 2026 年的一大亮点——相同的系统提示、few-shot 示例或长上下文文档可以在多次调用间复用 KV。对于具有重复工具提示的 agent 工作负载，前缀缓存通常能带来 5 倍的吞吐量提升。

## 上线部署

参见 `outputs/skill-inference-optimizer.md`。该技能会为新的推理部署选择注意力实现、KV 缓存策略、量化方案和投机解码。

## 练习

1. **简单。** 运行 `code/main.py`。确认朴素解码器和缓存解码器产生相同的输出；记录操作次数的差异。
2. **中等。** 实现前缀缓存：给定提示 P 和若干补全，对 P 运行一次前向传播填充 KV 缓存，然后按补全分支。测量与每次重新编码 P 相比的速度提升。
3. **困难。** 实现一个玩具版 PagedAttention：KV 缓存放在固定 16-token 的块中并维护一个空闲链表。当一个序列完成时，将其块归还池中。模拟 1,000 次长度不一的聊天补全。比较与连续分配相比的内存碎片情况。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| KV 缓存 | “让解码变快的技巧” | 存储每个前缀 token 的 K 和 V；新的 query 直接对它们进行注意力计算，无需重新计算。 |
| HBM | “GPU 主存” | High Bandwidth Memory（高带宽内存）；H100 上为 80 GB，B200 上为 192 GB。带宽约 3 TB/s。 |
| SRAM | “片上内存” | 每 SM 的快速内存，H100 上每个 SM 约 256 KB。带宽约 30 TB/s。 |
| Flash Attention | “分块注意力内核” | 在不于 HBM 中物化 N×N 矩阵的情况下计算注意力。 |
| 连续批处理 | “无等待批处理” | 完成的序列换出，新的换入，无需清空整个批次。 |
| PagedAttention | “vLLM 的招牌” | KV 缓存按固定块分配并配有页表；消除碎片。 |
| 前缀缓存 | “复用长提示” | 跨请求缓存共享前缀的 KV；对 agent 而言是主要的成本削减手段。 |
| 投机解码 | “草稿 + 验证” | 廉价的草稿模型提出 token；大模型一次前向验证 k 个。 |

## 延伸阅读

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) — Flash 1。
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) — Flash 2。
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) — Flash 3。
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) — Blackwell 5 级流水线与 software-exp2 技巧；阅读仓库 README 了解本课提到的仅前向发布限制。
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180) — vLLM 论文。
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — 投机解码。
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) — 本课引用的集成草稿方法的 EAGLE-1/2 论文。
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) — 与 EAGLE 一同被提及的 Medusa 方法。
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) — 关于 16-token 块与页表设计的权威深度解读。