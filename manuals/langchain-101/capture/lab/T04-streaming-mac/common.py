import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
PY = sys.executable
SCRIPTS = HERE

os.environ.setdefault("LANGSMITH_TRACING", "false")
os.environ.setdefault("LANGCHAIN_TRACING_V2", "false")


def start_server(port, log, mode="stub", script="add_mul", schedule=None, log_bodies=False, upstream=None, log_arrivals=False):
    cmd = [PY, str(SCRIPTS / "stub_server.py"), "--port", str(port), "--log", str(log), "--mode", mode, "--script", script,
           "--schedule", json.dumps(schedule or {})]
    if log_bodies:
        cmd.append("--log-bodies")
    if log_arrivals:
        cmd.append("--log-arrivals")
    if upstream:
        cmd += ["--upstream", upstream]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    deadline = time.time() + 15
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1) as r:
                if r.status == 200:
                    return proc
        except Exception:
            time.sleep(0.1)
    proc.kill()
    raise RuntimeError("stub server did not start")


def stop_server(proc):
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


def read_jsonl(path):
    p = Path(path)
    if not p.exists():
        return []
    return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]


def pct(xs, q):
    xs = sorted(xs)
    if not xs:
        return float("nan")
    k = (len(xs) - 1) * q
    f = int(k)
    c = min(f + 1, len(xs) - 1)
    return xs[f] + (xs[c] - xs[f]) * (k - f)


def summ(xs):
    return {"n": len(xs), "median": pct(xs, 0.5), "p95": pct(xs, 0.95), "min": min(xs) if xs else None, "max": max(xs) if xs else None}
