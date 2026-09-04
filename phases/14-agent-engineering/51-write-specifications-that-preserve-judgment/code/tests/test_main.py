import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson51", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


class SpecificationTests(unittest.TestCase):
    def test_example_is_executable(self):
        self.assertEqual(module.compile_contract(module.example())["status"], "executable")

    def test_every_contract_surface_is_required(self):
        specification = module.example()
        specification.non_goals = []
        self.assertIn("non_goals is empty", module.validate(specification))

    def test_invalid_decision_mode_is_rejected(self):
        specification = module.example()
        specification.decisions = [module.Decision("x", "maybe", "reason")]
        self.assertTrue(any("invalid decision mode" in issue for issue in module.validate(specification)))

    def test_locked_decision_requires_rationale(self):
        specification = module.example()
        specification.decisions = [module.Decision("x", "locked", "")]
        self.assertTrue(any("lacks rationale" in issue for issue in module.validate(specification)))

    def test_compile_separates_agent_and_human_decisions(self):
        result = module.compile_contract(module.example())
        self.assertEqual(len(result["agent_may_decide"]), 1)
        self.assertEqual(len(result["human_checkpoint"]), 1)

    def test_compile_keeps_bounded_decisions_in_the_routing_contract(self):
        result = module.compile_contract(module.example())
        self.assertEqual(
            result["bounded_decisions"],
            [{"question": "How many sources may be queried?", "boundary": "Stop after five sources or two minutes"}],
        )


if __name__ == "__main__":
    unittest.main()
