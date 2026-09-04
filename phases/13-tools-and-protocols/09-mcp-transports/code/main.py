"""Phase 13 Lesson 09: stateless MCP Streamable HTTP.
Lesson: phases/13-tools-and-protocols/09-mcp-transports/docs/en.md
Specification: https://modelcontextprotocol.io/specification/2026-07-28/
Implements POST-only transport, header validation, JSON, and finite SSE.
Run: python3 main.py
"""

from __future__ import annotations

import base64
import json
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Mapping


PROTOCOL_VERSION = "2026-07-28"
SUPPORTED_VERSIONS = [PROTOCOL_VERSION]
VERSION_KEY = "io.modelcontextprotocol/protocolVersion"
CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"
SUBSCRIPTION_ID_KEY = "io.modelcontextprotocol/subscriptionId"

CLIENT_INFO = {"name": "lesson-09-client", "version": "2.0.0"}
SERVER_INFO = {"name": "lesson-09-http", "version": "2.0.0"}
SERVER_CAPABILITIES = {"tools": {"listChanged": True}}
ORIGIN_ALLOWLIST = {
    "http://localhost",
    "http://127.0.0.1",
    "https://client.example",
}
MAX_REQUEST_BYTES = 1_048_576
READ_TIMEOUT_SECONDS = 5.0
ROUTING_HEADERS = ("MCP-Protocol-Version", "Mcp-Method", "Mcp-Name")

TOOLS = [
    {
        "name": "ping",
        "description": "Return pong for a transport health check.",
        "inputSchema": {"type": "object", "properties": {}, "required": []},
        "annotations": {"readOnlyHint": True, "idempotentHint": True},
    }
]


