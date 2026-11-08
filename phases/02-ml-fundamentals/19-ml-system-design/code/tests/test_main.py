"""Tests for the ML system design toolkit."""

from __future__ import annotations

import copy
import math
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    STRONG_DOC,
    WEAK_DOC,
    CostModel,
    LogisticModel,
    Workload,
    apply_rule,
    base_rate_baseline,
    batch_plan,
    choose_serving,
    compare_to_baselines,
    f1_score,
    fit_rule,
    make_churn_data,
    majority_baseline,
    mean_absolute_error,
    mean_baseline,
    online_plan,
    review_design_doc,
    workload_from_doc,
)


class ServingCostTests(unittest.TestCase):
    def test_batch_cost_counts_every_entity_each_run(self) -> None:
        costs = CostModel(batch_dollars_per_million=1.0, lookup_dollars_per_million=0.0, batch_job_hours=1.0)
        plan = batch_plan(Workload("w", 1_000_000, 10, 1, 25, 100), costs)
        self.assertAlmostEqual(plan.predictions_per_day, 1_000_000.0)
        self.assertAlmostEqual(plan.dollars_per_day, 1.0)

    def test_batch_is_infeasible_when_staleness_is_shorter_than_the_job(self) -> None:
        plan = batch_plan(Workload("w", 1000, 10, 1, 0.5, 100), CostModel(batch_job_hours=1.0))
        self.assertFalse(plan.feasible)
        self.assertTrue(math.isinf(plan.dollars_per_day))

    def test_online_replicas_cover_peak_qps(self) -> None:
        costs = CostModel(replica_qps=100, replica_dollars_per_hour=1.0, min_replicas=1)
        plan = online_plan(Workload("w", 10, 10, 250, 1, 100), costs)
        self.assertAlmostEqual(plan.dollars_per_day, 3 * 24.0)

    def test_online_is_infeasible_when_model_is_too_slow(self) -> None:
        plan = online_plan(Workload("w", 10, 10, 5, 1, 20), CostModel(online_latency_ms=35))
        self.assertFalse(plan.feasible)

    def test_choose_serving_prefers_cheaper_feasible_plan(self) -> None:
        best, _ = choose_serving(Workload("nightly", 2_000_000, 300_000, 40, 24, 100))
        self.assertEqual(best.mode, "batch")
        best, _ = choose_serving(Workload("fresh", 5_000_000, 2_000_000, 120, 2, 80))
        self.assertEqual(best.mode, "online")

    def test_choose_serving_returns_none_when_no_plan_fits(self) -> None:
        best, plans = choose_serving(Workload("impossible", 1000, 1000, 10, 0.1, 1))
        self.assertIsNone(best)
        self.assertEqual(len(plans), 2)


class BaselineTests(unittest.TestCase):
    def test_metrics(self) -> None:
        self.assertAlmostEqual(f1_score([1, 1, 0, 0], [1, 0, 1, 0]), 0.5)
        self.assertEqual(f1_score([1, 0], [0, 0]), 0.0)
        self.assertAlmostEqual(mean_absolute_error([1.0, 3.0], [2.0, 2.0]), 1.0)

    def test_trivial_baselines(self) -> None:
        self.assertEqual(majority_baseline([0, 0, 1], 3), [0, 0, 0])
        self.assertEqual(mean_baseline([1.0, 3.0], 2), [2.0, 2.0])
        preds = base_rate_baseline([1, 0, 0, 0], 4000, seed=3)
        self.assertAlmostEqual(sum(preds) / len(preds), 0.25, delta=0.03)

    def test_metrics_reject_length_mismatch(self) -> None:
        with self.assertRaises(ValueError):
            f1_score([1, 0, 1], [1, 0])
        with self.assertRaises(ValueError):
            mean_absolute_error([1.0], [1.0, 2.0])
        with self.assertRaises(ValueError):
            mean_absolute_error([], [])

    def test_fit_rule_separates_close_values(self) -> None:
        rows = [{"x": v} for v in (1.04, 1.06)]
        threshold = fit_rule(rows, [0, 1], "x")
        self.assertEqual(apply_rule(rows, "x", threshold), [0, 1])

    def test_fit_rule_finds_separating_threshold(self) -> None:
        rows = [{"x": v} for v in (1.0, 2.0, 3.0, 8.0, 9.0)]
        threshold = fit_rule(rows, [0, 0, 0, 1, 1], "x")
        self.assertEqual(apply_rule(rows, "x", threshold), [0, 0, 0, 1, 1])

    def test_lift_is_measured_against_the_strongest_baseline(self) -> None:
        y = [1, 1, 0, 0]
        report = compare_to_baselines(
            y, [1, 1, 0, 0], {"weak": [0, 0, 0, 0], "strong": [1, 0, 0, 0]}, f1_score, "F1"
        )
        self.assertEqual(report.best_baseline, "strong")
        self.assertAlmostEqual(report.lift, 1.0 - 2 / 3)
        self.assertTrue(report.beats_baselines)

    def test_lower_is_better_metric(self) -> None:
        report = compare_to_baselines(
            [1.0, 2.0], [1.1, 2.1], {"mean": [1.5, 1.5]}, mean_absolute_error, "MAE", higher_is_better=False
        )
        self.assertAlmostEqual(report.lift, 0.5 - 0.1)

    def test_compare_requires_a_baseline(self) -> None:
        with self.assertRaises(ValueError):
            compare_to_baselines([1], [1], {}, f1_score, "F1")

    def test_model_beats_rule_on_churn_data(self) -> None:
        train_rows, train_y = make_churn_data(1500, seed=1)
        test_rows, test_y = make_churn_data(800, seed=2)
        model = LogisticModel(epochs=150).fit(train_rows, train_y)
        threshold = fit_rule(train_rows, train_y, "days_idle")
        report = compare_to_baselines(
            test_y, model.predict(test_rows),
            {"rule": apply_rule(test_rows, "days_idle", threshold)}, f1_score, "F1",
        )
        self.assertTrue(report.beats_baselines)


