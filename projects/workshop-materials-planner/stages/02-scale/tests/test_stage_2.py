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
                    },
                    {
                        "id": "s",
                        "name": "Scissors",
                        "kind": "shared",
                        "quantity": 1,
                        "unit": "pair",
                        "share": 3,
                    },
                ],
            }
        )

    def test_consumable(self):
        self.assertEqual(scale(self.model())[0]["required"], "16")

    def test_shared(self):
        self.assertEqual(scale(self.model())[1]["required"], "3")

    def test_zero(self):
        self.assertEqual(scale(self.model(), 0)[1]["required"], "0")

    def test_boundary(self):
        self.assertEqual(scale(self.model(), 9)[1]["required"], "3")
        self.assertEqual(scale(self.model(), 10)[1]["required"], "4")

    def test_invalid(self):
        with self.assertRaises(ValueError):
            scale(self.model(), 1.5)
