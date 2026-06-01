# 05 · 完整的 Transformer——编码器 + 解码器

> 注意力是主角。其余的一切——残差、归一化、前馈、交叉注意力——都是让你能把它堆叠得很深的脚手架。

**类型：** 实践构建
**语言：** Python
**前置：** 阶段 7 · 02（自注意力）、阶段 7 · 03（多头注意力）、阶段 7 · 04（位置编码）
**时长：** 约 75 分钟

## 问题所在

单独一层注意力是一个特征提取器，而不是一个模型。每层只做一次矩阵乘法，容量不足以建模语言。你需要深度——而没有正确的「管路（plumbing）」，深度就会崩溃。

2017 年的 Vaswani 论文打包了六项设计决策，把一层注意力变成了可堆叠的「块（block）」。此后的每一个 Transformer——纯编码器（BERT）、纯解码器（GPT）、编码器-解码器（T5）——都继承了同一副骨架。到了 2026 年，这些块经过了精炼（RMSNorm、SwiGLU、前置归一化（pre-norm）、RoPE），但骨架是完全相同的。

本课讲的就是这副骨架。后续课程对它做专门化——06 讲编码器，07 讲解码器，08 讲编码器-解码器。

## 核心概念

〔图：编码器与解码器块的内部结构及连线〕

### 六个组成部件

1. **嵌入 + 位置信号。** 词元（token）→ 向量。位置通过 RoPE（现代做法）或正弦编码（sinusoidal，经典做法）注入。
2. **自注意力（self-attention）。** 每个位置都关注其他所有位置。在解码器中会加掩码。
3. **前馈网络（feed-forward network, FFN）。** 逐位置的两层 MLP：`W_2 · activation(W_1 · x)`。默认扩张比为 4×。
4. **残差连接（residual connection）。** `x + sublayer(x)`。没有它，梯度会在超过约 6 层后消失。
5. **层归一化（layer normalization）。** `LayerNorm` 或 `RMSNorm`（现代做法）。稳定残差流。
6. **交叉注意力（cross-attention，仅解码器）。** 查询（query）来自解码器，键（key）和值（value）来自编码器输出。

### 编码器块（被 BERT、T5 编码器使用）

```
x → LN → MHA(self) → + → LN → FFN → + → out
                     ^              ^
                     |              |
                     └── residual ──┘
```

编码器是双向的。无掩码。所有位置都能看到所有位置。

### 解码器块（被 GPT、T5 解码器使用）

```
x → LN → MHA(masked self) → + → LN → MHA(cross to encoder) → + → LN → FFN → + → out
```

解码器每个块有三个子层。中间那个——交叉注意力——是信息从编码器流向解码器的唯一通道。在纯解码器架构（GPT）中，交叉注意力被省略，只剩带掩码的自注意力 + FFN。

### 前置归一化 vs 后置归一化

原始论文：`x + sublayer(LN(x))` 对比 `LN(x + sublayer(x))`。后置归一化（post-norm）在 2019 年前后失宠——若不精心安排预热（warmup），很难把它训练得很深。前置归一化（`LN` 在子层*之前*）是 2026 年的默认选择：Llama、Qwen、GPT-3+、Mistral 全都采用它。

### 2026 年的现代化块

Vaswani 2017 交付的是 LayerNorm + ReLU。现代技术栈把两者都替换了。生产级的块实际长这样：

| 组件 | 2017 | 2026 |
|-----------|------|------|
| 归一化 | LayerNorm | RMSNorm |
| FFN 激活函数 | ReLU | SwiGLU |
| FFN 扩张比 | 4× | 2.6×（SwiGLU 用了三个矩阵，总参数量相当） |
| 位置 | 正弦绝对位置 | RoPE |
| 注意力 | 完整 MHA | GQA（或 MLA） |
| 偏置项 | 有 | 无 |

RMSNorm 去掉了 LayerNorm 的均值中心化（少做一次减法），既省算力，经验上又至少同样稳定。SwiGLU（`Swish(W1 x) ⊙ W3 x`）在 Llama、PaLM 和 Qwen 的论文中，困惑度（ppl）上一致地比 ReLU/GELU 的 FFN 好约 0.5 个点。

### 参数量

对于一个 `d_model = d`、FFN 扩张比为 `r` 的块：

- MHA：`4 · d²`（Q、K、V、O 投影）
- FFN（SwiGLU）：`3 · d · (r · d)` ≈ `3rd²`
- 归一化：可忽略不计

在 `d = 4096, r = 2.6, layers = 32`（大致相当于 Llama 3 8B）时，总计：`32 · (4·4096² + 3·2.6·4096²) ≈ 32 · (16 + 32) M = ~1.5B 参数每层 × 32 ≈ 7B`（再加上嵌入和输出头）。与公开的参数量吻合。

## 动手构建

### 第 1 步：构建基础组件

使用第 03 课的微型 `Matrix` 类（已复制到本文件以保持独立）：

- `layer_norm(x, eps=1e-5)`——减去均值，除以标准差。
- `rms_norm(x, eps=1e-6)`——除以 RMS。不做均值减法。
- `gelu(x)` 和 `silu(x) * W3 x`（SwiGLU）。
- `ffn_swiglu(x, W1, W2, W3)`。
- `encoder_block(x, params)` 和 `decoder_block(x, enc_out, params)`。

完整的连线见 `code/main.py`。

