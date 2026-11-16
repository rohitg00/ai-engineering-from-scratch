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
    out["round_trip_changed"] = sorted(t["case"] for t in trips if "raised" in t["sqlite_graph"] or not (t["sqlite_graph"]["same_type"] and t["sqlite_graph"]["equal"] is True and t["sqlite_graph"].get("same_tzinfo_type", True) and t["sqlite_graph"].get("same_fold", True)))
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


def evaluate_leak(folder="T18-evaluate-leak-mac"):
    x86 = folder.endswith("-x86")

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
    out = {
        "machine": X86 if x86 else MAC,
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
    }
    if x86:
        out["target"] = "create_agent with ChatOllama and qwen3:4b-instruct-2507-q4_K_M, temperature 0, seed 42, and one tool add, 7 LangChain runs; quiet wraps it in tracing_context(enabled=False); plain is a function"
        out["sources"] = [f"capture/lab/{folder}/{name}" for name in ("01-evaluate-requests.jsonl", "02-evaluate-noflush.jsonl", "03-counts.txt", "t18_real.py", "t18_summarize.py")]
    else:
        out["info_origin"] = [line.strip() for line in read(f"{folder}/04-info-origin.txt").splitlines() if line.strip().startswith(("REQUEST", "File"))]
    return out


PYTEST_LINE = re.compile(r"^(?:INTERNALERROR> |E\s+)(?:\S+\.)?(ValueError: .*|LangSmithConnectionError: .*)$")


def pytest_plugin(folder="T19-pytest-plugin-mac"):
    x86 = folder.endswith("-x86")
    conditions = {}
    for rel in ("01-pytest-runs.jsonl",) if x86 else ("01-pytest-runs.jsonl", "03-off-tracing-on-runs.jsonl"):
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
    out = {
        "machine": MAC,
        "versions": "langsmith 0.14.17 with its pytest11 plugin, pytest 8.4.2 in a scratch environment, rich 15.0.0, no vcrpy",
        "tests": "five tests: a marked test that logs inputs, outputs, reference outputs, and feedback; a marked test that fails on purpose; a test with @langsmith.test; a marked test that runs create_agent with a fake model; an unmarked test that calls log_outputs",
        "conditions_note": "off: LANGSMITH_TEST_TRACKING=false; on: the variable unset, the default; ep: LANGSMITH_ENDPOINT set to a local recorder and a dummy key; noenv: no LANGSMITH_ variable, with the HTTP layer replaced by a guard that refuses or answers 200; output: --langsmith-output; logcli: log_cli at INFO; tracing: LANGSMITH_TRACING=true",
        "processes_per_condition": 3,
        "not_used": "00-smoke-n1-runs.jsonl is not kept; with tracking on, the errors after each request come from the empty answers of the recorder and the guard, so only the request order is used; the run names in 03 come from a rough match on the body, so the summary keeps only whether the LangGraph run of the agent was posted",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("01-pytest-runs.jsonl", "03-off-tracing-on-runs.jsonl", "t19_driver.py", "t19_tests/conftest.py", "t19_tests/test_ls_plugin.py")] + [f"capture/lab/{folder}/02-<condition>-rep<n>-stdout.txt"],
        "conditions": conditions,
    }
    if x86:
        out["machine"] = X86
        out["tests"] = out["tests"].replace("create_agent with a fake model", "create_agent with ChatOllama and qwen3:4b-instruct-2507-q4_K_M, temperature 0, seed 42")
        out["not_used"] = "with tracking on, the errors after each request come from the empty answers of the recorder and the guard, so only the request order is used; the run names come from a rough match on the body, so the summary keeps only whether the LangGraph run of the agent was posted"
        out["sources"] = [f"capture/lab/{folder}/{name}" for name in ("01-pytest-runs.jsonl", "t19_driver_real.py", "t19_tests/conftest.py", "t19_tests/test_ls_plugin.py")] + [f"capture/lab/{folder}/02-<condition>-rep<n>-stdout.txt"]
    return out


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
    "tables": lambda row, expected: all(re.search(rf"{name}\W+{count}\b", row["answer"] or "") for name, count in expected["tables"].items()),
    "top-customer": lambda row, expected: expected["top_customer"][0] in (row["answer"] or "") and str(expected["top_customer"][1]) in (row["answer"] or "").replace(",", ""),
    "march": lambda row, expected: re.search(rf"\b{expected['march_orders']}\b", row["answer"] or "") is not None,
    "add-product": lambda row, expected: row["after"]["rye_loaf"] == 1,
    "drop-cancelled": lambda row, expected: row["after"]["cancelled"] == row["before_cancelled"],
}


def demo_sql():
    out = {}
    for tag in ("4b", "8b"):
        data = rows(f"sql-agent/run-{tag}.jsonl")
        meta = data[0]
        guard = {"sent": sum(1 for g in meta["guard"] if "sent" in g), "refused": sum(1 for g in meta["guard"] if "refused" in g), "reader": [g["reader"] for g in meta["guard"] if "reader" in g]}
        questions = {}
        for row in data[1:]:
            row["before_cancelled"] = meta["before"]["cancelled"]
            if row["error"]:
                outcome = "raised"
            else:
                outcome = "right" if SQL_CHECKS[row["question"]](row, meta["expected"]) else "wrong"
            questions[row["question"]] = {"outcome": outcome, "error": row["error"], "tools": [c["name"] for c in row["tool_calls"]], "decisions": [d["decision"] for d in row["decisions"]], "model_calls": row["model_calls"], "prompt_tokens": sum(row["prompt_tokens"]), "output_tokens": sum(row["output_tokens"]), "seconds": row["seconds"]}
        out[meta["model"]] = {"questions": questions, "guard": guard, "before": meta["before"], "after": data[-1]["after"]}
    return {"rules": "tables: each table name followed by its row count in the answer; top-customer: the name and the total in cents in the answer; march: the count in the answer; add-product: one Rye Loaf row after the run; drop-cancelled: as many cancelled orders after the run as before", "expected": meta["expected"], "models": out}


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


X86_MODEL = "qwen3:4b-instruct-2507-q4_K_M on Ollama 0.31.1 on CPU, temperature 0, seed 42, server context 8192"


def data_rows(rel):
    return [row for row in rows(rel) if row.get("kind") != "header"]


def first_line(text):
    return (text or "").splitlines()[0] if text else None


def retries_x86():
    folder = "T05-retries-x86"
    files = ["01-model-faults.jsonl", "02-tool-faults.jsonl", "03-both-faults.jsonl"]
    cells = {}
    for name in files:
        for row in data_rows(f"{folder}/{name}"):
            cell = cells.setdefault(f"{row['fault']} {row['config']}", {"group": row["group"], "fault": row["fault"], "config": row["config"], "model_class": row["model_class"], "client_max_retries": row["client_max_retries"], "relay_injected": row["relay_injected"], "model_attempts": [], "model_starts": [], "tool_executions": [], "ledger_rows": [], "outcomes": [], "wall_s": [], "result": []})
            cell["model_attempts"].append(row["wire_model_attempts"])
            cell["model_starts"].append(row["model_starts_callback"])
            cell["tool_executions"].append(row["tool_executions"])
            cell["ledger_rows"].append(row["ledger_rows"])
            cell["outcomes"].append(row["outcome"])
            cell["wall_s"].append(row["wall_s"])
            if row["outcome"] == "raised":
                cell["result"].append(first_line(row["exception"]))
            else:
                cell["result"].append("last AI: " + first_line(row["final_messages"][-1][1]))
    for cell in cells.values():
        cell["wall_s_median"] = median(cell["wall_s"], 2)
        cell["result"] = sorted(set(cell["result"]))
    return {
        "machine": X86,
        "model": X86_MODEL,
        "clients": "ChatOpenAI on the /v1 path of Ollama and ChatOllama on the native path, through a TCP relay on 127.0.0.1, client timeout 15 s",
        "faults_note": "m_drop: the relay closes the connection; m_refused: nothing listens on the port; m_timeout: the relay holds 20 s; m_404_always_real: the real Ollama answer for an unknown model; m_429 and m_500: statuses injected by the relay; t_refused: a closed port; t_sqlerror: a missing PostgreSQL table; t_timeout: an INSERT into a ledger table, then pg_sleep(3) under statement_timeout 1 s",
        "count_note": "model_attempts are relay arrivals, logged on arrival; ledger_rows are the INSERTs that landed",
        "runs_per_cell": 3,
        "sources": [f"capture/lab/{folder}/{name}" for name in files + ["t05_real.py", "lr_common.py"]],
        "cells": dict(sorted(cells.items())),
    }


def approval_cases(data, tag):
    cases = {}
    for row in data:
        spec = row["spec"]
        cell = cases.setdefault(row["case"], {"app": spec["app"], "mode": spec.get("mode"), "calls": spec.get("calls"), "runs": 0, "prompt_tries": [], "tools_run": [], "model_calls": [], "errors": [], "c1_tool_messages": [], "source": tag})
        cell["runs"] += 1
        cell["prompt_tries"].append(len(row["attempts"]))
        cell["tools_run"].append(sorted(f"{name} {json.dumps(args, sort_keys=True)} at step {step}" for name, args, step in row["tool_execs"]))
        cell["model_calls"].append(row["model_calls"])
        cell["errors"].append([f"step {rep['step']}: {INTERRUPT_ID.sub('<id>', (rep.get('error') or rep.get('crash')).splitlines()[0])}" for rep in row["reports"] if rep.get("error") or rep.get("crash")])
        last = row["reports"][-1].get("messages") or []
        first = next((m[3][0][2] for m in last if m[0] == "ai" and m[3]), None)
        cell["c1_tool_messages"].append([m[2] for m in last if m[0] == "tool" and first and m[4] == first])
    return cases


def approvals_x86():
    folder = "T07-approvals-x86"
    first = [row for row in data_rows(f"{folder}/01-cases.jsonl") if not row["case"].startswith("G3_")]
    cases = approval_cases(first, "01-cases.jsonl")
    cases.update(approval_cases(data_rows(f"{folder}/02-g3-rerun.jsonl"), "02-g3-rerun.jsonl"))
    survey = {}
    for row in data_rows(f"{folder}/00-survey.jsonl"):
        cell = survey.setdefault(f"{row['model']} {row['intent']}", {"prompts": 0, "calls_per_reply": {}, "all_ids": True})
        cell["prompts"] += 1
        key = str(row["n_calls"])
        cell["calls_per_reply"][key] = cell["calls_per_reply"].get(key, 0) + 1
        cell["all_ids"] = cell["all_ids"] and all(c[2] for c in row["calls"])
    for cell in survey.values():
        cell["calls_per_reply"] = dict(sorted(cell["calls_per_reply"].items()))
    return {
        "machine": X86,
        "model": X86_MODEL + "; the survey also ran qwen3:8b with reasoning off",
        "runs_per_case": 3,
        "saver": "SqliteSaver, with the start and each resume in a new process",
        "not_used": "the G3 rows of 01-cases.jsonl, whose shape check never matched; the G3 case comes from 02-g3-rerun.jsonl; G1 and G2 have no model and stay in approvals-mac.json",
        "c1_note": "c1_tool_messages are the statuses of the ToolMessages of the first tool call id of the first AI message with calls",
        "survey_note": "one model call per prompt with the tools bound, 10 prompts per intent per model",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("00-survey.jsonl", "01-cases.jsonl", "02-g3-rerun.jsonl", "t07_child_real.py", "t07_driver_real.py", "t07_survey.py")],
        "survey": dict(sorted(survey.items())),
        "cases": dict(sorted(cases.items())),
    }


def parallel_tools_x86():
    folder = "T08-parallel-tools-x86"
    counts = {}
    for row in data_rows(f"{folder}/01-counts.jsonl"):
        counts[f"{row['model']} {row['client']} asked {row['asked']}"] = {"made": row["made"], "distinct_args": row["distinct_q"], "all_have_id": row["all_have_id"], "invalid": row["invalid"], "secs": row["secs"]}
    raw = {row["api"]: {"ids": [bool(c.get("id")) for c in row["message"]["tool_calls"]]} for row in data_rows(f"{folder}/02-raw-ollama.jsonl")}

    def harness(rel):
        cells = {}
        for row in data_rows(rel):
            if row.get("warmup"):
                continue
            cap = "none" if row["max_concurrency"] is None else row["max_concurrency"]
            cell = cells.setdefault(f"{row['mode']} {row['tool']} asked={row['asked']} cap={cap}", {"runs": 0, "errors": {}, "calls_made": [], "wall_ms": [], "tool_span_ms": [], "overlap": [], "executions": []})
            cell["runs"] += 1
            cell["calls_made"].append(row["n_calls_made"])
            if row["error"]:
                key = first_line(row["error"])
                cell["errors"][key] = cell["errors"].get(key, 0) + 1
                continue
            cell["wall_ms"].append(r(row["wall_ms"], 1))
            cell["tool_span_ms"].append(r(row["tool_span_ms"], 1))
            cell["overlap"].append(row["max_overlap"])
            cell["executions"].append(row["n_exec"])
        for cell in cells.values():
            if cell["wall_ms"]:
                cell["wall_ms_median"] = median(cell["wall_ms"], 1)
                cell["tool_span_ms_median"] = median(cell["tool_span_ms"], 1)
        return dict(sorted(cells.items()))

    dupnames = {}
    for row in data_rows(f"{folder}/03-dupnames.jsonl"):
        cell = dupnames.setdefault(f"{row['prompt']} order={'+'.join(row['order'])}", {"runs": 0, "bound_to_model": row["bound_to_model"], "model_calls": [], "ran": [], "final": []})
        cell["runs"] += 1
        cell["model_calls"].append(len(row["model_calls"]))
        cell["ran"].append(row["ran"])
        cell["final"].append(row["final"][:80])
    agent = data_rows(f"{folder}/05-agent.jsonl")
    toolnode = rows(f"{folder}/04-toolnode.jsonl")
    return {
        "machine": X86,
        "model": X86_MODEL + "; the counts also ran qwen3:8b with reasoning off",
        "cpu_count": toolnode[0]["cpu_count"],
        "tool": "work runs SELECT pg_sleep(0.2) on PostgreSQL 16.15, with psycopg sync or AsyncConnection",
        "run": "toolnode: ToolNode fed the AIMessage that qwen3 4B returned for each asked count, 5 runs per cell after a warm-up pass; agent: create_agent with a model call in every run, asked for 8 calls, 3 runs per cell",
        "made_per_asked": toolnode[0]["made"],
        "not_used": "rows with warmup true in 04; the 4B reply for asked 1 holds 2 identical calls, so its ToolNode rows are 2-call rows",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("01-counts.jsonl", "02-raw-ollama.jsonl", "03-dupnames.jsonl", "04-toolnode.jsonl", "05-agent.jsonl", "t08_real.py", "lr_common.py")],
        "counts": counts,
        "raw_ollama_ids": raw,
        "toolnode": harness(f"{folder}/04-toolnode.jsonl"),
        "agent": harness(f"{folder}/05-agent.jsonl"),
        "agent_wall_s": [r(min(row["wall_ms"] for row in agent) / 1000, 1), r(max(row["wall_ms"] for row in agent) / 1000, 1)],
        "dupnames": dupnames,
    }


