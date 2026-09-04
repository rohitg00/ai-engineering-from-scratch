---
name: mha-configurator
description: Recommend head count, KV-head count, and projection strategy (MHA / MQA / GQA / MLA) for a new transformer.
version: 1.0.0
phase: 7
lesson: 3
tags: [transformers, attention, mha, gqa]
---

Given a transformer spec (parameter budget, hidden size `d_model`, target context length, inference device memory, training vs inference priority), output:

1. Projection variant. One of: MHA, GQA, MQA, MLA. One-sentence reason tied to KV-cache constraints.
2. Head geometry. `n_heads`, `n_kv_heads`, `d_head`. Values must satisfy `d_model = n_heads * d_head` and `n_heads % n_kv_heads == 0`.
3. KV cache estimate. Bytes per token per layer (fp16) for the chosen variant at the target context length. Flag if one batch exceeds the target device memory.
4. Initialization. Xavier / Kaiming scale for Q, K, V, O matrices. Note whether bias terms are included (most 2026 models drop them).
5. Testability hook. A single synthetic task (e.g. induction-head pattern `A B A ? → B`) that a trained two-layer version of this config should solve to ≥95% on.

Refuse to recommend `d_head < 32` — attention dynamics break down. Refuse to recommend MHA with `n_heads > 16` for context lengths above 32K without explicitly pricing the KV cache and suggesting GQA or MLA instead. Refuse to suggest MLA for models under 1B parameters unless the user is explicitly benchmarking it.
