# KV缓存、Flash注意力与推理优化

> 训练是并行的且受FLOP限制。推理是串行的且受内存限制。不同的瓶颈，不同的技巧。

**类型：** 构建
**语言：** Python
**前置条件：** 阶段7·02（自注意力），阶段7·05（完整Transformer），阶段7·07（GPT）
**时间：** ~75分钟

## 问题

一个朴素的自回归解码器生成`N`个token需要`O(N²)`的计算量：每一步它都会重新计算整个前缀的注意力。对于4K token的响应，这意味着1600万次注意力操作，其中大部分是冗余的。前缀token的每个隐藏状态一旦计算出来就是确定的——你只需要对新token的查询（Query）与之前所有token的缓存键（Key）和值（Value）做注意力。

除此之外，注意力本身会移动大量数据。标准注意力需要实例化一个N×N的分数矩阵、N×d的softmax输出、N×d的最终输出——对高带宽内存（HBM）的读写操作过多。当N≥2K时，注意力在成为FLOP限制之前就已经成为内存限制了。经典的注意力内核在现代GPU上利用率低4–10倍。

来自Dao等人的两项优化将前沿推理从"慢"推向了"快"：

1. **KV缓存（KV cache）。** 存储每个前缀token的K和V向量。每个新token的注意力只需一个查询与缓存的键做计算。推理从每步`O(N²)`降低到`O(N)`。
2. **Flash注意力（Flash Attention）。** 对注意力计算进行分块，使完整的N×N矩阵永远不会触及HBM。所有softmax + 矩阵乘法都在SRAM中完成。在A100上获得2–4倍的墙上时钟加速；在H100上使用FP8可获得5–10倍加速。

到2026年，这两项技术都已普遍应用。每个生产级推理框架（vLLM、TensorRT-LLM、SGLang、llama.cpp）都依赖它们。每个前沿模型都默认启用Flash注意力。

## 概念

![KV缓存增长与Flash注意力分块](../assets/kv-cache-flash-attn.svg)

### KV缓存数学

每解码层、每token、每注意力头：

```
每层每token字节数 = 2 * d_head * dtype_size
                      ^
                      K 和 V
```

对于一个7B模型，32层、32头、d_head=128、fp16：

```
每层每token = 2 * 128 * 2 = 512 字节
每token（32层） = 16 KB
每32K上下文 = 512 MB
```

对于Llama 3 70B（80层、d_head=128、GQA有8个KV头）：

```
每层每token = 2 * 8 * 128 * 2 = 4096 字节（4 KB）
每32K上下文 = 10.4 GB
```

这10 GB就是为什么在batch size为1时，Llama 3 70B在128K上下文下需要40 GB A100的大部分仅用于KV缓存的原因。

**GQA是KV缓存的最大收益点。** 64头的MHA将需要32 GB。MLA进一步压缩了。

### Flash注意力——分块技巧

标准注意力：

```
S = Q @ K^T          （HBM读取，N×N，HBM写入）
P = softmax(S)       （HBM读取，HBM写入）
O = P @ V            （HBM读取，HBM写入）
```

三次HBM往返。在H100上，HBM带宽为3 TB/s；SRAM为30 TB/s。每次HBM往返与将所有数据保留在芯片上相比，速度慢10倍。

Flash注意力：

```
对于每个Q块（分块大小 ~128 × 128）：
    将Q_tile加载到SRAM中
    对于每个K、V块：
        将K_tile、V_tile加载到SRAM中
        计算 S_tile = Q_tile @ K_tile^T     （SRAM）
        运行中softmax聚合             （SRAM）
        累加到 O_tile                  （SRAM）
    将O_tile写入HBM
```

每个分块一次HBM往返。总内存占用从`O(N²)`降低到`O(N)`。反向传播从前向传播重新计算一些值而不是存储它们——另一个内存收益。

**数值技巧。** 运行中softmax跨分块维护`(max, sum)`，使得最终归一化精确。这不是近似——Flash注意力计算出与标准注意力位一致的结果（除了fp16的非结合性）。

**版本演进：**

| 版本 | 年份 | 关键变化 | 在参考硬件上的加速 |
|------|------|----------|-------------------|
| Flash 1 | 2022 | 分块SRAM内核 | 在A100上2× |
| Flash 2 | 2023 | 更好的并行性、因果优先顺序 | 在A100上3× |
| Flash 3 | 2024 | Hopper异步、FP8 | 在H100上1.5–2×（约740 TFLOPs FP16） |
| Flash 4 | 2026 | Blackwell 5级流水线、软件exp2 | 推理优先（起初仅前向） |

Flash 4在发布时仅支持前向传播。训练仍然使用Flash 3。GQA和变长支持待定（2026年中）。

### 推测性解码——另一个延迟收益

廉价模型提出N个token。大模型并行验证所有N个。如果验证接受了k个token，那么你为生成k个token支付了一次大模型前向传播。通常在代码和散文上k=3–5。

