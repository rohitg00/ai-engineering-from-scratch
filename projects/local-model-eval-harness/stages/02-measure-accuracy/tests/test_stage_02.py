import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Accuracy(unittest.TestCase):
    def r(self, a=" X "):
        return {"id": "a", "answer": a, "confidence": 0.5, "latency_ms": 1}

    def test_case(self):
        self.assertEqual(accuracy([self.r()], {"a": "x"})["accuracy"], 1)

    def test_missing(self):
        self.assertEqual(accuracy([self.r()], {"a": "x", "b": "y"})["accuracy"], 0.5)

    def test_coverage(self):
        self.assertEqual(accuracy([], {"a": "x"})["coverage"], 0)

    def test_unknown(self):
        with self.assertRaises(ValueError):
            accuracy([self.r()], {})

    def test_wrong(self):
        self.assertEqual(accuracy([self.r("z")], {"a": "x"})["correct"], 0)
