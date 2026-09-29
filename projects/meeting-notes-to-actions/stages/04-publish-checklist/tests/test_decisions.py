import json
import os
import subprocess
import sys
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path

from cli import inbox


TEXT = "ACTION Mira | 2026-10-01 | Update guide"
TODAY = "2026-09-29"


class DecisionTests(unittest.TestCase):
    def test_unknown_and_mixed_ids_are_rejected(self):
        key = inbox(TEXT, TODAY, {})["actions"][0]["id"]
        for decisions in ({"unknown": "approved"}, {key: "approved", "unknown": "pending"}):
            with self.subTest(decisions=decisions), self.assertRaisesRegex(ValueError, "unknown or stale action ids: unknown"):
                inbox(TEXT, TODAY, decisions)

    def test_non_object_decisions_are_rejected(self):
        for decisions in (None, [], "approved"):
            with self.subTest(decisions=decisions), self.assertRaisesRegex(ValueError, "decisions must be an object"):
                inbox(TEXT, TODAY, decisions)

    def test_unknown_values_still_rejected_for_known_ids(self):
        key = inbox(TEXT, TODAY, {})["actions"][0]["id"]
        with self.assertRaisesRegex(ValueError, "unknown review decision"):
            inbox(TEXT, TODAY, {key: "approve"})

    def test_html_preserves_saved_approved_and_rejected_choices(self):
        class SelectedOptions(HTMLParser):
            def __init__(self):
                super().__init__()
                self.selected = False
                self.values = []

            def handle_starttag(self, tag, attrs):
                self.selected = tag == "option" and "selected" in dict(attrs)

            def handle_data(self, data):
                if self.selected:
                    self.values.append(data)

            def handle_endtag(self, tag):
                if tag == "option":
                    self.selected = False

        key = inbox(TEXT, TODAY, {})["actions"][0]["id"]
        for choice in ("pending", "approved", "rejected"):
            with self.subTest(choice=choice):
                report = inbox(TEXT, TODAY, {key: choice})
                parser = SelectedOptions()
                parser.feed(report["html"])
                self.assertEqual(parser.values, [choice])
                self.assertEqual(len(report["approved"]), int(choice == "approved"))

    def test_stale_decisions_fail_cli_before_any_artifact_is_written(self):
        key = inbox(TEXT, TODAY, {})["actions"][0]["id"]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "notes.txt").write_text("Meeting notes\n" + TEXT)
            (root / "decisions.json").write_text(json.dumps({key: "approved"}))
            run = subprocess.run(
                [sys.executable, str(Path(os.environ["PROJECT_WORKSPACE"]) / "cli.py"),
                 "notes.txt", "--today", TODAY, "--decisions", "decisions.json", "--csv", "approved.csv"],
                cwd=root, capture_output=True, text=True,
            )
            self.assertNotEqual(run.returncode, 0)
            self.assertIn("unknown or stale action ids", run.stderr)
            for name in ("actions.json", "actions.html", "approved.csv"):
                self.assertFalse((root / name).exists(), name)
