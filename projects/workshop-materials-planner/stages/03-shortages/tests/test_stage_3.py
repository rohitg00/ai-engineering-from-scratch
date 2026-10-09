import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def model(self, unit="ml"):
        return validate(
            {
                "participants": 2,
                "materials": [
                    {
                        "id": "g",
                        "name": "Glue",
                        "kind": "consumable",
                        "quantity": 100,
                        "unit": "ml",
                    }
                ],
                "inventory": [{"id": "g", "quantity": 0.1, "unit": unit}],
                "conversions": [{"from": "l", "to": "ml", "factor": 1000}],
            }
        )

    def test_convert(self):
        self.assertEqual(shortages(self.model("l"))[0]["shortage"], "100.0")

    def test_unknown(self):
        self.assertIsNone(shortages(self.model("bottle"))[0]["shortage"])

    def test_no_negative(self):
        d = self.model("l")
        d["inventory"][0]["quantity"] = 10
        self.assertEqual(shortages(d)[0]["shortage"], "0")

    def test_decimal(self):
        self.assertEqual(shortages(self.model())[0]["available"], "0.1")

    def test_inconsistent(self):
        d = self.model()
        d["conversions"].append({"from": "l", "to": "ml", "factor": 2})
        with self.assertRaises(ValueError):
            validate(d)
