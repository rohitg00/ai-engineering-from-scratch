import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def doc(self, change=None):
        return {
            "format_version": "1.0",
            "resource_changes": [
                {
                    "address": "svc.a",
                    "change": change
                    or {
                        "actions": ["create"],
                        "after": {"password": "secret", "nested": [{"token": "x"}]},
                        "after_sensitive": {
                            "password": True,
                            "nested": [{"token": True}],
                        },
                        "after_unknown": {"endpoint": True},
                    },
                }
            ],
        }

    def test_redact(self):
        r = load_plan(self.doc())
        self.assertNotIn("secret", json.dumps(r))
        self.assertEqual(r["resources"][0]["after"]["password"], "[sensitive]")

    def test_unknown(self):
        self.assertEqual(
            load_plan(self.doc())["resources"][0]["after"]["endpoint"], "[unknown]"
        )

    def test_version(self):
        with self.assertRaises(ValueError):
            load_plan({"format_version": "2.0"})

    def test_minor(self):
        self.assertEqual(load_plan({"format_version": "1.99"})["resources"], [])

    def test_prior_omitted(self):
        d = self.doc()
        d["variables"] = {"token": {"value": "DO-NOT-EXPORT"}}
        self.assertNotIn("DO-NOT-EXPORT", json.dumps(load_plan(d)))
