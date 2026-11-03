---
id: diagnose-from-the-metric-table
title: Recall holds, MRR drops, nobody touched the retriever
card: rag
kind: debug
level: 3
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [rag-eval, mrr, recall, reranking, regression]
minutes: 10
lessons: [phases/19-capstone-projects/68-rag-eval-precision-recall]
manuals: []
practice: []
cheatsheet: [llm-evaluation, rag-production]
related: [rag/recall-at-k-first, rag/judge-grades-its-own-work]
updated: 2026-11-03
---

After a release, the nightly RAG eval shows recall at 5 unchanged and still high, MRR down from last week, and faithfulness unchanged. Nobody touched the retriever. Which stage do you suspect, how do you confirm it, and what would other patterns have told you?

## Short answer

The reranker. On average the gold chunk still arrives in the top 5, so recall holds, but it sits lower in the list, so MRR falls, and the generator stays grounded in what it receives. Confirm it from the per-query trace: compare the rank of the gold chunk before and after the release, then look at what changed in the reranker, such as its weights, its candidate pool size, or the order of the query and the document in the pair.

## Full answer

### Why the pattern points at one stage

MRR is the mean over queries of one divided by the rank of the first relevant document. Rank 1 contributes 1.0, rank 2 contributes 0.5, rank 10 contributes 0.1, so the metric is dominated by the top of the list. Recall at 5 is blind to position inside the top 5. A move in MRR with recall flat suggests that the right chunk moved down inside the window, and the stage that sets the order inside the window is the reranker. A flat average does not prove it: one query can lose its gold chunk from the top 5 while another gains one. The per-query rank trace below separates reranker movement from retrieval loss.

### The full table

| Symptom | Likely cause | What to fix |
|---|---|---|
| Low recall at k, low precision at k | the chunker cut the answer, or the retriever cannot find it | chunk boundaries, or the retrieval modality |
| Decent recall at k, low MRR | the right chunk is in the top k but not at position 1 | the reranker |
| High MRR, low faithfulness | the generator invents content with the right context in front of it | the generation prompt, force cite or refuse |
| High faithfulness, low relevance | the answer is grounded but off topic | the query rewriter, or the prompt |
| All four high, users still complain | the eval set is not representative | add real user queries to the qrels |

### Confirm, do not guess

Persist the metric trace per query on every CI run. Then the question is not "which number fell" but "which queries fell, and to which rank". Slice by query class. A fall confined to one class, such as queries that carry a literal symbol, points at a different change than a fall across every class.

## Follow-ups

- **Level 3:** The trace shows the gold chunk at rank 3 only for literal identifier queries. What does the slice suggest? Expected: a change that hurt the lexical signal inside the pool for those queries; slice by class to find it rather than averaging it away.
- **Level 3:** Which release changes can move MRR while recall at 5 stays fixed? Expected: anything inside the reranker: new weights, a smaller candidate pool, or the query and the document swapped in the pair.
- **Level 4:** Faithfulness is also down while recall and MRR are fine. Where do you look? Expected: the generation prompt, and the judge itself, because a judge from the same model family grades its own output too kindly; hand-grade a sample.
- **Level 4:** Why keep the per-query trace rather than the averages? Expected: a 90 percent average hides a class that always misses, and when a user complains you can find the matching qrel and see whether the eval would have caught it.

## Wrong answers

- "The retriever regressed." Nobody touched the retriever and recall at 5 did not move; a flat average can still hide a query that lost its gold chunk, so check the per-query rank trace before you blame retrieval.
- "The model started to hallucinate." Faithfulness did not move; the generator is still grounded in what it receives.
- "Run it again, it is noise." The eval is offline and deterministic on the fixture; one metric down with the others flat points at one stage.

## Taught in

The lesson [RAG evaluation](../../../phases/19-capstone-projects/68-rag-eval-precision-recall/) defines MRR and gives the symptom table.
