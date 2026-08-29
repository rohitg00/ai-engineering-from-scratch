import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson45", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


class DelegationTests(unittest.TestCase):
    def test_example_is_safe(self):
        self.assertEqual(module.delegation_plan(module.example())["status"], "ready")

    def test_parent_and_child_paths_overlap(self):
        self.assertTrue(module.paths_overlap("app/api", "app/api/routes.py"))

    def test_sibling_paths_do_not_overlap(self):
        self.assertFalse(module.paths_overlap("app/api", "app/models"))

    def test_conflicting_ownership_blocks_plan(self):
        units = [
            module.WorkUnit("a", "one", ("app",), (), "test"),
            module.WorkUnit("b", "two", ("app/api.py",), (), "test"),
        ]
        self.assertEqual(module.delegation_plan(units)["status"], "blocked")

    def test_dependencies_create_merge_wave(self):
        self.assertEqual(module.waves(module.example()), [["api", "docs"], ["integration"]])

    def test_duplicate_work_unit_ids_block_the_plan(self):
        units = [
            module.WorkUnit("api", "one", ("app/api.py",), (), "test"),
            module.WorkUnit("api", "two", ("tests/test_api.py",), (), "test"),
        ]
        result = module.delegation_plan(units)
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["duplicate_ids"], ["api"])
        self.assertEqual(result["waves"], [])


if __name__ == "__main__":
    unittest.main()
