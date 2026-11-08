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

    def test_alter(self):
        with tempfile.TemporaryDirectory() as d:
            r = rehearse(self.db(d), "ALTER TABLE t ADD COLUMN y TEXT;")
            self.assertTrue(r["applied"])
            self.assertEqual(len(r["schema_diff"]), 1)

    def test_source_unchanged(self):
        with tempfile.TemporaryDirectory() as d:
            p = self.db(d)
            before = p.read_bytes()
            rehearse(p, "DELETE FROM t;")
            self.assertEqual(p.read_bytes(), before)

    def test_attach_denied(self):
        with tempfile.TemporaryDirectory() as d:
            target = pathlib.Path(d, "outside.db")
            r = rehearse(
                self.db(d), "ATTACH DATABASE '" + str(target) + "' AS outside;"
            )
            self.assertFalse(r["applied"])
            self.assertFalse(target.exists())

    def test_pragma_denied(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(
                rehearse(self.db(d), "PRAGMA writable_schema=ON;")["applied"]
            )

    def test_bad_sql(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(
                rehearse(self.db(d), "ALTER imaginary nonsense;")["applied"]
            )
