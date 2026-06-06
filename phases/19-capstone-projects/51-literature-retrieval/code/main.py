"""Literature retrieval: BM25 over abstracts plus citation graph traversal, merged.

Conceptual references:
- ./docs/en.md (this lesson)
- Phase 19 Track A lessons 20-29 (agent harness primitives)

Stdlib only. Run: python3 code/main.py
"""

from __future__ import annotations

import json
import math
import re
import time
from collections import Counter, defaultdict, deque
from dataclasses import dataclass, field


TOKEN_RE = re.compile(r"[a-z0-9]+")


@dataclass
class Paper:
    id: str
    title: str
    abstract: str
    year: int
    authors: list[str]
    references: list[str] = field(default_factory=list)
    citations: list[str] = field(default_factory=list)
    source: str = "merged"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "year": self.year,
            "authors": list(self.authors),
            "references": list(self.references),
            "citations": list(self.citations),
            "source": self.source,
        }


def tokenise(text: str) -> list[str]:
    return TOKEN_RE.findall(text.lower())


class BM25Index:
    """Okapi BM25 with default k1=1.5, b=0.75. Stdlib only."""

    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self._doc_lens: dict[str, int] = {}
        self._term_freq: dict[str, dict[str, int]] = defaultdict(dict)
        self._doc_freq: Counter = Counter()
        self._avgdl: float = 0.0
        self._n_docs: int = 0

    def add(self, doc_id: str, text: str) -> None:
        tokens = tokenise(text)
        self._doc_lens[doc_id] = len(tokens)
        counts = Counter(tokens)
        for term, count in counts.items():
            self._term_freq[term][doc_id] = count
            self._doc_freq[term] += 1
        self._n_docs += 1

    def finalise(self) -> None:
        if self._n_docs == 0:
            self._avgdl = 0.0
            return
        self._avgdl = sum(self._doc_lens.values()) / self._n_docs

    def idf(self, term: str) -> float:
        df = self._doc_freq.get(term, 0)
        return math.log((self._n_docs - df + 0.5) / (df + 0.5) + 1.0)

    def score(self, doc_id: str, query_terms: list[str]) -> float:
        if doc_id not in self._doc_lens or self._avgdl == 0.0:
            return 0.0
        dl = self._doc_lens[doc_id]
        total = 0.0
        for term in query_terms:
            f = self._term_freq.get(term, {}).get(doc_id, 0)
            if f == 0:
                continue
            tf_norm = (f * (self.k1 + 1.0)) / (
                f + self.k1 * (1.0 - self.b + self.b * dl / self._avgdl)
            )
            total += self.idf(term) * tf_norm
        return total

    def search(self, query: str, top_k: int = 10) -> list[tuple[str, float]]:
        terms = tokenise(query)
        if not terms:
            return []
        scores: dict[str, float] = {}
        candidate_ids: set[str] = set()
        for term in terms:
            candidate_ids.update(self._term_freq.get(term, {}).keys())
        for doc_id in candidate_ids:
            scores[doc_id] = self.score(doc_id, terms)
        ranked = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
        return [(d, s) for d, s in ranked[:top_k] if s > 0.0]


class CitationGraph:
    """Directed citation graph with forward and backward adjacency lists."""

    def __init__(self) -> None:
        self._forward: dict[str, list[str]] = {}
        self._backward: dict[str, list[str]] = {}

    def add_paper(self, paper: Paper) -> None:
        self._forward[paper.id] = list(paper.references)
        self._backward[paper.id] = list(paper.citations)

    def neighbours(self, doc_id: str) -> list[str]:
        out = list(self._forward.get(doc_id, []))
        out.extend(self._backward.get(doc_id, []))
        return out

    def expand(self, seeds: list[str], max_hops: int = 2) -> dict[str, int]:
        """Return a mapping of paper id to shortest hop distance from any seed."""
        distance: dict[str, int] = {sid: 0 for sid in seeds}
        queue: deque[str] = deque(seeds)
        while queue:
            current = queue.popleft()
            d = distance[current]
            if d >= max_hops:
                continue
            for neighbour in self.neighbours(current):
                if neighbour in distance:
                    continue
                distance[neighbour] = d + 1
                queue.append(neighbour)
        return distance


