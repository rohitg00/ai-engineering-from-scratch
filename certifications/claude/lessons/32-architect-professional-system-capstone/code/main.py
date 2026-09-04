"""Architecture readiness gate for this capstone's docs/en.md.

Validates requirements, decisions, controls, evaluations, owners, and rollback.
Hard controls must be verified; a high average score cannot hide their failure.
Uses only the Python standard library and an inspectable architecture packet.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Requirement:
    requirement_id: str
    category: str
    statement: str
    measurable: bool
    owner: str


@dataclass(frozen=True)
class Decision:
    decision_id: str
    context: str
    selected_option: str
    rejected_options: tuple[str, ...]
    consequence: str
    reversal_condition: str
    owner: str


@dataclass(frozen=True)
class Control:
    control_id: str
    risk: str
    kind: str
    owner: str
    evidence: str
    verified: bool
    hard_gate: bool = False


@dataclass(frozen=True)
class EvaluationGate:
    metric: str
    observed: float
    operator: str
    threshold: float
    segment: str = "all"

    def passes(self) -> bool:
        operations = {
            ">=": lambda value, target: value >= target,
            "<=": lambda value, target: value <= target,
            "==": lambda value, target: value == target,
        }
        if self.operator not in operations:
            raise ValueError(f"unknown operator: {self.operator}")
        return operations[self.operator](self.observed, self.threshold)


@dataclass(frozen=True)
class ArchitecturePacket:
    outcome: str
    non_goals: tuple[str, ...]
    requirements: tuple[Requirement, ...]
    decisions: tuple[Decision, ...]
    controls: tuple[Control, ...]
    evaluation_gates: tuple[EvaluationGate, ...]
    rollback_runbook: str
    operating_owner: str


@dataclass(frozen=True)
class Finding:
    category: str
    message: str
    blocking: bool


def validate_packet(packet: ArchitecturePacket) -> list[Finding]:
    findings = []
    if not packet.outcome.strip():
        findings.append(Finding("discovery", "measurable outcome is missing", True))
    if not packet.non_goals:
        findings.append(Finding("scope", "non-goals are missing", False))
    if not packet.requirements:
        findings.append(Finding("requirements", "requirements are missing", True))
    for requirement in packet.requirements:
        if not requirement.owner.strip():
            findings.append(Finding("ownership", f"{requirement.requirement_id} has no owner", True))
        if not requirement.measurable:
            findings.append(Finding("requirements", f"{requirement.requirement_id} is not measurable", True))
    if not packet.decisions:
        findings.append(Finding("architecture", "architecture decisions are missing", True))
    for decision in packet.decisions:
        if not decision.rejected_options:
            findings.append(Finding("architecture", f"{decision.decision_id} has no rejected alternative", False))
        if not decision.reversal_condition.strip():
            findings.append(Finding("architecture", f"{decision.decision_id} has no reversal condition", True))
    if not packet.controls:
        findings.append(Finding("governance", "controls are missing", True))
    for control in packet.controls:
        if not control.owner.strip() or not control.evidence.strip():
            findings.append(Finding("governance", f"{control.control_id} lacks owner or evidence", True))
        if control.hard_gate and not control.verified:
            findings.append(Finding("governance", f"hard control {control.control_id} is unverified", True))
    if not packet.evaluation_gates:
        findings.append(Finding("evaluation", "evaluation gates are missing", True))
    for gate in packet.evaluation_gates:
        if not gate.passes():
            findings.append(Finding("evaluation", f"{gate.metric} failed for segment {gate.segment}", True))
    if not packet.rollback_runbook.strip():
        findings.append(Finding("operations", "rollback runbook is missing", True))
    if not packet.operating_owner.strip():
        findings.append(Finding("ownership", "operating owner is missing", True))
    return findings


def release_decision(packet: ArchitecturePacket) -> dict[str, object]:
    findings = validate_packet(packet)
    blocking = [finding for finding in findings if finding.blocking]
    return {
        "ready": not blocking,
        "blocking_count": len(blocking),
        "findings": [asdict(finding) for finding in findings],
    }


def example_packet() -> ArchitecturePacket:
    return ArchitecturePacket(
        outcome="Reduce policy-correct first-response time from 11 minutes to under 3 minutes",
        non_goals=("No automatic refunds", "No account deletion", "English pilot only"),
        requirements=(
            Requirement("quality-1", "quality", "At least 98 percent policy-supported drafts", True, "support-quality"),
            Requirement("latency-1", "performance", "P95 under 8 seconds", True, "platform-sre"),
        ),
        decisions=(
            Decision(
                "adr-1",
                "Known workflow with bounded retrieval and draft generation",
                "deterministic workflow",
                ("single prompt", "adaptive refund agent"),
                "New policy index and review queue require owners",
                "Reconsider if over 20 percent of tickets require unmodeled branches",
                "principal-architect",
            ),
        ),
        controls=(
            Control("auth-1", "unauthorized account access", "preventive", "identity-team", "scope test run 42", True, True),
            Control("fresh-1", "stale policy", "detective", "policy-ops", "freshness dashboard", True, True),
        ),
        evaluation_gates=(
            EvaluationGate("policy_support", 0.985, ">=", 0.98),
            EvaluationGate("p95_latency_ms", 7200, "<=", 8000),
            EvaluationGate("unsafe_action_count", 0, "==", 0, "high-risk"),
        ),
        rollback_runbook="Disable candidate route, restore known-safe prompt and index, replay failed cases",
        operating_owner="support-platform",
    )


if __name__ == "__main__":
    print(json.dumps(release_decision(example_packet()), indent=2))
