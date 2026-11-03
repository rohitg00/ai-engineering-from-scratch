---
id: parent-child-dedupe
title: Read the parent-document retrieval function
card: rag
kind: code-reading
level: 2
roles: [applied-ai-engineer, ai-data-engineer]
rounds: [coding, ml-depth]
tags: [chunking, parent-child, code-reading, context-budget]
minutes: 8
lessons: [phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag, phases/11-llm-engineering/07-advanced-rag]
manuals: []
practice: []
cheatsheet: [rag]
related: [rag/chunk-size-by-query-type, rag/cosine-is-the-default]
updated: 2026-11-03
---

Read this retrieval function from the chunking lesson. What problem does the two-level layout solve, what does the `seen` set do, and how many parents can the function return?

```python
def retrieve_parent(child_query, mapping, encoder, top_k=3):
    child_embs = encoder.encode([m["child"] for m in mapping], normalize_embeddings=True)
    q_emb = encoder.encode([child_query], normalize_embeddings=True)[0]
    scores = child_embs @ q_emb
    top = np.argsort(-scores)[:top_k]
    seen, parents = set(), []
    for i in top:
        if mapping[i]["parent_idx"] not in seen:
            parents.append(mapping[i]["parent"])
            seen.add(mapping[i]["parent_idx"])
    return parents
```

## Short answer

Small child chunks are indexed for a precise match and the larger parent is returned for context, which removes the trade-off between a precise hit and enough surrounding text. The `seen` set drops a parent that several top children map to, so the prompt does not receive the same text twice. For a mapping that is not empty and a positive `top_k`, the function returns between one and `top_k` parents, fewer when children share a parent; an empty mapping or a `top_k` of zero returns none.

## Full answer

### The layout

Standard chunking forces a choice: small chunks match precisely but lack context, large chunks carry context but cover many topics. The two-level layout indexes small children and stores the parent each child came from. The chunking lesson splits parents at 2048 and children at 256 by default, and the advanced RAG lesson draws a 512-token parent with four 128-token children. A query about one detail matches one child precisely, and the prompt receives the whole parent, including the lines around the detail.

### Walk the function

1. Encode every child and the query with normalization on, so the matrix product equals the cosine.
2. Sort children by score and keep the top k indices.
3. For each top child, look up its parent index; if that parent was not seen, append the parent text and mark it.
4. Return the parents in the order of their best child.

### Why de-duplicate

Several children of one parent often match the same query, because they sit in the same section. Without the set, the prompt would receive the same parent twice or three times and waste its context budget. The lesson calls this the key insight of the pattern.

### What production changes

The function re-encodes every child on each call. A real index stores the child vectors once and only embeds the query. The two-level layout also degrades gracefully: a poor child match still returns a reasonable parent.

## Follow-ups

- **Level 2:** Why index the child and not the parent? Expected: a small chunk matches a specific question precisely, while a large chunk covers many topics and its embedding points nowhere in particular.
- **Level 2:** Why a plain matrix product and no cosine? Expected: the vectors are normalized at encode time, so the dot product equals the cosine.
- **Level 3:** What does this function do on every call that production code must not? Expected: it re-encodes all the children; store the child vectors once at index time and embed only the query.
- **Level 3:** Two parents each have one matching child, and a third parent has three matching children below the cut. What does the function miss? Expected: it ranks by the best child only; a parent with several good children gets no extra credit unless you aggregate child scores per parent.

## Wrong answers

- "Return the parent of every top child, duplicates included." Several children map to one parent, and the repeated text wastes the context budget.
- "Make the child as large as the parent." Then there is no precision gain; the point is a small match unit and a large context unit.
- "The function always returns exactly top_k parents." It returns fewer when children share a parent.

## Taught in

The lesson [chunking strategies](../../../phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag/) gives this function and the de-duplication insight, and the lesson [advanced RAG](../../../phases/11-llm-engineering/07-advanced-rag/) draws the parent and child layout.
