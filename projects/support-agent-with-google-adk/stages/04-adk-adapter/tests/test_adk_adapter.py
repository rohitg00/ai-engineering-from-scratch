import unittest
import tempfile
from pathlib import Path
from adk_adapter import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(collect_events([]), [])

    def test_02(self):
        self.assertEqual(
            collect_events([{"author": "triage", "text": "billing"}])[0]["agent"],
            "triage",
        )

    def test_03(self):
        self.assertEqual(collect_events([{"author": "triage", "text": ""}]), [])

    def test_04(self):
        with self.assertRaises(ValueError):
            collect_events([{"text": "x"}])

    def test_05(self):
        self.assertEqual(
            collect_events(
                [{"author": "triage", "text": "x", "state_delta": {"route": "billing"}}]
            )[0]["state_delta"]["route"],
            "billing",
        )
