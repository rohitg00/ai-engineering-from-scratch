# Lesson program for selecting prototype, pilot, or production controls.
# Read: phases/14-agent-engineering/53-prototype-pilot-or-production/docs/en.md
# Reference: Boehm, A Spiral Model of Software Development and Enhancement, 1988.
# Reference: Fagerholm et al., Building Blocks for Continuous Experimentation, 2014.
# Run this file to generate outputs/stage-decisions.json.
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class BuildDecision:
    unknown: str
    real_users_required: bool
    real_data_required: bool
    consequence: int
    reversible: bool
    operational_readiness: bool


def choose_stage(decision: BuildDecision) -> str:
    if not 1 <= decision.consequence <= 5:
        raise ValueError("consequence must be from one to five")
    if not decision.real_users_required and not decision.real_data_required:
        return "prototype"
    if not decision.operational_readiness or decision.consequence >= 4 or not decision.reversible:
        return "pilot"
    return "production"


def required_controls(stage: str) -> list[str]:
    controls = {
        "prototype": ["synthetic or recorded inputs", "discardable implementation", "learning question"],
        "pilot": ["limited audience", "rollback", "human owner", "audit trail", "exit criteria"],
        "production": [
            "service level objective",
            "on-call owner",
            "security review",
            "cost and capacity controls",
            "rollback",
            "recovery",
            "continuous monitoring",
            "retirement path",
        ],
    }
    if stage not in controls:
        raise ValueError("unknown stage")
    return controls[stage]


def plan(decision: BuildDecision) -> dict:
    stage = choose_stage(decision)
    return {"stage": stage, "decision": asdict(decision), "required_controls": required_controls(stage)}


def examples() -> list[BuildDecision]:
    return [
        BuildDecision("Can the service be identified from an alert?", False, False, 2, True, False),
        BuildDecision("Will engineers trust the recommendation?", True, True, 4, True, False),
        BuildDecision("Can the workflow meet its SLO?", True, True, 2, True, True),
    ]


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "outputs" / "stage-decisions.json"
    output.write_text(json.dumps([plan(item) for item in examples()], indent=2) + "\n", encoding="utf-8")
    print(output.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
