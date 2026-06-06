"""Phase 13 Lesson 09 - Streamable HTTP MCP endpoint skeleton.

Uses stdlib http.server to serve a single /mcp endpoint supporting:
  - POST /mcp   (client request; JSON-RPC in, JSON or SSE out)
  - GET  /mcp   (open server-to-client SSE stream)
  - DELETE /mcp (explicit session termination)

Enforces Origin allowlist and assigns Mcp-Session-Id on first POST.
Reuses the Lesson 07 dispatch shape for tool behavior.

Run: python code/main.py               # starts server on :8017
      python code/main.py --probe       # run self-probe over TCP loopback
"""

from __future__ import annotations

import json
import secrets
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer


ORIGIN_ALLOWLIST = {
    "http://localhost",
    "http://127.0.0.1",
    "https://claude.ai",
    "vscode-webview://localhost",
}


SESSIONS: dict[str, dict] = {}

TOOLS = [
    {"name": "ping", "description": "Use when you need a sanity check. Do not use for real work.",
     "inputSchema": {"type": "object", "properties": {}, "required": []}},
]


def dispatch(msg: dict) -> dict | None:
    if "id" not in msg:
        return None
    method = msg.get("method")
    if method == "initialize":
        return {"jsonrpc": "2.0", "id": msg["id"], "result": {
            "protocolVersion": "2025-11-25",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "lesson-09-http", "version": "1.0.0"},
        }}
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": msg["id"], "result": {"tools": TOOLS}}
    if method == "tools/call":
        return {"jsonrpc": "2.0", "id": msg["id"], "result": {
            "content": [{"type": "text", "text": "pong"}],
            "isError": False,
        }}
    return {"jsonrpc": "2.0", "id": msg["id"],
            "error": {"code": -32601, "message": f"method not found: {method}"}}


def origin_allowed(origin: str | None) -> bool:
    if origin is None:
        return False
    for a in ORIGIN_ALLOWLIST:
        if origin == a or origin.startswith(a + "/") or origin.startswith(a + ":"):
            return True
    return False


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[srv] " + (fmt % args) + "\n")

    def _deny(self, code: int, msg: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"error": msg}).encode())

    def _require_origin(self) -> bool:
        origin = self.headers.get("Origin")
        if not origin_allowed(origin):
            self._deny(403, f"Origin not allowed: {origin!r}")
            return False
        return True

    def _resolve_session(self, msg: dict) -> str | None:
        """Return the session id, or None if a 404 was already sent.

        Per the Streamable HTTP spec (2025-11-25), only the `initialize`
        method may mint a session. Any other method arriving with an
        unknown or missing `Mcp-Session-Id` MUST be rejected with 404
        so the client knows to re-initialize.
        """
        sid = self.headers.get("Mcp-Session-Id")
        if msg.get("method") == "initialize":
            new = secrets.token_hex(16)
            SESSIONS[new] = {"created": time.time()}
            return new
        if not sid or sid not in SESSIONS:
            self._deny(404, "Unknown or expired session; re-initialize")
            return None
        return sid

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/mcp":
            return self._deny(404, "Not found")
        if not self._require_origin():
            return
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        try:
            msg = json.loads(body)
        except json.JSONDecodeError:
            return self._deny(400, "Invalid JSON")
        sid = self._resolve_session(msg)
        if sid is None:
            return
        resp = dispatch(msg)
        if resp is None:
            # JSON-RPC notification or response: ack only.
            self.send_response(202)
            self.send_header("Mcp-Session-Id", sid)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Mcp-Session-Id", sid)
        self.end_headers()
        self.wfile.write(json.dumps(resp).encode() + b"\n")

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/mcp":
            return self._deny(404, "Not found")
        if not self._require_origin():
            return
        accept = self.headers.get("Accept", "")
        if "text/event-stream" not in accept:
            return self._deny(405, "GET requires Accept: text/event-stream")
        sid = self.headers.get("Mcp-Session-Id")
        if not sid or sid not in SESSIONS:
            return self._deny(404, "Unknown session")
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Mcp-Session-Id", sid)
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        for i in range(3):
            payload = json.dumps({"jsonrpc": "2.0", "method": "notifications/progress",
                                  "params": {"progressToken": "p1", "progress": i, "total": 3}})
            self.wfile.write(f"id: {i}\nevent: message\ndata: {payload}\n\n".encode())
            try:
                self.wfile.flush()
            except Exception:
                return
            time.sleep(0.05)

    def do_DELETE(self) -> None:  # noqa: N802
        if self.path != "/mcp":
            return self._deny(404, "Not found")
        if not self._require_origin():
            return
        sid = self.headers.get("Mcp-Session-Id")
        if sid:
            SESSIONS.pop(sid, None)
        self.send_response(204)
        self.end_headers()


def serve(host: str, port: int) -> HTTPServer:
    srv = HTTPServer((host, port), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def probe() -> None:
    srv = serve("127.0.0.1", 8017)
    time.sleep(0.2)
    print("=" * 72)
    print("PHASE 13 LESSON 09 - STREAMABLE HTTP PROBE")
    print("=" * 72)

    print("\n1) evil origin is rejected")
    req = urllib.request.Request("http://127.0.0.1:8017/mcp",
                                 data=b'{"jsonrpc":"2.0","id":1,"method":"initialize"}',
                                 headers={"Origin": "http://evil.example", "Content-Type": "application/json"},
                                 method="POST")
    try:
        urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        print(f"  -> HTTP {e.code} (expected 403)")

    print("\n2) localhost origin is accepted; session id assigned")
    req = urllib.request.Request("http://127.0.0.1:8017/mcp",
                                 data=b'{"jsonrpc":"2.0","id":1,"method":"initialize"}',
                                 headers={"Origin": "http://localhost", "Content-Type": "application/json"},
                                 method="POST")
    with urllib.request.urlopen(req) as resp:
        sid = resp.headers.get("Mcp-Session-Id")
        print(f"  -> HTTP {resp.status}  session={sid}")

    print("\n3) echo session id on next request")
    req = urllib.request.Request("http://127.0.0.1:8017/mcp",
                                 data=b'{"jsonrpc":"2.0","id":2,"method":"tools/list"}',
                                 headers={"Origin": "http://localhost", "Content-Type": "application/json",
                                          "Mcp-Session-Id": sid},
                                 method="POST")
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode()
        print(f"  -> HTTP {resp.status}  echoed session {resp.headers.get('Mcp-Session-Id') == sid}")
        print(f"     tools: {json.loads(body)['result']['tools'][0]['name']}")

    print("\n4) DELETE session")
    req = urllib.request.Request("http://127.0.0.1:8017/mcp",
                                 headers={"Origin": "http://localhost", "Mcp-Session-Id": sid},
                                 method="DELETE")
    with urllib.request.urlopen(req) as resp:
        print(f"  -> HTTP {resp.status} (expected 204)")

    print("\n5) next request with dead session is refused")
    req = urllib.request.Request("http://127.0.0.1:8017/mcp",
                                 headers={"Origin": "http://localhost",
                                          "Mcp-Session-Id": sid,
                                          "Accept": "text/event-stream"},
                                 method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"  -> HTTP {resp.status} (unexpected)")
    except urllib.error.HTTPError as e:
        print(f"  -> HTTP {e.code} (expected 404)")

    srv.shutdown()


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "--probe":
        probe()
        return
    srv = serve("127.0.0.1", 8017)
    print("Streamable HTTP MCP endpoint on 127.0.0.1:8017/mcp  (Ctrl-C to stop)")
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        srv.shutdown()


if __name__ == "__main__":
    main()
