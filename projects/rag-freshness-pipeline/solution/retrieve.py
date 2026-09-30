"""Exclude expired evidence at query time.

Lesson: projects/rag-freshness-pipeline/stages/04-retrieve/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import re


def retrieve(documents, query, now, max_age=3600, k=3):
    if max_age < 0 or k < 0:
        raise ValueError("nonnegative age and k required")
    terms = set(re.findall(r"\w+", query.casefold()))
    rows = []
    for doc in documents.values():
        age = now - doc["updated"]
        if age < 0 or age > max_age:
            continue
        found = terms & set(re.findall(r"\w+", doc["text"].casefold()))
        if found:
            rows.append(
                {
                    "id": doc["id"],
                    "score": len(found) / len(terms),
                    "age": age,
                    "hash": doc["hash"],
                }
            )
    return sorted(rows, key=lambda r: (-r["score"], r["age"], r["id"]))[:k]
