import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Binary(unittest.TestCase):
    def test_half(self):
        self.assertEqual(
            precision_recall(["a", "x"], {"a": 1, "b": 1}, 2),
            {"precision": 0.5, "recall": 0.5},
        )

    def test_empty(self):
        self.assertEqual(precision_recall([], {}, 1)["recall"], 0)

    def test_underfill(self):
        self.assertEqual(precision_recall(["a"], {"a": 1}, 2)["precision"], 0.5)

    def test_zero_grade(self):
        self.assertEqual(precision_recall(["a"], {"a": 0}, 1)["precision"], 0)

    def test_beyond_k(self):
        self.assertEqual(precision_recall(["x", "a"], {"a": 1}, 1)["recall"], 0)
