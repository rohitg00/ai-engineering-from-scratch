"""Phase 13 Lesson 06 - MCP fundamentals, JSON-RPC 2.0 lifecycle walk.

Plays out the initialize -> tools/list -> tools/call sequence by hand with
stdlib JSON-RPC envelopes. No transport, no real server - just the message
shapes so you can compare to the 2025-11-25 spec line by line.

Run: python code/main.py
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any


PROTOCOL_VERSION = "2025-11-25"


@dataclass
class Message:
    raw: dict

    @property
    def kind(self) -> str:
        if "method" in self.raw and "id" not in self.raw:
            return "notification"
        if "method" in self.raw:
            return "request"
        if "result" in self.raw or "error" in self.raw:
            return "response"
        return "unknown"


def request(mid: int, method: str, params: dict | None = None) -> Message:
    body = {"jsonrpc": "2.0", "id": mid, "method": method}
    if params is not None:
        body["params"] = params
    return Message(body)


def response(mid: int, result: Any) -> Message:
    return Message({"jsonrpc": "2.0", "id": mid, "result": result})


def error(mid: int, code: int, message: str, data: Any = None) -> Message:
    err: dict = {"code": code, "message": message}
    if data is not None:
        err["data"] = data
    return Message({"jsonrpc": "2.0", "id": mid, "error": err})


def notification(method: str, params: dict | None = None) -> Message:
    body: dict = {"jsonrpc": "2.0", "method": method}
    if params is not None:
        body["params"] = params
    return Message(body)


def pretty(tag: str, msg: Message) -> None:
    arrow = {"request": ">>>", "response": "<<<",
             "notification": "-->", "unknown": "???"}[msg.kind]
    print(f"{tag} {arrow} [{msg.kind}]")
    print(json.dumps(msg.raw, indent=2))
    print()


CLIENT_INFO = {"name": "learner-client", "version": "1.0.0"}
SERVER_INFO = {"name": "notes-server", "version": "1.0.0"}

CLIENT_CAPS = {
    "roots": {"listChanged": True},
    "sampling": {},
    "elicitation": {},
}

SERVER_CAPS = {
    "tools": {"listChanged": True},
    "resources": {"subscribe": True, "listChanged": True},
    "prompts": {"listChanged": True},
}


TOOL_LIST = [
    {
        "name": "notes_search",
        "description": (
            "Use when the user searches for notes by keywords. "
            "Do not use for tag filters; use notes_list."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 50},
            },
            "required": ["query"],
        },
    }
]


def run_sequence() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 06 - MCP LIFECYCLE WALK")
    print("=" * 72)
    print()

    print("--- PHASE 1: initialize ---")
    pretty("client", request(1, "initialize", {
        "protocolVersion": PROTOCOL_VERSION,
        "capabilities": CLIENT_CAPS,
        "clientInfo": CLIENT_INFO,
    }))
    pretty("server", response(1, {
        "protocolVersion": PROTOCOL_VERSION,
        "capabilities": SERVER_CAPS,
        "serverInfo": SERVER_INFO,
    }))
    pretty("client", notification("notifications/initialized"))

    print("--- PHASE 2: operation ---")
    pretty("client", request(2, "tools/list"))
    pretty("server", response(2, {"tools": TOOL_LIST}))

    pretty("client", request(3, "tools/call", {
        "name": "notes_search",
        "arguments": {"query": "JSON-RPC", "limit": 5},
    }))
    pretty("server", response(3, {
        "content": [
            {"type": "text", "text": "Found 2 notes matching 'JSON-RPC':"},
            {"type": "text", "text": "- note-14 JSON-RPC 2.0 intro"},
            {"type": "text", "text": "- note-22 MCP handshake walkthrough"},
        ],
        "isError": False,
    }))

    pretty("server", notification("notifications/tools/list_changed"))

    print("--- PHASE 2 error example ---")
    pretty("client", request(4, "tools/call", {
        "name": "notes_delete",
        "arguments": {"id": "unknown"},
    }))
    pretty("server", error(4, -32601, "Method not found",
                           data={"tool": "notes_delete"}))

    print("--- PHASE 3: shutdown (transport-level, no JSON-RPC method) ---")
    print("  client closes stdio or HTTP session; server terminates.")


def main() -> None:
    run_sequence()
    print("\nsummary:")
    print(f"  protocolVersion  = {PROTOCOL_VERSION}")
    print(f"  client caps      = {list(CLIENT_CAPS.keys())}")
    print(f"  server caps      = {list(SERVER_CAPS.keys())}")
    print(f"  negotiated ops   = tools, resources (subscribe), prompts")
    print(f"                     + sampling (server-to-client), elicitation")


if __name__ == "__main__":
    main()
