"""Unit tests for the constitutional rules engine."""

from __future__ import annotations

import unittest

from main import Engine, Fixer, diff
from yaml_subset import load_yaml


class TestYamlSubset(unittest.TestCase):
    def test_simple_mapping(self) -> None:
        text = "name: alice\nage: 30\n"
        data = load_yaml(text)
        self.assertEqual(data, {"name": "alice", "age": 30})

    def test_nested_mapping(self) -> None:
        text = "outer:\n  inner: value\n  count: 7\n"
        data = load_yaml(text)
        self.assertEqual(data, {"outer": {"inner": "value", "count": 7}})

    def test_sequence_of_mappings(self) -> None:
        text = "items:\n  - id: 1\n    label: a\n  - id: 2\n    label: b\n"
        data = load_yaml(text)
        self.assertEqual(data["items"], [{"id": 1, "label": "a"}, {"id": 2, "label": "b"}])

    def test_quoted_string(self) -> None:
        text = "path: 'a/b/c'\n"
        data = load_yaml(text)
        self.assertEqual(data, {"path": "a/b/c"})

    def test_strips_comments(self) -> None:
        text = "# header\nkey: value  # trailing\n"
        data = load_yaml(text)
        self.assertEqual(data, {"key": "value"})


class TestEngineLoad(unittest.TestCase):
    def test_default_constitution_loads(self) -> None:
        engine = Engine()
        rules = engine.rules()
        self.assertGreaterEqual(len(rules), 5)

    def test_bad_severity_rejected(self) -> None:
        bad = [{"name": "x", "severity": "critical", "must": {}, "explanation": "..."}]
        with self.assertRaises(ValueError):
            Engine(rules=bad)

    def test_missing_required_field_rejected(self) -> None:
        bad = [{"name": "x", "severity": "low"}]
        with self.assertRaises(ValueError):
            Engine(rules=bad)


class TestPredicates(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = Engine()

    def test_empty_refusal_flagged(self) -> None:
        report = self.engine.evaluate("I cannot help with that.")
        names = [v.rule_name for v in report.violations()]
        self.assertIn("no-empty-refusal", names)

    def test_clean_response_passes(self) -> None:
        report = self.engine.evaluate("Here is a haiku about a quiet morning by the river.")
        self.assertEqual(report.violations(), [])

    def test_internal_library_leak_flagged(self) -> None:
        report = self.engine.evaluate("Use the internal-only adapter.")
        names = [v.rule_name for v in report.violations()]
        self.assertIn("no-internal-library-leak", names)

    def test_long_response_flagged(self) -> None:
        text = "word " * 850
        report = self.engine.evaluate(text)
        names = [v.rule_name for v in report.violations()]
        self.assertIn("bounded-length", names)

    def test_not_applicable_reported(self) -> None:
        report = self.engine.evaluate("Here is a haiku about a quiet morning by the river.")
        statuses = {r.rule_name: r.status for r in report.results}
        self.assertEqual(statuses["no-empty-refusal"], "not_applicable")


class TestFixer(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = Engine()
        self.fixer = Fixer(self.engine.rules())

    def test_refusal_redirect_appended(self) -> None:
        draft = "I cannot help with that."
        report = self.engine.evaluate(draft)
        revised = self.fixer.apply(draft, report.violations())
        report2 = self.engine.evaluate(revised)
        names = [v.rule_name for v in report2.violations()]
        self.assertNotIn("no-empty-refusal", names)

    def test_internal_replaced(self) -> None:
        draft = "Use the internal-only adapter."
        report = self.engine.evaluate(draft)
        revised = self.fixer.apply(draft, report.violations())
        self.assertNotIn("internal-only", revised)


class TestDiff(unittest.TestCase):
    def test_add_change_recorded(self) -> None:
        changes = diff("alpha\nbeta", "alpha\nbeta\ngamma")
        self.assertTrue(any(c.op == "add" and c.text == "gamma" for c in changes))

    def test_no_change_for_identical(self) -> None:
        self.assertEqual(diff("same", "same"), [])

    def test_edit_replaces_lines(self) -> None:
        changes = diff("alpha\nbeta", "alpha\nbravo")
        ops = {c.op for c in changes}
        self.assertTrue("edit-removed" in ops and "edit-added" in ops)


if __name__ == "__main__":
    unittest.main()
