import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Gate(unittest.TestCase):
    def test_empty(self):
        self.assertEqual(release_gate(compare([], {}, {}))["decision"], "block")

    def test_pass(self):
        self.assertEqual(
            release_gate({"cases": [1], "pass_rate": 1, "regressions": 0})["decision"],
            "ship",
        )

    def test_regression(self):
        self.assertEqual(
            release_gate({"cases": [1], "pass_rate": 1, "regressions": 1})["decision"],
            "block",
        )

    def test_nan(self):
        with self.assertRaises(ValueError):
            release_gate({}, float("nan"))

    def test_negative(self):
        with self.assertRaises(ValueError):
            release_gate({}, 1, -1)
