import unittest
import tempfile
from pathlib import Path
from fingerprint import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(normalize({"id": "a", "text": " x "})["text"], "x")

    def test_02(self):
        self.assertEqual(
            normalize({"id": "a", "text": "é"})["hash"],
            normalize({"id": "b", "text": "é"})["hash"],
        )

    def test_03(self):
        self.assertNotEqual(
            normalize({"id": "a", "text": "x"})["hash"],
            normalize({"id": "a", "text": "y"})["hash"],
        )

    def test_04(self):
        with self.assertRaises(ValueError):
            normalize({"id": "", "text": "x"})

    def test_05(self):
        with self.assertRaises(ValueError):
            normalize({"id": "a", "text": " "})
