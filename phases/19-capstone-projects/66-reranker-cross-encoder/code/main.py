"""Cross-encoder reranker on top of a bi-encoder retriever.

A tiny torch module shows the architectural shape. The two-stage pipeline
demonstrates the latency-vs-quality trade-off on a fixture corpus.

References:
- ./docs/en.md
- Phase 19 lesson 65 (bi-encoder hybrid retriever)
- Phase 19 lesson 68 (eval harness measuring the rerank lift)
- Phase 19 lesson 69 (end-to-end system that uses this reranker)

Run: python3 code/main.py
"""

from __future__ import annotations

import math
import re
import time
from dataclasses import dataclass, field
from typing import Callable

import numpy as np
import torch
import torch.nn as nn


VOCAB_SIZE = 8192
PAD_ID = 0
SEP_ID = 1
CLS_ID = 2
SEED = 19660101


def _set_seed(seed: int = SEED) -> None:
    torch.manual_seed(seed)
    np.random.seed(seed)


def _token_to_id(token: str) -> int:
    h = 0
    for ch in token:
        h = (h * 1315423911) ^ ord(ch)
        h &= 0xFFFFFFFF
    return 3 + (h % (VOCAB_SIZE - 3))


_WORD = re.compile(r"[a-z0-9]+")


def tokenize_pair(query: str, document: str, max_len: int = 96) -> tuple[list[int], list[int]]:
    q_tokens = [_token_to_id(t) for t in _WORD.findall(query.lower())]
    d_tokens = [_token_to_id(t) for t in _WORD.findall(document.lower())]
    ids = [CLS_ID] + q_tokens + [SEP_ID] + d_tokens + [SEP_ID]
    type_ids = ([0] * (len(q_tokens) + 2)) + ([1] * (len(d_tokens) + 1))
    if len(ids) > max_len:
        ids = ids[:max_len]
        type_ids = type_ids[:max_len]
    else:
        pad = max_len - len(ids)
        ids = ids + [PAD_ID] * pad
        type_ids = type_ids + [0] * pad
    return ids, type_ids


# ---------------------------------------------------------------------------
# the cross-encoder model
# ---------------------------------------------------------------------------

class CrossEncoder(nn.Module):
    def __init__(self, d_model: int = 64, n_heads: int = 4, ff_hidden: int = 128,
                 max_len: int = 96) -> None:
        super().__init__()
        _set_seed()
        self.token_emb = nn.Embedding(VOCAB_SIZE, d_model, padding_idx=PAD_ID)
        self.type_emb = nn.Embedding(2, d_model)
        self.pos_emb = nn.Embedding(max_len, d_model)
        self.attn = nn.MultiheadAttention(d_model, n_heads, batch_first=True)
        self.ln1 = nn.LayerNorm(d_model)
        self.ff = nn.Sequential(
            nn.Linear(d_model, ff_hidden),
            nn.GELU(),
            nn.Linear(ff_hidden, d_model),
        )
        self.ln2 = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, 1)
        self.max_len = max_len

    def forward(self, input_ids: torch.Tensor, type_ids: torch.Tensor) -> torch.Tensor:
        batch, seq = input_ids.shape
        pos = torch.arange(seq, device=input_ids.device).unsqueeze(0).expand(batch, seq)
        x = self.token_emb(input_ids) + self.type_emb(type_ids) + self.pos_emb(pos)
        mask = (input_ids == PAD_ID)
        attn_out, _ = self.attn(x, x, x, key_padding_mask=mask)
        x = self.ln1(x + attn_out)
        x = self.ln2(x + self.ff(x))
        # mean-pool over non-pad positions
        keep = (~mask).unsqueeze(-1).float()
        pooled = (x * keep).sum(dim=1) / keep.sum(dim=1).clamp(min=1.0)
        return self.head(pooled).squeeze(-1)


# ---------------------------------------------------------------------------
# training - one supervised pass with hand-labeled triples
# ---------------------------------------------------------------------------

@dataclass
class Triple:
    query: str
    document: str
    label: float  # 1.0 relevant, 0.0 irrelevant


def _batch_encode(pairs: list[Triple], max_len: int = 96) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    id_lists = []
    type_lists = []
    labels = []
    for p in pairs:
        ids, tids = tokenize_pair(p.query, p.document, max_len)
        id_lists.append(ids)
        type_lists.append(tids)
        labels.append(p.label)
    return (
        torch.tensor(id_lists, dtype=torch.long),
        torch.tensor(type_lists, dtype=torch.long),
        torch.tensor(labels, dtype=torch.float),
    )


def train_tiny(model: CrossEncoder, triples: list[Triple], epochs: int = 60, lr: float = 5e-3) -> list[float]:
    """Returns per-epoch loss."""
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.MSELoss()
    losses: list[float] = []
    ids, tids, labels = _batch_encode(triples, max_len=model.max_len)
    for _ in range(epochs):
        opt.zero_grad()
        pred = model(ids, tids)
        loss = loss_fn(pred, labels)
        loss.backward()
        opt.step()
        losses.append(loss.item())
    return losses


# ---------------------------------------------------------------------------
# reranking interface
# ---------------------------------------------------------------------------

@dataclass
class Candidate:
    doc_id: str
    text: str
    retriever_score: float = 0.0


def rerank(
    model: CrossEncoder,
    query: str,
    candidates: list[Candidate],
    top_k: int = 5,
) -> list[tuple[Candidate, float]]:
    if not candidates:
        return []
    model.eval()
    triples = [Triple(query, c.text, 0.0) for c in candidates]
    ids, tids, _ = _batch_encode(triples, max_len=model.max_len)
    with torch.no_grad():
        scores = model(ids, tids).tolist()
    out = sorted(zip(candidates, scores), key=lambda x: -x[1])
    return out[:top_k]


