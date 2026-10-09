import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
from main import *


class Contract(unittest.TestCase):
    def test_email_and_ip(self):
        result = redact("a@example.test on 192.0.2.9")
        self.assertEqual(result["text"], "[REDACTED] on [REDACTED]")
        self.assertEqual(result["redacted_characters"], 23)

    def test_no_raw_value_in_receipt(self):
        result = redact("private@example.test")
        self.assertNotIn("private@example.test", json.dumps(result))

    def test_overlap_covers_full_union(self):
        self.assertEqual(redact("banana", ["ana"])["text"], "b[REDACTED]")

    def test_unchanged_text(self):
        self.assertEqual(
            redact("quiet day"),
            {"text": "quiet day", "spans": [], "redacted_characters": 0},
        )

    def test_unicode_preservation(self):
        self.assertEqual(redact("🌳秘密🌳", ["秘密"])["text"], "🌳[REDACTED]🌳")

    def test_email_literal_nested(self):
        result = redact("a@example.test", ["example"])
        self.assertEqual(len(result["spans"]), 1)
        self.assertEqual(result["spans"][0]["kinds"], ["EMAIL", "LITERAL"])
