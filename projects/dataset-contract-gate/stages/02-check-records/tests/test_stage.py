import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
from main import *


class Contract(unittest.TestCase):
    def setUp(self):
        self.spec = validate_contract(
            {
                "version": 1,
                "fields": {
                    "id": {"type": "string", "required": True},
                    "n": {"type": "integer", "min": 0, "max": 10},
                    "split": {"type": "string", "enum": ["test", "train"]},
                },
            }
        )

    def test_valid(self):
        self.assertEqual(
            row_issues({"id": "a", "n": 3, "split": "test"}, self.spec), []
        )

    def test_missing_required(self):
        self.assertEqual(
            row_issues({}, self.spec), [{"field": "id", "rule": "required"}]
        )

    def test_bool_not_integer(self):
        self.assertEqual(
            row_issues({"id": "a", "n": True}, self.spec),
            [{"field": "n", "rule": "type"}],
        )

    def test_boundary(self):
        for value in [0, 10]:
            self.assertEqual(row_issues({"id": "a", "n": value}, self.spec), [])
        self.assertEqual(row_issues({"id": "a", "n": -1}, self.spec)[0]["rule"], "min")

    def test_enum(self):
        self.assertEqual(
            row_issues({"id": "a", "split": "secret"}, self.spec)[0]["rule"], "enum"
        )

    def test_extra_and_null(self):
        self.assertEqual(
            row_issues({"id": None, "extra": 4}, self.spec),
            [{"field": "id", "rule": "type"}, {"field": "extra", "rule": "extra"}],
        )

    def test_non_object(self):
        self.assertEqual(row_issues([], self.spec), [{"field": "", "rule": "object"}])

    def test_large_json_integer(self):
        spec = {"fields": {"n": {"type": "number"}}}
        self.assertEqual(row_issues({"n": 10**400}, spec), [])
        self.assertEqual(
            row_issues({"n": float("inf")}, spec), [{"field": "n", "rule": "type"}]
        )
