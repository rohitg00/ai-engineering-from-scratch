"""
Eval harness for an agent: fixture tasks, scored samples, pass@k.

See: phases/19-capstone-projects/27-eval-harness-fixture-tasks/docs/en.md
Concept refs:
  - pass@k = 1 - (1 - p)^k where p is the empirical per-sample pass rate.
  - Deterministic verifiers: file_equals, regex_match, shell_exit_zero.
The demo at the bottom runs the bundled fixtures against the reference candidate.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from typing import Any, Callable


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class FixtureTask:
    """A single evaluation task."""

    id: str
    goal: str
    setup_dir: str
    expected_dir: str
    verifier_name: str
    verifier_args: dict[str, Any]
    root: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "goal": self.goal,
            "verifier": self.verifier_name,
        }


@dataclass
class SampleResult:
    """One execution of a candidate against a task."""

    task_id: str
    sample_index: int
    latency_ms: float
    cost_units: float = 0.0
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "sample_index": self.sample_index,
            "latency_ms": round(self.latency_ms, 3),
            "cost_units": self.cost_units,
            "notes": self.notes,
        }


@dataclass
class VerificationOutcome:
    """The verifier's verdict on a single sample."""

    passed: bool
    detail: str


@dataclass
class TaskReport:
    task_id: str
    k: int
    passes: int
    pass_rate: float
    pass_at_k: float
    mean_latency_ms: float
    p95_latency_ms: float
    mean_cost: float
    samples: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "k": self.k,
            "passes": self.passes,
            "pass_rate": round(self.pass_rate, 4),
            "pass_at_k": round(self.pass_at_k, 4),
            "mean_latency_ms": round(self.mean_latency_ms, 3),
            "p95_latency_ms": round(self.p95_latency_ms, 3),
            "mean_cost": round(self.mean_cost, 4),
            "samples": self.samples,
        }


@dataclass
class EvalReport:
    task_reports: list[TaskReport]
    pass_at_1: float
    pass_at_k: float
    k: int
    mean_latency_ms: float
    p95_latency_ms: float
    total_cost: float

    def to_dict(self) -> dict:
        return {
            "k": self.k,
            "pass_at_1": round(self.pass_at_1, 4),
            "pass_at_k": round(self.pass_at_k, 4),
            "mean_latency_ms": round(self.mean_latency_ms, 3),
            "p95_latency_ms": round(self.p95_latency_ms, 3),
            "total_cost": round(self.total_cost, 4),
            "tasks": [t.to_dict() for t in self.task_reports],
        }


# ---------------------------------------------------------------------------
# pass@k math
# ---------------------------------------------------------------------------


def pass_at_k(empirical_pass_rate: float, k: int) -> float:
    """Probability of at least one pass in k independent samples."""

    if k <= 0:
        return 0.0
    p = max(0.0, min(1.0, empirical_pass_rate))
    return 1.0 - (1.0 - p) ** k


def p95(values: list[float]) -> float:
    """Sample 95th percentile via nearest-rank."""

    if not values:
        return 0.0
    sorted_values = sorted(values)
    idx = max(0, int(round(0.95 * len(sorted_values))) - 1)
    return sorted_values[min(idx, len(sorted_values) - 1)]


# ---------------------------------------------------------------------------
# Verifiers
# ---------------------------------------------------------------------------


Verifier = Callable[[FixtureTask, str, dict[str, Any]], VerificationOutcome]


def verify_file_equals(
    task: FixtureTask, scratch_dir: str, args: dict[str, Any]
) -> VerificationOutcome:
    """Compare a file in scratch_dir against a file in expected_dir."""

    rel = args.get("path")
    if not isinstance(rel, str):
        return VerificationOutcome(False, "verifier args missing 'path'")
    actual = os.path.join(scratch_dir, rel)
    expected = os.path.join(task.expected_dir, rel)
    if not os.path.isfile(actual):
        return VerificationOutcome(False, f"scratch file missing: {rel}")
    if not os.path.isfile(expected):
        return VerificationOutcome(False, f"expected file missing: {rel}")
    with open(actual, "r", encoding="utf-8") as fh:
        actual_text = fh.read()
    with open(expected, "r", encoding="utf-8") as fh:
        expected_text = fh.read()
    normalize = bool(args.get("normalize_trailing_newline", True))
    if normalize:
        actual_text = actual_text.rstrip("\n") + "\n"
        expected_text = expected_text.rstrip("\n") + "\n"
    if actual_text == expected_text:
        return VerificationOutcome(True, f"file {rel!r} matches expected")
    return VerificationOutcome(False, f"file {rel!r} differs from expected")


