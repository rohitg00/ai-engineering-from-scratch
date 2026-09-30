import unittest
import tempfile
from pathlib import Path
from discovery import *
from registry import catalog


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(
            discover(catalog(), "pods count")["tools"][0]["name"], "pods_count"
        )

    def test_02(self):
        self.assertEqual(discover(catalog(), "pods", max_chars=1)["tools"], [])

    def test_03(self):
        self.assertEqual(discover(catalog(), "zzzz")["tools"], [])

    def test_04(self):
        self.assertLessEqual(len(discover(catalog(), "pods", k=2)["tools"]), 2)

    def test_05(self):
        self.assertLessEqual(
            discover(catalog(), "pods", max_chars=700)["characters"], 700
        )
