import unittest
import tempfile
from pathlib import Path
from retrieve import *
from fingerprint import normalize


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(
            retrieve(
                {"a": normalize({"id": "a", "text": "kernel", "updated": 10})},
                "kernel",
                11,
            )[0]["age"],
            1,
        )

    def test_02(self):
        self.assertEqual(
            retrieve(
                {"a": normalize({"id": "a", "text": "kernel", "updated": 10})},
                "kernel",
                5000,
            ),
            [],
        )

    def test_03(self):
        self.assertEqual(
            retrieve(
                {"a": normalize({"id": "a", "text": "kernel", "updated": 10})},
                "kernel",
                9,
            ),
            [],
        )

    def test_04(self):
        self.assertEqual(retrieve({}, "", 0), [])

    def test_05(self):
        with self.assertRaises(ValueError):
            retrieve({}, "x", 0, max_age=-1)