def verify_regex_match(
    task: FixtureTask, scratch_dir: str, args: dict[str, Any]
) -> VerificationOutcome:
    """Match a regex against a file in scratch_dir."""

    rel = args.get("path")
    pattern = args.get("pattern")
    if not isinstance(rel, str) or not isinstance(pattern, str):
        return VerificationOutcome(False, "verifier args need 'path' and 'pattern'")
    actual = os.path.join(scratch_dir, rel)
    if not os.path.isfile(actual):
        return VerificationOutcome(False, f"scratch file missing: {rel}")
    with open(actual, "r", encoding="utf-8") as fh:
        text = fh.read()
    if re.search(pattern, text, re.MULTILINE):
        return VerificationOutcome(True, f"file {rel!r} matched {pattern!r}")
    return VerificationOutcome(False, f"file {rel!r} did not match {pattern!r}")


def verify_shell_exit_zero(
    task: FixtureTask, scratch_dir: str, args: dict[str, Any]
) -> VerificationOutcome:
    """Run a shell command in scratch_dir; pass if exit code is zero.

    The harness uses a simple subprocess call. Production wiring goes through
    the sandbox from lesson 26 with a denylist; for the eval harness's own
    self-test the candidate authors the command, not the model.
    """

    argv = args.get("argv")
    if not isinstance(argv, list) or not argv:
        return VerificationOutcome(False, "verifier args need 'argv' list")
    timeout = float(args.get("timeout_seconds", 10.0))
    try:
        proc = subprocess.run(
            list(argv),
            cwd=scratch_dir,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return VerificationOutcome(False, "shell command timed out")
    except FileNotFoundError as exc:
        return VerificationOutcome(False, f"shell command not found: {exc}")
    if proc.returncode == 0:
        return VerificationOutcome(True, "command exited zero")
    return VerificationOutcome(False, f"command exited {proc.returncode}")


VERIFIER_REGISTRY: dict[str, Verifier] = {
    "file_equals": verify_file_equals,
    "regex_match": verify_regex_match,
    "shell_exit_zero": verify_shell_exit_zero,
}


# ---------------------------------------------------------------------------
# Fixture loading
# ---------------------------------------------------------------------------


def load_fixture(task_dir: str) -> FixtureTask:
    """Load a fixture from a directory.

    Expected layout:
        <task_dir>/task.json
        <task_dir>/buggy/...
        <task_dir>/expected/... (when verifier is file_equals)
    """

    spec_path = os.path.join(task_dir, "task.json")
    with open(spec_path, "r", encoding="utf-8") as fh:
        spec = json.load(fh)
    setup = os.path.join(task_dir, "buggy")
    expected = os.path.join(task_dir, "expected")
    return FixtureTask(
        id=spec["id"],
        goal=spec["goal"],
        setup_dir=setup,
        expected_dir=expected,
        verifier_name=spec["verifier"]["name"],
        verifier_args=spec["verifier"].get("args", {}),
        root=task_dir,
    )


def load_all_fixtures(tasks_root: str) -> list[FixtureTask]:
    tasks: list[FixtureTask] = []
    for name in sorted(os.listdir(tasks_root)):
        full = os.path.join(tasks_root, name)
        if os.path.isdir(full) and os.path.isfile(os.path.join(full, "task.json")):
            tasks.append(load_fixture(full))
    return tasks


# ---------------------------------------------------------------------------
# Candidate protocol
# ---------------------------------------------------------------------------


Candidate = Callable[[FixtureTask, str], SampleResult]


def apply_known_fixes(task: FixtureTask, scratch_dir: str) -> SampleResult:
    """Reference candidate: copies the expected files over the buggy ones.

    Used by the harness's self-test. Real candidates wire to an LLM agent.
    """

    start = time.perf_counter()
    if os.path.isdir(task.expected_dir):
        for dirpath, _dirs, files in os.walk(task.expected_dir):
            rel = os.path.relpath(dirpath, task.expected_dir)
            dst_root = scratch_dir if rel == "." else os.path.join(scratch_dir, rel)
            os.makedirs(dst_root, exist_ok=True)
            for filename in files:
                shutil.copy2(
                    os.path.join(dirpath, filename),
                    os.path.join(dst_root, filename),
                )
    elapsed = (time.perf_counter() - start) * 1000.0
    return SampleResult(
        task_id=task.id,
        sample_index=0,
        latency_ms=elapsed,
        cost_units=1.0,
        notes="reference candidate",
    )


def noop_candidate(task: FixtureTask, scratch_dir: str) -> SampleResult:
    """A candidate that does nothing. Used to verify the harness records failures."""

    start = time.perf_counter()
    elapsed = (time.perf_counter() - start) * 1000.0
    return SampleResult(
        task_id=task.id,
        sample_index=0,
        latency_ms=elapsed,
        cost_units=0.0,
        notes="noop",
    )


# ---------------------------------------------------------------------------
# The harness
# ---------------------------------------------------------------------------


@dataclass
class EvalHarness:
    """Runs fixtures through a candidate and aggregates results."""

    tasks: list[FixtureTask]
    k: int = 1
    verifier_registry: dict[str, Verifier] = field(
        default_factory=lambda: dict(VERIFIER_REGISTRY)
    )

    def _verify(
        self, task: FixtureTask, scratch_dir: str
    ) -> VerificationOutcome:
        verifier = self.verifier_registry.get(task.verifier_name)
        if verifier is None:
            return VerificationOutcome(
                False, f"unknown verifier {task.verifier_name!r}"
            )
        return verifier(task, scratch_dir, task.verifier_args)

    def _prepare_scratch(self, task: FixtureTask) -> str:
        scratch = tempfile.mkdtemp(prefix=f"eval-{task.id}-")
        if os.path.isdir(task.setup_dir):
            for dirpath, _dirs, files in os.walk(task.setup_dir):
                rel = os.path.relpath(dirpath, task.setup_dir)
                dst_root = scratch if rel == "." else os.path.join(scratch, rel)
                os.makedirs(dst_root, exist_ok=True)
                for filename in files:
                    shutil.copy2(
                        os.path.join(dirpath, filename),
                        os.path.join(dst_root, filename),
                    )
        return scratch

    def run(self, candidate: Candidate) -> EvalReport:
        task_reports: list[TaskReport] = []
        for task in self.tasks:
            samples: list[dict] = []
            latencies: list[float] = []
            costs: list[float] = []
            passes = 0
            for sample_index in range(self.k):
                scratch = self._prepare_scratch(task)
                try:
                    sample = candidate(task, scratch)
                    outcome = self._verify(task, scratch)
                    latencies.append(sample.latency_ms)
                    costs.append(sample.cost_units)
                    if outcome.passed:
                        passes += 1
                    samples.append(
                        {
                            "sample_index": sample_index,
                            "latency_ms": round(sample.latency_ms, 3),
                            "cost_units": sample.cost_units,
                            "passed": outcome.passed,
                            "detail": outcome.detail,
                            "notes": sample.notes,
                        }
                    )
                finally:
                    shutil.rmtree(scratch, ignore_errors=True)
            pass_rate = passes / self.k if self.k else 0.0
            task_reports.append(
                TaskReport(
                    task_id=task.id,
                    k=self.k,
                    passes=passes,
                    pass_rate=pass_rate,
                    pass_at_k=pass_at_k(pass_rate, self.k),
                    mean_latency_ms=statistics.mean(latencies) if latencies else 0.0,
                    p95_latency_ms=p95(latencies),
                    mean_cost=statistics.mean(costs) if costs else 0.0,
                    samples=samples,
                )
            )

        per_sample_pass_at_1 = [
            (1.0 if r.passes > 0 else 0.0)
            if r.k == 1
            else min(1.0, r.pass_rate)
            for r in task_reports
        ]
        pass_at_1_value = (
            statistics.mean(per_sample_pass_at_1) if per_sample_pass_at_1 else 0.0
        )
        pass_at_k_value = (
            statistics.mean([r.pass_at_k for r in task_reports])
            if task_reports
            else 0.0
        )
        all_latencies = [
            float(s["latency_ms"])
            for r in task_reports
            for s in r.samples
        ]
        total_cost = sum(
            float(s["cost_units"]) for r in task_reports for s in r.samples
        )
        return EvalReport(
            task_reports=task_reports,
            pass_at_1=pass_at_1_value,
            pass_at_k=pass_at_k_value,
            k=self.k,
            mean_latency_ms=(
                statistics.mean(all_latencies) if all_latencies else 0.0
            ),
            p95_latency_ms=p95(all_latencies),
            total_cost=total_cost,
        )


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------


def _tasks_dir() -> str:
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "tasks")


