"""ターミナルネイティブ Coding Agent の最小 plan/act/observe loop scaffold。

2026年の coding agent で難しい architectural primitive は model call や
単体の tool ではありません。bounded context、structured plan state、
sandboxed tool dispatcher、各 lifecycle point の hook callback を備えた
plan-act-observe-recover loop です。このファイルはその loop を stdlib Python
だけで end to end に実装します。LLM は deterministic script で stub し、
network call なしでも loop logic を観測・test できるようにしています。

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
# plan state  --  TodoWrite 形状。毎 turn 全体を書き換える
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
        lines = [f"目標: {self.goal}"]
        for it in self.items:
            mark = {"pending": " ", "in_progress": ">", "done": "x", "failed": "!"}[it.status]
            lines.append(f"  [{mark}] {it.id}. {it.description}")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# budget  --  turns, tokens, dollars の hard ceiling
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
# hooks  --  2026年版の8 event surface (Pre/PostToolUse, SessionStart/End など)
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
# tool surface  --  各 tool は sandbox 化され、truncated text を返す
# ---------------------------------------------------------------------------

TRUNCATE_BYTES = 4096


def tool_read_file(sandbox: str, path: str) -> str:
    full = os.path.join(sandbox, path)
    if not os.path.realpath(full).startswith(os.path.realpath(sandbox)):
        raise RuntimeError("path が sandbox 外へ出ています")
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
# stub model  --  LLM なしで loop を test できる deterministic script
# ---------------------------------------------------------------------------

SCRIPT = [
    {"plan": [("対象ファイルを探す", "in_progress"),
              ("読み取って診断する", "pending"),
              ("修正を適用して検証する", "pending")],
     "tool": ("run_shell", {"cmd": "ls"}),
     "tokens": 1200, "cost": 0.02},
    {"plan": [("対象ファイルを探す", "done"),
              ("読み取って診断する", "in_progress"),
              ("修正を適用して検証する", "pending")],
     "tool": ("read_file", {"path": "README.md"}),
     "tokens": 900, "cost": 0.02},
    {"plan": [("対象ファイルを探す", "done"),
              ("読み取って診断する", "done"),
              ("修正を適用して検証する", "done")],
     "tool": None,  # 終了 turn
     "tokens": 600, "cost": 0.01},
]


def model_step(plan: PlanState, turn: int) -> dict[str, Any]:
    """stub model: plan rewrite と必要なら tool call を返す。"""
    if turn >= len(SCRIPT):
        return {"plan": plan.items, "tool": None, "tokens": 200, "cost": 0.005}
    s = SCRIPT[turn]
    items = [TodoItem(i + 1, desc, status) for i, (desc, status) in enumerate(s["plan"])]
    return {"plan": items, "tool": s["tool"], "tokens": s["tokens"], "cost": s["cost"]}


# ---------------------------------------------------------------------------
# main loop  --  hook 統合付き plan / act / observe / recover
# ---------------------------------------------------------------------------

def destructive_guard(payload: dict[str, Any]) -> dict[str, Any]:
    cmd = payload.get("args", {}).get("cmd", "")
    if "rm -rf" in cmd or "shutdown" in cmd:
        payload["blocked"] = True
        payload["reason"] = "破壊的なコマンドは PreToolUse hook でブロックされました"
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
    task = "network call なしで plan-act-observe loop をデモする"
    sandbox = os.path.dirname(os.path.abspath(__file__))
    result = run_agent(task, sandbox)
    print(result["plan"])
    print("---")
    print(f"turns={result['budget']['turns_used']} "
          f"tokens={result['budget']['tokens_used']} "
          f"dollars=${result['budget']['dollars_used']:.3f}")
    print("---")
    print(f"trace event 数: {len(result['trace'])}")
    for ev in result["trace"]:
        print(" ", json.dumps(ev, default=str))


if __name__ == "__main__":
    main()
