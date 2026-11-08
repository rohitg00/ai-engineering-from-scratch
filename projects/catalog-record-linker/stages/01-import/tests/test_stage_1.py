import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def test_import(self):
        self.assertEqual(
            import_catalog("id,title\n1,Atlas", "a")[0]["source_id"], "a:1"
        )

    def test_duplicate(self):
        with self.assertRaises(ValueError):
            import_catalog("id,title\n1,A\n1,B", "a")

    def test_missing_title(self):
        with self.assertRaises(ValueError):
            import_catalog("id,name\n1,A", "a")

    def test_ragged(self):
        with self.assertRaises(ValueError):
            import_catalog("id,title\n1,A,B", "a")

    def test_heldout(self):
        self.assertEqual(
            import_catalog('id,title,year\nβ,"Maps, old",1985', "archive")[0]["year"],
            "1985",
        )
