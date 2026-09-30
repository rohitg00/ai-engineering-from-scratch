import unittest
import tempfile
from pathlib import Path
from executor import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(execute([], lambda a, b: None)["state"], "completed")

    def test_02(self):
        self.assertEqual(
            execute([{"operation": "x", "resource": "a"}], lambda a, b: {"ok": True})[
                "results"
            ][0]["value"],
            {"ok": True},
        )

    def test_03(self):
        calls = []
        r = execute(
            [{"operation": "x", "resource": "a"}],
            lambda a, b: calls.append(1),
            max_steps=0,
        )
        self.assertEqual(calls, [])
        self.assertEqual(r["state"], "budget_exhausted")

    def test_04(self):
        self.assertEqual(
            execute(
                [{"operation": "x", "resource": "a"}],
                lambda a, b: "x" * 100,
                max_chars=2,
            )["state"],
            "budget_exhausted",
        )

    def test_05(self):
        with self.assertRaises(ValueError):
            execute([], lambda a, b: None, max_steps=-1)
