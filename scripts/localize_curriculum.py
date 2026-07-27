#!/usr/bin/env python3
"""Prepare, apply, and validate Turkish curriculum translations.

The translation bundle contains prose with immutable Markdown tokens replaced by
{{P<n>}} placeholders. Translators edit only each unit's ``translation`` value;
the apply step restores protected content and rejects structural drift.
"""

from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LESSON_GLOB = "phases/*/*/docs/en.md"
PHASE_GLOB = "phases/*/README.md"
PROTECTED_RE = re.compile(
    r"(`+[^`\n]+`+|https?://[^\s)>'\"]+|(?<!\w)[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+"
    r"|\$[^$\n]+\$|\{\{P\d+\}\})"
)
TERM_RE = re.compile(r"^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$")


@dataclass(frozen=True)
class Source:
    path: Path
    target: Path


def sources(root: Path = ROOT) -> list[Source]:
    found = [
        Source(path, path.with_name("tr.md"))
        for path in root.glob(LESSON_GLOB)
    ]
    found += [
        Source(path, path.with_name("README.tr.md"))
        for path in root.glob(PHASE_GLOB)
    ]
    return sorted(found, key=lambda item: str(item.path))


def digest(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def protect(text: str) -> tuple[str, list[str]]:
    values: list[str] = []

    def replace(match: re.Match[str]) -> str:
        values.append(match.group(0))
        return f"{{{{P{len(values) - 1}}}}}"

    return PROTECTED_RE.sub(replace, text), values


def translatable(line: str, in_fence: bool) -> bool:
    stripped = line.strip()
    if in_fence or not stripped or stripped.startswith(("<!--", "<")):
        return False
    if re.fullmatch(r"[-:| ]+", stripped):
        return False
    return bool(re.search(r"[A-Za-z]", stripped))


def make_bundle(selected: list[Source], root: Path = ROOT) -> dict:
    files = []
    for item in selected:
        text = item.path.read_text()
        units = []
        fence = False
        for number, line in enumerate(text.splitlines(keepends=True), 1):
            marker = line.lstrip().startswith("```")
            if marker:
                fence = not fence
            elif translatable(line, fence):
                body = line.rstrip("\r\n")
                protected, values = protect(body)
                units.append({
                    "line": number,
                    "source": protected,
                    "translation": protected,
                    "protected": values,
                })
        files.append({
            "source": str(item.path.relative_to(root)),
            "target": str(item.target.relative_to(root)),
            "source_sha256": digest(text),
            "units": units,
        })
    return {"version": 1, "locale": "tr", "files": files}


def restore(unit: dict) -> str:
    value = unit["translation"]
    placeholders = re.findall(r"\{\{P(\d+)\}\}", value)
    expected = [str(index) for index in range(len(unit["protected"]))]
    if Counter(placeholders) != Counter(expected):
        raise ValueError(
            f"line {unit['line']}: protected placeholders must contain exactly "
            f"{', '.join('{{P' + x + '}}' for x in expected)}"
        )
    for index, original in enumerate(unit["protected"]):
        value = value.replace(f"{{{{P{index}}}}}", original)
    return value


def apply_bundle(bundle: dict, root: Path = ROOT) -> None:
    for record in bundle["files"]:
        source = root / record["source"]
        target = root / record["target"]
        text = source.read_text()
        if digest(text) != record["source_sha256"]:
            raise ValueError(f"{record['source']}: source changed; regenerate the bundle")
        lines = text.splitlines(keepends=True)
        for unit in record["units"]:
            index = unit["line"] - 1
            ending = "\n" if lines[index].endswith("\n") else ""
            lines[index] = restore(unit) + ending
        target.write_text("".join(lines))
        validate_pair(source, target)


def immutable_lines(text: str) -> list[str]:
    result, fence = [], False
    for line in text.splitlines():
        marker = line.lstrip().startswith("```")
        if marker:
            fence = not fence
            result.append(line)
        elif fence or not translatable(line, False):
            result.append(line)
    return result


def protected_tokens(text: str) -> list[str]:
    return [match.group(0) for match in PROTECTED_RE.finditer(text)]


def validate_pair(source: Path, target: Path) -> None:
    original, translated = source.read_text(), target.read_text()
    if immutable_lines(original) != immutable_lines(translated):
        raise ValueError(f"{target}: fenced code or non-prose structure changed")
    required = Counter(protected_tokens(original))
    if any(translated.count(token) < count for token, count in required.items()):
        raise ValueError(f"{target}: code, URL, equation, or identifier changed")
    original_fences = sum(line.lstrip().startswith("```") for line in original.splitlines())
    translated_fences = sum(line.lstrip().startswith("```") for line in translated.splitlines())
    if original_fences % 2 or translated_fences % 2:
        raise ValueError(f"{target}: unbalanced fenced code block")


def terminology(root: Path = ROOT) -> list[str]:
    terms, inside = [], False
    for line in (root / "docs/translation-guide-tr.md").read_text().splitlines():
        if line.startswith("## Korunacak terimler"):
            inside = True
        elif inside and line.startswith("## "):
            break
        elif inside:
            match = TERM_RE.match(line)
            if match and match.group(1) not in {"İngilizce terim", "---"}:
                terms.append(match.group(1).strip())
    return terms


def validate_all(root: Path = ROOT) -> dict:
    all_sources = sources(root)
    translated = [item for item in all_sources if item.target.exists()]
    errors = []
    for item in translated:
        try:
            validate_pair(item.path, item.target)
        except ValueError as exc:
            errors.append(str(exc))
    known_terms = terminology(root)
    term_violations = []
    for item in translated:
        source_text, target_text = item.path.read_text(), item.target.read_text()
        for term in known_terms:
            if term.lower() in source_text.lower() and term.lower() not in target_text.lower():
                term_violations.append(f"{item.target.relative_to(root)}: missing preserved term {term!r}")
    report = {
        "locale": "tr",
        "total": len(all_sources),
        "translated": len(translated),
        "coverage_percent": round(100 * len(translated) / len(all_sources), 2),
        "errors": errors,
        "terminology_violations": term_violations,
    }
    return report


def choose(patterns: list[str], root: Path = ROOT) -> list[Source]:
    candidates = sources(root)
    if not patterns:
        return candidates
    return [
        item for item in candidates
        if any(item.path.match(pattern) or str(item.path.relative_to(root)).startswith(pattern)
               for pattern in patterns)
    ]


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    prepare = sub.add_parser("prepare", help="create a translation bundle")
    prepare.add_argument("--scope", action="append", default=[])
    prepare.add_argument("--output", type=Path, required=True)
    apply = sub.add_parser("apply", help="write translations from a bundle")
    apply.add_argument("bundle", type=Path)
    check = sub.add_parser("check", help="validate pages and print coverage")
    check.add_argument("--report", type=Path)
    args = parser.parse_args()

    try:
        if args.command == "prepare":
            selected = choose(args.scope)
            if not selected:
                raise ValueError("scope matched no curriculum sources")
            args.output.write_text(json.dumps(make_bundle(selected), ensure_ascii=False, indent=2) + "\n")
            print(f"Prepared {len(selected)} file(s) in {args.output}")
        elif args.command == "apply":
            apply_bundle(json.loads(args.bundle.read_text()))
            print(f"Applied {args.bundle}")
        else:
            report = validate_all()
            output = json.dumps(report, ensure_ascii=False, indent=2)
            print(output)
            if args.report:
                args.report.write_text(output + "\n")
            if report["errors"] or report["terminology_violations"]:
                return 1
    except (KeyError, OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
