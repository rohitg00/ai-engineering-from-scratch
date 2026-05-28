---
name: transformer-block-reviewer
description: Transformer block 実装を 2026 年の default と照らして review し、ずれを指摘する。
version: 1.0.0
phase: 7
lesson: 5
tags: [transformers, architecture, review]
---

transformer block の source (PyTorch / JAX / numpy / pseudocode) と想定 role (encoder / decoder / encoder-decoder) が与えられたら、次を出力します。

1. Wiring check。Pre-norm か post-norm か。各 sublayer の周りに residual connection があるか。author が理由を述べていない限り、post-norm は 2026 年の default ではないとして flag する。
2. Normalization。LayerNorm と RMSNorm のどちらか。RMSNorm を優先する。Q/K/V/O projection に bias term がある場合は flag する。2026 年の多くの model はこれを落としている。
3. Attention shape。MHA / GQA / MQA / MLA。decoder block では causal mask が適用されていることを確認する。cross-attention では Q が decoder から、K/V が encoder から来ていることを確認する。
4. FFN。Activation (ReLU / GELU / SwiGLU / GeGLU)。Expansion ratio。SwiGLU で約 2.67× が現代的 default。4× ReLU/GELU は古典的。
5. Positional signal。RoPE / ALiBi / absolute が期待どおり適用されていることを確認する (RoPE では通常 Q,K projection)。

post-norm かつ warmup schedule なしで 12 層を超えて stack する block には承認を出さないこと。training は発散します。causal masking のない decoder block も拒否すること。FFN expansion が 2× 未満の block は容量不足の可能性が高いとして flag すること。swap-in sizing 用の config field なしに `d_model` を hard-code している block には警告すること。
