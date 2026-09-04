"""Phase 13 Lesson 17: a stateless MCP gateway and admission catalog.

Companion to ../docs/en.md. This in-process protocol model implements current
discovery, routing validation, deterministic tool aggregation, Registry
server.json admission, RBAC, rate limits, descriptor pins, stateless backend
forwarding, and a modeled subscriptions/listen response. Lesson 09 supplies
the complete Streamable HTTP adapter.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PROTOCOL_META = "io.modelcontextprotocol/protocolVersion"
CLIENT_CAPABILITIES_META = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_META = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_META = "io.modelcontextprotocol/serverInfo"
SUBSCRIPTION_ID_META = "io.modelcontextprotocol/subscriptionId"
NAMED_METHODS = {
    "tools/call",
    "resources/read",
    "prompts/get",
    "tasks/get",
    "tasks/update",
    "tasks/cancel",
}

USERS = {
    "bearer-alice": {"id": "alice", "role": "developer"},
    "bearer-bob": {"id": "bob", "role": "auditor"},
}

RBAC = {
    "alice": {"notes.search", "notes.create", "issues.list", "issues.open"},
    "bob": {"notes.search", "issues.list"},
}

REGISTRY_SERVER_JSON = {
    "notes": {
        "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
        "name": "com.example/notes",
        "description": "Example notes MCP server.",
        "version": "1.0.0",
        "packages": [{
            "registryType": "npm",
            "identifier": "@example/notes-mcp",
            "version": "1.0.0",
            "transport": {"type": "stdio"},
        }],
    },
    "issues": {
        "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
        "name": "com.example/issues",
        "description": "Example issues MCP server.",
        "version": "1.0.0",
        "packages": [{
            "registryType": "npm",
            "identifier": "@example/issues-mcp",
            "version": "1.0.0",
            "transport": {"type": "stdio"},
        }],
    },
}

VERIFIED_ADMISSION_STATE = {
    "notes": {
        "registryName": "com.example/notes",
        "registryVersion": "1.0.0",
        "publisher": {"namespace": "com.example", "status": "verified"},
        "provenance": {
            "source": "registry.modelcontextprotocol.io",
            "recordId": "com.example/notes@1.0.0",
        },
        "admission": {"status": "approved", "reviewedBy": "gateway-policy"},
    },
    "issues": {
        "registryName": "com.example/issues",
        "registryVersion": "1.0.0",
        "publisher": {"namespace": "com.example", "status": "verified"},
        "provenance": {
            "source": "registry.modelcontextprotocol.io",
            "recordId": "com.example/issues@1.0.0",
        },
        "admission": {"status": "approved", "reviewedBy": "gateway-policy"},
    },
}


@dataclass(frozen=True)
class ProtocolError(Exception):
    code: int
    message: str
    data: dict[str, Any] | None = None


def request_meta(client_name: str = "gateway-client") -> dict[str, Any]:
    return {
        PROTOCOL_META: PROTOCOL_VERSION,
        CLIENT_CAPABILITIES_META: {},
        CLIENT_INFO_META: {"name": client_name, "version": "1.0.0"},
    }


def request_name(method: str, params: dict[str, Any]) -> Any:
    if method in {"tasks/get", "tasks/update", "tasks/cancel"}:
        return params.get("taskId")
    return params.get("name") or params.get("uri")


def make_request(method: str, request_id: Any, params: dict[str, Any] | None = None, *, client_name: str = "gateway-client"):
    wire_params = dict(params or {})
    wire_params["_meta"] = request_meta(client_name)
    body = {"jsonrpc": "2.0", "id": request_id, "method": method, "params": wire_params}
    headers = {"MCP-Protocol-Version": PROTOCOL_VERSION, "Mcp-Method": method}
    if method in NAMED_METHODS:
        headers["Mcp-Name"] = str(request_name(method, wire_params) or "")
    return body, headers


def descriptor_digest(tool: dict[str, Any]) -> str:
    canonical = json.dumps(tool, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def registry_record_is_admissible(
    record: dict[str, Any],
    admission: dict[str, Any],
    namespace: str = "com.example/",
) -> bool:
    packages = record.get("packages")
    package_shapes_are_valid = isinstance(packages, list) and bool(packages) and all(
        isinstance(package, dict)
        and isinstance(package.get("registryType"), str)
        and isinstance(package.get("identifier"), str)
        and isinstance(package.get("version"), str)
        and isinstance(package.get("transport"), dict)
        and package["transport"].get("type") == "stdio"
        for package in packages
    )
    return bool(
        isinstance(record.get("name"), str)
        and record["name"].startswith(namespace)
        and isinstance(record.get("description"), str)
        and record.get("version") == admission.get("registryVersion")
        and record.get("name") == admission.get("registryName")
        and package_shapes_are_valid
        and admission.get("publisher", {}).get("namespace") == "com.example"
        and admission.get("publisher", {}).get("status") == "verified"
        and admission.get("provenance", {}).get("source") == "registry.modelcontextprotocol.io"
        and admission.get("admission", {}).get("status") == "approved"
    )


def validate_wire(body: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    if body.get("jsonrpc") != "2.0":
        raise ProtocolError(-32600, "Invalid Request")
    method = body.get("method")
    params = body.get("params")
    if not isinstance(method, str) or not isinstance(params, dict):
        raise ProtocolError(-32600, "Invalid Request")
    meta = params.get("_meta")
    if not isinstance(meta, dict):
        raise ProtocolError(-32602, "params._meta is required")
    requested_version = meta.get(PROTOCOL_META)
    if not isinstance(requested_version, str):
        raise ProtocolError(-32602, "protocolVersion must be a string")
    if not isinstance(meta.get(CLIENT_CAPABILITIES_META), dict):
        raise ProtocolError(-32602, "clientCapabilities is required")
    if headers.get("MCP-Protocol-Version") != requested_version:
        raise ProtocolError(-32020, "MCP-Protocol-Version header mismatch")
    if headers.get("Mcp-Method") != method:
        raise ProtocolError(-32020, "Mcp-Method header mismatch")
    expected_name = request_name(method, params)
    if method in NAMED_METHODS and headers.get("Mcp-Name") != expected_name:
        raise ProtocolError(-32020, "Mcp-Name header mismatch")
    if requested_version != PROTOCOL_VERSION:
        raise ProtocolError(
            -32022,
            "Unsupported protocol version",
            {"supported": [PROTOCOL_VERSION], "requested": requested_version},
        )
    return params


class BackendServer:
    def __init__(self, name: str, tools: list[dict[str, Any]]) -> None:
        self.name = name
        self.tools = json.loads(json.dumps(tools))

    def _success(self, request_id: Any, result: dict[str, Any]) -> dict[str, Any]:
        result = dict(result)
        result.setdefault("resultType", "complete")
        result.setdefault("_meta", {})[SERVER_INFO_META] = {"name": self.name, "version": "2.0.0"}
        return {"jsonrpc": "2.0", "id": request_id, "result": result}

    def handle(self, body: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
        params = validate_wire(body, headers)
        if body["method"] == "server/discover":
            result = {
                "supportedVersions": [PROTOCOL_VERSION],
                "capabilities": {"tools": {"listChanged": True}},
                "ttlMs": 60_000,
                "cacheScope": "public",
            }
        elif body["method"] == "tools/list":
            result = {
                "tools": sorted(self.tools, key=lambda tool: tool["name"]),
                "ttlMs": 30_000,
                "cacheScope": "public",
            }
        elif body["method"] == "tools/call":
            tool = next((item for item in self.tools if item["name"] == params.get("name")), None)
            if tool is None:
                raise ProtocolError(-32601, "Tool not found")
            result = {
                "content": [{"type": "text", "text": f"{self.name}.{tool['name']} completed"}],
                "isError": False,
            }
        else:
            raise ProtocolError(-32601, "Method not found")
        return self._success(body.get("id"), result)


@dataclass
class TokenBucket:
    capacity: int = 5
    refill_per_second: float = 1.0
    tokens: float = 5.0
    updated_at: float = field(default_factory=time.monotonic)

    def consume(self, now: float | None = None) -> bool:
        current = time.monotonic() if now is None else now
        self.tokens = min(self.capacity, self.tokens + max(0.0, current - self.updated_at) * self.refill_per_second)
        self.updated_at = current
        if self.tokens < 1:
            return False
        self.tokens -= 1
        return True


class Gateway:
    def __init__(self) -> None:
        self.backends = {
            "notes": BackendServer("notes", [
                {
                    "name": "search",
                    "description": "Search approved notes.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {"query": {"type": "string"}},
                        "required": ["query"],
                    },
                },
                {
                    "name": "create",
                    "description": "Create a note.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {"title": {"type": "string"}},
                        "required": ["title"],
                    },
                },
            ]),
            "issues": BackendServer("issues", [
                {
                    "name": "list",
                    "description": "List tracked issues.",
                    "inputSchema": {"type": "object", "properties": {}},
                },
                {
                    "name": "open",
                    "description": "Open an issue.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {"id": {"type": "string"}},
                        "required": ["id"],
                    },
                },
            ]),
        }
        self.pins = {
            f"{server_name}.{tool['name']}": descriptor_digest(tool)
            for server_name, backend in self.backends.items()
            for tool in backend.tools
        }
        self.buckets: dict[str, TokenBucket] = {}
        self.audit: list[dict[str, Any]] = []
        self.forwarded_request_ids: list[str] = []

    @staticmethod
    def _success(request_id: Any, result: dict[str, Any]) -> dict[str, Any]:
        result = dict(result)
        result.setdefault("resultType", "complete")
        result.setdefault("_meta", {})[SERVER_INFO_META] = {"name": "enterprise-gateway", "version": "2.0.0"}
        return {"jsonrpc": "2.0", "id": request_id, "result": result}

    @staticmethod
    def _error(request_id: Any, error: ProtocolError) -> dict[str, Any]:
        payload: dict[str, Any] = {"code": error.code, "message": error.message}
        if error.data is not None:
            payload["data"] = error.data
        return {"jsonrpc": "2.0", "id": request_id, "error": payload}

    @staticmethod
    def _error_status(error: ProtocolError) -> int:
        return 404 if error.code == -32601 else 400

    def _is_pinned(self, canonical_name: str, tool: dict[str, Any]) -> bool:
        expected = self.pins.get(canonical_name)
        return expected is not None and expected == descriptor_digest(tool)

    def _visible_tools(self, user_id: str) -> list[dict[str, Any]]:
        visible = []
        for server_name, backend in self.backends.items():
            if not registry_record_is_admissible(
                REGISTRY_SERVER_JSON[server_name],
                VERIFIED_ADMISSION_STATE[server_name],
            ):
                continue
            for tool in backend.tools:
                canonical = f"{server_name}.{tool['name']}"
                if canonical in RBAC.get(user_id, set()) and self._is_pinned(canonical, tool):
                    visible.append({**tool, "name": canonical})
        return sorted(visible, key=lambda tool: tool["name"])

    def _forward(self, canonical_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        server_name, tool_name = canonical_name.split(".", 1)
        backend = self.backends[server_name]
        forwarded_id = f"gw-{len(self.forwarded_request_ids) + 1}"
        self.forwarded_request_ids.append(forwarded_id)
        body, headers = make_request(
            "tools/call",
            forwarded_id,
            {"name": tool_name, "arguments": arguments},
            client_name="enterprise-gateway",
        )
        return backend.handle(body, headers)["result"]

    def handle(
        self,
        bearer: str,
        body: dict[str, Any],
        headers: dict[str, str],
        *,
        http_method: str = "POST",
        accept: str = "application/json, text/event-stream",
    ) -> tuple[int, dict[str, Any] | None]:
        if http_method != "POST":
            return 405, None
        is_notification = "id" not in body
        user = USERS.get(bearer)
        if user is None:
            if is_notification:
                return 401, None
            return 401, self._error(
                body.get("id"),
                ProtocolError(-32001, "Unauthenticated"),
            )
        try:
            params = validate_wire(body, headers)
            method = body["method"]
            if method == "server/discover":
                result = {
                    "supportedVersions": [PROTOCOL_VERSION],
                    "capabilities": {"tools": {"listChanged": True}},
                    "ttlMs": 30_000,
                    "cacheScope": "private",
                }
            elif method == "tools/list":
                result = {
                    "tools": self._visible_tools(user["id"]),
                    "ttlMs": 10_000,
                    "cacheScope": "private",
                }
            elif method == "tools/call":
                canonical = str(params.get("name", ""))
                if canonical not in RBAC.get(user["id"], set()):
                    self.audit.append({"principal": user["id"], "tool": canonical, "decision": "deny"})
                    raise ProtocolError(-32003, "Forbidden", {"tool": canonical})
                bucket = self.buckets.setdefault(user["id"], TokenBucket())
                if not bucket.consume():
                    self.audit.append({"principal": user["id"], "tool": canonical, "decision": "rate_limit"})
                    if is_notification:
                        return 429, None
                    return 429, self._error(
                        body.get("id"),
                        ProtocolError(-32029, "Rate limited"),
                    )
                server_name, tool_name = canonical.split(".", 1)
                tool = next((item for item in self.backends[server_name].tools if item["name"] == tool_name), None)
                if tool is None or not self._is_pinned(canonical, tool):
                    self.audit.append({"principal": user["id"], "tool": canonical, "decision": "pin_mismatch"})
                    if is_notification:
                        return 409, None
                    return 409, self._error(
                        body.get("id"),
                        ProtocolError(-32010, "Descriptor changed", {"tool": canonical}),
                    )
                backend_result = self._forward(canonical, params.get("arguments", {}))
                result = {key: value for key, value in backend_result.items() if key != "_meta"}
                self.audit.append({"principal": user["id"], "tool": canonical, "decision": "allow"})
            elif method == "subscriptions/listen":
                if "text/event-stream" not in accept:
                    if is_notification:
                        return 406, None
                    return 406, self._error(
                        body.get("id"),
                        ProtocolError(-32602, "subscriptions/listen requires an SSE response"),
                    )
                requested = params.get("notifications", {})
                if not isinstance(requested, dict):
                    raise ProtocolError(-32602, "notifications must be an object")
                honored = {}
                if requested.get("toolsListChanged") is True:
                    honored["toolsListChanged"] = True
                if is_notification:
                    return 202, None
                return 200, {
                    "contentType": "text/event-stream",
                    "events": [{
                        "jsonrpc": "2.0",
                        "method": "notifications/subscriptions/acknowledged",
                        "params": {
                            "_meta": {SUBSCRIPTION_ID_META: body.get("id")},
                            "notifications": honored,
                        },
                    }],
                }
            else:
                raise ProtocolError(-32601, "Method not found")
            if is_notification:
                return 202, None
            return 200, self._success(body["id"], result)
        except (KeyError, ValueError):
            if is_notification:
                return 400, None
            return 400, self._error(body.get("id"), ProtocolError(-32602, "Invalid params"))
        except ProtocolError as error:
            status = 403 if error.code == -32003 else self._error_status(error)
            if is_notification:
                return status, None
            return status, self._error(body.get("id"), error)


def demo() -> None:
    gateway = Gateway()
    for request_id, (method, params) in enumerate(
        [
            ("server/discover", {}),
            ("tools/list", {}),
            ("tools/call", {"name": "notes.search", "arguments": {"query": "stateless"}}),
            ("subscriptions/listen", {"notifications": {"toolsListChanged": True}}),
        ],
        start=1,
    ):
        body, headers = make_request(method, request_id, params)
        status, response = gateway.handle("bearer-alice", body, headers)
        print(status, method, json.dumps(response)[:260])
    print("forwarded request ids:", gateway.forwarded_request_ids)
    print("audit:", gateway.audit)


if __name__ == "__main__":
    demo()
