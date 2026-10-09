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

    def test_reversible(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertTrue(
                test_rollback(
                    self.db(d), "CREATE TABLE extra(y);", "DROP TABLE extra;"
                )["reversible"]
            )

    def test_loss(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(
                test_rollback(self.db(d), "DELETE FROM t;", "SELECT 1;")["reversible"]
            )

    def test_same_count_wrong_data(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(
                test_rollback(self.db(d), "UPDATE t SET x=2;", "UPDATE t SET x=3;")[
                    "reversible"
                ]
            )

    def test_rollback_error(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertIsNotNone(
                test_rollback(
                    self.db(d), "CREATE TABLE extra(y);", "DROP TABLE missing;"
                )["rollback_error"]
            )

    def test_forward_error(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(
                test_rollback(self.db(d), "INVALID SQL;", "SELECT 1;")["reversible"]
            )
