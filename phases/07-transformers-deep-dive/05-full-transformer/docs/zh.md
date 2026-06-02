# 完整 Transformer——Encoder + Decoder

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> attention（注意力）是绝对主角。其余一切——residual、normalization、feed-forward、cross-attention——都是让你能把它堆深的脚手架。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head Attention), Phase 7 · 04 (Positional Encoding)
**Time:** ~75 minutes

## 问题（The Problem）

单层 attention 是个特征抽取器，不是一个模型。每层一次 matmul 的容量不足以建模语言。你需要深度——而深度在没有正确管线的情况下会崩。

2017 年 Vaswani 的论文打包了六个设计决定，把单层 attention 变成了可堆叠的 block。从那以后的每个 transformer——encoder-only（BERT）、decoder-only（GPT）、encoder-decoder（T5）——都继承了同一套骨架。到 2026 年，block 内部经过了精炼（RMSNorm、SwiGLU、pre-norm、RoPE），但骨架完全一致。

本课讲的就是这副骨架。后续课程把它专门化——06 讲 encoder，07 讲 decoder，08 讲 encoder-decoder。

## 概念（The Concept）

![Encoder 与 decoder block 的内部结构与连线](../assets/full-transformer.svg)

### 六个组件（The six pieces）

1. **Embedding + 位置信号。** Token → 向量。位置通过 RoPE（现代）或正弦（经典）注入。
2. **Self-attention。** 每个位置都关注其他所有位置。在 decoder 里要 mask。
3. **Feed-forward 网络（FFN）。** 逐位置的两层 MLP：`W_2 · activation(W_1 · x)`。默认扩展比 4×。
4. **Residual 连接。** `x + sublayer(x)`。没它，梯度过不了 6 层就消失。
5. **Layer normalization。** `LayerNorm` 或 `RMSNorm`（现代）。稳定 residual stream。
6. **Cross-attention（仅 decoder）。** Query 来自 decoder，key 和 value 来自 encoder 输出。

### Encoder block（被 BERT、T5 encoder 采用）

```
x → LN → MHA(self) → + → LN → FFN → + → out
                     ^              ^
                     |              |
                     └── residual ──┘
```

Encoder 是双向的。不做 mask。所有位置都能看见所有位置。

### Decoder block（被 GPT、T5 decoder 采用）

```
x → LN → MHA(masked self) → + → LN → MHA(cross to encoder) → + → LN → FFN → + → out
```

Decoder 每个 block 有三个 sublayer。中间那个——cross-attention——是信息从 encoder 流向 decoder 的唯一通道。在纯 decoder-only 架构（GPT）里 cross-attention 被省略，只剩 masked self-attention + FFN。

### Pre-norm vs post-norm

原论文：`x + sublayer(LN(x))` vs `LN(x + sublayer(x))`。Post-norm 在 2019 年前后失宠——没有精心设计的 warmup，深层很难训。Pre-norm（`LN` 在 sublayer **之前**）是 2026 年的默认：Llama、Qwen、GPT-3+、Mistral 全用它。

### 2026 年的现代化 block（The 2026 modernized block）

Vaswani 2017 出货时是 LayerNorm + ReLU。现代栈把这两样都换掉了。生产环境里的 block 实际长这样：

| 组件 | 2017 | 2026 |
|-----------|------|------|
| Normalization | LayerNorm | RMSNorm |
| FFN 激活 | ReLU | SwiGLU |
| FFN 扩展比 | 4× | 2.6×（SwiGLU 用三个矩阵，总参数量持平） |
| 位置 | 正弦绝对位置 | RoPE |
| Attention | 完整 MHA | GQA（或 MLA） |
| 偏置项 | 有 | 无 |

RMSNorm 砍掉了 LayerNorm 里的均值居中（少一次减法），节省算力，且经验上至少同等稳定。SwiGLU（`Swish(W1 x) ⊙ W3 x`）在 Llama、PaLM、Qwen 论文里相比 ReLU/GELU FFN 持续低约 0.5 点 ppl。

### 参数量（Parameter count）

对 `d_model = d`、FFN 扩展比 `r` 的单个 block：

- MHA：`4 · d²`（Q、K、V、O 投影）
- FFN（SwiGLU）：`3 · d · (r · d)` ≈ `3rd²`
- Norms：可忽略

在 `d = 4096, r = 2.6, layers = 32`（大致是 Llama 3 8B），总数：`32 · (4·4096² + 3·2.6·4096²) ≈ 32 · (16 + 32) M = ~1.5B 参数每层 × 32 ≈ 7B`（再加 embedding 和输出头）。与公开数字吻合。

## 动手实现（Build It）

### Step 1: the building blocks

复用 Lesson 03 的简易 `Matrix` 类（为独立性已拷贝到本文件）：

- `layer_norm(x, eps=1e-5)`——减均值、除以标准差。
- `rms_norm(x, eps=1e-6)`——除以 RMS。不减均值。
- `gelu(x)` 和 `silu(x) * W3 x`（SwiGLU）。
- `ffn_swiglu(x, W1, W2, W3)`。
- `encoder_block(x, params)` 和 `decoder_block(x, enc_out, params)`。

