# 12 · KV 缓存、Flash Attention 与推理优化

> 训练是并行的、受算力（FLOP）约束的；推理是串行的、受显存带宽约束的。瓶颈不同，技巧也不同。

**类型：** 实战构建
**语言：** Python
**前置：** 阶段 7 · 02（自注意力）、阶段 7 · 05（完整 Transformer）、阶段 7 · 07（GPT）
**时长：** 约 75 分钟

## 问题所在

一个朴素的自回归解码器为了生成 `N` 个 token，要做 `O(N²)` 的工作量：每一步都对整个前缀重新计算注意力。对于一个 4K token 的回复，这是 1600 万次注意力运算，其中大部分都是冗余的。前缀中每个 token 的隐藏状态一旦计算出来就是确定的——你只需要用新 token 的查询（query）去对前面所有内容的缓存键（key）和值（value）做计算即可。

除此之外，注意力本身还要搬运大量数据。标准注意力会实例化一个 N×N 的分数矩阵、N×d 的 softmax 输出、N×d 的最终输出——对「高带宽显存（HBM）」的读写次数太多。当 N≥2K 时，注意力在受算力约束之前就先受显存带宽约束了。经典的注意力核（kernel）对现代 GPU 的利用率要低 4~10 倍。

两项优化（均出自 Dao 等人）把前沿推理从「慢」推进到了「快」：

1. **KV 缓存（KV cache）。** 存储每个前缀 token 的 K 和 V 向量。每个新 token 的注意力就是一次查询对缓存键的计算。推理从每一步生成的 `O(N²)` 降到 `O(N)`。
2. **Flash Attention。** 对注意力计算做分块（tile），使完整的 N×N 矩阵永远不进入 HBM。整个 softmax + 矩阵乘法都在 SRAM 中完成。在 A100 上墙钟时间加速 2~4 倍；在 H100 上配合 FP8 加速 5~10 倍。

到 2026 年，二者都已普及。每一套生产级推理栈（vLLM、TensorRT-LLM、SGLang、llama.cpp）都默认使用它们。每个前沿模型出厂都启用了 Flash Attention。

## 核心概念

〔图：KV 缓存的增长与 Flash Attention 的分块计算〕

### KV 缓存的算术

按每个解码器层、每个 token、每个注意力头计算：

```
bytes_per_token_per_layer = 2 * d_head * dtype_size
                          ^
                          K 和 V
```

对于一个 32 层、32 头、d_head=128、fp16 的 7B 模型：

```
每 token 每层 = 2 * 128 * 2 = 512 字节
每 token（32 层） = 16 KB
每 32K 上下文 = 512 MB
```

对于 Llama 3 70B（80 层，d_head=128，采用 GQA、8 个 KV 头）：

```
每 token 每层 = 2 * 8 * 128 * 2 = 4096 字节（4 KB）
每 32K 上下文 = 10.4 GB
```

这 10 GB 就是为什么 Llama 3 70B 在 128K 上下文、batch size 为 1 时，仅 KV 缓存就要占掉一块 40 GB A100 的大部分显存。

**GQA 正是 KV 缓存的制胜点。** 64 头的「多头注意力（MHA）」会占 32 GB。「多头潜在注意力（MLA）」则压缩得更狠。

### Flash Attention——分块技巧

标准注意力：

```
S = Q @ K^T          (HBM 读, N×N, HBM 写)
P = softmax(S)       (HBM 读, HBM 写)
O = P @ V            (HBM 读, HBM 写)
```

三次 HBM 往返。在 H100 上，HBM 带宽是 3 TB/s；SRAM 是 30 TB/s。相比把一切都留在片上，每一次 HBM 往返都意味着 10 倍的减速。

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

每个分块只需一次 HBM 往返。总显存占用从 `O(N²)` 降到 `O(N)`。反向传播会从前向传播中重新计算一些值，而不是存储它们——这又省下了显存。

**数值技巧。** 滚动 softmax 在各分块间维护 `(max, sum)`，使最终的归一化精确无误。这不是近似——Flash Attention 计算出的输出与标准注意力逐比特一致（忽略 fp16 不满足结合律带来的差异）。

**版本演进：**

| 版本 | 年份 | 关键变化 | 在参考硬件上的加速比 |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | 分块 SRAM 核 | A100 上 2× |
| Flash 2 | 2023 | 更好的并行度、因果优先排序 | A100 上 3× |
| Flash 3 | 2024 | Hopper 异步、FP8 | H100 上 1.5~2×（约 740 TFLOPs FP16） |
| Flash 4 | 2026 | Blackwell 5 级流水线、软件实现 exp2 | 推理优先（初期仅前向） |

Flash 4 在发布时仅支持前向传播。训练仍使用 Flash 3。Flash 4 对 GQA 和变长（varlen）的支持尚待补齐（2026 年中）。

### 投机解码（speculative decoding）——另一项延迟优化

廉价模型提出 N 个 token。大模型并行验证全部 N 个。如果验证接受了 k 个 token，那么你用 1 次大模型前向传播换来了 k 次生成。在代码和散文上，k 通常为 3~5。

