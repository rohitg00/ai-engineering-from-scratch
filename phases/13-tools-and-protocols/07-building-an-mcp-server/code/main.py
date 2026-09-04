"""Phase 13 Lesson 07: a stateless MCP server over stdio.
Lesson: phases/13-tools-and-protocols/07-building-an-mcp-server/docs/en.md
Specification: https://modelcontextprotocol.io/specification/2026-07-28/
Implements discovery, three server primitives, and per-request validation.
Run: python3 main.py --demo
"""

from __future__ import annotations

import json
import sys
import uuid
from copy import deepcopy
from typing import Any, Callable


PROTOCOL_VERSION = "2026-07-28"
SUPPORTED_VERSIONS = [PROTOCOL_VERSION]
VERSION_KEY = "io.modelcontextprotocol/protocolVersion"
CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

CLIENT_INFO = {"name": "lesson-07-client", "version": "1.0.0"}
SERVER_INFO = {"name": "notes-lesson-07", "version": "2.0.0"}
SERVER_CAPABILITIES = {
    "tools": {"listChanged": False},
    "resources": {"listChanged": False, "subscribe": False},
    "prompts": {"listChanged": False},
}

_BASE_NOTES: dict[str, dict[str, str]] = {
    "note-1": {"title": "MCP overview", "body": "Stateless requests and JSON-RPC.", "tag": "mcp"},
    "note-2": {"title": "Function calling", "body": "Provider envelopes differ.", "tag": "api"},
    "note-3": {"title": "Tool schemas", "body": "Atomic tools are easier to route.", "tag": "design"},
}
NOTES = deepcopy(_BASE_NOTES)

TOOLS = [
    {
        "name": "notes_search",
        "description": "Search note titles and bodies by keyword.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 50},
            },
            "required": ["query"],
        },
        "annotations": {"readOnlyHint": True, "idempotentHint": True},
    },
    {
        "name": "notes_create",
        "description": "Create a new note.",
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
    {
        "name": "notes_list",
        "description": "List notes, optionally filtered by tag.",
        "inputSchema": {
            "type": "object",
            "properties": {"tag": {"type": "string"}},
            "required": [],
        },
        "annotations": {"readOnlyHint": True, "idempotentHint": True},
    },
]

PROMPTS = [
    {
        "name": "review_note",
        "description": "Critique a note and propose concrete improvements.",
        "arguments": [
            {"name": "note_id", "description": "Note identifier", "required": True}
        ],
    }
]


