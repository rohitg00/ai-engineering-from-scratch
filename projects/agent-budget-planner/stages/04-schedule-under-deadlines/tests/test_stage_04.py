import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Scheduling(unittest.TestCase):
    def test_deadline(self):
        self.assertEqual(
            schedule([{"id": "a", "cost": 1, "duration_ms": 10}], 10, 5)["events"][0][
                "reason"
            ],
            "deadline",
        )

    def test_budget(self):
        self.assertEqual(
            schedule([{"id": "a", "cost": 11, "duration_ms": 1}], 10, 5)["events"][0][
                "reason"
            ],
            "budget exceeded",
        )

    def test_boundary(self):
        self.assertEqual(
            schedule([{"id": "a", "cost": 10, "duration_ms": 5}], 10, 5)["ledger"][
                "spent"
            ],
            10,
        )

    def test_empty(self):
        self.assertEqual(schedule([], 0, 0)["events"], [])

    def test_duplicate(self):
        with self.assertRaises(ValueError):
            schedule([{"id": "a", "cost": 0, "duration_ms": 0}] * 2, 0, 0)
