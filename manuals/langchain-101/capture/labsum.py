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


def read(rel):
    with open(os.path.join(LAB, rel), encoding="utf-8") as handle:
        return handle.read()


def r(value, digits=3):
    return round(float(value), digits)


def median(values, digits=3):
    return r(statistics.median(values), digits)


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
    text = read(rel)
    counts = {name: int(n) for name, n in re.findall(r"## (venv_\w+): packages=\s*(\d+)", text)}
    sizes = {name: int(k) for name, k in re.findall(r"(venv_\w+) (\d+) KiB", text.split("Measured before any import")[1])}
    return {"machine": MAC, "method": "fresh uv venvs with the lockfile as constraints, du -sk of site-packages before any import", "sources": [f"capture/lab/{rel}"], "venvs": {name: {"packages": counts[name], "site_packages_kib": sizes[name]} for name in counts}}


def overhead():
    out = {"machine": MAC, "unit": "milliseconds of wall time for one run of three model calls", "sources": ["capture/lab/T01-overhead-mac/02-stub-runs.jsonl", "capture/lab/T01-overhead-mac/03-ollama-proxy-usage.jsonl", "capture/lab/T01-overhead-mac/04-ollama-runs.jsonl", "capture/lab/T01-overhead-mac/09-request-body-diff.txt"]}
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
        out[key] = variants
    proxy = rows("T01-overhead-mac/03-ollama-proxy-usage.jsonl")
    calls = {}
    for row in rows("T01-overhead-mac/04-ollama-runs.jsonl"):
        if row.get("warmup") or "t_end_ns" not in row:
            continue
        seen = [p for p in proxy if row["t_start_ns"] <= p["t_recv_ns"] <= row["t_end_ns"]]
        shape = json.dumps([[p["req_bytes"], p["usage"]["prompt_tokens"], p["usage"]["completion_tokens"]] for p in seen])
        entry = calls.setdefault(row["variant"], {})
        entry[shape] = entry.get(shape, 0) + 1
    out["ollama_requests"] = {"per_call": "request bytes, prompt tokens, completion tokens of each of the three model calls, with the number of runs that had that shape", "variants": {variant: [{"calls": json.loads(shape), "runs": n} for shape, n in sorted(shapes.items())] for variant, shapes in sorted(calls.items())}}
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


CRASH_FILES = (("graph", "01-graph-matrix.jsonl"), ("agent", "02-agent-matrix.jsonl"), ("graph_idempotent", "03-graph-idempotent.jsonl"))


def crash_resume():
    out = {"machine": MAC, "trials_per_cell": 5, "sources": []}
    for key, name in CRASH_FILES:
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


def checkpoint_cells(measures):
    files = ["T03-checkpoint-cost-x86/01-steps.jsonl", "T03-checkpoint-cost-x86/02-steps-5000.jsonl"]
    cells = {}
    for rel in files:
        for row in rows(rel):
            cell = cells.setdefault(f"{row['saver']} {row['channel']} {row['steps']}", {"saver": row["saver"], "channel": row["channel"], "steps": row["steps"]})
            for field, measure in measures.items():
                cell.setdefault(field, []).append(measure(row))
    return {"machine": X86, "durability": "sync", "message_chars_per_step": 400, "sources": [f"capture/lab/{rel}" for rel in files], "cells": dict(sorted(cells.items()))}


def checkpoint_cost():
    return checkpoint_cells({
        "put_ms_last10_p50": lambda row: r(row["put_ms_last10"]["p50"], 2),
        "thread_mb": lambda row: r(row["storage"]["thread_bytes"] / 1e6, 2),
    })


def agent_server():
    recursion_rows = rows("T15-agent-server-x86/02-recursion.jsonl")
    worker_rows = rows("T15-agent-server-x86/03-workers.jsonl")
    with open(os.path.join(LAB, "T15-agent-server-x86/10-up-license-excerpt.txt"), encoding="utf-8") as handle:
        first = handle.readline().strip()
    return {
        "machine": X86,
        "server": "langgraph dev, langgraph-cli 0.4.43, langgraph-api 0.18.0, in-memory runtime",
        "sources": ["capture/lab/T15-agent-server-x86/02-recursion.jsonl", "capture/lab/T15-agent-server-x86/03-workers.jsonl", "capture/lab/T15-agent-server-x86/04-double-texting.jsonl", "capture/lab/T15-agent-server-x86/05-load.jsonl", "capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt", "capture/lab/T15-agent-server-x86/12-latency-floor.jsonl"],
        "recursion": [{"config": row["config"], "steps_in_state": row["n_in_state"], "status": row["run_status"]} for row in recursion_rows],
        "workers": [{"server": row["server"], "background_runs": row["background_runs"], "seconds_per_run": row["seconds_per_run"], "max_inflight": row["max_inflight"], "wall_s": r(row["wall_s"], 1)} for row in worker_rows],
        "load_graph": "create_agent with a fake model of 2 calls of 50 ms and 1 tool call; a new thread and runs.wait for each run; one run per level",
        "load": [{"server": row["server"], "concurrency": row["concurrency"], "runs": row["runs"], "ok": row["ok"], "errors": row["errors"], "runs_per_s": r(row["runs_per_s"], 1), "p50_ms": round(row["lat_ms"]["p50"]), "p99_ms": round(row["lat_ms"]["p99"])} for row in rows("T15-agent-server-x86/05-load.jsonl")],
        "latency_floor": {kind: {"n": entry["n"], "client_ms_p50": round(entry["client_ms_p50"]), "server_ms_p50": None if entry["run_created_to_updated_ms_p50"] is None else round(entry["run_created_to_updated_ms_p50"])} for row in rows("T15-agent-server-x86/12-latency-floor.jsonl") for kind, entry in row["results"].items()},
        "double_texting": [{"strategy": row["strategy"], "second_run": "accepted" if row["second_run"]["accepted"] else f"HTTP {row['second_run']['http_status']}: {json.loads(row['second_run']['body'])['detail']}", "first_run_after": row["first_run_status_after"], "done": row["final_state_done"], "history": row["history_len"], "node_events": row["node_events"]} for row in rows("T15-agent-server-x86/04-double-texting.jsonl")],
        "langgraph_up": first,
    }


INTERRUPT_ID = re.compile(r"\b[0-9a-f]{32}\b")


