---
id: error-code-query-misses
title: Vector search misses the article with the exact error code
card: rag
kind: debug
level: 2
roles: [applied-ai-engineer, forward-deployed-ai-engineer, ai-data-engineer]
rounds: [debugging, ml-depth]
tags: [hybrid-search, bm25, rrf, lexical]
minutes: 8
lessons: [phases/11-llm-engineering/07-advanced-rag, phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense]
manuals: []
practice: [bm25, reciprocal-rank-fusion]
cheatsheet: [rag-production]
related: [rag/rrf-beats-score-sum, rag/read-the-rrf-function]
updated: 2026-11-03
---

Support agents search the knowledge base with the exact error code from a ticket, such as E-4021. The vector search returns articles about error handling in general and misses the one article that contains that code. What is happening, and what do you add?

## Short answer

The embedding model treats a rare code as noise, so the query vector lands near articles about errors in general and not near the one exact match. Add a lexical index with BM25 next to the vector index, run both for every query, and merge the two ranked lists with reciprocal rank fusion. The exact token wins on BM25, and the fused list puts that article first.

## Full answer

### Two retrievers, two strengths

Semantic search understands meaning. "How do I cancel my subscription" matches "steps to terminate your plan" with no shared word. It misses exact matches, because a code such as E-4021 carries no meaning for the model to embed.

Lexical search does the opposite. BM25 scores a document by summing, over the query terms, an inverse document frequency factor times a saturating term frequency factor with a length correction. A term that appears in few documents weighs most, so a rare code is exactly what BM25 is best at. It fails when the query and the document share no words.

### Hybrid search

Run both retrievers in parallel and fuse by rank: each document gets the sum of one over k plus its rank in each list, with k at 60. The capstone demo shows the three cases. The literal symbol query sits at BM25 rank 1 and dense rank 4, and fuses to rank 1. The paraphrased query sits at BM25 rank 6 and dense rank 1, and fuses to rank 1. The fusion wins on both query classes, so the fix for the error code does not cost the paraphrased queries.

### Two details that matter

- **Field weighting.** If the codes live in a title or symbol field, repeat those tokens at index time so a title match counts more than a body match. The math stays the same.
- **Out-of-vocabulary codes.** A code present in the ticket and absent from every article gets zero from BM25, because its document frequency is zero, while the dense side still returns plausible-looking neighbors. De-duplicate by document so the empty lexical side adds no stray rank contributions. Rank fusion still scores the documents that only the dense side returns, so they stay in the fused list and can rank first. Check that a retrieved article contains the code, and when none does, say that no retrieved article contains it instead of answering from the neighbors.

## Follow-ups

- **Level 2:** Why does BM25 give a rare code so much weight? Expected: the inverse document frequency factor; a term in few documents scores high and a term in most documents scores low.
- **Level 2:** The code is in the ticket but in no article at all. What does each retriever return? Expected: BM25 contributes nothing for that term, and the dense retriever still returns neighbors that look plausible and are wrong, and the fusion keeps them; check that a retrieved article contains the code, and when none does, say that no retrieved article contains it.
- **Level 3:** How do the paraphrased queries fare after you add the lexical index? Expected: they still win, because the fusion is rank based; in the demo the paraphrased query sat at BM25 rank 6 and dense rank 1 and fused to rank 1.
- **Level 3:** The codes live in a short title field and the body is long prose. What do you tune? Expected: field weighting, which repeats the title tokens at index time so a title match counts more.

## Wrong answers

- "Switch to a better embedding model." A rare code has no meaning to learn; the fix is a lexical signal next to the semantic one.
- "Lower the similarity threshold so more articles come back." More neighbors on the wrong topic do not include the one exact match.
- "Replace the vector search with BM25." Then the queries that share no words with the article fail; run both and fuse.

## Taught in

The lesson [advanced RAG](../../../phases/11-llm-engineering/07-advanced-rag/) contrasts the two retrievers, and the lesson [hybrid retrieval](../../../phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense/) shows the three query classes, field weighting and the out-of-vocabulary case.
