"""Stage 07 tests: citation precision, source recall, fact coverage, scorecard.

Lesson: projects/research-report-agent/stages/07-score-the-report/docs/en.md
Run: python3 scripts/project_test.py research-report-agent --stage 7
"""

import unittest
from pathlib import Path

from report_agent.evaluate import (
    Scorecard,
    QuestionScore,
    citation_precision,
    evaluate,
    fact_coverage,
    format_scorecard,
    source_recall,
)
from report_agent.snippets import Snippet
from report_agent.writer import CitedSentence, Report, Section

PROJECT = Path(__file__).resolve().parents[3]
CORPUS = PROJECT / "fixtures" / "corpus"
HELDOUT = PROJECT / "heldout" / "questions.json"


def toy_report():
    snippets = {
        "S1": Snippet(
            "S1",
            "05-microvm-monitor",
            0,
            39,
            "Each microVM runs its own guest kernel.",
            1.0,
        ),
        "S2": Snippet(
            "S2",
            "04-user-space-kernel",
            0,
            45,
            "user-space kernel is an application kernel written in Go.",
            1.0,
        ),
    }
    sections = [
        Section(
            "F1",
            "Overview",
            [
                CitedSentence("Each microVM runs its own guest kernel.", ("S1",)),
                CitedSentence("Every VM is written in Go.", ("S2",)),
            ],
        )
    ]
    return Report("q", sections, snippets)


class MetricTests(unittest.TestCase):
    def test_citation_precision(self):
        self.assertEqual(citation_precision(toy_report()), 0.5)

    def test_source_recall(self):
        report = toy_report()
        self.assertEqual(
            source_recall(report, ["05-microvm-monitor", "11-disposable-sessions"]), 0.5
        )
        self.assertEqual(source_recall(report, []), 1.0)

    def test_fact_coverage(self):
        report = toy_report()
        self.assertEqual(fact_coverage(report, [["own", "kernel"], ["kvm"]]), 0.5)

    def test_score_is_weighted_mean(self):
        card = Scorecard([QuestionScore("a", "q", 1.0, 0.5, 0.0, "completed")])
        self.assertEqual(card.score(), 55.0)


class HeldoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.card = evaluate(HELDOUT, CORPUS)

    def test_every_heldout_question_is_scored(self):
        self.assertEqual(len(self.card.questions), 6)

    def test_published_reports_are_honest(self):
        self.assertGreaterEqual(self.card.mean("citation_precision"), 0.9)

    def test_reports_are_useful(self):
        self.assertGreaterEqual(self.card.mean("source_recall"), 0.6)
        self.assertGreaterEqual(self.card.mean("fact_coverage"), 0.4)
        self.assertGreaterEqual(self.card.score(), 70.0)

    def test_scorecard_prints_the_final_number(self):
        text = format_scorecard(self.card)
        self.assertIn("score", text)
        self.assertIn("h1", text)


if __name__ == "__main__":
    unittest.main()
