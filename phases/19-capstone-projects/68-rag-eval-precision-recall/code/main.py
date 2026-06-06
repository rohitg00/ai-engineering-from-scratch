"""RAG eval: precision, recall, MRR, nDCG, faithfulness, answer relevance.

Pure-Python. Mock LLM-as-judge so the eval runs offline.

References:
- ./docs/en.md
- Phase 19 lessons 64-67 (components measured by these metrics)
- Phase 19 lesson 69 (end-to-end system this eval grades)

Run: python3 code/main.py
"""

from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Callable


# ---------------------------------------------------------------------------
# qrels record
# ---------------------------------------------------------------------------

@dataclass
class Qrel:
    qid: str
    query: str
    gold_doc_ids: list[str]
    gold_answer_substring: str
    graded_relevance: dict[str, int] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# retrieval metrics
# ---------------------------------------------------------------------------

def precision_at_k(retrieved: list[str], gold: set[str], k: int) -> float:
    if k <= 0:
        return 0.0
    top = retrieved[:k]
    if not top:
        return 0.0
    return sum(1 for r in top if r in gold) / k


def recall_at_k(retrieved: list[str], gold: set[str], k: int) -> float:
    if not gold:
        return 0.0
    top = set(retrieved[:k])
    return len(top & gold) / len(gold)


def reciprocal_rank(retrieved: list[str], gold: set[str]) -> float:
    for i, doc_id in enumerate(retrieved):
        if doc_id in gold:
            return 1.0 / (i + 1)
    return 0.0


def mean_reciprocal_rank(retrieved_per_query: list[list[str]],
                         gold_per_query: list[set[str]]) -> float:
    if len(retrieved_per_query) != len(gold_per_query):
        raise ValueError(
            f"retrieved_per_query and gold_per_query must have the same length "
            f"({len(retrieved_per_query)} vs {len(gold_per_query)})"
        )
    if not retrieved_per_query:
        return 0.0
    return sum(reciprocal_rank(r, g) for r, g in zip(retrieved_per_query, gold_per_query)) / len(retrieved_per_query)


def dcg_at_k(retrieved: list[str], graded: dict[str, int], k: int) -> float:
    s = 0.0
    for i, doc_id in enumerate(retrieved[:k]):
        rel = graded.get(doc_id, 0)
        if rel <= 0:
            continue
        s += ((2 ** rel) - 1) / math.log2(i + 2)
    return s


def ndcg_at_k(retrieved: list[str], graded: dict[str, int], k: int) -> float:
    dcg = dcg_at_k(retrieved, graded, k)
    ideal_order = sorted(graded.items(), key=lambda x: -x[1])
    ideal = [doc_id for doc_id, _ in ideal_order]
    idcg = dcg_at_k(ideal, graded, k)
    if idcg == 0:
        return 0.0
    return dcg / idcg


# ---------------------------------------------------------------------------
# answer-grade metrics
# ---------------------------------------------------------------------------

_SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+")


def extract_claims(answer: str) -> list[str]:
    parts = _SENTENCE_BOUNDARY.split(answer.strip())
    return [p.strip() for p in parts if p.strip()]


_TOK = re.compile(r"[a-z0-9]+")


def _content_tokens(text: str) -> set[str]:
    stop = {"the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
            "of", "to", "in", "on", "at", "for", "with", "and", "or", "as", "by",
            "that", "this", "these", "those", "it", "its", "from", "we", "our", "you",
            "your", "i", "do", "does", "did", "have", "has", "had", "will", "would",
            "can", "could", "should", "may", "might", "what", "when", "where",
            "which", "who", "why", "how"}
    return {t for t in _TOK.findall(text.lower()) if t not in stop and len(t) > 1}


