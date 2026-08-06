#!/usr/bin/env python3
"""Generate pytest test skeletons for lessons that have code but no tests.

This script reads each lesson's Python source files and extracts function /
class signatures so the generated test skeleton is tailored to the actual
code — not a blind copy-paste.  The resulting file is placed at
``code/tests/test_main.py`` and is a starting point for contributors.

Usage:
    python3 scripts/scaffold_tests.py                    # dry-run, report only
    python3 scripts/scaffold_tests.py --write            # create test files
    python3 scripts/scaffold_tests.py --phase 14          # single phase
    python3 scripts/scaffold_tests.py --write --phase 14  # write one phase

Exit codes:
    0 — success
    1 — no lessons matched

Stdlib only. Python 3.10+.
"""

from __future__ import annotations

import argparse
import ast
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHASES_DIR = ROOT / "phases"

PHASE_DIR_RE = re.compile(r"^([0-9]{2})-[a-z0-9][a-z0-9-]*[a-z0-9]$")
LESSON_DIR_RE = re.compile(r"^[0-9]{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$")


def _extract_top_level_defs(source: str) -> list[str]:
    """Parse a Python source file and return the names of top-level
    callables (functions, async functions, and classes)."""
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    names: list[str] = []
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.FunctionDef):
            names.append(node.name)
        elif isinstance(node, ast.AsyncFunctionDef):
            names.append(node.name)
        elif isinstance(node, ast.ClassDef):
            names.append(node.name)
    return names


def _generate_test_module(
    lesson_path: str,
    py_files: dict[str, list[str]],  # filename → list of top-level def names
) -> str:
    """Produce the content of a test file for one lesson."""
    rel = lesson_path
    lines: list[str] = [
        f'"""Tests for {rel}.',
        "",
        "Auto-generated skeleton.  Replace placeholder assertions with real",
        "test logic.  Every public name listed below should have at least one",
        'test that verifies correct behaviour on both "happy path" and edge-case',
        "inputs.",
        '"""',
        "",
        "import pytest",
    ]

    # Import the primary module(s)
    has_any = False
    for fname in sorted(py_files):
        if not py_files[fname]:
            continue
        has_any = True
        # Derive import path: e.g. phases/14-.../01-.../code/main.py
        # We can't easily import from here, but we can reference the path.
        lines.append("")
        lines.append("# To import the code under test, add the lesson")
        lines.append("# directory to sys.path or install as a package:")
        lines.append("#   import sys")
        lines.append(f"#   sys.path.insert(0, '{rel}/code')")
        lines.append(f"#   from {fname.replace('.py', '')} import {', '.join(py_files[fname][:5])}")
        break  # Only show the import hint for the first file

    if not has_any:
        lines.append("")
        lines.append("# No callable top-level definitions found — add tests manually.")
        return "\n".join(lines) + "\n"

    # Generate a stub test for each public name
    all_names: list[tuple[str, str]] = []
    for fname in sorted(py_files):
        for name in py_files[fname]:
            all_names.append((fname, name))

    lines.append("")
    lines.append("")
    lines.append("# ── Generated test stubs ─────────────────────────────────────────")
    lines.append("")
    lines.append("# Replace each 'pytest.skip' with real assertions once you've")
    lines.append("# verified the behaviour manually or via the lesson docs.")
    lines.append("")

    for fname, name in all_names:
        test_name = f"test_{name}"
        lines.append("")
        lines.append(f"def {test_name}():")
        lines.append(f'    """Test {name} from {fname}."""')
        lines.append(f"    pytest.skip('TODO: write test for {name}')")

    lines.append("")
    lines.append("")
    lines.append("# ── Edge-case helpers ─────────────────────────────────────────")
    lines.append("")
    lines.append("# Tests below should cover:")
    lines.append("#   - Empty / zero inputs")
    lines.append("#   - Single-element inputs")
    lines.append("#   - Large / many-element inputs")
    lines.append("#   - Negative values (where applicable)")
    lines.append("#   - Type errors / invalid inputs (where the code should raise)")
    lines.append("")

    return "\n".join(lines) + "\n"


def find_lessons_needing_tests(phase_filter: int | None) -> list[Path]:
    """Return lessons that have .py files but no tests/ directory."""
    needing: list[Path] = []
    if not PHASES_DIR.is_dir():
        return needing

    for phase_dir in sorted(PHASES_DIR.iterdir()):
        if not phase_dir.is_dir():
            continue
        pm = PHASE_DIR_RE.match(phase_dir.name)
        if not pm:
            continue
        if phase_filter is not None and int(pm.group(1)) != phase_filter:
            continue

        for lesson_dir in sorted(phase_dir.iterdir()):
            if not lesson_dir.is_dir():
                continue
            if not LESSON_DIR_RE.match(lesson_dir.name):
                continue

            code_dir = lesson_dir / "code"
            if not code_dir.is_dir():
                continue

            py_files = sorted(code_dir.glob("*.py"))
            if not py_files:
                continue

            # Already has tests?
            tests_dir = code_dir / "tests"
            alt_tests_dir = lesson_dir / "tests"
            if tests_dir.is_dir() or alt_tests_dir.is_dir():
                continue

            needing.append(lesson_dir)

    return needing


def analyze_lesson(lesson_dir: Path) -> tuple[str, dict[str, list[str]]]:
    """Extract top-level defs from every .py file in the lesson."""
    rel = lesson_dir.relative_to(ROOT).as_posix()
    code_dir = lesson_dir / "code"
    defs: dict[str, list[str]] = {}

    for py_file in sorted(code_dir.glob("*.py")):
        try:
            source = py_file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        names = _extract_top_level_defs(source)
        if names:
            defs[py_file.name] = names

    return rel, defs


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", type=int, default=None)
    parser.add_argument("--write", action="store_true", help="create test files")
    args = parser.parse_args(argv)

    lessons = find_lessons_needing_tests(args.phase)

    if not lessons:
        print("No lessons found that need test scaffolding.")
        return 0

    created = 0
    for lesson_dir in lessons:
        rel, defs = analyze_lesson(lesson_dir)
        total_defs = sum(len(v) for v in defs.values())
        if args.write:
            tests_dir = lesson_dir / "code" / "tests"
            tests_dir.mkdir(parents=True, exist_ok=True)
            content = _generate_test_module(rel, defs)
            test_file = tests_dir / "test_main.py"
            test_file.write_text(content, encoding="utf-8")
            print(f"  created  {test_file.relative_to(ROOT).as_posix()}  ({total_defs} targets)")
        else:
            file_count = len(defs)
            print(f"  missing  {rel}  ({file_count} .py file(s), {total_defs} target(s))")
        created += 1

    mode = "created" if args.write else "missing (dry run)"
    print(f"\n{created} test skeletons {mode}")
    if not args.write:
        print("Re-run with --write to create the skeleton files.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
