import unittest
import tempfile
from pathlib import Path
from retrieval import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(
            retrieve(
                [{"id": "a", "text": "kernel"}, {"id": "b", "text": "socket"}], "socket"
            )[0]["id"],
            "b",
        )

    def test_02(self):
        self.assertEqual(retrieve([{"id": "a", "text": "x"}], "missing"), [])

    def test_03(self):
        self.assertEqual(retrieve([], "x"), [])

    def test_04(self):
        self.assertEqual(
            retrieve([{"id": "b", "text": "x"}, {"id": "a", "text": "x"}], "x")[0][
                "id"
            ],
            "a",
        )

    def test_05(self):
        self.assertEqual(retrieve([{"id": "a", "text": "x"}], "x", 0), [])
