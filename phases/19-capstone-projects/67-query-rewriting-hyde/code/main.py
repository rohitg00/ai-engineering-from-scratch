"""Query rewriting strategies: HyDE, multi-query, decomposition.

Implements three rewriters on top of a shared hybrid retriever. Uses a
deterministic mock LLM so the loop runs offline.

References:
- ./docs/en.md
- Phase 19 lesson 65 (hybrid retriever consumed below)
- Phase 19 lesson 66 (reranker on the rewriter's output in production)
- Phase 19 lesson 69 (end-to-end pipeline composing rewriter + retriever + reranker)

Run: python3 code/main.py
"""

from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Iterable


# ---------------------------------------------------------------------------
# tokenizer + deterministic embedding (mirrors lesson 65 for compatibility)
# ---------------------------------------------------------------------------

_TOKEN = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


def mock_embed(text: str, dim: int = 96) -> list[float]:
    vec = [0.0] * dim
    for tok in tokenize(text):
        h = 0
        for ch in tok:
            h = (h * 1315423911) ^ ord(ch)
            h &= 0xFFFFFFFF
        vec[h % dim] += 1.0
        vec[(h >> 7) % dim] += 0.5
        for i in range(len(tok) - 1):
            bg = (ord(tok[i]) * 31 + ord(tok[i + 1])) & 0xFFFFFFFF
            vec[bg % dim] += 0.25
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


# ---------------------------------------------------------------------------
# retrieval shape - hybrid BM25 + dense, simplified from lesson 65
# ---------------------------------------------------------------------------

@dataclass
class Doc:
    doc_id: str
    title: str
    body: str

    def field_text(self) -> str:
        return f"{self.title}\n{self.body}"


@dataclass
class BM25Index:
    k1: float = 1.5
    b: float = 0.75
    docs: list[Doc] = field(default_factory=list)
    doc_lens: list[int] = field(default_factory=list)
    df: Counter = field(default_factory=Counter)
    tf: list[Counter] = field(default_factory=list)
    avgdl: float = 0.0

    def add(self, doc: Doc) -> None:
        toks = tokenize(doc.title) * 3 + tokenize(doc.body)
        counts = Counter(toks)
        self.docs.append(doc)
        self.doc_lens.append(len(toks))
        self.tf.append(counts)
        for term in counts:
            self.df[term] += 1
        self.avgdl = sum(self.doc_lens) / max(1, len(self.doc_lens))

    def search(self, query: str, k: int) -> list[tuple[Doc, float]]:
        q_terms = tokenize(query)
        n = len(self.docs)
        if n == 0:
            return []
        scores: list[float] = [0.0] * n
        for term in q_terms:
            df = self.df.get(term, 0)
            if df == 0:
                continue
            idf = math.log((n - df + 0.5) / (df + 0.5) + 1.0)
            for i, counts in enumerate(self.tf):
                f = counts.get(term, 0)
                if f == 0:
                    continue
                dl = self.doc_lens[i]
                denom = f + self.k1 * (1 - self.b + self.b * dl / (self.avgdl or 1))
                scores[i] += idf * f * (self.k1 + 1) / denom
        return sorted(zip(self.docs, scores), key=lambda x: -x[1])[:k]


@dataclass
class DenseIndex:
    vectors: list[tuple[Doc, list[float]]] = field(default_factory=list)

    def add(self, doc: Doc) -> None:
        self.vectors.append((doc, mock_embed(doc.field_text())))

    def search_vec(self, qv: list[float], k: int) -> list[tuple[Doc, float]]:
        scored = [(d, cosine(qv, v)) for d, v in self.vectors]
        scored.sort(key=lambda x: -x[1])
        return scored[:k]

    def search(self, query: str, k: int) -> list[tuple[Doc, float]]:
        return self.search_vec(mock_embed(query), k)


def rrf(rankings: list[list[tuple[Doc, float]]], k: int = 60) -> list[tuple[Doc, float]]:
    score: dict[str, float] = defaultdict(float)
    by_id: dict[str, Doc] = {}
    for ranks in rankings:
        for rank, (doc, _) in enumerate(ranks):
            score[doc.doc_id] += 1.0 / (k + rank + 1)
            by_id[doc.doc_id] = doc
    fused = sorted(score.items(), key=lambda x: -x[1])
    return [(by_id[did], s) for did, s in fused]


@dataclass
class HybridRetriever:
    bm25: BM25Index = field(default_factory=BM25Index)
    dense: DenseIndex = field(default_factory=DenseIndex)

    def add(self, doc: Doc) -> None:
        self.bm25.add(doc)
        self.dense.add(doc)

    def search(self, query: str, k_each: int = 5, k_out: int = 5) -> list[tuple[Doc, float]]:
        b = self.bm25.search(query, k_each)
        d = self.dense.search(query, k_each)
        return rrf([b, d])[:k_out]

    def search_vec(self, qv: list[float], qtext: str, k_each: int = 5,
                   k_out: int = 5) -> list[tuple[Doc, float]]:
        # When given a precomputed dense vector (HyDE case), still run BM25 on the
        # original query text so the lexical signal does not vanish.
        b = self.bm25.search(qtext, k_each)
        d = self.dense.search_vec(qv, k_each)
        return rrf([b, d])[:k_out]