def approvals():
    rel = "T07-approvals-mac/01-cases.jsonl"
    cases = {}
    for row in rows(rel):
        spec = row["spec"]
        cell = cases.setdefault(row["case"], {"app": spec["app"], "mode": spec.get("mode"), "calls": spec.get("calls"), "runs": 0, "tools_run": [], "model_calls": [], "errors": [], "c1_tool_messages": [], "branch_effects": [], "branch_entries": []})
        cell["runs"] += 1
        cell["tools_run"].append(sorted(f"{name} {json.dumps(args, sort_keys=True)} at step {step}" for name, args, step in row["tool_execs"]))
        cell["model_calls"].append(row["model_calls"])
        cell["errors"].append([f"step {rep['step']}: {INTERRUPT_ID.sub('<id>', (rep.get('error') or rep.get('crash')).splitlines()[0])}" for rep in row["reports"] if rep.get("error") or rep.get("crash")])
        last = row["reports"][-1].get("messages") or []
        cell["c1_tool_messages"].append([m[2] for m in last if m[0] == "tool" and m[4] == "c1"])
        cell["branch_effects"].append(row["branch_effects"])
        cell["branch_entries"].append(row["branch_entries"])
    return {"machine": MAC, "runs_per_case": 3, "saver": "SqliteSaver, with the start and each resume in a new process", "sources": [f"capture/lab/{rel}"], "cases": dict(sorted(cases.items()))}


def replay_fork():
    rel = "T17-claims-mac/02-replay-and-fork.jsonl"
    data = {row["case"]: row for row in rows(rel)}
    full = sorted(data["abc_full_history_after_all"]["history"], key=lambda row: row["checkpoint_id"])
    label = {row["checkpoint_id"]: f"c{i}" for i, row in enumerate(full)}
    tree = [{"id": label[row["checkpoint_id"]], "parent": label.get(row["parent"]), "step": row["step"], "source": row["source"], "next": row["next"], "x": row["values"].get("x"), "trail": row["values"]["trail"]} for row in full]
    update = data["abc_update_state_on_before_b"]
    cases = {
        "graph_first_run": {"runs": data["abc_initial_run"]["counts"], "checkpoints": len(data["abc_initial_run"]["history"])},
        "graph_replay_before_b": {"runs": data["abc_replay_from_before_b"]["counts"], "checkpoints_before": data["abc_replay_from_before_b"]["history_len_before"], "checkpoints_after": data["abc_replay_from_before_b"]["history_len_after"], "new_sources": [row["source"] for row in data["abc_replay_from_before_b"]["new_checkpoints"]]},
        "update_state_thread_and_checkpoint_id_only": data["update_state_with_thread_and_checkpoint_id_only"]["result"],
        "update_state_before_b": {"runs": update["counts_during_update_state"], "source": update["fork_row"]["source"], "step": update["fork_row"]["step"], "parent_is_before_b": update["fork_parent_is_before_b"], "originals_kept": update["original_checkpoints_still_present"], "checkpoints_after": update["history_len_after"]},
        "graph_continue_from_fork": {"runs": data["abc_continue_from_fork"]["counts"], "output": data["abc_continue_from_fork"]["output"], "checkpoints_after": data["abc_continue_from_fork"]["history_len_after"]},
        "agent_first_run": {"runs": data["agent_initial_run"]["counts"], "checkpoints": len(data["agent_initial_run"]["history"])},
        "agent_replay_from_step_0": {"runs": data["agent_replay_from_first_next_model"]["counts"]},
        "agent_replay_from_step_1": {"runs": data["agent_replay_from_next_tools"]["counts"]},
    }
    return {"machine": MAC, "runs_per_case": 1, "saver": "InMemorySaver", "sources": [f"capture/lab/{rel}"], "cases": cases, "tree": tree}


def crash_next():
    out = {"machine": MAC, "trials_per_cell": 5, "sources": []}
    for key, name in CRASH_FILES:
        rel = f"T02-crash-resume-mac/{name}"
        out["sources"].append(f"capture/lab/{rel}")
        cells = {}
        killed = empty = 0
        for row in rows(rel):
            report = row.get("resume_report") or {}
            crash = report.get("at_crash") or {}
            cell = cells.setdefault(f"{row['saver']} {row['durability']} {row['kill_point']}", {"history_len_at_crash": [], "empty_next_unfinished": 0})
            cell["history_len_at_crash"].append(crash.get("history_len"))
            if row["killed"]:
                killed += 1
                if report.get("resume_action") == "invoke_none_with_empty_next":
                    empty += 1
                    cell["empty_next_unfinished"] += 1
        out[key] = {"killed": killed, "empty_next_unfinished": empty, "cells": dict(sorted(cells.items()))}
    return out


def concurrency():
    rel = "T16-concurrency-x86/01-levels.jsonl"
    multi = "T16-concurrency-x86/02-multiprocess.jsonl"
    cells = {}
    for row in rows(rel):
        cell = cells.setdefault(f"{row['config']} {row['level']}", {"config": row["config"], "threads": row["level"], "steps_per_s": [], "step_p50_ms": [], "step_p99_ms": [], "pg_conns_max": [], "errors": [], "client_cpu_pct": []})
        cell["steps_per_s"].append(r(row["steps_per_s"], 1))
        cell["step_p50_ms"].append(r(row["step_ms"]["p50"], 1))
        cell["step_p99_ms"].append(r(row["step_ms"]["p99"], 1))
        cell["pg_conns_max"].append(row["pg_conns"]["max"])
        cell["errors"].append(row["errors"])
        cell["client_cpu_pct"].append(round(row["client_cpu_pct"]))
    processes = []
    for row in rows(multi):
        entry = {"processes": row["processes"], "threads": row["total_threads"], "steps_per_s_sum_of_processes": r(row["steps_per_s_sum_of_procs"], 0), "steps_per_s_with_startup": r(row["steps_per_s_outer"], 0), "errors": row["errors"]}
        if row["processes"] < 16:
            entry["pg_conns_max"] = row["pg_conns_max_total"]
        processes.append(entry)
    return {
        "machine": X86,
        "saver": "AsyncPostgresSaver on PostgreSQL 16.15, max_connections=100",
        "run": "5 steps per run, a fake model of 20 ms per step, 4 runs per thread, default durability",
        "reps_per_cell": 2,
        "not_used": "pg_conns_max of the two 16-process rows, because Postgres refused the monitor connection",
        "sources": [f"capture/lab/{rel}", f"capture/lab/{multi}", "capture/lab/T16-concurrency-x86/00-pg-settings.txt"],
        "cells": dict(sorted(cells.items(), key=lambda item: (item[1]["config"], item[1]["threads"]))),
        "multiprocess": processes,
    }


