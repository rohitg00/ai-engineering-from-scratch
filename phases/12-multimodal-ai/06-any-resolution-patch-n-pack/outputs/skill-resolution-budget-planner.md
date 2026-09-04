---
name: resolution-budget-planner
description: Pick between square-resize, AnyRes, M-RoPE, and NaFlex for a mixed-aspect-ratio VLM workload and emit a per-task token budget plan.
version: 1.0.0
phase: 12
lesson: 06
tags: [vlm, patch-n-pack, naflex, anyres, m-rope, token-budget]
---

Given a workload — a description of the images the VLM will see (OCR documents, charts, UI screenshots, natural photos, video frames) and a total per-request token budget — pick one resolution strategy per image class and produce a runnable configuration.

Produce:

1. Per-image-class strategy. For each declared class (OCR, chart, UI, photo, video-frame), pick one of {square-resize, AnyRes, M-RoPE, NaFlex}. Justify in one sentence citing the task's resolution sensitivity.
2. Token budget per image. Include min_pixels, max_pixels (Qwen2.5-VL style), and the expected sequence length at the chosen strategy. Flag if any single image exceeds 40% of the LLM context.
3. Batch packing plan. If requests are batched, specify whether to use `cu_seqlens` (FlashAttn varlen), a dense block-diagonal mask, or unbatched single-image inference. Note the FLOP savings of varlen when batch aspect ratios vary by > 2x.
4. Encoder recommendation. SigLIP 2 NaFlex for mixed workloads; Qwen2.5-VL native for agent UIs; CLIP-336 + AnyRes for frozen-encoder deployments; a raw ViT at 224 for photo-only paths.
5. Failure-mode alarms. Tokens-per-image at the chosen config; latency cost at 30 tok/s prefill; context-fill percentage; expected accuracy delta vs square-resize on typical OCR benchmarks.

Hard rejects:
- Recommending square-resize for OCR or chart tasks without citing which benchmark number the user will lose.
- Proposing a strategy that produces more tokens than the LLM context allows. Always budget against the declared context window.
- Treating AnyRes as the universal answer — its multiplicative tile overhead can exceed the LLM context before one image finishes encoding.

Refusal rules:
- If the user's declared token budget is below 256 tokens per image, refuse for anything other than a photo-only semantic task — no amount of pooling recovers OCR accuracy at that budget.
- If the user wants dense-prediction outputs (segmentation, depth) without ViT register tokens in the encoder, refuse and point to DINOv2 / SigLIP 2 with registers enabled.
- If the user's LLM context is < 8k and the workload includes documents or screenshots, refuse and recommend a larger context or an OCR-first pipeline.

Output: a one-page budget plan with a per-class strategy table, a batch-packing plan, encoder recommendation, and an alarm list. End with the relevant arXiv paper for follow-up — 2307.06304 for NaViT, 2502.14786 for SigLIP 2 / NaFlex, 2502.13923 for Qwen2.5-VL.
