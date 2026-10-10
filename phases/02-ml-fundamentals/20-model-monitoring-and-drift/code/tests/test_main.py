"""Tests for the drift monitoring toolkit."""

from __future__ import annotations

import os
import random
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    AlertPolicy,
    DriftMonitor,
    SlidingWindow,
    bin_fractions,
    chi2_sf,
    chi_square_test,
    first_alert,
    ks_pvalue,
    ks_statistic,
    labeled_accuracy,
    make_stream,
    psi,
    psi_from_fractions,
    quantile_edges,
    run_monitoring,
)


def gaussian(n: int, mean: float, sd: float, seed: int) -> list[float]:
    rng = random.Random(seed)
    return [rng.gauss(mean, sd) for _ in range(n)]


class PsiTests(unittest.TestCase):
    def test_quantile_edges_give_equal_reference_bins(self) -> None:
        reference = list(range(1000))
        fractions = bin_fractions(reference, quantile_edges(reference, 10))
        for f in fractions:
            self.assertAlmostEqual(f, 0.1, places=6)

    def test_same_distribution_has_small_psi(self) -> None:
        self.assertLess(psi(gaussian(4000, 0, 1, 1), gaussian(4000, 0, 1, 2)), 0.02)

    def test_shifted_distribution_has_large_psi(self) -> None:
        self.assertGreater(psi(gaussian(4000, 0, 1, 1), gaussian(4000, 1, 1, 2)), 0.25)

    def test_psi_formula_is_symmetric(self) -> None:
        e, a = [0.2, 0.3, 0.5], [0.4, 0.4, 0.2]
        self.assertAlmostEqual(psi_from_fractions(e, a), psi_from_fractions(a, e))

    def test_empty_bin_does_not_crash(self) -> None:
        self.assertGreater(psi_from_fractions([0.5, 0.5], [1.0, 0.0]), 1.0)


class KsTests(unittest.TestCase):
    def test_identical_samples_have_zero_statistic(self) -> None:
        sample = gaussian(300, 0, 1, 4)
        self.assertEqual(ks_statistic(sample, list(sample)), 0.0)

    def test_disjoint_samples_have_statistic_one(self) -> None:
        self.assertEqual(ks_statistic([1, 2, 3], [10, 11]), 1.0)

    def test_known_value_with_ties(self) -> None:
        self.assertAlmostEqual(ks_statistic([1, 1, 2, 2, 3, 3, 3], [1, 2, 2, 2, 4]), 8 / 35)

    def test_pvalue_behaviour(self) -> None:
        self.assertEqual(ks_pvalue(0.0, 100, 100), 1.0)
        self.assertLess(ks_pvalue(0.3, 500, 500), 1e-10)
        self.assertGreater(ks_pvalue(0.05, 100, 100), 0.5)


class ChiSquareTests(unittest.TestCase):
    def test_survival_function_matches_table_values(self) -> None:
        self.assertAlmostEqual(chi2_sf(3.841, 1), 0.05, places=3)
        self.assertAlmostEqual(chi2_sf(5.991, 2), 0.05, places=3)
        self.assertAlmostEqual(chi2_sf(0.0, 3), 1.0)

    def test_same_proportions_give_zero_statistic(self) -> None:
        result = chi_square_test({"a": 50, "b": 30, "c": 20}, {"a": 100, "b": 60, "c": 40})
        self.assertAlmostEqual(result.statistic, 0.0)
        self.assertAlmostEqual(result.p_value, 1.0)

    def test_new_category_is_detected(self) -> None:
        result = chi_square_test({"web": 500, "app": 500}, {"web": 200, "app": 200, "kiosk": 100})
        self.assertEqual(result.dof, 2)
        self.assertLess(result.p_value, 1e-6)
        self.assertGreater(result.cramers_v, 0.1)


class WindowAndPolicyTests(unittest.TestCase):
    def test_sliding_window_keeps_latest_items(self) -> None:
        window = SlidingWindow(3)
        for i in range(5):
            window.add({"x": i})
        self.assertTrue(window.full())
        self.assertEqual(window.column("x"), [2, 3, 4])

    def test_alert_needs_consecutive_drift_windows(self) -> None:
        policy = AlertPolicy(n_tests=1, patience=2)
        self.assertIsNone(policy.update("f", "drift"))
        self.assertEqual(policy.update("f", "drift"), "ALERT")
        self.assertIsNone(policy.update("f", "drift"))
        self.assertEqual(policy.update("f", "ok"), "resolved")

    def test_single_drift_window_does_not_alert(self) -> None:
        policy = AlertPolicy(n_tests=1, patience=2)
        outcomes = [policy.update("f", level) for level in ("drift", "ok", "drift", "ok")]
        self.assertNotIn("ALERT", outcomes)

    def test_small_effect_is_a_warning(self) -> None:
        policy = AlertPolicy(n_tests=2)
        self.assertEqual(policy.level({"chi2": 20.0, "p": 1e-4, "v": 0.05}), "warn")
        self.assertEqual(policy.level({"chi2": 90.0, "p": 1e-12, "v": 0.3}), "drift")
        self.assertEqual(policy.level({"psi": 0.3, "ks": 0.2, "ks_p": 1e-9}), "drift")

    def test_monitor_reports_every_feature(self) -> None:
        reference = [{"x": v, "c": "a" if v > 0 else "b"} for v in gaussian(500, 0, 1, 5)]
        window = SlidingWindow(200)
        for v in gaussian(200, 2, 1, 6):
            window.add({"x": v, "c": "a"})
        report = DriftMonitor(reference, ["x"], ["c"]).check(window)
        self.assertGreater(report["x"]["psi"], 0.25)
        self.assertLess(report["c"]["p"], 0.001)


class StreamTests(unittest.TestCase):
    def test_labels_arrive_after_the_delay(self) -> None:
        events = [{"label": 1} for _ in range(100)]
        self.assertIsNone(labeled_accuracy(events, [1] * 100, now=40, size=20, delay=50))
        self.assertEqual(labeled_accuracy(events, [1] * 100, now=80, size=20, delay=50), 1.0)

    def test_monitoring_finds_both_drifts_and_no_early_alert(self) -> None:
        rows, _, _ = run_monitoring(make_stream())
        early = [r for r in rows if r.end <= 3000 and any(n.startswith("ALERT") for n in r.events)]
        self.assertEqual(early, [])
        covariate = first_alert(rows, "amount", 3000)
        concept = first_alert(rows, "accuracy", 6500)
        self.assertIsNotNone(covariate)
        self.assertLessEqual(covariate, 4000)
        self.assertIsNotNone(concept)
        self.assertGreater(concept, 7000)

    def test_concept_drift_is_invisible_to_input_monitors(self) -> None:
        rows, _, _ = run_monitoring(make_stream())
        late = [r for r in rows if r.end > 7000]
        self.assertTrue(all(r.levels["amount"] == "ok" for r in late))
        self.assertTrue(any(r.levels.get("accuracy") == "drift" for r in late))


if __name__ == "__main__":
    unittest.main()
