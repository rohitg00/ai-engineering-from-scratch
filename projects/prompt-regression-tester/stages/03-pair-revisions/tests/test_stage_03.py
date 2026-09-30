import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Paired(unittest.TestCase):
    def setUp(self):
        self.c = [{"id": "a", "prompt": "q", "checks": [{"kind": "json"}]}]

    def test_regression(self):
        self.assertEqual(compare(self.c, {"a": "{}"}, {})["regressions"], 1)

    def test_improvement(self):
        self.assertEqual(compare(self.c, {}, {"a": "{}"})["improvements"], 1)

    def test_stable(self):
        self.assertEqual(
            compare(self.c, {"a": "{}"}, {"a": "{}"})["cases"][0]["state"],
            "stable_pass",
        )

    def test_both_fail(self):
        self.assertEqual(compare(self.c, {}, {})["cases"][0]["state"], "stable_fail")

    def test_extra_ignored(self):
        self.assertEqual(compare(self.c, {}, {"unrelated": "{}"})["pass_rate"], 0)
