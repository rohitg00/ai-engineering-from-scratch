import unittest
import tempfile
from pathlib import Path
from skill import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(
            route("Refund please", [{"terms": ["refund"], "label": "billing"}]),
            "billing",
        )

    def test_02(self):
        self.assertEqual(route("unrelated", []), "unknown")

    def test_03(self):
        self.assertEqual(
            route(
                "reset password", [{"terms": ["reset", "password"], "label": "access"}]
            ),
            "access",
        )

    def test_04(self):
        self.assertEqual(
            route("reset only", [{"terms": ["reset", "password"], "label": "access"}]),
            "unknown",
        )

    def test_05(self):
        self.assertEqual(
            evaluate([{"id": "a", "text": "x", "label": "unknown"}], [])["accuracy"], 1
        )
