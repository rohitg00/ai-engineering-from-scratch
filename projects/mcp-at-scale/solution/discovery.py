"""Select tools under an explicit context budget.

Lesson: projects/mcp-at-scale/stages/02-discovery/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import json
import re


def discover(tools, query, max_chars=1500, k=5):
    if max_chars < 0 or k < 0:
        raise ValueError("nonnegative limits required")
    tokens = lambda s: set(re.findall(r"[a-z0-9]+", s.lower()))
    terms = tokens(query)
    ranked = []
    for tool in tools:
        score = len(
            terms & tokens(tool["name"].replace("_", " ") + " " + tool["description"])
        )
        if score:
            ranked.append((score, tool["name"], tool))
    selected = []
    used = 0
    for score, name, tool in sorted(ranked, key=lambda r: (-r[0], r[1])):
        public = {key: tool[key] for key in ["name", "description", "inputSchema"]}
        size = len(json.dumps(selected + [public], separators=(",", ":")))
        if size > max_chars:
            continue
        selected.append(public)
        used = size
        if len(selected) >= k:
            break
    return {
        "tools": selected if k else [],
        "characters": used if k else 0,
        "catalog_size": len(tools),
    }
