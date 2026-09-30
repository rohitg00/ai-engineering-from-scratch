"""Companion code for:
certifications/mcpa/lessons/00-mcp-exam-strategy/docs/en.md
Deterministic MCPA study planner and 34-lesson route map.
Sources: MCPA exam page (Linux Foundation Training); research/source-verification-ledger.md.
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
    "timeLimitMinutesPage": 90,
    "timeLimitMinutesPress": 120,
    "timeLimitSourceUsed": "page",
    "itemCount": None,
    "passingScore": None,
}

ROUTE: tuple[dict[str, Any], ...] = (
    {"nn": "00", "slug": "mcp-exam-strategy", "domains": ("mcp-fundamentals",)},
    {"nn": "01", "slug": "reading-the-specification", "domains": ("mcp-fundamentals",)},
    {"nn": "02", "slug": "the-integration-problem", "domains": ("mcp-fundamentals",)},
    {"nn": "03", "slug": "json-rpc-and-meta", "domains": ("mcp-fundamentals", "architecture-and-components")},
    {"nn": "04", "slug": "the-stateless-core", "domains": ("mcp-fundamentals",)},
    {"nn": "05", "slug": "protocol-eras-and-compatibility", "domains": ("mcp-fundamentals",)},
    {"nn": "06", "slug": "hosts-clients-and-servers", "domains": ("architecture-and-components",)},
    {"nn": "07", "slug": "discovery-and-capability-negotiation", "domains": ("architecture-and-components",)},
    {"nn": "08", "slug": "tool-schemas-and-structured-content", "domains": ("architecture-and-components",)},
    {"nn": "09", "slug": "reading-server-manifests", "domains": ("architecture-and-components",)},
    {"nn": "10", "slug": "model-interaction-flow", "domains": ("architecture-and-components",)},
    {"nn": "11", "slug": "the-tools-primitive", "domains": ("interactions-and-execution",)},
    {"nn": "12", "slug": "the-resources-primitive", "domains": ("interactions-and-execution",)},
    {"nn": "13", "slug": "prompts-and-completion", "domains": ("interactions-and-execution",)},
    {"nn": "14", "slug": "multi-round-trip-requests-and-elicitation", "domains": ("interactions-and-execution",)},
    {"nn": "15", "slug": "deprecated-client-features", "domains": ("interactions-and-execution",)},
    {"nn": "16", "slug": "notifications-and-subscriptions", "domains": ("interactions-and-execution",)},
    {"nn": "17", "slug": "tool-invocation-lifecycle", "domains": ("interactions-and-execution",)},
    {"nn": "18", "slug": "error-handling", "domains": ("interactions-and-execution",)},
    {"nn": "19", "slug": "transports-and-http-headers", "domains": ("interactions-and-execution", "architecture-and-components")},
    {"nn": "20", "slug": "caching-and-pagination", "domains": ("interactions-and-execution",)},
    {"nn": "21", "slug": "long-running-work-and-tasks", "domains": ("interactions-and-execution",)},
    {"nn": "22", "slug": "trust-boundaries", "domains": ("security-and-governance",)},
    {"nn": "23", "slug": "oauth-authorization", "domains": ("security-and-governance",)},
    {"nn": "24", "slug": "client-registration-and-identity", "domains": ("security-and-governance",)},
    {"nn": "25", "slug": "consent-and-least-privilege", "domains": ("security-and-governance",)},
    {"nn": "26", "slug": "risk-and-safety-controls", "domains": ("security-and-governance",)},
    {"nn": "27", "slug": "auditability-and-observability", "domains": ("security-and-governance",)},
    {"nn": "28", "slug": "roles-and-adoption", "domains": ("use-cases-and-ecosystem",)},
    {"nn": "29", "slug": "operational-use-cases", "domains": ("use-cases-and-ecosystem",)},
    {"nn": "30", "slug": "the-extensions-framework", "domains": ("use-cases-and-ecosystem",)},
    {"nn": "31", "slug": "mcp-apps", "domains": ("use-cases-and-ecosystem",)},
    {"nn": "32", "slug": "registry-gateways-and-sdk-tiers", "domains": ("use-cases-and-ecosystem",)},
    {
        "nn": "33",
        "slug": "mcpa-capstone-readiness",
        "domains": (
            "mcp-fundamentals",
            "architecture-and-components",
            "interactions-and-execution",
            "security-and-governance",
            "use-cases-and-ecosystem",
        ),
    },
)

NO_WIRE_REASON = "Lesson 00 plans study time and reads exam mechanics; it never exchanges a message with an MCP server."


def validate_weights(weights: dict[str, int]) -> None:
    total = sum(weights.values())
    if total != 100:
        raise ValueError(f"domain weights must sum to 100; found {total}")


def validate_domain(domain: str, weights: dict[str, int] | None = None) -> None:
    if weights is None:
        weights = DOMAIN_WEIGHTS
    if domain not in weights:
        raise ValueError(f"unknown MCPA domain: {domain!r}")


def allocate_study_hours(total_hours: float, weights: dict[str, int] | None = None) -> dict[str, float]:
    if weights is None:
        weights = DOMAIN_WEIGHTS
    validate_weights(weights)
    if total_hours < 0:
        raise ValueError("total_hours must be non-negative")
    return {domain: total_hours * weight / 100 for domain, weight in weights.items()}


def estimate_readiness(results: dict[str, tuple[int, int]], weights: dict[str, int] | None = None) -> float:
    if weights is None:
        weights = DOMAIN_WEIGHTS
    validate_weights(weights)
    for domain in results:
        validate_domain(domain, weights)
    weighted_total = 0.0
    for domain, weight in weights.items():
        correct, total = results.get(domain, (0, 0))
        domain_score = (correct / total) if total > 0 else 0.0
        weighted_total += weight * domain_score
    return weighted_total


def validate_route(route: tuple[dict[str, Any], ...] | None = None, weights: dict[str, int] | None = None) -> None:
    if route is None:
        route = ROUTE
    if weights is None:
        weights = DOMAIN_WEIGHTS
    expected_ids = {f"{n:02d}" for n in range(len(route))}
    seen_ids = {entry["nn"] for entry in route}
    if seen_ids != expected_ids:
        raise ValueError(f"route must cover exactly {sorted(expected_ids)}; found {sorted(seen_ids)}")
    for entry in route:
        if not entry["domains"]:
            raise ValueError(f"lesson {entry['nn']} lists no domain")
        for domain in entry["domains"]:
            validate_domain(domain, weights)


def route_for_domain(
    domain: str,
    route: tuple[dict[str, Any], ...] | None = None,
    weights: dict[str, int] | None = None,
) -> tuple[str, ...]:
    if route is None:
        route = ROUTE
    validate_domain(domain, weights)
    return tuple(entry["slug"] for entry in route if domain in entry["domains"])


def transcript() -> list[dict[str, Any]]:
    return []


def demo() -> None:
    validate_weights(DOMAIN_WEIGHTS)
    validate_route()
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

    print("route length ->", len(ROUTE))
    print("mcp-fundamentals route ->", json.dumps(route_for_domain("mcp-fundamentals")))
    print("security-and-governance route ->", json.dumps(route_for_domain("security-and-governance")))
    print("capstone domains ->", json.dumps(sorted(ROUTE[-1]["domains"])))


if __name__ == "__main__":
    demo()
