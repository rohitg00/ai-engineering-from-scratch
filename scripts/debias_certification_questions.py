#!/usr/bin/env python3
"""Deterministically balance answer positions in certification question banks.

The lesson quizzes and assessment files are hand-authored, but option order is
mechanical. This script assigns balanced correct-position cycles per file while
preserving each option's correctness. It is idempotent because it canonicalizes
correct and incorrect option text before applying a content-seeded order.

Usage:
    python3 scripts/debias_certification_questions.py
    python3 scripts/debias_certification_questions.py --check
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import itertools
import json
import random
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
LESSON_QUIZZES = ROOT / "certifications" / "claude" / "lessons"
ASSESSMENTS = ROOT / "certifications" / "claude" / "assessments"
POSITIONAL_ANCHOR = re.compile(
    r"\b(?:all|none)\s+of\s+(?:the\s+)?(?:above|below|these)\b"
    r"|\b(?:both|neither|either)\s+[A-D]\s+(?:and|or)\s+[A-D]\b",
    re.IGNORECASE,
)


def question_files() -> list[Path]:
    return sorted(LESSON_QUIZZES.glob("*/quiz.json")) + sorted(ASSESSMENTS.glob("*/*.json"))


def seed_for(path: str, value: str) -> int:
    digest = hashlib.sha256(f"{path}\0{value}".encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def question_text(question: dict[str, Any]) -> str:
    return str(question.get("id") or question.get("prompt") or question.get("question") or "")


def correct_indices(question: dict[str, Any]) -> tuple[list[int], bool] | None:
    raw = question.get("correct")
    was_integer = isinstance(raw, int) and not isinstance(raw, bool)
    if was_integer:
        return [raw], True
    if isinstance(raw, list) and raw and all(isinstance(item, int) and not isinstance(item, bool) for item in raw):
        return sorted(raw), False
    return None


def target_cycles(option_count: int, correct_count: int) -> list[tuple[int, ...]]:
    if option_count == 4 and correct_count == 1:
        return [(0,), (1,), (2,), (3,)]
    if option_count == 4 and correct_count == 2:
        return [(0, 1), (2, 3), (0, 2), (1, 3), (0, 3), (1, 2)]
    if option_count == 4 and correct_count == 3:
        return [(0, 1, 2), (0, 1, 3), (0, 2, 3), (1, 2, 3)]
    return list(itertools.combinations(range(option_count), correct_count))


def stable_order(values: list[str], seed: int) -> list[str]:
    ordered = sorted(values, key=lambda item: json.dumps(item, ensure_ascii=False))
    random.Random(seed).shuffle(ordered)
    return ordered


def rewrite_question(
    relative_path: str,
    question: dict[str, Any],
    group_index: int,
) -> tuple[bool, str | None]:
    options = question.get("options")
    parsed = correct_indices(question)
    if not isinstance(options, list) or len(options) < 2 or not all(isinstance(item, str) for item in options):
        return False, "invalid options"
    if len(set(options)) != len(options):
        return False, "duplicate options"
    if parsed is None:
        return False, "invalid correct indices"
    indices, was_integer = parsed
    if not indices or any(index < 0 or index >= len(options) for index in indices):
        return False, "out-of-range correct index"
    if len(indices) >= len(options):
        return False, "all options are correct"
    if any(POSITIONAL_ANCHOR.search(option) for option in options):
        return False, "position-dependent option"

    correct_values = [options[index] for index in indices]
    incorrect_values = [option for index, option in enumerate(options) if index not in indices]
    cycles = target_cycles(len(options), len(indices))
    if not cycles:
        return False, "no target answer cycle"
    offset = seed_for(relative_path, f"answer-cycle:{len(options)}:{len(indices)}") % len(cycles)
    target = cycles[(offset + group_index) % len(cycles)]
    identity = question_text(question)
    correct_values = stable_order(correct_values, seed_for(relative_path, identity + ":correct"))
    incorrect_values = stable_order(incorrect_values, seed_for(relative_path, identity + ":incorrect"))

    new_options = [""] * len(options)
    correct_iter = iter(correct_values)
    incorrect_iter = iter(incorrect_values)
    target_set = set(target)
    for index in range(len(options)):
        new_options[index] = next(correct_iter) if index in target_set else next(incorrect_iter)
    new_correct: int | list[int] = target[0] if was_integer else list(target)
    changed = new_options != options or new_correct != question.get("correct")
    question["options"] = new_options
    question["correct"] = new_correct
    return changed, None


def questions_in(data: Any) -> list[dict[str, Any]]:
    questions = data.get("questions") if isinstance(data, dict) else None
    return questions if isinstance(questions, list) else []


def process(path: Path) -> tuple[
    int,
    list[str],
    dict[int, collections.Counter[tuple[int, ...]]],
    Any,
]:
    data = json.loads(path.read_text(encoding="utf-8"))
    questions = questions_in(data)
    relative = path.relative_to(ROOT).as_posix()
    group_seen: collections.Counter[tuple[int, int]] = collections.Counter()
    distributions: dict[int, collections.Counter[tuple[int, ...]]] = collections.defaultdict(collections.Counter)
    errors: list[str] = []
    changed = 0
    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            errors.append(f"question[{index}] is not an object")
            continue
        options = question.get("options")
        parsed = correct_indices(question)
        if not isinstance(options, list) or parsed is None:
            errors.append(f"question[{index}] has invalid options or correct indices")
            continue
        indices, _ = parsed
        group = (len(options), len(indices))
        did_change, error = rewrite_question(relative, question, group_seen[group])
        group_seen[group] += 1
        if error:
            errors.append(f"question[{index}] {error}")
            continue
        if did_change:
            changed += 1
        rewritten = correct_indices(question)
        if rewritten:
            distributions[len(rewritten[0])][tuple(rewritten[0])] += 1
    return changed, errors, distributions, data


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="report drift without writing files")
    args = parser.parse_args(argv)
    changed_files = 0
    changed_questions = 0
    failures: list[str] = []

    for path in question_files():
        changed, errors, distributions, data = process(path)
        relative = path.relative_to(ROOT).as_posix()
        if errors:
            failures.extend(f"{relative}: {error}" for error in errors)
        if changed:
            changed_files += 1
            changed_questions += changed
            if not args.check:
                path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        summary = ", ".join(
            f"k={size} {dict(counter)}" for size, counter in sorted(distributions.items())
        )
        print(f"{relative}: {summary}")

    action = "would rewrite" if args.check else "rewrote"
    print(f"{action} {changed_questions} question(s) across {changed_files} file(s)")
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    if args.check and changed_questions:
        print("Run python3 scripts/debias_certification_questions.py to apply the balanced order.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
