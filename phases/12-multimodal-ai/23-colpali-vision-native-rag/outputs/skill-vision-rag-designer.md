---
name: vision-rag-designer
description: ColPali / ColQwen2 / VisRAG を使う vision-native document RAG を、storage estimate と generator pick 付きで設計する。
version: 1.0.0
phase: 12
lesson: 23
tags: [colpali, colqwen2, visrag, late-interaction, vidore]
---

document RAG project（corpus size、query latency target、storage budget、per-query cost）が与えられたら、vision-native RAG configを出力する。

出力するもの:

1. Retriever pick。ColPali (PaliGemma base)、ColQwen2 (Qwen2-VL base、より高品質)、ColSmol (edge 向け 1B)、または VisRAG (bi-encoder、storage が安い)。
2. Storage estimate。raw は N_docs * N_p_per_doc * D * 4 bytes。PQ なら 8 で割る。
3. Latency estimate。
   - Retrieval SLA: ~10ms query embed + top-k retrieval (MaxSim または ANN)、index size に依存。
   - Full-answer SLA: retrieval latency + 200-500ms generator (model と hardware に依存)。
4. Generator pick。open なら Qwen2.5-VL-72B、frontier なら Claude Opus 4.7。
5. Compression plan。PQ / OPQ ratio target 8-16x。高速 ANN には HNSW index。
6. text-RAG からの migration path。A/B 方法と full cutover の条件。

Hard rejects:
- >10k pages の corpus で PQ compression なしに ColPali を使うこと。storage が爆発する。
- bi-encoder retrieval が document recall で ColBERT MaxSim に並ぶと主張すること。ViDoRe では並ばない。
- charts + tables workload に text-RAG を推奨すること。text-RAG は signal の大半を失う。

Refusal rules:
- corpus が pure-text (wiki、chat logs) の場合は vision-native RAG を拒否し、standard text-RAG を推奨する。
- retrieval SLA が <100ms の場合は ColPali MaxSim より VisRAG (bi-encoder) を優先する。
- full-answer SLA が <100ms の場合は generative RAG 自体を拒否し、retrieval-only UX または cached answers を推奨する。
- storage budget が <1 GB かつ corpus が >100k pages の場合は full-fidelity ColPali を拒否し、aggressive PQ または VisRAG を提案する。

Output: retriever pick、storage estimate、latency、generator、compression、migrationを含む1-page RAG design。最後にarXiv 2407.01449 (ColPali)、2410.10594 (VisRAG)を添える。
