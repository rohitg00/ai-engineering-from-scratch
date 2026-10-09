import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def roles(self):
        return {"group": "g", "value": "n", "unit": "people"}

    def test_number(self):
        self.assertEqual(parse_table("g,n\nA,4", self.roles())["rows"][0]["number"], 4)

    def test_blank(self):
        self.assertEqual(parse_table("g,n\nA,", self.roles())["missing"], 1)

    def test_nan(self):
        with self.assertRaises(ValueError):
            parse_table("g,n\nA,NaN", self.roles())

    def test_role(self):
        with self.assertRaises(ValueError):
            parse_table("g,n\nA,4", {"group": "g"})

    def test_heldout(self):
        self.assertEqual(
            parse_table("g,n\nÉ,-2.5", self.roles())["rows"][0]["number"], -2.5
        )
