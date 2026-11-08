import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def db(self, d):
        p = pathlib.Path(d, "source.db")
        c = sqlite3.connect(p)
        c.execute("CREATE TABLE items(id INTEGER PRIMARY KEY,value TEXT)")
        c.executemany("INSERT INTO items VALUES (?,?)", [(1, "a"), (2, "b")])
        c.commit()
        c.close()
        return p

    def test_count(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(snapshot(self.db(d))["tables"]["items"]["rows"], 2)

    def test_schema(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertIn("CREATE TABLE", snapshot(self.db(d))["schema"][0]["sql"])

    def test_missing(self):
        with self.assertRaises(ValueError):
            snapshot("/missing/rehearsal-123.db")

    def test_stability(self):
        with tempfile.TemporaryDirectory() as d:
            p = self.db(d)
            self.assertEqual(snapshot(p), snapshot(p))

    def test_same_count_different_data(self):
        with tempfile.TemporaryDirectory() as d:
            p = self.db(d)
            before = snapshot(p)
            c = sqlite3.connect(p)
            c.execute("UPDATE items SET value='z' WHERE id=1")
            c.commit()
            c.close()
            self.assertNotEqual(
                before["tables"]["items"]["data_hash"],
                snapshot(p)["tables"]["items"]["data_hash"],
            )
