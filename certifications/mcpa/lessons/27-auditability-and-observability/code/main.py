"""Companion code for:
certifications/mcpa/lessons/27-auditability-and-observability/docs/en.md
Trace context propagation and a hash-chained audit log for MCP tool calls.
Sources: SEP-414; W3C Trace Context; W3C Baggage.
"""

from __future__ import annotations

import hashlib
import json
import re
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"
TRACEPARENT_KEY = "traceparent"
TRACESTATE_KEY = "tracestate"
BAGGAGE_KEY = "baggage"

METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602

GENESIS_HASH = "0" * 64
REDACTED = "***REDACTED***"

TRACEPARENT_RE = re.compile(
    r"^(?P<version>[0-9a-f]{2})-(?P<trace_id>[0-9a-f]{32})-(?P<parent_id>[0-9a-f]{16})-(?P<flags>[0-9a-f]{2})$"
)


def new_trace_id() -> str:
    return secrets.token_hex(16)


def new_span_id() -> str:
    return secrets.token_hex(8)


def make_traceparent(trace_id: str, span_id: str, sampled: bool = True) -> str:
    return f"00-{trace_id}-{span_id}-{'01' if sampled else '00'}"


def parse_traceparent(value: Any) -> dict[str, str]:
    if not isinstance(value, str):
        raise ValueError("traceparent must be a string")
    match = TRACEPARENT_RE.match(value)
    if match is None:
        raise ValueError(f"traceparent does not match version-traceid-parentid-flags: {value!r}")
    parsed = match.groupdict()
    if parsed["trace_id"] == "0" * 32:
        raise ValueError("traceparent trace-id must not be all zeros")
    if parsed["parent_id"] == "0" * 16:
        raise ValueError("traceparent parent-id must not be all zeros")
    return parsed


def child_traceparent(value: str) -> str:
    parsed = parse_traceparent(value)
    return make_traceparent(parsed["trace_id"], new_span_id(), sampled=parsed["flags"] != "00")


def new_root_traceparent(sampled: bool = True) -> str:
    return make_traceparent(new_trace_id(), new_span_id(), sampled=sampled)


@dataclass(frozen=True)
class Principal:
    subject: str


TOKENS: dict[str, Principal] = {
    "tok-alice-prod": Principal(subject="alice@example.com"),
    "tok-svc-ci": Principal(subject="svc-release-bot"),
}


def authenticate(bearer_token: str) -> Principal:
    principal = TOKENS.get(bearer_token)
    if principal is None:
        raise PermissionError(f"unrecognized bearer token: {bearer_token!r}")
    return principal


def make_request(
    request_id: Any,
    method: str,
    params: dict[str, Any] | None = None,
    capabilities: dict[str, Any] | None = None,
    client_info: dict[str, Any] | None = None,
    version: str = PROTOCOL_VERSION,
    traceparent: str | None = None,
    tracestate: str | None = None,
    baggage: str | None = None,
) -> dict[str, Any]:
    body = dict(params or {})
    meta: dict[str, Any] = {PV_KEY: version, CAPS_KEY: capabilities or {}}
    if client_info is not None:
        meta[CLIENT_INFO_KEY] = client_info
    if traceparent is not None:
        meta[TRACEPARENT_KEY] = traceparent
    if tracestate is not None:
        meta[TRACESTATE_KEY] = tracestate
    if baggage is not None:
        meta[BAGGAGE_KEY] = baggage
    body["_meta"] = meta
    return {"jsonrpc": "2.0", "id": request_id, "method": method, "params": body}


