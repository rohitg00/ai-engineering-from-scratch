import unittest
import tempfile
from pathlib import Path
from intake import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertIn(
            "[email]",
            ticket({"id": "a", "text": "Contact me at x@example.test"})["text"],
        )

    def test_02(self):
        self.assertNotIn(
            "secret-value", ticket({"id": "a", "text": "api_key=secret-value"})["text"]
        )

    def test_03(self):
        self.assertEqual(
            ticket({"id": "a", "text": "reset account"})["priority"], "normal"
        )

    def test_04(self):
        with self.assertRaises(ValueError):
            ticket({"id": "", "text": "x"})

    def test_05(self):
        with self.assertRaises(ValueError):
            ticket({"id": "a", "text": " "})
