---
id: pick-the-query-rewriter
title: Which query rewriter fits a two-topic question
card: rag
kind: tradeoff
level: 2
roles: [applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [ml-depth, system-design]
tags: [query-rewriting, hyde, multi-query, decomposition]
minutes: 9
lessons: [phases/19-capstone-projects/67-query-rewriting-hyde, phases/11-llm-engineering/07-advanced-rag]
manuals: []
practice: []
cheatsheet: [rag-production]
related: [rag/hyde-invents-a-symbol]
updated: 2026-11-03
---

Your pipeline offers three query rewriters: write a hypothetical answer and search with it, write several paraphrases and merge, or decompose it into sub-questions and merge. A user asks "what does our team do when uploads fail and the budget is gone?" Which rewriter fits, and when would each of the other two be the right pick?

## Short answer

Split it, because the question joins two topics with a conjunction, an upload failure and an exhausted budget, and no single chunk holds both. The hypothetical answer fits a jargon-heavy question whose words do not match the corpus vocabulary. Paraphrases fit a short question that could be asked in many equally good ways.

## Full answer

### The three, side by side

| Rewriter | What it does | Wins when | Loses when |
|---|---|---|---|
| Hypothetical answer | the model writes a passage in the corpus voice; its embedding replaces the query vector | the query and the corpus use different words | the model invents an identifier that is not in the index |
| Paraphrases | the model writes N rewrites; retrieve each; merge the lists by rank fusion | any of several phrasings would have asked it better | the rewrites all converge, so the merge equals one retrieval |
| Sub-questions | the model splits the question; retrieve each part; merge | the question has conjunctions or two unrelated topics | the question is atomic and gets split anyway |

### Costs

Each rewriter adds one model call before retrieval, and the advanced RAG lesson puts the hypothetical answer at 500 to 2000 ms extra. The retrievals after the call run in parallel, so the model call is the floor. Cache the rewriter output by a hash of the query, because many queries repeat.

### Guards

- Cap the hypothetical to two or three sentences; longer ones collect noise, shorter ones lose the lexical signal.
- Add an explicit diversity instruction to the paraphrase prompt, and drop near duplicates by Jaccard overlap.
- Check that the sub-questions are distinct before the fan-out, so an atomic question returns unchanged.

### Choosing per query

The end-to-end lesson picks a strategy from heuristics on query length, conjunctions and jargon ratio. The other option is to run all three in parallel and fuse the three result sets; the cost is three model calls and one fusion.

## Follow-ups

- **Level 2:** What does a rewriter cost in latency? Expected: one model call before retrieval, 500 to 2000 ms for a hypothetical answer in the advanced RAG lesson, with the retrievals after it in parallel.
- **Level 2:** The paraphrases come back nearly identical. What happens and what do you change? Expected: the merged list equals one retrieval; add a diversity instruction and drop near duplicates by Jaccard overlap.
- **Level 3:** The splitter turns an atomic question into three parts. What is the damage and the guard? Expected: the same document comes back three times at a lower rank and the merge is worse; test that the parts are distinct before the fan-out.
- **Level 3:** How does the end-to-end system choose without a human? Expected: heuristics on length, conjunctions and jargon ratio, or run all three and fuse.

## Wrong answers

- "Always write the hypothetical answer, it is the strongest." It bridges a vocabulary gap and does nothing for a two-topic question; an invented identifier can also hurt the lexical side.
- "A rewriter fixes a weak retriever." It only moves the query closer to the corpus voice; a chunker that cut the answer still loses.
- "Split every query into sub-questions." Atomic questions get over-split and come back worse than the original.

## Taught in

The lesson [query rewriting](../../../phases/19-capstone-projects/67-query-rewriting-hyde/) builds the three rewriters and their failure modes, and the lesson [advanced RAG](../../../phases/11-llm-engineering/07-advanced-rag/) gives the latency cost.
