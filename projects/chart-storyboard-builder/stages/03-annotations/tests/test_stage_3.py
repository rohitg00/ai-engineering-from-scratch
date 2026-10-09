import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def spec(self):
        return aggregate(
            parse_table("g,n\nA,5\nB,", {"group": "g", "value": "n", "unit": "people"})
        )

    def test_ground(self):
        self.assertEqual(
            annotate(self.spec(), [{"group": "A", "text": "Peak"}])["annotations"][0][
                "text"
            ],
            "Peak (5 people)",
        )

    def test_missing(self):
        with self.assertRaises(ValueError):
            annotate(self.spec(), [{"group": "B", "text": "x"}])

    def test_unknown(self):
        with self.assertRaises(ValueError):
            annotate(self.spec(), [{"group": "C", "text": "x"}])

    def test_duplicate(self):
        with self.assertRaises(ValueError):
            annotate(self.spec(), [{"group": "A", "text": "x"}] * 2)

    def test_no_mutation(self):
        s = self.spec()
        annotate(s, [])
        self.assertNotIn("annotations", s)
