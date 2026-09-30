"""Companion code for:
certifications/mcpa/lessons/04-the-stateless-core/docs/en.md
Two stateless replicas sharing one handle store answer any client's call.
Sources: SEP-2575 (stateless MCP); SEP-2567 (sessionless MCP); MCP 2026-07-28 basic protocol.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602  # JSON-RPC: Invalid params


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


DEFAULT_TTL_MS = 300000
BASKET_EXPIRY_TICKS = 5


@dataclass
class Clock:
    now: int = 0

    def advance(self, ticks: int = 1) -> None:
        self.now += ticks


@dataclass
class Basket:
    handle: str
    owner: str
    created_at: int
    last_active: int = 0
    items: list[str] = field(default_factory=list)


class SharedStore:
    """Durable storage every replica reads and writes; no basket lives inside a replica process."""

    def __init__(self, clock: Clock) -> None:
        self.clock = clock
        self.baskets: dict[str, Basket] = {}
        self._next_id = 0

    def create_basket(self, owner: str) -> Basket:
        self._next_id += 1
        digest = hashlib.sha256(f"{owner}:{self._next_id}".encode()).hexdigest()[:8]
        handle = f"bsk_{digest}"
        basket = Basket(handle=handle, owner=owner, created_at=self.clock.now, last_active=self.clock.now)
        self.baskets[handle] = basket
        return basket

    def get(self, handle: str) -> Basket | None:
        return self.baskets.get(handle)

    def is_expired(self, basket: Basket) -> bool:
        return self.clock.now - basket.last_active > BASKET_EXPIRY_TICKS


@dataclass
class ToolSpec:
    name: str
    description: str
    input_schema: dict

    def definition(self) -> dict:
        return {"name": self.name, "description": self.description, "inputSchema": self.input_schema}


TOOL_DEFINITIONS = sorted(
    [
        ToolSpec(
            "create_basket",
            f"Create a basket owned by the caller. Returns an opaque basket_id handle; baskets expire "
            f"after {BASKET_EXPIRY_TICKS} idle clock ticks.",
            {"type": "object", "additionalProperties": False},
        ),
        ToolSpec(
            "add_item",
            "Add a sku to an existing basket. Requires the basket_id handle returned by create_basket.",
            {
                "type": "object",
                "properties": {"basket_id": {"type": "string"}, "sku": {"type": "string"}},
                "required": ["basket_id", "sku"],
            },
        ),
        ToolSpec(
            "checkout",
            "Check out a basket by its basket_id handle and return the items it held.",
            {"type": "object", "properties": {"basket_id": {"type": "string"}}, "required": ["basket_id"]},
        ),
    ],
    key=lambda tool: tool.name,
)


@dataclass
class Replica:
    name: str
    store: SharedStore

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": f"basket-replica-{self.name}", "version": "1.0.0"}}

    def handle(self, message: dict, principal: str) -> dict:
        request_id = message.get("id")
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        meta = params.get("_meta") if isinstance(params.get("_meta"), dict) else None
        if not isinstance(meta, dict) or not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta protocol fields")
        method = message.get("method")
        if method == "tools/list":
            return make_result(
                request_id,
                tools=[tool.definition() for tool in TOOL_DEFINITIONS],
                ttlMs=DEFAULT_TTL_MS,
                cacheScope="public",
                _meta=self._server_meta(),
            )
        if method == "tools/call":
            return self._call(request_id, params, principal)
        return make_error(request_id, METHOD_NOT_FOUND, f"Unknown method: {method}")

    def _call(self, request_id: Any, params: dict, principal: str) -> dict:
        name = params.get("name")
        arguments = params.get("arguments") or {}
        if name == "create_basket":
            basket = self.store.create_basket(owner=principal)
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Created basket {basket.handle}"}],
                structuredContent={"basket_id": basket.handle},
                isError=False,
                _meta=self._server_meta(),
            )
        if name == "add_item":
            return self._with_basket(request_id, arguments, principal, self._add_item)
        if name == "checkout":
            return self._with_basket(request_id, arguments, principal, self._checkout)
        return make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")

    def _with_basket(self, request_id: Any, arguments: dict, principal: str, action) -> dict:
        handle = arguments.get("basket_id")
        basket = self.store.get(handle) if handle else None
        if basket is None:
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"No basket found for handle {handle!r}. Call create_basket again."}],
                isError=True,
                _meta=self._server_meta(),
            )
        if self.store.is_expired(basket):
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Basket {basket.handle} expired after {BASKET_EXPIRY_TICKS} idle ticks. Call create_basket again."}],
                isError=True,
                _meta=self._server_meta(),
            )
        if basket.owner != principal:
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Basket {basket.handle} belongs to a different principal. Call create_basket for your own."}],
                isError=True,
                _meta=self._server_meta(),
            )
        return action(request_id, basket, arguments)

    def _add_item(self, request_id: Any, basket: Basket, arguments: dict) -> dict:
        sku = arguments.get("sku")
        if not sku:
            return make_result(
                request_id,
                content=[{"type": "text", "text": "sku is required"}],
                isError=True,
                _meta=self._server_meta(),
            )
        basket.items.append(sku)
        basket.last_active = self.store.clock.now
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"Added {sku} to {basket.handle} ({len(basket.items)} item(s))"}],
            structuredContent={"basket_id": basket.handle, "items": list(basket.items)},
            isError=False,
            _meta=self._server_meta(),
        )

    def _checkout(self, request_id: Any, basket: Basket, arguments: dict) -> dict:
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"Checked out {basket.handle} with {len(basket.items)} item(s)"}],
            structuredContent={"basket_id": basket.handle, "items": list(basket.items)},
            isError=False,
            _meta=self._server_meta(),
        )


class Router:
    """Round robin dispatch across replicas that share one SharedStore; no replica is sticky to a client."""

    def __init__(self, replicas: list[Replica]) -> None:
        self.replicas = replicas
        self._next = 0

    def pick(self) -> Replica:
        replica = self.replicas[self._next % len(self.replicas)]
        self._next += 1
        return replica


class Client:
    def __init__(self, principal: str, router: Router) -> None:
        self.principal = principal
        self.router = router
        self.next_id = 0
        self.log: list[dict] = []

    def send(self, method: str, params: dict | None = None) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params)
        replica = self.router.pick()
        response = replica.handle(request, principal=self.principal)
        self.log.append(request)
        self.log.append(response)
        return response

    def list_tools(self) -> list[dict]:
        return self.send("tools/list")["result"]["tools"]

    def call(self, name: str, arguments: dict) -> dict:
        return self.send("tools/call", {"name": name, "arguments": arguments})


def build_deployment() -> tuple[Clock, Router, Client, Client, Client]:
    clock = Clock()
    store = SharedStore(clock)
    router = Router([Replica("A", store), Replica("B", store)])
    alice = Client("alice", router)
    alice_second_connection = Client("alice", router)
    bob = Client("bob", router)
    return clock, router, alice, alice_second_connection, bob


def run_scenario() -> tuple[Clock, Client, Client, Client]:
    clock, router, alice, alice2, bob = build_deployment()
    alice.list_tools()
    alice2.list_tools()
    created = alice.call("create_basket", {})
    basket_id = created["result"]["structuredContent"]["basket_id"]
    alice.call("add_item", {"basket_id": basket_id, "sku": "tent"})
    bob.call("add_item", {"basket_id": basket_id, "sku": "stove"})
    clock.advance(BASKET_EXPIRY_TICKS + 1)
    alice2.call("checkout", {"basket_id": basket_id})
    return clock, alice, alice2, bob


def transcript() -> list[dict]:
    _, alice, alice2, bob = run_scenario()
    return alice.log + alice2.log + bob.log


def demo() -> None:
    clock, alice, alice2, bob = run_scenario()
    same_list = [tool["name"] for tool in alice.log[1]["result"]["tools"]]
    other_list = [tool["name"] for tool in alice2.log[1]["result"]["tools"]]
    print("alice's first connection and her second connection see the identical tools/list:")
    print(" ", same_list, "==", other_list)
    print("each result's _meta names whichever replica answered; the client never had to care.\n")
    for label, client in (("alice (connection 1)", alice), ("alice (connection 2)", alice2), ("bob", bob)):
        print(f"{label} exchanges")
        for message in client.log:
            print("  " + json.dumps(message, sort_keys=True)[:170])
        print()


if __name__ == "__main__":
    demo()
