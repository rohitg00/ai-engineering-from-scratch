import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Scorecard(unittest.TestCase):
    def test_percentile(self):
        self.assertEqual(percentile([3, 1, 2], 0.5), 2)

    def test_tail(self):
        self.assertEqual(percentile([3, 1, 2], 0.95), 3)

    def test_empty(self):
        self.assertIsNone(scorecard([], {}, "fixture")["p50_ms"])

    def test_source(self):
        with self.assertRaises(ValueError):
            scorecard([], {}, "")

    def test_bad_latency(self):
        with self.assertRaises(ValueError):
            percentile([float("inf")], 0.5)
