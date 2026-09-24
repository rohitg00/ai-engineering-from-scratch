"""Companion code for:
certifications/mcpa/lessons/15-deprecated-client-features/docs/en.md
Roots and sampling still ride MRTR while logging rides per-request logLevel.
Sources: SEP-2577; MCP 2026-07-28 deprecated-features registry.
"""

from __future__ import annotations

import calendar
import json
from dataclasses import dataclass
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"
LOGLEVEL_KEY = "io.modelcontextprotocol/logLevel"

INVALID_PARAMS = -32602
METHOD_NOT_FOUND = -32601
MISSING_REQUIRED_CLIENT_CAPABILITY = -32021

LEGACY_EXAMPLES = True


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


LOG_LEVELS = ["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"]
LOG_LEVEL_RANK = {level: index for index, level in enumerate(LOG_LEVELS)}
DIAGNOSTIC_EVENTS = [
    ("debug", "opened diagnostic session"),
    ("info", "checked 12 subsystems"),
    ("warning", "cache subsystem degraded"),
]

DEPRECATION_SEP = "SEP-2577"
DEPRECATED_SINCE = "2026-07-28"
MIN_DEPRECATION_MONTHS = 12

CLIENT_DEPRECATED_CAPABILITIES = {
    "roots": "Pass directories or files via tool parameters, resource URIs, or server configuration.",
    "sampling": "Integrate directly with an LLM provider API instead of routing generations through the client.",
}
SERVER_DEPRECATED_CAPABILITIES = {
    "logging": "Log to stderr on stdio transports, or emit OpenTelemetry spans and logs for structured observability.",
}


def add_months(iso_date: str, months: int) -> str:
    year, month, day = (int(part) for part in iso_date.split("-"))
    month_index = month - 1 + months
    year += month_index // 12
    month = month_index % 12 + 1
    day = min(day, calendar.monthrange(year, month)[1])
    return f"{year:04d}-{month:02d}-{day:02d}"


def earliest_removal(deprecated_since: str = DEPRECATED_SINCE, window_months: int = MIN_DEPRECATION_MONTHS) -> str:
    return add_months(deprecated_since, window_months)


@dataclass
class MigrationFinding:
    feature: str
    sep: str
    migration: str
    earliest_removal: str


def advise_migrations(server_capabilities: dict, client_capabilities: dict) -> list[MigrationFinding]:
    findings = []
    for name, migration in CLIENT_DEPRECATED_CAPABILITIES.items():
        if name in client_capabilities:
            findings.append(MigrationFinding(name, DEPRECATION_SEP, migration, earliest_removal()))
    for name, migration in SERVER_DEPRECATED_CAPABILITIES.items():
        if name in server_capabilities:
            findings.append(MigrationFinding(name, DEPRECATION_SEP, migration, earliest_removal()))
    return sorted(findings, key=lambda finding: finding.feature)


SUMMARIZE_REQUEST_STATE = "summarize-workspace:v1"
SUMMARIZE_REQUIRED_CAPABILITIES = {"roots": {}, "sampling": {}}


