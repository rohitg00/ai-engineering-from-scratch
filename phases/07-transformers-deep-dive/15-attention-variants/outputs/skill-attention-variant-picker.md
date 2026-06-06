---
name: attention-variant-picker
description: Pick a full / sliding-window / sparse / differential attention topology for a new model given context length, retrieval demands, and compute profile.
version: 1.0.0
phase: 7
lesson: 15
tags: [attention, transformer, long-context, inference, memory]
---

# Attention Variant Picker

Help a developer choose and justify an attention topology for a new transformer, or for an existing one they're extending to longer context.

## Inputs to gather

1. **Target context length** at training and at inference (often different — many models train at 16K and extend at inference).
2. **Retrieval demand** on a 1–5 scale: 1 = pure chat, 5 = needle-in-haystack / RAG / code with long repository context.
3. **Inference memory budget** per-request KV cache tolerance (bytes per token per layer is the right unit).
4. **Training cost tolerance** — training SWA from scratch is cheap; retrofitting differential attention into a pretrained model is expensive.
5. **Hardware target** — Hopper+ has full FlashAttention-3, Ada has FA2, older GPUs are mask-limited.

## Decision rules

- **Context ≤ 16K and retrieval ≤ 3**: full attention with FlashAttention. Don't optimize prematurely.
- **Context 16–128K and retrieval ≤ 3**: mixed SWA + global at 5:1, window 1024 (Gemma 3 shape). Keeps retrieval workable while collapsing KV.
- **Context > 128K**: full SWA with a global layer every 4–6 layers, plus position interpolation / YaRN scaling (Lesson 04).
- **Retrieval = 5 and training budget allows**: consider differential attention in the top 4 layers only (half the KV doubling, most of the sink-cancellation win).
- **You're shipping a public API**: prefer stable patterns (full, SWA, Gemma-3 mix). Skip native-sparse / DIFF unless you have kernel engineers.
- **You can't change the base model**: SWA can be retrofitted at inference via masking; differential and sparse can't.

## Always flag

- Pure-SWA models below 7B often lose measurably on reasoning benchmarks. Recommend against.
- Window size < 512 is almost never right. Go bigger or use a different topology.
- Differential attention reports in the paper are on small models (3–7B). Scale-up evidence is thin as of early 2026.
- Every variant interacts with RoPE / YaRN scaling (Lesson 04). State the position scheme explicitly.

## Output format

Return:

1. **Recommendation** — a single named topology (e.g. "Gemma-3 mix, W=1024, 5:1 SWA:global").
2. **Justification** — map each input to the decision rule above.
3. **KV cache estimate** — at target context, in bytes per token per layer and GB at batch 1.
4. **Migration path** — if the base model is already trained, how to retrofit.
5. **Known risks** — which benchmarks / workloads might regress.
