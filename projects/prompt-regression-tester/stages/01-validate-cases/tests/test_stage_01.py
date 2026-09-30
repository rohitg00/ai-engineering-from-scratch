import json, math, tempfile, unittest
from pathlib import Path
from main import *


class Cases(unittest.TestCase):
    def test_empty(self):
        self.assertEqual(validate_cases([]), [])

    def test_good(self):
        self.assertEqual(
            len(
                validate_cases(
                    [{"id": "a", "prompt": "q", "checks": [{"kind": "json"}]}]
                )
            ),
            1,
        )

    def test_duplicate(self):
        with self.assertRaises(ValueError):
            validate_cases(
                [{"id": "a", "prompt": "q", "checks": [{"kind": "json"}]}] * 2
            )

    def test_typo(self):
        with self.assertRaises(ValueError):
            validate_cases([{"id": "a", "prompt": "q", "checks": [{"kind": "jsn"}]}])

    def test_no_checks(self):
        with self.assertRaises(ValueError):
            validate_cases([{"id": "a", "prompt": "q", "checks": []}])
