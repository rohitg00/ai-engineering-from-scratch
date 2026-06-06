"""Tests for task spec validator, post-process, fixture loader."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    FEW_SHOT_MAX,
    bad_fixture_tasks,
    fixture_tasks,
    load_fixtures,
    post_process,
    render_prompt,
    TaskSpec,
    validate_file,
    validate_task,
)


def good_record():
    return {
        "task_id": "t1",
        "category": "arithmetic",
        "prompt": "Q: 1+1\nA:",
        "targets": ["2"],
        "metric_name": "exact_match",
        "post_process": "strip_whitespace",
    }


class TestValidateTask(unittest.TestCase):
    def test_minimal_good_record(self) -> None:
        errs = validate_task(good_record(), line_number=1)
        self.assertEqual(errs, [])

    def test_missing_required_fields(self) -> None:
        for field_name in ("task_id", "category", "prompt", "targets", "metric_name", "post_process"):
            r = good_record()
            del r[field_name]
            errs = validate_task(r, line_number=1)
            self.assertEqual(len(errs), 1)
            self.assertEqual(errs[0].rule, "missing_required")
            self.assertEqual(errs[0].field_name, field_name)

    def test_unknown_top_level_field_rejected(self) -> None:
        r = good_record()
        r["secret"] = 1
        errs = validate_task(r, line_number=1)
        self.assertEqual(len(errs), 1)
        self.assertEqual(errs[0].rule, "unknown_field")

    def test_bad_category(self) -> None:
        r = good_record()
        r["category"] = "logic"
        errs = validate_task(r, line_number=1)
        self.assertEqual(len(errs), 1)
        self.assertEqual(errs[0].field_name, "category")

    def test_empty_targets_rejected(self) -> None:
        r = good_record()
        r["targets"] = []
        errs = validate_task(r, line_number=1)
        self.assertEqual(len(errs), 1)
        self.assertEqual(errs[0].field_name, "targets")

    def test_trailing_whitespace_rejected(self) -> None:
        r = good_record()
        r["prompt"] = "Q: 1+1\nA: "
        errs = validate_task(r, line_number=1)
        self.assertEqual(len(errs), 1)
        self.assertEqual(errs[0].field_name, "prompt")

    def test_illegal_category_metric_pair(self) -> None:
        r = good_record()
        r["category"] = "mcq"
        r["targets"] = ["A"]
        r["metric_name"] = "bleu_4"
        r["post_process"] = "extract_letter"
        errs = validate_task(r, line_number=1)
        self.assertEqual(len(errs), 1)
        self.assertEqual(errs[0].rule, "illegal_pair")

    def test_mcq_target_must_be_letter(self) -> None:
        r = good_record()
        r["category"] = "mcq"
        r["targets"] = ["correct"]
        r["post_process"] = "extract_letter"
        errs = validate_task(r, line_number=1)
        self.assertEqual(len(errs), 1)
        self.assertEqual(errs[0].field_name, "targets")

    def test_too_many_few_shot(self) -> None:
        r = good_record()
        r["few_shot_examples"] = [{"prompt": "p", "completion": "c"} for _ in range(FEW_SHOT_MAX + 1)]
        errs = validate_task(r, line_number=1)
        self.assertEqual(len(errs), 1)
        self.assertEqual(errs[0].field_name, "few_shot_examples")

    def test_bad_task_id_chars(self) -> None:
        r = good_record()
        r["task_id"] = "has space"
        errs = validate_task(r, line_number=1)
        self.assertEqual(len(errs), 1)
        self.assertEqual(errs[0].field_name, "task_id")


class TestValidateFile(unittest.TestCase):
    def test_good_fixture_passes(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            good, _ = load_fixtures(d)
            tasks, errors = validate_file(good)
            self.assertEqual(len(tasks), len(fixture_tasks()))
            self.assertEqual(errors, [])

    def test_bad_fixture_all_fail(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            _, bad = load_fixtures(d)
            tasks, errors = validate_file(bad)
            self.assertEqual(len(tasks), 0)
            self.assertEqual(len(errors), len(bad_fixture_tasks()))

    def test_duplicate_task_id(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "dup.jsonl")
            with open(path, "w", encoding="utf-8") as fp:
                fp.write(json.dumps(good_record()) + "\n")
                fp.write(json.dumps(good_record()) + "\n")
            tasks, errors = validate_file(path)
            self.assertEqual(len(tasks), 1)
            self.assertEqual(len(errors), 1)
            self.assertEqual(errors[0].rule, "duplicate_task_id")

    def test_malformed_json(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "broken.jsonl")
            with open(path, "w", encoding="utf-8") as fp:
                fp.write("{not json\n")
                fp.write(json.dumps(good_record()) + "\n")
            tasks, errors = validate_file(path)
            self.assertEqual(len(tasks), 1)
            self.assertEqual(len(errors), 1)
            self.assertEqual(errors[0].rule, "bad_json")


class TestRender(unittest.TestCase):
    def test_render_with_few_shot(self) -> None:
        spec = TaskSpec(
            task_id="t",
            category="arithmetic",
            prompt="Q:3+3\nA:",
            targets=["6"],
            metric_name="exact_match",
            post_process="strip_whitespace",
            few_shot_examples=[{"prompt": "Q:1+1\nA:", "completion": "2"}],
        )
        rendered = render_prompt(spec)
        self.assertIn("Q:1+1", rendered)
        self.assertIn("Q:3+3", rendered)
        self.assertTrue(rendered.endswith("A:"))

    def test_render_without_few_shot(self) -> None:
        spec = TaskSpec(
            task_id="t",
            category="arithmetic",
            prompt="ONLY",
            targets=["x"],
            metric_name="exact_match",
            post_process="none",
        )
        self.assertEqual(render_prompt(spec), "ONLY")


class TestPostProcess(unittest.TestCase):
    def test_none(self) -> None:
        self.assertEqual(post_process("  raw  ", "none"), "  raw  ")

    def test_strip(self) -> None:
        self.assertEqual(post_process("  raw\n", "strip_whitespace"), "raw")

    def test_lower(self) -> None:
        self.assertEqual(post_process("YES", "lower"), "yes")

    def test_extract_letter(self) -> None:
        self.assertEqual(post_process("Answer: C is right", "extract_letter"), "C")
        self.assertEqual(post_process("no letter here", "extract_letter"), "")

    def test_extract_code_block(self) -> None:
        text = "Here:\n```python\ndef f():\n    return 1\n```\nbye"
        self.assertIn("def f()", post_process(text, "extract_code_block"))

    def test_extract_first_line(self) -> None:
        self.assertEqual(post_process("\n\nfirst\nsecond\n", "extract_first_line"), "first")

    def test_unknown_rule(self) -> None:
        with self.assertRaises(ValueError):
            post_process("x", "wat")


if __name__ == "__main__":
    unittest.main()
