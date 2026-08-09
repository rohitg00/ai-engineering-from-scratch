"""Companion code for:
certifications/claude/lessons/00-certification-strategy/docs/en.md
It validates a readiness packet and ranks domains by weighted weakness.
It uses only local JSON and never reconstructs confidential exam content.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


CONFIDENCE_MULTIPLIER = {"unseen": 1.5, "understood": 1.25, "practiced": 1.0, "timed": 0.8}
REQUIRED_DOMAIN_FIELDS = {"id", "weight", "allocatedHours", "confidence", "decisions", "artifact", "failureMode"}
REQUIRED_STAGES = {"orient", "build", "transfer", "simulate"}
REQUIRED_ERROR_TYPES = {
    "recall-gap",
    "stale-fact",
    "missed-constraint",
    "sequence-error",
    "surface-confusion",
    "evidence-failure",
    "overengineering",
}


def validate_plan(plan: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    guide = plan.get("guide")
    if not isinstance(guide, dict):
        errors.append("guide must be an object")
    else:
        if not str(guide.get("officialSource", "")).startswith("https://"):
            errors.append("guide officialSource must be HTTPS")
        if not _iso_date(guide.get("verifiedOn")):
            errors.append("guide verifiedOn must be an ISO date")
    domains = plan.get("domains")
    if not isinstance(domains, list) or len(domains) != 7:
        return errors + ["domains must contain exactly seven entries"]
    identifiers: set[str] = set()
    for index, domain in enumerate(domains):
        if not isinstance(domain, dict):
            errors.append(f"domains[{index}] must be an object")
            continue
        missing = REQUIRED_DOMAIN_FIELDS - set(domain)
        if missing:
            errors.append(f"domains[{index}] missing {', '.join(sorted(missing))}")
        identifier = domain.get("id")
        if not isinstance(identifier, str) or not identifier:
            errors.append(f"domains[{index}].id must be non-empty")
        elif identifier in identifiers:
            errors.append(f"duplicate domain id: {identifier}")
        identifiers.add(str(identifier))
        if domain.get("confidence") not in CONFIDENCE_MULTIPLIER:
            errors.append(f"domains[{index}].confidence is invalid")
        if not isinstance(domain.get("decisions"), list) or len(domain["decisions"]) < 2:
            errors.append(f"domains[{index}] needs at least two decisions")
        for field in ("artifact", "failureMode"):
            if not isinstance(domain.get(field), str) or not domain[field].strip():
                errors.append(f"domains[{index}].{field} must be non-empty")
    if round(sum(_number(item.get("weight")) for item in domains), 6) != 100:
        errors.append("domain weights must total 100")
    allocated = sum(_number(item.get("allocatedHours")) for item in domains)
    if round(allocated, 6) != round(_number(plan.get("totalHours")), 6):
        errors.append("allocated hours must equal totalHours")
    protocol = plan.get("practiceProtocol")
    if not isinstance(protocol, dict):
        errors.append("practiceProtocol must be an object")
    else:
        stages = protocol.get("stages")
        if not isinstance(stages, list):
            errors.append("practiceProtocol stages must be a list")
        else:
            stage_ids = {item.get("id") for item in stages if isinstance(item, dict)}
            if len(stages) != len(REQUIRED_STAGES) or stage_ids != REQUIRED_STAGES:
                errors.append("practiceProtocol must include orient, build, transfer, and simulate exactly once")
            if any(not str(item.get("exitEvidence", "")).strip() for item in stages if isinstance(item, dict)):
                errors.append("every practice stage needs exitEvidence")
        error_types = protocol.get("errorTaxonomy")
        if not isinstance(error_types, list) or set(error_types) != REQUIRED_ERROR_TYPES:
            errors.append("practiceProtocol errorTaxonomy is incomplete")
    return errors


def rank_domains(plan: dict[str, Any]) -> list[str]:
    errors = validate_plan(plan)
    if errors:
        raise ValueError("; ".join(errors))
    ranked = sorted(
        plan["domains"],
        key=lambda domain: domain["weight"] * CONFIDENCE_MULTIPLIER[domain["confidence"]],
        reverse=True,
    )
    return [domain["id"] for domain in ranked]


def build_report(plan: dict[str, Any]) -> dict[str, Any]:
    errors = validate_plan(plan)
    return {
        "valid": not errors,
        "errors": errors,
        "totalHours": plan.get("totalHours"),
        "studyOrder": rank_domains(plan) if not errors else [],
    }


def _number(value: Any) -> float:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0.0


def _iso_date(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return bool(__import__("datetime").date.fromisoformat(value))
    except ValueError:
        return False


def load_plan(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("plan root must be an object")
    return value


if __name__ == "__main__":
    artifact = Path(__file__).parents[1] / "outputs" / "readiness-plan.json"
    print(json.dumps(build_report(load_plan(artifact)), indent=2))
