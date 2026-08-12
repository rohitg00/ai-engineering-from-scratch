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
MANIFEST_SCHEMA_VERSION = 2
REVIEW_STATUS_BY_UPDATE_KIND = {
    "candidate_current": "approved_old_snapshot",
    "needs_figure_sync": "approved_mechanical",
    "metadata_label_localization": "approved_mechanical",
    "needs_substantive": "approved",
    "needs_substantive_and_figure": "approved",
    "needs_structural_fix": "approved",
    "needs_residual_translation": "approved",
    "new_certification": "approved",
}
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
    # A single-dollar math opener cannot be followed by a digit or slash:
    # ``$50`` and ``$/M`` are currency notation, not TeX. Display math and
    # symbolic inline math remain protected.
    r"(?<!\\)(?<!\$)(\$)(?![\$\d/])([^$\n]+?)(?<!\\)(\$)|"
    r"(\\\[)(.+?)(\\\])|"
    r"(\\\()(.+?)(\\\))"
)


@dataclass(frozen=True)
class MarkdownShape:
    fence_tags: tuple[str, ...]
    fence_blocks: tuple[str, ...]
    fences_balanced: bool
    figure_ids: tuple[str, ...]
    inline_code: tuple[tuple[str, str], ...]
    link_targets: tuple[str, ...]
    urls: tuple[str, ...]
    reference_uses: tuple[str, ...]
    reference_definitions: tuple[tuple[str, str], ...]
    math: tuple[tuple[str, str, str], ...]
    heading_levels: tuple[int, ...]


def _without_fences(text: str) -> tuple[str, list[str], list[str], list[str], bool]:
    """Mask fenced blocks while retaining their ordered tags and figure IDs."""
    lines = text.splitlines(keepends=True)
    masked: list[str] = []
    tags: list[str] = []
    blocks: list[str] = []
    figures: list[str] = []
    opening: tuple[str, int, str, str] | None = None
    opening_line = ""
    body: list[str] = []

    for line in lines:
        candidate = line.rstrip("\r\n")
        match = FENCE_RE.match(candidate)
        if opening is None:
            if not match:
                masked.append(line)
                continue
            marker, info = match.groups()
            tag = info.strip().split(maxsplit=1)[0] if info.strip() else ""
            tags.append(tag)
            opening = (marker[0], len(marker), tag, info.strip())
            opening_line = line
            body = []
            masked.append("\n" if line.endswith("\n") else "")
            continue

        char, minimum, tag, info = opening
        close = re.match(rf"^ {{0,3}}{re.escape(char)}{{{minimum},}}[ \t]*$", candidate)
        if close:
            blocks.append(opening_line + "".join(body) + line)
            if tag == "figure":
                identifiers = [value.strip() for value in body if value.strip()]
                figures.extend(identifiers)
            opening = None
            opening_line = ""
            body = []
        else:
            body.append(line)
        masked.append("\n" if line.endswith("\n") else "")

    return "".join(masked), tags, blocks, figures, opening is None


def _strip_url_punctuation(url: str) -> str:
    return url.rstrip(".,;:!?'\"")


def markdown_shape(text: str) -> MarkdownShape:
    prose, tags, blocks, figures, balanced = _without_fences(text)
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
        fence_blocks=tuple(blocks),
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
    target_prose = _without_fences(target)[0]
    labels = {
        "fence_tags": "fenced code tags/count/order",
        "fence_blocks": "fenced code bodies/opening metadata",
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
    errors = [
        label
        for field, label in labels.items()
        if getattr(expected, field) != getattr(actual, field)
    ]
    metadata_prose = INLINE_CODE_RE.sub(lambda match: " " * len(match.group(0)), target_prose)
    metadata_prose = re.sub(r"\]\([^)\n]*\)", "]()", metadata_prose)
    metadata_surface = "\n".join(metadata_prose.splitlines()[:15])
    if re.search(r"\*\*[A-Z][A-Za-z ]+:\*\*", metadata_surface):
        errors.append("visible English metadata labels")
    if re.search(r"\b(?:Phase|Lessons?|lesson|lessons|minutes?|hours?)\b", metadata_surface):
        errors.append("visible English metadata values")
    for alt_text in re.findall(r"!\[([^\]\n]+)\]\(", target_prose):
        if not re.search(r"[А-Яа-яЁё]", alt_text) and len(re.findall(r"[A-Za-z]{2,}", alt_text)) >= 3:
            errors.append("visible English image alt text")
            break
    return errors


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
    if value.get("schema_version") != MANIFEST_SCHEMA_VERSION:
        raise ValueError(f"schema_version must be {MANIFEST_SCHEMA_VERSION}")
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
    expected_targets = {expected_target(source) for source in inventory}
    actual_targets = {
        path.relative_to(root).as_posix()
        for translated_root in (
            root / "i18n/ru/phases",
            root / "i18n/ru/certifications/claude/lessons",
        )
        if translated_root.is_dir()
        for path in translated_root.rglob("docs/ru.md")
        if path.is_file()
    }
    for target in sorted(actual_targets - expected_targets):
        errors.append(f"orphan target: {target}")
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
            elif item.get("status") != "approved":
                status, detail = "structurally_invalid", "approval metadata: status is not approved"
            else:
                update_kind = item.get("update_kind")
                expected_review_status = (
                    REVIEW_STATUS_BY_UPDATE_KIND.get(update_kind)
                    if isinstance(update_kind, str)
                    else None
                )
                review = item.get("review")
                if expected_review_status is None:
                    status, detail = "structurally_invalid", "approval metadata: unsupported update_kind"
                elif item.get("review_status") != expected_review_status:
                    status, detail = "structurally_invalid", "approval metadata: unexpected review_status"
                elif expected_review_status == "approved" and (
                    not isinstance(review, dict) or review.get("verdict") != "approve"
                ):
                    status, detail = "structurally_invalid", "approval metadata: structured reviewer approval missing"
                else:
                    target_bytes = target_file.read_bytes()
                    if hashlib.sha256(target_bytes).hexdigest() != item.get("target_sha256"):
                        status, detail = "structurally_invalid", "target SHA-256 differs from manifest"
                    else:
                        try:
                            source_text = source_bytes.decode("utf-8")
                            target_text = target_bytes.decode("utf-8")
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
