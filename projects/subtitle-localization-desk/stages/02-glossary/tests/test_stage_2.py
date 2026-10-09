import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def cues(self):
        return parse_vtt("WEBVTT\n\na\n00:00.000 --> 00:03.000\nOpen the map.")

    def test_glossary(self):
        self.assertEqual(
            propose(self.cues(), {"a": "Abre el map."}, {"map": "mapa"})[0]["proposed"],
            "Abre el mapa.",
        )

    def test_missing(self):
        self.assertTrue(propose(self.cues(), {}, {})[0]["needs_translation"])

    def test_unknown(self):
        with self.assertRaises(ValueError):
            propose(self.cues(), {"x": "text"}, {})

    def test_boundary(self):
        self.assertEqual(
            propose(self.cues(), {"a": "mapping"}, {"map": "mapa"})[0]["proposed"],
            "mapping",
        )

    def test_heldout(self):
        self.assertEqual(
            propose(self.cues(), {"a": "MAP"}, {"map": "carte"})[0]["proposed"], "carte"
        )

    def test_whitespace_only_blank_line(self):
        with self.assertRaises(ValueError):
            propose(self.cues(), {"a": "Hola\n \nextra block"}, {})
