"""Companion code for:
certifications/claude/lessons/08-messages-api-and-application-lifecycle/docs/en.md
It models the Messages API lifecycle without network calls.
Protocol concepts follow the official Anthropic Messages API documentation.
"""

from __future__ import annotations

import base64
import binascii
import copy
import hashlib
import json
from dataclasses import dataclass
from typing import Any, Callable, Iterable


class ProtocolError(ValueError):
    """Raised when a simulated provider response violates the protocol."""


@dataclass(frozen=True)
class RunResult:
    text: str
    messages: list[dict[str, Any]]
    turns: int


@dataclass(frozen=True)
class AccessNeeds:
    """Workload facts used to choose a client and completion pattern."""

    supported_sdk: bool = True
    custom_transport: bool = False
    progressive_output: bool = False
    independent_requests: int = 1
    can_wait: bool = False


def choose_access_pattern(needs: AccessNeeds) -> dict[str, str]:
    """Choose SDK versus REST separately from sync, stream, or batch."""
    if needs.independent_requests < 1:
        raise ValueError("independent_requests must be positive")
    if needs.progressive_output and needs.can_wait and needs.independent_requests > 1:
        raise ValueError("message batches do not provide progressive per-token output")

    client = "raw-rest" if needs.custom_transport or not needs.supported_sdk else "sdk"
    if needs.can_wait and needs.independent_requests > 1:
        delivery = "message-batch"
    elif needs.progressive_output:
        delivery = "streaming"
    else:
        delivery = "synchronous"
    return {"client": client, "delivery": delivery}


