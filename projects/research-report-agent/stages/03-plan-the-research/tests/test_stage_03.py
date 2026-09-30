"""Stage 03 tests: rule planner, Model protocol, replay cassette, fallback.

Lesson: projects/research-report-agent/stages/03-plan-the-research/docs/en.md
Run: python3 scripts/project_test.py research-report-agent --stage 3
"""

import unittest
from pathlib import Path

from report_agent.model import CassetteMiss, ReplayModel
from report_agent.planner import Facet, Plan, build_planner_prompt, plan_research

PROJECT = Path(__file__).resolve().parents[3]
CASSETTE = PROJECT / "fixtures" / "cassettes" / "planner.json"


class RulePlannerTests(unittest.TestCase):
    def test_rule_plan_is_deterministic(self):
        question = (
            "Why is mounting the container socket into an agent container dangerous?"
        )
        self.assertEqual(plan_research(question).facets, plan_research(question).facets)

    def test_facets_have_ids_labels_and_subject_keywords(self):
        plan = plan_research(
            "How does user-space kernel reduce the host attack surface?"
        )
        self.assertIsInstance(plan, Plan)
        self.assertEqual(plan.source, "rules")
        self.assertTrue(2 <= len(plan.facets) <= 4)
        self.assertEqual(
            [f.id for f in plan.facets],
            [f"F{n}" for n in range(1, len(plan.facets) + 1)],
        )
        for facet in plan.facets:
            self.assertIsInstance(facet, Facet)
            self.assertTrue(facet.label)
            self.assertIn("kernel", facet.keywords)

    def test_max_facets_is_respected(self):
        self.assertEqual(
            len(plan_research("What is virtualized containers?", max_facets=2).facets),
            2,
        )

    def test_empty_question_is_rejected(self):
        with self.assertRaises(ValueError):
            plan_research("   ")

    def test_facet_query_combines_question_and_keywords(self):
        facet = plan_research("What does user-space kernel cost?").facets[0]
        self.assertIn(facet.sub_question, facet.query())
        self.assertIn("kernel", facet.query())


class ModelPlannerTests(unittest.TestCase):
    def test_replay_model_returns_recorded_plan(self):
        model = ReplayModel(CASSETTE)
        plan = plan_research(
            "Are command denylists enough to sandbox an agent?", model=model
        )
        self.assertEqual(plan.source, "model")
        self.assertEqual(len(plan.facets), 3)
        self.assertEqual(plan.facets[1].label, "How they fail")
        self.assertIn("interpreter", plan.facets[1].keywords)
        self.assertEqual(len(model.calls), 1)

    def test_prompt_must_match_exactly(self):
        model = ReplayModel(CASSETTE)
        with self.assertRaises(CassetteMiss):
            model.complete(
                build_planner_prompt("a question nobody recorded"), purpose="plan"
            )

    def test_bad_model_output_falls_back_to_rules(self):
        plan = plan_research(
            "What is the stateful sandbox controller for?", model=ReplayModel(CASSETTE)
        )
        self.assertEqual(plan.source, "rules-fallback")
        self.assertTrue(plan.notes)
        self.assertTrue(plan.facets)

    def test_missing_recording_also_falls_back(self):
        plan = plan_research(
            "A question with no recording?", model=ReplayModel(CASSETTE)
        )
        self.assertEqual(plan.source, "rules-fallback")


if __name__ == "__main__":
    unittest.main()
