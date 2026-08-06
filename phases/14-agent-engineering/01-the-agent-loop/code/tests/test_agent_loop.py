"""Tests for the ReAct agent loop (Phase 14, Lesson 01).

Run from repo root:
    python -m pytest phases/14-agent-engineering/01-the-agent-loop/code/tests/
"""

from __future__ import annotations

import sys
from pathlib import Path

# Make the parent code/ directory importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import main


class TestToyLLM:
    def test_script_plays_in_order(self) -> None:
        script = [
            {"kind": "finish", "content": "done"},
        ]
        llm = main.ToyLLM(script)
        assert llm.respond([]) == {"kind": "finish", "content": "done"}

    def test_cursor_exhaustion(self) -> None:
        llm = main.ToyLLM([{"kind": "finish", "content": "first"}])
        llm.respond([])
        assert llm.respond([]) == {"kind": "finish", "content": "no more actions"}

    def test_multiple_turns(self) -> None:
        script = [
            {"kind": "action", "thought": "t1", "action": "kv_set",
             "args": {"key": "k", "value": "v"}},
            {"kind": "action", "thought": "t2", "action": "kv_get",
             "args": {"key": "k"}},
            {"kind": "finish", "content": "all done"},
        ]
        llm = main.ToyLLM(script)
        history: list[main.Turn] = []
        r1 = llm.respond(history)
        assert r1["kind"] == "action"
        assert r1["action"] == "kv_set"
        r2 = llm.respond(history)
        assert r2["kind"] == "action"
        assert r2["action"] == "kv_get"
        r3 = llm.respond(history)
        assert r3["kind"] == "finish"
        assert r3["content"] == "all done"


class TestToolRegistry:
    def test_register_and_dispatch(self) -> None:
        reg = main.ToolRegistry()
        reg.register("echo", lambda x: x)
        assert reg.dispatch(main.ToolCall("echo", {"x": "hello"})) == "hello"

    def test_unknown_tool(self) -> None:
        reg = main.ToolRegistry()
        result = reg.dispatch(main.ToolCall("nope", {}))
        assert "error" in result
        assert "nope" in result

    def test_bad_args(self) -> None:
        reg = main.ToolRegistry()
        reg.register("add", lambda a, b: str(int(a) + int(b)))
        result = reg.dispatch(main.ToolCall("add", {"a": "1"}))
        assert "error" in result

    def test_names_sorted(self) -> None:
        reg = main.ToolRegistry()
        reg.register("zebra", lambda: "z")
        reg.register("alpha", lambda: "a")
        assert reg.names() == ["alpha", "zebra"]


class TestCalculator:
    def test_basic_arithmetic(self) -> None:
        assert main.calculator("2 + 3") == "5"
        assert main.calculator("10 * 5") == "50"

    def test_illegal_characters(self) -> None:
        result = main.calculator("__import__('os')")
        assert "error" in result

    def test_division_by_zero(self) -> None:
        result = main.calculator("1 / 0")
        assert "error" in result

    def test_parentheses(self) -> None:
        assert main.calculator("(2 + 3) * 4") == "20"


class TestKVStore:
    def test_set_and_get(self) -> None:
        kv = main.KVStore()
        assert kv.set("x", "10") == "stored x"
        assert kv.get("x") == "10"

    def test_missing_key(self) -> None:
        kv = main.KVStore()
        assert kv.get("nonexistent") == "missing:nonexistent"

    def test_overwrite(self) -> None:
        kv = main.KVStore()
        kv.set("key", "old")
        kv.set("key", "new")
        assert kv.get("key") == "new"


class TestAgentLoop:
    def test_build_demo_agent_runs(self) -> None:
        agent = main.build_demo_agent()
        final = agent.run("What is 120 plus 15% tax?")
        assert final == "the total including 15% tax is 138.0"
        assert len(agent.history) > 0

    def test_budget_exhausted(self) -> None:
        tools = main.ToolRegistry()
        tools.register("noop", lambda: "ok")
        script = [
            {"kind": "action", "thought": "loop", "action": "noop",
             "args": {}},
        ] * 20
        agent = main.AgentLoop(
            llm=main.ToyLLM(script), tools=tools, max_turns=3,
        )
        final = agent.run("loop forever")
        assert final == "budget exhausted"

    def test_history_has_user_turn(self) -> None:
        agent = main.build_demo_agent()
        agent.run("hello")
        assert agent.history[0].kind == "user"
        assert agent.history[0].content == "hello"

    def test_history_ends_with_final(self) -> None:
        agent = main.build_demo_agent()
        agent.run("any")
        assert agent.history[-1].kind == "final"


class TestTurn:
    def test_defaults(self) -> None:
        t = main.Turn(kind="user", content="hi")
        assert t.tool_call is None
        assert t.observation is None
