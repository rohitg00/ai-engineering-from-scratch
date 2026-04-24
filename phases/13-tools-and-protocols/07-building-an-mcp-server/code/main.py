"""Phase 13 Lesson 07 - toy MCP server over stdio, stdlib only.

Implements the 2025-11-25 spec's core flow:
  initialize, tools/list, tools/call, resources/list, resources/read,
  prompts/list, prompts/get, plus notifications/initialized.

Not a production server - no auth, no Streamable HTTP (Phase 13 Lesson 09),
no subscriptions. But the wire behavior is spec-shaped; any MCP client can
handshake and call the three notes tools.

Run the built-in demo harness:  python main.py --demo
Or pipe JSON-RPC lines: echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python main.py
"""

from __future__ import annotations

import json
import sys
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable


PROTOCOL_VERSION = "2025-11-25"
SERVER_INFO = {"name": "notes-lesson-07", "version": "1.0.0"}

NOTES: dict[str, dict] = {
    "note-1": {"title": "MCP overview", "body": "Primitives, lifecycle, JSON-RPC.", "tag": "mcp"},
    "note-2": {"title": "Function calling", "body": "Provider shapes diff by envelope.", "tag": "api"},
    "note-3": {"title": "Tool schemas", "body": "Atomic beats monolithic.", "tag": "design"},
}


# ----- primitive registries -----

TOOLS = [
    {
        "name": "notes_list",
        "description": "Use when the user wants all notes or a filtered list by tag. Do not use to read a note body.",
        "inputSchema": {
            "type": "object",
            "properties": {"tag": {"type": "string"}},
            "required": [],
        },
        "annotations": {"readOnlyHint": True, "idempotentHint": True},
    },
    {
        "name": "notes_search",
        "description": "Use when the user searches notes by content keywords. Do not use for tag filters.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 50},
            },
            "required": ["query"],
        },
        "annotations": {"readOnlyHint": True},
    },
    {
        "name": "notes_create",
        "description": "Use when the user writes a new note. Do not use to edit existing ones.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "body": {"type": "string"},
                "tag": {"type": "string"},
            },
            "required": ["title", "body"],
        },
        "annotations": {"destructiveHint": False, "idempotentHint": False},
    },
]

PROMPTS = [
    {
        "name": "review_note",
        "description": "Produce a critique of a note with concrete improvements.",
        "arguments": [
            {"name": "note_id", "description": "The id of the note to review", "required": True},
        ],
    }
]


# ----- tool executors -----

def exec_notes_list(args: dict) -> list[dict]:
    tag = args.get("tag")
    items = []
    for nid, note in NOTES.items():
        if tag and note.get("tag") != tag:
            continue
        items.append({"id": nid, "title": note["title"], "tag": note.get("tag", "")})
    return [{"type": "text", "text": json.dumps(items)}]


def exec_notes_search(args: dict) -> list[dict]:
    q = args["query"].lower()
    limit = args.get("limit", 10)
    hits = []
    for nid, n in NOTES.items():
        if q in n["title"].lower() or q in n["body"].lower():
            hits.append({"id": nid, "title": n["title"]})
    return [{"type": "text", "text": json.dumps(hits[:limit])}]


def exec_notes_create(args: dict) -> list[dict]:
    nid = f"note-{uuid.uuid4().hex[:6]}"
    NOTES[nid] = {"title": args["title"], "body": args["body"], "tag": args.get("tag", "")}
    return [
        {"type": "text", "text": f"Created {nid}"},
        {"type": "resource", "resource": {"uri": f"notes://{nid}", "text": args["body"]}},
    ]


TOOL_EXECUTORS: dict[str, Callable[[dict], list[dict]]] = {
    "notes_list": exec_notes_list,
    "notes_search": exec_notes_search,
    "notes_create": exec_notes_create,
}


# ----- handlers -----

def handle_initialize(params: dict) -> dict:
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "capabilities": {
            "tools": {"listChanged": False},
            "resources": {"listChanged": False, "subscribe": False},
            "prompts": {"listChanged": False},
        },
        "serverInfo": SERVER_INFO,
    }


def handle_tools_list(params: dict) -> dict:
    return {"tools": TOOLS}


