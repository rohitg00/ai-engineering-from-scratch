"""Implement initialized JSON-RPC over stdio.

Lesson: projects/mcp-at-scale/stages/03-protocol/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import json

import sys

from registry import catalog, execute


def handle(request, state, inventory):
    raise NotImplementedError("Stage 3: implement handle")


def serve(lines, output, inventory, tools=None):
    raise NotImplementedError("Stage 3: implement serve")
