# 位置编码（Positional Encoding）——正弦（Sinusoidal）、旋转位置编码（RoPE）、线性偏置注意力（ALiBi）

> 注意力机制是置换不变的（permutation-invariant）。"猫咪坐在垫子上"和"垫子坐在猫咪上"的注意力输出在没有位置信号的情况下是相同的。三种算法解决了这个问题——每种算法对"位置"的含义都有不同的假设。

**类型：** 动手实践
**语言：** Python
**前置知识：** 阶段7·02（自注意力（Self-Attention）），阶段7·03（多头注意力（Multi-Head Attention））
**时间：** 约45分钟

## 问题

缩放点积注意力（Scaled dot-product attention）对顺序是盲目的。注意力矩阵 `softmax(Q K^T / √d) V` 是基于逐对相似度计算的。打乱 `X` 的行，输出的行也会以相同方式被打乱。注意力内部并不关心位置。

这在词袋模型（bag-of-words model）中不是问题。但对于语言、代码、音频、视频——任何顺序承载意义的内容——这是致命的。

解决方法是将位置信息以某种方式注入到嵌入中。三个时代的答案：

1. **绝对正弦（Absolute sinusoidal）**（Vaswani 2017）。将位置的 `sin/cos` 加到嵌入上。简单、无需学习，但外推（extrapolate）到训练长度之外表现不佳。
2. **RoPE——旋转位置编码（Rotary Position Embeddings）**（Su 2021）。通过对Q和K向量进行与位置成正比的旋转来编码位置。直接在点积中编码*相对*位置。在2026年占据主导地位。
3. **ALiBi——线性偏置注意力（Attention with Linear Biases）**（Press 2022）。完全跳过嵌入；根据距离向注意力分数添加每头线性惩罚。在长度外推方面表现优异。

截至2026年，几乎所有前沿开源模型都使用RoPE：Llama 2/3/4、Qwen 2/3、Mistral、Mixtral、DeepSeek-V3、Kimi。少数长上下文模型使用ALiBi或其现代变体。绝对正弦已是历史。

## 概念

![正弦绝对位置编码 vs RoPE旋转 vs ALiBi距离偏置](../assets/positional-encoding.svg)

### 绝对正弦（Absolute sinusoidal）

预先计算一个形状为 `(max_len, d_model)` 的固定矩阵 `PE`：

```
PE[pos, 2i]   = sin(pos / 10000^(2i / d_model))
PE[pos, 2i+1] = cos(pos / 10000^(2i / d_model))
```

然后在注意力之前加上 `X' = X + PE[:N]`。每个维度都是一个不同频率的正弦波。模型学习从相位模式（phase pattern）中读取位置。在 `max_len` 之外会失效：当模型只见过位置0–2047时，没有任何东西告诉它在位置2048会发生什么。

### RoPE

对Q和K向量进行旋转（不是对嵌入）。对于一对维度 `(2i, 2i+1)`：

```
[q'_2i    ]   [ cos(pos·θ_i)  -sin(pos·θ_i) ] [q_2i   ]
[q'_2i+1  ] = [ sin(pos·θ_i)   cos(pos·θ_i) ] [q_2i+1 ]

θ_i = base^(-2i / d_head),  base 默认值为 10000
```

对位置 `pos_k` 的键（Key）应用相同的旋转。点积 `q'_m · k'_n` 仅成为 `(m - n)` 的函数。也就是说：**注意力分数仅取决于相对距离**，即使旋转是基于绝对位置的。巧妙技巧。

扩展RoPE：可以缩放 `base`（基于NTK感知、YaRN、LongRoPE）以在没有重新训练的情况下外推到更长的上下文。Llama 3 以此方式从8K上下文扩展到128K。

### ALiBi

跳过嵌入技巧。直接对注意力分数施加偏置：

```
attn_score[i, j] = (q_i · k_j) / √d  -  m_h · |i - j|
```

其中 `m_h` 是头特定的斜率（例如 `1 / 2^(8·h/H)`）。更近的令牌（token）得到提升；较远的令牌受到惩罚。没有训练时的成本。论文表明，在原始训练长度上，长度外推能力优于正弦编码，并可与RoPE媲美。

### 2026年如何选择

| 变体 | 外推能力 | 训练成本 | 使用方 |
|---------|---------------|---------------|---------|
| 绝对正弦（Absolute sinusoidal） | 差 | 免费 | 原始Transformer、早期BERT |
| 学习绝对（Learned absolute） | 无 | 极小 | GPT-2、GPT-3 |
| RoPE | 好（带缩放） | 免费 | Llama 2/3/4、Qwen 2/3、Mistral、DeepSeek-V3、Kimi |
| RoPE + YaRN | 极好 | 微调阶段 | Qwen2-1M、Llama 3.1 128K |
| ALiBi | 极好 | 免费 | BLOOM、MPT、Baichuan |

RoPE胜出是因为它嵌入到注意力中而不改变架构，编码相对位置，并且其 `base` 超参数为长上下文微调提供了一个干净的调节旋钮。

## 动手实现

### 第一步：正弦编码

见 `code/main.py`。一个4行计算：

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

### 第二步：对Q、K应用RoPE

RoPE 在 Q 和 K 上原位操作。对于每对维度：

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

