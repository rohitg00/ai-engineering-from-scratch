import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def rec(self, id, title, creator=""):
        return {"source_id": id, "title": title, "creator": creator}

    def test_exact(self):
        self.assertEqual(
            candidates(
                [self.rec("a", "Atlas", "Ada")], [self.rec("b", "ATLAS", "ada")]
            )[0]["score"],
            1,
        )

    def test_no_overlap(self):
        self.assertFalse(
            candidates([self.rec("a", "Maps")], [self.rec("b", "Gardens")])
        )

    def test_partial(self):
        self.assertEqual(
            candidates([self.rec("a", "Blue Atlas")], [self.rec("b", "Atlas")])[0][
                "title_score"
            ],
            0.5,
        )

    def test_bad_threshold(self):
        with self.assertRaises(ValueError):
            candidates([], [], float("nan"))

    def test_heldout(self):
        self.assertEqual(
            candidates([self.rec("a", "Ａtlas")], [self.rec("b", "atlas")])[0]["score"],
            0.8,
        )