class RpcFault(Exception):
    def __init__(self, code: int, message: str, data: Any | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.data = data


def request_meta(version: str = PROTOCOL_VERSION) -> dict[str, Any]:
    return {
        VERSION_KEY: version,
        CAPABILITIES_KEY: {},
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
    result_meta: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    metadata = {SERVER_INFO_KEY: SERVER_INFO.copy()}
    if result_meta:
        metadata.update(result_meta)
    result = {
        "resultType": "complete",
        **payload,
        "_meta": metadata,
    }
    if ttl_ms is not None:
        result["ttlMs"] = ttl_ms
        result["cacheScope"] = cache_scope
    return result


def origin_allowed(origin: str | None) -> bool:
    return origin is None or origin in ORIGIN_ALLOWLIST


def encode_header_value(value: str) -> str:
    safe = all(0x20 <= ord(character) <= 0x7E for character in value)
    sentinel = value.startswith("=?base64?") and value.endswith("?=")
    if safe and value == value.strip() and not sentinel:
        return value
    encoded = base64.b64encode(value.encode("utf-8")).decode("ascii")
    return f"=?base64?{encoded}?="


def decode_header_value(value: str) -> str:
    if value.startswith("=?base64?") and value.endswith("?="):
        encoded = value[len("=?base64?") : -2]
        try:
            return base64.b64decode(encoded, validate=True).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as exc:
            raise RpcFault(-32020, "Malformed Base64 MCP header value") from exc
    if any(ord(character) < 0x20 or ord(character) > 0x7E for character in value):
        raise RpcFault(-32020, "Malformed MCP header value")
    return value


def body_name(message: dict[str, Any]) -> str | None:
    params = message.get("params", {})
    if message.get("method") == "resources/read":
        value = params.get("uri")
    elif message.get("method") in {"tools/call", "prompts/get"}:
        value = params.get("name")
    else:
        return None
    return value if isinstance(value, str) else None


def http_headers_for(
    message: dict[str, Any],
    *,
    origin: str = "http://localhost",
    extra: Mapping[str, str] | None = None,
) -> dict[str, str]:
    meta = message["params"]["_meta"]
    headers = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
        "Origin": origin,
        "MCP-Protocol-Version": str(meta[VERSION_KEY]),
        "Mcp-Method": str(message["method"]),
    }
    name = body_name(message)
    if name is not None:
        headers["Mcp-Name"] = encode_header_value(name)
    if extra:
        headers.update(extra)
    return headers


def validate_request_structure(message: dict[str, Any]) -> str:
    if message.get("jsonrpc") != "2.0" or not isinstance(message.get("method"), str):
        raise RpcFault(-32600, "Invalid Request")
    params = message.get("params")
    if not isinstance(params, dict):
        raise RpcFault(-32602, "params must be an object")
    meta = params.get("_meta")
    if not isinstance(meta, dict):
        raise RpcFault(-32602, "params._meta is required")
    version = meta.get(VERSION_KEY)
    if not isinstance(version, str):
        raise RpcFault(-32602, f"{VERSION_KEY} is required")
    if not isinstance(meta.get(CAPABILITIES_KEY), dict):
        raise RpcFault(-32602, f"{CAPABILITIES_KEY} is required")
    client_info = meta.get(CLIENT_INFO_KEY)
    if client_info is not None and (
        not isinstance(client_info, dict)
        or not isinstance(client_info.get("name"), str)
        or not isinstance(client_info.get("version"), str)
    ):
        raise RpcFault(-32602, f"{CLIENT_INFO_KEY} is malformed")
    return version


def validate_supported_version(version: str) -> None:
    if version not in SUPPORTED_VERSIONS:
        raise RpcFault(
            -32022,
            "Unsupported protocol version",
            {"supported": SUPPORTED_VERSIONS.copy(), "requested": version},
        )


def validate_http_headers(
    headers: Mapping[str, str],
    message: dict[str, Any],
    body_version: str,
) -> None:
    header_version = headers.get("MCP-Protocol-Version")
    if header_version is None or header_version != body_version:
        raise RpcFault(-32020, "Header mismatch: MCP-Protocol-Version")
    header_method = headers.get("Mcp-Method")
    if header_method is None or header_method != message["method"]:
        raise RpcFault(-32020, "Header mismatch: Mcp-Method")
    expected_name = body_name(message)
    if message["method"] in {"tools/call", "resources/read", "prompts/get"}:
        header_name = headers.get("Mcp-Name")
        if header_name is None or expected_name is None:
            raise RpcFault(-32020, "Header mismatch: Mcp-Name")
        if decode_header_value(header_name) != expected_name:
            raise RpcFault(-32020, "Header mismatch: Mcp-Name")


def reject_duplicate_routing_headers(headers: Any) -> None:
    get_all = getattr(headers, "get_all", None)
    if not callable(get_all):
        return
    for name in ROUTING_HEADERS:
        if len(get_all(name, [])) > 1:
            raise RpcFault(-32020, f"Duplicate routing header: {name}")


def reject_duplicate_origin(headers: Any) -> None:
    get_all = getattr(headers, "get_all", None)
    if callable(get_all) and len(get_all("Origin", [])) > 1:
        raise RpcFault(-32020, "Duplicate Origin header")


def reject_ambiguous_body_framing(headers: Any) -> None:
    get_all = getattr(headers, "get_all", None)
    if not callable(get_all):
        return
    if len(get_all("Content-Length", [])) > 1:
        raise ValueError("duplicate Content-Length headers are not allowed")
    if get_all("Transfer-Encoding", []):
        raise ValueError("Transfer-Encoding is not supported")


def dispatch(message: dict[str, Any]) -> dict[str, Any] | None:
    if "id" not in message:
        return None
    request_id = message["id"]
    try:
        version = validate_request_structure(message)
        validate_supported_version(version)
        method = message["method"]
        params = message["params"]
        if method == "server/discover":
            result = complete(
                {
                    "supportedVersions": SUPPORTED_VERSIONS.copy(),
                    "capabilities": SERVER_CAPABILITIES.copy(),
                    "instructions": "Call ping for a transport health check.",
                },
                ttl_ms=3_600_000,
                cache_scope="public",
            )
        elif method == "tools/list":
            result = complete(
                {"tools": sorted(TOOLS, key=lambda tool: tool["name"])},
                ttl_ms=30_000,
                cache_scope="public",
            )
        elif method == "tools/call":
            if params.get("name") != "ping" or not isinstance(params.get("arguments", {}), dict):
                result = complete(
                    {
                        "content": [{"type": "text", "text": "Unknown or invalid tool"}],
                        "isError": True,
                    }
                )
            else:
                result = complete(
                    {"content": [{"type": "text", "text": "pong"}], "isError": False}
                )
        elif method == "subscriptions/listen":
            notifications = params.get("notifications")
            if not isinstance(notifications, dict):
                raise RpcFault(-32602, "subscriptions/listen requires notifications")
            result = complete({})
        else:
            raise RpcFault(-32601, f"Method not found: {method}")
        return {"jsonrpc": "2.0", "id": request_id, "result": result}
    except RpcFault as exc:
        return rpc_error(request_id, exc.code, str(exc), exc.data)


def accepted_filter(requested: dict[str, Any]) -> dict[str, Any]:
    accepted: dict[str, Any] = {}
    for key in ("toolsListChanged", "promptsListChanged", "resourcesListChanged"):
        if requested.get(key) is True:
            accepted[key] = True
    resources = requested.get("resourceSubscriptions")
    if isinstance(resources, list) and all(isinstance(uri, str) for uri in resources):
        accepted["resourceSubscriptions"] = resources.copy()
    return accepted


def subscription_messages(message: dict[str, Any]) -> list[dict[str, Any]]:
    request_id = message["id"]
    requested = message["params"]["notifications"]
    accepted = accepted_filter(requested)
    subscription_meta = {SUBSCRIPTION_ID_KEY: request_id}
    messages: list[dict[str, Any]] = [
        {
            "jsonrpc": "2.0",
            "method": "notifications/subscriptions/acknowledged",
            "params": {"notifications": accepted, "_meta": subscription_meta.copy()},
        }
    ]
    if accepted.get("toolsListChanged"):
        messages.append(
            {
                "jsonrpc": "2.0",
                "method": "notifications/tools/list_changed",
                "params": {"_meta": subscription_meta.copy()},
            }
        )
    resources = accepted.get("resourceSubscriptions", [])
    if resources:
        messages.append(
            {
                "jsonrpc": "2.0",
                "method": "notifications/resources/updated",
                "params": {"uri": resources[0], "_meta": subscription_meta.copy()},
            }
        )
    messages.append(
        {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": complete({}, result_meta=subscription_meta),
        }
    )
    return messages


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format_string: str, *args: Any) -> None:
        sys.stderr.write("[mcp-http] " + (format_string % args) + "\n")

    def _write_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _write_fault(self, status: int, request_id: Any, fault: RpcFault) -> None:
        self._write_json(status, rpc_error(request_id, fault.code, str(fault), fault.data))

    def _valid_path_and_origin(self) -> bool:
        if self.path != "/mcp":
            self._write_json(404, {"error": "Not found"})
            return False
        try:
            reject_duplicate_origin(self.headers)
        except RpcFault as fault:
            self._write_fault(400, None, fault)
            return False
        origin = self.headers.get("Origin")
        if not origin_allowed(origin):
            self._write_json(403, {"error": "Origin not allowed"})
            return False
        return True

    def _method_not_allowed(self) -> None:
        body = json.dumps({"error": "Method not allowed"}).encode("utf-8")
        self.send_response(405)
        self.send_header("Allow", "POST")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _write_subscription_stream(self, message: dict[str, Any]) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        for payload in subscription_messages(message):
            self.wfile.write(
                f"data: {json.dumps(payload, separators=(',', ':'))}\n\n".encode("utf-8")
            )
            self.wfile.flush()

    def do_POST(self) -> None:
        if not self._valid_path_and_origin():
            return
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            self._write_json(415, {"error": "Content-Type must be application/json"})
            return
        accept = self.headers.get("Accept", "")
        if "application/json" not in accept or "text/event-stream" not in accept:
            self._write_json(406, {"error": "Accept must include JSON and SSE"})
            return
        try:
            reject_ambiguous_body_framing(self.headers)
            raw_length = self.headers.get("Content-Length")
            if raw_length is None:
                raise ValueError("Content-Length is required")
            if not raw_length.isascii() or not raw_length.isdigit():
                raise ValueError("Content-Length must contain ASCII decimal digits")
            length = int(raw_length)
            if not 1 <= length <= MAX_REQUEST_BYTES:
                raise ValueError(
                    f"Content-Length must be from 1 through {MAX_REQUEST_BYTES}"
                )
            self.connection.settimeout(READ_TIMEOUT_SECONDS)
            body = self.rfile.read(length)
            if len(body) != length:
                raise ValueError("request body ended before Content-Length bytes arrived")
            message = json.loads(body)
            if not isinstance(message, dict):
                raise ValueError("message must be an object")
        except (ValueError, json.JSONDecodeError, TimeoutError) as exc:
            self._write_json(400, rpc_error(None, -32700, "Parse error", {"detail": str(exc)}))
            return

        request_id = message.get("id")
        try:
            body_version = validate_request_structure(message)
            reject_duplicate_routing_headers(self.headers)
            validate_http_headers(self.headers, message, body_version)
            validate_supported_version(body_version)
        except RpcFault as fault:
            self._write_fault(400, request_id, fault)
            return

        if "id" not in message:
            self.send_response(202)
            self.end_headers()
            return

        if message["method"] == "subscriptions/listen":
            notifications = message["params"].get("notifications")
            if not isinstance(notifications, dict):
                self._write_fault(
                    400,
                    request_id,
                    RpcFault(-32602, "subscriptions/listen requires notifications"),
                )
                return
            self._write_subscription_stream(message)
            return

        response = dispatch(message)
        status = 404 if response and response.get("error", {}).get("code") == -32601 else 200
        if response is not None:
            self._write_json(status, response)

    def do_GET(self) -> None:
        if self._valid_path_and_origin():
            self._method_not_allowed()

    def do_DELETE(self) -> None:
        if self._valid_path_and_origin():
            self._method_not_allowed()