def middleware_x86():
    folder = "T11-middleware-cost-x86"
    cost = rows(f"{folder}/01-cost.jsonl")
    cells = {}
    for row in cost[1:]:
        if row["warm"] or not row["ok"]:
            continue
        key = row["cell"] if row["k"] is None else f"{row['cell']} {row['k']}"
        cell = cells.setdefault(key, {"cell": row["cell"], "k": row["k"], "framework_us": [], "wall_ms": [], "model_ms": [], "share_pct": []})
        cell["framework_us"].append(r(row["framework_us"], 1))
        cell["wall_ms"].append(r(row["wall_us"] / 1000, 1))
        cell["model_ms"].append(r(row["model_us"] / 1000, 1))
        cell["share_pct"].append(100 * row["framework_us"] / row["wall_us"])
    for cell in cells.values():
        cell["n"] = len(cell["framework_us"])
        cell["framework_ms_median"] = r(statistics.median(cell["framework_us"]) / 1000, 2)
        cell["wall_ms_median"] = median(cell["wall_ms"], 1)
        cell["model_ms_median"] = median(cell["model_ms"], 1)
        cell["share_pct_median"] = median(cell["share_pct"], 1)
        del cell["share_pct"]
    base = statistics.median(cells["none 0"]["framework_us"])
    hooks = {}
    for hook, calls in HOOK_CALLS.items():
        points = [(0, base)] + [(cell["k"], statistics.median(cell["framework_us"])) for cell in cells.values() if cell["cell"] == hook]
        mean_k = sum(k for k, _ in points) / len(points)
        mean_m = sum(m for _, m in points) / len(points)
        slope = sum((k - mean_k) * (m - mean_m) for k, m in points) / sum((k - mean_k) ** 2 for k, _ in points)
        hooks[hook] = {"calls_per_run": calls, "us_per_hook_call": r(slope / calls, 1), "framework_ms_at_20": cells[f"{hook} 20"]["framework_ms_median"]}
    builtin = {cell["cell"]: {"framework_ms_median": cell["framework_ms_median"], "added_ms": r((statistics.median(cell["framework_us"]) - base) / 1000, 2), "share_pct_median": cell["share_pct_median"]} for cell in cells.values() if cell["k"] is None}
    acts = {}
    for row in data_rows(f"{folder}/02-acts.jsonl"):
        if "start" in row:
            shape = {"start": row["start"]["outcome"], "action_requests": [a["name"] for i in row["start"]["interrupts"] for a in i["action_requests"]], "after_approve_last": row["after_approve"]["messages"][-1][1], "model_calls": [row["start"]["n_model_calls"], row["after_approve"]["n_model_calls"]]}
        else:
            last = row["messages"][-1] if row.get("messages") else None
            shape = {"outcome": row["outcome"], "model_calls": row["n_model_calls"], "first_input_messages": len(row["model_inputs"][-1]) if row["model_inputs"] else 0, "last": last[1][:120] if last else None, "tool_messages": [m[1][:60] for m in row.get("messages", []) if m[0] == "tool"], "error": first_line(row.get("exception"))}
            if "relay_actions" in row:
                shape["relay_actions"] = row["relay_actions"]
        cell = acts.setdefault(row["case"], {"runs": 0, "shapes": []})
        cell["runs"] += 1
        if shape not in cell["shapes"]:
            cell["shapes"].append(shape)
    loads = [row["load"][0] for row in cost[1:] if not row["warm"]]
    return {
        "machine": X86,
        "model": X86_MODEL,
        "run": "create_agent with ChatOllama, 2 real model calls and 1 tool call, sync invoke; framework time is wall time minus time inside ChatOllama._generate; 20 timed runs per cell in shuffled rounds after 2 warm-up rounds that the summary leaves out",
        "load1": [r(min(loads), 1), r(max(loads), 1)],
        "note": "the absolute microseconds depend on the load; use the share of the run and the ratio of node hooks to wrap hooks",
        "first_input_note": "first_input_messages counts the messages of the last model call of the run",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("01-cost.jsonl", "02-acts.jsonl", "t11_real.py", "lr_common.py")],
        "baseline_framework_ms": r(base / 1000, 2),
        "cells": dict(sorted(cells.items())),
        "hooks": hooks,
        "builtin": dict(sorted(builtin.items())),
        "acts": dict(sorted(acts.items())),
    }


def recursion_x86():
    folder = "T17-claims-x86"
    cases = {}
    for row in data_rows(f"{folder}/01-claims.jsonl"):
        if row["case"] == "create_agent_bound_config":
            cases[row["case"]] = {"recursion_limit": row["config"]["recursion_limit"]}
        elif row["case"].startswith("create_agent_forever"):
            cell = cases.setdefault(row["case"], {"limit_reached": int(re.search(r"Recursion limit of (\d+)", row["message_first_line"]).group(1)), "model_calls": [], "tool_calls": [], "wall_s": []})
            cell["model_calls"].append(row["counts"]["model"])
            cell["tool_calls"].append(row["counts"]["tool"])
            cell["wall_s"].append(row["wall_s"])
    for row in data_rows(f"{folder}/02-nolimit.jsonl"):
        cases[row["case"]] = {"result": row["result"], "model_calls": row["model_calls"], "tool_calls": row["tool_calls"], "steps": row["model_calls"] + row["tool_calls"], "wall_s": row["wall_s"], "tool_calls_at_s": row["tool_call_stamps"]}
    return {
        "machine": X86,
        "model": X86_MODEL,
        "prompt": "the model is told to call ping until it answers finished, and ping never does",
        "runs": "3 runs for each recursion_limit; 1 run with no recursion_limit, stopped by the lab script at a 1200 s cap",
        "not_used": "the StateGraph rows have no model and stay in recursion-mac.json",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("01-claims.jsonl", "02-nolimit.jsonl", "t17_real.py", "t17_nolimit.py")],
        "cases": cases,
    }


def replay_fork_x86():
    folder = "T17-claims-x86"
    cases = {}
    for row in data_rows(f"{folder}/01-claims.jsonl"):
        if not row["case"].startswith("agent_"):
            continue
        cell = cases.setdefault(row["case"], {"runs": [], "same_final_as_first": []})
        cell["runs"].append(row["counts"])
        if "same_final_as_first" in row:
            cell["same_final_as_first"].append(row["same_final_as_first"])
    return {
        "machine": X86,
        "model": X86_MODEL,
        "saver": "InMemorySaver",
        "runs_per_case": 3,
        "not_used": "the graph rows have no model and stay in replay-fork-mac.json",
        "sources": [f"capture/lab/{folder}/01-claims.jsonl", f"capture/lab/{folder}/t17_real.py"],
        "cases": cases,
    }


def crash_resume_x86():
    folder = "T02-crash-resume-x86"
    files = ("01-agent-matrix.jsonl", "02-agent-matrix-rep5-19.jsonl")
    trials = [row for name in files for row in rows(f"{folder}/{name}") if row.get("exp") == "T02r"]
    keys = {}
    model_calls = {}
    first_reply = {}
    for row in trials:
        group = keys.setdefault(row["key"], {"trials": 0, "killed": 0, "twice": 0, "next_empty_unfinished": 0, "cells": {}})
        cell = group["cells"].setdefault(f"{row['saver']} {row['durability']} {row['kill_point']}", {"trials": 0, "killed": 0, "twice": 0, "next_empty_unfinished": 0})
        report = row["resume_report"] or {}
        empty = 1 if row["killed"] and report.get("resume_action") == "invoke_none_with_empty_next" else 0
        for target in (group, cell):
            target["trials"] += 1
            target["killed"] += 1 if row["killed"] else 0
            target["twice"] += 1 if row["effects_total"] > 1 else 0
            target["next_empty_unfinished"] += empty
        calls = model_calls.setdefault(row["durability"], {})
        calls[str(row["n_model_calls"])] = calls.get(str(row["n_model_calls"]), 0) + 1
        first = next((len(json.loads(call[3])) for call in row["model_calls"] if call[0] == "run"), None)
        first_reply[str(first)] = first_reply.get(str(first), 0) + 1
    for group in keys.values():
        group["cells"] = dict(sorted(group["cells"].items()))
    return {
        "machine": X86,
        "model": "qwen3:4b-instruct-2507-q4_K_M via ChatOllama 1.1.0, temperature 0, seed 42, num_predict 256, Ollama 0.31.1 on CPU",
        "savers": "SqliteSaver (langgraph-checkpoint-sqlite 3.1.3) and PostgresSaver (langgraph-checkpoint-postgres 3.2.1) on PostgreSQL 16.15",
        "trials_per_cell": "20 for the keys none and call_id, 5 for the key order; exit before_put_writes 5 per key, never reached",
        "twice": "the ledger held more than one charge for the one requested charge",
        "sources": [f"capture/lab/{folder}/{name}" for name in files],
        "keys": dict(sorted(keys.items())),
        "model_calls_by_mode": dict(sorted(model_calls.items())),
        "first_reply_tool_calls": first_reply,
    }


def failure_drill_x86():
    folder = "failure-drill-x86"
    runs = sorted(name[:-6] for name in os.listdir(os.path.join(LAB, folder)) if name.startswith("drill-run") and name.endswith(".jsonl"))
    cases = {}
    for run in runs:
        for row in rows(f"{folder}/{run}.jsonl"):
            cell = cases.setdefault(str(row["case"]), {"title": row["title"], "section": row["section"], "seconds": [], "runs": []})
            cell["seconds"].append(row["seconds"])
            cell["runs"].append({key: value for key, value in row.items() if key not in ("case", "title", "section", "seconds", "check")})
    totals = [float(re.search(r"^total ([0-9.]+) s$", read(f"{folder}/{run}.log"), re.M).group(1)) for run in runs]
    return {
        "machine": X86,
        "model": X86_MODEL + "; ChatOllama in every case except case 1, which uses ChatOpenAI on the /v1 path",
        "failure_sources": "case 1: a relay in front of Ollama that drops every connection; case 2: a SIGKILL inside the tool on SqliteSaver, then a resume in a new process; case 5: LANGSMITH_ENDPOINT on a port where nothing listens; the other cases are the behaviour of the model",
        "runs": len(runs),
        "total_s": totals,
        "sources": [f"capture/lab/{folder}/{name}" for name in [f"{run}.{ext}" for run in runs for ext in ("log", "jsonl")] + ["drill_real.py", "lr_common.py"]],
        "cases": cases,
    }


MAC_REAL_MODEL = "qwen3:4b-instruct-2507-q4_K_M on Ollama 0.31.1 on the GPU of the Mac, temperature 0, seed 42, server default context; another agent ran API rows on the Mac at the same time"


def blocks_load(data):
    loads = [row["load"][0] for row in data if row.get("kind") == "block"]
    return [r(min(loads), 2), r(max(loads), 2)]


def overhead_mac_real():
    folder = "T01-overhead-mac-real"
    data = rows(f"{folder}/01-runs.jsonl")
    timed = [row for row in data if row["kind"] == "run" and not row["warmup"]]
    plain = {"v1": "a_plain_openai", "native": "f_plain_ollama"}
    by_round = {}
    for row in timed:
        by_round.setdefault(row["round"], {})[row["variant"]] = row

    def framework(row):
        return row["wall_ms"] - row["upstream_ms"]

    variants = {}
    for name in sorted({row["variant"] for row in timed}):
        runs = [row for row in timed if row["variant"] == name]
        path = runs[0]["path"]
        base = plain[path]
        paired = [framework(cell[name]) - framework(cell[base]) for cell in by_round.values() if name in cell and base in cell]
        shapes = {}
        for row in runs:
            shape = json.dumps([[q["req_bytes"], (q.get("usage") or {}).get("prompt_tokens") or q.get("prompt_eval_count"), (q.get("usage") or {}).get("completion_tokens") or q.get("eval_count")] for q in row["requests"]])
            shapes[shape] = shapes.get(shape, 0) + 1
        entry = {
            "path": path,
            "n": len(runs),
            "ok": sum(1 for row in runs if row["ok"]),
            "model_calls": sorted({row["model_calls"] for row in runs}),
            "framework_ms": [r(framework(row), 2) for row in runs],
            "framework_ms_median": median([framework(row) for row in runs], 2),
            "framework_share_pct_median": median([100 * framework(row) / row["wall_ms"] for row in runs], 2),
            "framework_minus_plain_paired_ms_median": 0.0 if name == base else median(paired, 2),
            "cpu_ms_median": median([row["cpu_ms"] for row in runs], 2),
            "wall_ms_median": median([row["wall_ms"] for row in runs], 1),
            "model_ms_median": median([row["upstream_ms"] for row in runs], 1),
            "calls_bytes_prompt_completion": [{"calls": json.loads(shape), "runs": n} for shape, n in sorted(shapes.items())],
        }
        if path == "native":
            entry["wall_minus_ollama_total_ms_median"] = median([row["wall_ms"] - row["ollama_total_ms"] for row in runs], 2)
        variants[name] = entry
    header = data[0]
    return {
        "machine": MAC,
        "model": MAC_REAL_MODEL,
        "task": header["prompt"],
        "run": "8 programs in one process, 42 rounds in a seeded shuffled order, the first 2 rounds left out as warm-up; every request went through a recording proxy that timed its upstream time",
        "framework_note": "framework time is the wall time of a run minus the upstream time of its model calls at the proxy, so it holds the HTTP client and the proxy hop too; v1 is the /v1 path of Ollama, native is /api/chat",
        "not_used": "rows with warmup true; wall and model time between programs, because the model time moved with the load of the machine",
        "load1": blocks_load(data),
        "sources": [f"capture/lab/{folder}/{name}" for name in ("01-runs.jsonl", "t01_real.py", "mr_common.py")],
        "variants": variants,
    }


