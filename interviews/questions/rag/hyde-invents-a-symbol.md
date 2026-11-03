---
id: hyde-invents-a-symbol
title: The invented passage made code search worse
card: rag
kind: debug
level: 3
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [hyde, query-rewriting, bm25, hybrid-search]
minutes: 10
lessons: [phases/19-capstone-projects/67-query-rewriting-hyde, phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense]
manuals: []
practice: []
cheatsheet: [rag-production]
related: [rag/pick-the-query-rewriter, rag/error-code-query-misses]
updated: 2026-11-03
---

You turned on the hypothetical-answer rewriter for a code search assistant. Questions about one subsystem got worse: the gold document, which sat at rank 2 before, now falls out of the top 10 on the lexical side. The hypothetical passages read well. What happened, and what do you change?

## Short answer

The model wrote a function name that does not exist in the index. The real symbol that carried the lexical match is gone from the rewritten query, the rest of the passage is generic prose that scores across many documents, and the dense side returns a plausible neighbor for the invented token. Cap the hypothetical at two or three sentences, lower the BM25 weight in the fusion for rewritten queries, and route queries that already contain a literal symbol past the rewriter.

## Full answer

### Why the rewriter exists

The user's words and the corpus words differ. The rewriter asks the model to write the passage that would answer the question, in the voice of the documentation, and embeds that passage instead of the query. The passage is wrong as a fact, because the model does not know your corpus, and that is fine for the dense side: the retriever cares about token distribution, not truth.

### Why it broke here

Code search is the worst case for the trick. The model invents identifiers with confidence. On the lexical side, the invented name replaces the real symbol, so the one rare term that would have scored high on the right document is absent, and the generic prose around it spreads the score over many documents. On the dense side, a token that is in no document still gets a plausible-looking vector, so the retriever returns neighbors that look right and are wrong. The fusion absorbs that only when the lexical side votes correctly, and here it no longer does.

### The fixes, in order

1. Cap the hypothetical to two or three sentences. Longer passages collect more noise tokens; shorter ones lose the lexical signal the trick needs.
2. Weight the BM25 list lower in the fusion when the query was rewritten, as the lesson advises.
3. Pick the strategy per query. The lesson's heuristic sends jargon-heavy paraphrases to the hypothetical answer; a query that already carries the exact symbol is a literal query, and the lexical retriever handles it at rank 1 with no help.
4. Prove it. Slice the eval by query class and compare recall with and without the rewriter for each slice. Keep it on only where it lifts recall.

## Follow-ups

- **Level 3:** Why does a longer hypothetical make it worse? Expected: it collects more tokens that score on many documents; the lesson caps it at two or three sentences.
- **Level 3:** Which queries should skip the rewriter? Expected: queries that already contain a literal symbol, because the lexical retriever ranks those first without help.
- **Level 4:** How do you prove the fix rather than argue it? Expected: slice the eval by query class, compare recall per slice with and without the rewriter, and enable it only on the slices where it helps.
- **Level 4:** Why does the dense side not rescue the query? Expected: the invented token still gets a plausible vector, so the dense retriever returns wrong neighbors that look right; the fusion fixes that only when the lexical side votes correctly.

## Wrong answers

- "Tell the model not to invent names." It cannot know which names exist in your corpus; the lesson says the passage is wrong as a fact by design.
- "Turn the rewriter off everywhere." It wins on queries whose phrasing does not match the corpus; route by query class instead.
- "Raise the BM25 weight to get the lexical signal back." The lexical signal is the part the invented token broke; the lesson lowers the BM25 weight for the rewritten query.

## Taught in

The lesson [query rewriting](../../../phases/19-capstone-projects/67-query-rewriting-hyde/) names the invented identifier failure and its two fixes, and the lesson [hybrid retrieval](../../../phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense/) explains what each retriever does with an out-of-vocabulary token.
