import json
import tempfile
import unittest
from pathlib import Path

from scripts.localize_curriculum import (
    Source, apply_bundle, make_bundle, protect, validate_pair,
)


class LocalizationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "phases/01-phase/01-lesson/docs/en.md"
        self.source.parent.mkdir(parents=True)
        self.source.write_text(
            "# Build `softmax`\n\nSee https://example.com/a and $x+y$.\n\n"
            "```python\nvalue = softmax(x)\n```\n"
        )
        self.item = Source(self.source, self.source.with_name("tr.md"))

    def tearDown(self):
        self.temp.cleanup()

    def test_protects_inline_code_url_and_equation(self):
        value, tokens = protect("Use `x` at https://example.com for $a+b$.")
        self.assertEqual(value, "Use {{P0}} at {{P1}} for {{P2}}.")
        self.assertEqual(tokens, ["`x`", "https://example.com", "$a+b$"])

    def test_bundle_excludes_fenced_code(self):
        bundle = make_bundle([self.item], self.root)
        serialized = json.dumps(bundle)
        self.assertNotIn("value = softmax(x)", serialized)

    def test_apply_restores_protected_tokens(self):
        bundle = make_bundle([self.item], self.root)
        for unit in bundle["files"][0]["units"]:
            unit["translation"] = unit["translation"].replace("Build", "Kur")
        apply_bundle(bundle, self.root)
        result = self.item.target.read_text()
        self.assertIn("Kur `softmax`", result)
        self.assertIn("value = softmax(x)", result)

    def test_apply_rejects_missing_placeholder(self):
        bundle = make_bundle([self.item], self.root)
        bundle["files"][0]["units"][0]["translation"] = "# Kur"
        with self.assertRaisesRegex(ValueError, "protected placeholders"):
            apply_bundle(bundle, self.root)

    def test_apply_rejects_stale_source(self):
        bundle = make_bundle([self.item], self.root)
        self.source.write_text(self.source.read_text() + "\nChanged\n")
        with self.assertRaisesRegex(ValueError, "source changed"):
            apply_bundle(bundle, self.root)

    def test_validation_detects_code_change(self):
        self.item.target.write_text(self.source.read_text().replace("softmax(x)", "softmax(y)"))
        with self.assertRaisesRegex(ValueError, "fenced code"):
            validate_pair(self.source, self.item.target)


if __name__ == "__main__":
    unittest.main()
