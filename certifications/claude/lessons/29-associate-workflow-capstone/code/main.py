# Course lesson: certifications/claude/lessons/29-associate-workflow-capstone/docs/en.md
# Official source: Claude Certified Associate Foundations Exam Guide, effective July 2026.
# Guide URL: https://everpath-course-content.s3-accelerate.amazonaws.com/instructor%2F6nizmqk8tpzpfjvt6qmmav7rh%2Fpublic%2F1783542847%2FClaude+Certified+Associate+%E2%80%93+Foundations+Exam+Guide.pdf
# This standard-library exercise validates workflow evidence. It does not call Claude.

"""Deterministic validator for the Associate workflow capstone."""

from __future__ import annotations

import argparse
import copy
import json
from datetime import date, datetime
from pathlib import Path
from typing import Any


REQUIRED_SECTIONS = ("workflow", "sources", "claims", "governance", "handoff")
REQUIRED_SOURCE_FIELDS = (
    "id",
    "owner",
    "authority",
    "effective_date",
    "review_date",
    "sensitivity",
)
ALLOWED_SENSITIVITY = {"public", "internal", "confidential", "restricted"}
DIRECT_SUPPORT = {"direct", "calculated"}
BLOCKING_CODES = {
    "missing_section",
    "invalid_source",
    "duplicate_source",
    "unknown_source",
    "unsupported_consequential_claim",
    "unapproved_surface",
    "restricted_data_not_approved",
    "missing_decision_owner",
    "missing_handoff_field",
}


def finding(code: str, message: str, location: str, severity: str = "error") -> dict[str, str]:
    """Create one stable validation finding."""
    return {
        "code": code,
        "severity": severity,
        "location": location,
        "message": message,
    }


def parse_iso_date(value: Any) -> date | None:
    """Parse YYYY-MM-DD values without guessing other formats."""
    if not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def validate_sources(sources: Any, as_of: date) -> tuple[list[dict[str, str]], dict[str, dict[str, Any]]]:
    """Validate the source registry and return a source lookup."""
    findings: list[dict[str, str]] = []
    lookup: dict[str, dict[str, Any]] = {}
    if not isinstance(sources, list) or not sources:
        return [finding("invalid_source", "Sources must be a non-empty list.", "sources")], lookup

    for index, source in enumerate(sources):
        location = f"sources[{index}]"
        if not isinstance(source, dict):
            findings.append(finding("invalid_source", "Source must be an object.", location))
            continue

        missing = [field for field in REQUIRED_SOURCE_FIELDS if not source.get(field)]
        if missing:
            findings.append(
                finding(
                    "invalid_source",
                    f"Source is missing required fields: {', '.join(missing)}.",
                    location,
                )
            )
            continue

        source_id = str(source["id"])
        if source_id in lookup:
            findings.append(finding("duplicate_source", f"Duplicate source ID: {source_id}.", location))
            continue

        sensitivity = str(source["sensitivity"])
        if sensitivity not in ALLOWED_SENSITIVITY:
            findings.append(
                finding(
                    "invalid_source",
                    f"Unknown sensitivity class: {sensitivity}.",
                    location,
                )
            )
            continue

        effective = parse_iso_date(source["effective_date"])
        review = parse_iso_date(source["review_date"])
        if effective is None or review is None:
            findings.append(
                finding("invalid_source", "Source dates must use YYYY-MM-DD.", location)
            )
            continue

        if effective > as_of:
            findings.append(
                finding(
                    "source_not_effective",
                    f"Source {source_id} is not effective on {as_of.isoformat()}.",
                    location,
                    "warning",
                )
            )
        if review < as_of:
            findings.append(
                finding(
                    "stale_source",
                    f"Source {source_id} passed its review date.",
                    location,
                    "warning",
                )
            )
        lookup[source_id] = source

    return findings, lookup


