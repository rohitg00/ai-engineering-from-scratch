import pathlib
import sys
import unittest


CODE_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CODE_DIR))
import main  # noqa: E402


class OrchestrationContractTests(unittest.TestCase):
    def setUp(self):
        self.text = main.ARTIFACT.read_text(encoding="utf-8")

    def test_shipped_contract_is_ready(self):
        self.assertEqual(main.validate_text(self.text)["status"], "ready_for_dry_run")

    def test_dependency_section_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("## Tasks and Dependencies", "## Removed"))["status"], "blocked")

    def test_partial_state_is_required(self):
        text = self.text.replace("partial", "incomplete").replace("Partial", "Incomplete")
        result = main.validate_text(text)
        self.assertTrue(any("result states" in finding for finding in result["findings"]))

    def test_budget_and_tools_are_required(self):
        text = self.text.replace("budget", "limit").replace("allowed tools", "capabilities")
        self.assertTrue(any("resource boundary" in finding for finding in main.validate_text(text)["findings"]))

    def test_isolated_review_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("isolated", "shared"))["status"], "blocked")

    def test_placeholder_blocks(self):
        self.assertEqual(main.validate_text(self.text + "\nTODO\n")["status"], "blocked")


if __name__ == "__main__":
    unittest.main()
