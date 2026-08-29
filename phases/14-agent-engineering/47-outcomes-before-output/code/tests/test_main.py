import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson47", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


class OutcomeFrameTests(unittest.TestCase):
    def test_example_is_ready(self):
        self.assertEqual(module.decision(module.example())["status"], "ready-to-discover")

    def test_next_question_is_grammatical(self):
        question = module.decision(module.example())["next_question"]
        self.assertEqual(
            question,
            "What evidence would show that the desired outcome was achieved for the on-call engineer?",
        )

    def test_missing_user_is_rejected(self):
        frame = module.example()
        frame.user = ""
        self.assertIn("user is empty", module.validate(frame))

    def test_constraints_are_required(self):
        frame = module.example()
        frame.constraints = []
        self.assertIn("constraints are empty", module.validate(frame))

    def test_non_goals_are_required(self):
        frame = module.example()
        frame.non_goals = []
        self.assertIn("non-goals are empty", module.validate(frame))

    def test_solution_leakage_is_detected(self):
        frame = module.example()
        frame.desired_outcome = "Uses the incident assistant"
        self.assertTrue(any("proposed output" in issue for issue in module.validate(frame)))


if __name__ == "__main__":
    unittest.main()
