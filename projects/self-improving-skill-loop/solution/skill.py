"""Execute and score a transparent routing skill.

Lesson: projects/self-improving-skill-loop/stages/02-skill/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import re


def route(text, rules, default="unknown"):
    words = set(re.findall(r"\w+", text.casefold()))
    for rule in rules:
        terms = set(rule["terms"])
        if terms and terms <= words:
            return rule["label"]
    return default


def evaluate(cases, rules):
    rows = [
        {"id": c["id"], "expected": c["label"], "predicted": route(c["text"], rules)}
        for c in cases
    ]
    errors = [r for r in rows if r["expected"] != r["predicted"]]
    return {
        "total": len(rows),
        "accuracy": 1 - len(errors) / len(rows) if rows else 0.0,
        "errors": errors,
        "rows": rows,
    }
