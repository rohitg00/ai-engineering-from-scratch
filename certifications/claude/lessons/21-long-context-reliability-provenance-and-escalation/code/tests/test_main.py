import pathlib
import sys
import unittest


CODE_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CODE_DIR))
import main  # noqa: E402


class ReliabilityPacketTests(unittest.TestCase):
    def setUp(self):
        self.text = main.ARTIFACT.read_text(encoding="utf-8")

    def test_shipped_packet_is_ready(self):
        self.assertEqual(main.validate_text(self.text)["status"], "ready_for_bounded_review")

    def test_coverage_count_is_required(self):
        text = self.text.replace("18 of 24", "most").replace("omitted", "other")
        self.assertTrue(any("coverage" in finding for finding in main.validate_text(text)["findings"]))

    def test_provenance_location_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("location", "place"))["status"], "blocked")

    def test_conflict_owner_is_required(self):
        text = self.text.replace("owner", "team").replace("safe next action", "follow up")
        self.assertTrue(any("escalation" in finding for finding in main.validate_text(text)["findings"]))

    def test_random_sample_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("random sample", "flagged cases"))["status"], "blocked")

    def test_placeholder_blocks(self):
        self.assertEqual(main.validate_text(self.text + "\nTBD\n")["status"], "blocked")


if __name__ == "__main__":
    unittest.main()
