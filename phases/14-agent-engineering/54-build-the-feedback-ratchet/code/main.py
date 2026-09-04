# Lesson program for routing feedback into owned, verifiable system changes.
# Read: phases/14-agent-engineering/54-build-the-feedback-ratchet/docs/en.md
# Reference: Basili, Caldiera, and Rombach, The Goal Question Metric Approach.
# Reference: Fagerholm et al., Building Blocks for Continuous Experimentation, 2014.
# Run this file to generate outputs/feedback-backlog.json.
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class Signal:
    source: str
    observation: str
    severity: int
    frequency: int
    owner: str
    expires_after_days: int


@dataclass(frozen=True)
class RatchetAction:
    priority: int
    destination: str
    change: str
    owner: str
    durable_artifact: str
    verification_evidence: str
    retirement_check: str


def destination(signal: Signal) -> str:
    text = signal.observation.lower()
    if any(word in text for word in ("regression", "wrong result", "false positive")):
        return "evaluation"
    if any(word in text for word in ("permission", "unsafe", "production write")):
        return "policy"
    if any(word in text for word in ("missing context", "could not find", "duplicate")):
        return "context"
    if any(word in text for word in ("timeout", "retry", "unavailable")):
        return "runtime"
    return "backlog"


def promote(signal: Signal) -> RatchetAction:
    if signal.severity not in range(1, 6) or signal.frequency < 1:
        raise ValueError("severity must be one to five and frequency positive")
    target = destination(signal)
    priority = signal.severity * signal.frequency
    durable_artifact = {
        "evaluation": "evaluations/regression-suite.json",
        "policy": "policies/authority-boundaries.json",
        "context": "context/retrieval-guidance.md",
        "runtime": "runtime/reliability-controls.json",
        "backlog": "backlog/shaped-work.json",
    }[target]
    verification_evidence = {
        "evaluation": "Record a passing regression evaluation",
        "policy": "Record a passing authority-boundary scenario",
        "context": "Record a replay with the required context present",
        "runtime": "Record a timeout and retry scenario within budget",
        "backlog": "Record review against the outcome frame",
    }[target]
    return RatchetAction(
        priority,
        target,
        f"Prevent recurrence of: {signal.observation}",
        signal.owner,
        durable_artifact,
        verification_evidence,
        f"Remove or revise after {signal.expires_after_days} days without recurrence",
    )


def backlog(signals: list[Signal]) -> list[RatchetAction]:
    actions = [promote(signal) for signal in signals]
    return sorted(actions, key=lambda item: (-item.priority, item.destination, item.change))


def example() -> list[Signal]:
    return [
        Signal("incident 184", "missing context caused duplicate service lookup", 4, 3, "platform", 90),
        Signal("pilot audit", "production write was attempted", 5, 1, "security", 180),
        Signal("evaluation run", "false positive on a stale deployment", 3, 4, "evaluation", 60),
    ]


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "outputs" / "feedback-backlog.json"
    output.write_text(json.dumps([asdict(item) for item in backlog(example())], indent=2) + "\n", encoding="utf-8")
    print(output.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
