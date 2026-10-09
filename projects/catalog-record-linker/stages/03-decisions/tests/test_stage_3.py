import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def cats(self):
        return (
            import_catalog("id,title,year\n1,Atlas,2024", "a"),
            import_catalog("id,title,year\n2,Atlas,2025\n3,Garden,2025", "b"),
        )

    def test_separate(self):
        a, b = self.cats()
        self.assertEqual(len(reconcile(a, b, [])), 3)

    def test_conflict(self):
        a, b = self.cats()
        self.assertEqual(
            reconcile(a, b, [{"left": "a:1", "right": "b:2", "match": True}])[0][
                "conflicts"
            ][0]["field"],
            "year",
        )

    def test_resolve(self):
        a, b = self.cats()
        self.assertFalse(
            reconcile(
                a,
                b,
                [
                    {
                        "left": "a:1",
                        "right": "b:2",
                        "match": True,
                        "values": {"year": "2025"},
                    }
                ],
            )[0]["conflicts"]
        )

    def test_one_to_one(self):
        a, b = self.cats()
        with self.assertRaises(ValueError):
            reconcile(
                a,
                b,
                [{"left": "a:1", "right": x, "match": True} for x in ("b:2", "b:3")],
            )

    def test_unknown(self):
        a, b = self.cats()
        with self.assertRaises(ValueError):
            reconcile(a, b, [{"left": "missing", "right": "b:2", "match": False}])
