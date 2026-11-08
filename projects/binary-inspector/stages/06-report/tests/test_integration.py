import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from binspect.report import DIFF_SCHEMA, validate_report

ROOT = Path(os.environ.get("PROJECT_ROOT", Path(__file__).resolve().parents[3]))
WORKSPACE = Path(os.environ.get("PROJECT_WORKSPACE", ROOT / "solution"))
FIXTURES = ROOT / "solution" / "fixtures"
HELDOUT = ROOT / "heldout"


def run(*args):
    return subprocess.run([sys.executable, str(WORKSPACE / "cli.py"), *map(str, args)], cwd=WORKSPACE,
                          capture_output=True, text=True, timeout=120)


class Cli(unittest.TestCase):
    def test_inspect_writes_json_and_html(self):
        with tempfile.TemporaryDirectory() as folder:
            report_path, page_path = Path(folder) / "out" / "report.json", Path(folder) / "out" / "report.html"
            result = run("inspect", HELDOUT / "meter-arm64-O2.stripped", "--truth", HELDOUT / "meter-arm64-O2",
                         "--json", report_path, "--html", page_path)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("macho64 arm64 executable", result.stdout)
            self.assertIn("recall", result.stdout)
            report = json.loads(report_path.read_text())
            self.assertEqual(validate_report(report), [])
            self.assertEqual(report["file"]["name"], "meter-arm64-O2.stripped")
            self.assertIn("meter readout", page_path.read_text())

    def test_diff_writes_json(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "diff.json"
            result = run("diff", FIXTURES / "tally-arm64-O0", FIXTURES / "tally-arm64-O2", "--json", target)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("__TEXT,__text: 848 -> 768 (-80)", result.stdout)
            self.assertEqual(json.loads(target.read_text())["schema"], DIFF_SCHEMA)

    def test_bad_inputs_exit_two(self):
        result = run("inspect", HELDOUT / "meter.c")
        self.assertEqual(result.returncode, 2)
        self.assertIn("error:", result.stderr)
        missing = run("inspect", HELDOUT / "does-not-exist")
        self.assertEqual(missing.returncode, 2)


if __name__ == "__main__":
    unittest.main()
