import argparse
import json
import re
import statistics
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
LAB = HERE / "lab"
SUMMARY = LAB / "summary"
GUEST_A = "x86 server guest, 24 vCPU, 47 GB, nested KVM, kind v0.33.0, Kubernetes 1.37.0, Agent Substrate v1.0.0 built from source, Envoy dataplane, gVisor"
GUEST_B = "x86 server guest, 16 vCPU, 23 GB, kind v0.33.0, Kubernetes 1.37.0, Agent Substrate v1.0.0 from the release images"
GUEST_K = "x86 server guest, 16 vCPU, 31 GB, kind v0.33.0, Kubernetes 1.37.0, kagent v1.0.0 with its Substrate distribution, mock model server"
GUEST_D = "x86 server guest, 16 vCPU, 31 GB, kind v0.33.0, Kubernetes 1.37.0, Agent Substrate v1.0.0 from the release images, Envoy dataplane, gVisor"
MAC = "Apple silicon laptop, Docker Desktop with 10 CPU and 8 GB, kind v0.33.0, Kubernetes 1.37.0, Agent Substrate v1.0.0 from the release images"
VALIDATION_MACHINE = GUEST_A + ", pool of 2 workers with 8 CPU and 8 GiB each"
TIMED_REQUESTS = ("first-call-golden", "warm-call", "resume-local", "resume-after-sync")


def lines(rel):
    return (LAB / rel).read_text(encoding="utf-8").splitlines()


def rows(rel):
    return [line.split("\t") for line in lines(rel) if line.strip()]


def rounded(values):
    return [round(value, 3) for value in values]


def stat(values):
    values = sorted(values)
    return {"median": round(statistics.median(values), 3), "min": round(values[0], 3), "max": round(values[-1], 3), "n": len(values)}


def timed(entry):
    return {"seconds": stat(entry["ok"]), "runs": rounded(entry["ok"]), "failed": entry["failed"]}


def kib_mib(kib):
    return {"kib": kib, "mib": round(kib / 1024, 1)}


def first_kib(rel):
    return int(lines(rel)[0].split()[0])


def stamp(text):
    text = text.rstrip("Z")
    head, _, frac = text.partition(".")
    frac = (frac + "000000")[:6]
    return datetime.strptime(head, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc).timestamp() + int(frac) / 1e6


def by_size(rel):
    groups = {}
    for row in rows(rel):
        if len(row) < 5 or not row[0].isdigit():
            continue
        entry = groups.setdefault(row[1], {}).setdefault(int(row[0]), {"ok": [], "failed": 0})
        if row[3] in ("200", "-"):
            entry["ok"].append(float(row[4]))
        else:
            entry["failed"] += 1
    return groups


def points(group):
    return [{"x": mb, **timed(entry)} for mb, entry in sorted(group.items()) if entry["ok"]]


def snapshot_sizes():
    return [{"x": mb, **kib_mib(first_kib(f"C-resume-vs-size/snapdir-b{mb}-1.txt"))} for mb in (0, 50, 200, 500, 1000)]


def resume_x86():
    local = by_size("C-resume-vs-size/10-local.tsv")
    store = by_size("C-resume-vs-size/32-object-store.tsv")
    default = []
    for row in watch_rows():
        if row[2] == "resume-after-detach" and row[3] == "200":
            default.append({"x": int(row[1][1:]), "seconds": stat([float(row[4])]), "failed": 0})
    return {
        "machine": GUEST_A,
        "actor": "ballast: a Go server in a scratch image that holds x MiB of random bytes, fidelity SNAPSHOT_FIDELITY_MEMORY",
        "unit": {"x": "MiB of memory the actor holds", "seconds": "client time through kubectl ate proxy"},
        "sources": ["capture/lab/C-resume-vs-size/10-local.tsv", "capture/lab/C-resume-vs-size/32-object-store.tsv", "capture/lab/D-durability/10-watch-part1.tsv", "capture/lab/D-durability/10-watch-part2.tsv"],
        "node_local": {"note": "async suspend, 1 s wait, one request", "points": points(local["resume-local"])},
        "object_store": {"note": "atelet with --snapshot-upload-delay=3s --snapshot-detach-delay=10s, request after the actor has no assigned node", "points": points(store["resume-object-store"])},
        "object_store_default_timers": {"note": "default atelet timers, request 42 minutes after the suspend, one sample per size", "points": sorted(default, key=lambda p: p["x"])},
        "new_actor_first_call": {"note": "create an actor, first request restores the golden snapshot", "points": points(local["first-call-golden"])},
        "warm_call": {"points": points(local["warm-call"])},
        "create_actor": {"note": "kubectl ate create actor, CLI time", "points": points(local["create-actor"])},
        "detach_wait": {"note": "seconds from async suspend until the actor had no assigned node, shortened timers", "points": points(store["wait-detach"])},
    }


