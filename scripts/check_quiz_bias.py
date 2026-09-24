#!/usr/bin/env python3
"""
Check quiz.json files for answer-length bias.
Flags questions where the correct answer is significantly longer than distractors.
"""

import json
import os
import sys
from pathlib import Path

THRESHOLD = 1.5  # correct answer is 1.5x longer than average distractor length


def check_quiz(path: Path) -> list[dict]:
    issues = []
    try:
        with open(path) as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"  ERROR reading {path}: {e}")
        return issues

    # handle both {"questions": [...]} and [...] root formats
    if isinstance(data, list):
        questions = data
    elif isinstance(data, dict):
        questions = data.get("questions", [])
    else:
        return issues

    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            continue

        options = q.get("options", [])
        correct = q.get("correct", -1)

        if not options or correct < 0 or correct >= len(options):
            continue

        correct_len = len(options[correct])
        distractors = [len(options[j]) for j in range(len(options)) if j != correct]

        if not distractors:
            continue

        avg_distractor_len = sum(distractors) / len(distractors)

        if avg_distractor_len > 0 and correct_len / avg_distractor_len > THRESHOLD:
            issues.append({
                "file": str(path),
                "question_index": i,
                "question": q.get("question", "")[:80],
                "correct_answer": options[correct][:80],
                "correct_len": correct_len,
                "avg_distractor_len": round(avg_distractor_len, 1),
                "ratio": round(correct_len / avg_distractor_len, 2),
            })

    return issues


def main():
    root = Path(__file__).parent.parent
    quiz_files = sorted(root.rglob("quiz.json"))

    print(f"Scanning {len(quiz_files)} quiz files...\n")

    all_issues = []
    for path in quiz_files:
        issues = check_quiz(path)
        all_issues.extend(issues)

    if not all_issues:
        print("No answer-length bias detected.")
        sys.exit(0)

    print(f"Found {len(all_issues)} biased question(s):\n")
    for issue in all_issues:
        print(f"  File   : {issue['file']}")
        print(f"  Q #{issue['question_index']}: {issue['question']}")
        print(f"  Correct: {issue['correct_answer']}")
        print(f"  Ratio  : {issue['ratio']}x (correct={issue['correct_len']} chars, avg distractor={issue['avg_distractor_len']} chars)")
        print()

    print(f"Total biased questions: {len(all_issues)}")
    sys.exit(1)


if __name__ == "__main__":
    main()
