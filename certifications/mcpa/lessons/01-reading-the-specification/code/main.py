"""Companion code for:
certifications/mcpa/lessons/01-reading-the-specification/docs/en.md
A spec navigator over keyword strength, feature lifecycle, and changelog data.
Sources: MCP 2026-07-28 changelog and deprecated-features registry; RFC 2119; RFC 8174;
SEP-2596.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
UNSUPPORTED_PROTOCOL_VERSION = -32022


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


REVISION_STATES = {
    "2024-11-05": "Final",
    "2025-03-26": "Final",
    "2025-06-18": "Final",
    "2025-11-25": "Final",
    "2026-07-28": "Current",
}


def revision_state(revision: str) -> str:
    return REVISION_STATES.get(revision, "unknown")


KEYWORD_ORDER = [
    "MUST NOT", "SHALL NOT", "SHOULD NOT", "NOT RECOMMENDED",
    "MUST", "REQUIRED", "SHALL", "SHOULD", "RECOMMENDED", "MAY", "OPTIONAL",
]
KEYWORD_STRENGTH = {
    "MUST NOT": "forbidden",
    "SHALL NOT": "forbidden",
    "SHOULD NOT": "not_recommended",
    "NOT RECOMMENDED": "not_recommended",
    "MUST": "required",
    "REQUIRED": "required",
    "SHALL": "required",
    "SHOULD": "recommended",
    "RECOMMENDED": "recommended",
    "MAY": "optional",
    "OPTIONAL": "optional",
}


def classify_requirement(text: str) -> str:
    for keyword in KEYWORD_ORDER:
        if re.search(r"\b" + re.escape(keyword) + r"\b", text):
            return KEYWORD_STRENGTH[keyword]
    return "unspecified"


@dataclass
class Feature:
    name: str
    sep: str | None
    deprecated_in: str | None
    window_months: int | None
    migration: str
    follows: str | None = None
    removed_in: str | None = None
    removal_note: str | None = None


DEPRECATED_REGISTRY: list[Feature] = [
    Feature("roots", "SEP-2577", "2026-07-28", 12,
            "Pass directories or files via tool parameters, resource URIs, or server configuration"),
    Feature("sampling", "SEP-2577", "2026-07-28", 12,
            "Integrate directly with LLM provider APIs"),
    Feature("logging", "SEP-2577", "2026-07-28", 12,
            "Log to stderr for stdio transports, or use OpenTelemetry for observability"),
    Feature("dynamic-client-registration", "PR-2858", "2026-07-28", 12,
            "Client ID Metadata Documents"),
    Feature("include-context-this-server-all-servers", "SEP-2596", "2025-11-25", None,
            'Omit the field or set it to "none"', follows="sampling"),
    Feature("http-sse-transport", "SEP-2596", "2025-03-26", None,
            "Streamable HTTP",
            removal_note="three months after SEP-2596 reaches Final, under its transition provisions, "
                          "not a twelve-month window computed from a revision release"),
    Feature("json-rpc-batching", None, None, None,
            "None documented; batching was removed with no Deprecated state at all, which is part of "
            "why the feature lifecycle policy exists",
            removed_in="2025-06-18"),
]
FEATURE_BY_NAME = {feature.name: feature for feature in DEPRECATED_REGISTRY}


def find_feature(name: str) -> Feature | None:
    return FEATURE_BY_NAME.get(name)


def feature_state(name: str, revision: str) -> str:
    feature = find_feature(name)
    if feature is None:
        return "unknown"
    if feature.removed_in is not None and revision >= feature.removed_in:
        return "removed"
    if feature.deprecated_in is not None and revision >= feature.deprecated_in:
        return "deprecated"
    return "active"


def migration_path(name: str) -> str | None:
    feature = find_feature(name)
    return feature.migration if feature else None


def add_months(date_str: str, months: int) -> str:
    year, month, day = (int(part) for part in date_str.split("-"))
    total = month - 1 + months
    year += total // 12
    month = total % 12 + 1
    return f"{year:04d}-{month:02d}-{day:02d}"


def earliest_removal(name: str) -> str | None:
    feature = find_feature(name)
    if feature is None:
        return None
    if feature.removal_note is not None:
        return feature.removal_note
    basis = find_feature(feature.follows) if feature.follows else feature
    if basis is None or basis.deprecated_in is None or basis.window_months is None:
        return None
    return add_months(basis.deprecated_in, basis.window_months)


@dataclass
class ChangelogEntry:
    sep: str
    revision: str
    summary: str


CHANGELOG_ENTRIES: list[ChangelogEntry] = [
    ChangelogEntry("SEP-2575", PROTOCOL_VERSION,
                    "Remove the handshake and protocol sessions; every request carries its protocol "
                    "version and capabilities in _meta, and server/discover becomes the entry point."),
    ChangelogEntry("SEP-2567", PROTOCOL_VERSION,
                    "Remove the session header; list results stop varying per connection; cross-call "
                    "state moves to explicit server-minted handles."),
    ChangelogEntry("SEP-2322", PROTOCOL_VERSION,
                    "Introduce Multi Round-Trip Requests: a server asks for more input with an "
                    "input_required result instead of sending its own request to the client."),
    ChangelogEntry("SEP-2549", PROTOCOL_VERSION,
                    "Require ttlMs and cacheScope on list and read results through the CacheableResult "
                    "interface."),
    ChangelogEntry("SEP-2596", PROTOCOL_VERSION,
                    "Adopt the feature lifecycle and deprecation policy: Active, Deprecated, and Removed "
                    "states, a twelve-month minimum window, and the deprecated features registry."),
    ChangelogEntry("PR-2858", PROTOCOL_VERSION,
                    "Deprecate Dynamic Client Registration in favor of Client ID Metadata Documents."),
    ChangelogEntry("SEP-1850", PROTOCOL_VERSION,
                    "Formalize the PR-based SEP workflow with markdown files in the seps directory and "
                    "PR-derived numbering."),
]
CHANGELOG_BY_SEP = {entry.sep: entry for entry in CHANGELOG_ENTRIES}


def changelog_lookup(sep: str) -> ChangelogEntry | None:
    return CHANGELOG_BY_SEP.get(sep)


class SpecServer:
    def __init__(self, name: str) -> None:
        self.name = name

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def handle(self, message: dict) -> dict:
        request_id = message.get("id")
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        if PV_KEY not in meta or CAPS_KEY not in meta:
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        if meta[PV_KEY] != PROTOCOL_VERSION:
            return make_error(
                request_id,
                UNSUPPORTED_PROTOCOL_VERSION,
                "Unsupported protocol version",
                {"supported": [PROTOCOL_VERSION], "requested": meta[PV_KEY]},
            )
        method = message.get("method")
        if method == "server/discover":
            return make_result(
                request_id,
                supportedVersions=[PROTOCOL_VERSION],
                capabilities={"tools": {"listChanged": False}},
                instructions="Call tools/list to see what this server offers.",
                ttlMs=300000,
                cacheScope="public",
                _meta=self._server_meta(),
            )
        return make_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")


class Client:
    def __init__(self, server: SpecServer) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[dict] = []

    def send(self, method: str, params: dict | None = None, version: str = PROTOCOL_VERSION) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params, version=version)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response

    def discover(self) -> dict:
        return self.send("server/discover")["result"]


def run_scenario() -> Client:
    client = Client(SpecServer("spec-navigator"))
    client.discover()
    client.send("server/discover", version="2025-11-25")
    return client


def transcript() -> list[dict]:
    client = run_scenario()
    malformed_request = {"jsonrpc": "2.0", "id": 999, "method": "server/discover", "params": {}}
    malformed_response = SpecServer("spec-navigator").handle(malformed_request)
    entries: list[Any] = list(client.log)
    entries.append({
        "violation": "a server/discover request without params._meta is malformed; 2026-07-28 requires "
                      "the protocol version and client capabilities on every request",
        "message": malformed_request,
    })
    entries.append(malformed_response)
    return entries


def demo() -> None:
    print("keyword strength (all capitals only)")
    for sentence in (
        "Clients MUST NOT batch requests.",
        "A server SHOULD document which dialects it supports.",
        "Consumers MAY set limits for image size.",
        "The client must not batch requests.",
    ):
        print(f"  {classify_requirement(sentence):15s} {sentence!r}")

    print("\nrevision states")
    for revision in ("2025-11-25", "2026-07-28", "2099-01-01"):
        print(f"  {revision}: {revision_state(revision)}")

    print("\nfeature state across revisions")
    for name in ("roots", "json-rpc-batching"):
        for revision in ("2025-11-25", "2026-07-28"):
            print(f"  {name} at {revision}: {feature_state(name, revision)}")

    print("\nearliest removal")
    for name in ("roots", "include-context-this-server-all-servers", "http-sse-transport", "json-rpc-batching"):
        print(f"  {name}: {earliest_removal(name)}")

    print("\nchangelog lookup")
    for sep in ("SEP-2596", "SEP-9999"):
        entry = changelog_lookup(sep)
        print(f"  {sep}: {entry.summary if entry else None}")

    print("\nwire transcript")
    for entry in transcript():
        message = entry.get("message", entry) if isinstance(entry, dict) and "violation" in entry else entry
        print("  " + json.dumps(message, sort_keys=True)[:160])


if __name__ == "__main__":
    demo()
