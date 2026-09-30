import unittest, os, sys, json, subprocess, tempfile
from pathlib import Path

W = Path(os.environ["PROJECT_WORKSPACE"])
from cli import run, aws_arguments


class IntegrationTests(unittest.TestCase):
    def test_duplicate_plan_reuses_completed_receipt(self):
        payload = {
            "scope": ["checkout"],
            "plan": [{"operation": "logs.read", "resource": "checkout"}] * 2,
        }
        calls = []
        r = run(payload, lambda op, res: calls.append(op) or {"errors": 2})
        self.assertEqual(calls, ["logs.read"])
        self.assertTrue(r["receipts"][1]["cached"])

    def test_scope_rejection_precedes_provider(self):
        with self.assertRaises(ValueError):
            run(
                {
                    "scope": [],
                    "plan": [{"operation": "logs.read", "resource": "secret"}],
                },
                lambda *args: self.fail(),
            )

    def test_response_budget_stops_composition(self):
        r = run(
            {
                "scope": ["x"],
                "plan": [{"operation": "logs.read", "resource": "x"}],
                "max_chars": 1,
            },
            lambda *args: {"long": True},
        )
        self.assertEqual(r["state"], "budget_exhausted")

    def test_aws_operations_are_read_only_argv(self):
        args = aws_arguments(
            "logs.read",
            "service;echo surprise",
            {
                "service;echo surprise": {
                    "region": "us-east-1",
                    "log_group": "/app/service",
                }
            },
        )
        self.assertIn("filter-log-events", args)
        self.assertNotIn("sh", args)

    def test_invalid_aws_operation_rejected(self):
        with self.assertRaises(ValueError):
            aws_arguments("delete", "x", {"x": {"region": "us-east-1"}})
