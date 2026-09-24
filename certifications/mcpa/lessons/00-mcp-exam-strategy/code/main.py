"""MCPA exam strategy: the blueprint as a study-time budget.

A deterministic study planner for the MCPA "MCP Fundamentals" orientation
lesson. It has no network and no third-party dependency: it only encodes the
published MCPA domain weights and two pure functions a candidate can run
against their own numbers. See docs/en.md for the walkthrough and
certifications/mcpa/research/source-verification-ledger.md for where every
fact below was verified.

Run: python3 code/main.py
"""

from __future__ import annotations

import json
from typing import Any


PROTOCOL_VERSION = "2026-07-28"

DOMAIN_WEIGHTS: dict[str, int] = {
    "mcp-fundamentals": 16,
    "architecture-and-components": 14,
    "interactions-and-execution": 26,
    "security-and-governance": 24,
    "use-cases-and-ecosystem": 20,
}

EXAM_FACTS: dict[str, Any] = {
    "alignedSpec": PROTOCOL_VERSION,
    "format": "online, proctored, multiple choice",
    "feeUsd": 250,
    "feeScope": "exam only",
    "validityYears": 2,
    "retakesIncluded": 1,
    "itemCount": None,
    "passingScore": None,
}


def validate_weights(weights: dict[str, int]) -> None:
    """Raise ValueError unless the given domain weights sum to exactly 100."""
    total = sum(weights.values())
    if total != 100:
        raise ValueError(f"domain weights must sum to 100; found {total}")


def allocate_study_hours(total_hours: float, weights: dict[str, int] | None = None) -> dict[str, float]:
    """Split a study-hours budget across domains in proportion to blueprint weight.

    Each domain receives total_hours * weight / 100, so the returned values
    always sum back to total_hours and stay proportional to the blueprint
    regardless of how large or small the budget is.
    """
    if weights is None:
        weights = DOMAIN_WEIGHTS
    validate_weights(weights)
    if total_hours < 0:
        raise ValueError("total_hours must be non-negative")
    return {domain: total_hours * weight / 100 for domain, weight in weights.items()}


def estimate_readiness(results: dict[str, tuple[int, int]], weights: dict[str, int] | None = None) -> float:
    """Return a 0-100 readiness estimate that weights each domain by blueprint share.

    `results` maps a domain id to a (correct, total) practice-question count.
    A domain the candidate has not attempted yet (total == 0) contributes
    zero to the estimate instead of raising, so a coverage gap shows up as a
    lower score rather than crashing the caller.
    """
    if weights is None:
        weights = DOMAIN_WEIGHTS
    validate_weights(weights)
    weighted_total = 0.0
    for domain, weight in weights.items():
        correct, total = results.get(domain, (0, 0))
        domain_score = (correct / total) if total > 0 else 0.0
        weighted_total += weight * domain_score
    return weighted_total


def demo() -> None:
    validate_weights(DOMAIN_WEIGHTS)
    print("domain weights ->", json.dumps(DOMAIN_WEIGHTS))
    print("exam facts ->", json.dumps(EXAM_FACTS))

    budget = allocate_study_hours(40.0)
    rounded_budget = {domain: round(hours, 2) for domain, hours in budget.items()}
    print("40h budget allocation ->", json.dumps(rounded_budget))

    practice_results = {
        "mcp-fundamentals": (9, 10),
        "architecture-and-components": (6, 10),
        "interactions-and-execution": (7, 10),
        "security-and-governance": (5, 10),
        "use-cases-and-ecosystem": (8, 10),
    }
    readiness = estimate_readiness(practice_results)
    print("weighted readiness ->", round(readiness, 2))

    naive_average = sum(c / t for c, t in practice_results.values()) / len(practice_results) * 100
    print("naive unweighted average ->", round(naive_average, 2))


if __name__ == "__main__":
    demo()
