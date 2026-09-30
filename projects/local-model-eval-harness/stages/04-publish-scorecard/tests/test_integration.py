import unittest, os, sys, json, subprocess, tempfile
from pathlib import Path

W = Path(os.environ["PROJECT_WORKSPACE"])
from cli import measure, compare
from record import record


class IntegrationTests(unittest.TestCase):
    def test_manifest_dataset_change_is_not_comparable(self):
        d = json.loads((W / "samples/input.json").read_text())
        a = measure(d)
        d["labels"]["extra"] = "no"
        with self.assertRaises(ValueError):
            compare(a, measure(d))

    def test_missing_manifest_is_rejected(self):
        with self.assertRaises(ValueError):
            measure({})

    def test_record_prompt_does_not_include_expected(self):
        def request(body):
            self.assertNotIn("PRIVATE-LABEL", json.dumps(body))
            return {
                "choices": [
                    {"message": {"content": '{"answer":"no","confidence":0.5}'}}
                ]
            }

        r = record(
            [
                {
                    "id": "case",
                    "prompt": "Is this supported?",
                    "expected": "PRIVATE-LABEL",
                }
            ],
            "http://localhost:1000/v1/chat/completions",
            "test",
            "r1",
            "testhost",
            request,
        )
        self.assertGreaterEqual(r["records"][0]["latency_ms"], 0)
        self.assertEqual(r["labels"]["case"], "PRIVATE-LABEL")

    def test_remote_endpoint_rejected(self):
        with self.assertRaises(ValueError):
            record([], "https://public.example/v1", "m", "r", "h")

    def test_real_cli_writes_reliability_report(self):
        with tempfile.TemporaryDirectory() as d:
            p = subprocess.run(
                [
                    sys.executable,
                    str(W / "cli.py"),
                    str(W / "samples/input.json"),
                    "--html",
                    d + "/report.html",
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(p.returncode, 0, p.stderr)
            self.assertIn("Confidence", Path(d + "/report.html").read_text())
