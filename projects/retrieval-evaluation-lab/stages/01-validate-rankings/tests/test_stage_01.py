import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Contract(unittest.TestCase):
    def test_good(self):
        self.assertTrue(validate(["a"], {"a": 3}, 1))

    def test_duplicates(self):
        with self.assertRaises(ValueError):
            validate(["a", "a"], {}, 2)

    def test_cutoff(self):
        with self.assertRaises(ValueError):
            validate([], {}, 0)

    def test_grade(self):
        with self.assertRaises(ValueError):
            validate([], {"a": 4}, 1)

    def test_bool(self):
        with self.assertRaises(ValueError):
            validate([], {"a": True}, 1)
