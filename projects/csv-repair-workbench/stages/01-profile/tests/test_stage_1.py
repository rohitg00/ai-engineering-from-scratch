import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def test_original(self):
        self.assertEqual(profile("a,b\n x ,2\n")["rows"][0]["a"], " x ")

    def test_missing(self):
        self.assertEqual(profile('a\n""\n')["profile"]["a"]["missing"], 1)

    def test_ragged(self):
        with self.assertRaises(ValueError):
            profile("a,b\nx\n")

    def test_duplicate(self):
        with self.assertRaises(ValueError):
            profile("a,a\nx,y")

    def test_heldout(self):
        self.assertEqual(profile('name,note\nÉloi,"a,b"\n')["rows"][0]["note"], "a,b")
