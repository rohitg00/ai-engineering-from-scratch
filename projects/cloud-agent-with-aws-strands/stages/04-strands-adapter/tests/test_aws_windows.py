import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from cli import aws_arguments


class WindowTests(unittest.TestCase):
    def entry(self, **window):
        return {
            "checkout": {
                "region": "us-east-1",
                "cluster": "apps",
                "log_group": "/app/checkout",
                **window,
            }
        }

    def test_logs_without_window_keep_existing_arguments(self):
        args = aws_arguments("logs.read", "checkout", self.entry())
        self.assertEqual(
            args[-4:], ["--log-group-name", "/app/checkout", "--limit", "20"]
        )
        self.assertNotIn("--start-time", args)
        self.assertNotIn("--end-time", args)

    def test_timezone_aware_log_window_uses_epoch_milliseconds(self):
        config = self.entry(
            start="2026-01-01T05:30:00.125+05:30", end="2026-01-01T00:01:00Z"
        )
        args = aws_arguments("logs.read", "checkout", config)
        self.assertEqual(args[args.index("--start-time") + 1], "1767225600125")
        self.assertEqual(args[args.index("--end-time") + 1], "1767225660000")

    def test_metric_window_retains_iso_arguments(self):
        config = self.entry(
            start="2026-01-01T00:00:00Z", end="2026-01-01T00:01:00+00:00"
        )
        args = aws_arguments("metrics.read", "checkout", config)
        self.assertEqual(
            args[args.index("--start-time") + 1], config["checkout"]["start"]
        )
        self.assertEqual(args[args.index("--end-time") + 1], config["checkout"]["end"])

    def test_invalid_or_incomplete_windows_fail(self):
        for window in [
            {"start": "2026-01-01T00:00:00Z"},
            {"end": "2026-01-01T00:01:00Z"},
            {"start": None, "end": "2026-01-01T00:01:00Z"},
            {"start": "yesterday", "end": "2026-01-01T00:01:00Z"},
            {"start": "2026-01-01T00:00:00", "end": "2026-01-01T00:01:00Z"},
            {"start": "2026-01-01T00:01:00Z", "end": "2026-01-01T00:01:00Z"},
            {"start": "2026-01-02T00:00:00Z", "end": "2026-01-01T00:00:00Z"},
            {"start": "1969-12-31T23:59:59Z", "end": "1970-01-01T00:00:01Z"},
        ]:
            for operation in ("logs.read", "metrics.read"):
                with (
                    self.subTest(operation=operation, window=window),
                    self.assertRaises(ValueError),
                ):
                    aws_arguments(operation, "checkout", self.entry(**window))
        with self.assertRaises(ValueError):
            aws_arguments("metrics.read", "checkout", self.entry())

    def test_cli_passes_shared_window_to_aws_without_network(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stub = root / "aws"
            stub.write_text(
                "#!"
                + sys.executable
                + "\nimport json, os, sys\nwith open(os.environ['WINDOW_TEST_ARGS'], 'a') as stream:\n stream.write(json.dumps(sys.argv[1:]) + '\\n')\nprint('{}')\n"
            )
            stub.chmod(0o700)
            window = {"start": "2026-01-01T00:00:00Z", "end": "2026-01-01T00:01:00Z"}
            source = root / "input.json"
            source.write_text(
                json.dumps(
                    {
                        "scope": ["checkout"],
                        "plan": [
                            {"operation": op, "resource": "checkout"}
                            for op in ("logs.read", "metrics.read")
                        ],
                        "aws": self.entry(**window),
                    }
                )
            )
            output = root / "argv.jsonl"
            env = {
                **os.environ,
                "PATH": str(root) + os.pathsep + os.environ["PATH"],
                "WINDOW_TEST_ARGS": str(output),
            }
            subprocess.run(
                [
                    sys.executable,
                    str(Path(os.environ["PROJECT_WORKSPACE"]) / "cli.py"),
                    str(source),
                    "--mode",
                    "aws",
                ],
                check=True,
                capture_output=True,
                text=True,
                env=env,
            )
            calls = [json.loads(line) for line in output.read_text().splitlines()]
            self.assertEqual(len(calls), 2)
            self.assertIn("filter-log-events", calls[0])
            self.assertEqual(
                calls[0][calls[0].index("--start-time") + 1], "1767225600000"
            )
            self.assertEqual(
                calls[1][calls[1].index("--start-time") + 1], window["start"]
            )