完整接线见 `code/main.py`。

### Step 2: 接 2 层 encoder + 2 层 decoder

把它们堆起来。把 encoder 输出喂给每一个 decoder 的 cross-attention。在输出投影前加一个最终 LN。

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

### Step 3: 在玩具样例上跑一次前向

喂一个 6 token 的源序列和 5 token 的目标序列。验证输出形状为 `(5, vocab)`。不训练——本课只讲架构，不讲损失。

### Step 4: 换上 RMSNorm + SwiGLU

把 LayerNorm 和 ReLU-FFN 换成 RMSNorm 和 SwiGLU。确认形状仍然吻合。这就是 2026 年的现代化——一次函数替换搞定。

## 用起来（Use It）

PyTorch/TF 的参考实现：`nn.TransformerEncoderLayer`、`nn.TransformerDecoderLayer`。但 2026 年绝大多数生产代码都自己写 block，因为：

- Flash Attention 在 attention 内部调用，不走 `nn.MultiheadAttention`。
- GQA / MLA 不在标准库里。
- RoPE、RMSNorm、SwiGLU 不是 PyTorch 的默认。

HF `transformers` 里有干净的参考 block 值得读：`modeling_llama.py` 是 2026 年规范的 decoder-only block。约 500 行，值得过一遍。

**Encoder vs decoder vs encoder-decoder——怎么选：**

| 需求 | 选哪个 | 例子 |
|------|------|---------|
| 文本分类、embedding、QA | Encoder-only | BERT、DeBERTa、ModernBERT |
| 文本生成、对话、代码、推理 | Decoder-only | GPT、Llama、Claude、Qwen |
| 结构化输入 → 结构化输出（翻译、摘要） | Encoder-decoder | T5、BART、Whisper |

Decoder-only 在语言任务上胜出，因为它扩展性最干净，理解和生成都能做。Encoder-decoder 在输入有明确「源序列」属性（翻译、语音识别、结构化任务）时仍是最佳选择。

## 上线部署（Ship It）

见 `outputs/skill-transformer-block-reviewer.md`。该 skill 会用 2026 年的默认值审查新的 transformer block 实现，标出缺失部分（pre-norm、RoPE、RMSNorm、GQA、FFN 扩展比）。

## 练习（Exercises）

1. **简单。** 算一下 `d_model=512, n_heads=8, ffn_expansion=4, swiglu=True` 时 encoder_block 的参数量。用 `sum(p.numel() for p in block.parameters())` 实现并验证。
2. **中等。** 把 post-norm 换成 pre-norm。两种都初始化，在随机输入上堆 12 层后测激活的范数。Post-norm 的激活应该爆炸；pre-norm 应保持有界。
3. **困难。** 在玩具复制任务（把 `x` 反向复制）上实现 4 层 encoder-decoder。训练 100 步。报告 loss。换上 RMSNorm + SwiGLU + RoPE——loss 会降吗？

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际意思 |
|------|-----------------|-----------------------|
| Block | 「一层 transformer」 | norm + attention + norm + FFN 的堆叠，外面包 residual 连接。 |
| Residual | 「跳连接」 | `x + f(x)` 输出；让梯度能流过深层堆叠。 |
| Pre-norm | 「先 norm 再做」 | 现代写法：`x + sublayer(LN(x))`。不靠 warmup 体操就能训得更深。 |
| RMSNorm | 「不减均值的 LayerNorm」 | 除以 RMS；少一次操作，经验稳定性持平。 |
| SwiGLU | 「大家全都换过去的那个 FFN」 | `Swish(W1 x) ⊙ W3 x → W2`。在 LM ppl 上击败 ReLU/GELU。 |
| Cross-attention | 「decoder 看 encoder 的方式」 | Q 来自 decoder、K/V 来自 encoder 输出的 MHA。 |
| FFN expansion | 「中间 MLP 多宽」 | 隐藏层宽度对 d_model 的比，通常 4（LayerNorm）或 2.6（SwiGLU）。 |
| Bias-free | 「砍掉 +b 项」 | 现代栈在线性层里不带 bias；ppl 略降，模型更小。 |

## 延伸阅读（Further Reading）

- [Vaswani et al. (2017). Attention Is All You Need](https://arxiv.org/abs/1706.03762)——原始 block 规格。
- [Xiong et al. (2020). On Layer Normalization in the Transformer Architecture](https://arxiv.org/abs/2002.04745)——为什么深层 pre-norm 胜过 post-norm。
- [Zhang, Sennrich (2019). Root Mean Square Layer Normalization](https://arxiv.org/abs/1910.07467)——RMSNorm。
- [Shazeer (2020). GLU Variants Improve Transformer](https://arxiv.org/abs/2002.05202)——SwiGLU 论文。
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py)——2026 年规范的 decoder-only block。
