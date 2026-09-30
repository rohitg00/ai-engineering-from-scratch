"""Execute reads within step and response budgets.

Lesson: projects/cloud-agent-with-aws-strands/stages/02-executor/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import json


def execute(plan, provider, max_steps=5, max_chars=4000):
    if max_steps < 0 or max_chars < 0:
        raise ValueError("nonnegative budgets required")
    rows = []
    used = 0
    for item in plan:
        if len(rows) >= max_steps:
            return {"state": "budget_exhausted", "results": rows, "characters": used}
        value = provider(item["operation"], item["resource"])
        encoded = json.dumps(value, sort_keys=True)
        if used + len(encoded) > max_chars:
            return {"state": "budget_exhausted", "results": rows, "characters": used}
        rows.append({"action": item, "value": value})
        used += len(encoded)
    return {"state": "completed", "results": rows, "characters": used}
