import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Fingerprints(unittest.TestCase):
    def test_spaces(self):
        self.assertEqual(fingerprint(" A  B "), fingerprint("a b"))

    def test_nfkc(self):
        self.assertEqual(fingerprint("Ａ"), fingerprint("a"))

    def test_diff(self):
        self.assertNotEqual(fingerprint("a"), fingerprint("b"))

    def test_length(self):
        self.assertEqual(len(fingerprint("x")), 64)

    def test_type(self):
        with self.assertRaises(ValueError):
            fingerprint(None)
