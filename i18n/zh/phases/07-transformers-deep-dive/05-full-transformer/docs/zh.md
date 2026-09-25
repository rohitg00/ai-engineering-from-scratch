# 完整的 Transformer — 编码器 + 解码器

> 注意力机制是主角。其他一切——残差连接、归一化、前馈网络、交叉注意力——都是让你能把它堆得很深的脚手架。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head Attention), Phase 7 · 04 (Positional Encoding)
**Time:** ~75 分钟

## 问题所在

单个注意力层是特征提取器，而不是模型。每层一次矩阵乘法的容量不足以处理语言。你需要深度——而没有正确的管道设计，深度就会失效。

2017 年的 Vaswani 论文打包了六个设计决策，把单个注意力层变成了可堆叠的模块。此后的每个 transformer——仅编码器（BERT）、仅解码器（GPT）、编码器-解码器（T5）——都继承了相同的骨架。到 2026 年，这些模块已被改进（RMSNorm、SwiGLU、pre-norm、RoPE），但骨架完全相同。

本课讲的是这个骨架。接下来的课程会对它进行特化——06 讲编码器，07 讲解码器，08 讲编码器-解码器。

## 概念

![Encoder and decoder block internals, wired](../assets/full-transformer.svg)

### 六个组成部分

1. **嵌入 + 位置信号。** 词元 → 向量。位置通过 RoPE（现代）或正弦编码（经典）注入。
2. **自注意力。** 每个位置关注所有其他位置。在解码器中会被掩蔽。
3. **前馈网络（FFN）。** 逐位置的两层 MLP：`W_2 · activation(W_1 · x)`。默认扩展比例为 4 倍。
4. **残差连接。** `x + sublayer(x)`。没有它，梯度在约 6 层之后就会消失。
5. **层归一化。** `LayerNorm` 或 `RMSNorm`（现代）。稳定残差流。
6. **交叉注意力（仅解码器）。** 查询来自解码器，键和值来自编码器的输出。

观察一个向量流过一个模块：注意力跨位置混合信息，残差将其向前传递，FFN 对其进行变换，归一化保持流的稳定。

```figure
transformer-block
```

### 编码器模块（BERT、T5 编码器使用）

```
x → LN → MHA(self) → + → LN → FFN → + → out
                     ^              ^
                     |              |
                     └── residual ──┘
```

编码器是双向的。没有掩蔽。所有位置都能看到所有位置。

### 解码器模块（GPT、T5 解码器使用）

```
x → LN → MHA(masked self) → + → LN → MHA(cross to encoder) → + → LN → FFN → + → out
```

解码器每个模块有三个子层。中间那个——交叉注意力——是信息从编码器流向解码器的唯一途径。在纯仅解码器架构（GPT）中，交叉注意力被省略，只剩下掩蔽自注意力 + FFN。

### Pre-norm 与 post-norm

原始论文：`x + sublayer(LN(x))` 与 `LN(x + sublayer(x))`。Post-norm 在 2019 年左右失宠——没有精细的 warmup，深层训练会很困难。Pre-norm（在子层*之前*进行 `LN`）是 2026 年的默认选择：Llama、Qwen、GPT-3+、Mistral 都使用它。

### 2026 年的现代化模块

Vaswani 2017 交付的是 LayerNorm + ReLU。现代技术栈替换了两者。生产级模块实际上是这样的：

| 组件 | 2017 | 2026 |
|-----------|------|------|
| 归一化 | LayerNorm | RMSNorm |
| FFN 激活函数 | ReLU | SwiGLU |
| FFN 扩展 | 4× | 2.6×（SwiGLU 使用三个矩阵，总参数量相当） |
| 位置编码 | 正弦绝对位置 | RoPE |
| 注意力 | 完整 MHA | GQA（或 MLA） |
| 偏置项 | 有 | 无 |

RMSNorm 去掉了 LayerNorm 的均值中心化（少一次减法），节省计算且经验上至少同样稳定。SwiGLU（`Swish(W1 x) ⊙ W3 x`）在 Llama、PaLM 和 Qwen 论文中一致地比 ReLU/GELU FFN 的困惑度好约 0.5 个点。

### 参数量统计

对于一个具有 `d_model = d` 且 FFN 扩展为 `r` 的模块：

- MHA：`4 · d²`（Q、K、V、O 投影）
- FFN（SwiGLU）：`3 · d · (r · d)` ≈ `3rd²`
- 归一化：可忽略

在 `d = 4096, r = 2.6, layers = 32` 时（大致对应 Llama 3 8B），总量：`32 · (4·4096² + 3·2.6·4096²) ≈ 32 · (16 + 32) M = ~1.5B parameters per layer × 32 ≈ 7B`（加上嵌入和输出头）。与已发表的参数量一致。

## 动手构建

### 步骤 1：基础构建块

使用第 03 课的小型 `Matrix` 类（已复制到本文件以保持独立性）：

