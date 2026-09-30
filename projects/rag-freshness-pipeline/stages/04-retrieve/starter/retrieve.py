"""Exclude expired evidence at query time.

Lesson: projects/rag-freshness-pipeline/stages/04-retrieve/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import re


def retrieve(documents, query, now, max_age=3600, k=3):
    raise NotImplementedError("Stage 4: implement retrieve")
