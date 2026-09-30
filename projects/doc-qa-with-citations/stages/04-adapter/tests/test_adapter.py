import unittest
import tempfile
from pathlib import Path
from adapter import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(
            adapt_splits({"id": "d", "text": "one two"}, ["one", "two"])[1]["start"], 4
        )

    def test_02(self):
        self.assertEqual(
            adapt_splits({"id": "d", "text": "ababa"}, ["aba", "aba"])[1]["start"], 2
        )

    def test_03(self):
        with self.assertRaises(ValueError):
            adapt_splits({"id": "d", "text": "one"}, ["changed"])

    def test_04(self):
        with self.assertRaises(ValueError):
            adapt_splits({"id": "d", "text": "one"}, [""])

    def test_05(self):
        self.assertEqual(adapt_splits({"id": "d", "text": ""}, []), [])