class ScriptedTransport:
    """A stateless transport that returns scripted API responses."""

    def __init__(self, responses: list[dict[str, Any]]) -> None:
        self._responses = copy.deepcopy(responses)
        self.requests: list[list[dict[str, Any]]] = []

    def create(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        self.requests.append(copy.deepcopy(messages))
        if not self._responses:
            raise ProtocolError("transport has no scripted response left")
        return self._responses.pop(0)


class MessageLifecycle:
    """Own conversation state and advance it until the model ends the turn."""

    def __init__(
        self,
        transport: ScriptedTransport,
        tools: dict[str, Callable[[dict[str, Any]], Any]] | None = None,
        max_turns: int = 8,
    ) -> None:
        if max_turns < 1:
            raise ValueError("max_turns must be positive")
        self.transport = transport
        self.tools = tools or {}
        self.max_turns = max_turns

    def run(self, user_text: str) -> RunResult:
        if not user_text.strip():
            raise ValueError("user_text must not be empty")
        messages: list[dict[str, Any]] = [
            {"role": "user", "content": [{"type": "text", "text": user_text}]}
        ]

        for turn in range(1, self.max_turns + 1):
            response = self.transport.create(messages)
            blocks = _validated_blocks(response)
            stop_reason = response.get("stop_reason")

            # The assistant tool_use block must be retained before tool_result.
            messages.append({"role": "assistant", "content": copy.deepcopy(blocks)})

            if stop_reason == "end_turn":
                return RunResult(_text_from_blocks(blocks), messages, turn)
            if stop_reason != "tool_use":
                raise ProtocolError(f"unsupported stop_reason: {stop_reason!r}")

            tool_results = [self._execute_tool(block) for block in blocks if block["type"] == "tool_use"]
            if not tool_results:
                raise ProtocolError("stop_reason tool_use had no tool_use block")
            messages.append({"role": "user", "content": tool_results})

        raise ProtocolError(f"maximum turn count {self.max_turns} exceeded")

    def _execute_tool(self, block: dict[str, Any]) -> dict[str, Any]:
        tool_id = block.get("id")
        name = block.get("name")
        arguments = block.get("input")
        if not isinstance(tool_id, str) or not tool_id:
            raise ProtocolError("tool_use requires a non-empty id")
        if not isinstance(name, str) or not isinstance(arguments, dict):
            raise ProtocolError("tool_use requires name and object input")

        handler = self.tools.get(name)
        if handler is None:
            return {
                "type": "tool_result",
                "tool_use_id": tool_id,
                "content": f"Unknown tool: {name}",
                "is_error": True,
            }
        try:
            value = handler(arguments)
            return {
                "type": "tool_result",
                "tool_use_id": tool_id,
                "content": json.dumps(value, sort_keys=True),
            }
        except Exception as exc:  # Tool failures become model-visible results.
            return {
                "type": "tool_result",
                "tool_use_id": tool_id,
                "content": f"{type(exc).__name__}: {exc}",
                "is_error": True,
            }


def _validated_blocks(response: dict[str, Any]) -> list[dict[str, Any]]:
    blocks = response.get("content")
    if not isinstance(blocks, list) or not blocks:
        raise ProtocolError("response content must be a non-empty block list")
    if not all(isinstance(block, dict) and isinstance(block.get("type"), str) for block in blocks):
        raise ProtocolError("every content block needs a type")
    return blocks


def _text_from_blocks(blocks: list[dict[str, Any]]) -> str:
    return "".join(str(block.get("text", "")) for block in blocks if block["type"] == "text")


def collect_stream_text(events: Iterable[dict[str, Any]]) -> str:
    """Collect only text deltas while checking that a stream terminates."""
    chunks: list[str] = []
    stopped = False
    for event in events:
        event_type = event.get("type")
        if stopped:
            raise ProtocolError("event arrived after message_stop")
        if event_type == "content_block_delta":
            delta = event.get("delta", {})
            if delta.get("type") == "text_delta":
                chunks.append(str(delta.get("text", "")))
        elif event_type == "message_stop":
            stopped = True
    if not stopped:
        raise ProtocolError("stream ended without message_stop")
    return "".join(chunks)


def batch(items: list[Any], size: int) -> list[list[Any]]:
    if size < 1:
        raise ValueError("batch size must be positive")
    return [items[index : index + size] for index in range(0, len(items), size)]


def stable_cache_key(model: str, stable_prefix: str) -> str:
    payload = f"{model}\0{stable_prefix}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


IMAGE_MEDIA_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
DOCUMENT_MEDIA_TYPES = {"application/pdf", "text/plain"}


def build_multimodal_request(prompt: str, image_bytes: bytes, reusable_file_id: str) -> dict[str, Any]:
    """Build an offline request body with inline vision and a reusable file asset."""
    if not prompt.strip():
        raise ValueError("prompt must not be empty")
    if not image_bytes:
        raise ValueError("image_bytes must not be empty")
    if not reusable_file_id.strip():
        raise ValueError("reusable_file_id must not be empty")
    return {
        "model": "<current-model-id>",
        "max_tokens": 400,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": base64.b64encode(image_bytes).decode("ascii"),
                        },
                    },
                    {
                        "type": "document",
                        "source": {"type": "file", "file_id": reusable_file_id},
                    },
                ],
            }
        ],
    }


def validate_multimodal_request(request: dict[str, Any], owned_file_ids: set[str]) -> list[str]:
    """Validate content blocks and reject file references outside an application allowlist."""
    errors: list[str] = []
    messages = request.get("messages")
    if not isinstance(messages, list) or len(messages) != 1 or not isinstance(messages[0], dict):
        return ["fixture must contain exactly one user message"]
    message = messages[0]
    content = message.get("content")
    if message.get("role") != "user" or not isinstance(content, list) or not content:
        return ["fixture needs a non-empty user content block list"]
    if not isinstance(content[0], dict) or content[0].get("type") != "text" or not str(content[0].get("text", "")).strip():
        errors.append("instruction text must be the first content block")

    for index, block in enumerate(content[1:], start=1):
        if not isinstance(block, dict) or block.get("type") not in {"image", "document"}:
            errors.append(f"content[{index}] must be an image or document block")
            continue
        source = block.get("source")
        if not isinstance(source, dict):
            errors.append(f"content[{index}].source must be an object")
            continue
        source_type = source.get("type")
        if source_type == "file":
            file_id = source.get("file_id")
            if not isinstance(file_id, str) or file_id not in owned_file_ids:
                errors.append(f"content[{index}] references an unowned file_id")
        elif source_type == "base64":
            allowed = IMAGE_MEDIA_TYPES if block["type"] == "image" else DOCUMENT_MEDIA_TYPES
            if source.get("media_type") not in allowed:
                errors.append(f"content[{index}] has an unsupported media_type")
            try:
                encoded = source.get("data")
                if not isinstance(encoded, str) or not base64.b64decode(encoded, validate=True):
                    raise ValueError
            except (ValueError, binascii.Error):
                errors.append(f"content[{index}] has invalid base64 data")
        elif source_type == "url":
            url = source.get("url")
            if not isinstance(url, str) or not url.startswith("https://"):
                errors.append(f"content[{index}] URL must use https")
        else:
            errors.append(f"content[{index}] has an unsupported source type")
    return errors


