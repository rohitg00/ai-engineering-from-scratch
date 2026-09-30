"""Companion code for:
certifications/mcpa/lessons/20-caching-and-pagination/docs/en.md
A client cache that honors ttlMs, cacheScope, and list-changed invalidation while paging through
opaque cursors.
Sources: SEP-2549; MCP 2026-07-28 Caching and Pagination pages.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"
SUBSCRIPTION_ID_KEY = "io.modelcontextprotocol/subscriptionId"

INVALID_PARAMS = -32602
METHOD_NOT_FOUND = -32601

PAGE_SIZE = 2


def make_request(request_id: int, method: str, params: dict | None = None, capabilities: dict | None = None,
                 version: str = PROTOCOL_VERSION) -> dict:
    body = dict(params or {})
    body["_meta"] = {
        PV_KEY: version,
        CAPS_KEY: capabilities or {},
        CLIENT_INFO_KEY: {"name": "lesson-client", "version": "1.0.0"},
    }
    return {"jsonrpc": "2.0", "id": request_id, "method": method, "params": body}


def make_result(request_id: Any, result_type: str = "complete", **fields: Any) -> dict:
    return {"jsonrpc": "2.0", "id": request_id, "result": {"resultType": result_type, **fields}}


def make_error(request_id: Any, code: int, message: str, data: Any = None) -> dict:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


def make_notification(method: str, params: dict | None = None) -> dict:
    return {"jsonrpc": "2.0", "method": method, "params": params or {}}


def encode_cursor(offset: int) -> str:
    if offset == PAGE_SIZE:
        return ""
    return str(offset)


def decode_cursor(cursor: str | None) -> int | None:
    if cursor is None:
        return 0
    if cursor == "":
        return PAGE_SIZE
    if cursor.isdigit():
        return int(cursor)
    return None


NOTES = sorted(
    [
        {"uri": "note://shared/readme", "name": "readme"},
        {"uri": "note://shared/changelog", "name": "changelog"},
        {"uri": "note://shared/faq", "name": "faq"},
        {"uri": "note://private/journal", "name": "journal"},
        {"uri": "note://private/vault", "name": "vault"},
    ],
    key=lambda note: note["uri"],
)

PUBLIC_CONTENT = {
    "note://shared/readme": "Start here. This server lists shared notes and two private ones.",
    "note://shared/changelog": "2026-07-28: the server moved to the stateless core.",
    "note://shared/faq": "Q: does a connection keep state? A: no, every request stands alone.",
}


@dataclass
class NotesServer:
    name: str = "notes"
    call_counts: dict = field(default_factory=dict)

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def _record(self, method: str) -> None:
        self.call_counts[method] = self.call_counts.get(method, 0) + 1

    def handle(self, message: dict, token: str = "") -> dict:
        request_id = message.get("id")
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        if not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        method = message.get("method")
        self._record(method)
        if method == "resources/list":
            return self._list(request_id, params)
        if method == "resources/read":
            return self._read(request_id, params, token)
        if method == "subscriptions/listen":
            return make_result(request_id, "complete", _meta=self._server_meta())
        return make_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")

    def _list(self, request_id: Any, params: dict) -> dict:
        cursor = params.get("cursor")
        offset = decode_cursor(cursor)
        if offset is None or offset > len(NOTES):
            return make_error(request_id, INVALID_PARAMS, f"Invalid cursor: {cursor!r}")
        page = NOTES[offset:offset + PAGE_SIZE]
        fields = {
            "resources": page,
            "ttlMs": 120000,
            "cacheScope": "public",
            "_meta": self._server_meta(),
        }
        next_offset = offset + PAGE_SIZE
        if next_offset < len(NOTES):
            fields["nextCursor"] = encode_cursor(next_offset)
        return make_result(request_id, "complete", **fields)

    def _read(self, request_id: Any, params: dict, token: str) -> dict:
        uri = params.get("uri")
        if uri in PUBLIC_CONTENT:
            return make_result(
                request_id,
                "complete",
                contents=[{"uri": uri, "mimeType": "text/plain", "text": PUBLIC_CONTENT[uri]}],
                ttlMs=300000,
                cacheScope="public",
                _meta=self._server_meta(),
            )
        if uri == "note://private/journal":
            text = f"{token or 'anonymous'}'s journal: nothing urgent today."
            return make_result(
                request_id,
                "complete",
                contents=[{"uri": uri, "mimeType": "text/plain", "text": text}],
                ttlMs=30000,
                cacheScope="private",
                _meta=self._server_meta(),
            )
        if uri == "note://private/vault":
            return self._read_vault(request_id, params, token)
        return make_error(request_id, INVALID_PARAMS, f"Resource not found: {uri}")

    def _read_vault(self, request_id: Any, params: dict, token: str) -> dict:
        if "inputResponses" in params:
            confirmation = params["inputResponses"].get("confirm", {})
            content = confirmation.get("content") if isinstance(confirmation, dict) else None
            if not isinstance(content, dict) or confirmation.get("action") != "accept" or content.get("proceed") is not True:
                return make_result(request_id, "complete", contents=[], ttlMs=0, cacheScope="private",
                                    _meta=self._server_meta())
            text = f"{token or 'anonymous'}'s vault: rotate the deploy key before Friday."
            return make_result(
                request_id,
                "complete",
                contents=[{"uri": params["uri"], "mimeType": "text/plain", "text": text}],
                ttlMs=15000,
                cacheScope="private",
                _meta=self._server_meta(),
            )
        return make_result(
            request_id,
            "input_required",
            inputRequests={
                "confirm": {
                    "method": "elicitation/create",
                    "params": {
                        "mode": "form",
                        "message": "Confirm you want to read the vault note.",
                        "requestedSchema": {"type": "object", "properties": {"proceed": {"type": "boolean"}}},
                    },
                }
            },
            requestState=f"vault:{token or 'anonymous'}",
        )


@dataclass
class CacheEntry:
    value: dict
    expires_at_ms: int


class ClientCache:
    def __init__(self, now_ms: Callable[[], int]) -> None:
        self.now_ms = now_ms
        self.entries: dict[tuple, CacheEntry] = {}

    def _key(self, method: str, cache_params: tuple, token: str, private: bool) -> tuple:
        return (method, cache_params, token if private else None)

    def get(self, method: str, cache_params: tuple, token: str) -> dict | None:
        for private in (True, False):
            entry = self.entries.get(self._key(method, cache_params, token, private))
            if entry is not None and self.now_ms() < entry.expires_at_ms:
                return entry.value
        return None

    def store(self, method: str, cache_params: tuple, token: str, result: dict) -> None:
        ttl_ms = result.get("ttlMs", 0)
        if ttl_ms < 0:
            ttl_ms = 0
        private = result.get("cacheScope") == "private"
        key = self._key(method, cache_params, token, private)
        self.entries[key] = CacheEntry(value=result, expires_at_ms=self.now_ms() + ttl_ms)

    def invalidate_method(self, method: str) -> None:
        for key in [key for key in self.entries if key[0] == method]:
            del self.entries[key]


class FakeClock:
    def __init__(self, start_ms: int = 0) -> None:
        self.ms = start_ms

    def now(self) -> int:
        return self.ms

    def advance(self, delta_ms: int) -> None:
        self.ms += delta_ms


class Client:
    def __init__(self, server: NotesServer, token: str, clock: FakeClock, cache: ClientCache) -> None:
        self.server = server
        self.token = token
        self.clock = clock
        self.cache = cache
        self.next_id = 0
        self.log: list[dict] = []
        self.subscription_id: int | None = None
        self._pending_listen_request: dict | None = None

    def _send(self, method: str, params: dict | None = None) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params)
        response = self.server.handle(request, self.token)
        self.log.append(request)
        self.log.append(response)
        return response

    def list_resources(self, cursor: str | None = None) -> dict:
        cache_params = (cursor,)
        cached = self.cache.get("resources/list", cache_params, self.token)
        if cached is not None:
            return cached
        params = {} if cursor is None else {"cursor": cursor}
        response = self._send("resources/list", params)
        if "error" in response:
            return response
        result = response["result"]
        self.cache.store("resources/list", cache_params, self.token, result)
        return result

    def read_resource(self, uri: str) -> dict:
        cache_params = (uri,)
        cached = self.cache.get("resources/read", cache_params, self.token)
        if cached is not None:
            return cached
        response = self._send("resources/read", {"uri": uri})
        if "error" in response:
            return response
        result = response["result"]
        if result["resultType"] == "input_required":
            return self._resolve_input_required(response, {"uri": uri})
        self.cache.store("resources/read", cache_params, self.token, result)
        return result

    def _resolve_input_required(self, response: dict, original_params: dict) -> dict:
        result = response["result"]
        self.next_id += 1
        retry_params = dict(original_params)
        retry_params["inputResponses"] = {"confirm": {"action": "accept", "content": {"proceed": True}}}
        if "requestState" in result:
            retry_params["requestState"] = result["requestState"]
        request = make_request(self.next_id, "resources/read", retry_params)
        retry_response = self.server.handle(request, self.token)
        self.log.append(request)
        self.log.append(retry_response)
        if "error" in retry_response:
            return retry_response
        return retry_response["result"]

    def listen(self, notifications: dict) -> int:
        self.next_id += 1
        request_id = self.next_id
        request = make_request(request_id, "subscriptions/listen", {"notifications": notifications})
        self.log.append(request)
        self._pending_listen_request = request
        self.subscription_id = request_id
        ack = make_notification(
            "notifications/subscriptions/acknowledged",
            {"notifications": notifications, "_meta": {SUBSCRIPTION_ID_KEY: request_id}},
        )
        self.log.append(ack)
        return request_id

    def deliver_list_changed(self) -> None:
        notification = make_notification(
            "notifications/resources/list_changed",
            {"_meta": {SUBSCRIPTION_ID_KEY: self.subscription_id}},
        )
        self.log.append(notification)
        self.cache.invalidate_method("resources/list")

    def close_listen(self) -> None:
        request = self._pending_listen_request
        response = self.server.handle(request, self.token)
        self.log.append(response)
        self._pending_listen_request = None


def legacy_server_violation() -> dict:
    return {
        "violation": (
            "a server implemented before SEP-2549 omits ttlMs and cacheScope; a 2026-07-28 client "
            "must default ttlMs to 0 and treat the result as immediately stale rather than trust it"
        ),
        "message": {
            "jsonrpc": "2.0",
            "id": "legacy-1",
            "result": {"resultType": "complete", "resources": NOTES},
        },
    }


def run_scenario() -> tuple[NotesServer, Client, Client, FakeClock, ClientCache]:
    clock = FakeClock()
    server = NotesServer()
    cache = ClientCache(clock.now)
    alice = Client(server, "alice-token", clock, cache)
    bob = Client(server, "bob-token", clock, cache)

    alice.list_resources()
    alice.list_resources()
    alice.list_resources(cursor="")
    alice.list_resources(cursor="4")
    alice.list_resources(cursor="not-a-real-cursor")

    alice.read_resource("note://shared/readme")
    bob.read_resource("note://shared/readme")
    alice.read_resource("note://private/journal")
    bob.read_resource("note://private/journal")

    alice.listen({"resourcesListChanged": True})
    alice.deliver_list_changed()
    alice.close_listen()
    alice.list_resources()

    alice.read_resource("note://private/vault")

    clock.advance(30001)
    alice.read_resource("note://private/journal")

    return server, alice, bob, clock, cache


def transcript() -> list[dict]:
    server, alice, bob, clock, cache = run_scenario()
    return alice.log + bob.log + [legacy_server_violation()]


def demo() -> None:
    server, alice, bob, clock, cache = run_scenario()
    print("resources/list wire calls for 5 client-side requests:", server.call_counts.get("resources/list", 0))
    print("resources/read wire calls for 6 client-side reads:   ", server.call_counts.get("resources/read", 0))
    print("entries held in the shared client cache:              ", len(cache.entries))
    print()
    print("wire transcript (alice, then bob, then one deliberate violation)")
    for entry in transcript():
        message = entry["message"] if isinstance(entry, dict) and "violation" in entry else entry
        print("  " + json.dumps(message, sort_keys=True)[:170])


if __name__ == "__main__":
    demo()
