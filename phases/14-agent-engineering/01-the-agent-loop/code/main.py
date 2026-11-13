"""Toy ReAct agent loop — stdlib only.

Implements the five ingredients from docs/en.md:
  1. message buffer
  2. tool registry
  3. stop condition
  4. turn budget
  5. observation formatter

Also implements Exercises 1, 2, 3, and 5 from docs/en.md — all from scratch,
no external API calls:
  1. max_tool_calls_per_turn cap (see AgentLoop.max_tool_calls_per_turn)
  2. no_tool_calls -> done stop path (see AgentLoop.run, "implicit stop")
  3. malformed-argument recovery (see ToolRegistry.dispatch + demo_malformed_args)
  5. tool_use_id correlator for out-of-order results (see ToolCall.id)

ToyLLM is a scripted policy so the loop runs offline and deterministic. Swap
ToyLLM for a real provider client and the control flow is identical
(Exercise 4 — deliberately left for later, once this file is well understood).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

# ---------------------------------------------------------------------------
# Core data shapes
# ---------------------------------------------------------------------------


@dataclass
class ToolCall:
    """One request to run a tool.

    `id` is the Exercise 5 correlator: a label that stays attached to this
    call's result no matter what order tool calls finish executing in. Real
    providers (Anthropic, OpenAI, Bedrock) all require this because a turn
    can ask for several tools at once, and their results can come back in
    any order — the id is the only way to know which result answers which
    request.
    """

    id: str
    name: str
    args: dict[str, Any]


@dataclass
class Turn:
    """One entry in the conversation history."""

    kind: str  # "user" | "thought" | "action" | "final"
    content: str
    tool_call: ToolCall | None = None
    observation: str | None = None


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Callable[..., str]] = {}

    def register(self, name: str, fn: Callable[..., str]) -> None:
        self._tools[name] = fn

    def names(self) -> list[str]:
        return sorted(self._tools)

    def dispatch(self, call: ToolCall) -> str:
        """Run a tool call and always return a string — never raise.

        This is Exercise 3's mechanism: a malformed argument dict (wrong
        key, wrong type, missing field) turns into a TypeError from Python's
        own call machinery, which we catch here and turn into an
        `error: ...` observation. The loop keeps running and the next
        thought gets to see exactly what went wrong, the same way a 2026
        CRITIC-style agent recovers from its own mistakes.
        """
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


# ---------------------------------------------------------------------------
# The scripted "model"
# ---------------------------------------------------------------------------

class ToyLLM:
    """Scripted ReAct policy. Returns one assistant turn per call.

    Each script entry is a dict shaped like:
        {"kind": "action", "thought": "...", "calls": [{"name": ..., "args": {...}}, ...]}
        {"kind": "action", "thought": "...", "calls": []}     # Exercise 2: no tool calls
        {"kind": "finish", "content": "..."}                  # explicit stop

    `calls` is a *list* (not a single call) because a real model can ask for
    several tools in one turn — that's what Exercise 1's cap and Exercise 5's
    id correlator are both about.
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

# ---------------------------------------------------------------------------
# The loop
# ---------------------------------------------------------------------------