@dataclass
class MockJudge:
    """Deterministic stand-in for LLM-as-judge.

    Supports two queries:
    - supported(claim, context): True if the claim's content tokens overlap context
      by at least `overlap_threshold` fraction.
    - relevant(question, answer): True if the answer's content tokens overlap the
      question by at least `overlap_threshold` fraction.
    """
    overlap_threshold: float = 0.4

    def supported(self, claim: str, context: str) -> bool:
        c_tokens = _content_tokens(claim)
        if not c_tokens:
            return False
        ctx_tokens = _content_tokens(context)
        if not ctx_tokens:
            return False
        overlap = len(c_tokens & ctx_tokens) / len(c_tokens)
        return overlap >= self.overlap_threshold

    def relevant(self, question: str, answer: str) -> bool:
        q_tokens = _content_tokens(question)
        a_tokens = _content_tokens(answer)
        if not q_tokens:
            return False
        overlap = len(q_tokens & a_tokens) / len(q_tokens)
        return overlap >= self.overlap_threshold


def faithfulness(claims: list[str], context_texts: list[str], judge: MockJudge) -> float:
    if not claims:
        return 0.0
    context_blob = " ".join(context_texts)
    supported = sum(1 for c in claims if judge.supported(c, context_blob))
    return supported / len(claims)


def answer_relevance(question: str, answer: str, judge: MockJudge) -> float:
    return 1.0 if judge.relevant(question, answer) else 0.0


# ---------------------------------------------------------------------------
# fixture corpus + qrels + three pipeline variants
# ---------------------------------------------------------------------------

@dataclass
class Doc:
    doc_id: str
    title: str
    body: str

    def text(self) -> str:
        return f"{self.title}\n{self.body}"


CORPUS = [
    Doc("d1", "AbortMultipartOnFail",
        "AbortMultipartOnFail aborts an in-flight S3 multipart upload and decrements the "
        "per-bucket retry budget."),
    Doc("d2", "Uploading large files",
        "Large files are split into parts. Cancelled uploads release the reserved keys after "
        "three failed parts."),
    Doc("d3", "Abort threshold",
        "The abort threshold is configured per bucket at three failed parts. Past that "
        "threshold the upload is aborted."),
    Doc("d4", "check_permission",
        "Authorization is centralized in check_permission which evaluates a policy against "
        "principal, resource, and action."),
    Doc("d5", "Policy engine",
        "The policy engine wraps an OPA runtime and exposes evaluate; cached for a configured TTL."),
    Doc("d6", "Rank fusion",
        "Production search combines lexical and semantic retrieval through reciprocal rank "
        "fusion at k = 60."),
    Doc("d7", "Cancellation",
        "Long-running jobs accept a cancellation signal that stops the worker and releases the "
        "queue slot."),
    Doc("d8", "Index sizing",
        "Plan for one kilobyte per vector at 256 dimensions in float32 inside the in-memory ANN "
        "index."),
    Doc("d9", "Drop policy for stale records",
        "Stale records are dropped from the in-memory cache after a TTL. This is unrelated to "
        "the upload abort threshold."),
    Doc("d10", "Worker pool sizing",
        "The worker pool is sized by p95 demand. Long-running workers are recycled when the "
        "pool is overprovisioned."),
    Doc("d11", "Permission inheritance",
        "A central permission gate inherits roles from the parent group. This document does "
        "not describe the authorization implementation; see d4."),
    Doc("d12", "Combining query results",
        "Multiple query results can be combined by simple union or by intersection. Production "
        "engines prefer rank fusion; see d6."),
]


QRELS = [
    Qrel(
        qid="q1",
        query="what is the threshold before a multipart upload is dropped",
        gold_doc_ids=["d3", "d1"],
        gold_answer_substring="three failed parts",
        graded_relevance={"d3": 3, "d1": 2, "d2": 1},
    ),
    Qrel(
        qid="q2",
        query="where is the central permission gate",
        gold_doc_ids=["d4"],
        gold_answer_substring="check_permission",
        graded_relevance={"d4": 3, "d5": 2},
    ),
    Qrel(
        qid="q3",
        query="how do production search engines fuse two retrievers",
        gold_doc_ids=["d6"],
        gold_answer_substring="reciprocal rank fusion",
        graded_relevance={"d6": 3, "d8": 1},
    ),
    Qrel(
        qid="q4",
        query="how do you stop a long-running worker",
        gold_doc_ids=["d7"],
        gold_answer_substring="cancellation signal",
        graded_relevance={"d7": 3, "d2": 1},
    ),
]


