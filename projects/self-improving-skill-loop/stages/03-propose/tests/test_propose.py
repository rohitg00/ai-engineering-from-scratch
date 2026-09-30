import unittest
import tempfile
from pathlib import Path
from propose import *


class StageTests(unittest.TestCase):
    def test_01(self):
        cases = [
            {"text": "refund please", "label": "billing"},
            {"text": "refund now", "label": "billing"},
        ]
        self.assertIn({"terms": ["refund"], "label": "billing"}, propose(cases, []))

    def test_02(self):
        cases = [{"text": "reset", "label": "a"}, {"text": "reset", "label": "b"}]
        self.assertEqual(propose(cases, []), [])

    def test_03(self):
        self.assertEqual(propose([{"text": "rare", "label": "a"}], []), [])

    def test_04(self):
        rules = [{"terms": ["x"], "label": "a"}]
        propose([], rules)
        self.assertEqual(len(rules), 1)

    def test_05(self):
        with self.assertRaises(ValueError):
            propose([], [], 0)
