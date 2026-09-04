# Course lesson: certifications/claude/lessons/31-architect-foundations-scenario-capstone/docs/en.md
# Official source: Claude Certified Architect Foundations Exam Guide, effective July 2026.
# Guide URL: https://everpath-course-content.s3-accelerate.amazonaws.com/instructor%2F6nizmqk8tpzpfjvt6qmmav7rh%2Fpublic%2F1783542750%2FClaude+Certified+Architect+%E2%80%93+Foundations+Exam+Guide.pdf
# This standard-library validator checks architecture packet invariants. It does not call Claude.

"""Validate an original CCAR-F architecture scenario packet."""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
from typing import Any


SCENARIO_CONTEXTS = {
    "customer-support-resolution",
    "code-generation-claude-code",
    "multi-agent-research",
    "developer-productivity-claude",
    "claude-code-ci-cd",
    "structured-data-extraction",
}
REQUIRED_SECTIONS = {
    "scenario",
    "orchestration",
    "tools",
    "claude_code",
    "structured_output",
    "reliability",
    "handoff",
}
REQUIRED_ERROR_FIELDS = {"category", "retryable", "partial_result", "trace_id"}
REQUIRED_VALIDATION_LAYERS = {"syntax", "schema", "semantic", "provenance"}
REQUIRED_PROVENANCE_FIELDS = {
    "source_id",
    "source_version",
    "effective_date",
    "content_type",
    "location",
}
REQUIRED_RESULT_STATES = {"complete", "partial", "blocked"}
REQUIRED_ESCALATIONS = {"policy_gap", "authorization_gap", "source_conflict"}
REQUIRED_REVIEW_STRATA = {"high_impact", "partial_or_conflicting", "random_sample"}
SUPPORTED_SCHEMA_TYPES = {"array", "boolean", "integer", "null", "number", "object", "string"}


def issue(domain: str, code: str, message: str, location: str) -> dict[str, str]:
    """Return one stable architecture finding."""
    return {"domain": domain, "code": code, "message": message, "location": location}


def find_cycle(tasks: list[dict[str, Any]]) -> bool:
    """Detect dependency cycles after unknown prerequisite checks."""
    dependencies = {str(task["id"]): list(task.get("prerequisites", [])) for task in tasks}
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(task_id: str) -> bool:
        if task_id in visiting:
            return True
        if task_id in visited:
            return False
        visiting.add(task_id)
        for prerequisite in dependencies.get(task_id, []):
            if prerequisite in dependencies and visit(prerequisite):
                return True
        visiting.remove(task_id)
        visited.add(task_id)
        return False

    return any(visit(task_id) for task_id in dependencies)


def validate_scenario(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, dict):
        return [issue("scenario", "invalid_scenario", "Scenario must be an object.", "scenario")]
    findings: list[dict[str, str]] = []
    required = ("id", "context", "decision", "consequence", "human_authority")
    missing = [field for field in required if not value.get(field)]
    if missing:
        findings.append(issue("scenario", "invalid_scenario", f"Missing fields: {', '.join(missing)}.", "scenario"))
    if value.get("context") not in SCENARIO_CONTEXTS:
        findings.append(issue("scenario", "unknown_context", "Scenario context is not one of the six public context categories.", "scenario.context"))
    return findings


