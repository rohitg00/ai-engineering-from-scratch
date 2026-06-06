"""Assemble the capstone agent-workbench-pack into outputs/.

Seeds schemas, scripts, and docs from the surfaces built in the
preceding lessons of this mini-track. Idempotent. Prints the tree.

Run: python3 code/main.py
"""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).parent
PACK = HERE.parent / "outputs" / "agent-workbench-pack"

PACK_VERSION = "1.0.0"


AGENTS_MD = """# AGENTS.md

You are working inside a repository that runs with an agent workbench.

Read these before acting:

1. `agent_state.json` — where the last session stopped.
2. `task_board.json` — what is in flight, what is next.
3. `docs/agent-rules.md` — startup, forbidden, done, uncertainty, approval.
4. `docs/reliability-policy.md` — failure modes this workbench is designed to absorb.
5. `docs/handoff-protocol.md` — what session end must produce.
6. `docs/reviewer-rubric.md` — how completed work is judged.

Verification command: see `acceptance_criteria` in the active task on the board.

Pack version: {version}
""".lstrip()


AGENT_RULES_MD = """# Agent Rules

## startup/state-file-fresh
- category: startup
- check: state_file_fresh
Agent must read agent_state.json before any tool call.

## forbidden/no-out-of-scope-writes
- category: forbidden
- check: no_out_of_scope_writes
Never edit a file outside the active task's scope contract.

## done/tests-pass
- category: definition_of_done
- check: tests_pass
A task is done only when every acceptance command exits zero.

## uncertainty/open-question-note
- category: uncertainty
- check: opened_question_when_unsure
When confidence is below threshold, open a question note instead of guessing.

## approval/new-dependency
- category: approval
- check: new_dependency_approved
Adding a runtime dependency requires explicit human approval.
"""


RELIABILITY_POLICY_MD = """# Reliability Policy

The workbench absorbs the five industry-recurring failure modes:

1. Hallucinated action — caught by the rule set + verification gate.
2. Scope creep — caught by the scope contract diff check.
3. Cascading errors — caught by feedback records + refuse-on-null-exit.
4. Context loss — absorbed by repo memory; chat is not the source of truth.
5. Tool misuse — caught by the reviewer rubric's verification dimension.

The policy is enforced by the verification gate. The override path is signed
and audited; agents cannot self-override.
"""


HANDOFF_PROTOCOL_MD = """# Handoff Protocol

Every session ends with a handoff packet containing:

- summary
- changed_files
- commands_run
- failed_attempts
- open_risks (severity + detail)
- next_action (one concrete step)
- verdict_pointer (paths to verification + review reports)

The packet ships as both handoff.md (humans) and handoff.json (next agent).
Missing fields halt the session-end hook.
"""


REVIEWER_RUBRIC_MD = """# Reviewer Rubric

Five dimensions, scored 0 to 2.

1. Problem fit — did the change solve the task as stated?
2. Scope discipline — were edits confined to the contract?
3. Assumptions — are hidden assumptions written down?
4. Verification quality — does acceptance actually prove the goal?
5. Handoff readiness — can the next session pick up cleanly?

Total >= 7 with no zeros: pass. Total 5-6: soft fail. Below 5 or any zero: hard fail.
"""


STATE_SCHEMA = {
    "$id": "agent_state.schema.json",
    "type": "object",
    "required": ["schema_version", "active_task_id", "touched_files", "next_action"],
    "properties": {
        "schema_version": {"type": "integer", "enum": [1]},
        "active_task_id": {"type": ["string", "null"]},
        "touched_files": {"type": "array", "items": {"type": "string"}},
        "assumptions": {"type": "array", "items": {"type": "string"}},
        "blockers": {"type": "array", "items": {"type": "string"}},
        "next_action": {"type": "string"},
    },
}

BOARD_SCHEMA = {
    "$id": "task_board.schema.json",
    "type": "array",
    "items": {
        "type": "object",
        "required": ["id", "goal", "owner", "acceptance", "status"],
        "properties": {
            "id": {"type": "string", "pattern": r"^T-\d{3,}$"},
            "goal": {"type": "string"},
            "owner": {"type": "string", "enum": ["builder", "reviewer", "human"]},
            "acceptance": {"type": "array", "items": {"type": "string"}, "minItems": 1},
            "status": {"type": "string", "enum": ["todo", "in_progress", "done", "blocked"]},
        },
    },
}

