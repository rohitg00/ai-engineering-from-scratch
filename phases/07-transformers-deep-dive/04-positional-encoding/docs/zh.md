# 位置编码 —— Sinusoidal、RoPE、ALiBi

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> attention（注意力）对排列是不变的。"The cat sat on the mat" 和 "mat the on sat cat the" 在没有位置信号的情况下会得到相同的输出。三种算法解决了这个问题 —— 每种算法对"位置"是什么下了不同的赌注。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head Attention)
**Time:** ~45 minutes

## 问题（The Problem）

Scaled dot-product attention 是顺序盲的。attention 矩阵 `softmax(Q K^T / √d) V` 是从两两相似度算出来的。把 `X` 的行打乱，输出的行也会被同样地打乱。attention 内部什么都不在乎位置。

在 bag-of-words 模型里这不是 bug。但对语言、代码、音频、视频 —— 任何顺序承载意义的东西 —— 这是致命的。

修法是想办法把位置注入到 embedding（向量表示）里。三个时代的答案：

1. **Absolute sinusoidal**（绝对正弦位置编码，Vaswani 2017）。把位置的 `sin/cos` 加到 embedding 上。简单、不需要学习、对训练长度之外的外推效果差。
2. **RoPE —— Rotary Position Embeddings**（旋转位置编码，Su 2021）。把 Q 和 K 向量按位置成比例的角度旋转。直接把*相对*位置编码进点积里。2026 年的主流。
3. **ALiBi —— Attention with Linear Biases**（线性偏置 attention，Press 2022）。完全跳过 embedding；按距离给每个 head 的 attention 分数加上一个线性惩罚。在长度外推上表现极好。

到 2026 年为止，几乎每个前沿开源模型都用 RoPE：Llama 2/3/4、Qwen 2/3、Mistral、Mixtral、DeepSeek-V3、Kimi。少数长 context 模型用 ALiBi 或它的现代变体。Absolute sinusoidal 已经是历史。

## 概念（The Concept）

![Sinusoidal absolute vs RoPE rotations vs ALiBi distance bias](../assets/positional-encoding.svg)

### 绝对正弦编码（Absolute sinusoidal）

预计算一个形状为 `(max_len, d_model)` 的固定矩阵 `PE`：

```
PE[pos, 2i]   = sin(pos / 10000^(2i / d_model))
PE[pos, 2i+1] = cos(pos / 10000^(2i / d_model))
```

然后在 attention 之前 `X' = X + PE[:N]`。每个维度是一个不同频率的正弦波。模型学着从相位模式里读出位置。超过 `max_len` 就失效：模型只见过位置 0–2047，没人告诉它位置 2048 该怎么办。

### RoPE

旋转 Q 和 K 向量（不是 embedding）。对一对维度 `(2i, 2i+1)`：

```
[q'_2i    ]   [ cos(pos·θ_i)  -sin(pos·θ_i) ] [q_2i   ]
[q'_2i+1  ] = [ sin(pos·θ_i)   cos(pos·θ_i) ] [q_2i+1 ]

θ_i = base^(-2i / d_head),  base = 10000 by default
```

对位于 `pos_k` 的 key 应用同样的旋转。点积 `q'_m · k'_n` 就变成了仅与 `(m - n)` 有关的函数。也就是说：**虽然旋转是按绝对位置算的，但 attention 分数只依赖相对距离**。漂亮的小把戏。

扩展 RoPE：可以缩放 `base`（NTK-aware、YaRN、LongRoPE）来在不重新训练的情况下外推到更长的 context。Llama 3 就这样把 context 从 8K 扩到了 128K。

### ALiBi

跳过 embedding 这个把戏。直接给 attention 分数加偏置：

```
attn_score[i, j] = (q_i · k_j) / √d  -  m_h · |i - j|
```

其中 `m_h` 是每个 head 特有的斜率（例如 `1 / 2^(8·h/H)`）。近的 token 被加权；远的 token 被惩罚。训练期没成本。论文显示长度外推能力强过 sinusoidal，在原训练长度上和 RoPE 持平。

### 2026 年怎么选

| 方案 | 外推 | 训练成本 | 用户 |
|---------|---------------|---------------|---------|
| Absolute sinusoidal | 差 | 免费 | 原始 transformer，早期 BERT |
| Learned absolute | 没有 | 极小 | GPT-2、GPT-3 |
| RoPE | 配合 scaling 不错 | 免费 | Llama 2/3/4、Qwen 2/3、Mistral、DeepSeek-V3、Kimi |
| RoPE + YaRN | 极好 | 微调阶段 | Qwen2-1M、Llama 3.1 128K |
| ALiBi | 极好 | 免费 | BLOOM、MPT、Baichuan |

RoPE 胜出的原因是：它能在不改架构的情况下嵌进 attention，编码的是相对位置，并且它的 `base` 超参数为长 context 微调提供了一个干净的旋钮。

## 动手实现（Build It）

### 第 1 步：sinusoidal encoding

见 `code/main.py`。一个 4 行的计算：

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

在第一层 attention 之前把它加到 embedding 矩阵上。

### 第 2 步：把 RoPE 应用到 Q、K 上

