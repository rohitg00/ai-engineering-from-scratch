import unittest
import tempfile
from pathlib import Path
from answer import *


class StageTests(unittest.TestCase):
    def test_01(self):
        c = [{"id": "a:0", "source": "a", "start": 0, "text": "Kernel shared."}]
        self.assertEqual(
            answer("q", c, lambda p: '{"quote":"Kernel shared.","source":"a:0"}')[
                "state"
            ],
            "answered",
        )

    def test_02(self):
        self.assertEqual(answer("q", [], lambda p: None)["state"], "abstained")

    def test_03(self):
        with self.assertRaises(ValueError):
            answer(
                "q", [{"id": "a", "text": "x"}], lambda p: '{"quote":"y","source":"a"}'
            )

    def test_04(self):
        with self.assertRaises(ValueError):
            answer("q", [{"id": "a", "text": "x"}], lambda p: "not json")

    def test_05(self):
        c = [{"id": "a", "source": "d", "start": 10, "text": "abc def"}]
        self.assertEqual(
            answer("q", c, lambda p: '{"quote":"def","source":"a"}')["citations"][0][
                "start"
            ],
            14,
        )
