import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Settle(unittest.TestCase):
    def setUp(self):
        self.s = reserve(ledger(100), "a", 50)

    def test_release(self):
        self.assertEqual(settle(self.s, "a", 30)["spent"], 30)

    def test_cancel(self):
        self.assertEqual(settle(self.s, "a", 0)["holds"], {})

    def test_overrun(self):
        with self.assertRaises(ValueError):
            settle(self.s, "a", 51)

    def test_repeat(self):
        with self.assertRaises(ValueError):
            settle(settle(self.s, "a", 20), "a", 20)

    def test_no_reuse(self):
        with self.assertRaises(ValueError):
            reserve(settle(self.s, "a", 20), "a", 10)
