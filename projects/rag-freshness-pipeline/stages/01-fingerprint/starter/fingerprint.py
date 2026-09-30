"""Normalize documents and fingerprint content.

Lesson: projects/rag-freshness-pipeline/stages/01-fingerprint/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import hashlib

import unicodedata


def normalize(doc):
    raise NotImplementedError("Stage 1: implement normalize")
