import pathlib
import sys
import unittest


CODE_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CODE_DIR))
import main  # noqa: E402


class DiscoveryBriefTests(unittest.TestCase):
    def setUp(self):
        self.text = main.ARTIFACT.read_text(encoding="utf-8")

    def test_shipped_brief_is_ready(self):
        self.assertEqual(main.validate_text(self.text)["status"], "ready_for_architecture")

    def test_baseline_and_target_are_required(self):
        text = self.text.replace("baseline", "current").replace("Baseline", "Current").replace("target", "goal").replace("Target", "Goal")
        self.assertTrue(any("outcome" in finding for finding in main.validate_text(text)["findings"]))

    def test_sli_and_slo_are_required(self):
        text = self.text.replace("SLI", "metric").replace("SLO", "objective")
        self.assertTrue(any("service levels" in finding for finding in main.validate_text(text)["findings"]))

    def test_assumptions_section_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("## Assumptions", "## Removed"))["status"], "blocked")

    def test_non_goal_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("autonomous sending", "manual sending"))["status"], "blocked")

    def test_placeholder_blocks(self):
        self.assertEqual(main.validate_text(self.text + "\nTODO\n")["status"], "blocked")


if __name__ == "__main__":
    unittest.main()
