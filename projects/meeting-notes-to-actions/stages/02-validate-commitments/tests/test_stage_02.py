import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Validate(unittest.TestCase):
    def action(self, o="A", d="2026-09-28", t="Task"):
        return {"owner": o, "due": d, "task": t, "lines": [1]}

    def test_good(self):
        self.assertEqual(validate_action(self.action())["flags"], [])

    def test_unknown(self):
        self.assertEqual(len(validate_action(self.action("?", "?"))["flags"]), 2)

    def test_invalid_calendar(self):
        with self.assertRaises(ValueError):
            validate_action(self.action(d="2026-02-30"))

    def test_empty_task(self):
        with self.assertRaises(ValueError):
            validate_action(self.action(t=""))

    def test_format(self):
        with self.assertRaises(ValueError):
            validate_action(self.action(d="20260928"))

    def test_missing_citations(self):
        action = self.action()
        del action["lines"]
        with self.assertRaises(ValueError):
            validate_action(action)

    def test_citation_container(self):
        for lines in (None, [], "1", (1,)):
            with self.subTest(lines=lines), self.assertRaises(ValueError):
                validate_action({**self.action(), "lines": lines})

    def test_citation_values(self):
        for line in (True, False, 0, -1, 1.5, "1"):
            with self.subTest(line=line), self.assertRaises(ValueError):
                validate_action({**self.action(), "lines": [line]})

    def test_multiple_citations(self):
        action = {**self.action(), "lines": [1, 3]}
        self.assertEqual(validate_action(action)["lines"], [1, 3])
