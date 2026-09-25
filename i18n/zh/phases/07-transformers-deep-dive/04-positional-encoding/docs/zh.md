# 位置编码 — 正弦、RoPE、ALiBi

> Attention 是置换不变的。"The cat sat on the mat" 和 "mat the on sat cat the" 在没有位置信号的情况下会产生相同的输出。三种算法解决了这个问题——每一种对"位置"的含义下注不同。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention)、Phase 7 · 03 (Multi-Head Attention)
**Time:** ~45 分钟

## 问题所在

缩放点积注意力对顺序视而不见。注意力矩阵 `softmax(Q K^T / √d) V` 由两两相似度计算得到。打乱 `X` 的行,输出的行也会以相同方式被打乱。注意力内部完全不关心位置。

对于词袋模型来说这不是 bug。但对于语言、代码、音频、视频——任何顺序承载意义的领域——这是致命的。

解决办法是以某种方式把位置注入嵌入。三个时代的答案:

1. **绝对正弦编码**(Vaswani 2017)。把位置的 `sin/cos` 加到嵌入上。简单、无需学习,但在超出训练长度后外推能力差。
2. **RoPE — 旋转位置编码**(Su 2021)。按与位置成正比的角度旋转 Q 和 K 向量。在点积中直接编码*相对*位置。2026 年的主导方案。
3. **ALiBi — 带线性偏置的注意力**(Press 2022)。完全不用嵌入;根据距离向注意力分数添加每个头独立的线性惩罚。长度外推表现出色。

截至 2026 年,几乎所有前沿开源模型都使用 RoPE:Llama 2/3/4、Qwen 2/3、Mistral、Mixtral、DeepSeek-V3、Kimi。少数长上下文模型使用 ALiBi 或其现代变体。绝对正弦编码已成为历史。

## 核心概念

![Sinusoidal absolute vs RoPE rotations vs ALiBi distance bias](../assets/positional-encoding.svg)

### 绝对正弦编码

预先计算一个形状为 `(max_len, d_model)` 的固定矩阵 `PE`:

```
PE[pos, 2i]   = sin(pos / 10000^(2i / d_model))
PE[pos, 2i+1] = cos(pos / 10000^(2i / d_model))
```

然后在注意力之前计算 `X' = X + PE[:N]`。每个维度都是一个不同频率的正弦波。模型学会从相位模式中读取位置。超出 `max_len` 就会失效:模型只见过位置 0–2047,没有任何信息告诉它在位置 2048 处会发生什么。

### RoPE

旋转 Q 和 K 向量(而非嵌入)。对于一对维度 `(2i, 2i+1)`:

```
[q'_2i    ]   [ cos(pos·θ_i)  -sin(pos·θ_i) ] [q_2i   ]
[q'_2i+1  ] = [ sin(pos·θ_i)   cos(pos·θ_i) ] [q_2i+1 ]

θ_i = base^(-2i / d_head),  base = 10000 by default
```

对位置为 `pos_k` 的键应用相同的旋转。点积 `q'_m · k'_n` 变成仅关于 `(m - n)` 的函数。也就是说:**注意力分数只取决于相对距离**,尽管旋转是以绝对位置为依据的。漂亮的技巧。

扩展 RoPE:可以缩放 `base`(NTK-aware、YaRN、LongRoPE),无需重新训练即可外推到更长上下文。Llama 3 就是这样把上下文从 8K 扩展到 128K 的。

### ALiBi

跳过嵌入技巧,直接对注意力分数加偏置:

```
attn_score[i, j] = (q_i · k_j) / √d  -  m_h · |i - j|
```

其中 `m_h` 是特定于头的斜率(例如 `1 / 2^(8·h/H)`)。近处的 token 被加强;远处的 token 被惩罚。没有训练时开销。论文显示其长度外推优于正弦编码,并在原始训练长度上与 RoPE 相当。

### 2026 年如何选择

| 变体 | 外推能力 | 训练成本 | 使用者 |
|---------|---------------|---------------|---------|
| 绝对正弦 | 差 | 免费 | 原始 Transformer、早期 BERT |
| 可学习绝对编码 | 无 | 极小 | GPT-2、GPT-3 |
| RoPE | 配合缩放时良好 | 免费 | Llama 2/3/4、Qwen 2/3、Mistral、DeepSeek-V3、Kimi |
| RoPE + YaRN | 极好 | 微调阶段 | Qwen2-1M、Llama 3.1 128K |
| ALiBi | 极好 | 免费 | BLOOM、MPT、Baichuan |

RoPE 胜出的原因是:它无需改变架构即可融入注意力机制、编码相对位置,并且其 `base` 超参数为长上下文微调提供了清晰的调节旋钮。

```figure
rope-explorer
```

## 动手构建

### 第 1 步:正弦编码

见 `code/main.py`。一个 4 行的计算:

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

在第一个注意力层之前把它加到嵌入矩阵上。

### 第 2 步:对 Q、K 应用 RoPE

