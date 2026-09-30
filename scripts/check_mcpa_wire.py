#!/usr/bin/env python3
"""Check MCPA lesson wire transcripts against MCP 2026-07-28 invariants."""

from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
LESSONS_DIR = ROOT / "certifications" / "mcpa" / "lessons"
PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
SUB_KEY = "io.modelcontextprotocol/subscriptionId"
STANDARD_CODES = {-32700, -32600, -32601, -32602, -32603}
MCP_CODES = {-32020, -32021, -32022}
CACHEABLE_METHODS = {
    "server/discover",
    "tools/list",
    "prompts/list",
    "resources/list",
    "resources/templates/list",
    "resources/read",
}
MRTR_METHODS = {"tools/call", "prompts/get", "resources/read"}
INPUT_REQUEST_METHODS = {"elicitation/create", "sampling/createMessage", "roots/list"}
CORE_RESULT_TYPES = {"complete", "input_required"}
LEGACY_METHODS = {
    "initialize",
    "ping",
    "logging/setLevel",
    "resources/subscribe",
    "resources/unsubscribe",
    "tasks/result",
    "tasks/list",
    "notifications/initialized",
    "notifications/roots/list_changed",
    "notifications/elicitation/complete",
}
STREAM_NOTIFICATIONS = {
    "notifications/subscriptions/acknowledged",
    "notifications/tools/list_changed",
    "notifications/prompts/list_changed",
    "notifications/resources/list_changed",
    "notifications/resources/updated",
}
NAME_HEADER_METHODS = {"tools/call": "name", "prompts/get": "name", "resources/read": "uri"}
LEGACY_SOURCE_PATTERNS = [
    (re.compile(r"""["'](initialize|notifications/initialized|ping|logging/setLevel|resources/subscribe|resources/unsubscribe|tasks/result|tasks/list)["']"""), "legacy method literal"),
    (re.compile(r"Mcp-Session-Id", re.IGNORECASE), "Mcp-Session-Id header"),
    (re.compile(r"Last-Event-ID", re.IGNORECASE), "Last-Event-ID header"),
]


@dataclass
class Report:
    findings: list[tuple[str, str]] = field(default_factory=list)

    def add(self, where: str, message: str) -> None:
        self.findings.append((where, message))


def classify(message: Any) -> str:
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return "invalid"
    if "method" in message:
        return "request" if "id" in message else "notification"
    if "result" in message:
        return "result"
    if "error" in message:
        return "error"
    return "invalid"


def unwrap(entry: Any) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    if isinstance(entry, dict) and "message" in entry and "jsonrpc" not in entry:
        return entry.get("message"), entry
    return entry, {}


def check_request(report: Report, where: str, message: dict[str, Any], wrapper: dict[str, Any]) -> None:
    request_id = message.get("id")
    if request_id is None or isinstance(request_id, bool) or not isinstance(request_id, (str, int)):
        report.add(where, "request id must be a string or integer, never null")
    method = message.get("method")
    if method in LEGACY_METHODS:
        report.add(where, f"{method!r} does not exist in {PROTOCOL_VERSION}; mark the entry legacy if it is a compatibility example")
    params = message.get("params")
    meta = params.get("_meta") if isinstance(params, dict) else None
    if not isinstance(meta, dict):
        report.add(where, f"{method} request is missing params._meta with the per-request protocol fields")
        return
    if not isinstance(meta.get(PV_KEY), str):
        report.add(where, f"{method} request is missing _meta[{PV_KEY!r}]")
    if not isinstance(meta.get(CAPS_KEY), dict):
        report.add(where, f"{method} request is missing _meta[{CAPS_KEY!r}]")
    http = wrapper.get("http")
    if isinstance(http, dict) and isinstance(http.get("headers"), dict):
        headers = {str(k).lower(): v for k, v in http["headers"].items()}
        if headers.get("mcp-protocol-version") != meta.get(PV_KEY):
            report.add(where, "MCP-Protocol-Version header must equal the _meta protocol version")
        if headers.get("mcp-method") != method:
            report.add(where, "Mcp-Method header must equal the JSON-RPC method")
        field_name = NAME_HEADER_METHODS.get(method)
        if field_name and headers.get("mcp-name") != (params or {}).get(field_name):
            report.add(where, f"Mcp-Name header must equal params.{field_name} for {method}")


