"""Terminal-native coding agent — minimal plan/act/observe loop scaffold.

The hard architectural primitive in a 2026 coding agent is not the model call
or any single tool. It is the plan-act-observe-recover loop with bounded
context, a structured plan state, a sandboxed tool dispatcher, and hook
callbacks at every lifecycle point. This file implements that loop end to end
in stdlib Python. The LLM is stubbed out with a deterministic script so the
loop logic stays observable and testable without network calls.

Run:  python main.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Callable


# ---------------------------------------------------------------------------
# plan state  --  TodoWrite shape, rewritten whole each turn
# ---------------------------------------------------------------------------

@dataclass
class TodoItem:
    id: int
    description: str
    status: str  # "pending" | "in_progress" | "done" | "failed"
    note: str = ""


@dataclass
class PlanState:
    goal: str
    items: list[TodoItem] = field(default_factory=list)

    def summary(self) -> str:
        lines = [f"GOAL: {self.goal}"]
        for it in self.items:
            mark = {"pending": " ", "in_progress": ">", "done": "x", "failed": "!"}[it.status]
            lines.append(f"  [{mark}] {it.id}. {it.description}")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# budget  --  hard ceilings on turns, tokens, dollars
# ---------------------------------------------------------------------------

@dataclass
class Budget:
    max_turns: int = 50
    max_tokens: int = 200_000
    max_dollars: float = 5.00
    turns_used: int = 0
    tokens_used: int = 0
    dollars_used: float = 0.0

    def step(self, tokens: int, dollars: float) -> None:
        self.turns_used += 1
        self.tokens_used += tokens
        self.dollars_used += dollars

    def exceeded(self) -> str | None:
        if self.turns_used >= self.max_turns:
            return "turn_limit"
        if self.tokens_used >= self.max_tokens:
            return "token_limit"
        if self.dollars_used >= self.max_dollars:
            return "dollar_limit"
        return None


# ---------------------------------------------------------------------------
# hooks  --  2026 eight-event surface (Pre/PostToolUse, SessionStart/End, etc)
# ---------------------------------------------------------------------------

HookFn = Callable[[dict[str, Any]], dict[str, Any]]


class HookBus:
    EVENTS = ("SessionStart", "SessionEnd", "PreToolUse", "PostToolUse",
              "UserPromptSubmit", "Notification", "Stop", "PreCompact")

    def __init__(self) -> None:
        self._hooks: dict[str, list[HookFn]] = {e: [] for e in self.EVENTS}

    def on(self, event: str, fn: HookFn) -> None:
        self._hooks[event].append(fn)

    def fire(self, event: str, payload: dict[str, Any]) -> dict[str, Any]:
        for fn in self._hooks[event]:
            payload = fn(payload) or payload
        return payload


# ---------------------------------------------------------------------------
# tool surface  --  six tools, each sandboxed, each returns truncated text
# ---------------------------------------------------------------------------

TRUNCATE_BYTES = 4096


def tool_read_file(sandbox: str, path: str) -> str:
    full = os.path.join(sandbox, path)
    if not os.path.realpath(full).startswith(os.path.realpath(sandbox)):
        raise RuntimeError("path escapes sandbox")
    with open(full, "r", encoding="utf-8", errors="replace") as fh:
        return fh.read()[:TRUNCATE_BYTES]


def tool_run_shell(sandbox: str, cmd: str, timeout: int = 30) -> str:
    proc = subprocess.run(cmd, cwd=sandbox, shell=True, capture_output=True,
                          text=True, timeout=timeout)
    out = (proc.stdout + proc.stderr)[:TRUNCATE_BYTES]
    return f"exit={proc.returncode}\n{out}"


TOOLS: dict[str, Callable[..., str]] = {
    "read_file": tool_read_file,
    "run_shell": tool_run_shell,
}


# ---------------------------------------------------------------------------
# stub model  --  deterministic script so loop is testable without LLM
# ---------------------------------------------------------------------------

SCRIPT = [
    {"plan": [("locate target file", "in_progress"),
              ("read and diagnose", "pending"),
              ("apply fix and verify", "pending")],
     "tool": ("run_shell", {"cmd": "ls"}),
     "tokens": 1200, "cost": 0.02},
    {"plan": [("locate target file", "done"),
              ("read and diagnose", "in_progress"),
              ("apply fix and verify", "pending")],
     "tool": ("read_file", {"path": "README.md"}),
     "tokens": 900, "cost": 0.02},
    {"plan": [("locate target file", "done"),
              ("read and diagnose", "done"),
              ("apply fix and verify", "done")],
     "tool": None,  # terminal turn
     "tokens": 600, "cost": 0.01},
]


def model_step(plan: PlanState, turn: int) -> dict[str, Any]:
    """Stubbed model: returns a plan rewrite and (optionally) a tool call."""
    if turn >= len(SCRIPT):
        return {"plan": plan.items, "tool": None, "tokens": 200, "cost": 0.005}
    s = SCRIPT[turn]
    items = [TodoItem(i + 1, desc, status) for i, (desc, status) in enumerate(s["plan"])]
    return {"plan": items, "tool": s["tool"], "tokens": s["tokens"], "cost": s["cost"]}


# ---------------------------------------------------------------------------
# main loop  --  plan / act / observe / recover with full hook integration
# ---------------------------------------------------------------------------

def destructive_guard(payload: dict[str, Any]) -> dict[str, Any]:
    cmd = payload.get("args", {}).get("cmd", "")
    if "rm -rf" in cmd or "shutdown" in cmd:
        payload["blocked"] = True
        payload["reason"] = "destructive command blocked by PreToolUse hook"
    return payload


def run_agent(task: str, sandbox: str) -> dict[str, Any]:
    plan = PlanState(goal=task, items=[])
    budget = Budget()
    hooks = HookBus()
    trace: list[dict[str, Any]] = []

    hooks.on("PreToolUse", destructive_guard)
    hooks.on("PostToolUse", lambda p: (trace.append({"event": "tool", **p}), p)[1])
    hooks.on("SessionStart", lambda p: (trace.append({"event": "start", **p}), p)[1])
    hooks.on("SessionEnd", lambda p: (trace.append({"event": "end", **p}), p)[1])

    hooks.fire("SessionStart", {"task": task, "sandbox": sandbox,
                                "started_at": time.time()})

    turn = 0
    while True:
        stop = budget.exceeded()
        if stop:
            hooks.fire("Stop", {"reason": stop, "turn": turn})
            break

        step = model_step(plan, turn)
        plan.items = step["plan"]
        budget.step(step["tokens"], step["cost"])

        call = step["tool"]
        if call is None:
            hooks.fire("Stop", {"reason": "complete", "turn": turn})
            break

        name, args = call
        pre = hooks.fire("PreToolUse", {"tool": name, "args": args})
        if pre.get("blocked"):
            hooks.fire("PostToolUse", {"tool": name, "blocked": True,
                                       "reason": pre.get("reason", "")})
            turn += 1
            continue

        try:
            result = TOOLS[name](sandbox, **args)
            hooks.fire("PostToolUse", {"tool": name, "ok": True,
                                       "bytes": len(result)})
        except Exception as exc:
            hooks.fire("PostToolUse", {"tool": name, "ok": False,
                                       "error": str(exc)})

        turn += 1

    hooks.fire("SessionEnd", {"turns": budget.turns_used,
                              "tokens": budget.tokens_used,
                              "dollars": budget.dollars_used})

    return {"plan": plan.summary(), "budget": asdict(budget), "trace": trace}


def main() -> None:
    task = "demonstrate the plan-act-observe loop without network calls"
    sandbox = os.path.dirname(os.path.abspath(__file__))
    result = run_agent(task, sandbox)
    print(result["plan"])
    print("---")
    print(f"turns={result['budget']['turns_used']} "
          f"tokens={result['budget']['tokens_used']} "
          f"dollars=${result['budget']['dollars_used']:.3f}")
    print("---")
    print(f"trace events: {len(result['trace'])}")
    for ev in result["trace"]:
        print(" ", json.dumps(ev, default=str))


if __name__ == "__main__":
    main()
