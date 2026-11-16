import json
import statistics
import sys
from datetime import datetime
from pathlib import Path

R = Path("runs/2026-11-15-real")
LABELS = {"qwen3-4b": "Qwen3 4B", "qwen3-14b": "Qwen3 14B", "haiku": "Claude Haiku 5.5"}


def load(path):
    return json.loads(Path(path).read_text())


def ts(text):
    return datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp()


def evals(out):
    suite = load(R / "summary" / "suite-mac.json")
    causes = load("scripts/causes.json")
    models = []
    for key in ("qwen3-4b", "qwen3-14b", "haiku"):
        reps = suite.get(key, [])
        models.append({"key": key, "label": LABELS[key],
                       "reps": [{"rep": r["rep"], "passed": r["passed"], "total": r["total"],
                                 "uptime": [l for l in r["block"] if l.startswith("# uptime")],
                                 "cases": {n: c["outcome"] for n, c in r["cases"].items()},
                                 "seconds": {n: c["seconds"] for n, c in r["cases"].items()}} for r in reps]})
    (out / "evals-mac.json").write_text(json.dumps({"models": models, "causes": causes}, indent=1))


def crash(out):
    result = {}
    for form in ("map", "plain"):
        path = R / f"crash-{form}" / "crash-trials.json"
        if path.exists():
            rows = load(path)
            result[form] = [{k: r.get(k) for k in ("trial", "outcome", "refund_committed_before_kill", "kill_exit_code",
                                                  "approve_client_error", "rows_after_kill", "after_restart_next",
                                                  "approval_re_asked", "replayed_flags", "refunded_cents", "final_next", "marks",
                                                  "uptime_before")} | {"refund_rows": len(r.get("refund_rows") or []),
                                                                       "first_tool_calls": [c["name"] for c in r.get("first_tool_calls", [])],
                                                                       "resumed_tool_calls": [c["name"] for c in r.get("resumed_tool_calls", [])]}
                            for r in rows]
    trial = R / "crash-map"
    timeline = []
    for name in ("t01-before-kill", "t01-after-restart"):
        log = trial / f"{name}.log.jsonl"
        if log.exists():
            for line in log.read_text().splitlines():
                e = json.loads(line)
                timeline.append({"file": name, "ts": e["ts"], "event": e["event"],
                                 **{k: e[k] for k in ("status", "tool", "seconds") if k in e}})
        spans = trial / f"{name}.spans.jsonl"
        if spans.exists():
            for line in spans.read_text().splitlines():
                s = json.loads(line)
                timeline.append({"file": name, "span": s["name"], "start": ts(s["start_time"]), "end": ts(s["end_time"]),
                                 "status": s["status"]["status_code"]})
    result["trial1_timeline"] = timeline
    (out / "crash-mac.json").write_text(json.dumps(result, indent=1))


def drain(out):
    path = R / "drain" / "drain-trials.json"
    if path.exists():
        (out / "drain-mac.json").write_text(json.dumps(load(path), indent=1))


def stream(out):
    base = R / "stream-warm" if (R / "stream-warm" / "stream-events.jsonl").exists() else R / "stream"
    path = base / "stream-events.jsonl"
    if not path.exists():
        return
    lines = [json.loads(l) for l in path.read_text().splitlines()]
    spans = [json.loads(l) for l in (base / "stream.spans.jsonl").read_text().splitlines() if l]
    spans = [{"name": s["name"], "start": ts(s["start_time"]), "end": ts(s["end_time"]),
              "attributes": {k: v for k, v in s["attributes"].items() if k.startswith(("gen_ai", "tool", "run"))},
              "status": s["status"]["status_code"], "trace_id": s["context"]["trace_id"]} for s in spans]
    events = []
    for l in lines:
        if l.get("kind") == "token":
            continue
        events.append(l)
    turns = {}
    for l in lines:
        if "turn" in l and l.get("kind") == "token":
            t = turns.setdefault(l["turn"], {"tokens": 0, "first_ms": l["t_ms"], "last_ms": l["t_ms"]})
            t["tokens"] += 1
            t["last_ms"] = l["t_ms"]
    cold = [json.loads(l) for l in (R / "stream" / "stream-events.jsonl").read_text().splitlines()]
    cold = [l for l in cold if l.get("kind") not in ("token",)]
    (out / "stream-mac.json").write_text(json.dumps({"source": base.name, "events": events, "token_runs": turns,
                                                     "spans": spans, "cold_capture": cold}, indent=1))


def disconnect(out):
    path = R / "disconnect" / "disconnect-trials.json"
    if path.exists():
        (out / "disconnect-mac.json").write_text(json.dumps(load(path), indent=1))


def service(out):
    path = R / "service" / "service-properties.json"
    if path.exists():
        (out / "service-mac.json").write_text(json.dumps(load(path), indent=1))