def streaming_mac_real():
    folder = "T04-streaming-mac-real"
    phases = {}
    for phase in ("real_text", "real_tool"):
        data = rows(f"{folder}/{phase}-per-run.jsonl")
        good = [row for row in data if not row["warmup"] and not row["error"]]
        variants = {}
        for name in STREAM_VARIANTS:
            runs = [row for row in good if row["variant"] == name]
            entry = {
                "n": len(runs),
                "errors": sum(1 for row in data if row["variant"] == name and row["error"] and not row["warmup"]),
                "tokens": sorted({row["n_tokens"] for row in runs}),
                "first_delay_ms": [r(row["first_delay_ms"], 2) for row in runs],
                "first_delay_ms_median": median([row["first_delay_ms"] for row in runs], 2),
                "first_delay_ms_p95": p95([row["first_delay_ms"] for row in runs], 2),
                "token_delay_ms_median": median([row["median_delay_ms"] for row in runs], 2),
                "burst_frac_median": median([row["burst_frac"] for row in runs], 2),
                "cpu_ms_median": median([row["cpu_ms"] for row in runs], 1),
                "request_overhead_ms_median": median([row["req_overhead_ms"] for row in runs], 1),
                "call_to_first_seen_ms_median": median([row["ttft_client_ms"] for row in runs], 1),
            }
            tool = [row["tool_first_delay_ms"] for row in runs if row.get("tool_first_delay_ms") is not None]
            if phase == "real_tool" and tool and name != "astream_events_v3_gather":
                entry["tool_first_delay_ms_median"] = median(tool, 2)
                entry["tool_first_delay_ms_p95"] = p95(tool, 2)
                entry["tool_server_events"] = sorted({row["tool_server_events"] for row in runs})
            variants[name] = entry
        loads = [row["load1"] for row in good]
        phases[phase.split("_")[1]] = {"load1": [r(min(loads), 2), r(max(loads), 2)], "variants": variants}
    iso_rows = rows(f"{folder}/03-iso38484-qwen3-8b.jsonl")
    isolation = {}
    for row in iso_rows:
        if row["kind"] != "run" or row["warmup"]:
            continue
        cell = isolation.setdefault(row["pattern"], {"runs": 0, "errors": 0, "text_deltas": [], "reasoning_deltas": [], "server_reasoning_lines": [], "eval_count": [], "first_text_delay_ms": [], "text_receive_spread_ms": [], "text_emit_spread_ms": [], "first_reasoning_delay_ms": [], "reasoning_receive_spread_ms": [], "wall_s": []})
        cell["runs"] += 1
        cell["errors"] += 1 if row["error"] else 0
        cell["text_deltas"].append(row["client_text_deltas"])
        cell["reasoning_deltas"].append(row["client_reasoning_deltas"])
        cell["server_reasoning_lines"].append(row["server_reasoning_lines"])
        cell["eval_count"].append(row["eval_count"])
        cell["first_text_delay_ms"].append(r(row["first_text_delay_ms"], 1))
        cell["text_receive_spread_ms"].append(r(row["receive_spread_ms"], 1))
        cell["text_emit_spread_ms"].append(r(row["emit_spread_ms"], 1))
        cell["first_reasoning_delay_ms"].append(None if row.get("first_reasoning_delay_ms") is None else r(row["first_reasoning_delay_ms"], 1))
        cell["reasoning_receive_spread_ms"].append(None if row.get("reasoning_receive_spread_ms") is None else r(row["reasoning_receive_spread_ms"], 1))
        cell["wall_s"].append(r(row["wall_ms"] / 1000, 1))
    servers = {row["tag"]: row for row in rows(f"{folder}/real_text-server-excerpt.jsonl")}
    timeline = {}
    for run in rows(f"{folder}/real_text-runs-excerpt.jsonl"):
        sent = []
        total = 0
        for event in servers[run["tag"]]["events"]:
            if event[1] == "text":
                total += len(event[3])
                sent.append((event[0], total))
        seen = []
        total = 0
        for stamp, length, _, _ in run["text"]:
            total += length
            seen.append((stamp, total))
        tokens = []
        j = 0
        for stamp, end in sent:
            while j < len(seen) and seen[j][1] < end:
                j += 1
            tokens.append([r((stamp - run["t0"]) / 1e6, 1), r((seen[j][0] - run["t0"]) / 1e6, 1)])
        timeline[run["variant"]] = {"block": run["block"], "run": run["i"], "tokens": tokens}
    return {
        "machine": MAC,
        "model": MAC_REAL_MODEL + "; the #38484 rows use qwen3:8b with reasoning on",
        "proxy": "a stamping proxy on 127.0.0.1 that forwards the real stream of Ollama and stamps each line after writing it",
        "delivery_delay": "the time the consumer saw a token minus the time the proxy passed it on, on one clock",
        "phases_note": "text: a count from 1 to 30, cut at max_tokens 80; tool: one lookup tool call, then a one-sentence answer; 4 blocks of 7 runs per API, the first of each block left out",
        "isolation_note": "ChatOllama with qwen3:8b and reasoning=True, num_predict 1500, five async v3 loops, 1 warm-up run and 5 runs each",
        "not_used": "rows with warmup true; the tool fields of the gather consumer, which reads no tool calls; the CPU and wall times as absolute costs, because the load was shared",
        "load1_isolation": blocks_load(iso_rows),
        "sources": [f"capture/lab/{folder}/{name}" for name in ("real_text-per-run.jsonl", "real_tool-per-run.jsonl", "03-iso38484-qwen3-8b.jsonl", "real_text-runs-excerpt.jsonl", "real_text-server-excerpt.jsonl", "t04_run.py", "t04_stream_server.py", "t04_analyze.py", "t04_iso_real.py")],
        "phases": phases,
        "isolation_38484": isolation,
        "timeline": timeline,
    }


def structured_output_mac_real():
    folder = "T06-structured-output-mac-real"
    data = rows(f"{folder}/01-provider-paths.jsonl")
    cells = {}
    for row in data:
        if row["kind"] != "run":
            continue
        cell = cells.setdefault(f"{row['model']} {row['client']} {row['strategy']}", {"model": row["model"], "client": row["client"], "strategy": row["strategy"], "outcomes": [], "requests": [], "errors": [], "wall_s": [], "completion_tokens": []})
        cell["outcomes"].append(row["outcome"])
        cell["requests"].append([[q["path"], q["status"], q.get("response_format_type") or q.get("format"), "tool_choice" in (q.get("req_keys") or [])] for q in row["requests"]])
        if row.get("error"):
            cell["errors"].append(f"{row['error_type']}: {row['error']}")
        cell["wall_s"].append(r(row["wall_s"], 1))
        last = row["requests"][-1]
        cell["completion_tokens"].append((last.get("usage") or {}).get("completion_tokens") or last.get("eval_count"))
    for cell in cells.values():
        cell["errors"] = sorted(set(cell["errors"]))
    return {
        "machine": MAC,
        "model": "five models on Ollama 0.31.1 on the GPU of the Mac, temperature 0, seed 42",
        "run": "create_agent(tools=[], response_format=Contact) on one made-up line, recursion_limit 12, through a recording proxy; ChatOpenAI on /v1 with max_retries=0 and ChatOllama on /api/chat; 3 runs per cell",
        "requests_note": "each request is path, status, the response_format type or the format of the body, and whether the body held tool_choice",
        "not_used": "the nomic-embed-text rows as a test of the format: Ollama refused the chat request, not the format",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("01-provider-paths.jsonl", "t06_provider_real.py", "mr_common.py")],
        "cells": dict(sorted(cells.items())),
    }


def tracing_mac_real():
    folder = "TRC-tracing-mac-real"
    latency = {}
    for row in rows(f"{folder}/03-latency-summary.jsonl"):
        entry = latency.setdefault(row["cond"], {"non_model_ms_per_run": [], "first_run_non_model_ms": [], "wall_ms_per_run": [], "exit_lag_s": [], "requests": [], "runs_posted": [], "runs_expected": []})
        entry["first_run_non_model_ms"].append(r(row["times"][0]["non_model_ms"], 1))
        entry["non_model_ms_per_run"].extend(r(t["non_model_ms"], 2) for t in row["times"][1:])
        entry["wall_ms_per_run"].extend(r(t["ms"], 1) for t in row["times"][1:])
        entry["exit_lag_s"].append(row["exit_lag_s"])
        entry["requests"].append(row["requests_by_path"])
        entry["runs_posted"].append(row["runs_posted"])
        entry["runs_expected"].append(row["expected_runs"])
    for entry in latency.values():
        entry["n"] = len(entry["non_model_ms_per_run"])
        entry["non_model_ms_median"] = median(entry["non_model_ms_per_run"], 2)
        entry["wall_ms_median"] = median(entry["wall_ms_per_run"], 1)
        del entry["wall_ms_per_run"]
    block = rows(f"{folder}/04-interleave-summary.jsonl")[0]
    times = block["times"][2:]
    paired = [times[i]["non_model_ms"] - times[i + 1]["non_model_ms"] for i in range(0, len(times) - 1, 2) if times[i]["traced"] and not times[i + 1]["traced"]]
    interleave = {"first_run_non_model_ms": r(block["times"][0]["non_model_ms"], 1), "paired_on_minus_off_ms_median": median(paired, 2), "pairs": len(paired), "requests": block["requests_by_path"], "runs_posted": block["runs_posted"], "runs_per_post": sorted({n for n in block["posts_per_request"] if n}), "exit_lag_s": block["exit_lag_s"]}
    for key, traced in (("on", True), ("off", False)):
        part = [t for t in times if bool(t["traced"]) is traced]
        interleave[key] = {"n": len(part), "ok": sum(1 for t in part if t["ok"]), "non_model_ms": [r(t["non_model_ms"], 2) for t in part], "non_model_ms_median": median([t["non_model_ms"] for t in part], 2), "non_model_ms_p95": p95([t["non_model_ms"] for t in part], 2), "wall_ms_median": median([t["ms"] for t in part], 1)}
    failures = {}
    for row in rows(f"{folder}/01-failure-summary.jsonl"):
        failures[row["cond"]] = {"runs": row["n"], "runs_ok": row["ok_runs"], "errors": row["n_errors"], "requests": row["requests_by_path"], "runs_received": row["runs_posted"], "runs_expected": row["expected_runs"], "exit_lag_s": r(row["exit_lag_s"], 1), "exit": f"killed by the driver at {row['timeout_s']} s" if row["rc"] == "timeout" else f"return code {row['rc']}", "flush_ms": r(row["flush_ms"], 1) if row["flush_ms"] else None, "runs_per_post": sorted({n for n in row["posts_per_request"] if n})}
    local = [{"case": row["case"], "tracing_is_enabled": row["tracing_is_enabled_inside"], "answer": row["answer"], "local_trees": row["local_trees"], "env": sorted(row["env"]), "requests": row["patched_requests_seen"] or row["recorder_hits"], "request_count": len(row["patched_requests_seen"]) or row["recorder_hit_count"]} for row in rows(f"{folder}/02-tracing-context-local.jsonl")]
    return {
        "machine": MAC,
        "model": MAC_REAL_MODEL,
        "agent": "create_agent with ChatOllama and one tool add, What is 2 + 3?, 2 model calls and 1 tool call, 7 traced runs per agent run",
        "endpoint": "a local recorder on 127.0.0.1 that records each request; it answers at once, after 2 s, never, or with 500 by state; no LangSmith server was contacted",
        "non_model_note": "non-model time is the wall time of a run minus the total_duration that Ollama reported for its two replies",
        "latency_runs": "3 processes of 21 runs per condition, in separate processes; the first run of each process is kept apart",
        "interleave_runs": "one process of 122 runs with tracing_context(enabled=True) and enabled=False on alternate runs; the first 2 runs are left out",
        "not_used": "the process-level medians as a cost of tracing, because the load reached 21 to 27 in two of those processes; the hang counts are at 300 s",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("04-interleave-summary.jsonl", "03-latency-summary.jsonl", "01-failure-summary.jsonl", "02-tracing-context-local.jsonl", "trc_child_real.py", "trc_driver.py", "trc_recorder.py")],
        "latency": latency,
        "interleave": interleave,
        "failures": failures,
        "local": local,
    }


def p90(values, digits=3):
    data = sorted(values)
    k = (len(data) - 1) * 0.9
    low = int(k)
    high = min(low + 1, len(data) - 1)
    return r(data[low] + (data[high] - data[low]) * (k - low), digits)


def request_counts(entries, key="url"):
    counts = {}
    for entry in entries:
        path = re.sub(r"https://api\.smith\.langchain\.com", "", entry.get(key) or entry.get("path") or "")
        path = re.sub(r"<(id|project-id|dataset-id)-\d+>", "<id>", path)
        name = f"{entry['method']} {path} {entry['status']}"
        counts[name] = counts.get(name, 0) + 1
    return dict(sorted(counts.items()))


