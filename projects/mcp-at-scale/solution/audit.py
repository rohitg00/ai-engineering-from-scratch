"""Audit catalog coverage through protocol pages.

Lesson: projects/mcp-at-scale/stages/04-audit/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

from protocol import handle


def audit_catalog(inventory=None):
    state = {}
    seq = 1
    handle(
        {
            "jsonrpc": "2.0",
            "id": seq,
            "method": "initialize",
            "params": {"protocolVersion": "2025-06-18"},
        },
        state,
        inventory or {},
    )
    handle(
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        state,
        inventory or {},
    )
    names = []
    cursor = None
    pages = 0
    while True:
        seq += 1
        params = {} if cursor is None else {"cursor": cursor}
        result = handle(
            {"jsonrpc": "2.0", "id": seq, "method": "tools/list", "params": params},
            state,
            inventory or {},
        )["result"]
        names.extend(t["name"] for t in result["tools"])
        pages += 1
        cursor = result.get("nextCursor")
        if cursor is None:
            break
        if pages > 100:
            raise RuntimeError("pagination did not terminate")
    if len(names) != len(set(names)):
        raise ValueError("duplicate tool across pages")
    return {"tools": len(names), "pages": pages, "names": names}
