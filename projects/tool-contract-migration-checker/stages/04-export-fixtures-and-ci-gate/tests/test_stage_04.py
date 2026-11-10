import json
import os
import subprocess
import sys
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


def _get_cli_path():
    """Locate the cli.py executable across workspace and solution environments."""
    if "PROJECT_WORKSPACE" in os.environ:
        cand = Path(os.environ["PROJECT_WORKSPACE"]) / "cli.py"
        if cand.is_file():
            return cand
    cand = Path(__file__).resolve().parents[3] / "solution" / "cli.py"
    if cand.is_file():
        return cand
    return Path.cwd() / "cli.py"


class TestStage04ReportAndGate(unittest.TestCase):
    """Unit tests for Stage 4 report generation, fixture export, and CI gate."""

    def setUp(self):
        """Set up test schemas for breaking and compatible tool evolutions."""
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
        """Verify report summary and failure flags when breaking changes occur."""
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
        self.assertIn("incompatible", report["summary"].lower())

    def test_build_report_compatible(self):
        """Verify report summary and success flags when changes are compatible."""
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

    def test_build_report_unresolved_contracts_incompatible(self):
        """Verify contracts with unresolved keywords fail the compatibility report."""
        old_c = load_contract(self.old_schema)
        new_schema_ref = dict(self.new_schema_compatible)
        new_schema_ref["$ref"] = "#/defs/Doc"
        new_c = load_contract(new_schema_ref)
        changes = classify_changes(old_c, new_c)
        replay = replay_calls(old_c, new_c, [])
        report = build_report(old_c, new_c, changes, [], replay)

        self.assertFalse(report["compatible"])
        self.assertGreater(report["unresolved_count"], 0)
        self.assertIn("unresolved", report["summary"].lower())

    def test_export_fixtures(self):
        """Verify fixture JSON output generation with counterexamples and broken calls."""
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

    def test_cli_execution_with_strict_failure(self):
        """Verify CLI execution exits with status 1 under strict mode on breaking change."""
        with tempfile.TemporaryDirectory() as tmpdir:
            old_f = Path(tmpdir) / "old.json"
            new_f = Path(tmpdir) / "new.json"
            out_f = Path(tmpdir) / "report.json"
            with open(old_f, "w") as f:
                json.dump(self.old_schema, f)
            with open(new_f, "w") as f:
                json.dump(self.new_schema_breaking, f)

            cli_path = _get_cli_path()
            proc = subprocess.run(
                [sys.executable, str(cli_path), "--old", str(old_f), "--new", str(new_f), "--output", str(out_f), "--strict"],
                capture_output=True,
                text=True,
            )
            self.assertEqual(proc.returncode, 1)
            self.assertTrue(out_f.exists())

    def test_cli_missing_calls_file_raises_error(self):
        """Verify CLI execution raises error when passed a non-existent calls file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            old_f = Path(tmpdir) / "old.json"
            new_f = Path(tmpdir) / "new.json"
            with open(old_f, "w") as f:
                json.dump(self.old_schema, f)
            with open(new_f, "w") as f:
                json.dump(self.new_schema_compatible, f)

            cli_path = _get_cli_path()
            proc = subprocess.run(
                [sys.executable, str(cli_path), "--old", str(old_f), "--new", str(new_f), "--calls", "/nonexistent/calls.json"],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("not found", proc.stderr + proc.stdout)

    def test_deterministic_unresolved_order(self):
        """Verify multiple unresolved keywords appear in deterministic sorted order."""
        old_c = load_contract(self.old_schema)
        new_schema_multi = dict(self.new_schema_compatible)
        new_schema_multi["$ref"] = "#/defs/A"
        new_schema_multi["oneOf"] = [{"type": "string"}]
        new_schema_multi["allOf"] = [{"type": "object"}]
        new_schema_multi["anyOf"] = [{"type": "string"}]
        new_c = load_contract(new_schema_multi)

        changes1 = classify_changes(old_c, new_c)
        changes2 = classify_changes(old_c, new_c)
        unresolved1 = [c["property"] for c in changes1 if c["type"] == "unresolved"]
        unresolved2 = [c["property"] for c in changes2 if c["type"] == "unresolved"]
        self.assertEqual(unresolved1, unresolved2)
        self.assertEqual(unresolved1, sorted(unresolved1))


if __name__ == "__main__":
    unittest.main()
