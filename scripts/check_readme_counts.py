#!/usr/bin/env python3
"""Verify that hardcoded counts in README.md match catalog.json totals.

Requires Python 3.10+. Stdlib only.

catalog.json is filesystem-truth (rebuilt by scripts/build_catalog.py and
checked in CI). The README, however, sprinkles hardcoded counts ("428
lessons", "373 skills, 99 prompts, ...") that drift every time the
curriculum grows or shrinks. This script pins each hardcoded count to a
field in catalog.json's `totals` block and fails when they disagree.

Usage:
    python3 scripts/check_readme_counts.py            # exit 1 on any drift
    python3 scripts/check_readme_counts.py --json     # machine-readable report
    python3 scripts/check_readme_counts.py --fix      # rewrite README to match catalog

The --fix flag is opt-in. CI runs the script without --fix and fails the
build on any mismatch, surfacing the drift in the workflow log.

Patterns are deliberately anchored to README context (badge URLs, alt
attributes, specific prose) so per-phase counts like `<code>22 lessons</code>`
in the Contents table are NOT touched. Each pattern declares its catalog
field and a short human description; mismatches are reported with line
numbers and surrounding text.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "catalog.json"
README_PATH = ROOT / "README.md"


@dataclass(frozen=True)
class CountPattern:
    """A single hardcoded count in README pinned to a catalog totals field."""

    regex: re.Pattern[str]
    field: str  # totals.<field>
    description: str


PATTERNS: tuple[CountPattern, ...] = (
    CountPattern(
        regex=re.compile(r"lessons-(\d+)-3553ff"),
        field="lessons",
        description="lesson-count badge URL",
    ),
    CountPattern(
        regex=re.compile(r'alt="(\d+) lessons"'),
        field="lessons",
        description="lesson-count badge alt text",
    ),
    CountPattern(
        regex=re.compile(r"^> (\d+) lessons\. \d+ phases\.", re.MULTILINE),
        field="lessons",
        description="hero blockquote lesson count",
    ),
    CountPattern(
        regex=re.compile(r"^> \d+ lessons\. (\d+) phases\.", re.MULTILINE),
        field="phases",
        description="hero blockquote phase count",
    ),
    CountPattern(
        regex=re.compile(r"This curriculum is the spine\. (\d+) phases,"),
        field="phases",
        description="'spine' prose phase count",
    ),
    CountPattern(
        regex=re.compile(r"This curriculum is the spine\. \d+ phases, (\d+) lessons,"),
        field="lessons",
        description="'spine' prose lesson count",
    ),
    CountPattern(
        regex=re.compile(r"phases-(\d+)-3553ff"),
        field="phases",
        description="phase-count badge URL",
    ),
    CountPattern(
        regex=re.compile(r'alt="(\d+) phases"'),
        field="phases",
        description="phase-count badge alt text",
    ),
    CountPattern(
        regex=re.compile(r"portfolio of (\d+) artifacts"),
        field="lessons",
        description="'portfolio of N artifacts' (one artifact per lesson)",
    ),
    CountPattern(
        regex=re.compile(r"The repo ships (\d+) skills"),
        field="skills",
        description="toolkit section skill count",
    ),
    CountPattern(
        regex=re.compile(r"The repo ships \d+ skills and (\d+) prompts"),
        field="prompts",
        description="toolkit section prompt count",
    ),
    CountPattern(
        regex=re.compile(r"MIT-licensed, (\d+) lessons\."),
        field="lessons",
        description="sponsor section lesson count",
    ),
)


@dataclass
class Mismatch:
    pattern: CountPattern
    found: int
    expected: int
    line: int
    snippet: str


def load_totals() -> dict[str, int]:
    with CATALOG_PATH.open(encoding="utf-8") as fh:
        catalog = json.load(fh)
    totals = catalog.get("totals")
    if not isinstance(totals, dict):
        raise SystemExit("catalog.json is missing the 'totals' block")
    return totals


def line_for(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def snippet_for(text: str, offset: int, end: int) -> str:
    line_start = text.rfind("\n", 0, offset) + 1
    line_end = text.find("\n", end)
    if line_end == -1:
        line_end = len(text)
    return text[line_start:line_end].strip()


def find_mismatches(readme_text: str, totals: dict[str, int]) -> list[Mismatch]:
    mismatches: list[Mismatch] = []
    for pattern in PATTERNS:
        expected = totals.get(pattern.field)
        if expected is None:
            raise SystemExit(f"catalog.json totals is missing field: {pattern.field}")
        matched_any = False
        for match in pattern.regex.finditer(readme_text):
            matched_any = True
            found = int(match.group(1))
            if found != expected:
                mismatches.append(
                    Mismatch(
                        pattern=pattern,
                        found=found,
                        expected=expected,
                        line=line_for(readme_text, match.start()),
                        snippet=snippet_for(readme_text, match.start(), match.end()),
                    )
                )
        if not matched_any:
            raise SystemExit(
                f"pattern did not match README at all: {pattern.description} "
                f"({pattern.regex.pattern!r}). The README structure has changed; "
                f"update scripts/check_readme_counts.py."
            )
    return mismatches


def apply_fixes(readme_text: str, totals: dict[str, int]) -> str:
    for pattern in PATTERNS:
        expected = totals[pattern.field]

        def replace(match: re.Match[str], expected: int = expected) -> str:
            whole = match.group(0)
            old = match.group(1)
            start = match.start(1) - match.start()
            return whole[:start] + str(expected) + whole[start + len(old):]

        readme_text = pattern.regex.sub(replace, readme_text)
    return readme_text


def render_text_report(mismatches: list[Mismatch]) -> str:
    if not mismatches:
        return "README.md counts match catalog.json totals.\n"
    out = [f"README.md drift detected: {len(mismatches)} mismatch(es).\n"]
    for m in mismatches:
        out.append(
            f"  README.md:{m.line}  {m.pattern.description}\n"
            f"    expected totals.{m.pattern.field} = {m.expected}, found {m.found}\n"
            f"    >>> {m.snippet}\n"
        )
    out.append(
        "\nRun `python3 scripts/check_readme_counts.py --fix` to update README.md.\n"
    )
    return "".join(out)


def render_json_report(mismatches: list[Mismatch], totals: dict[str, int]) -> str:
    payload = {
        "ok": not mismatches,
        "totals": totals,
        "mismatches": [
            {
                "line": m.line,
                "field": m.pattern.field,
                "description": m.pattern.description,
                "expected": m.expected,
                "found": m.found,
                "snippet": m.snippet,
            }
            for m in mismatches
        ],
    }
    return json.dumps(payload, indent=2) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--json", action="store_true", help="emit JSON report on stdout")
    parser.add_argument(
        "--fix",
        action="store_true",
        help="rewrite README.md so hardcoded counts match catalog.json",
    )
    args = parser.parse_args(argv)

    totals = load_totals()
    readme_text = README_PATH.read_text(encoding="utf-8")

    if args.fix:
        initial_mismatches = find_mismatches(readme_text, totals)
        if not initial_mismatches:
            if args.json:
                sys.stdout.write(render_json_report([], totals))
            else:
                sys.stdout.write("README.md already matches catalog.json totals.\n")
            return 0
        new_text = apply_fixes(readme_text, totals)
        README_PATH.write_text(new_text, encoding="utf-8")
        remaining = find_mismatches(new_text, totals)
        if args.json:
            sys.stdout.write(render_json_report(remaining, totals))
        else:
            sys.stdout.write("README.md updated to match catalog.json totals.\n")
            if remaining:
                sys.stdout.write(render_text_report(remaining))
        return 1 if remaining else 0

    mismatches = find_mismatches(readme_text, totals)
    if args.json:
        sys.stdout.write(render_json_report(mismatches, totals))
    else:
        sys.stdout.write(render_text_report(mismatches))
    return 1 if mismatches else 0


if __name__ == "__main__":
    sys.exit(main())
