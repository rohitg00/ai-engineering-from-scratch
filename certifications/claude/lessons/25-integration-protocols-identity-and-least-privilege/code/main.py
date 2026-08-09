"""Integration and least-privilege lab for this lesson's docs/en.md.

Models protocol selection, capability discovery, scope checks, and approvals.
Authorization is evaluated at execution time instead of delegated to a prompt.
Uses only the Python standard library so the control boundary is inspectable.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class IntegrationRequirements:
    dynamic_discovery: bool = False
    local_automation: bool = False
    cross_agent_delegation: bool = False
    direct_service_call: bool = False
    long_running: bool = False


def select_protocol(requirements: IntegrationRequirements) -> str:
    selected = [
        name
        for condition, name in (
            (requirements.dynamic_discovery, "mcp"),
            (requirements.local_automation, "cli"),
            (requirements.cross_agent_delegation, "agent-to-agent"),
            (requirements.direct_service_call, "api"),
        )
        if condition
    ]
    if len(selected) != 1:
        raise ValueError("requirements must identify one primary integration shape")
    protocol = selected[0]
    if requirements.long_running and protocol == "cli":
        return "cli-with-durable-job"
    return protocol


@dataclass(frozen=True)
class Principal:
    principal_id: str
    scopes: frozenset[str]
    approved_actions: frozenset[str] = frozenset()


@dataclass(frozen=True)
class ToolContract:
    name: str
    description: str
    required_scopes: frozenset[str]
    risk: str
    approval_required: bool = False


@dataclass(frozen=True)
class AuthorizationDecision:
    allowed: bool
    reason: str


def authorize(principal: Principal, tool: ToolContract) -> AuthorizationDecision:
    missing = sorted(tool.required_scopes - principal.scopes)
    if missing:
        return AuthorizationDecision(False, f"missing scopes: {', '.join(missing)}")
    if tool.approval_required and tool.name not in principal.approved_actions:
        return AuthorizationDecision(False, "fresh human approval required")
    return AuthorizationDecision(True, "authorized")


def discover_tools(principal: Principal, tools: list[ToolContract]) -> list[ToolContract]:
    return [tool for tool in tools if not (tool.required_scopes - principal.scopes)]


def execute_tool(principal: Principal, tool: ToolContract, arguments: dict[str, object]) -> dict[str, object]:
    decision = authorize(principal, tool)
    if not decision.allowed:
        return {
            "ok": False,
            "error": {"category": "authorization", "retryable": False, "message": decision.reason},
        }
    return {
        "ok": True,
        "tool": tool.name,
        "arguments": arguments,
        "audit": {"principal": principal.principal_id, "risk": tool.risk},
    }


def demo() -> dict[str, object]:
    tools = [
        ToolContract("read_ticket", "Read one assigned support ticket", frozenset({"tickets:read"}), "low"),
        ToolContract("draft_reply", "Create a draft without sending it", frozenset({"tickets:read", "drafts:write"}), "low"),
        ToolContract("issue_refund", "Issue an approved refund", frozenset({"refunds:write"}), "high", True),
    ]
    principal = Principal("support-agent-42", frozenset({"tickets:read", "drafts:write"}))
    visible = discover_tools(principal, tools)
    attempt = execute_tool(principal, tools[2], {"amount": 75})
    return {
        "protocol": select_protocol(IntegrationRequirements(dynamic_discovery=True)),
        "visible_tools": [tool.name for tool in visible],
        "refund_attempt": attempt,
        "principal": asdict(principal) | {"scopes": sorted(principal.scopes), "approved_actions": sorted(principal.approved_actions)},
    }


if __name__ == "__main__":
    print(json.dumps(demo(), indent=2))

