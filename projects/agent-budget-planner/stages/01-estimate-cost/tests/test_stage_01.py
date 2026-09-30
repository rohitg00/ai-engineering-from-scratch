import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Estimate(unittest.TestCase):
    def test_value(self):
        self.assertEqual(estimate(10, 5, 2, 3), 35)

    def test_zero(self):
        self.assertEqual(estimate(0, 0, 1, 1), 0)

    def test_large(self):
        self.assertEqual(estimate(10**20, 0, 2, 0), 2 * 10**20)

    def test_negative(self):
        with self.assertRaises(ValueError):
            estimate(-1, 0, 1, 1)

    def test_float(self):
        with self.assertRaises(ValueError):
            estimate(1.2, 0, 1, 1)
