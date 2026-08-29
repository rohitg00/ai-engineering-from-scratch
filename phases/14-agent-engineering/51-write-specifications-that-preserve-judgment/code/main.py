# Lesson program for compiling specifications into explicit decision boundaries.
# Read: phases/14-agent-engineering/51-write-specifications-that-preserve-judgment/docs/en.md
# Reference: Zave and Jackson, Four Dark Corners of Requirements Engineering, 1997.
# Reference: Gotel and Finkelstein, Requirements Traceability, IEEE ICRE 1994.
# Run this file to generate outputs/executable-specification.json.
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class Decision:
    question: str
    mode: str
    rationale: str


@dataclass
class Specification:
    outcome: str
    invariants: list[str]
    examples: list[str]
    non_goals: list[str]
    decisions: list[Decision]
    proof: list[str]


VALID_MODES = {"locked", "bounded", "delegated"}


def validate(specification: Specification) -> list[str]:
    issues: list[str] = []
    for field_name in ("outcome", "invariants", "examples", "non_goals", "decisions", "proof"):
        if not getattr(specification, field_name):
            issues.append(f"{field_name} is empty")
    for decision in specification.decisions:
        if decision.mode not in VALID_MODES:
            issues.append(f"invalid decision mode: {decision.mode}")
        if decision.mode != "delegated" and not decision.rationale.strip():
            issues.append(f"constrained decision lacks rationale: {decision.question}")
    return issues


def compile_contract(specification: Specification) -> dict:
    issues = validate(specification)
    return {
        "status": "executable" if not issues else "incomplete",
        "issues": issues,
        "contract": asdict(specification),
        "agent_may_decide": [item.question for item in specification.decisions if item.mode == "delegated"],
        "bounded_decisions": [
            {"question": item.question, "boundary": item.rationale}
            for item in specification.decisions
            if item.mode == "bounded"
        ],
        "human_checkpoint": [item.question for item in specification.decisions if item.mode == "locked"],
    }


def example() -> Specification:
    return Specification(
        outcome="Identify the affected service from an incident alert in under two minutes",
        invariants=["diagnosis is read-only", "every source is included in the audit record"],
        examples=["an alert with a deployment id resolves to its service owner"],
        non_goals=["automatic remediation", "changing alert routing"],
        decisions=[
            Decision("Which read-only data source should be queried first?", "delegated", ""),
            Decision("May the system write to production?", "locked", "Production authority stays with the incident commander"),
            Decision("How many sources may be queried?", "bounded", "Stop after five sources or two minutes"),
        ],
        proof=["ten recorded incident replays", "zero production writes"],
    )


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "outputs" / "executable-specification.json"
    output.write_text(json.dumps(compile_contract(example()), indent=2) + "\n", encoding="utf-8")
    print(output.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