# ---------------------------------------------------------------------------
# mock LLM - deterministic, offline
# ---------------------------------------------------------------------------

_SYNONYMS = {
    "abort":   ["cancel", "stop", "terminate"],
    "cancel":  ["abort", "stop"],
    "upload":  ["transfer", "ingest"],
    "fail":    ["error", "failure"],
    "budget":  ["quota", "limit"],
    "retry":   ["attempt", "resend"],
    "permission": ["authorization", "authz"],
    "service": ["worker"],
    "policy":  ["rule"],
    "rank":    ["score", "ordering"],
    "fusion":  ["merge", "combine"],
}


HYDE_TABLE: dict[str, str] = {
    "what do we do when a transfer breaks halfway":
        "AbortMultipartOnFail terminates an S3 multipart transfer and decrements the per-bucket "
        "retry quota when the transfer fails. The bucket then enters a cooldown window.",
    "how is access control handled across user types":
        "Authorization is centralized in check_permission which evaluates a policy against "
        "principal, resource, and action. The same function applies to user accounts and to "
        "service accounts equally.",
    "how does the search service merge two retrievers":
        "The search service merges lexical and semantic retrievers through reciprocal rank "
        "fusion. Rank fusion is the production technique for combining two ranked lists; the "
        "fusion operates on ranks, not on scores, so calibration is not required.",
}


MQ_TABLE: dict[str, list[str]] = {
    "what do we do when a transfer breaks halfway": [
        "how do multipart uploads behave on failure",
        "what action does the storage service take when a multipart upload fails",
        "how is an in-flight multipart upload aborted on persistent failure",
    ],
    "how is access control handled across user types": [
        "how does the system perform authorization checks",
        "where is the central permission check implemented",
        "how are service accounts authorized for storage operations",
    ],
    "how does the search service merge two retrievers": [
        "how is lexical and semantic retrieval combined",
        "what algorithm fuses BM25 and dense rankings",
        "how does rank fusion work in production search",
    ],
}


DECOMP_TABLE: dict[str, list[str]] = {
    "what happens when an upload fails and the retry budget is exhausted": [
        "how is an in-flight multipart upload aborted",
        "what happens when the retry quota reaches zero",
    ],
    "how is authorization handled and how do policies get evaluated": [
        "how is authorization performed",
        "how are policies evaluated",
    ],
}


@dataclass
class MockLLM:
    def generate_hypothetical(self, query: str) -> str:
        key = query.lower().strip().rstrip("?").strip()
        if key in HYDE_TABLE:
            return HYDE_TABLE[key]
        # fallback: synonym-expanded restatement
        toks = tokenize(query)
        expanded = []
        for t in toks:
            expanded.append(t)
            expanded.extend(_SYNONYMS.get(t, []))
        return " ".join(expanded)

    def paraphrase(self, query: str, n: int = 3) -> list[str]:
        key = query.lower().strip().rstrip("?").strip()
        if key in MQ_TABLE:
            return MQ_TABLE[key][:n]
        # fallback: cyclic synonym swaps
        toks = tokenize(query)
        out: list[str] = []
        for shift in range(n):
            swapped = []
            for i, t in enumerate(toks):
                opts = _SYNONYMS.get(t, [])
                if opts and (i + shift) % 2 == 0:
                    swapped.append(opts[shift % len(opts)])
                else:
                    swapped.append(t)
            out.append(" ".join(swapped))
        return out

    def decompose(self, query: str) -> list[str]:
        key = query.lower().strip().rstrip("?").strip()
        if key in DECOMP_TABLE:
            return DECOMP_TABLE[key]
        # fallback: split on " and "
        if " and " in query.lower():
            parts = re.split(r"\s+and\s+", query, flags=re.IGNORECASE)
            return [p.strip().rstrip("?") for p in parts if p.strip()]
        return [query]


# ---------------------------------------------------------------------------
# rewriter interface
# ---------------------------------------------------------------------------

@dataclass
class RewriteResult:
    strategy: str
    rewrites: list[str]
    hypothetical: str | None = None


class Rewriter:
    name: str

    def rewrite(self, query: str) -> RewriteResult:
        raise NotImplementedError


@dataclass
class HyDERewriter(Rewriter):
    llm: MockLLM = field(default_factory=MockLLM)
    name: str = "hyde"

    def rewrite(self, query: str) -> RewriteResult:
        h = self.llm.generate_hypothetical(query)
        return RewriteResult(strategy=self.name, rewrites=[query], hypothetical=h)


@dataclass
class MultiQueryRewriter(Rewriter):
    llm: MockLLM = field(default_factory=MockLLM)
    n: int = 3
    name: str = "multiquery"

    def rewrite(self, query: str) -> RewriteResult:
        rewrites = [query] + self.llm.paraphrase(query, n=self.n)
        return RewriteResult(strategy=self.name, rewrites=rewrites)


