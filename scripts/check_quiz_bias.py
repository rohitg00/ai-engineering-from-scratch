#!/usr/bin/env python3
"""Measure and gate answer-length bias in the lesson quizzes.

A multiple-choice question is guessable when the correct option is written more
fully than every distractor: a reader can pick the longest answer without
knowing the material. `scripts/debias_quizzes.py` already spreads the correct
option across positions; this measures the separate length tell and keeps it
from getting worse.

A question is counted as length-biased when its correct option is strictly the
longest and is at least MIN_RATIO times the length of its longest distractor.

Usage:
    python3 scripts/check_quiz_bias.py            # report the distribution
    python3 scripts/check_quiz_bias.py --report   # also list the worst offenders
    python3 scripts/check_quiz_bias.py --check     # fail if the rate rose above the baseline
"""
import argparse
import collections
import glob
import json
import sys

QUIZ_GLOB = "phases/*/*/quiz.json"
MIN_RATIO = 1.25

# The share of length-biased questions on main today. The gate fails when a
# change pushes the rate above this, so new quizzes cannot add bias. Lower it as
# quizzes are rebalanced so the ceiling ratchets down and never drifts back up.
BASELINE_RATE = 0.84


def questions_in(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("questions", [])
    return []


def is_length_biased(question):
    options = question.get("options")
    correct = question.get("correct")
    if not isinstance(options, list) or not isinstance(correct, int):
        return None
    if not (0 <= correct < len(options)) or len(options) < 2:
        return None
    lengths = [len(str(option).strip()) for option in options]
    correct_length = lengths[correct]
    longest_distractor = max(lengths[i] for i in range(len(lengths)) if i != correct)
    if longest_distractor == 0:
        return True
    return correct_length > longest_distractor and correct_length / longest_distractor >= MIN_RATIO


def scan():
    total = 0
    biased = 0
    per_phase = collections.defaultdict(lambda: [0, 0])
    offenders = []
    errors = []
    for path in sorted(glob.glob(QUIZ_GLOB)):
        phase = path.split("/")[1]
        try:
            data = json.load(open(path, encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append((path, str(exc)))
            continue
        for index, question in enumerate(questions_in(data)):
            flag = is_length_biased(question)
            if flag is None:
                continue
            total += 1
            per_phase[phase][1] += 1
            if flag:
                biased += 1
                per_phase[phase][0] += 1
                offenders.append((path, index, str(question.get("question", ""))[:70]))
    return total, biased, per_phase, offenders, errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args()

    total, biased, per_phase, offenders, errors = scan()
    if errors:
        for path, message in errors:
            print(f"could not read {path}: {message}", file=sys.stderr)
        return 1
    if total == 0:
        print("no quiz questions found")
        return 0
    rate = biased / total
    print(f"{biased}/{total} questions are length-biased ({rate:.1%}); baseline {BASELINE_RATE:.0%}")

    if args.report:
        print("\nper phase:")
        for phase, (b, n) in sorted(per_phase.items(), key=lambda kv: -kv[1][0]):
            print(f"  {phase:44} {b:4}/{n:4}  {b / n:5.1%}")
        print(f"\nworst offenders ({min(len(offenders), 30)} of {len(offenders)}):")
        for path, index, text in offenders[:30]:
            print(f"  {path} [q{index}] {text}")

    if args.check and rate > BASELINE_RATE:
        print(
            f"\nlength-bias rate {rate:.1%} is above the baseline {BASELINE_RATE:.0%}. "
            "Rebalance the new or edited quizzes so distractors are comparable in "
            "length to the correct option.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
