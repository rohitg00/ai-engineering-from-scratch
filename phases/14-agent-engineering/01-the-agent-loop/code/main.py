"""Toy ReAct agent loop — stdlib only.

Implements the five ingredients from docs/en.md:
  1. message buffer
  2. tool registry
  3. stop condition
  4. turn budget
  5. observation formatter

ToyLLM is a scripted policy so the loop runs offline and deterministic. Swap
ToyLLM for a real provider client and the control flow is identical.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class ToolCall:
    name: str
    args: dict[str, Any]


@dataclass
class Turn:
    kind: str
    content: str
    tool_call: ToolCall | None = None
    observation: str | None = None


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Callable[..., str]] = {}

    def register(self, name: str, fn: Callable[..., str]) -> None:
        self._tools[name] = fn

    def names(self) -> list[str]:
        return sorted(self._tools)

    def dispatch(self, call: ToolCall) -> str:
        fn = self._tools.get(call.name)
        if fn is None:
            return f"error: unknown tool {call.name!r}"
        try:
            return fn(**call.args)
        except TypeError as e:
            return f"error: bad args for {call.name}: {e}"
        except Exception as e:
            return f"error: {type(e).__name__}: {e}"


def calculator(expr: str) -> str:
    allowed = set("0123456789+-*/(). ")
    if not set(expr).issubset(allowed):
        return "error: illegal character in expr"
    try:
        return str(eval(expr, {"__builtins__": {}}, {}))
    except Exception as e:
        return f"error: {type(e).__name__}: {e}"


class KVStore:
    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    def get(self, key: str) -> str:
        return self._store.get(key, f"missing:{key}")

    def set(self, key: str, value: str) -> str:
        self._store[key] = value
        return f"stored {key}"


class ToyLLM:
    """Scripted ReAct policy. Returns one assistant turn per call.

    Each script entry is either ('thought', text) plus ('action', name, args)
    or ('finish', text). The loop runs through the script in order.
    """

    def __init__(self, script: list[dict[str, Any]]) -> None:
        self.script = script
        self.cursor = 0

    def respond(self, history: list[Turn]) -> dict[str, Any]:
        if self.cursor >= len(self.script):
            return {"kind": "finish", "content": "no more actions"}
        entry = self.script[self.cursor]
        self.cursor += 1
        return entry


@dataclass
class AgentLoop:
    llm: ToyLLM
    tools: ToolRegistry
    max_turns: int = 12
    history: list[Turn] = field(default_factory=list)

    def run(self, user_message: str) -> str:
        self.history.append(Turn(kind="user", content=user_message))
        for step in range(self.max_turns):
            reply = self.llm.respond(self.history)
            if reply["kind"] == "finish":
                self.history.append(Turn(kind="final", content=reply["content"]))
                return reply["content"]
            thought = reply.get("thought", "")
            self.history.append(Turn(kind="thought", content=thought))
            call = ToolCall(name=reply["action"], args=reply.get("args", {}))
            observation = self.tools.dispatch(call)
            self.history.append(
                Turn(kind="action", content=call.name,
                     tool_call=call, observation=observation)
            )
        self.history.append(Turn(kind="final",
                                 content="budget exhausted"))
        return "budget exhausted"


def pretty_trace(history: list[Turn]) -> None:
    for i, turn in enumerate(history):
        tag = f"[{i:02d} {turn.kind:>7}]"
        if turn.kind == "user":
            print(f"{tag} {turn.content}")
        elif turn.kind == "thought":
            print(f"{tag} {turn.content}")
        elif turn.kind == "action":
            call = turn.tool_call
            assert call is not None
            print(f"{tag} {call.name}({call.args}) -> {turn.observation}")
        elif turn.kind == "final":
            print(f"{tag} {turn.content}")


def build_demo_agent() -> AgentLoop:
    tools = ToolRegistry()
    tools.register("calculator", calculator)
    kv = KVStore()
    tools.register("kv_get", kv.get)
    tools.register("kv_set", kv.set)

    script: list[dict[str, Any]] = [
        {"kind": "action", "thought": "store the base price",
         "action": "kv_set", "args": {"key": "base", "value": "120"}},
        {"kind": "action", "thought": "compute 15% tax",
         "action": "calculator", "args": {"expr": "120 * 0.15"}},
        {"kind": "action", "thought": "store the tax",
         "action": "kv_set", "args": {"key": "tax", "value": "18.0"}},
        {"kind": "action", "thought": "compute total",
         "action": "calculator", "args": {"expr": "120 + 18.0"}},
        {"kind": "action", "thought": "confirm stored values",
         "action": "kv_get", "args": {"key": "base"}},
        {"kind": "finish", "content": "the total including 15% tax is 138.0"},
    ]
    return AgentLoop(llm=ToyLLM(script), tools=tools, max_turns=10)


def main() -> None:
    print("=" * 70)
    print("TOY REACT LOOP — Phase 14, Lesson 01")
    print("=" * 70)
    agent = build_demo_agent()
    final = agent.run("What is 120 plus 15% tax, stored in kv?")
    print()
    pretty_trace(agent.history)
    print()
    print(f"final answer: {final}")
    print(f"turns used:   {len([t for t in agent.history if t.kind == 'action'])}")
    print(f"tools used:   {agent.tools.names()}")


if __name__ == "__main__":
    main()
