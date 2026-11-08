# Evidence: cheatsheets/embeddings-vector-search.md

Abbreviations: E = phases/11-llm-engineering/04-embeddings, D = phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive, W2V = phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec, FT = phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword, IR = phases/05-nlp-foundations-to-advanced/14-information-retrieval-search, NORM = phases/01-math-foundations/14-norms-and-distances, KNN = phases/02-ml-fundamentals/06-knn-and-distances, CV = phases/04-computer-vision/20-image-retrieval-metric, HY = phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense.

## Retrieve, then rerank (architecture, 8 nodes, 7 edges)
- docs "Documents, split into chunks": E/docs/en.md:165
- enc "Bi-encoder, text to vector": E/docs/en.md:186
- norm "L2 normalize, unit length": IR/docs/en.md:112, D/docs/en.md:78
- idx "Vector index, HNSW or flat": E/docs/en.md:131, HY/docs/en.md:113
- q "Query, same model, query prefix": E/docs/en.md:186, D/docs/en.md:141
- topk "Top 100, ANN search": E/docs/en.md:190, 194-195
- rerank "Cross-encoder, scores pairs": E/docs/en.md:188, 196
- out "Top 10": E/docs/en.md:190, 197

## Encode, search, truncate (annotated-code, 12 lines)
- SentenceTransformer("BAAI/bge-small-en-v1.5"): D/docs/en.md:64. 384 dim: D/docs/en.md:189
- encode with normalize_embeddings=True: IR/docs/en.md:101, 106
- sims = (embeddings @ q_emb.T).flatten(), dot equals cosine: IR/docs/en.md:107, 112
- order = np.argsort(-sims)[:top_k]: IR/docs/en.md:108
- truncate(vectors, dim), renormalize: D/docs/en.md:83-85, 91. emb_256: D/docs/en.md:87
- faiss.IndexFlatL2(dimension), index.add, index.search(query_vectors, k=5): KNN/docs/en.md:343-345. Exact: CV/docs/en.md:90

## Tasks (task-table, 8)
- truncate_matryoshka(vec, 64): D/code/main.py:34, 88
- binarize(vec): E/code/embeddings.py:94-95
- engine.index.search(query_vec, top_k=5, metric="hamming"): E/code/embeddings.py:372, 117-118
- rrf_fuse([dense_ranked[:5], sparse_scores[:5]]): D/code/main.py:105
- BGEM3FlagModel("BAAI/bge-m3", use_fp16=True): D/docs/en.md:98
- analogy(vocab, W, "man", "king", "woman"): W2V/docs/en.md:168
- fasttext_vector(word, ngram_table): FT/docs/en.md:106
- evaluation.run(encoder, output_folder="./mteb-results"): D/docs/en.md:128-129

## Similarity math (concepts, 8)
- Cosine, range -1 to 1, ignores magnitude: E/docs/en.md:101-105, NORM/docs/en.md:141-145
- Cosine distance 1 - cos, 0 to 2: NORM/docs/en.md:147
- Dot product sum, equals cosine on unit vectors: E/docs/en.md:107-111, NORM/docs/en.md:176
- L2 formula, smaller is more similar: E/docs/en.md:113-117
- ||a - b||^2 = 2 - 2 cos(a, b) for unit vectors: CV/docs/en.md:72
- Hamming counts differing bits: E/docs/en.md:214, E/code/embeddings.py:90-91
- MaxSim: D/docs/en.md:32
- RRF 1 / (k + rank + 1), rank from 0: D/code/main.py:59-63

## HNSW search (flow, 7)
1. multi-layer graph, node links to approximate nearest neighbors: E/docs/en.md:133, NORM/docs/en.md:429
2. top layers sparse, long-range: E/docs/en.md:134
3. bottom layers dense: E/docs/en.md:135, 145 ("Layer 0 (dense, all vectors)")
4. start at top layer: E/docs/en.md:136
5. greedy descent: E/docs/en.md:136, NORM/docs/en.md:429
6. O(log n) instead of O(n): E/docs/en.md:137
7. 95-99% recall, milliseconds at 10 million: E/docs/en.md:139

