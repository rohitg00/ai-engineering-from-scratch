import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
from main import *


class Contract(unittest.TestCase):
    def setUp(self):
        self.spec = validate_contract(
            {
                "version": 1,
                "fields": {"id": {"type": "string"}, "n": {"type": "number"}},
                "unique": ["id"],
            }
        )

    def test_all_duplicates(self):
        self.assertEqual(
            duplicate_rows(
                [{"id": "a"}, {"id": "b"}, {"id": "a"}, {"id": "a"}], self.spec
            ),
            [{"field": "id", "rows": [1, 3, 4]}],
        )

    def test_missing_not_duplicates(self):
        self.assertEqual(duplicate_rows([{}, {}], self.spec), [])

    def test_invalid_type_not_duplicates(self):
        self.assertEqual(duplicate_rows([{"id": []}, {"id": []}], self.spec), [])

    def test_distinct(self):
        self.assertEqual(duplicate_rows([{"id": "a"}, {"id": "A"}], self.spec), [])

    def test_numeric_equality(self):
        self.spec["unique"] = ["n"]
        self.assertEqual(
            duplicate_rows([{"n": 1}, {"n": 1.0}], self.spec),
            [{"field": "n", "rows": [1, 2]}],
        )

    def test_no_values_in_receipt(self):
        self.assertNotIn(
            "hidden",
            json.dumps(duplicate_rows([{"id": "hidden"}, {"id": "hidden"}], self.spec)),
        )
