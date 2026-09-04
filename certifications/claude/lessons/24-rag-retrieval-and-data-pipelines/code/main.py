"""Retrieval incident lab for docs/en.md in this lesson.

Implements chunking, a compact BM25-style index, provenance, and retrieval evals.
Uses only the Python standard library so every ranking decision stays visible.
The production comparison is described in the lesson documentation.
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from dataclasses import asdict, dataclass


TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    return TOKEN_RE.findall(text.lower())


@dataclass(frozen=True)
class Document:
    document_id: str
    text: str
    updated_at: str
    active: bool = True


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    document_id: str
    text: str
    updated_at: str
    position: int


@dataclass(frozen=True)
class RetrievalHit:
    chunk_id: str
    document_id: str
    text: str
    updated_at: str
    score: float


def chunk_document(document: Document, max_words: int = 80, overlap_words: int = 12) -> list[Chunk]:
    if max_words <= 0:
        raise ValueError("max_words must be positive")
    if overlap_words < 0 or overlap_words >= max_words:
        raise ValueError("overlap_words must be between zero and max_words - 1")
    words = document.text.split()
    if not words:
        return []
    step = max_words - overlap_words
    chunks = []
    for position, start in enumerate(range(0, len(words), step)):
        selected = words[start : start + max_words]
        if not selected:
            break
        chunks.append(
            Chunk(
                chunk_id=f"{document.document_id}:{position}",
                document_id=document.document_id,
                text=" ".join(selected),
                updated_at=document.updated_at,
                position=position,
            )
        )
        if start + max_words >= len(words):
            break
    return chunks


class RetrievalIndex:
    def __init__(self, chunks: list[Chunk]) -> None:
        self.chunks = chunks
        self.term_frequencies = [Counter(tokenize(chunk.text)) for chunk in chunks]
        self.lengths = [sum(frequencies.values()) for frequencies in self.term_frequencies]
        self.average_length = sum(self.lengths) / len(self.lengths) if self.lengths else 0.0
        self.document_frequency = Counter()
        for frequencies in self.term_frequencies:
            self.document_frequency.update(frequencies.keys())

    @classmethod
    def build(cls, documents: list[Document], max_words: int = 80, overlap_words: int = 12) -> "RetrievalIndex":
        chunks = []
        for document in documents:
            if document.active:
                chunks.extend(chunk_document(document, max_words, overlap_words))
        return cls(chunks)

    def _inverse_document_frequency(self, term: str) -> float:
        total = len(self.chunks)
        containing = self.document_frequency.get(term, 0)
        if total == 0 or containing == 0:
            return 0.0
        return math.log(1.0 + (total - containing + 0.5) / (containing + 0.5))

    def _score(self, query_terms: list[str], index: int, k1: float = 1.5, b: float = 0.75) -> float:
        frequencies = self.term_frequencies[index]
        length = self.lengths[index]
        normalization = 1.0 - b + b * (length / self.average_length) if self.average_length else 1.0
        score = 0.0
        for term in query_terms:
            frequency = frequencies.get(term, 0)
            if frequency == 0:
                continue
            numerator = frequency * (k1 + 1.0)
            denominator = frequency + k1 * normalization
            score += self._inverse_document_frequency(term) * numerator / denominator
        return score

    def search(self, query: str, top_k: int = 3) -> list[RetrievalHit]:
        if top_k <= 0:
            raise ValueError("top_k must be positive")
        query_terms = tokenize(query)
        if not query_terms:
            return []
        scored = []
        for index, chunk in enumerate(self.chunks):
            score = self._score(query_terms, index)
            if score > 0:
                scored.append((score, chunk))
        scored.sort(key=lambda item: (-item[0], item[1].chunk_id))
        return [
            RetrievalHit(
                chunk_id=chunk.chunk_id,
                document_id=chunk.document_id,
                text=chunk.text,
                updated_at=chunk.updated_at,
                score=round(score, 6),
            )
            for score, chunk in scored[:top_k]
        ]


@dataclass(frozen=True)
class RetrievalCase:
    query: str
    relevant_document_ids: tuple[str, ...]


def evaluate_retrieval(index: RetrievalIndex, cases: list[RetrievalCase], top_k: int = 3) -> dict[str, float]:
    if not cases:
        return {"recall_at_k": 0.0, "mean_reciprocal_rank": 0.0}
    recall_total = 0.0
    reciprocal_rank_total = 0.0
    for case in cases:
        hits = index.search(case.query, top_k)
        retrieved = [hit.document_id for hit in hits]
        relevant = set(case.relevant_document_ids)
        recall_total += len(relevant.intersection(retrieved)) / len(relevant) if relevant else 1.0
        first_rank = next((rank for rank, document_id in enumerate(retrieved, start=1) if document_id in relevant), None)
        reciprocal_rank_total += 1.0 / first_rank if first_rank else 0.0
    return {
        "recall_at_k": round(recall_total / len(cases), 4),
        "mean_reciprocal_rank": round(reciprocal_rank_total / len(cases), 4),
    }


def demo() -> dict[str, object]:
    documents = [
        Document("refund-v3", "Refunds above 500 dollars require finance approval before execution.", "2026-08-01"),
        Document("shipping-v2", "Express shipping refunds are allowed after seven business days without delivery.", "2026-07-15"),
        Document("refund-v2", "Refunds above 250 dollars require manager approval.", "2025-12-01", active=False),
    ]
    index = RetrievalIndex.build(documents, max_words=20, overlap_words=4)
    hits = index.search("Who approves a refund above 500 dollars?", top_k=2)
    metrics = evaluate_retrieval(
        index,
        [
            RetrievalCase("approval for a large refund", ("refund-v3",)),
            RetrievalCase("late express delivery", ("shipping-v2",)),
        ],
        top_k=2,
    )
    return {"hits": [asdict(hit) for hit in hits], "metrics": metrics}


if __name__ == "__main__":
    print(json.dumps(demo(), indent=2))

