"""capstone agent-workbench-pack を outputs/ に組み立てる。

この mini-track の preceding lessons で作った surfaces から schemas、scripts、docs を seed する。
idempotent。tree を表示する。

Run: python3 code/main.py
"""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).parent
PACK = HERE.parent / "outputs" / "agent-workbench-pack"

PACK_VERSION = "1.0.0"


AGENTS_MD = """# AGENTS.md

あなたは agent workbench を使う repository の中で作業しています。

行動する前に次を読んでください。

1. `agent_state.json` — 前 session が止まった場所。
2. `task_board.json` — 進行中のもの、次に行うもの。
3. `docs/agent-rules.md` — startup、forbidden、done、uncertainty、approval。
4. `docs/reliability-policy.md` — この workbench が吸収するよう設計された failure modes。
5. `docs/handoff-protocol.md` — session end が生成すべきもの。
6. `docs/reviewer-rubric.md` — completed work の判断方法。

Verification command: board 上の active task の `acceptance_criteria` を参照してください。

Pack version: {version}
""".lstrip()


AGENT_RULES_MD = """# Agent Rules

## startup/state-file-fresh
- category: startup
- check: state_file_fresh
Agent は tool call の前に必ず agent_state.json を読む。

## forbidden/no-out-of-scope-writes
- category: forbidden
- check: no_out_of_scope_writes
active task の scope contract 外の file を編集してはいけない。

## done/tests-pass
- category: definition_of_done
- check: tests_pass
task は、すべての acceptance command が exit zero になったときだけ done。

## uncertainty/open-question-note
- category: uncertainty
- check: opened_question_when_unsure
confidence が threshold 未満のときは、推測せず question note を開く。

## approval/new-dependency
- category: approval
- check: new_dependency_approved
runtime dependency を追加するには、明示的な human approval が必要。
"""


RELIABILITY_POLICY_MD = """# Reliability Policy

workbench は、業界で繰り返し発生する5つの failure modes を吸収します。

1. Hallucinated action — rule set + verification gate で捕捉する。
2. Scope creep — scope contract diff check で捕捉する。
3. Cascading errors — feedback records + refuse-on-null-exit で捕捉する。
4. Context loss — repo memory で吸収する。chat は source of truth ではない。
5. Tool misuse — reviewer rubric の verification dimension で捕捉する。

policy は verification gate により enforce されます。override path は signed
and audited です。agents は self-override できません。
"""


HANDOFF_PROTOCOL_MD = """# Handoff Protocol

すべての session は、次を含む handoff packet で終わります。

- summary
- changed_files
- commands_run
- failed_attempts
- open_risks (severity + detail)
- next_action (1つの具体的 step)
- verdict_pointer (verification + review reports への paths)

packet は handoff.md (humans) と handoff.json (next agent) の両方で出荷されます。
missing fields は session-end hook を停止させます。
"""


REVIEWER_RUBRIC_MD = """# Reviewer Rubric

5つの dimensions を 0 から 2 で採点します。

1. Problem fit — change は stated task を解いたか。
2. Scope discipline — edits は contract 内に収まったか。
3. Assumptions — hidden assumptions は書かれているか。
4. Verification quality — acceptance は goal を実際に証明しているか。
5. Handoff readiness — 次 session は clean に引き継げるか。

total >= 7 かつ zero なし: pass。total 5-6: soft fail。5 未満またはいずれか zero: hard fail。
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

# agent workbench pack を current repo に install する。
# Usage: bin/install.sh [--force]

FORCE="${1:-}"
TARGET="$(pwd)"
PACK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

required=("AGENTS.md" "VERSION" "docs" "schemas" "scripts")
for path in "${required[@]}"; do
    if [[ ! -e "$PACK_ROOT/$path" ]]; then
        echo "pack source がありません: $PACK_ROOT/$path" >&2
        exit 1
    fi
done

if [[ -e "$TARGET/AGENTS.md" && "$FORCE" != "--force" ]]; then
    echo "AGENTS.md はすでに存在します。overwrite するには --force を渡してください。" >&2
    exit 1
fi

cp "$PACK_ROOT/AGENTS.md" "$TARGET/AGENTS.md"
mkdir -p "$TARGET/docs" "$TARGET/schemas" "$TARGET/scripts"
cp -r "$PACK_ROOT/docs/." "$TARGET/docs/"
cp -r "$PACK_ROOT/schemas/." "$TARGET/schemas/"
cp -r "$PACK_ROOT/scripts/." "$TARGET/scripts/"
cat "$PACK_ROOT/VERSION" > "$TARGET/.workbench-version"

echo "pack version $(cat "$PACK_ROOT/VERSION") を install しました"
echo "next: task_board.json を編集し、acceptance commands を設定し、scripts/init_agent.py を実行してください"
"""


