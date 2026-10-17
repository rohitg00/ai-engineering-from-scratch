"""Phase 13 Lesson 08: an opt-in Parallel Search HTTP peer.
Lesson: phases/13-tools-and-protocols/08-building-an-mcp-client/docs/en.md
Specification: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
Service: https://docs.parallel.ai/integrations/mcp/search-mcp
Run: python3 parallel_search.py search "MCP Streamable HTTP transport"
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
import uuid

from main import MultiServerClient, VERSION_KEY


ENDPOINT = "https://search.parallel.ai/mcp"
USER_AGENT = "ai-engineering-from-scratch/1.0 (Parallel Search MCP lesson)"
MAX_RESPONSE_BYTES = 2_000_000


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class ParallelTransport:
    def __init__(self) -> None:
        self.opener = urllib.request.build_opener(NoRedirects())
        self.session_id: str | None = None
        self.protocol_version: str | None = None

    def __call__(self, message: dict, timeout_ms: int | None = None) -> dict | None:
        timeout = (timeout_ms / 1000) if timeout_ms is not None else 30.0
        if timeout <= 0:
            raise ValueError("timeout must be positive")
        headers = {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        method = message["method"]
        version = message.get("params", {}).get("_meta", {}).get(VERSION_KEY)
        if method != "server/discover" and (version or self.protocol_version):
            headers["MCP-Protocol-Version"] = version or self.protocol_version
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id
        request = urllib.request.Request(
            ENDPOINT, data=json.dumps(message).encode(), headers=headers, method="POST"
        )
        started = time.monotonic()
        try:
            response = self.opener.open(request, timeout=timeout)
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                retry = exc.headers.get("Retry-After", "unspecified")
                exc.close()
                raise RuntimeError(f"Parallel rate limit: Retry-After={retry}") from exc
            if exc.headers.get_content_type() != "application/json":
                exc.close()
                raise
            response = exc
        with response:
            if "id" not in message:
                if response.status != 202:
                    raise RuntimeError(f"Notification rejected: HTTP {response.status}")
                return None
            media_type = response.headers.get_content_type()
            if media_type == "application/json":
                body = response.read(MAX_RESPONSE_BYTES + 1)
                if len(body) > MAX_RESPONSE_BYTES:
                    raise RuntimeError("MCP response exceeds size limit")
                payload = json.loads(body)
            elif media_type == "text/event-stream":
                payload = self._read_sse(response, message["id"], started + timeout)
            else:
                raise RuntimeError(f"Unexpected MCP content type: {media_type}")
            if not isinstance(payload, dict):
                raise RuntimeError("MCP response must be an object")
            if method == "initialize" and isinstance(payload.get("result"), dict):
                self.session_id = response.headers.get("Mcp-Session-Id")
                self.protocol_version = payload["result"].get("protocolVersion")
            return payload

    @staticmethod
    def _read_sse(response, request_id, deadline: float) -> dict:
        data: list[str] = []
        total = 0
        while time.monotonic() < deadline:
            line = response.readline(MAX_RESPONSE_BYTES - total + 1)
            total += len(line)
            if total > MAX_RESPONSE_BYTES:
                raise RuntimeError("MCP response exceeds size limit")
            if not line:
                break
            text = line.decode("utf-8").rstrip("\r\n")
            if text.startswith("data:"):
                data.append(text[5:].removeprefix(" "))
            elif text == "" and data:
                payload = json.loads("\n".join(data))
                data.clear()
                if isinstance(payload, dict) and payload.get("id") == request_id:
                    return payload
        raise RuntimeError("SSE stream ended without the requested response")


def connect_parallel() -> MultiServerClient:
    client = MultiServerClient(discovery_timeout_ms=10_000, legacy_probe_timeout_ms=10_000)
    client.add_server("parallel", ParallelTransport(), allow_legacy=True)
    client.connect_all()
    client.discover_tools()
    client.merge()
    return client


def main() -> None:
    parser = argparse.ArgumentParser(description="Run keyless search or fetch through the lesson client.")
    commands = parser.add_subparsers(dest="command", required=True)
    search = commands.add_parser("search")
    search.add_argument("query")
    fetch = commands.add_parser("fetch")
    fetch.add_argument("url")
    args = parser.parse_args()
    client = connect_parallel()
    conversation_id = str(uuid.uuid4())
    if args.command == "search":
        tool_name = "web_search"
        arguments = {"objective": args.query, "search_queries": [args.query], "session_id": conversation_id}
    else:
        tool_name = "web_fetch"
        arguments = {"urls": [args.url], "session_id": conversation_id}
    result = client.call(tool_name, arguments)
    if result.get("isError"):
        raise RuntimeError(json.dumps(result, ensure_ascii=False))
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, OSError) as exc:
        raise SystemExit(str(exc)) from exc
