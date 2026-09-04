"""Tests for lesson 07 workflow handoffs."""

import copy
import pathlib
import sys
import unittest

LESSON = pathlib.Path(__file__).parents[2]
sys.path.insert(0, str(LESSON / "code"))

from main import load_workflow, next_action, validate_workflow


class WorkflowHandoffTests(unittest.TestCase):
    def setUp(self):
        self.workflow = load_workflow(LESSON / "outputs" / "workflow-handoff-packet.json")

    def test_filled_workflow_is_valid(self):
        self.assertEqual(validate_workflow(self.workflow), [])

    def test_each_step_needs_an_owner_and_gate(self):
        broken = copy.deepcopy(self.workflow)
        broken["steps"][0]["owner"] = ""
        broken["steps"][0]["gate"] = ""
        errors = " ".join(validate_workflow(broken))
        self.assertIn("owner", errors)
        self.assertIn("gate", errors)

    def test_irreversible_action_requires_human_approval(self):
        broken = copy.deepcopy(self.workflow)
        broken["steps"][-1]["humanApproval"] = False
        self.assertIn("humanApproval", " ".join(validate_workflow(broken)))

    def test_each_step_needs_a_checkpoint(self):
        broken = copy.deepcopy(self.workflow)
        broken["checkpoints"] = ["one"]
        self.assertIn("checkpoint", " ".join(validate_workflow(broken)))

    def test_handoff_must_offer_all_decisions(self):
        broken = copy.deepcopy(self.workflow)
        broken["handoff"]["actionsAvailable"] = ["approve"]
        self.assertIn("revise", " ".join(validate_workflow(broken)))

    def test_failed_check_recommends_escalation(self):
        self.assertEqual(next_action(self.workflow)["recommendedAction"], "escalate")

    def test_no_failed_checks_can_recommend_approval(self):
        clean = copy.deepcopy(self.workflow)
        clean["handoff"]["checksFailed"] = []
        self.assertEqual(next_action(clean)["recommendedAction"], "approve")


if __name__ == "__main__":
    unittest.main()
