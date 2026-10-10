import unittest, tempfile, pathlib, json, copy, csv, io, sqlite3
from main import *


class StageTests(unittest.TestCase):
    def plan(self, ref="svc.db.endpoint"):
        return load_plan(
            {
                "format_version": "1.0",
                "resource_changes": [
                    {"address": a, "change": {"actions": ["update"]}}
                    for a in ("svc.db", "svc.app")
                ],
                "configuration": {
                    "root_module": {
                        "resources": [
                            {
                                "address": "svc.app",
                                "expressions": {"endpoint": {"references": [ref]}},
                            }
                        ]
                    }
                },
            }
        )

    def test_dependency(self):
        self.assertEqual(impact_graph(self.plan())["edges"][0]["to"], "svc.db")

    def test_variable(self):
        self.assertFalse(impact_graph(self.plan("var.secret"))["unresolved"])

    def test_missing(self):
        self.assertEqual(
            impact_graph(self.plan("svc.missing.id"))["unresolved"][0]["reference"],
            "svc.missing.id",
        )

    def test_no_self(self):
        self.assertFalse(impact_graph(self.plan("svc.app.id"))["edges"])

    def test_heldout_counted(self):
        p = self.plan()
        p["resources"][0]["id"] = "svc.db[0]"
        p["resources"][0]["address"] = "svc.db[0]"
        self.assertEqual(impact_graph(p)["edges"][0]["to"], "svc.db[0]")
