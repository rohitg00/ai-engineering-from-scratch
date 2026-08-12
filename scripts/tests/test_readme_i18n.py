#!/usr/bin/env python3
"""Fail-closed coverage checks for hand-authored README translations."""

import hashlib
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from build_readme_i18n import STRUCTURAL, localize_links, spans  # noqa: E402
from readme_translations import STRUCTURAL_TRANSLATIONS, TRANSLATIONS  # noqa: E402


URL = re.compile(r"(?:\]\(|(?:href|src)=\")[^\"\s)]+")
CODE_SPAN = re.compile(r"`[^`]+`")
TRANSLATABLE_CODE_LABELS = {"`12 lessons`", "`12 уроков`"}


class RussianReadmeCoverageTests(unittest.TestCase):
    def test_toolkit_readmes_do_not_use_box_drawing_diagram(self):
        old_tree = "outputs/\n├── prompts/"
        for relative in ("README.md", "i18n/ru/README.md"):
            text = (ROOT / relative).read_text(encoding="utf-8")
            self.assertNotIn(old_tree, text, relative)

    def test_structural_surface_is_fail_closed(self):
        """Any list/table/HTML/heading change requires explicit localization review."""
        rendered = (ROOT / "i18n/ru/README.md").read_text(encoding="utf-8")
        surface = "\n".join(line for line in rendered.splitlines() if STRUCTURAL.match(line)) + "\n"
        self.assertEqual(
            "1a3e086ba4642c0b1e261302057f611b63bc943d6bb332d08d132774290397de",
            hashlib.sha256(surface.encode()).hexdigest(),
        )

    def test_curriculum_ci_runs_this_fail_closed_suite(self):
        workflow = (ROOT / ".github/workflows/curriculum.yml").read_text(encoding="utf-8")
        self.assertEqual(2, workflow.count('- "scripts/tests/test_readme_i18n.py"'))
        self.assertIn("python3 -m unittest scripts.tests.test_readme_i18n -v", workflow)

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