2026年的默认配置：
- **EAGLE 2 / Medusa。** 集成草稿头（draft heads），共享验证器的隐藏状态。2–3倍加速，无质量损失。
- **带草稿模型的推测性解码。** 在消费级硬件上2–4倍加速。
- **Lookahead解码。** Jacobi迭代；无需草稿模型。小众但免费。

### 连续批处理（Continuous batching）

经典批处理推理：等待最慢的序列完成，然后开始新的一批。当短响应提前完成时，浪费了GPU。

连续批处理（首先在Orca中推出，现在在vLLM、TensorRT-LLM、SGLang中）：一旦旧请求完成，立即将新请求交换到批处理中。对于典型的聊天工作负载，吞吐量提升5–10倍。

### PagedAttention——KV缓存作为虚拟内存

vLLM的招牌功能。KV缓存以16-token块分配；页表将逻辑位置映射到物理块。允许跨并行样本（束搜索、并行采样）共享KV缓存，热交换前缀用于提示缓存，以及整理内存。相比朴素连续分配，吞吐量提升4倍。

## 构建它

参见 `code/main.py`。我们实现：

1. 一个朴素的 `O(N²)` 增量解码器。
2. 一个 `O(N)` 的KV缓存解码器。
3. 一个分块softmax，模拟Flash注意力的运行中最大值算法。

### 步骤1：KV缓存

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

简单：在每个层、每个头的列表中持续增长每个token的K、V向量。

### 步骤2：分块softmax

```python
def tiled_softmax_dot(q, K, V, tile=4):
    """Flash注意力风格的分块softmax(qK^T)V，使用运行中最大值/和。"""
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

一次性计算与 `softmax(qK) V` 位一致的结果，但任何时刻的工作集只是一个 `tile × d_head` 块，而不是完整的 `N × d_head`。

### 步骤3：在100 token生成上比较朴素解码与缓存解码

统计注意力操作次数。朴素：`O(N²)` = 5050。缓存：`O(N)` = 100。代码会打印两者。

## 使用它

```python
# HuggingFace transformers在仅解码器的generate()上自动启用KV缓存。
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # 如果是Hopper架构可使用FA3
    torch_dtype="bfloat16",
)
# generate()自动使用KV缓存
```

vLLM生产部署：

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

跨请求的前缀缓存是2026年的一大收益——相同的系统提示、少样本示例或长上下文文档可在多次调用中重用KV缓存。对于具有重复工具提示的智能体工作负载，前缀缓存通常带来5倍吞吐量提升。

## 部署它

参见 `outputs/skill-inference-optimizer.md`。该技能为新的推理部署选择注意力实现、KV缓存策略、量化和推测性解码。

## 练习

1. **简单。** 运行 `code/main.py` 。确认朴素解码器和缓存解码器产生相同的输出；注意操作次数差异。
2. **中等。** 实现前缀缓存：给定一个提示P和多个补全，对P进行一次前向传播以填充KV缓存，然后每个补全分支使用。测量相对于为每个补全重新编码P的加速比。
3. **困难。** 实现一个玩具PagedAttention：KV缓存以固定16-token块分配，带空闲列表。当一个序列完成时，将其块归还到池中。模拟1000个长度变化的多轮对话补全。比较与连续分配相比的内存碎片化。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|---------|
| KV缓存（KV cache） | "让解码变快的技巧" | 存储每个前缀token的K和V；新查询与它们做注意力而不是重新计算。 |
| HBM | "GPU主内存" | 高带宽内存（High Bandwidth Memory）；H100上80 GB，B200上192 GB。约3 TB/s带宽。 |
| SRAM | "片上内存" | 每流处理器的快速内存，H100上每SM约256 KB。约30 TB/s带宽。 |
| Flash注意力（Flash Attention） | "分块注意力内核" | 计算注意力而不在HBM中实例化N×N矩阵。 |
| 连续批处理（Continuous batching） | "无等待批处理" | 完成序列换出，新序列换入，无需清空整个批次。 |
| PagedAttention | "vLLM的招牌功能" | KV缓存以固定块分配，带页表；消除碎片化。 |
| 前缀缓存（Prefix caching） | "重利用长提示" | 缓存共享前缀的KV缓存；对智能体来说是主要的成本削减。 |
| 推测性解码（Speculative decoding） | "草稿+验证" | 廉价草稿模型提出token；大模型一次性验证k个。 |

## 进一步阅读

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) — Flash 1。
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) — Flash 2。
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) — Flash 3。
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) — Blackwell 5级流水线和软件exp2技巧；阅读仓库README以了解本课提到的仅前向启动注意事项。
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180) — vLLM论文。
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — 推测性解码论文。
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) — EAGLE-1/2论文，关于集成草稿方法，本课有引用。
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) — 与EAGLE一同引用的Medusa方法。
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) — 关于16-token块和页表设计的权威深度解析。