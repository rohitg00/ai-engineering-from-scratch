import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def p(self, text="hola"):
        return propose(
            parse_vtt("WEBVTT\n\na\n00:00.000 --> 00:01.000\nmap"),
            {"a": text},
            {"map": "mapa"},
        )

    def test_budget(self):
        self.assertIn("over_budget", inspect(self.p("mapa muy grande"), 3)[0]["flags"])

    def test_term(self):
        self.assertIn("glossary_missing", inspect(self.p())[0]["flags"])

    def test_tag_count(self):
        self.assertEqual(inspect(self.p("<b>mapa</b>"))[0]["characters"], 4)

    def test_invalid(self):
        with self.assertRaises(ValueError):
            inspect([], 0)

    def test_heldout_unicode(self):
        self.assertEqual(inspect(self.p("é ü"))[0]["characters"], 2)
