import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def test_order(self):
        r = propose(profile("a\nx"), {"a": {"x": "y"}}, ["a"])
        self.assertEqual(
            [x["operation"] for x in r["rules"]], ["trim", "alias", "date"]
        )

    def test_empty(self):
        self.assertEqual(len(propose(profile("a\n"))["rules"]), 1)

    def test_unknown(self):
        with self.assertRaises(ValueError):
            propose(profile("a\nx"), {"b": {}})

    def test_invalid(self):
        with self.assertRaises(ValueError):
            propose(profile("a\nx"), {"a": {"x": 3}})

    def test_heldout(self):
        self.assertEqual(
            propose(profile("z,a\n0,1"), date_columns=["z"])["rules"][1]["operation"],
            "date",
        )
