import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Validation(unittest.TestCase):
    def r(self, **kw):
        return {"id": "a", "answer": "x", "confidence": 0.5, "latency_ms": 1, **kw}

    def test_good(self):
        self.assertEqual(len(validate([self.r()])), 1)

    def test_nan(self):
        with self.assertRaises(ValueError):
            validate([self.r(confidence=float("nan"))])

    def test_duplicate(self):
        with self.assertRaises(ValueError):
            validate([self.r()] * 2)

    def test_negative(self):
        with self.assertRaises(ValueError):
            validate([self.r(latency_ms=-1)])

    def test_over_one(self):
        with self.assertRaises(ValueError):
            validate([self.r(confidence=1.1)])
