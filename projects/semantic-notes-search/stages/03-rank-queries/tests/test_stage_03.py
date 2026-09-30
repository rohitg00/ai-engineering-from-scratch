import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Ranking(unittest.TestCase):
    def test_match(self):
        self.assertEqual(
            search(build_index({"a": "apple", "b": "pear"}), "apple")[0]["id"], "a"
        )

    def test_tie(self):
        self.assertEqual(
            [r["id"] for r in search(build_index({"z": "a", "b": "a"}), "a")],
            ["b", "z"],
        )

    def test_unknown(self):
        self.assertEqual(search(build_index({"x": "a"}), "z"), [])

    def test_empty(self):
        self.assertEqual(search(build_index({"x": "a"}), ""), [])

    def test_alias(self):
        self.assertEqual(
            search(build_index({"x": "deploy"}, {"release": "deploy"}), "release")[0][
                "id"
            ],
            "x",
        )

    def test_invalid_k(self):
        with self.assertRaises(ValueError):
            search(build_index({}), "q", 0)
