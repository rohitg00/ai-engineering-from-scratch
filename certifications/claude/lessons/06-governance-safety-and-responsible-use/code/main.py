"""Companion code for:
certifications/claude/lessons/06-governance-safety-and-responsible-use/docs/en.md
It scores governance controls and computes a deterministic review threshold.
Confidence never overrides consequence, authority, or reversibility in the runner.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def review_required(consequence: str, reversible: bool, ambiguity: str = "low") -> bool:
    if consequence not in {"low", "medium", "high"} or ambiguity not in {"low", "medium", "high"}:
        raise ValueError("unknown risk classification")
    return consequence == "high" or not reversible or ambiguity == "high"


def validate_control_map(packet: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for field in ("useCaseId", "approvedPurpose", "affectedPeople", "retentionRule", "incidentOwner"):
        if not isinstance(packet.get(field), str) or not packet[field].strip():
            errors.append(f"{field} is required")
    if packet.get("automationMode") not in {"assist", "bounded-automation", "redesign", "reject"}:
        errors.append("automationMode is invalid")
    if not isinstance(packet.get("dataClasses"), list) or not packet["dataClasses"]:
        errors.append("dataClasses are required")
    if not isinstance(packet.get("prohibitedActions"), list) or not packet["prohibitedActions"]:
        errors.append("prohibitedActions are required")
    confidence = packet.get("analysisConfidence")
    if not isinstance(confidence, (int, float)) or isinstance(confidence, bool) or not 0 <= confidence <= 1:
        errors.append("analysisConfidence must be between zero and one")
    risks = packet.get("risks")
    if not isinstance(risks, list) or len(risks) < 3:
        errors.append("at least three risks are required")
    else:
        ids: set[str] = set()
        for index, risk in enumerate(risks):
            if not isinstance(risk, dict) or any(not str(risk.get(field, "")).strip() for field in ("id", "prevent", "detect", "correct")):
                errors.append(f"risks[{index}] needs prevent, detect, and correct controls")
                continue
            if risk["id"] in ids:
                errors.append(f"duplicate risk id: {risk['id']}")
            ids.add(risk["id"])
    approval = packet.get("approvalPacket")
    needs_review = review_required(str(packet.get("consequence")), bool(packet.get("reversible"))) if packet.get("consequence") in {"low", "medium", "high"} else True
    if not isinstance(approval, dict):
        errors.append("approvalPacket is required")
    else:
        if needs_review and approval.get("humanGate") is not True:
            errors.append("risk requires an authorized humanGate")
        if not str(approval.get("authorizedRole", "")).strip():
            errors.append("approvalPacket needs an authorizedRole")
        if approval.get("untrustedContentCanAuthorize") is not False:
            errors.append("untrusted content cannot authorize action")
        for field in ("decision", "evidence", "uncertainty"):
            if not str(approval.get(field, "")).strip():
                errors.append(f"approvalPacket.{field} is required")
    return errors


def score_control_map(packet: dict[str, Any]) -> dict[str, Any]:
    errors = validate_control_map(packet)
    control_count = 3 * len(packet.get("risks", [])) if isinstance(packet.get("risks"), list) else 0
    return {"passed": not errors, "errors": errors, "controlCount": control_count, "reviewRequired": review_required(packet.get("consequence", "high"), bool(packet.get("reversible"))), "confidenceDoesNotAuthorize": True}


def load_packet(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("packet root must be an object")
    return value


if __name__ == "__main__":
    path = Path(__file__).parents[1] / "outputs" / "responsible-use-control-map.json"
    print(json.dumps(score_control_map(load_packet(path)), indent=2))
