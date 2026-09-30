import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Tokens(unittest.TestCase):
    def test_case(self):
        self.assertEqual(normalize("HELLO hello"), ["hello", "hello"])

    def test_unicode(self):
        self.assertEqual(normalize("CAFÉ"), ["café"])

    def test_empty(self):
        self.assertEqual(normalize(""), [])

    def test_alias(self):
        self.assertEqual(normalize("release", {"release": "deploy"}), ["deploy"])

    def test_cycle(self):
        self.assertEqual(normalize("a", {"a": "b", "b": "a"}), ["b"])

    def test_invalid(self):
        with self.assertRaises(ValueError):
            normalize(None)
