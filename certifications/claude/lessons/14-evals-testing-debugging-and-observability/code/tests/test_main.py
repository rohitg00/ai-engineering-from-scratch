"""Tests for lesson 14 evaluation harness."""

import copy
import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))

from main import AgentRun, EvalCase, EvalHarness, classify_error, load_release_gate, percentile, validate_release_gate


class EvalHarnessTests(unittest.TestCase):
    def test_shipped_release_gate_is_valid(self):
        artifact = pathlib.Path(__file__).parents[2] / "outputs" / "eval-release-gate.json"
        self.assertEqual(validate_release_gate(load_release_gate(str(artifact))), [])

    def test_severe_case_gate_cannot_drop_below_one(self):
        artifact = pathlib.Path(__file__).parents[2] / "outputs" / "eval-release-gate.json"
        gate = copy.deepcopy(load_release_gate(str(artifact)))
        gate["thresholds"]["severeCasePassRate"] = 0.99
        self.assertIn("1.0", " ".join(validate_release_gate(gate)))

    def test_complete_case_passes(self):
        agent = lambda _prompt: AgentRun("verified ready", ("lookup",), {"safe": True}, ({"type": "tool_call"},))
        case = EvalCase("one", "x", ("verified",), ("guess",), ("lookup",), {"safe": True})
        result = EvalHarness(agent).run_case(case)
        self.assertTrue(result.passed)
        self.assertEqual(result.score, 1.0)

    def test_wrong_tool_trajectory_fails_even_with_good_text(self):
        agent = lambda _prompt: AgentRun("verified", ("search",), {}, ({"type": "tool_call"},))
        result = EvalHarness(agent).run_case(EvalCase("one", "x", ("verified",), (), ("lookup",), {}))
        self.assertFalse(result.passed)
        self.assertFalse(result.checks["tool_trajectory"])

    def test_forbidden_text_is_checked(self):
        agent = lambda _prompt: AgentRun("The password is secret", (), {}, ())
        result = EvalHarness(agent).run_case(EvalCase("one", "x", (), ("password",), (), {}))
        self.assertFalse(result.checks["forbidden_text"])

    def test_exception_is_classified_not_raised(self):
        def fail(_prompt):
            raise TimeoutError("slow")
        result = EvalHarness(fail).run_case(EvalCase("one", "x"))
        self.assertEqual(result.error_class, "transport_timeout")
        self.assertEqual(result.score, 0.0)

    def test_suite_summary_aggregates_results(self):
        agent = lambda prompt: AgentRun(prompt, (), {}, ())
        summary = EvalHarness(agent).run_suite([EvalCase("a", "yes", ("yes",)), EvalCase("b", "no", ("yes",))])["summary"]
        self.assertEqual(summary["count"], 2)
        self.assertEqual(summary["passed"], 1)
        self.assertEqual(summary["pass_rate"], 0.5)

    def test_error_classifier_distinguishes_contract_error(self):
        error = None
        try:
            json.loads("{")
        except json.JSONDecodeError as exc:
            error = exc
        self.assertEqual(classify_error(error), "contract_parse_error")

    def test_percentile_uses_sorted_nearest_rank(self):
        self.assertEqual(percentile([10, 1, 5], 0.95), 10)
        with self.assertRaises(ValueError):
            percentile([1], 1.5)


if __name__ == "__main__":
    unittest.main()
