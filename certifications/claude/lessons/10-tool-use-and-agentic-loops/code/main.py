"""Companion code for:
certifications/claude/lessons/10-tool-use-and-agentic-loops/docs/en.md
It models Claude tool_use and tool_result content-block sequencing.
Behavior follows official Anthropic client-tool and Messages documentation.
"""

from __future__ import annotations

import copy
import json
from dataclasses import dataclass
from typing import Any, Callable


class ToolLoopError(RuntimeError):
    pass


@dataclass(frozen=True)
class RuntimeNeeds:
    """Facts that decide how much agent-loop infrastructure to adopt."""

    open_ended: bool
    supported_sdk: bool = True
    needs_custom_wire_control: bool = False
    needs_managed_sandbox: bool = False
    needs_remote_durable_session: bool = False
    accepts_managed_beta: bool = False


def choose_runtime(needs: RuntimeNeeds) -> str:
    """Choose a workflow, hand-written loop, Tool Runner, or managed agent."""
    if not needs.open_ended:
        return "deterministic-workflow"
    if needs.needs_managed_sandbox or needs.needs_remote_durable_session:
        if not needs.accepts_managed_beta:
            raise ValueError("managed requirements need explicit acceptance of the current beta boundary")
        return "managed-agents"
    if needs.needs_custom_wire_control or not needs.supported_sdk:
        return "hand-written-loop"
    return "sdk-tool-runner"


@dataclass(frozen=True)
class CapabilityNeeds:
    """Separate executable capability from optional reusable procedure."""

    reusable_procedure: bool = False
    shared_standard_service: bool = False
    provider_executed_builtin: bool = False
    anthropic_schema_client_tool: bool = False


def choose_capability_surface(needs: CapabilityNeeds) -> dict[str, str]:
    execution_flags = sum(
        (
            needs.shared_standard_service,
            needs.provider_executed_builtin,
            needs.anthropic_schema_client_tool,
        )
    )
    if execution_flags > 1:
        raise ValueError("choose one execution boundary for a capability")
    if needs.provider_executed_builtin:
        execution = "server-built-in-tool"
        boundary = "anthropic-service"
    elif needs.anthropic_schema_client_tool:
        execution = "anthropic-schema-client-tool"
        boundary = "application-sandbox"
    elif needs.shared_standard_service:
        execution = "mcp"
        boundary = "mcp-server"
    else:
        execution = "custom-client-tool"
        boundary = "application-service"
    return {
        "execution": execution,
        "procedure": "skill" if needs.reusable_procedure else "inline-instructions",
        "execution_boundary": boundary,
        "authorization_owner": "application-policy",
    }


def _matches_json_type(value: Any, expected: str) -> bool:
    checks: dict[str, Callable[[Any], bool]] = {
        "null": lambda item: item is None,
        "boolean": lambda item: isinstance(item, bool),
        "integer": lambda item: isinstance(item, int) and not isinstance(item, bool),
        "number": lambda item: isinstance(item, (int, float)) and not isinstance(item, bool),
        "string": lambda item: isinstance(item, str),
        "array": lambda item: isinstance(item, list),
        "object": lambda item: isinstance(item, dict),
    }
    if expected not in checks:
        raise ValueError(f"unsupported schema type: {expected}")
    return checks[expected](value)


def _integer_bound(schema: dict[str, Any], name: str) -> int | None:
    if name not in schema:
        return None
    value = schema[name]
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValueError(f"schema {name} must be a non-negative integer")
    return value