- `layer_norm(x, eps=1e-5)` — 减去均值，除以标准差。
- `rms_norm(x, eps=1e-6)` — 除以 RMS。不减均值。
- `gelu(x)` 和 `silu(x) * W3 x`（SwiGLU）。
- `ffn_swiglu(x, W1, W2, W3)`。
- `encoder_block(x, params)` 和 `decoder_block(x, enc_out, params)`。

完整接线见 `code/main.py`。

### 步骤 2：组装一个 2 层编码器和一个 2 层解码器

将它们堆叠。把编码器的输出传入每个解码器交叉注意力。在输出投影之前加一个最终的 LN。

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

### 步骤 3：在玩具示例上运行前向传播

输入 6 个词元的源序列和 5 个词元的目标序列。验证输出形状为 `(5, vocab)`。不需要训练——本课讲的是架构，不是损失。

### 步骤 4：换成 RMSNorm + SwiGLU

用 RMSNorm 和 SwiGLU 替换 LayerNorm 和 ReLU-FFN。确认形状仍然匹配。只需替换函数，就实现了 2026 年的现代化。

## 使用它

PyTorch/TF 参考实现：`nn.TransformerEncoderLayer`、`nn.TransformerDecoderLayer`。但大多数 2026 年的生产代码都是自己实现模块，因为：

- Flash Attention 是在注意力内部调用的，而不是通过 `nn.MultiheadAttention`。
- GQA / MLA 不在标准库参考实现中。
- RoPE、RMSNorm、SwiGLU 不是 PyTorch 的默认选项。

HF 的 `transformers` 有值得阅读的干净参考模块：`modeling_llama.py` 是 2026 年最典型的仅解码器模块。它约 500 行，值得完整走读一遍。

**编码器 vs 解码器 vs 编码器-解码器 — 如何选择：**

| 需求 | 选择 | 示例 |
|------|------|---------|
| 分类、嵌入、文本问答 | 仅编码器 | BERT、DeBERTa、ModernBERT |
| 文本生成、对话、代码、推理 | 仅解码器 | GPT、Llama、Claude、Qwen |
| 结构化输入 → 结构化输出（翻译、摘要） | 编码器-解码器 | T5、BART、Whisper |

仅解码器架构赢得了语言建模，因为它扩展性最干净，且能同时处理理解和生成。当输入具有明确的"源序列"属性时（翻译、语音识别、结构化任务），编码器-解码器仍然是最佳选择。

## 发布它

见 `outputs/skill-transformer-block-reviewer.md`。该技能会对照 2026 年的默认配置审查新的 transformer 模块实现，并标记缺失的部分（pre-norm、RoPE、RMSNorm、GQA、FFN 扩展比例）。

## 练习

1. **简单。** 统计 `d_model=512, n_heads=8, ffn_expansion=4, swiglu=True` 处 encoder_block 的参数量。通过实现该模块并使用 `sum(p.numel() for p in block.parameters())` 来验证。
2. **中等。** 从 post-norm 切换到 pre-norm。两者都初始化，并在随机输入上测量堆叠 12 层后的激活范数。Post-norm 的激活应该爆炸；pre-norm 的应该保持有界。
3. **困难。** 在一个玩具复制任务上（复制 `x` 的逆序）实现一个 4 层编码器-解码器。训练 100 步。报告损失。换入 RMSNorm + SwiGLU + RoPE——损失下降了吗？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 模块（Block） | "一个 transformer 层" | 归一化 + 注意力 + 归一化 + FFN 的堆叠，包裹在残差连接中。 |
| 残差（Residual） | "跳跃连接" | `x + f(x)` 输出；使梯度能流过深层堆叠。 |
| Pre-norm | "先归一化，而不是之后" | 现代：`x + sublayer(LN(x))`。无需 warmup 技巧即可训练更深的网络。 |
| RMSNorm | "去掉均值的 LayerNorm" | 除以 RMS；少一个操作，经验稳定性相同。 |
| SwiGLU | "人人都换用的 FFN" | `Swish(W1 x) ⊙ W3 x → W2`。在语言模型困惑度上胜过 ReLU/GELU。 |
| 交叉注意力 | "解码器如何看到编码器" | Q 来自解码器、K/V 来自编码器输出的 MHA。 |
| FFN 扩展 | "中间 MLP 有多宽" | 隐藏层大小与 d_model 的比例，通常为 4（LayerNorm）或 2.6（SwiGLU）。 |
| 无偏置 | "去掉 +b 项" | 现代技术栈在线性层中省略偏置；困惑度略有提升，模型更小。 |

## 延伸阅读

- [Vaswani et al. (2017). Attention Is All You Need](https://arxiv.org/abs/1706.03762) — 原始模块规范。
- [Xiong et al. (2020). On Layer Normalization in the Transformer Architecture](https://arxiv.org/abs/2002.04745) — 为什么深层网络中 pre-norm 优于 post-norm。
- [Zhang, Sennrich (2019). Root Mean Square Layer Normalization](https://arxiv.org/abs/1910.07467) — RMSNorm。
- [Shazeer (2020). GLU Variants Improve Transformer](https://arxiv.org/abs/2002.05202) — SwiGLU 论文。
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) — 2026 年最典型的仅解码器模块。