### 第 2 步：搭建一个 2 层编码器和一个 2 层解码器

把它们堆起来。把编码器输出传入每一个解码器的交叉注意力。在输出投影前加一个最终的 LN。

```python
def encode(tokens, params):
    x = embed(tokens, params.emb) + sinusoidal(len(tokens), params.d)
    for block in params.encoder_blocks:
        x = encoder_block(x, block)
    return x

def decode(target_tokens, encoder_out, params):
    x = embed(target_tokens, params.emb) + sinusoidal(len(target_tokens), params.d)
    for block in params.decoder_blocks:
        x = decoder_block(x, encoder_out, block)
    return x
```

### 第 3 步：在一个玩具示例上跑前向

喂入一个 6 词元的源序列和一个 5 词元的目标序列。验证输出形状为 `(5, vocab)`。不训练——本课讲的是架构，不是损失函数。

### 第 4 步：换成 RMSNorm + SwiGLU

把 LayerNorm 和 ReLU-FFN 替换为 RMSNorm 和 SwiGLU。确认形状依然匹配。这就是 2026 年的现代化改造，只需替换一个函数。

## 实际应用

PyTorch/TF 的参考实现：`nn.TransformerEncoderLayer`、`nn.TransformerDecoderLayer`。但 2026 年大多数生产代码都自己手写块，因为：

- Flash Attention 是在注意力内部调用的，而不是通过 `nn.MultiheadAttention`。
- GQA / MLA 不在标准库的参考实现里。
- RoPE、RMSNorm、SwiGLU 不是 PyTorch 的默认项。

HF `transformers` 里有干净的参考块，你应该读一读：`modeling_llama.py` 是 2026 年纯解码器块的范本。它约 500 行，值得通读一遍。

**编码器 vs 解码器 vs 编码器-解码器——何时选哪个：**

| 需求 | 选择 | 示例 |
|------|------|------|
| 分类、嵌入、文本问答（QA） | 纯编码器 | BERT、DeBERTa、ModernBERT |
| 文本生成、对话、代码、推理 | 纯解码器 | GPT、Llama、Claude、Qwen |
| 结构化输入 → 结构化输出（翻译、摘要） | 编码器-解码器 | T5、BART、Whisper |

纯解码器赢得了语言建模的主导地位，因为它扩展（scale）起来最干净，且能同时处理理解和生成。当输入有明确的「源序列」身份时（翻译、语音识别、结构化任务），编码器-解码器仍然是最优选择。

## 交付成果

见 `outputs/skill-transformer-block-reviewer.md`。该技能会对照 2026 年的默认实践审查一份新的 Transformer 块实现，并标记出缺失的部件（前置归一化、RoPE、RMSNorm、GQA、FFN 扩张比）。

## 练习

1. **简单。** 在 `d_model=512, n_heads=8, ffn_expansion=4, swiglu=True` 下，数一数你的 encoder_block 有多少参数。通过实现该块并用 `sum(p.numel() for p in block.parameters())` 来验证。
2. **中等。** 从后置归一化切换到前置归一化。两种都初始化，在随机输入上堆叠 12 层后测量激活的范数。后置归一化的激活应当爆炸；前置归一化的应当保持有界。
3. **困难。** 在一个玩具复制任务（把 `x` 反转后复制）上实现一个 4 层的编码器-解码器。训练 100 步。报告损失。换成 RMSNorm + SwiGLU + RoPE——损失会下降吗？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 块（Block） | 「一层 Transformer」 | 由 归一化 + 注意力 + 归一化 + FFN 组成的堆叠，外面套上残差连接。 |
| 残差（Residual） | 「跳跃连接（skip connection）」 | `x + f(x)` 的输出；让梯度能流过很深的堆叠。 |
| 前置归一化（Pre-norm） | 「在之前归一化，而不是之后」 | 现代做法：`x + sublayer(LN(x))`。无需预热花招就能训练得更深。 |
| RMSNorm | 「去掉均值的 LayerNorm」 | 除以 RMS；少一个运算，经验稳定性相同。 |
| SwiGLU | 「大家都换用的那个 FFN」 | `Swish(W1 x) ⊙ W3 x → W2`。在语言模型困惑度上胜过 ReLU/GELU。 |
| 交叉注意力（Cross-attention） | 「解码器如何看到编码器」 | Q 来自解码器、K/V 来自编码器输出的 MHA。 |
| FFN 扩张（FFN expansion） | 「中间那层 MLP 有多宽」 | 隐藏层大小与 d_model 的比值，通常为 4（LayerNorm）或 2.6（SwiGLU）。 |
| 无偏置（Bias-free） | 「去掉 +b 项」 | 现代技术栈在线性层中省略偏置；困惑度略有改善，模型更小。 |

## 延伸阅读

- [Vaswani et al. (2017). Attention Is All You Need](https://arxiv.org/abs/1706.03762)——原始的块规格。
- [Xiong et al. (2020). On Layer Normalization in the Transformer Architecture](https://arxiv.org/abs/2002.04745)——为什么前置归一化在深层上胜过后置归一化。
- [Zhang, Sennrich (2019). Root Mean Square Layer Normalization](https://arxiv.org/abs/1910.07467)——RMSNorm。
- [Shazeer (2020). GLU Variants Improve Transformer](https://arxiv.org/abs/2002.05202)——SwiGLU 论文。
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py)——2026 年纯解码器块的范本。
