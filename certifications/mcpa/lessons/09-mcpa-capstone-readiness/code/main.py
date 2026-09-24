"""MCPA capstone readiness, modeled with the standard library.

A runnable mock of one full MCP exchange: the initialize handshake, tool
discovery, a schema-validated call, a host-side consent gate on a
side-effecting tool, an append-only audit log, and the result crossing back
across the trust boundary. There is no network and no SDK, so the exchange
is deterministic and portable, but the message shapes are the real
JSON-RPC 2.0 envelopes MCP 2026-07-28 uses. See docs/en.md for the
walkthrough that ties each stage back to its exam domain.

Run: python3 code/main.py
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Callable


PROTOCOL_VERSION = "2026-07-28"

INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
# Implementation-defined server-error range reserved by JSON-RPC 2.0
# (-32000 to -32099). CONSENT_REQUIRED is a host policy refusal, not a
# protocol-level error, so it lives in that reserved band rather than
# among the standard codes above.
CONSENT_REQUIRED = -32001


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Any]
    annotations: dict[str, Any] = field(default_factory=dict)


@dataclass
class MockServer:
    """A minimal MCP server: it advertises tools and runs them on request."""

    name: str
    tools: dict[str, Tool] = field(default_factory=dict)

    def register(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def handle(self, request: dict[str, Any]) -> dict[str, Any]:
        if request.get("jsonrpc") != "2.0" or "method" not in request or "id" not in request:
            return _error(request.get("id"), INVALID_REQUEST, "not a JSON-RPC 2.0 request")
        method = request["method"]
        params = request.get("params", {})
        if method == "initialize":
            return _result(request["id"], {
                "protocolVersion": PROTOCOL_VERSION,
                "serverInfo": {"name": self.name},
                "capabilities": {"tools": {"listChanged": False}},
            })
        if method == "tools/list":
            return _result(request["id"], {
                "tools": [
                    {
                        "name": tool.name,
                        "description": tool.description,
                        "inputSchema": tool.input_schema,
                        "annotations": tool.annotations,
                    }
                    for tool in self.tools.values()
                ]
            })
        if method == "tools/call":
            name = params.get("name")
            if name not in self.tools:
                return _error(request["id"], METHOD_NOT_FOUND, f"unknown tool: {name!r}")
            arguments = params.get("arguments", {})
            required = self.tools[name].input_schema.get("required", [])
            missing = [key for key in required if key not in arguments]
            if missing:
                return _error(request["id"], INVALID_PARAMS, f"missing arguments: {missing}")
            value = self.tools[name].handler(arguments)
            return _result(request["id"], {"content": [{"type": "text", "text": str(value)}]})
        return _error(request["id"], METHOD_NOT_FOUND, f"unknown method: {method!r}")


@dataclass
class MockClient:
    """A client inside a host: it owns one connection to one server."""

    server: MockServer
    _next_id: int = 1

    def _request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        request = {"jsonrpc": "2.0", "id": self._next_id, "method": method}
        if params is not None:
            request["params"] = params
        self._next_id += 1
        return self.server.handle(request)

    def initialize(self) -> dict[str, Any]:
        return self._request("initialize", {"protocolVersion": PROTOCOL_VERSION})

    def list_tools(self) -> list[dict[str, Any]]:
        return self._request("tools/list")["result"]["tools"]

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        return self._request("tools/call", {"name": name, "arguments": arguments})


def _result(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


@dataclass
class AuditEntry:
    """One append-only audit record, chained to the entry before it."""

    seq: int
    method: str
    tool: str | None
    status: str
    detail: str
    prev_hash: str
    entry_hash: str = field(init=False, default="")

    def __post_init__(self) -> None:
        self.entry_hash = _chain_hash(self.seq, self.method, self.tool, self.status, self.detail, self.prev_hash)


def _chain_hash(seq: int, method: str, tool: str | None, status: str, detail: str, prev_hash: str) -> str:
    payload = f"{seq}|{method}|{tool}|{status}|{detail}|{prev_hash}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


@dataclass
class AuditLog:
    """An append-only, hash-chained log of protocol activity.

    Each entry's hash covers its own fields and the previous entry's hash,
    so verify() can detect an inserted, removed, or edited entry by
    recomputing the chain from the genesis hash forward.
    """

    genesis: str = "0" * 64
    entries: list[AuditEntry] = field(default_factory=list)

    def record(self, method: str, tool: str | None, status: str, detail: str) -> AuditEntry:
        prev = self.entries[-1].entry_hash if self.entries else self.genesis
        entry = AuditEntry(seq=len(self.entries) + 1, method=method, tool=tool, status=status, detail=detail, prev_hash=prev)
        self.entries.append(entry)
        return entry

    def verify(self) -> bool:
        prev = self.genesis
        for entry in self.entries:
            if entry.prev_hash != prev:
                return False
            if _chain_hash(entry.seq, entry.method, entry.tool, entry.status, entry.detail, entry.prev_hash) != entry.entry_hash:
                return False
            prev = entry.entry_hash
        return True


@dataclass
class Host:
    """The application the user interacts with.

    The host embeds a client, decides on consent using the annotations
    discovery returned, and writes every tool-call outcome to its audit
    log, whether the call was refused locally or sent to the server.
    """

    client: MockClient
    audit_log: AuditLog = field(default_factory=AuditLog)
    consents: set[str] = field(default_factory=set)
    known_tools: dict[str, dict[str, Any]] = field(default_factory=dict)

    def initialize(self) -> dict[str, Any]:
        return self.client.initialize()

    def discover(self) -> list[dict[str, Any]]:
        tools = self.client.list_tools()
        self.known_tools = {tool["name"]: tool for tool in tools}
        return tools

    def grant_consent(self, tool_name: str) -> None:
        self.consents.add(tool_name)

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        tool_meta = self.known_tools.get(name)
        if tool_meta is None:
            # Not in the discovered cache; forward it and let the server,
            # the source of truth for what it exposes, report the error.
            response = self.client.call_tool(name, arguments)
            self._record(name, response)
            return response

        required = tool_meta.get("inputSchema", {}).get("required", [])
        missing = [key for key in required if key not in arguments]
        if missing:
            # Fail fast on the host: no point prompting for consent on a
            # call that is already malformed.
            response = _error(None, INVALID_PARAMS, f"missing arguments: {missing}")
            self._record(name, response)
            return response

        if tool_meta.get("annotations", {}).get("destructiveHint") and name not in self.consents:
            # The consent gate lives on the host, not the server: only the
            # host embeds the user, so only the host can ask them. Nothing
            # is sent, which is why this response has no request id.
            response = _error(None, CONSENT_REQUIRED, f"consent required for side-effecting tool: {name!r}")
            self._record(name, response)
            return response

        response = self.client.call_tool(name, arguments)
        self._record(name, response)
        return response

    def _record(self, tool_name: str, response: dict[str, Any]) -> None:
        if "error" in response:
            detail = f"{response['error']['code']}: {response['error']['message']}"
            status = "error"
        else:
            detail = "executed"
            status = "ok"
        self.audit_log.record(method="tools/call", tool=tool_name, status=status, detail=detail)


def build_ops_server() -> MockServer:
    server = MockServer(name="ops")
    server.register(Tool(
        name="check_status",
        description="Report whether a named service is currently healthy.",
        input_schema={"type": "object", "properties": {"service": {"type": "string"}}, "required": ["service"]},
        handler=lambda args: f"{args['service']}: healthy",
        annotations={"readOnlyHint": True, "destructiveHint": False},
    ))
    server.register(Tool(
        name="restart_service",
        description="Restart a named service. Interrupts traffic until it is back up.",
        input_schema={"type": "object", "properties": {"service": {"type": "string"}}, "required": ["service"]},
        handler=lambda args: f"{args['service']}: restarted",
        annotations={"readOnlyHint": False, "destructiveHint": True},
    ))
    return server


def demo() -> None:
    host = Host(client=MockClient(server=build_ops_server()))

    handshake = host.initialize()
    print("initialize ->", json.dumps(handshake["result"], indent=None))

    tools = host.discover()
    print("tools/list ->", json.dumps(tools, indent=None))

    bad_schema = host.call_tool("restart_service", {})
    print("schema-invalid call ->", json.dumps(bad_schema["error"], indent=None))

    refused = host.call_tool("restart_service", {"service": "billing-api"})
    print("consent required ->", json.dumps(refused["error"], indent=None))

    host.grant_consent("restart_service")
    ok = host.call_tool("restart_service", {"service": "billing-api"})
    print("consented call ->", json.dumps(ok["result"], indent=None))

    unknown = host.call_tool("shutdown_datacenter", {})
    print("unknown tool ->", json.dumps(unknown["error"], indent=None))

    print("audit entries ->", len(host.audit_log.entries))
    print("audit verify ->", host.audit_log.verify())


if __name__ == "__main__":
    demo()
