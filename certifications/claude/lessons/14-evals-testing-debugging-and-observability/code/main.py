"""Companion code for:
certifications/claude/lessons/14-evals-testing-debugging-and-observability/docs/en.md
It scores output, tool trajectory, final state, latency, and failures.
The design follows official Anthropic evaluation guidance.
"""

from __future__ import annotations

import json
import statistics
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable


@dataclass(frozen=True)
class EvalCase:
    case_id: str
    prompt: str
    required_text: tuple[str, ...] = ()
    forbidden_text: tuple[str, ...] = ()
    expected_tools: tuple[str, ...] = ()
    expected_state: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentRun:
    output: str
    tools: tuple[str, ...] = ()
    state: dict[str, Any] = field(default_factory=dict)
    trace: tuple[dict[str, Any], ...] = ()


@dataclass(frozen=True)
class CaseResult:
    case_id: str
    passed: bool
    score: float
    checks: dict[str, bool]
    latency_ms: float
    error_class: str | None = None


class EvalHarness:
    def __init__(self, agent: Callable[[str], AgentRun]) -> None:
        self.agent = agent

    def run_case(self, case: EvalCase) -> CaseResult:
        started = time.perf_counter()
        try:
            run = self.agent(case.prompt)
            checks = {
                "required_text": all(fragment.lower() in run.output.lower() for fragment in case.required_text),
                "forbidden_text": all(fragment.lower() not in run.output.lower() for fragment in case.forbidden_text),
                "tool_trajectory": tuple(run.tools) == tuple(case.expected_tools),
                "final_state": all(run.state.get(key) == value for key, value in case.expected_state.items()),
                "trace_shape": all(isinstance(event.get("type"), str) for event in run.trace),
            }
            score = sum(checks.values()) / len(checks)
            return CaseResult(case.case_id, all(checks.values()), score, checks, _elapsed_ms(started))
        except Exception as exc:
            return CaseResult(case.case_id, False, 0.0, {}, _elapsed_ms(started), classify_error(exc))

    def run_suite(self, cases: list[EvalCase]) -> dict[str, Any]:
        results = [self.run_case(case) for case in cases]
        return {
            "cases": [asdict(result) for result in results],
            "summary": {
                "count": len(results),
                "passed": sum(result.passed for result in results),
                "pass_rate": sum(result.passed for result in results) / len(results) if results else 0.0,
                "mean_score": statistics.fmean(result.score for result in results) if results else 0.0,
                "p95_latency_ms": percentile([result.latency_ms for result in results], 0.95),
            },
        }


def classify_error(exc: Exception) -> str:
    if isinstance(exc, TimeoutError):
        return "transport_timeout"
    if isinstance(exc, PermissionError):
        return "policy_denial"
    if isinstance(exc, json.JSONDecodeError):
        return "contract_parse_error"
    if isinstance(exc, ValueError):
        return "application_validation_error"
    return "unexpected_application_error"


def percentile(values: list[float], quantile: float) -> float:
    if not values:
        return 0.0
    if not 0 <= quantile <= 1:
        raise ValueError("quantile must be between zero and one")
    ordered = sorted(values)
    index = round((len(ordered) - 1) * quantile)
    return ordered[index]


def validate_release_gate(gate: dict[str, Any]) -> list[str]:
    """Validate severe-case, regression, trace, and failure-class coverage."""
    errors: list[str] = []
    thresholds = gate.get("thresholds")
    required_thresholds = {
        "severeCasePassRate",
        "maximumOverallRegressionPoints",
        "maximumSliceRegressionPoints",
        "maximumP95LatencyIncreasePercent",
        "maximumMeanCostIncreasePercent",
    }
    if not isinstance(thresholds, dict) or required_thresholds - set(thresholds):
        errors.append("thresholds are incomplete")
    elif thresholds["severeCasePassRate"] != 1.0:
        errors.append("severeCasePassRate must be 1.0")
    if not isinstance(gate.get("severeCases"), list) or len(gate["severeCases"]) < 3:
        errors.append("at least three severeCases are required")
    required_surfaces = {"output", "trajectory", "final-state", "safety", "operational-budget"}
    if not required_surfaces <= set(gate.get("evaluationSurfaces", [])):
        errors.append("all five evaluation surfaces are required")
    required_trace = {"trace_id", "type", "model_version", "prompt_version", "policy", "latency_ms", "result_class"}
    if not required_trace <= set(gate.get("requiredTraceFields", [])):
        errors.append("required trace fields are incomplete")
    required_failures = {"transport_timeout", "protocol_error", "contract_parse_error", "policy_denial", "final_state_failure"}
    if not required_failures <= set(gate.get("failureClasses", [])):
        errors.append("failure classes are incomplete")
    return errors


def load_release_gate(path: str) -> dict[str, Any]:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("release gate root must be an object")
    return value


def _elapsed_ms(started: float) -> float:
    return (time.perf_counter() - started) * 1000


def demo_agent(prompt: str) -> AgentRun:
    if "missing" in prompt:
        return AgentRun("I cannot verify that order.", (), {"escalated": True}, ({"type": "decision", "reason": "missing_id"},))
    return AgentRun("Order A-17 is ready.", ("lookup_order",), {"escalated": False}, ({"type": "tool_call", "name": "lookup_order"},))


def demo() -> dict[str, Any]:
    cases = [
        EvalCase("known", "Find A-17", ("ready",), (), ("lookup_order",), {"escalated": False}),
        EvalCase("missing", "The order id is missing", ("cannot verify",), ("ready",), (), {"escalated": True}),
    ]
    return EvalHarness(demo_agent).run_suite(cases)


if __name__ == "__main__":
    print(json.dumps(demo(), indent=2))