def validate_tools(value: Any) -> tuple[list[dict[str, str]], set[str]]:
    if not isinstance(value, list) or not value:
        return [issue("tool-design-mcp-integration", "invalid_tools", "Tools must be a non-empty list.", "tools")], set()
    findings: list[dict[str, str]] = []
    names: set[str] = set()
    for index, tool in enumerate(value):
        location = f"tools[{index}]"
        if not isinstance(tool, dict):
            findings.append(issue("tool-design-mcp-integration", "invalid_tool", "Tool must be an object.", location))
            continue
        name = tool.get("name")
        if not name or name in names:
            findings.append(issue("tool-design-mcp-integration", "duplicate_or_missing_tool", "Tool names must be non-empty and unique.", location))
            continue
        names.add(str(name))
        for field in ("description", "when_use", "when_not_use", "auth_scope", "side_effect"):
            if not tool.get(field):
                findings.append(issue("tool-design-mcp-integration", "incomplete_tool_contract", f"Tool {name} is missing {field}.", location))
        input_schema = tool.get("input_schema")
        if not isinstance(input_schema, dict) or input_schema.get("type") != "object":
            findings.append(issue("tool-design-mcp-integration", "invalid_input_schema", f"Tool {name} needs an object input schema.", f"{location}.input_schema"))
        else:
            properties = input_schema.get("properties")
            required = input_schema.get("required", [])
            if not isinstance(properties, dict) or not isinstance(required, list):
                findings.append(issue("tool-design-mcp-integration", "invalid_input_schema", f"Tool {name} schema properties and required fields are invalid.", f"{location}.input_schema"))
            else:
                invalid_required = (
                    any(not isinstance(field, str) for field in required)
                    or len(required) != len(set(required))
                    or not set(required).issubset(properties)
                )
                invalid_properties = any(
                    not isinstance(field, str)
                    or not isinstance(definition, dict)
                    or definition.get("type") not in SUPPORTED_SCHEMA_TYPES
                    for field, definition in properties.items()
                )
                if invalid_required or invalid_properties:
                    findings.append(issue("tool-design-mcp-integration", "invalid_input_schema", f"Tool {name} schema must type every property and require only declared properties.", f"{location}.input_schema"))
            if input_schema.get("additionalProperties") is not False:
                findings.append(issue("tool-design-mcp-integration", "open_input_schema", f"Tool {name} must reject undeclared input properties.", f"{location}.input_schema.additionalProperties"))
        error_fields = set(tool.get("error_contract", []))
        if not REQUIRED_ERROR_FIELDS.issubset(error_fields):
            findings.append(issue("tool-design-mcp-integration", "incomplete_error_contract", f"Tool {name} must expose structured error and partial-result fields.", location))
        if tool.get("side_effect") == "write":
            if tool.get("fresh_authorization") is not True:
                findings.append(issue("tool-design-mcp-integration", "write_without_authorization", f"Write tool {name} needs fresh authorization.", location))
            if not tool.get("idempotency_key"):
                findings.append(issue("tool-design-mcp-integration", "write_without_idempotency", f"Write tool {name} needs an idempotency strategy.", location))
    return findings, names


def validate_orchestration(value: Any, tool_names: set[str]) -> list[dict[str, str]]:
    if not isinstance(value, dict):
        return [issue("agentic-architecture-orchestration", "invalid_orchestration", "Orchestration must be an object.", "orchestration")]
    findings: list[dict[str, str]] = []
    tasks = value.get("tasks")
    if not isinstance(tasks, list) or not tasks:
        return [issue("agentic-architecture-orchestration", "invalid_tasks", "Tasks must be a non-empty list.", "orchestration.tasks")]

    task_ids: set[str] = set()
    valid_tasks: list[dict[str, Any]] = []
    for index, task in enumerate(tasks):
        location = f"orchestration.tasks[{index}]"
        if not isinstance(task, dict) or not task.get("id"):
            findings.append(issue("agentic-architecture-orchestration", "invalid_task", "Task requires an ID.", location))
            continue
        task_id = str(task["id"])
        if task_id in task_ids:
            findings.append(issue("agentic-architecture-orchestration", "duplicate_task", f"Duplicate task ID: {task_id}.", location))
            continue
        task_ids.add(task_id)
        valid_tasks.append(task)
        unknown_tools = set(task.get("allowed_tools", [])) - tool_names
        if unknown_tools:
            findings.append(issue("agentic-architecture-orchestration", "undistributed_tool", f"Task {task_id} references unknown tools: {', '.join(sorted(unknown_tools))}.", location))

    for task in valid_tasks:
        unknown = set(task.get("prerequisites", [])) - task_ids
        if unknown:
            findings.append(issue("agentic-architecture-orchestration", "unknown_prerequisite", f"Task {task['id']} has unknown prerequisites: {', '.join(sorted(unknown))}.", "orchestration.tasks"))
    if find_cycle(valid_tasks):
        findings.append(issue("agentic-architecture-orchestration", "dependency_cycle", "Task prerequisites contain a cycle.", "orchestration.tasks"))

    if set(value.get("result_states", [])) != REQUIRED_RESULT_STATES:
        findings.append(issue("agentic-architecture-orchestration", "missing_result_states", "Orchestration must preserve complete, partial, and blocked states.", "orchestration.result_states"))
    if value.get("reviewer_context") != "isolated":
        findings.append(issue("agentic-architecture-orchestration", "reviewer_not_isolated", "Independent review requires an isolated context.", "orchestration.reviewer_context"))
    if value.get("resume_policy") != "revalidate_external_state":
        findings.append(issue("agentic-architecture-orchestration", "unsafe_resume", "Resume policy must revalidate external state.", "orchestration.resume_policy"))
    return findings


