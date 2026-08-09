"""Companion validator for this lesson's docs/en.md team review artifact."""

from __future__ import annotations

import json
from pathlib import Path


ARTIFACT = Path(__file__).resolve().parents[1] / "outputs" / "team-configuration-review.md"
HOOK_ARTIFACT = Path(__file__).resolve().parents[1] / "outputs" / "permission-request-decision.json"
REQUIRED_HEADINGS = (
    "## Scope",
    "## Capability Inventory",
    "## Permission Modes",
    "## Context Recovery",
    "## Autonomous Boundary",
    "## Worktree Ownership",
    "## Hook Decision",
    "## Scheduled Execution",
    "## Review Automation",
    "## Allowed Fixture",
    "## Denied Fixture",
    "## Version Evidence",
    "## Rollback",
)
REQUIRED_EVIDENCE = {
    "ownership": ("owner",),
    "boundary fixtures": ("allow", "deny"),
    "versioning": ("pinned", "version"),
    "recovery": ("rollback",),
    "permissions": ("acceptedits", "dontask", "deny rule"),
    "context": ("/context", "/compact", "/clear", "/rewind"),
    "autonomy": ("/goal", "/loop", "turn bound"),
    "isolation": ("--worktree", "owner"),
    "scheduling": ("routine", "github actions"),
    "review": ("code review", "anthropics/claude-code-action@v1"),
}


def validate_text(text: str) -> dict[str, object]:
    lowered = " ".join(text.lower().split())
    findings = [f"missing heading: {heading}" for heading in REQUIRED_HEADINGS if heading not in text]
    for label, terms in REQUIRED_EVIDENCE.items():
        missing = [term for term in terms if term not in lowered]
        if missing:
            findings.append(f"missing {label} evidence: {', '.join(missing)}")
    if any(marker in lowered for marker in ("tbd", "todo", "[replace")):
        findings.append("artifact contains an unresolved placeholder")
    score = max(0, 100 - 12 * len(findings))
    return {"status": "ready_for_team_review" if not findings else "blocked", "score": score, "findings": findings}


def validate_artifact(path: Path = ARTIFACT) -> dict[str, object]:
    result = validate_text(path.read_text(encoding="utf-8"))
    hook_result = validate_permission_decision(json.loads(HOOK_ARTIFACT.read_text(encoding="utf-8")))
    findings = list(result["findings"]) + list(hook_result["findings"])
    return {
        "status": "ready_for_team_review" if not findings else "blocked",
        "score": max(0, 100 - 8 * len(findings)),
        "findings": findings,
    }


def validate_permission_decision(payload: object) -> dict[str, object]:
    findings: list[str] = []
    if not isinstance(payload, dict):
        findings.append("hook output must be an object")
        output: object = None
    else:
        output = payload.get("hookSpecificOutput")
    if not isinstance(output, dict):
        findings.append("missing hookSpecificOutput")
        decision: object = None
    else:
        if output.get("hookEventName") != "PermissionRequest":
            findings.append("hookEventName must be PermissionRequest")
        decision = output.get("decision")
    if not isinstance(decision, dict):
        findings.append("missing PermissionRequest decision")
    else:
        behavior = decision.get("behavior")
        if behavior not in {"allow", "deny"}:
            findings.append("decision behavior must be allow or deny")
        if behavior == "deny" and not isinstance(decision.get("message"), str):
            findings.append("deny decision requires a message")
    return {"status": "valid" if not findings else "blocked", "findings": findings}


if __name__ == "__main__":
    print(json.dumps(validate_artifact(), indent=2))