def make_result(request_id: Any, result_type: str = "complete", **fields: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": {"resultType": result_type, **fields}}


def make_error(request_id: Any, code: int, message: str, data: Any = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[["CallContext", dict[str, Any]], str]
    flagged_fields: frozenset[str] = field(default_factory=frozenset)


@dataclass
class AuditEntry:
    index: int
    timestamp: str
    trace_id: str
    request_id: Any
    principal: str
    method: str
    tool: str | None
    arguments: dict[str, Any]
    result_channel: str
    prev_hash: str
    hash: str


@dataclass
class AuditLog:
    entries: list[AuditEntry] = field(default_factory=list)

    def _last_hash(self) -> str:
        return self.entries[-1].hash if self.entries else GENESIS_HASH

    @staticmethod
    def _digest(
        prev_hash: str,
        timestamp: str,
        trace_id: str,
        request_id: Any,
        principal: str,
        method: str,
        tool: str | None,
        arguments: dict[str, Any],
        result_channel: str,
    ) -> str:
        payload = json.dumps(
            {
                "prev_hash": prev_hash,
                "timestamp": timestamp,
                "trace_id": trace_id,
                "request_id": request_id,
                "principal": principal,
                "method": method,
                "tool": tool,
                "arguments": arguments,
                "result_channel": result_channel,
            },
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def append(
        self,
        trace_id: str,
        request_id: Any,
        principal: str,
        method: str,
        tool: str | None,
        arguments: dict[str, Any],
        result_channel: str,
    ) -> AuditEntry:
        timestamp = datetime.now(timezone.utc).isoformat()
        prev_hash = self._last_hash()
        digest = self._digest(prev_hash, timestamp, trace_id, request_id, principal, method, tool, arguments, result_channel)
        entry = AuditEntry(
            index=len(self.entries),
            timestamp=timestamp,
            trace_id=trace_id,
            request_id=request_id,
            principal=principal,
            method=method,
            tool=tool,
            arguments=arguments,
            result_channel=result_channel,
            prev_hash=prev_hash,
            hash=digest,
        )
        self.entries.append(entry)
        return entry

    def verify(self) -> tuple[bool, int | None]:
        expected_prev = GENESIS_HASH
        for entry in self.entries:
            if entry.prev_hash != expected_prev:
                return False, entry.index
            recomputed = self._digest(
                entry.prev_hash, entry.timestamp, entry.trace_id, entry.request_id,
                entry.principal, entry.method, entry.tool, entry.arguments, entry.result_channel,
            )
            if recomputed != entry.hash:
                return False, entry.index
            expected_prev = entry.hash
        return True, None


@dataclass
class IdSequence:
    value: int = 1

    def next(self) -> int:
        current = self.value
        self.value += 1
        return current


@dataclass
class Server:
    name: str
    tools: dict[str, Tool] = field(default_factory=dict)
    log: AuditLog = field(default_factory=AuditLog)
    upstream: "Server | None" = None

    def register(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def _redacted(self, tool: Tool, arguments: dict[str, Any]) -> dict[str, Any]:
        return {key: (REDACTED if key in tool.flagged_fields else value) for key, value in arguments.items()}

    def _server_meta(self) -> dict[str, Any]:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def call_upstream(self, ctx: "CallContext", tool: str, arguments: dict[str, Any]) -> str:
        if self.upstream is None:
            raise RuntimeError(f"{self.name} has no upstream server configured")
        child = child_traceparent(ctx.traceparent)
        request_id = ctx.id_seq.next()
        request = make_request(
            request_id,
            "tools/call",
            {"name": tool, "arguments": arguments},
            capabilities={},
            client_info={"name": f"{self.name}-upstream-client", "version": "1.0.0"},
            traceparent=child,
            tracestate=ctx.tracestate,
            baggage=ctx.baggage,
        )
        ctx.wire_log.append(request)
        response = self.upstream.handle(request, ctx.headers, ctx.id_seq, ctx.wire_log)
        ctx.wire_log.append(response)
        if "error" in response:
            raise RuntimeError(f"upstream call failed: {response['error']}")
        return response["result"]["content"][0]["text"]

    def handle(self, request: dict[str, Any], headers: dict[str, str], id_seq: IdSequence, wire_log: list[dict[str, Any]]) -> dict[str, Any]:
        request_id = request.get("id")
        method = request.get("method")
        params = request.get("params") if isinstance(request.get("params"), dict) else {}
        meta = params.get("_meta") if isinstance(params.get("_meta"), dict) else {}
        if not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return make_error(request_id, INVALID_PARAMS, "missing required _meta fields")

        traceparent = meta.get(TRACEPARENT_KEY) or new_root_traceparent()
        try:
            trace_id = parse_traceparent(traceparent)["trace_id"]
        except ValueError:
            traceparent = new_root_traceparent()
            trace_id = parse_traceparent(traceparent)["trace_id"]
        tracestate = meta.get(TRACESTATE_KEY)
        baggage = meta.get(BAGGAGE_KEY)

        bearer = headers.get("Authorization", "")
        token = bearer[len("Bearer "):] if bearer.startswith("Bearer ") else bearer
        try:
            principal = authenticate(token).subject
        except PermissionError:
            self.log.append(trace_id, request_id, "unauthenticated", method, None, {}, "protocol_error")
            return make_error(request_id, INVALID_PARAMS, "unrecognized bearer token")

        if method != "tools/call":
            return make_error(request_id, METHOD_NOT_FOUND, f"method not found: {method}")

        name = params.get("name")
        tool = self.tools.get(name)
        if tool is None:
            self.log.append(trace_id, request_id, principal, method, name, {}, "protocol_error")
            return make_error(request_id, INVALID_PARAMS, f"unknown tool: {name!r}")

        arguments = params.get("arguments") if isinstance(params.get("arguments"), dict) else {}
        missing = [key for key in tool.input_schema.get("required", []) if key not in arguments]
        if missing:
            self.log.append(trace_id, request_id, principal, method, name, self._redacted(tool, arguments), "isError")
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Missing required argument(s): {', '.join(missing)}. Provide them and call again."}],
                isError=True,
                _meta=self._server_meta(),
            )

        ctx = CallContext(
            server=self, traceparent=traceparent, trace_id=trace_id, tracestate=tracestate,
            baggage=baggage, principal=principal, headers=headers, id_seq=id_seq, wire_log=wire_log,
        )
        text = tool.handler(ctx, arguments)
        self.log.append(trace_id, request_id, principal, method, name, self._redacted(tool, arguments), "complete")
        return make_result(request_id, content=[{"type": "text", "text": text}], isError=False, _meta=self._server_meta())


@dataclass
class CallContext:
    server: Server
    traceparent: str
    trace_id: str
    tracestate: str | None
    baggage: str | None
    principal: str
    headers: dict[str, str]
    id_seq: IdSequence
    wire_log: list[dict[str, Any]]

    def call_upstream(self, tool: str, arguments: dict[str, Any]) -> str:
        return self.server.call_upstream(self, tool, arguments)


def _list_recent_grants(ctx: CallContext, arguments: dict[str, Any]) -> str:
    return "3 grants in the last 24h: alice@example.com x2, svc-release-bot x1"


def _reset_api_key(ctx: CallContext, arguments: dict[str, Any]) -> str:
    receipt = ctx.call_upstream("store_secret", {"account_id": arguments["account_id"], "secret": arguments["new_key"]})
    return f"api key rotated for {arguments['account_id']}: {receipt}"


def build_vault_server() -> Server:
    vault = Server(name="credential-vault")
    vault.register(Tool(
        name="store_secret",
        description="Persist a rotated secret and return its vault reference.",
        input_schema={
            "type": "object",
            "properties": {"account_id": {"type": "string"}, "secret": {"type": "string"}},
            "required": ["account_id", "secret"],
        },
        handler=lambda ctx, args: f"stored under vault ref vlt-{args['account_id']}",
        flagged_fields=frozenset({"secret"}),
    ))
    return vault


def build_ops_server(upstream: Server) -> Server:
    ops = Server(name="ops-desk", upstream=upstream)
    ops.register(Tool(
        name="list_recent_grants",
        description="List recent access grants for review.",
        input_schema={"type": "object", "additionalProperties": False},
        handler=_list_recent_grants,
    ))
    ops.register(Tool(
        name="reset_api_key",
        description="Rotate an account's API key through the credential vault.",
        input_schema={
            "type": "object",
            "properties": {"account_id": {"type": "string"}, "new_key": {"type": "string"}},
            "required": ["account_id", "new_key"],
        },
        handler=_reset_api_key,
        flagged_fields=frozenset({"new_key"}),
    ))
    return ops


class Client:
    def __init__(self, server: Server, bearer_token: str, client_name: str, id_seq: IdSequence, wire_log: list[dict[str, Any]]) -> None:
        self.server = server
        self.bearer_token = bearer_token
        self.client_name = client_name
        self.id_seq = id_seq
        self.wire_log = wire_log

    def call_tool(
        self,
        name: str,
        arguments: dict[str, Any],
        traceparent: str | None = None,
        tracestate: str | None = None,
        baggage: str | None = None,
    ) -> dict[str, Any]:
        request_id = self.id_seq.next()
        request = make_request(
            request_id,
            "tools/call",
            {"name": name, "arguments": arguments},
            capabilities={},
            client_info={"name": self.client_name, "version": "1.0.0"},
            traceparent=traceparent,
            tracestate=tracestate,
            baggage=baggage,
        )
        self.wire_log.append(request)
        headers = {"Authorization": f"Bearer {self.bearer_token}"}
        response = self.server.handle(request, headers, self.id_seq, self.wire_log)
        self.wire_log.append(response)
        return response


@dataclass
class Scenario:
    client: Client
    rogue: Client
    ops: Server
    vault: Server
    wire_log: list[dict[str, Any]]


def run_scenario() -> Scenario:
    id_seq = IdSequence()
    wire_log: list[dict[str, Any]] = []
    vault = build_vault_server()
    ops = build_ops_server(vault)
    client = Client(ops, bearer_token="tok-alice-prod", client_name="support-console", id_seq=id_seq, wire_log=wire_log)
    rogue = Client(ops, bearer_token="tok-unknown", client_name="shadow-client", id_seq=id_seq, wire_log=wire_log)

    client.call_tool("list_recent_grants", {}, traceparent=new_root_traceparent())
    client.call_tool(
        "reset_api_key",
        {"account_id": "acct-42", "new_key": "k-8f2c9e"},
        traceparent=new_root_traceparent(),
        tracestate="vendor=ops-desk",
        baggage="team=support",
    )
    client.call_tool("reset_api_key", {"account_id": "acct-77"}, traceparent=new_root_traceparent())
    client.call_tool("delete_everything", {}, traceparent=new_root_traceparent())
    rogue.call_tool("list_recent_grants", {}, traceparent=new_root_traceparent())

    return Scenario(client=client, rogue=rogue, ops=ops, vault=vault, wire_log=wire_log)


def transcript() -> list[dict[str, Any]]:
    return run_scenario().wire_log


def render_log(label: str, log: AuditLog) -> None:
    print(f"\n{label} audit log")
    for entry in log.entries:
        print(f"  [{entry.index}] {entry.principal} called {entry.tool} -> {entry.result_channel}  args={entry.arguments}  trace={entry.trace_id[:8]}..")


def demo() -> None:
    scenario = run_scenario()

    sample = new_root_traceparent()
    parsed = parse_traceparent(sample)
    print("sample traceparent:", sample)
    print("  version:", parsed["version"], "trace_id:", parsed["trace_id"], "parent_id:", parsed["parent_id"], "flags:", parsed["flags"])
    child = child_traceparent(sample)
    print("child traceparent: ", child, "(same trace_id, new parent_id)")

    print("\nwire messages")
    for message in scenario.wire_log:
        print(" ", json.dumps(message, sort_keys=True)[:170])

    render_log("ops-desk", scenario.ops.log)
    render_log("credential-vault", scenario.vault.log)

    ok, broken_at = scenario.ops.log.verify()
    print("\nops-desk log verify before tampering ->", ok, broken_at)
    scenario.ops.log.entries[0].arguments = dict(scenario.ops.log.entries[0].arguments)
    scenario.ops.log.entries[0].arguments["tampered"] = True
    ok, broken_at = scenario.ops.log.verify()
    print("ops-desk log verify after tampering entry 0 ->", ok, broken_at)


if __name__ == "__main__":
    demo()
