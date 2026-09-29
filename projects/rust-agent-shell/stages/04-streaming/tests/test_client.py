import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from client import encode


class ClientReceiptsTests(unittest.TestCase):
    def run_client(self, tools, limit=50):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            rows = [
                {"id": f"request-{i}", "tool": tool, "arguments": arguments}
                for i, (tool, arguments) in enumerate(tools)
            ]
            requests = root / "requests.jsonl"
            requests.write_text("".join(json.dumps(row) + "\n" for row in rows))
            output = root / "out.jsonl"
            run = subprocess.run(
                [sys.executable, str(Path(os.environ["PROJECT_WORKSPACE"]) / "client.py"),
                 str(root), str(requests), "--limit", str(limit), "--out", str(output)],
                capture_output=True, text=True, timeout=30,
            )
            self.assertTrue(output.exists(), run.stderr)
            self.assertEqual(output.read_text(), run.stdout)
            events = [json.loads(line) for line in run.stdout.splitlines()]
            self.assertEqual([event["request_id"] for event in events], [row["id"] for row in rows])
            return run, events

    def test_quit_preserves_unanswered_ids(self):
        run, events = self.run_client([("pwd", {}), ("quit", {}), ("pwd", {}), ("help", {})])
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual([e["kind"] for e in events], ["ok", "ok", "not-executed", "not-executed"])
        self.assertTrue(all(e["terminal"] for e in events[1:]))
        self.assertIn("session closed", events[-1]["output"])

    def test_budget_preserves_native_rejection_and_remaining_ids(self):
        run, events = self.run_client([("pwd", {})] * 4, limit=1)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual([e["kind"] for e in events], ["ok", "error", "not-executed", "not-executed"])
        self.assertIn("action budget exhausted", events[-1]["output"])

    def test_process_error_preserves_completed_prefix_and_all_ids(self):
        run, events = self.run_client([("pwd", {}), ("read", {"path": "x" * 5000}), ("help", {})])
        self.assertNotEqual(run.returncode, 0)
        self.assertEqual([e["kind"] for e in events], ["ok", "not-executed", "not-executed"])
        self.assertIn("command too long", events[-1]["output"])

    def test_empty_input_emits_no_events(self):
        run, events = self.run_client([])
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(events, [])

    def test_required_and_unknown_arguments_rejected(self):
        for request in [None, {"id": "a", "tool": "read"},
                        {"id": "a", "tool": "search", "arguments": {"path": "x"}},
                        {"id": "a", "tool": "list", "arguments": {"typo": "x"}}]:
            with self.subTest(request=request), self.assertRaises(ValueError):
                encode(request)
