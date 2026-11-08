import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def model(self):
        return {
            "participants": 8,
            "materials": [
                {
                    "id": "paper",
                    "name": "Paper",
                    "kind": "consumable",
                    "quantity": 2,
                    "unit": "sheet",
                }
            ],
            "inventory": [],
        }

    def test_valid(self):
        self.assertEqual(validate(self.model())["participants"], 8)

    def test_negative(self):
        d = self.model()
        d["participants"] = -1
        with self.assertRaises(ValueError):
            validate(d)

    def test_duplicates(self):
        d = self.model()
        d["materials"] *= 2
        with self.assertRaises(ValueError):
            validate(d)

    def test_nonfinite(self):
        d = self.model()
        d["materials"][0]["quantity"] = "NaN"
        with self.assertRaises(ValueError):
            validate(d)

    def test_sharing(self):
        d = self.model()
        d["materials"][0].update(kind="shared", share=0)
        with self.assertRaises(ValueError):
            validate(d)
