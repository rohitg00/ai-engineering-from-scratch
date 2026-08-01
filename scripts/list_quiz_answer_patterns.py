#!/usr/bin/env python3
"""List answer-index patterns for lesson quizzes."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHASES_DIR = ROOT / "phases"


def quiz_questions(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        questions = data.get("questions", [])
    elif isinstance(data, list):
        questions = data
    else:
        questions = []
    return [q for q in questions if isinstance(q, dict)]


def correct_pattern(path: Path) -> list[int]:
    pattern: list[int] = []
    for question in quiz_questions(path):
        correct = question.get("correct")
        options = question.get("options")
        if isinstance(correct, int) and isinstance(options, list) and 0 <= correct < len(options):
            pattern.append(correct)
    return pattern


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--all-same",
        action="store_true",
        help="show only quizzes with one repeated answer index",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="show pattern counts instead of one row per quiz",
    )
    args = parser.parse_args()

    quiz_paths = sorted(PHASES_DIR.glob("**/quiz.json"))
    rows: list[tuple[str, list[int]]] = []
    for path in quiz_paths:
        pattern = correct_pattern(path)
        if not pattern:
            continue
        if args.all_same and len(set(pattern)) != 1:
            continue
        rows.append((path.relative_to(ROOT).as_posix(), pattern))

    print(f"total={len(quiz_paths)} matched={len(rows)}")
    if args.summary:
        counts = Counter(",".join(str(i) for i in pattern) for _, pattern in rows)
        for pattern, count in counts.most_common():
            print(f"{count}\t{pattern}")
    else:
        for rel_path, pattern in rows:
            print(f"{rel_path}\t{','.join(str(i) for i in pattern)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
