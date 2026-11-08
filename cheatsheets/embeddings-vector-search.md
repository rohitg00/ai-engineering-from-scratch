---
id: embeddings-vector-search
title: Embeddings and Vector Search
code: EV
subtitle: Encode text, pick a metric, size the vectors, choose an index and fix bad recall. Python, NumPy and FAISS.
hue: 170
sources: phases/11-llm-engineering/04-embeddings, phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive, phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec, phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword, phases/05-nlp-foundations-to-advanced/14-information-retrieval-search, phases/01-math-foundations/14-norms-and-distances, phases/02-ml-fundamentals/06-knn-and-distances, phases/04-computer-vision/20-image-retrieval-metric, phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense
source_hash: 16665e2c8ff93f4e
---

## Retrieve, then rerank
type: architecture
from: phases/11-llm-engineering/04-embeddings/docs/en.md, phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/docs/en.md, phases/05-nlp-foundations-to-advanced/14-information-retrieval-search/docs/en.md

```arch
node | docs | 1,1 | Documents | split into chunks
node | enc | 2,1 | Bi-encoder | text to vector
node | norm | 3,1 | L2 normalize | unit length
node | idx | 4,1 | Vector index | HNSW or flat
node | q | 1,2 | Query | same model, query prefix
node | out | 2,2 | Top 10 | to the reader
node | rerank | 3,2 | Cross-encoder | scores pairs
node | topk | 4,2 | Top 100 | ANN search
edge | docs | enc | chunks
edge | q | enc | embed
edge | enc | norm |
edge | norm | idx | add
edge | idx | topk | search
edge | topk | rerank |
edge | rerank | out | top 10
```

## Encode, search, truncate
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/14-information-retrieval-search/docs/en.md, phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/docs/en.md, phases/02-ml-fundamentals/06-knn-and-distances/docs/en.md

```python
encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")  # 384 dim
embeddings = encoder.encode(corpus, normalize_embeddings=True)  # unit vectors
q_emb = encoder.encode([query], normalize_embeddings=True)
sims = (embeddings @ q_emb.T).flatten()  # dot equals cosine
order = np.argsort(-sims)[:top_k]        # best first
def truncate(vectors, dim):              # Matryoshka cut
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)  # renormalize
emb_256 = truncate(emb, 256)
index = faiss.IndexFlatL2(dimension)     # exact search
index.add(embeddings)
distances, indices = index.search(query_vectors, k=5)
```

## Tasks
type: task-table
from: phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/docs/en.md, phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/code/main.py, phases/11-llm-engineering/04-embeddings/code/embeddings.py, phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/docs/en.md, phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/docs/en.md

| Task | Code |
|---|---|
| Truncate one vector | `truncate_matryoshka(vec, 64)` |
| Binarize a vector | `binarize(vec)` |
| Search by Hamming distance | `engine.index.search(query_vec, top_k=5, metric="hamming")` |
| Fuse dense and sparse ranks | `rrf_fuse([dense_ranked[:5], sparse_scores[:5]])` |
| Load BGE-M3 | `BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)` |
| Run an analogy | `analogy(vocab, W, "man", "king", "woman")` |
| Vector for an unseen word | `fasttext_vector(word, ngram_table)` |
| Evaluate on MTEB tasks | `evaluation.run(encoder, output_folder="./mteb-results")` |

## Similarity math
type: concepts
from: phases/11-llm-engineering/04-embeddings/docs/en.md, phases/11-llm-engineering/04-embeddings/code/embeddings.py, phases/01-math-foundations/14-norms-and-distances/docs/en.md, phases/04-computer-vision/20-image-retrieval-metric/docs/en.md, phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/docs/en.md, phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/code/main.py

- **Cosine**: $\cos(a, b) = \frac{a \cdot b}{\lVert a \rVert \, \lVert b \rVert}$. Range -1 to 1. Ignores length.
- **Cosine distance**: $1 - \cos(a, b)$. Range 0 to 2.
- **Dot product**: $\sum_i a_i b_i$. Equals cosine on unit vectors.
- **L2**: $\sqrt{\sum_i (a_i - b_i)^2}$. Smaller is closer.
- **Unit vectors**: $\lVert a - b \rVert^2 = 2 - 2 \cos(a, b)$.
- **Hamming**: count of different bits after binarize.
- **MaxSim**: best doc token per query token, then sum.
- **RRF**: $\sum \frac{1}{k + \text{rank} + 1}$ over rankings, rank from 0.

## HNSW search
type: flow
from: phases/11-llm-engineering/04-embeddings/docs/en.md, phases/01-math-foundations/14-norms-and-distances/docs/en.md

1. **Build**: put each vector in a multi-layer graph, linked to approximate neighbors.
2. **Top layers**: sparse, with long links between distant clusters.
3. **Bottom layer**: dense, holds all vectors with short links.
4. **Enter**: the query starts at the top layer.
5. **Descend**: greedy moves to closer nodes, then one layer down.
6. **Return**: approximate top-k in $O(\log n)$, not $O(n)$.
7. **Cost**: typically 95 to 99 percent recall. Milliseconds at 10 million vectors.

