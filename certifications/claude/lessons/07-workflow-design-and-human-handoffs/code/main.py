"""Companion code for:
certifications/claude/lessons/07-workflow-design-and-human-handoffs/docs/en.md
It validates step ownership, review boundaries, checkpoints, and fallback.
The local runner returns the next decision from a filled handoff packet.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


STEP_FIELDS = {"id", "trigger", "owner", "inputs", "output", "gate", "escalation", "fallback", "nextOwner", "irreversible", "humanApproval"}
HANDOFF_FIELDS = {"decisionRequired", "deadlineAndOwner", "workflowAndSourceVersions", "candidateResult", "evidence", "checksPassed", "checksFailed", "uncertainty", "actionsAvailable", "fallback"}


def validate_workflow(workflow: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not str(workflow.get("sourceCutoff", "")).strip():
        errors.append("sourceCutoff is required")
    steps = workflow.get("steps")
    if not isinstance(steps, list) or len(steps) < 3:
        return errors + ["at least three workflow steps are required"]
    ids: set[str] = set()
    for index, step in enumerate(steps):
        if not isinstance(step, dict) or STEP_FIELDS - set(step):
            errors.append(f"steps[{index}] is incomplete")
            continue
        if step["id"] in ids:
            errors.append(f"duplicate step id: {step['id']}")
        ids.add(step["id"])
        for field in ("trigger", "owner", "output", "gate", "escalation", "fallback", "nextOwner"):
            if not str(step.get(field, "")).strip():
                errors.append(f"steps[{index}].{field} is required")
        if not isinstance(step.get("inputs"), list) or not step["inputs"]:
            errors.append(f"steps[{index}].inputs must be non-empty")
        if step.get("irreversible") is True and step.get("humanApproval") is not True:
            errors.append(f"steps[{index}] irreversible action requires humanApproval")
    checkpoints = workflow.get("checkpoints")
    if not isinstance(checkpoints, list) or len(checkpoints) < len(steps):
        errors.append("each step needs a durable checkpoint")
    handoff = workflow.get("handoff")
    if not isinstance(handoff, dict) or HANDOFF_FIELDS - set(handoff):
        errors.append("handoff is incomplete")
    else:
        for field in HANDOFF_FIELDS - {"checksPassed", "checksFailed", "actionsAvailable"}:
            if not str(handoff.get(field, "")).strip():
                errors.append(f"handoff.{field} is required")
        if not isinstance(handoff.get("checksFailed"), list):
            errors.append("handoff.checksFailed must be a list")
        actions = handoff.get("actionsAvailable")
        if not isinstance(actions, list) or not {"approve", "revise", "reject", "escalate"} <= set(actions):
            errors.append("handoff must expose approve, revise, reject, and escalate")
    return errors


def next_action(workflow: dict[str, Any]) -> dict[str, Any]:
    errors = validate_workflow(workflow)
    if errors:
        raise ValueError("; ".join(errors))
    handoff = workflow["handoff"]
    return {"decisionRequired": handoff["decisionRequired"], "failedChecks": handoff["checksFailed"], "recommendedAction": "escalate" if handoff["checksFailed"] else "approve", "fallback": handoff["fallback"]}


def load_workflow(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("workflow root must be an object")
    return value


if __name__ == "__main__":
    path = Path(__file__).parents[1] / "outputs" / "workflow-handoff-packet.json"
    workflow = load_workflow(path)
    print(json.dumps({"valid": not validate_workflow(workflow), "next": next_action(workflow)}, indent=2))