def suspend_x86():
    local = by_size("C-resume-vs-size/10-local.tsv")
    return {
        "machine": GUEST_A,
        "unit": {"x": "MiB of memory the actor holds", "seconds": "kubectl ate suspend actor, CLI time"},
        "sources": ["capture/lab/C-resume-vs-size/10-local.tsv"],
        "async": {"note": "default mode, returns when the snapshot is on the node", "points": points(local["suspend-async"])},
        "sync": {"note": "--mode sync, returns when the snapshot is in the object store", "points": points(local["suspend-sync"])},
    }


def resume_mac():
    local = by_size("M-mac-arm64/80-local.tsv")
    return {
        "machine": MAC,
        "actor": "ballast, linux/arm64 build of the same server",
        "unit": {"x": "MiB of memory the actor holds", "seconds": "client time through kubectl ate proxy"},
        "sources": ["capture/lab/M-mac-arm64/80-local.tsv"],
        "node_local": {"points": points(local["resume-local"])},
        "new_actor_first_call": {"points": points(local["first-call-golden"])},
        "suspend_async": {"points": points(local["suspend-async"])},
        "warm_call": {"points": points(local["warm-call"])},
    }


def section(text_lines, title):
    out = []
    inside = False
    for line in text_lines:
        if line.startswith("== "):
            inside = line.startswith(title)
            continue
        if inside:
            out.append(line)
    return out


def du_value(text_lines, suffix):
    for line in text_lines:
        parts = line.split()
        if len(parts) == 2 and parts[0].isdigit() and parts[1] == suffix:
            return int(parts[0])
    return None


def footprint_x86():
    before = lines("C-resume-vs-size/20-storage-footprint.txt")
    after = lines("C-resume-vs-size/23-storage-after-delete.txt")
    node = section(before, "== node: /var/lib/ate")
    store = section(before, "== rustfs pod data")
    return {
        "machine": GUEST_A,
        "unit": "MiB as du reports it",
        "sources": ["capture/lab/C-resume-vs-size/20-storage-footprint.txt", "capture/lab/C-resume-vs-size/23-storage-after-delete.txt", "capture/lab/C-resume-vs-size/snapdir-b0-1.txt", "capture/lab/C-resume-vs-size/snapdir-b50-1.txt", "capture/lab/C-resume-vs-size/snapdir-b200-1.txt", "capture/lab/C-resume-vs-size/snapdir-b500-1.txt", "capture/lab/C-resume-vs-size/snapdir-b1000-1.txt"],
        "local_snapshot_per_actor": snapshot_sizes(),
        "with_25_suspended_actors": {
            "actors": 25,
            "node_snapshots_mib": du_value(node, "/var/lib/ate/snapshots"),
            "node_snapshot_cache_mib": du_value(node, "/var/lib/ate/snapshot-cache"),
            "object_store_mib": du_value(store, "/data"),
        },
        "after_delete": {
            "node_snapshots_mib": du_value(after, "/var/lib/ate/snapshots"),
            "node_snapshot_cache_mib": du_value(after, "/var/lib/ate/snapshot-cache"),
            "object_store_mib": du_value(after, "/data"),
        },
    }


def watch_rows():
    out = []
    for rel in ("D-durability/10-watch-part1.tsv", "D-durability/10-watch-part2.tsv"):
        for row in rows(rel):
            if row[0] != "ts" and len(row) >= 3:
                out.append(row)
    return out


def timers_x86():
    actors = {}
    node = []
    for row in watch_rows():
        if row[1] == "node" and row[2] == "local-snapshots-MiB":
            node.append({"t": row[0], "mib": int(row[3])})
            continue
        entry = actors.setdefault(row[1], {})
        if row[2] == "suspended-async":
            entry["suspended"] = stamp(row[0])
            entry["suspended_at"] = row[0]
            entry["ran"] = len(row) > 4 and row[4] != "-"
        if row[2] == "state" and "suspended" in entry and len(row) >= 6:
            if "uploaded" not in entry and "SNAPSHOT_OWNER_ACTOR:SNAPSHOT_STORAGE_STATE_COMPLETED" in row[5]:
                entry["uploaded"] = stamp(row[0])
                entry["uploaded_at"] = row[0]
            if "detached" not in entry and row[4] == "-" and "uploaded" in entry:
                entry["detached"] = stamp(row[0])
                entry["detached_at"] = row[0]
    out = []
    for name, entry in sorted(actors.items(), key=lambda kv: int(kv[0][1:])):
        if not entry.get("ran") or "uploaded" not in entry:
            continue
        out.append({
            "actor": name,
            "mib": int(name[1:]),
            "suspended_at": entry["suspended_at"],
            "uploaded_at": entry["uploaded_at"],
            "detached_at": entry.get("detached_at"),
            "seconds_to_upload": round(entry["uploaded"] - entry["suspended"], 1),
            "seconds_to_detach": round(entry["detached"] - entry["suspended"], 1) if "detached" in entry else None,
        })
    return {
        "machine": GUEST_A,
        "note": "default atelet timers, state sampled every 10 s, so each time is at most 10 s late",
        "sources": ["capture/lab/D-durability/10-watch-part1.tsv", "capture/lab/D-durability/10-watch-part2.tsv", "capture/lab/D-durability/00-atelet-args.txt"],
        "actors": out,
        "node_local_snapshots": node,
    }