def long_threads():
    variants = {}
    files = ["01-turns-none.jsonl", "01-turns-msgs60_keep7.jsonl", "01-turns-tok6000_keep1500.jsonl", "01-turns-msgs20_keep1.jsonl"]
    for name in files:
        data = rows(f"T10-long-threads-x86/{name}")
        turns = [row for row in data if "turn" in row]
        final = next(row for row in data if row.get("final"))
        windows = []
        for start in range(0, len(turns), 100):
            part = turns[start:start + 100]
            windows.append({"turns": f"{part[0]['turn']}-{part[-1]['turn']}", "latency_p50_ms": median([row["latency_ms"] for row in part]), "request_messages_max": max(row["req_msgs_max"] for row in part), "request_tokens_max": max(row["req_tokens_max"] for row in part)})
        variants[turns[0]["variant"]] = {
            "turns": len(turns),
            "model_calls": final["total_model_calls"],
            "summary_calls": final["summary_calls"],
            "final_state_messages": final["final_state_msgs"],
            "requests_with_orphan_tool_messages": final["total_problem_requests"],
            "final_state_problems": len(final["final_state_problems"]),
            "windows": windows,
            "storage": [{"turn": row["turn"], "thread_mb": r(row["pg"]["thread_bytes"] / 1e6, 2), "checkpoint_rows": row["pg"]["checkpoints"]["rows"]} for row in turns if "pg" in row],
            "rss_mb": [{"turn": row["turn"], "mb": round(row["rss_mb"])} for row in turns if row["turn"] in (1, 500, 1000, 2000) and "rss_mb" in row],
        }
    return {"machine": X86, "saver": "PostgresSaver on PostgreSQL 16.15, default durability", "run": "create_agent with a fake model, 2,000 turns in one thread, turns rotate a plain answer, one tool call, and two parallel tool calls", "runs_per_variant": 1, "sources": [f"capture/lab/T10-long-threads-x86/{name}" for name in files], "variants": variants}


def serde():
    out = {"machine": MAC, "runs_per_case": 1, "sources": []}
    for key, name in (("load_default", "01-serde-default.jsonl"), ("load_strict_msgpack", "02-serde-strict-msgpack.jsonl")):
        rel = f"T13-serde-mac/{name}"
        out["sources"].append(f"capture/lab/{rel}")
        out[key] = [{"case": row["case"], "advisory": row["advisory"], "ran_code": bool(row["marker_files"]), "secret_leaked": row["secret_leaked"]} for row in rows(rel) if "case" in row]
    rel = "T13-serde-mac/03-round-trip.jsonl"
    out["sources"].append(f"capture/lab/{rel}")
    trips = []
    for row in rows(rel):
        if "case" not in row:
            continue
        entry = {"case": row["case"], "before": row["before"]["type"]}
        for path in ("serde", "sqlite_graph"):
            got = row[path]
            if "raised" in got:
                entry[path] = {"raised": got["raised"]}
            else:
                entry[path] = {"after": got["after"]["type"], "same_type": got["same_type"], "equal": got["equal"]}
                for extra in ("same_tzinfo_type", "same_fold"):
                    if extra in got:
                        entry[path][extra] = got[extra]
        trips.append(entry)
    out["round_trip"] = trips
    out["round_trip_changed"] = sorted(t["case"] for t in trips if "raised" in t["sqlite_graph"] or not (t["sqlite_graph"]["same_type"] and t["sqlite_graph"]["equal"] is True and t["sqlite_graph"].get("same_tzinfo_type", True)))
    return out


def stores():
    backends = {}
    files = ["01-memory-sqlite.jsonl", "03-postgres.jsonl", "04-index.jsonl"]
    for name in files:
        for row in rows(f"T14-stores-mac/{name}"):
            if "case" not in row:
                continue
            entry = backends.setdefault(row["backend"], {"owner_searches": 0, "owner_searches_crossing": 0, "cases": {}})
            match = re.match(r"search\(\('users','(.*)'\)\) owners$", row["case"])
            if match:
                entry["owner_searches"] += 1
                entry["owner_searches_crossing"] += 1 if any(owner != match.group(1) for owner, _ in row["result"]) else 0
                continue
            result = row.get("result", row.get("raised"))
            if isinstance(result, list) and result and all(isinstance(item, str) for item in result):
                result = {"count": len(result), "distinct": len(set(result))}
            entry["cases"][row["case"]] = result if "raised" not in row else {"raised": row["raised"].split(":")[0]}
    return {"machine": MAC, "runs_per_case": 1, "users": ["alice", "alice2", "a_ice", "%", "*", "al?ce", "[a]lice", "bob"], "sources": [f"capture/lab/T14-stores-mac/{name}" for name in files], "backends": backends}


def checkpoint_reads():
    return checkpoint_cells({
        "ms_per_step": lambda row: r(row["ms_per_step"], 2),
        "get_state_ms_best_of_3": lambda row: r(min(row["get_state_ms"]), 2),
        "serialized_bytes_last_put": lambda row: row["serialized_bytes_last_put"],
    })


def structured_output():
    folder = "T06-structured-output-mac"
    runs = [row for row in rows(f"{folder}/01-ollama-runs.jsonl") if row["model"] == "qwen3:0.6b"] + rows(f"{folder}/03-ollama-seq-n10.jsonl")
    cells = {}
    for row in runs:
        cell = cells.setdefault(f"{row['model']} {row['schema']} {row['strategy']}", {"model": row["model"], "schema": row["schema"], "strategy": row["strategy"], "outcomes": [], "model_calls": [], "correct": [], "errors": {}})
        cell["outcomes"].append(row["outcome"])
        cell["model_calls"].append(row.get("model_calls", 0))
        cell["correct"].append(row.get("correct"))
        if row["outcome"] == "raised":
            kind = "build: " + row["error"].split(" <")[0] if row.get("stage") == "create_agent" else row.get("error_type")
            cell["errors"][kind] = cell["errors"].get(kind, 0) + 1
    failures = {}
    for cell in cells.values():
        for scope in ("all", "without_union"):
            if scope == "without_union" and cell["schema"] == "union":
                continue
            entry = failures.setdefault(cell["model"], {}).setdefault(cell["strategy"], {}).setdefault(scope, {"failed": 0, "runs": 0})
            entry["runs"] += len(cell["outcomes"])
            entry["failed"] += sum(1 for outcome in cell["outcomes"] if outcome in ("raised", "missing"))
    for model in failures.values():
        for strategy in model.values():
            for entry in strategy.values():
                entry["pct"] = round(100 * entry["failed"] / entry["runs"])
    enum_correct = {key: {"with_structured_response": sum(1 for c in cell["correct"] if c is not None), "agreed_with_labels": sum(1 for c in cell["correct"] if c is True)} for key, cell in cells.items() if cell["schema"] == "enum"}
    fakes = [{"case": row["case"], "outcome": row["outcome"], "error_type": row.get("error_type"), "model_calls": row.get("model_calls"), "requests": len(row.get("requests") or []) or None} for row in rows(f"{folder}/02-d209-fake-and-stub.jsonl")]
    return {
        "machine": MAC,
        "model_settings": "ChatOllama with temperature 0, seed 42, reasoning off, num_predict 512; create_agent with tools=[] and recursion_limit 10 per run",
        "runs_per_cell": {"qwen3:0.6b": 20, "qwen3:1.7b": 10, "qwen3:4b-instruct-2507-q4_K_M": 10, "qwen3:8b": 10},
        "not_used": "the qwen3:1.7b rows of 01, which ran beside other processes that made Ollama fail; 03 holds the same cells run one at a time",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("01-ollama-runs.jsonl", "02-d209-fake-and-stub.jsonl", "03-ollama-seq-n10.jsonl", "t06_schemas.py", "t06_run.py", "t06_d209.py")],
        "runs": len(runs),
        "cells": dict(sorted(cells.items())),
        "failure_rate": failures,
        "enum_correct": dict(sorted(enum_correct.items())),
        "fake_and_stub": fakes,
    }


