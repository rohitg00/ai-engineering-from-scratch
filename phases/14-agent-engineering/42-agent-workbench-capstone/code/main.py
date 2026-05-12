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
            "acceptance": {"type": "array", "items": {"type": "string"}},
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

if [[ -e "$TARGET/AGENTS.md" && "$FORCE" != "--force" ]]; then
    echo "AGENTS.md already exists. Pass --force to overwrite." >&2
    exit 1
fi

cp "$PACK_ROOT/AGENTS.md" "$TARGET/AGENTS.md"
mkdir -p "$TARGET/docs" "$TARGET/schemas" "$TARGET/scripts"
cp -r "$PACK_ROOT/docs/." "$TARGET/docs/"
cp -r "$PACK_ROOT/schemas/." "$TARGET/schemas/"
cp -r "$PACK_ROOT/scripts/." "$TARGET/scripts/"
echo "$(cat "$PACK_ROOT/VERSION")" > "$TARGET/.workbench-version"

echo "pack installed at version $(cat "$PACK_ROOT/VERSION")"
echo "next: edit task_board.json, set acceptance commands, run scripts/init_agent.py"
"""


SCRIPT_STUBS: dict[str, str] = {
    "init_agent.py": '"""Probes runtime, deps, env, state freshness. See Phase 14 · 35."""\n',
    "run_with_feedback.py": '"""Wraps subprocess.run with structured capture. See Phase 14 · 37."""\n',
    "verify_agent.py": '"""Deterministic verification gate. See Phase 14 · 38."""\n',
    "generate_handoff.py": '"""End-of-session handoff packet generator. See Phase 14 · 40."""\n',
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
    for name, stub in SCRIPT_STUBS.items():
        write(PACK / "scripts" / name, stub)
    write(PACK / "bin" / "install.sh", INSTALL_SH)
    (PACK / "bin" / "install.sh").chmod(0o755)
    write(PACK / "VERSION", PACK_VERSION + "\n")
    write(PACK / "README.md", PACK_README)

    for path in sorted(PACK.rglob("*")):
        if path.is_file():
            print(path.relative_to(PACK.parent.parent))


if __name__ == "__main__":
    main()
