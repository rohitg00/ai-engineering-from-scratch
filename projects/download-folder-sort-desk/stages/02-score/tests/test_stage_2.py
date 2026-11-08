import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def test_image(self):
        self.assertEqual(
            categorize({"path": "a.png", "suffix": ".png"})["category"], "images"
        )

    def test_keywords(self):
        self.assertEqual(
            categorize({"path": "workshop-handout.bin", "suffix": ".bin"})["scores"][
                "documents"
            ],
            2,
        )

    def test_unknown(self):
        self.assertEqual(categorize({"path": "x", "suffix": ""})["category"], "other")

    def test_extension_wins(self):
        self.assertEqual(
            categorize({"path": "workshop-handout.csv", "suffix": ".csv"})["category"],
            "tables",
        )

    def test_heldout(self):
        self.assertEqual(
            categorize({"path": "raw.tar", "suffix": ".tar"})["scores"]["archives"], 3
        )
