"""Rank chunks with an inspectable keyword score.

Lesson: projects/doc-qa-with-citations/stages/02-retrieval/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import math
import re
from collections import Counter


def retrieve(chunks, query, k=3):
    if k < 0:
        raise ValueError("nonnegative result limit required")
    terms = set(re.findall(r"\w+", query.casefold()))
    bags = [Counter(re.findall(r"\w+", c["text"].casefold())) for c in chunks]
    frequency = Counter(t for bag in bags for t in bag)
    rows = []
    for chunk, bag in zip(chunks, bags):
        score = sum(
            (1 + math.log(bag[t])) * math.log(1 + len(chunks) / (1 + frequency[t]))
            for t in terms
            if bag[t]
        )
        if score > 0:
            rows.append({**chunk, "score": score})
    return sorted(rows, key=lambda row: (-row["score"], row["id"]))[:k]
