---
name: skill-embedding-patterns
description: Production patterns for embeddings, vector search, and similarity
version: 1.0.0
phase: 11
lesson: 4
tags: [embeddings, vectors, similarity, search, chunking, quantization]
---

# Embedding Patterns

Every embedding workflow follows this contract:

```
text -> embed(text) -> vector (float array)
similarity(vector_a, vector_b) -> score (float)
```

The embedding model and similarity metric are the only two decisions that matter. Everything else is plumbing.

## When to use embeddings

- Semantic search across documents (find meaning, not keywords)
- Clustering similar items (support tickets, product reviews, bug reports)
- Classification by nearest neighbors (label new items by similarity to labeled examples)
- Recommendation systems (find items similar to what the user liked)
- Deduplication (find near-duplicate content using similarity threshold)

## When NOT to use embeddings

- Exact keyword matching (use full-text search)
- Structured queries (use SQL, filters)
- Small datasets where manual labeling is faster (<100 items)
- Tasks where explainability matters more than accuracy (embeddings are opaque)

## Model selection

Pick based on your constraints:

- **Need an API, best value**: OpenAI text-embedding-3-small (1536d, $0.02/1M tokens)
- **Need maximum accuracy**: Voyage-3 (1024d, $0.06/1M tokens, highest MTEB)
- **Need local/private**: BGE-M3 (1024d, free, multilingual, GPU recommended)
- **Need fast local prototyping**: all-MiniLM-L6-v2 (384d, free, runs on CPU)
- **Need multilingual**: Cohere embed-v3 (1024d) or BGE-M3 (both strong multilingual)

Rule: never mix embedding models between indexing and querying. Vectors from different models live in incompatible spaces.

## Chunking rules

1. Target 256-512 tokens per chunk with 50-token overlap
2. Never split mid-sentence if you can avoid it
3. Include metadata (source file, section title, position) with every chunk
4. For structured docs (Markdown, HTML), split at heading boundaries first
5. Test chunk quality by searching for known answers and checking retrieval

## Similarity metric selection

- **Cosine similarity**: default choice, handles variable-length text, normalized
- **Dot product**: use when vectors are already unit-normalized (OpenAI models are), slightly faster
- **Euclidean distance**: use for clustering, when absolute position matters

All three give the same ranking when vectors are normalized. The choice only matters for non-normalized vectors.

## Storage optimization

Three levels of compression, stackable:

1. **Matryoshka truncation**: reduce dimensions (1536 -> 256 = 6x savings, 3-5% accuracy loss)
2. **Float16 quantization**: halve storage per dimension (2x savings, <1% accuracy loss)
3. **Binary quantization**: 1 bit per dimension (32x savings, 5-10% accuracy loss, use with rescoring)

Production pattern: binary search over full corpus, rescore top-1000 with float32 vectors.

## Retrieve-then-rerank

Two-stage pipeline for best accuracy:

1. Bi-encoder retrieves top-100 candidates (fast, uses pre-computed embeddings)
2. Cross-encoder reranks to top-10 (slow, processes each query-doc pair)

This beats single-stage retrieval by 10-15% on precision metrics. Use when accuracy matters more than latency.

## Common mistakes

- Using different embedding models for indexing and querying
- Embedding entire documents instead of chunks (embedding becomes average of everything)
- Not normalizing vectors before cosine similarity (most models pre-normalize, but verify)
- Ignoring chunk overlap (sentences split at boundaries lose context)
- Storing only vectors without the original text (you need both for retrieval)
- Not re-embedding when the model changes (old vectors are incompatible)
- Choosing dimensions based on accuracy alone (storage and latency scale linearly with dimensions)

## Debugging embeddings

If search results are poor:

1. Verify the query embedding is non-zero (empty or whitespace input produces zero vectors)
2. Check a known-relevant document's similarity score manually
3. Try rephrasing the query to match document vocabulary
4. Inspect chunk boundaries to ensure relevant content is not split across chunks
5. Compare top-k results across metrics (cosine, dot, euclidean) to spot normalization issues
6. Test with a trivially matching query (copy a sentence from a document) to confirm the pipeline works

## Production parameters

- Chunk size: 256-512 tokens
- Chunk overlap: 50 tokens (10-20% of chunk size)
- Top-k retrieval: 5-10 for direct use, 50-100 for reranking
- Similarity threshold: 0.7+ for cosine (below this, results are usually irrelevant)
- Batch embedding: process 100-500 texts per API call for throughput
- Index rebuild: re-embed when the model changes or documents update significantly
