import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def test_alias(self):
        t = profile("place\n Garden ")
        r = preview(t, propose(t, {"place": {"Garden": "North"}}))
        self.assertEqual(r["rows"][0]["place"], "North")
        self.assertEqual(t["rows"][0]["place"], " Garden ")

    def test_ambiguous(self):
        t = profile("date\n03/04/2026")
        self.assertEqual(
            preview(t, propose(t, date_columns=["date"]))["pending"][0]["reason"],
            "ambiguous date",
        )

    def test_unambiguous(self):
        t = profile("date\n14/03/2026")
        self.assertEqual(
            preview(t, propose(t, date_columns=["date"]))["rows"][0]["date"],
            "2026-03-14",
        )

    def test_invalid(self):
        t = profile("date\n31/02/2026")
        self.assertEqual(
            len(preview(t, propose(t, date_columns=["date"]))["pending"]), 1
        )

    def test_heldout(self):
        t = profile("date\n2024-02-29")
        self.assertFalse(preview(t, propose(t, date_columns=["date"]))["changes"])
