#!/usr/bin/env python3
"""Report quiz.json coverage across phases.

Usage:
    python scripts/quiz_coverage.py               # full summary
    python scripts/quiz_coverage.py --json         # JSON report on stdout
    python scripts/quiz_coverage.py --missing      # list every lesson missing a quiz

Exit codes:
    0 — all lessons have quizzes (or --missing used without threshold)
    1 — coverage below --threshold percent (default: none)

Stdlib only. Python 3.10+.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHASES_DIR = ROOT / "phases"

PHASE_DIR_RE = re.compile(r"^([0-9]{2})-[a-z0-9][a-z0-9-]*[a-z0-9]$")
LESSON_DIR_RE = re.compile(r"^[0-9]{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$")


@dataclass
class PhaseCoverage:
    phase_id: int
    phase_name: str
    total_lessons: int
    with_quiz: int
    missing: list[str]


def _phase_slug_to_name(slug: str) -> str:
    return " ".join(w.capitalize() for w in slug.split("-"))


def gather() -> list[PhaseCoverage]:
    if not PHASES_DIR.is_dir():
        return []

    phases: dict[int, PhaseCoverage] = {}

    for phase_dir in sorted(PHASES_DIR.iterdir()):
        if not phase_dir.is_dir():
            continue
        pm = PHASE_DIR_RE.match(phase_dir.name)
        if not pm:
            continue
        phase_id = int(pm.group(1))
        name = _phase_slug_to_name(phase_dir.name.split("-", 1)[1])

        total = 0
        with_quiz = 0
        missing: list[str] = []

        for lesson_dir in sorted(phase_dir.iterdir()):
            if not lesson_dir.is_dir():
                continue
            if not LESSON_DIR_RE.match(lesson_dir.name):
                continue
            total += 1
            if (lesson_dir / "quiz.json").is_file():
                with_quiz += 1
            else:
                missing.append(lesson_dir.name)

        phases[phase_id] = PhaseCoverage(
            phase_id=phase_id,
            phase_name=name,
            total_lessons=total,
            with_quiz=with_quiz,
            missing=missing,
        )

    return [phases[k] for k in sorted(phases)]


def render_report(coverages: list[PhaseCoverage]) -> str:
    lines: list[str] = []
    grand_total = sum(c.total_lessons for c in coverages)
    grand_quiz = sum(c.with_quiz for c in coverages)
    pct = (grand_quiz / grand_total * 100) if grand_total else 0

    lines.append("Quiz Coverage Report")
    lines.append("=" * 50)
    lines.append(f"Total: {grand_quiz}/{grand_total} lessons have quizzes ({pct:.1f}%)")
    lines.append("")

    # Header
    lines.append(f"{'Phase':<10} {'Name':<35} {'Coverage':<12} {'Bar'}")
    lines.append("-" * 80)

    for c in coverages:
        pct_p = (c.with_quiz / c.total_lessons * 100) if c.total_lessons else 0
        bar_len = max(0, int(pct_p / 5))
        bar = "#" * bar_len + "-" * (20 - bar_len)
        lines.append(
            f"Phase {c.phase_id:<02d}  {c.phase_name:<33}  "
            f"{c.with_quiz:>3d}/{c.total_lessons:<3d} ({pct_p:>5.1f}%)  {bar}"
        )

    lines.append("")
    lines.append("Missing quizzes:")
    lines.append("-" * 80)

    any_missing = False
    for c in coverages:
        if c.missing:
            any_missing = True
            lines.append(f"\nPhase {c.phase_id:02d} — {c.phase_name} ({len(c.missing)} missing):")
            for name in c.missing:
                lines.append(f"  - {name}")

    if not any_missing:
        lines.append("  None — every lesson has a quiz! 🎉")

    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--json", action="store_true", help="emit JSON report on stdout"
    )
    parser.add_argument(
        "--missing",
        action="store_true",
        help="list every lesson path missing a quiz (one per line)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0,
        help="exit 1 if overall coverage < THRESHOLD percent (default: 0, never fail)",
    )
    args = parser.parse_args(argv)

    coverages = gather()

    if args.missing:
        for c in coverages:
            for name in c.missing:
                print(f"phases/{c.phase_id:02d}-{c.phase_name.lower().replace(' ', '-')}/{name}")
        return 0

    if args.json:
        payload = {
            "total_lessons": sum(c.total_lessons for c in coverages),
            "total_with_quiz": sum(c.with_quiz for c in coverages),
            "phases": [
                {
                    "phase_id": c.phase_id,
                    "phase_name": c.phase_name,
                    "total_lessons": c.total_lessons,
                    "with_quiz": c.with_quiz,
                    "missing": c.missing,
                    "coverage_pct": round(
                        (c.with_quiz / c.total_lessons * 100) if c.total_lessons else 0, 1
                    ),
                }
                for c in coverages
            ],
        }
        json.dump(payload, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        sys.stdout.write(render_report(coverages) + "\n")

    grand_total = sum(c.total_lessons for c in coverages)
    grand_quiz = sum(c.with_quiz for c in coverages)
    overall = (grand_quiz / grand_total * 100) if grand_total else 0

    if args.threshold > 0 and overall < args.threshold:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