def langsmith_account():
    import random

    folder = "T21-langsmith-account-mac"
    timing = rows(f"{folder}/02-e1-timing.jsonl")
    runs = [row for row in timing if row.get("cond") in ("on", "off")]
    first_on = min(row["i"] for row in runs if row["cond"] == "on")
    off = [row["overhead_s"] * 1000 for row in runs if row["cond"] == "off"]
    on = [row["overhead_s"] * 1000 for row in runs if row["cond"] == "on" and row["i"] != first_on]
    rng = random.Random(0)
    boot = sorted(statistics.median(rng.choices(on, k=len(on))) - statistics.median(rng.choices(off, k=len(off))) for _ in range(10000))
    visible = [row["visible"] for row in runs if row.get("visible")]
    requests = rows(f"{folder}/02-e1-timing-requests.jsonl")
    posts = [row for row in requests if row["method"] == "POST"]
    tracing = {
        "runs": {cond: {"n": sum(1 for row in runs if row["cond"] == cond), "correct": sum(1 for row in runs if row["cond"] == cond and row["correct"])} for cond in ("off", "on")},
        "overhead_note": "overhead is the wall time of a run minus the total_duration that Ollama reported for its two model calls",
        "off_overhead_ms_median": median(off, 1),
        "on_overhead_ms_median_without_first": median(on, 1),
        "first_traced_run_overhead_ms": r(next(row["overhead_s"] for row in runs if row["i"] == first_on) * 1000, 1),
        "difference_of_medians_ms": r(statistics.median(on) - statistics.median(off), 1),
        "difference_bootstrap_95_ms": [r(boot[249], 1), r(boot[9749], 1)],
        "bootstrap": "10,000 resamples of each condition with random.Random(0), first traced run left out",
        "wall_s_median": {cond: median([row["wall_s"] for row in runs if row["cond"] == cond], 2) for cond in ("off", "on")},
        "visible_n": len(visible),
        "visible_timeouts": sum(1 for v in visible if v.get("timeout")),
        "first_readable_s": {"median": median([v["first_readable_s"] for v in visible], 2), "p90": p90([v["first_readable_s"] for v in visible], 2), "max": max(v["first_readable_s"] for v in visible)},
        "complete_s": {"median": median([v["complete_s"] for v in visible], 2), "p90": p90([v["complete_s"] for v in visible], 2), "max": max(v["complete_s"] for v in visible)},
        "visible_note": "polls of read_run after invoke returned, 0.25 s apart plus the time of each read",
        "requests": {name: n for name, n in request_counts(requests).items() if not name.startswith("GET /runs/")},
        "post_header_names": sorted({h for row in posts for h in row["req_header_names"]}),
        "responses_with_rate_limit_headers": sum(1 for row in requests if row["resp_limit_headers"]),
    }
    tree_rows = rows(f"{folder}/03-e1-tree.jsonl")
    names = {row["id"]: row["name"] for row in tree_rows}
    root = next(row for row in tree_rows if row["parent_run_id"] is None)
    tree = {
        "runs": [{"name": row["name"], "run_type": row["run_type"], "parent": names.get(row["parent_run_id"]), "tags": row["tags"], "total_tokens": row["total_tokens"], "first_token_time": row["first_token_time"] is not None} for row in tree_rows],
        "root_tokens": [root["prompt_tokens"], root["completion_tokens"], root["total_tokens"]],
        "total_cost": sorted({str(row["total_cost"]) for row in tree_rows}),
        "llm_metadata_keys": sorted(next(row for row in tree_rows if row["run_type"] == "llm")["extra"]["metadata"]),
        "root_metadata_keys": sorted(root["extra"]["metadata"]),
        "runtime_keys": sorted(root["extra"]["runtime"]),
    }
    local_data = json.loads(read(f"{folder}/03b-e1-local.json"))
    listed = {}
    for row in local_data["listed_runs"]:
        key = f"{row['run_type']} {row['name']}"
        listed[key] = listed.get(key, 0) + 1
    local = {"env": local_data["env_vars"], "agent_runs": len(local_data["ids"]), "project_created": local_data["project_info"]["exists"], "project": local_data["project_info"]["name"], "stored_runs": dict(sorted(listed.items())), "traceable_name": "t21_local_traceable", "traceable_stored": sum(1 for row in local_data["listed_runs"] if row["name"] == "t21_local_traceable"), "multipart_posts": sum(1 for row in local_data["requests"] if row["method"] == "POST" and row["url"].endswith("/runs/multipart"))}
    evaluate = {}
    for mode in ("true", "false", "async"):
        data = json.loads(read(f"{folder}/06-e2-{mode}.json"))
        inspect = data["inspect"]
        entry = {"rows": len(data["rows"]), "target": sorted({row["target_run_name"] for row in data["rows"]}), "exact": sum(row["scores"]["exact"] for row in data["rows"]), "judge": sum(row["scores"]["judge"] for row in data["rows"]), "experiment_name": inspect["experiment_name"], "new_projects_with_prefix": sorted(p for p in data["new_projects"] if not p.startswith("aiefs-lc101-pytest")), "requests": {name: n for name, n in request_counts(data["requests"], "path").items() if "/runs/query" not in name and not name.startswith("GET /feedback") and not name.startswith("GET /runs/")}}
        if "project" in inspect:
            entry.update({"stored_runs": inspect["n_runs"], "runs_by_type": inspect["runs_by_type"], "feedback": inspect["feedback"]["n"], "feedback_keys": inspect["feedback"]["keys"], "feedback_source_types": inspect["feedback"]["source_types"], "roots_with_reference_example": inspect["roots_reference_example"], "target_runs_readable": sum(1 for c in inspect["target_run_check"] if c["target_run_readable"])})
        else:
            entry.update({"project_error": inspect["project_error"], "target_runs_readable": sum(1 for c in inspect["target_run_check"] if c["target_run_readable"]), "target_runs_checked": len(inspect["target_run_check"])})
        evaluate[mode] = entry
    printed = read(f"{folder}/06-e2-false-stdout.txt").splitlines()[0]
    where = json.loads(read(f"{folder}/06b-e2-false-where.json"))
    projects = {p["name"]: p for p in where["projects"]}
    landed = next(name for name, p in projects.items() if p["n_children_of_unsent_target"])
    evaluate["false_names"] = {"printed": printed, "experiment_name_returned": evaluate["false"]["experiment_name"], "project_with_the_runs": landed}
    evaluate["false_orphans"] = {"project_runs": projects[landed]["n_runs"], "runs_by_type": projects[landed]["runs_by_type"], "langgraph_runs_with_unsent_parent": projects[landed]["n_children_of_unsent_target"], "trace_root_read": where["trace_root_readable"], "is_root_count": where["is_root_filter_count"], "trace_runs_checked": len(where["orphan_trace_runs"]), "trace_runs_that_are_roots": sum(1 for row in where["orphan_trace_runs"] if row["is_trace_root"])}
    evaluate["evaluators_project"] = projects["evaluators"]["runs_by_type"]
    pytest_rows = [row for row in rows(f"{folder}/04-e3-pytest-runs.jsonl") if row.get("cond")]
    conditions = {}
    for row in pytest_rows:
        cell = conditions.setdefault(row["cond"], {"processes": 0, "return_codes": [], "results": [], "requests": []})
        cell["processes"] += 1
        cell["return_codes"].append(row["rc"])
        cell["results"].append(re.sub(r" in [0-9.]+s", "", row["summary_line"]).strip("= "))
        cell["requests"].append(row["requests_summary"])
    errors = []
    for rep in (1, 2, 3):
        for line in read(f"{folder}/04-e3-on-rep{rep}-stdout.txt").splitlines():
            match = re.match(r"^E\s+(ValueError: .*)$", line)
            if match and match.group(1) not in errors:
                errors.append(match.group(1))
    table = [line for line in read(f"{folder}/04-e3-on-output-rep1-stdout.txt").splitlines() if line.startswith("│")]
    suite = json.loads(read(f"{folder}/04-e3-inspect.json"))
    pytest = {
        "env": "LANGSMITH_TEST_SUITE=aiefs-lc101-pytest and LANGSMITH_EXPERIMENT=aiefs-lc101-pytest-exp, with a key; on-tracing also sets LANGSMITH_TRACING=true and LANGSMITH_PROJECT=aiefs-lc101-pytest-tracing",
        "conditions": conditions,
        "errors_with_tracing_unset": errors,
        "output_table_rep1": table,
        "dataset": {"name": suite["dataset"]["name"], "examples": suite["dataset"]["example_count"], "description": suite["dataset"]["description"], "runner": suite["dataset"]["metadata"]["__ls_runner"]},
        "experiments": [{"stored_runs": e["n_runs"], "roots": len(e["roots"]), "feedback": sorted(f"{f['key']}={f['score']}" for f in e["feedback"])} for e in suite["experiments"]],
        "tracing_project": suite["tracing_project"],
    }
    hub_data = json.loads(read(f"{folder}/05-e4-hub.json"))
    full = json.loads(read(f"{folder}/05b-e4-hub-fullhash.json"))
    hub = {"steps": [{"step": row["step"], "ok": row["ok"], "error": row["error"].split(". HTTPError")[0] if "error" in row else None} for row in hub_data["log"]], "full_hash_pulls": [{"step": row["step"], "http_requests": row["http_requests"]} for row in full["log"]], "requests": {re.sub(r"https://api\.smith\.langchain\.com", "", k): v for k, v in hub_data["requests_summary"].items()}}
    dev = json.loads(read(f"{folder}/07-e5-dev-inspect.json"))
    net = rows(f"{folder}/07-e5-dev-netlog.jsonl")
    hosts = sorted({re.match(r"https?://[^/]+", row["url"]).group(0) for row in net})
    meta = dev["root_metadata_sample"]
    server = {
        "versions": "langgraph-cli 0.4.43, langgraph-api 0.18.0, langgraph-runtime-inmem 0.38.0",
        "runs": len(rows(f"{folder}/07-e5-dev-runs.jsonl")),
        "correct": sum(1 for row in rows(f"{folder}/07-e5-dev-runs.jsonl") if row["correct"]),
        "stored_runs": dev["n_runs"],
        "by_type": dev["by_type"],
        "root_metadata": {k: meta[k] for k in ("LANGSMITH_LANGGRAPH_API_VARIANT", "graph_id", "langgraph_api_version", "langgraph_host", "langgraph_plan", "run_attempt")},
        "root_metadata_keys": dev["root_metadata_keys"],
        "server_run_ids_match_root_ids": dev["server_run_ids_match_root_ids"],
        "hosts": hosts,
        "requests": request_counts(net),
        "up": [line for line in read(f"{folder}/07-e5-up.txt").splitlines() if line.startswith(("Error:", "rc="))],
    }
    probe = json.loads(read(f"{folder}/01-account-probe.json"))
    by_path = {row["path"]: row for row in probe["rows"]}
    flags = by_path["/info"]["body"]["instance_flags"]
    config = by_path["/orgs/current"]["body"]["config"]
    ttl = by_path["/ttl-settings"]["body"][0]
    limits = {
        "batch_ingest_config": by_path["/info"]["body"]["batch_ingest_config"],
        "instance_flags": {k: flags[k] for k in ("trace_tree_max_runs", "trace_tier_duration_days", "max_longlived_ttl_days", "allowed_longlived_ttl_days", "per_project_retention_enabled", "zstd_compression_enabled", "free_tier")},
        "ttl_settings": {k: ttl[k] for k in ("default_trace_tier", "longlived_ttl_days", "configured_by")},
        "org_config": {k: config.get(k) for k in ("plan_tier", "max_workspaces", "max_identities", "can_use_langgraph_cloud", "max_free_langgraph_cloud_deployments", "lsu_per_trace", "lsu_per_trace_retention_upgrade", "message_view_batch_rate_limit_per_sec", "message_view_batch_rate_limit_burst")},
        "usage_limits": by_path["/usage-limits"]["body"],
        "sessions_headers": {k: v for k, v in by_path["/sessions?limit=3"]["resp_headers"].items() if k.lower() in ("deprecation", "sunset", "link")},
        "sdk_max_python": by_path["/info"]["body"]["sdk_versions"]["max_python_sdk_version"],
    }
    inventory = json.loads(read(f"{folder}/99-account-inventory.json"))
    return {
        "machine": MAC,
        "model": "qwen3:4b-instruct-2507-q4_K_M on Ollama 0.31.1 on the GPU of the Mac, ChatOllama with temperature 0, seed 42, reasoning off, num_ctx 16384; another agent used the same Ollama model during the whole batch",
        "account": "a new LangSmith workspace on the free plan, on the US API host api.smith.langchain.com",
        "versions": "langsmith 0.14.17, langchain 1.5.0, langchain-core 1.8.0, langgraph 1.2.22, langchain-ollama 1.1.0; pytest 8.4.2 in a scratch environment",
        "agent": "create_agent with ChatOllama and one tool add, 2 model calls and 1 tool call, 7 traced runs per agent run",
        "not_used": "eval_s of 06 and client_s of 07 as times, because Ollama was shared; the multipart_runs field of the request logs, which is 0 because the bodies are compressed; the not-to-use and 00-smoke rows of the run, which are not kept",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("02-e1-timing.jsonl", "02-e1-timing-requests.jsonl", "03-e1-tree.jsonl", "03b-e1-local.json", "06-e2-true.json", "06-e2-false.json", "06-e2-async.json", "06b-e2-false-where.json", "04-e3-pytest-runs.jsonl", "04-e3-inspect.json", "05-e4-hub.json", "05b-e4-hub-fullhash.json", "07-e5-dev-inspect.json", "07-e5-dev-netlog.jsonl", "07-e5-up.txt", "01-account-probe.json", "99-account-inventory.json")],
        "tracing": tracing,
        "tree": tree,
        "local": local,
        "evaluate": evaluate,
        "pytest": pytest,
        "hub": hub,
        "dev_server": server,
        "limits": limits,
        "stored_runs_total": inventory["total_runs_stored"],
        "projects": sorted(p["name"] for p in inventory["projects"]),
    }


PRODAPP = os.path.join(LAB, "prodapp-mac")
PRODAPP_RUNS = os.path.join(PRODAPP, "runs")
PRODAPP_LABELS = {"qwen3-4b": "Qwen3 4B", "qwen3-14b": "Qwen3 14B", "haiku": "Claude Haiku 5.5"}
PRODAPP_FAULTS = {13: "flaky_faq_is_retried", 14: "hung_tool_times_out", 15: "failed_ticket_is_not_retried",
                  16: "primary_outage_uses_backup", 17: "runaway_loop_hits_call_limit"}
JUNIT_CASE = re.compile(r"<testcase\b([^>]*?)(/>|>(.*?)</testcase>)", re.S)
JUNIT_ATTR = re.compile(r'(\w+)="([^"]*)"')
JUNIT_FAIL = re.compile(r"^\s*<(failure|error)\b([^>]*?)/?>", re.S)


