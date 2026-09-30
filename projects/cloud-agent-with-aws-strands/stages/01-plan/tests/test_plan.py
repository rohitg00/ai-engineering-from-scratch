import unittest
import tempfile
from pathlib import Path
from plan import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(
            validate_plan([{"operation": "metrics.read", "resource": "svc"}], {"svc"})[
                0
            ]["resource"],
            "svc",
        )

    def test_02(self):
        with self.assertRaises(ValueError):
            validate_plan([], {"svc"})

    def test_03(self):
        with self.assertRaises(ValueError):
            validate_plan([{"operation": "delete", "resource": "svc"}], {"svc"})

    def test_04(self):
        with self.assertRaises(ValueError):
            validate_plan([{"operation": "logs.read", "resource": "other"}], {"svc"})

    def test_05(self):
        with self.assertRaises(ValueError):
            validate_plan(
                [{"operation": "logs.read", "resource": "svc", "extra": 1}], {"svc"}
            )
