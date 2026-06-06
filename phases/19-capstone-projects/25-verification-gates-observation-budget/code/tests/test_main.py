"""Tests for the verification gate chain and observation ledger."""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    BudgetGate,
    ChainOutcome,
    GateChain,
    GateContext,
    Observation,
    ObservationLedger,
    PerToolBudgetGate,
    RecencyGate,
    RegexGate,
    ToolCall,
    WhitelistGate,
    build_default_chain,
    estimate_tokens,
    run_demo,
    run_synthetic_loop,
)


class LedgerTests(unittest.TestCase):
    def test_empty_ledger_has_zero_cumulative(self) -> None:
        ledger = ObservationLedger()
        self.assertEqual(ledger.cumulative(), 0)
        self.assertEqual(ledger.per_tool("read_file"), 0)
        self.assertEqual(ledger.latest_turn(), -1)

    def test_per_tool_accounting(self) -> None:
        ledger = ObservationLedger()
        ledger.record(Observation(turn=1, tool="read_file", text="x", tokens=20))
        ledger.record(Observation(turn=2, tool="read_file", text="y", tokens=30))
        ledger.record(Observation(turn=3, tool="list_dir", text="z", tokens=10))
        self.assertEqual(ledger.cumulative(), 60)
        self.assertEqual(ledger.per_tool("read_file"), 50)
        self.assertEqual(ledger.per_tool("list_dir"), 10)
        self.assertEqual(ledger.latest_turn(), 3)
        self.assertEqual(ledger.turns_seen(), [1, 2, 3])


class TokenEstimatorTests(unittest.TestCase):
    def test_estimator_is_monotonic(self) -> None:
        a = estimate_tokens("ab")
        b = estimate_tokens("abcd")
        c = estimate_tokens("abcd" * 100)
        self.assertLessEqual(a, b)
        self.assertLess(b, c)

    def test_estimator_zero_on_empty(self) -> None:
        self.assertEqual(estimate_tokens(""), 0)


class WhitelistGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.gate = WhitelistGate(allowed=frozenset({"read_file", "list_dir"}))
        self.ctx = GateContext(ledger=ObservationLedger(), current_turn=1)

    def test_allow_known_tool(self) -> None:
        decision = self.gate.evaluate(
            ToolCall(turn=1, tool="read_file", argv=("x",)), self.ctx
        )
        self.assertTrue(decision.allow)
        self.assertEqual(decision.gate, "whitelist")

    def test_deny_unknown_tool(self) -> None:
        decision = self.gate.evaluate(
            ToolCall(turn=1, tool="shell", argv=("rm",)), self.ctx
        )
        self.assertFalse(decision.allow)
        self.assertIn("not in allow-set", decision.reason)


class RegexGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.gate = RegexGate.from_strings(patterns=(r"rm\s+-rf", r"sudo"))
        self.ctx = GateContext(ledger=ObservationLedger(), current_turn=1)

    def test_allow_clean_argv(self) -> None:
        decision = self.gate.evaluate(
            ToolCall(turn=1, tool="shell", argv=("ls", "-la")), self.ctx
        )
        self.assertTrue(decision.allow)

    def test_deny_rm_rf(self) -> None:
        decision = self.gate.evaluate(
            ToolCall(turn=1, tool="shell", argv=("rm", "-rf", "/")), self.ctx
        )
        self.assertFalse(decision.allow)
        self.assertIn("rm", decision.reason)

    def test_deny_sudo(self) -> None:
        decision = self.gate.evaluate(
            ToolCall(turn=1, tool="shell", argv=("sudo", "apt", "install")), self.ctx
        )
        self.assertFalse(decision.allow)


class RecencyGateTests(unittest.TestCase):
    def test_first_call_always_allowed(self) -> None:
        gate = RecencyGate(window=3)
        ctx = GateContext(ledger=ObservationLedger(), current_turn=1)
        self.assertTrue(
            gate.evaluate(ToolCall(turn=1, tool="x", argv=()), ctx).allow
        )

    def test_within_window(self) -> None:
        gate = RecencyGate(window=3)
        ledger = ObservationLedger()
        ledger.record(Observation(turn=5, tool="x", text="", tokens=1))
        ctx = GateContext(ledger=ledger, current_turn=7)
        decision = gate.evaluate(ToolCall(turn=7, tool="x", argv=()), ctx)
        self.assertTrue(decision.allow)

    def test_outside_window(self) -> None:
        gate = RecencyGate(window=3)
        ledger = ObservationLedger()
        ledger.record(Observation(turn=1, tool="x", text="", tokens=1))
        ctx = GateContext(ledger=ledger, current_turn=10)
        decision = gate.evaluate(ToolCall(turn=10, tool="x", argv=()), ctx)
        self.assertFalse(decision.allow)
        self.assertIn("gap", decision.reason)


