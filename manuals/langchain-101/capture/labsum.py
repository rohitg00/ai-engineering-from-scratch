import json
import os
import re
import statistics
import tempfile

HERE = os.path.dirname(os.path.realpath(__file__))
LAB = os.path.join(HERE, "lab")
SUMMARY = os.path.join(LAB, "summary")
MAC = "the Mac: Apple M1 Max, 10 cores, 64 GiB, macOS 26.2, Python 3.13.12"
X86 = "an x86 server guest: 32 vCPU, 48 GiB, Ubuntu 24.04, Python 3.13.18"


def rows(rel):
    with open(os.path.join(LAB, rel), encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def r(value, digits=3):
    return round(float(value), digits)


def median(values):
    return r(statistics.median(values))


def import_times():
    rel = "T01-overhead-mac/06-import-times.jsonl"
    names = {"baseline_pass": "pass", "openai": "import openai", "langgraph_only": "langgraph StateGraph", "langchain_stack": "create_agent and ChatOpenAI"}
    targets = {}
    for row in rows(rel):
        entry = targets.setdefault(row["target"], {"label": names[row["target"]], "warm": [], "cold": []})
        entry["warm" if row["kind"] == "warm" else "cold"].append(r(row["s"]))
    for entry in targets.values():
        entry["warm_median"] = median(entry["warm"])
        entry["cold_median"] = median(entry["cold"])
        entry["n"] = len(entry["warm"])
    return {"machine": MAC, "unit": "seconds", "cold": "an empty PYTHONPYCACHEPREFIX, so no bytecode; the OS file cache was not purged", "sources": [f"capture/lab/{rel}"], "targets": targets}


def install_size():
    rel = "T01-overhead-mac/07-install-size.txt"
    with open(os.path.join(LAB, rel), encoding="utf-8") as handle:
        text = handle.read()
    counts = {name: int(n) for name, n in re.findall(r"## (venv_\w+): packages=\s*(\d+)", text)}
    sizes = {name: int(k) for name, k in re.findall(r"(venv_\w+) (\d+) KiB", text.split("Measured before any import")[1])}
    return {"machine": MAC, "method": "fresh uv venvs with the lockfile as constraints, du -sk of site-packages before any import", "sources": [f"capture/lab/{rel}"], "venvs": {name: {"packages": counts[name], "site_packages_kib": sizes[name]} for name in counts}}


def overhead():
    out = {"machine": MAC, "unit": "milliseconds of wall time for one run of three model calls", "sources": ["capture/lab/T01-overhead-mac/02-stub-runs.jsonl", "capture/lab/T01-overhead-mac/04-ollama-runs.jsonl", "capture/lab/T01-overhead-mac/09-request-body-diff.txt"]}
    for key, rel in (("stub", "T01-overhead-mac/02-stub-runs.jsonl"), ("ollama", "T01-overhead-mac/04-ollama-runs.jsonl")):
        variants = {}
        for row in rows(rel):
            if row.get("warmup") or "t_end_ns" not in row:
                continue
            entry = variants.setdefault(row["variant"], {"wall_ms": [], "ok": 0})
            entry["wall_ms"].append(r((row["t_end_ns"] - row["t_start_ns"]) / 1e6, 2))
            entry["ok"] += 1 if row["ok"] else 0
        for entry in variants.values():
            entry["n"] = len(entry["wall_ms"])
            entry["median_ms"] = r(statistics.median(entry["wall_ms"]), 2)
            del entry["wall_ms"]
        out[key] = variants
    return out


def retries():
    timeouts = {(row["fault"], row["config"]) for row in rows("T05-retries-mac/04-timeouts-arrival-count.jsonl")}
    cells = {}
    files = ["01-model-faults.jsonl", "02-tool-faults.jsonl", "03-both-faults.jsonl", "04-timeouts-arrival-count.jsonl"]
    for name in files:
        for row in rows(f"T05-retries-mac/{name}"):
            key = (row["fault"], row["config"])
            if key in timeouts and name != "04-timeouts-arrival-count.jsonl":
                continue
            cell = cells.setdefault(f"{row['fault']} {row['config']}", {"fault": row["fault"], "config": row["config"], "model_attempts": [], "tool_attempts": [], "tool_executions": [], "outcomes": []})
            cell["model_attempts"].append(row["wire_model_attempts"])
            cell["tool_attempts"].append(row["wire_tool_attempts"])
            cell["tool_executions"].append(row["tool_executions"])
            cell["outcomes"].append(row["outcome"])
    return {"machine": MAC, "note": "timeout cells come from 04, which counts arrivals at the stub", "sources": [f"capture/lab/T05-retries-mac/{name}" for name in files], "cells": dict(sorted(cells.items()))}


def crash_resume():
    out = {"machine": MAC, "trials_per_cell": 5, "sources": []}
    for key, name in (("graph", "01-graph-matrix.jsonl"), ("agent", "02-agent-matrix.jsonl"), ("graph_idempotent", "03-graph-idempotent.jsonl")):
        rel = f"T02-crash-resume-mac/{name}"
        out["sources"].append(f"capture/lab/{rel}")
        data = rows(rel)
        cells = {}
        for row in data:
            cell = cells.setdefault(f"{row['saver']} {row['durability']} {row['kill_point']}", {"trials": 0, "killed": 0, "twice": 0})
            cell["trials"] += 1
            cell["killed"] += 1 if row["killed"] else 0
            cell["twice"] += 1 if row["effects_total"] > 1 else 0
        out[key] = {"trials": len(data), "twice": sum(cell["twice"] for cell in cells.values()), "cells": dict(sorted(cells.items()))}
    return out


def recursion():
    rel = "T17-claims-mac/01-recursion-limit.jsonl"
    cases = {}
    for row in rows(rel):
        if row["case"] == "constants":
            cases["constants"] = {key: value for key, value in row.items() if key != "case"}
        elif row["case"] == "create_agent_bound_config":
            cases[row["case"]] = {"recursion_limit": row["config"]["recursion_limit"]}
        else:
            limit = int(re.search(r"Recursion limit of (\d+)", row["message_first_line"]).group(1))
            cases[row["case"]] = {"limit_reached": limit, "model_calls": row["counts"]["model"], "tool_calls": row["counts"]["tool"], "loop_steps": row["counts"]["loop"], "wall_s": row["wall_s"]}
    return {"machine": MAC, "runs_per_case": 1, "sources": [f"capture/lab/{rel}"], "cases": cases}


def checkpoint_cost():
    cells = {}
    files = ["01-steps.jsonl", "02-steps-5000.jsonl"]
    for name in files:
        for row in rows(f"T03-checkpoint-cost-x86/{name}"):
            cell = cells.setdefault(f"{row['saver']} {row['channel']} {row['steps']}", {"saver": row["saver"], "channel": row["channel"], "steps": row["steps"], "put_ms_last10_p50": [], "thread_mb": []})
            cell["put_ms_last10_p50"].append(r(row["put_ms_last10"]["p50"], 2))
            cell["thread_mb"].append(r(row["storage"]["thread_bytes"] / 1e6, 2))
    return {"machine": X86, "durability": "sync", "message_chars_per_step": 400, "sources": [f"capture/lab/T03-checkpoint-cost-x86/{name}" for name in files], "cells": dict(sorted(cells.items()))}


def agent_server():
    recursion_rows = rows("T15-agent-server-x86/02-recursion.jsonl")
    worker_rows = rows("T15-agent-server-x86/03-workers.jsonl")
    with open(os.path.join(LAB, "T15-agent-server-x86/10-up-license-excerpt.txt"), encoding="utf-8") as handle:
        first = handle.readline().strip()
    return {
        "machine": X86,
        "server": "langgraph dev, langgraph-cli 0.4.43, langgraph-api 0.18.0, in-memory runtime",
        "sources": ["capture/lab/T15-agent-server-x86/02-recursion.jsonl", "capture/lab/T15-agent-server-x86/03-workers.jsonl", "capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt"],
        "recursion": [{"config": row["config"], "steps_in_state": row["n_in_state"], "status": row["run_status"]} for row in recursion_rows],
        "workers": [{"server": row["server"], "background_runs": row["background_runs"], "seconds_per_run": row["seconds_per_run"], "max_inflight": row["max_inflight"], "wall_s": r(row["wall_s"], 1)} for row in worker_rows],
        "langgraph_up": first,
    }


SUMMARIES = {
    "import-times-mac.json": import_times,
    "install-size-mac.json": install_size,
    "overhead-mac.json": overhead,
    "retries-mac.json": retries,
    "crash-resume-mac.json": crash_resume,
    "recursion-mac.json": recursion,
    "checkpoint-cost-x86.json": checkpoint_cost,
    "agent-server-x86.json": agent_server,
}


def write(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for name, build in SUMMARIES.items():
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as handle:
            json.dump(build(), handle, indent=1, sort_keys=True)
            handle.write("\n")
    return sorted(SUMMARIES)


def check():
    drift = []
    with tempfile.TemporaryDirectory(prefix="lc101-lab-") as fresh:
        for name in write(fresh):
            old = os.path.join(SUMMARY, name)
            if not os.path.exists(old):
                drift.append(f"lab/summary/{name}: missing")
                continue
            with open(old, encoding="utf-8") as a, open(os.path.join(fresh, name), encoding="utf-8") as b:
                if a.read() != b.read():
                    drift.append(f"lab/summary/{name}: differs from the recordings")
    return drift
