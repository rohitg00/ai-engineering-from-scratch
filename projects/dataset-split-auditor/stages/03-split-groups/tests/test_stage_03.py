import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Splits(unittest.TestCase):
    def setUp(self):
        self.rows = [
            {"id": str(i), "group": str(i // 2), "text": str(i)} for i in range(20)
        ]

    def test_groups(self):
        self.assertTrue(audit(**split_groups(self.rows))["clean"])

    def test_cover(self):
        self.assertEqual(sum((len(v) for v in split_groups(self.rows).values())), 20)

    def test_order(self):
        self.assertEqual(
            {r["id"] for r in split_groups(self.rows)["test"]},
            {r["id"] for r in split_groups(self.rows[::-1])["test"]},
        )

    def test_bounds(self):
        with self.assertRaises(ValueError):
            split_groups([], 1)

    def test_nan(self):
        with self.assertRaises(ValueError):
            split_groups([], float("nan"))
