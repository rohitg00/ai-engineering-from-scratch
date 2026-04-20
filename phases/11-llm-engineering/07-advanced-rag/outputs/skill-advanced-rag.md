---
name: skill-advanced-rag
description: Build production-grade RAG with hybrid search, reranking, and evaluation
version: 1.0.0
phase: 11
lesson: 7
tags: [rag, hybrid-search, bm25, reranking, hyde, evaluation]
---

# Advanced RAG Pattern

Basic RAG: embed query -> vector search -> top-k -> generate.
Advanced RAG: embed query + BM25 -> fuse ranks -> rerank -> top-k -> generate.

```
query -> [vector search (top-50)] -+-> RRF fusion -> reranker (top-5) -> prompt -> LLM
                                   |
query -> [BM25 search (top-50)]  --+
```

## When to upgrade from basic RAG

- Retrieval quality drops below 70% Recall@5
- Users report wrong or irrelevant answers
- Corpus grows beyond 100K chunks
- Queries use different vocabulary than documents
- Multi-hop questions fail consistently

## Implementation checklist

1. Add BM25 index alongside vector index
2. Run both searches in parallel (top-50 each)
3. Merge with Reciprocal Rank Fusion (k=60)
4. Rerank top candidates with a cross-encoder
5. Take top-5 for the final prompt
6. Add faithfulness evaluation on a test set

## Technique selection guide

- **Hybrid search**: always use in production. Costs nothing extra at query time.
- **Reranking**: use when Recall@50 is good but Recall@5 is bad. Adds 50-200ms latency.
- **HyDE**: use when queries are vague or use different vocabulary than docs. Adds one LLM call.
- **Parent-child chunks**: use when small chunks lack context but large chunks dilute relevance.
- **Metadata filtering**: use when corpus has clear categories (date, source type, department).
- **Query decomposition**: use for multi-hop questions that require information from multiple docs.

## Common mistakes

- Running BM25 and vector search with different chunk sets (they must search the same corpus)
- Using too small a candidate pool for reranking (top-10 is too few; use top-50)
- Adding HyDE for every query (only helps when vocabulary mismatch is the bottleneck)
- Not evaluating changes (measure Recall@k before and after each technique)
- Over-engineering the pipeline before measuring where it fails

## Evaluation workflow

1. Create 50+ test questions with known answer chunks
2. Measure Recall@5 and Recall@10 for each retrieval method
3. For queries where retrieval succeeds, measure faithfulness of generated answers
4. Track metrics weekly as the corpus grows
5. Investigate individual failures before adding more techniques