def run_demo() -> int:
    tasks = load_all_fixtures(_tasks_dir())
    if not tasks:
        print("ERROR: no fixture tasks found", file=sys.stderr)
        return 1

    print("EVAL HARNESS DEMO")
    print(f"loaded {len(tasks)} fixture task(s)")
    print("")
    for t in tasks:
        print(f"  - {t.id:32s} verifier={t.verifier_name}")
    print("")

    print("running reference candidate (apply_known_fixes), k=1 ...")
    harness = EvalHarness(tasks=tasks, k=1)
    report = harness.run(apply_known_fixes)
    print(json.dumps(report.to_dict(), indent=2))

    if report.pass_at_1 < 1.0:
        print(
            f"ERROR: reference candidate should pass all fixtures, got "
            f"pass@1={report.pass_at_1}",
            file=sys.stderr,
        )
        return 1

    print("")
    print("running noop candidate (should fail every fixture), k=3 ...")
    harness_noop = EvalHarness(tasks=tasks, k=3)
    noop_report = harness_noop.run(noop_candidate)
    print(
        json.dumps(
            {
                "noop_pass_at_1": round(noop_report.pass_at_1, 4),
                "noop_pass_at_k": round(noop_report.pass_at_k, 4),
                "noop_k": noop_report.k,
            },
            indent=2,
        )
    )

    if noop_report.pass_at_1 > 0.0:
        print(
            f"ERROR: noop candidate should fail, got pass@1={noop_report.pass_at_1}",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
