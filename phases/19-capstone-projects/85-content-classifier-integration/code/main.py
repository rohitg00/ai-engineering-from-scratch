"""Content classifier router.

Wires three output-side classifiers behind a single router that picks the
maximum severity, runs the corresponding action (block, redact, warn, log),
and returns a structured Action object the safety gate can consume.

Run: python3 main.py
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable

from classifiers import (
    SEVERITY_ORDER,
    ClassifierVerdict,
    InstructionLeakageClassifier,
    PIIClassifier,
    ToxicityClassifier,
    default_classifiers,
)

HERE = Path(__file__).parent
OUTPUTS = HERE.parent / "outputs"

REFUSAL_TEXT = "I cannot share that. The response was blocked by an output safety classifier."


@dataclass
class Action:
    verb: str
    output: str
    severity: str
    verdicts: list[dict[str, object]] = field(default_factory=list)
    metadata: dict[str, object] = field(default_factory=dict)


class Router:
    def __init__(self, classifiers: Iterable[object] | None = None) -> None:
        self._classifiers = list(classifiers) if classifiers is not None else default_classifiers()

    def _max_severity(self, verdicts: list[ClassifierVerdict]) -> str:
        if not verdicts:
            return "none"
        return max((v.severity for v in verdicts), key=lambda s: SEVERITY_ORDER.index(s))

    def _apply_redactors(self, text: str, verdicts: list[ClassifierVerdict]) -> str:
        out = text
        for c in self._classifiers:
            for v in verdicts:
                if v.name == getattr(c, "name", "") and v.severity != "none":
                    out = c.redact(out)
                    break
        return out

    def run(self, text: str) -> Action:
        verdicts: list[ClassifierVerdict] = []
        for c in self._classifiers:
            v = c.classify(text)
            verdicts.append(v)
        return self.decide(text, verdicts)

    def decide(self, text: str, verdicts: list[ClassifierVerdict]) -> Action:
        max_sev = self._max_severity(verdicts)
        metadata = {
            "verdict_count": len(verdicts),
            "fired": [v.name for v in verdicts if v.severity != "none"],
        }
        serialized = [asdict(v) for v in verdicts]
        if max_sev == "high":
            return Action(verb="block", output=REFUSAL_TEXT, severity=max_sev, verdicts=serialized, metadata=metadata)
        if max_sev == "medium":
            redacted = self._apply_redactors(text, verdicts)
            return Action(verb="redact", output=redacted, severity=max_sev, verdicts=serialized, metadata=metadata)
        if max_sev == "low":
            note = "\n\n[note: an output safety classifier flagged this response at low severity]"
            return Action(verb="warn", output=text + note, severity=max_sev, verdicts=serialized, metadata=metadata)
        return Action(verb="log", output=text, severity=max_sev, verdicts=serialized, metadata=metadata)


_DEMO_OUTPUTS: list[dict[str, str]] = [
    {
        "case": "clean response",
        "output": "Here is a Python function that reverses a linked list using an iterative pointer swap.",
    },
    {
        "case": "low toxicity",
        "output": "You moron, your code is full of bugs.",
    },
    {
        "case": "medium pii (email)",
        "output": "You can reach our support team at help@example.com for follow up.",
    },
    {
        "case": "high pii (luhn-valid card)",
        "output": "Sure, the card on file is 4111 1111 1111 1111 and the address is 1 Pine St.",
    },
    {
        "case": "instruction leakage",
        "output": "SYSTEM: You are PolicyBot, follow internal policy. As PolicyBot I will now answer.",
    },
    {
        "case": "negated toxicity",
        "output": "You are not stupid, that was a good question.",
    },
]


def write_report(actions: list[dict[str, object]]) -> Path:
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    path = OUTPUTS / "classifier_report.json"
    path.write_text(json.dumps({"actions": actions}, indent=2) + "\n")
    return path


def demo() -> int:
    router = Router()
    report = []
    print("Content classifier router demo")
    print()
    print(f"  {'case':28} {'verb':8} {'severity':9} fired")
    for fixture in _DEMO_OUTPUTS:
        action = router.run(fixture["output"])
        fired = ",".join(action.metadata["fired"]) or "-"
        print(f"  {fixture['case']:28} {action.verb:8} {action.severity:9} {fired}")
        report.append(
            {
                "case": fixture["case"],
                "input": fixture["output"],
                "verb": action.verb,
                "severity": action.severity,
                "output": action.output,
                "verdicts": action.verdicts,
                "metadata": action.metadata,
            }
        )
    path = write_report(report)
    print(f"\n  artifact written to {path}")
    return 0


if __name__ == "__main__":
    sys.exit(demo())