RoPE 原地作用于 Q 和 K。对每一对维度:

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

关键在于:对位置 `m` 的 Q 和位置 `n` 的 K 应用同一个函数。它们的点积在每一对坐标上都会获得一个 `cos((m-n)·θ_i)` 因子。注意力免费学会了相对位置。

### 第 3 步:ALiBi 斜率与偏置

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

把 `bias[h]` 加到头 `h` 的 `(seq_len, seq_len)` 注意力分数矩阵上,然后做 softmax。

### 第 4 步:验证 RoPE 的相对距离性质

取两个随机向量 `a, b`。先按 `(pos_a, pos_b)` 旋转,再按 `(pos_a + k, pos_b + k)` 旋转做点积。两个点积必须在浮点误差范围内相等。这个性质正是 RoPE 的全部要点——它对绝对偏移不变,只有相对间隔才重要。

## 使用它

PyTorch 2.5+ 在 `torch.nn.functional` 中提供了 RoPE 工具。大多数生产代码使用 `flash_attn` 或 `xformers`,由它们在 attention kernel 内部应用 RoPE。

```python
from transformers import AutoModel
model = AutoModel.from_pretrained("meta-llama/Llama-3.2-3B")
# model.config.rope_scaling → {"type": "yarn", "factor": 32.0, "original_max_position_embeddings": 8192}
```

**2026 年的长上下文技巧:**

- **NTK-aware 插值。** 从 4K 扩展到 16K+ 时,把 `base` 重缩放为 `base * (scale_factor)^(d/(d-2))`。
- **YaRN。** 更智能的插值方法,在长上下文上保持注意力熵。Llama 3.1 128K 使用它。
- **LongRoPE。** 微软 2024 年的方法,使用进化搜索为每个维度选择缩放因子。Phi-3-Long 使用它。
- **位置插值 + 微调。** 只需按扩展因子缩小位置,再用 1–5B token 微调。效果出奇地好。

## 上线它

见 `outputs/skill-positional-encoding-picker.md`。该技能根据目标上下文长度、外推需求和训练预算,为新模型选择编码策略。

## 练习

1. **简单。** 把 `max_len=512, d=128` 的正弦 `PE` 矩阵画成热力图。确认"维度索引越大,条纹越宽"的模式。
2. **中等。** 实现 NTK-aware RoPE 缩放。在长度为 256 的序列上训练一个微型 LM,然后在长度 1024 上分别带缩放和不带缩放进行测试。测量困惑度。
3. **困难。** 在同一个注意力模块中实现 ALiBi 和 RoPE。在长度 512 的复制任务序列上训练一个 4 层 Transformer。测试时外推到 2048。比较性能退化。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 位置编码 | "告诉注意力顺序信息" | 加到嵌入或注意力上、用于编码位置的任何信号。 |
| 正弦编码 | "最初的那一个" | 以几何频率加到嵌入上的 `sin/cos`;不能外推。 |
| RoPE | "旋转嵌入" | 按位置相关角度旋转 Q、K;点积编码相对距离。 |
| ALiBi | "线性偏置技巧" | 向注意力分数加 `-m·\|i-j\|`;无需嵌入,外推极佳。 |
| base | "RoPE 的旋钮" | RoPE 中的频率缩放器;推理时增大它可扩展上下文。 |
| NTK-aware | "一种 RoPE 缩放技巧" | 重缩放 `base`,使高频维度在上下文扩展时不会被压缩。 |
| YaRN | "花哨的那一个" | 按维度插值+外推,保持注意力熵。 |
| 外推 | "在训练长度之外也能工作" | 位置方案能否在超出训练中见到的 `max_len` 之后仍给出正确输出? |

## 延伸阅读

- [Vaswani et al. (2017). Attention Is All You Need §3.5](https://arxiv.org/abs/1706.03762) — 原始正弦编码。
- [Su et al. (2021). RoFormer: Enhanced Transformer with Rotary Position Embedding](https://arxiv.org/abs/2104.09864) — RoPE 论文。
- [Press, Smith, Lewis (2021). Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation](https://arxiv.org/abs/2108.12409) — ALiBi。
- [Peng et al. (2023). YaRN: Efficient Context Window Extension of Large Language Models](https://arxiv.org/abs/2309.00071) — 当前最先进的 RoPE 缩放方法。
- [Chen et al. (2023). Extending Context Window of Large Language Models via Positional Interpolation](https://arxiv.org/abs/2306.15595) — Meta 的 Llama 2 长上下文论文。
- [Ding et al. (2024). LongRoPE: Extending LLM Context Window Beyond 2 Million Tokens](https://arxiv.org/abs/2402.13753) — 微软的方法,被 Phi-3-Long 使用,并在"使用它"一节中被引用。
- [HuggingFace Transformers — `modeling_rope_utils.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/modeling_rope_utils.py) — 所有 RoPE 缩放方案(default、linear、dynamic、YaRN、LongRoPE、Llama-3)的生产级实现。