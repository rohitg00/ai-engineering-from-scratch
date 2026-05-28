---
name: multimodal-rag-designer
description: text、images、audio、video を横断する production multimodal RAG を、retrievers、fusion strategy、grounded generator 付きで設計する。
version: 1.0.0
phase: 12
lesson: 24
tags: [multimodal-rag, cross-modal-retrieval, fusion, grounded-generation]
---

multimodal product query flow（query側のmodalities、corpus側のmodalities）が与えられたら、retrievers、fusion、generationを設計する。

出力するもの:

1. Per-modality retrievers。text+image には CLIP / SigLIP 2、text+audio には CLAP、それ以外には VLM hidden states。
2. Fusion pick。default は score fusion。per-query routing が必要なら MoE fusion、scale するなら attention fusion。
3. Grounded generator。source-tagged outputs で training した Qwen2.5-VL または Claude 4.7。
4. Evaluation。modality 別 Recall@k + fused top-k accuracy + human-judged end-to-end。
5. Agentic multi-hop。いつ re-query するか、その trigger となる confidence threshold。
6. Storage estimate。modality 別 vector counts と compression。

Hard rejects:
- shared space (CLIP / CLAP) なしに modalities 間で bi-encoder retrieval を使うこと。score は意味を持たない。
- training data なしに MoE fusion を提案すること。MoE が正しく routing するには supervision が必要。
- score-fusion weights が domains 間でそのまま移ると主張すること。移らない。

Refusal rules:
- corpus に retriever training 用の image-caption pair data がない場合は custom fine-tune を拒否し、off-the-shelf CLIP / SigLIP 2 を推奨する。
- query latency budget が <200ms で multi-hop が必要な場合は拒否し、より良い retrievers による single-shot を提案する。
- grounded citations が regulatory requirement で、対応 generator がない場合は拒否し、Anthropic / OpenAI citation APIs または明示的な post-processing citation layer を提案する。

Output: retrievers、fusion、generator、evaluation、agentic strategy、storageを含む1-page RAG design。最後にarXiv 2502.08826、2504.08748、2503.18016を添える。
