---
id: bm25-idf-plus-one
title: Read the four lines that score a BM25 term
card: rag
kind: code-reading
level: 3
roles: [applied-ai-engineer, ai-data-engineer]
rounds: [coding, ml-depth]
tags: [bm25, code-reading, idf, lexical]
minutes: 10
lessons: [phases/11-llm-engineering/07-advanced-rag, phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense]
manuals: []
practice: [bm25]
cheatsheet: [rag-production]
related: [rag/error-code-query-misses, rag/rrf-beats-score-sum]
updated: 2026-11-03
---

Read these four lines of a BM25 scorer from the advanced retrieval lesson. Explain the `+ 1` inside the logarithm, say what `k1` and `b` control, and describe what happens to a term that appears in more than half of the documents.

```python
idf = math.log((self.n_docs - df + 0.5) / (df + 0.5) + 1)
numerator = tf * (self.k1 + 1)
denominator = tf + self.k1 * (1 - self.b + self.b * doc_len / self.avg_dl)
score += idf * numerator / denominator
```

## Short answer

The `+ 1` inside the log is the smoothed inverse document frequency: without it a term that is in most of the documents gets a negative weight, and with it the weight stays positive. `k1` sets how fast repeated occurrences stop adding score, and `b` sets how much a long document is penalized. A term in most documents gets a weight near zero, which is the right treatment for a stop word.

## Full answer

### The inverse document frequency

The ratio inside the log is the number of documents without the term, plus a half, over the number with the term, plus a half. When fewer documents contain the term than not, the ratio is above one and the log is positive. When the term crosses the half-corpus line the ratio drops below one and the log alone turns negative. The `+ 1` keeps it positive. The capstone lesson notes that this matters for stop words, which appear in most documents, and in small corpora where one common term can cross the line.

### Term frequency saturation

The term frequency factor is `tf * (k1 + 1)` over `tf + k1 * (...)`. As `tf` grows the factor approaches `k1 + 1`, so a document that repeats a term 50 times is not 50 times more relevant than one that has it once. The advanced RAG lesson defaults `k1` to 1.2; the capstone lesson uses 1.5 and calls it the published recommendation, with the advice not to move it without a benchmark.

### Length normalization

`b` scales the length term. At `b` of zero, document length is ignored. At `b` of one, the length penalty is full. Both lessons default to 0.75: longer documents are penalized, but not linearly.

### Field weights

The capstone implements field weighting as a multiplier on term counts at index time, for example the symbol name repeated above the body. The scoring code stays the same.

## Follow-ups

- **Level 3:** What is the weight of a term that appears in every document? Expected: df equals the document count, the ratio inside the log is near zero, the log of about one is near zero, so the term adds almost nothing.
- **Level 3:** A document repeats a query term 50 times. How does its score compare with one occurrence? Expected: it is not 50 times higher; the term frequency factor saturates toward k1 plus 1.
- **Level 4:** When would you move `b`? Expected: up when long documents really say less per word, and down toward zero when document length has nothing to do with topic.
- **Level 4:** The two lessons default `k1` differently. What do you do? Expected: keep the published default unless a benchmark on your own corpus says otherwise, and tune k1 and b by re-running the eval harness rather than by intuition.

## Wrong answers

- "The +1 avoids a logarithm of zero." The ratio is never zero because of the half in the numerator; the +1 keeps the weight from going negative when the term passes half the corpus.
- "k1 is the number of results to keep." k1 is the term frequency saturation constant.
- "A higher b favors long documents." A higher b penalizes length more; b at zero ignores length.

## Taught in

The lesson [advanced RAG](../../../phases/11-llm-engineering/07-advanced-rag/) gives this scorer, and the lesson [hybrid retrieval](../../../phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense/) explains the smoothed IDF, the defaults and field weighting.