def trace(rel, with_case):
    out = []
    for row in rows(rel):
        if row[0] in ("ts", "DONE") or len(row) < 3:
            continue
        item = {"t": row[0]}
        rest = row[1:]
        if with_case:
            item["case"] = rest[0]
            rest = rest[1:]
        item["event"] = rest[0]
        item["fields"] = [field[:200] for field in rest[1:]]
        out.append(item)
    return out


def failures_x86():
    lifecycle = rows("B-lifecycle/10-trace.tsv")
    idle = [row for row in lifecycle if len(row) > 2 and row[1] == "state"]
    start = next(i for i, row in enumerate(lifecycle) if len(row) > 1 and row[1] == "idle-watch-start")
    end = next(i for i, row in enumerate(lifecycle) if len(row) > 1 and row[1] == "idle-watch-end")
    watch = [row for row in lifecycle[start:end] if len(row) > 2 and row[1] == "state"]
    counts = {}
    for row in watch:
        counts[row[2]] = counts.get(row[2], 0) + 1
    return {
        "machine": GUEST_A,
        "sources": ["capture/lab/B-lifecycle/10-trace.tsv", "capture/lab/B-lifecycle/20-trace-ops.tsv", "capture/lab/D-durability/30-local-loss.tsv", "capture/lab/D-durability/40-node-reboot.tsv", "capture/lab/J-container-death/10-trace.tsv"],
        "idle_watch": {"seconds": 900, "samples_after_last_request": len(watch), "states": counts, "all_samples": len(idle)},
        "lifecycle_ops": trace("B-lifecycle/20-trace-ops.tsv", False),
        "local_snapshot_loss": trace("D-durability/30-local-loss.tsv", True),
        "node_restart": trace("D-durability/40-node-reboot.tsv", False),
        "death_inside_sandbox": trace("J-container-death/10-trace.tsv", True),
    }


def parking_x86():
    text = (LAB / "I-capacity/16-load-30s.log").read_text(encoding="utf-8")
    def grab(pattern):
        return re.search(pattern, text).group(1)
    full = []
    for row in rows("I-capacity/01-unplanned-full-pool-503.tsv"):
        if len(row) >= 6 and row[3] == "503":
            full.append({"phase": row[1], "seconds": float(row[4]), "body": row[5][:160]})
    return {
        "machine": GUEST_A,
        "sources": ["capture/lab/I-capacity/16-load-30s.log", "capture/lab/I-capacity/13-parking-trace.tsv", "capture/lab/I-capacity/01-unplanned-full-pool-503.tsv", "capture/lab/I-capacity/17-router-args.txt"],
        "load_run": {
            "seconds": 30,
            "actors": 4,
            "workers": 2,
            "requests": int(grab(r"total requests\s*:\s*(\d+)")),
            "ok": int(grab(r"200 OK\s*:\s*(\d+)")),
            "shed_503": int(grab(r"503 unavailable\s*:\s*(\d+)")),
            "other": int(grab(r"other\s*:\s*(\d+)")),
            "ok_average_seconds": float(grab(r"avg ([0-9.]+)s")),
            "ok_slowest_seconds": round(float(grab(r"slowest ([0-9.]+)s")), 3),
        },
        "parking_trace": trace("I-capacity/13-parking-trace.tsv", False),
        "full_pool_503": {"seconds": stat([item["seconds"] for item in full]), "body": full[0]["body"] if full else None},
    }


def dependency_x86():
    marks = {}
    for row in rows("E-dependency-loss/10-timeline.tsv"):
        if len(row) >= 3 and row[0].isdigit():
            marks[row[2].split(" ")[0]] = int(row[0])
    outages = [
        ("postgres", "T1-postgres-scale-0", "T1-postgres-scale-1", "T1-postgres-ready"),
        ("ate-api-server", "T2-ateapi-scale-0", "T2-ateapi-scale-2", "T2-ateapi-ready"),
        ("kube-apiserver", "T3-kube-apiserver-manifest-moved-out", "T3-kube-apiserver-manifest-moved-back", "T3-kube-apiserver-livez-200"),
    ]
    probes = []
    for rel in ("E-dependency-loss/12-probe-incluster.tsv", "E-dependency-loss/12-probe-proxy.tsv"):
        for row in rows(rel):
            if len(row) >= 5 and row[0].isdigit():
                probes.append((int(row[0]), row[1], row[3], float(row[4])))
    out = {}
    for name, down, restore, ready in outages:
        start = marks[down]
        restore_t = marks[restore] - start
        streams = {}
        for epoch, stream, code, seconds in probes:
            if start - 10 <= epoch <= marks[ready] + 40:
                streams.setdefault(stream, []).append({"t": epoch - start, "code": code, "seconds": round(seconds, 3), "ok": code == "200"})
        summary = {}
        for stream, items in streams.items():
            during = [item for item in items if 0 <= item["t"] <= restore_t]
            failed = [item for item in items if not item["ok"]]
            summary[stream] = {
                "requests_during_outage": len(during),
                "ok_during_outage": sum(1 for item in during if item["ok"]),
                "first_failure_t": min((item["t"] for item in failed), default=None),
                "last_failure_t": max((item["t"] for item in failed), default=None),
                "codes": {code: sum(1 for item in items if item["code"] == code) for code in sorted({item["code"] for item in items})},
            }
        out[name] = {
            "outage_seconds": restore_t,
            "restore_action_t": restore_t,
            "dependency_ready_t": marks[ready] - start,
            "summary": summary,
            "per_second": streams,
        }
    return {
        "machine": GUEST_B,
        "note": "one request per second to a RUNNING actor from a pod (stream running) and through kubectl ate proxy (stream proxy), one fresh SUSPENDED actor every 5 s (stream suspended). t is seconds from the moment the dependency was taken away. Code 000 is a client timeout at 9 s.",
        "sources": ["capture/lab/E-dependency-loss/10-timeline.tsv", "capture/lab/E-dependency-loss/12-probe-incluster.tsv", "capture/lab/E-dependency-loss/12-probe-proxy.tsv", "capture/lab/E-dependency-loss/20-analysis.txt"],
        "outages": out,
    }


