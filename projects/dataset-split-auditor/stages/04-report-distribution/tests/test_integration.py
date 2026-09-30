import unittest, os, sys, json, subprocess, tempfile
from pathlib import Path

W = Path(os.environ["PROJECT_WORKSPACE"])
from cli import evidence


class IntegrationTests(unittest.TestCase):
    def test_ids_explain_content_leak(self):
        r = evidence(
            [{"id": "a", "group": "a", "text": "Retry  now"}],
            [{"id": "b", "group": "b", "text": " retry now "}],
        )
        self.assertEqual(r["audit"]["content_evidence"][0]["test_ids"], ["b"])

    def test_group_leak_identifies_both_rows(self):
        r = evidence(
            [{"id": "a", "group": "x", "text": "first"}],
            [{"id": "b", "group": "x", "text": "second"}],
        )
        self.assertEqual(r["audit"]["group_evidence"][0]["group"], "x")
        self.assertEqual(
            r["audit"]["group_evidence"][0]["sources"],
            [{"id": "a", "source": None}, {"id": "b", "source": None}],
        )

    def test_clean_partition_has_no_evidence(self):
        r = evidence(
            [{"id": "a", "group": "x", "text": "first"}],
            [{"id": "b", "group": "y", "text": "second"}],
        )
        self.assertTrue(r["usable"])

    def test_empty_partition_is_not_usable(self):
        self.assertFalse(evidence([], [])["usable"])

    def test_cli_check_exits_two(self):
        p = subprocess.run(
            [
                sys.executable,
                str(W / "cli.py"),
                str(W / "samples/input.json"),
                "--check",
            ],
            capture_output=True,
            text=True,
        )
        self.assertEqual(p.returncode, 2)
        self.assertIn("content_evidence", p.stdout)
