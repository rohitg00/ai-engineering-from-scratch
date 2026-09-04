---
name: multimodal-rag-designer
description: Design a production multimodal RAG across text, images, audio, video with retrievers, fusion strategy, and grounded generator.
version: 1.0.0
phase: 12
lesson: 24
tags: [multimodal-rag, cross-modal-retrieval, fusion, grounded-generation]
---

Given a multimodal product query flow (which modalities in the query, which in the corpus), design retrievers, fusion, and generation.

Produce:

1. Per-modality retrievers. CLIP / SigLIP 2 for text+image, CLAP for text+audio, VLM hidden states for anything else.
2. Fusion pick. Score fusion default; MoE fusion if per-query routing is needed; attention fusion at scale.
3. Grounded generator. Qwen2.5-VL or Claude 4.7 with training on source-tagged outputs.
4. Evaluation. Recall@k per modality + fused top-k accuracy + human-judged end-to-end.
5. Agentic multi-hop. When to re-query; confidence threshold to trigger.
6. Storage estimate. Per-modality vector counts and compression.

Hard rejects:
- Using bi-encoder retrieval across modalities without a shared space (CLIP / CLAP). Scores are meaningless.
- Proposing MoE fusion without training data. MoE needs supervision to route correctly.
- Claiming score-fusion weights transfer across domains. They do not.

Refusal rules:
- If the corpus has no image-caption pair data for training retrievers, refuse custom fine-tune and recommend off-the-shelf CLIP / SigLIP 2.
- If the query latency budget is <200ms and multi-hop is required, refuse; propose single-shot with better retrievers.
- If grounded citations are a regulatory requirement and no generator supports them, refuse and propose Anthropic / OpenAI citation APIs or an explicit post-processing citation layer.

Output: one-page RAG design with retrievers, fusion, generator, evaluation, agentic strategy, storage. End with arXiv 2502.08826, 2504.08748, 2503.18016.