def tokens():
    folder = "T09-tokens-mac"
    base = {}
    for name in ("02-baseprompt-0.6.12.jsonl", "01-baseprompt-0.7.38.jsonl"):
        for row in rows(f"{folder}/{name}"):
            base[f"{row['deepagents']} {row['model']}"] = {
                "tools": row["tools"],
                "system_chars": row["system_chars"],
                "system_tokens_o200k": row["system_tokens"]["o200k_base"],
                "tool_schema_tokens_o200k": row["tool_schema_json_tokens"]["o200k_base"],
                "system_plus_schema_tokens": row["system_plus_schema_tokens"],
                "tool_description_tokens_o200k": row["tool_description_tokens"]["o200k_base"],
                "tool_and_param_description_tokens_o200k": row["tool_and_param_description_tokens"]["o200k_base"],
            }
    qwen = {}
    for row in rows(f"{folder}/03-qwen3-token-counts.jsonl"):
        qwen.setdefault(f"{row['deepagents']} {row['profile_model']}", {})[row["variant"]] = row["qwen3_prompt_eval_count_x3"]
    old, new = base["0.6.12 anthropic:claude-sonnet-4-6"], base["0.7.38 anthropic:claude-sonnet-4-6"]
    whole = "system+user 'hi'+tools"
    drop = {
        "o200k_base": r(100 * (1 - new["system_plus_schema_tokens"]["o200k_base"] / old["system_plus_schema_tokens"]["o200k_base"]), 1),
        "cl100k_base": r(100 * (1 - new["system_plus_schema_tokens"]["cl100k_base"] / old["system_plus_schema_tokens"]["cl100k_base"]), 1),
        "qwen3_whole_request": r(100 * (1 - qwen["0.7.38 anthropic:claude-sonnet-4-6"][whole][0] / qwen["0.6.12 anthropic:claude-sonnet-4-6"][whole][0]), 1),
        "tool_descriptions_o200k": r(100 * (1 - new["tool_description_tokens_o200k"] / old["tool_description_tokens_o200k"]), 1),
        "tool_and_param_descriptions_o200k": r(100 * (1 - new["tool_and_param_description_tokens_o200k"] / old["tool_and_param_description_tokens_o200k"]), 1),
    }
    cells = {}
    for row in rows(f"{folder}/04-agent-runs.jsonl"):
        cell = cells.setdefault(f"{row['task']} {row['harness']}", {"task": row["task"], "harness": row["harness"], "runs": 0, "ok": 0, "model_calls": [], "prompt_tokens_per_call": [], "prompt_tokens_total": [], "completion_tokens_total": []})
        cell["runs"] += 1
        cell["ok"] += 1 if row["ok"] else 0
        cell["model_calls"].append(row["n_calls"])
        cell["prompt_tokens_per_call"].append([call["in_tokens"] for call in row["calls"]])
        cell["prompt_tokens_total"].append(row["in_tokens_total"])
        cell["completion_tokens_total"].append(row["out_tokens_total"])
    ratios = {}
    for task in ("trivial", "tools", "files"):
        plain = cells[f"{task} plain"]["prompt_tokens_total"][0]
        deep = cells[f"{task} deep_agent"]
        ratios[task] = {
            "deep_over_plain": r(deep["prompt_tokens_total"][0] / plain, 1),
            "create_agent_equals_plain": cells[f"{task} create_agent"]["prompt_tokens_per_call"] == cells[f"{task} plain"]["prompt_tokens_per_call"],
            "extra_tokens_per_call": [d - p for d, p in zip(deep["prompt_tokens_per_call"][0], cells[f"{task} plain"]["prompt_tokens_per_call"][0])],
        }
    return {
        "machine": MAC,
        "model": "qwen3:8b on Ollama 0.31.1, temperature 0, seed 42, think off; tokens are prompt_eval_count and eval_count",
        "base_prompt": "the first request of a default create_deep_agent() for the message hi, captured offline with no model call; tokens counted with tiktoken o200k_base and cl100k_base, and with qwen3 through Ollama",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("01-baseprompt-0.7.38.jsonl", "02-baseprompt-0.6.12.jsonl", "03-qwen3-token-counts.jsonl", "04-agent-runs.jsonl")],
        "base_prompts": base,
        "qwen3_prompt_eval_count": qwen,
        "drop_0_6_to_0_7_pct": drop,
        "cells": dict(sorted(cells.items())),
        "ratios": ratios,
    }


def mcp():
    folder = "T12-mcp-mac"
    current = rows(f"{folder}/01-langchain-mcp.jsonl")
    old = rows(f"{folder}/02-langchain-mcp-adapters-0.3.2.jsonl")

    def outcome(row):
        if "ok" in row:
            return f"ToolMessage status {row['ok']['status']}"
        if "raised" in row:
            return row["raised"].split(" To run")[0]
        if "messages" in row:
            return "run finished: " + ", ".join(f"{m['type']} {m['status']}" if m["status"] else m["type"] for m in row["messages"])
        if "hung" in row:
            return "hung: " + row["hung"]
        if "returncode" in row:
            return f"return code {row['returncode']}"
        if "constructed" in row:
            return "constructed"
        return "listed: " + ", ".join(tool if isinstance(tool, str) else tool[0] for tool in row["tools"])

    def cases(data):
        out = {}
        for row in data[1:]:
            if "median_ms" in row:
                continue
            entry = {"result": outcome(row)}
            for key in ("secs", "launches", "new_launches"):
                if key in row:
                    entry[key] = row[key]
            out[f"{row['transport']}: {row['case']}"] = entry
        return out

    def latency(data):
        return {f"{row['transport']}: {row['case']}": {"n": 50, "median_ms": row["median_ms"], "p95_ms": row["p95_ms"]} for row in data if "median_ms" in row}

    launches = int(re.search(r"after the langchain-mcp-adapters 0\.3\.2 run: (\d+)", read(f"{folder}/03-adapters-launch-count.txt")).group(1))
    return {
        "machine": MAC,
        "server": "a FastMCP 4.2.0 server with the tools add, fail, boom, slow, and crash, started over stdio and over Streamable HTTP on 127.0.0.1",
        "runs_per_case": 1,
        "latency_note": "the raw file keeps the median and the p95 of each 50-call block, not each call",
        "sources": [f"capture/lab/{folder}/01-langchain-mcp.jsonl", f"capture/lab/{folder}/02-langchain-mcp-adapters-0.3.2.jsonl", f"capture/lab/{folder}/03-adapters-launch-count.txt"],
        "langchain_mcp": {"versions": current[0]["meta"], "cases": cases(current), "latency": latency(current)},
        "langchain_mcp_adapters": {"versions": old[0]["meta"], "cases": cases(old), "latency": latency(old), "server_launches": launches},
    }


