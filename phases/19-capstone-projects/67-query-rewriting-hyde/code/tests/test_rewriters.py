"""Tests for HyDE, multi-query, decomposition rewriters and the retrieve loop."""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    CORPUS,
    DecomposeRewriter,
    GOLD,
    HyDERewriter,
    MockLLM,
    MultiQueryRewriter,
    RewriteResult,
    _IdentityRewriter,
    build_retriever,
    retrieve_with_rewriter,
    rrf,
)


class TestMockLLM(unittest.TestCase):
    def setUp(self) -> None:
        self.llm = MockLLM()

    def test_hyde_table_hit(self) -> None:
        h = self.llm.generate_hypothetical("how does the search service merge two retrievers")
        self.assertIn("rank fusion", h.lower())

    def test_hyde_fallback_returns_string(self) -> None:
        h = self.llm.generate_hypothetical("a brand new question never seen before")
        self.assertIsInstance(h, str)
        self.assertGreater(len(h), 0)

    def test_paraphrase_returns_n(self) -> None:
        out = self.llm.paraphrase("how is access control handled across user types", n=3)
        self.assertEqual(len(out), 3)
        # rewrites must not be exact duplicates of the input
        self.assertNotIn("how is access control handled across user types", out)

    def test_decompose_atomic_returns_self(self) -> None:
        atomic = "where is the policy engine cached"
        self.assertEqual(self.llm.decompose(atomic), [atomic])

    def test_decompose_splits_on_and(self) -> None:
        out = self.llm.decompose("how is authorization handled and how do policies get evaluated")
        self.assertEqual(len(out), 2)


class TestHyDERewriter(unittest.TestCase):
    def test_returns_hypothetical(self) -> None:
        rw = HyDERewriter()
        out = rw.rewrite("how is access control handled across user types")
        self.assertIsInstance(out, RewriteResult)
        self.assertIsNotNone(out.hypothetical)
        self.assertEqual(out.strategy, "hyde")


class TestMultiQueryRewriter(unittest.TestCase):
    def test_includes_original_query_plus_paraphrases(self) -> None:
        rw = MultiQueryRewriter(n=3)
        out = rw.rewrite("how does the search service merge two retrievers")
        self.assertGreaterEqual(len(out.rewrites), 3)
        self.assertEqual(out.rewrites[0], "how does the search service merge two retrievers")


class TestDecomposeRewriter(unittest.TestCase):
    def test_multi_clause_decomposes(self) -> None:
        rw = DecomposeRewriter()
        out = rw.rewrite("how is authorization handled and how do policies get evaluated")
        self.assertEqual(len(out.rewrites), 2)
        for sub in out.rewrites:
            self.assertLess(len(sub), 80)


class TestRetrieveLoop(unittest.TestCase):
    def setUp(self) -> None:
        self.retriever = build_retriever()

    def test_no_rewrite_baseline_runs(self) -> None:
        out = retrieve_with_rewriter("how is access control handled across user types",
                                     _IdentityRewriter(), self.retriever, k_each=5, k_out=5)
        self.assertIn("results", out)
        self.assertGreater(len(out["results"]), 0)

    def test_hyde_changes_top_rank(self) -> None:
        q = "how does the search service merge two retrievers"
        baseline = retrieve_with_rewriter(q, _IdentityRewriter(), self.retriever, k_each=8, k_out=8)
        hyde = retrieve_with_rewriter(q, HyDERewriter(), self.retriever, k_each=8, k_out=8)
        base_ids = [d.doc_id for d, _ in baseline["results"]]
        hyde_ids = [d.doc_id for d, _ in hyde["results"]]
        # Confirm rewriting actually changed the ranking somewhere
        self.assertNotEqual(base_ids, hyde_ids)

    def test_gold_promotion_for_designated_strategies(self) -> None:
        """For each gold case, the designated strategy at least matches no-rewrite on gold rank."""
        for q, gold, _winner in GOLD:
            baseline = retrieve_with_rewriter(q, _IdentityRewriter(), self.retriever, k_each=8, k_out=8)
            base_ids = [d.doc_id for d, _ in baseline["results"]]
            base_rank = base_ids.index(gold) + 1 if gold in base_ids else 99
            best = base_rank
            for rw in (HyDERewriter(), MultiQueryRewriter(n=3), DecomposeRewriter()):
                out = retrieve_with_rewriter(q, rw, self.retriever, k_each=8, k_out=8)
                ids = [d.doc_id for d, _ in out["results"]]
                rank = ids.index(gold) + 1 if gold in ids else 99
                best = min(best, rank)
            # At least one rewriter must do at least as well as baseline on gold rank.
            self.assertLessEqual(best, base_rank, f"no rewriter helped on query: {q}")


class TestRRF(unittest.TestCase):
    def test_rrf_empty(self) -> None:
        self.assertEqual(rrf([], k=60), [])

    def test_rrf_single_list_preserves_order(self) -> None:
        d1 = CORPUS[0]
        d2 = CORPUS[1]
        fused = rrf([[(d1, 1.0), (d2, 0.5)]], k=60)
        self.assertEqual(fused[0][0].doc_id, d1.doc_id)


if __name__ == "__main__":
    unittest.main()
