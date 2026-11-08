---
id: rag
title: Retrieval-Augmented Generation (RAG)
code: RA
subtitle: Chunk, index, retrieve, fuse, rerank, generate with citations and grade each stage. Python from the lessons.
hue: 100
sources: phases/11-llm-engineering/06-rag, phases/11-llm-engineering/07-advanced-rag, phases/05-nlp-foundations-to-advanced/13-question-answering, phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag, phases/19-capstone-projects/64-chunking-strategies-advanced, phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense, phases/19-capstone-projects/66-reranker-cross-encoder, phases/19-capstone-projects/67-query-rewriting-hyde, phases/19-capstone-projects/68-rag-eval-precision-recall, phases/19-capstone-projects/69-end-to-end-rag-system
source_hash: daba05d015cad49c
---

## End-to-end RAG pipeline
type: architecture
from: phases/19-capstone-projects/69-end-to-end-rag-system/docs/en.md, phases/19-capstone-projects/69-end-to-end-rag-system/code/main.py

```arch
node | docs | 1,1 | Documents | offline indexing
node | chunk | 2,1 | Chunker | recursive split
node | index | 3,1 | HybridIndex | BM25 + dense
node | gen | 4,1 | Generator | cited answer or refuse
node | query | 1,2 | User query |
node | rewrite | 2,2 | Rewriter | HyDE, multi-query, decompose
node | retr | 3,2 | Retriever | RRF, top_n 12
node | rerank | 4,2 | Reranker | cross-encoder, top_k 5
edge | docs | chunk |
edge | chunk | index | chunks
edge | query | rewrite |
edge | rewrite | retr | rewrites
edge | index | retr | search
edge | retr | rerank | top_n
edge | rerank | gen | top_k
```

## One query: Pipeline.query
type: flow
from: phases/19-capstone-projects/69-end-to-end-rag-system/code/main.py, phases/19-capstone-projects/69-end-to-end-rag-system/docs/en.md

1. **Rewriter**: `pick_strategy` picks decompose for " and ", hyde for api or config, else multiquery.
2. **HyDE**: BM25 searches the query. Dense searches the hypothetical passage.
3. **Subqueries**: each rewrite searches alone. `rrf` fuses the ranked lists.
4. **HybridIndex**: BM25 top 8 and dense top 8, fused, keep `top_n` 12.
5. **Reranker**: cross-encoder score plus 0.3 times query overlap. Keep `top_k` 5.
6. **Generator**: top score below `REFUSE_THRESHOLD` gives "I do not know."
7. **Generator**: else one sentence from up to 2 chunks, each with a `[doc_id:chunk_index]` anchor.

## Tasks in code
type: task-table
from: phases/19-capstone-projects/64-chunking-strategies-advanced/code/main.py, phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense/code/main.py, phases/19-capstone-projects/67-query-rewriting-hyde/code/main.py, phases/19-capstone-projects/68-rag-eval-precision-recall/code/main.py, phases/19-capstone-projects/69-end-to-end-rag-system/code/main.py

| Task | Code |
|---|---|
| Fixed window chunks | `fixed_window(doc_id, text, size=400, overlap=80)` |
| Chunk at headings | `structural_markdown(doc_id, text)` |
| Score a chunker | `eval_recall(chunker, fixture, ks=(1, 3, 5))` |
| Fuse ranked lists | `rrf(rankings, k=60, weights=[1.0, 1.0])` |
| Retrieve through a rewriter | `retrieve_with_rewriter(query, rewriter, retriever)` |
| Rerank candidates | `rerank(model, query, candidates, top_k)` |
| Graded ranking score | `ndcg_at_k(retrieved, graded, k)` |
| Run the gated demo | `python3 code/main.py` exits 1 on a FAIL |

## Hybrid retrieval with RRF
type: annotated-code
lang: python
from: phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense/code/main.py

