import unittest
import tempfile
from pathlib import Path
from dataset import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(split_cases([]), {"development": [], "holdout": []})

    def test_02(self):
        cases = [{"id": str(i), "text": "x", "label": "a"} for i in range(30)]
        s = split_cases(cases)
        self.assertEqual(len(s["development"]) + len(s["holdout"]), 30)

    def test_03(self):
        case = {"id": "a", "text": "x", "label": "a"}
        self.assertEqual(split_cases([case]), split_cases([case]))

    def test_04(self):
        with self.assertRaises(ValueError):
            split_cases([{"id": "a", "text": "x", "label": "a"}] * 2)

    def test_05(self):
        with self.assertRaises(ValueError):
            split_cases([], 1)
