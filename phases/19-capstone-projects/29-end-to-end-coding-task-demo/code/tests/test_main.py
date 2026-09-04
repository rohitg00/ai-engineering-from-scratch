"""End-to-end tests for the composed agent + harness."""

from __future__ import annotations

import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    AgentRun,
    BudgetGate,
    ChainOutcome,
    CodingAgentPolicy,
    GateChain,
    GateContext,
    InMemoryExporter,
    JSONLExporter,
    MetricsRegistry,
    Observation,
    ObservationLedger,
    RegexGate,
    Sandbox,
    SpanBuilder,
    ToolCall,
    WhitelistGate,
    build_default_chain,
    prepare_scratch_repo,
    prometheus_text,
    run_demo,
)


class PolicyTransitionTests(unittest.TestCase):
    def test_initial_state(self) -> None:
        p = CodingAgentPolicy(repo_root="/tmp")
        self.assertEqual(p.state, "SURVEY")
        action = p.next_action(None)
        self.assertEqual(action[0], "read_file")

    def test_survey_to_run_tests(self) -> None:
        p = CodingAgentPolicy(repo_root="/tmp")
        p.observe("read_file", 0, "def fizz(n): pass\n")
        self.assertEqual(p.state, "RUN_TESTS")

    def test_run_tests_pass_halts(self) -> None:
        p = CodingAgentPolicy(repo_root="/tmp")
        p.state = "RUN_TESTS"
        p.observe("run_tests", 0, "ok")
        self.assertEqual(p.state, "HALT")

    def test_run_tests_fail_to_inspect(self) -> None:
        p = CodingAgentPolicy(repo_root="/tmp")
        p.state = "RUN_TESTS"
        p.observe("run_tests", 1, "FAIL: expected ... fizz")
        self.assertEqual(p.state, "INSPECT")

    def test_inspect_to_fix(self) -> None:
        p = CodingAgentPolicy(repo_root="/tmp")
        p.state = "INSPECT"
        p.last_test_stderr = "FAIL: expected [1, 2, 'fizz']"
        p.observe("read_file", 0, "test source")
        self.assertEqual(p.state, "FIX")
        self.assertIsNotNone(p.identified_bug_file)
        self.assertIsNotNone(p.identified_fix)


class GateChainTests(unittest.TestCase):
    def test_chain_refuses_unknown_tool(self) -> None:
        chain = build_default_chain(budget=1000)
        ctx = GateContext(ledger=ObservationLedger(), current_turn=1)
        outcome = chain.evaluate(
            ToolCall(turn=1, tool="shell", argv=("rm",)), ctx
        )
        self.assertFalse(outcome.allow)

    def test_chain_refuses_rm_rf(self) -> None:
        chain = build_default_chain(budget=1000)
        ctx = GateContext(ledger=ObservationLedger(), current_turn=1)
        outcome = chain.evaluate(
            ToolCall(turn=1, tool="run_tests", argv=("rm", "-rf", "/")), ctx
        )
        self.assertFalse(outcome.allow)

    def test_chain_allows_legal_call(self) -> None:
        chain = build_default_chain(budget=1000)
        ctx = GateContext(ledger=ObservationLedger(), current_turn=1)
        outcome = chain.evaluate(
            ToolCall(turn=1, tool="read_file", argv=("src/fizz.py",)), ctx
        )
        self.assertTrue(outcome.allow)


class SandboxTests(unittest.TestCase):
    def test_sandbox_runs_echo_in_repo(self) -> None:
        repo = prepare_scratch_repo()
        sb = Sandbox(project_root=repo)
        # Smoke-test that we can spawn a process. Use python -m to avoid
        # invoking the interpreter directly through its own check.
        result = sb.run([sys.executable, "-V"])
        self.assertEqual(result.exit_code, 0, msg=result.stderr)

    def test_sandbox_denies_rm(self) -> None:
        repo = prepare_scratch_repo()
        sb = Sandbox(project_root=repo)
        result = sb.run(["rm", "-rf", "."])
        self.assertTrue(result.denied)


class FixtureRepoTests(unittest.TestCase):
    def test_fixture_repo_has_buggy_fizz(self) -> None:
        repo = prepare_scratch_repo()
        src = os.path.join(repo, "src", "fizz.py")
        self.assertTrue(os.path.isfile(src))
        with open(src, "r", encoding="utf-8") as fh:
            text = fh.read()
        # Off-by-one: range(1, n) instead of range(1, n + 1).
        self.assertIn("range(1, n)", text)
        self.assertNotIn("range(1, n + 1)", text)


class EndToEndTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = prepare_scratch_repo()
        self.chain = build_default_chain(budget=8000)
        self.sandbox = Sandbox(project_root=self.repo, timeout_seconds=10.0)
        self.metrics = MetricsRegistry()
        self.exporter = InMemoryExporter()
        self.builder = SpanBuilder(
            exporters=[self.exporter], metrics=self.metrics
        )

    def test_agent_solves_under_12_steps(self) -> None:
        runner = AgentRun(
            repo_root=self.repo,
            chain=self.chain,
            sandbox=self.sandbox,
            builder=self.builder,
            observation_budget=8000,
            step_budget=12,
        )
        report = runner.run()
        self.assertTrue(report.solved, msg=report.halted_reason)
        self.assertLess(len(report.steps), 12)
        self.assertEqual(report.refused_legal_tool_calls, 0)
        self.assertLessEqual(
            report.observation_tokens, report.max_observation_budget
        )

    def test_agent_emits_one_chat_span_and_one_per_tool_call(self) -> None:
        runner = AgentRun(
            repo_root=self.repo,
            chain=self.chain,
            sandbox=self.sandbox,
            builder=self.builder,
        )
        report = runner.run()
        chat_spans = [s for s in self.exporter.spans if s.name == "gen_ai.chat"]
        tool_spans = [
            s for s in self.exporter.spans if s.name == "gen_ai.tool.execution"
        ]
        self.assertEqual(len(chat_spans), 1)
        self.assertEqual(len(tool_spans), len(report.steps))
        for span in tool_spans:
            self.assertIn("gen_ai.tool.name", span.attributes)
            self.assertIn("gen_ai.tool.call.id", span.attributes)
            self.assertEqual(span.parent_span_id, chat_spans[0].span_id)

    def test_prometheus_text_includes_tools_called_total(self) -> None:
        runner = AgentRun(
            repo_root=self.repo,
            chain=self.chain,
            sandbox=self.sandbox,
            builder=self.builder,
        )
        runner.run()
        text = prometheus_text(self.metrics)
        self.assertIn("tools_called_total", text)
        self.assertIn('tool="read_file"', text)
        self.assertIn("tool_latency_ms_count", text)

    def test_jsonl_export_roundtrip(self) -> None:
        path = os.path.join(self.repo, "traces.jsonl")
        jsonl = JSONLExporter(path=path)
        builder = SpanBuilder(
            exporters=[jsonl], metrics=self.metrics
        )
        runner = AgentRun(
            repo_root=self.repo,
            chain=self.chain,
            sandbox=self.sandbox,
            builder=builder,
        )
        runner.run()
        jsonl.close()
        with open(path, "r", encoding="utf-8") as fh:
            spans = [json.loads(line) for line in fh if line.strip()]
        self.assertGreater(len(spans), 0)
        for span in spans:
            self.assertIn("name", span)
            self.assertIn("attributes", span)
            self.assertIn("status", span)

    def test_demo_main_exits_zero(self) -> None:
        self.assertEqual(run_demo(), 0)


if __name__ == "__main__":
    unittest.main()
