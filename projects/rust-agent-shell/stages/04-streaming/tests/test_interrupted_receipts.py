import contextlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import client


class InterruptedReceiptsTests(unittest.TestCase):
    def test_timeout_preserves_complete_prefix_before_partial_utf8(self):
        prefix = b'{"seq":1,"kind":"ok","output":"done","terminal":false}\n'
        for suffix in (b'{"seq":2', b'{"seq":2,"output":"caf\xc3'):
            with self.subTest(suffix=suffix), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                rows = [{"id": str(i), "tool": "pwd"} for i in range(3)]
                (root / "requests.jsonl").write_text("".join(json.dumps(row) + "\n" for row in rows))
                output = root / "out.jsonl"
                timeout = subprocess.TimeoutExpired("shell", 30, output=prefix + suffix)
                with patch.object(client.subprocess, "run", side_effect=[None, timeout]), patch.object(sys, "argv", [
                    "client.py", str(root), str(root / "requests.jsonl"), "--out", str(output)
                ]), contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(client.main(), 1)
                events = [json.loads(line) for line in output.read_text().splitlines()]
                self.assertEqual([event["request_id"] for event in events], ["0", "1", "2"])
                self.assertEqual([event["kind"] for event in events], ["ok", "not-executed", "not-executed"])
                self.assertIn("process timed out; incomplete response discarded", events[-1]["output"])

    def test_complete_malformed_response_preserves_prefix_and_explicit_failure(self):
        prefix = b'{"seq":1,"kind":"ok","output":"done","terminal":false}\n'
        for malformed in (b'not-json\n', b'{"output":"\xff"}\n', b'null\n'):
            with self.subTest(malformed=malformed):
                events, failed = client.receipts([{"id": "a"}, {"id": "b"}], prefix + malformed, "process ended", abnormal=True)
                self.assertTrue(failed)
                self.assertEqual(events[0]["output"], "done")
                self.assertEqual(events[1]["kind"], "not-executed")
                self.assertIn("invalid native response at position 2", events[1]["output"])
