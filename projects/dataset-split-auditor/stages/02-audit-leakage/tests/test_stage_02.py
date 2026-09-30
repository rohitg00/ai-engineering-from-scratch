import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Audit(unittest.TestCase):
    def row(self, i, g, t):
        return {"id": i, "group": g, "text": t}

    def test_empty(self):
        self.assertTrue(audit([], [])["clean"])

    def test_content(self):
        self.assertFalse(
            audit([self.row("1", "a", "Hi")], [self.row("2", "b", "hi")])["clean"]
        )

    def test_group(self):
        self.assertEqual(
            audit([self.row("1", "a", "one")], [self.row("2", "a", "two")])[
                "group_leaks"
            ],
            ["a"],
        )

    def test_clean(self):
        self.assertTrue(
            audit([self.row("1", "a", "one")], [self.row("2", "b", "two")])["clean"]
        )

    def test_duplicate_id(self):
        with self.assertRaises(ValueError):
            audit([self.row("1", "a", "one")], [self.row("1", "b", "two")])
