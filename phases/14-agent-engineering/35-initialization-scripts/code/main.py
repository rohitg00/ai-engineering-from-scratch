"""Deterministic agent initialization script.

Runs five probes (runtime, deps, test command, env, state freshness),
writes init_report.json next to the state file, and exits non-zero
when any block-severity probe fails.

Run: python3 code/main.py
"""

from __future__ import annotations

import importlib.util
import json
import os
import shutil
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

HERE = Path(__file__).parent
WORK = HERE / "workdir"
STATE_PATH = WORK / "agent_state.json"
REPORT_PATH = WORK / "init_report.json"

REQUIRED_PYTHON = (3, 10)
REQUIRED_DEPS = ["json", "dataclasses"]
REQUIRED_TEST_COMMAND = "python3"
REQUIRED_ENV_VARS: list[str] = []
STATE_FRESHNESS_SECONDS = 24 * 60 * 60


@dataclass
class Probe:
    name: str
    status: str
    detail: str


def probe_runtime() -> Probe:
    major, minor = sys.version_info[:2]
    if (major, minor) >= REQUIRED_PYTHON:
        return Probe("runtime", "pass", f"python {major}.{minor}")
    return Probe("runtime", "fail", f"need >= {REQUIRED_PYTHON}, have {major}.{minor}")


def probe_dependencies() -> Probe:
    missing = [dep for dep in REQUIRED_DEPS if importlib.util.find_spec(dep) is None]
    if missing:
        return Probe("dependencies", "fail", f"missing: {missing}")
    return Probe("dependencies", "pass", f"all of {REQUIRED_DEPS} importable")


def probe_test_command() -> Probe:
    if shutil.which(REQUIRED_TEST_COMMAND):
        return Probe("test_command", "pass", f"{REQUIRED_TEST_COMMAND} resolvable on PATH")
    return Probe("test_command", "fail", f"{REQUIRED_TEST_COMMAND} not on PATH")


def probe_env() -> Probe:
    missing = [k for k in REQUIRED_ENV_VARS if not os.environ.get(k)]
    if missing:
        return Probe("env", "fail", f"missing env vars: {missing}")
    return Probe("env", "pass", f"all of {REQUIRED_ENV_VARS or '[]'} present")


def probe_state_freshness() -> Probe:
    if not STATE_PATH.exists():
        return Probe("state_freshness", "warn", "no state file yet; first run")
    age = time.time() - STATE_PATH.stat().st_mtime
    if age > STATE_FRESHNESS_SECONDS:
        hours = int(age // 3600)
        return Probe("state_freshness", "warn", f"state is {hours}h old; confirm before continuing")
    return Probe("state_freshness", "pass", f"state is {int(age)}s old")


def run_probes() -> list[Probe]:
    return [probe_runtime(), probe_dependencies(), probe_test_command(), probe_env(), probe_state_freshness()]


def main() -> int:
    WORK.mkdir(exist_ok=True)
    probes = run_probes()
    report = {
        "timestamp": time.time(),
        "probes": [asdict(p) for p in probes],
        "ok": all(p.status != "fail" for p in probes),
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n")

    width = max(len(p.name) for p in probes)
    for p in probes:
        print(f"  {p.name:<{width}}  {p.status:>4}  {p.detail}")

    if not report["ok"]:
        print("\ninit failed; refuse to launch agent", file=sys.stderr)
        return 1
    print("\ninit ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