class DesignDocTests(unittest.TestCase):
    def test_strong_doc_is_ready(self) -> None:
        review = review_design_doc(STRONG_DOC)
        self.assertEqual(review.verdict, "ready for review")
        self.assertAlmostEqual(review.score, 1.0)
        self.assertEqual(review.failed, [])

    def test_weak_doc_lists_blocking_items_first(self) -> None:
        review = review_design_doc(WEAK_DOC)
        self.assertEqual(review.verdict, "revise")
        self.assertTrue(review.failed[0][1])
        keys = {key for key, _, _ in review.failed}
        self.assertIn("no_leakage", keys)
        self.assertIn("baselines", keys)

    def test_one_blocking_gap_prevents_ready(self) -> None:
        doc = copy.deepcopy(STRONG_DOC)
        doc["failure_modes"][0]["default_action"] = ""
        review = review_design_doc(doc)
        self.assertGreater(review.score, 0.85)
        self.assertEqual(review.verdict, "revise")

    def test_serving_fit_rejects_batch_for_minutes_of_staleness(self) -> None:
        doc = copy.deepcopy(STRONG_DOC)
        doc["serving"]["max_staleness_hours"] = 0.1
        failed = {key for key, _, _ in review_design_doc(doc).failed}
        self.assertIn("serving_fit", failed)

    def test_workload_rejects_negative_and_non_finite_numbers(self) -> None:
        for key, value in (("entities", -1), ("requests_per_day", float("nan")), ("max_staleness_hours", float("inf"))):
            doc = copy.deepcopy(STRONG_DOC)
            doc["serving"][key] = value
            with self.subTest(key=key):
                self.assertIsNone(workload_from_doc(doc))

    def test_malformed_fields_fail_checks_without_errors(self) -> None:
        doc = copy.deepcopy(STRONG_DOC)
        doc["problem"]["ml_task"] = ["regression"]
        doc["baselines"] = [{"kind": ["heuristic"]}]
        doc["serving"]["mode"] = {"batch": True}
        doc["rollout"]["stages"] = [{"name": "shadow"}]
        failed = {key for key, _, _ in review_design_doc(doc).failed}
        self.assertTrue({"ml_task", "baselines", "serving_fit", "rollout"} <= failed)

    def test_infinite_or_boolean_budget_fails(self) -> None:
        for budget in (float("inf"), True):
            doc = copy.deepcopy(STRONG_DOC)
            doc["budgets"]["max_dollars_per_day"] = budget
            with self.subTest(budget=budget):
                failed = {key for key, _, _ in review_design_doc(doc).failed}
                self.assertTrue({"budgets", "serving_fit"} <= failed)

    def test_hybrid_mode_fails_without_a_hybrid_plan(self) -> None:
        doc = copy.deepcopy(STRONG_DOC)
        doc["serving"]["mode"] = "hybrid"
        failed = {key for key, _, _ in review_design_doc(doc).failed}
        self.assertIn("serving_fit", failed)

    def test_workload_from_doc_needs_all_numbers(self) -> None:
        self.assertIsNotNone(workload_from_doc(STRONG_DOC))
        self.assertIsNone(workload_from_doc(WEAK_DOC))


if __name__ == "__main__":
    unittest.main()
