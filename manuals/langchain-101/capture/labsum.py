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
        "sources": ["capture/lab/T15-agent-server-x86/02-recursion.jsonl", "capture/lab/T15-agent-server-x86/03-workers.jsonl", "capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt"],
        "recursion": [{"config": row["config"], "steps_in_state": row["n_in_state"], "status": row["run_status"]} for row in recursion_rows],
        "workers": [{"server": row["server"], "background_runs": row["background_runs"], "seconds_per_run": row["seconds_per_run"], "max_inflight": row["max_inflight"], "wall_s": r(row["wall_s"], 1)} for row in worker_rows],
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


SUMMARIES = {
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
