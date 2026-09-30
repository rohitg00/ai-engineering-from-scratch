import unittest
from cli import run


class Delta(unittest.TestCase):
    def test_regression_stays_visible(self):
        result = run(
            {"q1": ["b", "a"], "q2": ["a", "b"]},
            {"q1": ["a", "b"], "q2": ["b", "a"]},
            {"q1": {"a": 3, "b": 0}, "q2": {"a": 3, "b": 0}},
            2,
        )
        self.assertEqual(result["regressions"], 1)
        self.assertEqual(result["deltas"][0]["query"], "q2")
