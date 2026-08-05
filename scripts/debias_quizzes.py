#!/usr/bin/env python3
"""Distribute quiz correct-answer positions so they are not always the same slot.

The generated quizzes placed the correct answer in option B (index 1) for 61.5%
of questions, making every quiz guessable. This rewrites each question's option
order with a deterministic, content-seeded permutation and updates the `correct`
index to follow the moved answer. It is idempotent: options are canonicalised to
a sorted base before permuting, so re-running produces byte-identical output.

Questions whose options reference each other by position ("all of the above",
"both A and B", etc.) are left in their original order, since reordering would
break the meaning.

Usage:
    python3 scripts/debias_quizzes.py            # rewrite in place
    python3 scripts/debias_quizzes.py --check     # report distribution, no writes
"""
import argparse
import collections
import glob
import hashlib
import json
import random
import re
import sys

QUIZ_GLOB = "phases/*/*/quiz.json"

ANCHOR = re.compile(
    r"\b(all|none|both|neither)\s+of\s+(the|these)\b"
    r"|\b(both|neither|either)\s+[A-D]\b"
    r"|\b[A-D]\s+and\s+[A-D]\b"
    r"|\b(above|below|following)\b",
    re.IGNORECASE,
)


def seed_for(path, question_text):
    h = hashlib.sha256(f"{path}\x00{question_text}".encode("utf-8")).hexdigest()
    return int(h[:16], 16)


def has_positional_anchor(options):
    return any(ANCHOR.search(str(o)) for o in options)


def debias_question(path, q):
    """Return True if the question order changed."""
    options = q.get("options")
    correct = q.get("correct")
    if not isinstance(options, list) or not isinstance(correct, int):
        return False
    if not (0 <= correct < len(options)) or len(options) < 2:
        return False
    if has_positional_anchor(options):
        return False
    if len(set(map(str, options))) != len(options):
        return False  # duplicate options make identity tracking ambiguous

    correct_val = options[correct]
    base = sorted(options, key=str)
    perm = list(range(len(base)))
    random.Random(seed_for(path, q.get("question", ""))).shuffle(perm)
    new_options = [base[i] for i in perm]
    new_correct = new_options.index(correct_val)

    if new_options == options and new_correct == correct:
        return False
    assert sorted(map(str, new_options)) == sorted(map(str, options))
    q["options"] = new_options
    q["correct"] = new_correct
    return True


def serialize(data, inline_options):
    """Pretty JSON at 2-space indent, matching the file's original option style.

    Some quiz files keep each question's `options` array on one line; others
    expand it. Preserving the original form keeps the diff to the reordered
    values instead of a whole-file whitespace change.
    """
    text = json.dumps(data, ensure_ascii=False, indent=2)
    if not inline_options:
        return text + "\n"
    out = []
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.rstrip()
        if stripped.endswith('"options": ['):
            indent = line[: len(line) - len(line.lstrip())]
            block = []
            i += 1
            while not lines[i].strip().startswith("]"):
                block.append(lines[i])
                i += 1
            trailing = "," if lines[i].strip().endswith(",") else ""
            items = json.loads("[" + "\n".join(block) + "]")
            out.append(f'{indent}"options": {json.dumps(items, ensure_ascii=False)}{trailing}')
        else:
            out.append(line)
        i += 1
    return "\n".join(out) + "\n"


def iter_questions(data):
    if isinstance(data, dict):
        qs = data.get("questions")
    elif isinstance(data, list):
        qs = data
    else:
        qs = None
    return qs if isinstance(qs, list) else []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="report only, do not write")
    args = ap.parse_args()

    pos = collections.Counter()
    total = 0
    changed_files = 0
    changed_qs = 0
    skipped_anchor = 0

    for path in sorted(glob.glob(QUIZ_GLOB)):
        with open(path, encoding="utf-8") as fh:
            raw = fh.read()
        data = json.loads(raw)
        inline_options = '"options": [\n' not in raw
        questions = iter_questions(data)
        if not questions:
            continue
        file_changed = False
        for q in questions:
            if not isinstance(q, dict):
                continue
            opts, c = q.get("options"), q.get("correct")
            if isinstance(opts, list) and isinstance(c, int) and 0 <= c < len(opts):
                if has_positional_anchor(opts):
                    skipped_anchor += 1
                elif debias_question(path, q):
                    file_changed = True
                    changed_qs += 1
                pos[q.get("correct")] += 1
                total += 1
        if file_changed and not args.check:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(serialize(data, inline_options))
        if file_changed:
            changed_files += 1

    verb = "would rewrite" if args.check else "rewritten"
    print(f"questions: {total}  files affected: {changed_files}  questions {verb}: {changed_qs}")
    print(f"positional-anchor questions left as-is: {skipped_anchor}")
    print("correct-position distribution:")
    for k in sorted(pos):
        label = chr(65 + k) if isinstance(k, int) else "?"
        print(f"  {label}: {pos[k]:4d}  {100 * pos[k] / max(total, 1):5.1f}%")

    if args.check and changed_qs:
        print(
            f"\nFAIL: {changed_qs} quiz question(s) are not de-biased. "
            "Run: python3 scripts/debias_quizzes.py",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
