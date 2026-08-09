import pathlib
import sys
import unittest


CODE_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CODE_DIR))
import main  # noqa: E402


class TeamConfigurationReviewTests(unittest.TestCase):
    def setUp(self):
        self.text = main.ARTIFACT.read_text(encoding="utf-8")

    def test_shipped_review_is_ready(self):
        self.assertEqual(main.validate_artifact()["status"], "ready_for_team_review")

    def test_missing_scope_blocks(self):
        result = main.validate_text(self.text.replace("## Scope", "## Removed", 1))
        self.assertEqual(result["status"], "blocked")

    def test_allow_and_deny_fixtures_are_required(self):
        text = self.text.replace("allow", "removed").replace("deny", "removed")
        self.assertTrue(any("boundary fixtures" in finding for finding in main.validate_text(text)["findings"]))

    def test_unpinned_configuration_blocks(self):
        text = self.text.replace("pinned", "floating")
        self.assertTrue(any("versioning" in finding for finding in main.validate_text(text)["findings"]))

    def test_placeholder_blocks(self):
        self.assertEqual(main.validate_text(self.text + "\nTBD\n")["status"], "blocked")

    def test_validation_is_deterministic(self):
        self.assertEqual(main.validate_text(self.text), main.validate_text(self.text))

    def test_operational_boundaries_are_required(self):
        for evidence in ("acceptEdits", "/compact", "/goal", "--worktree", "/loop"):
            with self.subTest(evidence=evidence):
                result = main.validate_text(self.text.replace(evidence, "removed"))
                self.assertEqual(result["status"], "blocked")

    def test_permission_hook_artifact_is_valid(self):
        payload = {
            "hookSpecificOutput": {
                "hookEventName": "PermissionRequest",
                "decision": {"behavior": "deny", "message": "human approval required"},
            }
        }
        self.assertEqual(main.validate_permission_decision(payload)["status"], "valid")

    def test_permission_hook_rejects_wrong_event(self):
        payload = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "decision": {"behavior": "deny", "message": "blocked"},
            }
        }
        self.assertEqual(main.validate_permission_decision(payload)["status"], "blocked")

    def test_permission_hook_rejects_unknown_behavior(self):
        payload = {
            "hookSpecificOutput": {
                "hookEventName": "PermissionRequest",
                "decision": {"behavior": "ask"},
            }
        }
        findings = main.validate_permission_decision(payload)["findings"]
        self.assertIn("decision behavior must be allow or deny", findings)

    def test_deny_permission_hook_requires_message(self):
        payload = {
            "hookSpecificOutput": {
                "hookEventName": "PermissionRequest",
                "decision": {"behavior": "deny"},
            }
        }
        self.assertEqual(main.validate_permission_decision(payload)["status"], "blocked")


if __name__ == "__main__":
    unittest.main()