```python
retriever = HybridRetriever()                # BM25Index + DenseIndex
for d in CORPUS:
    retriever.add(d)                         # indexes both modalities
result = retriever.search(q, k_each=5, k_out=5)
result["bm25"], result["dense"], result["fused"]  # three ranked lists
bm25 = BM25Index(k1=1.5, b=0.75)             # title tokens count 3 times
idf = math.log((n - df + 0.5) / (df + 0.5) + 1.0)  # stays positive
score[doc.doc_id] += w * (1.0 / (k + rank + 1))    # rank starts at 0
```

## Assemble and query the pipeline
type: annotated-code
lang: python
from: phases/19-capstone-projects/69-end-to-end-rag-system/code/main.py

```python
p = Pipeline()                        # chunker, index, rewriter, reranker
p.ingest(CORPUS)                      # recursive split, target 400
p.train_reranker_on(TRAIN_TRIPLES)    # fits the small cross-encoder
result = p.query("<question>")
result.answer                         # sentences plus anchors
result.citations                      # list of doc_id:chunk_index
result.rewriter_strategy              # hyde, multiquery or decompose
result.latency_ms                     # rewrite, retrieve, rerank, generate
```

## Chunking strategies
type: command-table
from: phases/19-capstone-projects/64-chunking-strategies-advanced/docs/en.md, phases/19-capstone-projects/64-chunking-strategies-advanced/code/main.py, phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag/docs/en.md

| Command | What it does |
|---|---|
| `recursive_split` | Prose without structure. Strongest single baseline |
| `structural_markdown` | Markdown, RFC and API docs. Cuts at headings |
| `sentence_chunks` | Long single-topic paragraphs. Target 500 |
| `semantic_chunks` | Short mixed-topic paragraphs. Threshold 0.6 |
| `fixed_window` | A control only. Cuts mid-symbol in code |
| Parent-document | Search small children, return the parent. Dedupe parents |
| Contextual retrieval | Prepend 50-100 words of LLM context to each chunk |
| Late chunking | Embed the whole doc per token, then pool per chunk |

## Key formulas
type: concepts
from: phases/11-llm-engineering/06-rag/docs/en.md, phases/11-llm-engineering/07-advanced-rag/docs/en.md, phases/19-capstone-projects/68-rag-eval-precision-recall/docs/en.md, phases/19-capstone-projects/68-rag-eval-precision-recall/code/main.py

- **Cosine**: $\cos(a, b) = \frac{a \cdot b}{\lVert a \rVert \, \lVert b \rVert}$, from -1 to 1.
- **BM25 term**: $\mathrm{IDF}(t) \frac{tf \, (k_1 + 1)}{tf + k_1 (1 - b + b \, |d| / \mathrm{avgdl})}$
- **RRF**: $\mathrm{RRF}(d) = \sum_R \frac{1}{k + \mathrm{rank}_R(d)}$
- **Precision@k**: gold docs in the top k, divided by k.
- **Recall@k**: gold docs in the top k, divided by all gold docs.
- **MRR**: mean of 1 / rank of the first relevant doc.
- **DCG gain**: $\frac{2^{rel} - 1}{\log_2(i + 2)}$ for position $i$ from 0.
- **nDCG@k**: DCG divided by the DCG of the ideal order. From 0 to 1.

## Defaults and numbers
type: defaults
from: phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense/code/main.py, phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense/docs/en.md, phases/11-llm-engineering/06-rag/docs/en.md, phases/11-llm-engineering/07-advanced-rag/docs/en.md, phases/19-capstone-projects/66-reranker-cross-encoder/docs/en.md, phases/19-capstone-projects/69-end-to-end-rag-system/code/main.py

| Setting | Default | Note |
|---|---|---|
| BM25 `k1` | 1.5 | Lesson 11.07 code uses 1.2 |
| BM25 `b` | 0.75 | 0 ignores length, 1 full normalization |
| RRF `k` | 60 | Rank 1 adds 1/61 |
| Chunk size | 256-512 | Tokens, with 50-token overlap |
| Chunks per query | 5 to 10 | 2,500-5,000 tokens of context |
| Rerank pool N | 50 to 200 | Cross-encoder keeps the top K |
| `top_n`, `top_k` | 12 | Pipeline keeps 5 after rerank |
| `REFUSE_THRESHOLD` | 0.05 | Below it the answer is "I do not know." |

