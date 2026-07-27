# Positional Encoding — Sinusoidal、RoPE、ALiBi

> 注意力是排列不变的。"The cat sat on the mat" 和 "mat the on sat cat the" 在没有位置信号的情况下产生相同的输出。三种算法修复了它——每种算法对"位置"的含义有不同的赌注。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head Attention)
**Time:** ~45 分钟

## 问题

Scaled dot-product attention 是顺序盲的。注意力矩阵 `softmax(Q K^T / √d) V` 由两两相似度计算得出。打乱 `X` 的行，输出行也会以同样的方式被打乱。注意力内部没有任何东西关心位置。

在词袋模型中这不是 bug。但对于语言、代码、音频、视频——任何顺序承载意义的事物——这是致命的。

修复方案是以某种方式将位置注入嵌入。三个时代的答案：

1. **绝对正弦编码**（Vaswani 2017）。将位置的 `sin/cos` 加到嵌入上。简单、无需学习、在训练长度之外外推能力差。
2. **RoPE — Rotary Position Embeddings**（Su 2021）。将 Q 和 K 向量旋转一个与位置成比例的角度。直接在点积中编码*相对*位置。2026 年占主导地位。
3. **ALiBi — Attention with Linear Biases**（Press 2022）。完全跳过嵌入；基于距离向注意力分数添加每个 head 的线性惩罚。出色的长度外推能力。

截至 2026 年，几乎所有前沿开源模型都使用 RoPE：Llama 2/3/4、Qwen 2/3、Mistral、Mixtral、DeepSeek-V3、Kimi。少数长上下文模型使用 ALiBi 或其现代变体。绝对正弦编码已成为历史。

## 概念

![Sinusoidal 绝对 vs RoPE 旋转 vs ALiBi 距离偏置](../assets/positional-encoding.svg)

### 绝对正弦编码

预计算一个形状为 `(max_len, d_model)` 的固定矩阵 `PE`：

```
PE[pos, 2i]   = sin(pos / 10000^(2i / d_model))
PE[pos, 2i+1] = cos(pos / 10000^(2i / d_model))
```

然后在注意力之前 `X' = X + PE[:N]`。每个维度是不同频率的正弦波。模型学会从相位模式读取位置。在 `max_len` 之外失败：当模型只见过位置 0–2047 时，没有任何东西告诉它在位置 2048 会发生什么。

### RoPE

旋转 Q 和 K 向量（而非嵌入）。对于一对维度 `(2i, 2i+1)`：

```
[q'_2i    ]   [ cos(pos·θ_i)  -sin(pos·θ_i) ] [q_2i   ]
[q'_2i+1  ] = [ sin(pos·θ_i)   cos(pos·θ_i) ] [q_2i+1 ]

θ_i = base^(-2i / d_head),  base = 10000 by default
```

对位置 `pos_k` 的 keys 应用相同的旋转。点积 `q'_m · k'_n` 成为仅依赖 `(m - n)` 的函数。即：**注意力分数仅取决于相对距离**，即使旋转是基于绝对位置的。漂亮的技巧。

扩展 RoPE：可以缩放 `base`（NTK-aware、YaRN、LongRoPE）以在没有重新训练的情况下外推到更长的上下文。Llama 3 通过这种方式从 8K 扩展到 128K 上下文。

### ALiBi

跳过嵌入技巧。直接偏置注意力分数：

```
attn_score[i, j] = (q_i · k_j) / √d  -  m_h · |i - j|
```

其中 `m_h` 是每个 head 特定的斜率（如 `1 / 2^(8·h/H)`）。较近的 token 得到提升；较远的 token 受到惩罚。没有训练时成本。论文显示长度外推优于正弦编码，并在原始训练长度上与 RoPE 相当。

### 2026 年如何选择

| 变体 | 外推能力 | 训练成本 | 使用方 |
|---------|---------------|---------------|---------|
| Absolute sinusoidal | 差 | 免费 | 原始 transformer, 早期 BERT |
| Learned absolute | 无 | 极小 | GPT-2, GPT-3 |
| RoPE | 好（带缩放） | 免费 | Llama 2/3/4, Qwen 2/3, Mistral, DeepSeek-V3, Kimi |
| RoPE + YaRN | 优秀 | 微调阶段 | Qwen2-1M, Llama 3.1 128K |
| ALiBi | 优秀 | 免费 | BLOOM, MPT, Baichuan |

RoPE 胜出是因为它不改变架构就融入注意力、编码相对位置，并且其 `base` 超参数为长上下文微调提供了清晰的调节旋钮。

## 动手构建

### 步骤 1：正弦编码

参见 `code/main.py`。4 行计算：

```python
def sinusoidal(N, d):
    pe = [[0.0] * d for _ in range(N)]
    for pos in range(N):
        for i in range(d // 2):
            theta = pos / (10000 ** (2 * i / d))
            pe[pos][2 * i]     = math.sin(theta)
            pe[pos][2 * i + 1] = math.cos(theta)
    return pe
```

在第一个注意力层之前将其添加到嵌入矩阵中。

### 步骤 2：对 Q、K 应用 RoPE

RoPE 就地操作 Q 和 K。对于每对维度：

```python
def apply_rope(x, pos, base=10000):
    d = len(x)
    out = list(x)
    for i in range(d // 2):
        theta = pos / (base ** (2 * i / d))
        c, s = math.cos(theta), math.sin(theta)
        a, b = x[2 * i], x[2 * i + 1]
        out[2 * i]     = a * c - b * s
        out[2 * i + 1] = a * s + b * c
    return out
```