关键点：对位置 `m` 的 Q 和位置 `n` 的 K 应用相同的函数。它们的点积在每一对坐标上都引入了一个 `cos((m-n)·θ_i)` 因子。注意力自动学习相对位置。

### 第三步：ALiBi 斜率和偏置

```python
def alibi_bias(n_heads, seq_len):
    # slope_h = 2 ** (-8 * h / n_heads) for h = 1..n_heads
    slopes = [2 ** (-8 * (h + 1) / n_heads) for h in range(n_heads)]
    bias = []
    for m in slopes:
        row = [[-m * abs(i - j) for j in range(seq_len)] for i in range(seq_len)]
        bias.append(row)
    return bias  # 在softmax之前加到注意力分数上
```

将 `bias[h]` 添加到第 `h` 头的 `(seq_len, seq_len)` 注意力分数矩阵上，然后 softmax。

### 第四步：验证RoPE的相对距离性质

选取两个随机向量 `a, b`。用 `(pos_a, pos_b)` 旋转。再用 `(pos_a + k, pos_b + k)` 旋转。两个点积必须在浮点误差范围内相等。这个性质就是RoPE的全部意义——它相对于绝对偏移是不变的，只有相对间隔起作用。

## 使用

PyTorch 2.5+ 在 `torch.nn.functional` 中提供了RoPE工具。大多数生产代码使用 `flash_attn` 或 `xformers`，其中RoPE在注意力内核内部应用。

```python
from transformers import AutoModel
model = AutoModel.from_pretrained("meta-llama/Llama-3.2-3B")
# model.config.rope_scaling → {"type": "yarn", "factor": 32.0, "original_max_position_embeddings": 8192}
```

**2026年的长上下文技巧：**

- **NTK感知插值（NTK-aware interpolation）。** 当从4K扩展到16K+时，将 `base` 重新缩放为 `base * (scale_factor)^(d/(d-2))`。
- **YaRN。** 更智能的插值，可在长上下文中保持注意力熵。Llama 3.1 128K 使用它。
- **LongRoPE。** 微软2024年的方法，使用进化搜索（evolutionary search）为每个维度选择缩放因子。Phi-3-Long 使用它。
- **位置插值 + 微调（Position interpolation + fine-tuning）。** 仅通过扩展因子缩小位置，并微调1–5B token。出奇地有效。

## 部署

见 `outputs/skill-positional-encoding-picker.md`。该技能根据目标上下文长度、外推需求和训练预算为新模型选择编码策略。

## 练习

1. **简单。** 绘制正弦 `PE` 矩阵的热力图，`max_len=512, d=128`。确认"条纹随着维度索引增加而变宽"的模式。
2. **中等。** 实现NTK感知的RoPE缩放。训练一个小型语言模型，序列长度为256，然后测试长度为1024，分别使用和不使用缩放。测量困惑度（perplexity）。
3. **困难。** 在同一个注意力模块中实现ALiBi和RoPE。训练一个4层Transformer，复制任务，序列长度为512。测试时外推到2048。比较退化情况。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 位置编码（Positional encoding） | "告诉注意力关于顺序的信息" | 任何添加到嵌入或注意力中编码位置的信号。 |
| 正弦编码（Sinusoidal） | "原始的那一种" | 以几何频率添加到嵌入的 `sin/cos`；不能外推。 |
| RoPE | "旋转嵌入" | 通过位置依赖的角度旋转 Q、K；点积编码相对距离。 |
| ALiBi | "线性偏置技巧" | 向注意力分数添加 `-m·|i-j|`；无需嵌入，外推能力强。 |
| base | "RoPE的旋钮" | RoPE中的频率缩放器；增加它可以在推理时扩展上下文。 |
| NTK感知（NTK-aware） | "一种RoPE缩放技巧" | 重新缩放 `base`，使得当上下文扩展时高频维度不会被压缩。 |
| YaRN | "花哨的那种" | 逐维度插值+外推，保持注意力熵。 |
| 外推（Extrapolation） | "在训练长度之外工作" | 位置方案能否在训练中未见过的 `max_len` 之外提供正确输出。 |

## 拓展阅读

- [Vaswani et al. (2017). Attention Is All You Need §3.5](https://arxiv.org/abs/1706.03762) — 原始正弦编码。
- [Su et al. (2021). RoFormer: Enhanced Transformer with Rotary Position Embedding](https://arxiv.org/abs/2104.09864) — RoPE论文。
- [Press, Smith, Lewis (2021). Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation](https://arxiv.org/abs/2108.12409) — ALiBi。
- [Peng et al. (2023). YaRN: Efficient Context Window Extension of Large Language Models](https://arxiv.org/abs/2309.00071) — 最新的RoPE缩放方法。
- [Chen et al. (2023). Extending Context Window of Large Language Models via Positional Interpolation](https://arxiv.org/abs/2306.15595) — Meta的Llama 2长上下文论文。
- [Ding et al. (2024). LongRoPE: Extending LLM Context Window Beyond 2 Million Tokens](https://arxiv.org/abs/2402.13753) — 微软的方法，Phi-3-Long使用并在“使用”部分中引用。
- [HuggingFace Transformers — `modeling_rope_utils.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/modeling_rope_utils.py) — 每个RoPE缩放方案（默认、线性、动态、YaRN、LongRoPE、Llama-3）的生产级实现。