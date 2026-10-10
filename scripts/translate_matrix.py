#!/usr/bin/env python3
"""Choose the lesson and interface-string legs of .github/workflows/translate.yml.

Reads EVENT, REQUESTED, REQUESTED_PHASE, BEFORE, AFTER and FORCED from the
environment, runs from the repository root, and prints the lessons= and
ui_langs= lines that the workflow appends to $GITHUB_OUTPUT.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

REGISTRY = "languages.json"
PHASE_NAME = re.compile(r"^[0-9]{2}-[a-z0-9-]+$")
COMMIT = re.compile(r"^(?:[0-9a-f]{40}|[0-9a-f]{64})$")
UI_SOURCES = frozenset({"site/ui-strings.json", "scripts/translate_ui_strings.py"})
LOGIC_SOURCES = frozenset(
    {
        ".github/workflows/translate.yml",
        ".github/translate-requirements.txt",
        "scripts/translate_lessons.py",
        "scripts/build_catalog.py",
        "scripts/_lib.py",
    }
)


class RangeUnavailable(Exception):
    pass


def note(message: str) -> None:
    print(message, file=sys.stderr)


def fail(message: str) -> None:
    note(message)
    raise SystemExit(1)


def listing(items) -> str:
    return ", ".join(items) or "none"


def targets(registry: list[dict]) -> list[dict]:
    return [entry for entry in registry if entry.get("source") is not True]


def automatic(registry: list[dict]) -> tuple[list[str], list[str]]:
    languages = targets(registry)
    langs = [entry["code"] for entry in languages if entry.get("ci") is True]
    ui_langs = [
        entry["code"]
        for entry in languages
        if entry.get("ci") is True or entry.get("site") is True
    ]
    return langs, ui_langs


def requested_langs(registry: list[dict], requested: str) -> list[str]:
    known = {entry["code"] for entry in targets(registry)}
    return sorted({code for code in requested.split(" ") if code and code in known})


def phase_dirs(root: Path) -> list[str]:
    return sorted(
        path.name
        for path in (root / "phases").iterdir()
        if path.is_dir() and not path.is_symlink() and PHASE_NAME.match(path.name)
    )


def every_leg(langs: list[str], phases: list[str]) -> list[tuple[str, str]]:
    return [(lang, phase) for lang in langs for phase in phases]


def lesson_phase(path: str) -> str | None:
    parts = path.split("/")
    if len(parts) >= 4 and parts[0] == "phases" and parts[-2:] == ["docs", "en.md"]:
        return parts[1]
    return None


def select_push(
    changed: set[str],
    previous: list[dict] | None,
    langs: list[str],
    ui_langs: list[str],
    phases: list[str],
) -> tuple[list[tuple[str, str]], list[str], list[str]]:
    logic = sorted(changed & LOGIC_SOURCES)
    if logic:
        return every_leg(langs, phases), ui_langs, [
            f"translation code changed: {listing(logic)}; every leg runs"
        ]

    old_langs, old_ui_langs = automatic(previous) if previous is not None else (langs, ui_langs)
    new_langs = [code for code in langs if code not in old_langs]
    new_ui_langs = [code for code in ui_langs if code not in old_ui_langs]
    touched = sorted({lesson_phase(path) for path in changed} & set(phases))
    ui_sources = sorted(changed & UI_SOURCES)

    lessons = [
        (lang, phase)
        for lang, phase in every_leg(langs, phases)
        if phase in touched or lang in new_langs
    ]
    selected_ui = ui_langs if ui_sources else new_ui_langs
    return lessons, selected_ui, [
        f"phases with changed English lessons: {listing(touched)}",
        f"languages newly automatic: {listing(new_langs)}",
        f"interface sources changed: {listing(ui_sources)}",
        f"languages newly on the site: {listing(new_ui_langs)}",
    ]


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], check=check, capture_output=True, text=True)


def has_commit(sha: str) -> bool:
    return git("cat-file", "-e", f"{sha}^{{commit}}", check=False).returncode == 0


def push_range(before: str, after: str, forced: str) -> tuple[set[str], list[dict] | None]:
    if forced == "true":
        raise RangeUnavailable("the push rewrote history")
    if not COMMIT.match(before) or not before.strip("0"):
        raise RangeUnavailable(f"the push has no previous commit ({before or 'empty'})")
    if not COMMIT.match(after):
        raise RangeUnavailable(f"the pushed commit id is not usable ({after or 'empty'})")
    if not has_commit(before):
        fetch = git("fetch", "--no-tags", "--no-recurse-submodules", "--depth=1", "origin", before, check=False)
        sys.stderr.write(fetch.stderr)
        if not has_commit(before):
            raise RangeUnavailable(f"commit {before} is not available")
    try:
        names = git("diff", "--name-only", "--no-renames", "-z", before, after).stdout
    except subprocess.CalledProcessError as error:
        raise RangeUnavailable(f"the diff {before}..{after} failed: {error.stderr.strip()}") from error
    changed = {name for name in names.split("\0") if name}
    if REGISTRY not in changed:
        return changed, None
    try:
        previous = json.loads(git("show", f"{before}:{REGISTRY}").stdout)["languages"]
    except (subprocess.CalledProcessError, ValueError, KeyError, TypeError) as error:
        raise RangeUnavailable(f"{REGISTRY} at {before} cannot be read") from error
    if not isinstance(previous, list) or not all(isinstance(entry, dict) for entry in previous):
        raise RangeUnavailable(f"{REGISTRY} at {before} has no language list")
    return changed, previous


def main() -> None:
    root = Path.cwd()
    registry = json.loads((root / REGISTRY).read_text(encoding="utf-8"))["languages"]
    phases = phase_dirs(root)
    requested = os.environ.get("REQUESTED", "")
    requested_phase = os.environ.get("REQUESTED_PHASE", "")

    if requested:
        langs = requested_langs(registry, requested)
        if not langs:
            fail("no registered non-source languages selected")
        ui_langs = list(langs)
    else:
        langs, ui_langs = automatic(registry)
    if requested_phase:
        if requested_phase not in phases:
            fail(f"unknown phase: {requested_phase}")
        phases = [requested_phase]
    lessons = every_leg(langs, phases)

    if os.environ.get("EVENT") == "push":
        before = os.environ.get("BEFORE", "")
        after = os.environ.get("AFTER", "")
        try:
            changed, previous = push_range(before, after, os.environ.get("FORCED", ""))
        except RangeUnavailable as reason:
            note(f"{reason}; every leg runs")
        else:
            note(f"push {before[:12]}..{after[:12]} changed {len(changed)} file(s)")
            lessons, ui_langs, reasons = select_push(changed, previous, langs, ui_langs, phases)
            for reason in reasons:
                note(reason)

    note(f"{len(lessons)} lesson leg(s), {len(ui_langs)} interface-string leg(s)")
    matrix = [{"lang": lang, "phase": phase} for lang, phase in lessons]
    print("lessons=" + json.dumps(matrix, separators=(",", ":")))
    print("ui_langs=" + json.dumps(ui_langs, separators=(",", ":")))


if __name__ == "__main__":
    main()
