import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson44", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


class EvidencePlanTests(unittest.TestCase):
    def test_example_has_three_execution_waves(self):
        self.assertEqual(module.execution_waves(module.example()), [["contract"], ["docs", "implementation"], ["integration"]])

    def test_missing_evidence_blocks_plan(self):
        items = [module.WorkItem("a", "change", (), (), "test")]
        self.assertIn("a has no repository evidence", module.validate(items))

    def test_missing_dependency_is_reported(self):
        items = [module.WorkItem("a", "change", ("x:1",), ("missing",), "test")]
        self.assertTrue(any("unknown items" in issue for issue in module.validate(items)))

    def test_execution_waves_rejects_unknown_dependency_before_cycle_detection(self):
        items = [module.WorkItem("a", "change", ("x:1",), ("missing",), "test")]
        with self.assertRaisesRegex(ValueError, "a depends on unknown items: missing"):
            module.execution_waves(items)

    def test_cycle_is_rejected(self):
        items = [
            module.WorkItem("a", "a", ("x:1",), ("b",), "test"),
            module.WorkItem("b", "b", ("x:2",), ("a",), "test"),
        ]
        with self.assertRaisesRegex(ValueError, "dependency cycle"):
            module.execution_waves(items)

    def test_document_keeps_proof_commands(self):
        document = module.plan_document(module.example())
        self.assertEqual(document["status"], "ready")
        self.assertEqual(document["items"][-1]["proof"], "python3 -m unittest")

    def test_invalid_documents_never_emit_execution_waves(self):
        invalid_plans = [
            [module.WorkItem("a", "change", (), (), "test")],
            [
                module.WorkItem("a", "first", ("x:1",), (), "test"),
                module.WorkItem("a", "duplicate", ("x:2",), (), "test"),
            ],
        ]
        for items in invalid_plans:
            with self.subTest(items=items):
                document = module.plan_document(items)
                self.assertEqual(document["status"], "blocked")
                self.assertEqual(document["waves"], [])


if __name__ == "__main__":
    unittest.main()
