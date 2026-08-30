# 04 · 位置编码——Sinusoidal、RoPE、ALiBi

> 注意力机制具有「排列不变性（permutation-invariant）」。在没有位置信号的情况下，"The cat sat on the mat" 和 "mat the on sat cat the" 会产生完全相同的输出。三种算法解决了这个问题——每一种都对「位置」究竟意味着什么下了不同的赌注。

**类型：** 构建
**语言：** Python
**前置：** 阶段 7 · 02（自注意力）、阶段 7 · 03（多头注意力）
**时长：** 约 45 分钟

## 问题所在

「缩放点积注意力（scaled dot-product attention）」对顺序是盲目的。注意力矩阵 `softmax(Q K^T / √d) V` 由成对相似度计算得出。打乱 `X` 的行，输出的行也会以同样的方式被打乱。注意力机制内部没有任何东西在意位置。

在词袋模型中，这并不是缺陷。但对于语言、代码、音频、视频——任何顺序承载意义的场景——这是致命的。

解决办法是设法把位置信息注入到嵌入向量中。答案历经三个时代：

1. **绝对正弦位置编码（Absolute sinusoidal）**（Vaswani 2017）。把位置的 `sin/cos` 值加到嵌入向量上。简单、无需学习参数，但在超出训练长度后外推能力很差。
2. **RoPE——旋转位置编码（Rotary Position Embeddings）**（Su 2021）。将 Q 和 K 向量按与位置成正比的角度进行旋转。直接在点积中编码*相对*位置。在 2026 年占据主导地位。
3. **ALiBi——带线性偏置的注意力（Attention with Linear Biases）**（Press 2022）。完全跳过嵌入；根据距离给注意力分数添加一个逐头（per-head）的线性惩罚。长度外推能力极佳。

截至 2026 年，几乎每一个前沿开源模型都使用 RoPE：Llama 2/3/4、Qwen 2/3、Mistral、Mixtral、DeepSeek-V3、Kimi。少数长上下文模型使用 ALiBi 或其现代变体。绝对正弦编码已成为历史。

## 核心概念

〔图：绝对正弦编码 vs RoPE 旋转 vs ALiBi 距离偏置的对比〕

### 绝对正弦编码

预先计算一个形状为 `(max_len, d_model)` 的固定矩阵 `PE`：

```
PE[pos, 2i]   = sin(pos / 10000^(2i / d_model))
PE[pos, 2i+1] = cos(pos / 10000^(2i / d_model))
```

然后在注意力之前计算 `X' = X + PE[:N]`。每个维度都是一个不同频率的正弦波。模型学会从相位模式中读取位置。在超出 `max_len` 后失效：模型只见过位置 0–2047，没有人告诉它位置 2048 会发生什么。

### RoPE

旋转 Q 和 K 向量（而非嵌入向量）。对于一对维度 `(2i, 2i+1)`：

```
[q'_2i    ]   [ cos(pos·θ_i)  -sin(pos·θ_i) ] [q_2i   ]
[q'_2i+1  ] = [ sin(pos·θ_i)   cos(pos·θ_i) ] [q_2i+1 ]

θ_i = base^(-2i / d_head),  base = 10000 by default
```

对键（key）也施加相同的旋转，使用其位置 `pos_k`。点积 `q'_m · k'_n` 就变成了仅依赖于 `(m - n)` 的函数。也就是说：**注意力分数只取决于相对距离**，尽管旋转是基于绝对位置计算的。这是一个精妙的技巧。

扩展 RoPE：可以缩放 `base`（NTK-aware、YaRN、LongRoPE）来在不重新训练的情况下外推到更长的上下文。Llama 3 就是用这种方式把上下文从 8K 扩展到 128K 的。

### ALiBi

跳过嵌入这一套技巧，直接给注意力分数加偏置：

```
attn_score[i, j] = (q_i · k_j) / √d  -  m_h · |i - j|
```

其中 `m_h` 是一个逐头的斜率（slope，例如 `1 / 2^(8·h/H)`）。距离近的 token 得到增强；距离远的 token 受到惩罚。没有训练时的开销。论文表明其长度外推能力胜过正弦编码，并且在其原始训练长度上与 RoPE 持平。

### 2026 年该如何选择

| 变体 | 外推能力 | 训练成本 | 使用者 |
|---------|---------------|---------------|---------|
| 绝对正弦编码 | 差 | 免费 | 原始 transformer、早期 BERT |
| 学习式绝对编码 | 无 | 极小 | GPT-2、GPT-3 |
| RoPE | 配合缩放则良好 | 免费 | Llama 2/3/4、Qwen 2/3、Mistral、DeepSeek-V3、Kimi |
| RoPE + YaRN | 极佳 | 微调阶段 | Qwen2-1M、Llama 3.1 128K |
| ALiBi | 极佳 | 免费 | BLOOM、MPT、Baichuan |

RoPE 胜出的原因在于：它无需改动架构就能嵌入注意力机制、编码相对位置，而且其 `base` 超参数为长上下文微调提供了一个干净利落的调节旋钮。

## 动手构建

### 步骤 1：正弦编码

参见 `code/main.py`。一段 4 行的计算：

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

在第一个注意力层之前，把它加到嵌入矩阵上。

### 步骤 2：将 RoPE 应用于 Q、K

RoPE 对 Q 和 K 进行原地（in-place）操作。对于每一对维度：

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

