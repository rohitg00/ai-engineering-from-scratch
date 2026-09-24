"""Audit logs and risk controls at the tool-call boundary.

A stdlib-only mock of an append-only, hash-chained audit log wrapped
around MCP tool calls, plus three risk controls named in the MCPA
"Security and Governance" domain: an allowlist of registered tools,
required-argument validation, and a per-tool rate limit. There is no
network and no SDK, so the exchange is deterministic and portable, but
the request/response shape is the same JSON-RPC 2.0 envelope MCP
2026-07-28 uses. See docs/en.md for the walkthrough.

Run: python3 code/main.py
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Callable


PROTOCOL_VERSION = "2026-07-28"

METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INVALID_REQUEST = -32600
TOOL_DENIED = -32001  # implementation-defined server error, reserved -32000..-32099

GENESIS_HASH = "0" * 64
REDACTED = "***REDACTED***"


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Any]
    flagged_fields: frozenset[str] = field(default_factory=frozenset)


@dataclass
class AuditEntry:
    index: int
    tool: str
    arguments: dict[str, Any]
    result: str
    prev_hash: str
    hash: str


@dataclass
class AuditLog:
    """An append-only, hash-chained record of tool calls a server ran.

    Nothing is ever edited or removed. Each new call becomes a new entry
    at the end, and each entry's hash covers the previous entry's hash
    plus this entry's own content, so the entries form a chain.
    """

    entries: list[AuditEntry] = field(default_factory=list)

    def _last_hash(self) -> str:
        return self.entries[-1].hash if self.entries else GENESIS_HASH

    @staticmethod
    def _digest(prev_hash: str, tool: str, arguments: dict[str, Any], result: str) -> str:
        payload = json.dumps(
            {"prev_hash": prev_hash, "tool": tool, "arguments": arguments, "result": result},
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def append(self, tool: str, arguments: dict[str, Any], result: str) -> AuditEntry:
        prev_hash = self._last_hash()
        entry = AuditEntry(
            index=len(self.entries),
            tool=tool,
            arguments=arguments,
            result=result,
            prev_hash=prev_hash,
            hash=self._digest(prev_hash, tool, arguments, result),
        )
        self.entries.append(entry)
        return entry

    def verify(self) -> tuple[bool, int | None]:
        """Recompute every hash from stored content and compare.

        Returns (True, None) if the chain is intact, or (False, index) for
        the first entry whose recorded hash no longer matches its content,
        or whose prev_hash no longer matches the entry before it.
        """
        expected_prev = GENESIS_HASH
        for entry in self.entries:
            if entry.prev_hash != expected_prev:
                return False, entry.index
            recomputed = self._digest(entry.prev_hash, entry.tool, entry.arguments, entry.result)
            if recomputed != entry.hash:
                return False, entry.index
            expected_prev = entry.hash
        return True, None


def _result(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


@dataclass
class AuditedServer:
    """An MCP-shaped server whose tools/call path is wrapped by an audit
    log and gated by risk controls: an allowlist, required-argument
    validation, and a per-tool rate limit.
    """

    name: str
    tools: dict[str, Tool] = field(default_factory=dict)
    log: AuditLog = field(default_factory=AuditLog)
    rate_limit_per_tool: int = 3
    _calls_seen: dict[str, int] = field(default_factory=dict)

    def register(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def _redacted(self, tool: Tool, arguments: dict[str, Any]) -> dict[str, Any]:
        return {
            key: (REDACTED if key in tool.flagged_fields else value)
            for key, value in arguments.items()
        }

    def handle(self, request: dict[str, Any]) -> dict[str, Any]:
        if request.get("jsonrpc") != "2.0" or "method" not in request or "id" not in request:
            return _error(request.get("id"), INVALID_REQUEST, "not a JSON-RPC 2.0 request")
        request_id = request["id"]
        if request["method"] != "tools/call":
            return _error(request_id, METHOD_NOT_FOUND, f"unknown method: {request['method']!r}")

        params = request.get("params", {})
        name = params.get("name")
        arguments = params.get("arguments", {})

        # Risk control 1: allowlist. Only a registered tool may run at all;
        # an unknown name is refused before it reaches the tool or the log.
        tool = self.tools.get(name)
        if tool is None:
            return _error(request_id, METHOD_NOT_FOUND, f"unknown tool: {name!r}")

        # Risk control 2: required-argument validation refuses a bad call
        # before it runs.
        required = tool.input_schema.get("required", [])
        missing = [key for key in required if key not in arguments]
        if missing:
            return _error(request_id, INVALID_PARAMS, f"missing arguments: {missing}")

        # Risk control 3: a per-tool rate limit bounds how many times a
        # tool may run, so a compromised or looping caller has a ceiling.
        seen = self._calls_seen.get(name, 0)
        if seen >= self.rate_limit_per_tool:
            return _error(request_id, TOOL_DENIED, f"rate limit exceeded for tool: {name!r}")
        self._calls_seen[name] = seen + 1

        value = tool.handler(arguments)
        self.log.append(tool=name, arguments=self._redacted(tool, arguments), result=str(value))
        return _result(request_id, {"content": [{"type": "text", "text": str(value)}]})


@dataclass
class AuditedClient:
    """A client that owns one connection to an audited server."""

    server: AuditedServer
    _next_id: int = 1

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        request = {
            "jsonrpc": "2.0",
            "id": self._next_id,
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        }
        self._next_id += 1
        return self.server.handle(request)


def build_support_server() -> AuditedServer:
    server = AuditedServer(name="support-desk", rate_limit_per_tool=2)
    server.register(Tool(
        name="lookup_order",
        description="Look up the shipping status of an order.",
        input_schema={"type": "object", "properties": {"order_id": {"type": "string"}}, "required": ["order_id"]},
        handler=lambda args: f"order {args['order_id']}: shipped",
    ))
    server.register(Tool(
        name="reset_password",
        description="Reset a user's password.",
        input_schema={
            "type": "object",
            "properties": {"user_id": {"type": "string"}, "new_password": {"type": "string"}},
            "required": ["user_id", "new_password"],
        },
        handler=lambda args: f"password reset for {args['user_id']}",
        flagged_fields=frozenset({"new_password"}),
    ))
    return server


def demo() -> None:
    client = AuditedClient(server=build_support_server())

    first = client.call_tool("lookup_order", {"order_id": "A100"})
    print("tools/call lookup_order ->", json.dumps(first["result"], indent=None))

    reset = client.call_tool("reset_password", {"user_id": "u42", "new_password": "hunter2"})
    print("tools/call reset_password ->", json.dumps(reset["result"], indent=None))
    print("audit entry, arguments redacted ->", json.dumps(client.server.log.entries[-1].arguments, indent=None))

    unknown = client.call_tool("delete_account", {})
    print("unknown tool denied ->", json.dumps(unknown["error"], indent=None))

    second = client.call_tool("lookup_order", {"order_id": "A100"})
    print("tools/call lookup_order ->", json.dumps(second["result"], indent=None))
    third = client.call_tool("lookup_order", {"order_id": "A100"})
    print("rate limit denied ->", json.dumps(third["error"], indent=None))

    clean_ok, clean_break = client.server.log.verify()
    print("verify before tampering ->", clean_ok, clean_break)

    client.server.log.entries[0].arguments = {"order_id": "TAMPERED"}
    tampered_ok, tampered_break = client.server.log.verify()
    print("verify after tampering ->", tampered_ok, tampered_break)


if __name__ == "__main__":
    demo()
