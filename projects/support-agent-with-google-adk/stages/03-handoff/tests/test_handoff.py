import unittest
import tempfile
from pathlib import Path
from handoff import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(begin({"id": "a"})["state"], "received")

    def test_02(self):
        self.assertEqual(
            transition(begin({"id": "a"}), "classify", "invoice")["route"], "billing"
        )

    def test_03(self):
        with self.assertRaises(ValueError):
            transition(begin({"id": "a"}), "respond", "hello")

    def test_04(self):
        s = transition(begin({"id": "a"}), "classify", "unknown")
        with self.assertRaises(ValueError):
            transition(s, "respond", "hello")

    def test_05(self):
        s = begin({"id": "a"})
        transition(s, "classify", "invoice")
        self.assertEqual(s["history"], [])
