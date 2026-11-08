import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def index(self):
        return catalog(
            [
                {
                    "id": "a",
                    "title": "Basics",
                    "minutes": 10,
                    "goals": [],
                    "prerequisites": [],
                },
                {
                    "id": "b",
                    "title": "Map",
                    "minutes": 20,
                    "goals": ["map"],
                    "prerequisites": ["a"],
                },
                {
                    "id": "c",
                    "title": "Quick",
                    "minutes": 15,
                    "goals": ["map"],
                    "prerequisites": [],
                },
            ]
        )

    def test_cheapest(self):
        self.assertEqual(rank_paths(self.index(), ["map"], 30)["best"]["steps"], ["c"])

    def test_budget(self):
        self.assertEqual(
            rank_paths(self.index(), ["map"], 10)["best"]["uncovered"], ["map"]
        )

    def test_completed(self):
        self.assertEqual(
            rank_paths(self.index(), ["map"], 0, ["c"])["best"]["covered"], ["map"]
        )

    def test_invalid(self):
        with self.assertRaises(ValueError):
            rank_paths(self.index(), ["map"], -1)

    def test_missing_route(self):
        i = self.index()
        i["b"]["prerequisites"] = ["external"]
        self.assertEqual(
            rank_paths(i, ["map"], 50)["unmet_prerequisites"][0]["missing"],
            ["external"],
        )
