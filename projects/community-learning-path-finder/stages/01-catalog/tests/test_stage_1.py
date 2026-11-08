import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def r(self, id="a", pre=None):
        return {
            "id": id,
            "title": id,
            "minutes": 20,
            "goals": ["map"],
            "prerequisites": pre or [],
        }

    def test_catalog(self):
        self.assertIn("a", catalog([self.r()]))

    def test_duplicate(self):
        with self.assertRaises(ValueError):
            catalog([self.r(), self.r()])

    def test_cycle(self):
        with self.assertRaises(ValueError):
            catalog([self.r("a", ["b"]), self.r("b", ["a"])])

    def test_missing_preserved(self):
        self.assertEqual(
            catalog([self.r("a", ["external"])])["a"]["prerequisites"], ["external"]
        )

    def test_invalid_duration(self):
        r = self.r()
        r["minutes"] = 0
        with self.assertRaises(ValueError):
            catalog([r])
