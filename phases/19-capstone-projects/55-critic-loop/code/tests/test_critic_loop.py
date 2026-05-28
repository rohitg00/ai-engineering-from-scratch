"""critic loop の tests: monotone improvement、target/plateau/budget verdicts、trace shape。"""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    DIMENSIONS,
    Critique,
    CriticLoop,
    MiniPaper,
    MiniSection,
    Suggestion,
    deterministic_critic,
    deterministic_reviser,
    deterministic_score,
    make_deterministic_critic_pair,
)


class TestScoring(unittest.TestCase):
    def test_score_keys_match_dimensions(self) -> None:
        paper = MiniPaper(title="t", abstract="a")
        scores = deterministic_score(paper)
        self.assertEqual(set(scores.keys()), set(DIMENSIONS))

    def test_score_each_in_zero_ten(self) -> None:
        paper = MiniPaper(
            title="t", abstract="a",
            sections=[MiniSection(id="s1", title="S1", body="x" * 1000)],
            originality_tag="high",
        )
        for v in deterministic_score(paper).values():
            self.assertGreaterEqual(v, 0.0)
            self.assertLessEqual(v, 10.0)

    def test_originality_tag_drives_novelty(self) -> None:
        low = MiniPaper(title="t", abstract="a", originality_tag="low")
        med = MiniPaper(title="t", abstract="a", originality_tag="medium")
        hi = MiniPaper(title="t", abstract="a", originality_tag="high")
        self.assertLess(
            deterministic_score(low)["novelty"],
            deterministic_score(med)["novelty"],
        )
        self.assertLess(
            deterministic_score(med)["novelty"],
            deterministic_score(hi)["novelty"],
        )


class TestCritic(unittest.TestCase):
    def test_critic_emits_suggestions_for_below_target(self) -> None:
        paper = MiniPaper(title="t", abstract="a", originality_tag="low")
        c = deterministic_critic(paper, 1)
        self.assertEqual(c.round, 1)
        self.assertEqual(set(c.scores.keys()), set(DIMENSIONS))
        dims = {s.dimension for s in c.suggestions}
        self.assertIn("novelty", dims)


class TestConvergence(unittest.TestCase):
    def test_monotone_improvement_after_one_round(self) -> None:
        paper = MiniPaper(
            title="t", abstract="a",
            sections=[MiniSection(id="intro", title="Introduction", body="x")],
            originality_tag="low",
        )
        critic, reviser = make_deterministic_critic_pair()
        c1 = critic(paper, 1)
        reviser(paper, c1.suggestions)
        c2 = critic(paper, 2)
        self.assertGreater(c2.mean(), c1.mean())

    def test_target_convergence(self) -> None:
        paper = MiniPaper(
            title="t", abstract="a",
            sections=[MiniSection(id="intro", title="Introduction", body="short")],
            originality_tag="low",
        )
        loop = CriticLoop(
            critic=deterministic_critic,
            reviser=deterministic_reviser,
            max_rounds=6,
            target_score=8.0,
        )
        result = loop.run(paper)
        self.assertEqual(result.status, "converged")
        self.assertEqual(result.reason, "target")
        for v in result.final_scores.values():
            self.assertGreaterEqual(v, 8.0)

    def test_budget_exhaustion_when_no_progress(self) -> None:
        def stuck_critic(paper: MiniPaper, round_: int) -> Critique:
            scores = {d: 4.0 for d in DIMENSIONS}
            return Critique(round=round_, scores=scores,
                            suggestions=[Suggestion(dimension="clarity",
                                                    target_section_id=None,
                                                    edit="no-op")],
                            reason="stuck")

        def no_op_reviser(paper: MiniPaper, suggestions: list[Suggestion]) -> MiniPaper:
            return paper

        loop = CriticLoop(
            critic=stuck_critic, reviser=no_op_reviser,
            max_rounds=3, target_score=8.0, plateau_epsilon=0.01,
        )
        paper = MiniPaper(title="t", abstract="a")
        result = loop.run(paper)
        self.assertIn(result.reason, ("plateau", "budget"))
        self.assertLessEqual(result.rounds_used, 3)

    def test_plateau_detected_when_mean_stable(self) -> None:
        seq = [
            {d: 5.0 for d in DIMENSIONS},
            {d: 5.05 for d in DIMENSIONS},
            {d: 5.07 for d in DIMENSIONS},
            {d: 5.08 for d in DIMENSIONS},
        ]

        def slow_critic(paper: MiniPaper, round_: int) -> Critique:
            idx = min(round_ - 1, len(seq) - 1)
            return Critique(round=round_, scores=dict(seq[idx]),
                            suggestions=[Suggestion(dimension="clarity",
                                                    target_section_id=None,
                                                    edit="no-op")],
                            reason="slow")

        def no_op_reviser(paper: MiniPaper, suggestions: list[Suggestion]) -> MiniPaper:
            return paper

        loop = CriticLoop(
            critic=slow_critic, reviser=no_op_reviser,
            max_rounds=5, target_score=9.0, plateau_epsilon=0.1, plateau_window=2,
        )
        result = loop.run(MiniPaper(title="t", abstract="a"))
        self.assertEqual(result.reason, "plateau")
        self.assertEqual(result.trace[-1].verdict, "plateau")


class TestTrace(unittest.TestCase):
    def test_trace_shape(self) -> None:
        paper = MiniPaper(
            title="t", abstract="a",
            sections=[MiniSection(id="intro", title="Introduction", body="x")],
        )
        loop = CriticLoop(
            critic=deterministic_critic, reviser=deterministic_reviser,
            max_rounds=6, target_score=8.0,
        )
        result = loop.run(paper)
        self.assertGreaterEqual(len(result.trace), 1)
        for ev in result.trace:
            self.assertIn(ev.verdict, ("continue", "target", "plateau", "budget"))
            self.assertEqual(set(ev.scores.keys()), set(DIMENSIONS))
            self.assertIsInstance(ev.mean, float)


class TestReviser(unittest.TestCase):
    def test_revision_applies_targeted_edit(self) -> None:
        paper = MiniPaper(
            title="t", abstract="a",
            sections=[MiniSection(id="intro", title="Introduction", body="")],
        )
        before = paper.sections[0].body
        deterministic_reviser(paper, [Suggestion(
            dimension="clarity", target_section_id="intro", edit="expand-body",
        )])
        self.assertGreater(len(paper.sections[0].body), len(before))

    def test_bump_originality_climbs(self) -> None:
        paper = MiniPaper(title="t", abstract="a", originality_tag="low")
        deterministic_reviser(paper, [Suggestion(
            dimension="novelty", target_section_id=None, edit="bump-originality",
        )])
        self.assertEqual(paper.originality_tag, "medium")
        deterministic_reviser(paper, [Suggestion(
            dimension="novelty", target_section_id=None, edit="bump-originality",
        )])
        self.assertEqual(paper.originality_tag, "high")


if __name__ == "__main__":
    unittest.main()
