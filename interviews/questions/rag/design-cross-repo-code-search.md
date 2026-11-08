---
id: design-cross-repo-code-search
title: Design code search across ten repositories that stays fresh
card: rag
kind: design
level: 4
roles: [applied-ai-engineer, ai-data-engineer, forward-deployed-ai-engineer]
rounds: [system-design]
tags: [code-search, ast-chunking, symbol-graph, incremental-index, citations]
minutes: 30
lessons: [phases/19-capstone-projects/02-rag-over-codebase, phases/11-llm-engineering/07-advanced-rag]
manuals: []
practice: []
cheatsheet: [rag-production]
related: [rag/design-rag-over-company-docs, rag/hyde-invents-a-symbol]
updated: 2026-11-03
---

Design a code search service that answers questions such as "how is the upload retry budget enforced" across 10 repositories with about 2M lines of code, and that stays fresh on every push. What is different from document retrieval, and where does it break?

## Short answer

Chunk at syntax tree nodes, functions and classes, not at fixed windows, and give each chunk three retrievable forms: a dense code embedding, BM25 terms with the symbol name weighted above the body, and a one-sentence natural-language summary. Retrieve hybrid, rerank with a cross-encoder, and synthesize with mandatory file and line citations that a post-filter enforces. Freshness is the hard part: a push triggers a symbol-level diff so that only changed chunks re-embed and only affected cross-file edges recompute.

## Full answer

### Why fixed windows fail on code

A fixed window cuts an identifier in half and separates a function body from its signature. The capstone parses each file with a syntax tree parser, extracts function and class nodes, and emits one chunk per node with its repository, path, start line, end line, symbol and body. The chunk boundary is the unit the user wants cited.

### Three representations per chunk

| Form | Catches |
|---|---|
| Dense embedding of the code | paraphrased questions about behavior |
| BM25 with field weights, symbol name 4, summary 2, body 1 | literal symbol names and "find the function named X" |
| A one-sentence summary from a small cached model | a user who says "authorized" when the code says `check_permission` |

Users ask in English about code that uses other words. The summary adds the modality that neither the code embedding nor the lexical index covers.

### The symbol graph

Record edges for imports, calls and inheritance across files and repositories. At query time, expand retrieval along the edges so that a question which crosses four repositories still finds the chain from the caller to the budget configuration.

### The query path

Retrieve dense and BM25 in parallel, de-duplicate by repository, path and symbol, rerank the top 50 and keep the top 10, synthesize with a cached system prompt, and require a repository, path and line range anchor on every claim. A claim without an anchor is flagged for a re-ask or dropped.

### Incremental freshness

A push triggers a diff of changed files and changed symbols. Only chunks whose text changed re-embed. The cross-file edges of the changed chunks recompute, which covers imports, calls and inheritance, so a changed call or base class does not leave a stale edge. A deleted file or symbol removes its chunks from the dense and lexical indexes and its edges from the graph, so search cannot return it after the push. The capstone's target is a 50-file push searchable in under 60 seconds on the 2M line fleet.

### Evaluation

Label 100 cross-repository questions with gold file and line answers. Measure MRR at 10, nDCG at 10, citation faithfulness as the fraction of claims with a verifiable anchor, and p50 and p99 latency. Re-run the set weekly and alert on an MRR at 10 drop above 5 percent.

### Where it breaks

- **Generated code.** Boilerplate from code generators poisons retrieval with near duplicates; flag generated chunks in the payload and down-weight them. The capstone injects 20 percent generated code to show the effect.
- **Monorepo duplication.** Repeated utility code spreads the lexical signal over copies; de-duplicate by symbol.
- **The long tail.** Rarely imported symbols have weak embeddings; the lexical side and the summary carry them.
- **A big push.** A commit that retouches half the files is where the incremental path is tested; measure the push-to-searchable time, not only the average.

## Follow-ups

- **Level 3:** Why three forms per chunk and not one good embedding? Expected: users ask how something is authorized while the code says `check_permission`; the summary bridges a vocabulary gap that neither the code embedding nor BM25 covers.
- **Level 3:** What does the symbol graph buy at query time? Expected: expansion across repository boundaries, from a function to its callers and imports, so a question that spans several repositories finds the whole chain.
- **Level 4:** Generated boilerplate enters the corpus. What happens and what do you do? Expected: near-duplicate code poisons retrieval; flag generated chunks in the payload and down-weight them.
- **Level 4:** What is the freshness target and how do you hold it? Expected: a 50-file push searchable in under 60 seconds on the 2M line fleet, by re-embedding only changed chunks and recomputing only affected edges.

## Wrong answers

- "Chunk code every 512 tokens like prose." Fixed windows cut identifiers in half and separate a function from its signature; cut at syntax tree nodes.
- "Re-index the whole fleet on every push." Two million lines per commit never catches up; diff at the symbol level.
- "Citations are optional for code answers." The capstone rejects any claim without a file and line anchor; the post-filter drops or re-asks.

## Taught in

The capstone [codebase RAG](../../../phases/19-capstone-projects/02-rag-over-codebase/) sets the syntax-aware chunks, the three forms, the symbol graph, the incremental re-index and the eval, and the lesson [advanced RAG](../../../phases/11-llm-engineering/07-advanced-rag/) supplies hybrid search and reranking.
