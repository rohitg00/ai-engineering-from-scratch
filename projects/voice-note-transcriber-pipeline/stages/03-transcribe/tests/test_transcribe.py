import unittest
import tempfile
from pathlib import Path
from transcribe import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(
            transcribe([0.5] * 100, 1000, [(0, 100)], lambda b: " hello ")[0]["text"],
            "hello",
        )

    def test_02(self):
        self.assertEqual(transcribe([], 1000, [], lambda b: "never"), [])

    def test_03(self):
        with self.assertRaises(ValueError):
            transcribe([0], 1, [(0, 2)], lambda b: "x")

    def test_04(self):
        with self.assertRaises(ValueError):
            transcribe([0], 1, [(0, 1)], lambda b: "")

    def test_05(self):
        calls = []

        def provider(b):
            calls.append(b)
            if len(calls) == 1:
                raise TimeoutError()
            return "retry worked"

        self.assertEqual(
            transcribe([0.5] * 10, 1000, [(0, 10)], provider)[0]["attempts"], 2
        )
