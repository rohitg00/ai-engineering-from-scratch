import pathlib
import sys
import unittest


CODE_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CODE_DIR))
import main  # noqa: E402


class SessionRecoveryPacketTests(unittest.TestCase):
    def setUp(self):
        self.text = main.ARTIFACT.read_text(encoding="utf-8")

    def test_shipped_packet_is_safe(self):
        self.assertEqual(main.validate_text(self.text)["status"], "safe_to_resume")

    def test_durable_state_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("## Durable State", "## Removed"))["status"], "blocked")

    def test_hash_and_manifest_are_required(self):
        text = self.text.replace("hash", "digest").replace("manifest", "list")
        self.assertTrue(any("checkpoint" in finding for finding in main.validate_text(text)["findings"]))

    def test_unknown_outcome_needs_idempotency(self):
        text = self.text.replace("idempotency", "retry").replace("unknown outcome", "timeout")
        self.assertTrue(any("safe retry" in finding for finding in main.validate_text(text)["findings"]))

    def test_isolated_review_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("isolated", "shared"))["status"], "blocked")

    def test_placeholder_blocks(self):
        self.assertEqual(main.validate_text(self.text + "\nTBD\n")["status"], "blocked")


if __name__ == "__main__":
    unittest.main()