SCOPE_SCHEMA = {
    "$id": "scope_contract.schema.json",
    "type": "object",
    "required": ["task_id", "goal", "allowed_files", "forbidden_files", "acceptance_criteria", "rollback_plan"],
    "properties": {
        "task_id": {"type": "string"},
        "goal": {"type": "string"},
        "allowed_files": {"type": "array", "items": {"type": "string"}},
        "forbidden_files": {"type": "array", "items": {"type": "string"}},
        "acceptance_criteria": {"type": "array", "items": {"type": "string"}},
        "rollback_plan": {"type": "string"},
        "approvals_required": {"type": "array", "items": {"type": "string"}},
    },
}


INSTALL_SH = """#!/usr/bin/env bash
set -euo pipefail

# Install the agent workbench pack into the current repo.
# Usage: bin/install.sh [--force]

FORCE="${1:-}"
TARGET="$(pwd)"
PACK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

required=("AGENTS.md" "VERSION" "docs" "schemas" "scripts")
for path in "${required[@]}"; do
    if [[ ! -e "$PACK_ROOT/$path" ]]; then
        echo "missing pack source: $PACK_ROOT/$path" >&2
        exit 1
    fi
done

if [[ -e "$TARGET/AGENTS.md" && "$FORCE" != "--force" ]]; then
    echo "AGENTS.md already exists. Pass --force to overwrite." >&2
    exit 1
fi

cp "$PACK_ROOT/AGENTS.md" "$TARGET/AGENTS.md"
mkdir -p "$TARGET/docs" "$TARGET/schemas" "$TARGET/scripts"
cp -r "$PACK_ROOT/docs/." "$TARGET/docs/"
cp -r "$PACK_ROOT/schemas/." "$TARGET/schemas/"
cp -r "$PACK_ROOT/scripts/." "$TARGET/scripts/"
cat "$PACK_ROOT/VERSION" > "$TARGET/.workbench-version"

echo "pack installed at version $(cat "$PACK_ROOT/VERSION")"
echo "next: edit task_board.json, set acceptance commands, run scripts/init_agent.py"
"""


INIT_AGENT_PY = '''#!/usr/bin/env python3
"""Workbench init script. See Phase 14 · 35 for the from-scratch build."""

from __future__ import annotations

import importlib.util
import json
import os
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORT_PATH = ROOT / "init_report.json"
STATE_PATH = ROOT / "agent_state.json"
REQUIRED_PYTHON = (3, 10)
REQUIRED_DEPS: list[str] = []
TEST_COMMAND = os.environ.get("WORKBENCH_TEST_COMMAND", "python3")
REQUIRED_ENV: list[str] = []
FRESH_SECONDS = 24 * 60 * 60


def _probe_runtime() -> tuple[str, str, str]:
    major, minor = sys.version_info[:2]
    ok = (major, minor) >= REQUIRED_PYTHON
    return ("runtime", "pass" if ok else "fail", f"python {major}.{minor}")


def _probe_deps() -> tuple[str, str, str]:
    missing = [d for d in REQUIRED_DEPS if importlib.util.find_spec(d) is None]
    return ("dependencies", "fail" if missing else "pass", f"missing: {missing}" if missing else "all importable")


def _probe_test_command() -> tuple[str, str, str]:
    return ("test_command", "pass" if shutil.which(TEST_COMMAND) else "fail", f"{TEST_COMMAND} on PATH")


def _probe_env() -> tuple[str, str, str]:
    missing = [k for k in REQUIRED_ENV if not os.environ.get(k)]
    return ("env", "fail" if missing else "pass", f"missing: {missing}" if missing else "all present")


def _probe_state() -> tuple[str, str, str]:
    if not STATE_PATH.exists():
        return ("state_freshness", "warn", "no state file yet")
    age = time.time() - STATE_PATH.stat().st_mtime
    if age > FRESH_SECONDS:
        return ("state_freshness", "warn", f"state is {int(age // 3600)}h old")
    return ("state_freshness", "pass", f"state is {int(age)}s old")


def main() -> int:
    probes = [_probe_runtime(), _probe_deps(), _probe_test_command(), _probe_env(), _probe_state()]
    REPORT_PATH.write_text(
        json.dumps(
            {"timestamp": time.time(), "probes": [{"name": n, "status": s, "detail": d} for n, s, d in probes]},
            indent=2,
        )
        + "\\n"
    )
    width = max(len(n) for n, _, _ in probes)
    for name, status, detail in probes:
        print(f"  {name:<{width}}  {status:>4}  {detail}")
    failed = [n for n, s, _ in probes if s == "fail"]
    if failed:
        print(f"\\ninit failed: {failed}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''


RUN_WITH_FEEDBACK_PY = '''#!/usr/bin/env python3
"""Structured shell-command runner. See Phase 14 · 37."""

