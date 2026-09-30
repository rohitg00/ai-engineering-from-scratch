import unittest
import tempfile
from pathlib import Path
from strands_adapter import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(
            parse_model_plan('[{"operation":"logs.read","resource":"svc"}]', {"svc"})[
                0
            ]["operation"],
            "logs.read",
        )

    def test_02(self):
        with self.assertRaises(ValueError):
            parse_model_plan("not json", {"svc"})

    def test_03(self):
        with self.assertRaises(ValueError):
            parse_model_plan('[{"operation":"delete","resource":"svc"}]', {"svc"})

    def test_04(self):
        with self.assertRaises(ValueError):
            parse_model_plan('[{"operation":"logs.read","resource":"other"}]', {"svc"})

    def test_05(self):
        with self.assertRaises(ValueError):
            parse_model_plan("{}", {"svc"})
