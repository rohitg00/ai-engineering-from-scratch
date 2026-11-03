---
id: bi-encoder-vs-cross-encoder
title: The retriever model and the reranker model
card: rag
kind: concept
level: 1
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, ai-developer-relations-engineer]
rounds: [screen, ml-depth]
tags: [reranking, cross-encoder, bi-encoder, latency]
minutes: 6
lessons: [phases/19-capstone-projects/66-reranker-cross-encoder, phases/11-llm-engineering/07-advanced-rag]
manuals: []
practice: []
cheatsheet: [rag-production]
related: [rag/rerank-pool-size, rag/cross-encoder-passes-per-query]
updated: 2026-11-03
---

A retrieval pipeline uses one model to find candidate chunks and a second model to order them. Explain what each model sees as input, and why the second model does not run over the whole corpus.

## Short answer

A bi-encoder embeds the query and each document on their own and compares the vectors, so every document vector is computed once at index time. A cross-encoder reads the query and one document together as a single sequence and outputs one relevance score, so it can see how the two texts interact. That score costs one forward pass for each pair, so the cross-encoder runs only on a short candidate list.

## Full answer

### Input shape

The bi-encoder maps a text to a vector. The query vector and the document vectors live in the same space, and the rank is the cosine between them. The two encodings never see each other, so the model has to compress all that is useful about a document into one vector without knowing the question.

The cross-encoder takes `[CLS] query_tokens [SEP] document_tokens [SEP]` as one sequence. Attention runs across the join, so every document token can attend to every query token. The output at the first position goes into one linear head that gives one number.

### Cost

The bi-encoder embeds once and answers queries for ever. The cross-encoder runs once per pair. On a 10 million document corpus that is 10 million forward passes for one query, which no request budget allows. The advanced RAG lesson puts the gap at 100 to 1000 times slower than a bi-encoder.

### Staging

Retrieve the top N with the cheap model, then rerank N down to K with the expensive one. N is small, 50 to 200. The quality is the cross-encoder quality, capped by the recall of the first stage at N. A low N caps quality, not only latency.

The production point is a cross-encoder of about 22M parameters. Larger rerankers are kept for offline work or for a very small K.

## Follow-ups

- **Level 1:** Which of the two outputs can you compute before any query arrives? Expected: the bi-encoder document vectors; a cross-encoder score depends on the query.
- **Level 2:** What caps the quality of the two-stage pipeline? Expected: the recall of the first stage at N, because the reranker can only reorder what the retriever returned.
- **Level 2:** Does the order of the two texts in the pair matter? Expected: yes, the cross-encoder is not symmetric; feed the query first, or recall collapses.
- **Level 3:** A team promises a p95 under 100 ms with a 22M parameter reranker. What do you plan first? Expected: memory, because the weights take 88 MB at float32, and batching, because scoring the N candidates one by one multiplies the latency by N.

## Wrong answers

- "The cross-encoder is a better embedding model." It does not produce an embedding; it produces one score for one query and one document.
- "Run the cross-encoder over every chunk for the best quality." On a 10 million document corpus that is 10 million forward passes per query.
- "A larger reranker always wins." The 22M parameter class is the production point; larger models lose more latency than they gain and are kept for offline reranking or a very small K.

## Taught in

The lesson [cross-encoder](../../../phases/19-capstone-projects/66-reranker-cross-encoder/) builds the two-stage pipeline, and the lesson [advanced RAG](../../../phases/11-llm-engineering/07-advanced-rag/) gives the cost gap.