def handle_tools_call(params: dict) -> dict:
    name = params["name"]
    args = params.get("arguments", {})
    if name not in TOOL_EXECUTORS:
        return {"content": [{"type": "text", "text": f"unknown tool {name}"}], "isError": True}
    try:
        content = TOOL_EXECUTORS[name](args)
        return {"content": content, "isError": False}
    except Exception as e:
        return {"content": [{"type": "text", "text": str(e)}], "isError": True}


def handle_resources_list(params: dict) -> dict:
    items = [
        {"uri": f"notes://{nid}", "name": n["title"], "mimeType": "text/markdown"}
        for nid, n in NOTES.items()
    ]
    return {"resources": items}


def handle_resources_read(params: dict) -> dict:
    uri = params["uri"]
    nid = uri.replace("notes://", "")
    if nid not in NOTES:
        raise ValueError(f"not found: {uri}")
    n = NOTES[nid]
    return {
        "contents": [
            {"uri": uri, "mimeType": "text/markdown",
             "text": f"# {n['title']}\n\n{n['body']}\n\ntag: {n.get('tag', '')}"}
        ]
    }


def handle_prompts_list(params: dict) -> dict:
    return {"prompts": PROMPTS}


def handle_prompts_get(params: dict) -> dict:
    if params["name"] != "review_note":
        raise ValueError("unknown prompt")
    nid = params.get("arguments", {}).get("note_id", "")
    body = NOTES.get(nid, {}).get("body", "(not found)")
    return {
        "description": "Review the note and propose concrete improvements.",
        "messages": [
            {"role": "user", "content": {"type": "text",
                "text": f"Review this note and propose improvements:\n\n{body}"}}
        ],
    }


HANDLERS: dict[str, Callable[[dict], dict]] = {
    "initialize": handle_initialize,
    "tools/list": handle_tools_list,
    "tools/call": handle_tools_call,
    "resources/list": handle_resources_list,
    "resources/read": handle_resources_read,
    "prompts/list": handle_prompts_list,
    "prompts/get": handle_prompts_get,
}


# ----- dispatch loop -----

def dispatch(msg: dict) -> dict | None:
    method = msg.get("method")
    if "id" not in msg:
        return None  # notification
    if method not in HANDLERS:
        return {"jsonrpc": "2.0", "id": msg["id"],
                "error": {"code": -32601, "message": f"Method not found: {method}"}}
    try:
        result = HANDLERS[method](msg.get("params", {}))
        return {"jsonrpc": "2.0", "id": msg["id"], "result": result}
    except Exception as e:
        return {"jsonrpc": "2.0", "id": msg["id"],
                "error": {"code": -32603, "message": str(e)}}


def serve_stdio() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError as e:
            sys.stderr.write(f"parse error: {e}\n")
            sys.stdout.write(json.dumps({
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": "Parse error", "data": str(e)},
            }) + "\n")
            sys.stdout.flush()
            continue
        resp = dispatch(msg)
        if resp is not None:
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()


def demo() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 07 - MCP SERVER DEMO (no transport)")
    print("=" * 72)
    scenarios = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": PROTOCOL_VERSION}},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
        {"jsonrpc": "2.0", "id": 3, "method": "tools/call",
         "params": {"name": "notes_search", "arguments": {"query": "MCP"}}},
        {"jsonrpc": "2.0", "id": 4, "method": "resources/list"},
        {"jsonrpc": "2.0", "id": 5, "method": "resources/read",
         "params": {"uri": "notes://note-1"}},
        {"jsonrpc": "2.0", "id": 6, "method": "tools/call",
         "params": {"name": "notes_create",
                    "arguments": {"title": "Session notes", "body": "Built it.", "tag": "mcp"}}},
        {"jsonrpc": "2.0", "id": 7, "method": "prompts/get",
         "params": {"name": "review_note", "arguments": {"note_id": "note-1"}}},
        {"jsonrpc": "2.0", "id": 8, "method": "tools/call",
         "params": {"name": "no_such_tool", "arguments": {}}},
    ]
    for msg in scenarios:
        print("\n>>>", msg["method"])
        resp = dispatch(msg)
        print(json.dumps(resp, indent=2)[:400])


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "--demo":
        demo()
    else:
        serve_stdio()


if __name__ == "__main__":
    main()
