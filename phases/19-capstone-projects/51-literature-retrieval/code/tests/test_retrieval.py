"""Tests for RetrievalClient: lexical hits, graph expansion, merge, dedup, edges."""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    ArxivMockClient,
    BM25Index,
    CitationGraph,
    Paper,
    RetrievalClient,
    RetrievalConfig,
    SemanticScholarMockClient,
    build_client,
    build_corpus,
    tokenise,
)


class TestTokenise(unittest.TestCase):
    def test_lowercases_and_splits(self) -> None:
        self.assertEqual(tokenise("Attention, Sparsity!"), ["attention", "sparsity"])

    def test_keeps_digits(self) -> None:
        self.assertEqual(tokenise("study 12 result 3"), ["study", "12", "result", "3"])


class TestBM25(unittest.TestCase):
    def test_single_doc_query(self) -> None:
        idx = BM25Index()
        idx.add("d1", "attention sparsity head pruning")
        idx.finalise()
        hits = idx.search("attention", top_k=5)
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0][0], "d1")
        self.assertGreater(hits[0][1], 0.0)

    def test_returns_zero_for_unknown_term(self) -> None:
        idx = BM25Index()
        idx.add("d1", "attention sparsity")
        idx.finalise()
        self.assertEqual(idx.search("graphene", top_k=5), [])

    def test_ranking_orders_by_score(self) -> None:
        idx = BM25Index()
        idx.add("d1", "attention attention sparsity")
        idx.add("d2", "attention sparsity head pruning routing")
        idx.add("d3", "retrieval embedding index passage")
        idx.finalise()
        hits = idx.search("attention sparsity", top_k=5)
        ids = [h[0] for h in hits]
        self.assertIn("d1", ids)
        self.assertIn("d2", ids)
        self.assertNotIn("d3", ids)

    def test_empty_query_returns_empty(self) -> None:
        idx = BM25Index()
        idx.add("d1", "attention sparsity")
        idx.finalise()
        self.assertEqual(idx.search("", top_k=5), [])


class TestCitationGraph(unittest.TestCase):
    def test_expand_zero_hops(self) -> None:
        g = CitationGraph()
        g.add_paper(Paper("a", "", "", 2020, [], references=["b"], citations=["c"]))
        g.add_paper(Paper("b", "", "", 2020, []))
        g.add_paper(Paper("c", "", "", 2020, []))
        self.assertEqual(g.expand(["a"], max_hops=0), {"a": 0})

    def test_expand_one_hop_reaches_neighbours(self) -> None:
        g = CitationGraph()
        g.add_paper(Paper("a", "", "", 2020, [], references=["b"], citations=["c"]))
        g.add_paper(Paper("b", "", "", 2020, []))
        g.add_paper(Paper("c", "", "", 2020, []))
        out = g.expand(["a"], max_hops=1)
        self.assertEqual(out["a"], 0)
        self.assertEqual(out["b"], 1)
        self.assertEqual(out["c"], 1)


class TestClients(unittest.TestCase):
    def test_arxiv_returns_lexical_overlap(self) -> None:
        corpus = build_corpus()
        client = ArxivMockClient(corpus)
        hits = client.search("retrieval augmentation")
        self.assertTrue(hits)
        for hit in hits:
            self.assertEqual(hit.source, "arxiv")
            self.assertEqual(hit.references, [])

    def test_s2_returns_full_record(self) -> None:
        corpus = build_corpus()
        client = SemanticScholarMockClient(corpus)
        hits = client.search("attention sparsity")
        self.assertTrue(hits)
        with_refs = [hit for hit in hits if hit.references]
        self.assertTrue(with_refs)


class TestRetrieval(unittest.TestCase):
    def test_search_returns_ranked_papers(self) -> None:
        client = build_client(RetrievalConfig(top_k_lexical=5, max_hops=2))
        result = client.search("attention sparsity head pruning")
        self.assertGreater(result.hit_count, 0)
        scores = [r.final_score for r in result.ranked]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_top_hit_is_on_topic(self) -> None:
        client = build_client(RetrievalConfig(top_k_lexical=5, max_hops=2))
        result = client.search("attention sparsity head pruning")
        top = result.ranked[0]
        self.assertIn("Attention Sparsity", top.paper.title)

    def test_dedup_no_duplicate_ids(self) -> None:
        client = build_client(RetrievalConfig(top_k_lexical=10, max_hops=2))
        result = client.search("retrieval augmentation embedding")
        ids = [r.paper.id for r in result.ranked]
        self.assertEqual(len(ids), len(set(ids)))

    def test_graph_expansion_extends_beyond_lexical(self) -> None:
        client_no_graph = build_client(RetrievalConfig(top_k_lexical=3, max_hops=0))
        client_with_graph = build_client(RetrievalConfig(top_k_lexical=3, max_hops=2))
        narrow = client_no_graph.search("dataset distillation synthetic")
        wide = client_with_graph.search("dataset distillation synthetic")
        self.assertGreaterEqual(wide.hit_count, narrow.hit_count)

    def test_empty_query_returns_no_hits(self) -> None:
        client = build_client()
        result = client.search("")
        self.assertEqual(result.hit_count, 0)
        self.assertEqual(result.ranked, [])

    def test_metrics_present(self) -> None:
        client = build_client()
        result = client.search("evaluation harness benchmark")
        self.assertGreaterEqual(result.average_score, 0.0)
        self.assertGreaterEqual(result.top_score, result.average_score)
        self.assertGreaterEqual(result.wall_time_ms, 0.0)


class TestCorpusShape(unittest.TestCase):
    def test_corpus_has_hundred_papers(self) -> None:
        self.assertEqual(len(build_corpus()), 100)

    def test_corpus_ids_unique(self) -> None:
        ids = [p.id for p in build_corpus()]
        self.assertEqual(len(ids), len(set(ids)))


if __name__ == "__main__":
    unittest.main()