关键点：对位置 `m` 处的 Q 和位置 `n` 处的 K 施加相同的函数。它们的点积会在每一对坐标上获得一个 `cos((m-n)·θ_i)` 因子。注意力机制由此免费学到相对位置。

### 步骤 3：ALiBi 斜率与偏置

```python
def alibi_bias(n_heads, seq_len):
    # 对于 h = 1..n_heads，slope_h = 2 ** (-8 * h / n_heads)
    slopes = [2 ** (-8 * (h + 1) / n_heads) for h in range(n_heads)]
    bias = []
    for m in slopes:
        row = [[-m * abs(i - j) for j in range(seq_len)] for i in range(seq_len)]
        bias.append(row)
    return bias  # 在 softmax 之前加到注意力分数上
```

把 `bias[h]` 加到第 `h` 个头的 `(seq_len, seq_len)` 注意力分数矩阵上，然后做 softmax。

### 步骤 4：验证 RoPE 的相对距离特性

选取两个随机向量 `a, b`。按 `(pos_a, pos_b)` 旋转。再按 `(pos_a + k, pos_b + k)` 旋转。两次的点积必须在浮点误差范围内一致。这一特性正是 RoPE 的全部意义所在——它对绝对偏移量不变，只有相对间隔才重要。

## 实际使用

PyTorch 2.5+ 在 `torch.nn.functional` 中提供了 RoPE 工具。大多数生产代码使用 `flash_attn` 或 `xformers`，其中 RoPE 在注意力核（kernel）内部被应用。

```python
from transformers import AutoModel
model = AutoModel.from_pretrained("meta-llama/Llama-3.2-3B")
# model.config.rope_scaling → {"type": "yarn", "factor": 32.0, "original_max_position_embeddings": 8192}
```

**2026 年的长上下文技巧：**

- **NTK-aware 插值。** 从 4K 扩展到 16K+ 时，将 `base` 重新缩放为 `base * (scale_factor)^(d/(d-2))`。
- **YaRN。** 一种更聪明的插值方法，能在长上下文上保持注意力熵。Llama 3.1 128K 就用了它。
- **LongRoPE。** 微软 2024 年的方法，使用进化搜索（evolutionary search）来挑选逐维度的缩放因子。Phi-3-Long 使用了它。
- **位置插值 + 微调。** 只需将位置按扩展因子缩小，然后用 1–5B 个 token 微调。效果出奇地好。

## 交付落地

参见 `outputs/skill-positional-encoding-picker.md`。该技能会根据目标上下文长度、外推需求和训练预算，为一个新模型挑选编码策略。

## 练习

1. **简单。** 对于 `max_len=512, d=128`，将正弦 `PE` 矩阵绘制成热力图。确认「条纹随维度索引增大而变宽」的模式。
2. **中等。** 实现 NTK-aware 的 RoPE 缩放。在长度为 256 的序列上训练一个极小的语言模型，然后分别在使用和不使用缩放的情况下，在长度 1024 上测试。测量困惑度（perplexity）。
3. **困难。** 在同一个注意力模块中同时实现 ALiBi 和 RoPE。在长度为 512 的序列上，针对一个复制任务训练一个 4 层的 transformer。测试时外推到 2048。比较两者的性能退化。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 位置编码（Positional encoding） | "告诉注意力关于顺序的信息" | 任何加到嵌入或注意力上、用以编码位置的信号。 |
| 正弦编码（Sinusoidal） | "最初那个" | 在几何频率上的 `sin/cos`，加到嵌入向量上；无法外推。 |
| RoPE | "旋转嵌入" | 按位置相关的角度旋转 Q、K；点积编码相对距离。 |
| ALiBi | "线性偏置技巧" | 给注意力分数加上 `-m·\|i-j\|`；无需嵌入，外推能力极佳。 |
| base | "RoPE 的旋钮" | RoPE 中的频率缩放因子；推理时增大它以扩展上下文。 |
| NTK-aware | "一种 RoPE 缩放技巧" | 重新缩放 `base`，使上下文扩展时高频维度不会被挤压。 |
| YaRN | "高级的那个" | 逐维度的插值+外推，能保持注意力熵。 |
| 外推（Extrapolation） | "在训练长度之外也能工作" | 该位置方案能否在超出训练时见过的 `max_len` 后仍输出正确结果？ |

## 延伸阅读

- [Vaswani et al. (2017). Attention Is All You Need §3.5](https://arxiv.org/abs/1706.03762) —— 原始正弦编码。
- [Su et al. (2021). RoFormer: Enhanced Transformer with Rotary Position Embedding](https://arxiv.org/abs/2104.09864) —— RoPE 论文。
- [Press, Smith, Lewis (2021). Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation](https://arxiv.org/abs/2108.12409) —— ALiBi。
- [Peng et al. (2023). YaRN: Efficient Context Window Extension of Large Language Models](https://arxiv.org/abs/2309.00071) —— 最先进的 RoPE 缩放方法。
- [Chen et al. (2023). Extending Context Window of Large Language Models via Positional Interpolation](https://arxiv.org/abs/2306.15595) —— Meta 的 Llama 2 长上下文论文。
- [Ding et al. (2024). LongRoPE: Extending LLM Context Window Beyond 2 Million Tokens](https://arxiv.org/abs/2402.13753) —— 微软的方法，被 Phi-3-Long 采用，并在「实际使用」一节中引用。
- [HuggingFace Transformers — `modeling_rope_utils.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/modeling_rope_utils.py) —— 每一种 RoPE 缩放方案的生产级实现（default、linear、dynamic、YaRN、LongRoPE、Llama-3）。