# pipeline shape - retrieve top-k doc_ids + write an answer.
PipelineFn = Callable[[str, int], tuple[list[str], str]]


def _bow(text: str) -> Counter:
    return Counter(_TOK.findall(text.lower()))


def _score_doc(query: str, doc: Doc) -> float:
    q = _bow(query)
    d = _bow(doc.text())
    return sum(q[term] * d[term] for term in q)


_BASELINE_STOP = {
    "the", "a", "an", "is", "are", "of", "to", "in", "on", "at", "for",
    "with", "and", "or", "as", "by", "do", "you", "we", "our", "how", "what",
    "where", "when", "which", "before", "after", "into",
}


def _baseline_tokens(text: str) -> list[str]:
    return [t for t in _TOK.findall(text.lower()) if t not in _BASELINE_STOP]


def baseline_pipeline(query: str, k: int) -> tuple[list[str], str]:
    """Bag-of-words term overlap on content tokens only.

    Loses on every query whose phrasing diverges from the corpus's vocabulary,
    e.g. query says "dropped" but the corpus says "aborted".
    """
    q_tokens = _baseline_tokens(query)
    scored = []
    for d in CORPUS:
        d_tokens = _baseline_tokens(d.text())
        d_counter = Counter(d_tokens)
        score = sum(d_counter[t] for t in q_tokens)
        scored.append((d, score))
    scored.sort(key=lambda x: -x[1])
    top = [d for d, s in scored if s > 0][:k]
    answer = top[0].body if top else "I do not know."
    return [d.doc_id for d in top], answer


_SYN = {
    "drop":     ["abort"],
    "dropped":  ["aborted"],
    "fuse":     ["combine", "fusion"],
    "central":  ["centralized"],
    "gate":     ["check"],
    "stop":     ["cancel", "cancellation"],
    "worker":   ["job"],
    "permission": ["authorization"],
}


def hybrid_pipeline(query: str, k: int) -> tuple[list[str], str]:
    """Lexical baseline plus a synonym pass; stand-in for the lesson 65 retriever."""
    q_tokens = _baseline_tokens(query)
    expanded = list(q_tokens)
    for t in list(q_tokens):
        expanded.extend(_SYN.get(t, []))
    expanded_counter = Counter(expanded)
    scored = []
    for d in CORPUS:
        d_counter = Counter(_baseline_tokens(d.text()))
        score = sum(min(expanded_counter[t], d_counter[t]) for t in set(expanded_counter) | set(d_counter))
        # Hybrid also adds a small bonus for documents whose title contains a content word.
        title_tokens = set(_baseline_tokens(d.title))
        score += 2 * len(set(expanded) & title_tokens)
        scored.append((d, score))
    scored.sort(key=lambda x: -x[1])
    top = [d for d, s in scored if s > 0][:k]
    answer_parts = [d.body for d in top[:2]]
    return [d.doc_id for d in top], " ".join(answer_parts) if answer_parts else "I do not know."


def hybrid_plus_rerank_pipeline(query: str, k: int) -> tuple[list[str], str]:
    """Hybrid + reranker that boosts docs whose title contains query-content tokens."""
    ids, _ = hybrid_pipeline(query, k * 2)
    by_id = {d.doc_id: d for d in CORPUS}
    q_tokens = set(_baseline_tokens(query))
    for syn_list in _SYN.values():
        for s in syn_list:
            if s in {t for t in _SYN if any(s in v for v in _SYN.values())}:
                continue

    def title_boost(doc_id: str) -> int:
        title_tokens = set(_baseline_tokens(by_id[doc_id].title))
        # cross-encoder stand-in: heavy boost when query content matches title content
        expanded = set(q_tokens)
        for t in q_tokens:
            expanded.update(_SYN.get(t, []))
        return len(expanded & title_tokens) * 5

    ranked = sorted(ids, key=lambda did: -title_boost(did))
    top = ranked[:k]
    docs = [by_id[d] for d in top]
    answer_parts = [d.body for d in docs[:2]]
    answer = " ".join(answer_parts) if answer_parts else "I do not know."
    return top, answer