def kagent_x86():
    client = {}
    for rel in ("K-kagent/latency/timings.tsv", "K-kagent/parallel/timings.tsv"):
        for row in rows(rel):
            if len(row) < 4:
                continue
            label = row[1] if row[1] == "session-create" else re.sub(r"-\d+$", "", row[1])
            key = label if rel.endswith("latency/timings.tsv") else "parallel-" + label
            try:
                client.setdefault(key, []).append(float(row[3]))
            except ValueError:
                continue
    server = {}
    for row in rows("K-kagent/latency/server-times.tsv"):
        if len(row) >= 3 and row[1] and row[2]:
            server.setdefault(re.sub(r"-\d+\.json$", "", row[0]), []).append(stamp(row[2]) - stamp(row[1]))
    changes = {}
    for row in rows("K-kagent/logs/actor-state-changes.tsv"):
        if len(row) >= 4:
            changes.setdefault(row[1], []).append((stamp(row[0]), row[2], row[3]))
    resume = []
    suspend = []
    for items in changes.values():
        items.sort()
        last = {}
        for when, op, state in items:
            if state in ("resuming", "suspending"):
                last[op] = when
            elif state == "running" and "resume" in last:
                resume.append(when - last.pop("resume"))
            elif state == "suspended" and op == "suspend" and "suspend" in last:
                suspend.append(when - last.pop("suspend"))
    turns = [value for value in resume if value < 5]
    workers = []
    for line in lines("K-kagent/parallel/workers-during.txt"):
        match = re.match(r"(\S+) N=(\d+) actors=(\d+)/\d+ cpu=(\d+)/(\d+)", line)
        if match:
            workers.append({"t": match.group(1), "turns_started": int(match.group(2)), "actors": int(match.group(3)), "cpu_millicores": int(match.group(4)), "cpu_capacity_millicores": int(match.group(5))})
    return {
        "machine": GUEST_K,
        "note": "the model is a mock server in the cluster, so model time is near zero. Every turn resumes the session actor and suspends it again.",
        "sources": ["capture/lab/K-kagent/latency/timings.tsv", "capture/lab/K-kagent/latency/server-times.tsv", "capture/lab/K-kagent/parallel/timings.tsv", "capture/lab/K-kagent/logs/actor-state-changes.tsv"],
        "client_seconds": {key: stat(values) for key, values in sorted(client.items())},
        "server_turn_seconds": {key: stat(values) for key, values in sorted(server.items())},
        "resume_seconds": {"all": stat(resume), "turns_only": stat(turns), "note": "resuming to running in the ate-api log. The values of 5 s or more are golden snapshot builds, left out of turns_only."},
        "suspend_seconds": stat(suspend),
        "runs": {
            "client_seconds": {key: rounded(values) for key, values in sorted(client.items())},
            "server_turn_seconds": {key: rounded(values) for key, values in sorted(server.items())},
            "resume_seconds_turns_only": rounded(turns),
            "suspend_seconds": rounded(suspend),
        },
        "parallel_workers": workers,
    }


def steps(rel):
    out = []
    for row in rows(rel):
        if len(row) >= 3 and row[1].lstrip("-").isdigit():
            out.append({"step": row[0], "exit": int(row[1]), "seconds": float(row[2])})
    return out


