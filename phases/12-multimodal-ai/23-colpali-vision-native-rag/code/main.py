"""ColPali toy: patch encoder + MaxSim retrieval — stdlib.

Five mock "pages" of patch embeddings, three text queries with token embeddings,
MaxSim scoring with top-k retrieval. Prints ranked pages + interpretation.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

random.seed(7)


@dataclass
class Page:
    doc_id: str
    patches: list[list[float]]


@dataclass
class Query:
    text: str
    tokens: list[list[float]]


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) + 1e-8
    nb = math.sqrt(sum(y * y for y in b)) + 1e-8
    return dot / (na * nb)


def maxsim(query_tokens: list[list[float]],
           patches: list[list[float]]) -> float:
    """ColBERT MaxSim: sum over query tokens of max over patches."""
    s = 0.0
    for q in query_tokens:
        best = max(cosine(q, p) for p in patches)
        s += best
    return s


def random_emb(dim: int, bias: int = 0) -> list[float]:
    return [random.gauss(bias / 10.0, 1.0) for _ in range(dim)]


def build_pages(n_pages: int = 5, n_patches: int = 16, dim: int = 32) -> list[Page]:
    pages = []
    topics = ["finance", "science", "legal", "medical", "engineering"]
    for i, topic in enumerate(topics[:n_pages]):
        bias = i + 1
        patches = [random_emb(dim, bias) for _ in range(n_patches)]
        pages.append(Page(doc_id=f"page_{i}_{topic}", patches=patches))
    return pages


def build_queries(dim: int = 32) -> list[Query]:
    random.seed(100)
    queries = []
    for text, bias in [("Q3 revenue growth", 1),
                       ("proof of lemma 3", 2),
                       ("patient diagnosis", 4)]:
        tokens = [random_emb(dim, bias) for _ in range(4)]
        queries.append(Query(text=text, tokens=tokens))
    return queries


def retrieve(query: Query, pages: list[Page], k: int = 3) -> list[tuple[str, float]]:
    scored = [(p.doc_id, maxsim(query.tokens, p.patches)) for p in pages]
    scored.sort(key=lambda x: -x[1])
    return scored[:k]


def storage_estimate() -> None:
    print("\nSTORAGE — COLPALI vs TEXT-RAG")
    print("-" * 60)
    print(f"  {'system':<24}{'bytes/page':<14}  note")
    print(f"  {'text-RAG 768d bi-enc':<24}{'3.0 KB':<14}  one vector per chunk")
    print(f"  {'ColPali raw (729 x 128)':<24}{'365 KB':<14}  one vec per patch")
    print(f"  {'ColPali PQ 8x':<24}{'46 KB':<14}  OPQ compression")
    print(f"  {'VisRAG bi-enc':<24}{'3.0 KB':<14}  single vec per page")


def compare_maxsim_vs_mean() -> None:
    print("\nMAXSIM vs MEAN SIMILARITY")
    print("-" * 60)
    random.seed(42)
    q_tokens = [[1.0, 0.1, 0.0], [0.0, 1.0, 0.1]]
    strong_patch = [0.9, 0.9, 0.0]
    other_patches = [[0.1, 0.1, 0.1], [0.2, 0.2, 0.2], [0.0, 0.0, 0.0]]
    patches = [strong_patch] + other_patches
    max_score = maxsim(q_tokens, patches)
    mean_score = sum(cosine(q, p) for q in q_tokens for p in patches) / (
        len(q_tokens) * len(patches))
    print(f"  MaxSim : {max_score:.3f}   (captures best matches per query token)")
    print(f"  Mean   : {mean_score:.3f}   (washed out by irrelevant patches)")
    print("  MaxSim's selectivity is why late interaction beats bi-encoder recall")


def main() -> None:
    print("=" * 60)
    print("COLPALI VISION-NATIVE RAG (Phase 12, Lesson 23)")
    print("=" * 60)

    pages = build_pages(n_pages=5, n_patches=16, dim=32)
    queries = build_queries(dim=32)

    print("\nINDEX + RETRIEVE")
    print("-" * 60)
    for q in queries:
        hits = retrieve(q, pages, k=3)
        print(f"  query: '{q.text}'")
        for page_id, score in hits:
            print(f"    {page_id:<22}  score={score:+.3f}")
        print()

    compare_maxsim_vs_mean()
    storage_estimate()

    print("\nEND-TO-END PIPELINE")
    print("-" * 60)
    print("  ingest : PDF -> page PNG -> PaliGemma -> patch vectors (cached)")
    print("  query  : user text -> tokens -> MaxSim -> top-k pages")
    print("  gen    : top-k page images + query -> Qwen2.5-VL -> answer")
    print("  no OCR, no chunking, no layout loss")


if __name__ == "__main__":
    main()
