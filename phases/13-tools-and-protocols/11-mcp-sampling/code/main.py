"""Phase 13 Lesson 11: model input through stateless MCP MRTR.

Lesson: ../docs/en.md
Specification: https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr
This example uses only Python's standard library.
Run: python3 main.py
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from copy import deepcopy
from dataclasses import dataclass
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PROTOCOL_META = "io.modelcontextprotocol/protocolVersion"
CAPABILITIES_META = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_META = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_META = "io.modelcontextprotocol/serverInfo"
SERVER_SECRET = b"lesson-11-demo-secret-change-in-production"

FAKE_REPO = {
    "README.md": "A small notes server used to teach stateless MCP.",
    "server.py": "def dispatch(request): return handle(request)",
    "client.py": "def retry(request, inputs, state): ...",
    "LICENSE": "MIT",
    "tests/test_server.py": "def test_stateless_retry(): ...",
    "docs/intro.md": "The server has no protocol session state.",
}
TOOLS = [
    {
        "name": "summarize_repo",
        "description": "Select representative repository files and summarize them.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "audience": {
                    "type": "string",
                    "description": "Audience for the final repository summary.",
                }
            },
            "required": [],
        },
    }
]


@dataclass
class McpError(Exception):
    code: int
    message: str
    data: dict[str, Any] | None = None


def request_meta(*, sampling: bool = True) -> dict[str, Any]:
    capabilities: dict[str, Any] = {"sampling": {}} if sampling else {}
    return {
        PROTOCOL_META: PROTOCOL_VERSION,
        CAPABILITIES_META: capabilities,
        CLIENT_INFO_META: {"name": "lesson-client", "version": "1.0.0"},
    }


def _server_meta() -> dict[str, Any]:
    return {SERVER_INFO_META: {"name": "mrtr-demo", "version": "1.0.0"}}


def complete(**fields: Any) -> dict[str, Any]:
    return {"resultType": "complete", **fields, "_meta": _server_meta()}


def validate_request_meta(params: dict[str, Any]) -> dict[str, Any]:
    meta = params.get("_meta")
    if not isinstance(meta, dict):
        raise McpError(-32602, "missing request _meta")
    requested_version = meta.get(PROTOCOL_META)
    if not isinstance(requested_version, str):
        raise McpError(-32602, "missing protocol version")
    if requested_version != PROTOCOL_VERSION:
        raise McpError(
            -32022,
            "unsupported protocol version",
            {"supported": [PROTOCOL_VERSION], "requested": requested_version},
        )
    capabilities = meta.get(CAPABILITIES_META)
    if not isinstance(capabilities, dict):
        raise McpError(-32602, "missing client capabilities")
    return meta


def server_discover(params: dict[str, Any]) -> dict[str, Any]:
    validate_request_meta(params)
    return complete(
        supportedVersions=[PROTOCOL_VERSION],
        capabilities={"tools": {}},
        ttlMs=300_000,
        cacheScope="public",
    )


def tools_list(params: dict[str, Any]) -> dict[str, Any]:
    validate_request_meta(params)
    return complete(
        tools=sorted(deepcopy(TOOLS), key=lambda tool: tool["name"]),
        ttlMs=60_000,
        cacheScope="public",
    )


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _arguments_digest(arguments: dict[str, Any]) -> str:
    encoded = json.dumps(arguments, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def seal_request_state(payload: dict[str, Any]) -> str:
    body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    signature = hmac.new(SERVER_SECRET, body, hashlib.sha256).digest()
    return f"{_b64(body)}.{_b64(signature)}"


def verify_request_state(
    token: str,
    *,
    principal: str,
    arguments: dict[str, Any],
    now: int | None = None,
) -> dict[str, Any]:
    try:
        body_part, signature_part = token.split(".", 1)
        body = _unb64(body_part)
        supplied = _unb64(signature_part)
    except (ValueError, TypeError) as exc:
        raise McpError(-32602, "invalid requestState encoding") from exc
    expected = hmac.new(SERVER_SECRET, body, hashlib.sha256).digest()
    if not hmac.compare_digest(supplied, expected):
        raise McpError(-32602, "requestState integrity check failed")
    try:
        state = json.loads(body)
    except json.JSONDecodeError as exc:
        raise McpError(-32602, "invalid requestState payload") from exc
    if state.get("principal") != principal:
        raise McpError(-32602, "requestState principal mismatch")
    if state.get("method") != "tools/call":
        raise McpError(-32602, "requestState method mismatch")
    if state.get("argumentsDigest") != _arguments_digest(arguments):
        raise McpError(-32602, "requestState arguments mismatch")
    if int(state.get("expiresAt", 0)) < (int(time.time()) if now is None else now):
        raise McpError(-32602, "requestState expired")
    return state


def _sampling_request(prompt: str, *, intelligence: float) -> dict[str, Any]:
    return {
        "method": "sampling/createMessage",
        "params": {
            "messages": [
                {"role": "user", "content": {"type": "text", "text": prompt}}
            ],
            "systemPrompt": "Return only the requested value.",
            "modelPreferences": {
                "costPriority": round(1.0 - intelligence, 2),
                "intelligencePriority": intelligence,
            },
            "maxTokens": 400,
        },
    }


def _input_required(
    key: str,
    prompt: str,
    state: dict[str, Any],
    *,
    intelligence: float,
) -> dict[str, Any]:
    return {
        "resultType": "input_required",
        "inputRequests": {key: _sampling_request(prompt, intelligence=intelligence)},
        "requestState": seal_request_state(state),
        "_meta": _server_meta(),
    }


def _sampling_text(input_responses: Any, key: str) -> str:
    if not isinstance(input_responses, dict):
        raise McpError(-32602, "inputResponses must be an object")
    response = input_responses.get(key)
    if not isinstance(response, dict):
        raise McpError(-32602, f"missing input response: {key}")
    content = response.get("content")
    if not isinstance(content, dict) or content.get("type") != "text":
        raise McpError(-32602, f"invalid sampling response: {key}")
    text = content.get("text")
    if not isinstance(text, str) or not text.strip():
        raise McpError(-32602, f"empty sampling response: {key}")
    return text


def tools_call(params: dict[str, Any], *, principal: str) -> dict[str, Any]:
    meta = validate_request_meta(params)
    if params.get("name") != "summarize_repo":
        raise McpError(-32602, "unknown tool")
    arguments = params.get("arguments", {})
    if not isinstance(arguments, dict):
        raise McpError(-32602, "arguments must be an object")
    capabilities = meta[CAPABILITIES_META]
    if "sampling" not in capabilities:
        raise McpError(
            -32021,
            "missing required client capability",
            {"requiredCapabilities": {"sampling": {}}},
        )

    state_token = params.get("requestState")
    if state_token is None:
        state = {
            "phase": "pick",
            "principal": principal,
            "method": "tools/call",
            "argumentsDigest": _arguments_digest(arguments),
            "expiresAt": int(time.time()) + 300,
        }
        prompt = (
            "Choose three representative files and return a JSON array. Files: "
            + json.dumps(sorted(FAKE_REPO))
        )
        return _input_required("pick_files", prompt, state, intelligence=0.2)

    if not isinstance(state_token, str):
        raise McpError(-32602, "requestState must be a string")
    state = verify_request_state(
        state_token,
        principal=principal,
        arguments=arguments,
    )
    responses = params.get("inputResponses")

    if state["phase"] == "pick":
        raw_picks = _sampling_text(responses, "pick_files")
        try:
            picks = json.loads(raw_picks)
        except json.JSONDecodeError as exc:
            raise McpError(-32602, "pick_files must return JSON") from exc
        if not isinstance(picks, list) or not all(isinstance(item, str) for item in picks):
            raise McpError(-32602, "pick_files must return a string array")
        picked = [name for name in picks if name in FAKE_REPO][:3]
        if not picked:
            raise McpError(-32602, "pick_files returned no known files")
        combined = "\n\n".join(f"{name}: {FAKE_REPO[name]}" for name in picked)
        next_state = {
            **state,
            "phase": "summarize",
            "picked": picked,
            "expiresAt": int(time.time()) + 300,
        }
        prompt = "Summarize these files in two sentences:\n\n" + combined
        return _input_required("summary", prompt, next_state, intelligence=0.8)

    if state["phase"] == "summarize":
        summary = _sampling_text(responses, "summary")
        return complete(
            content=[{"type": "text", "text": summary}],
            structuredContent={"picked": state["picked"], "summary": summary},
            isError=False,
        )

    raise McpError(-32602, "unknown requestState phase")


def dispatch(
    request: dict[str, Any],
    *,
    principal: str = "user-42",
) -> dict[str, Any] | None:
    is_notification = "id" not in request
    request_id = request.get("id")
    try:
        method = request.get("method")
        params = request.get("params", {})
        if not isinstance(params, dict):
            raise McpError(-32602, "params must be an object")
        if method == "server/discover":
            result = server_discover(params)
        elif method == "tools/list":
            result = tools_list(params)
        elif method == "tools/call":
            result = tools_call(params, principal=principal)
        else:
            raise McpError(-32601, "method not found")
        if is_notification:
            return None
        return {"jsonrpc": "2.0", "id": request_id, "result": result}
    except McpError as exc:
        if is_notification:
            return None
        error: dict[str, Any] = {"code": exc.code, "message": exc.message}
        if exc.data is not None:
            error["data"] = exc.data
        return {"jsonrpc": "2.0", "id": request_id, "error": error}


def fake_host_model(input_request: dict[str, Any]) -> dict[str, Any]:
    prompt = input_request["params"]["messages"][-1]["content"]["text"]
    if "Choose three" in prompt:
        text = json.dumps(["README.md", "server.py", "docs/intro.md"])
    else:
        text = (
            "This repository demonstrates a stateless MCP server and client retry loop. "
            "Each MRTR round carries all required state without a protocol session."
        )
    return {
        "role": "assistant",
        "content": {"type": "text", "text": text},
        "model": "host-model",
        "stopReason": "endTurn",
    }


def run_mrtr() -> tuple[dict[str, Any], list[int]]:
    base_params = {
        "name": "summarize_repo",
        "arguments": {"audience": "developer"},
        "_meta": request_meta(),
    }
    request_id = 1
    response = dispatch(
        {"jsonrpc": "2.0", "id": request_id, "method": "tools/call", "params": base_params}
    )
    seen_ids = [request_id]

    while response.get("result", {}).get("resultType") == "input_required":
        pending = response["result"]
        fulfilled = {
            key: fake_host_model(input_request)
            for key, input_request in pending["inputRequests"].items()
        }
        request_id += 1
        seen_ids.append(request_id)
        retry_params = {
            **base_params,
            "inputResponses": fulfilled,
            "requestState": pending["requestState"],
        }
        response = dispatch(
            {
                "jsonrpc": "2.0",
                "id": request_id,
                "method": "tools/call",
                "params": retry_params,
            }
        )
    return response, seen_ids


def main() -> None:
    discovery = dispatch(
        {
            "jsonrpc": "2.0",
            "id": 0,
            "method": "server/discover",
            "params": {"_meta": request_meta()},
        }
    )
    print("discover:", json.dumps(discovery["result"], indent=2))
    response, request_ids = run_mrtr()
    print("independent request ids:", request_ids)
    print("final:", json.dumps(response["result"], indent=2))


if __name__ == "__main__":
    main()