def tracing():
    folder = "TRC-tracing-mac"
    latency = {}
    for row in rows(f"{folder}/03-latency-summary.jsonl"):
        block = row["block"].split("#")[1]
        child = json.loads(read(f"{folder}/03-latency-{row['cond']}-b{block}-child.json"))
        entry = latency.setdefault(row["cond"], {"ms_per_run": [], "first_run_ms": [], "requests": [], "runs_posted": []})
        entry["first_run_ms"].append(r(child["times"][0]["ms"], 1))
        entry["ms_per_run"].extend(r(t["ms"], 2) for t in child["times"][1:])
        entry["requests"].append(row["requests_by_path"])
        entry["runs_posted"].append(row["runs_posted"])
    for entry in latency.values():
        entry["n"] = len(entry["ms_per_run"])
        entry["median_ms"] = median(entry["ms_per_run"], 2)
    failures = {}
    for row in rows(f"{folder}/01-failure-summary.jsonl"):
        failures[row["cond"]] = {"runs": row["n"], "runs_ok": row["ok_runs"], "errors": row["n_errors"], "run_median_ms": r(row["run_ms_median"], 1), "requests": row["requests_by_path"], "runs_received": row["runs_posted"], "runs_expected": row["expected_runs"], "exit_lag_s": r(row["exit_lag_s"], 1), "exit": "killed by the driver at 900 s" if row["rc"] == "timeout" else f"return code {row['rc']}", "flush_ms": r(row["flush_ms"], 0) if row["flush_ms"] else None}
    batches = {}
    for name in sorted(os.listdir(os.path.join(LAB, folder))):
        if name.endswith("-recorder.jsonl"):
            sizes = [len(row["posts"]) for row in rows(f"{folder}/{name}") if row["path"] == "/runs/multipart"]
            batches[name.replace("-recorder.jsonl", "")] = sizes
    local = [{"case": row["case"], "tracing_is_enabled": row["tracing_is_enabled_inside"], "env": sorted(row["env"]), "requests": row["patched_requests_seen"] or row["recorder_hits"]} for row in rows(f"{folder}/02-tracing-context-local.jsonl")]
    return {
        "machine": MAC,
        "agent": "create_agent with a fake model and one tool, 2 model calls and 1 tool call, 7 traced runs per agent run",
        "endpoint": "a local recorder on 127.0.0.1 that answers GET /info with {} and records each request; no LangSmith server was contacted",
        "latency_runs": "3 blocks of 60 runs per condition, each block in a new process, interleaved; the first run of each process is kept apart",
        "sources": [f"capture/lab/{folder}/03-latency-summary.jsonl", f"capture/lab/{folder}/01-failure-summary.jsonl", f"capture/lab/{folder}/02-tracing-context-local.jsonl"],
        "latency": latency,
        "failures": failures,
        "runs_per_multipart_post": batches,
        "local": local,
    }


def evaluate_leak():
    folder = "T18-evaluate-leak-mac"

    def requests_of(row):
        return [(h["method"], h["path"], h["names"]) for h in row["recorder"]] + [(p["method"], p["url"], p["names"]) for p in row.get("patched_requests", [])]

    conditions = {}
    mismatched = agent_processes = 0
    for row in rows(f"{folder}/01-evaluate-requests.jsonl"):
        sent = requests_of(row)
        names = [name for _, _, batch in sent for name in batch]
        cell = conditions.setdefault(row["case"], {"processes": 0, "return_codes": [], "requests": [], "runs_sent": [], "top_run_with_parent": [], "reference_example_set": [], "scores": [], "blocked": []})
        cell["processes"] += 1
        cell["return_codes"].append(row["rc"])
        cell["requests"].append([f"{method} {path}" for method, path, _ in sent])
        counts = {}
        for name in names:
            key = ":".join(name.split(":")[:3])
            counts[key] = counts.get(key, 0) + 1
        cell["runs_sent"].append(dict(sorted(counts.items())))
        cell["top_run_with_parent"].append(sum(1 for name in names if name.startswith("post:chain:LangGraph:parent=y")))
        cell["reference_example_set"].append(sum(1 for name in names if name.endswith("ref_example=y")))
        cell["scores"].append([score for result in row["rows"] for score in result["score"]])
        cell["blocked"].append(len(row["guard_blocked"]))
        if names:
            agent_processes += 1
            printed = row["stdout_other"][0].rsplit(" ", 1)[1]
            projects = {name.split("project=")[1].split(":")[0] for name in names}
            mismatched += 1 if projects != {printed} else 0
    noflush = {}
    for row in rows(f"{folder}/02-evaluate-noflush.jsonl"):
        noflush.setdefault(row["case"], []).append([f"{method} {path}" for method, path, _ in requests_of(row) if path.endswith("/info")])
    origin = [line.strip() for line in read(f"{folder}/04-info-origin.txt").splitlines() if line.strip().startswith(("REQUEST", "File"))]
    return {
        "machine": MAC,
        "versions": "langsmith 0.14.17, langchain 1.5.0, langchain-core 1.8.0",
        "run": "evaluate(upload_results=False) on one example, with no client argument, so the default client; every process new",
        "target": "create_agent with a fake model and one tool add, 2 model calls and 1 tool call, 7 LangChain runs; quiet wraps it in tracing_context(enabled=False); plain is a function",
        "conditions_note": "ep: LANGSMITH_ENDPOINT set to a local recorder and a dummy key, LANGSMITH_TRACING unset; noenv: no LANGSMITH_ or LANGCHAIN_ variable, the HTTP layer replaced with a recorder that answers 200",
        "processes_per_condition": 5,
        "not_used": "00-smoke-n1.jsonl is not kept; in 02 the noenv:agent rows miss the POST that happens at exit, so 02 is used only for GET /info",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("01-evaluate-requests.jsonl", "02-evaluate-noflush.jsonl", "04-info-origin.txt", "t18_evaluate.py", "t18_info_origin.py")],
        "conditions": conditions,
        "info_without_flush": noflush,
        "agent_processes": agent_processes,
        "project_differs_from_printed_name": mismatched,
        "info_origin": origin,
    }


PYTEST_LINE = re.compile(r"^(?:INTERNALERROR> |E\s+)(?:\S+\.)?(ValueError: .*|LangSmithConnectionError: .*)$")