def asset_boundary_ledger(request: dict[str, Any]) -> list[dict[str, str]]:
    """Return auditable asset metadata without copying asset bytes or opaque file IDs."""
    ledger: list[dict[str, str]] = []
    content = request["messages"][0]["content"]
    for block in content:
        if block.get("type") not in {"image", "document"}:
            continue
        source = block["source"]
        source_type = source["type"]
        secret = source.get("data") or source.get("file_id") or source.get("url")
        ledger.append(
            {
                "content_type": block["type"],
                "source_type": source_type,
                "reference_sha256": hashlib.sha256(str(secret).encode("utf-8")).hexdigest(),
                "boundary": {
                    "base64": "request-body",
                    "url": "provider-fetches-remote-origin",
                    "file": "files-workspace",
                }[source_type],
                "retention_action": {
                    "base64": "redact-request-content-from-logs",
                    "url": "review-origin-and-request-retention",
                    "file": "delete-when-workspace-retention-ends",
                }[source_type],
            }
        )
    return ledger


def multimodal_lab_fixture() -> dict[str, Any]:
    """Create the deterministic access and asset fixture shipped with the lesson."""
    owned_file_id = "file_offline_policy_fixture"
    one_pixel_png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    )
    request = build_multimodal_request(
        "Compare the synthetic chart with the approved policy document.",
        one_pixel_png,
        owned_file_id,
    )
    return {
        "verified_on": "2026-08-09",
        "files_api_beta_header": "files-api-2025-04-14",
        "owned_file_ids": [owned_file_id],
        "access_decisions": [
            {
                "workload": "typed interactive request",
                **choose_access_pattern(AccessNeeds()),
            },
            {
                "workload": "progressive user interface",
                **choose_access_pattern(AccessNeeds(progressive_output=True)),
            },
            {
                "workload": "overnight independent evaluation",
                **choose_access_pattern(AccessNeeds(independent_requests=500, can_wait=True)),
            },
            {
                "workload": "unsupported embedded runtime with custom transport",
                **choose_access_pattern(AccessNeeds(supported_sdk=False, custom_transport=True)),
            },
        ],
        "request": request,
        "asset_boundary_ledger": asset_boundary_ledger(request),
    }


def demo() -> RunResult:
    transport = ScriptedTransport(
        [
            {
                "stop_reason": "tool_use",
                "content": [
                    {"type": "text", "text": "I will check the order. "},
                    {"type": "tool_use", "id": "toolu_01", "name": "lookup_order", "input": {"id": "A-17"}},
                ],
            },
            {"stop_reason": "end_turn", "content": [{"type": "text", "text": "Order A-17 is ready."}]},
        ]
    )
    lifecycle = MessageLifecycle(transport, {"lookup_order": lambda args: {"id": args["id"], "status": "ready"}})
    return lifecycle.run("Where is order A-17?")


if __name__ == "__main__":
    result = demo()
    print(
        json.dumps(
            {
                "lifecycle": {"text": result.text, "turns": result.turns, "messages": result.messages},
                "multimodal_lab": multimodal_lab_fixture(),
            },
            indent=2,
        )
    )
