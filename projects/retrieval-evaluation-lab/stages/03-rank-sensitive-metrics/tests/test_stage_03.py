import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Discount(unittest.TestCase):
    def test_ideal(self):
        self.assertAlmostEqual(rank_metrics(["a", "b"], {"a": 3, "b": 1}, 2)["ndcg"], 1)

    def test_reverse(self):
        self.assertLess(rank_metrics(["b", "a"], {"a": 3, "b": 1}, 2)["ndcg"], 1)

    def test_rr(self):
        self.assertEqual(rank_metrics(["x", "a"], {"a": 1}, 2)["rr"], 0.5)

    def test_zero(self):
        self.assertEqual(rank_metrics([], {}, 3)["ndcg"], 0)

    def test_cutoff(self):
        self.assertEqual(rank_metrics(["x", "a"], {"a": 1}, 1)["rr"], 0)
