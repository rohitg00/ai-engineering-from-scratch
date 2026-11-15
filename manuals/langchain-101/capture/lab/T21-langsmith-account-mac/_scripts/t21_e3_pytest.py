import json
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from t21_common import PREFIX, SCRIPTS, T21, child_env, env_snapshot, scrub

PY = str(T21 / "_venv-pytest" / "bin" / "python")
TESTS = SCRIPTS / "t21_tests"
SUITE = PREFIX + "pytest"
EXP = PREFIX + "pytest-exp"


def run_all(out_name):
    base = {"LANGSMITH_TEST_SUITE": SUITE, "LANGSMITH_EXPERIMENT": EXP}
    conds = [("on", base, [], 3), ("on-output", base, ["--langsmith-output"], 3),
             ("on-tracing", {**base, "LANGSMITH_TRACING": "true", "LANGSMITH_PROJECT": PREFIX + "pytest-tracing"}, [], 2)]
    rows = []
    for name, extra, flags, n in conds:
        for rep in range(1, n + 1):
            log = T21 / f"_reqlog-{name}-{rep}.jsonl"
            env = child_env({**extra, "T21_REQLOG": str(log)})
            cmd = [PY, "-m", "pytest", str(TESTS / "test_ls_plugin.py"), "-p", "no:cacheprovider", "-rA", "--color=no", *flags]
            t0 = time.perf_counter()
            try:
                cp = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=600, cwd=str(TESTS))
                rc, so, se = cp.returncode, cp.stdout, cp.stderr
            except subprocess.TimeoutExpired as e:
                rc, so, se = "timeout", str(e.stdout)[-4000:], ""
            wall = time.perf_counter() - t0
            reqs = [json.loads(l) for l in log.read_text().splitlines()] if log.exists() else []
            if log.exists():
                log.unlink()
            (T21 / f"04-e3-{name}-rep{rep}-stdout.txt").write_text(scrub(f"$ pytest {' '.join(cmd[3:])}\nrc={rc} wall={wall:.2f}s\n--- stdout\n{so}\n--- stderr\n{se}"))
            summ = {}
            for r in reqs:
                k = f"{r['method']} {r['path'].replace('https://api.smith.langchain.com', '')} {r['status']}"
                summ[k] = summ.get(k, 0) + 1
            row = {"cond": name, "rep": rep, "rc": rc, "wall_s": round(wall, 2), "summary_line": (so.strip().splitlines() or [""])[-1],
                   "requests_summary": summ, "n_requests": len(reqs), "load1": os.getloadavg()[0], "requests": reqs}
            rows.append(row)
            print(name, rep, rc, round(wall, 1), row["summary_line"][:100], len(reqs), flush=True)
    with open(T21 / out_name, "w") as f:
        f.write(scrub(json.dumps({"kind": "env", **env_snapshot()})) + "\n")
        for r in rows:
            f.write(scrub(json.dumps(r)) + "\n")


def inspect(out_name):
    from langsmith import Client
    c = Client()
    out = {"suite": SUITE}
    ds = c.read_dataset(dataset_name=SUITE)
    out["dataset"] = {"id": str(ds.id), "name": ds.name, "example_count": ds.example_count, "description": ds.description,
                      "metadata": ds.metadata}
    ex = list(c.list_examples(dataset_id=ds.id))
    out["examples"] = [{"inputs": e.inputs, "outputs": e.outputs, "metadata": e.metadata} for e in ex]
    exps = list(c.list_projects(reference_dataset_id=ds.id))
    out["experiments"] = []
    for p in exps:
        runs = list(c.list_runs(project_id=p.id))
        roots = [r for r in runs if not r.parent_run_id]
        fb = list(c.list_feedback(run_ids=[r.id for r in roots])) if roots else []
        by = {}
        for r in runs:
            k = f"{r.run_type}:{r.name}:{'child' if r.parent_run_id else 'root'}"
            by[k] = by.get(k, 0) + 1
        out["experiments"].append({"name": p.name, "id": str(p.id), "n_runs": len(runs), "runs_by_type": by,
                                   "roots": [{"name": r.name, "status": r.status, "error": (r.error or "")[:120], "outputs": r.outputs,
                                              "reference_example": bool(r.reference_example_id)} for r in roots],
                                   "feedback": [{"key": f.key, "score": f.score} for f in fb], "metadata": (p.extra or {}).get("metadata")})
    try:
        tp = c.read_project(project_name=PREFIX + "pytest-tracing")
        out["tracing_project"] = {"name": tp.name, "runs": [f"{r.run_type}:{r.name}:{'child' if r.parent_run_id else 'root'}" for r in c.list_runs(project_id=tp.id)]}
    except Exception as e:
        out["tracing_project"] = {"error": type(e).__name__}
    with open(T21 / out_name, "w") as f:
        f.write(scrub(json.dumps(out, default=str, indent=1)) + "\n")
    print(scrub(json.dumps(out, default=str))[:4000])


if __name__ == "__main__":
    if sys.argv[1] == "run":
        run_all(sys.argv[2])
    else:
        inspect(sys.argv[2])
