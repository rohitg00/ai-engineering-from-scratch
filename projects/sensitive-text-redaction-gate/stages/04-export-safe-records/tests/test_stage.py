import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
from main import *


class Contract(unittest.TestCase):
    def test_batch_totals(self):
        result = process(
            [{"id": "a", "text": "x@example.test"}, {"id": "b", "text": "quiet"}]
        )
        self.assertEqual(result["totals"]["spans"], 1)
        self.assertEqual(len(result["ledger"]), 2)

    def test_empty_batch_still_validates_policy(self):
        with self.assertRaises(ValueError):
            process([], [""])

    def test_duplicate_ids(self):
        with self.assertRaises(ValueError):
            process([{"id": "a", "text": "x"}, {"id": "a", "text": "y"}])

    def test_extra_metadata_is_rejected(self):
        with self.assertRaises(ValueError):
            process([{"id": "a", "text": "x", "raw_email": "hidden@example.test"}])

    def test_html_escaped(self):
        page = render_html(process([{"id": "a", "text": "<script>alert(1)</script>"}]))
        self.assertNotIn("<script>", page)
        self.assertIn("&lt;script&gt;", page)

    def test_cli_export_consumed(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            source = folder / "rows.jsonl"
            source.write_text(
                json.dumps(
                    {
                        "id": "heldout",
                        "text": "Heldout owner h@example.test from 198.51.100.2",
                    }
                )
                + "\n"
            )
            out = folder / "out"
            result = subprocess.run(
                [
                    sys.executable,
                    str(Path(os.environ["PROJECT_WORKSPACE"]) / "cli.py"),
                    str(source),
                    "--output",
                    str(out),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            rows = [
                json.loads(line)
                for line in (out / "redacted.jsonl").read_text().splitlines()
            ]
            self.assertEqual(detect(rows[0]["text"]), [])
            self.assertEqual(
                json.loads((out / "receipt.json").read_text())["totals"]["spans"], 2
            )
            for path in out.iterdir():
                self.assertNotIn("h@example.test", path.read_text())

    def test_cli_error_does_not_echo_sensitive_text(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            source = folder / "bad.jsonl"
            source.write_text("email-secret@example.test")
            result = subprocess.run(
                [
                    sys.executable,
                    str(Path(os.environ["PROJECT_WORKSPACE"]) / "cli.py"),
                    str(source),
                    "--output",
                    str(folder / "out"),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 2)
            self.assertNotIn("email-secret", result.stderr + result.stdout)
            self.assertFalse((folder / "out").exists())