def microvm_x86():
    base = "L-gaps/microvm"
    local = by_size(f"{base}/40-microvm-local.tsv")
    snapdir_sizes = (0, 200, 500)
    process_sizes = (0, 200)
    snapshots = [{"x": mb, **kib_mib(first_kib(f"{base}/44-snapdir-v{mb}-1.txt"))} for mb in snapdir_sizes]
    resident = []
    for mb in process_sizes:
        for line in lines(f"{base}/41-node-processes-v{mb}-1.txt"):
            parts = line.split()
            if len(parts) > 3 and parts[3].endswith("/cloud-hypervisor"):
                resident.append({"x": mb, "process": "cloud-hypervisor", **kib_mib(int(parts[1]))})
    gvisor = []
    for line in lines(f"{base}/50-gvisor-rss.txt"):
        parts = line.split()
        if len(parts) > 3 and parts[3] in ("runsc-sandbox", "runsc-gofer"):
            gvisor.append({"process": parts[3], **kib_mib(int(parts[1]))})
    files = [f"capture/lab/{base}/40-microvm-local.tsv", f"capture/lab/{base}/50-gvisor-rss.txt"]
    files += [f"capture/lab/{base}/44-snapdir-v{mb}-1.txt" for mb in snapdir_sizes]
    files += [f"capture/lab/{base}/41-node-processes-v{mb}-1.txt" for mb in process_sizes]
    return {
        "machine": GUEST_A.replace(", gVisor", ", microVM class"),
        "actor": "ballast: a Go server in a scratch image that holds x MiB of random bytes, fidelity SNAPSHOT_FIDELITY_MEMORY, sandbox class microvm",
        "unit": {"x": "MiB of memory the actor holds", "seconds": "client time through kubectl ate proxy, CLI time for create and suspend"},
        "sources": files,
        "node_local": {"note": "async suspend, 1 s wait, one request", "points": points(local["resume-local"])},
        "new_actor_first_call": {"note": "create an actor, first request restores the golden snapshot", "points": points(local["first-call-golden"])},
        "suspend_async": {"points": points(local["suspend-async"])},
        "suspend_sync": {"points": points(local["suspend-sync"])},
        "warm_call": {"points": points(local["warm-call"])},
        "create_actor": {"points": points(local["create-actor"])},
        "local_snapshot_per_actor": snapshots,
        "resident_memory": {"note": "resident set size from ps on the node, one sample per process", "microvm": resident, "gvisor_same_node": sorted(gvisor, key=lambda item: (item["process"], -item["kib"]))},
    }


def install_steps():
    return {
        "note": "wall time of each install step. A step with exit 1 failed and was run again.",
        "sources": ["capture/lab/A-quickstart/02-steps.tsv", "capture/lab/G-dataplane/00-install/steps.tsv", "capture/lab/M-mac-arm64/02-steps.tsv", "capture/lab/K-kagent/install/steps.tsv"],
        "source_build": {"machine": GUEST_A, "steps": steps("A-quickstart/02-steps.tsv")},
        "release_images": {"machine": GUEST_B, "steps": steps("G-dataplane/00-install/steps.tsv")},
        "release_images_mac": {"machine": MAC, "steps": steps("M-mac-arm64/02-steps.tsv")},
        "kagent": {"machine": GUEST_K, "steps": steps("K-kagent/install/steps.tsv")},
    }


def drill_cases():
    cases = []
    for line in lines("N-demos/failure-drill/drill-run.log"):
        head = re.match(r"== (\d) (.+)", line)
        if head:
            cases.append({"n": int(head.group(1)), "title": head.group(2), "symptoms": [], "recoveries": []})
            continue
        field = re.match(r"\s+(\w+)\s+(.*)", line)
        if not field or not cases:
            continue
        case, key, text = cases[-1], field.group(1), field.group(2)
        timed = re.search(r"(\d{3}) in ([\d.]+) s", text)
        after = re.search(r"after ([\d.]+) s", text)
        took = re.search(r"\(([\d.]+) s\)", text)
        if key == "symptom" and timed:
            case["symptoms"].append({"http": int(timed.group(1)), "seconds": round(float(timed.group(2)), 3)})
        elif key == "detect" and after:
            case["detect_seconds"] = float(after.group(1))
        elif key == "fix":
            case["fix"] = re.sub(r"\s*\(.*\)$", "", text)
            case["fix_seconds"] = float(took.group(1)) if took else float(after.group(1))
        elif key == "recover" and timed:
            case["recoveries"].append({"http": int(timed.group(1)), "seconds": round(float(timed.group(2)), 3)})
        elif key == "recover" and after:
            case["recoveries"].append({"http": 200, "seconds": float(after.group(1))})
        elif key == "state" and "state" not in case:
            case["state"] = text
    return cases


def agent_session(kind):
    turns = []
    for row in rows(f"N-demos/stateful-agent/session-{kind}.tsv")[1:]:
        reply = json.loads(row[3])
        step = row[0]
        if step.startswith("note"):
            phase = "note"
        elif "new actor" in step:
            phase = "new"
        elif "after suspend" in step:
            phase = "resumed"
        else:
            phase = "warm"
        turns.append({
            "step": step,
            "phase": phase,
            "http": int(row[1]),
            "seconds": round(float(row[2]), 3),
            "memory_turns": reply["memory_turns"],
            "db_turns": reply["db_turns"],
            "rehydrated_from_db": reply["rehydrated_from_db"],
            "note": reply["note"],
            "scratch_file": reply["scratch_file"],
            "process_age_s": reply["process_age_s"],
        })
    marks = []
    for line in lines(f"N-demos/stateful-agent/lifecycle-{kind}.log"):
        if line.startswith("{"):
            event = json.loads(line)
            marks.append((event["message"], stamp(event["time"][:26])))
    restores = [round(end - start, 3) for (a, start), (b, end) in zip(marks, marks[1:]) if a == "Actor restoring" and b == "Actor restored"]
    return {
        "turns": turns,
        "resumed_seconds": stat([t["seconds"] for t in turns if t["phase"] == "resumed"]),
        "warm_seconds": stat([t["seconds"] for t in turns if t["phase"] == "warm"]),
        "restore_seconds": stat(restores),
    }


