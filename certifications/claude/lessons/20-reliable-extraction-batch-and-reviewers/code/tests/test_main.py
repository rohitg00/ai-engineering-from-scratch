import pathlib
import sys
import unittest


CODE_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CODE_DIR))
import main  # noqa: E402


class ExtractionReviewReportTests(unittest.TestCase):
    def setUp(self):
        self.text = main.ARTIFACT.read_text(encoding="utf-8")

    def test_shipped_report_is_ready(self):
        self.assertEqual(main.validate_text(self.text)["status"], "ready_for_adjudication")

    def test_all_validation_layers_are_required(self):
        text = self.text.replace("provenance", "citation").replace("Provenance", "Citation")
        self.assertTrue(any("validation" in finding for finding in main.validate_text(text)["findings"]))

    def test_null_state_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("null", "unknown"))["status"], "blocked")

    def test_stable_ids_are_required(self):
        text = self.text.replace("custom_id", "array_position")
        self.assertTrue(any("reconciliation" in finding for finding in main.validate_text(text)["findings"]))

    def test_dated_batch_contract_is_required(self):
        text = self.text.replace("24-hour", "eventual")
        self.assertTrue(any("batch_contract" in finding for finding in main.validate_text(text)["findings"]))

    def test_independent_review_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("independent", "generator"))["status"], "blocked")

    def test_placeholder_blocks(self):
        self.assertEqual(main.validate_text(self.text + "\nTODO\n")["status"], "blocked")


if __name__ == "__main__":
    unittest.main()