INIT_AGENT_PY = '''#!/usr/bin/env python3
"""Workbench init script。from-scratch build は Phase 14 · 35 を参照。"""

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
    return ("dependencies", "fail" if missing else "pass", f"missing: {missing}" if missing else "すべて import 可能")


def _probe_test_command() -> tuple[str, str, str]:
    return ("test_command", "pass" if shutil.which(TEST_COMMAND) else "fail", f"{TEST_COMMAND} が PATH 上にある")


def _probe_env() -> tuple[str, str, str]:
    missing = [k for k in REQUIRED_ENV if not os.environ.get(k)]
    return ("env", "fail" if missing else "pass", f"missing: {missing}" if missing else "すべて存在")


def _probe_state() -> tuple[str, str, str]:
    if not STATE_PATH.exists():
        return ("state_freshness", "warn", "state file はまだありません")
    age = time.time() - STATE_PATH.stat().st_mtime
    if age > FRESH_SECONDS:
        return ("state_freshness", "warn", f"state は {int(age // 3600)}h old")
    return ("state_freshness", "pass", f"state は {int(age)}s old")


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
        print(f"\\ninit に失敗しました: {failed}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''


RUN_WITH_FEEDBACK_PY = '''#!/usr/bin/env python3
"""structured shell-command runner。Phase 14 · 37 を参照。"""

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
"""deterministic verification gate。Phase 14 · 38 を参照。"""

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
            findings.append({"code": "acceptance.missing", "severity": "block", "detail": f"未実行: {cmd}"})
    for r in feedback:
        cmd_str = _normalize_command(r.get("command"))
        if r.get("exit_code") is None:
            findings.append({"code": "feedback.null_exit", "severity": "block", "detail": f"{cmd_str} の exit が欠落"})
        elif r.get("exit_code") != 0 and cmd_str in accept_set:
            findings.append({"code": "acceptance.failed", "severity": "block",
                             "detail": f"{cmd_str} で exit {r.get('exit_code')}"})
    return findings


def check_scope(scope_report: dict) -> list[dict]:
    findings: list[dict] = []
    if scope_report.get("forbidden_writes"):
        findings.append({"code": "scope.forbidden", "severity": "block",
                         "detail": f"forbidden writes がある: {scope_report['forbidden_writes']}"})
    if scope_report.get("off_scope_writes"):
        findings.append({"code": "scope.off_scope", "severity": "warn",
                         "detail": f"off-scope writes がある: {scope_report['off_scope_writes']}"})
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
        print("verification に失敗しました", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''


GENERATE_HANDOFF_PY = '''#!/usr/bin/env python3
"""end-of-session handoff packet generator。Phase 14 · 40 を参照。"""

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
        risks.append({"severity": "warn", "detail": f"未解決 blocker: {blocker}"})
    try:
        total = int(review.get("total", 10))
    except (TypeError, ValueError):
        total = 10
    if total < 7:
        risks.append({"severity": "warn", "detail": f"review total {review.get('total')} が 7 未満"})
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
        "next_action": str(state.get("next_action") or "next_action の記録なし。人間の確認が必要"),
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
        return [f"- {x}" for x in items] or ["- なし"]
    lines = [
        f"# Handoff: {p['task_id']}",
        "",
        f"**概要.** {p['summary']}",
        "",
        "## 変更ファイル",
        *bullets(p["changed_files"]),
        "",
        "## 実行したコマンド",
        *bullets(p["commands_run"]),
        "",
        "## 失敗した試行",
        *bullets(p["failed_attempts"]),
        "",
        "## 未解決リスク",
        *bullets([f"[{r['severity']}] {r['detail']}" for r in p["open_risks"]]),
        "",
        "## 次のアクション",
        str(p["next_action"]),
        "",
        "## 証跡",
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
        print(f"handoff に失敗しました: {exc}", file=sys.stderr)
        return 1
    print(f"outputs/handoff/{payload['session_id']}/{{handoff.json,handoff.md}} を書きました")
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

reliable な agent work を必要とする任意の repo 向けの drop-in workbench。

## 得られるもの

- pack の残りへ案内する短い router としての `AGENTS.md`。
- rules、reliability policy、handoff protocol、reviewer rubric を含む `docs/`。
- state、board、scope contract 用の JSON Schemas を含む `schemas/`。
- init、feedback runner、verification gate、handoff generator を含む `scripts/`。
- idempotent installer としての `bin/install.sh`。

## Quickstart

```
bin/install.sh
$EDITOR task_board.json
python3 scripts/init_agent.py
```

## Versioning

`VERSION` file が contract です。major bump には state migration が必要です。
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
