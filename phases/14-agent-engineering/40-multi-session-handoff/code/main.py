"""workbench artifacts から handoff packet を生成する。

state、verdict、review、feedback (ここでは in-memory stub) を読み、
人間向けの handoff.md と次の agent 向けの handoff.json を書く。

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
        risks.append({"severity": "warn", "detail": f"未解決 blocker: {blocker}"})
    raw_total = snapshot.review.get("total", 10)
    try:
        safe_total = int(raw_total)
    except (TypeError, ValueError):
        safe_total = 10
    if safe_total < 7:
        risks.append({"severity": "warn", "detail": f"review total {raw_total} が 7 未満"})
    return risks


def generate_handoff(snapshot: WorkbenchSnapshot) -> tuple[str, HandoffPayload]:
    next_action = str(snapshot.state.get("next_action") or "next_action の記録なし。人間の確認が必要")
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
        return items or ["- なし"]

    md_lines = [
        f"# Handoff: {payload.task_id}",
        "",
        f"**概要.** {payload.summary}",
        "",
        "## 変更ファイル",
        *_bullets([f"- `{f}`" for f in payload.changed_files]),
        "",
        "## 実行したコマンド",
        *_bullets([f"- `{c}`" for c in payload.commands_run]),
        "",
        "## 失敗した試行",
        *_bullets([f"- {f}" for f in payload.failed_attempts]),
        "",
        "## 未解決リスク",
        *_bullets([f"- [{r['severity']}] {r['detail']}" for r in payload.open_risks]),
        "",
        "## 次のアクション",
        f"{payload.next_action}",
        "",
        "## 証跡",
        f"- verdict: `{payload.verdict_pointer['verdict']}`",
        f"- review:  `{payload.verdict_pointer['review']}`",
    ]
    return "\n".join(md_lines) + "\n", payload


def main() -> None:
    snapshot = WorkbenchSnapshot(
        task_id="T-001",
        state={
            "active_task_id": None,
            "blockers": ["rate-limit window の判断待ち"],
            "next_action": "current diff で PR を開き review を依頼する",
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
