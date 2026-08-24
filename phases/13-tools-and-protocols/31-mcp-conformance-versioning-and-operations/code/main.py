"""Companion code for docs/en.md: test MCP wire contracts and release evidence.
Protocol contract: https://modelcontextprotocol.io/specification/2026-07-28/basic
Transport contract: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
Run `python3 main.py` for the finite demo or `python3 -m unittest discover -s tests`.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from typing import Any


MODERN_VERSION = "2026-07-28"
LEGACY_VERSION = "2025-11-25"
PROTOCOL_VERSION_KEY = "io.modelcontextprotocol/protocolVersion"
CLIENT_CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
MODERN_ERROR_CODES = {-32020, -32021, -32022}
CORE_RESULT_TYPES = {"complete", "input_required"}
EXTENSION_RESULT_TYPES = {"io.modelcontextprotocol/tasks": {"task"}}
SECRET_KEYS = {
    "authorization",
    "cookie",
    "setcookie",
    "xapikey",
    "proxyauthorization",
    "accesstoken",
    "refreshtoken",
    "password",
    "secret",
    "token",
    "apikey",
    "clientsecret",
    "registrationaccesstoken",
}


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def is_sha256_digest(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(
        character in "0123456789abcdefABCDEF" for character in value
    )


def attach_rollback_attestation(
    evidence: dict[str, Any], signer: str, signing_key: bytes
) -> dict[str, Any]:
    payload = dict(evidence)
    payload.pop("authenticator", None)
    signature = hmac.new(
        signing_key,
        canonical_json(payload).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return {
        **payload,
        "authenticator": {
            "algorithm": "hmac-sha256",
            "signer": signer,
            "signature": signature,
        },
    }


def rollback_evidence_ready(
    rollback: Any, trusted_signers: dict[str, bytes]
) -> bool:
    if not isinstance(rollback, dict):
        return False
    required_text = ("version",)
    if any(
        not isinstance(rollback.get(field), str) or not rollback[field].strip()
        for field in required_text
    ):
        return False
    if rollback.get("healthy") is not True or rollback.get("registryStatus") != "active":
        return False
    for field in ("admissionEvidenceDigest", "artifactDigest", "descriptorDigest"):
        if not is_sha256_digest(rollback.get(field)):
            return False
    authenticator = rollback.get("authenticator")
    if not isinstance(authenticator, dict) or authenticator.get("algorithm") != "hmac-sha256":
        return False
    signer = authenticator.get("signer")
    signature = authenticator.get("signature")
    if not isinstance(signer, str) or not isinstance(signature, str):
        return False
    signing_key = trusted_signers.get(signer)
    if not isinstance(signing_key, bytes):
        return False
    payload = dict(rollback)
    payload.pop("authenticator", None)
    expected = hmac.new(
        signing_key,
        canonical_json(payload).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(signature, expected)


def canonical_field_name(key: str) -> str:
    return "".join(character for character in key.casefold() if character.isalnum())


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        output: dict[str, Any] = {}
        for key, item in value.items():
            normalized = canonical_field_name(key)
            output[key] = "[REDACTED]" if normalized in SECRET_KEYS else redact(item)
        return output
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


class ProtocolViolation(ValueError):
    def __init__(self, message: str, code: int = -32600) -> None:
        super().__init__(message)
        self.code = code


def routing_name(body: dict[str, Any]) -> str | None:
    params = body.get("params", {})
    if not isinstance(params, dict):
        return None
    for key in ("name", "taskId", "uri"):
        value = params.get(key)
        if isinstance(value, str):
            return value
    return None


def normalized_headers(headers: dict[str, str]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for name, value in headers.items():
        key = name.lower()
        if key in normalized and normalized[key] != value:
            raise ProtocolViolation(f"conflicting duplicate HTTP header: {name}", -32020)
        normalized[key] = value
    return normalized


def encode_header_value(value: str) -> str:
    safe = all(0x20 <= ord(character) <= 0x7E for character in value)
    sentinel = value.startswith("=?base64?") and value.endswith("?=")
    if safe and value == value.strip() and not sentinel:
        return value
    encoded = base64.b64encode(value.encode("utf-8")).decode("ascii")
    return f"=?base64?{encoded}?="


def decode_header_value(value: str) -> str:
    starts = value.startswith("=?base64?")
    ends = value.endswith("?=")
    if starts or ends:
        if not (starts and ends):
            raise ProtocolViolation("malformed Base64 MCP header sentinel", -32020)
        encoded = value[len("=?base64?") : -2]
        try:
            return base64.b64decode(encoded, validate=True).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as error:
            raise ProtocolViolation("malformed Base64 MCP header value", -32020) from error
    if value != value.strip() or any(
        ord(character) < 0x20 or ord(character) > 0x7E for character in value
    ):
        raise ProtocolViolation("unsafe MCP header value must use the Base64 sentinel", -32020)
    return value


def validate_request(headers: dict[str, str], body: dict[str, Any], era: str) -> None:
    if body.get("jsonrpc") != "2.0" or not isinstance(body.get("method"), str):
        raise ProtocolViolation("invalid JSON-RPC request")
    params = body.get("params", {})
    if not isinstance(params, dict):
        raise ProtocolViolation("params must be an object", -32602)
    wire_headers = normalized_headers(headers)
    if era == "legacy":
        if body["method"] != "initialize" and wire_headers.get("mcp-protocol-version") == MODERN_VERSION:
            raise ProtocolViolation("modern metadata reached the legacy branch", -32020)
        return
    if era != "modern":
        raise ValueError(f"unknown era: {era}")

    metadata = params.get("_meta")
    if not isinstance(metadata, dict):
        raise ProtocolViolation("modern request is missing params._meta", -32602)
    protocol_version = metadata.get(PROTOCOL_VERSION_KEY)
    capabilities = metadata.get(CLIENT_CAPABILITIES_KEY)
    if not isinstance(protocol_version, str):
        raise ProtocolViolation(f"modern request is missing {PROTOCOL_VERSION_KEY}", -32602)
    if not isinstance(capabilities, dict):
        raise ProtocolViolation(f"modern request is missing {CLIENT_CAPABILITIES_KEY}", -32021)

    mirrored = {
        "mcp-protocol-version": protocol_version,
        "mcp-method": body["method"],
    }
    name = routing_name(body)
    if name is not None:
        mirrored["mcp-name"] = name
    for header, body_value in mirrored.items():
        header_value = wire_headers.get(header)
        if header == "mcp-name" and header_value is not None:
            header_value = decode_header_value(header_value)
        if header_value != body_value:
            raise ProtocolViolation(
                f"{header} does not match the JSON-RPC body",
                -32020,
            )
    if protocol_version != MODERN_VERSION:
        raise ProtocolViolation(f"unsupported protocol version: {protocol_version}", -32022)


def allowed_result_types(capabilities: set[str]) -> set[str]:
    allowed = set(CORE_RESULT_TYPES)
    for capability in capabilities:
        allowed.update(EXTENSION_RESULT_TYPES.get(capability, set()))
    return allowed


def validate_result(
    result: dict[str, Any],
    era: str,
    capabilities: set[str] | None = None,
) -> dict[str, Any]:
    if not isinstance(result, dict):
        raise ProtocolViolation("result must be an object")
    preserved = dict(result)
    result_type = result.get("resultType")
    if era == "legacy":
        if result_type is None:
            return {"semanticType": "complete", "wire": preserved, "inferred": True}
    elif era == "modern":
        if result_type is None:
            raise ProtocolViolation("modern result is missing resultType")
    else:
        raise ValueError(f"unknown era: {era}")

    allowed = allowed_result_types(capabilities or set())
    if result_type not in allowed:
        raise ProtocolViolation(f"unknown or unadvertised resultType: {result_type}")
    return {"semanticType": result_type, "wire": preserved, "inferred": False}


def validate_method_result(method: str, result: dict[str, Any]) -> None:
    result_type = result.get("resultType")
    if method == "tools/list":
        if result_type != "complete":
            raise ProtocolViolation("tools/list must return a complete result")
        tools = result.get("tools")
        if not isinstance(tools, list):
            raise ProtocolViolation("complete tools/list result requires a tools array")
        names: set[str] = set()
        for tool in tools:
            if not isinstance(tool, dict):
                raise ProtocolViolation("each tools/list descriptor must be an object")
            name = tool.get("name")
            description = tool.get("description")
            input_schema = tool.get("inputSchema")
            if not isinstance(name, str) or not name:
                raise ProtocolViolation("each tool descriptor requires a non-empty name")
            if name in names:
                raise ProtocolViolation("tools/list contains a duplicate tool name")
            names.add(name)
            if not isinstance(description, str) or not description:
                raise ProtocolViolation("each tool descriptor requires a non-empty description")
            if not isinstance(input_schema, dict) or input_schema.get("type") != "object":
                raise ProtocolViolation("each tool descriptor requires an object-root inputSchema")

    if method == "completion/complete":
        if result_type != "complete":
            raise ProtocolViolation("completion/complete must return a complete result")
        completion = result.get("completion")
        if not isinstance(completion, dict):
            raise ProtocolViolation("completion/complete requires a completion object")
        values = completion.get("values")
        if not isinstance(values, list) or any(not isinstance(value, str) for value in values):
            raise ProtocolViolation("completion.values must be an array of strings")
        if len(values) > 100:
            raise ProtocolViolation("completion.values must contain at most 100 entries")
        total = completion.get("total")
        if total is not None and (
            isinstance(total, bool) or not isinstance(total, int) or total < len(values)
        ):
            raise ProtocolViolation("completion.total must be an integer at least values length")
        has_more = completion.get("hasMore")
        if has_more is not None and not isinstance(has_more, bool):
            raise ProtocolViolation("completion.hasMore must be a boolean")

    if result_type != "task":
        return
    if method != "tools/call":
        raise ProtocolViolation("task result is valid only for tools/call")
    required_strings = ("taskId", "status", "createdAt", "lastUpdatedAt")
    for field in required_strings:
        if not isinstance(result.get(field), str) or not result[field]:
            raise ProtocolViolation(f"task result requires non-empty {field}")
    if result["status"] not in {"working", "input_required", "completed", "cancelled", "failed"}:
        raise ProtocolViolation("task result has an unknown status")
    if "ttlMs" not in result:
        raise ProtocolViolation("task result requires ttlMs")
    ttl_ms = result["ttlMs"]
    if ttl_ms is not None and (
        isinstance(ttl_ms, bool) or not isinstance(ttl_ms, int) or ttl_ms < 0
    ):
        raise ProtocolViolation("task result ttlMs must be null or a non-negative integer")
    poll_interval = result.get("pollIntervalMs")
    if poll_interval is not None and (
        isinstance(poll_interval, bool) or not isinstance(poll_interval, int) or poll_interval < 0
    ):
        raise ProtocolViolation("task result pollIntervalMs must be a non-negative integer")


def select_era(
    observation: dict[str, Any],
    policy: str,
    legacy_allowed: bool = False,
    legacy_evidence: dict[str, Any] | None = None,
) -> str:
    if policy not in {"strict", "fallback"}:
        raise ValueError("policy must be strict or fallback")
    kind = observation.get("kind")
    if kind == "discover_success":
        return "modern"
    if kind == "jsonrpc_error" and observation.get("code") in MODERN_ERROR_CODES:
        return "modern"
    if policy == "strict":
        raise ProtocolViolation("modern support was not proven; strict policy forbids fallback")
    if kind not in {"empty", "timeout", "connection_closed", "unrecognized"}:
        raise ProtocolViolation("probe outcome is not safe evidence for fallback")
    if not legacy_allowed:
        raise ProtocolViolation("legacy fallback is not allowlisted for this endpoint")
    if not isinstance(legacy_evidence, dict):
        raise ProtocolViolation("inconclusive modern probe is not positive legacy evidence")
    if (
        legacy_evidence.get("kind") != "initialize_success"
        or legacy_evidence.get("protocolVersion") != LEGACY_VERSION
    ):
        raise ProtocolViolation("legacy probe did not prove the configured legacy era")
    return "legacy"


def notification_http_outcome(request: dict[str, Any]) -> tuple[int, None]:
    if "id" in request:
        raise ValueError("request has an id and is not a notification")
    return 202, None


@dataclass(frozen=True)
class Transcript:
    name: str
    era: str
    headers: dict[str, str]
    request: dict[str, Any]
    response_status: int
    response_body: dict[str, Any] | None
    capabilities: frozenset[str] = frozenset()
    expected_error_code: int | None = None


@dataclass(frozen=True)
class CaseResult:
    name: str
    passed: bool
    detail: str
    evidence_digest: str


def validate_response(
    request: dict[str, Any],
    status: int,
    response: dict[str, Any],
    era: str,
    capabilities: set[str],
) -> None:
    if not isinstance(response, dict) or response.get("jsonrpc") != "2.0":
        raise ProtocolViolation("invalid JSON-RPC response envelope")
    request_id = request.get("id")
    response_id = response.get("id")
    if type(response_id) is not type(request_id) or response_id != request_id:
        raise ProtocolViolation("response id does not exactly match request id")
    has_result = "result" in response
    has_error = "error" in response
    if has_result == has_error:
        raise ProtocolViolation("response must contain exactly one of result or error")
    if has_result:
        if status != 200:
            raise ProtocolViolation("successful JSON-RPC result requires HTTP 200")
        validate_result(response["result"], era, capabilities)
        validate_method_result(request["method"], response["result"])
        return

    error = response["error"]
    if not isinstance(error, dict):
        raise ProtocolViolation("JSON-RPC error must be an object")
    code = error.get("code")
    if isinstance(code, bool) or not isinstance(code, int) or not isinstance(error.get("message"), str):
        raise ProtocolViolation("JSON-RPC error requires integer code and string message")
    expected_status = {-32020: 400, -32021: 400, -32022: 400, -32601: 404}.get(code)
    if expected_status is not None and status != expected_status:
        raise ProtocolViolation(f"JSON-RPC error {code} requires HTTP {expected_status}")


def validate_protocol_error_evidence(case: Transcript, expected_code: int) -> None:
    if case.response_body is None:
        raise ProtocolViolation("expected JSON-RPC error response is missing")
    validate_response(
        case.request,
        case.response_status,
        case.response_body,
        case.era,
        set(case.capabilities),
    )
    error = case.response_body.get("error")
    if not isinstance(error, dict) or error.get("code") != expected_code:
        raise ProtocolViolation(f"server did not return JSON-RPC error {expected_code}")


def run_transcript(case: Transcript) -> CaseResult:
    evidence = redact(
        {
            "headers": case.headers,
            "request": case.request,
            "responseStatus": case.response_status,
            "responseBody": case.response_body,
        }
    )
    try:
        validate_request(case.headers, case.request, case.era)
        if "id" not in case.request:
            expected_status, expected_body = notification_http_outcome(case.request)
            if (case.response_status, case.response_body) != (expected_status, expected_body):
                raise ProtocolViolation("notification received a response body")
        elif case.response_body is None:
            raise ProtocolViolation("JSON-RPC request has no response body")
        else:
            validate_response(
                case.request,
                case.response_status,
                case.response_body,
                case.era,
                set(case.capabilities),
            )
        if case.expected_error_code is not None:
            return CaseResult(case.name, False, "negative case was accepted", digest(evidence))
        return CaseResult(case.name, True, "accepted as expected", digest(evidence))
    except ProtocolViolation as error:
        passed = case.expected_error_code == error.code
        detail = f"rejected with {error.code}: {error}"
        if error.code == -32020:
            try:
                validate_protocol_error_evidence(case, -32020)
            except ProtocolViolation as response_error:
                passed = False
                detail = f"request rejection was correct, but response was invalid: {response_error}"
        return CaseResult(case.name, passed, detail, digest(evidence))


def modern_request(
    method: str = "tools/list",
    request_id: int | None = 1,
    name: str | None = None,
) -> tuple[dict[str, str], dict[str, Any]]:
    params: dict[str, Any] = {
        "_meta": {
            PROTOCOL_VERSION_KEY: MODERN_VERSION,
            CLIENT_CAPABILITIES_KEY: {},
            CLIENT_INFO_KEY: {"name": "course-harness", "version": "1.0.0"},
        }
    }
    if name is not None:
        params["name"] = name
    body: dict[str, Any] = {"jsonrpc": "2.0", "method": method, "params": params}
    if request_id is not None:
        body["id"] = request_id
    headers = {"MCP-Protocol-Version": MODERN_VERSION, "Mcp-Method": method}
    if name is not None:
        headers["Mcp-Name"] = encode_header_value(name)
    return headers, body


def transcript_suite() -> list[Transcript]:
    list_headers, list_request = modern_request()
    mismatch_headers, mismatch_request = modern_request("tools/call", 2, "inventory_get")
    mismatch_headers["Mcp-Name"] = "inventory_delete"
    missing_type_headers, missing_type_request = modern_request("tools/list", 3)
    unknown_type_headers, unknown_type_request = modern_request("tools/list", 4)
    notification_headers, notification_request = modern_request(
        "notifications/course/progress", None
    )
    bad_jsonrpc_headers, bad_jsonrpc_request = modern_request("tools/list", 5)
    wrong_id_headers, wrong_id_request = modern_request("tools/list", 6)
    exclusive_headers, exclusive_request = modern_request("tools/list", 7)
    malformed_error_headers, malformed_error_request = modern_request("tools/list", 8)
    mapping_headers, mapping_request = modern_request("tools/list", 9)
    malformed_tools_headers, malformed_tools_request = modern_request("tools/list", 10)
    malformed_task_headers, malformed_task_request = modern_request(
        "tools/call", 11, "report_generate"
    )
    golden_task_headers, golden_task_request = modern_request(
        "tools/call", 12, "report_generate"
    )
    completion_headers, completion_request = modern_request("completion/complete", 13)
    malformed_completion_headers, malformed_completion_request = modern_request(
        "completion/complete", 14
    )
    return [
        Transcript(
            "golden-modern-list",
            "modern",
            list_headers,
            list_request,
            200,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "result": {
                    "resultType": "complete",
                    "tools": [],
                    "futureHint": {"safeToIgnore": True},
                },
            },
        ),
        Transcript(
            "golden-notification-no-response",
            "modern",
            notification_headers,
            notification_request,
            202,
            None,
        ),
        Transcript(
            "negative-header-body-mismatch",
            "modern",
            mismatch_headers,
            mismatch_request,
            400,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "error": {"code": -32020, "message": "Mcp-Name header mismatch"},
            },
            expected_error_code=-32020,
        ),
        Transcript(
            "negative-missing-result-type",
            "modern",
            missing_type_headers,
            missing_type_request,
            200,
            {"jsonrpc": "2.0", "id": 3, "result": {"tools": []}},
            expected_error_code=-32600,
        ),
        Transcript(
            "negative-unknown-result-type",
            "modern",
            unknown_type_headers,
            unknown_type_request,
            200,
            {
                "jsonrpc": "2.0",
                "id": 4,
                "result": {"resultType": "surprise", "tools": []},
            },
            expected_error_code=-32600,
        ),
        Transcript(
            "negative-response-jsonrpc-version",
            "modern",
            bad_jsonrpc_headers,
            bad_jsonrpc_request,
            200,
            {"jsonrpc": "1.0", "id": 5, "result": {"resultType": "complete"}},
            expected_error_code=-32600,
        ),
        Transcript(
            "negative-response-id-mismatch",
            "modern",
            wrong_id_headers,
            wrong_id_request,
            200,
            {"jsonrpc": "2.0", "id": "6", "result": {"resultType": "complete"}},
            expected_error_code=-32600,
        ),
        Transcript(
            "negative-result-error-exclusivity",
            "modern",
            exclusive_headers,
            exclusive_request,
            200,
            {
                "jsonrpc": "2.0",
                "id": 7,
                "result": {"resultType": "complete"},
                "error": {"code": -32600, "message": "both"},
            },
            expected_error_code=-32600,
        ),
        Transcript(
            "negative-malformed-error",
            "modern",
            malformed_error_headers,
            malformed_error_request,
            400,
            {"jsonrpc": "2.0", "id": 8, "error": {"code": "-32020"}},
            expected_error_code=-32600,
        ),
        Transcript(
            "negative-error-http-mapping",
            "modern",
            mapping_headers,
            mapping_request,
            500,
            {
                "jsonrpc": "2.0",
                "id": 9,
                "error": {"code": -32020, "message": "header mismatch"},
            },
            expected_error_code=-32600,
        ),
        Transcript(
            "negative-malformed-tools-list",
            "modern",
            malformed_tools_headers,
            malformed_tools_request,
            200,
            {
                "jsonrpc": "2.0",
                "id": 10,
                "result": {
                    "resultType": "complete",
                    "tools": [{"name": "unsafe", "description": "Missing schema"}],
                },
            },
            expected_error_code=-32600,
        ),
        Transcript(
            "negative-task-required-fields",
            "modern",
            malformed_task_headers,
            malformed_task_request,
            200,
            {"jsonrpc": "2.0", "id": 11, "result": {"resultType": "task", "taskId": "t-1"}},
            frozenset({"io.modelcontextprotocol/tasks"}),
            expected_error_code=-32600,
        ),
        Transcript(
            "golden-task-result",
            "modern",
            golden_task_headers,
            golden_task_request,
            200,
            {
                "jsonrpc": "2.0",
                "id": 12,
                "result": {
                    "resultType": "task",
                    "taskId": "t-2",
                    "status": "working",
                    "createdAt": "2026-08-21T10:00:00Z",
                    "lastUpdatedAt": "2026-08-21T10:00:00Z",
                    "ttlMs": 900000,
                    "pollIntervalMs": 1000,
                },
            },
            frozenset({"io.modelcontextprotocol/tasks"}),
        ),
        Transcript(
            "golden-completion-result",
            "modern",
            completion_headers,
            completion_request,
            200,
            {
                "jsonrpc": "2.0",
                "id": 13,
                "result": {
                    "resultType": "complete",
                    "completion": {
                        "values": ["development", "staging"],
                        "total": 3,
                        "hasMore": True,
                    },
                },
            },
        ),
        Transcript(
            "negative-malformed-completion-result",
            "modern",
            malformed_completion_headers,
            malformed_completion_request,
            200,
            {
                "jsonrpc": "2.0",
                "id": 14,
                "result": {
                    "resultType": "complete",
                    "completion": {
                        "values": ["staging", 7],
                        "total": 2,
                        "hasMore": False,
                    },
                },
            },
            expected_error_code=-32600,
        ),
    ]


def compare_sdk_view(
    raw_result: dict[str, Any],
    sdk_result: dict[str, Any],
    era: str = "modern",
    capabilities: set[str] | None = None,
    method: str = "tools/list",
) -> dict[str, Any]:
    validated = validate_result(raw_result, era, capabilities)
    method_result = dict(validated["wire"])
    method_result["resultType"] = validated["semanticType"]
    validate_method_result(method, method_result)
    bookkeeping = {"resultType", "_meta", "ttlMs", "cacheScope"}
    semantic_wire = {
        key: value for key, value in validated["wire"].items() if key not in bookkeeping
    }
    dropped = sorted(key for key in semantic_wire if key not in sdk_result)
    changed = sorted(
        key for key in semantic_wire if key in sdk_result and semantic_wire[key] != sdk_result[key]
    )
    return {
        "semanticMatch": not dropped and not changed,
        "droppedFields": dropped,
        "changedFields": changed,
        "rawDigest": digest(raw_result),
        "sdkDigest": digest(sdk_result),
    }


def inspect_proxy(exchange: dict[str, Any]) -> dict[str, Any]:
    issues: list[str] = []
    ingress = exchange.get("ingress", {})
    origin = exchange.get("origin", {})
    egress = exchange.get("egress", {})
    try:
        validate_request(ingress.get("headers", {}), ingress.get("body", {}), "modern")
    except ProtocolViolation as error:
        issues.append(f"ingress:{error.code}")

    origin_body = origin.get("body")
    if (
        origin.get("status") in {400, 404}
        and isinstance(origin_body, dict)
        and "error" in origin_body
        and egress.get("status") == 500
    ):
        issues.append("proxy collapsed a protocol error into HTTP 500")
    if origin.get("body") != egress.get("body"):
        issues.append("proxy changed the origin JSON-RPC body")

    redacted_exchange = redact(exchange)
    return {
        "passed": not issues,
        "issues": issues,
        "ingressDigest": digest(redacted_exchange.get("ingress", {})),
        "originDigest": digest(redacted_exchange.get("origin", {})),
        "egressDigest": digest(redacted_exchange.get("egress", {})),
        "evidence": redacted_exchange,
    }


def evaluate_health(health: dict[str, Any]) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    if health.get("sampleCount", 0) <= 0:
        reasons.append("health window has no samples")
    if health.get("errorRate", 1.0) > health.get("maxErrorRate", 0.01):
        reasons.append("error rate exceeds the release threshold")
    if health.get("p95Ms", float("inf")) > health.get("maxP95Ms", 500):
        reasons.append("p95 latency exceeds the release threshold")
    return not reasons, reasons


class ReleaseGate:
    def __init__(self, trusted_rollback_signers: dict[str, bytes] | None = None) -> None:
        self.trusted_rollback_signers = dict(trusted_rollback_signers or {})

    def evaluate(
        self,
        transcripts: list[CaseResult],
        sdk_reports: list[dict[str, Any]],
        proxy_reports: list[dict[str, Any]],
        health: dict[str, Any],
        rollback: dict[str, Any],
    ) -> dict[str, Any]:
        reasons: list[str] = []
        if not transcripts:
            reasons.append("conformance transcript evidence is empty")
        elif any(not is_sha256_digest(case.evidence_digest) for case in transcripts):
            reasons.append("conformance transcript evidence has an invalid digest")
        reasons.extend(f"transcript failed: {case.name}" for case in transcripts if not case.passed)
        if not sdk_reports:
            reasons.append("SDK differential evidence is empty")
        elif any(
            not is_sha256_digest(report.get("rawDigest"))
            or not is_sha256_digest(report.get("sdkDigest"))
            for report in sdk_reports
        ):
            reasons.append("SDK differential evidence has an invalid digest")
        reasons.extend(
            "SDK view lost or changed wire semantics"
            for report in sdk_reports
            if report.get("semanticMatch") is not True
        )
        if not proxy_reports:
            reasons.append("proxy evidence is empty")
        elif any(
            not is_sha256_digest(report.get(field))
            for report in proxy_reports
            for field in ("ingressDigest", "originDigest", "egressDigest")
        ):
            reasons.append("proxy evidence has an invalid digest")
        reasons.extend(
            issue for report in proxy_reports for issue in report.get("issues", [])
        )
        reasons.extend(
            "proxy evidence did not pass"
            for report in proxy_reports
            if report.get("passed") is not True and not report.get("issues")
        )
        health_passed, health_reasons = evaluate_health(health)
        reasons.extend(health_reasons)

        rollback_ready = rollback_evidence_ready(rollback, self.trusted_rollback_signers)
        if not rollback_ready:
            reasons.append("no verified healthy rollback target")
        if not reasons:
            action = "promote"
        elif rollback_ready:
            action = "rollback"
        else:
            action = "hold"

        evidence = redact(
            {
                "transcripts": [case.__dict__ for case in transcripts],
                "sdkDifferential": sdk_reports,
                "proxy": proxy_reports,
                "health": health,
                "rollback": rollback,
            }
        )
        return {
            "action": action,
            "passed": action == "promote",
            "reasons": reasons,
            "healthPassed": health_passed,
            "rollbackReady": rollback_ready,
            "evidenceDigest": digest(evidence),
            "evidence": evidence,
        }


def healthy_window() -> dict[str, Any]:
    return {
        "sampleCount": 1000,
        "errorRate": 0.002,
        "maxErrorRate": 0.01,
        "p95Ms": 180,
        "maxP95Ms": 500,
    }


def demo() -> None:
    cases = [run_transcript(case) for case in transcript_suite()]
    raw_result = {
        "resultType": "complete",
        "tools": [],
        "futureHint": {"preserve": True},
        "_meta": {"trace": "trace-42"},
    }
    sdk_report = compare_sdk_view(raw_result, {"tools": []})
    headers, request = modern_request("tools/call", 7, "inventory_get")
    error_body = {
        "jsonrpc": "2.0",
        "id": 7,
        "error": {"code": -32020, "message": "header mismatch"},
    }
    proxy_report = inspect_proxy(
        {
            "ingress": {
                "headers": {**headers, "Authorization": "Bearer do-not-store"},
                "body": request,
            },
            "origin": {"status": 400, "body": error_body},
            "egress": {"status": 500, "body": {"message": "upstream failed"}},
        }
    )
    fixture_key = hashlib.sha256(b"deterministic non-secret lesson fixture").digest()
    rollback = attach_rollback_attestation(
        {
            "version": "1.0.0",
            "healthy": True,
            "registryStatus": "active",
            "admissionEvidenceDigest": digest({"release": "1.0.0"}),
            "artifactDigest": digest({"artifact": "inventory-1.0.0"}),
            "descriptorDigest": digest({"tools": ["inventory_get"]}),
        },
        "release-controller",
        fixture_key,
    )
    report = ReleaseGate({"release-controller": fixture_key}).evaluate(
        cases, [sdk_report], [proxy_report], healthy_window(), rollback
    )
    print(
        json.dumps(
            {
                "transcriptsPassed": sum(case.passed for case in cases),
                "transcriptsTotal": len(cases),
                "sdkDroppedFields": sdk_report["droppedFields"],
                "proxyIssues": proxy_report["issues"],
                "releaseAction": report["action"],
                "evidenceDigest": report["evidenceDigest"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    demo()
