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
            ]
        )

    def test_order(self):
        self.assertEqual(path_for(self.index(), "b")["steps"], ["a", "b"])

    def test_duration(self):
        self.assertEqual(path_for(self.index(), "b")["minutes"], 30)

    def test_completed(self):
        self.assertEqual(path_for(self.index(), "b", ["a"])["steps"], ["b"])

    def test_missing(self):
        self.assertEqual(path_for(self.index(), "missing")["missing"], ["missing"])

    def test_external_completion(self):
        self.assertTrue(path_for(self.index(), "external", ["external"])["feasible"])
