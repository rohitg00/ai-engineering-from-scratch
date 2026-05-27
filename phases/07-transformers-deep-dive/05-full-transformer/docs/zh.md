# 完整Transformer——编码器+解码器

> 注意力机制是主角。其他一切——残差连接、归一化、前馈网络、交叉注意力——都是让你能堆叠深度的脚手架。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段7·02（自注意力），阶段7·03（多头注意力），阶段7·04（位置编码）
**时长：** ~75分钟

## 问题

单个注意力层是特征提取器，而不是模型。每层一次矩阵乘法的容量不足以处理语言。你需要深度——而没有正确的管道，深度就会崩溃。

2017年的Vaswani论文打包了六项设计决策，将一个注意力层变成了可堆叠的模块。自此以后，所有的Transformer——编码器专用（BERT）、解码器专用（GPT）、编码器-解码器（T5）——都继承了这个相同的骨架。到了2026年，这些模块已经被改进（RMSNorm、SwiGLU、前归一化、RoPE），但骨架本身是相同的。

本节课就是介绍这个骨架。后续的课程会对其进行专门化——06课讲编码器，07课讲解码器，08课讲编码器-解码器。

## 概念

![编码器和解码器模块内部连接图](../assets/full-transformer.svg)

### 六大部分

1. **嵌入+位置信号。** 词元→向量。通过RoPE（现代）或正弦函数（经典）注入位置。
2. **自注意力。** 每个位置关注所有其他位置。解码器中需要掩码。
3. **前馈网络（FFN）。** 位置级的两层MLP：`W_2 · activation(W_1 · x)`。默认扩展比为4倍。
4. **残差连接。** `x + sublayer(x)`。没有它，梯度在超过约6层后会消失。
5. **层归一化。** `LayerNorm`或`RMSNorm`（现代）。稳定残差流。
6. **交叉注意力（仅解码器）。** 查询来自解码器，键和值来自编码器输出。

### 编码器模块（用于BERT、T5编码器）

```
x → LN → MHA(self) → + → LN → FFN → + → out
                     ^              ^
                     |              |
                     └── 残差连接 ──┘
```

编码器是双向的。无掩码。所有位置都能看到所有位置。

### 解码器模块（用于GPT、T5解码器）

```
x → LN → MHA(masked self) → + → LN → MHA(cross to encoder) → + → LN → FFN → + → out
```

解码器每个模块有三个子层。中间的交叉注意力层是信息从编码器流向解码器的唯一通道。在纯解码器架构（GPT）中，省略了交叉注意力，只保留掩码自注意力+FFN。

### 前归一化 vs 后归一化

原始论文：`x + sublayer(LN(x))` vs `LN(x + sublayer(x))`。后归一化在2019年左右失宠——如果没有仔细的预热，深度训练会更困难。前归一化（在子层*之前*进行`LN`）是2026年的默认选择：Llama、Qwen、GPT-3+、Mistral都使用它。

### 2026年现代化模块

Vaswani 2017年使用了LayerNorm + ReLU。现代模块替换了这两者。实际生产模块的样子：

| 组件 | 2017年 | 2026年 |
|-----------|------|------|
| 归一化 | LayerNorm | RMSNorm |
| FFN激活函数 | ReLU | SwiGLU |
| FFN扩展比 | 4× | 2.6×（SwiGLU使用三个矩阵，总参数量匹配） |
| 位置编码 | 正弦绝对位置 | RoPE |
| 注意力 | 完整MHA | GQA（或MLA） |
| 偏置项 | 有 | 无 |

RMSNorm去掉了LayerNorm的均值中心化（少一次减法），节省计算，且经验上至少同样稳定。SwiGLU（`Swish(W1 x) ⊙ W3 x`）在Llama、PaLM和Qwen论文中始终比ReLU/GELU FFN的困惑度低约0.5点。

### 参数量

对于单个模块，设`d_model = d`，FFN扩展比为`r`：

- MHA：`4 · d²`（Q、K、V、O投影）
- FFN（SwiGLU）：`3 · d · (r · d)` ≈ `3rd²`
- 归一化：可忽略

当`d = 4096, r = 2.6, layers = 32`（约等于Llama 3 8B）：总数 = `32 · (4·4096² + 3·2.6·4096²) ≈ 32 · (16 + 32) M = 每层约1.5B参数 × 32 ≈ 7B`（加上嵌入和输出头）。与公开的参数量一致。

## 构建

### 第一步：构建模块

使用课程03中的小型`Matrix`类（已复制到本文件中以保持独立）：

- `layer_norm(x, eps=1e-5)` — 减去均值，除以标准差。
- `rms_norm(x, eps=1e-6)` — 除以RMS。不减去均值。
- `gelu(x)` 和 `silu(x) * W3 x`（SwiGLU）。
- `ffn_swiglu(x, W1, W2, W3)`。
- `encoder_block(x, params)` 和 `decoder_block(x, enc_out, params)`。