@dataclass
class AgentLoop:
    llm: ToyLLM
    tools: ToolRegistry
    max_turns: int = 12
    max_tool_calls_per_turn: int = 2  # Exercise 1
    history: list[Turn] = field(default_factory=list)
    _next_call_id: int = 0

    def _new_call_id(self) -> str:
        self._next_call_id += 1
        return f"call-{self._next_call_id}"

    def _run_calls(self, raw_calls: list[dict[str, Any]]) -> None:
        """Execute one turn's tool calls, respecting the per-turn cap.

        Exercise 1 in practice: if the model asks for three calls but the
        cap is two, the third call is never run. We still record it in the
        trace with an explicit "dropped" observation, because silently
        ignoring it is worse — the next thought would reference a result
        that never happened and the whole trace would look like a mystery.

        Exercise 5 in practice: each call gets its own id up front, so even
        though we dispatch them one after another here, a real system that
        ran them concurrently could return results in any order and still
        match each one back to the request that produced it.
        """
        to_run = raw_calls[: self.max_tool_calls_per_turn]
        dropped = raw_calls[self.max_tool_calls_per_turn:]

        for raw in to_run:
            call = ToolCall(id=self._new_call_id(), name=raw["name"], args=raw.get("args", {}))
            observation = self.tools.dispatch(call)
            self.history.append(
                Turn(kind="action", content=call.name, tool_call=call, observation=observation)
            )

        for raw in dropped:
            call = ToolCall(id=self._new_call_id(), name=raw["name"], args=raw.get("args", {}))
            observation = (
                f"error: dropped — turn exceeded max_tool_calls_per_turn="
                f"{self.max_tool_calls_per_turn}"
            )
            self.history.append(
                Turn(kind="action", content=call.name, tool_call=call, observation=observation)
            )

    def run(self, user_message: str) -> str:
        self.history.append(Turn(kind="user", content=user_message))
        for _ in range(self.max_turns):
            reply = self.llm.respond(self.history)

            if reply["kind"] == "finish":
                # Explicit stop: the model called a `finish` action.
                self.history.append(Turn(kind="final", content=reply["content"]))
                return reply["content"]

            self.history.append(Turn(kind="thought", content=reply.get("thought", "")))

            calls = reply.get("calls", [])
            if not calls:
                # Exercise 2: implicit stop. The assistant turn carried a
                # thought but asked for no tools, so there is nothing left
                # to react to — treat that as "done" too. This is a second,
                # softer stop condition alongside explicit `finish`. It is
                # more fragile than `finish`: a model that simply forgets to
                # call a tool looks identical to one that is truly done, so
                # relying on it alone risks stopping early on a real mistake.
                msg = "stopped: assistant turn had no tool calls"
                self.history.append(Turn(kind="final", content=msg))
                return msg

            self._run_calls(calls)

        self.history.append(Turn(kind="final", content="budget exhausted"))
        return "budget exhausted"


def pretty_trace(history: list[Turn]) -> None:
    for i, turn in enumerate(history):
        tag = f"[{i:02d} {turn.kind:>7}]"
        if turn.kind in ("user", "thought", "final"):
            print(f"{tag} {turn.content}")
        elif turn.kind == "action":
            call = turn.tool_call
            assert call is not None
            print(f"{tag} {call.id} {call.name}({call.args}) -> {turn.observation}")


# ---------------------------------------------------------------------------
# Demo agents — one per behavior, so each is easy to read on its own
# ---------------------------------------------------------------------------

def build_demo_agent() -> AgentLoop:
    """The five-ingredient loop end to end: a short tax calculation."""
    tools = ToolRegistry()
    tools.register("calculator", calculator)
    kv = KVStore()
    tools.register("kv_get", kv.get)
    tools.register("kv_set", kv.set)

    script: list[dict[str, Any]] = [
        {"kind": "action", "thought": "store the base price",
         "calls": [{"name": "kv_set", "args": {"key": "base", "value": "120"}}]},
        {"kind": "action", "thought": "compute 15% tax",
         "calls": [{"name": "calculator", "args": {"expr": "120 * 0.15"}}]},
        {"kind": "action", "thought": "store the tax",
         "calls": [{"name": "kv_set", "args": {"key": "tax", "value": "18.0"}}]},
        {"kind": "action", "thought": "compute total",
         "calls": [{"name": "calculator", "args": {"expr": "120 + 18.0"}}]},
        {"kind": "action", "thought": "confirm stored values",
         "calls": [{"name": "kv_get", "args": {"key": "base"}}]},
        {"kind": "finish", "content": "the total including 15% tax is 138.0"},
    ]
    return AgentLoop(llm=ToyLLM(script), tools=tools, max_turns=10)


