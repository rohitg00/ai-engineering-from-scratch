import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
from main import *


class Contract(unittest.TestCase):
    def test_minimal(self):
        spec = {"version": 1, "fields": {"id": {"type": "string"}}}
        self.assertEqual(validate_contract(spec), spec)

    def test_unknown_rules(self):
        with self.assertRaises(ValueError):
            validate_contract(
                {"version": 1, "fields": {"id": {"type": "string", "regex": ".*"}}}
            )

    def test_unique_must_resolve(self):
        with self.assertRaises(ValueError):
            validate_contract(
                {
                    "version": 1,
                    "fields": {"id": {"type": "string"}},
                    "unique": ["missing"],
                }
            )

    def test_bool_is_not_numeric_bound(self):
        with self.assertRaises(ValueError):
            validate_contract(
                {"version": 1, "fields": {"x": {"type": "number", "min": True}}}
            )

    def test_inverted_bounds(self):
        with self.assertRaises(ValueError):
            validate_contract(
                {"version": 1, "fields": {"x": {"type": "number", "min": 9, "max": 3}}}
            )

    def test_enum_type(self):
        with self.assertRaises(ValueError):
            validate_contract(
                {"version": 1, "fields": {"x": {"type": "integer", "enum": [True]}}}
            )

    def test_row_bounds(self):
        with self.assertRaises(ValueError):
            validate_contract(
                {
                    "version": 1,
                    "fields": {"x": {"type": "number"}},
                    "min_rows": 2,
                    "max_rows": 1,
                }
            )
