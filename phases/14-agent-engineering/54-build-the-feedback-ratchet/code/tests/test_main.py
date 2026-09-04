import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson54", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


class FeedbackRatchetTests(unittest.TestCase):
    def test_missing_context_routes_to_context(self):
        self.assertEqual(module.destination(module.example()[0]), "context")

    def test_unsafe_action_routes_to_policy(self):
        self.assertEqual(module.destination(module.example()[1]), "policy")

    def test_false_positive_routes_to_evaluation(self):
        self.assertEqual(module.destination(module.example()[2]), "evaluation")

    def test_backlog_sorts_by_priority(self):
        priorities = [item.priority for item in module.backlog(module.example())]
        self.assertEqual(priorities, sorted(priorities, reverse=True))

    def test_every_action_names_an_artifact_and_verification_evidence(self):
        for action in module.backlog(module.example()):
            self.assertTrue(action.durable_artifact)
            self.assertTrue(action.verification_evidence)

    def test_invalid_signal_is_rejected(self):
        signal = module.Signal("x", "y", 0, 1, "owner", 30)
        with self.assertRaises(ValueError):
            module.promote(signal)


if __name__ == "__main__":
    unittest.main()
