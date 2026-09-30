"""Companion code for:
certifications/mcpa/lessons/16-notifications-and-subscriptions/docs/en.md
A subscriptions/listen stream demultiplexed by subscription id, next to a request's own progress
notifications.
Sources: MCP 2026-07-28 Subscriptions, Progress, and Cancellation pages.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"
SUB_KEY = "io.modelcontextprotocol/subscriptionId"
PROGRESS_TOKEN_KEY = "progressToken"

STREAM_METHODS = {
    "toolsListChanged": "notifications/tools/list_changed",
    "promptsListChanged": "notifications/prompts/list_changed",
    "resourcesListChanged": "notifications/resources/list_changed",
}
PROGRESS_STEPS = (0.2, 0.6, 1.0)


def make_request(request_id: int, method: str, params: dict | None = None, capabilities: dict | None = None,
                 version: str = PROTOCOL_VERSION, progress_token: Any = None) -> dict:
    body = dict(params or {})
    meta = {
        PV_KEY: version,
        CAPS_KEY: capabilities or {},
        CLIENT_INFO_KEY: {"name": "lesson-client", "version": "1.0.0"},
    }
    if progress_token is not None:
        meta[PROGRESS_TOKEN_KEY] = progress_token
    body["_meta"] = meta
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


@dataclass
class Subscription:
    subscription_id: Any
    granted: dict[str, Any]
    open: bool = True


@dataclass
class SubscriptionServer:
    name: str
    supported_filters: frozenset[str] = field(
        default_factory=lambda: frozenset({"toolsListChanged", "resourcesListChanged", "resourceSubscriptions"})
    )
    subscriptions: dict[Any, Subscription] = field(default_factory=dict)

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def listen(self, request: dict) -> dict:
        request_id = request["id"]
        requested = (request.get("params") or {}).get("notifications") or {}
        granted = {key: value for key, value in requested.items() if key in self.supported_filters}
        self.subscriptions[request_id] = Subscription(subscription_id=request_id, granted=granted)
        return make_notification(
            "notifications/subscriptions/acknowledged",
            {"_meta": {SUB_KEY: request_id}, "notifications": granted},
        )

    def resource_updated(self, subscription_id: Any, uri: str) -> dict | None:
        sub = self.subscriptions.get(subscription_id)
        if sub is None or not sub.open:
            return None
        if uri not in (sub.granted.get("resourceSubscriptions") or []):
            return None
        return make_notification(
            "notifications/resources/updated",
            {"_meta": {SUB_KEY: subscription_id}, "uri": uri},
        )

    def list_changed(self, subscription_id: Any, which: str) -> dict | None:
        sub = self.subscriptions.get(subscription_id)
        if sub is None or not sub.open:
            return None
        if not sub.granted.get(which):
            return None
        return make_notification(STREAM_METHODS[which], {"_meta": {SUB_KEY: subscription_id}})

    def cancel(self, subscription_id: Any) -> None:
        sub = self.subscriptions.get(subscription_id)
        if sub is not None:
            sub.open = False

    def close_gracefully(self, subscription_id: Any) -> dict | None:
        sub = self.subscriptions.get(subscription_id)
        if sub is None or not sub.open:
            return None
        sub.open = False
        return make_result(subscription_id, _meta={SUB_KEY: subscription_id})

    def call_long_job(self, request: dict) -> tuple[dict, list[dict]]:
        params = request.get("params") or {}
        meta = params.get("_meta") or {}
        token = meta.get(PROGRESS_TOKEN_KEY)
        arguments = params.get("arguments") or {}
        target = arguments.get("target", "unknown")
        notifications = []
        if token is not None:
            for value in PROGRESS_STEPS:
                notifications.append(make_notification("notifications/progress", {
                    "progressToken": token,
                    "progress": value,
                    "total": 1.0,
                    "message": f"build {int(value * 100)}% complete",
                }))
        response = make_result(
            request["id"],
            content=[{"type": "text", "text": f"release build for {target} finished"}],
            structuredContent={"target": target, "status": "ok"},
            isError=False,
            _meta=self._server_meta(),
        )
        return response, notifications


@dataclass
class SubscriberClient:
    server: SubscriptionServer
    next_id: int = 0
    log: list[Any] = field(default_factory=list)
    local_subscriptions: set[Any] = field(default_factory=set)

    def _new_id(self) -> int:
        self.next_id += 1
        return self.next_id

    def listen(self, notifications: dict) -> int:
        request_id = self._new_id()
        request = make_request(request_id, "subscriptions/listen", {"notifications": notifications})
        self.log.append(request)
        ack = self.server.listen(request)
        self.log.append(ack)
        self.local_subscriptions.add(request_id)
        return request_id

    def receive_stream(self, notification: dict | None, *, violation: str | None = None) -> bool:
        if notification is None:
            return False
        sub_id = (notification.get("params") or {}).get("_meta", {}).get(SUB_KEY)
        if sub_id not in self.local_subscriptions:
            if violation:
                self.log.append({"violation": violation, "message": notification})
            return False
        self.log.append(notification)
        return True

    def cancel(self, subscription_id: Any, reason: str = "") -> None:
        notification = make_notification("notifications/cancelled", {"requestId": subscription_id, "reason": reason})
        self.log.append(notification)
        self.local_subscriptions.discard(subscription_id)
        self.server.cancel(subscription_id)

    def close_gracefully(self, subscription_id: Any) -> dict | None:
        result = self.server.close_gracefully(subscription_id)
        if result is not None:
            self.log.append(result)
        self.local_subscriptions.discard(subscription_id)
        return result

    def call_with_progress(self, name: str, arguments: dict, progress_token: str) -> dict:
        request_id = self._new_id()
        request = make_request(
            request_id, "tools/call", {"name": name, "arguments": arguments}, progress_token=progress_token,
        )
        self.log.append(request)
        response, notifications = self.server.call_long_job(request)
        self.log.extend(notifications)
        self.log.append(response)
        return response


def run_scenario() -> tuple[SubscriptionServer, SubscriberClient]:
    server = SubscriptionServer("workspace")
    client = SubscriberClient(server)

    sub_a = client.listen({"toolsListChanged": True, "resourceSubscriptions": ["file:///project/config.json"]})
    sub_b = client.listen({"resourcesListChanged": True, "promptsListChanged": True})

    client.receive_stream(server.resource_updated(sub_a, "file:///project/config.json"))
    client.receive_stream(server.list_changed(sub_a, "toolsListChanged"))
    client.receive_stream(server.list_changed(sub_b, "resourcesListChanged"))
    client.receive_stream(server.list_changed(sub_b, "promptsListChanged"))
    client.receive_stream(server.list_changed(sub_a, "resourcesListChanged"))

    client.call_with_progress("run_build", {"target": "release"}, "job-42")

    client.cancel(sub_b, reason="client no longer interested in resource changes")
    late = make_notification(
        "notifications/resources/updated",
        {"_meta": {SUB_KEY: sub_b}, "uri": "file:///project/report.csv"},
    )
    client.receive_stream(
        late,
        violation=(
            "a resources/updated notification for subscription 2 was already in flight when the cancel landed; "
            "the client dropped it instead of routing it, because it no longer tracks that subscription id"
        ),
    )

    client.close_gracefully(sub_a)

    return server, client


def transcript() -> list[dict]:
    _, client = run_scenario()
    return client.log


def demo() -> None:
    server, client = run_scenario()
    print("subscription and progress transcript")
    for message in client.log:
        print("  " + json.dumps(message, sort_keys=True)[:170])
    print("\nfinal subscription state")
    for subscription_id, sub in server.subscriptions.items():
        print(f"  subscription {subscription_id}: open={sub.open} granted={sub.granted}")


if __name__ == "__main__":
    demo()
