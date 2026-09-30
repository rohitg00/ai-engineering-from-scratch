"""Stage 05 tests: critic verdicts, poisoned drafts, budget, terminal states.

Lesson: projects/research-report-agent/stages/05-verify-every-claim/docs/en.md
Run: python3 scripts/project_test.py research-report-agent --stage 5
"""

import json
import unittest
from pathlib import Path

from report_agent.critic import (
    Budget,
    BudgetExceeded,
    apply_verdicts,
    decide_state,
    review,
    support_score,
)
from report_agent.corpus import load_corpus
from report_agent.planner import plan_research
from report_agent.search import BM25Index
from report_agent.writer import gather_snippets, to_markdown, write_report

PROJECT = Path(__file__).resolve().parents[3]
CORPUS = PROJECT / "fixtures" / "corpus"
POISONED = PROJECT / "heldout" / "poisoned_drafts.json"


class SupportScoreTests(unittest.TestCase):
    source = "Each microVM runs its own guest kernel."

    def test_verbatim_sentence_is_fully_supported(self):
        self.assertEqual(
            support_score("Each microVM runs its own guest kernel [S1].", self.source)[
                0
            ],
            1.0,
        )

    def test_new_name_mid_sentence_is_unsupported(self):
        score, reason = support_score(
            "Each Hypervisor sandbox runs its own guest kernel [S1].", self.source
        )
        self.assertEqual(score, 0.0)
        self.assertIn("hypervisor", reason)

    def test_negation_mismatch_is_unsupported(self):
        self.assertEqual(
            support_score(
                "Each microVM does not run its own kernel [S1].", self.source
            )[0],
            0.0,
        )


class PoisonedDraftTests(unittest.TestCase):
    def test_every_heldout_draft_gets_the_expected_verdicts(self):
        drafts = json.loads(POISONED.read_text())["drafts"]
        for draft in drafts:
            with self.subTest(draft=draft["id"], attack=draft["attack"]):
                verdicts = review(draft["draft"], draft["snippets"])
                self.assertEqual([v.supported for v in verdicts], draft["expected"])

    def test_unsupported_verdicts_carry_a_reason(self):
        verdicts = review("## A\n\nNo cite here.", {})
        self.assertEqual(verdicts[0].reason, "uncited")


class BudgetAndStateTests(unittest.TestCase):
    def test_budget_counts_and_stops(self):
        budget = Budget(max_steps=2, max_tokens=100)
        budget.charge("plan", 40)
        budget.charge("write", 50)
        with self.assertRaises(BudgetExceeded):
            budget.charge("verify", 1)
        self.assertEqual(budget.to_dict()["used_tokens"], 90)

    def test_token_budget(self):
        with self.assertRaises(BudgetExceeded):
            Budget(max_steps=10, max_tokens=10).charge("gather", 11)

    def test_terminal_states(self):
        good = review(
            "## A\n\nEach microVM runs its own guest kernel [S1].",
            {"S1": "Each microVM runs its own guest kernel."},
        )
        mixed = review(
            "## A\n\nEach microVM runs its own guest kernel [S1]. Nothing is shared [S1].",
            {"S1": "Each microVM runs its own guest kernel."},
        )
        self.assertEqual(decide_state(good), "completed")
        self.assertEqual(decide_state(mixed), "needs_review")
        self.assertEqual(decide_state([]), "failed")
        self.assertEqual(decide_state(good, budget_exceeded=True), "failed")


class ApplyVerdictsTests(unittest.TestCase):
    def test_unsupported_sentences_are_dropped_from_the_report(self):
        index = BM25Index(load_corpus(CORPUS))
        plan = plan_research(
            "How does user-space kernel reduce the host attack surface?"
        )
        report = write_report(plan, gather_snippets(plan, index))
        markdown = (
            to_markdown(report)
            + "\nThe microVM monitor team wrote user-space kernel in Rust [S1].\n"
        )
        verdicts = review(markdown, report.snippets)
        cleaned = apply_verdicts(report, verdicts)
        self.assertEqual(sum(not v.supported for v in verdicts), 1)
        self.assertEqual(cleaned.sentence_count(), report.sentence_count())
        self.assertNotIn("Rust", to_markdown(cleaned))


if __name__ == "__main__":
    unittest.main()
