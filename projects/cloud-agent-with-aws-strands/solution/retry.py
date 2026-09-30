"""Retry transient reads and reuse completed requests.

Lesson: projects/cloud-agent-with-aws-strands/stages/03-retry/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import hashlib
import json


def request_key(operation, resource):
    return hashlib.sha256(
        json.dumps([operation, resource], separators=(",", ":")).encode()
    ).hexdigest()


def cached_read(operation, resource, provider, cache, retries=2):
    if retries < 0:
        raise ValueError("nonnegative retries required")
    key = request_key(operation, resource)
    if key in cache:
        return {"value": cache[key], "cached": True, "attempts": 0}
    for attempt in range(retries + 1):
        try:
            value = provider(operation, resource)
        except TimeoutError:
            if attempt == retries:
                raise
        else:
            cache[key] = value
            return {"value": value, "cached": False, "attempts": attempt + 1}
