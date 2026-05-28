#!/usr/bin/env python3
"""Agent Workbench packを対象repositoryへscaffoldする。

使い方:
    python3 scripts/scaffold_workbench.py <target_dir> [options]

オプション:
    --force         既存のAGENTS.md / docs / schemas / scriptsを上書き。
    --minimal       docs/を省略（AGENTS.md、schemas/、scripts/、VERSIONのみ）。
    --dry-run       書き込まずに何が起きるか表示。
    --no-seed       starter task_board.json + agent_state.json のseedを省略。

インストールするもの:
    AGENTS.md                      — builder agent用のroot contract
    docs/                          — agent rules、reviewer rubric、handoff、reliability
    schemas/                       — state + task board + scope用JSON Schema
    scripts/                       — init、run_with_feedback、verify、generate_handoff
    task_board.json (seeded)       — todo例タスク1件
    agent_state.json (seeded)      — schema_version 1の新規state record
    .workbench-version             — 固定されたpack version

pack sourceはこのrepoの以下から読む:
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
        return [f"pack sourceが見つかりません: {pack_dir}"]
    for entry in REQUIRED_PACK_ENTRIES:
        if not (pack_dir / entry).exists():
            errors.append(f"packに必須entryがありません: {entry}")
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
            "goal": "最初のタスク。agent開始前に実タスクへ置き換えてください。",
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
        "next_action": "AGENTS.mdを読み、task_board.jsonからtaskを選び、scripts/init_agent.pyを実行する",
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
        f"Workbench pack v{pack_version} を {rel} へscaffoldしました",
        "",
        "次の手順:",
        "  1. task_board.jsonを編集し、T-001を実タスクへ置き換える。",
        "  2. AGENTS.mdを編集し、project固有のbuild cmd、test cmd、deny rulesを設定する。",
        "  3. scripts/init_agent.pyを実行し、environment probesを記録する。",
        "  4. AGENTS.md + task_board.jsonをagentへ渡し、反復する。",
        "",
    ]
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target_dir", type=Path, help="scaffold先ディレクトリ")
    parser.add_argument("--force", action="store_true", help="既存ファイルを上書き")
    parser.add_argument("--minimal", action="store_true", help="docs/を省略")
    parser.add_argument("--dry-run", action="store_true", help="書き込まずにプレビュー")
    parser.add_argument(
        "--no-seed",
        action="store_true",
        help="task_board.json / agent_state.json をseedしない",
    )
    args = parser.parse_args(argv)

    errors = validate_pack(PACK_DIR)
    if errors:
        for e in errors:
            sys.stderr.write(f"エラー: {e}\n")
        return 2

    target = args.target_dir
    if not target.exists():
        if args.dry_run:
            sys.stdout.write(f"target dirを作成予定: {target}\n")
        else:
            target.mkdir(parents=True, exist_ok=True)

    actions = plan_copies(target, args.minimal)
    collisions = detect_collisions(target, actions)
    if collisions and not args.force and not args.dry_run:
        sys.stderr.write("エラー: targetに既に以下が存在します:\n")
        for c in collisions:
            sys.stderr.write(f"  {c}\n")
        sys.stderr.write("上書きするには --force を渡してください\n")
        return 1

    pack_version = (PACK_DIR / "VERSION").read_text(encoding="utf-8").strip()

    if args.dry_run:
        sys.stdout.write(f"dry run — pack v{pack_version}\n")
        for action in actions:
            sys.stdout.write(action.describe(target) + "\n")
        if not args.no_seed:
            sys.stdout.write("  [seed] task_board.json（存在しなければ）\n")
            sys.stdout.write("  [seed] agent_state.json（存在しなければ）\n")
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
