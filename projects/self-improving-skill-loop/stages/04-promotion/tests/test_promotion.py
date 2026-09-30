import unittest
import tempfile
from pathlib import Path
from promotion import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertTrue(
            gate(
                [{"id": "a", "text": "refund", "label": "billing"}],
                [],
                [{"terms": ["refund"], "label": "billing"}],
            )["promote"]
        )

    def test_02(self):
        self.assertFalse(
            gate([{"id": "a", "text": "x", "label": "unknown"}], [], [])["promote"]
        )

    def test_03(self):
        self.assertEqual(
            gate(
                [{"id": "a", "text": "x", "label": "unknown"}],
                [],
                [{"terms": ["x"], "label": "wrong"}],
            )["regressions"],
            ["a"],
        )

    def test_04(self):
        with self.assertRaises(ValueError):
            gate([], [], [])

    def test_05(self):
        self.assertEqual(
            len(
                gate([{"id": "a", "text": "x", "label": "unknown"}], [], [])[
                    "candidate_sha256"
                ]
            ),
            64,
        )