# ---------------------------------------------------------------------------
# bi-encoder retriever (deterministic mock embedding)
# ---------------------------------------------------------------------------

def mock_embed(text: str, dim: int = 96) -> list[float]:
    vec = [0.0] * dim
    for tok in _WORD.findall(text.lower()):
        h = 0
        for ch in tok:
            h = (h * 1315423911) ^ ord(ch)
            h &= 0xFFFFFFFF
        vec[h % dim] += 1.0
        vec[(h >> 7) % dim] += 0.5
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


@dataclass
class BiEncoder:
    docs: list[Candidate] = field(default_factory=list)
    vectors: list[list[float]] = field(default_factory=list)

    def add(self, c: Candidate) -> None:
        self.docs.append(c)
        self.vectors.append(mock_embed(c.text))

    def search(self, query: str, top_n: int) -> list[Candidate]:
        qv = mock_embed(query)
        scored = [(d, cosine(qv, v)) for d, v in zip(self.docs, self.vectors)]
        scored.sort(key=lambda x: -x[1])
        return [Candidate(d.doc_id, d.text, retriever_score=s) for d, s in scored[:top_n]]


# ---------------------------------------------------------------------------
# the full two-stage pipeline
# ---------------------------------------------------------------------------

def pipeline(
    query: str,
    retriever: BiEncoder,
    reranker: CrossEncoder,
    top_n: int = 10,
    top_k: int = 5,
) -> dict[str, object]:
    t0 = time.perf_counter()
    n_candidates = retriever.search(query, top_n)
    t1 = time.perf_counter()
    reranked = rerank(reranker, query, n_candidates, top_k)
    t2 = time.perf_counter()
    return {
        "retrieve_top_n": n_candidates,
        "reranked_top_k": reranked,
        "latency_retrieve_ms": (t1 - t0) * 1000,
        "latency_rerank_ms": (t2 - t1) * 1000,
    }


# ---------------------------------------------------------------------------
# fixture corpus and training pairs
# ---------------------------------------------------------------------------

CORPUS = [
    Candidate("d1", "AbortMultipartOnFail aborts an in-flight S3 multipart upload and "
                    "decrements the per-bucket retry budget when the upload fails."),
    Candidate("d2", "Uploading large files: the storage service splits a file into parts. "
                    "The client tracks parts. Cancelled uploads release reserved keys."),
    Candidate("d3", "Per-bucket budgets: each bucket carries a retry budget that limits "
                    "how often a failed operation can be retried within a window."),
    Candidate("d4", "check_permission: authorization is centralized in check_permission "
                    "which evaluates a policy against principal, resource, and action."),
    Candidate("d5", "Policy engine: wraps an Open Policy Agent runtime and exposes evaluate. "
                    "Cached for a configured TTL."),
    Candidate("d6", "Search ranking: production search combines lexical and semantic "
                    "retrieval through a rank fusion step."),
    Candidate("d7", "Index sizing: the vector index sits in memory; plan for 1 KB per "
                    "vector at 256 dimensions in float32."),
    Candidate("d8", "Cancelling jobs: long-running jobs accept a cancellation signal that "
                    "stops the worker and releases the queue slot."),
]


TRAIN_TRIPLES = [
    Triple("how do we abort a multipart upload", CORPUS[0].text, 1.0),
    Triple("how do we abort a multipart upload", CORPUS[1].text, 0.3),
    Triple("how do we abort a multipart upload", CORPUS[3].text, 0.0),
    Triple("retry budget per bucket configuration", CORPUS[2].text, 1.0),
    Triple("retry budget per bucket configuration", CORPUS[0].text, 0.5),
    Triple("retry budget per bucket configuration", CORPUS[4].text, 0.0),
    Triple("centralized authorization check function", CORPUS[3].text, 1.0),
    Triple("centralized authorization check function", CORPUS[4].text, 0.5),
    Triple("centralized authorization check function", CORPUS[6].text, 0.0),
    Triple("how does rank fusion work", CORPUS[5].text, 1.0),
    Triple("how does rank fusion work", CORPUS[2].text, 0.0),
    Triple("how do we cancel a job", CORPUS[7].text, 1.0),
    Triple("how do we cancel a job", CORPUS[1].text, 0.3),
    Triple("how do we cancel a job", CORPUS[0].text, 0.2),
]


# ---------------------------------------------------------------------------
# demo
# ---------------------------------------------------------------------------

def print_list(label: str, items, fmt) -> None:
    print(f"  {label}:")
    for i, item in enumerate(items[:5]):
        print(f"    {i + 1}. {fmt(item)}")


def main() -> None:
    _set_seed()
    retriever = BiEncoder()
    for c in CORPUS:
        retriever.add(c)

    reranker = CrossEncoder()
    losses = train_tiny(reranker, TRAIN_TRIPLES, epochs=60)
    print(f"trained tiny cross-encoder, loss {losses[0]:.4f} -> {losses[-1]:.4f}\n")

    queries = [
        "how do we abort a multipart upload",
        "centralized authorization check function",
        "how do we cancel a job",
    ]

    for q in queries:
        print(f"query: {q}")
        result = pipeline(q, retriever, reranker, top_n=8, top_k=3)
        print_list(
            "retrieve top-N",
            result["retrieve_top_n"],
            lambda c: f"{c.doc_id}  retriever_score={c.retriever_score:.4f}",
        )
        print_list(
            "reranked top-K",
            result["reranked_top_k"],
            lambda x: f"{x[0].doc_id}  cross_score={x[1]:.4f}",
        )
        print(f"  latency: retrieve {result['latency_retrieve_ms']:.2f}ms, "
              f"rerank {result['latency_rerank_ms']:.2f}ms\n")


if __name__ == "__main__":
    main()
