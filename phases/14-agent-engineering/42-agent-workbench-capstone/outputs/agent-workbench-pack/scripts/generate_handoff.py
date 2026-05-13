#!/usr/bin/env python3
"""End-of-session handoff packet generator. See Phase 14 · 40."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text())


def _load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(ln) for ln in path.read_text().splitlines() if ln.strip()]


def derive_risks(verdict: dict, state: dict, review: dict) -> list[dict[str, str]]:
    risks: list[dict[str, str]] = []
    for f in verdict.get("findings", []) or []:
        if isinstance(f, dict) and f.get("severity") in ("warn", "block"):
            risks.append({"severity": str(f.get("severity")), "detail": str(f.get("detail"))})
    for blocker in state.get("blockers") or []:
        risks.append({"severity": "warn", "detail": f"open blocker: {blocker}"})
    try:
        total = int(review.get("total", 10))
    except (TypeError, ValueError):
        total = 10
    if total < 7:
        risks.append({"severity": "warn", "detail": f"review total {review.get('total')} below 7"})
    return risks


def generate_handoff(task_id: str, session_id: str | None = None) -> dict[str, object]:
    state = _load_json(ROOT / "agent_state.json", {})
    verdict = _load_json(ROOT / "outputs" / "verification" / f"{task_id}.json", {})
    review = _load_json(ROOT / "outputs" / "review" / f"{task_id}.json", {})
    feedback = _load_jsonl(ROOT / "feedback_record.jsonl")
    diff = _load_json(ROOT / "outputs" / "diff_summary.json", {})

    payload = {
        "session_id": session_id or str(int(time.time())),
        "timestamp": time.time(),
        "task_id": task_id,
        "summary": f"task {task_id}: gate={verdict.get('passed')} review={review.get('verdict')}",
        "changed_files": diff.get("touched", []),
        "commands_run": [str(r.get("command")) for r in feedback],
        "failed_attempts": [
            f"{r.get('command')} -> exit {r.get('exit_code')}"
            for r in feedback if r.get("exit_code") not in (0, None)
        ],
        "open_risks": derive_risks(verdict, state, review),
        "next_action": str(state.get("next_action") or "no next_action recorded; needs human"),
        "verdict_pointer": {
            "verdict": f"outputs/verification/{task_id}.json",
            "review": f"outputs/review/{task_id}.json",
        },
    }
    out = ROOT / "outputs" / "handoff" / payload["session_id"]
    out.mkdir(parents=True, exist_ok=True)
    (out / "handoff.json").write_text(json.dumps(payload, indent=2) + "\n")
    (out / "handoff.md").write_text(_render_markdown(payload))
    return payload


def _render_markdown(p: dict[str, object]) -> str:
    def bullets(items):
        return [f"- {x}" for x in items] or ["- none"]
    lines = [
        f"# Handoff: {p['task_id']}",
        "",
        f"**Summary.** {p['summary']}",
        "",
        "## Changed files",
        *bullets(p["changed_files"]),
        "",
        "## Commands run",
        *bullets(p["commands_run"]),
        "",
        "## Failed attempts",
        *bullets(p["failed_attempts"]),
        "",
        "## Open risks",
        *bullets([f"[{r['severity']}] {r['detail']}" for r in p["open_risks"]]),
        "",
        "## Next action",
        str(p["next_action"]),
        "",
        "## Receipts",
        f"- verdict: `{p['verdict_pointer']['verdict']}`",
        f"- review:  `{p['verdict_pointer']['review']}`",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("task_id")
    ap.add_argument("--session-id", default=None)
    args = ap.parse_args()
    try:
        payload = generate_handoff(args.task_id, args.session_id)
    except Exception as exc:
        print(f"handoff failed: {exc}", file=sys.stderr)
        return 1
    print(f"wrote outputs/handoff/{payload['session_id']}/{{handoff.json,handoff.md}}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
