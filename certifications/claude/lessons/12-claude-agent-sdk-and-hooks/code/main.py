"""Companion code for:
certifications/claude/lessons/12-claude-agent-sdk-and-hooks/docs/en.md
It validates tools, hooks, sandbox, budgets, subagent isolation, and resume state.
No Agent SDK installation or provider credential is required for the policy lab.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


REQUIRED_STATE = {"goal", "acceptanceCriteria", "artifactPaths", "contentHashes", "completedSteps", "pendingSteps", "approvalRecords", "operationIds", "testResults", "recoveryPlan"}
REQUIRED_RUNTIME_OWNERSHIP = {"authorization", "data boundaries", "custom tool execution", "event persistence", "final-state verification"}
REQUIRED_APPROVAL_RISKS = {"external-side-effect", "affirmative-consent", "financial-transaction", "terms-acceptance"}


class EventStreamError(ValueError):
    """Raised when a managed-agent event fixture violates the state contract."""


@dataclass(frozen=True)
class EventSummary:
    status: str
    stop_reason: str | None
    messages: list[str]
    pending_action_ids: list[str]
    last_event_id: str | None
    preview_text: str
    complete: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "stop_reason": self.stop_reason,
            "messages": self.messages,
            "pending_action_ids": self.pending_action_ids,
            "last_event_id": self.last_event_id,
            "preview_text": self.preview_text,
            "complete": self.complete,
        }


def consume_managed_events(events: Iterable[dict[str, Any]]) -> EventSummary:
    """Consume persisted events and optional stream previews without network access."""
    status = "unknown"
    stop_reason: str | None = None
    messages: list[str] = []
    preview_parts: list[str] = []
    actionable: set[str] = set()
    pending: set[str] = set()
    seen: set[str] = set()
    last_event_id: str | None = None

    for event in events:
        if not isinstance(event, dict) or not isinstance(event.get("type"), str):
            raise EventStreamError("every event needs a type")
        event_type = event["type"]
        if event_type in {"event_start", "event_delta"}:
            if event_type == "event_delta" and isinstance(event.get("text"), str):
                preview_parts.append(event["text"])
            continue

        event_id = event.get("id")
        if not isinstance(event_id, str) or not event_id:
            raise EventStreamError("persisted events need a non-empty id")
        if event_id in seen:
            continue
        seen.add(event_id)
        last_event_id = event_id

        if event_type == "session.status_running":
            status = "running"
            stop_reason = None
        elif event_type == "agent.message":
            content = event.get("content", [])
            if not isinstance(content, list):
                raise EventStreamError("agent.message content must be a list")
            messages.append(
                "".join(
                    str(block.get("text", ""))
                    for block in content
                    if isinstance(block, dict) and block.get("type") == "text"
                )
            )
        elif event_type in {"agent.custom_tool_use", "agent.tool_use", "agent.mcp_tool_use"}:
            actionable.add(event_id)
        elif event_type in {"user.custom_tool_result", "user.tool_confirmation"}:
            reference = event.get("custom_tool_use_id") or event.get("tool_use_id")
            if not isinstance(reference, str) or reference not in actionable:
                raise EventStreamError("tool result or confirmation must reference a known action")
            pending.discard(reference)
        elif event_type == "session.status_idle":
            status = "idle"
            reason = event.get("stop_reason")
            if not isinstance(reason, dict) or reason.get("type") not in {"requires_action", "end_turn"}:
                raise EventStreamError("idle status needs a supported stop_reason")
            stop_reason = reason["type"]
            if stop_reason == "requires_action":
                event_ids = reason.get("event_ids")
                if not isinstance(event_ids, list) or not event_ids or not all(
                    isinstance(item, str) and item in actionable for item in event_ids
                ):
                    raise EventStreamError("requires_action must reference known actionable event IDs")
                pending = set(event_ids)
            else:
                pending.clear()
        elif event_type == "session.status_terminated":
            status = "terminated"
            stop_reason = "terminated"
            pending.clear()
        elif event_type == "session.error":
            raise EventStreamError("session emitted an error event")

    complete = status == "terminated" or (status == "idle" and stop_reason == "end_turn")
    return EventSummary(
        status=status,
        stop_reason=stop_reason,
        messages=messages,
        pending_action_ids=sorted(pending),
        last_event_id=last_event_id,
        preview_text="".join(preview_parts),
        complete=complete,
    )


def validate_policy(policy: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    tools = policy.get("tools")
    if not isinstance(tools, list) or not tools:
        return ["tools must be non-empty"]
    names = [tool.get("name") for tool in tools if isinstance(tool, dict)]
    if len(names) != len(tools) or len(names) != len(set(names)):
        errors.append("tool names must be present and unique")
    for index, tool in enumerate(tools):
        has_action_policy = tool.get("approvalPolicy") == "per-action"
        if tool.get("mutates") is True and tool.get("approvalRequired") is not True and not has_action_policy:
            errors.append(f"tools[{index}] mutation requires approval")
    hooks = policy.get("hooks")
    if not isinstance(hooks, list):
        errors.append("hooks must be a list")
        hooks = []
    pre_tool_names = {name for hook in hooks if isinstance(hook, dict) and hook.get("event") == "pre-tool" for name in hook.get("tools", [])}
    mutating_names = {tool["name"] for tool in tools if tool.get("mutates") is True}
    if not mutating_names <= pre_tool_names:
        errors.append("every mutating tool needs a pre-tool hook")
    if not any(hook.get("event") == "stop" and "verified final state" in str(hook.get("purpose", "")) for hook in hooks if isinstance(hook, dict)):
        errors.append("stop hook must require an independently verified final state")
    sandbox = policy.get("sandbox")
    if not isinstance(sandbox, dict) or not sandbox.get("readRoots") or not sandbox.get("writeRoots") or sandbox.get("network") not in {"deny", "allowlist"} or not sandbox.get("secretPaths"):
        errors.append("sandbox needs roots, network policy, and secret paths")
    budgets = policy.get("budgets")
    if not isinstance(budgets, dict) or any(not isinstance(budgets.get(field), int) or budgets[field] <= 0 for field in ("maxTurns", "maxToolCalls", "deadlineSeconds", "maxConsecutiveErrors")):
        errors.append("budgets must contain positive integer limits")
    reviewer = policy.get("reviewerSubagent")
    if not isinstance(reviewer, dict) or reviewer.get("canWrite") is not False:
        errors.append("reviewerSubagent must be read-only")
    elif set(reviewer.get("tools", [])) & mutating_names:
        errors.append("reviewerSubagent cannot receive mutating tools")
    state = policy.get("durableState")
    if not isinstance(state, dict) or not REQUIRED_STATE <= set(state.get("fields", [])) or state.get("reconcileBeforeResume") is not True:
        errors.append("durableState must persist required fields and reconcile before resume")
    final = policy.get("finalStatePredicate")
    if not isinstance(final, dict) or final.get("type") in {None, "final-prose"} or len(final.get("requirements", [])) < 3:
        errors.append("finalStatePredicate must verify artifacts and state outside final prose")

    runtime = policy.get("runtimeDecision")
    if not isinstance(runtime, dict) or runtime.get("selected") not in {"hand-written-loop", "sdk-tool-runner", "managed-agents"}:
        errors.append("runtimeDecision must select a supported agent runtime")
    elif runtime.get("selected") == "managed-agents" and runtime.get("acceptsManagedBeta") is not True:
        errors.append("managed-agents selection requires explicit beta acceptance")
    if not isinstance(runtime, dict) or not REQUIRED_RUNTIME_OWNERSHIP <= set(runtime.get("applicationOwns", [])):
        errors.append("runtimeDecision must preserve application-owned controls")

    stream = policy.get("managedEventStream")
    if not isinstance(stream, dict) or any(
        stream.get(field) is not expected
        for field, expected in (
            ("persistEventCursor", True),
            ("deduplicateByEventId", True),
            ("connectionCloseIsTerminal", False),
            ("resolveRequiresActionByEventId", True),
        )
    ):
        errors.append("managedEventStream must persist, deduplicate, and resolve explicit state")

    computer = policy.get("computerUse")
    if not isinstance(computer, dict) or computer.get("enabled") is not True:
        errors.append("computerUse policy must be explicit")
    else:
        environment = computer.get("environment")
        display = computer.get("display")
        approval = computer.get("humanApproval")
        if not isinstance(environment, dict) or environment.get("isolation") not in {"dedicated-vm", "container"}:
            errors.append("computerUse needs a dedicated VM or container")
        elif environment.get("network") not in {"deny", "allowlist"} or environment.get("sensitiveData") != "deny":
            errors.append("computerUse needs bounded network and denied sensitive data")
        elif environment.get("network") == "allowlist" and not environment.get("allowedDomains"):
            errors.append("computerUse network allowlist cannot be empty")
        if not isinstance(display, dict) or any(
            not isinstance(display.get(field), int) or isinstance(display[field], bool) or display[field] <= 0
            for field in ("width", "height")
        ):
            errors.append("computerUse display dimensions must be positive integers")
        if computer.get("requireFreshScreenshotBeforeAction") is not True or computer.get("requireScreenshotAfterAction") is not True:
            errors.append("computerUse requires screenshots before and after actions")
        if not isinstance(computer.get("allowedActions"), list) or "screenshot" not in computer["allowedActions"]:
            errors.append("computerUse needs an explicit action allowlist")
        if not isinstance(approval, dict) or not REQUIRED_APPROVAL_RISKS <= set(approval.get("requiredRiskClasses", [])) or "credential-entry" not in set(approval.get("deniedRiskClasses", [])):
            errors.append("computerUse needs approval and denial risk boundaries")
    return errors


def evaluate_action(policy: dict[str, Any], tool_name: str, approved: bool) -> dict[str, Any]:
    errors = validate_policy(policy)
    if errors:
        raise ValueError("; ".join(errors))
    tool = next((item for item in policy["tools"] if item["name"] == tool_name), None)
    if tool is None:
        return {"allowed": False, "reason": "unknown tool"}
    if tool.get("approvalPolicy") == "per-action":
        return {"allowed": False, "reason": "per-action policy required"}
    if tool["approvalRequired"] and not approved:
        return {"allowed": False, "reason": "approval required"}
    return {"allowed": True, "reason": "policy and approval passed"}


class ComputerUseGuard:
    """Validate model-proposed UI actions against trusted harness state."""

    def __init__(self, policy: dict[str, Any]) -> None:
        errors = validate_policy(policy)
        if errors:
            raise ValueError("; ".join(errors))
        self.config = policy["computerUse"]
        self.screenshot_id: str | None = None
        self.needs_verification = False

    def observe_screenshot(self, screenshot_id: str, width: int, height: int) -> dict[str, Any]:
        display = self.config["display"]
        if not screenshot_id:
            return {"allowed": False, "reason": "screenshot ID is required"}
        if width != display["width"] or height != display["height"]:
            return {"allowed": False, "reason": "screenshot dimensions do not match the tool display"}
        self.screenshot_id = screenshot_id
        self.needs_verification = False
        return {"allowed": True, "reason": "fresh screenshot recorded"}

    def authorize(
        self,
        action: dict[str, Any],
        trusted_risk_class: str,
        approved: bool = False,
    ) -> dict[str, Any]:
        action_name = action.get("action")
        if action_name == "screenshot":
            return {"allowed": False, "reason": "record screenshots through observe_screenshot"}
        if action_name not in self.config["allowedActions"]:
            return {"allowed": False, "reason": "action is outside the allowlist"}
        if self.screenshot_id is None or action.get("screenshot_id") != self.screenshot_id:
            return {"allowed": False, "reason": "action needs the current screenshot ID"}

        allowed_fields = {
            "left_click": {"action", "coordinate", "screenshot_id"},
            "type": {"action", "text", "screenshot_id"},
        }.get(action_name)
        if allowed_fields is None or set(action) - allowed_fields:
            return {"allowed": False, "reason": "action fields do not match the normalized contract"}
        if action_name == "left_click" and "coordinate" not in action:
            return {"allowed": False, "reason": "left_click requires a coordinate"}
        if action_name == "type":
            text = action.get("text")
            if not isinstance(text, str) or not text or len(text) > 1000:
                return {"allowed": False, "reason": "type text must contain 1 to 1000 characters"}

        coordinate = action.get("coordinate")
        if coordinate is not None:
            if not isinstance(coordinate, list) or len(coordinate) != 2 or any(
                not isinstance(value, int) or isinstance(value, bool) for value in coordinate
            ):
                return {"allowed": False, "reason": "coordinate must contain two integers"}
            width = self.config["display"]["width"]
            height = self.config["display"]["height"]
            if not (0 <= coordinate[0] < width and 0 <= coordinate[1] < height):
                return {"allowed": False, "reason": "coordinate is outside the displayed screenshot"}

        approval = self.config["humanApproval"]
        if trusted_risk_class in approval["deniedRiskClasses"]:
            return {"allowed": False, "reason": "risk class is denied"}
        if trusted_risk_class in approval["requiredRiskClasses"] and not approved:
            return {"allowed": False, "reason": "human approval required"}
        if trusted_risk_class not in approval["allowedRiskClasses"] and trusted_risk_class not in approval["requiredRiskClasses"]:
            return {"allowed": False, "reason": "unknown trusted risk class"}

        self.screenshot_id = None
        self.needs_verification = True
        return {"allowed": True, "reason": "action passed policy; capture a verification screenshot"}


def load_policy(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("policy root must be an object")
    return value


if __name__ == "__main__":
    path = Path(__file__).parents[1] / "outputs" / "agent-harness-policy.json"
    policy = load_policy(path)
    fixture = load_policy(Path(__file__).parents[1] / "outputs" / "managed-agent-event-fixture.json")
    checkpoint = fixture["events"][: fixture["checkpoint_after"]]
    print(
        json.dumps(
            {
                "valid": not validate_policy(policy),
                "read": evaluate_action(policy, "Read", False),
                "editWithoutApproval": evaluate_action(policy, "Edit", False),
                "managedCheckpoint": consume_managed_events(checkpoint).to_dict(),
                "managedComplete": consume_managed_events(fixture["events"]).to_dict(),
            },
            indent=2,
        )
    )