def loadtest(out):
    path = R / "load" / "load-summary.json"
    if not path.exists():
        return
    cells = load(path)
    def server_side(folder, cell):
        from collections import Counter
        name = f"load-{cell['workers']}w-{cell['users']}u-{int(cell['model_latency_s'] * 1000)}ms"
        ends = Counter()
        for log in folder.glob(f"{name}-w*.log.jsonl"):
            for line in log.read_text().splitlines():
                e = json.loads(line)
                if e["event"] == "run.end":
                    ends[e["status"]] += 1
        rows = load(folder / f"{name}.rows.json")
        cell["server_run_end"] = dict(ends)
        cell["runs_per_s_exact"] = round(cell["ok"] / cell["wall_s"], 3)
        cell["client_errors"] = dict(Counter(r.get("error") for r in rows if r["kind"] == "error"))
        cell["run_seconds"] = sorted(round(r["seconds"], 3) for r in rows if r.get("seconds") is not None)

    for cell in cells:
        server_side(R / "load", cell)
    extra = {"baseline": []}
    for p in sorted(R.glob("load-baseline-*/load-summary.json")):
        for cell in load(p):
            rows = load(p.parent / "load-1w-1u-0ms.rows.json")
            cell["run_seconds"] = [round(r["seconds"], 3) for r in rows if r.get("seconds") is not None]
            cell["run_kinds"] = [r["kind"] for r in rows]
            extra["baseline"].append(cell)
    p = R / "load" / "ollama-parallel.json"
    if p.exists():
        extra["ollama_parallel"] = load(p)
    rerun = R / "load-rerun" / "load-summary.json"
    if rerun.exists():
        for cell in load(rerun):
            server_side(rerun.parent, cell)
            cell["note"] = "rerun: the first 1-worker 10-user cell ran while 12 leaked test servers held Postgres connections"
            i = next(i for i, c in enumerate(cells) if c["workers"] == cell["workers"] and c["users"] == cell["users"])
            extra["replaced_cell"] = cells[i]
            cells[i] = cell
    notes = R / "load-notes.txt"
    if notes.exists():
        extra["notes"] = notes.read_text().splitlines()
    (out / "load-mac.json").write_text(json.dumps({"cells": cells, **extra}, indent=1))


def cost(out):
    path = R / "summary" / "cost-real.json"
    if path.exists():
        data = load(path)
        for m in data["models"].values():
            pass
        (out / "cost-mac.json").write_text(json.dumps(data, indent=1))


FAULTS = {13: "flaky_faq_is_retried", 14: "hung_tool_times_out", 15: "failed_ticket_is_not_retried",
          16: "primary_outage_uses_backup", 17: "runaway_loop_hits_call_limit"}


def faults(out):
    result = {}
    for key in ("qwen3-4b", "qwen3-14b", "haiku"):
        rep = R / "suite" / key / "rep-1"
        if not (rep / "test-spans.jsonl").exists():
            continue
        spans = [json.loads(l) for l in (rep / "test-spans.jsonl").read_text().splitlines() if l]
        owner = {s["context"]["trace_id"]: s["attributes"]["user.id"] for s in spans if s["name"] == "agent.run"}
        rows = {}
        for n, case in FAULTS.items():
            user = f"e{n:02d}"
            mine = [s for s in spans if owner.get(s["context"]["trace_id"]) == user]
            tools = [{"name": s["name"], "error": s["status"]["status_code"] == "ERROR",
                      "ms": round((ts(s["end_time"]) - ts(s["start_time"])) * 1000, 1)}
                     for s in sorted(mine, key=lambda s: s["start_time"]) if s["name"].startswith("tool.")]
            models = [{"model": s["attributes"].get("gen_ai.request.model"), "error": s["status"]["status_code"] == "ERROR"}
                      for s in sorted(mine, key=lambda s: s["start_time"]) if s["name"] == "model.call"]
            record = load(rep / "cases" / f"{n:02d}-{case}.json")
            reply = ""
            for entry in record["log"]:
                if isinstance(entry["result"], list):
                    reply = "".join(d["text"] for e, d in entry["result"] if e == "token")
            runs = [s for s in mine if s["name"] == "agent.run"]
            rows[case] = {"outcome": record["outcome"], "tools": tools, "model_calls": models, "reply": reply,
                          "run_seconds": [round(ts(s["end_time"]) - ts(s["start_time"]), 2) for s in runs]}
        result[key] = rows
    (out / "faults-mac.json").write_text(json.dumps(result, indent=1))


def main(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    for step in (evals, faults, crash, drain, stream, disconnect, service, loadtest, cost):
        try:
            step(out)
            print("ok", step.__name__)
        except FileNotFoundError as exc:
            print("skip", step.__name__, exc.filename)


if __name__ == "__main__":
    main(sys.argv[1])
