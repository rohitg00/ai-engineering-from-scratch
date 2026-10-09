import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def model(self):
        return validate(
            {
                "participants": 8,
                "materials": [
                    {
                        "id": "p",
                        "name": "Paper",
                        "kind": "consumable",
                        "quantity": 2,
                        "unit": "sheet",
                    }
                ],
                "inventory": [{"id": "p", "quantity": 20, "unit": "sheet"}],
            }
        )

    def test_comparison(self):
        r = export_plan(self.model(), [8, 12])
        self.assertEqual(r["scenarios"][1]["packing"][0]["shortage"], "4")

    def test_csv(self):
        r = export_plan(self.model(), [])
        self.assertEqual(
            list(csv.DictReader(io.StringIO(r["csv"])))[0]["status"], "known"
        )

    def test_duplicates(self):
        with self.assertRaises(ValueError):
            export_plan(self.model(), [8, 8])

    def test_unknown(self):
        d = self.model()
        d["inventory"][0]["unit"] = "ream"
        r = export_plan(d, [])
        self.assertEqual(r["uncertain_items"], ["p"])
        self.assertEqual(list(csv.DictReader(io.StringIO(r["csv"])))[0]["shortage"], "")

    def test_heldout(self):
        r = export_plan(self.model(), [0, 13])
        self.assertEqual(r["scenarios"][1]["packing"][0]["required"], "26")