def sandbox_tasks():
    tasks = {}
    for row in rows("N-demos/tool-sandbox/tasks.tsv")[1:]:
        task = tasks.setdefault(row[0], {"label": row[0]})
        if row[1] == "task":
            task.update({"state": row[2], "http": int(row[3]), "seconds": float(row[4]), "result": row[5][:200]})
        elif row[1] == "revert":
            task["revert_seconds"] = float(row[4])
        else:
            task.update({"clean_check_seconds": float(row[4]), "files_after_revert": int(json.loads(row[5])["stdout"])})
    return list(tasks.values())


def idle_run():
    base = "N-demos/idle-suspender"
    events = rows(f"{base}/suspender.tsv")
    zero = min(stamp(row[0]) for row in events if row[1] == "request")
    requests = [{"t": round(stamp(row[0]) - zero, 1), "actor": row[2], "http": int(row[3]), "seconds": float(row[4]), "kind": row[5]} for row in events if row[1] == "request"]
    suspends = [{"t": round(stamp(row[0]) - zero, 1), "actor": row[2], "idle_seconds": int(row[3][5:-1]), "seconds": float(row[4]), "result": row[5]} for row in events if row[1] == "suspend"]
    capacity = []
    for row in rows(f"{base}/capacity-requests-with-suspender.tsv")[1:]:
        if len(row) < 6:
            continue
        capacity.append({"t": round(stamp(row[0]) - zero, 1), "actors": int(row[1].split("/")[0]), "millicores": int(row[2].split("/")[0]), "bursty": row[3], "busy": row[4], "rare": row[5]})
    control_file = f"{base}/requests-without-suspender.tsv"
    control = [{"actor": row[1], "http": int(row[2]), "seconds": round(float(row[3]), 3)} for row in rows(control_file)[1:]] if (LAB / control_file).exists() else []
    client = [(row[1], int(row[2]), float(row[3])) for row in rows(f"{base}/requests-with-suspender.tsv")[1:]]
    return {
        "idle_seconds": 30,
        "slots": 2,
        "requests": requests,
        "suspends": suspends,
        "capacity": capacity,
        "with_suspender": {
            "requests": len(client),
            "ok": sum(1 for _, code, _ in client if code == 200),
            "resumed_seconds": stat([r["seconds"] for r in requests if r["kind"] == "resumed"]),
            "warm_seconds": stat([r["seconds"] for r in requests if r["kind"] == "warm"]),
            "suspend_cli_seconds": stat([s["seconds"] for s in suspends]),
            "mean_millicores": round(statistics.mean(c["millicores"] for c in capacity)),
        },
        "without_suspender": {
            "requests": len(control),
            "ok": sum(1 for r in control if r["http"] == 200),
            "failed": [r for r in control if r["http"] != 200],
        },
    }


def demos_x86():
    return {
        "machine": GUEST_D,
        "note": "four demos from capture/demos, recorded once each. The model in the agent demo is a mock server in the cluster.",
        "sources": [
            "capture/lab/N-demos/failure-drill/drill-run.log",
            "capture/lab/N-demos/stateful-agent/session-memory.tsv",
            "capture/lab/N-demos/stateful-agent/session-volumes.tsv",
            "capture/lab/N-demos/stateful-agent/lifecycle-memory.log",
            "capture/lab/N-demos/stateful-agent/lifecycle-volumes.log",
            "capture/lab/N-demos/tool-sandbox/tasks.tsv",
            "capture/lab/N-demos/idle-suspender/suspender.tsv",
            "capture/lab/N-demos/idle-suspender/requests-with-suspender.tsv",
            "capture/lab/N-demos/idle-suspender/requests-without-suspender.tsv",
            "capture/lab/N-demos/idle-suspender/capacity-requests-with-suspender.tsv",
        ],
        "install": steps("N-demos/install/steps.tsv"),
        "failure_drill": drill_cases(),
        "stateful_agent": {"memory": agent_session("memory"), "volumes": agent_session("volumes")},
        "tool_sandbox": sandbox_tasks(),
        "idle_suspender": idle_run(),
    }


def validation_rows(rel):
    groups = {}
    for row in rows(rel):
        if len(row) < 5 or row[0] == "template":
            continue
        entry = groups.setdefault(row[0], {}).setdefault(row[1], {"ok": [], "failed": 0, "details": []})
        if row[3] in ("200", "-"):
            entry["ok"].append(float(row[4]))
            entry["details"].append(row[5] if len(row) > 5 else "")
        else:
            entry["failed"] += 1
    return groups


