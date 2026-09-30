"""Validate a scoped cloud inspection plan.

Lesson: projects/cloud-agent-with-aws-strands/stages/01-plan/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

ALLOWED = {"inventory.list", "metrics.read", "logs.read"}


def validate_plan(raw, scope):
    if not isinstance(raw, list) or not raw or len(raw) > 10:
        raise ValueError("one to ten actions required")
    rows = []
    for item in raw:
        if not isinstance(item, dict) or set(item) != {"operation", "resource"}:
            raise ValueError("operation and resource required")
        if item["operation"] not in ALLOWED:
            raise ValueError("read-only operation required")
        if item["resource"] not in scope:
            raise ValueError("resource outside scope")
        rows.append(dict(item))
    return rows
