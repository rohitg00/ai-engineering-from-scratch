"""Tests for Evaluator: improvement, regression, noise, failed terminal, log scale, t test."""

from __future__ import annotations

import math
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    Evaluator,
    EvaluatorConfig,
    ExperimentResultLike,
    HIGHER,
    LINEAR,
    LOG,
    LOWER,
    MetricSpec,
    PairingError,
    paired_t_test,
    regularised_incomplete_beta,
    two_sided_t_p_value,
)


def res(seed: int, metric_name: str, value: float, terminal: str = "ok") -> ExperimentResultLike:
    return ExperimentResultLike(
        spec_id=f"r_{seed}",
        terminal=terminal,
        metrics={"seed": seed, metric_name: value},
    )


class TestIncompleteBeta(unittest.TestCase):
    def test_symmetry(self) -> None:
        a, b, x = 2.5, 3.5, 0.4
        ix = regularised_incomplete_beta(a, b, x)
        comp = regularised_incomplete_beta(b, a, 1.0 - x)
        self.assertAlmostEqual(ix + comp, 1.0, places=6)

    def test_endpoints(self) -> None:
        self.assertEqual(regularised_incomplete_beta(2.0, 3.0, 0.0), 0.0)
        self.assertEqual(regularised_incomplete_beta(2.0, 3.0, 1.0), 1.0)


class TestTwoSidedPValue(unittest.TestCase):
    def test_t_zero_is_one(self) -> None:
        self.assertAlmostEqual(two_sided_t_p_value(0.0, df=5), 1.0, places=6)

    def test_p_decreases_with_t(self) -> None:
        p_small = two_sided_t_p_value(0.5, df=10)
        p_large = two_sided_t_p_value(3.0, df=10)
        self.assertGreater(p_small, p_large)

    def test_known_reference(self) -> None:
        p = two_sided_t_p_value(2.228, df=10)
        self.assertAlmostEqual(p, 0.05, places=2)

    def test_t_large_p_small(self) -> None:
        p = two_sided_t_p_value(10.0, df=5)
        self.assertLess(p, 0.01)


class TestPairedTTest(unittest.TestCase):
    def test_clear_improvement(self) -> None:
        cand = [1.0, 2.0, 3.0, 4.0, 5.0]
        base = [2.0, 3.0, 4.0, 5.0, 6.0]
        mean_diff, p, n = paired_t_test(cand, base)
        self.assertAlmostEqual(mean_diff, -1.0)
        self.assertEqual(n, 5)
        self.assertLess(p, 0.05)

    def test_zero_variance(self) -> None:
        mean_diff, p, n = paired_t_test([1.0, 1.0, 1.0], [0.0, 0.0, 0.0])
        self.assertAlmostEqual(mean_diff, 1.0)
        self.assertEqual(p, 0.0)
        self.assertEqual(n, 3)

    def test_low_n_returns_none(self) -> None:
        _, p_one, n_one = paired_t_test([1.0], [2.0])
        self.assertIsNone(p_one)
        self.assertEqual(n_one, 1)
        _, p_zero, n_zero = paired_t_test([], [])
        self.assertIsNone(p_zero)
        self.assertEqual(n_zero, 0)

    def test_length_mismatch_raises(self) -> None:
        with self.assertRaises(PairingError):
            paired_t_test([1.0, 2.0], [3.0])


class TestImprovedRegressedNoise(unittest.TestCase):
    def test_improved_higher_is_better(self) -> None:
        candidates = [res(s, "acc", 0.85 + 0.005 * (s % 3)) for s in range(8)]
        baselines = [res(s, "acc", 0.70 + 0.005 * (s % 3)) for s in range(8)]
        evaluator = Evaluator()
        v = evaluator.evaluate(1, MetricSpec("acc", direction=HIGHER, scale=LINEAR), candidates, baselines)
        self.assertEqual(v.verdict, "improved")
        self.assertGreater(v.improvement, 0.1)
        self.assertLess(v.p_value, 0.05)

    def test_regressed_lower_is_better(self) -> None:
        candidates = [res(s, "loss", 0.7 + 0.005 * (s % 3)) for s in range(8)]
        baselines = [res(s, "loss", 0.5 + 0.005 * (s % 3)) for s in range(8)]
        evaluator = Evaluator()
        v = evaluator.evaluate(2, MetricSpec("loss", direction=LOWER, scale=LINEAR), candidates, baselines)
        self.assertEqual(v.verdict, "regressed")
        self.assertLess(v.improvement, 0.0)

    def test_small_change_is_noise(self) -> None:
        candidates = [res(s, "acc", 0.800 + 0.0001 * s) for s in range(8)]
        baselines = [res(s, "acc", 0.799 + 0.0001 * s) for s in range(8)]
        evaluator = Evaluator()
        v = evaluator.evaluate(3, MetricSpec("acc", direction=HIGHER, scale=LINEAR), candidates, baselines)
        self.assertEqual(v.verdict, "noise")

    def test_one_seed_is_noise(self) -> None:
        evaluator = Evaluator()
        v = evaluator.evaluate(
            4,
            MetricSpec("acc", direction=HIGHER, scale=LINEAR),
            [res(0, "acc", 0.9)],
            [res(0, "acc", 0.7)],
        )
        self.assertEqual(v.verdict, "noise")
        self.assertIsNone(v.p_value)


class TestFailedTerminal(unittest.TestCase):
    def test_any_crash_returns_failed(self) -> None:
        candidates = [
            res(0, "acc", 0.9, terminal="ok"),
            res(1, "acc", 0.0, terminal="timeout"),
        ]
        baselines = [res(0, "acc", 0.7), res(1, "acc", 0.7)]
        evaluator = Evaluator()
        v = evaluator.evaluate(5, MetricSpec("acc", direction=HIGHER), candidates, baselines)
        self.assertEqual(v.verdict, "failed")
        self.assertIn("timeout", v.rationale)


class TestLogScale(unittest.TestCase):
    def test_log_transform_changes_threshold_outcome(self) -> None:
        candidates = [res(s, "perplexity", 28.0 + 0.1 * s) for s in range(8)]
        baselines = [res(s, "perplexity", 32.0 + 0.1 * s) for s in range(8)]
        evaluator = Evaluator()
        v_lin = evaluator.evaluate(6, MetricSpec("perplexity", direction=LOWER, scale=LINEAR), candidates, baselines)
        v_log = evaluator.evaluate(6, MetricSpec("perplexity", direction=LOWER, scale=LOG), candidates, baselines)
        self.assertEqual(v_lin.verdict, "improved")
        self.assertEqual(v_log.verdict, "improved")
        self.assertNotAlmostEqual(v_lin.improvement, v_log.improvement, places=3)

    def test_log_requires_positive_metric(self) -> None:
        candidates = [res(s, "x", -1.0) for s in range(2)]
        baselines = [res(s, "x", 1.0) for s in range(2)]
        evaluator = Evaluator()
        with self.assertRaises(ValueError):
            evaluator.evaluate(7, MetricSpec("x", direction=LOWER, scale=LOG), candidates, baselines)


class TestPairing(unittest.TestCase):
    def test_no_shared_seeds_raises(self) -> None:
        evaluator = Evaluator()
        with self.assertRaises(PairingError):
            evaluator.evaluate(
                8,
                MetricSpec("acc", direction=HIGHER),
                [res(0, "acc", 0.9)],
                [res(99, "acc", 0.7)],
            )


if __name__ == "__main__":
    unittest.main()
