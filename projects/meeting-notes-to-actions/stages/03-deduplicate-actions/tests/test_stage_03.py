import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Dedup(unittest.TestCase):
    def test_same(self):
        self.assertEqual(
            len(deduplicate(parse_notes("ACTION A | ? | Task\nACTION a | ? | task"))), 1
        )

    def test_lines(self):
        self.assertEqual(
            deduplicate(parse_notes("ACTION A | ? | Task\nACTION a | ? | task"))[0][
                "lines"
            ],
            [1, 2],
        )

    def test_owner(self):
        self.assertEqual(
            len(deduplicate(parse_notes("ACTION A | ? | Task\nACTION B | ? | Task"))), 2
        )

    def test_date(self):
        self.assertEqual(
            len(
                deduplicate(
                    parse_notes(
                        "ACTION A | 2026-01-01 | Task\nACTION A | 2026-01-02 | Task"
                    )
                )
            ),
            2,
        )

    def test_empty(self):
        self.assertEqual(deduplicate([]), [])
