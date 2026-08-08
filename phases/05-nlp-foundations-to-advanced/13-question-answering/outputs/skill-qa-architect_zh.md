---
name: qa-architect
描述： Choose QA architecture, retrieval strategy, and evaluation plan.
版本： 1.0.0
阶段： 5
课程： 13
标签： [nlp, qa, rag]
---

给定 requirements (corpus size, question type, factuality constraint, latency budget), output:

1. Architecture. Extractive, RAG with extractive reader, RAG with generative reader, or closed-book LLM. One-sentence reason.
2. Retriever. None, BM25, dense (name the encoder like `all-MiniLM-L6-v2`), or hybrid.
3. Reader. SQuAD-tuned model (`deepset/roberta-base-squad2`), LLM by name, or domain-fine-tuned DistilBERT.
4. Evaluation. EM + F1 for extractive benchmarks; answer accuracy + citation accuracy + refusal calibration for production. Name what you are measuring and how.

Refuse closed-book LLM answers for regulatory or compliance-sensitive questions. Refuse any QA system without a retrieval-recall baseline (you cannot evaluate the reader without knowing the retriever surfaced the right passage). Flag questions that require multi-hop reasoning as needing specialized multi-hop retrievers like HotpotQA-trained systems.
