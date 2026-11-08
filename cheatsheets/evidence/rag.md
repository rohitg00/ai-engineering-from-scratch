# Evidence: cheatsheets/rag.md

Abbreviations: P11 = phases/11-llm-engineering, P05 = phases/05-nlp-foundations-to-advanced, P19 = phases/19-capstone-projects, L64 = phases/19-capstone-projects/64-chunking-strategies-advanced, L65 = phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense, L66 = phases/19-capstone-projects/66-reranker-cross-encoder, L67 = phases/19-capstone-projects/67-query-rewriting-hyde, L68 = phases/19-capstone-projects/68-rag-eval-precision-recall, L69 = phases/19-capstone-projects/69-end-to-end-rag-system, d = docs/en.md, c = code/main.py.

## Architecture: End-to-end RAG pipeline (8 nodes, 7 edges)
- Documents, source documents: L69/d:26
- Chunker recursive split: L69/d:94, L69/c:130-138
- HybridIndex BM25 + dense: L69/d:95, L69/c:212-223
- User query: L69/d:28
- Rewriter HyDE, multi-query, decompose: L69/d:96, L69/c:249-255
- Retriever RRF, top_n 12: L69/c:200, 220, 476
- Reranker cross-encoder, top_k 5: L69/d:97, L69/c:477, 515
- Generator cited answer or refuse: L69/d:57-60, 98

## Flow: One query, Pipeline.query (7 steps)
1. pick_strategy " and " decompose, api/function/endpoint/config hyde, else multiquery: L69/c:250-255, 491
2. HyDE: BM25 on query, dense on hypothetical: L69/c:225-229, 501-502
3. subqueries searched alone and fused with rrf: L69/c:503-509
4. BM25 top 8 and dense top 8, fused, top_n 12: L69/c:220-223, 476, 510-511
5. cross-encoder plus overlap_weight 0.3 times overlap, top_k 5: L69/c:397-425, 477, 515
6. top score below REFUSE_THRESHOLD gives "I do not know.": L69/c:431-432, 437-440
7. first sentence of up to 2 chunks, each with [doc_id:chunk_index] anchor: L69/c:93-94, 441-455, L69/d:57-60

## Tasks in code (task-table, 8)
- fixed_window(doc_id, text, size=400, overlap=80): L64/c:38, 381
- structural_markdown(doc_id, text): L64/c:229
- eval_recall(chunker, fixture, ks=(1, 3, 5)): L64/c:363
- rrf(rankings, k=60, weights=...): L65/c:143-147
- retrieve_with_rewriter(query, rewriter, retriever): L67/c:321-326
- rerank(model, query, candidates, top_k): L69/c:397-398
- ndcg_at_k(retrieved, graded, k): L68/c:84
- python3 code/main.py exits 1 on a FAIL: L69/c:14, 704-717, 721

## Hybrid retrieval with RRF (annotated-code, 8 lines)
- HybridRetriever with BM25Index + DenseIndex: L65/c:166-176
- retriever.add per doc: L65/c:232-234
- retriever.search(q, k_each=5, k_out=5): L65/c:247
- result keys bm25, dense, fused: L65/c:186-190
- BM25Index k1=1.5, b=0.75, field_weights title 3: L65/c:50-53
- idf formula: L65/c:87, plus-one keeps IDF positive: L65/d:41
- score += w * (1.0 / (k + rank + 1)), enumerate from 0: L65/c:155-156

## Assemble and query the pipeline (annotated-code, 8 lines)
- Pipeline() with chunker, index, rewriter, reranker: L69/c:471-477
- p.ingest(CORPUS), p.train_reranker_on(TRAIN_TRIPLES): L69/c:663-667
- Chunker target 400: L69/c:131
- p.query returns Result(answer, citations, top_k, rewriter_strategy, latency_ms): L69/c:462-468, 523-529
- latency keys rewrite, retrieve, rerank, generate: L69/c:496, 512, 517, 521

