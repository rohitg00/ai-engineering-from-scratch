import unittest
import tempfile
from pathlib import Path
from metrics import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(
            score_report("Kernel shared [S1].", {"S1": "Kernel shared."})["precision"],
            1,
        )

    def test_02(self):
        self.assertEqual(score_report("", {})["precision"], 0)

    def test_03(self):
        self.assertEqual(
            score_report("X [S1].", {"S1": "X"}, ["S1", "S2"])["recall"], 0.5
        )

    def test_04(self):
        self.assertEqual(
            score_report(
                "Kernel [S1].", {"S1": "Kernel"}, facts=[["kernel"], ["socket"]]
            )["coverage"],
            0.5,
        )

    def test_05(self):
        self.assertEqual(
            score_report("Invented.", {}, ["S1"], [["kernel"]])["score"], 0
        )
