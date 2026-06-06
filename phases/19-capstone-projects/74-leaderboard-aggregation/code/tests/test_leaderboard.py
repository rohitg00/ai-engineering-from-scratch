"""Tests for leaderboard aggregation, bootstrap CI, win-rate, markdown rendering."""

from __future__ import annotations

import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    aggregate,
    bootstrap_mean_ci,
    bootstrap_pairwise_diff,
    EvalRun,
    pairwise_diffs,
    render_json,
    render_markdown,
)


def make_runs(spec):
    runs = []
    for model_id, task_scores in spec.items():
        for task_id, score in task_scores:
            runs.append(EvalRun(model_id=model_id, task_id=task_id, metric_name="m", score=score, category="general"))
    return runs


class TestAggregate(unittest.TestCase):
    def test_empty_input(self) -> None:
        self.assertEqual(aggregate([]), [])

    def test_validate_score_range(self) -> None:
        bad = [EvalRun("m", "t", "x", 1.5, "general")]
        with self.assertRaises(ValueError):
            aggregate(bad)

    def test_basic_two_model(self) -> None:
        spec = {
            "good": [("t1", 0.9), ("t2", 0.8), ("t3", 0.85)],
            "bad": [("t1", 0.2), ("t2", 0.3), ("t3", 0.25)],
        }
        rows = aggregate(make_runs(spec), b=200, seed=1)
        self.assertEqual(rows[0].model_id, "good")
        self.assertEqual(rows[1].model_id, "bad")
        self.assertGreater(rows[0].mean_score, rows[1].mean_score)

    def test_sorted_by_mean_descending(self) -> None:
        spec = {
            "a": [("t1", 0.1)],
            "b": [("t1", 0.9)],
            "c": [("t1", 0.5)],
        }
        rows = aggregate(make_runs(spec), b=50, seed=2)
        ids = [r.model_id for r in rows]
        self.assertEqual(ids, ["b", "c", "a"])

    def test_category_means_returned(self) -> None:
        runs = [
            EvalRun("m", "t1", "x", 1.0, "math"),
            EvalRun("m", "t2", "x", 0.0, "code"),
        ]
        rows = aggregate(runs, b=50, seed=3)
        self.assertEqual(rows[0].categories["math"], 1.0)
        self.assertEqual(rows[0].categories["code"], 0.0)

    def test_ci_is_within_bounds(self) -> None:
        spec = {"m": [("t1", 0.5), ("t2", 0.5), ("t3", 0.5)]}
        rows = aggregate(make_runs(spec), b=200, seed=4)
        self.assertAlmostEqual(rows[0].mean_ci_lo, 0.5, places=6)
        self.assertAlmostEqual(rows[0].mean_ci_hi, 0.5, places=6)


class TestBootstrap(unittest.TestCase):
    def test_constant_scores_zero_width_ci(self) -> None:
        lo, hi = bootstrap_mean_ci([0.7, 0.7, 0.7, 0.7], b=100, seed=0)
        self.assertAlmostEqual(lo, 0.7, places=6)
        self.assertAlmostEqual(hi, 0.7, places=6)

    def test_ci_contains_mean(self) -> None:
        scores = [0.1, 0.5, 0.9, 0.4, 0.6]
        lo, hi = bootstrap_mean_ci(scores, b=500, seed=1)
        mean = sum(scores) / len(scores)
        self.assertLessEqual(lo, mean)
        self.assertGreaterEqual(hi, mean)

    def test_pairwise_diff_zero_for_equal(self) -> None:
        diff_mean, lo, hi = bootstrap_pairwise_diff([0.5, 0.5], [0.5, 0.5], b=100, seed=2)
        self.assertAlmostEqual(diff_mean, 0.0)
        self.assertAlmostEqual(lo, 0.0)
        self.assertAlmostEqual(hi, 0.0)

    def test_pairwise_diff_significant(self) -> None:
        a = [0.9] * 30
        b = [0.1] * 30
        diff_mean, lo, hi = bootstrap_pairwise_diff(a, b, b=300, seed=3)
        self.assertGreater(lo, 0.0)
        self.assertAlmostEqual(diff_mean, 0.8, places=6)

    def test_pairwise_diff_misaligned(self) -> None:
        with self.assertRaises(ValueError):
            bootstrap_pairwise_diff([0.1], [0.2, 0.3])

    def test_empty_scores_returns_zero_width(self) -> None:
        lo, hi = bootstrap_mean_ci([], b=10)
        self.assertEqual(lo, 0.0)
        self.assertEqual(hi, 0.0)


class TestWinRate(unittest.TestCase):
    def test_winner_takes_all(self) -> None:
        spec = {
            "high": [("t1", 0.9), ("t2", 0.8)],
            "low": [("t1", 0.2), ("t2", 0.3)],
        }
        rows = aggregate(make_runs(spec), b=50, seed=5)
        high = next(r for r in rows if r.model_id == "high")
        self.assertEqual(high.win_rate, 1.0)

    def test_ties_split_to_winner(self) -> None:
        spec = {
            "a": [("t1", 0.5)],
            "b": [("t1", 0.5)],
        }
        rows = aggregate(make_runs(spec), b=50, seed=6)
        self.assertEqual(rows[0].win_rate, 1.0)
        self.assertEqual(rows[1].win_rate, 1.0)


class TestPairwiseDiffs(unittest.TestCase):
    def test_returns_one_per_pair(self) -> None:
        spec = {
            "a": [("t1", 0.6), ("t2", 0.6)],
            "b": [("t1", 0.5), ("t2", 0.5)],
            "c": [("t1", 0.4), ("t2", 0.4)],
        }
        diffs = pairwise_diffs(make_runs(spec), b=100, seed=7)
        self.assertEqual(len(diffs), 3)


class TestRender(unittest.TestCase):
    def test_markdown_header_present(self) -> None:
        spec = {"m": [("t1", 0.5)]}
        rows = aggregate(make_runs(spec), b=20, seed=8)
        md = render_markdown(rows)
        self.assertIn("| Rank | Model | Mean", md)
        self.assertIn("| 1 | m |", md)

    def test_json_round_trip(self) -> None:
        spec = {"m": [("t1", 0.5)]}
        rows = aggregate(make_runs(spec), b=20, seed=9)
        s = render_json(rows)
        parsed = json.loads(s)
        self.assertEqual(parsed[0]["model_id"], "m")

    def test_long_model_id_truncated(self) -> None:
        spec = {"x" * 30: [("t1", 0.5)]}
        rows = aggregate(make_runs(spec), b=20, seed=10)
        md = render_markdown(rows)
        self.assertNotIn("x" * 25, md)


if __name__ == "__main__":
    unittest.main()
