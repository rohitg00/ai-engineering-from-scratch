"""eval harness、verifier、pass@k math の tests。"""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    EvalHarness,
    FixtureTask,
    SampleResult,
    apply_known_fixes,
    load_all_fixtures,
    load_fixture,
    noop_candidate,
    p95,
    pass_at_k,
    run_demo,
    verify_file_equals,
    verify_regex_match,
    verify_shell_exit_zero,
)

TASKS_DIR = os.path.join(os.path.dirname(HERE), "tasks")


# ---------------------------------------------------------------------------
# Math
# ---------------------------------------------------------------------------


class PassAtKMathTests(unittest.TestCase):
    def test_zero_pass_rate(self) -> None:
        self.assertEqual(pass_at_k(0.0, 5), 0.0)

    def test_full_pass_rate(self) -> None:
        self.assertEqual(pass_at_k(1.0, 5), 1.0)

    def test_partial_pass_rate(self) -> None:
        # p=0.5, k=2 -> 0.75
        self.assertAlmostEqual(pass_at_k(0.5, 2), 0.75)

    def test_k_zero(self) -> None:
        self.assertEqual(pass_at_k(0.5, 0), 0.0)

    def test_clamps_out_of_range(self) -> None:
        # caller bug でも [0,1] 内の数値を返す。
        self.assertGreaterEqual(pass_at_k(-1.0, 3), 0.0)
        self.assertLessEqual(pass_at_k(2.0, 3), 1.0)

    def test_p95_empty(self) -> None:
        self.assertEqual(p95([]), 0.0)

    def test_p95_nearest_rank(self) -> None:
        # 20 values: nearest rank 95th は index round(0.95*20)-1 = 18。
        values = list(range(1, 21))
        self.assertEqual(p95(values), 19.0)


# ---------------------------------------------------------------------------
# Verifier unit tests
# ---------------------------------------------------------------------------


class FileEqualsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.mkdtemp(prefix="ve-file-")
        self.expected_dir = tempfile.mkdtemp(prefix="ve-expected-")
        os.makedirs(os.path.join(self.expected_dir, "expected"), exist_ok=True)
        with open(os.path.join(self.expected_dir, "a.txt"), "w", encoding="utf-8") as fh:
            fh.write("hello\n")
        self.task = FixtureTask(
            id="t",
            goal="",
            setup_dir="",
            expected_dir=self.expected_dir,
            verifier_name="file_equals",
            verifier_args={"path": "a.txt"},
        )

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)
        shutil.rmtree(self.expected_dir, ignore_errors=True)

    def test_exact_match_passes(self) -> None:
        with open(os.path.join(self.tmp, "a.txt"), "w", encoding="utf-8") as fh:
            fh.write("hello\n")
        outcome = verify_file_equals(self.task, self.tmp, {"path": "a.txt"})
        self.assertTrue(outcome.passed)

    def test_difference_fails(self) -> None:
        with open(os.path.join(self.tmp, "a.txt"), "w", encoding="utf-8") as fh:
            fh.write("goodbye\n")
        outcome = verify_file_equals(self.task, self.tmp, {"path": "a.txt"})
        self.assertFalse(outcome.passed)

    def test_missing_scratch_file_fails(self) -> None:
        outcome = verify_file_equals(self.task, self.tmp, {"path": "missing.txt"})
        self.assertFalse(outcome.passed)


class RegexMatchTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.mkdtemp(prefix="ve-rgx-")
        with open(os.path.join(self.tmp, "src.py"), "w", encoding="utf-8") as fh:
            fh.write("def f():\n    return 42\n")
        self.task = FixtureTask(
            id="t",
            goal="",
            setup_dir="",
            expected_dir="",
            verifier_name="regex_match",
            verifier_args={"path": "src.py", "pattern": "return\\s+42"},
        )

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_match_passes(self) -> None:
        outcome = verify_regex_match(
            self.task, self.tmp, {"path": "src.py", "pattern": "return\\s+42"}
        )
        self.assertTrue(outcome.passed)

    def test_no_match_fails(self) -> None:
        outcome = verify_regex_match(
            self.task, self.tmp, {"path": "src.py", "pattern": "return\\s+99"}
        )
        self.assertFalse(outcome.passed)


class ShellExitZeroTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.mkdtemp(prefix="ve-shell-")
        self.task = FixtureTask(
            id="t",
            goal="",
            setup_dir="",
            expected_dir="",
            verifier_name="shell_exit_zero",
            verifier_args={"argv": ["true"]},
        )

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_true_passes(self) -> None:
        outcome = verify_shell_exit_zero(self.task, self.tmp, {"argv": ["true"]})
        self.assertTrue(outcome.passed)

    def test_false_fails(self) -> None:
        outcome = verify_shell_exit_zero(self.task, self.tmp, {"argv": ["false"]})
        self.assertFalse(outcome.passed)

    def test_missing_argv(self) -> None:
        outcome = verify_shell_exit_zero(self.task, self.tmp, {})
        self.assertFalse(outcome.passed)


# ---------------------------------------------------------------------------
# Fixture loading
# ---------------------------------------------------------------------------


class FixtureLoadingTests(unittest.TestCase):
    def test_loads_all_bundled_fixtures(self) -> None:
        tasks = load_all_fixtures(TASKS_DIR)
        ids = [t.id for t in tasks]
        self.assertIn("task_001_fizzbuzz_offbyone", ids)
        self.assertIn("task_002_factorial_missing_return", ids)
        self.assertIn("task_003_error_message_typo", ids)
        self.assertIn("task_004_empty_reverse", ids)
        self.assertIn("task_005_linked_list_traversal", ids)
        for t in tasks:
            self.assertTrue(os.path.isdir(t.setup_dir))
            self.assertTrue(os.path.isdir(t.expected_dir))


# ---------------------------------------------------------------------------
# Harness end-to-end
# ---------------------------------------------------------------------------


class HarnessEndToEndTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tasks = load_all_fixtures(TASKS_DIR)

    def test_reference_candidate_passes_all(self) -> None:
        harness = EvalHarness(tasks=self.tasks, k=1)
        report = harness.run(apply_known_fixes)
        self.assertEqual(report.pass_at_1, 1.0)
        self.assertEqual(report.pass_at_k, 1.0)
        for task_report in report.task_reports:
            self.assertEqual(task_report.passes, 1)

    def test_noop_candidate_fails_all(self) -> None:
        harness = EvalHarness(tasks=self.tasks, k=2)
        report = harness.run(noop_candidate)
        self.assertEqual(report.pass_at_1, 0.0)
        self.assertEqual(report.pass_at_k, 0.0)
        for task_report in report.task_reports:
            self.assertEqual(task_report.passes, 0)

    def test_report_serialises(self) -> None:
        harness = EvalHarness(tasks=self.tasks[:1], k=1)
        report = harness.run(apply_known_fixes)
        blob = json.dumps(report.to_dict())
        self.assertIn("pass_at_1", blob)
        self.assertIn("task_001_fizzbuzz_offbyone", blob)

    def test_demo_main_exits_zero(self) -> None:
        self.assertEqual(run_demo(), 0)


if __name__ == "__main__":
    unittest.main()
