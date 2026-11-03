---
id: design-rag-over-company-docs
title: Design a question answering service over company documents
card: rag
kind: design
level: 3
roles: [applied-ai-engineer, forward-deployed-ai-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design]
tags: [rag, system-design, hybrid-search, access-control, evaluation]
minutes: 30
lessons: [phases/11-llm-engineering/06-rag, phases/11-llm-engineering/07-advanced-rag, phases/19-capstone-projects/69-end-to-end-rag-system, phases/19-capstone-projects/08-production-rag-chatbot, phases/19-capstone-projects/68-rag-eval-precision-recall]
manuals: []
practice: []
cheatsheet: [rag, rag-production]
related: [rag/filter-before-search, rag/refuse-when-confidence-is-low, rag/take-home-stratified-eval]
updated: 2026-11-03
---

Design a question answering service over a company's internal documents: wikis, policies, contracts and support articles, a few hundred thousand pages, with weekly updates. Users are employees with different access rights. Walk through the pipeline, the evaluation, and the first three things you would measure in production.

## Short answer

Build two sides. The ingestion side parses each document, chunks it per document with a structure-aware splitter, embeds the chunks, and indexes dense vectors and a BM25 index with metadata and access labels on every chunk. The query side filters by access first, runs hybrid retrieval with rank fusion, reranks a candidate pool with a cross-encoder, and generates a cited answer with a refuse path. Prove it with a golden set labeled by domain experts and a retrieval eval that reports recall at k per query class, then measure retrieval quality weekly, faithfulness and citation correctness per turn, and cost per query in production.

## Full answer

### Requirements first

- **Freshness.** Weekly updates mean re-indexing changed documents, not retraining a model.
- **Access.** Different rights mean per-chunk labels and a filter before retrieval.
- **Audit.** Answers must point at the passages they came from.
- **Scale.** Several hundred thousand pages do not fit any prompt; retrieval decides what the model sees.

### Ingestion

1. Parse each document into text and structure.
2. Chunk per document. Start with recursive splitting at 512 tokens and no overlap; use the header splitter for markdown; clamp every chunk with a minimum and a maximum; never let a chunk span two documents.
3. Attach metadata: source, date, version, category, author, role label, jurisdiction or business unit tag.
4. Embed each chunk and write the vector with its payload. Build a BM25 index beside it with field weights so a title or code match counts more than a body match.

### Query

1. Filter the candidate space by the caller's role labels before any search.
2. Run dense and BM25 retrieval in parallel and fuse by rank.
3. Send the top 20 to a cross-encoder and keep the top 5, the funnel the production capstone uses.
4. Build the prompt with the stable parts first: the system prompt and the static policies, then the reranked context, then the question. The capstone targets a cache hit rate of 60 to 80 percent on that prefix, which drops the cost per query by 3 to 5 times.
5. Generate with instructions to cite every claim and to refuse when the snippets do not answer; gate on the reranker's rank-1 score before generation and drop uncited claims after it.

### Evaluation before launch

- A golden set of 200 question and answer pairs with citations, labeled by a domain expert, as the capstone requires.
- Qrels in tiers: a smoke set of 20 queries in CI, a regression set of 200 nightly, a deep set of 2000 weekly.
- Retrieval metrics per query class: recall at k first, then MRR, then nDCG if relevance is graded.
- Answer metrics: faithfulness and relevance, judged by a model from another family.
- A red team of 50 adversarial prompts: jailbreaks, data extraction attempts, off-domain questions and cross-unit leaks.

### The first three production measurements

1. **Retrieval quality on the golden set, weekly.** The capstone alerts on a 5 percent drop. Slice it by document type and business unit.
2. **Faithfulness and citation correctness per turn.** These catch the generator inventing or mis-citing while retrieval is fine.
3. **Cost and latency per query by stage.** Cache hit rate, tokens per query, and the split between retrieval, in the lesson's range of 50 to 200 ms, and generation, in the range of 500 to 3000 ms.

## Follow-ups

- **Level 3:** Where does access control live? Expected: in the retrieval filter, as role labels on chunks applied before the similarity search, and never in the prompt text.
- **Level 3:** A document changes on Tuesday. What is stale and for how long? Expected: its chunks, until the next re-index; re-embed only changed documents, carry the version in the metadata, and watch the gap between source updates and index updates.
- **Level 4:** How do you keep the model cost down at this volume? Expected: a cache-friendly prompt with the system prompt and policies first, the reranked context next and the question last; the capstone targets a 60 to 80 percent hit rate and a 3 to 5 times lower cost per query.
- **Level 4:** The golden set passes and one department still reports bad answers. What do you do? Expected: slice the eval by document type and query class, add that department's real queries to the qrels, and check whether their documents are chunked by a splitter that fits their format.

## Wrong answers

- "Put every document into one long prompt." Hundreds of thousands of pages do not fit, and the lesson budgets 2,500 to 5,000 tokens of retrieved text per query for a reason.
- "Tune the model on the documents every week." It cannot cite, it goes stale between runs, and it cannot enforce access rights.
- "Vector search alone is enough." Exact identifiers, codes and names need the lexical side; run both and fuse.
- "Ship without a labeled set, the demo works." A demo on ten documents says nothing about hundreds of thousands of pages; label the golden set first.

## Taught in

The lesson [RAG](../../../phases/11-llm-engineering/06-rag/) builds the two phases, the lesson [advanced RAG](../../../phases/11-llm-engineering/07-advanced-rag/) adds hybrid search, reranking and metadata filters, the lesson [end-to-end RAG](../../../phases/19-capstone-projects/69-end-to-end-rag-system/) composes the stages with a cited generator, the capstone [production RAG](../../../phases/19-capstone-projects/08-production-rag-chatbot/) sets the golden set, the red team and the cache targets, and the lesson [RAG evaluation](../../../phases/19-capstone-projects/68-rag-eval-precision-recall/) tiers the qrels.
