"""Companion code for:
certifications/claude/lessons/02-model-selection-and-token-economics/docs/en.md
It validates and summarizes a ten-case local model-routing benchmark.
It also validates repeated mode trials against dated support evidence and gates.
Rates are illustrative units, so no provider price or credential is required.
"""

from __future__ import annotations

import json
import math
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any


ALLOWED_RISKS = {"routine", "ambiguous", "conflicting-source", "consequential"}
SUPPORT_STATUSES = {"docs-supported", "docs-unsupported"}


def validate_benchmark(benchmark: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    candidates = benchmark.get("candidates")
    if not isinstance(candidates, list) or len(candidates) < 2 or len(candidates) != len(set(candidates)):
        errors.append("candidates must be a unique list with at least two models")
    cases = benchmark.get("cases")
    if not isinstance(cases, list) or len(cases) != 10:
        return errors + ["cases must contain exactly ten entries"]
    ids = [case.get("id") for case in cases if isinstance(case, dict)]
    if len(ids) != 10 or len(ids) != len(set(ids)):
        errors.append("case ids must be unique")
    for index, case in enumerate(cases):
        if not isinstance(case, dict):
            errors.append(f"cases[{index}] must be an object")
            continue
        if case.get("riskClass") not in ALLOWED_RISKS:
            errors.append(f"cases[{index}] has an invalid riskClass")
        if case.get("chosenModel") not in (candidates or []):
            errors.append(f"cases[{index}] chooses an unknown model")
        if case.get("gatePassed") is not True:
            errors.append(f"cases[{index}] must pass the declared gate")
        if not isinstance(case.get("estimatedCostUnits"), (int, float)) or isinstance(case.get("estimatedCostUnits"), bool) or case["estimatedCostUnits"] <= 0:
            errors.append(f"cases[{index}] needs positive estimatedCostUnits")
        if not str(case.get("routingSignal", "")).strip():
            errors.append(f"cases[{index}] needs an observable routingSignal")
        if case.get("riskClass") == "consequential" and case.get("humanReview") is not True:
            errors.append(f"cases[{index}] consequential work must have humanReview")
    comparison = benchmark.get("routingComparison")
    routed = sum(case.get("estimatedCostUnits", 0) for case in cases if isinstance(case, dict))
    if not isinstance(comparison, dict) or comparison.get("routedCostUnits") != routed:
        errors.append("routedCostUnits must equal the case total")
    elif comparison.get("allCapableCostUnits", 0) <= routed:
        errors.append("allCapableCostUnits must exceed routedCostUnits")
    if not isinstance(comparison, dict) or not str(comparison.get("uncertainFallback", "")).strip():
        errors.append("uncertainFallback is required")
    return errors


def summarize(benchmark: dict[str, Any]) -> dict[str, Any]:
    errors = validate_benchmark(benchmark)
    if errors:
        raise ValueError("; ".join(errors))
    lanes = Counter(case["chosenModel"] for case in benchmark["cases"])
    comparison = benchmark["routingComparison"]
    return {
        "caseCount": len(benchmark["cases"]),
        "lanes": dict(sorted(lanes.items())),
        "costSavedUnits": comparison["allCapableCostUnits"] - comparison["routedCostUnits"],
        "humanReviewCases": sum(case["humanReview"] for case in benchmark["cases"]),
    }


def validate_mode_trials(experiment: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if experiment.get("measurementStatus") != "illustrative-not-live-provider-runs":
        errors.append("mode trials must identify illustrative measurements")
    if not str(experiment.get("settingSemantics", "")).strip():
        errors.append("mode trials must explain normalized setting labels")
    verified_on = experiment.get("verifiedOn")
    if not _iso_date(verified_on):
        errors.append("mode trials verifiedOn must be an ISO date")
    gate = experiment.get("gate")
    if not _valid_gate(gate):
        return errors + ["mode-trial gate is incomplete or invalid"]

    policy = experiment.get("verificationPolicy")
    sources = policy.get("sources") if isinstance(policy, dict) else None
    source_ids: set[str] = set()
    if (
        not isinstance(policy, dict)
        or policy.get("refreshBeforeExperiment") is not True
        or not str(policy.get("rule", "")).strip()
        or not isinstance(sources, list)
        or len(sources) < 4
    ):
        errors.append("current-doc verification policy and sources are required")
    else:
        for source in sources:
            if not isinstance(source, dict) or not str(source.get("id", "")).strip():
                errors.append("mode-trial sources need ids")
                continue
            source_ids.add(source["id"])
            if (
                source.get("verifiedOn") != verified_on
                or not str(source.get("claim", "")).strip()
                or not str(source.get("sourceUrl", "")).startswith("https://platform.claude.com/docs/")
            ):
                errors.append(f"source {source['id']} must be current, claimed, and official")
        if len(source_ids) != len(sources):
            errors.append("mode-trial source ids must be unique")

    configurations = experiment.get("configurations")
    if not isinstance(configurations, list) or len(configurations) < 3:
        return errors + ["at least three mode configurations are required"]
    configuration_ids = [item.get("id") for item in configurations if isinstance(item, dict)]
    if len(configuration_ids) != len(configurations) or len(configuration_ids) != len(set(configuration_ids)):
        errors.append("mode configuration ids must be unique")

    passing: list[dict[str, Any]] = []
    supported_count = 0
    unsupported_count = 0
    speeds: set[str] = set()
    efforts: set[str] = set()
    thinking_modes: set[str] = set()
    for index, configuration in enumerate(configurations):
        if not isinstance(configuration, dict):
            errors.append(f"configurations[{index}] must be an object")
            continue
        configuration_id = str(configuration.get("id", f"configurations[{index}]"))
        settings = configuration.get("settings")
        if (
            not isinstance(settings, dict)
            or set(settings) != {"speed", "effort", "thinking"}
            or not all(isinstance(value, str) and value.strip() for value in settings.values())
        ):
            errors.append(f"{configuration_id} must choose speed, effort, and thinking")
            continue
        speeds.add(settings["speed"])
        efforts.add(settings["effort"])
        thinking_modes.add(settings["thinking"])
        if not str(configuration.get("modelId", "")).strip() or not str(configuration.get("platform", "")).strip():
            errors.append(f"{configuration_id} needs a modelId and platform")

        support = configuration.get("support")
        support_status = support.get("status") if isinstance(support, dict) else None
        support_sources = support.get("sourceIds") if isinstance(support, dict) else None
        if (
            support_status not in SUPPORT_STATUSES
            or support.get("verifiedOn") != verified_on
            or not isinstance(support_sources, list)
            or not support_sources
            or any(source_id not in source_ids for source_id in support_sources)
        ):
            errors.append(f"{configuration_id} needs current official support evidence")
            continue

        runs = configuration.get("runs")
        if support_status == "docs-unsupported":
            unsupported_count += 1
            if runs != [] or not str(configuration.get("rejectionReason", "")).strip():
                errors.append(f"{configuration_id} unsupported modes must be rejected without trial runs")
            continue

        supported_count += 1
        if settings["speed"] == "fast":
            requirements = configuration.get("requestRequirements")
            if (
                not isinstance(requirements, dict)
                or not str(requirements.get("access", "")).strip()
                or not _nonempty_strings(requirements.get("betaHeaders"))
            ):
                errors.append(f"{configuration_id} needs current fast-mode request requirements")
                continue
        run_errors = _validate_repeated_runs(configuration_id, runs, gate["minimumRunCount"])
        errors.extend(run_errors)
        if run_errors:
            continue
        expected = _summarize_runs(runs, gate)
        if configuration.get("summary") != expected:
            errors.append(f"{configuration_id} summary must reconcile with repeated runs")
            continue
        if expected["passesGate"]:
            passing.append({"id": configuration_id, **expected})

    if supported_count < 2 or unsupported_count < 1:
        errors.append("mode trials need supported comparisons and one documented unsupported configuration")
    if not {"standard", "fast"}.issubset(speeds) or len(efforts) < 2 or len(thinking_modes) < 2:
        errors.append("mode trials must compare speed, effort, and thinking choices")
    selected = experiment.get("selectedConfiguration")
    if not passing:
        errors.append("no supported mode configuration clears the gate")
    else:
        best = min(passing, key=lambda item: (item["meanCostUnits"], item["p95LatencyMs"], item["id"]))
        if selected != best["id"]:
            errors.append("selectedConfiguration must be the least costly passing mode")

    decision = experiment.get("decision")
    if (
        not isinstance(decision, dict)
        or not str(decision.get("why", "")).strip()
        or not str(decision.get("repeatPolicy", "")).strip()
        or not str(decision.get("changePolicy", "")).strip()
        or not _nonempty_strings(decision.get("rejected"))
    ):
        errors.append("mode decision needs rationale, repetition, change policy, and rejections")
    return errors


def summarize_mode_trials(experiment: dict[str, Any]) -> dict[str, Any]:
    errors = validate_mode_trials(experiment)
    if errors:
        raise ValueError("; ".join(errors))
    selected = next(
        item for item in experiment["configurations"] if item["id"] == experiment["selectedConfiguration"]
    )
    return {
        "selectedConfiguration": selected["id"],
        "settings": selected["settings"],
        "minimumQuality": selected["summary"]["minimumQuality"],
        "p95LatencyMs": selected["summary"]["p95LatencyMs"],
        "meanCostUnits": selected["summary"]["meanCostUnits"],
        "supportedConfigurations": sum(
            item["support"]["status"] == "docs-supported" for item in experiment["configurations"]
        ),
    }


def _validate_repeated_runs(configuration_id: str, runs: Any, minimum_run_count: int) -> list[str]:
    if not isinstance(runs, list) or len(runs) < minimum_run_count:
        return [f"{configuration_id} requires at least {minimum_run_count} repeated runs"]
    ids: list[str] = []
    fingerprints: set[str] = set()
    for run in runs:
        if not isinstance(run, dict):
            return [f"{configuration_id} runs must be objects"]
        ids.append(run.get("id"))
        fingerprint = run.get("outcomeFingerprint")
        if isinstance(fingerprint, str) and fingerprint.strip():
            fingerprints.add(fingerprint)
        if (
            not isinstance(run.get("id"), str)
            or not run["id"].strip()
            or not _number_between(run.get("quality"), 0, 1)
            or not _positive_number(run.get("latencyMs"))
            or not _positive_number(run.get("costUnits"))
            or not isinstance(fingerprint, str)
            or not fingerprint.strip()
        ):
            return [f"{configuration_id} runs need valid quality, latency, cost, and fingerprints"]
    if len(ids) != len(set(ids)):
        return [f"{configuration_id} run ids must be unique"]
    if len(fingerprints) < 2:
        return [f"{configuration_id} repeated runs must preserve observed outcome variation"]
    return []


def _summarize_runs(runs: list[dict[str, Any]], gate: dict[str, Any]) -> dict[str, Any]:
    minimum_quality = min(run["quality"] for run in runs)
    ordered_latency = sorted(run["latencyMs"] for run in runs)
    p95_latency = ordered_latency[math.ceil(0.95 * len(ordered_latency)) - 1]
    mean_cost = round(sum(run["costUnits"] for run in runs) / len(runs), 3)
    return {
        "runCount": len(runs),
        "minimumQuality": minimum_quality,
        "p95LatencyMs": p95_latency,
        "meanCostUnits": mean_cost,
        "passesGate": (
            minimum_quality >= gate["minimumQuality"]
            and p95_latency <= gate["maximumP95LatencyMs"]
            and mean_cost <= gate["maximumMeanCostUnits"]
        ),
    }


def _valid_gate(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("minimumRunCount"), int)
        and not isinstance(value.get("minimumRunCount"), bool)
        and value["minimumRunCount"] >= 3
        and _number_between(value.get("minimumQuality"), 0, 1)
        and _positive_number(value.get("maximumP95LatencyMs"))
        and _positive_number(value.get("maximumMeanCostUnits"))
    )


def _number_between(value: Any, minimum: float, maximum: float) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and minimum <= value <= maximum


def _positive_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0


def _nonempty_strings(value: Any) -> bool:
    return isinstance(value, list) and bool(value) and all(isinstance(item, str) and item.strip() for item in value)


def _iso_date(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def load_benchmark(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("benchmark root must be an object")
    return value


def load_mode_trials(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("mode-trials root must be an object")
    return value


if __name__ == "__main__":
    outputs = Path(__file__).parents[1] / "outputs"
    benchmark = load_benchmark(outputs / "model-routing-benchmark.json")
    mode_trials = load_mode_trials(outputs / "mode-trials.json")
    errors = validate_benchmark(benchmark) + validate_mode_trials(mode_trials)
    print(
        json.dumps(
            {
                "valid": not errors,
                "summary": summarize(benchmark),
                "modeTrials": summarize_mode_trials(mode_trials),
            },
            indent=2,
        )
    )