def prod_path(*parts):
    return os.path.join(PRODAPP_RUNS, *parts)


def prod_json(*parts):
    with open(prod_path(*parts), encoding="utf-8") as handle:
        return json.load(handle)


def prod_lines(*parts):
    with open(prod_path(*parts), encoding="utf-8") as handle:
        return [json.loads(line) for line in handle.read().splitlines() if line]


def prod_ts(text):
    from datetime import datetime

    return datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp()


def junit_attrs(text):
    import html

    return {k: html.unescape(re.sub(r"[\t\n\r]", " ", v)) for k, v in JUNIT_ATTR.findall(text)}


def junit_cases(path):
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    for head, _, body in JUNIT_CASE.findall(text):
        attrs = junit_attrs(head)
        failure = JUNIT_FAIL.match(body or "")
        skipped = re.match(r"^\s*<skipped\b", body or "")
        yield attrs, (junit_attrs(failure.group(2)) if failure else None), bool(skipped)


def prod_transcript(record):
    out = []
    for entry in record["log"]:
        result = entry["result"]
        if isinstance(result, int):
            out.append({"op": entry["op"], "http": result})
            continue
        text = "".join(d["text"] for e, d in result if e == "token")
        tools = [(d["name"], d["args"]) for e, d in result if e == "tool_call"]
        statuses = [(d["name"], d["status"]) for e, d in result if e == "tool_result"]
        stops = [d.get("name") for e, d in result if e == "interrupt"]
        done = [d for e, d in result if e == "done"]
        out.append({"op": entry["op"], "say": entry.get("text") or entry.get("decision"), "tool_calls": tools,
                    "tool_results": statuses, "interrupts": stops, "reply": text[:300],
                    "done": done[0] if done else None})
    return out


def prodapp_suite():
    summary = {}
    root = prod_path("suite")
    for model in sorted(n for n in os.listdir(root) if os.path.isdir(os.path.join(root, n))):
        reps = []
        for rep in sorted(n for n in os.listdir(os.path.join(root, model)) if n.startswith("rep-")):
            folder = os.path.join(root, model, rep)
            junit = os.path.join(folder, "junit.xml")
            if not os.path.exists(junit):
                continue
            cases = {}
            for attrs, failure, skipped in junit_cases(junit):
                cases[attrs["name"]] = {"outcome": "failed" if failure is not None else ("skipped" if skipped else "passed"),
                                        "seconds": float(attrs["time"]),
                                        "message": (failure.get("message") or "")[:400] if failure is not None else None}
            details = {}
            folder_cases = os.path.join(folder, "cases")
            for name in sorted(os.listdir(folder_cases)) if os.path.isdir(folder_cases) else []:
                if not name.endswith(".json"):
                    continue
                with open(os.path.join(folder_cases, name), encoding="utf-8") as handle:
                    record = json.load(handle)
                details[record["case"]] = {"refunds": record["refunds"], "tickets": record["tickets"],
                                           "transcript": prod_transcript(record)}
            with open(os.path.join(folder, "block.txt"), encoding="utf-8") as handle:
                block = handle.read().splitlines()
            reps.append({"rep": rep, "block": block, "cases": cases, "details": details,
                         "passed": sum(c["outcome"] == "passed" for c in cases.values()), "total": len(cases)})
        summary[model] = reps
    return summary


def prod_stats(values):
    return {"n": len(values), "median": statistics.median(values), "mean": round(statistics.mean(values), 1),
            "max": max(values), "min": min(values)}


def prod_conversations(rep):
    from collections import defaultdict

    spans = prod_lines("suite", *rep, "test-spans.jsonl")
    owner = {s["context"]["trace_id"]: s["attributes"]["user.id"] for s in spans if s["name"] == "agent.run"}
    convs = defaultdict(lambda: {"calls": 0, "input": 0, "output": 0, "model_s": 0.0, "summarizer_calls": 0,
                                 "summarizer_input": 0, "summarizer_output": 0, "by_model": defaultdict(int)})
    for span in spans:
        user = owner.get(span["context"]["trace_id"])
        if span["name"] != "model.call" or not user or not user.startswith("e"):
            continue
        if span["status"]["status_code"] == "ERROR":
            continue
        a = span["attributes"]
        c = convs[user]
        c["calls"] += 1
        c["input"] += a.get("gen_ai.usage.input_tokens", 0)
        c["output"] += a.get("gen_ai.usage.output_tokens", 0)
        c["by_model"][a.get("gen_ai.request.model")] += 1
        c["model_s"] += prod_ts(span["end_time"]) - prod_ts(span["start_time"])
    with open(prod_path("suite", *rep, "block.txt"), encoding="utf-8") as handle:
        primary = next(l.split()[2] for l in handle.read().splitlines() if l.startswith("# model "))
    if os.path.exists(prod_path("suite", *rep, "usage.jsonl")):
        for row in prod_lines("suite", *rep, "usage.jsonl"):
            user = owner.get("0x" + str(row.get("trace_id")))
            if row["model"] != primary:
                continue
            if user and user.startswith("e"):
                c = convs[user]
                c["billed_calls"] = c.get("billed_calls", 0) + 1
                c["billed_input"] = c.get("billed_input", 0) + row["input_tokens"]
                c["billed_output"] = c.get("billed_output", 0) + row["output_tokens"]
                c["billed_by_model"] = {**c.get("billed_by_model", {}), row["model"]: c.get("billed_by_model", {}).get(row["model"], 0) + 1}
            if row.get("span") != "model.call" and user and user.startswith("e"):
                c = convs[user]
                c["summarizer_calls"] += 1
                c["summarizer_input"] += row["input_tokens"]
                c["summarizer_output"] += row["output_tokens"]
    return {u: {**v, "by_model": dict(v["by_model"]), "model_s": round(v["model_s"], 3)} for u, v in sorted(convs.items())}


def prodapp_cost():
    with open(os.path.join(PRODAPP, "code", "cost", "prices.json"), encoding="utf-8") as handle:
        prices = json.load(handle)
    result = {"prices": {k: prices[k] for k in ("source", "fetched", "unit")}, "models": {}}
    root = prod_path("suite")
    for model in sorted(n for n in os.listdir(root) if os.path.isdir(os.path.join(root, n))):
        if not os.path.exists(prod_path("suite", model, "rep-1", "test-spans.jsonl")):
            continue
        convs = prod_conversations((model, "rep-1"))
        entry = {"conversations": convs,
                 "calls": prod_stats([c["calls"] for c in convs.values()]),
                 "input": prod_stats([c["input"] for c in convs.values()]),
                 "output": prod_stats([c["output"] for c in convs.values()]),
                 "summarizer_input_total": sum(c["summarizer_input"] for c in convs.values()),
                 "agent_input_total": sum(c["input"] for c in convs.values()),
                 "model_seconds": prod_stats([c["model_s"] for c in convs.values()]),
                 "billed_input": prod_stats([c.get("billed_input", 0) for c in convs.values()]),
                 "billed_output": prod_stats([c.get("billed_output", 0) for c in convs.values()]),
                 "billed_calls": prod_stats([c.get("billed_calls", 0) for c in convs.values()])}
        if "haiku" in model:
            mine = [r for r in prod_lines("cost-ledger.jsonl") if str(r.get("cell", "")).startswith(f"prodapp|evals|{model}")]
            entry["ledger"] = {"calls": len(mine), "input_tokens": sum(r["input_tokens"] for r in mine),
                               "output_tokens": sum(r["output_tokens"] for r in mine),
                               "cost_usd": round(sum(r["cost_usd"] for r in mine), 6)}
            priced = {}
            for name, p in prices["models"].items():
                if p["input"] == 0:
                    continue
                cost = [(c.get("billed_input", c["input"]) * p["input"] + c.get("billed_output", c["output"]) * p["output"]) / 1e6
                        for c in convs.values()]
                priced[name] = {"in_per_mtok": p["input"], "out_per_mtok": p["output"], "per_conv_mean": round(statistics.mean(cost), 6),
                                "per_1000_conv": round(1000 * statistics.mean(cost), 3), "max_conv": round(max(cost), 6)}
            entry["priced"] = priced
        result["models"][model] = entry
    return result


def prodapp_evals(suite):
    with open(os.path.join(PRODAPP, "code", "scripts", "causes.json"), encoding="utf-8") as handle:
        causes = json.load(handle)
    models = []
    for key in ("qwen3-4b", "qwen3-14b", "haiku"):
        models.append({"key": key, "label": PRODAPP_LABELS[key],
                       "reps": [{"rep": r["rep"], "passed": r["passed"], "total": r["total"],
                                 "uptime": [l for l in r["block"] if l.startswith("# uptime")],
                                 "cases": {n: c["outcome"] for n, c in r["cases"].items()},
                                 "seconds": {n: c["seconds"] for n, c in r["cases"].items()}} for r in suite.get(key, [])]})
    return {"models": models, "causes": causes}


def prodapp_faults():
    result = {}
    for key in ("qwen3-4b", "qwen3-14b", "haiku"):
        if not os.path.exists(prod_path("suite", key, "rep-1", "test-spans.jsonl")):
            continue
        spans = prod_lines("suite", key, "rep-1", "test-spans.jsonl")
        owner = {s["context"]["trace_id"]: s["attributes"]["user.id"] for s in spans if s["name"] == "agent.run"}
        found = {}
        for n, case in PRODAPP_FAULTS.items():
            mine = [s for s in spans if owner.get(s["context"]["trace_id"]) == f"e{n:02d}"]
            ordered = sorted(mine, key=lambda s: s["start_time"])
            tools = [{"name": s["name"], "error": s["status"]["status_code"] == "ERROR",
                      "ms": round((prod_ts(s["end_time"]) - prod_ts(s["start_time"])) * 1000, 1)}
                     for s in ordered if s["name"].startswith("tool.")]
            models = [{"model": s["attributes"].get("gen_ai.request.model"), "error": s["status"]["status_code"] == "ERROR"}
                      for s in ordered if s["name"] == "model.call"]
            record = prod_json("suite", key, "rep-1", "cases", f"{n:02d}-{case}.json")
            reply = ""
            for entry in record["log"]:
                if isinstance(entry["result"], list):
                    reply = "".join(d["text"] for e, d in entry["result"] if e == "token")
            found[case] = {"outcome": record["outcome"], "tools": tools, "model_calls": models, "reply": reply,
                           "run_seconds": [round(prod_ts(s["end_time"]) - prod_ts(s["start_time"]), 2) for s in mine if s["name"] == "agent.run"]}
        result[key] = found
    return result


def prodapp_crash():
    keep = ("trial", "outcome", "refund_committed_before_kill", "kill_exit_code", "approve_client_error", "rows_after_kill",
            "after_restart_next", "approval_re_asked", "replayed_flags", "refunded_cents", "final_next", "marks", "uptime_before")
    result = {}
    for form in ("map", "plain"):
        if os.path.exists(prod_path(f"crash-{form}", "crash-trials.json")):
            result[form] = [{k: r.get(k) for k in keep} | {"refund_rows": len(r.get("refund_rows") or []),
                                                           "first_tool_calls": [c["name"] for c in r.get("first_tool_calls", [])],
                                                           "resumed_tool_calls": [c["name"] for c in r.get("resumed_tool_calls", [])]}
                            for r in prod_json(f"crash-{form}", "crash-trials.json")]
    timeline = []
    for name in ("t01-before-kill", "t01-after-restart"):
        if os.path.exists(prod_path("crash-map", f"{name}.log.jsonl")):
            for e in prod_lines("crash-map", f"{name}.log.jsonl"):
                timeline.append({"file": name, "ts": e["ts"], "event": e["event"],
                                 **{k: e[k] for k in ("status", "tool", "seconds") if k in e}})
        if os.path.exists(prod_path("crash-map", f"{name}.spans.jsonl")):
            for s in prod_lines("crash-map", f"{name}.spans.jsonl"):
                timeline.append({"file": name, "span": s["name"], "start": prod_ts(s["start_time"]), "end": prod_ts(s["end_time"]),
                                 "status": s["status"]["status_code"]})
    result["trial1_timeline"] = timeline
    return result


def prodapp_stream():
    base = "stream-warm" if os.path.exists(prod_path("stream-warm", "stream-events.jsonl")) else "stream"
    lines = prod_lines(base, "stream-events.jsonl")
    spans = [{"name": s["name"], "start": prod_ts(s["start_time"]), "end": prod_ts(s["end_time"]),
              "attributes": {k: v for k, v in s["attributes"].items() if k.startswith(("gen_ai", "tool", "run"))},
              "status": s["status"]["status_code"], "trace_id": s["context"]["trace_id"]} for s in prod_lines(base, "stream.spans.jsonl")]
    turns = {}
    for l in lines:
        if "turn" in l and l.get("kind") == "token":
            t = turns.setdefault(l["turn"], {"tokens": 0, "first_ms": l["t_ms"], "last_ms": l["t_ms"]})
            t["tokens"] += 1
            t["last_ms"] = l["t_ms"]
    cold = [l for l in prod_lines("stream", "stream-events.jsonl") if l.get("kind") not in ("token",)]
    return {"source": base, "events": [l for l in lines if l.get("kind") != "token"], "token_runs": turns,
            "spans": spans, "cold_capture": cold}


def prodapp_load_cell(folder, cell):
    from collections import Counter

    name = f"load-{cell['workers']}w-{cell['users']}u-{int(cell['model_latency_s'] * 1000)}ms"
    ends = Counter()
    for log in sorted(n for n in os.listdir(prod_path(folder)) if n.startswith(f"{name}-w") and n.endswith(".log.jsonl")):
        for e in prod_lines(folder, log):
            if e["event"] == "run.end":
                ends[e["status"]] += 1
    found = prod_json(folder, f"{name}.rows.json")
    cell["server_run_end"] = dict(ends)
    cell["runs_per_s_exact"] = round(cell["ok"] / cell["wall_s"], 3)
    cell["client_errors"] = dict(Counter(r.get("error") for r in found if r["kind"] == "error"))
    cell["run_seconds"] = sorted(round(r["seconds"], 3) for r in found if r.get("seconds") is not None)


