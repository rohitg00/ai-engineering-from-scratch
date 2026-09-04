import pathlib
import sys
import unittest


CODE_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CODE_DIR))
import main  # noqa: E402


class DeliveryHandoffPacketTests(unittest.TestCase):
    def setUp(self):
        self.text = main.ARTIFACT.read_text(encoding="utf-8")

    def test_shipped_packet_is_ready(self):
        self.assertEqual(main.validate_text(self.text)["status"], "ready_for_handoff")

    def test_adr_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("## ADR", "## Removed"))["status"], "blocked")

    def test_rejected_option_and_reversal_are_required(self):
        text = self.text.replace("rejected", "other").replace("Rejected", "Other").replace("reversal", "review").replace("Reversal", "Review")
        self.assertTrue(any("decision" in finding for finding in main.validate_text(text)["findings"]))

    def test_runbook_evidence_is_required(self):
        text = self.text.replace("rollback", "restore").replace("alert", "signal").replace("SLO", "target")
        self.assertTrue(any("operations" in finding for finding in main.validate_text(text)["findings"]))

    def test_tabletop_drill_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("tabletop", "meeting"))["status"], "blocked")

    def test_placeholder_blocks(self):
        self.assertEqual(main.validate_text(self.text + "\nTBD\n")["status"], "blocked")


if __name__ == "__main__":
    unittest.main()
