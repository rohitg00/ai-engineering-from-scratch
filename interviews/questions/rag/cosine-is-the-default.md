---
id: cosine-is-the-default
title: Why vector search ranks by cosine
card: rag
kind: concept
level: 1
roles: [applied-ai-engineer, ai-data-engineer]
rounds: [screen, ml-breadth]
tags: [embeddings, cosine, vector-search]
minutes: 5
lessons: [phases/11-llm-engineering/06-rag, phases/05-nlp-foundations-to-advanced/13-question-answering]
manuals: []
practice: [cosine-top-k]
cheatsheet: [embeddings-vector-search]
related: []
updated: 2026-11-03
---

You write the search step of a retrieval pipeline. A teammate wants to rank chunks by the raw dot product between the query vector and each chunk vector. What do you use instead, and when is the dot product the right choice?

## Short answer

Use cosine similarity, which is the dot product divided by the lengths of the two vectors. It measures only the angle, so a long chunk and a short chunk compete on direction and not on size. The raw dot product is right only when the vector length carries meaning that you want to reward.

## Full answer

### Three measures

| Measure | What it does | Behavior |
|---|---|---|
| Cosine | the cosine of the angle between two vectors, from -1 to 1 | ignores length, the default for retrieval |
| Dot product | the sum of the products of each pair of values | longer vectors score higher |
| L2 distance | the straight-line distance between the two points | smaller is closer, sensitive to length |

Cosine normalizes by length, so chunks of different sizes compare on direction alone. When someone says vector search, they almost always mean cosine.

### The code

```python
def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
```

The guard returns zero when a vector has no length, so an empty chunk does not divide by zero.

### When the two agree

Many embedding models return unit-length vectors, or the caller asks for normalized output. The question-answering lesson encodes with normalization on and then ranks with a plain matrix product. With unit vectors the dot product equals the cosine, so the cheaper operation gives the same order.

## Follow-ups

- **Level 1:** What do the values 1, 0 and -1 mean for cosine? Expected: the same direction, orthogonal, and opposite directions.
- **Level 2:** Your embedder returns unit vectors. Does the choice still matter? Expected: no, because with unit vectors the dot product and the cosine are equal, which is why the lesson normalizes and then uses a matrix product.
- **Level 2:** Why does L2 distance treat a long and a short chunk differently? Expected: it measures the straight-line distance, so a longer vector sits farther away even when it points the same way.
- **Level 3:** When would you keep the raw dot product on purpose? Expected: when the model was trained so that length carries a signal, such as more content in a longer document, and you want that signal in the rank.

## Wrong answers

- "The dot product and the cosine give the same order." Only when every vector has the same length; otherwise longer vectors win on the dot product.
- "A smaller cosine means a closer match." A larger cosine means a smaller angle; smaller is closer only for a distance such as L2.
- "Use whatever the vector store defaults to." The measure must match how the vectors were produced and normalized, so check the embedder before the store.

## Taught in

The lesson [RAG](../../../phases/11-llm-engineering/06-rag/) defines the three measures and the guard, and the lesson [question answering](../../../phases/05-nlp-foundations-to-advanced/13-question-answering/) ranks normalized vectors with a matrix product.
