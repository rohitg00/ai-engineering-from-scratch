"""Phase 13 Lesson 08 - toy MCP client, multi-server namespace merge.

No real subprocess - simulates three MCP servers in-process as callables so
we can focus on discovery, merging, and routing. The Session and dispatch
shape match the real stdio client; swap the in-process stub for a real
subprocess to get a working client.

Run: python code/main.py
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Callable


# ------------------------------------------------------------------
# fake servers (normally these are subprocesses over stdio)
# ------------------------------------------------------------------

def server_notes(method: str, params: dict) -> dict:
    if method == "initialize":
        return {"protocolVersion": "2025-11-25",
                "capabilities": {"tools": {}}, "serverInfo": {"name": "notes"}}
    if method == "tools/list":
        return {"tools": [
            {"name": "search", "description": "Search notes", "inputSchema": {"type": "object", "properties": {}, "required": []}},
            {"name": "create", "description": "Create a note", "inputSchema": {"type": "object", "properties": {}, "required": []}},
        ]}
    if method == "tools/call":
        return {"content": [{"type": "text", "text": f"[notes] {params['name']} ran"}], "isError": False}
    raise ValueError(method)


def server_files(method: str, params: dict) -> dict:
    if method == "initialize":
        return {"protocolVersion": "2025-11-25",
                "capabilities": {"tools": {}, "resources": {}}, "serverInfo": {"name": "files"}}
    if method == "tools/list":
        return {"tools": [
            {"name": "read", "description": "Read a file", "inputSchema": {"type": "object", "properties": {}, "required": []}},
            {"name": "search", "description": "Search files", "inputSchema": {"type": "object", "properties": {}, "required": []}},
        ]}
    if method == "tools/call":
        return {"content": [{"type": "text", "text": f"[files] {params['name']} ran"}], "isError": False}
    raise ValueError(method)


def server_github(method: str, params: dict) -> dict:
    if method == "initialize":
        return {"protocolVersion": "2025-11-25",
                "capabilities": {"tools": {}}, "serverInfo": {"name": "github"}}
    if method == "tools/list":
        return {"tools": [
            {"name": "list_issues", "description": "List issues", "inputSchema": {"type": "object", "properties": {}, "required": []}},
            {"name": "open_pr", "description": "Open a PR", "inputSchema": {"type": "object", "properties": {}, "required": []}},
            {"name": "search", "description": "Search repo", "inputSchema": {"type": "object", "properties": {}, "required": []}},
        ]}
    if method == "tools/call":
        return {"content": [{"type": "text", "text": f"[github] {params['name']} ran"}], "isError": False}
    raise ValueError(method)


# ------------------------------------------------------------------
# client
# ------------------------------------------------------------------

@dataclass
class Session:
    name: str
    server_fn: Callable[[str, dict], dict]
    capabilities: dict = field(default_factory=dict)
    tools: list[dict] = field(default_factory=list)
    alive: bool = False


@dataclass
class MergedTool:
    canonical_name: str
    server_name: str
    local_name: str
    description: str


class MultiServerClient:
    def __init__(self) -> None:
        self.sessions: dict[str, Session] = {}
        self.registry: dict[str, MergedTool] = {}

    def add_server(self, name: str, fn: Callable) -> None:
        self.sessions[name] = Session(name=name, server_fn=fn)

    def initialize_all(self) -> None:
        for s in self.sessions.values():
            resp = s.server_fn("initialize", {})
            s.capabilities = resp["capabilities"]
            s.alive = True
            print(f"  init {s.name:8s} caps={list(s.capabilities.keys())}")

    def discover_all(self) -> None:
        for s in self.sessions.values():
            if not s.alive:
                continue
            resp = s.server_fn("tools/list", {})
            s.tools = resp["tools"]
            print(f"  {s.name:8s} offers: {[t['name'] for t in s.tools]}")

    def merge(self, policy: str = "prefix-on-collision") -> None:
        self.registry.clear()
        for s in self.sessions.values():
            for tool in s.tools:
                local = tool["name"]
                canonical = local
                if canonical in self.registry:
                    if policy == "prefix-on-collision":
                        canonical = f"{s.name}/{local}"
                        print(f"    COLLISION: {local!r} already from "
                              f"{self.registry[local].server_name}; "
                              f"renaming to {canonical!r}")
                    elif policy == "reject":
                        print(f"    COLLISION REJECTED: {local!r}")
                        continue
                self.registry[canonical] = MergedTool(
                    canonical_name=canonical,
                    server_name=s.name,
                    local_name=local,
                    description=tool["description"],
                )

    def call(self, canonical_name: str, args: dict) -> dict:
        if canonical_name not in self.registry:
            return {"content": [{"type": "text", "text": f"unknown tool {canonical_name}"}],
                    "isError": True}
        mt = self.registry[canonical_name]
        session = self.sessions[mt.server_name]
        if not session.alive:
            return {"content": [{"type": "text", "text": f"session dead: {mt.server_name}"}],
                    "isError": True}
        return session.server_fn("tools/call",
                                 {"name": mt.local_name, "arguments": args})


def main() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 08 - MCP CLIENT MULTI-SERVER HARNESS")
    print("=" * 72)

    client = MultiServerClient()
    client.add_server("notes", server_notes)
    client.add_server("files", server_files)
    client.add_server("github", server_github)

    print("\n1) initialize each server")
    client.initialize_all()

    print("\n2) discover tools on each")
    client.discover_all()

    print("\n3) merge namespaces (prefix-on-collision)")
    client.merge(policy="prefix-on-collision")
    print(f"\n  merged registry ({len(client.registry)} tools):")
    for name, mt in client.registry.items():
        print(f"    {name:20s} -> {mt.server_name}:{mt.local_name}")

    print("\n4) call routing")
    for name in ("create", "read", "files/search", "search", "list_issues"):
        resp = client.call(name, {})
        print(f"  call {name:20s} -> {resp['content'][0]['text']}")

    print("\n5) simulate session death")
    client.sessions["notes"].alive = False
    resp = client.call("create", {})
    print(f"  call create (notes dead) -> {resp['content'][0]['text']}")


if __name__ == "__main__":
    main()