@dataclass
class DecomposeRewriter(Rewriter):
    llm: MockLLM = field(default_factory=MockLLM)
    name: str = "decompose"

    def rewrite(self, query: str) -> RewriteResult:
        subs = self.llm.decompose(query)
        return RewriteResult(strategy=self.name, rewrites=subs)


# ---------------------------------------------------------------------------
# retrieve through a rewriter
# ---------------------------------------------------------------------------

def retrieve_with_rewriter(
    query: str,
    rewriter: Rewriter,
    retriever: HybridRetriever,
    k_each: int = 5,
    k_out: int = 5,
) -> dict[str, object]:
    rw = rewriter.rewrite(query)
    rankings: list[list[tuple[Doc, float]]] = []
    if rw.hypothetical is not None:
        hv = mock_embed(rw.hypothetical)
        rankings.append(retriever.search_vec(hv, qtext=query, k_each=k_each, k_out=k_each))
    for r in rw.rewrites:
        rankings.append(retriever.search(r, k_each=k_each, k_out=k_each))
    fused = rrf(rankings)[:k_out]
    return {
        "rewriter": rwriter_name(rw),
        "rewrites": rw.rewrites,
        "hypothetical": rw.hypothetical,
        "results": fused,
    }


def rwriter_name(rw: RewriteResult) -> str:
    return rw.strategy


# ---------------------------------------------------------------------------
# fixture corpus + gold answers
# ---------------------------------------------------------------------------

CORPUS = [
    Doc("d1", "AbortMultipartOnFail",
        "AbortMultipartOnFail terminates an S3 multipart transfer and decrements the per-bucket "
        "retry quota on persistent failure."),
    Doc("d2", "Transfer manager",
        "The transfer manager breaks a file into parts and tracks each part. Aborted transfers "
        "release the reserved key."),
    Doc("d3", "Quota cooldown",
        "Each storage bucket carries a retry quota. When the quota reaches zero the bucket "
        "enters a cooldown window and rejects further attempts."),
    Doc("d4", "check_permission",
        "Authorization is centralized in check_permission which evaluates a policy against "
        "principal, resource, and action. Equally applied to user and service accounts."),
    Doc("d5", "Policy engine",
        "The policy engine wraps an OPA runtime and exposes evaluate. Cached for a configured TTL."),
    Doc("d6", "Rank fusion",
        "Production search engines combine lexical and semantic retrieval through reciprocal "
        "rank fusion. The fusion operates on ranks, not scores."),
    Doc("d7", "Index sizing",
        "The vector index sits in memory. Plan for 1 KB per vector at 256 dimensions."),
    Doc("d8", "Cancelling jobs",
        "Long-running jobs accept a cancellation signal that stops the worker and releases the queue slot."),
]


# Each query is designed so a specific rewriter strategy excels on it.
# - HyDE: phrasing mismatch where the hypothetical passage matches the corpus.
# - MultiQuery: vague phrasing where one of N paraphrases lands on corpus terms.
# - Decompose: multi-clause question covering two distinct documents.
GOLD = [
    ("what do we do when a transfer breaks halfway", "d1", "multiquery"),
    ("how does the search service merge two retrievers", "d6", "hyde"),
    ("what happens when an upload fails and the retry budget is exhausted", "d1", "decompose"),
]


def build_retriever() -> HybridRetriever:
    r = HybridRetriever()
    for d in CORPUS:
        r.add(d)
    return r


# ---------------------------------------------------------------------------
# demo
# ---------------------------------------------------------------------------

def main() -> None:
    retriever = build_retriever()
    llm = MockLLM()

    strategies: dict[str, Rewriter] = {
        "no-rewrite": _IdentityRewriter(),
        "hyde":       HyDERewriter(llm=llm),
        "multiquery": MultiQueryRewriter(llm=llm, n=3),
        "decompose":  DecomposeRewriter(llm=llm),
    }

    print(f"{'strategy':<12} | {'query':<60} | gold@1? | gold-rank")
    print("-" * 100)
    for q, gold, expected_winner in GOLD:
        for name, rw in strategies.items():
            out = retrieve_with_rewriter(q, rw, retriever, k_each=8, k_out=8)
            ranks = [d.doc_id for d, _ in out["results"]]
            hit = "yes" if ranks and ranks[0] == gold else "no "
            gold_rank = ranks.index(gold) + 1 if gold in ranks else -1
            marker = "  <- expected winner" if name == expected_winner else ""
            print(f"{name:<12} | {q[:58]:<60} |  {hit}   |   {gold_rank}{marker}")
        print()


class _IdentityRewriter(Rewriter):
    name = "no-rewrite"

    def rewrite(self, query: str) -> RewriteResult:
        return RewriteResult(strategy=self.name, rewrites=[query])


if __name__ == "__main__":
    main()
