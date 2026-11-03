---
id: rrf-beats-score-sum
title: Why hybrid search fuses ranks and not scores
card: rag
kind: concept
level: 2
roles: [applied-ai-engineer, ai-data-engineer, ai-developer-relations-engineer]
rounds: [screen, ml-depth]
tags: [rrf, hybrid-search, rank-fusion, bm25]
minutes: 8
lessons: [phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense, phases/11-llm-engineering/07-advanced-rag]
manuals: []
practice: [reciprocal-rank-fusion]
cheatsheet: [rag-production]
related: [rag/read-the-rrf-function, rag/error-code-query-misses]
updated: 2026-11-03
---

You have a BM25 ranked list and a vector ranked list for the same query. An engineer proposes to merge them as alpha times the BM25 score plus one minus alpha times the cosine. What is wrong with that, and what do you do instead?

## Short answer

BM25 scores are unbounded and change with the corpus, while a cosine sits between -1 and 1, so a weighted sum needs a new alpha every time you re-index. Reciprocal rank fusion merges by rank instead: each document gets the sum, over the lists, of one over k plus its rank, with k at 60. Ranks are comparable across the two retrievers, so nothing has to be calibrated.

## Full answer

### The formula and one worked case

A document at rank 1 in the vector list and rank 5 in the BM25 list gets 1/(60+1) + 1/(60+5) = 0.0164 + 0.0154 = 0.0318. A document at rank 3 and rank 2 gets 1/(60+3) + 1/(60+2) = 0.0159 + 0.0161 = 0.0320. The second document wins by a hair: a document that is good in both lists beats one that is first in one list and deep in the other.

### What k does

With k at 60, rank 1 contributes 1/61 and rank 10 contributes 1/70. The contribution decays slowly, so deep candidates still vote. A smaller k lets the top results dominate. A larger k flattens the curve.

### Why ranks and not scores

A linear combination of scores needs an alpha tuned per corpus, and it breaks on every re-index because the BM25 score spread moves. Ranks do not have a scale. The capstone lesson notes that the rank-based baseline has beaten score interpolation in every public TREC track since 2010, and that the production search engines that document hybrid search came to the same conclusion.

### A knob that keeps the method honest

If you have evidence that one retriever beats the other on your data, multiply its rank contribution by a weight. The rank decay shape stays and the method stays scale free.

## Follow-ups

- **Level 2:** What does the constant k control? Expected: how fast the contribution decays with rank; at 60, rank 1 gives 1/61 and rank 10 gives 1/70, so deep candidates still count.
- **Level 2:** When would you lower k? Expected: when the top result of each list should dominate the fused order.
- **Level 3:** You know BM25 is better on your corpus. How do you express that? Expected: a per-list weight that multiplies the rank contribution of the BM25 list; the decay shape and the scale-free property both survive.
- **Level 3:** Why does the rank method survive a re-index when the weighted sum does not? Expected: ranks keep their meaning when the corpus changes, while BM25 scores and their spread move, so the tuned alpha no longer fits.

## Wrong answers

- "Normalize both scores to a zero to one range and add them." The two distributions still differ per query and per corpus, so the tuned balance drifts after a re-index.
- "Take the document with the highest score in either list." One unbounded BM25 score then dominates every query; ranks are the comparable unit.
- "Fusion is only a tie-breaker between the two lists." In the demo it decides the top result on every query class; a document good in both lists beats one that is top in only one.

## Taught in

The lesson [hybrid retrieval](../../../phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense/) gives the published formula, the role of k and the case against score interpolation, and the lesson [advanced RAG](../../../phases/11-llm-engineering/07-advanced-rag/) works the two-document example.
