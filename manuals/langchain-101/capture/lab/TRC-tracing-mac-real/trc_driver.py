import json
import os
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PY = sys.executable
OUTDIR = HERE
TAG = sys.argv[1]
CONDS = sys.argv[2].split(",")
N = int(sys.argv[3])
PORT = 18951
HANG_TIMEOUT = int(os.environ.get("TRC_TIMEOUT", "900"))

BASE_ENV = {k: v for k, v in os.environ.items() if not k.startswith(("LANGSMITH", "LANGCHAIN"))}


def run(label):
    cond = label.split("#")[0]
    log = OUTDIR / f"{TAG}-{label.replace('#', '-b')}-recorder.jsonl"
    res = OUTDIR / f"{TAG}-{label.replace('#', '-b')}-child.json"
    for p in (log, res):
        if p.exists():
            p.unlink()
    env = dict(BASE_ENV)
    rec = None
    up = subprocess.run(["uptime"], capture_output=True, text=True).stdout.strip()
    mode = {"ok-il": "ok", "ok": "ok", "slow": "slow", "hang": "hang", "e500": "error500", "ok-fg": "ok", "slow-fg": "slow", "ok-flush": "ok", "slow-flush": "slow"}.get(cond)
    if cond != "off":
        env.update(LANGSMITH_TRACING="true", LANGSMITH_API_KEY="dummy-not-a-key", LANGSMITH_PROJECT="t-lab",
                   LANGSMITH_ENDPOINT=f"http://127.0.0.1:{PORT}")
    if cond.endswith("-fg"):
        env["LANGCHAIN_CALLBACKS_BACKGROUND"] = "false"
    if mode:
        rec = subprocess.Popen([PY, str(HERE / "trc_recorder.py"), "--port", str(PORT), "--log", str(log), "--mode", mode, "--delay", "2"],
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        rec.stdout.readline()
    args = [PY, str(HERE / "trc_child_real.py"), str(N), str(res)] + (["--flush"] if cond.endswith("-flush") else []) + (["--interleave"] if cond.endswith("-il") else [])
    t0 = time.time()
    try:
        cp = subprocess.run(args, env=env, capture_output=True, text=True, timeout=HANG_TIMEOUT)
        rc, err = cp.returncode, cp.stderr[-1500:]
    except subprocess.TimeoutExpired:
        rc, err = "timeout", ""
    t_exit = time.time()
    time.sleep(2)
    if rec:
        rec.terminate()
        try:
            rec.wait(5)
        except subprocess.TimeoutExpired:
            rec.kill()
    child = json.loads(res.read_text()) if res.exists() else {}
    reqs = [json.loads(l) for l in log.read_text().splitlines()] if log.exists() else []
    posts = set()
    patches = set()
    for r in reqs:
        posts.update(r.get("posts", []))
        patches.update(r.get("patches", []))
    ms = sorted(t["ms"] for t in child.get("times", [])[1:])
    q = lambda p: ms[min(len(ms) - 1, int(p * (len(ms) - 1) + 0.5))] if ms else None
    summary = {
        "tag": TAG, "cond": cond, "block": label, "n": N, "uptime_before": up, "timeout_s": HANG_TIMEOUT, "rc": rc, "stderr_tail": err[-600:],
        "run_ms_median": q(0.5), "run_ms_p95": q(0.95), "run_ms_max": ms[-1] if ms else None, "run_ms_first": child.get("times", [{}])[0].get("ms") if child.get("times") else None,
        "non_model_ms_first": child.get("times", [{}])[0].get("non_model_ms") if child.get("times") else None,
        "non_model_ms_median_after_first": (sorted(t["non_model_ms"] for t in child.get("times", [])[1:]) or [None])[len(child.get("times", [])[1:]) // 2] if child.get("times") else None,
        "import_ms": child.get("import_ms"),
        "ok_runs": sum(t["ok"] for t in child.get("times", [])), "n_errors": child.get("n_errors"), "errors": child.get("errors"),
        "flush_ms": child.get("flush_ms"),
        "exit_lag_s": round(t_exit - child["last_run_end_epoch"], 3) if child else None,
        "child_wall_s": round(t_exit - t0, 3),
        "requests": len(reqs), "requests_by_path": {},
        "runs_posted": len(posts), "runs_patched": len(patches),
        "expected_runs": 7 * N,
        "posts_per_request": [len(r.get("posts", [])) for r in reqs if r["method"] == "POST"],
        "patches_per_request": [len(r.get("patches", [])) for r in reqs if r["method"] == "POST"],
        "times": child.get("times"),
    }
    for r in reqs:
        k = f"{r['method']} {r['path']}"
        summary["requests_by_path"][k] = summary["requests_by_path"].get(k, 0) + 1
    print(json.dumps(summary), flush=True)
    with open(OUTDIR / f"{TAG}-summary.jsonl", "a") as f:
        f.write(json.dumps(summary) + "\n")


for c in CONDS:
    run(c)
