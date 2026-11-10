import json
import tempfile
import unittest
from pathlib import Path

from main import (
    build_report,
    classify_changes,
    export_fixtures,
    generate_counterexamples,
    load_calls,
    load_contract,
    replay_calls,
)


class TestStage04ReportAndGate(unittest.TestCase):
    def setUp(self):
        self.old_schema = {
            "title": "document_reader",
            "type": "object",
            "properties": {
                "doc_id": {"type": "string"},
                "page": {"type": "integer", "minimum": 1},
            },
            "required": ["doc_id"],
            "additionalProperties": True,
        }
        self.new_schema_breaking = {
            "title": "document_reader",
            "type": "object",
            "properties": {
                "doc_id": {"type": "string"},
                "page": {"type": "integer", "minimum": 1, "maximum": 50},
                "auth": {"type": "string"},  # added required
            },
            "required": ["doc_id", "auth"],
            "additionalProperties": False,
        }
        self.new_schema_compatible = {
            "title": "document_reader",
            "type": "object",
            "properties": dict(self.old_schema["properties"], format={"type": "string"}),
            "required": ["doc_id"],
            "additionalProperties": True,
        }

    def test_build_report_breaking(self):
        old_c = load_contract(self.old_schema)
        new_c = load_contract(self.new_schema_breaking)
        changes = classify_changes(old_c, new_c)
        ces = generate_counterexamples(old_c, new_c)
        calls = load_calls([{"id": "1", "arguments": {"doc_id": "d1"}}])
        replay = replay_calls(old_c, new_c, calls)
        report = build_report(old_c, new_c, changes, ces, replay)

        self.assertEqual(report["schema_version"], 1)
        self.assertEqual(report["tool_name"], "document_reader")
        self.assertFalse(report["compatible"])
        self.assertGreater(report["breaking_count"], 0)
        self.assertEqual(len(report["replay"]["broken"]), 1)
        self.assertIn("breaking", report["summary"].lower())

    def test_build_report_compatible(self):
        old_c = load_contract(self.old_schema)
        new_c = load_contract(self.new_schema_compatible)
        changes = classify_changes(old_c, new_c)
        ces = generate_counterexamples(old_c, new_c)
        calls = load_calls([{"id": "1", "arguments": {"doc_id": "d1"}}])
        replay = replay_calls(old_c, new_c, calls)
        report = build_report(old_c, new_c, changes, ces, replay)

        self.assertTrue(report["compatible"])
        self.assertEqual(report["breaking_count"], 0)
        self.assertEqual(len(report["replay"]["broken"]), 0)
        self.assertIn("compatible", report["summary"].lower())

    def test_export_fixtures(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            out_file = Path(tmpdir) / "fixtures.json"
            ces = [{"breaking_category": "added_required", "property": "auth", "payload": {"doc_id": "d1"}}]
            broken = [{"id": "call_1", "arguments": {"doc_id": "d1"}}]
            data = export_fixtures(str(out_file), ces, broken)

            self.assertTrue(out_file.exists())
            with open(out_file, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            self.assertEqual(loaded["version"], 1)
            self.assertEqual(len(loaded["synthesized_counterexamples"]), 1)
            self.assertEqual(len(loaded["broken_historical_calls"]), 1)


if __name__ == "__main__":
    unittest.main()
