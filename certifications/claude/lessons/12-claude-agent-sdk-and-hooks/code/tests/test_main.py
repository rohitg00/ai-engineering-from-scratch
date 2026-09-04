"""Tests for lesson 12 agent harness policy."""

import copy
import pathlib
import sys
import unittest

LESSON = pathlib.Path(__file__).parents[2]
sys.path.insert(0, str(LESSON / "code"))

from main import (
    ComputerUseGuard,
    EventStreamError,
    consume_managed_events,
    evaluate_action,
    load_policy,
    validate_policy,
)


class AgentHarnessPolicyTests(unittest.TestCase):
    def setUp(self):
        self.policy = load_policy(LESSON / "outputs" / "agent-harness-policy.json")
        self.events = load_policy(LESSON / "outputs" / "managed-agent-event-fixture.json")

    def test_filled_policy_is_valid(self):
        self.assertEqual(validate_policy(self.policy), [])

    def test_mutation_requires_approval(self):
        broken = copy.deepcopy(self.policy)
        broken["tools"][-1]["approvalRequired"] = False
        self.assertIn("mutation requires approval", " ".join(validate_policy(broken)))

    def test_mutation_needs_pre_tool_hook(self):
        broken = copy.deepcopy(self.policy)
        broken["hooks"][0]["tools"].remove("Edit")
        self.assertIn("pre-tool", " ".join(validate_policy(broken)))

    def test_reviewer_must_be_read_only(self):
        broken = copy.deepcopy(self.policy)
        broken["reviewerSubagent"]["canWrite"] = True
        self.assertIn("read-only", " ".join(validate_policy(broken)))

    def test_resume_requires_durable_state(self):
        broken = copy.deepcopy(self.policy)
        broken["durableState"]["fields"].remove("operationIds")
        self.assertIn("durableState", " ".join(validate_policy(broken)))

    def test_final_prose_is_not_a_final_state(self):
        broken = copy.deepcopy(self.policy)
        broken["finalStatePredicate"]["type"] = "final-prose"
        self.assertIn("outside final prose", " ".join(validate_policy(broken)))

    def test_edit_is_denied_without_approval(self):
        self.assertFalse(evaluate_action(self.policy, "Edit", False)["allowed"])
        self.assertTrue(evaluate_action(self.policy, "Edit", True)["allowed"])

    def test_unknown_tool_fails_closed(self):
        self.assertEqual(evaluate_action(self.policy, "Network", True)["reason"], "unknown tool")

    def test_runtime_keeps_application_controls(self):
        broken = copy.deepcopy(self.policy)
        broken["runtimeDecision"]["applicationOwns"].remove("authorization")
        self.assertIn("application-owned", " ".join(validate_policy(broken)))
        broken = copy.deepcopy(self.policy)
        broken["runtimeDecision"]["selected"] = "managed-agents"
        self.assertIn("beta acceptance", " ".join(validate_policy(broken)))

    def test_shipped_event_fixture_reaches_action_and_completion_states(self):
        checkpoint = self.events["events"][: self.events["checkpoint_after"]]
        self.assertEqual(consume_managed_events(checkpoint).to_dict(), self.events["expected_checkpoint"])
        self.assertEqual(consume_managed_events(self.events["events"]).to_dict(), self.events["expected_complete"])

    def test_stream_disconnect_while_running_is_not_completion(self):
        summary = consume_managed_events(self.events["events"][:4])
        self.assertEqual(summary.status, "running")
        self.assertFalse(summary.complete)

    def test_requires_action_must_reference_a_known_event(self):
        broken = copy.deepcopy(self.events["events"][:5])
        broken[-1]["stop_reason"]["event_ids"] = ["evt_missing"]
        with self.assertRaisesRegex(EventStreamError, "known actionable"):
            consume_managed_events(broken)

    def test_replayed_persisted_event_is_deduplicated(self):
        replayed = self.events["events"] + [copy.deepcopy(self.events["events"][-1])]
        self.assertEqual(consume_managed_events(replayed).to_dict(), self.events["expected_complete"])

    def test_computer_action_requires_fresh_before_and_after_screenshots(self):
        guard = ComputerUseGuard(self.policy)
        action = {"action": "left_click", "coordinate": [120, 80], "screenshot_id": "shot-1"}
        self.assertIn("current screenshot", guard.authorize(action, "local-reversible")["reason"])
        self.assertTrue(guard.observe_screenshot("shot-1", 1280, 720)["allowed"])
        self.assertTrue(guard.authorize(action, "local-reversible")["allowed"])
        self.assertTrue(guard.needs_verification)
        self.assertIn("current screenshot", guard.authorize(action, "local-reversible")["reason"])

    def test_computer_coordinates_and_human_boundaries_fail_closed(self):
        guard = ComputerUseGuard(self.policy)
        guard.observe_screenshot("shot-1", 1280, 720)
        missing = {"action": "left_click", "screenshot_id": "shot-1"}
        self.assertIn("requires a coordinate", guard.authorize(missing, "read-only")["reason"])
        model_labeled = {
            "action": "left_click",
            "coordinate": [20, 10],
            "screenshot_id": "shot-1",
            "risk_class": "safe",
        }
        self.assertIn("normalized contract", guard.authorize(model_labeled, "read-only")["reason"])
        outside = {"action": "left_click", "coordinate": [1280, 10], "screenshot_id": "shot-1"}
        self.assertIn("outside", guard.authorize(outside, "read-only")["reason"])
        consequential = {"action": "left_click", "coordinate": [20, 10], "screenshot_id": "shot-1"}
        self.assertIn("human approval", guard.authorize(consequential, "financial-transaction")["reason"])
        self.assertTrue(guard.authorize(consequential, "financial-transaction", approved=True)["allowed"])

        guard.observe_screenshot("shot-2", 1280, 720)
        credential = {"action": "type", "text": "secret", "screenshot_id": "shot-2"}
        self.assertIn("denied", guard.authorize(credential, "credential-entry", approved=True)["reason"])

    def test_computer_tool_cannot_bypass_per_action_policy(self):
        self.assertEqual(evaluate_action(self.policy, "Computer", True)["reason"], "per-action policy required")


if __name__ == "__main__":
    unittest.main()
