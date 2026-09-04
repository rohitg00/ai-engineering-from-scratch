"""Multimodal document QA — ColPali-style late interaction scaffold.

The hard architectural primitive is late-interaction retrieval: every query
token scores against every document patch, the MaxSim per query token is
summed, the top-k pages are returned. This scaffold implements MaxSim end to
end on synthetic patch embeddings so the algorithm is observable without
loading a real ColQwen model. Includes DocPruner-style patch pruning.

Run:  python main.py
"""

from __future__ import annotations

import math
import random
import re
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# patch embeddings  --  fake 16-dim patch vectors per page
# ---------------------------------------------------------------------------

EMB_DIM = 16


def tokenize(text: str) -> list[str]:
    return re.findall(r"\w+", text.lower())


def hash_embed(tok: str) -> list[float]:
    rnd = random.Random(hash(tok) & 0xFFFFFFFF)
    v = [rnd.gauss(0, 1) for _ in range(EMB_DIM)]
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


@dataclass
class Page:
    doc_id: str
    page_num: int
    content_tokens: list[str]          # stand-in for page contents
    patches: list[list[float]] = field(default_factory=list)

    def embed_patches(self) -> None:
        """Multi-vector: each content token becomes a patch vector."""
        self.patches = [hash_embed(t) for t in self.content_tokens]


# ---------------------------------------------------------------------------
# DocPruner  --  keep top-fraction patches by norm variance
# ---------------------------------------------------------------------------

def doc_prune(patches: list[list[float]], keep_fraction: float = 0.5) -> list[list[float]]:
    """Keep patches with highest per-patch norm (poor proxy for info density
    but matches the DocPruner intuition: drop low-signal patches)."""
    scored = [(sum(abs(x) for x in p), p) for p in patches]
    scored.sort(key=lambda x: -x[0])
    keep_n = max(1, int(len(scored) * keep_fraction))
    return [p for _, p in scored[:keep_n]]


# ---------------------------------------------------------------------------
# MaxSim late interaction  --  the algorithmic core of ColPali / ColQwen
# ---------------------------------------------------------------------------

def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def max_sim_score(query_tokens: list[list[float]],
                  doc_patches: list[list[float]]) -> float:
    """For every query token embedding, take max dot product against any
    doc patch; sum across query tokens. This is MaxSim / late interaction."""
    total = 0.0
    for q in query_tokens:
        best = -1e9
        for p in doc_patches:
            s = dot(q, p)
            if s > best:
                best = s
        total += best
    return total


# ---------------------------------------------------------------------------
# index + retrieval  --  ranked top-k by MaxSim
# ---------------------------------------------------------------------------

@dataclass
class Index:
    pages: list[Page] = field(default_factory=list)

    def add(self, p: Page) -> None:
        self.pages.append(p)

    def retrieve(self, query: str, k: int = 5) -> list[tuple[Page, float]]:
        q_tokens = [hash_embed(t) for t in tokenize(query)]
        scored = [(pg, max_sim_score(q_tokens, pg.patches)) for pg in self.pages]
        scored.sort(key=lambda x: -x[1])
        return scored[:k]


# ---------------------------------------------------------------------------
# synthetic corpus  --  ten pages spanning tables, charts, handwriting, text
# ---------------------------------------------------------------------------

CORPUS = [
    ("10k-2024", 88, "segment EMEA operating margin 18.2 to 16.8 decline 140bp table four"),
    ("10k-2024", 92, "MDA operating performance EMEA macro headwinds FX impact narrative"),
    ("10k-2024", 14, "executive summary revenue growth 7 percent consolidated totals"),
    ("paper-vidore-v3", 3, "late interaction multi vector retrieval ColPali ColQwen benchmark"),
    ("paper-vidore-v3", 7, "nDCG results table vision first vs OCR then text columns"),
    ("paper-m3docrag", 2, "M3DocVQA multi page reasoning evaluation protocol"),
    ("handwritten-lab", 5, "experiment notes circuit board pH readings handwritten"),
    ("handwritten-lab", 6, "graph with annotated error bars figure 3 caption"),
    ("chart-report", 11, "line chart revenue by segment EMEA americas APAC Q1 Q4"),
    ("chart-report", 12, "bar chart operating margin by segment with 2023 2024 comparison"),
]


def build_index(prune: bool = True) -> Index:
    idx = Index()
    for doc, page, text in CORPUS:
        p = Page(doc_id=doc, page_num=page, content_tokens=tokenize(text))
        p.embed_patches()
        if prune:
            p.patches = doc_prune(p.patches, keep_fraction=0.5)
        idx.add(p)
    return idx


def main() -> None:
    print("=== build index with DocPruner (50% patches) ===")
    idx = build_index(prune=True)
    print(f"pages indexed: {len(idx.pages)}")

    queries = [
        "what was the 2024 operating margin change for EMEA",
        "late interaction retrieval vs OCR",
        "handwritten experimental figures with error bars",
        "bar chart comparing segment margins",
    ]

    for q in queries:
        print(f"\nQ: {q}")
        hits = idx.retrieve(q, k=3)
        for pg, score in hits:
            print(f"  score={score:+.3f}  {pg.doc_id} p.{pg.page_num}")

    # pruning ablation
    print("\n=== ablation: pruning off vs on ===")
    full = build_index(prune=False)
    pruned = build_index(prune=True)
    q = "chart comparing segment margins"
    full_top = [(p.doc_id, p.page_num) for p, _ in full.retrieve(q, 3)]
    prn_top = [(p.doc_id, p.page_num) for p, _ in pruned.retrieve(q, 3)]
    print(f"  full    top-3 : {full_top}")
    print(f"  pruned  top-3 : {prn_top}")
    print(f"  overlap       : {len(set(full_top) & set(prn_top))}/3")


if __name__ == "__main__":
    main()
