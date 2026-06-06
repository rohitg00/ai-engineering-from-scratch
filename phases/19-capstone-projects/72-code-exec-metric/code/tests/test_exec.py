"""Tests for code extraction, sandbox subprocess execution, and pass-at-k."""

from __future__ import annotations

import math
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    EXIT_ASSERTION_FAIL,
    EXIT_ERROR,
    EXIT_PASS,
    EXIT_SYNTAX_ERROR,
    EXIT_TIMEOUT,
    extract_code,
    pass_at_k,
    pass_at_k_estimator,
    run_candidate,
    score_code_exec,
)


GOOD_ADD = "```python\ndef add(a, b):\n    return a + b\n```"
BAD_ADD = "```python\ndef add(a, b):\n    return a + b + 1\n```"


class TestExtractCode(unittest.TestCase):
    def test_extracts_python_block(self) -> None:
        code = extract_code(GOOD_ADD)
        self.assertIn("def add", code)
        self.assertNotIn("```", code)

    def test_extracts_untagged_block(self) -> None:
        text = "Here:\n```\ndef f():\n    return 1\n```"
        code = extract_code(text)
        self.assertIn("def f", code)

    def test_no_block_no_backticks_returns_raw(self) -> None:
        self.assertEqual(extract_code("def f(): pass"), "def f(): pass")

    def test_backticks_but_unclosed_returns_none(self) -> None:
        self.assertIsNone(extract_code("```python\ndef f"))


class TestRunCandidate(unittest.TestCase):
    def test_all_assertions_pass(self) -> None:
        r = run_candidate("def add(a,b):\n    return a+b\n", ["add(1,2) == 3", "add(0,0) == 0"])
        self.assertEqual(r.exit_code, EXIT_PASS)
        self.assertEqual(r.score, 1.0)
        self.assertEqual(r.passed, 2)
        self.assertEqual(r.total, 2)

    def test_partial_assertions_fail(self) -> None:
        r = run_candidate("def add(a,b):\n    return a+b+1\n", ["add(1,2) == 3", "add(0,0) == 1"])
        self.assertEqual(r.exit_code, EXIT_ASSERTION_FAIL)
        self.assertEqual(r.passed, 1)
        self.assertEqual(r.total, 2)
        self.assertAlmostEqual(r.score, 0.5)

    def test_syntax_error(self) -> None:
        r = run_candidate("def add(a,b)\n    return a+b\n", ["add(1,2) == 3"])
        self.assertEqual(r.exit_code, EXIT_SYNTAX_ERROR)
        self.assertEqual(r.score, 0.0)

    def test_timeout(self) -> None:
        r = run_candidate("import time\ntime.sleep(5)\ndef add(a,b):\n    return a+b\n",
                          ["add(1,2) == 3"], timeout_s=0.5)
        self.assertEqual(r.exit_code, EXIT_TIMEOUT)
        self.assertEqual(r.score, 0.0)

    def test_runtime_error_during_assertion(self) -> None:
        r = run_candidate("def add(a,b):\n    raise RuntimeError('boom')\n", ["add(1,2) == 3"])
        self.assertEqual(r.exit_code, EXIT_ASSERTION_FAIL)
        self.assertEqual(r.score, 0.0)

    def test_denied_import_subprocess(self) -> None:
        r = run_candidate("import subprocess\nsubprocess.run(['ls'])\n", ["True"])
        self.assertEqual(r.exit_code, EXIT_ERROR)
        self.assertIn("denied", r.detail)

    def test_no_assertions_yields_error(self) -> None:
        r = run_candidate("def f(): return 1\n", [])
        self.assertEqual(r.exit_code, EXIT_ERROR)


class TestScoreCodeExec(unittest.TestCase):
    def test_score_from_fenced_block(self) -> None:
        self.assertEqual(
            score_code_exec(GOOD_ADD, ["add(1,2) == 3"]),
            1.0,
        )

    def test_score_zero_on_bad_block(self) -> None:
        self.assertEqual(
            score_code_exec(BAD_ADD, ["add(1,2) == 3"]),
            0.0,
        )

    def test_unclosed_block_scores_zero(self) -> None:
        self.assertEqual(
            score_code_exec("```python\nbroken", ["True"]),
            0.0,
        )


class TestPassAtK(unittest.TestCase):
    def test_pass_at_1_equals_c_over_n(self) -> None:
        self.assertAlmostEqual(pass_at_k(10, 3, 1), 0.3)

    def test_pass_at_k_perfect(self) -> None:
        self.assertAlmostEqual(pass_at_k(10, 10, 5), 1.0)

    def test_pass_at_k_none_pass(self) -> None:
        self.assertAlmostEqual(pass_at_k(10, 0, 5), 0.0)

    def test_pass_at_k_known_value(self) -> None:
        v = pass_at_k(10, 1, 5)
        expected = 1.0 - math.comb(9, 5) / math.comb(10, 5)
        self.assertAlmostEqual(v, expected, places=8)

    def test_pass_at_k_when_k_greater_than_n_minus_c(self) -> None:
        self.assertAlmostEqual(pass_at_k(5, 3, 4), 1.0)

    def test_pass_at_k_estimator_over_tasks(self) -> None:
        samples = [
            [True, False, False],
            [True, True, False],
        ]
        result = pass_at_k_estimator(samples, [1, 3])
        self.assertAlmostEqual(result[1], 0.5, places=6)
        self.assertAlmostEqual(result[3], 1.0, places=6)

    def test_invalid_inputs_raise(self) -> None:
        with self.assertRaises(ValueError):
            pass_at_k(-1, 0, 1)
        with self.assertRaises(ValueError):
            pass_at_k(5, 6, 1)
        with self.assertRaises(ValueError):
            pass_at_k(5, 1, 0)


if __name__ == "__main__":
    unittest.main()