class ArxivMockClient:
    """Returns title, abstract, year, authors. No reference graph."""

    def __init__(self, corpus: list[Paper]) -> None:
        self._papers = {p.id: p for p in corpus}

    def search(self, query: str) -> list[Paper]:
        terms = set(tokenise(query))
        hits: list[Paper] = []
        for paper in self._papers.values():
            haystack = set(tokenise(paper.title + " " + paper.abstract))
            if terms & haystack:
                hits.append(Paper(
                    id=paper.id,
                    title=paper.title,
                    abstract=paper.abstract,
                    year=paper.year,
                    authors=list(paper.authors),
                    source="arxiv",
                ))
        return hits


class SemanticScholarMockClient:
    """Returns the same papers as arxiv plus references and citations."""

    def __init__(self, corpus: list[Paper]) -> None:
        self._papers = {p.id: p for p in corpus}

    def search(self, query: str) -> list[Paper]:
        terms = set(tokenise(query))
        hits: list[Paper] = []
        for paper in self._papers.values():
            haystack = set(tokenise(paper.title + " " + paper.abstract))
            if terms & haystack:
                hits.append(Paper(
                    id=paper.id,
                    title=paper.title,
                    abstract=paper.abstract,
                    year=paper.year,
                    authors=list(paper.authors),
                    references=list(paper.references),
                    citations=list(paper.citations),
                    source="s2",
                ))
        return hits

    def fetch(self, paper_id: str) -> Paper | None:
        paper = self._papers.get(paper_id)
        if paper is None:
            return None
        return Paper(
            id=paper.id,
            title=paper.title,
            abstract=paper.abstract,
            year=paper.year,
            authors=list(paper.authors),
            references=list(paper.references),
            citations=list(paper.citations),
            source="s2",
        )


@dataclass
class RetrievalConfig:
    top_k_lexical: int = 10
    max_hops: int = 2
    w_bm25: float = 0.5
    w_graph: float = 0.3
    w_recency: float = 0.2

    def __post_init__(self) -> None:
        if self.max_hops > 2:
            self.max_hops = 2


@dataclass
class RankedPaper:
    paper: Paper
    bm25_score: float
    graph_distance: int | None
    recency_score: float
    final_score: float

    def to_dict(self) -> dict:
        return {
            "id": self.paper.id,
            "title": self.paper.title,
            "year": self.paper.year,
            "bm25_score": round(self.bm25_score, 4),
            "graph_distance": self.graph_distance,
            "recency_score": round(self.recency_score, 4),
            "final_score": round(self.final_score, 4),
        }


@dataclass
class RetrievalResult:
    ranked: list[RankedPaper]
    hit_count: int
    average_score: float
    top_score: float
    wall_time_ms: float

    def to_dict(self) -> dict:
        return {
            "hit_count": self.hit_count,
            "average_score": round(self.average_score, 4),
            "top_score": round(self.top_score, 4),
            "wall_time_ms": round(self.wall_time_ms, 3),
            "ranked": [r.to_dict() for r in self.ranked],
        }


class RetrievalClient:
    """Wraps arxiv and semantic scholar mocks and merges lexical and graph hits."""

    def __init__(
        self,
        arxiv: ArxivMockClient,
        s2: SemanticScholarMockClient,
        corpus: list[Paper],
        config: RetrievalConfig | None = None,
    ) -> None:
        self._arxiv = arxiv
        self._s2 = s2
        self._cfg = config or RetrievalConfig()
        self._corpus = {p.id: p for p in corpus}
        self._index = BM25Index()
        for paper in corpus:
            self._index.add(paper.id, paper.title + " " + paper.abstract)
        self._index.finalise()
        self._graph = CitationGraph()
        for paper in corpus:
            self._graph.add_paper(paper)
        years = [p.year for p in corpus]
        self._year_min = min(years) if years else 0
        self._year_max = max(years) if years else 0

    def _recency(self, year: int) -> float:
        if self._year_max == self._year_min:
            return 1.0
        return (year - self._year_min) / (self._year_max - self._year_min)

    def _graph_score(self, distance: int | None) -> float:
        if distance is None:
            return 0.0
        if distance == 0:
            return 1.0
        if distance == 1:
            return 0.6
        if distance == 2:
            return 0.3
        return 0.0

    def _merge_paper(self, lexical: Paper | None, s2: Paper | None) -> Paper:
        base = self._corpus[(lexical or s2).id]
        return Paper(
            id=base.id,
            title=base.title,
            abstract=base.abstract,
            year=base.year,
            authors=list(base.authors),
            references=list(base.references),
            citations=list(base.citations),
            source="merged",
        )

    def search(self, query: str) -> RetrievalResult:
        start = time.perf_counter()
        terms = tokenise(query)
        if not terms:
            return RetrievalResult([], 0, 0.0, 0.0, (time.perf_counter() - start) * 1000.0)
        lexical_hits = self._index.search(query, self._cfg.top_k_lexical)
        seed_ids = [doc_id for doc_id, _ in lexical_hits]
        graph_distance = self._graph.expand(seed_ids, self._cfg.max_hops)
        merged_ids = set(seed_ids) | set(graph_distance.keys())
        max_bm25 = max((s for _, s in lexical_hits), default=0.0)
        ranked: list[RankedPaper] = []
        for doc_id in merged_ids:
            paper = self._corpus.get(doc_id)
            if paper is None:
                continue
            bm25 = self._index.score(doc_id, terms)
            distance = graph_distance.get(doc_id)
            graph_score = self._graph_score(distance)
            bm25_norm = bm25 / max_bm25 if max_bm25 > 0 else 0.0
            recency = self._recency(paper.year)
            final = (
                self._cfg.w_bm25 * bm25_norm
                + self._cfg.w_graph * graph_score
                + self._cfg.w_recency * recency
            )
            merged_paper = Paper(
                id=paper.id,
                title=paper.title,
                abstract=paper.abstract,
                year=paper.year,
                authors=list(paper.authors),
                references=list(paper.references),
                citations=list(paper.citations),
                source="merged",
            )
            ranked.append(RankedPaper(merged_paper, bm25, distance, recency, final))
        ranked.sort(key=lambda r: (-r.final_score, r.paper.id))
        scores = [r.final_score for r in ranked]
        avg = sum(scores) / len(scores) if scores else 0.0
        top = max(scores) if scores else 0.0
        wall_ms = (time.perf_counter() - start) * 1000.0
        return RetrievalResult(ranked, len(ranked), avg, top, wall_ms)


