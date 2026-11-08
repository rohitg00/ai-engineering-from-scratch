---
id: chunk-size-by-query-type
title: Review a chunking choice before the first index build
card: rag
kind: tradeoff
level: 2
roles: [applied-ai-engineer, ai-data-engineer, forward-deployed-ai-engineer]
rounds: [design-review, ml-depth]
tags: [chunking, chunk-size, overlap, recall]
minutes: 10
lessons: [phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag, phases/11-llm-engineering/06-rag, phases/19-capstone-projects/64-chunking-strategies-advanced]
manuals: []
practice: []
cheatsheet: [rag]
related: [rag/overlap-measure-first, rag/take-home-stratified-eval]
updated: 2026-11-03
---

A team is about to index a new document corpus and asks you to review the chunker. They picked semantic splitting, 1000 tokens per chunk and 20 percent overlap, because a blog post recommended it. What do you tell them?

## Short answer

Start from the query type, not from a post. Factoid questions want 256 to 512 tokens, analytical or multi-hop questions 512 to 1024, and whole-section questions 1024 to 2048. Begin with recursive splitting at 512 tokens and no overlap, then measure recall at 5 on a 50-query set before you move any knob.

## Full answer

### Why size follows the question

A chunk must be large enough to hold the answer plus its local context, and small enough that the top k returns the answer and not noise. Too small, at 64 to 128 tokens, and a chunk says "it increased 15% last quarter" with no subject. Too large, at 2048 tokens and more, and one chunk is 10% about revenue and 90% about headcount, so its embedding points nowhere.

| Query type | Chunk size |
|---|---|
| Factoid | 256 to 512 tokens |
| Analytical or multi-hop | 512 to 1024 tokens |
| Whole-section comprehension | 1024 to 2048 tokens |

### What the measurements say

- Recursive splitting at 512 tokens beat semantic splitting 69% to 54% in the chunking study.
- Overlap gave zero measurable benefit in the sparse retrieval study, and every overlapped token is embedded and stored again, so the index cost grows with the overlap.
- Response quality drops sharply around 2,500 tokens of context, so bigger chunks hit a cliff.
- Semantic splitting without a minimum size produces 40-token fragments that hurt retrieval.

### Pick a default without a benchmark

Three properties decide the first chunker: the document type, the paragraph length, and whether the format carries structure. Prose with no structure gets recursive splitting. Markdown and API docs get the header splitter. Code gets a syntax-aware splitter. When in doubt, recursive splitting is the strongest single baseline.

### Then measure

Build a 50-query eval set, stratified by query type, and read recall at 5 for each candidate. Clamp every chunker with a minimum and a maximum size. Never let a chunk span two documents.

## Follow-ups

- **Level 2:** Why does the chunk size depend on the kind of question? Expected: the chunk has to contain the answer with its context, and still be small enough that the top k is about the answer and not about the surrounding noise.
- **Level 2:** The corpus is markdown API documentation. What do you try first? Expected: the structural header splitter, because the format carries explicit structure; drop or merge header-only chunks.
- **Level 3:** Which two guards does every chunker need, whatever the strategy? Expected: a minimum and a maximum size, because chunks of 5 tokens or 5000 tokens both break retrieval.
- **Level 3:** You switch the embedding model later. What do you run again? Expected: the chunking eval, because the winner depends on the corpus and the model, and semantic splitting moves its boundaries when the model changes.

## Wrong answers

- "Semantic splitting is best because it follows meaning." It lost to recursive splitting at 512 tokens in the measured study, and it makes tiny fragments unless you set a floor.
- "Overlap is a safety margin, keep it." The studies found that overlap often adds nothing, and it adds index cost in proportion to its size; justify any overlap with an ablation.
- "Bigger chunks give the model more context." Quality drops around 2,500 tokens of context, and a chunk that covers many topics dilutes its own embedding.

## Taught in

The lesson [chunking strategies](../../../phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag/) gives the size table and the measurements, the lesson [RAG](../../../phases/11-llm-engineering/06-rag/) explains the too-small and too-large failures, and the lesson [chunking comparison](../../../phases/19-capstone-projects/64-chunking-strategies-advanced/) picks a default from three properties.