def validate_claude_code(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, dict):
        return [issue("claude-code-configuration-workflows", "invalid_claude_code", "Claude Code configuration must be an object.", "claude_code")]
    findings: list[dict[str, str]] = []
    if not value.get("project_guidance"):
        findings.append(issue("claude-code-configuration-workflows", "missing_project_guidance", "Shared project guidance must be explicit.", "claude_code.project_guidance"))
    if not isinstance(value.get("path_rules"), list) or not value["path_rules"]:
        findings.append(issue("claude-code-configuration-workflows", "missing_path_rules", "At least one scoped path rule is required.", "claude_code.path_rules"))
    ci = value.get("ci")
    required_true = ("fresh_checkout", "structured_findings", "deterministic_tests", "read_only_review")
    if not isinstance(ci, dict) or any(ci.get(field) is not True for field in required_true):
        findings.append(issue("claude-code-configuration-workflows", "unsafe_ci", "CI review must be fresh, structured, deterministic, and read-only.", "claude_code.ci"))
    return findings


def validate_structured_output(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, dict):
        return [issue("prompt-engineering-structured-output", "invalid_structured_output", "Structured-output configuration must be an object.", "structured_output")]
    findings: list[dict[str, str]] = []
    if not value.get("schema_version") or value.get("unknown_state") is not True:
        findings.append(issue("prompt-engineering-structured-output", "incomplete_schema_contract", "Schema version and explicit unknown state are required.", "structured_output"))
    if set(value.get("validation_layers", [])) != REQUIRED_VALIDATION_LAYERS:
        findings.append(issue("prompt-engineering-structured-output", "missing_validation_layer", "Syntax, schema, semantic, and provenance validation are all required.", "structured_output.validation_layers"))
    retry_limit = value.get("retry_limit")
    if not isinstance(retry_limit, int) or isinstance(retry_limit, bool) or retry_limit < 0 or retry_limit > 3:
        findings.append(issue("prompt-engineering-structured-output", "unbounded_retry", "Retry limit must be an integer from 0 through 3.", "structured_output.retry_limit"))
    if value.get("independent_reviewer") is not True:
        findings.append(issue("prompt-engineering-structured-output", "missing_independent_reviewer", "The candidate output needs an independent reviewer pass.", "structured_output.independent_reviewer"))
    return findings


def validate_reliability(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, dict):
        return [issue("context-management-reliability", "invalid_reliability", "Reliability configuration must be an object.", "reliability")]
    findings: list[dict[str, str]] = []
    if value.get("manifest") is not True or not value.get("fact_placement"):
        findings.append(issue("context-management-reliability", "missing_context_controls", "Manifest and fact-placement policy are required.", "reliability"))
    if not REQUIRED_PROVENANCE_FIELDS.issubset(set(value.get("provenance_fields", []))):
        findings.append(issue("context-management-reliability", "incomplete_provenance", "Provenance must include source, version, date, content type, and location.", "reliability.provenance_fields"))
    if not REQUIRED_RESULT_STATES.issubset(set(value.get("partial_states", []))):
        findings.append(issue("context-management-reliability", "incomplete_partial_states", "Reliability must preserve complete, partial, and blocked states.", "reliability.partial_states"))
    if not REQUIRED_ESCALATIONS.issubset(set(value.get("escalation", []))):
        findings.append(issue("context-management-reliability", "incomplete_escalation", "Policy, authorization, and source-conflict escalation are required.", "reliability.escalation"))
    if not REQUIRED_REVIEW_STRATA.issubset(set(value.get("human_review", []))):
        findings.append(issue("context-management-reliability", "incomplete_human_review", "Review must cover high impact, partial or conflicting, and random samples.", "reliability.human_review"))
    return findings


def validate_handoff(value: Any) -> list[dict[str, str]]:
    required = ("decision_owner", "implementation_owner", "evidence", "residual_risks", "fallback", "change_triggers")
    if not isinstance(value, dict):
        return [issue("handoff", "invalid_handoff", "Handoff must be an object.", "handoff")]
    missing = [field for field in required if not value.get(field)]
    if not missing:
        return []
    return [issue("handoff", "incomplete_handoff", f"Handoff is missing: {', '.join(missing)}.", "handoff")]


