import unittest
import tempfile
from pathlib import Path
from changes import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(diff({}, [{"id": "a", "text": "x"}])["insert"], ["a"])

    def test_02(self):
        self.assertEqual(
            diff({"a": normalize({"id": "a", "text": "x"})}, [])["delete"], ["a"]
        )

    def test_03(self):
        self.assertEqual(
            diff(
                {"a": normalize({"id": "a", "text": "x"})}, [{"id": "a", "text": "y"}]
            )["update"],
            ["a"],
        )

    def test_04(self):
        self.assertEqual(
            diff(
                {"a": normalize({"id": "a", "text": "x"})},
                [{"id": "a", "text": "x", "updated": 2}],
            )["refresh"],
            ["a"],
        )

    def test_05(self):
        with self.assertRaises(ValueError):
            diff({}, [{"id": "a", "text": "x"}, {"id": "a", "text": "x"}])
