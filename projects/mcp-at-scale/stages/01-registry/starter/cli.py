"""Serve a scoped MCP inventory or print a context-budgeted tool selection."""

import argparse
import json
import sys
from pathlib import Path
from registry import catalog
from discovery import discover
from protocol import serve
from rest_adapter import import_openapi

SEARCH = {
    "name": "catalog_search",
    "description": "Find tools for this inventory within an explicit serialized array budget",
    "inputSchema": {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "max_chars": {"type": "integer", "minimum": 0},
            "k": {"type": "integer", "minimum": 0},
        },
        "required": ["query"],
        "additionalProperties": False,
    },
}


def configured_catalog(inventory):
    if not isinstance(inventory, dict):
        raise ValueError("inventory object required")
    for resource, items in inventory.items():
        if not isinstance(items, list) or any(
            not isinstance(item, dict) or not isinstance(item.get("name"), str)
            for item in items
        ):
            raise ValueError("each resource requires named records")
    tools = [tool for tool in catalog() if tool["resource"] in inventory]
    if set(inventory) - {tool["resource"] for tool in tools}:
        raise ValueError("unknown resource family")
    return [SEARCH, *tools]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inventory", type=Path)
    parser.add_argument("--serve", action="store_true")
    parser.add_argument("--openapi", type=Path)
    parser.add_argument(
        "--base-url", help="opt-in loopback HTTP origin; omitted means recordings only"
    )
    parser.add_argument("--query", default="pods count")
    parser.add_argument("--max-chars", type=int, default=1500)
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()
    inventory = json.loads(args.inventory.read_text())
    tools = (
        [SEARCH, *import_openapi(json.loads(args.openapi.read_text()))]
        if args.openapi
        else configured_catalog(inventory)
    )
    if args.base_url:
        if not args.openapi:
            parser.error("base-url requires openapi")
        inventory["base_url"] = args.base_url
    if args.serve:
        serve(sys.stdin, sys.stdout, inventory, tools)
    else:
        result = discover(tools[1:], args.query, args.max_chars, args.limit)
        result.update(
            schema_version=1,
            full_characters=len(
                json.dumps(
                    [
                        {k: t[k] for k in ("name", "description", "inputSchema")}
                        for t in tools[1:]
                    ],
                    separators=(",", ":"),
                )
            ),
        )
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
