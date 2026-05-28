---
name: transformer-review
description: transformer-from-scratch implementation を 13 個の Phase 7 lessons に照らして review する。
version: 1.0.0
phase: 7
lesson: 14
tags: [transformers, review, capstone]
---

transformer-from-scratch codebase (PyTorch / JAX) が与えられたら、2026 defaults に照らして review し、欠けている点や誤った点を flag してください。

1. Attention。Causal mask がある。`sqrt(d_head)` で scale している。Multi-head split が動く。利用可能なら Flash Attention を使っている。d_model ≥ 1024 なら GQA に言及している。
2. Positional encoding。RoPE (2026 年の preferred) または learned absolute (small models では acceptable)。sinusoidal は historical として flag します。
3. Block wiring。Pre-norm (post-norm ではない)。RMSNorm (LayerNorm ではない)。SwiGLU FFN (ReLU/GELU ではない)。すべての sublayer の周囲に residuals。linear layers の biases は落とす (modern default)。
4. Training。AdamW (または 2026+ なら Muon)、linear warmup 付き cosine LR schedule、1.0 での gradient clipping、bf16 autocast。token embedding と lm_head の weight tying。
5. Loss。すべての position で shift-by-one cross-entropy。padding があれば mask out。固定 interval で train と val loss を log。

次のいずれかを含む codebase は sign off を拒否してください。明示的な理由のない post-norm、justification なしに 2026 production code で LayerNorm、decoder self-attention の causal mask 欠落、small LM で untied embeddings。次を flag してください。validation split なし、gradient clipping なし、warmup なしで LR > 1e-3、fallback なしに positional embedding range を超える block_size。`python code/main.py` を end-to-end で実行し、nano config の tinyshakespeare で final val loss が 2.5 未満に入ることを確認するよう推奨してください。