def _validate_schema_value(value: Any, schema: Any, location: str) -> None:
    if not isinstance(schema, dict):
        raise ValueError(f"schema for {location} must be an object")

    declared_type = schema.get("type")
    if declared_type is not None:
        declared_types = declared_type if isinstance(declared_type, list) else [declared_type]
        if not declared_types or not all(isinstance(item, str) for item in declared_types):
            raise ValueError(f"schema type for {location} must be a string or non-empty string list")
        if not any(_matches_json_type(value, item) for item in declared_types):
            expected = " or ".join(declared_types)
            raise ValueError(f"invalid type for {location}: expected {expected}")

    if "enum" in schema:
        choices = schema["enum"]
        if not isinstance(choices, list) or not choices:
            raise ValueError(f"schema enum for {location} must be a non-empty list")
        if value not in choices:
            raise ValueError(f"invalid value for {location}: not in enum")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        for keyword, comparison, message in (
            ("minimum", lambda current, bound: current >= bound, "below minimum"),
            ("maximum", lambda current, bound: current <= bound, "above maximum"),
            ("exclusiveMinimum", lambda current, bound: current > bound, "at or below exclusive minimum"),
            ("exclusiveMaximum", lambda current, bound: current < bound, "at or above exclusive maximum"),
        ):
            if keyword not in schema:
                continue
            bound = schema[keyword]
            if not isinstance(bound, (int, float)) or isinstance(bound, bool):
                raise ValueError(f"schema {keyword} for {location} must be numeric")
            if not comparison(value, bound):
                raise ValueError(f"invalid value for {location}: {message} {bound}")

    if isinstance(value, str):
        minimum = _integer_bound(schema, "minLength")
        maximum = _integer_bound(schema, "maxLength")
        if minimum is not None and len(value) < minimum:
            raise ValueError(f"invalid length for {location}: below minLength {minimum}")
        if maximum is not None and len(value) > maximum:
            raise ValueError(f"invalid length for {location}: above maxLength {maximum}")

    if isinstance(value, list):
        minimum = _integer_bound(schema, "minItems")
        maximum = _integer_bound(schema, "maxItems")
        if minimum is not None and len(value) < minimum:
            raise ValueError(f"invalid item count for {location}: below minItems {minimum}")
        if maximum is not None and len(value) > maximum:
            raise ValueError(f"invalid item count for {location}: above maxItems {maximum}")
        if "items" in schema:
            for index, item in enumerate(value):
                _validate_schema_value(item, schema["items"], f"{location}[{index}]")

    if isinstance(value, dict):
        properties = schema.get("properties", {})
        if not isinstance(properties, dict):
            raise ValueError(f"schema properties for {location} must be an object")
        required = schema.get("required", [])
        if not isinstance(required, list) or not all(isinstance(name, str) for name in required):
            raise ValueError(f"schema required for {location} must be a string list")
        missing = [name for name in required if name not in value]
        if missing:
            raise ValueError(f"missing required fields: {', '.join(missing)}")
        unexpected = set(value) - set(properties)
        if unexpected and schema.get("additionalProperties") is False:
            raise ValueError(f"unexpected fields: {', '.join(sorted(unexpected))}")
        for name, item in value.items():
            if name in properties:
                _validate_schema_value(item, properties[name], f"{location}.{name}")


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Any]
    mutates: bool = False

    def validate(self, arguments: dict[str, Any]) -> None:
        if not isinstance(arguments, dict):
            raise ValueError("tool input must be an object")
        _validate_schema_value(arguments, self.input_schema, "tool input")


class ToolRegistry:
    def __init__(self, tools: list[Tool]) -> None:
        names = [tool.name for tool in tools]
        if len(names) != len(set(names)):
            raise ValueError("tool names must be unique")
        self._tools = {tool.name: tool for tool in tools}

    def execute(self, block: dict[str, Any], approve: Callable[[Tool, dict[str, Any]], bool]) -> dict[str, Any]:
        tool_id = block.get("id")
        name = block.get("name")
        arguments = block.get("input")
        if not isinstance(tool_id, str) or not tool_id:
            raise ToolLoopError("tool_use id is required")
        result = {"type": "tool_result", "tool_use_id": tool_id}
        tool = self._tools.get(name)
        if tool is None:
            return {**result, "content": f"Unknown tool: {name}", "is_error": True}
        try:
            tool.validate(arguments)
            if tool.mutates and not approve(tool, arguments):
                return {**result, "content": "Approval denied", "is_error": True}
            value = tool.handler(arguments)
            return {**result, "content": json.dumps(value, sort_keys=True)}
        except Exception as exc:
            return {**result, "content": f"{type(exc).__name__}: {exc}", "is_error": True}


