# Embedding Models — The 2026 Deep Dive

> Word2Vec gave you a vector per word. Modern embedding models give you a vector per passage, cross-lingual, with sparse, dense, and multi-vector views, sized to fit your index. Pick wrong and your RAG retrieves the wrong thing.

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 03 (Word2Vec), Phase 5 · 14 (Information Retrieval)
**Time:** ~60 minutes

## The Problem

Your RAG system retrieves the wrong passage 40% of the time. The culprit is rarely the vector database or the prompt. It is the embedding model.

Choosing an embedding in 2026 means picking across five axes:

1. **Dense vs sparse vs multi-vector.** One vector per passage, or one per token, or a sparse weighted bag of words.
2. **Language coverage.** Monolingual English models still win on English-only tasks. Multilingual models win when corpora are mixed.
3. **Context length.** 512 tokens vs 8,192 vs 32,768 — and real effective capacity is often 60-70% of the advertised max.
4. **Dimension budget.** 3,072 floats at full precision = 12 KB per vector. At 100M vectors, storage is $1,300/month. Matryoshka truncation cuts this 4×.
5. **Open vs hosted.** Open-weight means you control the stack and data. Hosted means you trade control for always-latest.

This lesson names the tradeoffs so you can pick on evidence, not on whatever was popular last quarter.

## The Concept

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

**Dense embeddings.** One vector per passage (usually 384-3,072 dimensions). Cosine similarity ranks passages by semantic proximity. OpenAI `text-embedding-3-large`, BGE-M3 dense mode, Voyage-3. Default choice.

**Sparse embeddings.** SPLADE-style. A transformer predicts a weight for every vocab token, then zeros out most of them. Result is a sparse vector of size |vocab|. Captures lexical matching (like BM25) but with learned term weights. Strong on keyword-heavy queries.

**Multi-vector (late interaction).** ColBERTv2, Jina-ColBERT. One vector per token. Scoring with MaxSim: for each query token, find the most similar document token, sum the scores. More expensive to store and score, but wins on long queries and domain-specific corpora.

**BGE-M3: all three at once.** Single model outputs dense, sparse, and multi-vector representations simultaneously. Each can be queried independently; scores fuse via weighted sum. The 2026 default when you want flexibility from one checkpoint.

**Matryoshka Representation Learning.** Trained so the first N dimensions of the vector form a useful standalone embedding. Truncate a 1,536-dim vector to 256 dim and pay ~1% accuracy for 6× storage savings. Supported by OpenAI text-3, Cohere v4, Voyage-4, Jina v5, Gemini Embedding 2, Nomic v1.5+.

### The MTEB leaderboard tells a partial story

Massive Text Embedding Benchmark — 56 tasks across 8 task types at launch (2022), expanded to 100+ tasks in MTEB v2. In early 2026, Gemini Embedding 2 tops retrieval (67.71 MTEB-R). Cohere embed-v4 leads general (65.2 MTEB). BGE-M3 leads open-weight multilingual (63.0). The leaderboard is necessary but not sufficient — always benchmark on your domain.

### The three-tier pattern

| Use case | Pattern |
|----------|---------|
| Fast first-pass | Dense bi-encoder (BGE-M3, text-3-small) |
| Recall boost | Sparse (SPLADE, BGE-M3 sparse) + RRF fuse |
| Precision on top-50 | Multi-vector (ColBERTv2) or cross-encoder reranker |

Most production stacks use all three.

## Build It

### Step 1: baseline — dense embeddings with Sentence-BERT

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")
corpus = [
    "The first iPhone launched in 2007.",
    "Apple released the iPod in 2001.",
    "Android is an operating system from Google.",
]
emb = encoder.encode(corpus, normalize_embeddings=True)

query = "When was the iPhone released?"
q_emb = encoder.encode([query], normalize_embeddings=True)[0]
scores = emb @ q_emb
print(sorted(enumerate(scores), key=lambda x: -x[1]))
```

`normalize_embeddings=True` makes the dot product equal cosine similarity. Always set it.

### Step 2: Matryoshka truncation

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

Re-normalize after truncation. Nomic v1.5, OpenAI text-3, and Voyage-4 are trained so this is lossless for the first few levels. Non-Matryoshka models (original Sentence-BERT) degrade sharply when truncated.

### Step 3: BGE-M3 multi-functionality

```python
from FlagEmbedding import BGEM3FlagModel

model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)

