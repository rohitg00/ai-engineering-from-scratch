"""Route tickets and enforce specialist capabilities.

Lesson: projects/support-agent-with-google-adk/stages/02-routing/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import re

ROUTES = {
    "billing": {"invoice", "refund", "payment"},
    "access": {"password", "login", "account"},
    "platform": {"outage", "latency", "error"},
}
TOOLS = {
    "billing": {"read_invoice"},
    "access": {"read_account"},
    "platform": {"read_status"},
}


def route(text):
    words = set(re.findall(r"\w+", text.lower()))
    scores = sorted(
        ((len(words & terms), name) for name, terms in ROUTES.items()),
        key=lambda pair: (-pair[0], pair[1]),
    )
    if not scores[0][0] or len(scores) > 1 and scores[0][0] == scores[1][0]:
        return "human"
    return scores[0][1]


def authorize(specialist, tool):
    return tool in TOOLS.get(specialist, set())