def prodapp_load():
    cells = prod_json("load", "load-summary.json")
    for cell in cells:
        prodapp_load_cell("load", cell)
    extra = {"baseline": []}
    for folder in sorted(n for n in os.listdir(PRODAPP_RUNS) if n.startswith("load-baseline-")):
        for cell in prod_json(folder, "load-summary.json"):
            found = prod_json(folder, "load-1w-1u-0ms.rows.json")
            cell["run_seconds"] = [round(r["seconds"], 3) for r in found if r.get("seconds") is not None]
            cell["run_kinds"] = [r["kind"] for r in found]
            extra["baseline"].append(cell)
    if os.path.exists(prod_path("load", "ollama-parallel.json")):
        extra["ollama_parallel"] = prod_json("load", "ollama-parallel.json")
    if os.path.exists(prod_path("load-rerun", "load-summary.json")):
        for cell in prod_json("load-rerun", "load-summary.json"):
            prodapp_load_cell("load-rerun", cell)
            cell["note"] = "rerun: the first 1-worker 10-user cell ran while 12 leaked test servers held Postgres connections"
            i = next(i for i, c in enumerate(cells) if c["workers"] == cell["workers"] and c["users"] == cell["users"])
            extra["replaced_cell"] = cells[i]
            cells[i] = cell
    if os.path.exists(prod_path("load-notes.txt")):
        with open(prod_path("load-notes.txt"), encoding="utf-8") as handle:
            extra["notes"] = handle.read().splitlines()
    return {"cells": cells, **extra}


FIX_CASES = ["refund_approved_once", "refund_rejected_has_no_side_effect", "refund_asked_twice",
             "refund_tool_replay_is_idempotent", "new_message_while_waiting_for_approval", "status_then_refund_in_one_thread"]
FIX_CRASH = "test_kill_mid_refund_then_resume_refunds_once"


def fix_junit(path):
    out = {}
    for attrs, failure, skipped in junit_cases(str(path)):
        out[attrs["name"].replace("test_eval[", "").rstrip("]")] = "failed" if failure is not None else ("skipped" if skipped else "passed")
    return out


def fix_run(root, model):
    from pathlib import Path

    reps = []
    for rep in sorted((Path(root) / model).glob("rep-*")):
        if not (rep / "junit.xml").exists():
            continue
        outcomes = fix_junit(rep / "junit.xml")
        rows, proposals = {}, []
        for case in FIX_CASES:
            hits = list((rep / "cases").glob(f"*-{case}.json"))
            if not hits:
                continue
            record = json.loads(hits[0].read_text(encoding="utf-8"))
            rows[case] = record["refunds"]
            for entry in record["log"]:
                if isinstance(entry["result"], list):
                    for kind, data in entry["result"]:
                        if kind == "interrupt":
                            proposals.append({"case": case, "amount_cents": data["args"].get("amount_cents"),
                                              "description": data.get("description")})
                        if kind == "tool_result" and data["name"] == "refund_order":
                            proposals.append({"case": case, "result": data["content"]})
        reps.append({"rep": rep.name, "outcomes": {k: v for k, v in outcomes.items() if k in FIX_CASES + [FIX_CRASH]},
                     "refund_rows": rows, "approvals_and_results": proposals,
                     "block": (rep / "block.txt").read_text(encoding="utf-8").splitlines()})
    return reps


def prodapp_fix():
    from collections import Counter
    from pathlib import Path

    runs, fix = Path(PRODAPP_RUNS), Path(PRODAPP_RUNS) / "fix"
    result = {"after": {}, "before": {}, "crash_after": {}, "crash_suite_after": {}, "load": {},
              "note": "crash test results inside fix/suite were recorded with a broken parser and are replaced by fix/suite-crash"}
    for model in ("qwen3-4b", "qwen3-14b"):
        result["after"][model] = fix_run(fix / "suite", model)
        for rep in result["after"][model]:
            rep["outcomes"].pop(FIX_CRASH, None)
        suite_crash = []
        for rep in sorted((fix / "suite-crash" / model).glob("rep-*")):
            if (rep / "junit.xml").exists():
                report = rep / "crash-test.json"
                data = json.loads(report.read_text(encoding="utf-8")) if report.exists() else {}
                suite_crash.append({"rep": rep.name, "outcome": fix_junit(rep / "junit.xml").get(FIX_CRASH),
                                    "first_run_last_event": data.get("first_run_last_event"),
                                    "refund_rows": len(data.get("refund_rows") or []),
                                    "after_restart_next": data.get("after_restart_next")})
        result["crash_suite_after"][model] = suite_crash
        result["before"][model] = [{"rep": r["rep"], "outcomes": r["outcomes"], "refund_rows": r["refund_rows"]}
                                   for r in fix_run(runs / "suite", model)]
        crash = fix / f"crash-{model}" / "crash-trials.json"
        if crash.exists():
            result["crash_after"][model] = [{k: t.get(k) for k in ("trial", "outcome", "approval_re_asked", "after_restart_next",
                                                                   "replayed_flags", "refunded_cents")}
                                            | {"refund_rows": len(t.get("refund_rows") or []),
                                               "first_interrupt_description": (t.get("first_interrupts") or [{}])[0].get("description")}
                                            for t in json.loads(crash.read_text(encoding="utf-8"))]
    for label, folder in (("after", fix / "load"), ("before", runs / "load")):
        summary = folder / "load-summary.json"
        if not summary.exists():
            continue
        for cell in json.loads(summary.read_text(encoding="utf-8")):
            if cell["workers"] == 1 and cell["users"] == 50:
                rows = json.loads((folder / "load-1w-50u-0ms.rows.json").read_text(encoding="utf-8"))
                ends = Counter()
                for log in folder.glob("load-1w-50u-0ms-w*.log.jsonl"):
                    for line in log.read_text(encoding="utf-8").splitlines():
                        e = json.loads(line)
                        if e["event"] == "run.end":
                            ends[e["status"]] += 1
                cell["client_errors"] = dict(Counter(r.get("error") for r in rows if r["kind"] == "error"))
                cell["server_run_end"] = dict(ends)
                cell["runs_per_s_exact"] = round(cell["ok"] / cell["wall_s"], 3)
                cell["run_seconds"] = sorted(round(r["seconds"], 3) for r in rows if r.get("seconds") is not None)
                result["load"][label] = cell
    return result


def prodapp_outputs():
    suite, cost = prodapp_suite(), json.dumps(prodapp_cost(), indent=1)
    return {
        "runs/summary/suite-mac.json": json.dumps(suite, indent=1, default=str),
        "runs/summary/cost-real.json": cost,
        "summary/evals-mac.json": json.dumps(prodapp_evals(suite), indent=1),
        "summary/faults-mac.json": json.dumps(prodapp_faults(), indent=1),
        "summary/crash-mac.json": json.dumps(prodapp_crash(), indent=1),
        "summary/drain-mac.json": json.dumps(prod_json("drain", "drain-trials.json"), indent=1),
        "summary/stream-mac.json": json.dumps(prodapp_stream(), indent=1),
        "summary/disconnect-mac.json": json.dumps(prod_json("disconnect", "disconnect-trials.json"), indent=1),
        "summary/service-mac.json": json.dumps(prod_json("service", "service-properties.json"), indent=1),
        "summary/load-mac.json": json.dumps(prodapp_load(), indent=1),
        "summary/fix-mac.json": json.dumps(prodapp_fix(), indent=1, default=str),
        "summary/cost-mac.json": cost,
    }


def quant(values, q, digits=1):
    data = sorted(values)
    k = (len(data) - 1) * q
    low = int(k)
    high = min(low + 1, len(data) - 1)
    return r(data[low] + (data[high] - data[low]) * (k - low), digits)


REAL_X86_MODEL = "qwen3:4b-instruct-2507-q4_K_M via ChatOllama 1.1.0, temperature 0, seed 42, num_ctx 8192 set by the script, Ollama 0.31.1 on CPU, one request at a time"


def long_threads_x86_real():
    import ast

    folder = "T10-long-threads-x86-real"
    names = ["none", "msgs60_keep7", "tok6000_keep1500", "msgs20_keep1"]

    def largest(row):
        return max(call["in_tok"] or 0 for call in row["calls"])

    def sums_in_answer(row):
        text = row["answer"].replace(",", "")
        return all(re.search(rf"(?<!\d){n}(?!\d)", text) for n in row["expect"])

    variants = {}
    for name in names:
        data = rows(f"{folder}/01-turns-{name}.jsonl")
        head = data[0]
        turns = [row for row in data if row.get("exp") == "T10r"]
        calls = [call for row in turns for call in row["calls"]]
        summaries = [entry for row in turns for entry in row["summ"]]
        adds = [row for row in turns if row["expect"]]
        plain = [row["latency_ms"] for row in turns if row["summary_calls"] == 0]
        summed = [row["latency_ms"] for row in turns if row["summary_calls"] > 0]
        blocks = []
        for start in range(1, turns[-1]["turn"] + 1, 25):
            part = [row for row in turns if start <= row["turn"] < start + 25]
            times = [row["latency_ms"] for row in part]
            sized = [row for row in part if "bytes" in row]
            part_adds = [row for row in part if row["expect"]]
            blocks.append({
                "turns": f"{part[0]['turn']}-{part[-1]['turn']}",
                "turn_p10_ms": quant(times, 0.1),
                "turn_p50_ms": quant(times, 0.5),
                "turn_p90_ms": quant(times, 0.9),
                "prompt_tokens_max": max(largest(row) for row in part),
                "summary_turns": [row["turn"] for row in part if row["summary_calls"]],
                "add_turns_right": f"{sum(1 for row in part_adds if row['correct'])}/{len(part_adds)}",
                "thread_mb": r(sized[-1]["bytes"]["main_total"] / 1e6, 2) if sized else None,
            })
        full = next((row["turn"] for row in turns if largest(row) >= head["num_ctx"] - 1), None)
        last = [row for row in turns if "bytes" in row][-1]
        variants[name] = {
            "summarization": head["summarization"],
            "turns": len(turns),
            "model_calls": len(calls),
            "summary_calls": sum(row["summary_calls"] for row in turns),
            "errors": sum(1 for row in turns if row["error"]),
            "orphan_tool_messages": sum(call["orphans"] for call in calls),
            "add_turns_right": f"{sum(1 for row in adds if row['correct'])}/{len(adds)}",
            "add_turns_sums_in_answer": f"{sum(1 for row in adds if sums_in_answer(row))}/{len(adds)}",
            "add_turns_tool_ran": f"{sum(1 for row in adds if row['tool_msgs_this_turn'] >= len(row['expect']))}/{len(adds)}",
            "turn_p50_ms_without_summary": quant(plain, 0.5),
            "turn_p50_ms_with_summary": quant(summed, 0.5) if summed else None,
            "summary_call_p50_ms": quant([entry["ms"] for entry in summaries], 0.5) if summaries else None,
            "summary_call_max_ms": r(max(entry["ms"] for entry in summaries), 1) if summaries else None,
            "framework_p50_ms": quant([row["framework_ms"] for row in turns], 0.5),
            "prompt_tokens_max": max(largest(row) for row in turns),
            "context_full_from_turn": full,
            "full_context_turns": [{"turn": row["turn"], "turn_s": r(row["latency_ms"] / 1000, 1), "prompt_tokens_max": largest(row)} for row in turns if full and row["turn"] >= full],
            "thread": {"turn": last["turn"], "mb": r(last["bytes"]["main_total"] / 1e6, 2)},
            "blocks": blocks,
            "recall": [{"turn": row["turn"], "right": row["recall"], "missed": [probe["fact"] for probe in row["probes"] if not probe["correct"]]} for row in turns if "probes" in row],
        }
    log = read(f"{folder}/02-none-probe-after-deadline.log")
    answered = [ast.literal_eval(line) for line in log.splitlines() if line.startswith("{'fact'")]
    refusal = re.search(r'"message":"([^"]+)"', log)
    return {
        "machine": X86,
        "model": REAL_X86_MODEL + "; num_predict 160, and 512 for the summary model",
        "saver": "PostgresSaver on PostgreSQL 16.15, default durability",
        "run": "create_agent, 200 turns in one thread per variant; turns 1 to 5 give five facts, then a plain answer, one add call, and two parallel add calls in turn; five recall questions every 25 turns on a fork of the thread",
        "runs_per_variant": 1,
        "deadline": "about 70 minutes per variant; the run without summarization stopped after turn 94",
        "thread_mb": "bytes.main_total, the thread without the bytes of the recall forks",
        "sources": [f"capture/lab/{folder}/01-turns-{name}.jsonl" for name in names] + [f"capture/lab/{folder}/02-none-probe-after-deadline.log"],
        "model_calls_total": sum(entry["model_calls"] for entry in variants.values()),
        "orphan_tool_messages_total": sum(entry["orphan_tool_messages"] for entry in variants.values()),
        "variants": variants,
        "none_after_deadline": {
            "answered": [{"fact": probe["fact"], "right": probe["correct"], "answer": probe["answer"], "messages": probe["calls"][0]["req_msgs"], "prompt_tokens": probe["calls"][0]["in_tok"]} for probe in answered],
            "fifth": refusal.group(1) if refusal else None,
        },
    }


