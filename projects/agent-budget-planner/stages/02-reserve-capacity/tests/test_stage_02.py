import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Reserve(unittest.TestCase):
    def test_hold(self):
        self.assertEqual(reserve(ledger(10), "a", 10)["holds"], {"a": 10})

    def test_overflow(self):
        with self.assertRaises(ValueError):
            reserve(reserve(ledger(100), "a", 60), "b", 60)

    def test_duplicate(self):
        with self.assertRaises(ValueError):
            reserve(reserve(ledger(10), "a", 1), "a", 1)

    def test_original(self):
        s = ledger(10)
        reserve(s, "a", 1)
        self.assertEqual(s["holds"], {})

    def test_bad_id(self):
        with self.assertRaises(ValueError):
            reserve(ledger(1), "", 0)