## Choose an index
type: command-table
from: phases/04-computer-vision/20-image-retrieval-metric/docs/en.md, phases/01-math-foundations/14-norms-and-distances/docs/en.md, phases/02-ml-fundamentals/06-knn-and-distances/docs/en.md

| Command | What it does |
|---|---|
| `IndexFlatIP` | Exact inner product. Cosine on unit vectors. About 100k vectors |
| `IndexFlatL2` | Exact L2, no training. Up to about 1M vectors |
| `IndexIVFFlat` | K cells, searches the closest few. Needs training. About 10M |
| `IndexIVFPQ` | IVF plus product quantization. 100M and more |
| `IndexHNSW` | Graph index. Fastest for many queries. Large index |
| LSH | Random hash projections. Near-duplicate detection |
| KD-trees, ball trees | Exact. Low and medium dimension only |

## Size and compression
type: concepts
from: phases/11-llm-engineering/04-embeddings/docs/en.md, phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/docs/en.md

- **float32, 1536 dim**: 6,144 bytes per vector. 61 GB for 10 million.
- **3,072 dim**: 12 KB per vector at full precision.
- **Binary**: 192 bytes per vector, 32x smaller. 5 to 10 percent recall loss.
- **Rescore**: binary first pass, then full precision on the top 1000.
- **Matryoshka 256 of 1536**: 6x less storage, about 3 to 5 percent loss.
- **Safe cut**: 1,536 to 256 is usually safe. 1,536 to 64 is not.

## Defaults in the code
type: defaults
from: phases/11-llm-engineering/04-embeddings/code/embeddings.py, phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/code/main.py, phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `chunk_size` | 200 | Words per chunk, `chunk_text` |
| `overlap` | 50 | Words shared by two chunks |
| `top_k` | 5 | Results per search |
| `metric` | `"cosine"` | Also dot, euclidean, hamming |
| RRF `k` | 60 | `rrf_fuse` |
| `hash_embed` dim | 256 | Hash trick demo embedder |
| `n_min` | 3 | FastText n-grams, `n_max` 6 |
| `x_max` | 100 | GloVe weighting, `alpha` 0.75 |

## Troubleshooting
type: troubleshooting
from: phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/docs/en.md, phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/code/main.py, phases/04-computer-vision/20-image-retrieval-metric/docs/en.md, phases/11-llm-engineering/04-embeddings/docs/en.md, phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/docs/en.md, phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| bge recall 3 to 5 points low | No query prefix | Prepend the prefix from the model card |
| Truncated vectors rank badly | No renormalize after the cut | Divide by the norm again |
| Recall falls after truncation | Cut too far, or no Matryoshka training | Validate on your eval set |
| Nearest neighbors change | Cosine and L2 conventions mixed | Match the training metric |
| Query and doc do not match | Asymmetric model | Check the model card |
| `cosine: dim mismatch` | Vectors of different size | One model and one dim for both |
| Long docs match nothing | One vector averages all topics | Chunk 256 to 512 tokens, 50 overlap |
| Unseen word has no vector | Word2Vec and GloVe have no fallback | Use FastText n-grams |

## Abbreviations
type: glossary
from: phases/01-math-foundations/14-norms-and-distances/docs/en.md, phases/11-llm-engineering/04-embeddings/docs/en.md, phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/docs/en.md, phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/docs/en.md

- **ANN**: Approximate Nearest Neighbor. Small accuracy loss, large speed gain.
- **HNSW**: Hierarchical Navigable Small World. Multi-layer graph index.
- **IVF**: Inverted file index. Searches a few clusters only.
- **PQ**: Product quantization. Search in compressed space.
- **LSH**: Locality-sensitive hashing. Random hash projections.
- **MTEB**: Massive Text Embedding Benchmark. 56 tasks at launch, 100+ in v2.
- **BEIR**: 18 zero-shot retrieval tasks.
- **OOV**: Out of vocabulary. A word not seen in training.

## Questions
type: qa
from: phases/11-llm-engineering/04-embeddings/docs/en.md, phases/01-math-foundations/14-norms-and-distances/docs/en.md, phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense/docs/en.md, phases/05-nlp-foundations-to-advanced/14-information-retrieval-search/docs/en.md, phases/04-computer-vision/20-image-retrieval-metric/docs/en.md

- **Cosine or dot product?** On L2-normalized vectors the choice does not matter.
- **Why ANN?** Brute force at 1M by 1536 is 1.5 billion multiply-adds per query.
- **Why rerank?** A cross-encoder reads query and doc together. It is slower but more accurate.
- **Why RRF, not a score sum?** BM25 is unbounded. Cosine is in -1 to 1. Ranks compare.
- **Which number for a RAG retriever?** Recall@k. No right passage, no answer.

## Tips
type: tips
from: phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/docs/en.md, phases/04-computer-vision/20-image-retrieval-metric/docs/en.md, phases/05-nlp-foundations-to-advanced/14-information-retrieval-search/docs/en.md, phases/11-llm-engineering/04-embeddings/docs/en.md

- Always set `normalize_embeddings=True`.
- Benchmark on your own queries. Leaderboard rank is not enough.
- Swap a model only if it wins on your domain by more than 3 points.
- Report recall@1, @5 and @10 side by side.
- Measure p99 latency. MTEB scores hide it.
- For a failing query, diff the sparse and dense rankings.
