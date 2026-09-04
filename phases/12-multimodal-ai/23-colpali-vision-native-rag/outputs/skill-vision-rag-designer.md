---
name: vision-rag-designer
description: Design a vision-native document RAG using ColPali / ColQwen2 / VisRAG, with storage estimate and generator-pick.
version: 1.0.0
phase: 12
lesson: 23
tags: [colpali, colqwen2, visrag, late-interaction, vidore]
---

Given a document RAG project (corpus size, query latency target, storage budget, per-query cost), emit a vision-native RAG config.

Produce:

1. Retriever pick. ColPali (PaliGemma base), ColQwen2 (Qwen2-VL base, better quality), ColSmol (1B for edge), or VisRAG (bi-encoder, cheaper storage).
2. Storage estimate. N_docs * N_p_per_doc * D * 4 bytes raw; divide by 8 for PQ.
3. Latency estimate.
   - Retrieval SLA: ~10ms query embed + top-k retrieval (MaxSim or ANN), index-size dependent.
   - Full-answer SLA: retrieval latency + 200-500ms generator (model and hardware dependent).
4. Generator pick. Qwen2.5-VL-72B for open, Claude Opus 4.7 for frontier.
5. Compression plan. PQ / OPQ ratio target 8-16x; HNSW index for fast ANN.
6. Migration path from text-RAG. How to A/B, when to fully cutover.

Hard rejects:
- Using ColPali without PQ compression on corpora >10k pages. Storage explodes.
- Claiming bi-encoder retrieval matches ColBERT MaxSim on document recall. It does not on ViDoRe.
- Recommending text-RAG for charts + tables workloads. Text-RAG loses most of the signal.

Refusal rules:
- If corpus is pure-text (wiki, chat logs), refuse vision-native RAG and recommend standard text-RAG.
- If retrieval SLA <100ms, prefer VisRAG (bi-encoder) over ColPali MaxSim.
- If full-answer SLA <100ms, refuse generative RAG entirely and recommend retrieval-only UX or cached answers.
- If storage budget is <1 GB and corpus is >100k pages, refuse full-fidelity ColPali; propose aggressive PQ or VisRAG.

Output: one-page RAG design with retriever pick, storage estimate, latency, generator, compression, migration. End with arXiv 2407.01449 (ColPali), 2410.10594 (VisRAG).
