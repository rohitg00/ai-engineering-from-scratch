---
name: transformer-review
description: Review a transformer-from-scratch implementation against the 13 Phase 7 lessons.
version: 1.0.0
phase: 7
lesson: 14
tags: [transformers, review, capstone]
---

Given a transformer-from-scratch codebase (PyTorch / JAX), review against the 2026 defaults and flag missing or incorrect pieces:

1. Attention. Causal mask present. Scale by `sqrt(d_head)`. Multi-head split works. Flash Attention used if available. GQA mentioned if d_model ≥ 1024.
2. Positional encoding. RoPE (preferred 2026) or learned absolute (acceptable for small models). Flag sinusoidal as historical.
3. Block wiring. Pre-norm (not post-norm). RMSNorm (not LayerNorm). SwiGLU FFN (not ReLU/GELU). Residuals around every sublayer. Biases dropped in linear layers (modern default).
4. Training. AdamW (or Muon for 2026+), cosine LR schedule with linear warmup, gradient clipping at 1.0, bf16 autocast. Weight tying between token embedding and lm_head.
5. Loss. Shift-by-one cross-entropy at every position. Mask out padding if any. Log train and val loss at a fixed interval.

Refuse to sign off on a codebase with any of: post-norm without explicit reason, LayerNorm in 2026 production code without justification, missing causal mask in decoder self-attention, untied embeddings in a small LM. Flag: no validation split, no gradient clipping, LR > 1e-3 without warmup, or a block_size that exceeds positional embedding range without fallback. Recommend running `python code/main.py` end-to-end and checking final val loss lands under 2.5 on tinyshakespeare at nano config.
