"""Retry transient reads and reuse completed requests.

Lesson: projects/cloud-agent-with-aws-strands/stages/03-retry/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import hashlib

import json


def request_key(operation, resource):
    raise NotImplementedError("Stage 3: implement request_key")


def cached_read(operation, resource, provider, cache, retries=2):
    raise NotImplementedError("Stage 3: implement cached_read")
