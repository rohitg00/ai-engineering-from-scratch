#!/usr/bin/env python3
"""One-time backfill: writes quiz.json for every lesson that doesn't have one yet,
using game.generator.TemplateGenerator (no LLM). Never touches existing quiz.json files.

Run from repo root:
    python scripts/backfill_quizzes.py
    python scripts/backfill_quizzes.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from game.catalog import build_catalog
from game.generator import TemplateGenerator


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Report what would be written, write nothing.")
    args = parser.parse_args()

    generator = TemplateGenerator()
    written, skipped_existing, skipped_no_data = 0, 0, 0

    for phase in build_catalog():
        for lesson in phase.lessons:
            if lesson.has_quiz:
                skipped_existing += 1
                continue
            questions = generator.generate(phase, lesson)
            if not questions:
                skipped_no_data += 1
                print(f"  [skip: insufficient data] {lesson.path}")
                continue
            if args.dry_run:
                print(f"  [would write {len(questions)} Qs] {lesson.path}")
            else:
                lesson.quiz_path.write_text(json.dumps(questions, indent=2) + "\n", encoding="utf-8")
                print(f"  [wrote {len(questions)} Qs] {lesson.path}")
            written += 1

    print(
        f"\nDone. {written} lesson(s) {'would be ' if args.dry_run else ''}backfilled, "
        f"{skipped_existing} already had quiz.json, {skipped_no_data} had insufficient data."
    )


if __name__ == "__main__":
    main()
