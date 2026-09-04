"""Code RAG — AST-aware chunking + hybrid retrieval scaffold.

The hard architectural primitive here is hybrid retrieval with rank fusion:
two index structures (dense vector, BM25) run in parallel, results are merged
with reciprocal rank fusion, then a re-ranker picks the final top-k. This
scaffold implements both halves with stdlib: a naive dense index (hash-based
fake embeddings so the loop runs deterministically offline) and a real BM25
from scratch. The fusion + rerank logic is the part that matters.

Run:  python main.py
"""

from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# chunk shape  --  AST-aware function-level chunks
# ---------------------------------------------------------------------------

@dataclass
class Chunk:
    repo: str
    path: str
    start_line: int
    end_line: int
    symbol: str
    body: str
    summary: str = ""

    def anchor(self) -> str:
        return f"{self.repo}/{self.path}:{self.start_line}-{self.end_line}"


SAMPLE_CORPUS = [
    Chunk("uploader", "services/retry.go", 122, 148, "AbortMultipartOnFail",
          "if ctx.Err() != nil { return abort() }; decrement bucket budget; retry with backoff",
          "aborts an in-flight S3 multipart upload and decrements the per-bucket retry budget"),
    Chunk("uploader", "config/budgets.yaml", 34, 51, "bucket_budget",
          "per_bucket_budget: 64; backoff_ms: [100, 500, 2500]; abort_threshold: 3",
          "declares the retry budget and exponential backoff schedule per S3 bucket"),
    Chunk("client", "libs/s3client/multipart.ts", 44, 61, "abortUpload",
          "await s3.abortMultipartUpload({Bucket, Key, UploadId}); metrics.inc('s3.abort')",
          "client-side S3 multipart abort with metrics instrumentation"),
    Chunk("auth", "services/authz/check.py", 12, 38, "check_permission",
          "def check_permission(user, resource, action): return policy.evaluate(user, resource, action)",
          "central authorization gateway evaluating an OPA policy for user-resource-action"),
    Chunk("auth", "libs/policy/opa.py", 88, 110, "evaluate",
          "def evaluate(user, resource, action): return self.engine.query('authz', input=...)",
          "OPA policy engine query wrapper for authorization checks"),
    Chunk("catalog", "services/search/query.rs", 200, 240, "rank_fusion",
          "pub fn rank_fusion(dense: Vec<Hit>, sparse: Vec<Hit>) -> Vec<Hit>",
          "reciprocal rank fusion of dense and sparse retrieval results"),
]


# ---------------------------------------------------------------------------
# naive dense index  --  deterministic fake embeddings for scaffold testing
# ---------------------------------------------------------------------------

def fake_embed(text: str, dim: int = 64) -> list[float]:
    """Hash-based deterministic embedding; stands in for Voyage-code-3."""
    vec = [0.0] * dim
    for tok in re.findall(r"\w+", text.lower()):
        h = hash(tok)
        vec[h % dim] += 1.0
        vec[(h >> 8) % dim] += 0.5
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


@dataclass
class DenseIndex:
    vectors: list[tuple[Chunk, list[float]]] = field(default_factory=list)

    def add(self, chunk: Chunk) -> None:
        text = f"{chunk.symbol}\n{chunk.summary}\n{chunk.body}"
        self.vectors.append((chunk, fake_embed(text)))

    def search(self, query: str, k: int = 10) -> list[tuple[Chunk, float]]:
        qv = fake_embed(query)
        scored = [(c, cosine(qv, v)) for c, v in self.vectors]
        scored.sort(key=lambda x: -x[1])
        return scored[:k]


# ---------------------------------------------------------------------------
# BM25 from scratch  --  the real algorithm, documents are Chunks
# ---------------------------------------------------------------------------

def tokenize(text: str) -> list[str]:
    return re.findall(r"\w+", text.lower())


