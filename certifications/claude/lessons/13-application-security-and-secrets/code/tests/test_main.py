"""Tests for lesson 13 deterministic security policy."""

import json
import os
import pathlib
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))

from main import Action, EnvironmentSecrets, PolicyGate, demo, redact


class PolicyTests(unittest.TestCase):
    def setUp(self):
        self.gate = PolicyGate(["/workspace/project"], ["api.example.test"])

    def test_shipped_decision_record_matches_demo(self):
        artifact = pathlib.Path(__file__).parents[2] / "outputs" / "security-decision-record.json"
        expected = json.loads(artifact.read_text(encoding="utf-8"))
        self.assertEqual(json.loads(json.dumps(demo())), expected)


    def test_read_inside_root_is_allowed(self):
        self.assertTrue(self.gate.evaluate(Action("read_file", {"path": "/workspace/project/docs/a.md"})).allowed)

    def test_path_traversal_is_blocked(self):
        decision = self.gate.evaluate(Action("read_file", {"path": "/workspace/project/../outside.txt"}))
        self.assertFalse(decision.allowed)
        self.assertIn("outside", decision.reason)

    def test_secret_path_is_blocked_even_inside_root(self):
        self.assertFalse(self.gate.evaluate(Action("read_file", {"path": "/workspace/project/.env"})).allowed)

    def test_destructive_command_is_never_approved(self):
        decision = self.gate.evaluate(Action("run_command", {"command": "git reset --hard"}, approved=True))
        self.assertFalse(decision.allowed)

    def test_untrusted_content_cannot_authorize_mutation(self):
        decision = self.gate.evaluate(Action("write_file", {"path": "a"}, source_trust="untrusted_content", approved=True))
        self.assertFalse(decision.allowed)

    def test_network_requires_https_allowlisted_host(self):
        self.assertTrue(self.gate.evaluate(Action("http_get", {"url": "https://api.example.test/status"})).allowed)
        self.assertFalse(self.gate.evaluate(Action("http_get", {"url": "http://api.example.test/status"})).allowed)
        self.assertFalse(self.gate.evaluate(Action("http_get", {"url": "https://attacker.test/status"})).allowed)

    def test_redaction_removes_secret_value(self):
        redacted = redact("token=abc123 user=rohit")
        self.assertNotIn("abc123", redacted)
        self.assertIn("[REDACTED]", redacted)

    def test_environment_secret_requires_explicit_variable(self):
        with patch.dict(os.environ, {"STUDY_API_KEY": "safe-value"}, clear=True):
            self.assertEqual(EnvironmentSecrets().require("STUDY_API_KEY"), "safe-value")
            with self.assertRaises(RuntimeError):
                EnvironmentSecrets().require("MISSING_KEY")


if __name__ == "__main__":
    unittest.main()
