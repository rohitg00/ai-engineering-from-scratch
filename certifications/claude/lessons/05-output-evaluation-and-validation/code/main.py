"""Companion code for:
certifications/claude/lessons/05-output-evaluation-and-validation/docs/en.md
It validates claim provenance, evaluator fit, and release-gate consistency.
The local packet contains one intentional blocker to exercise revision logic.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any


CAPABILITY_PROPERTIES = {
    "next-token-prediction",
    "knowledge",
    "working-memory",
    "steerability",
}
HUMAN_COMPETENCIES = {"delegation", "description", "discernment", "diligence"}


def validate_record(record: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    sources = record.get("sources")
    source_ids = {source.get("id") for source in sources if isinstance(source, dict)} if isinstance(sources, list) else set()
    if not sources or len(source_ids) != len(sources):
        errors.append("sources need unique ids")
    claims = record.get("claims")
    if not isinstance(claims, list) or not claims:
        return errors + ["claims must be non-empty"]
    claim_ids: set[str] = set()
    for index, claim in enumerate(claims):
        if not isinstance(claim, dict):
            errors.append(f"claims[{index}] must be an object")
            continue
        identifier = claim.get("id")
        if not isinstance(identifier, str) or identifier in claim_ids:
            errors.append(f"claims[{index}] id is invalid or duplicated")
        claim_ids.add(str(identifier))
        referenced = claim.get("sourceIds")
        if not isinstance(referenced, list) or not referenced or not set(referenced) <= source_ids:
            errors.append(f"claims[{index}] has unresolved sourceIds")
        if claim.get("severity") not in {"blocker", "required", "quality"}:
            errors.append(f"claims[{index}] has invalid severity")
        if claim.get("result") not in {"pass", "fail"}:
            errors.append(f"claims[{index}] has invalid result")
    diagnostic = record.get("capabilityDiagnostic")
    if not isinstance(diagnostic, dict):
        errors.append("capabilityDiagnostic must be an object")
    else:
        properties = diagnostic.get("properties")
        if not isinstance(properties, list):
            errors.append("capabilityDiagnostic properties must be a list")
        else:
            property_ids = {
                item.get("id") for item in properties if isinstance(item, dict)
            }
            if property_ids != CAPABILITY_PROPERTIES or len(properties) != len(CAPABILITY_PROPERTIES):
                errors.append("capabilityDiagnostic must cover all four capability properties exactly once")
            for index, item in enumerate(properties):
                if not isinstance(item, dict):
                    errors.append(f"capabilityDiagnostic properties[{index}] must be an object")
                    continue
                if not str(item.get("evidence", "")).strip():
                    errors.append(f"capabilityDiagnostic properties[{index}] needs evidence")
                if not str(item.get("targetedFix", "")).strip():
                    errors.append(f"capabilityDiagnostic properties[{index}] needs a targetedFix")
        if diagnostic.get("primaryProperty") not in CAPABILITY_PROPERTIES:
            errors.append("capabilityDiagnostic primaryProperty is invalid")
        if diagnostic.get("humanCompetency") not in HUMAN_COMPETENCIES:
            errors.append("capabilityDiagnostic humanCompetency is invalid")
    evaluators = record.get("evaluatorAssignments")
    if not isinstance(evaluators, dict) or evaluators.get("schema") != "deterministic" or evaluators.get("totals") != "deterministic":
        errors.append("schema and totals must use deterministic evaluators")
    release = record.get("release")
    blocker_failures = sum(claim.get("severity") == "blocker" and claim.get("result") == "fail" for claim in claims if isinstance(claim, dict))
    required_failures = sum(claim.get("severity") == "required" and claim.get("result") == "fail" for claim in claims if isinstance(claim, dict))
    if not isinstance(release, dict) or release.get("blockerFailures") != blocker_failures or release.get("requiredFailures") != required_failures:
        errors.append("release failure counts must match claims")
    elif blocker_failures and release.get("decision") != "revise":
        errors.append("blocker failure requires a revise decision")
    elif not str(release.get("nextAction", "")).strip():
        errors.append("release nextAction is required")
    if not isinstance(record.get("uncertainties"), list):
        errors.append("uncertainties must be a list")
    return errors


def summarize(record: dict[str, Any]) -> dict[str, Any]:
    errors = validate_record(record)
    if errors:
        raise ValueError("; ".join(errors))
    results = Counter(claim["result"] for claim in record["claims"])
    return {"claims": len(record["claims"]), "results": dict(results), "decision": record["release"]["decision"], "failedClaimIds": [claim["id"] for claim in record["claims"] if claim["result"] == "fail"]}


def load_record(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("record root must be an object")
    return value


if __name__ == "__main__":
    path = Path(__file__).parents[1] / "outputs" / "claim-validation-record.json"
    record = load_record(path)
    print(json.dumps({"valid": not validate_record(record), "summary": summarize(record)}, indent=2))