def check_error(report: Report, where: str, error: Any) -> None:
    if not isinstance(error, dict):
        report.add(where, "error must be an object")
        return
    code = error.get("code")
    if not isinstance(code, int) or isinstance(code, bool):
        report.add(where, "error code must be an integer")
        return
    if not isinstance(error.get("message"), str):
        report.add(where, "error must carry a message string")
    if -32768 <= code <= -32000 and code not in STANDARD_CODES | MCP_CODES:
        if code == -32002:
            report.add(where, "-32002 was resource-not-found before 2026-07-28; use -32602")
        elif code == -32042:
            report.add(where, "-32042 existed only in 2025-11-25; implementations of 2026-07-28 must not emit it")
        elif -32019 <= code <= -32000:
            report.add(where, f"{code} is in the legacy -32000..-32019 range that new implementations should not use")
        else:
            report.add(where, f"{code} is inside the JSON-RPC reserved range but is not defined by MCP 2026-07-28")
    data = error.get("data")
    if code == -32022:
        if not isinstance(data, dict) or not isinstance(data.get("supported"), list) or not isinstance(data.get("requested"), str):
            report.add(where, "UnsupportedProtocolVersion (-32022) must carry data.supported and data.requested")
    if code == -32021:
        if not isinstance(data, dict) or not isinstance(data.get("requiredCapabilities"), dict):
            report.add(where, "MissingRequiredClientCapability (-32021) must carry data.requiredCapabilities")


def check_result(
    report: Report,
    where: str,
    message: dict[str, Any],
    request: dict[str, Any] | None,
    allowed_types: set[str],
) -> None:
    result = message.get("result")
    if not isinstance(result, dict):
        report.add(where, "result must be an object")
        return
    result_type = result.get("resultType")
    if result_type not in allowed_types:
        report.add(where, f"resultType {result_type!r} is not one of {sorted(allowed_types)}")
        return
    method = request.get("method") if request else None
    if result_type == "input_required":
        if method is not None and method not in MRTR_METHODS:
            report.add(where, f"{method} may not return input_required; only {sorted(MRTR_METHODS)} may")
        if "inputRequests" not in result and "requestState" not in result:
            report.add(where, "input_required results must include inputRequests or requestState")
        requests = result.get("inputRequests")
        if requests is not None:
            if not isinstance(requests, dict):
                report.add(where, "inputRequests must be a map of key to request object")
            else:
                for key, value in requests.items():
                    if not isinstance(value, dict) or value.get("method") not in INPUT_REQUEST_METHODS:
                        report.add(where, f"inputRequests[{key!r}] must be one of {sorted(INPUT_REQUEST_METHODS)}")
        if "ttlMs" in result or "cacheScope" in result:
            report.add(where, "input_required results are not cacheable and carry no caching hints")
        return
    if result_type == "complete" and method in CACHEABLE_METHODS:
        ttl = result.get("ttlMs")
        if not isinstance(ttl, int) or isinstance(ttl, bool) or ttl < 0:
            report.add(where, f"{method} results must carry an integer ttlMs >= 0")
        if result.get("cacheScope") not in {"public", "private"}:
            report.add(where, f"{method} results must carry cacheScope 'public' or 'private'")
    if result_type == "complete" and method == "tools/call" and not isinstance(result.get("content"), list):
        report.add(where, "a complete tools/call result must carry a content list")
    if result_type == "complete" and method == "server/discover":
        if not isinstance(result.get("supportedVersions"), list) or not isinstance(result.get("capabilities"), dict):
            report.add(where, "server/discover results must carry supportedVersions and capabilities")


