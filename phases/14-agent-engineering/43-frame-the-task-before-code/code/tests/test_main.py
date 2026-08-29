import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson43", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


class TaskFrameTests(unittest.TestCase):
    def test_example_is_ready(self):
        self.assertEqual(module.validate(module.example()), [])

    def test_empty_goal_blocks_work(self):
        frame = module.example()
        frame.goal = " "
        self.assertIn("goal is empty", module.validate(frame))

    def test_unsupported_fact_is_reported(self):
        frame = module.example()
        frame.facts = [module.RepositoryFact("A guess", "")]
        self.assertIn("unsupported fact: A guess", module.validate(frame))

    def test_path_overlap_is_reported(self):
        frame = module.example()
        frame.forbidden_paths.append(frame.allowed_paths[0])
        self.assertTrue(any("both allowed and forbidden" in item for item in module.validate(frame)))

    def test_render_includes_evidence_and_unknowns(self):
        text = module.render(module.example())
        self.assertIn("Status: READY", text)
        self.assertIn("app/accounts.py:18", text)
        self.assertIn("case-insensitive", text)


if __name__ == "__main__":
    unittest.main()