def build_corpus() -> list[Paper]:
    """Return a hundred paper mock corpus across five topics, with a citation graph.

    Topics: attention sparsity, retrieval augmentation, low rank adapters,
    dataset distillation, evaluation harnesses. Each topic gets twenty papers
    with intra topic references and a few cross topic edges.
    """
    topics = [
        ("attention sparsity", "attention sparsity head pruning routing block"),
        ("retrieval augmentation", "retrieval augmentation embedding index passage"),
        ("low rank adapters", "low rank adapter parameter fine tuning"),
        ("dataset distillation", "dataset distillation synthetic compact training"),
        ("evaluation harnesses", "evaluation harness benchmark task accuracy"),
    ]
    papers: list[Paper] = []
    for topic_idx, (label, terms) in enumerate(topics):
        for i in range(20):
            pid = f"p{topic_idx * 20 + i + 1:03d}"
            title = f"{label.title()} study {i + 1}"
            abstract = (
                f"This work investigates {label} and reports on {terms}. "
                f"We measure perplexity, accuracy, and wall time on small transformer baselines. "
                f"The study {i + 1} extends prior findings in topic {topic_idx + 1}."
            )
            year = 2018 + (i % 8)
            authors = [f"Author {topic_idx + 1}-{i + 1}", f"Coauthor {topic_idx + 1}-{i + 1}"]
            papers.append(Paper(pid, title, abstract, year, authors))
    by_id = {p.id: p for p in papers}
    for topic_idx in range(5):
        for i in range(20):
            pid = f"p{topic_idx * 20 + i + 1:03d}"
            paper = by_id[pid]
            if i >= 2:
                anchor_a = f"p{topic_idx * 20 + 1:03d}"
                anchor_b = f"p{topic_idx * 20 + 2:03d}"
                paper.references.extend([anchor_a, anchor_b])
                by_id[anchor_a].citations.append(pid)
                by_id[anchor_b].citations.append(pid)
            if i == 5:
                cross = f"p{((topic_idx + 1) % 5) * 20 + 1:03d}"
                paper.references.append(cross)
                by_id[cross].citations.append(pid)
    return papers


def build_client(config: RetrievalConfig | None = None) -> RetrievalClient:
    corpus = build_corpus()
    return RetrievalClient(ArxivMockClient(corpus), SemanticScholarMockClient(corpus), corpus, config)


def _demo() -> None:
    client = build_client(RetrievalConfig(top_k_lexical=5, max_hops=2))
    result = client.search("attention sparsity head pruning")
    print(json.dumps({
        "hit_count": result.hit_count,
        "top_score": round(result.top_score, 4),
        "top_three": [r.to_dict() for r in result.ranked[:3]],
    }, indent=2))


if __name__ == "__main__":
    _demo()
