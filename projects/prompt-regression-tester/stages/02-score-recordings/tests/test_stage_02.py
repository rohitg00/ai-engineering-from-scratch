import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Score(unittest.TestCase):
    def test_json(self):
        self.assertTrue(score_response("{}", [{"kind": "json"}])["passed"])

    def test_nan(self):
        self.assertFalse(score_response("NaN", [{"kind": "json"}])["passed"])

    def test_missing(self):
        self.assertFalse(score_response(None, [{"kind": "json"}])["passed"])

    def test_contains(self):
        self.assertFalse(
            score_response("X", [{"kind": "contains", "value": "x"}])["passed"]
        )

    def test_excludes(self):
        self.assertFalse(
            score_response("secret", [{"kind": "excludes", "value": "secret"}])[
                "passed"
            ]
        )

    def test_empty(self):
        self.assertFalse(score_response("x", [])["passed"])
