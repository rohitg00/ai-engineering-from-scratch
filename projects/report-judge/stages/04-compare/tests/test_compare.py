import unittest
import tempfile
from pathlib import Path
from compare import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertTrue(compare({"a": 1, "b": 2}, {"a": 2, "b": 3})["promote"])

    def test_02(self):
        self.assertFalse(compare({"a": 1}, {"a": 1})["promote"])

    def test_03(self):
        self.assertEqual(compare({"a": 2}, {"a": 1})["regressions"], ["a"])

    def test_04(self):
        self.assertEqual(compare({"a": 1}, {"a": 2}), compare({"a": 1}, {"a": 2}))

    def test_05(self):
        with self.assertRaises(ValueError):
            compare({"a": 1}, {"b": 1})
