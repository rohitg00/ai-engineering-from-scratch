import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson53", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


class StageDecisionTests(unittest.TestCase):
    def test_no_real_users_or_data_means_prototype(self):
        self.assertEqual(module.choose_stage(module.examples()[0]), "prototype")

    def test_high_consequence_means_pilot(self):
        self.assertEqual(module.choose_stage(module.examples()[1]), "pilot")

    def test_ready_reversible_work_can_be_production(self):
        self.assertEqual(module.choose_stage(module.examples()[2]), "production")

    def test_invalid_consequence_is_rejected(self):
        bad = module.BuildDecision("x", False, False, 0, True, False)
        with self.assertRaises(ValueError):
            module.choose_stage(bad)

    def test_pilot_has_exit_criteria(self):
        self.assertIn("exit criteria", module.required_controls("pilot"))

    def test_production_has_full_lifecycle_controls(self):
        controls = module.required_controls("production")
        for control in ("cost and capacity controls", "recovery", "retirement path"):
            self.assertIn(control, controls)


if __name__ == "__main__":
    unittest.main()
