"""Persist an index with atomic replacement.

Lesson: projects/rag-freshness-pipeline/stages/03-snapshot/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import json

import os

from pathlib import Path

import tempfile

import threading


def read_snapshot(path):
    raise NotImplementedError("Stage 3: implement read_snapshot")


def commit(path, documents, expected_version):
    raise NotImplementedError("Stage 3: implement commit")
