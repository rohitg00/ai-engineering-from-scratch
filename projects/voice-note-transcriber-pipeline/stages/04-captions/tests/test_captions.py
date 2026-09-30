import unittest
import tempfile
from pathlib import Path
from captions import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(stamp(1.234), "00:00:01.234")

    def test_02(self):
        self.assertEqual(stamp(3661), "01:01:01.000")

    def test_03(self):
        self.assertTrue(captions([]).startswith("WEBVTT"))

    def test_04(self):
        self.assertIn("&lt;b&gt;", captions([{"start": 0, "end": 1, "text": "<b>"}]))

    def test_05(self):
        with self.assertRaises(ValueError):
            captions([{"start": 1, "end": 0, "text": "bad"}])
