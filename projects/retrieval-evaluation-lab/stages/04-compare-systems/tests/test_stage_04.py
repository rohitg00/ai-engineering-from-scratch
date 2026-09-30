import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Comparison(unittest.TestCase):
    def test_missing(self):
        with self.assertRaises(ValueError):
            compare_systems({"s": {}}, {"q": {"a": 1}}, 1)

    def test_empty(self):
        self.assertEqual(compare_systems({"s": {}}, {}, 1)["s"]["mean"]["rr"], 0)

    def test_macro(self):
        self.assertEqual(
            compare_systems(
                {"s": {"q": ["a"], "r": []}}, {"q": {"a": 1}, "r": {"b": 1}}, 1
            )["s"]["mean"]["rr"],
            0.5,
        )

    def test_unjudged(self):
        self.assertEqual(
            compare_systems({"s": {"q": ["x"]}}, {"q": {}}, 1)["s"]["queries"]["q"][
                "unjudged"
            ],
            1,
        )

    def test_same_metrics(self):
        self.assertEqual(
            compare_systems({"s": {"q": ["a"]}, "t": {"q": ["a"]}}, {"q": {"a": 1}}, 1)[
                "s"
            ],
            compare_systems({"s": {"q": ["a"]}}, {"q": {"a": 1}}, 1)["s"],
        )
