"""実験ランナー: timeout、memory poller、ablation table を持つ subprocess sandbox。

概念参照:
- ./docs/en.md (この lesson)
- Phase 19 Track A lessons 20-29 (agent harness primitives)

stdlib のみ。実行: python3 code/main.py
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Iterable


_LOGGER = logging.getLogger(__name__)
_MEMORY_POLLER_UNSUPPORTED_WARNED = False


@dataclass
class ExperimentSpec:
    spec_id: str
    hypothesis_id: int
    script_path: str
    config: dict
    seed: int = 0
    wall_timeout_s: float = 30.0
    memory_cap_mb: int = 512
    metric_keys: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "spec_id": self.spec_id,
            "hypothesis_id": self.hypothesis_id,
            "script_path": self.script_path,
            "config": dict(self.config),
            "seed": self.seed,
            "wall_timeout_s": self.wall_timeout_s,
            "memory_cap_mb": self.memory_cap_mb,
            "metric_keys": list(self.metric_keys),
        }


@dataclass
class ExperimentResult:
    spec_id: str
    hypothesis_id: int
    exit_code: int
    terminal: str
    wall_time_s: float
    peak_rss_mb: float | None
    metrics: dict
    intermediate_metrics: list[dict]
    stdout_tail: str
    stderr_tail: str

    def to_dict(self) -> dict:
        return {
            "spec_id": self.spec_id,
            "hypothesis_id": self.hypothesis_id,
            "exit_code": self.exit_code,
            "terminal": self.terminal,
            "wall_time_s": round(self.wall_time_s, 4),
            "peak_rss_mb": None if self.peak_rss_mb is None else round(self.peak_rss_mb, 2),
            "metrics": dict(self.metrics),
            "intermediate_metrics": [dict(m) for m in self.intermediate_metrics],
            "stdout_tail": self.stdout_tail[-400:],
            "stderr_tail": self.stderr_tail[-400:],
        }


def _rss_mb(pid: int) -> float | None:
    """RSS を MB で best effort に読みます。非対応 platform では None を返します。"""
    proc_status = f"/proc/{pid}/status"
    if os.path.exists(proc_status):
        try:
            with open(proc_status, "rt", encoding="utf-8") as fh:
                for line in fh:
                    if line.startswith("VmRSS:"):
                        parts = line.split()
                        if len(parts) >= 2:
                            return float(parts[1]) / 1024.0
        except OSError:
            return None
        return 0.0
    if shutil.which("ps"):
        try:
            out = subprocess.run(
                ["ps", "-o", "rss=", "-p", str(pid)],
                capture_output=True, text=True, timeout=2.0,
            )
            value = out.stdout.strip()
            if value:
                return float(value) / 1024.0
        except (OSError, subprocess.SubprocessError, ValueError):
            return None
    return None


class _MemoryPoller(threading.Thread):
    """subprocess RSS を MB 単位で poll し、cap を超えたら process を kill します。"""

    def __init__(self, proc: subprocess.Popen, cap_mb: int, interval_s: float = 0.05) -> None:
        super().__init__(daemon=True)
        self._proc = proc
        self._cap = cap_mb
        self._interval = interval_s
        self._stop_event = threading.Event()
        self.peak_rss_mb: float | None = None
        self.killed_for_oom = False
        self.unsupported = False

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        global _MEMORY_POLLER_UNSUPPORTED_WARNED
        while not self._stop_event.is_set() and self._proc.poll() is None:
            rss = _rss_mb(self._proc.pid)
            if rss is None:
                self.unsupported = True
                if not _MEMORY_POLLER_UNSUPPORTED_WARNED:
                    _MEMORY_POLLER_UNSUPPORTED_WARNED = True
                    _LOGGER.warning(
                        "memory poller disabled: platform does not expose RSS via /proc or ps; wall clock timeout still applies",
                    )
                return
            self.peak_rss_mb = rss if self.peak_rss_mb is None else max(self.peak_rss_mb, rss)
            if rss > self._cap:
                self.killed_for_oom = True
                try:
                    self._proc.kill()
                except OSError:
                    pass
                return
            self._stop_event.wait(self._interval)


def _scan_intermediates(stdout: str, metric_keys: list[str]) -> tuple[dict, list[dict]]:
    """stdout の各行を歩き、metric_keys を満たす JSON line をすべて抜き出します。

    最後に見つかった line を final metrics として扱います。それ以前の line は
    evaluator が learning curve を plot できるよう intermediate として返します。
    """
    intermediates: list[dict] = []
    final: dict = {}
    required = set(metric_keys)
    for raw_line in stdout.splitlines():
        line = raw_line.strip()
        if not line.startswith("{"):
            continue
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(parsed, dict):
            continue
        if required and not required.issubset(parsed.keys()):
            continue
        if final:
            intermediates.append(final)
        final = parsed
    return final, intermediates


class ExperimentRunner:
    """subprocess を spawn し、timeout と memory cap を enforce して ExperimentResult を返します。"""

    def __init__(self, python_path: str | None = None, poll_interval_s: float = 0.05) -> None:
        self._python = python_path or sys.executable
        self._poll_interval = poll_interval_s

    def run(self, spec: ExperimentSpec) -> ExperimentResult:
        with tempfile.TemporaryDirectory(prefix="exp_") as workdir:
            config_path = os.path.join(workdir, "config.json")
            merged_config = dict(spec.config)
            merged_config["__seed"] = spec.seed
            with open(config_path, "w", encoding="utf-8") as fh:
                json.dump(merged_config, fh)
            return self._run_subprocess(spec, config_path)

    def _run_subprocess(self, spec: ExperimentSpec, config_path: str) -> ExperimentResult:
        start = time.perf_counter()
        try:
            proc = subprocess.Popen(
                [self._python, spec.script_path, config_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except OSError as exc:
            wall = time.perf_counter() - start
            return ExperimentResult(
                spec_id=spec.spec_id,
                hypothesis_id=spec.hypothesis_id,
                exit_code=-1,
                terminal="crash",
                wall_time_s=wall,
                peak_rss_mb=None,
                metrics={},
                intermediate_metrics=[],
                stdout_tail="",
                stderr_tail=str(exc),
            )
        poller = _MemoryPoller(proc, spec.memory_cap_mb, self._poll_interval)
        poller.start()
        killed_for_timeout = False
        try:
            stdout, stderr = proc.communicate(timeout=spec.wall_timeout_s)
        except subprocess.TimeoutExpired:
            killed_for_timeout = True
            try:
                proc.kill()
            except OSError:
                pass
            try:
                stdout, stderr = proc.communicate(timeout=2.0)
            except subprocess.TimeoutExpired:
                stdout, stderr = "", ""
        finally:
            poller.stop()
            poller.join(timeout=1.0)
        wall = time.perf_counter() - start
        metrics, intermediates = _scan_intermediates(stdout, spec.metric_keys)
        terminal = self._terminal_label(proc.returncode, killed_for_timeout, poller.killed_for_oom, bool(metrics))
        return ExperimentResult(
            spec_id=spec.spec_id,
            hypothesis_id=spec.hypothesis_id,
            exit_code=proc.returncode if proc.returncode is not None else -1,
            terminal=terminal,
            wall_time_s=wall,
            peak_rss_mb=poller.peak_rss_mb,
            metrics=metrics,
            intermediate_metrics=intermediates,
            stdout_tail=stdout,
            stderr_tail=stderr,
        )

    @staticmethod
    def _terminal_label(exit_code: int | None, timed_out: bool, oomed: bool, have_metrics: bool) -> str:
        if oomed:
            return "oom"
        if timed_out:
            return "timeout"
        if exit_code == 0 and have_metrics:
            return "ok"
        if exit_code == 0 and not have_metrics:
            return "crash"
        return "crash"


def ablate(base: ExperimentSpec, knob: str, values: Iterable[Any]) -> list[ExperimentSpec]:
    specs: list[ExperimentSpec] = []
    for value in values:
        derived_config = dict(base.config)
        derived_config[knob] = value
        specs.append(ExperimentSpec(
            spec_id=f"{base.spec_id}_{knob}_{value}",
            hypothesis_id=base.hypothesis_id,
            script_path=base.script_path,
            config=derived_config,
            seed=base.seed,
            wall_timeout_s=base.wall_timeout_s,
            memory_cap_mb=base.memory_cap_mb,
            metric_keys=list(base.metric_keys),
        ))
    return specs


@dataclass
class AblationTable:
    knob: str
    rows: list[tuple[Any, ExperimentResult]]

    def to_dict(self) -> dict:
        return {
            "knob": self.knob,
            "rows": [{"value": v, "result": r.to_dict()} for v, r in self.rows],
        }


class AblationRunner:
    def __init__(self, runner: ExperimentRunner) -> None:
        self._runner = runner

    def sweep(self, base: ExperimentSpec, knob: str, values: Iterable[Any]) -> AblationTable:
        value_list = list(values)
        rows: list[tuple[Any, ExperimentResult]] = []
        for value, spec in zip(value_list, ablate(base, knob, value_list)):
            result = self._runner.run(spec)
            rows.append((value, result))
        return AblationTable(knob=knob, rows=rows)


def _demo() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    script = os.path.join(here, "experiments", "sparsity_experiment.py")
    base = ExperimentSpec(
        spec_id="demo_base",
        hypothesis_id=1,
        script_path=script,
        config={"k": 16, "steps": 4, "sleep_s": 0.0},
        seed=7,
        wall_timeout_s=15.0,
        memory_cap_mb=256,
        metric_keys=["perplexity", "final_loss"],
    )
    runner = ExperimentRunner()
    base_result = runner.run(base)
    sweep = AblationRunner(runner).sweep(base, "k", [4, 8, 16, 32])
    print(json.dumps({
        "base": base_result.to_dict(),
        "ablation": sweep.to_dict(),
    }, indent=2))


if __name__ == "__main__":
    _demo()
