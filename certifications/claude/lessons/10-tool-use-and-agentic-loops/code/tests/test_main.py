"""Tests for lesson 10 client tool loop."""

import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))

from main import (
    CapabilityNeeds,
    RuntimeNeeds,
    ScriptedModel,
    Tool,
    ToolLoop,
    ToolLoopError,
    ToolRegistry,
    choose_capability_surface,
    choose_runtime,
    decision_lab,
    demo,
)


def make_tool(name="read", mutates=False, handler=lambda data: data):
    return Tool(name, "Focused test tool.", {"type": "object", "required": ["value"], "additionalProperties": False, "properties": {"value": {"type": "string"}}}, handler, mutates)


class ToolLoopTests(unittest.TestCase):
    def test_shipped_transcript_matches_demo(self):
        artifact = pathlib.Path(__file__).parents[2] / "outputs" / "tool-loop-transcript.json"
        expected = json.loads(artifact.read_text(encoding="utf-8"))
        answer, transcript = demo()
        self.assertEqual({"answer": answer, "transcript": transcript}, expected)

    def test_single_tool_round_trip(self):
        model = ScriptedModel([
            {"stop_reason": "tool_use", "content": [{"type": "tool_use", "id": "c1", "name": "read", "input": {"value": "x"}}]},
            {"stop_reason": "end_turn", "content": [{"type": "text", "text": "ok"}]},
        ])
        answer, messages = ToolLoop(model, ToolRegistry([make_tool()])).run("go")
        self.assertEqual(answer, "ok")
        self.assertEqual(messages[2]["content"][0]["tool_use_id"], "c1")

    def test_multiple_calls_return_multiple_results(self):
        model = ScriptedModel([
            {"stop_reason": "tool_use", "content": [
                {"type": "tool_use", "id": "c1", "name": "read", "input": {"value": "a"}},
                {"type": "tool_use", "id": "c2", "name": "read", "input": {"value": "b"}},
            ]},
            {"stop_reason": "end_turn", "content": [{"type": "text", "text": "ok"}]},
        ])
        _, messages = ToolLoop(model, ToolRegistry([make_tool()])).run("go")
        self.assertEqual([r["tool_use_id"] for r in messages[2]["content"]], ["c1", "c2"])

    def test_unknown_tool_is_model_visible_error(self):
        model = ScriptedModel([
            {"stop_reason": "tool_use", "content": [{"type": "tool_use", "id": "c1", "name": "ghost", "input": {}}]},
            {"stop_reason": "end_turn", "content": [{"type": "text", "text": "handled"}]},
        ])
        _, messages = ToolLoop(model, ToolRegistry([])).run("go")
        self.assertTrue(messages[2]["content"][0]["is_error"])

    def test_schema_error_does_not_crash_loop(self):
        model = ScriptedModel([
            {"stop_reason": "tool_use", "content": [{"type": "tool_use", "id": "c1", "name": "read", "input": {}}]},
            {"stop_reason": "end_turn", "content": [{"type": "text", "text": "fixed"}]},
        ])
        _, messages = ToolLoop(model, ToolRegistry([make_tool()])).run("go")
        self.assertIn("missing required", messages[2]["content"][0]["content"])

    def test_declared_type_is_checked_before_handler(self):
        calls = []
        model = ScriptedModel([
            {"stop_reason": "tool_use", "content": [{"type": "tool_use", "id": "c1", "name": "read", "input": {"value": 7}}]},
            {"stop_reason": "end_turn", "content": [{"type": "text", "text": "fixed"}]},
        ])
        _, messages = ToolLoop(model, ToolRegistry([make_tool(handler=lambda data: calls.append(data))])).run("go")
        self.assertEqual(calls, [])
        self.assertIn("expected string", messages[2]["content"][0]["content"])

    def test_numeric_bounds_are_checked_before_handler(self):
        calls = []
        bounded = Tool(
            "score",
            "Accept a bounded score.",
            {
                "type": "object",
                "required": ["value"],
                "additionalProperties": False,
                "properties": {"value": {"type": "integer", "minimum": 1, "maximum": 5}},
            },
            lambda data: calls.append(data),
        )
        model = ScriptedModel([
            {"stop_reason": "tool_use", "content": [{"type": "tool_use", "id": "c1", "name": "score", "input": {"value": 6}}]},
            {"stop_reason": "end_turn", "content": [{"type": "text", "text": "fixed"}]},
        ])
        _, messages = ToolLoop(model, ToolRegistry([bounded])).run("go")
        self.assertEqual(calls, [])
        self.assertIn("above maximum 5", messages[2]["content"][0]["content"])

    def test_string_and_array_bounds_are_enforced(self):
        bounded = Tool(
            "tag",
            "Accept two short tags.",
            {
                "type": "object",
                "required": ["tags"],
                "additionalProperties": False,
                "properties": {
                    "tags": {
                        "type": "array",
                        "minItems": 2,
                        "maxItems": 2,
                        "items": {"type": "string", "minLength": 2, "maxLength": 4},
                    }
                },
            },
            lambda data: data,
        )
        with self.assertRaisesRegex(ValueError, "minLength"):
            bounded.validate({"tags": ["x", "okay"]})
        with self.assertRaisesRegex(ValueError, "minItems"):
            bounded.validate({"tags": ["okay"]})

    def test_mutating_tool_requires_approval(self):
        model = ScriptedModel([
            {"stop_reason": "tool_use", "content": [{"type": "tool_use", "id": "c1", "name": "write", "input": {"value": "x"}}]},
            {"stop_reason": "end_turn", "content": [{"type": "text", "text": "denied"}]},
        ])
        _, messages = ToolLoop(model, ToolRegistry([make_tool("write", True)])).run("go")
        self.assertEqual(messages[2]["content"][0]["content"], "Approval denied")

    def test_handler_exception_becomes_error(self):
        def fail(_data):
            raise OSError("offline")
        model = ScriptedModel([
            {"stop_reason": "tool_use", "content": [{"type": "tool_use", "id": "c1", "name": "read", "input": {"value": "x"}}]},
            {"stop_reason": "end_turn", "content": [{"type": "text", "text": "fallback"}]},
        ])
        _, messages = ToolLoop(model, ToolRegistry([make_tool(handler=fail)])).run("go")
        self.assertIn("offline", messages[2]["content"][0]["content"])

    def test_turn_budget_stops_runaway_agent(self):
        response = {"stop_reason": "tool_use", "content": [{"type": "tool_use", "id": "c1", "name": "read", "input": {"value": "x"}}]}
        with self.assertRaisesRegex(ToolLoopError, "maximum turns"):
            ToolLoop(ScriptedModel([response]), ToolRegistry([make_tool()]), max_turns=1).run("go")

    def test_shipped_runtime_decisions_match_lab(self):
        artifact = pathlib.Path(__file__).parents[2] / "outputs" / "runtime-and-tool-surface-decisions.json"
        self.assertEqual(json.loads(artifact.read_text(encoding="utf-8")), decision_lab())

    def test_runtime_choice_preserves_workflow_gate(self):
        self.assertEqual(choose_runtime(RuntimeNeeds(open_ended=False)), "deterministic-workflow")
        self.assertEqual(choose_runtime(RuntimeNeeds(open_ended=True)), "sdk-tool-runner")
        self.assertEqual(
            choose_runtime(RuntimeNeeds(open_ended=True, needs_custom_wire_control=True)),
            "hand-written-loop",
        )

    def test_managed_runtime_requires_explicit_beta_acceptance(self):
        with self.assertRaisesRegex(ValueError, "explicit acceptance"):
            choose_runtime(RuntimeNeeds(open_ended=True, needs_managed_sandbox=True))
        self.assertEqual(
            choose_runtime(
                RuntimeNeeds(
                    open_ended=True,
                    needs_remote_durable_session=True,
                    accepts_managed_beta=True,
                )
            ),
            "managed-agents",
        )

    def test_skill_composes_with_an_execution_surface(self):
        decision = choose_capability_surface(CapabilityNeeds(reusable_procedure=True))
        self.assertEqual(decision["procedure"], "skill")
        self.assertEqual(decision["execution"], "custom-client-tool")
        self.assertEqual(decision["authorization_owner"], "application-policy")

    def test_capability_surface_has_one_execution_boundary(self):
        with self.assertRaisesRegex(ValueError, "one execution boundary"):
            choose_capability_surface(
                CapabilityNeeds(shared_standard_service=True, provider_executed_builtin=True)
            )


if __name__ == "__main__":
    unittest.main()
