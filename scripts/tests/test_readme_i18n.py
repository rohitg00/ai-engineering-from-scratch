#!/usr/bin/env python3
"""Fail-closed coverage checks for hand-authored README translations."""

import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from build_readme_i18n import spans  # noqa: E402
from readme_translations import TRANSLATIONS  # noqa: E402


URL = re.compile(r"(?:\]\(|(?:href|src)=\")[^\"\s)]+")
CODE_SPAN = re.compile(r"`[^`]+`")


class RussianReadmeCoverageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        source = (ROOT / "README.md").read_text(encoding="utf-8")
        cls.keys = {span["key"] for span in spans(source)}
        cls.translations = TRANSLATIONS["ru"]

    def test_every_current_readme_block_has_a_russian_translation(self):
        translated = set(self.translations)
        missing = sorted(self.keys - translated)
        stale = sorted(translated - self.keys)
        self.assertEqual([], missing, f"Russian README blocks fall back to English: {missing}")
        self.assertEqual([], stale, f"Russian README translations have stale keys: {stale}")

    def test_urls_and_code_spans_are_preserved(self):
        for english in self.keys:
            russian = self.translations[english]
            with self.subTest(block=english):
                self.assertEqual(URL.findall(english), URL.findall(russian))
                self.assertEqual(CODE_SPAN.findall(english), CODE_SPAN.findall(russian))


if __name__ == "__main__":
    unittest.main()
