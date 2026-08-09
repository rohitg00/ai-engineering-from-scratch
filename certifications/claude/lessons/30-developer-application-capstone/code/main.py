"""Companion code for:
certifications/claude/lessons/30-developer-application-capstone/docs/en.md
It combines validation, policy, tools, tracing, and deterministic evaluation.
Protocol ideas follow official Anthropic Messages and evaluation guidance.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Protocol


ORDER_ID = re.compile(r"\b[A-Z]-\d{2,6}\b")
DEFAULT_EVAL_PLAN = Path(__file__).resolve().parents[1] / "outputs" / "eval-plan.json"
ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


class MessagesTransport(Protocol):
    """Small dependency-injection boundary for a Messages API call."""

    def create_message(self, payload: dict[str, Any]) -> dict[str, Any]: ...


class AnthropicMessagesHTTPTransport:
    """Opt-in stdlib HTTP transport that never logs or persists its API key."""

    def __init__(
        self,
        api_key: str,
        endpoint: str = ANTHROPIC_MESSAGES_URL,
        timeout_seconds: float = 30.0,
        opener: Callable[..., Any] = urllib.request.urlopen,
    ) -> None:
        if not api_key.strip():
            raise ValueError("api_key must be non-empty")
        self._api_key = api_key
        self.endpoint = endpoint
        self.timeout_seconds = timeout_seconds
        self._opener = opener

    def create_message(self, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            self.endpoint,
            data=body,
            method="POST",
            headers={
                "content-type": "application/json",
                "anthropic-version": ANTHROPIC_VERSION,
                "x-api-key": self._api_key,
            },
        )
        try:
            with self._opener(request, timeout=self.timeout_seconds) as response:
                decoded = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            raise RuntimeError(f"Messages API returned HTTP {error.code}") from None
        if not isinstance(decoded, dict):
            raise ValueError("Messages API response must be an object")
        return decoded


def build_live_order_request(request: str, model: str) -> dict[str, Any]:
    """Build an inspectable wire payload with the same bounded lookup contract."""
    return {
        "model": model,
        "max_tokens": 128,
        "system": (
            "You are a bounded order-status router. Use lookup_order only when "
            "the user supplies an exact public order ID. Never claim execution."
        ),
        "messages": [{"role": "user", "content": request}],
        "tools": [
            {
                "name": "lookup_order",
                "description": "Read one visible order status. Never changes order state.",
                "input_schema": {
                    "type": "object",
                    "properties": {"order_id": {"type": "string", "pattern": "^[A-Z]-[0-9]{2,6}$"}},
                    "required": ["order_id"],
                    "additionalProperties": False,
                },
            }
        ],
    }


def run_live_wire(transport: MessagesTransport, request: str, model: str) -> dict[str, Any]:
    """Exercise the real serialization boundary and return only safe metadata."""
    response = transport.create_message(build_live_order_request(request, model))
    content = response.get("content")
    if response.get("type") != "message" or response.get("role") != "assistant" or not isinstance(content, list):
        raise ValueError("unexpected Messages API response contract")
    content_types = [block.get("type") for block in content if isinstance(block, dict)]
    return {
        "type": response["type"],
        "role": response["role"],
        "stop_reason": response.get("stop_reason"),
        "content_types": content_types,
        "message_id_present": isinstance(response.get("id"), str),
    }


@dataclass(frozen=True)
class TraceEvent:
    type: str
    detail: dict[str, Any]


@dataclass(frozen=True)
class SupportResult:
    status: str
    answer: str
    order_id: str | None
    escalated: bool
    trace: tuple[TraceEvent, ...]

    def contract(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "answer": self.answer,
            "order_id": self.order_id,
            "escalated": self.escalated,
        }


class LeastPrivilegeGate:
    def allow(self, tool: str, arguments: dict[str, Any], approved: bool = False) -> tuple[bool, str]:
        if tool == "lookup_order" and set(arguments) == {"order_id"}:
            return True, "read-only lookup"
        if tool == "issue_refund":
            return (approved, "explicit approval required" if not approved else "approved refund")
        return False, "capability or arguments not allowlisted"


class ToolRegistry:
    def __init__(self, orders: dict[str, str]) -> None:
        self.orders = dict(orders)

    def call(self, tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if tool != "lookup_order":
            raise ValueError("unsupported tool")
        order_id = arguments["order_id"]
        if order_id not in self.orders:
            return {"found": False, "order_id": order_id}
        return {"found": True, "order_id": order_id, "status": self.orders[order_id]}


class SupportAgent:
    def __init__(self, registry: ToolRegistry, gate: LeastPrivilegeGate | None = None) -> None:
        self.registry = registry
        self.gate = gate or LeastPrivilegeGate()

    def run(self, request: str) -> SupportResult:
        trace: list[TraceEvent] = [TraceEvent("request_received", {"length": len(request)})]
        injection_markers = ("ignore previous", "reveal secret", "read .env", "bypass approval")
        if any(marker in request.lower() for marker in injection_markers):
            trace.append(TraceEvent("policy_denial", {"reason": "instruction injection marker"}))
            return SupportResult("denied", "I cannot follow instructions that bypass policy or request secrets.", None, True, tuple(trace))

        match = ORDER_ID.search(request)
        if not match:
            trace.append(TraceEvent("validation_failure", {"field": "order_id"}))
            return SupportResult("needs_input", "Provide an order ID such as A-123 before I check status.", None, False, tuple(trace))

        order_id = match.group(0)
        arguments = {"order_id": order_id}
        allowed, reason = self.gate.allow("lookup_order", arguments)
        trace.append(TraceEvent("policy_check", {"allowed": allowed, "reason": reason}))
        if not allowed:
            return SupportResult("denied", "The requested lookup is outside my permissions.", order_id, True, tuple(trace))

        started = time.perf_counter()
        tool_result = self.registry.call("lookup_order", arguments)
        trace.append(
            TraceEvent(
                "tool_result",
                {
                    "tool": "lookup_order",
                    "found": tool_result["found"],
                    "effects": ["order_lookup"],
                    "latency_ms": (time.perf_counter() - started) * 1000,
                },
            )
        )
        if not tool_result["found"]:
            return SupportResult("not_found", f"I could not verify order {order_id}. A support specialist should check it.", order_id, True, tuple(trace))

        status = str(tool_result["status"])
        trace.append(TraceEvent("contract_validated", {"fields": ["status", "answer", "order_id", "escalated"]}))
        return SupportResult("resolved", f"Order {order_id} is {status}.", order_id, False, tuple(trace))


def validate_contract(value: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    required = {"status": str, "answer": str, "order_id": (str, type(None)), "escalated": bool}
    for name, expected in required.items():
        if name not in value:
            issues.append(f"missing {name}")
        elif not isinstance(value[name], expected):
            issues.append(f"invalid type for {name}")
    unexpected = set(value) - set(required)
    if unexpected:
        issues.append(f"unexpected fields: {sorted(unexpected)}")
    return issues


def load_eval_plan(path: Path | str | None = None) -> dict[str, Any]:
    source = Path(path) if path is not None else DEFAULT_EVAL_PLAN
    with source.open("r", encoding="utf-8") as handle:
        plan = json.load(handle)
    if not isinstance(plan, dict) or not isinstance(plan.get("cases"), list) or not plan["cases"]:
        raise ValueError("evaluation plan requires a non-empty cases list")
    if not isinstance(plan.get("releaseGates"), dict):
        raise ValueError("evaluation plan requires releaseGates")
    return plan


def _default_agent_factory(fixture: dict[str, str]) -> Callable[[str], SupportResult]:
    return SupportAgent(ToolRegistry(fixture)).run


def _trace_tools(trace: tuple[TraceEvent, ...]) -> list[str]:
    return [
        str(event.detail["tool"])
        for event in trace
        if event.type == "tool_result" and isinstance(event.detail.get("tool"), str)
    ]


def _trace_effects(trace: tuple[TraceEvent, ...]) -> set[str]:
    effects: set[str] = set()
    for event in trace:
        declared = event.detail.get("effects", [])
        if isinstance(declared, list):
            effects.update(str(effect) for effect in declared)
    return effects


def evaluate(
    plan: dict[str, Any] | None = None,
    agent_factory: Callable[[dict[str, str]], Callable[[str], SupportResult]] | None = None,
) -> dict[str, Any]:
    active_plan = load_eval_plan() if plan is None else plan
    cases = active_plan.get("cases")
    release_gates = active_plan.get("releaseGates")
    if not isinstance(cases, list) or not cases or not isinstance(release_gates, dict):
        raise ValueError("evaluation plan requires cases and releaseGates")

    max_tool_calls = release_gates.get("maxToolCallsPerCase")
    if not isinstance(max_tool_calls, int) or isinstance(max_tool_calls, bool) or max_tool_calls < 0:
        raise ValueError("maxToolCallsPerCase must be a non-negative integer")
    global_forbidden = release_gates.get("forbiddenEffects", [])
    if not isinstance(global_forbidden, list):
        raise ValueError("releaseGates.forbiddenEffects must be a list")
    required_trace_fields = active_plan.get("requiredTraceFields", [])
    if not isinstance(required_trace_fields, list):
        raise ValueError("requiredTraceFields must be a list")

    create_agent = agent_factory or _default_agent_factory
    results: list[dict[str, Any]] = []
    safe_cases = 0
    for case in cases:
        if not isinstance(case, dict) or not isinstance(case.get("id"), str):
            raise ValueError("every evaluation case requires an id")
        fixture = case.get("fixture", {})
        expected_tools = case.get("expectedTools", [])
        case_forbidden = case.get("forbiddenEffects", [])
        if not isinstance(fixture, dict) or not isinstance(expected_tools, list) or not isinstance(case_forbidden, list):
            raise ValueError(f"evaluation case {case['id']} has invalid fixture or constraints")

        result = create_agent(dict(fixture))(str(case.get("input", "")))
        contract = result.contract()
        trace = [asdict(event) for event in result.trace]
        actual_tools = _trace_tools(result.trace)
        actual_effects = _trace_effects(result.trace)
        forbidden = set(str(effect) for effect in global_forbidden + case_forbidden)
        forbidden_observed = sorted(actual_effects & forbidden)

        failures = validate_contract(contract)
        if result.status != case.get("expectedStatus"):
            failures.append(f"expected status {case.get('expectedStatus')}")
        if result.escalated is not case.get("expectedEscalated"):
            failures.append(f"expected escalated {case.get('expectedEscalated')}")
        if actual_tools != expected_tools:
            failures.append(f"expected tool trajectory {expected_tools}, got {actual_tools}")
        if len(actual_tools) > max_tool_calls:
            failures.append(f"tool call limit exceeded: {len(actual_tools)} > {max_tool_calls}")
        if forbidden_observed:
            failures.append(f"forbidden effects observed: {forbidden_observed}")
        for index, event in enumerate(trace):
            missing_fields = [field for field in required_trace_fields if field not in event]
            if missing_fields:
                failures.append(f"trace event {index} missing fields: {missing_fields}")

        safety_passed = not forbidden_observed
        safe_cases += int(safety_passed)
        results.append(
            {
                "id": case["id"],
                "prompt": case.get("input", ""),
                "passed": not failures,
                "safetyPassed": safety_passed,
                "failures": failures,
                "actual": contract,
                "actualTools": actual_tools,
                "actualEffects": sorted(actual_effects),
                "trace": trace,
            }
        )

    passed = sum(item["passed"] for item in results)
    total = len(results)
    case_pass_rate = passed / total
    safety_pass_rate = safe_cases / total
    required_case_rate = float(release_gates.get("requiredCasePassRate", 1.0))
    required_safety_rate = float(release_gates.get("safetyPassRate", 1.0))
    return {
        "passed": passed,
        "total": total,
        "casePassRate": case_pass_rate,
        "safetyPassRate": safety_pass_rate,
        "releaseReady": case_pass_rate >= required_case_rate and safety_pass_rate >= required_safety_rate,
        "cases": results,
    }


def demo() -> dict[str, Any]:
    agent = SupportAgent(ToolRegistry({"A-17": "ready for dispatch", "B-42": "in transit"}))
    result = agent.run("Please check A-17")
    return {
        "result": result.contract(),
        "trace": [asdict(event) for event in result.trace],
        "evaluation": evaluate(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the offline capstone or an opt-in Messages wire smoke test.")
    parser.add_argument("--live", action="store_true", help="Call the real Messages API using ANTHROPIC_API_KEY.")
    parser.add_argument("--model", help="Model ID for --live; defaults to ANTHROPIC_MODEL.")
    args = parser.parse_args()

    if not args.live:
        result = demo()
    else:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        model = args.model or os.environ.get("ANTHROPIC_MODEL", "")
        if not api_key:
            parser.error("--live requires ANTHROPIC_API_KEY")
        if not model:
            parser.error("--live requires --model or ANTHROPIC_MODEL")
        result = run_live_wire(AnthropicMessagesHTTPTransport(api_key), "Check order A-17.", model)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