class BudgetGateTests(unittest.TestCase):
    def test_under_budget_allows(self) -> None:
        gate = BudgetGate(max_tokens=100)
        ledger = ObservationLedger()
        ledger.record(Observation(turn=1, tool="x", text="", tokens=40))
        ctx = GateContext(ledger=ledger, current_turn=2)
        self.assertTrue(gate.evaluate(ToolCall(turn=2, tool="x", argv=()), ctx).allow)

    def test_at_budget_denies(self) -> None:
        gate = BudgetGate(max_tokens=100)
        ledger = ObservationLedger()
        ledger.record(Observation(turn=1, tool="x", text="", tokens=100))
        ctx = GateContext(ledger=ledger, current_turn=2)
        decision = gate.evaluate(ToolCall(turn=2, tool="x", argv=()), ctx)
        self.assertFalse(decision.allow)
        self.assertIn("budget exhausted", decision.reason)

    def test_over_budget_denies(self) -> None:
        gate = BudgetGate(max_tokens=100)
        ledger = ObservationLedger()
        ledger.record(Observation(turn=1, tool="x", text="", tokens=200))
        ctx = GateContext(ledger=ledger, current_turn=2)
        self.assertFalse(gate.evaluate(ToolCall(turn=2, tool="x", argv=()), ctx).allow)


class PerToolBudgetGateTests(unittest.TestCase):
    def test_unbudgeted_tool_passes(self) -> None:
        gate = PerToolBudgetGate(limits={"read_file": 50})
        ctx = GateContext(ledger=ObservationLedger(), current_turn=1)
        decision = gate.evaluate(ToolCall(turn=1, tool="list_dir", argv=()), ctx)
        self.assertTrue(decision.allow)

    def test_over_per_tool_limit_denies(self) -> None:
        gate = PerToolBudgetGate(limits={"read_file": 50})
        ledger = ObservationLedger()
        ledger.record(Observation(turn=1, tool="read_file", text="", tokens=60))
        ctx = GateContext(ledger=ledger, current_turn=2)
        decision = gate.evaluate(ToolCall(turn=2, tool="read_file", argv=()), ctx)
        self.assertFalse(decision.allow)


class ChainShortCircuitTests(unittest.TestCase):
    def test_chain_short_circuits_on_first_deny(self) -> None:
        chain = GateChain(
            gates=(
                WhitelistGate(allowed=frozenset({"only_this"})),
                RegexGate.from_strings(patterns=(r".*",)),
            )
        )
        ctx = GateContext(ledger=ObservationLedger(), current_turn=1)
        outcome = chain.evaluate(
            ToolCall(turn=1, tool="other", argv=()), ctx
        )
        self.assertFalse(outcome.allow)
        self.assertEqual(len(outcome.decisions), 1)
        self.assertEqual(outcome.decisions[0].gate, "whitelist")

    def test_chain_allows_when_all_gates_pass(self) -> None:
        chain = build_default_chain(budget=500)
        ctx = GateContext(ledger=ObservationLedger(), current_turn=1)
        outcome = chain.evaluate(
            ToolCall(turn=1, tool="read_file", argv=("main.py",)), ctx
        )
        self.assertTrue(outcome.allow)
        self.assertEqual(len(outcome.decisions), 4)


class SyntheticLoopTests(unittest.TestCase):
    def test_loop_trips_budget_on_third_read(self) -> None:
        chain = build_default_chain(budget=80)

        def big_tool(call: ToolCall) -> str:
            return "x" * 400

        calls = [
            ToolCall(turn=1, tool="list_dir", argv=()),
            ToolCall(turn=2, tool="read_file", argv=("a",)),
            ToolCall(turn=3, tool="read_file", argv=("b",)),
        ]
        report = run_synthetic_loop(
            calls,
            chain,
            tool_fns={
                "list_dir": lambda c: "tiny",
                "read_file": big_tool,
                "run_tests": lambda c: "ok",
            },
        )
        self.assertGreaterEqual(report.refused, 1)
        self.assertGreaterEqual(report.allowed, 1)

    def test_demo_main_exits_zero(self) -> None:
        self.assertEqual(run_demo(), 0)


if __name__ == "__main__":
    unittest.main()