class RpcProblem(Exception):
    def __init__(self, code: int, message: str, data: Any | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.data = data


def reset_notes() -> None:
    NOTES.clear()
    NOTES.update(deepcopy(_BASE_NOTES))


def request_meta(
    version: str = PROTOCOL_VERSION,
    capabilities: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        VERSION_KEY: version,
        CAPABILITIES_KEY: {} if capabilities is None else capabilities,
        CLIENT_INFO_KEY: CLIENT_INFO.copy(),
    }


def make_request(
    request_id: int | str,
    method: str,
    params: dict[str, Any] | None = None,
    *,
    version: str = PROTOCOL_VERSION,
) -> dict[str, Any]:
    body_params = dict(params or {})
    body_params["_meta"] = request_meta(version)
    return {"jsonrpc": "2.0", "id": request_id, "method": method, "params": body_params}


def rpc_error(
    request_id: int | str | None,
    code: int,
    message: str,
    data: Any | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


def complete(
    payload: dict[str, Any],
    *,
    ttl_ms: int | None = None,
    cache_scope: str = "private",
) -> dict[str, Any]:
    result = {
        "resultType": "complete",
        **payload,
        "_meta": {SERVER_INFO_KEY: SERVER_INFO.copy()},
    }
    if ttl_ms is not None:
        result["ttlMs"] = ttl_ms
        result["cacheScope"] = cache_scope
    return result


def validate_request(message: dict[str, Any]) -> None:
    if message.get("jsonrpc") != "2.0" or not isinstance(message.get("method"), str):
        raise RpcProblem(-32600, "Invalid Request")
    if "id" in message and type(message["id"]) not in (int, str):
        raise RpcProblem(-32600, "id must be a string or integer")
    params = message.get("params")
    if not isinstance(params, dict):
        raise RpcProblem(-32602, "params must be an object")
    meta = params.get("_meta")
    if not isinstance(meta, dict):
        raise RpcProblem(-32602, "params._meta is required")
    requested = meta.get(VERSION_KEY)
    if not isinstance(requested, str):
        raise RpcProblem(-32602, f"{VERSION_KEY} is required")
    if requested not in SUPPORTED_VERSIONS:
        raise RpcProblem(
            -32022,
            "Unsupported protocol version",
            {"requested": requested, "supported": SUPPORTED_VERSIONS.copy()},
        )
    if not isinstance(meta.get(CAPABILITIES_KEY), dict):
        raise RpcProblem(-32602, f"{CAPABILITIES_KEY} is required")
    client_info = meta.get(CLIENT_INFO_KEY)
    if client_info is not None and (
        not isinstance(client_info, dict)
        or not isinstance(client_info.get("name"), str)
        or not isinstance(client_info.get("version"), str)
    ):
        raise RpcProblem(-32602, f"{CLIENT_INFO_KEY} is malformed")


def exec_notes_list(arguments: dict[str, Any]) -> list[dict[str, str]]:
    tag = arguments.get("tag")
    items = [
        {"id": note_id, "title": note["title"], "tag": note.get("tag", "")}
        for note_id, note in sorted(NOTES.items())
        if not tag or note.get("tag") == tag
    ]
    return [{"type": "text", "text": json.dumps(items, sort_keys=True)}]


def exec_notes_search(arguments: dict[str, Any]) -> list[dict[str, str]]:
    query = arguments.get("query")
    if not isinstance(query, str) or not query:
        raise ValueError("query must be a non-empty string")
    limit = arguments.get("limit", 10)
    if not isinstance(limit, int) or not 1 <= limit <= 50:
        raise ValueError("limit must be an integer from 1 through 50")
    needle = query.lower()
    hits = [
        {"id": note_id, "title": note["title"]}
        for note_id, note in sorted(NOTES.items())
        if needle in note["title"].lower() or needle in note["body"].lower()
    ]
    return [{"type": "text", "text": json.dumps(hits[:limit], sort_keys=True)}]


def exec_notes_create(arguments: dict[str, Any]) -> list[dict[str, Any]]:
    title = arguments.get("title")
    body = arguments.get("body")
    if not isinstance(title, str) or not isinstance(body, str):
        raise ValueError("title and body must be strings")
    note_id = f"note-{uuid.uuid4().hex[:6]}"
    NOTES[note_id] = {"title": title, "body": body, "tag": str(arguments.get("tag", ""))}
    return [
        {"type": "text", "text": f"Created {note_id}"},
        {
            "type": "resource",
            "resource": {"uri": f"notes://{note_id}", "text": body},
        },
    ]


TOOL_EXECUTORS: dict[str, Callable[[dict[str, Any]], list[dict[str, Any]]]] = {
    "notes_create": exec_notes_create,
    "notes_list": exec_notes_list,
    "notes_search": exec_notes_search,
}


def handle_discover(params: dict[str, Any]) -> dict[str, Any]:
    return complete(
        {
            "supportedVersions": SUPPORTED_VERSIONS.copy(),
            "capabilities": deepcopy(SERVER_CAPABILITIES),
            "instructions": "Use tools for note actions, resources for note bodies, and prompts for reviews.",
        },
        ttl_ms=3_600_000,
        cache_scope="public",
    )


def handle_tools_list(params: dict[str, Any]) -> dict[str, Any]:
    return complete(
        {"tools": sorted(TOOLS, key=lambda tool: tool["name"])},
        ttl_ms=60_000,
        cache_scope="public",
    )


def handle_tools_call(params: dict[str, Any]) -> dict[str, Any]:
    name = params.get("name")
    arguments = params.get("arguments", {})
    if not isinstance(name, str) or not isinstance(arguments, dict):
        raise RpcProblem(-32602, "tools/call requires string name and object arguments")
    executor = TOOL_EXECUTORS.get(name)
    if executor is None:
        return complete(
            {"content": [{"type": "text", "text": f"Unknown tool: {name}"}], "isError": True}
        )
    try:
        return complete({"content": executor(arguments), "isError": False})
    except (KeyError, TypeError, ValueError) as exc:
        return complete(
            {"content": [{"type": "text", "text": str(exc)}], "isError": True}
        )


def handle_resources_list(params: dict[str, Any]) -> dict[str, Any]:
    resources = [
        {"uri": f"notes://{note_id}", "name": note["title"], "mimeType": "text/markdown"}
        for note_id, note in sorted(NOTES.items())
    ]
    return complete({"resources": resources}, ttl_ms=10_000, cache_scope="private")


def handle_resources_read(params: dict[str, Any]) -> dict[str, Any]:
    uri = params.get("uri")
    if not isinstance(uri, str) or not uri.startswith("notes://"):
        raise RpcProblem(-32602, "resources/read requires a notes:// URI")
    note_id = uri.removeprefix("notes://")
    note = NOTES.get(note_id)
    if note is None:
        raise RpcProblem(-32602, "Resource not found", {"uri": uri})
    text = f"# {note['title']}\n\n{note['body']}\n\ntag: {note.get('tag', '')}"
    return complete(
        {"contents": [{"uri": uri, "mimeType": "text/markdown", "text": text}]},
        ttl_ms=5_000,
        cache_scope="private",
    )


def handle_prompts_list(params: dict[str, Any]) -> dict[str, Any]:
    return complete(
        {"prompts": sorted(PROMPTS, key=lambda prompt: prompt["name"])},
        ttl_ms=60_000,
        cache_scope="public",
    )


def handle_prompts_get(params: dict[str, Any]) -> dict[str, Any]:
    if params.get("name") != "review_note":
        raise RpcProblem(-32602, "Unknown prompt")
    arguments = params.get("arguments", {})
    if not isinstance(arguments, dict):
        raise RpcProblem(-32602, "prompt arguments must be an object")
    note_id = arguments.get("note_id")
    if not isinstance(note_id, str) or note_id not in NOTES:
        raise RpcProblem(-32602, "note_id must name an existing note")
    body = NOTES[note_id]["body"]
    return complete(
        {
            "description": "Review the note and propose concrete improvements.",
            "messages": [
                {
                    "role": "user",
                    "content": {
                        "type": "text",
                        "text": f"Review this note and propose improvements:\n\n{body}",
                    },
                }
            ],
        }
    )


HANDLERS: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
    "prompts/get": handle_prompts_get,
    "prompts/list": handle_prompts_list,
    "resources/list": handle_resources_list,
    "resources/read": handle_resources_read,
    "server/discover": handle_discover,
    "tools/call": handle_tools_call,
    "tools/list": handle_tools_list,
}


def dispatch(message: dict[str, Any]) -> dict[str, Any] | None:
    if "id" not in message:
        return None
    request_id = message.get("id")
    error_id = request_id if type(request_id) in (int, str) else None
    try:
        validate_request(message)
        handler = HANDLERS.get(message["method"])
        if handler is None:
            raise RpcProblem(-32601, f"Method not found: {message['method']}")
        result = handler(message["params"])
        return {"jsonrpc": "2.0", "id": request_id, "result": result}
    except RpcProblem as exc:
        return rpc_error(error_id, exc.code, str(exc), exc.data)
    except Exception as exc:
        return rpc_error(error_id, -32603, "Internal error", {"detail": str(exc)})


def serve_stdio() -> None:
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError as exc:
            response = rpc_error(None, -32700, "Parse error", {"detail": str(exc)})
        else:
            response = (
                dispatch(parsed)
                if isinstance(parsed, dict)
                else rpc_error(None, -32600, "Invalid Request")
            )
        if response is not None:
            sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
            sys.stdout.flush()


def demo() -> None:
    scenarios = [
        make_request(1, "server/discover"),
        make_request(2, "tools/list"),
        make_request(3, "resources/list"),
        make_request(4, "prompts/list"),
        make_request(
            5,
            "tools/call",
            {"name": "notes_search", "arguments": {"query": "MCP"}},
        ),
        make_request(6, "resources/read", {"uri": "notes://note-1"}),
        make_request(7, "prompts/get", {"name": "review_note", "arguments": {"note_id": "note-1"}}),
        make_request(8, "tools/list", version="2027-01-01"),
    ]
    print("MCP 2026-07-28 stateless notes server")
    for message in scenarios:
        response = dispatch(message)
        print(f"\n{message['method']} id={message['id']}")
        print(json.dumps(response, indent=2, sort_keys=True)[:700])


def main() -> None:
    if "--demo" in sys.argv:
        demo()
    else:
        serve_stdio()


if __name__ == "__main__":
    main()
