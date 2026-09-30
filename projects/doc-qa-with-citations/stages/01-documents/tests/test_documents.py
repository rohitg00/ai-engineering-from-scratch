import unittest
import tempfile
from pathlib import Path
from documents import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(
            chunk_document({"id": "a", "text": "abcdef"}, 4, 1)[1]["start"], 3
        )

    def test_02(self):
        self.assertEqual(chunk_document({"id": "a", "text": ""}), [])

    def test_03(self):
        with self.assertRaises(ValueError):
            chunk_document({"id": "a", "text": "x"}, 2, 2)

    def test_04(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, "b.txt").write_text("b")
            Path(d, "a.txt").write_text("a")
            self.assertEqual([r["id"] for r in load_documents(d)], ["a.txt", "b.txt"])

    def test_05(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, "a.txt").write_text("hello")
            self.assertEqual(len(load_documents(d)[0]["sha256"]), 64)
