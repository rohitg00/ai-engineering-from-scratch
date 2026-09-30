"""Plan inserts updates deletions and refreshes.

Lesson: projects/rag-freshness-pipeline/stages/02-changes/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

from fingerprint import normalize


def diff(previous, incoming):
    raise NotImplementedError("Stage 2: implement diff")
