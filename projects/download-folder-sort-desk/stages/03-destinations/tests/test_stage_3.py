import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def record(self, path="a.txt", sha="x"):
        return {"path": path, "sha256": sha, "size": 1, "suffix": ".txt"}

    def test_collision(self):
        self.assertEqual(
            plan_moves([self.record()], ["documents/a.txt"])["moves"][0]["destination"],
            "documents/a-2.txt",
        )

    def test_case_collision(self):
        self.assertEqual(
            plan_moves([self.record("A.txt"), self.record("sub/a.txt")])["moves"][1][
                "destination"
            ],
            "documents/a-2.txt",
        )

    def test_duplicates(self):
        self.assertEqual(
            len(plan_moves([self.record(), self.record("b.txt")])["duplicate_groups"]),
            1,
        )

    def test_traversal(self):
        with self.assertRaises(ValueError):
            plan_moves([self.record("../a.txt")])

    def test_heldout(self):
        self.assertEqual(
            plan_moves([self.record()], ["documents/a.txt", "documents/a-2.txt"])[
                "moves"
            ][0]["destination"],
            "documents/a-3.txt",
        )
