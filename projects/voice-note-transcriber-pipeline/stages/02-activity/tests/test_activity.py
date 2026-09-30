import unittest
import tempfile
from pathlib import Path
from activity import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(activity([0] * 100, 1000), [])

    def test_02(self):
        self.assertEqual(activity([0.5] * 100, 1000), [(0, 100)])

    def test_03(self):
        self.assertEqual(activity([0.5] * 40 + [0] * 20 + [0.5] * 40, 1000), [(0, 100)])

    def test_04(self):
        self.assertEqual(activity([0.5] * 20, 1000, min_ms=40), [])

    def test_05(self):
        with self.assertRaises(ValueError):
            activity([], 0)
