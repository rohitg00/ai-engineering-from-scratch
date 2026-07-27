# KV Cache、Flash Attention 与推理优化

> 训练是并行的，受 FLOPs 限制。推理是串行的，受内存限制。不同的瓶颈，不同的技巧。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 分钟

## 问题

天真的自回归解码器需要 `O(N²)` 的工作量来生成 `N` 个 token：每一步它都重新计算整个前缀上的注意力。对于一个 4K token 的响应，那是 16M 次注意力操作，其中大部分是冗余的。前缀 token 的每个隐藏状态一旦计算就是确定性的——你只需要运行新 token 的 query 与缓存的所有先前 keys 和 values 进行匹配。

除此之外，注意力本身移动了大量数据。标准注意力实现了一个 N×N 分数矩阵、N×d softmax 输出、N×d 最终输出——对 HBM 的读写太多。对于 N≥2K，注意力在成为 FLOPs 限制之前就先成为内存限制。经典注意力内核将现代 GPU 的利用率降低了 4–10 倍。

两个优化，都来自 Dao 等人，将前沿推理从"慢"推到了"快"：

1. **KV cache。** 存储每个前缀 token 的 K 和 V 向量。每个新 token 的注意力是一次 query 与缓存 keys 的匹配。推理从 `O(N²)` 降低到每次生成步骤 `O(N)`。
2. **Flash Attention。** 分块注意力计算，使得完整的 N×N 矩阵永远不会触及 HBM。所有 softmax + matmul 在 SRAM 中完成。A100 上加速 2–4 倍墙钟时间；H100 上 FP8 下加速 5–10 倍。

到 2026 年，两者都已普遍使用。每个生产推理堆栈（vLLM、TensorRT-LLM、SGLang、llama.cpp）都假设它们存在。每个前沿模型都启用了 Flash Attention。

## 概念

![KV cache 增长和 Flash Attention 分块](../assets/kv-cache-flash-attn.svg)

### KV cache 计算

每解码器层、每 token、每 head：

```
bytes_per_token_per_layer = 2 * d_head * dtype_size
                          ^
                          K and V
```

对于一个 7B 模型，32 层，32 heads，d_head=128，fp16：

```
per token per layer = 2 * 128 * 2 = 512 bytes
per token (32 layers) = 16 KB
per 32K context = 512 MB
```

