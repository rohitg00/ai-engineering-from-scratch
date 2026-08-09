#!/usr/bin/env python3
"""Fail-closed structural and freshness audit for Russian lesson translations.

The canonical inventory is every ``docs/en.md`` below ``phases`` and
``certifications/claude/lessons``.  Each manifest entry certifies the SHA-256
of the exact English bytes from which its Russian target was translated.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

SOURCE_ROOTS = ("phases", "certifications/claude/lessons")
DEFAULT_MANIFEST = "i18n/ru/.quality/manifest.json"
FENCE_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})([^\n]*)$", re.MULTILINE)
HEADING_RE = re.compile(r"^ {0,3}(#{1,6})(?:[ \t]+|$)", re.MULTILINE)
INLINE_CODE_RE = re.compile(r"(`+)(?!`)(.+?)(?<!`)\1(?!`)")
INLINE_LINK_RE = re.compile(r"!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)")
REFERENCE_USE_RE = re.compile(r"(?<!!)\[[^\]\n]+\]\[([^\]\n]*)\]")
REFERENCE_DEF_RE = re.compile(
    r"^ {0,3}\[([^\]\n]+)\]:[ \t]*(?:<([^>\n]+)>|([^\s]+))", re.MULTILINE
)
URL_RE = re.compile(r"https?://[^\s<>]+")
MATH_RE = re.compile(
    r"(?s)(\$\$)(.+?)(\$\$)|"
    r"(?<!\\)(?<!\$)(\$)(?!\$)([^$\n]+?)(?<!\\)(\$)|"
    r"(\\\[)(.+?)(\\\])|"
    r"(\\\()(.+?)(\\\))"
)


@dataclass(frozen=True)
class MarkdownShape:
    fence_tags: tuple[str, ...]
    fences_balanced: bool
    figure_ids: tuple[str, ...]
    inline_code: tuple[tuple[str, str], ...]
    link_targets: tuple[str, ...]
    urls: tuple[str, ...]
    reference_uses: tuple[str, ...]
    reference_definitions: tuple[tuple[str, str], ...]
    math: tuple[tuple[str, str, str], ...]
    heading_levels: tuple[int, ...]


def _without_fences(text: str) -> tuple[str, list[str], list[str], bool]:
    """Mask fenced blocks while retaining their ordered tags and figure IDs."""
    lines = text.splitlines(keepends=True)
    masked: list[str] = []
    tags: list[str] = []
    figures: list[str] = []
    opening: tuple[str, int, str] | None = None
    body: list[str] = []

    for line in lines:
        candidate = line.rstrip("\r\n")
        match = re.match(r"^ {0,3}(`{3,}|~{3,})([^\n]*)$", candidate)
        if opening is None:
            if not match:
                masked.append(line)
                continue
            marker, info = match.groups()
            tag = info.strip().split(maxsplit=1)[0] if info.strip() else ""
            tags.append(tag)
            opening = (marker[0], len(marker), tag)
            body = []
            masked.append("\n" if line.endswith("\n") else "")
            continue

        char, minimum, tag = opening
        close = re.match(rf"^ {{0,3}}{re.escape(char)}{{{minimum},}}[ \t]*$", candidate)
        if close:
            if tag == "figure":
                identifiers = [value.strip() for value in body if value.strip()]
                figures.extend(identifiers)
            opening = None
            body = []
        else:
            body.append(candidate)
        masked.append("\n" if line.endswith("\n") else "")

    return "".join(masked), tags, figures, opening is None


def _strip_url_punctuation(url: str) -> str:
    return url.rstrip(".,;:!?'\"")


def markdown_shape(text: str) -> MarkdownShape:
    prose, tags, figures, balanced = _without_fences(text)
    inline = tuple((match.group(1), match.group(2)) for match in INLINE_CODE_RE.finditer(prose))
    no_code = INLINE_CODE_RE.sub(lambda match: " " * len(match.group(0)), prose)

    link_targets = tuple(
        match.group(1)[1:-1] if match.group(1).startswith("<") else match.group(1)
        for match in INLINE_LINK_RE.finditer(no_code)
    )
    urls = tuple(_strip_url_punctuation(match.group(0)) for match in URL_RE.finditer(no_code))
    reference_uses = tuple(
        (match.group(1) or match.group(0).split("][", 1)[0][1:]).strip().casefold()
        for match in REFERENCE_USE_RE.finditer(no_code)
    )
    reference_definitions = tuple(
        (match.group(1).strip().casefold(), match.group(2) or match.group(3))
        for match in REFERENCE_DEF_RE.finditer(no_code)
    )

    math: list[tuple[str, str, str]] = []
    for match in MATH_RE.finditer(no_code):
        groups = match.groups()
        for offset in (0, 3, 6, 9):
            if groups[offset] is not None:
                math.append((groups[offset], groups[offset + 1], groups[offset + 2]))
                break

    return MarkdownShape(
        fence_tags=tuple(tags),
        fences_balanced=balanced,
        figure_ids=tuple(figures),
        inline_code=inline,
        link_targets=link_targets,
        urls=urls,
        reference_uses=reference_uses,
        reference_definitions=reference_definitions,
        math=tuple(math),
        heading_levels=tuple(len(match.group(1)) for match in HEADING_RE.finditer(no_code)),
    )


def structural_errors(source: str, target: str) -> list[str]:
    expected = markdown_shape(source)
    actual = markdown_shape(target)
    labels = {
        "fence_tags": "fenced code tags/count/order",
        "fences_balanced": "balanced fenced code",
        "figure_ids": "figure IDs/order",
        "inline_code": "inline code tokens",
        "link_targets": "URL/link targets",
        "urls": "URLs",
        "reference_uses": "reference links",
        "reference_definitions": "reference link definitions",
        "math": "formula delimiters/protected math",
        "heading_levels": "heading-level sequence",
    }
    return [
        label
        for field, label in labels.items()
        if getattr(expected, field) != getattr(actual, field)
    ]


def source_inventory(root: Path) -> set[str]:
    return {
        path.relative_to(root).as_posix()
        for source_name in SOURCE_ROOTS
        for path in (root / source_name).rglob("docs/en.md")
        if path.is_file()
    }


def expected_target(source: str) -> str:
    path = PurePosixPath(source)
    return (PurePosixPath("i18n/ru") / path.parent / "ru.md").as_posix()


def load_manifest(path: Path) -> dict[str, Any]:
    raw = path.read_text(encoding="utf-8")
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("top level must be an object")
    if value.get("locale") != "ru":
        raise ValueError("locale must be 'ru'")
    if not isinstance(value.get("items"), list):
        raise ValueError("items must be a list")
    return value


def validate_manifest(root: Path, manifest: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
    items: list[dict[str, Any]] = []
    errors: list[str] = []
    for index, item in enumerate(manifest["items"]):
        if not isinstance(item, dict):
            errors.append(f"item {index} is not an object")
            continue
        source = item.get("source")
        target = item.get("target")
        if not isinstance(source, str) or not isinstance(target, str):
            errors.append(f"item {index} needs string source and target")
            continue
        if target != expected_target(source):
            errors.append(f"wrong target for {source}: {target}")
        recorded_hash = item.get("source_sha256", item.get("current_source_sha256"))
        if not isinstance(recorded_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", recorded_hash):
            errors.append(f"invalid source SHA-256 for {source}")
        items.append(item)

    inventory = source_inventory(root)
    sources = [item["source"] for item in items]
    source_set = set(sources)
    for source in sorted(inventory - source_set):
        errors.append(f"manifest incomplete: missing {source}")
    for source in sorted(source_set - inventory):
        errors.append(f"manifest contains unknown source: {source}")
    for source in sorted({value for value in sources if sources.count(value) > 1}):
        errors.append(f"manifest duplicate source: {source}")
    return items, errors


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--manifest", type=Path, help="manifest path (relative paths use --root)")
    parser.add_argument(
        "--paths",
        nargs="+",
        metavar="PATH",
        help="audit only known source or Russian target paths (manifest completeness still enforced)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    root = args.root.resolve()
    manifest_path = args.manifest or Path(DEFAULT_MANIFEST)
    if not manifest_path.is_absolute():
        manifest_path = root / manifest_path
    try:
        manifest = load_manifest(manifest_path)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        print(f"manifest error: {error}", file=sys.stderr)
        return 2

    items, manifest_errors = validate_manifest(root, manifest)
    if manifest_errors:
        for error in manifest_errors:
            print(error, file=sys.stderr)
        return 2

    requested = set(args.paths or ())
    known_paths = {item["source"] for item in items} | {item["target"] for item in items}
    unknown = sorted(requested - known_paths)
    if unknown:
        for path in unknown:
            print(f"unknown --paths entry: {path}", file=sys.stderr)
        return 2
    selected = {
        item["source"]
        for item in items
        if not requested or item["source"] in requested or item["target"] in requested
    }

    failed = False
    counts = {status: 0 for status in ("missing", "stale", "structurally_invalid", "approved")}
    for item in items:
        source = item["source"]
        if source not in selected:
            continue
        source_file = root / source
        target_file = root / item["target"]
        if not target_file.is_file():
            status, detail = "missing", "target does not exist"
        else:
            source_bytes = source_file.read_bytes()
            recorded_hash = item.get("source_sha256", item.get("current_source_sha256"))
            if hashlib.sha256(source_bytes).hexdigest() != recorded_hash:
                status, detail = "stale", "source SHA-256 differs from manifest"
            else:
                try:
                    source_text = source_bytes.decode("utf-8")
                    target_text = target_file.read_text(encoding="utf-8")
                except UnicodeDecodeError:
                    status, detail = "structurally_invalid", "target is not UTF-8"
                else:
                    if not target_text.strip():
                        status, detail = "structurally_invalid", "target is empty"
                    else:
                        errors = structural_errors(source_text, target_text)
                        if errors:
                            status, detail = "structurally_invalid", "; ".join(errors)
                        else:
                            status, detail = "approved", ""
        counts[status] += 1
        failed |= status != "approved"
        suffix = f": {detail}" if detail else ""
        print(f"{status} {source}{suffix}")

    print("summary " + " ".join(f"{key}={value}" for key, value in counts.items()))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
