#!/usr/bin/env python3
"""Generate quiz.json skeletons for lessons that don't have one.

For each lesson without a quiz, this script reads docs/en.md to extract the
lesson title (H1 line) and a few key phrases (H3 lines), then writes a
quiz.json skeleton with 6 placeholder questions matching the canonical schema:

  1 pre-question  — connects to prior knowledge
  3 check-questions — verify understanding of the build-it section
  2 post-questions — apply the concept to new scenarios

The generated files are clearly marked with [TODO] placeholders so
contributors know to replace them with real content.

Usage:
    python3 scripts/scaffold_quizzes.py                    # dry-run (report only)
    python3 scripts/scaffold_quizzes.py --write            # actually create files
    python3 scripts/scaffold_quizzes.py --phase 7          # single phase
    python3 scripts/scaffold_quizzes.py --write --phase 7  # write one phase

Exit codes:
    0 — success
    1 — no lessons found (wrong phase?)

Stdlib only. Python 3.10+.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHASES_DIR = ROOT / "phases"

PHASE_DIR_RE = re.compile(r"^([0-9]{2})-[a-z0-9][a-z0-9-]*[a-z0-9]$")
LESSON_DIR_RE = re.compile(r"^[0-9]{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$")
H1_RE = re.compile(r"^#\s+(.+)", re.MULTILINE)
H3_RE = re.compile(r"^###\s+(.+)", re.MULTILINE)

STAGES = ["pre", "check", "check", "check", "post", "post"]
PLACEHOLDER_OPTIONS = [
    "[TODO: option A]",
    "[TODO: option B]",
    "[TODO: option C]",
    "[TODO: option D]",
]

SKELETON_TEMPLATE = {
    "questions": [
        {
            "stage": "pre",
            "question": "[TODO: pre-question — what should the learner already know?]",
            "options": list(PLACEHOLDER_OPTIONS),
            "correct": 0,
            "explanation": "[TODO: explain why this answer is correct, and reference the specific lesson section]",
        },
        {
            "stage": "check",
            "question": "[TODO: check-question 1 — did the learner understand the core build?]",
            "options": list(PLACEHOLDER_OPTIONS),
            "correct": 0,
            "explanation": "[TODO: explain why this answer is correct]",
        },
        {
            "stage": "check",
            "question": "[TODO: check-question 2 — can the learner trace the implementation?]",
            "options": list(PLACEHOLDER_OPTIONS),
            "correct": 0,
            "explanation": "[TODO: explain why this answer is correct]",
        },
        {
            "stage": "check",
            "question": "[TODO: check-question 3 — does the learner understand the edge cases?]",
            "options": list(PLACEHOLDER_OPTIONS),
            "correct": 0,
            "explanation": "[TODO: explain why this answer is correct]",
        },
        {
            "stage": "post",
            "question": "[TODO: post-question 1 — apply the concept to a new scenario]",
            "options": list(PLACEHOLDER_OPTIONS),
            "correct": 0,
            "explanation": "[TODO: explain why this answer is correct]",
        },
        {
            "stage": "post",
            "question": "[TODO: post-question 2 — combine this concept with earlier lessons]",
            "options": list(PLACEHOLDER_OPTIONS),
            "correct": 0,
            "explanation": "[TODO: explain why this answer is correct]",
        },
    ]
}


def _slug_to_title(slug: str) -> str:
    """Derive a human-readable lesson title from a directory slug like 01-linear-algebra."""
    no_num = slug.split("-", 1)[1] if "-" in slug else slug
    return " ".join(w.capitalize() for w in no_num.split("-"))


def _extract_title(doc_path: Path) -> str | None:
    """Read the H1 from docs/en.md, or return None."""
    try:
        text = doc_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    m = H1_RE.search(text)
    return m.group(1).strip() if m else None


def _extract_h3s(doc_path: Path) -> list[str]:
    """Read all H3 lines from docs/en.md for context hints."""
    try:
        text = doc_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []
    return [m.strip() for m in H3_RE.findall(text)]


def find_missing(phase_filter: int | None) -> list[Path]:
    """Return every lesson dir that has a docs/ but no quiz.json."""
    missing: list[Path] = []
    if not PHASES_DIR.is_dir():
        return missing

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
            if (lesson_dir / "quiz.json").is_file():
                continue
            if not (lesson_dir / "docs" / "en.md").is_file():
                continue
            missing.append(lesson_dir)

    return missing


def scaffold_one(lesson_dir: Path) -> dict:
    """Generate a personalized skeleton for one lesson. Returns the JSON-serializable dict."""
    doc = lesson_dir / "docs" / "en.md"
    title = _extract_title(doc)
    h3s = _extract_h3s(doc)

    if title is None:
        title = _slug_to_title(lesson_dir.name)

    # Deep-copy the template
    skeleton = json.loads(json.dumps(SKELETON_TEMPLATE))

    # Personalize each question with the lesson title for context
    for i, q in enumerate(skeleton["questions"]):
        stage = q["stage"]
        if stage == "pre":
            q["question"] = f"[TODO] {title}: What foundational concept must you understand before this lesson?"
        elif stage == "check":
            q["question"] = f"[TODO] {title}: Key concept check #{i} — fill in after reading the Build It section"
        else:
            q["question"] = f"[TODO] {title}: Application scenario #{i - 3} — apply what you built to a new problem"

    # Append H3 hints as a comment (non-standard but helpful for contributors)
    if h3s:
        skeleton["_h3_hints"] = h3s[:12]  # first 12 H3s give good coverage

    return skeleton


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", type=int, default=None, help="restrict to a single phase")
    parser.add_argument("--write", action="store_true", help="actually create quiz.json files")
    args = parser.parse_args(argv)

    missing = find_missing(args.phase)

    if not missing:
        print("All lessons have quiz.json — nothing to scaffold.")
        return 0

    created = 0
    for lesson_dir in missing:
        rel = lesson_dir.relative_to(ROOT).as_posix()
        if args.write:
            skeleton = scaffold_one(lesson_dir)
            quiz_path = lesson_dir / "quiz.json"
            quiz_path.write_text(
                json.dumps(skeleton, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            print(f"  created  {rel}/quiz.json")
        else:
            print(f"  missing  {rel}/quiz.json")
        created += 1

    mode = "created" if args.write else "missing (dry run)"
    print(f"\n{created} quiz skeletons {mode} in {len(set(d.parent for d in missing))} phase(s)")
    if not args.write:
        print("Re-run with --write to create the skeleton files.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
