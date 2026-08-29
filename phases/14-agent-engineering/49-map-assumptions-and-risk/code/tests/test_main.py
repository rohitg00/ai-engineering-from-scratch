import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson49", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


class AssumptionMapTests(unittest.TestCase):
    def test_risk_score_weights_impact_and_uncertainty(self):
        item = module.Assumption("x", 5, 4, 3, "test")
        self.assertEqual(module.risk_score(item), 23)

    def test_invalid_dimension_is_rejected(self):
        with self.assertRaises(ValueError):
            module.risk_score(module.Assumption("x", 0, 4, 3, "test"))

    def test_highest_open_risk_is_next(self):
        self.assertEqual(module.next_experiment(module.example()).statement, "Engineers can identify the right service from alert context")

    def test_tested_assumption_is_not_selected(self):
        selected = module.next_experiment(module.example())
        self.assertFalse(selected.evidence)

    def test_prioritize_marks_evidence_status(self):
        statuses = {item["statement"]: item["status"] for item in module.prioritize(module.example())}
        self.assertEqual(statuses["Two-minute diagnosis matters"], "tested")


if __name__ == "__main__":
    unittest.main()
