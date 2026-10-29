"""Toy ReAct agent loop — stdlib only.

Lesson: phases/14-agent-engineering/01-the-agent-loop/docs/en.md
Ingredients: message buffer, tool registry, stop condition, turn budget, observation formatter.
ToyLLM is a scripted policy, so the loop runs offline and deterministically.
Source: ReAct (Yao et al., 2022), https://arxiv.org/abs/2210.03629
"""

# Exercises from docs/en.md, all implemented offline with no external API calls:
#   1. max_tool_calls_per_turn cap (see AgentLoop.max_tool_calls_per_turn)
#   2. no_tool_calls -> done stop path (see AgentLoop.run, "implicit stop")
#   3. malformed-argument recovery (see ToolRegistry.dispatch + build_malformed_args_demo)
#   5. tool_use_id correlator for out-of-order results (see ToolCall.id)
# Exercise 4 (swap ToyLLM for a real provider client) is left for later.

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

@dataclass
class ToolCall:
    """One tool invocation requested by the model, keyed by a correlation id."""

    id: str
    name: str
    args: dict[str, Any]

@dataclass
class Turn:
    """One entry in the message buffer: user, thought, action, or final."""

    kind: str
    content: str
    tool_call: ToolCall | None = None
    observation: str | None = None

class ToolRegistry:
    """Name-to-function map the loop dispatches tool calls through."""

    def __init__(self) -> None:
        """Start with no tools registered."""
        self._tools: dict[str, Callable[..., str]] = {}

    def register(self, name: str, fn: Callable[..., str]) -> None:
        """Add or replace the tool called `name`."""
        self._tools[name] = fn

    def names(self) -> list[str]:
        """Return the registered tool names in sorted order."""
        return sorted(self._tools)

    def dispatch(self, call: ToolCall) -> str:
        """Run a call and return its observation; failures come back as error strings."""
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
    """Evaluate an arithmetic expression restricted to digits and + - * / ( ) . characters."""
    allowed = set("0123456789+-*/(). ")
    if not set(expr).issubset(allowed):
        return "error: illegal character in expr"
    try:
        return str(eval(expr, {"__builtins__": {}}, {}))
    except Exception as e:
        return f"error: {type(e).__name__}: {e}"

class KVStore:
    """In-memory key-value store exposed to the agent as two tools."""

    def __init__(self) -> None:
        """Start empty."""
        self._store: dict[str, str] = {}

    def get(self, key: str) -> str:
        """Return the stored value, or a `missing:<key>` marker."""
        return self._store.get(key, f"missing:{key}")

    def set(self, key: str, value: str) -> str:
        """Store a value and return a confirmation string."""
        self._store[key] = value
        return f"stored {key}"

class ToyLLM:
    """Scripted policy that replays canned replies so the loop runs offline."""

    def __init__(self, script: list[dict[str, Any]]) -> None:
        """Keep the script and start at its first entry."""
        self.script = script
        self.cursor = 0

    def respond(self, history: list[Turn]) -> dict[str, Any]:
        """Return the next scripted reply, or a finish reply once the script runs out."""
        if self.cursor >= len(self.script):
            return {"kind": "finish", "content": "no more actions"}
        entry = self.script[self.cursor]
        self.cursor += 1
        return entry

