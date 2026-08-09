"""Companion code for:
certifications/claude/lessons/04-context-knowledge-memory-and-caching/docs/en.md
It validates source lifecycle metadata, prompt budget, and cache eligibility.
The scenario runner keeps correctness separate from cache economics.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any


SOURCE_FIELDS = {"id", "job", "owner", "authority", "effectiveDate", "reviewDate", "sensitivity", "status", "stability", "cacheEligible"}


def validate_registry(registry: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not _iso_date(registry.get("asOf")):
        errors.append("asOf must be an ISO date")
    sources = registry.get("sources")
    if not isinstance(sources, list) or len(sources) < 4:
        return errors + ["sources must contain at least four entries"]
    ids: set[str] = set()
    by_id: dict[str, dict[str, Any]] = {}
    for index, source in enumerate(sources):
        if not isinstance(source, dict) or SOURCE_FIELDS - set(source):
            errors.append(f"sources[{index}] is incomplete")
            continue
        identifier = source.get("id")
        if not isinstance(identifier, str) or not identifier:
            errors.append(f"sources[{index}].id is invalid")
            continue
        if identifier in ids:
            errors.append(f"duplicate source id: {identifier}")
        ids.add(identifier)
        by_id[identifier] = source
        if not str(source.get("owner", "")).strip():
            errors.append(f"sources[{index}] needs an owner")
        if not _iso_date(source.get("effectiveDate")) or not _iso_date(source.get("reviewDate")):
            errors.append(f"sources[{index}] needs ISO lifecycle dates")
        if source.get("status") not in {"active", "superseded", "quarantined"}:
            errors.append(f"sources[{index}] has invalid status")
        if source.get("status") != "active" and source.get("cacheEligible") is True:
            errors.append(f"sources[{index}] inactive source cannot be cache eligible")
    cached = registry.get("cachedPrefixSourceIds")
    if not isinstance(cached, list) or not cached:
        errors.append("cachedPrefixSourceIds must be non-empty")
    else:
        for identifier in cached:
            source = by_id.get(identifier)
            if source is None:
                errors.append(f"cached source does not exist: {identifier}")
            elif source.get("status") != "active" or source.get("stability") != "stable" or source.get("cacheEligible") is not True:
                errors.append(f"cached source is not active, stable, and eligible: {identifier}")
            elif source.get("sensitivity") == "restricted":
                errors.append(f"restricted source cannot enter cached prefix: {identifier}")
    budget = registry.get("promptBudget")
    if not isinstance(budget, dict) or not isinstance(budget.get("maximumTokens"), int):
        errors.append("promptBudget is invalid")
    else:
        used = sum(value for key, value in budget.items() if key != "maximumTokens" and isinstance(value, int))
        if used > budget["maximumTokens"]:
            errors.append("prompt budget exceeds maximumTokens")
    if not str(registry.get("invalidationRule", "")).strip():
        errors.append("invalidationRule is required")
    return errors


def build_context_plan(registry: dict[str, Any]) -> dict[str, Any]:
    errors = validate_registry(registry)
    if errors:
        raise ValueError("; ".join(errors))
    cached = set(registry["cachedPrefixSourceIds"])
    return {
        "cachedPrefix": [source["id"] for source in registry["sources"] if source["id"] in cached],
        "dynamicContext": [source["id"] for source in registry["sources"] if source["status"] == "active" and source["id"] not in cached],
        "retired": [source["id"] for source in registry["sources"] if source["status"] != "active"],
        "budgetRemaining": registry["promptBudget"]["maximumTokens"] - sum(value for key, value in registry["promptBudget"].items() if key != "maximumTokens"),
    }


def _iso_date(value: Any) -> bool:
    try:
        date.fromisoformat(value)
        return isinstance(value, str)
    except (TypeError, ValueError):
        return False


def load_registry(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("registry root must be an object")
    return value


if __name__ == "__main__":
    path = Path(__file__).parents[1] / "outputs" / "context-registry.json"
    registry = load_registry(path)
    print(json.dumps({"valid": not validate_registry(registry), "plan": build_context_plan(registry)}, indent=2))
