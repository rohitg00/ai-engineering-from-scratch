#!/usr/bin/env python3
"""Compare published lesson translations with the current English lessons.

Each language on the translations branch records the sha256 of the English
source it translated in i18n/<lang>/.cache/<phase>.json. A record that differs
from the current docs/en.md is stale, a lesson with no record is missing, and a
record for a lesson that no longer exists is orphaned.

scripts/translate_matrix.py uses this to rerun every automatic (language,
phase) leg that has drifted, so a cancelled or failed run is repaired by the
next one. The command line prints the same comparison for every registered
language, including contributor-maintained ones, so a fix to an English lesson
names the reviewed translations that must be synced by hand.

Usage:
    python3 scripts/translation_freshness.py [--ref origin/translations] [--summary FILE]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

REF = "origin/translations"
NAME = re.compile(r"^[0-9]{2}-[a-z0-9][a-z0-9-]*$")
KINDS = ("stale", "missing", "orphaned")
LESSON_FILE = re.compile(r"^i18n/([^/]+)/(phases/[0-9]{2}-[a-z0-9-]+/[0-9]{2}-[a-z0-9-]+)/docs/([^/]+)\.md$")


def source_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def phase_dirs(root: Path) -> list[str]:
    return sorted(
        path.name
        for path in (root / "phases").iterdir()
        if path.is_dir() and not path.is_symlink() and NAME.match(path.name)
    )


def lesson_sources(root: Path, phase: str) -> dict[str, str]:
    sources = {}
    phase_dir = root / "phases" / phase
    if not phase_dir.is_dir():
        return sources
    for lesson in sorted(phase_dir.iterdir()):
        doc = lesson / "docs" / "en.md"
        if lesson.is_dir() and NAME.match(lesson.name) and doc.is_file():
            sources[f"phases/{phase}/{lesson.name}/docs/en.md"] = source_hash(doc.read_text(encoding="utf-8"))
    return sources


def git(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=root, check=False, capture_output=True, text=True, encoding="utf-8")


def ref_available(root: Path, ref: str) -> bool:
    return git(root, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}").returncode == 0


def published_files(root: Path, ref: str) -> set[str]:
    listed = git(root, "ls-tree", "-r", "--name-only", ref, "i18n/")
    return set(listed.stdout.split("\n")) if listed.returncode == 0 else set()


def published_cache(root: Path, ref: str, lang: str, phase: str) -> dict[str, str]:
    shown = git(root, "show", f"{ref}:i18n/{lang}/.cache/{phase}.json")
    if shown.returncode != 0:
        return {}
    try:
        cache = json.loads(shown.stdout)
    except ValueError:
        return {}
    return cache if isinstance(cache, dict) else {}


def drift(sources: dict[str, str], cache: dict[str, str]) -> dict[str, list[str]]:
    return {
        "stale": sorted(key for key, digest in sources.items() if key in cache and cache[key] != digest),
        "missing": sorted(key for key in sources if key not in cache),
        "orphaned": sorted(key for key in cache if key not in sources),
    }


def drifted_legs(root: Path, ref: str, langs: list[str], phases: list[str]) -> list[tuple[str, str]]:
    sources = {phase: lesson_sources(root, phase) for phase in phases}
    files = published_files(root, ref)
    legs = []
    for lang in langs:
        lessons = published_lessons(files, lang)
        for phase in phases:
            found = drift(sources[phase], published_cache(root, ref, lang, phase))
            unpublished = any(key not in lessons for key in sources[phase])
            if unpublished or any(found[kind] for kind in KINDS):
                legs.append((lang, phase))
    return legs


def published_lessons(files: set[str], lang: str) -> set[str]:
    found = set()
    for name in files:
        match = LESSON_FILE.match(name)
        if match and match.group(1) == lang and match.group(3) == lang:
            found.add(f"{match.group(2)}/docs/en.md")
    return found


def lesson_name(key: str) -> str:
    return key[len("phases/") : -len("/docs/en.md")]


def report(root: Path, ref: str, registry: list[dict]) -> tuple[list[str], list[str]]:
    files = published_files(root, ref)
    phases = phase_dirs(root)
    sources = {phase: lesson_sources(root, phase) for phase in phases}
    lines = [
        "| Language | Kind | Current | Stale | Missing | Orphaned | Unrecorded |",
        "|---|---|---|---|---|---|---|",
    ]
    warnings = []
    for entry in registry:
        lang = entry["code"]
        lessons = published_lessons(files, lang)
        if entry.get("source") is True or not (
            lessons or any(name.startswith(f"i18n/{lang}/.cache/") for name in files)
        ):
            continue
        automatic = entry.get("ci") is True
        totals = {kind: [] for kind in KINDS}
        current = 0
        recorded = set()
        for phase in phases:
            cache = published_cache(root, ref, lang, phase)
            recorded |= set(cache)
            found = drift(sources[phase], cache)
            for kind in KINDS:
                totals[kind].extend(found[kind])
            current += sum(1 for key, digest in sources[phase].items() if cache.get(key) == digest)
        unrecorded = sorted(lessons - recorded)
        kind = "automatic" if automatic else "contributor-maintained"
        counts = " | ".join(str(len(totals[name])) for name in KINDS)
        lines.append(f"| {lang} | {kind} | {current} | {counts} | {len(unrecorded)} |")
        if totals["stale"]:
            action = "the next translate run replaces them" if automatic else "review and sync them by hand"
            names = ", ".join(lesson_name(key) for key in totals["stale"])
            warnings.append(f"{lang}: {len(totals['stale'])} translation(s) predate their English lesson; {action}: {names}")
        if unrecorded:
            names = ", ".join(lesson_name(key) for key in unrecorded)
            warnings.append(
                f"{lang}: {len(unrecorded)} published translation(s) have no source hash, so their freshness is unknown; "
                f"add the English sha256 to i18n/{lang}/.cache/<phase>.json: {names}"
            )
    return lines, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--ref", default=REF)
    parser.add_argument("--summary", help="append the Markdown table to this file")
    args = parser.parse_args()
    root = Path.cwd()
    if not ref_available(root, args.ref):
        print(f"{args.ref} is not available", file=sys.stderr)
        return 1
    registry = json.loads((root / "languages.json").read_text(encoding="utf-8"))["languages"]
    lines, warnings = report(root, args.ref, registry)
    table = "\n".join(lines) + "\n"
    print(table, end="")
    for warning in warnings:
        print(f"::warning title=Outdated translations::{warning}")
    if args.summary:
        with open(args.summary, "a", encoding="utf-8") as handle:
            handle.write("## Translation freshness\n\n" + table)
            for warning in warnings:
                handle.write(f"\n- {warning}")
            handle.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
