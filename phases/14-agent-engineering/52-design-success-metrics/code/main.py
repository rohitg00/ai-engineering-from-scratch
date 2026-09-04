# Lesson program for deriving reproducible metrics from outcome goals.
# Read: phases/14-agent-engineering/52-design-success-metrics/docs/en.md
# Reference: Basili, Software Modeling and Measurement: The GQM Paradigm, 1992.
# Reference: Basili, Caldiera, and Rombach, The Goal Question Metric Approach.
# Run this file to generate outputs/measurement-report.json.
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class Metric:
    name: str
    direction: str
    threshold: float
    window: str
    source: str
    kind: str


@dataclass
class MeasurementPlan:
    goal: str
    questions: list[str]
    metrics: list[Metric]


def validate(plan: MeasurementPlan) -> list[str]:
    issues: list[str] = []
    if not plan.goal.strip():
        issues.append("goal is empty")
    if not plan.questions:
        issues.append("questions are empty")
    if not plan.metrics:
        issues.append("metrics are empty")
    kinds = {metric.kind for metric in plan.metrics}
    if "outcome" not in kinds:
        issues.append("outcome metric is missing")
    if "guardrail" not in kinds:
        issues.append("guardrail metric is missing")
    for metric in plan.metrics:
        if metric.direction not in {"at-most", "at-least"}:
            issues.append(f"{metric.name} has invalid direction")
        if not metric.source.strip() or not metric.window.strip():
            issues.append(f"{metric.name} lacks source or window")
    return issues


def evaluate(metric: Metric, value: float) -> bool:
    if metric.direction == "at-most":
        return value <= metric.threshold
    if metric.direction == "at-least":
        return value >= metric.threshold
    raise ValueError("invalid direction")


def report(plan: MeasurementPlan, values: dict[str, float]) -> dict:
    issues = validate(plan)
    results = []
    for metric in plan.metrics:
        if metric.direction not in {"at-most", "at-least"}:
            result = {"name": metric.name, "status": "invalid"}
            if metric.name in values:
                result["value"] = values[metric.name]
            results.append(result)
        elif metric.name not in values:
            results.append({"name": metric.name, "status": "missing"})
        else:
            results.append({"name": metric.name, "value": values[metric.name], "passed": evaluate(metric, values[metric.name])})
    return {"status": "valid" if not issues else "invalid", "issues": issues, "plan": asdict(plan), "results": results}


def example() -> MeasurementPlan:
    return MeasurementPlan(
        goal="Reduce time to identify the affected service without increasing unsafe actions",
        questions=["How quickly is the correct service identified?", "Does diagnosis remain read-only?"],
        metrics=[
            Metric("median_identification_seconds", "at-most", 120, "ten incident replays", "replay log", "outcome"),
            Metric("correct_service_rate", "at-least", 0.9, "ten incident replays", "incident record", "outcome"),
            Metric("production_writes", "at-most", 0, "entire pilot", "audit log", "guardrail"),
        ],
    )


def main() -> None:
    values = {"median_identification_seconds": 94, "correct_service_rate": 0.9, "production_writes": 0}
    output = Path(__file__).resolve().parents[1] / "outputs" / "measurement-report.json"
    output.write_text(json.dumps(report(example(), values), indent=2) + "\n", encoding="utf-8")
    print(output.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
