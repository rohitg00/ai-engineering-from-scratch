import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson52", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


class MeasurementPlanTests(unittest.TestCase):
    def test_example_is_valid(self):
        self.assertEqual(module.validate(module.example()), [])

    def test_outcome_metric_is_required(self):
        plan = module.example()
        plan.metrics = [metric for metric in plan.metrics if metric.kind != "outcome"]
        self.assertIn("outcome metric is missing", module.validate(plan))

    def test_guardrail_metric_is_required(self):
        plan = module.example()
        plan.metrics = [metric for metric in plan.metrics if metric.kind != "guardrail"]
        self.assertIn("guardrail metric is missing", module.validate(plan))

    def test_at_most_threshold_is_inclusive(self):
        metric = module.example().metrics[0]
        self.assertTrue(module.evaluate(metric, 120))

    def test_report_marks_missing_value(self):
        result = module.report(module.example(), {})
        self.assertTrue(all(item["status"] == "missing" for item in result["results"]))

    def test_report_marks_invalid_direction_without_evaluating_it(self):
        plan = module.example()
        plan.metrics[0] = module.Metric("bad_direction", "up", 120, "ten replays", "replay log", "outcome")
        result = module.report(plan, {"bad_direction": 94})
        self.assertEqual(result["status"], "invalid")
        self.assertIn("bad_direction has invalid direction", result["issues"])
        self.assertEqual(result["results"][0], {"name": "bad_direction", "status": "invalid", "value": 94})


if __name__ == "__main__":
    unittest.main()
