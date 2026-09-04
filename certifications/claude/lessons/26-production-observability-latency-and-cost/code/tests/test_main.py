import importlib.util
import pathlib
import sys
import unittest


MODULE_PATH = pathlib.Path(__file__).resolve().parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("telemetry_lab", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class TelemetryLabTests(unittest.TestCase):
    def test_percentile_uses_nearest_rank(self):
        self.assertEqual(MODULE.percentile([10, 20, 30, 40], 0.95), 40.0)

    def test_percentile_rejects_invalid_probability(self):
        with self.assertRaises(ValueError):
            MODULE.percentile([1], 1.1)

    def test_empty_summary_is_explicit(self):
        summary = MODULE.summarize([])
        self.assertEqual(summary["requests"], 0)
        self.assertIsNone(summary["cost_per_task_success_usd"])

    def test_task_success_differs_from_system_success(self):
        traces = [MODULE.Trace("t", "v", 10, 1, 1, 1.0, False, True)]
        summary = MODULE.summarize(traces)
        self.assertEqual(summary["system_success_rate"], 1.0)
        self.assertEqual(summary["task_success_rate"], 0.0)

    def test_cost_per_success_includes_failed_attempt_cost(self):
        traces = [
            MODULE.Trace("a", "v", 10, 1, 1, 1.0, True, True),
            MODULE.Trace("b", "v", 10, 1, 1, 1.0, False, True),
        ]
        self.assertEqual(MODULE.summarize(traces)["cost_per_task_success_usd"], 2.0)

    def test_error_categories_are_counted(self):
        traces = [
            MODULE.Trace("a", "v", 10, 1, 1, 1.0, False, False, error_category="timeout"),
            MODULE.Trace("b", "v", 10, 1, 1, 1.0, False, False, error_category="timeout"),
        ]
        self.assertEqual(MODULE.summarize(traces)["errors"], {"timeout": 2})

    def test_variant_summaries_are_separate(self):
        traces = [
            MODULE.Trace("a", "one", 10, 1, 1, 1.0, True, True),
            MODULE.Trace("b", "two", 20, 1, 1, 2.0, True, True),
        ]
        self.assertEqual(set(MODULE.by_variant(traces)), {"one", "two"})

    def test_objectives_check_quality_latency_and_cost(self):
        summary = {"task_success_rate": 0.9, "p95_ms": 1000.0, "cost_per_task_success_usd": 0.02}
        objectives = MODULE.ServiceObjectives(0.8, 1500, 0.03)
        self.assertEqual(MODULE.evaluate_objectives(summary, objectives), {"task_success": True, "latency": True, "cost": True})


if __name__ == "__main__":
    unittest.main()