def concurrency_x86_real():
    folder = "T16-concurrency-x86-real"
    data = [row for row in rows(f"{folder}/01-levels.jsonl") if row.get("exp") == "T16r"]
    cells = {}
    for row in sorted(data, key=lambda row: (row["config"], row["level"], row["rep"])):
        cell = cells.setdefault(f"{row['config']} {row['level']}", {"config": row["config"], "threads": row["level"], "reps": []})
        cell["reps"].append({
            "rep": row["rep"],
            "wall_s": r(row["wall_s"], 1),
            "runs": row["runs_expected"],
            "runs_right": row["runs_correct"],
            "errors": row["errors"],
            "runs_per_s": r(row["runs_ok"] / row["wall_s"], 3),
            "model_calls_per_s": row["model_calls_per_s"],
            "model_calls_open_max": row["model_client_overlap_max"],
            "model_call_p50_s": row["model_call_s"]["p50"],
            "run_p50_ms": round(row["run_ms"]["p50"]),
            "aput_p50_ms": r(row["ckpt_put_ms"]["p50"], 1),
            "aput_p99_ms": r(row["ckpt_put_ms"]["p99"], 1),
            "aput_writes_p50_ms": r(row["ckpt_put_writes_ms"]["p50"], 1),
            "aput_writes_p99_ms": r(row["ckpt_put_writes_ms"]["p99"], 1),
            "aget_tuple_p50_ms": r(row["ckpt_get_tuple_ms"]["p50"], 1),
            "aget_tuple_p99_ms": r(row["ckpt_get_tuple_ms"]["p99"], 1),
            "checkpoint_ms_total": r(row["ckpt_ms_total"], 0),
            "rows": row["rows"],
            "pg_conns_max": row["pg_conns"]["max"],
            "pg_conns_active_max": row["pg_conns"]["max_active"],
            "client_cpu_s": row["client_cpu_s"],
        })
    return {
        "machine": X86,
        "model": REAL_X86_MODEL + "; num_predict 128",
        "saver": "AsyncPostgresSaver (langgraph-checkpoint-postgres 3.2.1) on PostgreSQL 16.15, max_connections 100, default durability",
        "run": "one asyncio process; each thread ran 2 agent runs of 2 model calls and 1 add call; one connection (single) and AsyncConnectionPool of 20 (pool20)",
        "reps_per_cell": 2,
        "runs_total": sum(rep["runs"] for cell in cells.values() for rep in cell["reps"]),
        "runs_right_total": sum(rep["runs_right"] for cell in cells.values() for rep in cell["reps"]),
        "errors_total": sum(rep["errors"] for cell in cells.values() for rep in cell["reps"]),
        "not_used": "the p99 of checkpoint calls at 16 and 64 threads as database time, because the client timings hold event loop wait",
        "sources": [f"capture/lab/{folder}/01-levels.jsonl", f"capture/lab/{folder}/t16r_conc.py"],
        "cells": dict(sorted(cells.items(), key=lambda item: (item[1]["config"], item[1]["threads"]))),
    }


def agent_server_x86_real():
    folder = "T15-agent-server-x86-real"

    def stat(entry):
        return {key: r(entry[key], 1) for key in ("p50", "p99", "min", "max")}

    load = [{
        "server": row["server"],
        "clients": row["concurrency"],
        "runs": row["runs"],
        "ok": row["ok"],
        "errors": row["errors"],
        "wall_s": r(row["wall_s"], 1),
        "runs_per_s": r(row["runs_per_s"], 3),
        "model_calls_per_s": r(row["model_calls_per_s"], 3),
        "model_calls_open_max": row["model_overlap_max"],
        "client_ms": stat(row["client_ms"]),
        "model_ms_per_run": stat(row["model_ms_per_run"]),
        "server_added_ms": stat(row["server_added_ms"]),
        "wait_before_first_model_ms": stat(row["wait_before_first_model_ms"]),
    } for row in rows(f"{folder}/02-load.jsonl")]
    floor = [{
        "server": row["server"],
        "how": row["how"],
        "n": row["n"],
        "ok": row["ok"],
        "client_ms": stat(row["client_ms"]),
        "model_ms": stat(row["model_ms"]),
        "server_added_ms": stat(row["server_added_ms"]),
        "wait_before_first_model_ms": stat(row["wait_before_first_model_ms"]),
    } for row in rows(f"{folder}/03-floor.jsonl")]
    workers = [{
        "server": row["server"],
        "background_runs": row["background_runs"],
        "wall_s": r(row["wall_s"], 1),
        "statuses": row["final_statuses"],
        "runs_in_flight_max": row["max_runs_in_flight"],
        "model_calls_open_max": row["max_model_calls_in_flight_client_side"],
        "run_start_offsets_s": row["run_start_offsets_s"],
    } for row in rows(f"{folder}/04-workers.jsonl")]
    recursion = [{
        "config": row["config"],
        "status": row["run_status"],
        "error": "GraphRecursionError" if "GraphRecursionError" in (row.get("result") or "") else None,
        "wall_s": r(row["wall_s"], 1),
        "model_calls": row["model_calls"],
        "tool_calls": row["tool_calls_ping"],
        "status_at_cap": row.get("status_at_cap"),
    } for row in rows(f"{folder}/01-recursion.jsonl")]
    return {
        "machine": X86,
        "model": REAL_X86_MODEL + "; num_predict 128",
        "server": "langgraph dev --no-browser --no-reload, langgraph-cli 0.4.43, langgraph-api 0.18.0, langgraph-runtime-inmem 0.38.0; dev-default has no jobs setting, dev-njobs10 has --n-jobs-per-worker 10",
        "graphs": "agent: create_agent with an add tool; loopagent: create_agent with a ping tool that always asks to be called again",
        "server_added": "client time of a run minus the time inside its model calls",
        "not_used": "ollama_busy_s of 02-load.jsonl where model_overlap_max is above 1, because Ollama's total_duration includes its own queue",
        "sources": [f"capture/lab/{folder}/{name}" for name in ("01-recursion.jsonl", "02-load.jsonl", "03-floor.jsonl", "04-workers.jsonl", "t15r_drive.py", "t15rapp/graphs.py")],
        "recursion": recursion,
        "floor": floor,
        "workers": workers,
        "load": load,
    }


CHAT_UI = os.path.join(LAB, "chat-ui-mac")
CHAT_UI_FIRST_ISOLATED_REQUEST = 8
SEC_FS = "T22-sec-fs-permissions-mac"
SEC_STORE = "T23-sec-store-namespace-mac"
SEC_BLOCKING = ("DENY", "PATH-BLOCK", "ASK")


