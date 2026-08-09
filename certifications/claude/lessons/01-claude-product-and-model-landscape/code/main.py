"""Companion code for:
certifications/claude/lessons/01-claude-product-and-model-landscape/docs/en.md
It validates surface, model, and deployment decisions plus their dated evidence.
All measurements come from a local filled scenario rather than provider calls.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any


DEPLOYMENT_PATHS = {
    "claude-enterprise-direct",
    "amazon-bedrock",
    "google-vertex-ai",
    "microsoft-foundry",
}
DEPLOYMENT_CRITERIA = {
    "cloudCommitment",
    "procurement",
    "dataBoundary",
    "identity",
    "seatsBudgets",
    "operationalControl",
}
OFFICIAL_DOC_PREFIXES = (
    "https://platform.claude.com/docs/",
    "https://support.claude.com/",
    "https://claude.com/docs/",
)


def validate_record(record: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not _iso_date(record.get("verifiedOn")):
        errors.append("verifiedOn must be an ISO date")
    if not isinstance(record.get("humanOwner"), str) or not record["humanOwner"].strip():
        errors.append("humanOwner is required")
    requirements = record.get("requirements")
    needed = {"recurrence", "publicFreshnessDays", "internalSource", "sensitivity", "output", "collaboration", "consequence"}
    if not isinstance(requirements, dict) or needed - set(requirements):
        errors.append("requirements are incomplete")
    surfaces = record.get("surfaceCandidates")
    if not isinstance(surfaces, list) or len(surfaces) < 2:
        errors.append("at least two surface candidates are required")
    else:
        ids = [item.get("id") for item in surfaces if isinstance(item, dict)]
        if len(ids) != len(set(ids)):
            errors.append("surface candidate ids must be unique")
        passing = [item for item in surfaces if isinstance(item, dict) and item.get("meetsConstraints") is True]
        if not passing:
            errors.append("at least one surface must meet constraints")
        elif record.get("selectedSurface") != min(passing, key=lambda item: item.get("complexity", 999))["id"]:
            errors.append("selectedSurface must be the smallest passing surface")
        if not any(item.get("meetsConstraints") is False and str(item.get("reason", "")).strip() for item in surfaces):
            errors.append("a rejected alternative with a reason is required")
    benchmark = record.get("modelBenchmark")
    gate = record.get("modelGate")
    if not isinstance(benchmark, list) or len(benchmark) < 2 or not isinstance(gate, dict):
        errors.append("model benchmark and gate are required")
    else:
        passing_models = [item for item in benchmark if _passes_model_gate(item, gate)]
        if not passing_models:
            errors.append("no model clears the gate")
        elif record.get("selectedModel") != min(passing_models, key=lambda item: item.get("costUnits", 999))["id"]:
            errors.append("selectedModel must be the least costly passing model")
    sources = record.get("officialSources")
    if not isinstance(sources, list) or len(sources) < 2 or not all(isinstance(source, str) and source.startswith("https://") for source in sources):
        errors.append("at least two HTTPS officialSources are required")
    matrix = record.get("deploymentMatrix")
    candidates = matrix.get("candidates") if isinstance(matrix, dict) else None
    candidate_ids = {
        candidate.get("id") for candidate in candidates or [] if isinstance(candidate, dict)
    }
    if not isinstance(candidates, list) or candidate_ids != DEPLOYMENT_PATHS or len(candidates) != 4:
        errors.append("deploymentMatrix must compare all four deployment paths")
    else:
        errors.extend(_validate_deployment_matrix(matrix, record.get("deploymentADR"), record.get("officialEvidence")))
    return errors


def recommend(record: dict[str, Any]) -> dict[str, str]:
    errors = validate_record(record)
    if errors:
        raise ValueError("; ".join(errors))
    return {
        "surface": record["selectedSurface"],
        "model": record["selectedModel"],
        "deployment": record["deploymentADR"]["selectedPath"],
        "owner": record["humanOwner"],
    }


def _passes_model_gate(candidate: Any, gate: dict[str, Any]) -> bool:
    return (
        isinstance(candidate, dict)
        and candidate.get("coverage", 0) >= gate.get("minimumCoverage", 1)
        and candidate.get("unsupportedClaims", 1) <= gate.get("maximumUnsupportedClaims", 0)
        and candidate.get("latencySeconds", float("inf")) <= gate.get("maximumLatencySeconds", 0)
    )


def _validate_deployment_matrix(matrix: dict[str, Any], adr: Any, evidence: Any) -> list[str]:
    errors: list[str] = []
    scenario = matrix.get("scenario")
    weights = matrix.get("weights")
    if not isinstance(scenario, dict) or not all(str(scenario.get(key, "")).strip() for key in {"workload"} | DEPLOYMENT_CRITERIA):
        errors.append("deployment scenario must state the workload and all decision criteria")
    if (
        not isinstance(weights, dict)
        or set(weights) != DEPLOYMENT_CRITERIA
        or not all(_valid_score(value) for value in weights.values())
    ):
        errors.append("deployment weights must score every criterion from 1 to 5")
        return errors

    scores: dict[str, int] = {}
    candidate_evidence: dict[str, set[str]] = {}
    for candidate in matrix["candidates"]:
        candidate_id = candidate["id"]
        ratings = candidate.get("ratings")
        if not isinstance(ratings, dict) or set(ratings) != DEPLOYMENT_CRITERIA:
            errors.append(f"{candidate_id} must rate every deployment criterion")
            continue
        if not all(
            isinstance(rating, dict)
            and _valid_score(rating.get("score"))
            and str(rating.get("reason", "")).strip()
            for rating in ratings.values()
        ):
            errors.append(f"{candidate_id} ratings need scores from 1 to 5 and reasons")
            continue
        expected = sum(weights[key] * ratings[key]["score"] for key in DEPLOYMENT_CRITERIA)
        if candidate.get("weightedScore") != expected:
            errors.append(f"{candidate_id} weightedScore must reconcile")
        scores[candidate_id] = expected
        evidence_ids = candidate.get("evidenceIds")
        if not isinstance(evidence_ids, list) or not evidence_ids or len(evidence_ids) != len(set(evidence_ids)):
            errors.append(f"{candidate_id} needs unique official evidence")
        else:
            candidate_evidence[candidate_id] = set(evidence_ids)

    selected = adr.get("selectedPath") if isinstance(adr, dict) else None
    if not scores or selected not in scores or scores[selected] != max(scores.values()):
        errors.append("deploymentADR selectedPath must have the highest weighted fit")
    if (
        not isinstance(adr, dict)
        or adr.get("status") != "accepted"
        or not str(adr.get("decision", "")).strip()
        or not _nonempty_strings(adr.get("rejectedAlternatives"))
        or not _nonempty_strings(adr.get("consequences"))
        or not _nonempty_strings(adr.get("reviewTriggers"))
    ):
        errors.append("deploymentADR needs an accepted decision, alternatives, consequences, and review triggers")

    evidence_by_id: dict[str, dict[str, Any]] = {}
    if not isinstance(evidence, list):
        errors.append("officialEvidence is required for deployment claims")
        return errors
    for item in evidence:
        if not isinstance(item, dict) or not str(item.get("id", "")).strip():
            errors.append("officialEvidence entries need ids")
            continue
        evidence_by_id[item["id"]] = item
        if (
            item.get("path") not in DEPLOYMENT_PATHS
            or not _iso_date(item.get("verifiedOn"))
            or not str(item.get("claim", "")).strip()
            or not _official_doc_url(item.get("sourceUrl"))
        ):
            errors.append(f"officialEvidence {item['id']} must be dated and sourced to official Claude docs")
    if len(evidence_by_id) != len(evidence):
        errors.append("officialEvidence ids must be unique")
    for candidate_id, evidence_ids in candidate_evidence.items():
        if any(
            evidence_id not in evidence_by_id or evidence_by_id[evidence_id].get("path") != candidate_id
            for evidence_id in evidence_ids
        ):
            errors.append(f"{candidate_id} references missing or mismatched official evidence")
    return errors


def _valid_score(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= 5


def _official_doc_url(value: Any) -> bool:
    return isinstance(value, str) and value.startswith(OFFICIAL_DOC_PREFIXES)


def _nonempty_strings(value: Any) -> bool:
    return isinstance(value, list) and bool(value) and all(isinstance(item, str) and item.strip() for item in value)


def _iso_date(value: Any) -> bool:
    try:
        date.fromisoformat(value)
        return isinstance(value, str)
    except (TypeError, ValueError):
        return False


def load_record(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("record root must be an object")
    return value


if __name__ == "__main__":
    path = Path(__file__).parents[1] / "outputs" / "product-selection-record.json"
    record = load_record(path)
    print(json.dumps({"valid": not validate_record(record), "recommendation": recommend(record)}, indent=2))
