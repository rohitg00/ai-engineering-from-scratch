import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Summary(unittest.TestCase):
    def test_empty(self):
        self.assertFalse(summarize([], [])["usable"])

    def test_one_side(self):
        self.assertFalse(
            summarize([{"id": "a", "group": "a", "text": "a"}], [])["usable"]
        )

    def test_clean(self):
        self.assertTrue(
            summarize(
                [{"id": "a", "group": "a", "text": "a"}],
                [{"id": "b", "group": "b", "text": "b"}],
            )["usable"]
        )

    def test_leak(self):
        self.assertFalse(
            summarize(
                [{"id": "a", "group": "a", "text": "x"}],
                [{"id": "b", "group": "b", "text": "x"}],
            )["usable"]
        )

    def test_groups(self):
        self.assertEqual(
            summarize(
                [
                    {"id": "a", "group": "a", "text": "a"},
                    {"id": "b", "group": "a", "text": "b"},
                ],
                [],
            )["train_groups"],
            1,
        )