关键：对位置 `m` 的 Q 和位置 `n` 的 K 应用相同的函数。它们的点积在每个坐标对上获得一个 `cos((m-n)·θ_i)` 因子。注意力免费学习相对位置。

### 步骤 3：ALiBi 斜率和偏置

```python
def alibi_bias(n_heads, seq_len):
    # slope_h = 2 ** (-8 * h / n_heads) for h = 1..n_heads
    slopes = [2 ** (-8 * (h + 1) / n_heads) for h in range(n_heads)]
    bias = []
    for m in slopes:
        row = [[-m * abs(i - j) for j in range(seq_len)] for i in range(seq_len)]
        bias.append(row)
    return bias  # add to attention scores before softmax
```

将 `bias[h]` 加到 head `h` 的 `(seq_len, seq_len)` 注意力分数矩阵上，然后 softmax。

### 步骤 4：验证 RoPE 的相对距离特性

选取两个随机向量 `a, b`。按 `(pos_a, pos_b)` 旋转。然后按 `(pos_a + k, pos_b + k)` 旋转。两个点积必须在浮点误差内匹配。这一特性是 RoPE 的全部意义——它对绝对偏移不变，只有相对距离重要。

## 实际应用

PyTorch 2.5+ 在 `torch.nn.functional` 中提供了 RoPE 工具。大多数生产代码使用 `flash_attn` 或 `xformers`，其中 RoPE 在注意力内核内部应用。

```python
from transformers import AutoModel
model = AutoModel.from_pretrained("meta-llama/Llama-3.2-3B")
# model.config.rope_scaling → {"type": "yarn", "factor": 32.0, "original_max_position_embeddings": 8192}
```

**2026 年的长上下文技巧：**

- **NTK-aware interpolation.** 从 4K 扩展到 16K+ 时，将 `base` 重新缩放到 `base * (scale_factor)^(d/(d-2))`。
- **YaRN.** 在长上下文中保持注意力熵的更智能插值。Llama 3.1 128K 使用它。
- **LongRoPE.** 微软 2024 年的方法，使用进化搜索选择每个维度的缩放因子。Phi-3-Long 使用它。
- **Position interpolation + fine-tuning.** 只需按扩展因子缩小位置，然后在 1–5B tokens 上微调。效果出奇地好。

## 交付

参见 `outputs/skill-positional-encoding-picker.md`。该 skill 根据目标上下文长度、外推需求和训练预算为新模型选择编码策略。

## 练习

1. **简单。** 将正弦 `PE` 矩阵绘制为 `max_len=512, d=128` 的热力图。确认"条纹随维度索引增长而变宽"的模式。
2. **中等。** 实现 NTK-aware RoPE 缩放。训练一个微型 LM 在长度为 256 的序列上，然后在长度为 1024 的序列上测试，分别使用和不使用缩放。测量 perplexity。
3. **困难。** 在同一个注意力模块中实现 ALiBi 和 RoPE。训练一个 4 层 transformer 在长度为 512 的序列的复制任务上。测试时外推到 2048。比较退化程度。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| Positional encoding | "告诉注意力关于顺序的信息" | 任何添加到嵌入或注意力的编码位置信号。 |
| Sinusoidal | "原始的那个" | 以几何频率添加到嵌入的 `sin/cos`；不进行外推。 |
| RoPE | "旋转嵌入" | 按位置相关角度旋转 Q、K；点积编码相对距离。 |
| ALiBi | "线性偏置技巧" | 将 `-m·\|i-j\|` 添加到注意力分数；无需嵌入，出色的外推能力。 |
| base | "RoPE 的旋钮" | RoPE 中的频率缩放器；增加以在推理时扩展上下文。 |
| NTK-aware | "一个 RoPE 缩放技巧" | 重新缩放 `base`，使高频维度在上下文扩展时不被压缩。 |
| YaRN | "高级的那个" | 保持注意力熵的逐维度插值+外推。 |
| Extrapolation | "在训练长度之外工作" | 位置方案能否在训练时见过的 `max_len` 之外提供正确的输出？ |

## 延伸阅读

- [Vaswani et al. (2017). Attention Is All You Need §3.5](https://arxiv.org/abs/1706.03762) — 原始正弦编码。
- [Su et al. (2021). RoFormer: Enhanced Transformer with Rotary Position Embedding](https://arxiv.org/abs/2104.09864) — RoPE 论文。
- [Press, Smith, Lewis (2021). Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation](https://arxiv.org/abs/2108.12409) — ALiBi。
- [Peng et al. (2023). YaRN: Efficient Context Window Extension of Large Language Models](https://arxiv.org/abs/2309.00071) — 最先进的 RoPE 缩放。
- [Chen et al. (2023). Extending Context Window of Large Language Models via Positional Interpolation](https://arxiv.org/abs/2306.15595) — Meta 的 Llama 2 长上下文论文。
- [Ding et al. (2024). LongRoPE: Extending LLM Context Window Beyond 2 Million Tokens](https://arxiv.org/abs/2402.13753) — Phi-3-Long 使用的微软方法。
- [HuggingFace Transformers — `modeling_rope_utils.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/modeling_rope_utils.py) — 每个 RoPE 缩放方案的生产级实现（default、linear、dynamic、YaRN、LongRoPE、Llama-3）。
