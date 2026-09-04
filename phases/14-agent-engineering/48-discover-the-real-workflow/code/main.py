# Lesson program: audits workflow evidence, ordering, confidence, and friction.
# Lesson: phases/14-agent-engineering/48-discover-the-real-workflow/docs/en.md
# Canonical source: Nuseibeh and Easterbrook, Requirements Engineering: A Roadmap.
# Canonical source: Gotel and Finkelstein, ICRE 1994, DOI 10.1109/ICRE.1994.292398.
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class Evidence:
    source: str
    observation: str
    direct: bool
    confidence: float


@dataclass(frozen=True)
class WorkflowStep:
    order: int
    actor: str
    action: str
    evidence: tuple[Evidence, ...]
    friction: str = ""


def audit(steps: list[WorkflowStep]) -> dict:
    orders = [step.order for step in steps]
    issues: list[str] = []
    if orders != list(range(1, len(steps) + 1)):
        issues.append("workflow order must be contiguous from one")
    for step in steps:
        if not step.evidence:
            issues.append(f"step {step.order} has no evidence")
        for item in step.evidence:
            if not 0 <= item.confidence <= 1:
                issues.append(f"step {step.order} has confidence outside zero to one")
    direct = sum(item.direct for step in steps for item in step.evidence)
    total = sum(len(step.evidence) for step in steps)
    return {
        "status": "grounded" if not issues and direct > 0 else "needs-evidence",
        "issues": issues,
        "direct_evidence_ratio": round(direct / total, 2) if total else 0,
        "friction_points": [step.friction for step in steps if step.friction],
        "steps": [asdict(step) for step in steps],
    }


def example() -> list[WorkflowStep]:
    return [
        WorkflowStep(1, "on-call engineer", "opens the alert", (Evidence("screen recording 01", "alert lacks service owner", True, 0.95),), "owner lookup"),
        WorkflowStep(2, "on-call engineer", "searches dashboards", (Evidence("incident 184", "three dashboards opened", True, 0.9),), "context switching"),
        WorkflowStep(3, "incident commander", "approves mitigation", (Evidence("runbook", "production writes require approval", False, 0.8),)),
    ]


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "outputs" / "workflow-evidence.json"
    output.write_text(json.dumps(audit(example()), indent=2) + "\n", encoding="utf-8")
    print(output.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
