"""Companion code for:
certifications/mcpa/lessons/33-mcpa-capstone-readiness/docs/en.md
Capstone: one 2026-07-28 incident-response exchange touching every MCPA domain.
Sources: MCP 2026-07-28 specification and the sources cited by lessons 00 to 32.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"
TRACEPARENT_KEY = "traceparent"

TASKS_EXTENSION = "io.modelcontextprotocol/tasks"
TASKS_CAPS = {"extensions": {TASKS_EXTENSION: {}}}
ELICIT_CAPS = {"elicitation": {"form": {}}}
RESTART_REQUIRES = {"elicitation": {}}

METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
MISSING_REQUIRED_CLIENT_CAPABILITY = -32021
UNSUPPORTED_PROTOCOL_VERSION = -32022

EXTENSION_RESULT_TYPES = {"task"}

GENESIS_HASH = "0" * 64
RESOURCE_URI = "https://ops.example.com/mcp"


def make_request(
    request_id: int,
    method: str,
    params: dict[str, Any] | None = None,
    capabilities: dict[str, Any] | None = None,
    version: str = PROTOCOL_VERSION,
    client_info: dict[str, Any] | None = None,
    traceparent: str | None = None,
    progress_token: Any = None,
) -> dict[str, Any]:
    body = dict(params or {})
    meta: dict[str, Any] = {PV_KEY: version, CAPS_KEY: capabilities or {}}
    meta[CLIENT_INFO_KEY] = client_info or {"name": "incident-console-client", "version": "1.0.0"}
    if traceparent is not None:
        meta[TRACEPARENT_KEY] = traceparent
    if progress_token is not None:
        meta["progressToken"] = progress_token
    body["_meta"] = meta
    return {"jsonrpc": "2.0", "id": request_id, "method": method, "params": body}


def make_result(request_id: Any, result_type: str = "complete", **fields: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": {"resultType": result_type, **fields}}


def make_error(request_id: Any, code: int, message: str, data: Any = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


def new_trace_id() -> str:
    return uuid.uuid4().hex


def new_span_id() -> str:
    return uuid.uuid4().hex[:16]


def make_traceparent(trace_id: str, span_id: str, sampled: bool = True) -> str:
    return f"00-{trace_id}-{span_id}-{'01' if sampled else '00'}"


def parse_traceparent(value: Any) -> dict[str, str]:
    if not isinstance(value, str):
        raise ValueError("traceparent must be a string")
    parts = value.split("-")
    if len(parts) != 4 or len(parts[1]) != 32 or len(parts[2]) != 16:
        raise ValueError(f"traceparent does not match version-traceid-parentid-flags: {value!r}")
    return {"version": parts[0], "trace_id": parts[1], "parent_id": parts[2], "flags": parts[3]}


def child_traceparent(value: str) -> str:
    parsed = parse_traceparent(value)
    return make_traceparent(parsed["trace_id"], new_span_id(), sampled=parsed["flags"] != "00")


def new_root_traceparent(sampled: bool = True) -> str:
    return make_traceparent(new_trace_id(), new_span_id(), sampled=sampled)


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def digest_request(name: str, arguments: dict[str, Any]) -> str:
    canonical = json.dumps({"method": "tools/call", "name": name, "arguments": arguments}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def mint_request_state(secret: bytes, principal: str, name: str, arguments: dict[str, Any], issued_at: int, nonce: str,
                       ttl_ticks: int = 50) -> str:
    payload = {
        "principal": principal,
        "expiresAt": issued_at + ttl_ticks,
        "requestDigest": digest_request(name, arguments),
        "nonce": nonce,
    }
    encoded = base64.urlsafe_b64encode(json.dumps(payload, sort_keys=True).encode("utf-8")).decode("ascii")
    signature = hmac.new(secret, encoded.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


@dataclass
class StateVerdict:
    ok: bool
    reason: str
    payload: dict[str, Any] | None = None


def verify_request_state(secret: bytes, state: Any, principal: str, name: str, arguments: dict[str, Any], now: int,
                         consumed: set[str]) -> StateVerdict:
    if not isinstance(state, str) or "." not in state:
        return StateVerdict(False, "requestState is missing or malformed")
    encoded, _, signature = state.rpartition(".")
    expected_signature = hmac.new(secret, encoded.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        return StateVerdict(False, "requestState signature does not verify; it was tampered with after the server issued it")
    try:
        payload = json.loads(base64.urlsafe_b64decode(encoded.encode("ascii")).decode("utf-8"))
    except Exception:
        return StateVerdict(False, "requestState payload could not be decoded")
    if payload.get("principal") != principal:
        return StateVerdict(False, "requestState was minted for a different principal")
    if now > payload.get("expiresAt", -1):
        return StateVerdict(False, "requestState expired before the retry arrived")
    if payload.get("requestDigest") != digest_request(name, arguments):
        return StateVerdict(False, "requestState does not match the request it was minted for")
    if payload.get("nonce") in consumed:
        return StateVerdict(False, "requestState was already redeemed")
    return StateVerdict(True, "ok", payload)


@dataclass
class AuditEntry:
    index: int
    timestamp: str
    trace_id: str | None
    request_id: Any
    principal: str
    method: str
    tool: str | None
    detail: str
    prev_hash: str
    hash: str


@dataclass
class AuditLog:
    entries: list[AuditEntry] = field(default_factory=list)

    def _last_hash(self) -> str:
        return self.entries[-1].hash if self.entries else GENESIS_HASH

    @staticmethod
    def _digest(prev_hash: str, timestamp: str, trace_id: str | None, request_id: Any, principal: str, method: str,
               tool: str | None, detail: str) -> str:
        payload = json.dumps(
            {
                "prev_hash": prev_hash,
                "timestamp": timestamp,
                "trace_id": trace_id,
                "request_id": request_id,
                "principal": principal,
                "method": method,
                "tool": tool,
                "detail": detail,
            },
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def append(self, trace_id: str | None, request_id: Any, principal: str, method: str, tool: str | None, detail: str) -> AuditEntry:
        timestamp = _timestamp()
        prev_hash = self._last_hash()
        digest = self._digest(prev_hash, timestamp, trace_id, request_id, principal, method, tool, detail)
        entry = AuditEntry(
            index=len(self.entries), timestamp=timestamp, trace_id=trace_id, request_id=request_id,
            principal=principal, method=method, tool=tool, detail=detail, prev_hash=prev_hash, hash=digest,
        )
        self.entries.append(entry)
        return entry

    def verify(self) -> tuple[bool, int | None]:
        expected_prev = GENESIS_HASH
        for entry in self.entries:
            if entry.prev_hash != expected_prev:
                return False, entry.index
            recomputed = self._digest(entry.prev_hash, entry.timestamp, entry.trace_id, entry.request_id,
                                      entry.principal, entry.method, entry.tool, entry.detail)
            if recomputed != entry.hash:
                return False, entry.index
            expected_prev = entry.hash
        return True, None


@dataclass
class AccessToken:
    value: str
    audience: str
    subject: str


def authorize_bearer(authorization_header: str | None, tokens: dict[str, AccessToken],
                     canonical_uri: str) -> tuple[AccessToken | None, int, str]:
    if not authorization_header or not authorization_header.startswith("Bearer "):
        return None, 401, "missing or malformed Authorization header"
    value = authorization_header[len("Bearer "):].strip()
    token = tokens.get(value)
    if token is None:
        return None, 401, "unknown or expired token"
    if token.audience != canonical_uri:
        return None, 401, f"token audience {token.audience!r} does not match this server {canonical_uri!r}"
    return token, 200, "ok"


@dataclass
class Task:
    task_id: str
    target: str
    status: str = "working"
    status_message: str = "Collecting fleet diagnostics."
    created_at: str = field(default_factory=_timestamp)
    last_updated_at: str = field(default_factory=_timestamp)
    ttl_ms: int = 600000
    poll_interval_ms: int = 1500
    result: dict[str, Any] | None = None

    def touch(self) -> None:
        self.last_updated_at = _timestamp()

    def snapshot(self, request_id: Any) -> dict[str, Any]:
        fields: dict[str, Any] = {
            "taskId": self.task_id,
            "status": self.status,
            "createdAt": self.created_at,
            "lastUpdatedAt": self.last_updated_at,
            "ttlMs": self.ttl_ms,
            "pollIntervalMs": self.poll_interval_ms,
        }
        if self.status_message:
            fields["statusMessage"] = self.status_message
        if self.status == "completed":
            fields["result"] = self.result
        return make_result(request_id, "complete", **fields)


SCAN_TOOL = {
    "name": "scan_fleet_health",
    "description": "Scan every region for unhealthy instances. Read only; reports progress while it runs.",
    "inputSchema": {"type": "object", "additionalProperties": False},
}
RESTART_TOOL = {
    "name": "restart_service",
    "description": "Restart a service in an environment. Destructive: interrupts active connections. Always asks for explicit confirmation before it executes.",
    "inputSchema": {
        "type": "object",
        "properties": {"service": {"type": "string"}, "environment": {"type": "string"}},
        "required": ["service", "environment"],
    },
    "annotations": {"destructiveHint": True, "idempotentHint": False, "openWorldHint": False, "readOnlyHint": False},
}
DIAGNOSTICS_TOOL = {
    "name": "run_full_diagnostics",
    "description": "Run a full diagnostic sweep of one target. May outlive one request; becomes a durable task when the caller declares io.modelcontextprotocol/tasks.",
    "inputSchema": {
        "type": "object",
        "properties": {"target": {"type": "string"}},
        "required": ["target"],
    },
}
ACKNOWLEDGE_TOOL = {
    "name": "acknowledge_incident",
    "description": "Acknowledge an open incident on behalf of the caller. Served only over HTTP behind OAuth; stdio callers use environment credentials instead.",
    "inputSchema": {
        "type": "object",
        "properties": {"incident_id": {"type": "string"}},
        "required": ["incident_id"],
    },
}
TOOL_DEFINITIONS = sorted([SCAN_TOOL, RESTART_TOOL, DIAGNOSTICS_TOOL, ACKNOWLEDGE_TOOL], key=lambda tool: tool["name"])


@dataclass
class Server:
    name: str = "incident-console"
    version: str = "3.1.0"
    hmac_secret: bytes = b"capstone-lesson-hmac-key-do-not-reuse-in-production"
    tasks: dict[str, Task] = field(default_factory=dict)
    audit: AuditLog = field(default_factory=AuditLog)
    consumed_nonces: set[str] = field(default_factory=set)
    tokens: dict[str, AccessToken] = field(default_factory=dict)
    _nonce_seq: int = 0
    _task_seq: int = 0

    def _server_meta(self) -> dict[str, Any]:
        return {SERVER_INFO_KEY: {"name": self.name, "version": self.version}}

    def _mint_nonce(self) -> str:
        self._nonce_seq += 1
        return f"nonce-{self._nonce_seq}"

    def _trace_id(self, meta: dict[str, Any]) -> str | None:
        traceparent = meta.get(TRACEPARENT_KEY)
        if not isinstance(traceparent, str):
            return None
        try:
            return parse_traceparent(traceparent)["trace_id"]
        except ValueError:
            return None

    def handle(self, message: dict[str, Any], principal: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        request_id = message.get("id")
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        meta = params.get("_meta") if isinstance(params.get("_meta"), dict) else None
        if not isinstance(meta, dict) or not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return [], make_error(request_id, INVALID_PARAMS, "Missing required _meta protocol fields")
        if meta[PV_KEY] != PROTOCOL_VERSION:
            return [], make_error(
                request_id, UNSUPPORTED_PROTOCOL_VERSION, "Unsupported protocol version",
                {"supported": [PROTOCOL_VERSION], "requested": meta[PV_KEY]},
            )
        method = message.get("method")
        trace_id = self._trace_id(meta)
        if method == "server/discover":
            return [], self._discover(request_id)
        if method == "tools/list":
            return [], self._list_tools(request_id)
        if method == "tools/call":
            return self._call_tool(request_id, params, meta, principal, trace_id)
        if method == "tasks/get":
            return [], self._task_get(request_id, params, meta, principal, trace_id)
        if method == "tasks/cancel":
            return [], self._task_cancel(request_id, params, meta, principal, trace_id)
        return [], make_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")

    def _discover(self, request_id: Any) -> dict[str, Any]:
        return make_result(
            request_id,
            supportedVersions=[PROTOCOL_VERSION],
            capabilities={"tools": {"listChanged": False}, "extensions": {TASKS_EXTENSION: {}}},
            instructions="Call restart_service only after the caller has accepted an elicitation confirmation. Declare io.modelcontextprotocol/tasks on run_full_diagnostics for work that may outlast one request.",
            ttlMs=600000,
            cacheScope="public",
            _meta=self._server_meta(),
        )

    def _list_tools(self, request_id: Any) -> dict[str, Any]:
        return make_result(request_id, tools=TOOL_DEFINITIONS, ttlMs=300000, cacheScope="public", _meta=self._server_meta())

    def _call_tool(self, request_id: Any, params: dict[str, Any], meta: dict[str, Any], principal: str,
                   trace_id: str | None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        name = params.get("name")
        if name == "scan_fleet_health":
            return self._scan_fleet_health(request_id, meta, principal, trace_id)
        if name == "restart_service":
            return [], self._restart_service(request_id, params, meta, principal, trace_id)
        if name == "run_full_diagnostics":
            return [], self._run_diagnostics(request_id, params, meta, principal, trace_id)
        if name == "acknowledge_incident":
            self.audit.append(trace_id, request_id, principal, "tools/call", name, "isError: requires the authorized HTTP endpoint")
            return [], make_result(
                request_id,
                content=[{"type": "text", "text": "acknowledge_incident is served only over the authorized HTTP endpoint. Send it there with a bearer token issued for this server."}],
                isError=True,
                _meta=self._server_meta(),
            )
        self.audit.append(trace_id, request_id, principal, "tools/call", name, "protocol_error: unknown tool")
        return [], make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")

    def _scan_fleet_health(self, request_id: Any, meta: dict[str, Any], principal: str,
                           trace_id: str | None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        progress_token = meta.get("progressToken")
        total = 3
        notifications: list[dict[str, Any]] = []
        if progress_token is not None:
            for tick in range(1, total + 1):
                notifications.append({
                    "jsonrpc": "2.0",
                    "method": "notifications/progress",
                    "params": {
                        "progressToken": progress_token,
                        "progress": tick,
                        "total": total,
                        "message": f"scanning fleet: region {tick} of {total}",
                    },
                })
        self.audit.append(trace_id, request_id, principal, "tools/call", "scan_fleet_health", "complete: 0 unhealthy")
        response = make_result(
            request_id,
            content=[{"type": "text", "text": "Fleet scan complete: 3 of 3 regions healthy"}],
            structuredContent={"regionsChecked": total, "unhealthy": 0},
            isError=False,
            _meta=self._server_meta(),
        )
        return notifications, response

    def _restart_service(self, request_id: Any, params: dict[str, Any], meta: dict[str, Any], principal: str,
                         trace_id: str | None) -> dict[str, Any]:
        arguments = params.get("arguments") or {}
        is_retry = "inputResponses" in params or "requestState" in params
        if not is_retry:
            missing = [key for key in RESTART_TOOL["inputSchema"]["required"] if key not in arguments]
            if missing:
                self.audit.append(trace_id, request_id, principal, "tools/call", "restart_service", f"isError: missing {', '.join(missing)}")
                return make_result(
                    request_id,
                    content=[{"type": "text", "text": f"Missing required argument(s): {', '.join(missing)}. Provide them and call restart_service again."}],
                    isError=True,
                    _meta=self._server_meta(),
                )
            client_capabilities = meta[CAPS_KEY]
            missing_caps = {key: value for key, value in RESTART_REQUIRES.items() if key not in client_capabilities}
            if missing_caps:
                self.audit.append(trace_id, request_id, principal, "tools/call", "restart_service", "protocol_error: missing elicitation capability")
                return make_error(
                    request_id, MISSING_REQUIRED_CLIENT_CAPABILITY,
                    "restart_service asks for confirmation through elicitation, which this request did not declare",
                    {"requiredCapabilities": missing_caps},
                )
            nonce = self._mint_nonce()
            state = mint_request_state(self.hmac_secret, principal, "restart_service", arguments, 0, nonce)
            self.audit.append(trace_id, request_id, principal, "tools/call", "restart_service", "input_required: confirmation requested")
            return make_result(
                request_id,
                result_type="input_required",
                inputRequests={
                    "confirm": {
                        "method": "elicitation/create",
                        "params": {
                            "mode": "form",
                            "message": f"Restart {arguments.get('service')} in {arguments.get('environment')}? This interrupts active connections.",
                            "requestedSchema": {
                                "type": "object",
                                "properties": {"confirmed": {"type": "boolean", "title": "Confirm restart", "default": False}},
                                "required": ["confirmed"],
                            },
                        },
                    }
                },
                requestState=state,
                _meta=self._server_meta(),
            )
        state = params.get("requestState")
        verdict = verify_request_state(self.hmac_secret, state, principal, "restart_service", arguments, 0, self.consumed_nonces)
        if not verdict.ok:
            self.audit.append(trace_id, request_id, principal, "tools/call", "restart_service", f"isError: requestState rejected ({verdict.reason})")
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Confirmation rejected: {verdict.reason}. Call restart_service again to request a fresh confirmation."}],
                isError=True,
                _meta=self._server_meta(),
            )
        self.consumed_nonces.add(verdict.payload["nonce"])
        responses = params.get("inputResponses") if isinstance(params.get("inputResponses"), dict) else {}
        confirm = responses.get("confirm")
        approved = (
            isinstance(confirm, dict)
            and confirm.get("action") == "accept"
            and isinstance(confirm.get("content"), dict)
            and confirm["content"].get("confirmed") is True
        )
        if approved:
            self.audit.append(trace_id, request_id, principal, "tools/call", "restart_service", "complete: restarted")
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Restarted {arguments['service']} in {arguments['environment']}"}],
                structuredContent={"service": arguments["service"], "environment": arguments["environment"], "restarted": True},
                isError=False,
                _meta=self._server_meta(),
            )
        self.audit.append(trace_id, request_id, principal, "tools/call", "restart_service", "complete: not restarted, declined")
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"Restart of {arguments['service']} in {arguments['environment']} was not performed; confirmation was not given."}],
            structuredContent={"service": arguments["service"], "environment": arguments["environment"], "restarted": False},
            isError=False,
            _meta=self._server_meta(),
        )

    def _run_diagnostics(self, request_id: Any, params: dict[str, Any], meta: dict[str, Any], principal: str,
                        trace_id: str | None) -> dict[str, Any]:
        arguments = params.get("arguments") or {}
        missing = [key for key in DIAGNOSTICS_TOOL["inputSchema"]["required"] if key not in arguments]
        if missing:
            self.audit.append(trace_id, request_id, principal, "tools/call", "run_full_diagnostics", f"isError: missing {', '.join(missing)}")
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Missing required argument(s): {', '.join(missing)}. Provide them and call run_full_diagnostics again."}],
                isError=True,
                _meta=self._server_meta(),
            )
        target = arguments["target"]
        client_declares_tasks = TASKS_EXTENSION in (meta[CAPS_KEY].get("extensions") or {})
        if client_declares_tasks:
            self._task_seq += 1
            task_id = f"tsk_{self._task_seq:04d}_{uuid.uuid4().hex[:8]}"
            task = Task(task_id=task_id, target=target)
            self.tasks[task_id] = task
            self.audit.append(trace_id, request_id, principal, "tools/call", "run_full_diagnostics", f"task created: {task_id}")
            return make_result(
                request_id,
                result_type="task",
                taskId=task.task_id,
                status=task.status,
                statusMessage=task.status_message,
                createdAt=task.created_at,
                lastUpdatedAt=task.last_updated_at,
                ttlMs=task.ttl_ms,
                pollIntervalMs=task.poll_interval_ms,
                _meta=self._server_meta(),
            )
        self.audit.append(trace_id, request_id, principal, "tools/call", "run_full_diagnostics", "complete: synchronous, no tasks extension declared")
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"Diagnostics for {target} finished without the tasks extension: 0 critical anomalies"}],
            structuredContent={"target": target, "anomalies": 0},
            isError=False,
            _meta=self._server_meta(),
        )

    def _find_task(self, request_id: Any, params: dict[str, Any], meta: dict[str, Any]) -> tuple[Task | None, dict[str, Any] | None]:
        client_declares_tasks = TASKS_EXTENSION in (meta.get(CAPS_KEY, {}).get("extensions") or {})
        if not client_declares_tasks:
            return None, make_error(
                request_id, MISSING_REQUIRED_CLIENT_CAPABILITY, "Missing required client capability",
                {"requiredCapabilities": {"extensions": {TASKS_EXTENSION: {}}}},
            )
        task = self.tasks.get(params.get("taskId"))
        if task is None:
            return None, make_error(request_id, INVALID_PARAMS, "Failed to retrieve task: task not found")
        return task, None

    def _task_get(self, request_id: Any, params: dict[str, Any], meta: dict[str, Any], principal: str,
                  trace_id: str | None) -> dict[str, Any]:
        task, error = self._find_task(request_id, params, meta)
        if error is not None:
            self.audit.append(trace_id, request_id, principal, "tasks/get", "run_full_diagnostics", "protocol_error: task lookup refused")
            return error
        self.audit.append(trace_id, request_id, principal, "tasks/get", "run_full_diagnostics", f"task poll: {task.status}")
        return task.snapshot(request_id)

    def _task_cancel(self, request_id: Any, params: dict[str, Any], meta: dict[str, Any], principal: str,
                     trace_id: str | None) -> dict[str, Any]:
        task, error = self._find_task(request_id, params, meta)
        if error is not None:
            return error
        if task.status not in ("completed", "cancelled"):
            task.status = "cancelled"
            task.status_message = "Cancelled before finishing."
            task.touch()
        self.audit.append(trace_id, request_id, principal, "tasks/cancel", "run_full_diagnostics", f"task cancelled: {task.task_id}")
        return make_result(request_id)

    def advance_task(self, task_id: str) -> None:
        task = self.tasks[task_id]
        if task.status == "working":
            task.status = "completed"
            task.status_message = ""
            task.result = {
                "resultType": "complete",
                "content": [{"type": "text", "text": f"Diagnostics for {task.target} finished: 2 anomalies found, 1 auto remediated"}],
                "structuredContent": {"target": task.target, "anomalies": 2, "autoRemediated": 1},
                "isError": False,
                "_meta": self._server_meta(),
            }
            task.touch()

    def handle_http_tool_call(self, message: dict[str, Any], authorization_header: str | None) -> tuple[int, dict[str, Any] | None]:
        request_id = message.get("id")
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        meta = params.get("_meta") if isinstance(params.get("_meta"), dict) else {}
        trace_id = self._trace_id(meta) if isinstance(meta, dict) else None
        token, status, reason = authorize_bearer(authorization_header, self.tokens, RESOURCE_URI)
        if token is None:
            self.audit.append(trace_id, request_id, "unauthenticated", "tools/call", "acknowledge_incident", f"unauthorized: {reason}")
            return status, None
        if not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return 400, make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        arguments = params.get("arguments") or {}
        incident_id = arguments.get("incident_id", "unknown")
        self.audit.append(trace_id, request_id, token.subject, "tools/call", "acknowledge_incident", "complete: acknowledged")
        result = make_result(
            request_id,
            content=[{"type": "text", "text": f"Incident {incident_id} acknowledged by {token.subject}"}],
            structuredContent={"incidentId": incident_id, "acknowledgedBy": token.subject},
            isError=False,
            _meta=self._server_meta(),
        )
        return 200, result


def build_server() -> Server:
    server = Server()
    server.tokens = {
        "tok-alice-oncall": AccessToken(value="tok-alice-oncall", audience=RESOURCE_URI, subject="alice-oncall"),
        "tok-foreign-svc": AccessToken(value="tok-foreign-svc", audience="https://other-tenant.example.com/mcp", subject="svc-foreign"),
    }
    return server


class Client:
    def __init__(self, principal: str, server: Server) -> None:
        self.principal = principal
        self.server = server
        self.next_id = 0
        self.log: list[Any] = []

    def _id(self) -> int:
        self.next_id += 1
        return self.next_id

    def send(
        self,
        method: str,
        params: dict[str, Any] | None = None,
        capabilities: dict[str, Any] | None = None,
        version: str = PROTOCOL_VERSION,
        traceparent: str | None = None,
        progress_token: Any = None,
        input_responses: dict[str, Any] | None = None,
        request_state: Any = None,
        violation: str | None = None,
    ) -> dict[str, Any]:
        request_id = self._id()
        body = dict(params or {})
        if input_responses is not None:
            body["inputResponses"] = input_responses
        if request_state is not None:
            body["requestState"] = request_state
        request = make_request(
            request_id, method, body, capabilities=capabilities or {}, version=version,
            traceparent=traceparent, progress_token=progress_token,
        )
        notifications, response = self.server.handle(request, self.principal)
        self.log.append({"violation": violation, "message": request} if violation else request)
        self.log.extend(notifications)
        self.log.append(response)
        return response

    def call_http(self, name: str, arguments: dict[str, Any], authorization_header: str | None,
                  traceparent: str | None = None) -> tuple[int, dict[str, Any] | None]:
        request_id = self._id()
        request = make_request(request_id, "tools/call", {"name": name, "arguments": arguments}, traceparent=traceparent)
        meta = request["params"]["_meta"]
        headers = {"MCP-Protocol-Version": meta[PV_KEY], "Mcp-Method": "tools/call", "Mcp-Name": name}
        if authorization_header:
            headers["Authorization"] = authorization_header
        status, response = self.server.handle_http_tool_call(request, authorization_header)
        self.log.append({"http": {"headers": headers, "status": status}, "message": request})
        if response is not None:
            self.log.append(response)
        return status, response


def run_scenario() -> dict[str, Any]:
    server = build_server()
    alice = Client("alice-oncall", server)
    bob = Client("bob-readonly", server)

    trace = new_root_traceparent()

    def hop() -> str:
        nonlocal trace
        trace = child_traceparent(trace)
        return trace

    mismatch = alice.send("server/discover", version="2025-11-25", traceparent=hop())
    supported_version = mismatch["error"]["data"]["supported"][0]
    alice.send("server/discover", version=supported_version, traceparent=hop())
    alice.send("tools/list", traceparent=hop())

    alice.send("tools/call", {"name": "scan_fleet_health", "arguments": {}}, traceparent=hop(), progress_token="scan-1")
    alice.send("tools/call", {"name": "close_incident_ticket", "arguments": {"incident_id": "INC-501"}}, traceparent=hop())
    alice.send("tools/execute", {"name": "scan_fleet_health", "arguments": {}}, traceparent=hop())

    restart_incomplete = {"service": "checkout-api"}
    restart_args = {"service": "checkout-api", "environment": "production"}
    alice.send("tools/call", {"name": "restart_service", "arguments": restart_incomplete}, capabilities=ELICIT_CAPS, traceparent=hop())
    bob.send("tools/call", {"name": "restart_service", "arguments": restart_args}, capabilities={}, traceparent=hop())

    ask = alice.send("tools/call", {"name": "restart_service", "arguments": restart_args}, capabilities=ELICIT_CAPS, traceparent=hop())
    state = ask["result"]["requestState"]
    tampered_state = state[:-1] + ("0" if state[-1] != "0" else "1")
    alice.send(
        "tools/call", {"name": "restart_service", "arguments": restart_args}, capabilities=ELICIT_CAPS, traceparent=hop(),
        input_responses={"confirm": {"action": "accept", "content": {"confirmed": True}}}, request_state=tampered_state,
        violation="the retry carries a requestState whose HMAC signature was altered after the server issued it",
    )
    alice.send(
        "tools/call", {"name": "restart_service", "arguments": restart_args}, capabilities=ELICIT_CAPS, traceparent=hop(),
        input_responses={"confirm": {"action": "accept", "content": {"confirmed": True}}}, request_state=state,
    )

    alice.send("tools/call", {"name": "run_full_diagnostics", "arguments": {"target": "edge-cache-7"}}, capabilities={}, traceparent=hop())

    created = alice.send(
        "tools/call", {"name": "run_full_diagnostics", "arguments": {"target": "checkout-api"}}, capabilities=TASKS_CAPS, traceparent=hop(),
    )
    task_id = created["result"]["taskId"]
    alice.send("tasks/get", {"taskId": task_id}, capabilities=TASKS_CAPS, traceparent=hop())
    server.advance_task(task_id)
    alice.send("tasks/get", {"taskId": task_id}, capabilities=TASKS_CAPS, traceparent=hop())

    created_second = alice.send(
        "tools/call", {"name": "run_full_diagnostics", "arguments": {"target": "billing-api"}}, capabilities=TASKS_CAPS, traceparent=hop(),
    )
    cancel_id = created_second["result"]["taskId"]
    alice.send("tasks/cancel", {"taskId": cancel_id}, capabilities=TASKS_CAPS, traceparent=hop())
    alice.send("tasks/get", {"taskId": cancel_id}, capabilities=TASKS_CAPS, traceparent=hop())

    alice.send("tasks/get", {"taskId": "tsk_does_not_exist"}, capabilities=TASKS_CAPS, traceparent=hop())
    alice.send("tasks/get", {"taskId": task_id}, capabilities={}, traceparent=hop())

    alice.call_http("acknowledge_incident", {"incident_id": "INC-501"}, authorization_header="Bearer tok-foreign-svc", traceparent=hop())
    alice.call_http("acknowledge_incident", {"incident_id": "INC-501"}, authorization_header="Bearer tok-alice-oncall", traceparent=hop())

    return {
        "server": server,
        "alice": alice,
        "bob": bob,
        "task_id": task_id,
        "cancel_id": cancel_id,
        "root_trace": parse_traceparent(trace)["trace_id"],
    }


def transcript() -> list[Any]:
    scenario = run_scenario()
    return scenario["alice"].log + scenario["bob"].log


def demo() -> None:
    scenario = run_scenario()
    server: Server = scenario["server"]
    print("incident-console capstone walkthrough")
    for entry in scenario["alice"].log + scenario["bob"].log:
        message = entry["message"] if isinstance(entry, dict) and "message" in entry else entry
        tag = "wire "
        if isinstance(entry, dict):
            if entry.get("violation"):
                tag = "viol "
            elif "http" in entry:
                tag = "http "
            elif entry.get("method") == "notifications/progress":
                tag = "prog "
        print(" ", tag, json.dumps(message, sort_keys=True)[:170])

    print("\naudit log (hash chained)")
    for entry in server.audit.entries:
        print(f"  [{entry.index}] {entry.principal:14} {entry.method:12} {entry.tool or '-':22} {entry.detail}")
    ok, broken_at = server.audit.verify()
    print("\naudit log verify ->", ok, broken_at)

    tampered_index = 0
    original_detail = server.audit.entries[tampered_index].detail
    server.audit.entries[tampered_index].detail = original_detail + " (edited after the fact)"
    ok_after, broken_at_after = server.audit.verify()
    print("audit log verify after editing entry 0 ->", ok_after, broken_at_after)
    server.audit.entries[tampered_index].detail = original_detail

    print("\nevery request in this narrative shares one trace id:", scenario["root_trace"][:16] + "...")


if __name__ == "__main__":
    demo()