def check_transcript(report: Report, lesson: str, entries: list[Any], extra_result_types: set[str]) -> None:
    allowed_types = CORE_RESULT_TYPES | extra_result_types
    pending: dict[Any, dict[str, Any]] = {}
    issued_state: dict[tuple[str, str], tuple[Any, Any]] = {}
    for index, entry in enumerate(entries):
        message, wrapper = unwrap(entry)
        where = f"{lesson} transcript[{index}]"
        if wrapper.get("legacy") or wrapper.get("violation"):
            if wrapper.get("violation") and not isinstance(wrapper.get("violation"), str):
                report.add(where, "violation must be a string explaining the deliberate negative example")
            if not isinstance(message, dict):
                report.add(where, "legacy/violation entry must wrap a JSON-RPC message object")
            elif "id" in message and "method" in message:
                pending[message["id"]] = message
            continue
        kind = classify(message)
        if kind == "invalid":
            report.add(where, "entry is not a JSON-RPC 2.0 request, notification, result, or error")
            continue
        if kind == "request":
            if message.get("id") in pending:
                report.add(where, f"request id {message.get('id')!r} reuses an id that is still awaiting a response")
            check_request(report, where, message, wrapper)
            params = message.get("params") if isinstance(message.get("params"), dict) else {}
            target = str(params.get("name") or params.get("uri") or "")
            key = (str(message.get("method")), target)
            if "inputResponses" in params or "requestState" in params:
                prior = issued_state.get(key)
                if prior is not None:
                    prior_id, prior_state = prior
                    if message.get("id") == prior_id:
                        report.add(where, "an MRTR retry must use a new JSON-RPC id")
                    if prior_state is not None and params.get("requestState") != prior_state:
                        report.add(where, "an MRTR retry must echo requestState exactly")
                    if prior_state is None and "requestState" in params:
                        report.add(where, "an MRTR retry must not invent requestState the server never sent")
            pending[message.get("id")] = message
        elif kind == "notification":
            method = message.get("method")
            if method in LEGACY_METHODS:
                report.add(where, f"{method!r} does not exist in {PROTOCOL_VERSION}")
            if method in STREAM_NOTIFICATIONS:
                params = message.get("params") if isinstance(message.get("params"), dict) else {}
                meta = params.get("_meta") if isinstance(params.get("_meta"), dict) else {}
                if SUB_KEY not in meta:
                    report.add(where, f"{method} on a subscriptions/listen stream must carry _meta[{SUB_KEY!r}]")
        elif kind == "result":
            request = pending.pop(message.get("id"), None)
            if request is None:
                report.add(where, f"result id {message.get('id')!r} does not answer any pending request")
            check_result(report, where, message, request, allowed_types)
            result = message.get("result") if isinstance(message.get("result"), dict) else {}
            if request is not None and result.get("resultType") == "input_required":
                params = request.get("params") if isinstance(request.get("params"), dict) else {}
                target = str(params.get("name") or params.get("uri") or "")
                issued_state[(str(request.get("method")), target)] = (request.get("id"), result.get("requestState"))
        elif kind == "error":
            if "id" in message:
                pending.pop(message.get("id"), None)
            check_error(report, where, message.get("error"))


def load_module(lesson_dir: Path):
    main = lesson_dir / "code" / "main.py"
    name = f"mcpa_wire_{lesson_dir.name.replace('-', '_')}"
    spec = importlib.util.spec_from_file_location(name, main)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {main}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    code_dir = str(main.parent)
    sys.path.insert(0, code_dir)
    try:
        spec.loader.exec_module(module)
    finally:
        sys.path.remove(code_dir)
    return module


def check_lesson(report: Report, lesson_dir: Path) -> None:
    lesson = lesson_dir.name
    main = lesson_dir / "code" / "main.py"
    if not main.is_file():
        report.add(lesson, "missing code/main.py")
        return
    source = main.read_text(encoding="utf-8")
    try:
        module = load_module(lesson_dir)
    except Exception as exc:
        report.add(lesson, f"code/main.py failed to import: {exc!r}")
        return
    if not getattr(module, "LEGACY_EXAMPLES", False):
        for pattern, label in LEGACY_SOURCE_PATTERNS:
            match = pattern.search(source)
            if match:
                report.add(lesson, f"code/main.py contains a {label} ({match.group(0)}) without LEGACY_EXAMPLES = True")
    transcript = getattr(module, "transcript", None)
    if not callable(transcript):
        report.add(lesson, "code/main.py must define transcript() returning the wire messages its demo exchanges")
        return
    try:
        entries = transcript()
    except Exception as exc:
        report.add(lesson, f"transcript() raised {exc!r}")
        return
    if not isinstance(entries, list):
        report.add(lesson, "transcript() must return a list")
        return
    if not entries and not getattr(module, "NO_WIRE_REASON", None):
        report.add(lesson, "transcript() is empty; set NO_WIRE_REASON to explain a conceptual lesson")
        return
    extra = getattr(module, "EXTENSION_RESULT_TYPES", set())
    check_transcript(report, lesson, entries, set(extra))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lessons", nargs="*", type=Path, help="lesson directories (default: every MCPA lesson)")
    args = parser.parse_args()
    lesson_dirs = [path.resolve() for path in args.lessons] or sorted(
        path for path in LESSONS_DIR.iterdir() if path.is_dir()
    )
    report = Report()
    for lesson_dir in lesson_dirs:
        check_lesson(report, lesson_dir)
    print(f"check_mcpa_wire.py - {len(lesson_dirs)} lesson(s), {len(report.findings)} finding(s)")
    for where, message in report.findings:
        print(f"  [{where}] {message}")
    return 1 if report.findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
