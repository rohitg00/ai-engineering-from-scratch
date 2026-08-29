import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson48", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


class WorkflowEvidenceTests(unittest.TestCase):
    def test_example_is_grounded(self):
        self.assertEqual(module.audit(module.example())["status"], "grounded")

    def test_missing_step_evidence_is_reported(self):
        step = module.WorkflowStep(1, "user", "acts", ())
        self.assertIn("step 1 has no evidence", module.audit([step])["issues"])

    def test_non_contiguous_order_is_rejected(self):
        steps = [module.WorkflowStep(2, "user", "acts", (module.Evidence("x", "y", True, 1),))]
        self.assertTrue(any("contiguous" in issue for issue in module.audit(steps)["issues"]))

    def test_reversed_contiguous_order_is_rejected(self):
        evidence = (module.Evidence("x", "y", True, 1),)
        steps = [
            module.WorkflowStep(2, "user", "acts second", evidence),
            module.WorkflowStep(1, "user", "acts first", evidence),
        ]
        self.assertTrue(any("contiguous" in issue for issue in module.audit(steps)["issues"]))

    def test_confidence_range_is_checked(self):
        steps = [module.WorkflowStep(1, "user", "acts", (module.Evidence("x", "y", True, 1.2),))]
        self.assertTrue(any("confidence" in issue for issue in module.audit(steps)["issues"]))

    def test_friction_points_are_extracted(self):
        self.assertEqual(module.audit(module.example())["friction_points"], ["owner lookup", "context switching"])


if __name__ == "__main__":
    unittest.main()
