#!/usr/bin/env python3
"""Install course outputs (skills / prompts / agents) into a target directory.

Walks flat `phases/**/outputs/{skill,prompt,agent}-*.md` artifacts and skill
bundles at `phases/**/outputs/<name>/SKILL.md`, parses YAML frontmatter, filters
by type / phase / tag, and installs each matching artifact.

Usage:
    python3 scripts/install_skills.py <target_dir> [options]

Options:
    --type {skill,prompt,agent,all}   default: skill
    --phase N                          filter to a single phase number
    --tag TAG                          filter to outputs whose tags include TAG
    --layout {flat,by-phase,skills}    default: skills
        flat       flat files: <target>/<name>.md; bundles: <target>/<name>/
        by-phase   flat files: <target>/phase-NN/<name>.md; bundles: .../<name>/
        skills     flat files: <target>/<name>/SKILL.md; bundles: <target>/<name>/
    --dry-run                          preview without writing
    --force                            overwrite existing files
    --json                             write manifest.json only; do not print steps

Always writes <target>/manifest.json with the installed inventory. Bundle
entries also include their source directory and regular-file list.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import stat
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import (  # noqa: E402
    ArtifactPathError,
    BundleValidationError,
    parse_frontmatter,
    validate_repository_directory,
    validate_repository_file,
    validate_skill_bundle,
)

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
    bundle_root: Path | None = None
    bundle_files: list[str] = field(default_factory=list)

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
        if self.bundle_root is not None:
            out["bundle"] = True
            out["bundle_path"] = self.bundle_root.relative_to(ROOT).as_posix()
            out["files"] = list(self.bundle_files)
        if target is not None:
            out["target"] = target.as_posix()
        return out


def derive_phase_lesson(path: Path) -> tuple[int | None, int | None]:
    parts = path.parts
    try:
        phases_index = parts.index("phases")
    except ValueError:
        phases_index = -1
    if phases_index >= 0:
        numbers: list[int | None] = []
        for part in parts[phases_index + 1 : phases_index + 3]:
            head = part.split("-", 1)[0]
            numbers.append(int(head) if head.isdigit() else None)
        while len(numbers) < 2:
            numbers.append(None)
        return numbers[0], numbers[1]
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


def artifact_from_markdown(
    path: Path,
    artifact_type: str,
    fallback_name: str,
    bundle_root: Path | None = None,
    bundle_files: list[str] | None = None,
) -> Artifact | None:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return None
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
    tags_raw = meta.get("tags", [])
    return Artifact(
        type=artifact_type,
        name=str(meta.get("name", "")).strip() or fallback_name,
        phase=phase,
        lesson=lesson,
        version=str(meta.get("version", "")).strip(),
        description=str(meta.get("description", "")).strip(),
        tags=list(tags_raw) if isinstance(tags_raw, list) else [],
        source=path,
        bundle_root=bundle_root,
        bundle_files=list(bundle_files or []),
    )


def discover_artifacts() -> Iterable[Artifact]:
    if not PHASES_DIR.is_dir():
        return
    output_dirs = sorted(PHASES_DIR.glob("*/[0-9][0-9]-*/outputs"))
    for output_dir in output_dirs:
        validate_output_directory(output_dir)
    for output_dir in output_dirs:
        paths = sorted(output_dir.iterdir())
        for path in paths:
            if path.suffix != ".md":
                continue
            stem = path.stem
            artifact_type = next(
                (t for t in VALID_TYPES if stem.startswith(f"{t}-")), None
            )
            if artifact_type is None:
                continue
            if path.is_symlink():
                validate_flat_artifact(path)
            if not path.is_file():
                continue
            validate_flat_artifact(path)
            artifact = artifact_from_markdown(path, artifact_type, stem)
            if artifact is not None:
                yield artifact
    for output_dir in output_dirs:
        paths = sorted(output_dir.iterdir())
        for bundle_root in paths:
            if not bundle_root.is_dir():
                continue
            if bundle_root.is_symlink():
                raise UnsafeBundleError(
                    f"skill bundle must be a regular directory: {bundle_root}"
                )
            skill_path = bundle_root / "SKILL.md"
            if not skill_path.exists():
                continue
            bundle_files = validate_bundle(bundle_root)
            artifact = artifact_from_markdown(
                skill_path,
                "skill",
                bundle_root.name,
                bundle_root,
                bundle_files,
            )
            if artifact is not None:
                yield artifact


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
    if (
        not artifact.name
        or artifact.name in {".", ".."}
        or "/" in artifact.name
        or "\\" in artifact.name
        or Path(artifact.name).name != artifact.name
    ):
        raise ValueError(f"unsafe artifact name: {artifact.name!r}")
    if artifact.bundle_root is not None:
        if layout == "by-phase":
            phase_dir = (
                f"phase-{artifact.phase:02d}"
                if artifact.phase is not None
                else "phase-unknown"
            )
            return target_root / phase_dir / artifact.name
        if layout in {"flat", "skills"}:
            return target_root / artifact.name
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
    target_root: Path | None = None


def target_identity(artifact: Artifact, target_root: Path, layout: str) -> Path:
    if layout == "by-phase":
        phase_dir = (
            f"phase-{artifact.phase:02d}"
            if artifact.phase is not None
            else "phase-unknown"
        )
        return target_root / phase_dir / artifact.name
    return target_root / artifact.name


def build_plan(
    artifacts: list[Artifact], target_root: Path, layout: str, force: bool
) -> Plan:
    plan = Plan(target_root=target_root)
    seen_targets: dict[Path, Artifact] = {}
    for a in artifacts:
        dest = target_path(a, target_root, layout)
        identity = target_identity(a, target_root, layout)
        if identity in seen_targets:
            sys.stderr.write(
                f"warn: target collision between {seen_targets[identity].source} "
                f"and {a.source} (both map to {identity}); skipping latter\n"
            )
            continue
        seen_targets[identity] = a
        if dest.exists() and not force:
            plan.collisions.append(dest)
        plan.actions.append((a, dest))
    return plan


class UnsafeBundleError(ValueError):
    pass


class UnsafeArtifactError(UnsafeBundleError):
    pass


def validate_output_directory(output_dir: Path) -> None:
    try:
        validate_repository_directory(output_dir, ROOT, "lesson outputs")
    except ArtifactPathError as error:
        raise UnsafeArtifactError(str(error)) from error


def validate_flat_artifact(source: Path) -> None:
    try:
        validate_repository_file(source, ROOT, "flat artifact")
    except ArtifactPathError as error:
        raise UnsafeArtifactError(str(error)) from error


def validate_bundle(bundle_root: Path) -> list[str]:
    try:
        return validate_skill_bundle(bundle_root, ROOT)
    except BundleValidationError as error:
        raise UnsafeBundleError(str(error)) from error


def _require_safe_open_flags() -> None:
    if not getattr(os, "O_NOFOLLOW", 0) or not getattr(os, "O_DIRECTORY", 0):
        raise UnsafeArtifactError(
            "this platform does not support race-safe artifact installation"
        )


def _same_file(expected: os.stat_result, actual: os.stat_result) -> bool:
    return (expected.st_dev, expected.st_ino) == (actual.st_dev, actual.st_ino)


def _open_bundle_directory(
    directory_fd: int | None,
    name: str | Path,
    expected: os.stat_result,
    display_path: Path,
) -> tuple[int, os.stat_result]:
    if not stat.S_ISDIR(expected.st_mode):
        raise UnsafeBundleError(
            f"skill bundle contains an unsafe directory entry: {display_path}"
        )
    try:
        descriptor = os.open(
            name,
            os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
            dir_fd=directory_fd,
        )
    except OSError as error:
        raise UnsafeBundleError(
            f"skill bundle contains an unsafe directory entry: {display_path}"
        ) from error
    actual = os.fstat(descriptor)
    if not stat.S_ISDIR(actual.st_mode) or not _same_file(expected, actual):
        os.close(descriptor)
        raise UnsafeBundleError(
            f"skill bundle contains an unsafe directory entry: {display_path}"
        )
    return descriptor, actual


def _open_bundle_file(
    directory_fd: int,
    name: str,
    expected: os.stat_result,
    display_path: Path,
) -> tuple[int, os.stat_result]:
    if not stat.S_ISREG(expected.st_mode):
        raise UnsafeBundleError(
            f"skill bundle contains an unsafe file entry: {display_path}"
        )
    try:
        descriptor = os.open(
            name,
            os.O_RDONLY | os.O_NOFOLLOW,
            dir_fd=directory_fd,
        )
    except OSError as error:
        raise UnsafeBundleError(
            f"skill bundle contains an unsafe file entry: {display_path}"
        ) from error
    actual = os.fstat(descriptor)
    if not stat.S_ISREG(actual.st_mode) or not _same_file(expected, actual):
        os.close(descriptor)
        raise UnsafeBundleError(
            f"skill bundle contains an unsafe file entry: {display_path}"
        )
    return descriptor, actual


def _copy_bundle_directory(
    source_fd: int,
    destination: Path,
    source_path: Path,
) -> None:
    for name in sorted(os.listdir(source_fd)):
        display_path = source_path / name
        try:
            expected = os.stat(name, dir_fd=source_fd, follow_symlinks=False)
        except OSError as error:
            raise UnsafeBundleError(
                f"could not inspect skill bundle entry: {display_path}"
            ) from error
        target = destination / name
        if stat.S_ISDIR(expected.st_mode):
            child_fd, actual = _open_bundle_directory(
                source_fd, name, expected, display_path
            )
            try:
                target.mkdir()
                _copy_bundle_directory(child_fd, target, display_path)
                target.chmod(stat.S_IMODE(actual.st_mode))
            finally:
                os.close(child_fd)
            continue
        if stat.S_ISREG(expected.st_mode):
            file_fd, actual = _open_bundle_file(
                source_fd, name, expected, display_path
            )
            try:
                with os.fdopen(file_fd, "rb") as source_handle, target.open(
                    "xb"
                ) as target_handle:
                    shutil.copyfileobj(source_handle, target_handle)
            except Exception:
                if target.exists():
                    target.unlink()
                raise
            target.chmod(stat.S_IMODE(actual.st_mode))
            continue
        raise UnsafeBundleError(
            f"skill bundle contains an unsafe file entry: {display_path}"
        )


def _copy_bundle_no_follow(bundle_root: Path, staged_bundle: Path) -> None:
    _require_safe_open_flags()
    try:
        expected = os.stat(bundle_root, follow_symlinks=False)
    except OSError as error:
        raise UnsafeBundleError(
            f"skill bundle must be a regular directory: {bundle_root}"
        ) from error
    source_fd, actual = _open_bundle_directory(
        None, bundle_root, expected, bundle_root
    )
    try:
        staged_bundle.mkdir()
        _copy_bundle_directory(source_fd, staged_bundle, bundle_root)
        staged_bundle.chmod(stat.S_IMODE(actual.st_mode))
    finally:
        os.close(source_fd)


def _open_flat_artifact(
    source: Path, expected: os.stat_result
) -> tuple[int, os.stat_result]:
    if not stat.S_ISREG(expected.st_mode):
        raise UnsafeArtifactError(f"flat artifact must be a regular file: {source}")
    try:
        descriptor = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
    except OSError as error:
        raise UnsafeArtifactError(
            f"flat artifact must be a regular file: {source}"
        ) from error
    actual = os.fstat(descriptor)
    if not stat.S_ISREG(actual.st_mode) or not _same_file(expected, actual):
        os.close(descriptor)
        raise UnsafeArtifactError(f"flat artifact changed during installation: {source}")
    return descriptor, actual


def _ensure_safe_target_root(target_root: Path) -> None:
    target_root.mkdir(parents=True, exist_ok=True)
    if target_root.is_symlink() or not target_root.is_dir():
        raise UnsafeArtifactError(
            f"installation target must be a regular directory: {target_root}"
        )


def _ensure_safe_destination_parent(target_root: Path, parent: Path) -> None:
    _ensure_safe_target_root(target_root)
    try:
        relative = parent.relative_to(target_root)
    except ValueError as error:
        raise UnsafeArtifactError(
            f"artifact target escapes the installation directory: {parent}"
        ) from error
    current = target_root
    for part in relative.parts:
        current /= part
        if current.is_symlink():
            raise UnsafeArtifactError(
                f"artifact destination parent must be a regular directory: {current}"
            )
        current.mkdir(exist_ok=True)
        if current.is_symlink() or not current.is_dir():
            raise UnsafeArtifactError(
                f"artifact destination parent must be a regular directory: {current}"
            )


def install_bundle(bundle_root: Path, dest: Path, force: bool) -> None:
    staging_root = Path(
        tempfile.mkdtemp(prefix=f".{dest.name}.install-", dir=dest.parent)
    )
    staged_bundle = staging_root / "bundle"
    backup_root: Path | None = None
    backup: Path | None = None
    try:
        _copy_bundle_no_follow(bundle_root, staged_bundle)
        try:
            validate_skill_bundle(staged_bundle, staging_root)
        except BundleValidationError as error:
            raise UnsafeBundleError(str(error)) from error
        if dest.exists() or dest.is_symlink():
            if not force:
                raise FileExistsError(f"target already exists: {dest}")
            backup_root = Path(
                tempfile.mkdtemp(prefix=f".{dest.name}.backup-", dir=dest.parent)
            )
            backup = backup_root / "previous"
            os.replace(dest, backup)
        try:
            os.replace(staged_bundle, dest)
        except Exception:
            backup_exists = backup is not None and (
                backup.exists() or backup.is_symlink()
            )
            dest_exists = dest.exists() or dest.is_symlink()
            if backup_exists and not dest_exists:
                os.replace(backup, dest)
            raise
        if backup_root is not None:
            shutil.rmtree(backup_root)
            backup_root = None
    finally:
        shutil.rmtree(staging_root, ignore_errors=True)
        if backup_root is not None:
            shutil.rmtree(backup_root, ignore_errors=True)


def install_flat_artifact(source: Path, dest: Path, force: bool) -> None:
    _require_safe_open_flags()
    try:
        expected = os.stat(source, follow_symlinks=False)
    except OSError as error:
        raise UnsafeArtifactError(
            f"flat artifact must be a regular file: {source}"
        ) from error
    source_fd, actual = _open_flat_artifact(source, expected)
    staging_fd, staging_name = tempfile.mkstemp(
        prefix=f".{dest.name}.install-", dir=dest.parent
    )
    staging_path = Path(staging_name)
    try:
        with os.fdopen(source_fd, "rb") as source_handle, os.fdopen(
            staging_fd, "wb"
        ) as target_handle:
            shutil.copyfileobj(source_handle, target_handle)
            target_handle.flush()
            os.fsync(target_handle.fileno())
        staging_path.chmod(stat.S_IMODE(actual.st_mode))
        if (dest.exists() or dest.is_symlink()) and not force:
            raise FileExistsError(f"target already exists: {dest}")
        os.replace(staging_path, dest)
    finally:
        if staging_path.exists() or staging_path.is_symlink():
            staging_path.unlink()


def apply_plan(plan: Plan, force: bool = False) -> None:
    for artifact, _dest in plan.actions:
        if artifact.bundle_root is not None:
            artifact.bundle_files = validate_bundle(artifact.bundle_root)
        else:
            validate_flat_artifact(artifact.source)
    if plan.actions and plan.target_root is None:
        raise ValueError("installation plan is missing its target root")
    for artifact, dest in plan.actions:
        _ensure_safe_destination_parent(plan.target_root, dest.parent)
        if artifact.bundle_root is not None:
            install_bundle(artifact.bundle_root, dest, force)
        else:
            install_flat_artifact(artifact.source, dest, force)


def write_manifest(target_root: Path, artifacts: list[Artifact], layout: str) -> Path:
    manifest_path = target_root / "manifest.json"
    _ensure_safe_target_root(target_root)
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
    descriptor, staging_name = tempfile.mkstemp(
        prefix=".manifest.json.install-", dir=target_root
    )
    staging_path = Path(staging_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        staging_path.chmod(0o644)
        os.replace(staging_path, manifest_path)
    finally:
        if staging_path.exists() or staging_path.is_symlink():
            staging_path.unlink()
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
        help="suppress human-readable output (manifest.json still written unless --dry-run)",
    )
    args = parser.parse_args(argv)

    try:
        artifacts = list(discover_artifacts())
    except (OSError, ValueError) as exc:
        sys.stderr.write(f"error: {exc}\n")
        return 1
    selected = filter_artifacts(artifacts, args.type, args.phase, args.tag)
    if not selected:
        sys.stderr.write("no artifacts matched the given filters\n")
        return 1

    try:
        plan = build_plan(selected, args.target_dir, args.layout, args.force)
    except ValueError as exc:
        sys.stderr.write(f"error: {exc}\n")
        return 1
    if plan.collisions and not args.force:
        sys.stderr.write(
            f"error: {len(plan.collisions)} target file(s) already exist. "
            f"Pass --force to overwrite.\n"
        )
        if not args.json:
            for c in plan.collisions[:10]:
                sys.stderr.write(f"  {c}\n")
            if len(plan.collisions) > 10:
                sys.stderr.write(f"  ... and {len(plan.collisions) - 10} more\n")
        return 1

    if args.dry_run:
        if not args.json:
            sys.stdout.write(
                f"dry run: {len(plan.actions)} artifact(s) -> {args.target_dir} "
                f"(layout={args.layout})\n"
            )
            for artifact, _dest in plan.actions[:20]:
                sys.stdout.write(
                    f"  [{artifact.type}] {artifact.name} "
                    f"<- {artifact.source.relative_to(ROOT)}\n"
                )
            if len(plan.actions) > 20:
                sys.stdout.write(f"  ... and {len(plan.actions) - 20} more\n")
        return 0

    try:
        apply_plan(plan, force=args.force)
        installed_artifacts = [artifact for artifact, _dest in plan.actions]
        manifest_path = write_manifest(
            args.target_dir, installed_artifacts, args.layout
        )
    except (OSError, ValueError) as exc:
        sys.stderr.write(f"error: {exc}\n")
        return 1
    if not args.json:
        sys.stdout.write(
            f"installed {len(plan.actions)} artifact(s) into {args.target_dir} "
            f"(layout={args.layout})\n"
        )
        sys.stdout.write(f"manifest: {manifest_path}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