output = model.encode(
    corpus,
    return_dense=True,
    return_sparse=True,
    return_colbert_vecs=True,
)
# output["dense_vecs"]:    (n_docs, 1024)
# output["lexical_weights"]: list of dict {token_id: weight}
# output["colbert_vecs"]:  list of (n_tokens, 1024) arrays
```

Three indexes, one inference call. Score fusion:

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

Tune the weights on your domain.

### Step 4: MTEB eval on a custom task

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

Run your candidate models on a *representative* subset. Do not trust leaderboard rank alone — your domain matters.

### Step 5: hand-rolled cosine from scratch

See `code/main.py`. Averaged Hashing Trick embeddings (stdlib-only). Not competitive with transformer embeddings, but shows the shape: tokenize → vector → normalize → dot product.

## Pitfalls

- **Same model for query and doc.** Some models (Voyage, Jina-ColBERT) use asymmetric encoding — query and document pass through different paths. Always check the model card.
- **Missing prefix.** `bge-*` models need `"Represent this sentence for searching relevant passages: "` prepended to queries. 3-5 point recall gap if you forget.
- **Over-trimming Matryoshka.** 1,536 → 256 is usually safe. 1,536 → 64 is not. Validate on your eval set.
- **Context truncation.** Most models silently truncate inputs over their max length. Long docs need chunking (see lesson 23).
- **Ignoring latency tail.** MTEB scores hide p99 latency. A 600M model might beat a 335M model by 2 points but cost 3× more per query.

## Use It

The 2026 stack:

| Situation | Pick |
|-----------|------|
| English-only, fast, API | `text-embedding-3-large` or `voyage-3-large` |
| Open-weight, English | `BAAI/bge-large-en-v1.5` |
| Open-weight, multilingual | `BAAI/bge-m3` or `Qwen3-Embedding-8B` |
| Long context (32k+) | Voyage-3-large, Cohere embed-v4, Qwen3-Embedding-8B |
| CPU-only deployment | Nomic Embed v2 (137M params, MoE) |
| Storage-constrained | Matryoshka-truncated + int8 quantization |
| Keyword-heavy queries | Add SPLADE sparse, RRF-fuse with dense |

2026 pattern: start with BGE-M3 or text-3-large, evaluate on your domain with MTEB, swap if a domain-specific model wins by more than 3 points.

## Ship It

Save as `outputs/skill-embedding-picker.md`:

```markdown
---
name: embedding-picker
description: Pick embedding model, dimension, and retrieval mode for a given corpus and deployment.
version: 1.0.0
phase: 5
lesson: 22
tags: [nlp, embeddings, retrieval]
---

Given a corpus (size, languages, domain, avg length), deployment target (cloud / edge / on-prem), latency budget, and storage budget, output:

1. Model. Named checkpoint or API. One-sentence reason.
2. Dimension. Full / Matryoshka-truncated / int8-quantized. Reason tied to storage budget.
3. Mode. Dense / sparse / multi-vector / hybrid. Reason.
4. Query prefix / template if required by the model card.
5. Evaluation plan. MTEB tasks relevant to domain + held-out domain eval with nDCG@10.

Refuse recommendations that truncate Matryoshka to <64 dims without domain validation. Refuse ColBERTv2 for corpora under 10k passages (overhead not justified). Flag long-document corpora (>8k tokens) routed to models with 512-token windows.
```

## Exercises

1. **Easy.** Encode 100 sentences with `bge-small-en-v1.5` at full dim (384), then at Matryoshka 128. Measure MRR drop on 10 queries.
2. **Medium.** Compare BGE-M3 dense, sparse, and colbert on 500 passages from your domain. Which wins on recall@10? Does RRF fusion beat the best single mode?
3. **Hard.** Run MTEB on three candidate models across your top-2 domain tasks. Report MTEB score, p99 latency on a 100-query batch, and $/1M queries. Pick the Pareto-optimal one.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Dense embedding | The vector | One fixed-size vector per text. Cosine similarity for ranking. |
| Sparse embedding | Learned BM25 | One weight per vocab token; mostly zeros; trained end-to-end. |
| Multi-vector | ColBERT-style | One vector per token; MaxSim scoring; bigger index, better recall. |
| Matryoshka | Russian doll trick | First N dims are a valid smaller embedding on their own. |
| MTEB | The benchmark | Massive Text Embedding Benchmark — 56 tasks at launch, 100+ in v2. |
| BEIR | The retrieval benchmark | 18 zero-shot retrieval tasks; often cited for cross-domain robustness. |
| Asymmetric encoding | Query ≠ doc path | Model uses different projections for queries and documents. |

## Further Reading

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) — the bi-encoder paper.
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) — the leaderboard paper.
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) — the unified three-mode model.
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) — the dimension-ladder training objective.
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) — late interaction in production.
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) — live rankings.
