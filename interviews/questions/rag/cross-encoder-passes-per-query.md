---
id: cross-encoder-passes-per-query
title: Count the work of a reranker over the whole index
card: rag
kind: estimate
level: 2
roles: [applied-ai-engineer, ai-data-engineer, forward-deployed-ai-engineer]
rounds: [screen, system-design]
tags: [reranking, cross-encoder, estimate, latency]
minutes: 8
lessons: [phases/19-capstone-projects/66-reranker-cross-encoder, phases/11-llm-engineering/07-advanced-rag]
manuals: []
practice: []
cheatsheet: [rag-production]
related: [rag/bi-encoder-vs-cross-encoder, rag/rerank-pool-size]
updated: 2026-11-03
---

A proposal replaces the vector retriever with a cross-encoder that scores every chunk in a 10 million chunk index, so that nothing is ever missed. Estimate the work for one question, and say what you propose instead.

## Short answer

One forward pass per chunk means 10 million forward passes for one question, which no request budget allows. Keep a bi-encoder for the first stage, because its document vectors are computed once at index time, and run the cross-encoder on a pool of 50 to 200 candidates. The advanced RAG lesson puts the per-pair cost at 100 to 1000 times a bi-encoder comparison.

## Full answer

### The count

| Stage | Work at index time | Work per query |
|---|---|---|
| Bi-encoder | one embedding per chunk, stored | one embedding of the query, then one vector comparison per chunk |
| Cross-encoder | nothing can be stored, the score depends on the query | one forward pass per pair, so one per chunk in the pool |

With the cross-encoder over the whole index, the pool is the index. An index of 10 million chunks means 10 million passes for one question.

### The staged shape

Retrieve a larger candidate set with the cheap stage, for example the top 50 from hybrid search, and rerank with the cross-encoder to the final top 5. The expensive model runs 50 times instead of 10 million, and its lift lands where it matters, in the final order.

### Two more numbers to plan

- A production cross-encoder of about 22M parameters takes 88 MB at float32. Load it once and keep it resident.
- Run the N candidates as one batch. Scored one at a time, the latency multiplies by N.

## Follow-ups

- **Level 2:** Which part of the bi-encoder cost is paid once? Expected: the document embeddings, at index time; a query pays for one embedding and the comparisons.
- **Level 2:** Why does the expensive model pay for itself on the top 50? Expected: 50 passes fit a request budget and the lift is concentrated in the final order of the candidates.
- **Level 3:** The index doubles in size. Which stage grows in cost per query? Expected: the first stage, because it compares against every chunk; the reranker stays at N passes while N is fixed.
- **Level 3:** At this scale the first stage itself is not a brute-force scan. What does it use, and what does that cost? Expected: an approximate nearest neighbor index, which trades a little recall for speed; the advanced RAG lesson notes that at 2 million chunks the error can push a relevant chunk out of the top k.

## Wrong answers

- "Score everything, GPUs are fast." 10 million passes per question is not a latency a user waits for, and the lesson's model takes 88 MB before any batch.
- "Precompute the cross-encoder score for every chunk." The score depends on the query, so there is nothing to precompute.
- "Use a smaller cross-encoder over the whole corpus." Smaller rerankers lose quality faster than they save latency, and the pass count stays the same.

## Taught in

The lesson [cross-encoder](../../../phases/19-capstone-projects/66-reranker-cross-encoder/) counts the passes and sizes the model, and the lesson [advanced RAG](../../../phases/11-llm-engineering/07-advanced-rag/) gives the cost gap and the top 50 to top 5 funnel.
