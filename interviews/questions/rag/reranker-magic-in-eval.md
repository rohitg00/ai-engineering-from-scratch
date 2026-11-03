---
id: reranker-magic-in-eval
title: The reranker is perfect offline and worse in production
card: rag
kind: debug
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [reranking, cross-encoder, eval-leak, rag-eval]
minutes: 8
lessons: [phases/19-capstone-projects/66-reranker-cross-encoder, phases/19-capstone-projects/69-end-to-end-rag-system]
manuals: []
practice: []
cheatsheet: [rag-production, llm-evaluation]
related: [rag/rerank-pool-size, rag/bi-encoder-vs-cross-encoder]
updated: 2026-11-03
---

A new cross-encoder reranker lifts MRR on the offline fixture to a near-perfect value. In production the same reranker makes the top result worse than the retriever alone. List the causes you check, in order, and say how each one shows up.

## Short answer

Check the training data first: if the hand-labeled training pairs include the eval queries, the eval is a memory test and the lift is fake. Then check the pair order in production, because a cross-encoder is not symmetric and a swapped query and document collapses recall. Then check the candidate pool, because production candidates come from the real bi-encoder, and its recall at N caps what the reranker can see.

## Full answer

### Cause 1: the eval leaked into training

The reranker lesson warns that if the hand-labeled training pairs include the eval queries, the rerank looks magical. The end-to-end lesson makes the point concrete: its 14 training triples resemble the eval queries, so the demo keeps the eval queries disjoint on purpose. A leak shows as a near-perfect fixture and a production result that looks like a different model.

### Cause 2: the pair is swapped

The score for the query followed by the document is not the score for the document followed by the query. Always feed the query first. A swap shows as a collapse, not a drift, because every score is computed in the wrong direction.

### Cause 3: the pool is not the production pool

An offline fixture can hand the reranker a made-up pool that always contains the gold chunk. In production the pool comes from the bi-encoder, and the reranker cannot raise recall above the bi-encoder recall at N. The lesson's fix is to pin the bi-encoder, the cross-encoder and N together; a change in any of them invalidates the eval.

### What to log so the next one is cheaper

Log the rank-1 cross-encoder score per query. A top score below a corpus threshold marks an out-of-domain query, and a shift in the score distribution after a release marks a regression before users do.

## Follow-ups

- **Level 2:** How do you make the leak impossible? Expected: hold the eval queries out of the training triples strictly, even on a fixture, as the end-to-end lesson does.
- **Level 2:** What does a swapped pair look like in the numbers? Expected: a collapse rather than a drift, because every score is computed for the wrong direction.
- **Level 3:** Why does a synthetic candidate pool inflate the offline result? Expected: it can contain the gold chunk every time, while the real bi-encoder's recall at N caps what the reranker sees in production.
- **Level 3:** Which one number do you log per query to catch the next regression? Expected: the rank-1 cross-encoder score; a top score below a corpus threshold marks an out-of-domain query.

## Wrong answers

- "The production model is a different build." Check the data and the inputs before the weights; a leak and a swapped pair both reproduce with the same weights.
- "The fixture is too small to mean anything." Size does not create a leak; overlap between training and eval queries does.
- "Lower N in production to match the fixture." A smaller N lowers the recall cap and makes the pipeline worse.

## Taught in

The lesson [cross-encoder](../../../phases/19-capstone-projects/66-reranker-cross-encoder/) names the leak, the asymmetry and the pool cap, and the lesson [end-to-end RAG](../../../phases/19-capstone-projects/69-end-to-end-rag-system/) keeps its training triples disjoint from its eval queries.