def sized(entry):
    return kib_mib(int(entry["ok"][0]))


def detail_field(detail, key):
    match = re.search(rf"{key}=(-?[\d.]+)", detail)
    return float(match.group(1)) if match else None


def request_count(group):
    return sum(len(group[key]["ok"]) + group[key]["failed"] for key in TIMED_REQUESTS)


def validation_timings(group):
    return {
        "node_snapshot": sized(group["local-snapshot-kib"]),
        "object_store_copy": sized(group["store-snapshot-kib"]),
        "resume_node": timed(group["resume-local"]),
        "resume_after_sync": timed(group["resume-after-sync"]),
        "suspend_async": timed(group["suspend-async"]),
        "suspend_sync": timed(group["suspend-sync"]),
        "new_actor_first_call": timed(group["first-call-golden"]),
        "warm_call": timed(group["warm-call"]),
    }


def validation_memory_x86():
    rel = "V-validation/01-compressible/10-compressible.tsv"
    groups = validation_rows(rel)
    fills = {"zero": "all zero bytes", "mixed": "half zero bytes, half random bytes", "rand": "all random bytes"}
    actors = []
    for name, group in groups.items():
        fill, mib = name.split("-")
        actors.append({
            "template": name,
            "fill": fill,
            "fill_note": fills[fill],
            "x": int(mib),
            **validation_timings(group),
        })
    py_rel = "V-validation/02-python-runtime/10-python.tsv"
    py = validation_rows(py_rel)["pyagent"]
    ages = [detail_field(d, "process_age_s") for d in py["first-call-golden"]["details"][:1] + py["resume-local"]["details"] + py["resume-after-sync"]["details"]]
    rss = {int(detail_field(d, "maxrss_mib")) for d in py["resume-local"]["details"]}
    image_bytes = int((LAB / "V-validation/02-python-runtime/02-image.txt").read_text(encoding="utf-8").split()[1])
    return {
        "machine": VALIDATION_MACHINE,
        "actor": "ballast v3: a Go server in a scratch image that holds x MiB of zero bytes, random bytes, or half of each, fidelity SNAPSHOT_FIDELITY_MEMORY",
        "unit": {"x": "MiB of memory the actor holds", "seconds": "client time through kubectl ate proxy, CLI time for suspend", "kib": "du on the node snapshot folder and on the object store data folder"},
        "sources": [f"capture/lab/{rel}", f"capture/lab/{py_rel}", "capture/lab/V-validation/02-python-runtime/02-image.txt"],
        "actors": sorted(actors, key=lambda a: (a["x"], ["zero", "mixed", "rand"].index(a["fill"]))),
        "python": {
            "actor": "python:3.13-slim with an HTTP server that builds a dict of 1,000,000 random 100-byte values, limit 768 MiB, fidelity SNAPSHOT_FIDELITY_MEMORY",
            "image_bytes": image_bytes,
            "peak_rss_mib": sorted(rss),
            "requests": request_count(py),
            "process_age_first_request_s": ages[0],
            "process_age_last_resume_s": ages[-1],
            "template_to_golden_ready": timed(py["template-to-golden-ready"]),
            **validation_timings(py),
        },
    }


def percentile(values, q):
    values = sorted(values)
    return round(values[int(q * (len(values) - 1))], 3)


def parallel_levels(rel):
    levels = {}
    for row in rows(rel):
        if len(row) < 5 or row[0] in ("n", "DONE"):
            continue
        level = levels.setdefault(row[0], {"ok": [], "refused": [], "bodies": set()})
        if row[3] == "200":
            level["ok"].append(float(row[4]))
        else:
            level["refused"].append(float(row[4]))
            level["bodies"].add(row[5][:160] if len(row) > 5 else "")
    out = []
    for name, level in levels.items():
        item = {
            "level": name,
            "requests": len(level["ok"]) + len(level["refused"]),
            "ok": len(level["ok"]),
            "refused_503": len(level["refused"]),
            "runs": rounded(level["ok"]),
        }
        if level["ok"]:
            item["seconds"] = stat(level["ok"])
            item["p90"] = percentile(level["ok"], 0.9)
        if level["refused"]:
            item["refused_seconds"] = stat(level["refused"])
            item["refused_runs"] = rounded(level["refused"])
            item["refused_body"] = sorted(level["bodies"])[0]
        out.append(item)
    return out


def worker_slots(rel):
    used = 0
    capacity = 0
    for line in lines(rel):
        match = re.search(r"\s(\d+)/(\d+)\s+\S+Mi", line)
        if match:
            used += int(match.group(1))
            capacity += int(match.group(2))
    return {"cpu_millicores_used": used, "cpu_millicores_capacity": capacity}


