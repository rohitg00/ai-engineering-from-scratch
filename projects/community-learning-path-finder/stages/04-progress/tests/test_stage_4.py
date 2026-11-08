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

    def test_export(self):
        self.assertEqual(export_path(self.index(), ["map"], 40)["planned_minutes"], 30)

    def test_progress(self):
        i = self.index()
        r = export_path(i, ["map"], 40)
        self.assertEqual(
            export_path(
                i,
                ["map"],
                40,
                decisions={"fingerprint": r["fingerprint"], "completed": ["a"]},
            )["remaining_minutes"],
            20,
        )

    def test_order_gate(self):
        i = self.index()
        r = export_path(i, ["map"], 40)
        with self.assertRaises(ValueError):
            export_path(
                i,
                ["map"],
                40,
                decisions={"fingerprint": r["fingerprint"], "completed": ["b"]},
            )

    def test_stale(self):
        with self.assertRaises(ValueError):
            export_path(self.index(), ["map"], 40, decisions={"fingerprint": "old"})

    def test_roundtrip(self):
        r = export_path(self.index(), ["map"], 40)
        self.assertEqual(json.loads(json.dumps(r))["path"][1]["prerequisites"], ["a"])
