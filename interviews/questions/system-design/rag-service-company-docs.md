---
id: rag-service-company-docs
title: Design cited search over ten repositories of code
card: system-design
kind: design
level: 3
roles: [applied-ai-engineer, forward-deployed-ai-engineer, ai-data-engineer, agentic-ai-engineer]
rounds: [system-design]
tags: [rag, hybrid-retrieval, reranking, citations, incremental-indexing]
minutes: 25
lessons: [phases/19-capstone-projects/02-rag-over-codebase, phases/11-llm-engineering/13-production-app]
manuals: []
practice: []
cheatsheet: [rag-production, rag]
related: [system-design/batched-inference-api-budget, system-design/eval-platform-ship-gate]
updated: 2026-11-03
---

An engineering organization wants to ask questions across 10 repositories with about 2M lines of code and get answers that cite file and line. The index must stay fresh on every push. Design the ingestion, the retrieval, the answer step, the freshness path, and the evaluation, with the budgets you would commit to.

## Short answer

Parse each file into function and class nodes and chunk at those boundaries, give each chunk a dense embedding, sparse terms and a one-sentence summary, and store a graph of imports and calls between chunks. A query runs dense and sparse search in parallel, merges and deduplicates, reranks the top 50 with a cross-encoder to keep 10, and hands those to a long-context model that must cite every claim by file and line; uncited claims are dropped. A push triggers a symbol-level diff so only changed chunks re-embed, with a budget of under 60 seconds for a 50-file push. Quality is measured on 100 labeled cross-repo questions with MRR@10, nDCG@10, citation faithfulness and p50 and p99 latency.

## Full answer

### Ingestion

- A push webhook starts a worker that collects the changed files.
- A parser with grammars for the languages in the fleet extracts function and class nodes with their full source span. Chunks follow node boundaries, not fixed token windows.
- Each chunk gets three representations: a dense code embedding, sparse terms in a field-weighted index with symbol names weighted 4, bodies 1 and summaries 2, and a one-sentence summary written by a small model with the system preamble cached.
- A symbol graph records imports, calls and inheritance across files and repositories, used at query time to expand retrieval across repo boundaries.

The summary is the third retrievable modality: a user asks how something is authorized, the code says `check_permission`, and the summary says authorization.

### Retrieval and answer

1. Fire dense and sparse search in parallel, deduplicate by repository, path and symbol.
2. Rerank the top 50 with a cross-encoder and keep the top 10.
3. Call the synthesizer with the reranked chunks and a cached system prompt, requiring a file and line anchor on every claim.
4. Parse the output and check each anchor against the span at the indexed commit; a claim without an anchor, or with a span that is missing or does not support it, is re-asked or dropped. Only verified claims return.

Naive cosine search alone is poisoned by generated boilerplate, monorepo duplication and rarely imported symbols, which is why the hybrid search, the reranker and the graph exist.

### Freshness

On each webhook compute the symbol-level diff. Re-embed only the chunks whose text changed, recompute the import, call and inheritance edges of the changed symbols, and delete the chunks, summaries and edges of removed files and symbols from every store. The budget is a 50-file push searchable in under 60 seconds for the whole fleet, without reprocessing the 2M lines.

### Evaluation and budgets

| Weight | Criterion | Measure |
|---|---|---|
| 25 | Retrieval quality | MRR@10 and nDCG@10 on 100 held-out questions |
| 20 | Citation faithfulness | Share of claims with a verifiable file and line anchor |
| 20 | Latency and scale | p95 query latency at 10k QPS on the indexed corpus |
| 20 | Incremental indexing | Time from push to searchable on a 50-file commit |
| 15 | Answer formatting | Clickable citations, snippet previews, follow-up affordance |

A weekly rerun of the 100 questions with an alert on an MRR@10 drop above 5% catches drift in the index or the models.

### The service around it

The query path sits inside the production stack from the application lesson: a gateway with per-user limits, guardrails on input and output, streaming of the answer, structured logs per retrieval and synthesis step, and cost tracking that attributes the summary model, the embeddings, the reranker and the synthesizer separately.

## Follow-ups

- **Level 3:** Why chunk at syntax nodes instead of fixed token windows? Expected: a window cuts functions in half and mixes neighbors; a node is one coherent unit with a stable symbol name to cite and deduplicate on.
- **Level 3:** What does the reranker add that the two retrievers cannot? Expected: it scores each query and candidate pair together, which is more accurate than cosine on separate embeddings, at a cost that only the top 50 can afford.
- **Level 4:** Generated boilerplate makes up a fifth of the corpus. What happens and what do you change? Expected: retrieval poisoning, where near-duplicate generated code crowds the results; flag generated chunks in the payload and down-weight them.
- **Level 4:** A question needs code from four repositories. Which component carries that? Expected: the symbol graph expands the candidate set across import and call edges, so the reranker sees chunks from repositories the first search missed.

## Wrong answers

- "A million-token context window replaces retrieval." Context helps but does not rank; cross-repo questions still need retrieval and citations.
- "Dense embeddings alone are enough for code." Exact symbol names need the sparse index, and the summary catches intent that the code text does not state.
- "Re-index the fleet on every push to keep it simple." Reprocessing 2M lines per commit blows the freshness budget; the diff keeps the index consistent at a fraction of the work.

## Taught in

The [RAG over a codebase capstone](../../../phases/19-capstone-projects/02-rag-over-codebase/) gives the ingestion, the hybrid retrieval, the citation rule, the freshness budget and the rubric, and the [production LLM application lesson](../../../phases/11-llm-engineering/13-production-app/) gives the service around the query path.