def validate_claims(claims: Any, source_lookup: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    """Check claim-source integrity and support strength."""
    findings: list[dict[str, str]] = []
    if not isinstance(claims, list):
        return [finding("invalid_claims", "Claims must be a list.", "claims")]

    for index, claim in enumerate(claims):
        location = f"claims[{index}]"
        if not isinstance(claim, dict) or not claim.get("id") or not claim.get("text"):
            findings.append(finding("invalid_claim", "Claim requires id and text.", location))
            continue

        source_ids = claim.get("source_ids", [])
        if not isinstance(source_ids, list) or not source_ids:
            findings.append(finding("unknown_source", "Claim has no source IDs.", location))
            continue

        unknown = [source_id for source_id in source_ids if source_id not in source_lookup]
        if unknown:
            findings.append(
                finding(
                    "unknown_source",
                    f"Claim references unknown sources: {', '.join(unknown)}.",
                    location,
                )
            )

        consequential = bool(claim.get("consequential", False))
        support = claim.get("support")
        if consequential and support not in DIRECT_SUPPORT:
            findings.append(
                finding(
                    "unsupported_consequential_claim",
                    "Consequential claim requires direct or calculated support.",
                    location,
                )
            )
    return findings


def validate_governance(governance: Any) -> list[dict[str, str]]:
    """Check approval, data-class, and human-authority boundaries."""
    if not isinstance(governance, dict):
        return [finding("invalid_governance", "Governance must be an object.", "governance")]

    findings: list[dict[str, str]] = []
    if governance.get("approved_surface") is not True:
        findings.append(
            finding("unapproved_surface", "The selected surface is not explicitly approved.", "governance")
        )

    data_class = governance.get("data_class")
    if data_class not in ALLOWED_SENSITIVITY:
        findings.append(
            finding("invalid_governance", "Governance has an unknown data class.", "governance")
        )
    if data_class == "restricted" and governance.get("restricted_processing_approved") is not True:
        findings.append(
            finding(
                "restricted_data_not_approved",
                "Restricted data requires an explicit approved processing path.",
                "governance",
            )
        )

    high_consequence = governance.get("consequence") == "high"
    irreversible = governance.get("reversible") is False
    if (high_consequence or irreversible) and not governance.get("decision_owner"):
        findings.append(
            finding(
                "missing_decision_owner",
                "High-consequence or irreversible work requires an authorized decision owner.",
                "governance",
            )
        )
    return findings


def validate_handoff(handoff: Any) -> list[dict[str, str]]:
    """Ensure a reviewer can decide and recover without rediscovery."""
    required = ("decision", "deadline", "next_owner", "fallback", "source_snapshot")
    if not isinstance(handoff, dict):
        return [finding("missing_handoff_field", "Handoff must be an object.", "handoff")]
    missing = [field for field in required if not handoff.get(field)]
    if not missing:
        return []
    return [
        finding(
            "missing_handoff_field",
            f"Handoff is missing required fields: {', '.join(missing)}.",
            "handoff",
        )
    ]


def evaluate_packet(packet: Any, as_of: date | None = None) -> dict[str, Any]:
    """Evaluate a complete packet and return a release recommendation."""
    check_date = as_of or date.today()
    if not isinstance(packet, dict):
        return {
            "status": "blocked",
            "as_of": check_date.isoformat(),
            "findings": [finding("missing_section", "Packet must be an object.", "packet")],
            "metrics": {"sources": 0, "claims": 0, "errors": 1, "warnings": 0},
        }

    findings: list[dict[str, str]] = []
    missing_sections = [section for section in REQUIRED_SECTIONS if section not in packet]
    for section in missing_sections:
        findings.append(finding("missing_section", f"Missing required section: {section}.", section))

    source_findings, source_lookup = validate_sources(packet.get("sources"), check_date)
    findings.extend(source_findings)
    findings.extend(validate_claims(packet.get("claims"), source_lookup))
    findings.extend(validate_governance(packet.get("governance")))
    findings.extend(validate_handoff(packet.get("handoff")))

    errors = [item for item in findings if item["severity"] == "error"]
    warnings = [item for item in findings if item["severity"] == "warning"]
    blocking = any(item["code"] in BLOCKING_CODES for item in errors)
    status = "blocked" if blocking or errors else "needs_revision" if warnings else "ready_for_human_review"

    return {
        "status": status,
        "as_of": check_date.isoformat(),
        "findings": findings,
        "metrics": {
            "sources": len(packet.get("sources", [])) if isinstance(packet.get("sources"), list) else 0,
            "claims": len(packet.get("claims", [])) if isinstance(packet.get("claims"), list) else 0,
            "errors": len(errors),
            "warnings": len(warnings),
        },
    }


def build_demo_packet() -> dict[str, Any]:
    """Return a small passing packet for learning and local verification."""
    return {
        "workflow": {
            "id": "northstar-weekly-brief",
            "version": "1.0",
            "source_cutoff": "2026-08-07T15:00:00Z",
        },
        "sources": [
            {
                "id": "regional-snapshot-w32",
                "owner": "operations-analytics",
                "authority": "approved-snapshot",
                "effective_date": "2026-08-07",
                "review_date": "2026-08-14",
                "sensitivity": "internal",
            },
            {
                "id": "service-policy-2026-07",
                "owner": "service-governance",
                "authority": "approved-policy",
                "effective_date": "2026-07-01",
                "review_date": "2026-10-01",
                "sensitivity": "internal",
            },
        ],
        "claims": [
            {
                "id": "claim-001",
                "text": "Two regions exceeded the service-delay threshold.",
                "source_ids": ["regional-snapshot-w32"],
                "support": "calculated",
                "consequential": True,
            },
            {
                "id": "claim-002",
                "text": "Director approval is required for the proposed exception.",
                "source_ids": ["service-policy-2026-07"],
                "support": "direct",
                "consequential": True,
            },
        ],
        "governance": {
            "approved_surface": True,
            "data_class": "internal",
            "consequence": "high",
            "reversible": True,
            "decision_owner": "operations-director",
        },
        "handoff": {
            "decision": "Choose up to two interventions for next week.",
            "deadline": "2026-08-07T15:00:00Z",
            "next_owner": "operations-director",
            "fallback": "Use the approved manual briefing template.",
            "source_snapshot": "regional-snapshot-w32",
        },
    }


def load_packet(path: Path | None) -> dict[str, Any]:
    """Load a user packet or return an isolated copy of the demo."""
    if path is None:
        return copy.deepcopy(build_demo_packet())
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate an Associate workflow packet.")
    parser.add_argument("--input", type=Path, help="Optional JSON packet. Uses a passing demo by default.")
    parser.add_argument("--as-of", help="Validation date in YYYY-MM-DD format.")
    args = parser.parse_args()

    as_of = parse_iso_date(args.as_of) if args.as_of else date(2026, 8, 8)
    if args.as_of and as_of is None:
        parser.error("--as-of must use YYYY-MM-DD")

    result = evaluate_packet(load_packet(args.input), as_of)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["status"] != "blocked" else 1


if __name__ == "__main__":
    raise SystemExit(main())
