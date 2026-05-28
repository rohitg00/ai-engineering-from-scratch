"""deterministic な agent initialization script。

probes (runtime, deps, test command, env, state freshness, last-known-good
diff, timing budget) を実行し、init_report.json を書き、prereqs.lock TTL
short-circuit を support し、block-severity probe が失敗すると non-zero exit する。

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
    return Probe("runtime", "fail", f">= {REQUIRED_PYTHON} が必要、現在 {major}.{minor}")


@_timed
def probe_dependencies() -> Probe:
    missing = [dep for dep in REQUIRED_DEPS if importlib.util.find_spec(dep) is None]
    if missing:
        return Probe("dependencies", "fail", f"missing: {missing}")
    return Probe("dependencies", "pass", f"{REQUIRED_DEPS} はすべて import 可能")


@_timed
def probe_test_command() -> Probe:
    if shutil.which(REQUIRED_TEST_COMMAND):
        return Probe("test_command", "pass", f"{REQUIRED_TEST_COMMAND} は PATH で解決可能")
    return Probe("test_command", "fail", f"{REQUIRED_TEST_COMMAND} が PATH にない")


@_timed
def probe_env() -> Probe:
    missing = [k for k in REQUIRED_ENV_VARS if not os.environ.get(k)]
    if missing:
        return Probe("env", "fail", f"missing env vars: {missing}")
    return Probe("env", "pass", f"{REQUIRED_ENV_VARS or '[]'} はすべて present")


@_timed
def probe_state_freshness() -> Probe:
    if not STATE_PATH.exists():
        return Probe("state_freshness", "warn", "state file はまだない; first run")
    age = time.time() - STATE_PATH.stat().st_mtime
    if age > STATE_FRESHNESS_SECONDS:
        hours = int(age // 3600)
        return Probe("state_freshness", "warn", f"state は {hours}h old; 続行前に確認")
    return Probe("state_freshness", "pass", f"state は {int(age)}s old")


@_timed
def probe_lkg_diff() -> Probe:
    """last-known-good との差分が file budget を超えたら launch を拒否する。

    drift が compound しないよう、すべての session を同じ baseline に anchor する。
    """
    if not LKG_PATH.exists():
        return Probe("lkg_diff", "warn", "last_known_good.json がない; first successful merge 後に pin する")
    try:
        lkg = json.loads(LKG_PATH.read_text())
        baseline = lkg.get("commit")
        if not baseline:
            return Probe("lkg_diff", "warn", "lkg file はあるが commit field が空")
    except json.JSONDecodeError as exc:
        return Probe("lkg_diff", "fail", f"lkg file を読めない: {exc}")
    if not isinstance(baseline, str) or not SHA_PATTERN.match(baseline):
        return Probe("lkg_diff", "warn", "lkg commit が invalid; skipped")
    try:
        out = subprocess.run(
            ["git", "diff", "--name-only", baseline, "HEAD"],
            capture_output=True, text=True, timeout=2.0, cwd=HERE,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return Probe("lkg_diff", "warn", "git が unavailable または slow; skipped")
    if out.returncode != 0:
        return Probe("lkg_diff", "warn", f"git diff が失敗: {out.stderr.strip()[:60]}")
    changed = [ln for ln in out.stdout.splitlines() if ln.strip()]
    if len(changed) > LKG_FILE_DIFF_BUDGET:
        return Probe("lkg_diff", "fail", f"{baseline[:7]} 以降に {len(changed)} files changed (budget {LKG_FILE_DIFF_BUDGET})")
    return Probe("lkg_diff", "pass", f"{baseline[:7]} 以降に {len(changed)} files changed")


def _deps_fingerprint() -> str:
    h = hashlib.sha256()
    h.update(str(sorted(REQUIRED_DEPS)).encode())
    h.update(REQUIRED_TEST_COMMAND.encode())
    h.update(str(sorted(REQUIRED_ENV_VARS)).encode())
    h.update(str(REQUIRED_PYTHON).encode())
    return h.hexdigest()[:16]


def lock_is_fresh() -> bool:
    """cache pattern: material change がなければ前回の probe pass を再利用する。

    Docker layer caches と同じ形: idempotent probe + content hash = skip。
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
    ap.add_argument("--no-cache", action="store_true", help="prereqs.lock を無視して every probe を実行する")
    ap.add_argument("--write-lkg", action="store_true", help="current HEAD を last-known-good として pin する")
    args = ap.parse_args(argv)

    WORK.mkdir(exist_ok=True)

    if args.write_lkg:
        try:
            head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=HERE, text=True, timeout=2.0).strip()
            LKG_PATH.write_text(json.dumps({"commit": head, "written_at": time.time()}, indent=2) + "\n")
            print(f"LKG を pin -> {head[:7]}")
            return 0
        except (FileNotFoundError, subprocess.CalledProcessError) as exc:
            print(f"lkg pin が失敗: {exc}", file=sys.stderr)
            return 1

    if not args.no_cache and lock_is_fresh():
        print(f"prereqs.lock は fresh (TTL {LOCK_TTL_SECONDS}s); probes を skip")
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
        print("\ninit failed; agent launch を拒否", file=sys.stderr)
        return 1
    write_lock()
    print("\ninit ok (lock refreshed)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
