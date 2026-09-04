"""Companion validator for this lesson's docs/en.md recovery packet."""

from __future__ import annotations

import json
from pathlib import Path


ARTIFACT = Path(__file__).resolve().parents[1] / "outputs" / "session-recovery-packet.md"
REQUIRED_HEADINGS = (
    "## Goal and Scope",
    "## Durable State",
    "## Revalidation",
    "## Side Effect Reconciliation",
    "## Context Budget",
    "## Independent Review",
)
REQUIRED_EVIDENCE = {
    "checkpoint": ("hash", "manifest"),
    "freshness": ("revalidate",),
    "safe retry": ("idempotency", "unknown outcome"),
    "review": ("isolated", "blocked"),
}


def validate_text(text: str) -> dict[str, object]:
    lowered = " ".join(text.lower().split())
    findings = [f"missing heading: {heading}" for heading in REQUIRED_HEADINGS if heading not in text]
    for label, terms in REQUIRED_EVIDENCE.items():
        missing = [term for term in terms if term not in lowered]
        if missing:
            findings.append(f"missing {label}: {', '.join(missing)}")
    if any(marker in lowered for marker in ("tbd", "todo", "[replace")):
        findings.append("unresolved placeholder")
    return {"status": "safe_to_resume" if not findings else "blocked", "score": max(0, 100 - 12 * len(findings)), "findings": findings}


def validate_artifact(path: Path = ARTIFACT) -> dict[str, object]:
    return validate_text(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    print(json.dumps(validate_artifact(), indent=2))
