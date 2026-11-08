import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def db(self, d):
        p = pathlib.Path(d, "source.db")
        c = sqlite3.connect(p)
        c.execute("CREATE TABLE t(x)")
        c.execute("INSERT INTO t VALUES (1)")
        c.commit()
        c.close()
        return p

    def test_ready(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertTrue(
                receipt(
                    self.db(d),
                    "CREATE TABLE extra(y);",
                    "DROP TABLE extra;",
                    [{"table": "t", "preserve_data": True}],
                )["release_ready"]
            )

    def test_lost_row(self):
        with tempfile.TemporaryDirectory() as d:
            r = receipt(
                self.db(d),
                "DELETE FROM t;",
                "INSERT INTO t VALUES (1);",
                [{"table": "t", "same_rows": True}],
            )
            self.assertFalse(r["release_ready"])
            self.assertTrue(r["reversible"])

    def test_missing_table(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(
                receipt(self.db(d), "SELECT 1;", "SELECT 1;", [{"table": "missing"}])[
                    "invariant_results"
                ][0]["passed"]
            )

    def test_bad_rule(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):
                receipt(
                    self.db(d),
                    "SELECT 1;",
                    "SELECT 1;",
                    [{"table": "t", "min_rows": -1}],
                )

    def test_roundtrip(self):
        with tempfile.TemporaryDirectory() as d:
            r = receipt(self.db(d), "SELECT 1;", "SELECT 1;", [])
            self.assertEqual(json.loads(json.dumps(r))["schema_version"], 1)