@dataclass
class BM25Index:
    k1: float = 1.5
    b: float = 0.75
    docs: list[Chunk] = field(default_factory=list)
    doc_lens: list[int] = field(default_factory=list)
    df: Counter = field(default_factory=Counter)
    tf: list[Counter] = field(default_factory=list)
    avgdl: float = 0.0

    def add(self, chunk: Chunk) -> None:
        # field-weighted: symbol x4, summary x2, body x1
        tokens = (tokenize(chunk.symbol) * 4 +
                  tokenize(chunk.summary) * 2 +
                  tokenize(chunk.body))
        counts = Counter(tokens)
        self.docs.append(chunk)
        self.doc_lens.append(len(tokens))
        self.tf.append(counts)
        for term in counts:
            self.df[term] += 1
        self.avgdl = sum(self.doc_lens) / len(self.doc_lens)

    def search(self, query: str, k: int = 10) -> list[tuple[Chunk, float]]:
        q_terms = tokenize(query)
        n = len(self.docs)
        scores: list[float] = [0.0] * n
        for term in q_terms:
            if term not in self.df:
                continue
            idf = math.log((n - self.df[term] + 0.5) / (self.df[term] + 0.5) + 1.0)
            for i, counts in enumerate(self.tf):
                if term not in counts:
                    continue
                f = counts[term]
                dl = self.doc_lens[i]
                denom = f + self.k1 * (1 - self.b + self.b * dl / self.avgdl)
                scores[i] += idf * f * (self.k1 + 1) / denom
        ranked = sorted(zip(self.docs, scores), key=lambda x: -x[1])
        return [(c, s) for c, s in ranked[:k] if s > 0]


# ---------------------------------------------------------------------------
# reciprocal rank fusion  --  the merge step of hybrid retrieval
# ---------------------------------------------------------------------------

def rrf(dense: list[tuple[Chunk, float]], sparse: list[tuple[Chunk, float]],
        k_rrf: int = 60) -> list[tuple[Chunk, float]]:
    score: dict[str, float] = defaultdict(float)
    by_anchor: dict[str, Chunk] = {}
    for rank, (c, _) in enumerate(dense):
        score[c.anchor()] += 1.0 / (k_rrf + rank + 1)
        by_anchor[c.anchor()] = c
    for rank, (c, _) in enumerate(sparse):
        score[c.anchor()] += 1.0 / (k_rrf + rank + 1)
        by_anchor[c.anchor()] = c
    fused = sorted(score.items(), key=lambda x: -x[1])
    return [(by_anchor[a], s) for a, s in fused]


# ---------------------------------------------------------------------------
# stub reranker  --  cross-encoder stand-in; rerank by query-symbol overlap
# ---------------------------------------------------------------------------

def rerank(query: str, candidates: list[tuple[Chunk, float]],
           top_k: int = 5) -> list[tuple[Chunk, float]]:
    q_toks = set(tokenize(query))
    out: list[tuple[Chunk, float]] = []
    for c, prior in candidates:
        symbol_overlap = len(q_toks & set(tokenize(c.symbol))) * 3
        summary_overlap = len(q_toks & set(tokenize(c.summary)))
        out.append((c, prior + 0.3 * symbol_overlap + 0.1 * summary_overlap))
    out.sort(key=lambda x: -x[1])
    return out[:top_k]


# ---------------------------------------------------------------------------
# orchestrator  --  the full retrieve -> fuse -> rerank flow
# ---------------------------------------------------------------------------

def answer(query: str, dense: DenseIndex, bm25: BM25Index) -> dict[str, object]:
    dense_hits = dense.search(query, k=10)
    sparse_hits = bm25.search(query, k=10)
    fused = rrf(dense_hits, sparse_hits)
    top = rerank(query, fused, top_k=5)
    citations = [c.anchor() for c, _ in top]
    return {
        "query": query,
        "dense_top": [c.anchor() for c, _ in dense_hits[:3]],
        "sparse_top": [c.anchor() for c, _ in sparse_hits[:3]],
        "fused_top": [c.anchor() for c, _ in fused[:5]],
        "rerank_top": citations,
    }


def main() -> None:
    dense = DenseIndex()
    bm25 = BM25Index()
    for ch in SAMPLE_CORPUS:
        dense.add(ch)
        bm25.add(ch)

    for q in ("how is S3 multipart abort wired into retry budget",
              "where is authorization centralized",
              "how does rank fusion work"):
        result = answer(q, dense, bm25)
        print(f"Q: {result['query']}")
        print(f"  dense  : {result['dense_top']}")
        print(f"  sparse : {result['sparse_top']}")
        print(f"  fused  : {result['fused_top']}")
        print(f"  rerank : {result['rerank_top']}")
        print()


if __name__ == "__main__":
    main()
