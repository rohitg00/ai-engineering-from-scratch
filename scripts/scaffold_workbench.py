#!/usr/bin/env python3
"""Scaffold the Agent Workbench pack into a target repository.

Usage:
    python3 scripts/scaffold_workbench.py <target_dir> [options]

Options:
    --force         Overwrite existing AGENTS.md / docs / schemas / scripts.
    --minimal       Skip docs/ (only AGENTS.md, schemas/, scripts/, VERSION).
    --dry-run       Print what would happen without writing.
    --no-seed       Skip seeding starter task_board.json + agent_state.json.

What it installs:
    AGENTS.md                      — root contract for the builder agent
    docs/                          — agent rules, reviewer rubric, handoff, reliability
    schemas/                       — JSON Schemas for state + task board + scope
    scripts/                       — init, run_with_feedback, verify, generate_handoff
    task_board.json (seeded)       — one todo example task
    agent_state.json (seeded)      — fresh state record at schema_version 1
    .workbench-version             — pinned pack version

The pack source is read from this repo at:
    phases/14-agent-engineering/42-agent-workbench-capstone/outputs/agent-workbench-pack/
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACK_DIR = (
    ROOT
    / "phases"
    / "14-agent-engineering"
    / "42-agent-workbench-capstone"
    / "outputs"
    / "agent-workbench-pack"
)

REQUIRED_PACK_ENTRIES = ("AGENTS.md", "VERSION", "docs", "schemas", "scripts")
TOP_LEVEL_FILES = ("AGENTS.md",)
TOP_LEVEL_DIRS = ("docs", "schemas", "scripts")
MINIMAL_SKIP_DIRS = ("docs",)


@dataclass
class Action:
    kind: str
    source: Path | None
    target: Path
    note: str = ""

    def describe(self, target_root: Path) -> str:
        rel = self.target.relative_to(target_root)
        return f"  [{self.kind}] {rel}{(' — ' + self.note) if self.note else ''}"


def validate_pack(pack_dir: Path) -> list[str]:
    errors: list[str] = []
    if not pack_dir.is_dir():
        return [f"pack source not found: {pack_dir}"]
    for entry in REQUIRED_PACK_ENTRIES:
        if not (pack_dir / entry).exists():
            errors.append(f"pack missing required entry: {entry}")
    return errors


def plan_copies(target: Path, minimal: bool) -> list[Action]:
    actions: list[Action] = []
    skip_dirs = set(MINIMAL_SKIP_DIRS) if minimal else set()
    for name in TOP_LEVEL_FILES:
        actions.append(Action("file", PACK_DIR / name, target / name))
    for name in TOP_LEVEL_DIRS:
        if name in skip_dirs:
            actions.append(Action("skip", None, target / name, "minimal mode"))
            continue
        actions.append(Action("tree", PACK_DIR / name, target / name))
    actions.append(
        Action(
            "version",
            PACK_DIR / "VERSION",
            target / ".workbench-version",
        )
    )
    return actions


def detect_collisions(target: Path, actions: list[Action]) -> list[Path]:
    collisions: list[Path] = []
    for action in actions:
        if action.kind == "skip":
            continue
        if action.target.exists():
            collisions.append(action.target)
    return collisions


def apply_action(action: Action) -> None:
    if action.kind == "skip":
        return
    if action.kind == "file":
        action.target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(action.source, action.target)
        return
    if action.kind == "tree":
        shutil.copytree(action.source, action.target, dirs_exist_ok=True)
        return
    if action.kind == "version":
        action.target.parent.mkdir(parents=True, exist_ok=True)
        version = action.source.read_text(encoding="utf-8").strip()
        action.target.write_text(version + "\n", encoding="utf-8")
        return
    raise ValueError(f"unknown action kind: {action.kind}")


def seed_task_board(target: Path) -> bool:
    path = target / "task_board.json"
    if path.exists():
        return False
    seed = [
        {
            "id": "T-001",
            "goal": "First task. Replace with the real one before the agent starts.",
            "owner": "builder",
            "acceptance": [
                "code change lands",
                "tests pass",
                "reviewer sign-off recorded",
            ],
            "status": "todo",
        }
    ]
    path.write_text(
        json.dumps(seed, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return True


def seed_agent_state(target: Path) -> bool:
    path = target / "agent_state.json"
    if path.exists():
        return False
    seed = {
        "schema_version": 1,
        "active_task_id": None,
        "touched_files": [],
        "assumptions": [],
        "blockers": [],
        "next_action": "read AGENTS.md, pick a task from task_board.json, run scripts/init_agent.py",
    }
    path.write_text(
        json.dumps(seed, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return True


def render_next_steps(target: Path, pack_version: str) -> str:
    rel = target.resolve()
    lines = [
        "",
        f"Workbench pack v{pack_version} scaffolded into {rel}",
        "",
        "Next steps:",
        "  1. Edit task_board.json. Replace T-001 with the real task.",
        "  2. Edit AGENTS.md. Set project-specific build cmd, test cmd, deny rules.",
        "  3. Run scripts/init_agent.py to capture environment probes.",
        "  4. Hand AGENTS.md + task_board.json to the agent. Iterate.",
        "",
    ]
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target_dir", type=Path, help="directory to scaffold into")
    parser.add_argument("--force", action="store_true", help="overwrite existing files")
    parser.add_argument("--minimal", action="store_true", help="skip docs/")
    parser.add_argument("--dry-run", action="store_true", help="preview without writing")
    parser.add_argument(
        "--no-seed",
        action="store_true",
        help="do not seed task_board.json / agent_state.json",
    )
    args = parser.parse_args(argv)

    errors = validate_pack(PACK_DIR)
    if errors:
        for e in errors:
            sys.stderr.write(f"error: {e}\n")
        return 2

    target = args.target_dir
    if not target.exists():
        if args.dry_run:
            sys.stdout.write(f"would create target dir: {target}\n")
        else:
            target.mkdir(parents=True, exist_ok=True)

    actions = plan_copies(target, args.minimal)
    collisions = detect_collisions(target, actions)
    if collisions and not args.force and not args.dry_run:
        sys.stderr.write("error: target already contains:\n")
        for c in collisions:
            sys.stderr.write(f"  {c}\n")
        sys.stderr.write("pass --force to overwrite\n")
        return 1

    pack_version = (PACK_DIR / "VERSION").read_text(encoding="utf-8").strip()

    if args.dry_run:
        sys.stdout.write(f"dry run — pack v{pack_version}\n")
        for action in actions:
            sys.stdout.write(action.describe(target) + "\n")
        if not args.no_seed:
            sys.stdout.write("  [seed] task_board.json (if absent)\n")
            sys.stdout.write("  [seed] agent_state.json (if absent)\n")
        return 0

    for action in actions:
        apply_action(action)

    if not args.no_seed:
        seed_task_board(target)
        seed_agent_state(target)

    sys.stdout.write(render_next_steps(target, pack_version))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