对于 Llama 3 70B（80 层，d_head=128，GQA 8 个 KV heads）：

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KB)
per 32K context = 10.4 GB
```

这 10 GB 就是为什么在 batch size 1 下，Llama 3 70B 在 128K 上下文时需要一个 40 GB A100 的大部分仅用于 KV cache。

**GQA 是 KV-cache 的胜利。** 64 heads 的 MHA 将是 32 GB。MLA 压缩得更进一步。

拖动维度并观察缓存大小变化。增加序列长度或 batch，看看它多快超过单个 GPU：

### Flash Attention — 分块技巧

标准注意力：

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

三次 HBM 往返。在 H100 上，HBM 带宽为 3 TB/s；SRAM 为 30 TB/s。每次 HBM 访问相比将所有数据保持在片上慢了 10 倍。

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

每个 tile 一次 HBM 访问。总内存占用从 `O(N²)` 降至 `O(N)`。反向传播从前向传播重计算一些值而不是存储它们——又一个内存胜利。

**数值技巧。** Running softmax 跨 tiles 维护 `(max, sum)`，使最终的归一化是精确的。不是近似——Flash Attention 计算与标准注意力比特一致输出（模 fp16 非结合性）。

**版本演进：**

| 版本 | 年份 | 关键变化 | 在参考硬件上的加速 |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | 分块 SRAM 内核 | A100 上 2× |
| Flash 2 | 2023 | 更好的并行性，因果优先排序 | A100 上 3× |
| Flash 3 | 2024 | Hopper 异步，FP8 | H100 上 1.5–2×（~740 TFLOPs FP16） |
| Flash 4 | 2026 | Blackwell 5 级流水线，软件 exp2 | 推理优先（初始仅前向） |

Flash 4 发布时仅支持前向传播。训练仍使用 Flash 3。Flash 4 的 GQA 和 varlen 支持待定（2026 年中）。

### Speculative decoding — 另一个延迟胜利

廉价模型提出 N 个 token。大模型并行验证所有 N 个。如果验证接受 k 个 token，你为 k 次生成支付了 1 次大模型前向传播。代码和散文上典型 k=3–5。

2026 年默认：
- **EAGLE 2 / Medusa。** 集成式 draft heads，共享验证器的隐藏状态。2–3× 加速，无质量损失。
- **Speculative decoding with draft model。** 消费级硬件上 2–4× 加速。
- **Lookahead decoding。** Jacobi 迭代；无需 draft 模型。小众但免费。

### Continuous batching

经典批推理：等待最慢的序列完成，然后开始新批次。当短响应提前完成时浪费 GPU。

Continuous batching（首次在 Orca 中发布，现在在 vLLM、TensorRT-LLM、SGLang 中）：一旦旧请求完成，立即将新请求交换入批次。典型聊天工作负载的吞吐量提升 5–10×。

### PagedAttention — KV cache 作为虚拟内存

vLLM 的招牌特性。KV cache 以 16 token 的块分配；页表将逻辑位置映射到物理块。允许跨并行样本共享 KV（beam search、并行采样）、为 prompt 缓存热交换前缀、以及碎片整理。相比天真的连续分配，吞吐量提升 4×。

## 动手构建

参见 `code/main.py`。我们实现：

1. 天真的 `O(N²)` 增量解码器。
2. 一个 `O(N)` KV-cached 解码器。
3. 一个分块 softmax，模拟 Flash Attention 的运行中最大值算法。

### 步骤 1：KV cache

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

简单：在每层、每 head 的列表中持续增长每 token 的 K、V 向量。

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

一次到位产生与 `softmax(qK) V` 比特一致的输出，但任何时候的工作集是 `tile × d_head` 块，而不是完整的 `N × d_head`。

### 步骤 3：比较 100 token 生成时天真的 vs 缓存的解码

计数注意力操作。天真：`O(N²)` = 5050。缓存：`O(N)` = 100。代码打印两者。

## 实际应用

```python
# HuggingFace transformers 在 decoder-only generate() 上自动启用 KV cache。
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # 如果使用 Hopper 则用 FA3
    torch_dtype="bfloat16",
)
# generate() 自动使用 KV cache
```

vLLM 生产：

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

跨请求的前缀缓存是 2026 年的重大胜利——相同的系统 prompt、few-shot 示例或长上下文文档跨调用重用 KV。对于重复工具 prompt 的 agent 工作负载，前缀缓存通常能带来 5× 的吞吐量提升。

## 交付

参见 `outputs/skill-inference-optimizer.md`。该 skill 为新的推理部署选择注意力实现、KV cache 策略、量化和 speculative decoding。

## 练习

1. **简单。** 运行 `code/main.py`。确认天真的和缓存的解码器产生相同的输出；注意操作计数差异。
2. **中等。** 实现前缀缓存：给定 prompt P 和多个补全，对 P 运行一次前向传播以填充 KV cache，然后按补全分支。测量与为每个补全重新编码 P 相比的加速。
3. **困难。** 实现一个玩具 PagedAttention：KV cache 在固定的 16 token 块中，带空闲列表。当一个序列完成时，将其块返回到池中。模拟 1,000 个不同长度的聊天补全。比较内存碎片与连续分配。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| KV cache | "让解码变快的技巧" | 存储的每个前缀 token 的 K 和 V；新 queries 关注它们而不是重新计算。 |
| HBM | "GPU 主内存" | High Bandwidth Memory；H100 上 80 GB，B200 上 192 GB。约 3 TB/s 带宽。 |
| SRAM | "片上内存" | 每 SM 快速内存，H100 上每 SM 约 256 KB。约 30 TB/s 带宽。 |
| Flash Attention | "分块注意力内核" | 计算注意力时不将 N×N 写入 HBM。 |
| Continuous batching | "无等待批处理" | 交换完成的序列出去，新的进来，无需清空批次。 |
| PagedAttention | "vLLM 的招牌" | KV cache 以固定块分配，带页表；消除碎片。 |
| Prefix caching | "重用长 prompt" | 跨请求缓存共享前缀的 KV；对 agent 有重大成本削减。 |
| Speculative decoding | "起草 + 验证" | 廉价 draft 模型提出 token；大模型一次验证 k 个。 |

## 延伸阅读

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) — Flash 1。
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) — Flash 2。
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) — Flash 3。
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) — Blackwell 5 级流水线和 software-exp2 技巧；阅读仓库 README 了解仅前向启动的注意事项。
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180) — vLLM 论文。
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — spec decoding。
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) — EAGLE-1/2 论文，针对本课引用的集成 draft 方法。
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) — 与 EAGLE 一起引用的 Medusa 方法。
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) — 关于 16-token 块和页表设计的典范深入分析。