## Chunking strategies (command-table, 8)
- recursive_split, prose with no structure, strongest single baseline: L64/d:114, 120
- structural_markdown, Markdown / RFC / API docs: L64/d:64, 115
- sentence_chunks, long single topic, target 500: L64/d:117
- semantic_chunks, short mixed topics, threshold 0.6: L64/d:118
- fixed_window as a control, mid-symbol cuts: L64/d:48, 100
- Parent-document, retrieve child, return parent, dedupe: P05/23-chunking-strategies-rag/d:36, 152
- Contextual retrieval, 50-100 words of context: P05/23-chunking-strategies-rag/d:40, 161
- Late chunking, token-level embed then pool: P05/23-chunking-strategies-rag/d:38

## Key formulas (concepts, 8)
- Cosine, -1 to 1: P11/06-rag/d:95-99
- BM25 term: P11/07-advanced-rag/d:42-47
- RRF: P11/07-advanced-rag/d:55-60
- Precision@k: L68/d:47, L68/c:39-45
- Recall@k: L68/d:51, L68/c:48-52
- MRR: L68/d:57
- DCG gain (2^rel - 1) / log2(i + 2): L68/c:74-81
- nDCG@k = DCG / IDCG, range 0 to 1: L68/d:63, L68/c:84-91

## Defaults and numbers (defaults, 8)
- BM25 k1 1.5: L65/c:51, L65/d:90. Lesson 11.07 uses 1.2: P11/07-advanced-rag/d:47, 186
- b 0.75, 0 ignores length, 1 full: L65/c:52, L65/d:135
- RRF k 60, rank 1 adds 1/61: L65/c:145, L65/d:55
- chunk size 256-512 with 50-token overlap: P11/06-rag/d:131
- 5 to 10 chunks, 2,500-5,000 tokens: P11/06-rag/d:174, 176
- rerank pool N 50 to 200: L66/d:26
- top_n 12, top_k 5: L69/c:476-477
- REFUSE_THRESHOLD 0.05, REFUSE_TEXT: L69/c:431-432

## Troubleshooting (troubleshooting, 8)
- low recall and precision, chunker or retriever: L68/d:132
- good recall, low MRR, reranker: L68/d:133
- high MRR, low faithfulness, force cite or refuse: L68/d:134
- high faithfulness, low relevance, query rewriter: L68/d:135
- E-4021 missed by embedding: P11/07-advanced-rag/d:34, BM25 exact match: P11/07-advanced-rag/d:36-38
- N = K gives zero lift, N at least 3 times K: L66/d:94
- HyDE invents identifier, cap length, weight BM25 lower: L67/d:129
- 40-token fragments, enforce min_tokens: P05/23-chunking-strategies-rag/d:189

## Abbreviations (glossary, 8)
- RAG: P11/06-rag/d:417
- BM25 Best Matching 25: P11/07-advanced-rag/d:40, 515
- RRF: P11/07-advanced-rag/d:517
- HyDE: P11/07-advanced-rag/d:105
- MRR: L68/d:55, 174
- nDCG: L68/d:63
- Qrels: L68/d:178
- Bi-encoder, cross-encoder: L66/d:126-127

## Questions (qa, 5)
- RRF vs score interpolation, BM25 unbounded: L65/d:61
- cross-encoder 100-1000x slower: P11/07-advanced-rag/d:74
- recall@k quoted, generator cannot use unseen chunk: L68/d:53
- HyDE wrong answer still helps, token distribution: L67/d:58
- RAG for facts, fine-tuning for style, tone, reasoning pattern: P11/06-rag/d:70

## Tips (tips, 6)
- recursive 512, recall@5 on 50 queries: P05/23-chunking-strategies-rag/d:207
- answer only from context, say "I don't know": P05/13-question-answering/d:106, 111
- pin bi-encoder, cross-encoder and N: L66/d:106
- different model family for the judge: L68/d:140
- slice qrels by query class: L68/d:146
- tier 20 / 200 / 2000: L68/d:154
