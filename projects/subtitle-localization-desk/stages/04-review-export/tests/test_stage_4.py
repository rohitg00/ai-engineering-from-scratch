import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def p(self):
        return propose(
            parse_vtt("WEBVTT\n\na\n00:00.000 --> 00:02.000 align:start\nHello"),
            {"a": "Hola"},
            {},
        )

    def test_unreviewed(self):
        self.assertIsNone(export_localized(self.p())["vtt"])

    def test_export(self):
        p = self.p()
        r = export_localized(p)
        x = export_localized(
            p,
            {
                "fingerprint": r["fingerprint"],
                "cues": {"a": {"text": "Hola", "approved": True}},
            },
        )
        self.assertEqual(parse_vtt(x["vtt"])[0]["start"], "00:00.000")
        self.assertIn("align:start", x["vtt"])

    def test_stale(self):
        with self.assertRaises(ValueError):
            export_localized(self.p(), {"fingerprint": "bad"})

    def test_injection(self):
        p = self.p()
        r = export_localized(p)
        with self.assertRaises(ValueError):
            export_localized(
                p,
                {
                    "fingerprint": r["fingerprint"],
                    "cues": {"a": {"text": "x\n\ny", "approved": True}},
                },
            )

    def test_budget_override(self):
        p = self.p()
        r = export_localized(p, cps=1)
        d = {
            "fingerprint": r["fingerprint"],
            "cues": {"a": {"text": "Hola", "approved": True, "override_budget": True}},
        }
        self.assertTrue(export_localized(p, d, 1)["all_reviewed"])

    def test_whitespace_only_blank_line(self):
        proposals = self.p()
        result = export_localized(proposals)
        with self.assertRaises(ValueError):
            export_localized(
                proposals,
                {
                    "fingerprint": result["fingerprint"],
                    "cues": {"a": {"text": "Hola\n \nextra block", "approved": True}},
                },
            )
