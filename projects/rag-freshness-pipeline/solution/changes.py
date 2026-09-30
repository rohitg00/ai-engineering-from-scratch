"""Plan inserts updates deletions and refreshes.

Lesson: projects/rag-freshness-pipeline/stages/02-changes/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

from fingerprint import normalize


def diff(previous, incoming):
    fresh = {}
    for raw in incoming:
        doc = normalize(raw)
        if doc["id"] in fresh:
            raise ValueError("duplicate document id")
        fresh[doc["id"]] = doc
    plan = {
        "insert": [],
        "update": [],
        "refresh": [],
        "delete": sorted(set(previous) - set(fresh)),
        "unchanged": [],
        "documents": fresh,
    }
    for key, doc in sorted(fresh.items()):
        old = previous.get(key)
        bucket = (
            "insert"
            if old is None
            else "update"
            if old["hash"] != doc["hash"]
            else "refresh"
            if old["updated"] != doc["updated"]
            else "unchanged"
        )
        plan[bucket].append(key)
    return plan
