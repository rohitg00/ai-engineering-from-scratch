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
    raise NotImplementedError("Stage 2: implement route")


def authorize(specialist, tool):
    raise NotImplementedError("Stage 2: implement authorize")
