import unittest, os, sys, json, subprocess, tempfile
from pathlib import Path

W = Path(os.environ["PROJECT_WORKSPACE"])
from cli import inbox, proposals


class IntegrationTests(unittest.TestCase):
    def test_proposal_retains_physical_source(self):
        rows = proposals(
            "Decision: ship later.\nMira will update the guide by 2026-10-01."
        )
        self.assertEqual(rows[0]["lines"], [2])
        self.assertTrue(rows[0]["proposal"])

    def test_no_implicit_approval(self):
        self.assertEqual(
            inbox("ACTION Mira | 2026-10-01 | Update guide", "2026-09-29", {})[
                "approved"
            ],
            [],
        )

    def test_explicit_approval_only(self):
        text = "ACTION Mira | 2026-10-01 | Update guide"
        r = inbox(text, "2026-09-29", {})
        key = r["actions"][0]["id"]
        self.assertEqual(
            len(inbox(text, "2026-09-29", {key: "approved"})["approved"]), 1
        )

    def test_incomplete_action_cannot_be_approved(self):
        text = "ACTION ? | ? | Update guide"
        key = inbox(text, "2026-09-29", {})["actions"][0]["id"]
        with self.assertRaises(ValueError):
            inbox(text, "2026-09-29", {key: "approved"})

    def test_source_html_is_escaped(self):
        self.assertNotIn(
            "<script>alert(1)</script>",
            inbox(
                "ACTION Mira | 2026-10-01 | <script>alert(1)</script>", "2026-09-29", {}
            )["html"],
        )