2026 年的默认方案：
- **EAGLE 2 / Medusa。** 集成式草稿头（draft head），共享验证器的隐藏状态。加速 2~3 倍且无质量损失。
- **带草稿模型的投机解码。** 在消费级硬件上加速 2~4 倍。
- **前瞻解码（Lookahead decoding）。** 雅可比（Jacobi）迭代；无需草稿模型。小众但免费。

### 连续批处理（continuous batching）

经典的批处理推理：等待最慢的序列完成，再开始新的一批。当短回复提前结束时会浪费 GPU。

连续批处理（最早在 Orca 中落地，如今见于 vLLM、TensorRT-LLM、SGLang）：一旦旧请求完成，就立即把新请求换入这一批。对典型聊天负载吞吐量提升 5~10 倍。

### PagedAttention——把 KV 缓存当作虚拟内存

vLLM 的招牌特性。KV 缓存以 16 token 为一块（block）来分配；一张页表（page table）将逻辑位置映射到物理块。这让你能够在并行采样间共享 KV（束搜索、并行采样）、为提示缓存（prompt caching）热替换前缀，以及对内存做碎片整理。相比朴素的连续分配，吞吐量提升 4 倍。

## 动手构建

参见 `code/main.py`。我们实现：

1. 一个朴素的 `O(N²)` 增量解码器。
2. 一个 `O(N)` 的 KV 缓存解码器。
3. 一个分块 softmax，模拟 Flash Attention 的滚动最大值算法。

### 第 1 步：KV 缓存

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

很简单：在按层、按头组织的列表中，不断追加每个 token 的 K、V 向量。

### 第 2 步：分块 softmax

```python
def tiled_softmax_dot(q, K, V, tile=4):
    """带滚动 max/sum 的 Flash-attention 风格 softmax(qK^T)V。"""
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

输出与一次性的 `softmax(qK) V` 逐比特一致，但任意时刻的工作集都是一个 `tile × d_head` 的块，而非完整的 `N × d_head`。

### 第 3 步：在 100 token 的生成上对比朴素解码与缓存解码

统计注意力运算次数。朴素：`O(N²)` = 5050。缓存：`O(N)` = 100。代码会把两者都打印出来。

## 实际使用

```python
# HuggingFace transformers 在 decoder-only 的 generate() 上自动启用 KV 缓存。
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # 若为 Hopper 则用 FA3
    torch_dtype="bfloat16",
)
# generate() 会自动使用 KV 缓存
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

跨请求的前缀缓存是 2026 年的一大利好——相同的系统提示词、少样本示例或长上下文文档，可以在多次调用间复用 KV。对于反复使用工具提示词的智能体（agent）负载，前缀缓存通常能带来 5 倍的吞吐量提升。

## 上线交付

参见 `outputs/skill-inference-optimizer.md`。该 skill 会为一次新的推理部署挑选注意力实现、KV 缓存策略、量化方案以及投机解码方案。

## 练习

1. **简单。** 运行 `code/main.py`。确认朴素解码器与缓存解码器产生相同输出；记录运算次数的差异。
2. **中等。** 实现前缀缓存：给定一个提示词 P 和若干个补全，对 P 跑一次前向传播以填满 KV 缓存，然后按每个补全分叉。测量相对于为每个补全重新编码 P 的加速比。
3. **困难。** 实现一个玩具级 PagedAttention：KV 缓存按固定的 16 token 块组织，配一个空闲块列表（free-list）。当一个序列结束时，将其块归还到池中。模拟 1000 次长度各异的聊天补全。对比内存碎片化程度与连续分配的差异。

## 关键术语

| 术语 | 大家口头怎么说 | 它实际是什么意思 |
|------|-----------------|-----------------------|
| KV 缓存 | 「让解码变快的那个技巧」 | 存储每个前缀 token 的 K 和 V；新的查询去关注它们，而非重新计算。 |
| HBM | 「GPU 主显存」 | 高带宽显存；H100 上 80 GB，B200 上 192 GB。带宽约 3 TB/s。 |
| SRAM | 「片上内存」 | 每个 SM 的快速内存，H100 上每 SM 约 256 KB。带宽约 30 TB/s。 |
| Flash Attention | 「分块注意力核」 | 计算注意力时不在 HBM 中实例化 N×N 矩阵。 |
| 连续批处理 | 「免等待批处理」 | 把完成的序列换出、新序列换入，无需清空整批。 |
| PagedAttention | 「vLLM 的招牌」 | KV 缓存按固定块分配并配以页表；消除碎片化。 |
| 前缀缓存 | 「复用长提示词」 | 跨请求缓存共享前缀的 KV；为智能体大幅削减成本。 |
| 投机解码 | 「草稿 + 验证」 | 廉价草稿模型提出 token；大模型一次验证 k 个。 |

## 延伸阅读

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) —— Flash 1。
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) —— Flash 2。
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) —— Flash 3。
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) —— Blackwell 5 级流水线与软件 exp2 技巧；本课提到的「仅前向」发布注意事项请参阅仓库的 README。
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180) —— vLLM 论文。
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) —— 投机解码。
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) —— 本课所引用的集成式草稿方法的 EAGLE-1/2 论文。
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) —— 与 EAGLE 一同提及的 Medusa 方法。
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) —— 关于 16 token 块与页表设计的权威深度解析。
