import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
from main import *


class Contract(unittest.TestCase):
    def test_email_offsets(self):
        self.assertEqual(
            detect("To a@example.test!"), [{"start": 3, "end": 17, "kind": "EMAIL"}]
        )

    def test_unicode_offsets(self):
        self.assertEqual(detect("🌳 a@example.test")[0]["start"], 2)

    def test_ip_validity(self):
        self.assertEqual([x["kind"] for x in detect("192.0.2.1 999.1.1.1")], ["IPV4"])

    def test_literal_repetition_overlap(self):
        self.assertEqual(
            [(x["start"], x["end"]) for x in detect("banana", ["ana"])],
            [(1, 4), (3, 6)],
        )

    def test_literal_validation(self):
        for literal in ["", None, 123]:
            with self.assertRaises(ValueError):
                detect("text", [literal])

    def test_text_validation(self):
        for value in [None, 7, False, "x" * 1000001]:
            with self.assertRaises(ValueError):
                detect(value)

    def test_unmatched(self):
        self.assertEqual(detect("plain prose and version 1.2.3"), [])

    def test_sentence_punctuation(self):
        self.assertEqual(
            [
                span["kind"]
                for span in detect("Contact a@example.test. Source 192.0.2.14.")
            ],
            ["EMAIL", "IPV4"],
        )
        self.assertEqual(detect("999.192.0.2.14"), [])

    def test_punctuation_scan_is_bounded(self):
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from main import detect; assert detect('!' * 100000) == []",
            ],
            cwd=Path(sys.modules["main"].__file__).parent,
            capture_output=True,
            text=True,
            timeout=3,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_match_limit_fails_closed(self):
        self.assertEqual(len(detect("a" * 10000, ["a"])), 10000)
        with self.assertRaisesRegex(ValueError, "match limit"):
            detect("a" * 10001, ["a"])
