#!/usr/bin/env python3
"""コースのoutputs（skills / prompts / agents）を対象ディレクトリへインストールする。

カリキュラム全体の `phases/**/outputs/{skill,prompt,agent}-*.md` artifact を走査し、
YAML frontmatterを解析し、type / phase / tagで絞り込み、3つのlayoutのいずれかで
一致したファイルを対象ディレクトリへコピーする。

使い方:
    python3 scripts/install_skills.py <target_dir> [options]

オプション:
    --type {skill,prompt,agent,all}   デフォルト: skill
    --phase N                          単一フェーズ番号へ絞り込み
    --tag TAG                          TAGを含むoutputsへ絞り込み
    --layout {flat,by-phase,skills}    デフォルト: skills
        flat       <target>/<name>.md
        by-phase   <target>/phase-NN/<name>.md
        skills     <target>/<name>/SKILL.md
    --dry-run                          書き込まずにプレビュー
    --force                            既存ファイルを上書き
    --json                             manifest.jsonのみを書き、手順表示はしない

常に <target>/manifest.json に完全な目録（name, type, phase, lesson, source path,
target path, tags, version）を書き込む。
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import parse_frontmatter  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PHASES_DIR = ROOT / "phases"

VALID_TYPES = ("skill", "prompt", "agent")
LAYOUTS = ("flat", "by-phase", "skills")


@dataclass
class Artifact:
    type: str
    name: str
    phase: int | None
    lesson: int | None
    version: str
    description: str
    tags: list[str]
    source: Path

    def to_dict(self, target: Path | None = None) -> dict:
        out: dict[str, object] = {
            "type": self.type,
            "name": self.name,
            "phase": self.phase,
            "lesson": self.lesson,
            "version": self.version,
            "description": self.description,
            "tags": self.tags,
            "source": self.source.relative_to(ROOT).as_posix(),
        }
        if target is not None:
            out["target"] = target.as_posix()
        return out


def derive_phase_lesson(path: Path) -> tuple[int | None, int | None]:
    parts = path.parts
    phase_num: int | None = None
    lesson_num: int | None = None
    for part in parts:
        if part.startswith(("0", "1", "2")) and "-" in part:
            head = part.split("-", 1)[0]
            if head.isdigit():
                num = int(head)
                if phase_num is None:
                    phase_num = num
                elif lesson_num is None:
                    lesson_num = num
                    break
    return phase_num, lesson_num


def discover_artifacts() -> Iterable[Artifact]:
    if not PHASES_DIR.is_dir():
        return
    for output_dir in sorted(PHASES_DIR.glob("*/[0-9][0-9]-*/outputs")):
        for path in sorted(output_dir.iterdir()):
            if path.suffix != ".md" or not path.is_file():
                continue
            stem = path.stem
            artifact_type: str | None = None
            for t in VALID_TYPES:
                if stem.startswith(f"{t}-"):
                    artifact_type = t
                    break
            if artifact_type is None:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            meta = parse_frontmatter(text) or {}
            default_phase, default_lesson = derive_phase_lesson(path)
            phase_raw = meta.get("phase", default_phase)
            lesson_raw = meta.get("lesson", default_lesson)
            try:
                phase = int(phase_raw) if phase_raw is not None else None
            except (TypeError, ValueError):
                phase = default_phase
            try:
                lesson = int(lesson_raw) if lesson_raw is not None else None
            except (TypeError, ValueError):
                lesson = default_lesson
            name = str(meta.get("name", "")).strip() or stem
            description = str(meta.get("description", "")).strip()
            version = str(meta.get("version", "")).strip()
            tags_raw = meta.get("tags", [])
            tags = list(tags_raw) if isinstance(tags_raw, list) else []
            yield Artifact(
                type=artifact_type,
                name=name,
                phase=phase,
                lesson=lesson,
                version=version,
                description=description,
                tags=tags,
                source=path,
            )


def filter_artifacts(
    artifacts: Iterable[Artifact],
    type_filter: str,
    phase_filter: int | None,
    tag_filter: str | None,
) -> list[Artifact]:
    out: list[Artifact] = []
    for a in artifacts:
        if type_filter != "all" and a.type != type_filter:
            continue
        if phase_filter is not None and a.phase != phase_filter:
            continue
        if tag_filter is not None and tag_filter not in a.tags:
            continue
        out.append(a)
    return out


def target_path(artifact: Artifact, target_root: Path, layout: str) -> Path:
    if layout == "flat":
        return target_root / f"{artifact.name}.md"
    if layout == "by-phase":
        phase_dir = f"phase-{artifact.phase:02d}" if artifact.phase is not None else "phase-unknown"
        return target_root / phase_dir / f"{artifact.name}.md"
    if layout == "skills":
        return target_root / artifact.name / "SKILL.md"
    raise ValueError(f"unknown layout: {layout}")


@dataclass
class Plan:
    actions: list[tuple[Artifact, Path]] = field(default_factory=list)
    collisions: list[Path] = field(default_factory=list)


def build_plan(
    artifacts: list[Artifact], target_root: Path, layout: str, force: bool
) -> Plan:
    plan = Plan()
    seen_targets: dict[Path, Artifact] = {}
    for a in artifacts:
        dest = target_path(a, target_root, layout)
        if dest in seen_targets:
            sys.stderr.write(
                f"警告: {seen_targets[dest].source} と {a.source} のtargetが衝突 "
                f"（どちらも {dest} へ対応）。後者をスキップします\n"
            )
            continue
        seen_targets[dest] = a
        if dest.exists() and not force:
            plan.collisions.append(dest)
        plan.actions.append((a, dest))
    return plan


def apply_plan(plan: Plan) -> None:
    for artifact, dest in plan.actions:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(artifact.source, dest)


def write_manifest(target_root: Path, artifacts: list[Artifact], layout: str) -> Path:
    manifest_path = target_root / "manifest.json"
    target_root.mkdir(parents=True, exist_ok=True)
    by_type: dict[str, int] = {}
    by_phase: dict[str, int] = {}
    entries = []
    for a in artifacts:
        dest_rel = target_path(a, target_root, layout).relative_to(target_root)
        entries.append(a.to_dict(target=dest_rel))
        by_type[a.type] = by_type.get(a.type, 0) + 1
        key = f"phase-{a.phase:02d}" if a.phase is not None else "phase-unknown"
        by_phase[key] = by_phase.get(key, 0) + 1
    manifest = {
        "schema_version": 1,
        "layout": layout,
        "totals": {
            "artifacts": len(entries),
            "by_type": dict(sorted(by_type.items())),
            "by_phase": dict(sorted(by_phase.items())),
        },
        "artifacts": entries,
    }
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return manifest_path


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target_dir", type=Path)
    parser.add_argument("--type", choices=(*VALID_TYPES, "all"), default="skill")
    parser.add_argument("--phase", type=int, default=None)
    parser.add_argument("--tag", default=None)
    parser.add_argument("--layout", choices=LAYOUTS, default="skills")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument(
        "--json",
        action="store_true",
        help="人間向け出力を抑制（--dry-runでなければmanifest.jsonは書く）",
    )
    args = parser.parse_args(argv)

    artifacts = list(discover_artifacts())
    selected = filter_artifacts(artifacts, args.type, args.phase, args.tag)
    if not selected:
        sys.stderr.write("指定されたフィルターに一致するartifactがありません\n")
        return 1

    plan = build_plan(selected, args.target_dir, args.layout, args.force)
    if plan.collisions and not args.force:
        sys.stderr.write(
            f"エラー: {len(plan.collisions)} 個のtarget fileが既に存在します。"
            f"上書きするには --force を渡してください。\n"
        )
        if not args.json:
            for c in plan.collisions[:10]:
                sys.stderr.write(f"  {c}\n")
            if len(plan.collisions) > 10:
                sys.stderr.write(f"  ... ほか {len(plan.collisions) - 10} 件\n")
        return 1

    if args.dry_run:
        if not args.json:
            sys.stdout.write(
                f"dry run: {len(plan.actions)} 個のartifact -> {args.target_dir} "
                f"(layout={args.layout})\n"
            )
            for artifact, _dest in plan.actions[:20]:
                sys.stdout.write(
                    f"  [{artifact.type}] {artifact.name} "
                    f"<- {artifact.source.relative_to(ROOT)}\n"
                )
            if len(plan.actions) > 20:
                sys.stdout.write(f"  ... ほか {len(plan.actions) - 20} 件\n")
        return 0

    apply_plan(plan)
    manifest_path = write_manifest(args.target_dir, selected, args.layout)
    if not args.json:
        sys.stdout.write(
            f"{len(plan.actions)} 個のartifactを {args.target_dir} へインストールしました "
            f"(layout={args.layout})\n"
        )
        sys.stdout.write(f"manifest: {manifest_path}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
