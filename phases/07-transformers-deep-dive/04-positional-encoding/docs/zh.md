# Positional Encoding — Sinusoidal, RoPE, ALiBi

> 注意力是排列不变的。“猫坐在垫子上”和“垫子坐在垫子上的猫”产生相同的输出，没有位置信号。有三种算法可以解决这个问题--每个算法都对“位置”的含义进行了不同的赌注。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段7 · 02（自我注意）、阶段7 · 03（多头注意）
** 时间：** ~45分钟

## The Problem

规模化的点产品关注是盲目的。注意力矩阵“softmax（Q K & T /& d）V”是根据成对相似度计算的。对“X”的行进行洗牌，以相同的方式对输出的行进行洗牌。内部注意力不关心位置。

这不是词袋模型中的错误。对于语言、代码、音频、视频--任何秩序具有意义的东西--这都是致命的。

修复方法是以某种方式将位置注入嵌入。三个时代的答案：

1. ** 绝对曲线 **（Vaswani 2017）。将位置的“sin/cos”添加到嵌入中。简单、无需学习、超出训练长度的推断能力很差。
2. **RoPE -旋转位置嵌入 **（Su 2021）。以与位置成比例的角度旋转Q和K载体。直接在点积中编码 * 相对 * 位置。2026年占据主导地位。
3. **ALibi -注意线性偏差 **（Press 2022）。完全跳过嵌入;根据距离对注意力分数添加每人线性惩罚。出色的长度外推。

截至2026年，基本上所有前沿开放模型都使用RoPE：Llama 2/3/4、Qwen 2/3、Mistral、Mixtral、DeepSeek-V3、Kimi。少数长上下文模型使用ALibi或其现代变体。绝对曲线是历史性的。

## The Concept

![Sinusoidal absolute vs RoPE rotations vs ALiBi distance bias](../assets/positional-encoding.svg)

### Absolute sinusoidal

预先计算形状为“（max_len，d_mode）”的固定矩阵“PE”：

```
PE[pos, 2i]   = sin(pos / 10000^(2i / d_model))
PE[pos, 2i+1] = cos(pos / 10000^(2i / d_model))
```

然后“X”= X + PE[：N]'在注意之前。每个维度都是不同频率的一个sin。该模型学会从相模式中读取位置。超出“max_len”的失败：当模型只看到位置0-2047时，没有任何东西告诉模型在位置2048会发生什么。

### RoPE

旋转Q和K载体（不是嵌入）。对于一对维度“（2 i，2 i +1）”：

```
[q'_2i    ]   [ cos(pos·θ_i)  -sin(pos·θ_i) ] [q_2i   ]
[q'_2i+1  ] = [ sin(pos·θ_i)   cos(pos·θ_i) ] [q_2i+1 ]

θ_i = base^(-2i / d_head),  base = 10000 by default
```

对位置为“pos_k”的关键点应用相同的旋转。点积“q '_m ·k '_n '单独成为“（m-n）'的函数。也就是说：** 注意力得分仅取决于相对距离 **，即使旋转是根据绝对位置进行的。漂亮的技巧。

扩展RoPE：可以扩展“base”（NTK-aware、YaRN、LongRoPE）以外推到更长的上下文，无需重新培训。Lama 3以这种方式从8 K扩展到128 K环境。

### ALiBi

跳过嵌入技巧。直接偏向注意力得分：

```
attn_score[i, j] = (q_i · k_j) / √d  -  m_h · |i - j|
```

其中“m_h”是特定于头部的斜坡（例如“1 / 2^（8·h/H）”）。较近的代币会得到提升;较远的代币会受到惩罚。没有培训时间成本。论文表明，长度外推优于sin，并与RoPE的原始训练长度相匹配。

### What to pick in 2026

| 变体 | 外推 | 培训成本 | 使用 |
|---------|---------------|---------------|---------|
| 绝对曲线 | 贫困 | 免费 | 原始Transformer，早期BERT |
| 学到的绝对 | 没有一 | 微小 | GPT-2、GPT-3 |
| 绳 | 善于缩放 | 免费 | Llama 2/3/4、Qwen 2/3、Mistral、DeepSeek-V3、Kimi |
| RoPE + YaRN | 优秀 | 微调级 | Qwen 2 - 1 M，Lama 3.1 128 K |
| 在场证明 | 优秀 | 免费 | 布鲁姆、MPT、白川 |

RoPE之所以获胜，是因为它在不改变架构的情况下引起了人们的注意，对相对位置进行了编码，并且它的“base”超参数为长上下文微调提供了一个干净的旋钮。

## Build It

### Step 1: sinusoidal encoding

请参阅' code/main.py '。4行计算：

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

将其添加到第一个关注层之前的嵌入矩阵中。

### Step 2: RoPE applied to Q, K

RoPE在Q和K上就地运营。对于每对硬币：

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

