import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson46", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


class FeedbackRatchetTests(unittest.TestCase):
    def test_scope_correction_becomes_scope_control(self):
        self.assertEqual(module.promote(module.example()[0]).target, "scope")

    def test_regression_becomes_test(self):
        self.assertEqual(module.promote(module.example()[1]).target, "test")

    def test_environment_failure_becomes_automation(self):
        self.assertEqual(module.promote(module.example()[2]).target, "automation")

    def test_control_retains_correction_evidence(self):
        correction = module.example()[0]
        control = module.promote(correction)
        self.assertEqual(control.symptom, correction.symptom)
        self.assertEqual(control.cause, correction.cause)
        self.assertEqual(control.recurrence, correction.recurrence)
        self.assertEqual(control.consequence, correction.consequence)

    def test_rules_use_grammatical_cause_phrases(self):
        self.assertEqual(module.promote(module.example()[0]).rule, "Prevent unchecked scope description")
        self.assertEqual(module.promote(module.example()[1]).rule, "Prevent missing executable example for edge case")
        self.assertEqual(module.promote(module.example()[2]).rule, "Prevent implicit environment assumptions")

    def test_duplicate_controls_are_collapsed(self):
        correction = module.example()[0]
        self.assertEqual(len(module.ratchet([correction, correction])), 1)

    def test_zero_recurrence_is_not_promoted(self):
        correction = module.Correction("typo", "one-off", 0, "none")
        self.assertEqual(module.ratchet([correction]), [])


if __name__ == "__main__":
    unittest.main()
