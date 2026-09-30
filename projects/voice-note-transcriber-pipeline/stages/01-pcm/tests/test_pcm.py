import unittest
import tempfile
from pathlib import Path
from pcm import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(
            decode_wav(encode_wav([0, 0.5, -0.5]))["samples"], [0, 0.5, -0.5]
        )

    def test_02(self):
        self.assertEqual(decode_wav(encode_wav([], 8000))["rate"], 8000)

    def test_03(self):
        self.assertEqual(decode_wav(encode_wav([2]))["samples"][0], 32767 / 32768)

    def test_04(self):
        with self.assertRaises((wave.Error, EOFError)):
            decode_wav(b"bad")

    def test_05(self):
        with self.assertRaises(ValueError):
            encode_wav([], 0)
