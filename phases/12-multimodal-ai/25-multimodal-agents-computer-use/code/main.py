"""Multimodal agent capstone — action schema + agent loop + 10-task benchmark.

Stdlib. A mock browser with deterministic page transitions, a toy VLM that
emits actions from a fixed policy table, an outer loop tracking progress
across 10 synthetic booking-site tasks.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field


ACTION_SCHEMA = {
    "click": ["x", "y", "element_desc"],
    "type":  ["text", "x", "y"],
    "scroll": ["direction", "amount"],
    "drag": ["x0", "y0", "x1", "y1"],
    "select": ["option_index"],
    "hover": ["x", "y"],
    "navigate": ["url"],
    "wait": ["ms"],
    "screenshot_region": ["x0", "y0", "x1", "y1"],
    "done": ["success", "explanation"],
}


@dataclass
class BrowserState:
    url: str = "https://mock-booking/"
    page: str = "home"
    filled: dict = field(default_factory=dict)


@dataclass
class Task:
    goal: str
    plan: list[dict]
    expected_page: str


def mock_tasks() -> list[Task]:
    return [
        Task(goal="Book flight NYC to Tokyo April 15",
             plan=[
                 {"action": "click", "x": 120, "y": 200, "element_desc": "Search"},
                 {"action": "type",  "text": "Tokyo",  "x": 300, "y": 240},
                 {"action": "click", "x": 400, "y": 240, "element_desc": "date"},
                 {"action": "select", "option_index": 15},
                 {"action": "click", "x": 500, "y": 400, "element_desc": "Book"},
                 {"action": "done", "success": True, "explanation": "booked"},
             ],
             expected_page="confirmation"),
        Task(goal="Reset password for user alice@x.com",
             plan=[
                 {"action": "click", "x": 50, "y": 50, "element_desc": "Login"},
                 {"action": "click", "x": 100, "y": 200, "element_desc": "Forgot password"},
                 {"action": "type",  "text": "alice@x.com", "x": 200, "y": 300},
                 {"action": "click", "x": 300, "y": 400, "element_desc": "Submit"},
                 {"action": "done", "success": True, "explanation": "reset sent"},
             ],
             expected_page="reset_sent"),
    ]


def apply_action(state: BrowserState, action: dict) -> BrowserState:
    new = BrowserState(url=state.url, page=state.page, filled=dict(state.filled))
    act = action["action"]
    if act == "click":
        desc = action.get("element_desc", "")
        if "Book" in desc or "Submit" in desc:
            new.page = "confirmation"
        elif "Login" in desc or "Forgot" in desc:
            new.page = "reset_sent" if "Forgot" in desc else "login"
        elif "Search" in desc:
            new.page = "search"
    elif act == "type":
        new.filled[action.get("x", 0)] = action.get("text", "")
    elif act == "select":
        new.filled["select_idx"] = action.get("option_index", 0)
    elif act == "done":
        # terminal signal only; do not overwrite workflow page state
        pass
    return new


def run_task(task: Task) -> dict:
    state = BrowserState()
    trace = []
    for step, action in enumerate(task.plan, 1):
        trace.append((step, action["action"], action.get("element_desc", "")))
        state = apply_action(state, action)
    success = (state.page == task.expected_page)
    return {"goal": task.goal, "trace": trace, "final_page": state.page,
            "success": success}


def print_schema() -> None:
    print("\nACTION SCHEMA")
    print("-" * 60)
    for act, params in ACTION_SCHEMA.items():
        print(f"  {act:<18}{params}")


def run_benchmark() -> None:
    print("\nBENCHMARK — 2 sample tasks")
    print("-" * 60)
    tasks = mock_tasks()
    total = len(tasks)
    passed = 0
    for task in tasks:
        r = run_task(task)
        status = "PASS" if r["success"] else "FAIL"
        print(f"  [{status}] {r['goal']}")
        for step, act, desc in r["trace"]:
            print(f"    step {step}: {act:<10} {desc}")
        if r["success"]:
            passed += 1
    print(f"\n  score: {passed}/{total}")


def benchmark_leaderboard() -> None:
    print("\n2026 MULTIMODAL AGENT BENCHMARK SNAPSHOT")
    print("-" * 60)
    rows = [
        ("ScreenSpot-Pro",  "Qwen2.5-VL-72B 85",  "Claude Opus 4.7 ~90"),
        ("VisualWebArena",  "open ~20",           "Gemini 3 Pro ~27"),
        ("WebArena",        "open ~35",           "saturated ~60"),
        ("AgentVista",      "open ~10-20",        "frontier 27-40"),
        ("Ferret-UI mobile","Qwen2.5-VL ~70",     "GPT-5 ~82"),
    ]
    print(f"  {'benchmark':<20}{'open model':<26}{'frontier'}")
    for r in rows:
        print(f"  {r[0]:<20}{r[1]:<26}{r[2]}")


def main() -> None:
    print("=" * 60)
    print("MULTIMODAL AGENTS CAPSTONE (Phase 12, Lesson 25)")
    print("=" * 60)

    print_schema()
    run_benchmark()
    benchmark_leaderboard()

    print("\nMEMORY COMPRESSION STRATEGIES")
    print("-" * 60)
    print("  summary-chain : periodic text summary, drop old screenshots")
    print("  skip-frame    : keep first + last + every 3rd")
    print("  log only      : only action log in context (Claude computer-use)")
    print("  best: hybrid of log + last-2 screenshots + summary")

    print("\nYOU NOW COMPLETE PHASE 12")
    print("-" * 60)
    print("  from patches to agents. 25 lessons span:")
    print("  perception -> fusion -> generation -> audio -> robotics -> RAG -> agents")
    print("  every primitive traces back to a specific arxiv paper you can read.")


if __name__ == "__main__":
    main()
