"""Multimodal document QA — ColPali-style late interaction scaffold。

難しい architectural primitive は late-interaction retrieval です。各 query
token が各 document patch に対して score され、query token ごとの MaxSim を
合計し、top-k page を返します。この scaffold は synthetic patch embedding 上で
MaxSim を end to end に実装し、real ColQwen model を load しなくても algorithm
を観測できるようにします。DocPruner-style patch pruning も含みます。

Run:  python main.py
"""

from __future__ import annotations

import math
import random
import re
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# patch embeddings  --  page ごとの fake 16-dim patch vectors
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
    content_tokens: list[str]          # page contents の代役
    patches: list[list[float]] = field(default_factory=list)

    def embed_patches(self) -> None:
        """multi-vector: 各 content token が patch vector になる。"""
        self.patches = [hash_embed(t) for t in self.content_tokens]


# ---------------------------------------------------------------------------
# DocPruner  --  norm variance で top fraction の patch を残す
# ---------------------------------------------------------------------------

def doc_prune(patches: list[list[float]], keep_fraction: float = 0.5) -> list[list[float]]:
    """per-patch norm が高い patch を残す。
    info density の粗い proxy だが、low-signal patch を落とす DocPruner の直感に合う。"""
    scored = [(sum(abs(x) for x in p), p) for p in patches]
    scored.sort(key=lambda x: -x[0])
    keep_n = max(1, int(len(scored) * keep_fraction))
    return [p for _, p in scored[:keep_n]]


# ---------------------------------------------------------------------------
# MaxSim late interaction  --  ColPali / ColQwen の algorithmic core
# ---------------------------------------------------------------------------

def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def max_sim_score(query_tokens: list[list[float]],
                  doc_patches: list[list[float]]) -> float:
    """各 query token embedding について任意の doc patch との max dot product を取り、
    query token 全体で合計する。これが MaxSim / late interaction。"""
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
# index + retrieval  --  MaxSim による ranked top-k
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
# synthetic corpus  --  table、chart、handwriting、text にまたがる10 pages
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
    print("=== DocPruner (50% patches) で index を構築 ===")
    idx = build_index(prune=True)
    print(f"index 済み pages: {len(idx.pages)}")

    queries = [
        "2024年の EMEA operating margin はどう変化したか",
        "late interaction retrieval と OCR の比較",
        "error bar 付きの手書き実験 figure",
        "segment margin を比較する bar chart",
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
    q = "segment margin を比較する chart"
    full_top = [(p.doc_id, p.page_num) for p, _ in full.retrieve(q, 3)]
    prn_top = [(p.doc_id, p.page_num) for p, _ in pruned.retrieve(q, 3)]
    print(f"  full    top-3 : {full_top}")
    print(f"  pruned  top-3 : {prn_top}")
    print(f"  overlap       : {len(set(full_top) & set(prn_top))}/3")


if __name__ == "__main__":
    main()
