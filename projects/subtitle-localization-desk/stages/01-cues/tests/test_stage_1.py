import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def test_parse(self):
        self.assertEqual(
            parse_vtt("WEBVTT\n\na\n00:00.000 --> 00:02.000\nHello")[0]["duration"], 2
        )

    def test_settings(self):
        self.assertEqual(
            parse_vtt("WEBVTT\n\n00:00.000 --> 00:02.000 align:start\nHello")[0][
                "settings"
            ],
            "align:start",
        )

    def test_reversed(self):
        with self.assertRaises(ValueError):
            parse_vtt("WEBVTT\n\n00:02.000 --> 00:01.000\nHello")

    def test_bad_header(self):
        with self.assertRaises(ValueError):
            parse_vtt("SRT\n\nHello")

    def test_duplicate(self):
        with self.assertRaises(ValueError):
            parse_vtt(
                "WEBVTT\n\na\n00:00.000 --> 00:01.000\nX\n\na\n00:01.000 --> 00:02.000\nY"
            )