完整的连接代码见`code/main.py`。

### 第二步：搭建一个2层编码器和一个2层解码器

堆叠它们。将编码器输出传入每个解码器交叉注意力。在输出投影之前添加一个最终的LN层。

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

### 第三步：在玩具示例上运行前向传播

输入一个6词元的源序列和一个5词元的目标序列。验证输出形状为`(5, vocab)`。不进行训练——本节课关注架构，而非损失。

### 第四步：替换为RMSNorm + SwiGLU

将LayerNorm和ReLU-FFN替换为RMSNorm和SwiGLU。确认形状仍然匹配。这是只替换一个函数的2026年现代化版本。

## 使用

PyTorch/TF参考实现：`nn.TransformerEncoderLayer`、`nn.TransformerDecoderLayer`。但大多数2026年的生产代码都自己实现模块，因为：

- Flash Attention在注意力内部调用，而不是通过`nn.MultiheadAttention`。
- GQA / MLA没有包含在标准库参考中。
- RoPE、RMSNorm、SwiGLU不是PyTorch的默认选项。

HuggingFace `transformers`有清晰的参考模块，你应该阅读：`modeling_llama.py`是2026年解码器专用模块的规范实现。它大约有500行，值得通读一遍。

**编码器 vs 解码器 vs 编码器-解码器——如何选择：**

| 需求 | 选择 | 示例 |
|------|------|---------|
| 分类、嵌入、文本问答 | 编码器专用 | BERT、DeBERTa、ModernBERT |
| 文本生成、聊天、代码、推理 | 解码器专用 | GPT、Llama、Claude、Qwen |
| 结构化输入 → 结构化输出（翻译、摘要） | 编码器-解码器 | T5、BART、Whisper |

解码器专用之所以主导语言领域，是因为它扩展性最好，同时处理理解和生成。当输入具有明确的“源序列”身份时（翻译、语音识别、结构化任务），编码器-解码器仍然是最佳选择。

## 交付

见`outputs/skill-transformer-block-reviewer.md`。该技能针对一个新的Transformer模块实现，根据2026年默认设置进行审查，并标记缺失的部分（前归一化、RoPE、RMSNorm、GQA、FFN扩展比）。

## 练习

1. **简单。** 计算你的`encoder_block`在`d_model=512, n_heads=8, ffn_expansion=4, swiglu=True`时的参数量。通过实现模块并使用`sum(p.numel() for p in block.parameters())`进行验证。
2. **中等。** 从后归一化切换到前归一化。初始化两者，并在随机输入上测量12个堆叠层后的激活范数。后归一化的激活应会爆炸；前归一化应保持有界。
3. **困难。** 在一个玩具复制任务（将`x`反转复制）上实现一个4层编码器-解码器。训练100步。报告损失。替换为RMSNorm + SwiGLU + RoPE——损失是否下降？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 模块 | “一个Transformer层” | 归一化+注意力+归一化+FFN的堆叠，包裹在残差连接中。 |
| 残差 | “跳跃连接” | `x + f(x)`输出；使梯度能够流过深层堆叠。 |
| 前归一化 | “在之前归一化，而不是之后” | 现代：`x + sublayer(LN(x))`。无需预热技巧即可训练更深。 |
| RMSNorm | “没有均值的LayerNorm” | 除以RMS；少一次操作，经验稳定性相同。 |
| SwiGLU | “大家都换用的FFN” | `Swish(W1 x) ⊙ W3 x → W2`。在语言模型困惑度上优于ReLU/GELU。 |
| 交叉注意力 | “解码器如何看到编码器” | MHA，查询来自解码器，键/值来自编码器输出。 |
| FFN扩展比 | “中间MLP有多宽” | 隐藏层大小与d_model的比值，通常为4（LayerNorm）或2.6（SwiGLU）。 |
| 无偏置 | “去掉+b项” | 现代模块在线性层中省略偏置；略微改善困惑度，模型更小。 |

## 延伸阅读

- [Vaswani et al. (2017). Attention Is All You Need](https://arxiv.org/abs/1706.03762) — 原始模块规范。
- [Xiong et al. (2020). On Layer Normalization in the Transformer Architecture](https://arxiv.org/abs/2002.04745) — 为什么前归一化在深度上优于后归一化。
- [Zhang, Sennrich (2019). Root Mean Square Layer Normalization](https://arxiv.org/abs/1910.07467) — RMSNorm。
- [Shazeer (2020). GLU Variants Improve Transformer](https://arxiv.org/abs/2002.05202) — SwiGLU论文。
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) — 2026年解码器专用模块的规范实现。