# ---------------------------------------------------------------------------
# evaluator
# ---------------------------------------------------------------------------

def evaluate_pipeline(
    pipeline: PipelineFn,
    qrels: list[Qrel],
    ks: tuple[int, ...] = (1, 3, 5),
    judge: MockJudge | None = None,
) -> dict[str, object]:
    judge = judge or MockJudge()
    per_q_retrieved: list[list[str]] = []
    per_q_gold: list[set[str]] = []
    per_q_graded: list[dict[str, int]] = []
    per_q_answers: list[tuple[str, str, list[str]]] = []
    metrics: dict[str, list[float]] = defaultdict(list)

    for qrel in qrels:
        retrieved, answer = pipeline(qrel.query, max(ks))
        per_q_retrieved.append(retrieved)
        per_q_gold.append(set(qrel.gold_doc_ids))
        per_q_graded.append(qrel.graded_relevance)
        per_q_answers.append((qrel.query, answer, retrieved))
        for k in ks:
            metrics[f"precision@{k}"].append(precision_at_k(retrieved, set(qrel.gold_doc_ids), k))
            metrics[f"recall@{k}"].append(recall_at_k(retrieved, set(qrel.gold_doc_ids), k))
            metrics[f"ndcg@{k}"].append(ndcg_at_k(retrieved, qrel.graded_relevance, k))

    mrr = mean_reciprocal_rank(per_q_retrieved, per_q_gold)

    by_id = {d.doc_id: d for d in CORPUS}
    faith_scores: list[float] = []
    rel_scores: list[float] = []
    for question, answer, retrieved in per_q_answers:
        context_texts = [by_id[did].text() for did in retrieved if did in by_id]
        claims = extract_claims(answer)
        faith_scores.append(faithfulness(claims, context_texts, judge))
        rel_scores.append(answer_relevance(question, answer, judge))

    return {
        "per_query_retrieved": per_q_retrieved,
        **{m: sum(v) / len(v) if v else 0.0 for m, v in metrics.items()},
        "mrr": mrr,
        "faithfulness": sum(faith_scores) / len(faith_scores) if faith_scores else 0.0,
        "answer_relevance": sum(rel_scores) / len(rel_scores) if rel_scores else 0.0,
    }


# ---------------------------------------------------------------------------
# demo
# ---------------------------------------------------------------------------

def _fmt(v: float) -> str:
    return f"{v:.3f}"


def main() -> None:
    pipelines = {
        "baseline":       baseline_pipeline,
        "hybrid":         hybrid_pipeline,
        "hybrid+rerank":  hybrid_plus_rerank_pipeline,
    }
    metrics_order = [
        "precision@1", "precision@3", "precision@5",
        "recall@1", "recall@3", "recall@5",
        "ndcg@1", "ndcg@3", "ndcg@5",
        "mrr", "faithfulness", "answer_relevance",
    ]
    rows: dict[str, dict[str, float]] = {}
    for name, fn in pipelines.items():
        result = evaluate_pipeline(fn, QRELS, ks=(1, 3, 5))
        rows[name] = result

    header = "metric          | " + " | ".join(f"{n:<14}" for n in pipelines.keys())
    print(header)
    print("-" * len(header))
    for m in metrics_order:
        cells = " | ".join(f"{_fmt(rows[name][m]):<14}" for name in pipelines.keys())
        print(f"{m:<15} | {cells}")


if __name__ == "__main__":
    main()
