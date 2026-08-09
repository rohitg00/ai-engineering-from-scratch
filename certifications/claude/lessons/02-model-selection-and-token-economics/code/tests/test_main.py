"""Tests for lesson 02 model routing economics."""

import copy
import pathlib
import sys
import unittest

LESSON = pathlib.Path(__file__).parents[2]
sys.path.insert(0, str(LESSON / "code"))

from main import (
    load_benchmark,
    load_mode_trials,
    summarize,
    summarize_mode_trials,
    validate_benchmark,
    validate_mode_trials,
)


class RoutingBenchmarkTests(unittest.TestCase):
    def setUp(self):
        self.benchmark = load_benchmark(LESSON / "outputs" / "model-routing-benchmark.json")
        self.mode_trials = load_mode_trials(LESSON / "outputs" / "mode-trials.json")

    def test_filled_benchmark_is_valid(self):
        self.assertEqual(validate_benchmark(self.benchmark), [])

    def test_exactly_ten_cases_are_required(self):
        broken = copy.deepcopy(self.benchmark)
        broken["cases"].pop()
        self.assertIn("exactly ten", " ".join(validate_benchmark(broken)))

    def test_case_ids_must_be_unique(self):
        broken = copy.deepcopy(self.benchmark)
        broken["cases"][1]["id"] = broken["cases"][0]["id"]
        self.assertIn("unique", " ".join(validate_benchmark(broken)))

    def test_consequential_case_requires_human_review(self):
        broken = copy.deepcopy(self.benchmark)
        broken["cases"][-1]["humanReview"] = False
        self.assertIn("humanReview", " ".join(validate_benchmark(broken)))

    def test_cost_total_must_reconcile(self):
        broken = copy.deepcopy(self.benchmark)
        broken["routingComparison"]["routedCostUnits"] = 3
        self.assertIn("case total", " ".join(validate_benchmark(broken)))

    def test_unknown_model_is_rejected(self):
        broken = copy.deepcopy(self.benchmark)
        broken["cases"][0]["chosenModel"] = "mystery"
        self.assertIn("unknown model", " ".join(validate_benchmark(broken)))

    def test_summary_reports_savings_and_review(self):
        summary = summarize(self.benchmark)
        self.assertEqual(summary["caseCount"], 10)
        self.assertEqual(summary["costSavedUnits"], 16)
        self.assertEqual(summary["humanReviewCases"], 1)

    def test_filled_mode_trials_are_valid(self):
        self.assertEqual(validate_mode_trials(self.mode_trials), [])

    def test_supported_modes_require_repeated_runs(self):
        broken = copy.deepcopy(self.mode_trials)
        broken["configurations"][0]["runs"].pop()
        self.assertIn("repeated runs", " ".join(validate_mode_trials(broken)))

    def test_mode_summary_must_reconcile_with_runs(self):
        broken = copy.deepcopy(self.mode_trials)
        broken["configurations"][1]["summary"]["p95LatencyMs"] = 1
        self.assertIn("summary must reconcile", " ".join(validate_mode_trials(broken)))

    def test_unsupported_mode_is_rejected_without_a_trial(self):
        broken = copy.deepcopy(self.mode_trials)
        broken["configurations"][-1]["runs"].append(copy.deepcopy(broken["configurations"][0]["runs"][0]))
        self.assertIn("rejected without trial runs", " ".join(validate_mode_trials(broken)))

    def test_docs_supported_fast_mode_requires_request_prerequisites(self):
        broken = copy.deepcopy(self.mode_trials)
        fast = next(
            configuration
            for configuration in broken["configurations"]
            if configuration["id"] == "opus-fast-medium"
        )
        fast.pop("requestRequirements")
        self.assertIn("fast-mode request requirements", " ".join(validate_mode_trials(broken)))

    def test_measurements_must_not_imply_live_provider_runs(self):
        broken = copy.deepcopy(self.mode_trials)
        broken["measurementStatus"] = "provider-benchmark"
        self.assertIn("illustrative measurements", " ".join(validate_mode_trials(broken)))

    def test_mode_support_needs_current_official_evidence(self):
        broken = copy.deepcopy(self.mode_trials)
        broken["verificationPolicy"]["sources"][0]["sourceUrl"] = "https://example.test/sampling"
        broken["configurations"][0]["support"]["verifiedOn"] = "2025-01-01"
        errors = " ".join(validate_mode_trials(broken))
        self.assertIn("current", errors)
        self.assertIn("official", errors)

    def test_selected_mode_must_clear_quality_latency_and_cost(self):
        broken = copy.deepcopy(self.mode_trials)
        broken["selectedConfiguration"] = "opus-fast-medium"
        self.assertIn("least costly passing mode", " ".join(validate_mode_trials(broken)))

    def test_mode_trials_compare_thinking_choices(self):
        broken = copy.deepcopy(self.mode_trials)
        for configuration in broken["configurations"]:
            configuration["settings"]["thinking"] = "adaptive"
        self.assertIn("thinking choices", " ".join(validate_mode_trials(broken)))

    def test_mode_summary_reports_the_selected_tradeoff(self):
        summary = summarize_mode_trials(self.mode_trials)
        self.assertEqual(summary["selectedConfiguration"], "sonnet-standard-high")
        self.assertEqual(summary["minimumQuality"], 0.96)
        self.assertEqual(summary["p95LatencyMs"], 7600)
        self.assertEqual(summary["meanCostUnits"], 3.0)
        self.assertEqual(summary["supportedConfigurations"], 5)


if __name__ == "__main__":
    unittest.main()