class ScriptedModel:
    def __init__(self, responses: list[dict[str, Any]]) -> None:
        self.responses = copy.deepcopy(responses)
        self.requests: list[list[dict[str, Any]]] = []

    def create(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        self.requests.append(copy.deepcopy(messages))
        if not self.responses:
            raise ToolLoopError("model script exhausted")
        return self.responses.pop(0)


class ToolLoop:
    def __init__(
        self,
        model: ScriptedModel,
        registry: ToolRegistry,
        approve: Callable[[Tool, dict[str, Any]], bool] = lambda _tool, _args: False,
        max_turns: int = 8,
    ) -> None:
        self.model = model
        self.registry = registry
        self.approve = approve
        self.max_turns = max_turns

    def run(self, request: str) -> tuple[str, list[dict[str, Any]]]:
        messages: list[dict[str, Any]] = [{"role": "user", "content": request}]
        for _ in range(self.max_turns):
            response = self.model.create(messages)
            blocks = response.get("content")
            if not isinstance(blocks, list):
                raise ToolLoopError("response content must be a list")
            messages.append({"role": "assistant", "content": copy.deepcopy(blocks)})
            reason = response.get("stop_reason")
            if reason == "end_turn":
                text = "".join(block.get("text", "") for block in blocks if block.get("type") == "text")
                return text, messages
            if reason != "tool_use":
                raise ToolLoopError(f"unsupported stop reason: {reason}")
            calls = [block for block in blocks if block.get("type") == "tool_use"]
            if not calls:
                raise ToolLoopError("tool_use stop without calls")
            results = [self.registry.execute(block, self.approve) for block in calls]
            messages.append({"role": "user", "content": results})
        raise ToolLoopError("maximum turns exceeded")


def demo() -> tuple[str, list[dict[str, Any]]]:
    add = Tool(
        "add",
        "Add two integers.",
        {"type": "object", "required": ["a", "b"], "additionalProperties": False, "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}}},
        lambda data: data["a"] + data["b"],
    )
    model = ScriptedModel([
        {"stop_reason": "tool_use", "content": [{"type": "tool_use", "id": "call_1", "name": "add", "input": {"a": 7, "b": 8}}]},
        {"stop_reason": "end_turn", "content": [{"type": "text", "text": "The total is 15."}]},
    ])
    return ToolLoop(model, ToolRegistry([add])).run("Add 7 and 8")


def decision_lab() -> dict[str, Any]:
    """Return checked architecture decisions without importing an SDK."""
    runtime_cases = [
        ("fixed extraction pipeline", RuntimeNeeds(open_ended=False)),
        (
            "regulated loop with custom protocol checkpoints",
            RuntimeNeeds(open_ended=True, needs_custom_wire_control=True),
        ),
        ("client-owned support agent", RuntimeNeeds(open_ended=True)),
        (
            "remote long-running agent with managed sandbox",
            RuntimeNeeds(
                open_ended=True,
                needs_managed_sandbox=True,
                needs_remote_durable_session=True,
                accepts_managed_beta=True,
            ),
        ),
    ]
    capability_cases = [
        ("live public web search", CapabilityNeeds(provider_executed_builtin=True)),
        (
            "approved private refund procedure",
            CapabilityNeeds(reusable_procedure=True),
        ),
        ("shared CRM service", CapabilityNeeds(shared_standard_service=True)),
        ("desktop interaction", CapabilityNeeds(anthropic_schema_client_tool=True)),
    ]
    return {
        "verified_on": "2026-08-09",
        "runtime_decisions": [
            {"scenario": scenario, "runtime": choose_runtime(needs)}
            for scenario, needs in runtime_cases
        ],
        "capability_decisions": [
            {"scenario": scenario, **choose_capability_surface(needs)}
            for scenario, needs in capability_cases
        ],
    }


if __name__ == "__main__":
    answer, transcript = demo()
    print(answer)
    print(json.dumps(transcript, indent=2))
    print(json.dumps(decision_lab(), indent=2))
