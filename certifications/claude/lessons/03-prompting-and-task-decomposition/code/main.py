"""Companion code for:
certifications/claude/lessons/03-prompting-and-task-decomposition/docs/en.md
It validates a prompt contract, stage gates, and adversarial case coverage.
The runner evaluates structure and evidence boundaries without a provider call.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


CONTRACT_FIELDS = {"outcome", "context", "task", "evidence", "constraints", "format", "acceptanceChecks"}
CASE_TYPES = {"normal", "missing-source", "conflict", "injection", "unauthorized"}


def validate_packet(packet: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    contract = packet.get("contract")
    if not isinstance(contract, dict) or CONTRACT_FIELDS - set(contract):
        errors.append("contract must contain all seven prompt-contract fields")
    else:
        for field in CONTRACT_FIELDS - {"acceptanceChecks"}:
            if not isinstance(contract.get(field), str) or len(contract[field].strip()) < 12:
                errors.append(f"contract.{field} must be concrete")
        checks = contract.get("acceptanceChecks")
        if not isinstance(checks, list) or len(checks) < 4 or not all(isinstance(item, str) and len(item.strip()) >= 12 for item in checks):
            errors.append("acceptanceChecks need at least four observable checks")
    hierarchy = packet.get("sourceHierarchy")
    if not isinstance(hierarchy, list) or len(hierarchy) < 2:
        errors.append("sourceHierarchy needs at least two sources")
    else:
        ranks = [item.get("rank") for item in hierarchy if isinstance(item, dict)]
        if ranks != list(range(1, len(hierarchy) + 1)):
            errors.append("sourceHierarchy ranks must be consecutive")
    stages = packet.get("stages")
    if not isinstance(stages, list) or len(stages) < 3:
        errors.append("at least three stages are required")
    else:
        for index, stage in enumerate(stages):
            if not isinstance(stage, dict) or any(not str(stage.get(field, "")).strip() for field in ("id", "input", "output", "gate")):
                errors.append(f"stages[{index}] needs id, input, output, and gate")
    if not isinstance(packet.get("uncertaintyBehavior"), str) or "not" not in packet["uncertaintyBehavior"].lower():
        errors.append("uncertaintyBehavior must define explicit abstention")
    cases = packet.get("evaluationCases")
    if not isinstance(cases, list):
        errors.append("evaluationCases must be a list")
    else:
        observed = {item.get("type") for item in cases if isinstance(item, dict)}
        if observed != CASE_TYPES:
            errors.append("evaluationCases must cover normal, missing-source, conflict, injection, and unauthorized")
        if any(not str(item.get("expected", "")).strip() for item in cases if isinstance(item, dict)):
            errors.append("every evaluation case needs an expected behavior")
    return errors


def score_packet(packet: dict[str, Any]) -> dict[str, Any]:
    errors = validate_packet(packet)
    return {
        "passed": not errors,
        "errors": errors,
        "contractFields": len(set(packet.get("contract", {})) & CONTRACT_FIELDS) if isinstance(packet.get("contract"), dict) else 0,
        "caseCoverage": sorted({case.get("type") for case in packet.get("evaluationCases", []) if isinstance(case, dict)}),
        "stageCount": len(packet.get("stages", [])) if isinstance(packet.get("stages"), list) else 0,
    }


def load_packet(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("packet root must be an object")
    return value


if __name__ == "__main__":
    path = Path(__file__).parents[1] / "outputs" / "prompt-contract-packet.json"
    print(json.dumps(score_packet(load_packet(path)), indent=2))
