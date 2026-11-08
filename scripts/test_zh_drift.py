#!/usr/bin/env python3
"""Regression checks for the zh translation drift reporter.

The reporter's one judgement call is the math/content split: upstream's KaTeX
migration rewrote hundreds of `π_θ` code spans as $\\pi_\\theta$, and a drift
report that called every one of them a content change would bury the factual
corrections a translator must actually port. These tests pin that split, and
run the full baseline logic against a throwaway git repository.
"""

from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

import zh_drift


def diff(before: str, after: str) -> str:
    return f"@@ -1 +1 @@\n-{before}\n+{after}\n"


class Classify(unittest.TestCase):
    def test_code_span_to_latex_is_math(self):
        self.assertEqual(zh_drift.classify(diff(
            "Initialize `π_θ` from `π_SFT` with `β` near `0.01`.",
            r"Initialize $\pi_\theta$ from $\pi_{\text{SFT}}$ with $\beta$ near 0.01.",
        ))[0], "math")

    def test_operator_names_survive(self):
        self.assertEqual(zh_drift.classify(diff(
            "compute `log π_θ(token | prompt)`",
            r"compute $\log \pi_\theta(\text{token} \mid \text{prompt})$",
        ))[0], "math")

    def test_ellipsis_and_times(self):
        self.assertEqual(zh_drift.classify(diff(
            "total is `5×3 + 30` for `x_1..x_k`",
            r"total is $5 \times 3 + 30$ for $x_1 \ldots x_k$",
        ))[0], "math")

    def test_plain_text_formula_to_math_fence(self):
        d = ("@@ -1,3 +1,4 @@\n-```\n-m_hat = m_t / (1 - beta1^t)\n-w = w - lr * m_hat\n"
             "+```math\n+\\begin{aligned}\n+\\hat{m} &= \\frac{m_t}{1 - \\beta_1^t} \\\\\n"
             "+w &= w - \\text{lr} \\cdot \\hat{m}\n+\\end{aligned}\n")
        self.assertEqual(zh_drift.classify(d)[0], "math")

    def test_scientific_notation(self):
        self.assertEqual(zh_drift.classify(diff("epsilon = 1e-8", r"$\epsilon = 10^{-8}$"))[0], "math")

    def test_reworded_sentence_is_content(self):
        self.assertEqual(zh_drift.classify(diff(
            "If it creeps past 5-10, the policy has drifted.",
            "If it creeps past 5-10 per response, the policy has drifted; raise beta.",
        ))[0], "content")

    def test_changed_number_is_content(self):
        self.assertEqual(zh_drift.classify(diff(
            "takes ~30 ms on an H100",
            "takes ~20 ms on an H100",
        ))[0], "content")

    def test_mixed_hunks_count_separately(self):
        d = diff("`α` rate", r"$\alpha$ rate") + diff("old claim", "new claim")
        self.assertEqual(zh_drift.classify(d), ("content", 1, 1))


class Baseline(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)
        self.lesson = self.repo / "phases" / "01-x" / "01-y"
        (self.lesson / "docs").mkdir(parents=True)
        self.git("init", "-q")
        self.git("config", "user.email", "t@example.com")
        self.git("config", "user.name", "t")

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        subprocess.run(["git", *args], cwd=self.repo, check=True, capture_output=True)

    def commit(self, files: dict[str, str], msg: str):
        for name, text in files.items():
            (self.lesson / name).write_text(text, encoding="utf-8")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", msg)

    def test_fresh_translation_reports_nothing(self):
        self.commit({"docs/en.md": "# T\n\nA claim.\n", "docs/zh.md": "# T\n\n一個主張。\n"}, "both")
        self.assertEqual(zh_drift.drift(self.lesson, None, self.repo), [])

    def test_english_change_after_translation_is_drift(self):
        self.commit({"docs/en.md": "# T\n\nA claim.\n", "docs/zh.md": "# T\n\n一個主張。\n"}, "both")
        self.commit({"docs/en.md": "# T\n\nA corrected claim.\n"}, "fix: correct the claim")
        [row] = zh_drift.drift(self.lesson, None, self.repo)
        self.assertEqual(row["kind"], "content")
        self.assertEqual(row["file"], "docs/zh.md")
        self.assertIn("fix: correct the claim", row["commits"][0])

    def test_translation_update_resets_baseline(self):
        self.commit({"docs/en.md": "# T\n\nA claim.\n", "docs/zh.md": "# T\n\n一個主張。\n"}, "both")
        self.commit({"docs/en.md": "# T\n\nA corrected claim.\n"}, "fix")
        self.commit({"docs/zh.md": "# T\n\n一個修正後的主張。\n"}, "sync zh")
        self.assertEqual(zh_drift.drift(self.lesson, None, self.repo), [])

    def test_no_sync_commit_is_not_a_baseline(self):
        self.commit({"docs/en.md": "# T\n\nA claim.\n", "docs/zh.md": "# T\n\n一個主張。\n"}, "both")
        self.commit({"docs/en.md": "# T\n\nA corrected claim.\n"}, "fix")
        self.commit({"docs/zh.md": "# T\n\n一個主張！\n"}, "style: punctuation sweep\n\nZh-Sync: none")
        [row] = zh_drift.drift(self.lesson, None, self.repo)
        self.assertEqual(row["kind"], "content")

    def test_quiz_pair_is_tracked(self):
        self.commit({"quiz.json": "[1]\n", "quiz.zh.json": "[1]\n", "docs/en.md": "x\n"}, "quiz")
        self.commit({"quiz.json": "[2]\n"}, "fix quiz")
        [row] = zh_drift.drift(self.lesson, None, self.repo)
        self.assertEqual(row["file"], "quiz.zh.json")


if __name__ == "__main__":
    unittest.main(verbosity=2)
