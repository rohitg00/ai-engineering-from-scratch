"""Generate a handoff packet from workbench artifacts.

Reads state, verdict, review, and feedback (here stubbed in-memory),
writes handoff.md for humans and handoff.json for the next agent.

Run: python3 code/main.py
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

HERE = Path(__file__).parent
TAIL_K = 5


@dataclass
class WorkbenchSnapshot:
    task_id: str
    state: dict[str, object]
    verdict: dict[str, object]
    review: dict[str, object]
    feedback: list[dict[str, object]]
    diff_summary: dict[str, list[str]]


@dataclass
class HandoffPayload:
    task_id: str
    summary: str
    changed_files: list[str]
    commands_run: list[str]
    failed_attempts: list[str]
    open_risks: list[dict[str, str]]
    next_action: str
    verdict_pointer: dict[str, str]
    feedback_tail: list[dict[str, object]] = field(default_factory=list)


def trim_feedback(records: list[dict[str, object]]) -> list[dict[str, object]]:
    tail = records[-TAIL_K:]
    nonzero = [r for r in records if r.get("exit_code") not in (0, None)]
    out: list[dict[str, object]] = []
    seen: set[int] = set()
    for r in tail + nonzero:
        key = id(r)
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def derive_risks(snapshot: WorkbenchSnapshot) -> list[dict[str, str]]:
    risks: list[dict[str, str]] = []
    for f in snapshot.verdict.get("findings", []) or []:
        if isinstance(f, dict) and f.get("severity") in ("warn", "block"):
            risks.append({"severity": str(f.get("severity")), "detail": str(f.get("detail"))})
    for blocker in snapshot.state.get("blockers") or []:
        risks.append({"severity": "warn", "detail": f"open blocker: {blocker}"})
    raw_total = snapshot.review.get("total", 10)
    try:
        safe_total = int(raw_total)
    except (TypeError, ValueError):
        safe_total = 10
    if safe_total < 7:
        risks.append({"severity": "warn", "detail": f"review total {raw_total} below 7"})
    return risks


def generate_handoff(snapshot: WorkbenchSnapshot) -> tuple[str, HandoffPayload]:
    next_action = str(snapshot.state.get("next_action") or "no next_action recorded; needs human")
    payload = HandoffPayload(
        task_id=snapshot.task_id,
        summary=f"task {snapshot.task_id}: review={snapshot.review.get('verdict')}, gate={snapshot.verdict.get('passed')}",
        changed_files=snapshot.diff_summary.get("touched", []),
        commands_run=[str(r.get("command")) for r in snapshot.feedback],
        failed_attempts=[
            f"{r.get('command')} -> exit {r.get('exit_code')}"
            for r in snapshot.feedback
            if r.get("exit_code") not in (0, None)
        ],
        open_risks=derive_risks(snapshot),
        next_action=next_action,
        verdict_pointer={
            "verdict": f"outputs/verification/{snapshot.task_id}.json",
            "review": f"outputs/review/{snapshot.task_id}.json",
        },
        feedback_tail=trim_feedback(snapshot.feedback),
    )

    def _bullets(items: list[str]) -> list[str]:
        return items or ["- none"]

    md_lines = [
        f"# Handoff: {payload.task_id}",
        "",
        f"**Summary.** {payload.summary}",
        "",
        "## Changed files",
        *_bullets([f"- `{f}`" for f in payload.changed_files]),
        "",
        "## Commands run",
        *_bullets([f"- `{c}`" for c in payload.commands_run]),
        "",
        "## Failed attempts",
        *_bullets([f"- {f}" for f in payload.failed_attempts]),
        "",
        "## Open risks",
        *_bullets([f"- [{r['severity']}] {r['detail']}" for r in payload.open_risks]),
        "",
        "## Next action",
        f"{payload.next_action}",
        "",
        "## Receipts",
        f"- verdict: `{payload.verdict_pointer['verdict']}`",
        f"- review:  `{payload.verdict_pointer['review']}`",
    ]
    return "\n".join(md_lines) + "\n", payload


def main() -> None:
    snapshot = WorkbenchSnapshot(
        task_id="T-001",
        state={
            "active_task_id": None,
            "blockers": ["awaiting decision on rate-limit window"],
            "next_action": "open PR with current diff and request review",
        },
        verdict={"passed": True, "findings": [{"severity": "warn", "detail": "off-scope: README.md"}]},
        review={"verdict": "pass", "total": 8},
        feedback=[
            {"command": "pytest", "exit_code": 0},
            {"command": "ruff check .", "exit_code": 0},
            {"command": "pytest test_signup.py", "exit_code": 1},
            {"command": "pytest test_signup.py", "exit_code": 0},
        ],
        diff_summary={"touched": ["app/signup.py", "tests/test_signup.py", "README.md"]},
    )

    md, payload = generate_handoff(snapshot)
    (HERE / "handoff.md").write_text(md)
    (HERE / "handoff.json").write_text(json.dumps(asdict(payload), indent=2) + "\n")
    print(md)


if __name__ == "__main__":
    main()