@dataclass
class AgentLoop:
    """ReAct loop: ask the model, run its tool calls, append observations, repeat."""

    llm: ToyLLM
    tools: ToolRegistry
    max_turns: int = 12
    max_tool_calls_per_turn: int = 2
    history: list[Turn] = field(default_factory=list)
    _next_call_id: int = 0

    def _new_call_id(self, reserved: set[str]) -> str:
        """Return the next generated id that no supplied id in this turn already uses."""
        while True:
            self._next_call_id += 1
            candidate = f"call-{self._next_call_id}"
            if candidate not in reserved:
                return candidate

    def _make_call(self, raw: dict[str, Any], reserved: set[str]) -> ToolCall:
        """Build a ToolCall, keeping the model-supplied id so results match back to it."""
        call_id = raw.get("id") or self._new_call_id(reserved)
        return ToolCall(id=call_id, name=raw["name"], args=raw.get("args", {}))

    def _run_calls(
        self, raw_calls: list[dict[str, Any]], arrival: list[str] | None = None
    ) -> None:
        """Dispatch one turn's calls, drop those over the cap, and record the results."""
        to_run = raw_calls[: self.max_tool_calls_per_turn]
        dropped = raw_calls[self.max_tool_calls_per_turn:]
        # Reserve every supplied id first so a generated id can never shadow one.
        reserved = {raw["id"] for raw in raw_calls if raw.get("id")}

        results: list[Turn] = []
        for raw in to_run:
            call = self._make_call(raw, reserved)
            observation = self.tools.dispatch(call)
            results.append(
                Turn(kind="action", content=call.name, tool_call=call, observation=observation)
            )

        for raw in dropped:
            call = self._make_call(raw, reserved)
            observation = (
                f"error: dropped — turn exceeded max_tool_calls_per_turn="
                f"{self.max_tool_calls_per_turn}"
            )
            results.append(
                Turn(kind="action", content=call.name, tool_call=call, observation=observation)
            )

        if arrival:
            # Simulate results landing in a different order than the calls were issued.
            # Unlisted ids keep their issue order after the listed ones.
            rank = {cid: i for i, cid in enumerate(arrival)}
            results.sort(key=lambda t: rank.get(t.tool_call.id, len(rank)))
        self.history.extend(results)

    def run(self, user_message: str) -> str:
        """Run the loop until the model finishes, stops calling tools, or the budget ends."""
        self.history.append(Turn(kind="user", content=user_message))
        for _ in range(self.max_turns):
            reply = self.llm.respond(self.history)

            if reply["kind"] == "finish":
                self.history.append(Turn(kind="final", content=reply["content"]))
                return reply["content"]

            self.history.append(Turn(kind="thought", content=reply.get("thought", "")))

            calls = reply.get("calls", [])
            if not calls:
                msg = reply.get("content") or "stopped: assistant turn had no tool calls"
                self.history.append(Turn(kind="final", content=msg))
                return msg

            self._run_calls(calls, reply.get("arrival"))

        self.history.append(Turn(kind="final", content="budget exhausted"))
        return "budget exhausted"

def observations_by_id(history: list[Turn]) -> dict[str, str | None]:
    """Map each tool call id to its observation, whatever order results arrived in."""
    return {t.tool_call.id: t.observation for t in history if t.tool_call is not None}

def pretty_trace(history: list[Turn]) -> None:
    """Print the message buffer one numbered line per turn."""
    for i, turn in enumerate(history):
        tag = f"[{i:02d} {turn.kind:>7}]"
        if turn.kind in ("user", "thought", "final"):
            print(f"{tag} {turn.content}")
        elif turn.kind == "action":
            call = turn.tool_call
            assert call is not None
            print(f"{tag} {call.id} {call.name}({call.args}) -> {turn.observation}")

def build_demo_agent() -> AgentLoop:
    """Main demo: store a price, compute tax and total, then finish."""
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
    """Exercise 1: three calls in one turn against a cap of two."""
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
    """Exercise 2: an assistant turn with no tool calls ends the run."""
    tools = ToolRegistry()
    tools.register("calculator", calculator)

    script: list[dict[str, Any]] = [
        {"kind": "action", "thought": "compute the answer",
         "calls": [{"name": "calculator", "args": {"expr": "2 + 2"}}]},
        {"kind": "action", "thought": "nothing left to do", "calls": []},
    ]
    return AgentLoop(llm=ToyLLM(script), tools=tools, max_turns=5)

def build_malformed_args_demo() -> AgentLoop:
    """Exercise 3: a wrong argument name returns an error, then the retry succeeds."""
    tools = ToolRegistry()
    tools.register("calculator", calculator)

    script: list[dict[str, Any]] = [
        {"kind": "action", "thought": "compute 10 divided by 2",
         "calls": [{"name": "calculator", "args": {"expression": "10 / 2"}}]},
        {"kind": "action", "thought": "that failed, retry with the right argument name",
         "calls": [{"name": "calculator", "args": {"expr": "10 / 2"}}]},
        {"kind": "finish", "content": "the answer is 5.0"},
    ]
    return AgentLoop(llm=ToyLLM(script), tools=tools, max_turns=5)

def build_out_of_order_demo() -> AgentLoop:
    """Exercise 5: results land in a different order than the calls, matched by id."""
    tools = ToolRegistry()
    tools.register("calculator", calculator)

    script: list[dict[str, Any]] = [
        {"kind": "action", "thought": "compute two independent sums",
         "calls": [
             {"id": "tool-42", "name": "calculator", "args": {"expr": "1 + 1"}},
             {"id": "tool-7", "name": "calculator", "args": {"expr": "2 + 2"}},
         ],
         "arrival": ["tool-7", "tool-42"]},
        {"kind": "finish", "content": "computed both sums"},
    ]
    return AgentLoop(llm=ToyLLM(script), tools=tools, max_turns=5, max_tool_calls_per_turn=2)

def main() -> None:
    """Run the main demo, then each exercise demo, printing every trace."""
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
