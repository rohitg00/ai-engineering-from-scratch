"""Rank chunks with an inspectable keyword score.

Lesson: projects/doc-qa-with-citations/stages/02-retrieval/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import math

import re

from collections import Counter


def retrieve(chunks, query, k=3):
    raise NotImplementedError("Stage 2: implement retrieve")