def validation_parallel_x86():
    base = "V-validation/03-parallel-resume"
    levels = parallel_levels(f"{base}/20-parallel.tsv")
    for item in levels:
        item["x"] = int(item.pop("level"))
    return {
        "machine": VALIDATION_MACHINE,
        "actor": "ballast v3 with 50 MiB of random bytes, one CPU each, suspended before each round",
        "note": "x suspended actors each get one request at the same instant, 5 rounds for each x, one kubectl ate proxy for each actor. The pool has room for 16 one-CPU actors.",
        "unit": {"x": "requests at the same instant, one for each suspended actor", "seconds": "client time through kubectl ate proxy"},
        "sources": [f"capture/lab/{base}/20-parallel.tsv", f"capture/lab/{base}/10-parallel-first-run-n16-n32.tsv", f"capture/lab/{base}/11-workers-before-32.txt", f"capture/lab/{base}/21-workers-before.txt", f"capture/lab/{base}/12-ateapi-error-lines-during-bursts.txt"],
        "points": sorted(levels, key=lambda item: item["x"]),
        "first_run": {
            "note": "an earlier run with two dead RUNNING actors on the pool, so 14 of 16 slots were free. Level 32-with-release suspends 16 of the actors 1.5 s into the wait.",
            "workers_before": worker_slots(f"{base}/11-workers-before-32.txt"),
            "levels": parallel_levels(f"{base}/10-parallel-first-run-n16-n32.tsv"),
        },
        "workers_before": worker_slots(f"{base}/21-workers-before.txt"),
        "ate_api_error_lines_during_bursts": int((LAB / f"{base}/12-ateapi-error-lines-during-bursts.txt").read_text(encoding="utf-8").strip()),
    }


def validation_fidelity_x86():
    rel = "V-validation/04-fidelity/10-fidelity.tsv"
    groups = validation_rows(rel)
    levels = []
    for name in ("fid-volumes", "fid-rootfs", "fid-memory"):
        group = groups[name]
        resumed = group["resume-local"]["details"] + group["resume-after-sync"]["details"]
        last = resumed[-1]
        levels.append({
            "template": name,
            "fidelity": "SNAPSHOT_FIDELITY_" + name.split("-")[1].upper(),
            "requests": request_count(group),
            "after_last_resume": {
                "memory_count": int(detail_field(last, "count")),
                "rootfs_count": int(detail_field(last, "rootfs")),
                "volume_count": int(detail_field(last, "data")),
                "process_age_s": detail_field(last, "process_age_s"),
            },
            "process_age_after_resume_s": {"min": min(detail_field(d, "process_age_s") for d in resumed), "max": max(detail_field(d, "process_age_s") for d in resumed)},
            **validation_timings(group),
        })
    return {
        "machine": VALIDATION_MACHINE,
        "actor": "ballast v3 with 50 MiB of random bytes, a counter in memory, a counter file on the root filesystem, a counter file on a durableDir volume, and a child process",
        "unit": {"seconds": "client time through kubectl ate proxy, CLI time for suspend", "kib": "du on the node snapshot folder and on the object store data folder"},
        "sources": [f"capture/lab/{rel}"],
        "levels": levels,
    }


BUILDERS = {
    "resume-x86.json": resume_x86,
    "suspend-x86.json": suspend_x86,
    "resume-mac.json": resume_mac,
    "footprint-x86.json": footprint_x86,
    "timers-x86.json": timers_x86,
    "failures-x86.json": failures_x86,
    "parking-x86.json": parking_x86,
    "dependency-loss-x86.json": dependency_x86,
    "kagent-turns-x86.json": kagent_x86,
    "install-steps.json": install_steps,
    "microvm-x86.json": microvm_x86,
    "demos-x86.json": demos_x86,
    "validation-memory-x86.json": validation_memory_x86,
    "validation-parallel-x86.json": validation_parallel_x86,
    "validation-fidelity-x86.json": validation_fidelity_x86,
}


def build(target):
    target.mkdir(parents=True, exist_ok=True)
    for name, builder in BUILDERS.items():
        (target / name).write_text(json.dumps(builder(), indent=2, sort_keys=True) + "\n", encoding="utf-8")


def check():
    print("skipped: the recordings in capture/lab need a Kubernetes cluster with Agent Substrate installed and were made on our lab machines. Only the summaries are rebuilt here.")
    drift = []
    with tempfile.TemporaryDirectory() as tmp:
        fresh = Path(tmp)
        build(fresh)
        for name in BUILDERS:
            committed = SUMMARY / name
            if not committed.exists() or committed.read_text(encoding="utf-8") != (fresh / name).read_text(encoding="utf-8"):
                drift.append(name)
        extra = sorted(p.name for p in SUMMARY.glob("*.json") if p.name not in BUILDERS)
    if drift or extra:
        for name in drift:
            print(f"drift: capture/lab/summary/{name} differs from a rebuild")
        for name in extra:
            print(f"drift: capture/lab/summary/{name} has no builder")
        return 1
    print(f"ok: {len(BUILDERS)} summaries match a rebuild from capture/lab")
    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        return check()
    build(SUMMARY)
    print(f"wrote {len(BUILDERS)} summaries to capture/lab/summary")
    return 0


if __name__ == "__main__":
    sys.exit(main())