关键：将相同的函数应用于位置“m”的Q和位置“n”的K。它们的点积在每个坐标对上拾取一个“cos（（m-n）·θ_i）”因子。注意力免费学习相对位置。

### Step 3: ALiBi slopes and bias

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

将“偏见[h]”添加到头部“h”的“（seq_len，seq_len）”注意力得分矩阵中，然后添加softmax。

### Step 4: verify relative-distance property of RoPE

选择两个随机载体“a，b”。旋转'（pos_a，pos_b）'。然后通过“（pos_a + k，pos_b + k）”。两个点积必须在浮点误差内匹配。该属性就是RoPE的全部意义--它对绝对补偿是不变的，只有相对差距才重要。

## Use It

PyTorch 2.5+在“torch.nn.functional”中运送RoPE实用程序。大多数生产代码使用“Flash_attn”或“xformers”，其中RoPE应用于注意力内核中。

```python
from transformers import AutoModel
model = AutoModel.from_pretrained("meta-llama/Llama-3.2-3B")
# model.config.rope_scaling → {"type": "yarn", "factor": 32.0, "original_max_position_embeddings": 8192}
```

** 2026年的长期背景技巧：**

- ** NTK感知插值。**当从4K扩展到16 K+时，将“base”重新缩放为“base *（scale_factor）^（d/（d-2））”。
- ** YRN。**更智能的插值，可以在长上下文中保留注意力熵。Llama 3.1 128 K使用它。
- **LongRoPE。**微软2024年的方法使用进化搜索来选择按维度的比例因子。Phi-3-Long使用它。
- ** 位置插值+微调。**只需通过扩展因子缩小头寸并微调1- 5 B代币即可。令人惊讶的有效。

## Ship It

请参阅“输出/skill-positional-encoding-picker.md”。该技能在给定目标上下文长度、外推需求和训练预算的情况下为新模型选择编码策略。

## Exercises

1. ** 简单。**将其曲线“PE”矩阵绘制为“max_len=512，d=128”的热图。确认“随着维度指数的增长，条纹变得更宽”模式。
2. ** 中等。**实施NTK感知的RoPE扩展。在长度为256的序列上训练一个小型LM，然后在长度为1024的（有和没有缩放）上进行测试。衡量困惑。
3. ** 很难。**在同一关注模块中实施ALibi和RoPE。训练一个4层的Transformer在一个拷贝任务上，序列长度为512。在测试时推断到2048年。比较退化。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 位置编码 | “告诉注意秩序” | 添加到编码位置的嵌入或注意力的任何信号。 |
| 正弦 | “原版” | 几何频率处的“sin/cos”添加到嵌入中;不会外推。 |
| 绳 | “旋转嵌入” | 旋转Q、K取决于位置的角度;点积编码相对距离。 |
| 在场证明 | “线性偏置技巧” | 添加'-m· | I-J | '注意力分数;不需要嵌入，很棒的外推。 |
| 基地 | “RoPE的旋钮” | RoPE中的频率缩放器;增加以扩展推理时的上下文。 |
| NTK意识 | “RoPE缩放技巧” | 重新缩放“基础”，以便当上下文扩展时高频零钱不会受到挤压。 |
| 纱线 | “花哨的那个” | 保持注意熵的每维内插+外插。 |
| 外推 | “超出训练长度的作品” | 位置方案能否提供训练中看到的“max_len”之后的正确输出？ |

## Further Reading

- [瓦斯瓦尼等人（2017）。注意力就是你所需要的一切§3.5]（https：//arxiv.org/ab/1706.03762）-原始的曲线。
- [Su等人（2021）。RoFormer：具有旋转位置嵌入的增强型Transformer]（https：//arxiv.org/ab/2104.09864）- RoPE论文。
- [Press，Smith，Lewis（2021）。训练短，测试长：线性偏差的注意力启用输入长度外推]（https：//arxiv.org/ab/2108.12409）- ALibi。
- [Peng等人（2023）。YaRN：大型语言模型的高效上下文窗口扩展]（https：//arxiv.org/ab/2309.00071）-最先进的RoPE扩展。
- [Chen等人（2023）。通过位置插值扩展大型语言模型的上下文窗口]（https：//arxiv.org/ab/2306.15595）- Meta的Llama 2长上下文论文。
- [Ding等人（2024）。LongRoPE：将LLM上下文窗口扩展到超过200万个令牌]（https：//arxiv.org/ab/2402.13753）-Phi-3-Long使用的Microsoft方法，并在“使用它”部分引用。
- [HuggingFace Transformers -' modeling_rope_utils.py ']（https：//github.com/huggingface/transformers/blob/main/src/transformers/modeling_rope_utils.py）-每个RoPE扩展方案的生产级实现（默认、线性、动态、YaRN、LongRoPE、Llama-3）。