## Troubleshooting
type: troubleshooting
from: phases/19-capstone-projects/68-rag-eval-precision-recall/docs/en.md, phases/11-llm-engineering/07-advanced-rag/docs/en.md, phases/19-capstone-projects/66-reranker-cross-encoder/docs/en.md, phases/19-capstone-projects/67-query-rewriting-hyde/docs/en.md, phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Low recall@k and precision@k | Chunk cut the answer, or retriever misses it | Fix boundaries or add a modality |
| Good recall@k, low MRR | Right chunk not at position 1 | Add a cross-encoder reranker |
| High MRR, low faithfulness | Generator invents content | Force cite or refuse in the prompt |
| High faithfulness, low relevance | Grounded but off-topic answer | Rewrite the query |
| Exact code `E-4021` missed | Embedding treats it as noise | Add BM25 and fuse with RRF |
| Rerank shows no lift | N equals K | Set N to at least 3 times K |
| HyDE drops the right doc | Invented identifier in the passage | Cap length, weight BM25 lower |
| 40-token fragments | Semantic chunks without a floor | Enforce `min_tokens` |

## Abbreviations
type: glossary
from: phases/11-llm-engineering/06-rag/docs/en.md, phases/11-llm-engineering/07-advanced-rag/docs/en.md, phases/19-capstone-projects/66-reranker-cross-encoder/docs/en.md, phases/19-capstone-projects/68-rag-eval-precision-recall/docs/en.md

- **RAG**: Retrieval-Augmented Generation. Retrieve, put in the prompt, generate.
- **BM25**: Best Matching 25. Keyword ranking with IDF and length normalization.
- **RRF**: Reciprocal Rank Fusion. Sums 1/(k + rank) over ranked lists.
- **HyDE**: Hypothetical Document Embeddings. Search with a fake answer.
- **MRR**: Mean Reciprocal Rank. Mean of 1/rank of the first hit.
- **nDCG**: Normalized Discounted Cumulative Gain. Graded ranking quality.
- **Qrels**: gold labels. Queries with gold docs and answers.
- **Bi / cross-encoder**: embeds query and doc apart, or reads them together.

## Questions
type: qa
from: phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense/docs/en.md, phases/11-llm-engineering/07-advanced-rag/docs/en.md, phases/19-capstone-projects/68-rag-eval-precision-recall/docs/en.md, phases/19-capstone-projects/67-query-rewriting-hyde/docs/en.md, phases/11-llm-engineering/06-rag/docs/en.md

- **Why RRF, not score mixing?** BM25 scores are unbounded. Ranks compare across modalities.
- **Why rerank only the top N?** A cross-encoder is 100-1000x slower than a bi-encoder.
- **Why quote recall@k?** The generator can drop a bad chunk. It cannot use a chunk it never saw.
- **Why does a wrong HyDE answer help?** The retriever uses its words, not its facts.
- **RAG or fine-tuning?** RAG for facts. Fine-tuning for style, tone or a reasoning pattern.

## Tips
type: tips
from: phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag/docs/en.md, phases/05-nlp-foundations-to-advanced/13-question-answering/docs/en.md, phases/19-capstone-projects/66-reranker-cross-encoder/docs/en.md, phases/19-capstone-projects/68-rag-eval-precision-recall/docs/en.md

- Start with recursive 512 tokens. Measure recall@5 on a 50-query eval set.
- Tell the model to use only the context and to say "I don't know."
- Pin the bi-encoder, cross-encoder and N together.
- Judge with a different model family than the generator.
- Slice qrels by query class: literal, paraphrased, multi-topic.
- Tier the eval: 20 queries in CI, 200 nightly, 2000 weekly.