def pytest_plugin():
    folder = "T19-pytest-plugin-mac"
    conditions = {}
    for rel in ("01-pytest-runs.jsonl", "03-off-tracing-on-runs.jsonl"):
        for row in rows(f"{folder}/{rel}"):
            cell = conditions.setdefault(row["cond"], {"processes": 0, "return_codes": [], "results": [], "requests": [], "agent_run_posted": [], "messages": [], "skipping_lines": [], "header": None, "suite": None})
            cell["processes"] += 1
            cell["return_codes"].append(row["rc"])
            cell["results"].append(re.sub(r" in [0-9.]+s", "", row["summary"]).strip("= "))
            cell["requests"].append([f"{h['method']} {h['path']}" for h in row["recorder"]] + [f"{g['method']} {g['url']}" for g in row["guard"] if g.get("kind") == "requests-send"])
            cell["agent_run_posted"].append(any("LangGraph" in h["names"] for h in row["recorder"] if h["method"] == "POST"))
            text = read(f"{folder}/02-{row['cond']}-rep{row['rep']}-stdout.txt")
            found = []
            for line in text.splitlines():
                match = PYTEST_LINE.match(line)
                if match and match.group(1) not in found:
                    found.append(match.group(1))
                if line.startswith("plugins:"):
                    cell["header"] = line
                if line.startswith("Test Suite:"):
                    cell["suite"] = line.strip()
            cell["messages"].append(found)
            cell["skipping_lines"].append(sum(1 for line in text.splitlines() if "Skipping" in line and line.startswith("INFO")))
    return {
        "machine": MAC,
        "versions": "langsmith 0.14.17 with its pytest11 plugin, pytest 8.4.2 in a scratch environment, rich 15.0.0, no vcrpy",
        "tests": "five tests: a marked test that logs inputs, outputs, reference outputs, and feedback; a marked test that fails on purpose; a test with @langsmith.test; a marked test that runs create_agent with a fake model; an unmarked test that calls log_outputs",
        "conditions_note": "off: LANGSMITH_TEST_TRACKING=false; on: the variable unset, the default; ep: LANGSMITH_ENDPOINT set to a local recorder and a dummy key; noenv: no LANGSMITH_ variable, with the HTTP layer replaced by a guard that refuses or answers 200; output: --langsmith-output; logcli: log_cli at INFO; tracing: LANGSMITH_TRACING=true",
        "processes_per_condition": 3,
        "not_used": "00-smoke-n1-runs.jsonl is not kept; with tracking on, the errors after each request come from the empty answers of the recorder and the guard, so only the request order is used; the run names in 03 come from a rough match on the body, so the summary keeps only whether the LangGraph run of the agent was posted",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("01-pytest-runs.jsonl", "03-off-tracing-on-runs.jsonl", "t19_driver.py", "t19_tests/conftest.py", "t19_tests/test_ls_plugin.py")] + [f"capture/lab/{folder}/02-<condition>-rep<n>-stdout.txt"],
        "conditions": conditions,
    }


def mcp_edges():
    folder = "T20-mcp-edges-mac"
    cases = {}
    for row in rows(f"{folder}/01-mcp-edges.jsonl"):
        shape = {"protocol": row["protocol"], "events": row["events"], "handler_calls": len(row["handler_calls"]), "progress": [call[:3] for call in row["progress_calls"]], "server_calls": row.get("server_calls"), "return_code": row["rc"]}
        cell = cases.setdefault(f"{row['transport']}: {row['case']}", {"processes": 0, "shapes": []})
        cell["processes"] += 1
        if shape not in cell["shapes"]:
            cell["shapes"].append(shape)
    for cell in cases.values():
        cell["same_in_every_process"] = len(cell["shapes"]) == 1
    return {
        "machine": MAC,
        "versions": "langchain 1.5.0, fastmcp 4.2.0, mcp 2.3.0, langgraph 1.2.22",
        "server": "a FastMCP server with ask_name, which returns an InputRequiredResult, ask_legacy, which calls ctx.elicit, fail_structured and ok_structured, which return structured content with and without is_error, and long_task, which reports progress",
        "clients_note": "modern: MCPAdapter(server), protocol 2026-07-28; legacy: MCPAdapter(fastmcp.Client(server, mode='legacy')), protocol 2025-11-25; handler: a fastmcp.Client with an elicitation_handler; phandler: a fastmcp.Client with a progress_handler; noarm: a fastmcp.Client with no handler, given to as_langchain_tool; agent: create_agent with a fake model and InMemorySaver, astream with updates and custom",
        "processes_per_case": 3,
        "not_used": "00-smoke-n1.jsonl and the server stderr file, which is empty, are not kept; server_calls is counted in-process only",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("01-mcp-edges.jsonl", "t20_mcp.py", "t20_server.py")],
        "cases": cases,
    }


HOOK_CALLS = {"before_model": 2, "after_model": 2, "before_agent": 1, "wrap_model_call": 2, "wrap_tool_call": 1}


def middleware():
    folder = "T11-middleware-cost-mac"

    def cells(rel):
        out = {}
        for row in rows(f"{folder}/{rel}"):
            cell = out.setdefault((row["cell"], row["k"], row["history"]), {"wall_us": [], "bad_runs": 0, "graph_nodes": row["n_nodes"]})
            cell["wall_us"].extend(row["walls_us"][row["warm"]:])
            cell["bad_runs"] += row["bad_runs"]
        for cell in out.values():
            cell["n"] = len(cell["wall_us"])
            cell["median_us"] = median(cell["wall_us"], 1)
            cell["wall_us"] = [r(v, 0) for v in cell["wall_us"]]
        return out

    custom = cells("01-custom-runs.jsonl")
    base = custom[("none", 0, 2)]
    ks = [0, 1, 3, 10, 20]
    hooks = {}
    for hook, calls in HOOK_CALLS.items():
        meds = [base["median_us"]] + [custom[(hook, k, 2)]["median_us"] for k in ks[1:]]
        mean_k, mean_m = sum(ks) / len(ks), sum(meds) / len(meds)
        slope = sum((k - mean_k) * (m - mean_m) for k, m in zip(ks, meds)) / sum((k - mean_k) ** 2 for k in ks)
        hooks[hook] = {"calls_per_run": calls, "us_per_hook_call": r(slope / calls, 1), "median_us_by_count": dict(zip(map(str, ks), meds)), "graph_nodes_at_20": custom[(hook, 20, 2)]["graph_nodes"], "runs_at_20": custom[(hook, 20, 2)]["wall_us"]}
    builtin = cells("02-builtin-runs.jsonl")
    added = {}
    for (name, _, size), cell in sorted(builtin.items(), key=lambda item: (item[0][2], item[0][0])):
        if name == "none":
            continue
        added.setdefault(name, {})[f"history_{size}"] = {"added_us": r(cell["median_us"] - builtin[("none", None, size)]["median_us"], 0), "graph_nodes": cell["graph_nodes"], "n": cell["n"], "bad_runs": cell["bad_runs"]}
    return {
        "machine": MAC,
        "run": "create_agent with an in-process fake model, 2 model calls and 1 tool call, sync invoke; 6 shuffled blocks of 50 timed runs per cell after 5 warm-up runs that the summary leaves out",
        "baseline_median_us": base["median_us"],
        "baseline_runs": base["wall_us"],
        "sources": [f"capture/lab/{folder}/01-custom-runs.jsonl", f"capture/lab/{folder}/02-builtin-runs.jsonl", f"capture/lab/{folder}/t11_run.py"],
        "hooks": hooks,
        "builtin": added,
    }


