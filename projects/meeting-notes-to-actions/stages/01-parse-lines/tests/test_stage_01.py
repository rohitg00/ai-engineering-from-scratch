import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Parse(unittest.TestCase):
    def test_line(self):
        self.assertEqual(parse_notes("note\nACTION A | ? | task")[0]["lines"], [2])

    def test_unmarked(self):
        self.assertEqual(parse_notes("Maybe A should act"), [])

    def test_empty(self):
        self.assertEqual(parse_notes(""), [])

    def test_malformed(self):
        with self.assertRaises(ValueError):
            parse_notes("ACTION no delimiters")

    def test_pipe_task(self):
        self.assertEqual(parse_notes("ACTION A | ? | a | b")[0]["task"], "a | b")
