---
id: read-the-rrf-function
title: Read the rank fusion function
card: rag
kind: code-reading
level: 2
roles: [applied-ai-engineer, ai-data-engineer]
rounds: [coding, screen]
tags: [rrf, code-reading, hybrid-search]
minutes: 8
lessons: [phases/11-llm-engineering/07-advanced-rag, phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense]
manuals: []
practice: [reciprocal-rank-fusion]
cheatsheet: [rag-production]
related: [rag/rrf-beats-score-sum]
updated: 2026-11-03
---

Read this fusion function from the advanced RAG lesson. Explain the `+ 1` in the denominator, say what the function ignores on purpose, and describe what happens to a document that appears in only one of the lists.

```python
def reciprocal_rank_fusion(ranked_lists, k=60):
    scores = {}
    for ranked_list in ranked_lists:
        for rank, (doc_id, _) in enumerate(ranked_list):
            if doc_id not in scores:
                scores[doc_id] = 0.0
            scores[doc_id] += 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return fused
```

## Short answer

`enumerate` starts at zero, so the `+ 1` turns the index into a rank that starts at one, and the top document gets 1/61 as the published formula defines. The function drops the score that came with each document, because ranks are the comparable unit across retrievers. A document present in one list gets one contribution and no penalty for the other, so it can still place well if it ranked high where it appeared.

## Full answer

### Walk the loop

1. The outer loop visits each ranked list, for example the vector list and the BM25 list.
2. The inner loop reads each entry as a pair and discards the second element, the retriever's own score.
3. The contribution for a document at zero-based index `rank` is `1.0 / (k + rank + 1)`, which is one over k plus the one-based rank.
4. Contributions sum per document id across the lists.
5. The result is sorted by the summed contribution, highest first.

### What the caller does

The hybrid search in the same lesson asks each retriever for three times the final top k, fuses the two lists and returns the first top k of the fused result. The deeper candidate lists let a document that is good in both retrievers reach the final list even when it is first in neither.

### The capstone version

The hybrid retrieval lesson adds a `weights` list with one multiplier per ranked list, applied to each rank contribution, and raises an error when the number of weights does not match the number of lists. It also keeps a map from document id to document so it can return documents instead of ids.

### The key

Fusion runs on the document id. Two chunks of the same document are two keys. The capstone lesson recommends de-duplication by document, because a term that is out of vocabulary for BM25 gives a zero and the dense retriever still returns noise; per-document fusion absorbs that.

## Follow-ups

- **Level 2:** What changes if you delete the `+ 1`? Expected: the top document gets 1/60 instead of 1/61, the curve shifts a little, and the constant no longer matches the published definition.
- **Level 2:** Why does the caller fetch three times the final k from each retriever? Expected: a deeper list lets a document that ranks well in both retrievers reach the fused top k even when it is first in neither.
- **Level 3:** How does the capstone version let you favor one retriever? Expected: a weights list with one multiplier per ranked list, applied to the rank contribution, with an error when the lengths differ.
- **Level 3:** What is the fusion key, and why does that matter for chunks? Expected: the document id; chunks of one document are separate keys unless you de-duplicate by document, which the lesson recommends.

## Wrong answers

- "The function averages the two scores." It never reads the scores; it sums a function of the ranks.
- "A document missing from one list is penalized." It gets no contribution from that list, which is not a penalty; it can still rank first if it was first in the other.
- "k is the number of results to keep." k is the decay constant in the denominator; the caller slices the fused list to the final top k.

## Taught in

The lesson [advanced RAG](../../../phases/11-llm-engineering/07-advanced-rag/) gives this function and its caller, and the lesson [hybrid retrieval](../../../phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense/) adds the weights and the de-duplication advice.
