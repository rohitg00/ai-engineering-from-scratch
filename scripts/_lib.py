"""Shared helpers for scripts/ tools.

Currently provides:
- parse_frontmatter: minimal YAML-subset parser for `--- ... ---` blocks in markdown.
- validate_repository_directory/file: containment checks for lesson artifacts.
- validate_skill_bundle: safe, deterministic file discovery for skill bundles.

No external dependencies. Python 3.10+ (PEP 604 unions in type hints).
"""

from __future__ import annotations

import os
from pathlib import Path


class BundleValidationError(ValueError):
    """Raised when a skill bundle is unsafe or malformed."""


class ArtifactPathError(ValueError):
    """Raised when a lesson artifact path is unsafe or escapes the repository."""


def _resolve_within_repository(
    target: Path,
    repository_root: Path,
    label: str,
    error_type: type[ValueError],
) -> Path:
    try:
        resolved_target = target.resolve(strict=True)
        resolved_root = repository_root.resolve(strict=True)
    except (OSError, RuntimeError) as error:
        raise error_type(f"could not resolve {label}: {target}") from error
    if not resolved_target.is_relative_to(resolved_root):
        raise error_type(f"{label} escapes the repository: {target}")
    return resolved_target


def validate_repository_directory(
    directory: Path, repository_root: Path, label: str
) -> Path:
    """Resolve a regular directory and require it to remain in the repository."""

    if directory.is_symlink():
        _resolve_within_repository(
            directory, repository_root, label, ArtifactPathError
        )
        raise ArtifactPathError(f"{label} must be a regular directory: {directory}")
    if not directory.is_dir():
        raise ArtifactPathError(f"{label} must be a regular directory: {directory}")
    return _resolve_within_repository(
        directory, repository_root, label, ArtifactPathError
    )


def validate_repository_file(file_path: Path, repository_root: Path, label: str) -> Path:
    """Resolve a non-symlink regular file contained by the repository."""

    if file_path.is_symlink() or not file_path.is_file():
        raise ArtifactPathError(f"{label} must be a regular file: {file_path}")
    return _resolve_within_repository(
        file_path, repository_root, label, ArtifactPathError
    )


def validate_skill_bundle(bundle_root: Path, repository_root: Path) -> list[str]:
    """Return a validated bundle's relative POSIX file paths in string order."""

    if bundle_root.is_symlink() or not bundle_root.is_dir():
        raise BundleValidationError(
            f"skill bundle must be a regular directory: {bundle_root}"
        )
    _resolve_within_repository(
        bundle_root, repository_root, "skill bundle", BundleValidationError
    )

    skill_path = bundle_root / "SKILL.md"
    if skill_path.is_symlink() or not skill_path.is_file():
        raise BundleValidationError(
            f"skill bundle entrypoint must be a regular file: {skill_path}"
        )

    bundle_files: list[str] = []
    for current, dirs, files in os.walk(bundle_root, followlinks=False):
        dirs.sort()
        files.sort()
        current_path = Path(current)
        for name in dirs:
            entry = current_path / name
            if entry.is_symlink() or not entry.is_dir():
                raise BundleValidationError(
                    f"skill bundle contains an unsafe directory entry: {entry}"
                )
        for name in files:
            entry = current_path / name
            if entry.is_symlink() or not entry.is_file():
                raise BundleValidationError(
                    f"skill bundle contains an unsafe file entry: {entry}"
                )
            bundle_files.append(entry.relative_to(bundle_root).as_posix())
    return sorted(bundle_files)


def parse_frontmatter(text: str) -> dict[str, object] | None:
    """Parse a YAML-subset frontmatter block at the top of a markdown string.

    Returns the parsed key/value mapping, or None when no frontmatter is present
    or the closing `---` is missing.

    Supports:
    - bare strings: `key: value`
    - single-quoted: `key: 'value'`
    - double-quoted: `key: "value"`
    - lists: `key: [a, b, "c"]`
    - inline comment lines beginning with `#`
    """
    if not text.startswith("---\n"):
        return None
    # Closing delimiter: "\n---\n" inside the file, or "\n---" at EOF.
    end = text.find("\n---\n", 4)
    if end == -1 and text.endswith("\n---"):
        end = len(text) - 4
    if end == -1:
        return None
    block = text[4:end].strip("\n")
    result: dict[str, object] = {}
    for raw in block.splitlines():
        # Anchor at column 0: skip comments + indented lines.
        if not raw or raw.startswith("#") or raw[0] in (" ", "\t"):
            continue
        if ":" not in raw:
            continue
        key, _, value = raw.partition(":")
        key = key.strip()
        if not key:
            continue
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            result[key] = (
                [item.strip().strip("'\"") for item in inner.split(",") if item.strip()]
                if inner
                else []
            )
        elif (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            result[key] = value[1:-1]
        else:
            result[key] = value
    return result