## Choose an index (command-table, 7)
- IndexFlatIP, cosine, 100k: CV/docs/en.md:90, 94
- IndexFlatL2, exact, no training, ~1M: CV/docs/en.md:90
- IndexIVFFlat, K cells, training, 10M: CV/docs/en.md:91, 94
- IndexIVFPQ, 100M+: CV/docs/en.md:94
- IndexHNSW, fastest for many queries, large index: CV/docs/en.md:92
- LSH near-duplicate detection: NORM/docs/en.md:420
- KD-trees, ball trees, low and medium dim: NORM/docs/en.md:418-419, KNN/docs/en.md:194

## Size and compression (concepts, 6)
- 1536 float32 = 6,144 bytes, 61 GB for 10M: E/docs/en.md:212
- 3,072 floats = 12 KB: D/docs/en.md:19
- Binary 192 bytes, 32x, 5-10% recall loss: E/docs/en.md:214, 216
- Rescore top-1000 at full precision: E/docs/en.md:216
- 256 of 1536: 6x less storage, 3-5% loss: E/docs/en.md:208, 441
- 1,536 to 256 safe, to 64 not: D/docs/en.md:142

## Defaults in the code (defaults, 8)
- chunk_size 200: E/code/embeddings.py:6
- overlap 50: E/code/embeddings.py:6
- top_k 5: E/code/embeddings.py:109
- metric "cosine", also dot, euclidean, hamming: E/code/embeddings.py:109, 113-118
- RRF k 60: D/code/main.py:59
- hash_embed dim 256: D/code/main.py:16
- n_min 3, n_max 6: FT/docs/en.md:89
- x_max 100, alpha 0.75: FT/docs/en.md:60, 84

## Troubleshooting (troubleshooting, 8)
- missing bge prefix, 3-5 point recall gap: D/docs/en.md:141
- renormalize after truncation: D/docs/en.md:91
- over-trimming, non-Matryoshka degrade: D/docs/en.md:91, 142
- mixing cosine and L2 conventions: CV/docs/en.md:72
- asymmetric encoding, check model card: D/docs/en.md:140
- "cosine: dim mismatch" ValueError: D/code/main.py:29-30
- long doc embedding averages everything, 256-512 tokens with 50 overlap: E/docs/en.md:165, 182
- OOV no fallback, FastText fixes: W2V/docs/en.md:220, FT/docs/en.md:16

## Abbreviations (glossary, 8)
- ANN: NORM/docs/en.md:414, 516
- HNSW: NORM/docs/en.md:429, 517
- IVF: NORM/docs/en.md:423-424
- PQ: NORM/docs/en.md:425-426
- LSH: NORM/docs/en.md:420
- MTEB 56 tasks, 100+ in v2: D/docs/en.md:201
- BEIR 18 zero-shot tasks: D/docs/en.md:202
- OOV: W2V/docs/en.md:261

## Questions (qa, 5)
- normalized: choice does not matter: NORM/docs/en.md:197
- 1M x 1536 = 1.5 billion multiply-adds: E/docs/en.md:129
- cross-encoder joint, slower, more accurate: E/docs/en.md:188
- BM25 unbounded, cosine -1 to 1, ranks comparable: HY/docs/en.md:61
- Recall@k most important for RAG retriever: IR/docs/en.md:157

## Tips (tips, 6)
- normalize_embeddings=True, always set it: D/docs/en.md:78
- benchmark on own queries: E/docs/en.md:95, D/docs/en.md:132
- swap if wins by more than 3 points: D/docs/en.md:160
- recall@1, @5, @10 side by side: CV/docs/en.md:82
- p99 latency hidden by MTEB: D/docs/en.md:144
- diff sparse and dense rankings: IR/docs/en.md:159
