"""Deterministic agent initialization script.

Runs probes (runtime, deps, test command, env, state freshness, last-known-good
diff, timing budget), writes init_report.json, supports prereqs.lock TTL
short-circuit, and exits non-zero when any block-severity probe fails.

Run: python3 code/main.py
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

HERE = Path(__file__).parent
WORK = HERE / "workdir"
STATE_PATH = WORK / "agent_state.json"
REPORT_PATH = WORK / "init_report.json"
LOCK_PATH = WORK / "prereqs.lock"
LKG_PATH = WORK / "last_known_good.json"

REQUIRED_PYTHON = (3, 10)
REQUIRED_DEPS = ["json", "dataclasses"]
REQUIRED_TEST_COMMAND = "python3"
REQUIRED_ENV_VARS: list[str] = []
STATE_FRESHNESS_SECONDS = 24 * 60 * 60
LOCK_TTL_SECONDS = 24 * 60 * 60
PROBE_BUDGET_SECONDS = 3.0
LKG_FILE_DIFF_BUDGET = 50


SHA_PATTERN = re.compile(r"^[0-9a-fA-F]{7,40}$")


@dataclass
class Probe:
    name: str
    status: str
    detail: str
    duration_ms: int = 0


def _timed(probe_fn):
    def _wrap(*a, **kw) -> Probe:
        started = time.time()
        result = probe_fn(*a, **kw)
        result.duration_ms = int((time.time() - started) * 1000)
        if result.duration_ms > PROBE_BUDGET_SECONDS * 1000 and result.status == "pass":
            result.status = "warn"
            result.detail = f"{result.detail} (slow: {result.duration_ms}ms > {int(PROBE_BUDGET_SECONDS * 1000)}ms)"
        return result
    return _wrap


@_timed
def probe_runtime() -> Probe:
    major, minor = sys.version_info[:2]
    if (major, minor) >= REQUIRED_PYTHON:
        return Probe("runtime", "pass", f"python {major}.{minor}")
    return Probe("runtime", "fail", f"need >= {REQUIRED_PYTHON}, have {major}.{minor}")


@_timed
def probe_dependencies() -> Probe:
    missing = [dep for dep in REQUIRED_DEPS if importlib.util.find_spec(dep) is None]
    if missing:
        return Probe("dependencies", "fail", f"missing: {missing}")
    return Probe("dependencies", "pass", f"all of {REQUIRED_DEPS} importable")


@_timed
def probe_test_command() -> Probe:
    if shutil.which(REQUIRED_TEST_COMMAND):
        return Probe("test_command", "pass", f"{REQUIRED_TEST_COMMAND} resolvable on PATH")
    return Probe("test_command", "fail", f"{REQUIRED_TEST_COMMAND} not on PATH")


@_timed
def probe_env() -> Probe:
    missing = [k for k in REQUIRED_ENV_VARS if not os.environ.get(k)]
    if missing:
        return Probe("env", "fail", f"missing env vars: {missing}")
    return Probe("env", "pass", f"all of {REQUIRED_ENV_VARS or '[]'} present")


@_timed
def probe_state_freshness() -> Probe:
    if not STATE_PATH.exists():
        return Probe("state_freshness", "warn", "no state file yet; first run")
    age = time.time() - STATE_PATH.stat().st_mtime
    if age > STATE_FRESHNESS_SECONDS:
        hours = int(age // 3600)
        return Probe("state_freshness", "warn", f"state is {hours}h old; confirm before continuing")
    return Probe("state_freshness", "pass", f"state is {int(age)}s old")


@_timed
def probe_lkg_diff() -> Probe:
    """Refuse to launch when diff against last-known-good exceeds the file budget.

    Anchors every session against the same baseline so drift cannot compound.
    """
    if not LKG_PATH.exists():
        return Probe("lkg_diff", "warn", "no last_known_good.json; pin one after first successful merge")
    try:
        lkg = json.loads(LKG_PATH.read_text())
        baseline = lkg.get("commit")
        if not baseline:
            return Probe("lkg_diff", "warn", "lkg file present but commit field empty")
    except json.JSONDecodeError as exc:
        return Probe("lkg_diff", "fail", f"lkg file unreadable: {exc}")
    if not isinstance(baseline, str) or not SHA_PATTERN.match(baseline):
        return Probe("lkg_diff", "warn", "lkg commit invalid; skipped")
    try:
        out = subprocess.run(
            ["git", "diff", "--name-only", baseline, "HEAD"],
            capture_output=True, text=True, timeout=2.0, cwd=HERE,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return Probe("lkg_diff", "warn", "git unavailable or slow; skipped")
    if out.returncode != 0:
        return Probe("lkg_diff", "warn", f"git diff failed: {out.stderr.strip()[:60]}")
    changed = [ln for ln in out.stdout.splitlines() if ln.strip()]
    if len(changed) > LKG_FILE_DIFF_BUDGET:
        return Probe("lkg_diff", "fail", f"{len(changed)} files changed since {baseline[:7]} (budget {LKG_FILE_DIFF_BUDGET})")
    return Probe("lkg_diff", "pass", f"{len(changed)} files changed since {baseline[:7]}")


def _deps_fingerprint() -> str:
    h = hashlib.sha256()
    h.update(str(sorted(REQUIRED_DEPS)).encode())
    h.update(REQUIRED_TEST_COMMAND.encode())
    h.update(str(sorted(REQUIRED_ENV_VARS)).encode())
    h.update(str(REQUIRED_PYTHON).encode())
    return h.hexdigest()[:16]


def lock_is_fresh() -> bool:
    """Cache pattern: re-use prior probe pass when nothing material changed.

    Same shape as Docker layer caches: idempotent probe + content hash = skip.
    """
    if not LOCK_PATH.exists():
        return False
    try:
        lock = json.loads(LOCK_PATH.read_text())
    except json.JSONDecodeError:
        return False
    if not isinstance(lock, dict) or lock.get("fingerprint") != _deps_fingerprint():
        return False
    written_at = lock.get("written_at", 0)
    if not isinstance(written_at, (int, float)):
        try:
            written_at = float(written_at)
        except (TypeError, ValueError):
            return False
    age = time.time() - written_at
    return age < LOCK_TTL_SECONDS


def write_lock() -> None:
    LOCK_PATH.write_text(
        json.dumps({"fingerprint": _deps_fingerprint(), "written_at": time.time()}, indent=2) + "\n"
    )


def run_probes() -> list[Probe]:
    return [
        probe_runtime(),
        probe_dependencies(),
        probe_test_command(),
        probe_env(),
        probe_state_freshness(),
        probe_lkg_diff(),
    ]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-cache", action="store_true", help="ignore prereqs.lock and run every probe")
    ap.add_argument("--write-lkg", action="store_true", help="pin current HEAD as last-known-good")
    args = ap.parse_args(argv)

    WORK.mkdir(exist_ok=True)

    if args.write_lkg:
        try:
            head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=HERE, text=True).strip()
            LKG_PATH.write_text(json.dumps({"commit": head, "written_at": time.time()}, indent=2) + "\n")
            print(f"pinned LKG -> {head[:7]}")
            return 0
        except (FileNotFoundError, subprocess.CalledProcessError) as exc:
            print(f"lkg pin failed: {exc}", file=sys.stderr)
            return 1

    if not args.no_cache and lock_is_fresh():
        print(f"prereqs.lock fresh (TTL {LOCK_TTL_SECONDS}s); skipping probes")
        return 0

    probes = run_probes()
    report = {
        "timestamp": time.time(),
        "probes": [asdict(p) for p in probes],
        "ok": all(p.status != "fail" for p in probes),
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n")

    width = max(len(p.name) for p in probes)
    for p in probes:
        print(f"  {p.name:<{width}}  {p.status:>4}  {p.duration_ms:>4}ms  {p.detail}")

    if not report["ok"]:
        print("\ninit failed; refuse to launch agent", file=sys.stderr)
        return 1
    write_lock()
    print("\ninit ok (lock refreshed)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
