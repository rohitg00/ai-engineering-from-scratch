import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def test_hash(self):
        with tempfile.TemporaryDirectory() as d:
            pathlib.Path(d, "a.txt").write_text("same")
            pathlib.Path(d, "b.txt").write_text("same")
            r = inventory(d)
            self.assertEqual(r[0]["sha256"], r[1]["sha256"])

    def test_empty(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(inventory(d), [])

    def test_missing(self):
        with self.assertRaises(ValueError):
            inventory("/this-directory-does-not-exist-123")

    def test_symlink(self):
        with tempfile.TemporaryDirectory() as d:
            pathlib.Path(d, "link").symlink_to("/tmp")
            with self.assertRaises(ValueError):
                inventory(d)

    def test_heldout_nested(self):
        with tempfile.TemporaryDirectory() as d:
            pathlib.Path(d, "deep").mkdir()
            pathlib.Path(d, "deep", "Résumé.TXT").write_text("é")
            r = inventory(d)[0]
            self.assertEqual(r["suffix"], ".txt")
            self.assertEqual(r["size"], 2)
