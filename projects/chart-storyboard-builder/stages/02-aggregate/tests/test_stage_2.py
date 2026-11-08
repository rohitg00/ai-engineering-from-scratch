import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def table(self):
        return parse_table(
            "g,n\nA,2\nA,4\nC,", {"group": "g", "value": "n", "unit": "items"}
        )

    def test_sum(self):
        self.assertEqual(aggregate(self.table())["points"][0]["value"], 6)

    def test_mean(self):
        self.assertEqual(aggregate(self.table(), "mean")["points"][0]["value"], 3)

    def test_missing_period(self):
        self.assertIsNone(
            aggregate(self.table(), periods=["A", "B", "C"])["points"][1]["value"]
        )

    def test_omission(self):
        with self.assertRaises(ValueError):
            aggregate(self.table(), periods=["A"])

    def test_count(self):
        self.assertEqual(aggregate(self.table(), "count")["points"][0]["value"], 2)