class Server:
    def __init__(self, name: str = "workspace-tools") -> None:
        self.name = name

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def handle(self, message: dict) -> list[dict]:
        request_id = message.get("id")
        method = message.get("method")
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        meta = params.get("_meta") if isinstance(params.get("_meta"), dict) else {}
        if not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return [make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")]
        if method == "tools/call":
            return self._call(request_id, params, meta)
        return [make_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")]

    def _call(self, request_id: Any, params: dict, meta: dict) -> list[dict]:
        name = params.get("name")
        if name == "summarize_workspace":
            return self._summarize_workspace(request_id, params, meta)
        if name == "run_diagnostic":
            return self._run_diagnostic(request_id, meta)
        return [make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")]

    def _summarize_workspace(self, request_id: Any, params: dict, meta: dict) -> list[dict]:
        client_capabilities = meta.get(CAPS_KEY) or {}
        input_responses = params.get("inputResponses")
        if input_responses is None:
            missing = {key: value for key, value in SUMMARIZE_REQUIRED_CAPABILITIES.items() if key not in client_capabilities}
            if missing:
                return [make_error(
                    request_id,
                    MISSING_REQUIRED_CLIENT_CAPABILITY,
                    "summarize_workspace needs roots and sampling declared on this request",
                    {"requiredCapabilities": missing},
                )]
            input_requests = {
                "workspace_roots": {"method": "roots/list"},
                "workspace_summary": {
                    "method": "sampling/createMessage",
                    "params": {
                        "messages": [
                            {"role": "user", "content": {"type": "text", "text": "Summarize this workspace in one sentence."}},
                        ],
                        "maxTokens": 100,
                    },
                },
            }
            return [make_result(
                request_id,
                "input_required",
                inputRequests=input_requests,
                requestState=SUMMARIZE_REQUEST_STATE,
                _meta=self._server_meta(),
            )]
        if params.get("requestState") != SUMMARIZE_REQUEST_STATE:
            return [make_error(request_id, INVALID_PARAMS, "requestState is missing or does not match the pending call")]
        roots = (input_responses.get("workspace_roots") or {}).get("roots", [])
        summary_answer = input_responses.get("workspace_summary") or {}
        summary_content = summary_answer.get("content") or {}
        summary_text = summary_content.get("text", "")
        text = f"Scanned {len(roots)} root(s). Model summary: {summary_text}"
        return [make_result(
            request_id,
            "complete",
            content=[{"type": "text", "text": text}],
            structuredContent={"roots": roots, "summary": summary_text},
            isError=False,
            _meta=self._server_meta(),
        )]

    def _run_diagnostic(self, request_id: Any, meta: dict) -> list[dict]:
        log_level = meta.get(LOGLEVEL_KEY)
        messages: list[dict] = []
        if log_level is not None:
            if log_level not in LOG_LEVEL_RANK:
                return [make_error(request_id, INVALID_PARAMS, f"Unrecognized log level: {log_level}")]
            threshold = LOG_LEVEL_RANK[log_level]
            for level, text in DIAGNOSTIC_EVENTS:
                if LOG_LEVEL_RANK[level] >= threshold:
                    messages.append({
                        "jsonrpc": "2.0",
                        "method": "notifications/message",
                        "params": {"level": level, "logger": "diagnostics", "data": {"message": text}},
                    })
        messages.append(make_result(
            request_id,
            "complete",
            content=[{"type": "text", "text": "Diagnostic complete: 12 subsystem(s) checked."}],
            isError=False,
            _meta=self._server_meta(),
        ))
        return messages


class Client:
    def __init__(self, server: Server, capabilities: dict | None = None) -> None:
        self.server = server
        self.capabilities = capabilities or {}
        self.next_id = 0
        self.log: list[dict] = []

    def send(self, method: str, params: dict | None = None, log_level: str | None = None) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params, capabilities=self.capabilities)
        if log_level is not None:
            request["params"]["_meta"][LOGLEVEL_KEY] = log_level
        responses = self.server.handle(request)
        self.log.append(request)
        self.log.extend(responses)
        return responses[-1]

    def call(self, name: str, arguments: dict | None = None, input_responses: dict | None = None,
             request_state: str | None = None, log_level: str | None = None) -> dict:
        params: dict[str, Any] = {"name": name, "arguments": arguments or {}}
        if input_responses is not None:
            params["inputResponses"] = input_responses
        if request_state is not None:
            params["requestState"] = request_state
        return self.send("tools/call", params, log_level=log_level)


def legacy_logging_set_level_example(server: Server) -> list[dict]:
    request = make_request(9001, "logging/setLevel", {"level": "info"}, capabilities={})
    response = server.handle(request)[0]
    return [
        {"legacy": True, "message": request},
        {"legacy": True, "message": response},
    ]


def run_scenario() -> tuple[Client, Client, Client, list[dict]]:
    server = Server()
    capable_client = Client(server, capabilities={"roots": {}, "sampling": {}})
    bare_client = Client(server, capabilities={})
    diag_client = Client(server, capabilities={})

    first_response = capable_client.call("summarize_workspace", {})
    roots_answer = {"roots": [{"uri": "file:///home/user/projects/demo", "name": "demo project"}]}
    summary_answer = {
        "role": "assistant",
        "content": {"type": "text", "text": "The demo project is a small workspace with one active root."},
        "model": "demo-llm-1",
        "stopReason": "endTurn",
    }
    capable_client.call(
        "summarize_workspace",
        {},
        input_responses={"workspace_roots": roots_answer, "workspace_summary": summary_answer},
        request_state=first_response["result"]["requestState"],
    )

    bare_client.call("summarize_workspace", {})

    diag_client.call("run_diagnostic", {})
    diag_client.call("run_diagnostic", {}, log_level="info")
    diag_client.call("run_diagnostic", {}, log_level="verbose")

    legacy = legacy_logging_set_level_example(server)
    return capable_client, bare_client, diag_client, legacy


def transcript() -> list[dict]:
    capable_client, bare_client, diag_client, legacy = run_scenario()
    return capable_client.log + bare_client.log + diag_client.log + legacy


def demo() -> None:
    findings = advise_migrations({"logging": {}}, {"roots": {}, "sampling": {}})
    print("migration advisor for a server offering logging and a client offering roots and sampling")
    for finding in findings:
        print(f"  {finding.feature}: {finding.migration} (earliest removal {finding.earliest_removal})")
    capable_client, bare_client, diag_client, legacy = run_scenario()
    for label, client in (("capable client", capable_client), ("bare client", bare_client), ("diagnostic client", diag_client)):
        print(f"\n{label} exchanges")
        for message in client.log:
            print("  " + json.dumps(message, sort_keys=True)[:170])
    print("\nlegacy exchange (wrapped, not valid 2026-07-28 traffic)")
    for entry in legacy:
        print("  " + json.dumps(entry, sort_keys=True)[:170])


if __name__ == "__main__":
    demo()