def p95(values, digits=3):
    data = sorted(values)
    k = (len(data) - 1) * 0.95
    low = int(k)
    high = min(low + 1, len(data) - 1)
    return r(data[low] + (data[high] - data[low]) * (k - low), digits)


STREAM_VARIANTS = ["plain_openai", "chatopenai_stream", "agent_messages", "agent_messages_updates", "astream_events_v2", "stream_events_v3", "stream_events_v3_raw", "astream_events_v3", "astream_events_v3_gather"]


def streaming():
    folder = "T04-streaming-mac"
    phases = {}
    for phase in ("text", "tool", "subagent", "ollama"):
        data = rows(f"{folder}/{phase}-per-run.jsonl")
        good = [row for row in data if not row["warmup"] and not row["error"]]
        variants = {}
        for name in STREAM_VARIANTS:
            runs = [row for row in good if row["variant"] == name]
            if not runs:
                continue
            entry = {
                "n": len(runs),
                "errors": sum(1 for row in data if row["variant"] == name and row["error"] and not row["warmup"]),
                "first_delay_ms": [r(row["first_delay_ms"], 2) for row in runs],
                "first_delay_ms_median": median([row["first_delay_ms"] for row in runs], 2),
                "first_delay_ms_p95": p95([row["first_delay_ms"] for row in runs], 2),
                "token_delay_ms_median": median([row["median_delay_ms"] for row in runs], 2),
                "burst_frac_median": median([row["burst_frac"] for row in runs], 2),
                "cpu_ms_median": median([row["cpu_ms"] for row in runs], 1),
            }
            if phase != "ollama":
                entry["request_overhead_ms_median"] = median([row["req_overhead_ms"] for row in runs], 1)
            if phase == "text":
                entry["client_gap_ms_median"] = median([row["client_gap_median_ms"] for row in runs], 1)
                entry["server_gap_ms_median"] = median([row["server_gap_median_ms"] for row in runs], 1)
            if phase == "tool":
                tool = [row["tool_first_delay_ms"] for row in runs if row.get("tool_first_delay_ms") is not None]
                if tool:
                    entry["tool_first_delay_ms_median"] = median(tool, 1)
            variants[name] = entry
        loads = [row["load1"] for row in good]
        phases[phase] = {"load1": [r(min(loads), 1), r(max(loads), 1)], "variants": variants}
    isolation = {}
    for row in rows(f"{folder}/iso38484-runs.jsonl"):
        if row["warmup"]:
            continue
        cell = isolation.setdefault(f"{row['scenario']} {row['pattern']}", {"runs": 0, "text_in_one_burst": 0})
        cell["runs"] += 1
        cell["text_in_one_burst"] += 1 if row["main_burst_frac"] == 1.0 else 0
    reasoning = {}
    for row in rows(f"{folder}/reasoning-ollama-runs.jsonl"):
        if row["warmup"]:
            continue
        cell = reasoning.setdefault(" then ".join(row["order"]), {"runs": 0, "reasoning_deltas": [], "text_deltas": [], "reasoning_burst_frac": [], "text_burst_frac": [], "text_after_reasoning_ms": []})
        cell["runs"] += 1
        cell["reasoning_deltas"].append(row["reasoning"]["n"])
        cell["text_deltas"].append(row["text"]["n"])
        cell["reasoning_burst_frac"].append(row["reasoning"]["burst_frac"])
        cell["text_burst_frac"].append(row["text"]["burst_frac"])
        cell["text_after_reasoning_ms"].append(row["text"]["first_ms"] - row["reasoning"]["last_ms"])
    servers = {row["tag"]: row for row in rows(f"{folder}/text-server-excerpt.jsonl")}
    timeline = {}
    for run in rows(f"{folder}/text-runs-excerpt.jsonl"):
        sent = {event[3].strip(): event[0] for event in servers[run["tag"]]["events"] if event[1] == "text"}
        seen = {}
        for stamp, _, ids, _ in run["text"]:
            for token in ids:
                seen.setdefault(token, stamp)
        timeline[run["variant"]] = {"block": run["block"], "run": run["i"], "tokens": [[token, r((sent[token] - run["t0"]) / 1e6, 1), r((seen[token] - run["t0"]) / 1e6, 1)] for token in sorted(sent)]}
    return {
        "machine": MAC,
        "stub": "an OpenAI-compatible SSE stub on 127.0.0.1 that sends 40 text tokens after 50 ms, about 24 ms apart, and stamps each token as it writes it",
        "delivery_delay": "the time the consumer saw a token minus the time the stub sent it, on one clock",
        "phases_note": "text: 40 tokens; tool: a tool call of 202 argument chunks, then 40 tokens; subagent: a supervisor tool that calls an inner agent; ollama: qwen3:4b-instruct-2507-q4_K_M through a stamping proxy",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("text-per-run.jsonl", "tool-per-run.jsonl", "subagent-per-run.jsonl", "ollama-per-run.jsonl", "iso38484-runs.jsonl", "reasoning-ollama-runs.jsonl", "text-runs-excerpt.jsonl", "text-server-excerpt.jsonl", "t04_run.py", "t04_analyze.py")],
        "phases": phases,
        "isolation_38484": isolation,
        "reasoning_model": reasoning,
        "timeline": timeline,
    }


def parallel_tools():
    folder = "T08-parallel-tools-mac"
    cells = {}
    data = [row for row in rows(f"{folder}/01-concurrency-runs.jsonl") if not row["warmup"]]
    for row in data:
        cap = "none" if row["max_concurrency"] is None else row["max_concurrency"]
        cell = cells.setdefault(f"{row['kind']} {row['mode']} {row['tool']} N={row['n_calls']} cap={cap}", {"runs": 0, "errors": {}, "wall_ms": [], "overlap": [], "executions": []})
        cell["runs"] += 1
        if row["error"]:
            cell["errors"][row["error"]] = cell["errors"].get(row["error"], 0) + 1
            continue
        cell["wall_ms"].append(r(row["wall_ms"], 1))
        cell["overlap"].append(row["max_overlap"])
        cell["executions"].append(row["n_exec"])
    for cell in cells.values():
        if cell["wall_ms"]:
            cell["wall_ms_median"] = median(cell["wall_ms"], 1)
    ids = []
    for row in rows(f"{folder}/02-idless-and-dupnames.jsonl"):
        entry = {"case": row["case"], "executions": len(row["executions"]), "tool_messages": [[m[0], m[2]] for m in row["tool_messages"]], "error": row.get("error")}
        for key in ("how", "fake_last_chunk", "order", "bound_to_model"):
            if key in row:
                entry[key] = row[key]
        if "order" in row:
            entry["ran"] = [name for name, _ in row["executions"]]
        ids.append(entry)
    local = {}
    for row in rows(f"{folder}/03-ollama-parallel.jsonl"):
        cell = local.setdefault(f"{row['llm']} {row['how']}", {"runs": 0, "both_tools_ran": 0, "errors": 0})
        cell["runs"] += 1
        cell["both_tools_ran"] += 1 if len({name for name, _ in row["executions"]}) == 2 else 0
        cell["errors"] += 1 if row["error"] else 0
    loads = [row["load_block"][0] for row in data]
    return {
        "machine": MAC,
        "cpu_count": data[0]["cpu_count"],
        "load1": [r(min(loads), 1), r(max(loads), 1)],
        "run": "a fake model asks for N calls of one tool that sleeps 200 ms; overlap is the largest number of calls running at one time, from the start and end stamps of each call",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("01-concurrency-runs.jsonl", "02-idless-and-dupnames.jsonl", "03-ollama-parallel.jsonl", "t08_run.py", "t08_ids.py", "t08_ollama.py")],
        "cells": dict(sorted(cells.items())),
        "ids_and_names": ids,
        "ollama": dict(sorted(local.items())),
    }


