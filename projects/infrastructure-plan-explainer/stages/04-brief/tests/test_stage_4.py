import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def plan(self):
        return load_plan(
            {
                "format_version": "1.0",
                "resource_changes": [
                    {
                        "address": "svc.db",
                        "change": {
                            "actions": ["delete", "create"],
                            "before": {"key": "hidden"},
                            "before_sensitive": {"key": True},
                            "after_unknown": {"id": True},
                        },
                    }
                ],
            }
        )

    def test_markdown(self):
        self.assertIn("**replace**", explain(self.plan())["markdown"])

    def test_no_secret(self):
        self.assertNotIn("hidden", json.dumps(explain(self.plan())))

    def test_anchor(self):
        r = explain(self.plan())
        self.assertIn(r["resources"][0]["anchor"], r["markdown"])

    def test_roundtrip(self):
        r = explain(self.plan())
        self.assertEqual(
            json.loads(json.dumps(r))["graph"]["nodes"][0]["action"], "replace"
        )

    def test_empty(self):
        self.assertEqual(
            explain(load_plan({"format_version": "1.0"}))["graph"]["nodes"], []
        )