RoPE 在 Q 和 K 上原地操作。对每对维度：

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

关键：对位置 `m` 的 Q 和位置 `n` 的 K 用同一个函数。它们的点积在每对坐标上都会捕获一个 `cos((m-n)·θ_i)` 因子。attention 免费学到了相对位置。

### 第 3 步：ALiBi 的斜率与偏置

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

把 `bias[h]` 加到 head `h` 的 `(seq_len, seq_len)` attention 分数矩阵上，再做 softmax。

### 第 4 步：验证 RoPE 的相对距离性质

挑两个随机向量 `a, b`。按 `(pos_a, pos_b)` 旋转。再按 `(pos_a + k, pos_b + k)` 旋转。两次的点积必须在浮点误差内一致。这条性质就是 RoPE 的全部要点 —— 它对绝对偏移是不变的，只有相对差距重要。

## 用起来（Use It）

PyTorch 2.5+ 在 `torch.nn.functional` 里自带 RoPE 工具。大多数生产代码用 `flash_attn` 或 `xformers`，它们会在 attention kernel 内部应用 RoPE。

```python
from transformers import AutoModel
model = AutoModel.from_pretrained("meta-llama/Llama-3.2-3B")
# model.config.rope_scaling → {"type": "yarn", "factor": 32.0, "original_max_position_embeddings": 8192}
```

**2026 年的长 context 技巧：**

- **NTK-aware interpolation。** 从 4K 扩到 16K+ 时，把 `base` 缩放到 `base * (scale_factor)^(d/(d-2))`。
- **YaRN。** 更聪明的插值方式，能在长 context 上保留 attention 熵。Llama 3.1 128K 用的就是它。
- **LongRoPE。** 微软 2024 年的方法，用进化搜索为每个维度挑选缩放因子。Phi-3-Long 用的是它。
- **位置插值 + fine-tune。** 直接按扩展系数把位置缩小，然后用 1–5B token 微调。出乎意料地有效。

## 上线部署（Ship It）

见 `outputs/skill-positional-encoding-picker.md`。这个 skill 会根据目标 context 长度、外推需求和训练预算，为新模型挑一个编码策略。

## 练习（Exercises）

1. **简单。** 把 `max_len=512, d=128` 的 sinusoidal `PE` 矩阵画成热力图。确认"条纹随维度索引增大而变宽"的模式。
2. **中等。** 实现 NTK-aware 的 RoPE scaling。在长度 256 的序列上训练一个小 LM，然后在长度 1024 上分别测试有/无 scaling 的情况。测困惑度。
3. **困难。** 在同一个 attention 模块里同时实现 ALiBi 和 RoPE。在长度 512 的序列上用 copy 任务训练一个 4 层 transformer。测试时外推到 2048。比较退化情况。

## 关键术语（Key Terms）

| 术语 | 别人怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Positional encoding | "告诉 attention 顺序" | 加到 embedding 或 attention 上、用于编码位置的任何信号。 |
| Sinusoidal | "最早那个" | 在几何频率上把 `sin/cos` 加到 embedding 上；不外推。 |
| RoPE | "旋转 embedding" | 按位置相关角度旋转 Q、K；点积里编码相对距离。 |
| ALiBi | "线性偏置技巧" | 给 attention 分数加 `-m·\|i-j\|`；不需要 embedding，外推极佳。 |
| base | "RoPE 的旋钮" | RoPE 里的频率缩放系数；推理时增大可扩展 context。 |
| NTK-aware | "一种 RoPE scaling 技巧" | 缩放 `base`，让 context 扩张时高频维度不被挤压。 |
| YaRN | "高级版" | 逐维度的插值+外推，保留 attention 熵。 |
| Extrapolation | "在训练长度之外也能用" | 位置方案能否在超过训练时见过的 `max_len` 之后输出正确结果？ |

## 延伸阅读（Further Reading）

- [Vaswani et al. (2017). Attention Is All You Need §3.5](https://arxiv.org/abs/1706.03762) —— 原始 sinusoidal。
- [Su et al. (2021). RoFormer: Enhanced Transformer with Rotary Position Embedding](https://arxiv.org/abs/2104.09864) —— RoPE 论文。
- [Press, Smith, Lewis (2021). Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation](https://arxiv.org/abs/2108.12409) —— ALiBi。
- [Peng et al. (2023). YaRN: Efficient Context Window Extension of Large Language Models](https://arxiv.org/abs/2309.00071) —— RoPE scaling 的 SOTA。
- [Chen et al. (2023). Extending Context Window of Large Language Models via Positional Interpolation](https://arxiv.org/abs/2306.15595) —— Meta 的 Llama 2 长 context 论文。
- [Ding et al. (2024). LongRoPE: Extending LLM Context Window Beyond 2 Million Tokens](https://arxiv.org/abs/2402.13753) —— 微软的方法，被 Phi-3-Long 采用，也在 Use It 一节里被引用。
- [HuggingFace Transformers —— `modeling_rope_utils.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/modeling_rope_utils.py) —— 各种 RoPE scaling 方案的生产级实现（default、linear、dynamic、YaRN、LongRoPE、Llama-3）。