SQL_CHECKS = {
    "tables": lambda row, expected: all(name in (row["answer"] or "") for name in expected["tables"]),
    "largest": lambda row, expected: "PlaylistTrack" in (row["answer"] or ""),
    "genre": lambda row, expected: "Sci Fi" in (row["answer"] or ""),
    "add-genre": lambda row, expected: row["db_after"]["chiptune"] == 1,
    "delete": lambda row, expected: row["db_after"]["invoices_2009"] == expected["invoices_2009"],
}


def demo_sql():
    out = {}
    for tag in ("4b", "8b"):
        data = rows(f"sql-agent/run-{tag}.jsonl")
        meta = data[-1]
        questions = {}
        for row in data[:-1]:
            if row["error"]:
                outcome = "raised"
            else:
                outcome = "right" if SQL_CHECKS[row["question"]](row, meta["expected"]) else "wrong"
            questions[row["question"]] = {"outcome": outcome, "error": row["error"], "tools": [c["name"] for c in row["tool_calls"]], "decisions": [d["decision"] for d in row["decisions"]], "model_calls": row["model_calls"], "prompt_tokens": sum(row["prompt_tokens"]), "seconds": row["seconds"]}
        out[meta["model"]] = {"questions": questions, "db_final": meta["db_final"]}
    return {"rules": "tables: every table name in the answer; largest: PlaylistTrack in the answer; genre: Sci Fi in the answer; add-genre: one Chiptune row after the run; delete: 83 invoices of 2009 after the run", "expected": meta["expected"], "models": out}


def demo_retrieval():
    out = {}
    for tag in ("4b", "8b"):
        data = rows(f"retrieval-agent/run-{tag}.jsonl")
        meta = data[0]
        questions = {}
        for row in data[1:]:
            questions[row["question"]] = {"searched": len(row["searches"]), "cited": row["cited"], "cited_expected": row["cited_expected"], "top1": row["top4"][0][0], "top1_expected": row["top4"][0][0] in row["expected_sources"] if row["expected_sources"] else None, "top4_scores": [hit[2] for hit in row["top4"]], "model_calls": row["model_calls"], "prompt_tokens": sum(row["prompt_tokens"]), "seconds": row["seconds"]}
        out[meta["model"]] = questions
    return {"chunks": meta["chunks"], "files": len(meta["corpus"]), "embed_s": meta["embed_s"], "models": out}


def demo_assistant():
    out = {}
    for tag in ("", "-sync"):
        exits = dict(re.findall(r"== (\S+): process.*?\n.*?  exit       (-?\d+)", read(f"assistant/run{tag}.log"), re.S))
        by_step = {row["step"]: row for row in rows(f"assistant/run{tag}.jsonl")}
        steps = []
        for name, code in exits.items():
            row = by_step.get(name)
            entry = {"step": name, "exit": int(code)}
            if row:
                entry.update({"seconds": row["seconds"], "next": row["next"], "messages": len(row["messages"]), "checkpoints": row["checkpoints"], "pending": len(row["pending"]), "sent": row["sent"], "attempts": len(row["attempts"]), "summaries": row["summaries"], "memories": len(row["memories"])})
            steps.append(entry)
        out["sync" if tag else "default"] = steps
    return out


def demo_deep():
    data = rows("deep-agent/run.jsonl")
    calls = [{"n": row["n"], "agent": row["agent"], "tools": len(row["tools"]), "input_tokens": row["input_tokens"], "output_tokens": row["output_tokens"], "seconds": row["seconds"], "tool_calls": row["tool_calls"]} for row in data[1:]]
    totals = {}
    for row in calls:
        entry = totals.setdefault(row["agent"], {"calls": 0, "input_tokens": 0, "output_tokens": 0})
        entry["calls"] += 1
        entry["input_tokens"] += row["input_tokens"]
        entry["output_tokens"] += row["output_tokens"]
    return {"model": data[0]["model"], "seconds": data[0]["seconds"], "files": data[0]["files"], "todos": [t["status"] for t in data[0]["todos"]], "calls": calls, "totals": totals}


def demos():
    return {
        "machine": MAC,
        "runs": "one run of each demo; the SQL and retrieval demos once with each model",
        "models": "Ollama 0.31.1, temperature 0, seed 42, reasoning off; nomic-embed-text for embeddings",
        "sources": ["capture/lab/sql-agent/", "capture/lab/retrieval-agent/", "capture/lab/assistant/", "capture/lab/deep-agent/", "capture/lab/failure-drill/"],
        "sql_agent": demo_sql(),
        "retrieval_agent": demo_retrieval(),
        "assistant": demo_assistant(),
        "deep_agent": demo_deep(),
        "failure_drill": rows("failure-drill/drill.jsonl"),
    }


SUMMARIES = {
    "demos-mac.json": demos,
    "streaming-mac.json": streaming,
    "parallel-tools-mac.json": parallel_tools,
    "middleware-mac.json": middleware,
    "structured-output-mac.json": structured_output,
    "import-times-mac.json": import_times,
    "install-size-mac.json": install_size,
    "overhead-mac.json": overhead,
    "retries-mac.json": retries,
    "crash-resume-mac.json": crash_resume,
    "recursion-mac.json": recursion,
    "checkpoint-cost-x86.json": checkpoint_cost,
    "agent-server-x86.json": agent_server,
    "approvals-mac.json": approvals,
    "replay-fork-mac.json": replay_fork,
    "crash-next-mac.json": crash_next,
    "concurrency-x86.json": concurrency,
    "long-threads-x86.json": long_threads,
    "serde-mac.json": serde,
    "stores-mac.json": stores,
    "checkpoint-reads-x86.json": checkpoint_reads,
    "tokens-mac.json": tokens,
    "mcp-mac.json": mcp,
    "tracing-mac.json": tracing,
    "evaluate-mac.json": evaluate_leak,
    "pytest-plugin-mac.json": pytest_plugin,
    "mcp-edges-mac.json": mcp_edges,
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
