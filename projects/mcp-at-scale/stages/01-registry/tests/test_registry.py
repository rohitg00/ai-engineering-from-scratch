import unittest
import tempfile
from pathlib import Path
from registry import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(len(catalog()), 250)

    def test_02(self):
        self.assertEqual(len({t["name"] for t in catalog()}), 250)

    def test_03(self):
        self.assertEqual(
            execute(
                next(t for t in catalog() if t["name"] == "pods_count"),
                {},
                {"pods": [{"name": "a"}]},
            ),
            1,
        )

    def test_04(self):
        self.assertIsNone(
            execute(
                next(t for t in catalog() if t["name"] == "pods_get"),
                {"name": "missing"},
                {},
            )
        )

    def test_05(self):
        with self.assertRaises(ValueError):
            execute(catalog()[0], {"extra": "x"}, {})