from __future__ import annotations

import argparse
import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECORD = ROOT / "feedback_record.jsonl"
HEAD_LINES = 5
TAIL_LINES = 30


def deterministic_tail(text: str) -> tuple[str, int]:
    lines = text.splitlines()
    if len(lines) <= HEAD_LINES + TAIL_LINES:
        return text, 0
    cut = len(lines) - HEAD_LINES - TAIL_LINES
    return "\\n".join(lines[:HEAD_LINES] + [f"...truncated {cut} lines..."] + lines[-TAIL_LINES:]), cut


def run_with_feedback(command: list[str], agent_note: str = "", timeout_s: float = 30.0) -> dict[str, object]:
    started = time.time()
    record: dict[str, object] = {"command": command, "agent_note": agent_note, "started_at": started}
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout_s)
        out, cut_out = deterministic_tail(completed.stdout)
        err, cut_err = deterministic_tail(completed.stderr)
        record.update(
            stdout_tail=out, stderr_tail=err, exit_code=completed.returncode,
            duration_ms=int((time.time() - started) * 1000),
            truncations={"stdout": cut_out, "stderr": cut_err},
        )
    except subprocess.TimeoutExpired as exc:
        partial_out = exc.stdout.decode(errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        partial_err = exc.stderr.decode(errors="replace") if isinstance(exc.stderr, bytes) else (exc.stderr or "")
        out, cut_out = deterministic_tail(partial_out)
        err, cut_err = deterministic_tail(partial_err)
        record.update(
            stdout_tail=out, stderr_tail=err, exit_code=None,
            duration_ms=int((time.time() - started) * 1000),
            error=f"timeout after {timeout_s}s",
            truncations={"stdout": cut_out, "stderr": cut_err},
        )
    except FileNotFoundError as exc:
        record.update(stdout_tail="", stderr_tail="", exit_code=None,
                      duration_ms=int((time.time() - started) * 1000), error=str(exc))
    with RECORD.open("a") as fh:
        fh.write(json.dumps(record) + "\\n")
    return record


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", nargs="+")
    ap.add_argument("--note", default="")
    ap.add_argument("--timeout", type=float, default=30.0)
    args = ap.parse_args()
    rec = run_with_feedback(args.command, agent_note=args.note, timeout_s=args.timeout)
    print(json.dumps(rec, indent=2))
    return 0 if rec.get("exit_code") == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
'''


VERIFY_AGENT_PY = '''#!/usr/bin/env python3
"""Deterministic verification gate. See Phase 14 · 38."""

from __future__ import annotations

import argparse
import json
import sys
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


def _normalize_command(cmd) -> str:
    if isinstance(cmd, list):
        return " ".join(str(part) for part in cmd)
    return str(cmd)


def check_acceptance(accept: list[str], feedback: list[dict]) -> list[dict]:
    findings: list[dict] = []
    commands_run = [_normalize_command(r.get("command")) for r in feedback]
    accept_set = set(accept)
    for cmd in accept:
        if cmd not in commands_run:
            findings.append({"code": "acceptance.missing", "severity": "block", "detail": f"never ran: {cmd}"})
    for r in feedback:
        cmd_str = _normalize_command(r.get("command"))
        if r.get("exit_code") is None:
            findings.append({"code": "feedback.null_exit", "severity": "block", "detail": f"missing exit for {cmd_str}"})
        elif r.get("exit_code") != 0 and cmd_str in accept_set:
            findings.append({"code": "acceptance.failed", "severity": "block",
                             "detail": f"exit {r.get('exit_code')} on {cmd_str}"})
    return findings


def check_scope(scope_report: dict) -> list[dict]:
    findings: list[dict] = []
    if scope_report.get("forbidden_writes"):
        findings.append({"code": "scope.forbidden", "severity": "block",
                         "detail": f"forbidden writes: {scope_report['forbidden_writes']}"})
    if scope_report.get("off_scope_writes"):
        findings.append({"code": "scope.off_scope", "severity": "warn",
                         "detail": f"off-scope writes: {scope_report['off_scope_writes']}"})
    return findings


def check_rules(rule_report: list[dict]) -> list[dict]:
    return [{"code": "rule.failed", "severity": "block", "detail": f"rule failed: {row.get('slug')}"}
            for row in rule_report if not row.get("passed")]


def run_checks(task_id: str) -> dict[str, object]:
    accept = list(_load_json(ROOT / f"outputs/scope/closed/{task_id}.json", {}).get("acceptance_criteria", []))
    feedback = _load_jsonl(ROOT / "feedback_record.jsonl")
    scope_report = _load_json(ROOT / f"outputs/scope/closed/{task_id}.report.json", {})
    rule_report = _load_json(ROOT / "outputs/rule_report.json", [])
    findings = check_acceptance(accept, feedback) + check_scope(scope_report) + check_rules(rule_report)
    return {"task_id": task_id, "passed": not any(f["severity"] == "block" for f in findings), "findings": findings}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("task_id")
    args = ap.parse_args()
    report = run_checks(args.task_id)
    out = ROOT / "outputs" / "verification" / f"{args.task_id}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\\n")
    print(json.dumps(report, indent=2))
    if not report["passed"]:
        print("verification failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''


GENERATE_HANDOFF_PY = '''#!/usr/bin/env python3
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
    (out / "handoff.json").write_text(json.dumps(payload, indent=2) + "\\n")
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
    return "\\n".join(lines) + "\\n"


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
'''


SCRIPT_FILES: dict[str, str] = {
    "init_agent.py": INIT_AGENT_PY,
    "run_with_feedback.py": RUN_WITH_FEEDBACK_PY,
    "verify_agent.py": VERIFY_AGENT_PY,
    "generate_handoff.py": GENERATE_HANDOFF_PY,
}


PACK_README = """# Agent Workbench Pack

Drop-in workbench for any repo that wants reliable agent work.

## What you get

- `AGENTS.md` short router into the rest of the pack.
- `docs/` rules, reliability policy, handoff protocol, reviewer rubric.
- `schemas/` JSON Schemas for state, board, and scope contract.
- `scripts/` init, feedback runner, verification gate, handoff generator.
- `bin/install.sh` idempotent installer.

## Quickstart

```
bin/install.sh
$EDITOR task_board.json
python3 scripts/init_agent.py
```

## Versioning

The `VERSION` file is the contract. Major bumps require a state migration.
"""


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def main() -> None:
    write(PACK / "AGENTS.md", AGENTS_MD.format(version=PACK_VERSION))
    write(PACK / "docs" / "agent-rules.md", AGENT_RULES_MD)
    write(PACK / "docs" / "reliability-policy.md", RELIABILITY_POLICY_MD)
    write(PACK / "docs" / "handoff-protocol.md", HANDOFF_PROTOCOL_MD)
    write(PACK / "docs" / "reviewer-rubric.md", REVIEWER_RUBRIC_MD)
    write(PACK / "schemas" / "agent_state.schema.json", json.dumps(STATE_SCHEMA, indent=2) + "\n")
    write(PACK / "schemas" / "task_board.schema.json", json.dumps(BOARD_SCHEMA, indent=2) + "\n")
    write(PACK / "schemas" / "scope_contract.schema.json", json.dumps(SCOPE_SCHEMA, indent=2) + "\n")
    for name, body in SCRIPT_FILES.items():
        write(PACK / "scripts" / name, body)
        (PACK / "scripts" / name).chmod(0o755)
    write(PACK / "bin" / "install.sh", INSTALL_SH)
    (PACK / "bin" / "install.sh").chmod(0o755)
    write(PACK / "VERSION", PACK_VERSION + "\n")
    write(PACK / "README.md", PACK_README)

    for path in sorted(PACK.rglob("*")):
        if path.is_file():
            print(path.relative_to(PACK.parent.parent))


if __name__ == "__main__":
    main()
