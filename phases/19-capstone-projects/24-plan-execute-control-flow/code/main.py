"""failure 時の replan、plan diff、dual budget を備えた plan-and-execute agent。

Conceptual references:
- ./docs/en.md (this lesson)
- Phase 14 lesson 01 (agent loop fundamentals)
- Phase 13 lesson 02 (tool protocols overview)

stdlib のみ。実行: python3 code/main.py
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Step:
    id: int
    tool_name: str
    args: dict
    expected_outcome: str
    result: Any | None = None
    error: str | None = None

    def signature(self) -> tuple:
        return (self.tool_name, json.dumps(self.args, sort_keys=True))


@dataclass
class PlanDiff:
    revision: int
    removed: list[int]
    added: list[int]
    revised: list[int]

    def to_dict(self) -> dict:
        return {
            "revision": self.revision,
            "removed": list(self.removed),
            "added": list(self.added),
            "revised": list(self.revised),
        }


@dataclass
class Event:
    type: str
    payload: dict
    ts: float = field(default_factory=time.time)


@dataclass
class SessionResult:
    status: str
    reason: str
    history: list[Step]
    revisions: list[PlanDiff]
    events: list[Event]

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "reason": self.reason,
            "history": [
                {"id": s.id, "tool": s.tool_name, "args": s.args,
                 "result": s.result, "error": s.error}
                for s in self.history
            ],
            "revisions": [r.to_dict() for r in self.revisions],
            "events": [{"type": e.type, "payload": e.payload, "ts": e.ts} for e in self.events],
        }


Planner = Callable[[str, list[Step], str | None], list[Step]]
ToolExecutor = Callable[[str, dict], Any]


class ToolFailure(Exception):
    pass


def _diff_plans(old: list[Step], new: list[Step], revision: int) -> PlanDiff:
    old_ids = {s.id for s in old}
    new_ids = {s.id for s in new}
    removed = sorted(old_ids - new_ids)
    added = sorted(new_ids - old_ids)
    revised: list[int] = []
    old_by_id = {s.id: s for s in old}
    for s in new:
        if s.id in old_ids and old_by_id[s.id].signature() != s.signature():
            revised.append(s.id)
    return PlanDiff(revision=revision, removed=removed, added=added, revised=revised)


class PlanExecuteAgent:
    """failure 時に replan する sequential plan executor。"""

    def __init__(
        self,
        planner: Planner,
        executor: ToolExecutor,
        *,
        max_steps: int = 12,
        max_replans: int = 5,
    ) -> None:
        self._planner = planner
        self._executor = executor
        self.max_steps = max_steps
        self.max_replans = max_replans
        self._events: list[Event] = []

    def _emit(self, etype: str, payload: dict) -> None:
        self._events.append(Event(type=etype, payload=payload))

    def run(self, goal: str) -> SessionResult:
        self._events = []
        history: list[Step] = []
        revisions: list[PlanDiff] = []
        steps_taken = 0
        replans_used = 0
        last_error: str | None = None

        plan = self._planner(goal, history, None)
        self._emit("plan.commit", {"revision": 0, "steps": _summarize(plan)})

        if not plan:
            self._emit("session.complete", {"reason": "no_plan"})
            return SessionResult(
                status="failed", reason="no_plan",
                history=history, revisions=revisions, events=list(self._events),
            )

        cursor = 0
        revision = 0

        while cursor < len(plan):
            if steps_taken >= self.max_steps:
                self._emit("session.complete", {"reason": "step_budget"})
                return SessionResult(
                    status="failed", reason="step_budget",
                    history=history, revisions=revisions, events=list(self._events),
                )

            step = plan[cursor]
            self._emit("step.start", {"step_id": step.id, "tool": step.tool_name})
            try:
                step.result = self._executor(step.tool_name, step.args)
                self._emit("step.end", {"step_id": step.id, "outcome": "ok"})
                history.append(step)
                cursor += 1
                steps_taken += 1
                continue
            except Exception as exc:
                step.error = f"{type(exc).__name__}: {exc}"
                self._emit("step.end", {"step_id": step.id, "outcome": "error", "error": step.error})
                history.append(step)
                steps_taken += 1
                last_error = step.error

            if replans_used >= self.max_replans:
                self._emit("session.complete", {"reason": "replan_budget"})
                return SessionResult(
                    status="failed", reason="replan_budget",
                    history=history, revisions=revisions, events=list(self._events),
                )

            replans_used += 1
            revision += 1
            new_plan = self._planner(goal, history, last_error)
            self._emit("plan.draft", {"revision": revision, "steps": _summarize(new_plan)})
            if not new_plan:
                self._emit("session.complete", {"reason": "no_plan"})
                return SessionResult(
                    status="failed", reason="no_plan",
                    history=history, revisions=revisions, events=list(self._events),
                )
            diff = _diff_plans(plan[cursor:], new_plan, revision)
            revisions.append(diff)
            self._emit("plan.diff", diff.to_dict())
            plan = new_plan
            cursor = 0
            self._emit("plan.commit", {"revision": revision, "steps": _summarize(plan)})

        self._emit("session.complete", {"reason": "goal_met"})
        return SessionResult(
            status="completed", reason="goal_met",
            history=history, revisions=revisions, events=list(self._events),
        )


def _summarize(plan: list[Step]) -> list[dict]:
    return [{"id": s.id, "tool": s.tool_name, "outcome": s.expected_outcome} for s in plan]


def make_deterministic_planner(fail_step_id: int | None, recovery: str = "route_around") -> Planner:
    """demo と test で使う planner。

    ``fail_step_id`` が与えられると、planner は initial plan のその step の args に
    ``_force_fail`` marker を入れる。その marker を尊重する executor はその step で
    raise し、replan path を exercise する。revised plan では marker を外すので
    route-around が成功できる。
    """

    def planner(goal: str, history: list[Step], last_error: str | None) -> list[Step]:
        if last_error is None:
            initial = [
                Step(1, "fetch", {"key": "input"}, "user input を読み込んだ"),
                Step(2, "transform", {"mode": "v1"}, "v1 形式を計算した"),
                Step(3, "render", {}, "output を render した"),
                Step(4, "submit", {}, "backend に submit した"),
            ]
            if fail_step_id is not None:
                for s in initial:
                    if s.id == fail_step_id:
                        s.args = {**s.args, "_force_fail": True}
            return initial
        if recovery == "route_around" and "transform" in last_error:
            return [
                Step(2, "transform", {"mode": "v2"}, "fallback で計算した"),
                Step(3, "render", {}, "output を render した"),
                Step(4, "submit", {}, "backend に submit した"),
            ]
        if recovery == "give_up":
            return [
                Step(98, "log_failure", {"why": last_error or ""}, "failure を log した"),
                Step(99, "notify_user", {}, "user に伝えた"),
            ]
        return []

    return planner


def _demo() -> None:
    counters = {"transform_v1_calls": 0}

    def executor(tool: str, args: dict) -> Any:
        if args.get("_force_fail"):
            counters["transform_v1_calls"] += 1
            raise ToolFailure(f"{tool} は marker により failure")
        if tool == "fetch":
            return {"k": "v"}
        if tool == "transform":
            if args.get("mode") == "v1":
                counters["transform_v1_calls"] += 1
                raise ToolFailure("transform v1 backend が down")
            return {"ok": True}
        if tool == "render":
            return "html"
        if tool == "submit":
            return {"id": 1}
        if tool in ("log_failure", "notify_user"):
            return "logged"
        raise ToolFailure(f"未知の tool {tool}")

    agent = PlanExecuteAgent(
        planner=make_deterministic_planner(fail_step_id=2, recovery="route_around"),
        executor=executor,
        max_steps=12, max_replans=5,
    )
    res = agent.run("report を出荷する")
    print(json.dumps({
        "status": res.status,
        "reason": res.reason,
        "history": [(s.id, s.tool_name, bool(s.error)) for s in res.history],
        "revisions": [r.to_dict() for r in res.revisions],
        "events": [e.type for e in res.events],
        "transform_v1_calls": counters["transform_v1_calls"],
    }, indent=2))


if __name__ == "__main__":
    _demo()
