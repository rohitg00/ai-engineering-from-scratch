import unittest
import tempfile
from pathlib import Path
from support import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(support("limit 5", "limit 10")["reason"], "number")

    def test_02(self):
        self.assertEqual(support("not shared", "shared")["reason"], "negation")

    def test_03(self):
        self.assertEqual(support("a kernel is shared", "kernel shared")["score"], 1)

    def test_04(self):
        self.assertEqual(
            judge_claim({"text": "x", "cites": ["S9"]}, {})["reason"], "dangling"
        )

    def test_05(self):
        self.assertFalse(judge_claim({"text": "x", "cites": []}, {})["supported"])
