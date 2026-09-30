import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Publish(unittest.TestCase):
    def test_escape(self):
        self.assertNotIn(
            "<script>",
            publish(parse_notes("ACTION A | ? | <script>"), "2026-01-01")["html"],
        )

    def test_overdue(self):
        self.assertEqual(
            publish(parse_notes("ACTION A | 2025-01-01 | Task"), "2026-01-01")[
                "overdue"
            ],
            1,
        )

    def test_today(self):
        self.assertEqual(
            publish(parse_notes("ACTION A | 2026-01-01 | Task"), "2026-01-01")[
                "overdue"
            ],
            0,
        )

    def test_review(self):
        self.assertEqual(
            publish(parse_notes("ACTION ? | ? | Task"), "2026-01-01")["review"], 1
        )

    def test_empty(self):
        self.assertEqual(publish([], "2026-01-01")["ready"], 0)

    def test_rejects_script_citation(self):
        action = {
            "owner": "A",
            "due": "?",
            "task": "safe",
            "lines": ["<script>alert(1)</script>"],
        }
        with self.assertRaises(ValueError):
            publish([action], "2026-01-01")

    def test_keeps_numeric_citations(self):
        report = publish(
            parse_notes("ACTION A | ? | task\nnote\nACTION A | ? | task"),
            "2026-01-01",
        )
        self.assertIn("lines 1,3;", report["html"])
        self.assertEqual(report["actions"][0]["lines"], [1, 3])
