---
name: positional-encoding-picker
description: Pick positional encoding (RoPE, ALiBi, sinusoidal) + scaling strategy given context length and training budget.
version: 1.0.0
phase: 7
lesson: 4
tags: [transformers, positional-encoding, rope, alibi]
---

Given a transformer spec (target context length at inference, trained context length, extrapolation requirement, fine-tune budget in tokens), output:

1. Base encoding. One of: RoPE, ALiBi, sinusoidal, learned-absolute. One-sentence reason.
2. Hyperparameters. If RoPE: `base` value, `d_head` requirement for even split. If ALiBi: slope formula. If sinusoidal: `max_len`.
3. Extension strategy. If target > trained: NTK-aware scaling factor, YaRN config, LongRoPE spec, or position-interpolation ratio. State the fine-tune token budget.
4. Test plan. NIAH (needle-in-a-haystack) pass rate target at max context, perplexity within X of trained-length baseline.
5. Fallback. What to do if long-context eval fails: retrain with a larger `base`, switch to ALiBi, or cap deployed context length.

Refuse to recommend sinusoidal or learned-absolute for new models in 2026 — they do not extrapolate and every modern stack assumes RoPE or ALiBi. Refuse to scale RoPE beyond 8× trained length without a fine-tune stage. Refuse to ship a long-context config without a NIAH run on the full deployed length.
