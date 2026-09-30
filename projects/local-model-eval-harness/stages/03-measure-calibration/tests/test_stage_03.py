import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Calibration(unittest.TestCase):
    def r(self, a="wrong", c=1):
        return {"id": "a", "answer": a, "confidence": c, "latency_ms": 1}

    def test_wrong(self):
        self.assertEqual(calibration([self.r()], {"a": "right"})["ece"], 1)

    def test_right(self):
        self.assertEqual(calibration([self.r("right")], {"a": "right"})["ece"], 0)

    def test_half(self):
        self.assertEqual(
            calibration([self.r("right", 0.5)], {"a": "right"})["ece"], 0.5
        )

    def test_empty(self):
        self.assertEqual(calibration([], {})["ece"], 0)

    def test_bins(self):
        with self.assertRaises(ValueError):
            calibration([], {}, 0)
