"""Companion validator for this lesson's docs/en.md reliability packet."""

from __future__ import annotations

import json
from pathlib import Path


ARTIFACT = Path(__file__).resolve().parents[1] / "outputs" / "reliability-packet.md"
REQUIRED_HEADINGS = (
    "## Scope and Coverage",
    "## Provenance Envelope",
    "## Partial Result",
    "## Conflict",
    "## Escalation",
    "## Human Review",
)
REQUIRED_EVIDENCE = {
    "coverage": ("18 of 24", "omitted"),
    "provenance": ("source version", "content type", "location"),
    "escalation": ("owner", "safe next action"),
    "review": ("random sample",),
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
    return {"status": "ready_for_bounded_review" if not findings else "blocked", "score": max(0, 100 - 12 * len(findings)), "findings": findings}


def validate_artifact(path: Path = ARTIFACT) -> dict[str, object]:
    return validate_text(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    print(json.dumps(validate_artifact(), indent=2))
