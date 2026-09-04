import pathlib
import sys
import unittest


CODE_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CODE_DIR))
import main  # noqa: E402


class ToolCatalogReviewTests(unittest.TestCase):
    def setUp(self):
        self.text = main.ARTIFACT.read_text(encoding="utf-8")

    def test_shipped_catalog_is_ready(self):
        self.assertEqual(main.validate_text(self.text)["status"], "catalog_ready")

    def test_tool_contracts_are_required(self):
        self.assertEqual(main.validate_text(self.text.replace("## Tool Contracts", "## Removed"))["status"], "blocked")

    def test_authorization_error_is_non_retryable(self):
        text = self.text.replace("authorization", "access").replace("non-retryable", "retryable")
        self.assertTrue(any("errors" in finding for finding in main.validate_text(text)["findings"]))

    def test_positive_and_negative_guidance_are_required(self):
        text = self.text.replace("use when", "choose").replace("do not use", "avoid")
        self.assertTrue(any("selection" in finding for finding in main.validate_text(text)["findings"]))

    def test_progressive_discovery_section_is_required(self):
        self.assertEqual(main.validate_text(self.text.replace("## Progressive Discovery", "## Removed"))["status"], "blocked")

    def test_placeholder_blocks(self):
        self.assertEqual(main.validate_text(self.text + "\nTODO\n")["status"], "blocked")


if __name__ == "__main__":
    unittest.main()
