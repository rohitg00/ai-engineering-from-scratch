"""Toy SWE-bench-style harness plus a GAIA-style difficulty classifier.

SWE-bench: bug-fix tasks with FAIL_TO_PASS and PASS_TO_PASS gates.
GAIA: simple-for-humans, hard-for-AI questions scored by decomposition depth.
Both are synthetic; the point is to make the evaluator rules concrete.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Task:
    tid: str
    description: str
    state_before: dict[str, int]
    patch: Callable[[dict[str, int]], dict[str, int]]
    fail_to_pass: list[tuple[str, Callable[[dict[str, int]], bool]]]
    pass_to_pass: list[tuple[str, Callable[[dict[str, int]], bool]]]


@dataclass
class TaskResult:
    tid: str
    ftp_passed: int
    ftp_total: int
    ptp_passed: int
    ptp_total: int
    resolved: bool


def run_task(task: Task) -> TaskResult:
    state = dict(task.state_before)
    ftp_pre = sum(1 for _, check in task.fail_to_pass if check(state))
    ptp_pre = sum(1 for _, check in task.pass_to_pass if check(state))

    new_state = task.patch(dict(state))

    ftp_post = sum(1 for _, check in task.fail_to_pass if check(new_state))
    ptp_post = sum(1 for _, check in task.pass_to_pass if check(new_state))

    ftp_fixed = ftp_post - ftp_pre
    ptp_broke = ptp_pre - ptp_post
    resolved = (ftp_post == len(task.fail_to_pass)) and (ptp_broke == 0)

    return TaskResult(
        tid=task.tid,
        ftp_passed=ftp_post, ftp_total=len(task.fail_to_pass),
        ptp_passed=ptp_post, ptp_total=len(task.pass_to_pass),
        resolved=resolved,
    )


def gaia_level(question: str) -> int:
    steps = sum(1 for w in question.lower().split()
                if w in {"then", "after", "finally", "next", "and"}) + 1
    modalities = sum(word in question.lower() for word in
                     ("image", "video", "audio", "pdf", "chart", "graph"))
    tools = sum(word in question.lower() for word in
                ("search", "look up", "find", "visit", "extract"))
    score = steps + modalities + tools
    if score <= 2:
        return 1
    if score <= 5:
        return 2
    return 3


def swe_demo() -> None:
    print("-" * 70)
    print("SWE-bench-style harness (FAIL_TO_PASS + PASS_TO_PASS)")
    print("-" * 70)

    tasks = [
        Task(
            tid="t001",
            description="fix off-by-one in counter",
            state_before={"counter": 0, "multiplier": 2},
            patch=lambda s: {**s, "counter": s["counter"] + 1},
            fail_to_pass=[("counter > 0", lambda s: s["counter"] > 0)],
            pass_to_pass=[("multiplier unchanged", lambda s: s["multiplier"] == 2)],
        ),
        Task(
            tid="t002",
            description="fix multiplier regression",
            state_before={"counter": 1, "multiplier": 0},
            patch=lambda s: {**s, "multiplier": 2},
            fail_to_pass=[("multiplier > 0", lambda s: s["multiplier"] > 0)],
            pass_to_pass=[("counter unchanged", lambda s: s["counter"] == 1)],
        ),
        Task(
            tid="t003",
            description="agent overreaches and breaks a passing test",
            state_before={"counter": 1, "multiplier": 2, "flag": True},
            patch=lambda s: {**s, "counter": 2, "flag": False},
            fail_to_pass=[("counter > 1", lambda s: s["counter"] > 1)],
            pass_to_pass=[("flag stays true", lambda s: s["flag"]),
                          ("multiplier unchanged", lambda s: s["multiplier"] == 2)],
        ),
    ]

    resolved_count = 0
    for task in tasks:
        result = run_task(task)
        print(f"  {result.tid}: {task.description}")
        print(f"    FAIL_TO_PASS: {result.ftp_passed}/{result.ftp_total}")
        print(f"    PASS_TO_PASS: {result.ptp_passed}/{result.ptp_total}")
        print(f"    resolved:     {result.resolved}")
        if result.resolved:
            resolved_count += 1
    print(f"\nresolution rate: {resolved_count}/{len(tasks)}")


def gaia_demo() -> None:
    print("\n" + "-" * 70)
    print("GAIA-style difficulty classifier")
    print("-" * 70)
    questions = [
        "What is the capital of France?",
        "Search for the Wikipedia article on ReAct and extract the first author.",
        "Visit the arXiv listing for ReAct, find the GitHub linked in the PDF, "
        "then count the open issues with label 'bug' and return the ratio "
        "of bugs to total issues as a decimal.",
    ]
    for q in questions:
        level = gaia_level(q)
        print(f"  [Level {level}] {q[:70]}")


def main() -> None:
    print("=" * 70)
    print("BENCHMARKS: SWE-bench, GAIA — Phase 14, Lesson 19")
    print("=" * 70)
    swe_demo()
    gaia_demo()
    print()
    print("SWE-bench: patch-based, unit-test-gated. Verified removes ambiguity.")
    print("GAIA: depth + modalities + tools -> difficulty level.")
    print("report both your benchmark score AND the Verified/+-audited score.")


if __name__ == "__main__":
    main()
