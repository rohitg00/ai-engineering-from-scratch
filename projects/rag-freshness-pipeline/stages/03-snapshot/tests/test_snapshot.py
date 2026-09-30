import unittest
import tempfile
from pathlib import Path
from snapshot import *


class StageTests(unittest.TestCase):
    def test_01(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(read_snapshot(Path(d) / "x")["version"], 0)

    def test_02(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(commit(Path(d) / "x", {}, 0)["version"], 1)

    def test_03(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x"
            commit(p, {"a": 1}, 0)
            with self.assertRaises(ValueError):
                commit(p, {}, 0)
            self.assertEqual(read_snapshot(p)["documents"], {"a": 1})

    def test_04(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x"
            commit(p, {}, 0)
            commit(p, {"b": 2}, 1)
            self.assertEqual(read_snapshot(p)["version"], 2)

    def test_05(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x"
            commit(p, {}, 0)
            self.assertEqual(sorted(q.name for q in Path(d).iterdir()), ["x", "x.lock"])
