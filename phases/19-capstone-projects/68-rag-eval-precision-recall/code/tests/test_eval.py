"""Tests for retrieval metrics, answer-grade metrics, and the eval orchestrator."""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    MockJudge,
    QRELS,
    Qrel,
    answer_relevance,
    baseline_pipeline,
    dcg_at_k,
    evaluate_pipeline,
    extract_claims,
    faithfulness,
    hybrid_pipeline,
    hybrid_plus_rerank_pipeline,
    mean_reciprocal_rank,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
)


class TestPrecision(unittest.TestCase):
    def test_perfect(self) -> None:
        self.assertEqual(precision_at_k(["a", "b", "c"], {"a", "b", "c"}, 3), 1.0)

    def test_partial(self) -> None:
        self.assertAlmostEqual(precision_at_k(["a", "x", "y"], {"a"}, 3), 1 / 3)

    def test_k_larger_than_retrieved(self) -> None:
        self.assertAlmostEqual(precision_at_k(["a"], {"a"}, 5), 1 / 5)

    def test_zero_k_returns_zero(self) -> None:
        self.assertEqual(precision_at_k(["a"], {"a"}, 0), 0.0)


class TestRecall(unittest.TestCase):
    def test_perfect(self) -> None:
        self.assertEqual(recall_at_k(["a", "b", "c"], {"a", "b"}, 5), 1.0)

    def test_partial(self) -> None:
        self.assertAlmostEqual(recall_at_k(["a"], {"a", "b"}, 1), 0.5)

    def test_empty_gold(self) -> None:
        self.assertEqual(recall_at_k(["a"], set(), 5), 0.0)


class TestMRR(unittest.TestCase):
    def test_first_position(self) -> None:
        self.assertEqual(reciprocal_rank(["a", "b"], {"a"}), 1.0)

    def test_second_position(self) -> None:
        self.assertEqual(reciprocal_rank(["x", "a"], {"a"}), 0.5)

    def test_not_found(self) -> None:
        self.assertEqual(reciprocal_rank(["x", "y"], {"a"}), 0.0)

    def test_mean(self) -> None:
        v = mean_reciprocal_rank(
            [["a", "b"], ["x", "a"], ["y", "z"]],
            [{"a"}, {"a"}, {"a"}],
        )
        self.assertAlmostEqual(v, (1.0 + 0.5 + 0.0) / 3)


class TestNDCG(unittest.TestCase):
    def test_perfect_ranking(self) -> None:
        graded = {"a": 3, "b": 2, "c": 1}
        self.assertAlmostEqual(ndcg_at_k(["a", "b", "c"], graded, 3), 1.0)

    def test_inverted_ranking(self) -> None:
        graded = {"a": 3, "b": 2, "c": 1}
        v = ndcg_at_k(["c", "b", "a"], graded, 3)
        self.assertGreater(v, 0.0)
        self.assertLess(v, 1.0)

    def test_dcg_zero_when_no_relevant(self) -> None:
        self.assertEqual(dcg_at_k(["x", "y"], {"a": 3}, 2), 0.0)


class TestClaims(unittest.TestCase):
    def test_extract_claims_split_on_sentences(self) -> None:
        answer = "First claim. Second claim! Third claim? Trailing"
        claims = extract_claims(answer)
        self.assertEqual(len(claims), 4)

    def test_extract_claims_empty(self) -> None:
        self.assertEqual(extract_claims(""), [])


class TestFaithfulness(unittest.TestCase):
    def test_all_supported(self) -> None:
        judge = MockJudge(overlap_threshold=0.2)
        ctx = ["the abort threshold is three failed parts per bucket"]
        claims = ["abort threshold is three failed parts"]
        self.assertEqual(faithfulness(claims, ctx, judge), 1.0)

    def test_none_supported(self) -> None:
        judge = MockJudge(overlap_threshold=0.8)
        ctx = ["completely unrelated context with different vocabulary"]
        claims = ["the abort threshold is three failed parts"]
        self.assertEqual(faithfulness(claims, ctx, judge), 0.0)

    def test_empty_claims(self) -> None:
        self.assertEqual(faithfulness([], ["any context"], MockJudge()), 0.0)


class TestAnswerRelevance(unittest.TestCase):
    def test_relevant(self) -> None:
        judge = MockJudge(overlap_threshold=0.3)
        v = answer_relevance(
            "where is authorization centralized",
            "authorization is centralized in check_permission",
            judge,
        )
        self.assertEqual(v, 1.0)

    def test_irrelevant(self) -> None:
        judge = MockJudge(overlap_threshold=0.4)
        v = answer_relevance(
            "where is authorization centralized",
            "the weather today is rainy with mild temperatures",
            judge,
        )
        self.assertEqual(v, 0.0)


class TestEvaluatePipeline(unittest.TestCase):
    def test_returns_all_metrics(self) -> None:
        result = evaluate_pipeline(baseline_pipeline, QRELS, ks=(1, 3))
        for key in ("precision@1", "recall@1", "ndcg@1", "mrr", "faithfulness", "answer_relevance"):
            self.assertIn(key, result)

    def test_hybrid_beats_baseline_on_recall_at_1(self) -> None:
        base = evaluate_pipeline(baseline_pipeline, QRELS, ks=(1, 3, 5))
        hybrid = evaluate_pipeline(hybrid_pipeline, QRELS, ks=(1, 3, 5))
        self.assertGreaterEqual(hybrid["recall@1"], base["recall@1"])
        self.assertGreaterEqual(hybrid["mrr"], base["mrr"])

    def test_hybrid_plus_rerank_at_least_as_good_as_hybrid(self) -> None:
        hybrid = evaluate_pipeline(hybrid_pipeline, QRELS, ks=(1, 3, 5))
        rerank = evaluate_pipeline(hybrid_plus_rerank_pipeline, QRELS, ks=(1, 3, 5))
        self.assertGreaterEqual(rerank["mrr"], hybrid["mrr"] - 1e-9)


if __name__ == "__main__":
    unittest.main()