def build_parallel_calls_demo() -> AgentLoop:
    """Exercise 1: the model asks for three calls, the cap only allows two."""
    tools = ToolRegistry()
    kv = KVStore()
    tools.register("kv_set", kv.set)

    script: list[dict[str, Any]] = [
        {"kind": "action", "thought": "store three prices at once",
         "calls": [
             {"name": "kv_set", "args": {"key": "a", "value": "1"}},
             {"name": "kv_set", "args": {"key": "b", "value": "2"}},
             {"name": "kv_set", "args": {"key": "c", "value": "3"}},
         ]},
        {"kind": "finish", "content": "stored what the cap allowed"},
    ]
    return AgentLoop(llm=ToyLLM(script), tools=tools, max_turns=5, max_tool_calls_per_turn=2)


def build_no_tool_calls_demo() -> AgentLoop:
    """Exercise 2: the model stops by simply asking for no tools."""
    tools = ToolRegistry()
    tools.register("calculator", calculator)

    script: list[dict[str, Any]] = [
        {"kind": "action", "thought": "compute the answer",
         "calls": [{"name": "calculator", "args": {"expr": "2 + 2"}}]},
        {"kind": "action", "thought": "nothing left to do", "calls": []},
    ]
    return AgentLoop(llm=ToyLLM(script), tools=tools, max_turns=5)


def build_malformed_args_demo() -> AgentLoop:
    """Exercise 3: a bad call fails safely, the next thought corrects it."""
    tools = ToolRegistry()
    tools.register("calculator", calculator)

    script: list[dict[str, Any]] = [
        {"kind": "action", "thought": "compute 10 divided by 2",
         "calls": [{"name": "calculator", "args": {"expression": "10 / 2"}}]},  # wrong key
        {"kind": "action", "thought": "that failed, retry with the right argument name",
         "calls": [{"name": "calculator", "args": {"expr": "10 / 2"}}]},
        {"kind": "finish", "content": "the answer is 5.0"},
    ]
    return AgentLoop(llm=ToyLLM(script), tools=tools, max_turns=5)


def build_out_of_order_demo() -> AgentLoop:
    """Exercise 5: two calls in one turn, dispatched out of arrival order.

    ToolRegistry.dispatch itself does not run concurrently — this is a
    from-scratch demo, not a threading exercise. What matters is that each
    ToolCall still carries its own id, so even if a real system dispatched
    these two calls over the network and the *second* one happened to come
    back first, the trace below would still show unambiguously which
    observation answers which request.
    """
    tools = ToolRegistry()
    tools.register("calculator", calculator)

    script: list[dict[str, Any]] = [
        {"kind": "action", "thought": "compute two independent sums",
         "calls": [
             {"name": "calculator", "args": {"expr": "1 + 1"}},
             {"name": "calculator", "args": {"expr": "2 + 2"}},
         ]},
        {"kind": "finish", "content": "computed both sums"},
    ]
    return AgentLoop(llm=ToyLLM(script), tools=tools, max_turns=5, max_tool_calls_per_turn=2)


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

    for title, builder, prompt in [
        ("EXERCISE 1 — max_tool_calls_per_turn cap", build_parallel_calls_demo, "store three values"),
        ("EXERCISE 2 — no_tool_calls stop path", build_no_tool_calls_demo, "compute 2 + 2 then stop"),
        ("EXERCISE 3 — malformed-argument recovery", build_malformed_args_demo, "divide 10 by 2"),
        ("EXERCISE 5 — tool_use_id correlator", build_out_of_order_demo, "compute two sums"),
    ]:
        print()
        print("=" * 70)
        print(title)
        print("=" * 70)
        demo_agent = builder()
        demo_final = demo_agent.run(prompt)
        print()
        pretty_trace(demo_agent.history)
        print()
        print(f"final answer: {demo_final}")


if __name__ == "__main__":
    main()