def evaluate_packet(packet: Any) -> dict[str, Any]:
    """Validate all five architecture domains and the implementation handoff."""
    if not isinstance(packet, dict):
        findings = [issue("packet", "invalid_packet", "Packet must be an object.", "packet")]
        return {"status": "blocked", "findings": findings, "metrics": {"errors": 1, "domains": 0}}

    findings: list[dict[str, str]] = []
    for section in sorted(REQUIRED_SECTIONS - set(packet)):
        findings.append(issue("packet", "missing_section", f"Missing section: {section}.", section))

    findings.extend(validate_scenario(packet.get("scenario")))
    tool_findings, tool_names = validate_tools(packet.get("tools"))
    findings.extend(tool_findings)
    findings.extend(validate_orchestration(packet.get("orchestration"), tool_names))
    findings.extend(validate_claude_code(packet.get("claude_code")))
    findings.extend(validate_structured_output(packet.get("structured_output")))
    findings.extend(validate_reliability(packet.get("reliability")))
    findings.extend(validate_handoff(packet.get("handoff")))

    domains = {finding["domain"] for finding in findings}
    return {
        "status": "blocked" if findings else "ready_for_architecture_review",
        "findings": findings,
        "metrics": {"errors": len(findings), "domains_with_findings": len(domains)},
    }


def build_demo_packet() -> dict[str, Any]:
    """Return an original passing support-resolution architecture packet."""
    error_contract = ["category", "retryable", "partial_result", "trace_id"]
    return {
        "scenario": {
            "id": "cedar-bridge-resolution-v1",
            "context": "customer-support-resolution",
            "decision": "Recommend a policy-supported resolution for human approval.",
            "consequence": "high",
            "human_authority": "support-duty-manager",
        },
        "orchestration": {
            "tasks": [
                {"id": "intake", "prerequisites": [], "allowed_tools": ["read_case"]},
                {"id": "policy", "prerequisites": ["intake"], "allowed_tools": ["read_active_policy"]},
                {"id": "draft", "prerequisites": ["policy"], "allowed_tools": ["read_case"]},
                {"id": "review", "prerequisites": ["draft"], "allowed_tools": ["read_case", "read_active_policy"]},
            ],
            "result_states": ["complete", "partial", "blocked"],
            "reviewer_context": "isolated",
            "resume_policy": "revalidate_external_state",
        },
        "tools": [
            {
                "name": "read_case",
                "description": "Read one authorized support case and its versioned evidence.",
                "when_use": "Use for facts about the active case.",
                "when_not_use": "Do not use for policy or public research.",
                "auth_scope": "support:case:read",
                "side_effect": "none",
                "input_schema": {
                    "type": "object",
                    "properties": {"case_id": {"type": "string"}},
                    "required": ["case_id"],
                    "additionalProperties": False,
                },
                "error_contract": error_contract,
            },
            {
                "name": "read_active_policy",
                "description": "Read approved active support policy for the case region.",
                "when_use": "Use for governing resolution rules.",
                "when_not_use": "Do not use for customer-account facts or execution.",
                "auth_scope": "support:policy:read",
                "side_effect": "none",
                "input_schema": {
                    "type": "object",
                    "properties": {"region": {"type": "string"}},
                    "required": ["region"],
                    "additionalProperties": False,
                },
                "error_contract": error_contract,
            },
        ],
        "claude_code": {
            "project_guidance": "CLAUDE.md",
            "path_rules": ["src/support/**", "tests/support/**"],
            "ci": {
                "fresh_checkout": True,
                "structured_findings": True,
                "deterministic_tests": True,
                "read_only_review": True,
            },
        },
        "structured_output": {
            "schema_version": "resolution-candidate-1.0",
            "unknown_state": True,
            "validation_layers": ["syntax", "schema", "semantic", "provenance"],
            "retry_limit": 2,
            "independent_reviewer": True,
        },
        "reliability": {
            "manifest": True,
            "fact_placement": "Hard constraints first; current decision after focused evidence.",
            "provenance_fields": ["source_id", "source_version", "effective_date", "content_type", "location"],
            "partial_states": ["complete", "partial", "blocked"],
            "escalation": ["policy_gap", "authorization_gap", "source_conflict"],
            "human_review": ["high_impact", "partial_or_conflicting", "random_sample"],
        },
        "handoff": {
            "decision_owner": "support-duty-manager",
            "implementation_owner": "support-platform-team",
            "evidence": ["architecture-validator", "scenario-evaluations", "policy-approval"],
            "residual_risks": ["unseen policy phrasing"],
            "fallback": "Use the existing manual resolution process.",
            "change_triggers": ["policy-version", "tool-contract", "model-or-runtime"],
        },
    }


def load_packet(path: Path | None) -> dict[str, Any]:
    if path is None:
        return copy.deepcopy(build_demo_packet())
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a CCAR-F architecture scenario packet.")
    parser.add_argument("--input", type=Path, help="Optional packet JSON. Uses a passing example by default.")
    args = parser.parse_args()
    result = evaluate_packet(load_packet(args.input))
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["status"] == "ready_for_architecture_review" else 1


if __name__ == "__main__":
    raise SystemExit(main())