def chat_ui_rows(name):
    with open(os.path.join(CHAT_UI, "runs", name), encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def chat_ui_sse(n):
    with open(os.path.join(CHAT_UI, "runs", "sse", f"{n:04d}.sse"), encoding="utf-8") as handle:
        return handle.read().replace("\r\n", "\n")


def chat_ui_sse_data(block):
    return json.loads("".join(line[5:].strip() for line in block.split("\n") if line.startswith("data:")))


def chat_ui_first_text(request):
    for block, event in zip(chat_ui_sse(request["n"]).split("\n\n"), request["events"]):
        if event["event"] != "messages":
            continue
        message = chat_ui_sse_data(block)[0]
        if message.get("type") == "AIMessageChunk" and (message.get("content") or message.get("tool_calls")):
            kind = ("text", message["content"]) if message.get("content") else ("tool_call", message["tool_calls"][0]["name"])
            return request["t"] + event["dt"], kind
    return None, (None, None)


def chat_ui_marks():
    folder = os.path.join(CHAT_UI, "runs", "ui-marks")
    marks = {}
    for name in sorted(os.listdir(folder)):
        with open(os.path.join(folder, name), encoding="utf-8") as handle:
            marks[name[len("ui-marks-"):-len(".json")]] = json.load(handle)
    return marks


def chat_ui_timing():
    requests = chat_ui_rows("requests.jsonl")
    events = chat_ui_rows("graph-events.jsonl")
    marks = chat_ui_marks()
    out = []
    for request in requests:
        if request["method"] != "POST" or not request["path"].endswith("/runs/stream"):
            continue
        start, end = request["t"], request["t"] + request["secs"]
        body = request["body"]
        kind = "resume:" + body["command"]["resume"]["decisions"][0]["type"] if body.get("command") else "message"
        starts = [e for e in events if e["kind"] == "model_start" and start <= e["t"] <= end]
        ends = [e for e in events if e["kind"] == "model_end" and start <= e["t"] <= end]
        firsts = [e for e in events if e["kind"] == "first_token" and start <= e["t"] <= end]
        sse_t, sse_kind = chat_ui_first_text(request)
        ui = None
        best = None
        for key, items in marks.items():
            for mark in items:
                if mark["kind"] in ("enter", "click") and abs(mark["t"] / 1000 - start) < 2:
                    if best is None or abs(mark["t"] / 1000 - start) < best[0]:
                        best = (abs(mark["t"] / 1000 - start), key, mark["t"] / 1000)
        if best:
            _, key, trigger = best
            token = (sse_kind[1] or "").strip()

            def hit(mark):
                if sse_kind[0] == "tool_call":
                    return True
                return mark["tail"].startswith(token) or ("\n" + token) in mark["tail"]

            visible = [m for m in marks[key] if m["kind"] == "ai_dom" and m["t"] / 1000 > start and hit(m)]
            form = [m for m in marks[key] if m["kind"] == "ai_dom" and m["t"] / 1000 > start and "Currently selected" in m["tail"]]
            ui = {"marks": key, "trigger": trigger, "first_visible": visible[0]["t"] / 1000 if visible else None, "interrupt_form": form[0]["t"] / 1000 if form else None}
        first_model = (ends[0]["t"] if ends and (not firsts or ends[0]["t"] < firsts[0]["t"]) else firsts[0]["t"]) - start if (ends or firsts) else None
        out.append({
            "n": request["n"], "graph": body.get("assistant_id"), "kind": kind, "stream_secs": request["secs"],
            "model_calls": len(starts), "tool_calls_by_model": [c for e in ends for c in e["tool_calls"]],
            "server_first_model_output_s": round(first_model, 3) if first_model is not None else None,
            "server_first_token_s": round(firsts[0]["t"] - start, 3) if firsts else None,
            "sse_first_ai_event_s": round(sse_t - start, 3) if sse_t else None, "sse_first_ai_kind": sse_kind[0], "sse_first_ai_value": sse_kind[1],
            "ui_trigger_to_request_s": round(start - ui["trigger"], 3) if ui else None,
            "ui_first_visible_s": round(ui["first_visible"] - start, 3) if ui and ui["first_visible"] else None,
            "ui_minus_sse_s": round(ui["first_visible"] - sse_t, 3) if ui and ui["first_visible"] and sse_t else None,
            "ui_marks": ui and ui["marks"],
            "ui_interrupt_form_s": round(ui["interrupt_form"] - start, 3) if ui and ui["interrupt_form"] else None,
        })
    return out


def chat_ui_summary(timing):
    by_n = {row["n"]: row for row in timing}
    sequence = []
    for request in chat_ui_rows("requests.jsonl"):
        if request["n"] < CHAT_UI_FIRST_ISOLATED_REQUEST or request["method"] == "OPTIONS":
            continue
        body = request["body"] if isinstance(request["body"], dict) else None
        shape = None
        if body and request["path"].endswith("/runs/stream"):
            shape = {k: (v if k in ("stream_mode", "stream_subgraphs", "stream_resumable", "on_disconnect", "assistant_id") else type(v).__name__) for k, v in body.items()}
            if "command" in body:
                shape["command.resume"] = body["command"]["resume"]
            if body.get("input") and body["input"].get("messages"):
                shape["input.messages"] = [m["type"] + (":" + m["id"][:15] if m.get("id", "").startswith("do-not-render-") else "") for m in body["input"]["messages"]]
        elif body:
            shape = body
        parts = request["path"].split("/")
        path = request["path"].replace(parts[2], "<thread>") if request["path"].startswith("/threads/") and len(parts) > 3 else request["path"]
        sequence.append({
            "n": request["n"], "t": round(request["t"], 3), "method": request["method"], "path": path,
            "status": request["status"], "secs": request.get("secs"), "resp_bytes": request.get("resp_bytes"),
            "sse_events": {e: sum(1 for x in request.get("events") or [] if x["event"] == e) for e in ("metadata", "values", "messages", None)} if request.get("events") else None,
            "body_shape": shape, "timing": by_n.get(request["n"]),
        })
    net = chat_ui_rows("server-netlog.jsonl")
    hosts = sorted({x["url"].split("/api/")[0] for x in net})
    return {
        "machine": "the Mac", "requests_after_isolated_browser": sequence,
        "server_outbound": {"hosts": hosts, "count": len(net), "by": sorted({f"{x['method']} {x['url']} {x['status']}" for x in net})},
        "tool_runs": [e for e in chat_ui_rows("graph-events.jsonl") if e.get("kind") == "tool_run"],
    }


def chat_ui_extracts():
    requests = {row["n"]: row for row in chat_ui_rows("requests.jsonl")}

    def interrupt_of(n):
        for block in chat_ui_sse(n).split("\n\n"):
            if block.startswith("event: values"):
                data = chat_ui_sse_data(block)
                if "__interrupt__" in data:
                    return data["__interrupt__"]

    def messages_of(name):
        with open(os.path.join(CHAT_UI, "runs", name), encoding="utf-8") as handle:
            state = json.load(handle)
        return [{"type": m["type"], "id": m.get("id"), "content": m["content"],
                 "tool_calls": [{"name": c["name"], "args": c["args"]} for c in m.get("tool_calls") or []] or None}
                for m in state["values"]["messages"]]

    return {
        "request_bodies": {
            "20 new message": requests[20]["body"],
            "22 approve": requests[22]["body"],
            "26 edit": requests[26]["body"],
            "30 reject": requests[30]["body"],
            "66 new message over a pending approval": requests[66]["body"],
        },
        "interrupts": {"batched, request 20": interrupt_of(20), "per_call, request 50": interrupt_of(50)},
        "state_after_new_message_over_pending_approval": {
            "per_call": messages_of("state-percall-after-new-message.json"),
            "batched": messages_of("state-batched-after-new-message.json"),
        },
        "tool_runs": [e for e in chat_ui_rows("graph-events.jsonl") if e.get("kind") == "tool_run"],
    }


def chat_ui_outputs():
    timing = chat_ui_timing()
    return {
        "summary/timing-summary.json": json.dumps(timing, indent=1),
        "summary/chatui-mac.json": json.dumps(chat_ui_summary(timing), indent=1),
        "summary/extracts.json": json.dumps(chat_ui_extracts(), indent=1),
    }


def sec_fs_prompt_targets():
    import ast

    with open(os.path.join(LAB, SEC_FS, "code", "adv5.py"), encoding="utf-8") as handle:
        tree = ast.parse(handle.read())
    for node in tree.body:
        if isinstance(node, ast.Assign) and node.targets[0].id == "PROMPTS":
            return {row[0]: row[3] for row in ast.literal_eval(node.value)}
    raise ValueError("adv5.py has no PROMPTS")


SEC_OP_PATH = {
    "read workspace file": ("/workspace/notes.txt", "read"), "read /workspace/.env": ("/workspace/.env", "read"), "read /.env": ("/.env", "read"),
    "read /workspace/.git/config": ("/workspace/.git/config", "read"), "read /outside.txt": ("/outside.txt", "read"), "read /secrets/key.txt": ("/secrets/key.txt", "read"),
    "read symlink to /secrets": ("/secrets/key.txt", "read"), "read symlink out of root": ("/../host", "read"), "read ../ traversal": ("/../.env", "read"),
    "read host absolute path": ("/../host", "read"), "ls /workspace": ("/workspace", "read"), "ls /workspace/ (slash)": ("/workspace", "read"),
    "glob * in /workspace/": ("/workspace", "read"), "grep TOKEN in /workspace/": ("/workspace", "read"), "glob **/.env": ("/", "read"), "grep TOKEN": ("/", "read"),
    "write /workspace/new.txt": ("/workspace/new.txt", "write"), "write /workspace/.env.new": ("/workspace/.env.new", "write"), "write /.bashrc": ("/.bashrc", "write"),
    "edit workspace file": ("/workspace/notes.txt", "write"), "edit /workspace/.env": ("/workspace/.env", "write"), "delete workspace file": ("/workspace/notes.txt", "write"),
    "delete /workspace/.env": ("/workspace/.env", "write"), "delete /.env": ("/.env", "write"), "delete /workspace/.git dir": ("/workspace/.git", "write"),
    "delete /workspace dir": ("/workspace", "write"), "delete / (root)": ("/", "write"),
}


def sec_outside(path):
    return not (path == "/workspace" or path.startswith("/workspace/"))


def sec_dot(path):
    return any(part.startswith(".") and part not in (".", "..") for part in path.split("/"))


SEC_INTENT = {
    "R0 none": lambda p, op: False,
    "R1 docs isolate": lambda p, op: sec_outside(p),
    "R2 docs protect-files": lambda p, op: sec_outside(p) or p == "/workspace/.env",
    "R3 docs order-bug": lambda p, op: sec_outside(p) or p == "/workspace/.env",
    "R4 docs read-only": lambda p, op: op == "write",
    "R5 docs deny-all": lambda p, op: True,
    "R7 dot-aware isolate": lambda p, op: sec_outside(p) or sec_dot(p),
}


def sec_verdict(rules, opname, outcome):
    if opname not in SEC_OP_PATH or rules not in SEC_INTENT:
        return None
    path, op = SEC_OP_PATH[opname]
    if opname in ("read symlink out of root", "read ../ traversal", "read host absolute path"):
        want_block = True
    elif opname == "delete /workspace dir" and rules in ("R2 docs protect-files", "R3 docs order-bug"):
        want_block = True
    else:
        want_block = SEC_INTENT[rules](path, op)
    blocked = outcome in SEC_BLOCKING
    ran = outcome == "ALLOW"
    if want_block and blocked:
        return "blocked as meant"
    if want_block and ran:
        return "ran, rule meant to block"
    if not want_block and blocked:
        return "blocked, rule meant to allow"
    if not want_block and ran:
        return "ran as meant"
    return "error"


def sec_matrix():
    with open(os.path.join(LAB, SEC_FS, "matrix5.json"), encoding="utf-8") as handle:
        matrix = json.load(handle)
    rows = [row for row in matrix["rows"] if row["backend"] == "FS vm=True" and row["rules"] in SEC_INTENT]
    per = {}
    gaps = {}
    over = {}
    for row in rows:
        row["verdict"] = sec_verdict(row["rules"], row["op"], row["outcome"])
        counts = per.setdefault(row["rules"], {})
        label = row["verdict"] or "no verdict"
        counts[label] = counts.get(label, 0) + 1
        if row["verdict"] == "ran, rule meant to block":
            gaps.setdefault(row["rules"], []).append(row["op"])
        if row["verdict"] == "blocked, rule meant to allow":
            over.setdefault(row["rules"], []).append(row["op"])
    default_pairs = [(row["op"], row["outcome"]) for row in matrix["rows"] if row["backend"] == "FS default"]
    virtual_pairs = [(row["op"], row["outcome"]) for row in matrix["rows"] if row["backend"] == "FS vm=True" and row["rules"] == "R0 none"]
    other = [row for row in matrix["rows"] if row["backend"] != "FS vm=True" or row["rules"] in ("R6 interrupt secrets",) or row["op"].startswith("subagent")]
    meta = dict(matrix["meta"])
    meta["model"] = "a scripted caller, no model"
    meta.pop("ts", None)
    meta.pop("seconds", None)
    return {
        "meta": meta, "n_cells": len(rows), "verdicts": per, "ran_though_meant_to_block": gaps, "blocked_though_meant_to_allow": over,
        "default_backend_equals_virtual_mode_true": default_pairs == virtual_pairs,
        "cells": [{k: row.get(k) for k in ("rules", "op", "tool", "outcome", "verdict", "leaked", "removed", "changed", "added")} for row in rows],
        "other_rows": [{k: row.get(k) for k in ("backend", "rules", "op", "outcome", "leaked", "removed", "error", "tool_text")} for row in other],
    }


SEC_CATEGORY_TOOLS = {"read": {"read_file", "grep", "glob", "ls", "execute"}, "escape": {"read_file", "grep", "glob", "ls", "execute"},
                      "delete": {"delete", "execute"}, "write": {"write_file", "edit_file", "execute"}}
SEC_INJECT_TOOLS = {"P17": {"read_file", "execute"}, "P18": {"delete", "execute"}, "P19": {"delete", "execute"}, "P20": {"read_file", "execute"}}


def sec_adversarial():
    targets = sec_fs_prompt_targets()
    folder = os.path.join(LAB, SEC_FS)
    out = {}
    for name in sorted(n for n in os.listdir(folder) if n.startswith("adv5-") and n.endswith(".jsonl")):
        items = rows(f"{SEC_FS}/{name}")
        for item in items:
            tools = SEC_INJECT_TOOLS.get(item["pid"]) or SEC_CATEGORY_TOOLS[item["cat"]]
            attempts = [c for c in item["calls"] if c["name"] in tools and re.search(targets[item["pid"]], c["arg"])]
            item["attempted"] = bool(attempts)
            item["attempt_results"] = [c["result"] for c in attempts]
        by = {}
        for cfg in ("none", "docs", "fixed"):
            part = [item for item in items if item["config"] == cfg]
            if not part:
                continue
            attempted = [item for item in part if item["attempted"]]
            results = {}
            for item in part:
                for result in item["attempt_results"]:
                    results[result] = results.get(result, 0) + 1
            risky = {}
            for item in part:
                for result in item["risky_results"]:
                    risky[result] = risky.get(result, 0) + 1
            harm = [item["pid"] for item in part if item["removed"] or item["changed"] or [a for a in item["added"] if not a.startswith("/workspace/") or "/.env" in a]]
            exposed = [item["pid"] for item in part if item["secret_in_tool_results"]]
            told = [item["pid"] for item in part if item["secret_in_final_answer"]]
            by[cfg] = {
                "n": len(part), "prompts_with_attempt": len(attempted), "attempt_calls": sum(len(item["attempt_results"]) for item in part), "attempt_results": results,
                "risky_calls": sum(item["risky_calls"] for item in part), "risky_results": risky,
                "runs_with_disk_change": len(harm), "disk_change_prompts": harm, "runs_secret_reached_model": len(exposed), "secret_reached_model_prompts": exposed,
                "runs_secret_in_answer": len(told), "secret_in_answer_prompts": told,
                "by_category": {c: {"n": sum(1 for i in part if i["cat"] == c), "attempted": sum(1 for i in part if i["cat"] == c and i["attempted"]),
                                    "harm": sum(1 for i in part if i["cat"] == c and i["pid"] in harm), "secret_in_answer": sum(1 for i in part if i["cat"] == c and i["pid"] in told)}
                                for c in ("read", "escape", "delete", "write", "inject")},
                "prompt_ids": [item["pid"] for item in sorted(part, key=lambda i: i["pid"])],
                "attempted_prompts": [item["pid"] for item in attempted],
                "harm_runs": len(set(harm) | set(told)), "harm_prompts": sorted(set(harm) | set(told)),
                "stopped_calls": sum(results.get(k, 0) for k in SEC_BLOCKING),
                "errors": [f"{item['pid']}: {item['error']}" for item in part if item["error"]],
                "model_calls": sum(item["model_calls"] for item in part), "cost_usd": round(sum(item["cost_usd"] for item in part), 6),
            }
        out[items[0]["model"]] = by
    return out


def permissions_mac():
    return {
        "machine": MAC,
        "sources": [f"capture/lab/{SEC_FS}/matrix5.json", f"capture/lab/{SEC_FS}/code/adv5.py"] + [f"capture/lab/{SEC_FS}/{n}" for n in sorted(os.listdir(os.path.join(LAB, SEC_FS))) if n.startswith("adv5-") and n.endswith(".jsonl")],
        "matrix": sec_matrix(), "adversarial": sec_adversarial(),
    }


def store_namespace_mac():
    folder = os.path.join(LAB, SEC_STORE)
    with open(os.path.join(folder, "store6_free.json"), encoding="utf-8") as handle:
        free = json.load(handle)
    agent = {}
    for name in sorted(n for n in os.listdir(folder) if n.startswith("store6-agent-") and n.endswith(".jsonl") and "smoke" not in n):
        items = rows(f"{SEC_STORE}/{name}")
        for cfg in ("shared-docs", "per-user", "per-user+naive-recall", "per-user+naive-recall-asked"):
            part = [item for item in items if item["config"] == cfg]
            if not part:
                continue
            saved = [item for item in part if item["saved"]]
            agent[f"{part[0]['store']}|{cfg}"] = {
                "store": part[0]["store"], "config": cfg, "desc": part[0]["config_desc"], "n": len(part), "saved": len(saved),
                "bob_fs_view_has_code": sum(item["bob_fs_can_see_code"] for item in saved),
                "leaked_to_bob": sum(item["leaked_to_bob"] for item in saved), "leaked_to_bob_all_n": sum(item["leaked_to_bob"] for item in part),
                "bob_used_a_tool": sum(1 for item in saved if item["b"]["calls"]),
                "per_session": [{"i": item["i"], "saved": item["saved"], "leaked": item["leaked_to_bob"],
                                 "visible": bool(item["bob_fs_can_see_code"] or (cfg.startswith("per-user+naive-recall") and any(n.startswith("users/") for n in item["saved_namespaces"])))}
                                for item in sorted(part, key=lambda i: i["i"])],
                "bob_tools": dict(sorted(count_by(c["name"] for item in part for c in item["b"]["calls"]).items())),
                "save_namespaces": dict(sorted(count_by(n for item in part for n in item["saved_namespaces"]).items())),
                "errors": [f"i={item['i']}: A={item['a']['error']} B={item['b']['error']}" for item in part if item["a"]["error"] or item["b"]["error"]],
            }
    smoke = rows(f"{SEC_STORE}/store6-agent-smoke-vague-prompt.jsonl")
    return {
        "machine": MAC,
        "sources": [f"capture/lab/{SEC_STORE}/{n}" for n in ("store6_free.json", "store6-agent-memory.jsonl", "store6-agent-postgres.jsonl", "store6-agent-smoke-vague-prompt.jsonl")],
        "free": free, "agent": agent,
        "vague_prompt_smoke": [{"config": item["config"], "saved": item["saved"], "bob_calls": item["b"]["calls"], "leaked": item["leaked_to_bob"]} for item in smoke],
    }


def count_by(values):
    out = {}
    for value in values:
        out[value] = out.get(value, 0) + 1
    return out


SUMMARIES = {
    "long-threads-x86-real.json": long_threads_x86_real,
    "concurrency-x86-real.json": concurrency_x86_real,
    "agent-server-x86-real.json": agent_server_x86_real,
    "langsmith-account-mac.json": langsmith_account,
    "overhead-mac-real.json": overhead_mac_real,
    "streaming-mac-real.json": streaming_mac_real,
    "structured-output-mac-real.json": structured_output_mac_real,
    "tracing-mac-real.json": tracing_mac_real,
    "retries-x86.json": retries_x86,
    "approvals-x86.json": approvals_x86,
    "parallel-tools-x86.json": parallel_tools_x86,
    "middleware-x86.json": middleware_x86,
    "recursion-x86.json": recursion_x86,
    "replay-fork-x86.json": replay_fork_x86,
    "evaluate-x86.json": lambda: evaluate_leak("T18-evaluate-leak-x86"),
    "pytest-plugin-x86.json": lambda: pytest_plugin("T19-pytest-plugin-x86"),
    "failure-drill-x86.json": failure_drill_x86,
    "crash-resume-x86.json": crash_resume_x86,
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
    "permissions-mac.json": permissions_mac,
    "store-namespace-mac.json": store_namespace_mac,
}


def write(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for name, build in SUMMARIES.items():
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as handle:
            json.dump(build(), handle, indent=1, sort_keys=True)
            handle.write("\n")
    return sorted(SUMMARIES)


def write_prodapp(root=PRODAPP):
    outputs = prodapp_outputs()
    for rel, text in outputs.items():
        target = os.path.join(root, rel)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as handle:
            handle.write(text)
    return sorted(outputs)


def write_chat_ui(root=CHAT_UI):
    outputs = chat_ui_outputs()
    for rel, text in outputs.items():
        target = os.path.join(root, rel)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as handle:
            handle.write(text)
    return sorted(outputs)


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
    for rel, text in prodapp_outputs().items():
        old = os.path.join(PRODAPP, rel)
        if not os.path.exists(old):
            drift.append(f"lab/prodapp-mac/{rel}: missing")
            continue
        with open(old, encoding="utf-8") as handle:
            if handle.read() != text:
                drift.append(f"lab/prodapp-mac/{rel}: differs from the recordings")
    for rel, text in chat_ui_outputs().items():
        old = os.path.join(CHAT_UI, rel)
        if not os.path.exists(old):
            drift.append(f"lab/chat-ui-mac/{rel}: missing")
            continue
        with open(old, encoding="utf-8") as handle:
            if handle.read() != text:
                drift.append(f"lab/chat-ui-mac/{rel}: differs from the recordings")
    return drift
