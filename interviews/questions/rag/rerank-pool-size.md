---
id: rerank-pool-size
title: Pick how many candidates the reranker scores
card: rag
kind: tradeoff
level: 3
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, ml-depth]
tags: [reranking, cross-encoder, latency, recall]
minutes: 10
lessons: [phases/19-capstone-projects/66-reranker-cross-encoder]
manuals: []
practice: []
cheatsheet: [rag-production]
related: [rag/bi-encoder-vs-cross-encoder, rag/cross-encoder-passes-per-query]
updated: 2026-11-03
---

You add a cross-encoder behind a hybrid retriever. The prompt receives K chunks. The team wants a rule for N, the number of candidates the reranker scores, and one engineer proposes a small N to protect the latency budget. How do you choose N, and what do you refuse?

## Short answer

Choose N from the recall curve of the reranked output and the latency budget together. Sweep N on a held-out query set; the lift saturates at a knee somewhere around 20 to 50 candidates, and past it every extra candidate costs a forward pass for nothing. Keep N at least three times K, because the reranker can only promote a chunk that the retriever put in the pool.

## Full answer

### The one tunable

The two-stage pipeline has one knob. The bi-encoder returns N candidates, the cross-encoder scores each pair and keeps K. The lesson shows the shape of the curve with illustrative values: recall at 1 rises from N of 5 to N of 20, rises less to N of 50, and does not change at N of 100. The values are not measurements from the fixture; the knee is real.

### The cap

The cross-encoder cannot raise recall above the bi-encoder recall at N. A low N caps quality, not only latency. If N equals K, the reranker can reorder the K candidates but cannot bring a new one in, so recall at K cannot move and the lift looks like zero.

### The cost side

- Batch the N pairs into one forward pass. Scored one by one, the latency multiplies by N.
- Plan the memory. A 22M parameter cross-encoder takes 88 MB at float32 before any batch.
- Cache reranker output by the hash of the query and the document id. A stable corpus reranks the same way, so hits buy a free latency cut.

### Pin the three together

The bi-encoder, the cross-encoder and N are one choice. A change in any of them invalidates the eval, so the sweep runs again after a model change.

## Follow-ups

- **Level 3:** Why does the curve flatten? Expected: past the knee the extra candidates are rarely relevant, so the reranker has nothing more to promote while each one still costs a forward pass.
- **Level 3:** You cut N from 50 to 10 to save latency. What else moves? Expected: the recall cap, because the reranker cannot see a chunk outside the pool; run the eval again instead of assuming.
- **Level 4:** The embedder is upgraded. Is the chosen N still valid? Expected: no; a new bi-encoder changes recall at N, so the sweep must run again before the release.
- **Level 4:** How do you get the latency back without a smaller N? Expected: one batched forward pass for the N pairs, and a cache keyed on the query and the document id.

## Wrong answers

- "Set N equal to K to save time." Then the reranker can only reorder the K chunks and never bring a new one in, so recall at K cannot move.
- "The larger N, the better." Past the knee the lift saturates and each extra candidate costs one forward pass.
- "Pick N once and keep it." N is pinned with the two models; a change in either one invalidates the choice.

## Taught in

The lesson [cross-encoder](../../../phases/19-capstone-projects/66-reranker-cross-encoder/) gives the latency against quality curve, the three times K rule and the batching and memory notes.