def serve(host: str = "127.0.0.1", port: int = 0) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer((host, port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def post(url: str, message: dict[str, Any], headers: Mapping[str, str]) -> tuple[int, Any, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(message).encode("utf-8"),
        headers=dict(headers),
        method="POST",
    )
    try:
        response = urllib.request.urlopen(request, timeout=3)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        status = exc.code
        response_headers = exc.headers
        exc.close()
        return status, response_headers, json.loads(body) if body else None
    with response:
        body = response.read().decode("utf-8")
        if response.headers.get_content_type() == "application/json":
            payload: Any = json.loads(body)
        else:
            payload = body
        return response.status, response.headers, payload


def probe() -> None:
    server = serve()
    url = f"http://127.0.0.1:{server.server_port}/mcp"
    print("MCP 2026-07-28 Streamable HTTP probe")

    discover = make_request(1, "server/discover")
    status, _, _ = post(url, discover, http_headers_for(discover, origin="http://evil.example"))
    print(f"  invalid Origin: HTTP {status}")

    status, headers, payload = post(url, discover, http_headers_for(discover))
    print(
        f"  discovery: HTTP {status}, version={payload['result']['supportedVersions'][0]}, "
        f"session-header={headers.get('Mcp-Session-Id')}"
    )

    listing = make_request(2, "tools/list")
    removed = {"Mcp-Session-Id": "ignored", "Last-Event-ID": "ignored"}
    status, headers, payload = post(url, listing, http_headers_for(listing, extra=removed))
    print(
        f"  removed headers ignored: HTTP {status}, tool={payload['result']['tools'][0]['name']}, "
        f"echo={headers.get('Mcp-Session-Id')}"
    )

    mismatched = http_headers_for(listing)
    mismatched["Mcp-Method"] = "tools/call"
    status, _, payload = post(url, listing, mismatched)
    print(f"  header mismatch: HTTP {status}, code={payload['error']['code']}")

    future = make_request(3, "tools/list", version="2027-01-01")
    status, _, payload = post(url, future, http_headers_for(future))
    print(f"  unsupported version: HTTP {status}, code={payload['error']['code']}")

    notification = make_request(4, "tools/list")
    del notification["id"]
    status, _, payload = post(url, notification, http_headers_for(notification))
    print(f"  accepted notification: HTTP {status}, empty-body={payload == ''}")

    for method in ("GET", "DELETE"):
        request = urllib.request.Request(
            url,
            headers={"Origin": "http://localhost"},
            method=method,
        )
        try:
            urllib.request.urlopen(request, timeout=3)
        except urllib.error.HTTPError as exc:
            status = exc.code
            exc.close()
            print(f"  {method}: HTTP {status}")

    listen = make_request(
        "listen-1",
        "subscriptions/listen",
        {"notifications": {"toolsListChanged": True}},
    )
    status, _, stream = post(url, listen, http_headers_for(listen))
    print(
        f"  subscriptions/listen: HTTP {status}, "
        f"SSE={('notifications/subscriptions/acknowledged' in stream)}, "
        f"tagged={SUBSCRIPTION_ID_KEY in stream}"
    )

    server.shutdown()
    server.server_close()


def main() -> None:
    if "--serve" not in sys.argv:
        probe()
        return
    server = serve("127.0.0.1", 8017)
    print("MCP 2026-07-28 endpoint: http://127.0.0.1:8017/mcp")
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
