import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Evaluation(unittest.TestCase):
    def test_hit(self):
        self.assertEqual(
            evaluate(build_index({"a": "one"}), [{"query": "one", "expected": "a"}])[
                "recall"
            ],
            1,
        )

    def test_miss(self):
        self.assertEqual(
            evaluate(build_index({"a": "one"}), [{"query": "two", "expected": "a"}])[
                "hits"
            ],
            0,
        )

    def test_empty(self):
        self.assertEqual(evaluate(build_index({}), [])["recall"], 0)

    def test_unknown_label(self):
        with self.assertRaises(ValueError):
            evaluate(build_index({}), [{"query": "x", "expected": "x"}])

    def test_fraction(self):
        self.assertEqual(
            evaluate(
                build_index({"a": "one"}),
                [{"query": "one", "expected": "a"}, {"query": "two", "expected": "a"}],
            )["recall"],
            0.5,
        )
