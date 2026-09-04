---
name: deepseek-v3-reader
description: Read a DeepSeek-family config and produce a component-by-component architecture analysis.
version: 1.0.0
phase: 10
lesson: 20
tags: [deepseek-v3, deepseek-r1, mla, moe, mtp, dualpipe, architecture]
---

Given a DeepSeek-family model (V3, R1, or any derivative) and its config (hidden_size, layers, num_experts, kv_lora_rank, etc.), produce an architecture analysis that breaks the model down by component and identifies which DeepSeek-specific innovations it uses.

Produce:

1. Field-by-field config read. For each field, name the component it maps to and the parameter count it contributes. Format: `field_name: value → interpretation → parameter contribution`.
2. Parameter breakdown. Total parameters, active parameters, active ratio. Split by embedding, per-layer attention, per-layer MLP (dense vs expert), router, MTP module, LM head, RMSNorm total.
3. KV cache at target context. Report BF16 and FP8 values. Include a comparison to a Llama-3-style GQA(8/128) baseline at the same context and hidden size.
4. Innovation checklist. For each of MLA, MTP, aux-loss-free routing, DualPipe, identify whether the model uses it and where in the config/paper this is visible.
5. Sanity check. Compute the model's inference memory budget (weights + KV cache + activations) on a specific deployment target (H100 80GB, H200 141GB, MI300X 192GB, single node vs multi-node). Report whether it fits and what quantization would be needed.

Hard rejects:
- Any analysis that conflates DeepSeek-V3 with GPT-class dense models. The architecture is materially different.
- Claiming MLA is faster than GQA without specifying context length. At short context (under 4k) they are comparable; MLA wins at long context.
- Interpreting MTP as a replacement for speculative decoding. It is a pre-training objective that also doubles as a draft.

Refusal rules:
- If the provided config is missing `kv_lora_rank`, `num_experts`, or `first_k_dense_layers`, refuse — this is not a DeepSeek-family model.
- If the user asks for the exact published parameter count match (to the nearest 100M), refuse and explain that the published number includes implementation-specific structural parameters a simplified calculator does not exactly reproduce. Direct them to the paper's Section 2 appendix.
- If the target deployment target is a consumer GPU (24GB or less), refuse and recommend a quantized distilled DeepSeek-family derivative instead.

Output: a one-page architecture analysis listing fields, parameter breakdown, KV cache, innovation checklist, and deployment fit. End with a "what to read next" paragraph naming one of NSA (Phase 10 · 17), MLA ablations from the V2 paper, or the V3 technical report's Section 2 appendix, depending on what question the analysis surfaced.
