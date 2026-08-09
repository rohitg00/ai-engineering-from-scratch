#!/usr/bin/env python3
"""Fail-closed coverage checks for hand-authored README translations."""

import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from build_readme_i18n import localize_links, spans  # noqa: E402
from readme_translations import STRUCTURAL_TRANSLATIONS, TRANSLATIONS  # noqa: E402


URL = re.compile(r"(?:\]\(|(?:href|src)=\")[^\"\s)]+")
CODE_SPAN = re.compile(r"`[^`]+`")
TRANSLATABLE_CODE_LABELS = {"`12 lessons`", "`12 уроков`"}


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
                english_code = [span for span in CODE_SPAN.findall(english) if span not in TRANSLATABLE_CODE_LABELS]
                russian_code = [span for span in CODE_SPAN.findall(russian) if span not in TRANSLATABLE_CODE_LABELS]
                self.assertEqual(english_code, russian_code)

    def test_reviewed_structural_text_is_translated_and_current(self):
        source = (ROOT / "README.md").read_text(encoding="utf-8")
        rendered = (ROOT / "i18n/ru/README.md").read_text(encoding="utf-8")
        for english, russian in STRUCTURAL_TRANSLATIONS["ru"].items():
            with self.subTest(line=english):
                self.assertIn(english, source)
                self.assertNotIn(english, rendered)
                self.assertEqual(URL.findall(english), URL.findall(russian))
                self.assertIn(localize_links(russian), rendered)

    def test_critical_curriculum_counts_are_preserved(self):
        for english in self.keys:
            russian = self.translations[english]
            for token in ("20", "503", "388", "99"):
                if re.search(rf"(?<!\d){token}(?!\d)", english):
                    self.assertRegex(russian, rf"(?<!\d){token}(?!\d)")


if __name__ == "__main__":
    unittest.main()
