"""Propose rules from development errors only.

Lesson: projects/self-improving-skill-loop/stages/03-propose/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

from collections import defaultdict
import re
from skill import route


def propose(development, rules, min_support=2):
    if min_support < 1:
        raise ValueError("positive support required")
    labels = defaultdict(set)
    counts = defaultdict(int)
    for case in development:
        for word in set(re.findall(r"\w+", case["text"].casefold())) - {
            "a",
            "the",
            "please",
            "is",
            "my",
        }:
            labels[word].add(case["label"])
            counts[(word, case["label"])] += 1
    candidates = []
    for case in development:
        if route(case["text"], rules) == case["label"]:
            continue
        for word in sorted(set(re.findall(r"\w+", case["text"].casefold()))):
            if (
                labels[word] == {case["label"]}
                and counts[(word, case["label"])] >= min_support
            ):
                item = {"terms": [word], "label": case["label"]}
                if item not in rules and item not in candidates:
                    candidates.append(item)
    return [dict(rule) for rule in rules] + candidates
