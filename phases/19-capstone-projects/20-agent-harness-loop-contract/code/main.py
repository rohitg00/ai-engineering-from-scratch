"""Agent harness loop contract — deterministic state machine、hooks、pull points。

Conceptual references:
- ./docs/en.md (この lesson)
- Phase 14 lesson 01 (agent loop fundamentals)
- Phase 13 lesson 02 (tool protocols overview)

Stdlib のみ。実行: python3 code/main.py
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Iterable


class State(str, Enum):
    IDLE = "idle"
    PLANNING = "planning"
    EXECUTING = "executing"
    AWAITING_TOOL = "awaiting_tool"
    REFLECTING = "reflecting"
    DONE = "done"


HOOK_TOPICS = (
    "before_plan",
    "after_plan",
    "before_step",
    "after_step",
    "before_tool_call",
    "after_tool_call",
    "on_error",
    "on_pause",
    "on_budget_exceeded",
    "on_complete",
)

EVENT_TYPES = (
    "session.start",
    "plan.draft",
    "plan.commit",
    "step.start",
    "step.end",
    "tool.call",
    "tool.result",
    "tool.error",
    "budget.warn",
    "session.pause",
    "session.complete",
)


class HookAbort(Exception):
    """In-flight turn を cancel するために hook が raise する。"""


@dataclass
class Event:
    type: str
    payload: dict
    ts: float

    def to_dict(self) -> dict:
        return {"type": self.type, "payload": self.payload, "ts": self.ts}


@dataclass
class Budget:
    max_turns: int = 8
    max_tool_calls: int = 16
    max_wall_seconds: float = 30.0
    turns: int = 0
    tool_calls: int = 0
    started_at: float = field(default_factory=time.time)

    def remaining_seconds(self) -> float:
        return max(0.0, self.max_wall_seconds - (time.time() - self.started_at))

    def exceeded(self) -> str | None:
        if self.turns >= self.max_turns:
            return "turns"
        if self.tool_calls >= self.max_tool_calls:
            return "tool_calls"
        if self.remaining_seconds() <= 0.0:
            return "wall_clock"
        return None


@dataclass
class Step:
    id: int
    description: str
    requires_tool: bool
    tool_name: str | None = None
    tool_args: dict = field(default_factory=dict)
    result: Any = None
    error: str | None = None


@dataclass
class PullRequest:
    """Loop が control を yield するときに run()/resume() から返される。"""
    reason: str
    state: State
    payload: dict


@dataclass
class SessionResult:
    state: State
    reason: str
    steps: list[Step]
    events: list[Event]


class HookRegistry:
    def __init__(self) -> None:
        self._subs: dict[str, list[Callable[[dict], Any]]] = {t: [] for t in HOOK_TOPICS}

    def on(self, topic: str, fn: Callable[[dict], Any]) -> None:
        if topic not in self._subs:
            raise ValueError(f"unknown hook topic: {topic}")
        self._subs[topic].append(fn)

    def fire(self, topic: str, payload: dict) -> list[Any]:
        results = []
        for fn in self._subs[topic]:
            results.append(fn(payload))
        return results


Planner = Callable[[str, list[Step]], list[Step]]


def _default_planner(goal: str, history: list[Step]) -> list[Step]:
    """Deterministic stand-in planner。固定の three-step plan を返す。"""
    if history:
        return []
    return [
        Step(id=1, description=f"goal を解釈する: {goal}", requires_tool=False),
        Step(id=2, description="user record を取得する", requires_tool=True,
             tool_name="db.get_user", tool_args={"id": 42}),
        Step(id=3, description="要約して応答する", requires_tool=True,
             tool_name="format.summary", tool_args={"style": "short"}),
    ]


class HarnessLoop:
    """Hook topic と event stream を持つ six-state deterministic loop。"""

    def __init__(
        self,
        planner: Planner | None = None,
        budget: Budget | None = None,
    ) -> None:
        self.state: State = State.IDLE
        self.hooks = HookRegistry()
        self.budget = budget or Budget()
        self._planner: Planner = planner or _default_planner
        self._goal: str = ""
        self._plan: list[Step] = []
        self._cursor: int = 0
        self._events: list[Event] = []
        self._history: list[Step] = []
        self._reason: str = ""
        self._prev_state: State | None = None

    @property
    def events(self) -> list[Event]:
        return list(self._events)

    @property
    def plan(self) -> list[Step]:
        return list(self._plan)

    def _emit(self, etype: str, payload: dict) -> None:
        if etype not in EVENT_TYPES:
            raise ValueError(f"unknown event type: {etype}")
        self._events.append(Event(type=etype, payload=payload, ts=time.time()))

    def _transition(self, target: State) -> None:
        legal: dict[State, set[State]] = {
            State.IDLE: {State.PLANNING},
            State.PLANNING: {State.EXECUTING, State.IDLE, State.DONE},
            State.EXECUTING: {State.AWAITING_TOOL, State.REFLECTING, State.IDLE},
            State.AWAITING_TOOL: {State.REFLECTING, State.IDLE},
            State.REFLECTING: {State.PLANNING, State.EXECUTING, State.DONE, State.IDLE},
            State.DONE: set(),
        }
        if target not in legal[self.state]:
            raise RuntimeError(f"illegal transition {self.state.value} -> {target.value}")
        self.state = target

    def _check_budget(self) -> PullRequest | None:
        which = self.budget.exceeded()
        if which is None:
            return None
        self._emit("budget.warn", {"limit": which})
        self.hooks.fire("on_budget_exceeded", {"limit": which, "budget": self.budget})
        self._reason = f"budget_exceeded:{which}"
        self._prev_state = self.state
        return self._pause(self._reason)

    def _pause(self, reason: str) -> PullRequest:
        self._emit("session.pause", {"reason": reason})
        self.hooks.fire("on_pause", {"reason": reason})
        self._transition(State.IDLE)
        return PullRequest(reason=reason, state=self.state, payload={"reason": reason})

    def run(self, goal: str) -> PullRequest | SessionResult:
        if self.state != State.IDLE:
            raise RuntimeError(f"run() は IDLE からのみ実行できます。現在: {self.state.value}")
        self._goal = goal
        self.budget.started_at = time.time()
        self._emit("session.start", {"goal": goal})
        return self._step()

    def resume(self, payload: dict | None = None) -> PullRequest | SessionResult:
        if self.state == State.IDLE and self._reason.startswith("budget_exceeded"):
            self.budget.turns = 0
            self.budget.tool_calls = 0
            self.budget.started_at = time.time()
            self._reason = ""
            prev = self._prev_state
            self._prev_state = None
            if not self._plan:
                return self._begin_plan()
            if prev == State.EXECUTING:
                self.state = State.EXECUTING
            else:
                self.state = State.REFLECTING
            return self._step()
        if self.state == State.AWAITING_TOOL:
            if payload is None:
                raise ValueError("AWAITING_TOOL から resume するには payload が必要です")
            current = self._plan[self._cursor]
            if "error" in payload:
                current.error = str(payload["error"])
                self._emit("tool.error", {"step": current.id, "error": current.error})
                self.hooks.fire("on_error", {"step": current, "error": current.error})
            else:
                current.result = payload.get("result")
                self._emit("tool.result", {"step": current.id, "result": current.result})
            self.hooks.fire("after_tool_call", {"step": current})
            self._transition(State.REFLECTING)
            return self._step()
        raise RuntimeError(f"state {self.state.value} からの resume() は support されていません")

    def _begin_plan(self) -> PullRequest | SessionResult:
        self._transition(State.PLANNING)
        self.hooks.fire("before_plan", {"goal": self._goal, "history": list(self._history)})
        draft = self._planner(self._goal, list(self._history))
        self._emit("plan.draft", {"steps": [s.description for s in draft]})
        self.hooks.fire("after_plan", {"steps": draft})
        self._plan = draft
        self._cursor = 0
        self._emit("plan.commit", {"count": len(draft)})
        if not draft:
            return self._complete("no_plan")
        self._transition(State.EXECUTING)
        return self._step()

    def _step(self) -> PullRequest | SessionResult:
        if self.state == State.IDLE:
            return self._begin_plan()
        budget_hit = self._check_budget()
        if budget_hit is not None:
            return budget_hit
        if self.state == State.REFLECTING:
            self._cursor += 1
            self.budget.turns += 1
            if self._cursor >= len(self._plan):
                return self._complete("goal_met")
            self._transition(State.EXECUTING)
            return self._step()
        if self.state != State.EXECUTING:
            raise RuntimeError(f"_step には EXECUTING/REFLECTING が必要です。現在: {self.state.value}")
        step = self._plan[self._cursor]
        self.hooks.fire("before_step", {"step": step})
        self._emit("step.start", {"step_id": step.id, "desc": step.description})
        if step.requires_tool:
            try:
                self.hooks.fire("before_tool_call", {"step": step})
            except HookAbort as exc:
                step.error = f"hook_abort:{exc}"
                self._emit("tool.error", {"step": step.id, "error": step.error})
                self.hooks.fire("on_error", {"step": step, "error": step.error})
                self._transition(State.REFLECTING)
                return self._step()
            self.budget.tool_calls += 1
            self._emit("tool.call", {"step": step.id, "tool": step.tool_name, "args": step.tool_args})
            self._transition(State.AWAITING_TOOL)
            self._emit("step.end", {"step_id": step.id, "outcome": "awaiting_tool"})
            self.hooks.fire("after_step", {"step": step, "outcome": "awaiting_tool"})
            return PullRequest(
                reason="tool_call",
                state=self.state,
                payload={"tool": step.tool_name, "args": step.tool_args, "step_id": step.id},
            )
        step.result = f"ok:{step.description}"
        self._emit("step.end", {"step_id": step.id, "outcome": "ok"})
        self.hooks.fire("after_step", {"step": step, "outcome": "ok"})
        self._transition(State.REFLECTING)
        return self._step()

    def _complete(self, reason: str) -> SessionResult:
        self._emit("session.complete", {"reason": reason})
        self.hooks.fire("on_complete", {"reason": reason})
        self._transition(State.DONE)
        self._reason = reason
        return SessionResult(state=self.state, reason=reason, steps=list(self._plan), events=list(self._events))


def _demo() -> None:
    loop = HarnessLoop()
    fired: list[str] = []
    for topic in HOOK_TOPICS:
        loop.hooks.on(topic, lambda payload, t=topic: fired.append(t))

    out = loop.run("release notes を ship する")
    assert isinstance(out, PullRequest) and out.reason == "tool_call"
    out = loop.resume({"result": {"id": 42, "name": "ada"}})
    assert isinstance(out, PullRequest) and out.reason == "tool_call"
    final = loop.resume({"result": "summary text"})
    assert isinstance(final, SessionResult)
    assert final.state == State.DONE
    assert final.reason == "goal_met"

    report = {
        "events": [e.type for e in final.events],
        "hooks_fired": fired,
        "final_state": final.state.value,
        "final_reason": final.reason,
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    _demo()
