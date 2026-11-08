import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def make(self, d):
        pathlib.Path(d, "x.txt").write_text("x")
        return plan_moves(inventory(d))

    def test_approve(self):
        with tempfile.TemporaryDirectory() as d:
            plan = self.make(d)
            fingerprint = review_plan(d, plan)["fingerprint"]
            self.assertTrue(
                review_plan(
                    d, plan, {"fingerprint": fingerprint, "approved": ["x.txt"]}
                )["moves"][0]["approved"]
            )

    def test_no_approval(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(review_plan(d, self.make(d))["moves"][0]["approved"])

    def test_stale(self):
        with tempfile.TemporaryDirectory() as d:
            p = self.make(d)
            pathlib.Path(d, "x.txt").write_text("changed")
            with self.assertRaises(ValueError):
                review_plan(d, p)

    def test_unknown(self):
        with tempfile.TemporaryDirectory() as d:
            p = self.make(d)
            with self.assertRaises(ValueError):
                review_plan(d, p, {"approved": ["missing"]})

    def test_unsafe_destination(self):
        with tempfile.TemporaryDirectory() as d:
            p = self.make(d)
            p["moves"][0]["destination"] = "../outside"
            with self.assertRaises(ValueError):
                review_plan(d, p)

    def test_cli_rejects_stale_approval(self):
        import subprocess, sys, main

        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / "files").mkdir()
            (root / "files" / "x.txt").write_text("original")
            input_file = root / "input.json"
            input_file.write_text(json.dumps({"folder": "files"}))
            cli = pathlib.Path(main.__file__).with_name("cli.py")
            command = [
                sys.executable,
                str(cli),
                str(input_file),
                "--output",
                str(root / "out"),
            ]
            first = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            plan = json.loads((root / "out" / "moves.json").read_text())
            decisions = root / "decisions.json"
            decisions.write_text(
                json.dumps({"fingerprint": plan["fingerprint"], "approved": ["x.txt"]})
            )
            (root / "files" / "x.txt").write_text("changed since review")
            second = subprocess.run(
                command + ["--decisions", str(decisions)],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(second.returncode, 0)
            self.assertIn("stale approval", second.stderr)
