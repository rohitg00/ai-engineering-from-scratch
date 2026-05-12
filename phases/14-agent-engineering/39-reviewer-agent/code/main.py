"""Reviewer agent stub with a five-dimension rubric.

Consumes builder artifacts (diff summary, state, feedback, verification verdict)
and emits review_report.json with per-dimension scores and a final verdict.

In production each dimension scorer calls an LLM. Here we keep them
deterministic for the lesson — the structure is what travels.

Run: python3 code/main.py
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

HERE = Path(__file__).parent


@dataclass
class ReviewerInputs:
    task_id: str
    goal: str
    diff_summary: dict[str, list[str]]
    state: dict[str, object]
    feedback: list[dict[str, object]]
    verdict: dict[str, object]


@dataclass
class DimensionScore:
    name: str
    score: int
    note: str


@dataclass
class ReviewReport:
    task_id: str
    total: int
    verdict: str
    dimensions: list[DimensionScore] = field(default_factory=list)


def score_problem_fit(inputs: ReviewerInputs) -> DimensionScore:
    files = inputs.diff_summary.get("touched", [])
    goal = inputs.goal.lower()
    keywords = [w for w in goal.split() if len(w) > 4]
    hits = sum(any(k in f.lower() for f in files) for k in keywords)
    score = min(2, hits)
    return DimensionScore("problem_fit", score, f"keyword hits across touched files: {hits}")


def score_scope_discipline(inputs: ReviewerInputs) -> DimensionScore:
    off = inputs.verdict.get("findings", [])
    block_scope = [f for f in off if f.get("code") == "scope.forbidden"]
    if block_scope:
        return DimensionScore("scope_discipline", 0, "forbidden writes present")
    warn_scope = [f for f in off if f.get("code") == "scope.off_scope"]
    return DimensionScore("scope_discipline", 1 if warn_scope else 2, f"off-scope warnings: {len(warn_scope)}")


def score_assumptions(inputs: ReviewerInputs) -> DimensionScore:
    assumptions = inputs.state.get("assumptions") or []
    if not assumptions:
        return DimensionScore("assumptions", 1, "no assumptions recorded; either work was trivial or undocumented")
    return DimensionScore("assumptions", 2, f"{len(assumptions)} assumptions recorded")


def score_verification(inputs: ReviewerInputs) -> DimensionScore:
    exits = [rec.get("exit_code") for rec in inputs.feedback]
    if any(code is None for code in exits):
        return DimensionScore("verification_quality", 0, "feedback log has missing exit codes")
    if all(code == 0 for code in exits) and exits:
        return DimensionScore("verification_quality", 2, "all feedback exit zero")
    return DimensionScore("verification_quality", 1, "mixed exit codes in feedback")


def score_handoff(inputs: ReviewerInputs) -> DimensionScore:
    if inputs.state.get("active_task_id"):
        return DimensionScore("handoff_readiness", 1, "active task not closed in state")
    if inputs.state.get("next_action"):
        return DimensionScore("handoff_readiness", 2, "next_action set, task closed")
    return DimensionScore("handoff_readiness", 0, "no next_action recorded")


SCORERS = [score_problem_fit, score_scope_discipline, score_assumptions, score_verification, score_handoff]


def review(inputs: ReviewerInputs) -> ReviewReport:
    dims = [fn(inputs) for fn in SCORERS]
    total = sum(d.score for d in dims)
    if total >= 7 and not any(d.score == 0 for d in dims):
        verdict = "pass"
    elif total >= 5:
        verdict = "soft_fail"
    else:
        verdict = "hard_fail"
    return ReviewReport(task_id=inputs.task_id, total=total, verdict=verdict, dimensions=dims)


def main() -> None:
    clean = ReviewerInputs(
        task_id="T-001",
        goal="add input validation to signup",
        diff_summary={"touched": ["app/signup.py", "tests/test_signup.py"]},
        state={
            "active_task_id": None,
            "assumptions": ["users sign up with email + password only"],
            "next_action": "pick next task from board",
        },
        feedback=[{"command": "pytest", "exit_code": 0}],
        verdict={"passed": True, "findings": []},
    )
    wrong = ReviewerInputs(
        task_id="T-002",
        goal="add input validation to signup",
        diff_summary={"touched": ["docs/api.md"]},
        state={"active_task_id": "T-002", "assumptions": [], "next_action": ""},
        feedback=[{"command": "pytest", "exit_code": 0}],
        verdict={"passed": True, "findings": [{"code": "scope.off_scope", "severity": "warn"}]},
    )

    for case in (clean, wrong):
        report = review(case)
        out = HERE / f"review_report_{case.task_id}.json"
        out.write_text(
            json.dumps(
                {"task_id": report.task_id, "total": report.total, "verdict": report.verdict, "dimensions": [asdict(d) for d in report.dimensions]},
                indent=2,
            )
            + "\n"
        )
        print(f"task {report.task_id}: total={report.total}/10 verdict={report.verdict}")
        for d in report.dimensions:
            print(f"  {d.name:22} {d.score}  {d.note}")
        print()


if __name__ == "__main__":
    main()
