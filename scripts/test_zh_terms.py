#!/usr/bin/env python3
"""Regression checks for the Taiwan-terminology linter.

`--fix` rewrites translations in place, so these tests pin what it must never
touch: code, math and link targets (they mirror the English source), and
compounds that contain an error-tier term but are correct as a whole.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import zh_terms


class Lint(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.docs = self.root / "phases" / "01-x" / "01-y" / "docs"
        self.docs.mkdir(parents=True)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, text: str) -> Path:
        path = self.docs / "zh.md"
        path.write_text(text, encoding="utf-8")
        return path

    def test_fix_rewrites_prose(self):
        p = self.write("把結果緩存起來，付費用戶則調高。\n")
        self.assertEqual(zh_terms.fix(p), 2)
        self.assertEqual(p.read_text(encoding="utf-8"), "把結果快取起來，付費使用者則調高。\n")

    def test_fix_leaves_code_math_and_links(self):
        text = "```python\n# 緩存\n```\n\n用 `緩存` 與 $緩存$，見 [x](a/緩存.md)。\n"
        p = self.write(text)
        self.assertEqual(zh_terms.fix(p), 0)
        self.assertEqual(p.read_text(encoding="utf-8"), text)

    def test_allowed_compounds(self):
        p = self.write("MCP 用戶端重試；這些數字符合論文。\n")
        self.assertEqual(zh_terms.scan(p, zh_terms.ERROR), [])
        self.assertEqual(zh_terms.fix(p), 0)

    def test_longest_term_wins(self):
        p = self.write("讀源代碼。\n")
        zh_terms.fix(p)
        self.assertEqual(p.read_text(encoding="utf-8"), "讀原始碼。\n")

    def test_warn_tier_is_never_fixed(self):
        p = self.write("一個函數與一個算法。\n")
        self.assertEqual(zh_terms.fix(p), 0)
        self.assertEqual(len(zh_terms.scan(p, zh_terms.WARN)), 2)

    def test_quiz_fix_keeps_schema(self):
        quiz = self.docs.parent / "quiz.zh.json"
        quiz.write_text(json.dumps([{"stage": "pre", "question": "用戶端與用戶？",
                                     "options": ["a", "b"], "correct": 1,
                                     "explanation": "示例"}], ensure_ascii=False),
                        encoding="utf-8")
        self.assertEqual(zh_terms.fix(quiz), 2)
        [q] = json.loads(quiz.read_text(encoding="utf-8"))
        self.assertEqual(q["question"], "用戶端與使用者？")
        self.assertEqual(q["correct"], 1)

    def test_standard_headings(self):
        (self.docs / "en.md").write_text(
            "# T\n\n## The Problem\n\n```bash\n## not a heading\n```\n\n## Build It\n\n## Odd Section\n",
            encoding="utf-8")
        p = self.write("# T\n\n## 那個問題\n\n```bash\n## not a heading\n```\n\n## 建構它\n\n## 奇怪的段落\n")
        self.assertEqual([m[1] for m in zh_terms.heading_mismatches(p)], ["The Problem", "Build It"])
        self.assertEqual(zh_terms.fix_headings(p), 2)
        self.assertEqual(p.read_text(encoding="utf-8"),
                         "# T\n\n## 問題所在\n\n```bash\n## not a heading\n```\n\n## 動手實作\n\n## 奇怪的段落\n")

    def test_headings_skipped_when_counts_differ(self):
        (self.docs / "en.md").write_text("## The Problem\n\n## Build It\n", encoding="utf-8")
        p = self.write("## 那個問題\n")
        self.assertEqual(zh_terms.heading_mismatches(p), [])

    def test_type_label(self):
        (self.docs / "en.md").write_text("**Type:** Learn + Build\n", encoding="utf-8")
        p = self.write("**類型：** 學習 + 建構\n")
        self.assertEqual(zh_terms.type_mismatch(p)[3], "學習 + 實作")
        zh_terms.fix_headings(p)
        self.assertEqual(p.read_text(encoding="utf-8"), "**類型：** 學習 + 實作\n")

    def test_unusual_type_left_alone(self):
        (self.docs / "en.md").write_text("**Type:** Build (Capstone)\n", encoding="utf-8")
        self.assertIsNone(zh_terms.type_mismatch(self.write("**類型：** 實作（綜合專案）\n")))

    def test_strict_exit_code(self):
        self.write("付費用戶。\n")
        self.assertEqual(zh_terms.main(["--strict", "--root", str(self.root)]), 1)
        self.write("付費使用者。\n")
        self.assertEqual(zh_terms.main(["--strict", "--root", str(self.root)]), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
