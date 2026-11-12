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
GUEST_R = "x86 server guest, 16 vCPU, 31 GB, kind v0.33.0, Kubernetes 1.37.0, Agent Substrate v1.0.0 from the release images, Envoy dataplane, gVisor, Agent Executor built from source at one commit"
GUEST_S = "x86 server guest, 16 vCPU, 31 GB, kind v0.33.0, Kubernetes 1.37.0, kagent v1.0.0 with its Substrate distribution, Ollama 0.40.16 in a container on the guest with 12 CPUs, one request at a time, no GPU"
MAC = "Apple silicon laptop, Docker Desktop with 10 CPU and 8 GB, kind v0.33.0, Kubernetes 1.37.0, Agent Substrate v1.0.0 from the release images"
GUEST_P = "x86 server guest, 16 vCPU, 23 GB, kind v0.33.0, Kubernetes 1.37.0, Agent Substrate v1.0.0 from the release images, Envoy dataplane, gVisor, one control plane node and two worker nodes, default atelet timers, pool of 4 worker pods"
GUEST_Q = "x86 server guest, 16 vCPU, 23 GB, kind v0.33.0, Kubernetes 1.37.0, Agent Substrate v1.0.0 from the release images, one kind node, agentgateway v1.7.0 and Envoy switched in place"
VALIDATION_MACHINE = GUEST_A + ", pool of 2 workers with 8 CPU and 8 GiB each"
TIMED_REQUESTS = ("first-call-golden", "warm-call", "resume-local", "resume-after-sync")


def read(rel):
    return (LAB / rel).read_text(encoding="utf-8")


def read_json(rel):
    return json.loads(read(rel))


def lines(rel):
    return read(rel).splitlines()


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
    return {
        "machine": GUEST_A,
        "sources": ["capture/lab/B-lifecycle/10-trace.tsv", "capture/lab/B-lifecycle/20-trace-ops.tsv", "capture/lab/D-durability/30-local-loss.tsv", "capture/lab/D-durability/40-node-reboot.tsv", "capture/lab/J-container-death/10-trace.tsv"],
        "idle_watch": {"seconds": 900, "samples_after_last_request": len(watch), "states": tally(row[2] for row in watch), "all_samples": len(idle)},
        "lifecycle_ops": trace("B-lifecycle/20-trace-ops.tsv", False),
        "local_snapshot_loss": trace("D-durability/30-local-loss.tsv", True),
        "node_restart": trace("D-durability/40-node-reboot.tsv", False),
        "death_inside_sandbox": trace("J-container-death/10-trace.tsv", True),
    }


def parking_x86():
    text = read("I-capacity/16-load-30s.log")
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
    return dependency_loss("E-dependency-loss", GUEST_B)


def dependency_agw_x86():
    return dependency_loss("Q-network/g-dependency-loss-agw", GUEST_Q + ", agentgateway dataplane for this run")


def dependency_loss(folder, machine):
    marks = {}
    for row in rows(f"{folder}/10-timeline.tsv"):
        if len(row) >= 3 and row[0].isdigit():
            marks[row[2].split(" ")[0]] = int(row[0])
    outages = [
        ("postgres", "T1-postgres-scale-0", "T1-postgres-scale-1", "T1-postgres-ready"),
        ("ate-api-server", "T2-ateapi-scale-0", "T2-ateapi-scale-2", "T2-ateapi-ready"),
        ("kube-apiserver", "T3-kube-apiserver-manifest-moved-out", "T3-kube-apiserver-manifest-moved-back", "T3-kube-apiserver-livez-200"),
    ]
    probes = []
    for rel in (f"{folder}/12-probe-incluster.tsv", f"{folder}/12-probe-proxy.tsv"):
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
        "machine": machine,
        "note": "one request per second to a RUNNING actor from a pod (stream running) and through kubectl ate proxy (stream proxy), one fresh SUSPENDED actor every 5 s (stream suspended). t is seconds from the moment the dependency was taken away. Code 000 is a client timeout at 9 s.",
        "sources": [f"capture/lab/{folder}/10-timeline.tsv", f"capture/lab/{folder}/12-probe-incluster.tsv", f"capture/lab/{folder}/12-probe-proxy.tsv", f"capture/lab/{folder}/20-analysis.txt"],
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
        answered = re.search(r"(\d{3}) in ([\d.]+) s", text)
        after = re.search(r"after ([\d.]+) s", text)
        took = re.search(r"\(([\d.]+) s\)", text)
        gave_up = re.search(r"did not answer in ([\d.]+) s", text)
        if key == "symptom" and answered:
            case["symptoms"].append({"http": int(answered.group(1)), "seconds": round(float(answered.group(2)), 3)})
        elif key == "detect" and text.startswith("no "):
            case["detect_timed_out"] = True
        elif key == "detect" and after:
            case["detect_seconds"] = float(after.group(1))
        elif key == "fix":
            case["fix"] = re.sub(r"\s*\(.*\)$", "", text)
            case["fix_seconds"] = float(took.group(1)) if took else float(after.group(1))
        elif key == "recover" and answered:
            case["recoveries"].append({"http": int(answered.group(1)), "seconds": round(float(answered.group(2)), 3)})
        elif key == "recover" and after:
            case["recoveries"].append({"http": 200, "seconds": float(after.group(1))})
        elif key == "recover" and gave_up:
            case["recoveries"].append({"http": 0, "seconds": float(gave_up.group(1))})
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
            task["clean_check_seconds"] = float(row[4])
            if int(row[3]) == 200:
                task["files_after_revert"] = int(json.loads(row[5])["stdout"])
            else:
                task["clean_check_error"] = row[5][:200]
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
    image_bytes = int(read("V-validation/02-python-runtime/02-image.txt").split()[1])
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
        "ate_api_error_lines_during_bursts": int(read(f"{base}/12-ateapi-error-lines-during-bursts.txt").strip()),
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


NODE_LOSS_CASES = [
    ("a", "suspended with --mode sync, no request, one revert after the workers were unavailable", "10-a-quiet-revert.tsv", "return-a.tsv"),
    ("a2", "suspended with --mode sync, no request, first revert before the workers were unavailable", "74-second-revert.tsv", "return-rev.tsv"),
    ("b", "suspended with --mode sync, requests during the outage, a tag made before the stop", "80-tag-rescue.tsv", "return-tag.tsv"),
    ("b2-early", "suspended with --mode sync, requests and a revert every 15 s from 60 s", "20-b60-requests-revert-loop.tsv", "return-b60.tsv"),
    ("b2-evicted", "suspended with --mode sync, requests, reverts only after the pods were evicted", "30-bevict-requests-revert-after-eviction.tsv", "return-bevict.tsv"),
    ("c-quiet", "suspended in the default mode with a PENDING snapshot, no request, one revert after the workers were unavailable", "50-c-pending-snapshot.tsv", "return-cquiet.tsv"),
    ("c-requests", "suspended in the default mode with a PENDING snapshot, requests and reverts", "55-c-pending-snapshot-with-requests.tsv", "return-creq.tsv"),
    ("c-return", "two actors suspended in the default mode with a PENDING snapshot, no command until the node was back", "88-pending-snapshot-node-returns.tsv", "return-pend.tsv"),
    ("d", "running, with one tag from a sync suspend and one from an async suspend", "85-tag-rescue-running-and-pending.tsv", "return-tag2.tsv"),
    ("d2", "running, reverts during the outage, then suspend and delete", "60-d-running.tsv", "return-drun.tsv"),
    ("e", "suspended with --mode sync, 4 running actors on the other node, one revert", "70-e-no-spare-then-scale.tsv", "return-escale.tsv"),
    ("e2", "suspended with --mode sync, 11 running actors on the other node, one revert", "72-e2-survivor-full-then-scale.tsv", "return-e2scale.tsv"),
    ("f", "suspended with --mode sync, requests, then suspend, resume and delete", "40-balt-suspend-resume-delete.tsv", "return-balt.tsv"),
]
COMMAND_ERRORS = [
    ("while calling atelet Terminate", "atelet_terminate"),
    ("not in a revertable state", "not_revertable"),
    ("another operation is in progress", "operation_in_progress"),
    ("to be tagged", "not_suspended"),
    ("MarkSuspending prerequisite", "mark_suspending"),
    ("is unavailable", "worker_unavailable"),
    ("AlreadyExists", "already_exists"),
]
COMMAND_WORDS = ("revert", "suspend-attempt", "resume-attempt", "delete", "recreate", "tag-attempt", "create-from-tag", "create-tag")


def node_rows(rel):
    out = []
    for row in rows(rel)[1:]:
        if len(row) < 3:
            continue
        out.append({"t": None if row[1] == "t=-" else float(row[1][2:]), "event": row[2], "fields": row[3:], "text": "\t".join(row[3:])})
    return out


def actor_state(text):
    found = re.findall(r"ACTOR_STATE_[A-Z]+", text)
    return found[-1] if found else None


def is_command(event):
    if re.search(r"request|state|deleted|recovered", event):
        return False
    return any(word in event for word in COMMAND_WORDS)


def command(item):
    text = item["text"]
    took = re.search(r"(?:^|: )([\d.]+) s \|", text)
    before = re.search(r"state(?:-before)?=(ACTOR_STATE_[A-Z]+)", text)
    out = {"t": item["t"], "event": item["event"], "ok": "Error" not in text}
    if took:
        out["seconds"] = float(took.group(1))
    if before:
        out["state_before"] = before.group(1)
    if not out["ok"]:
        out["error"] = next((name for needle, name in COMMAND_ERRORS if needle in text), "other")
    return out


def served(item):
    match = re.search(r"(?:^|\t| )200\t([\d.]+)\tcount=(\d+)", item["text"])
    if not match:
        return None
    out = {"t": item["t"], "event": item["event"], "seconds": round(float(match.group(1)), 3), "count": int(match.group(2))}
    node = re.search(r"ACTOR_STATE_RUNNING\t(\S+)", item["text"])
    if node:
        out["node"] = node.group(1)
    after = re.search(r"([\d.]+) s after create", item["text"])
    if after:
        out["seconds_after_create"] = float(after.group(1))
    tag = re.match(r"([\w-]+) \| ", item["text"])
    if tag and after:
        out["tag"] = tag.group(1)
    return out


def tally(values):
    out = {}
    for value in values:
        out[value] = out.get(value, 0) + 1
    return dict(sorted(out.items()))


def node_loss_case(key, title, rel):
    items = node_rows(f"P-node-loss/{rel}")
    during = [item for item in items if item["t"] is not None]
    probes = [item for item in during if item["event"] in ("probe", "request", "first-request", "second-request", "request-after-recreate") and item["fields"] and re.fullmatch(r"\d{3}", item["fields"][0])]
    commands = [command(item) for item in during if is_command(item["event"])]
    requests_ok = [entry for entry in (served(item) for item in during) if entry]
    failed_seconds = [float(item["fields"][1]) for item in probes if item["fields"][0] != "200"]
    first = lambda name: next((item["t"] for item in during if item["event"] == name), None)
    crashed = next((item["t"] for item in during if item["event"] in ("probe", "state-before-revert-5", "state") and actor_state(item["text"]) == "ACTOR_STATE_CRASHED"), None)
    start = next((item for item in during if item["event"] == "node-start"), None)
    states = [actor_state(item["text"]) for item in during if actor_state(item["text"])]
    return {
        "case": key,
        "situation": title,
        "source": f"capture/lab/P-node-loss/{rel}",
        "calls_before_stop": sum(1 for item in items if item["t"] is None and item["event"].endswith("call")),
        "node_stopped_t": first("node-stopped"),
        "workers_unavailable_t": first("workers-of-stopped-node-not-active"),
        "pods_evicted_t": first("pods-evicted"),
        "actor_crashed_t": crashed,
        "node_start_t": start["t"] if start else None,
        "watched_seconds": during[-1]["t"],
        "probes": {
            "requests": len(probes),
            "ok": sum(1 for item in probes if item["fields"][0] == "200"),
            "codes": tally(item["fields"][0] for item in probes),
            "actor_states": tally(actor_state(item["text"]) or "none" for item in probes),
            "failed_seconds": stat(failed_seconds) if failed_seconds else None,
        },
        "commands": {
            "total": len(commands),
            "ok": sum(1 for entry in commands if entry["ok"]),
            "errors": tally(f"{entry['event'].split('-attempt')[0]}:{entry.get('state_before', 'any')}:{entry['error']}" for entry in commands if not entry["ok"]),
            "runs": commands,
        },
        "served": requests_ok,
        "last_state": states[-1] if states else None,
    }


def node_return(key, rel, case):
    items = node_rows(f"P-node-loss/{rel}")
    by_event = {}
    for item in items:
        by_event.setdefault(item["event"], []).append(item)
    outage = float(re.search(r"outage of ([\d.]+) s", by_event["node-start"][0]["text"]).group(1))
    late = outage == 0
    if late and case["node_start_t"] is not None:
        outage = case["node_start_t"]
    watches = by_event.get("watch", [])
    pods = [int(re.search(r"pool-pods-running-on-node=(\d+)", item["text"]).group(1)) for item in watches]
    active = next((item["t"] for item in watches if "workers-active-on-node=0" not in item["text"]), None)
    first_actor = by_event.get("first-actor-on-returned-node")
    final = by_event.get("final-state")
    reverts = [command(item) for item in by_event.get("revert-after-node-return", [])]
    requests_ok = [entry for entry in (served(item) for item in by_event.get("request-after-revert", [])) if entry]
    return {
        "case": key,
        "source": f"capture/lab/P-node-loss/{rel}",
        "outage_seconds": round(outage, 1),
        "after_eviction": case["pods_evicted_t"] is not None or outage > 360,
        "node_ready_t": by_event["node-ready"][0]["t"],
        "pool_pods_on_node_at_end": pods[-1] if pods else None,
        "workers_active_t": active,
        "first_new_actor_on_node_t": first_actor[0]["t"] if first_actor and not late else None,
        "trace_started_after_the_node": late,
        "watched_seconds": watches[-1]["t"] if watches else None,
        "moved_pods_by_hand": "rebalanced-by-hand" in by_event,
        "actor_state_at_end": actor_state(final[0]["text"]) if final else None,
        "revert_after_return": reverts,
        "served_after_return": requests_ok,
    }


def spread(values):
    values = [value for value in values if value is not None]
    return {**stat(values), "runs": rounded(values)} if values else None


def node_loss_x86():
    cases = [node_loss_case(key, title, rel) for key, title, rel, _ in NODE_LOSS_CASES]
    by_key = {case["case"]: case for case in cases}
    returns = [node_return(key, rel, by_key[key]) for key, _, _, rel in NODE_LOSS_CASES]
    rescues = []
    for case in cases:
        for entry in case["served"]:
            if "seconds_after_create" in entry:
                rescues.append({"case": case["case"], "tag": entry.get("tag", "keep-t1"), "seconds_after_create": entry["seconds_after_create"], "request_seconds": entry["seconds"], "count": entry["count"], "node": entry.get("node")})
    second_rows = node_rows("P-node-loss/74-second-revert.tsv")
    second = [command(item) for item in second_rows if item["t"] is not None and re.match(r"revert-\d", item["event"])]
    for entry, state in zip(second, [actor_state(item["text"]) for item in second_rows if item["event"] == "state"]):
        entry["state_after"] = state
    golden = lines("P-node-loss/96-golden-tag-deleted.txt")
    early = [r for r in returns if not r["after_eviction"] and not r["trace_started_after_the_node"]]
    late = [r for r in returns if r["after_eviction"]]
    return {
        "machine": GUEST_P,
        "note": "one run for each case. t is seconds from the docker stop command of the node multi-worker2. Requests go through kubectl ate proxy. The actor holds a counter and 50 MB in memory.",
        "sources": [case["source"] for case in cases] + [r["source"] for r in returns] + ["capture/lab/P-node-loss/96-golden-tag-deleted.txt", "capture/lab/P-node-loss/01-atelet-args.txt"],
        "detection": {
            "workers_unavailable_t": spread(case["workers_unavailable_t"] for case in cases),
            "pods_evicted_t": spread(case["pods_evicted_t"] for case in cases),
            "actor_crashed_t_while_down": spread(case["actor_crashed_t"] for case in cases if case["node_start_t"] is None or (case["actor_crashed_t"] or 0) < case["node_start_t"]),
        },
        "cases": cases,
        "tag_rescue": rescues,
        "second_revert": second,
        "node_return": {
            "before_eviction": {"first_new_actor_on_node_t": spread(r["first_new_actor_on_node_t"] for r in early), "outage_seconds": spread(r["outage_seconds"] for r in early), "pool_pods_on_node_at_end": [r["pool_pods_on_node_at_end"] for r in early]},
            "after_eviction": {"first_new_actor_on_node_t": spread(r["first_new_actor_on_node_t"] for r in late), "outage_seconds": spread(r["outage_seconds"] for r in late), "watched_seconds": spread(r["watched_seconds"] for r in late), "pool_pods_on_node_at_end": [r["pool_pods_on_node_at_end"] for r in late], "still_reverting_or_deleting": sum(1 for r in late if r["actor_state_at_end"] in ("ACTOR_STATE_REVERTING", "ACTOR_STATE_DELETING"))},
            "runs": returns,
        },
        "golden_tag_deleted": {
            "create_actor_error": next(line for line in golden if line.startswith("Error")),
            "templates_still_listed_with_tag": sum(1 for line in golden[2:5] if re.search(r"ballast-\d+\s+[0-9a-f-]{36}", line)),
        },
    }


def rotation_x86():
    out = {}
    for name in ("agentgateway", "envoy"):
        base = f"Q-network/l-credential-rotation/{name}"
        changes = []
        for row in rows(f"{base}/20-rotations.tsv"):
            if row[0].isdigit():
                changes.append({"change": int(row[0]), "wait_before_seconds": int(row[1]), "secret_changed_epoch": float(row[2]), "first_seen_epoch": float(row[3]), "seconds": float(row[4]), "requests_with_old_value": int(row[5])})
        probe = [row for row in rows(f"{base}/10-probe.tsv") if len(row) == 2 and row[0] != "epoch"]
        seen = [entry["first_seen_epoch"] for entry in changes]
        out[name] = {
            "changes": changes,
            "seconds": stat([entry["seconds"] for entry in changes]),
            "probe_requests": len(probe),
            "values_seen": tally(row[1].split(": ", 1)[1] for row in probe),
            "empty_or_placeholder_values": sum(1 for row in probe if "rot-value-" not in row[1]),
            "seconds_between_first_seen": rounded([b - a for a, b in zip(seen, seen[1:])]),
        }
    return {
        "machine": GUEST_Q,
        "note": "one running actor, one http rule with replaceHeaders from a Kubernetes Secret, one request about each second to an echo service in the cluster. The Secret was changed three times on each dataplane. The values are made-up test strings.",
        "unit": {"seconds": "from the change of the Secret to the first request in which the upstream saw the new value"},
        "sources": [f"capture/lab/Q-network/l-credential-rotation/{name}/{leaf}" for name in ("agentgateway", "envoy") for leaf in ("20-rotations.tsv", "10-probe.tsv")],
        "dataplanes": out,
    }


def cpu_limit_x86():
    base = "Q-network/n-cpu-limit"
    groups = {}
    for row in rows(f"{base}/40-work.tsv"):
        if row[0].isdigit():
            groups.setdefault((int(row[0]), int(row[1])), []).append([float(value) for value in row[3:]])
    results = []
    for (limit, threads), runs in sorted(groups.items()):
        column = lambda i: [run[i] for run in runs]
        results.append({
            "x": limit,
            "threads": threads,
            "wall_seconds": stat(column(1)),
            "host_cpu_seconds": stat(column(3)),
            "host_cores_used": stat(column(4)),
            "cpu_seconds_reported_inside": stat(column(2)),
            "periods": stat(column(5)),
            "throttled_periods": stat(column(6)),
            "runs": [{"wall_seconds": run[1], "cpu_seconds_reported_inside": run[2], "host_cpu_seconds": run[3], "host_cores_used": run[4], "periods": int(run[5]), "throttled_periods": int(run[6])} for run in runs],
        })
    seen = {str(limit): read_json(f"{base}/41-info-{limit}.json") for limit in (250, 500, 1000, 2000)}
    quotas = {}
    for line in lines(f"{base}/42-cgroup-after.txt"):
        parts = line.split()
        if len(parts) > 1 and parts[0].isdigit():
            quotas[parts[0]] = parts[1]
    first = []
    for row in rows(f"{base}/10-burn.tsv"):
        if row[0].isdigit():
            first.append({"x": int(row[0]), "threads": int(row[1]), "wall_seconds": float(row[4]), "effective_cores_not_valid": float(row[7])})
    worker = read_json(f"{base}/03-worker-pod-resources.json")
    return {
        "machine": GUEST_Q + ", pool of one worker pod with a Kubernetes limit of 6 CPU",
        "note": "a fixed number of loop steps (38,928 blocks of 200,000 steps, about 5 s on one free core) on 1 thread or on 4 threads, three runs for each row. Host CPU time is read from the cgroup of the actor on the node.",
        "unit": {"x": "resources.limits.cpuMillicores of the template", "host_cores_used": "host CPU seconds divided by wall seconds"},
        "sources": [f"capture/lab/{base}/40-work.tsv", f"capture/lab/{base}/42-cgroup-after.txt", f"capture/lab/{base}/41-info-250.json", f"capture/lab/{base}/03-worker-pod-resources.json", f"capture/lab/{base}/10-burn.tsv"],
        "points": results,
        "seen_inside_the_actor": seen,
        "cgroup_cpu_max_of_actor": quotas,
        "worker_pod_limits": worker["resources"]["limits"],
        "superseded_first_test": {"note": "each run stopped when the CPU time read inside the sandbox reached 10 s, so effective_cores is not valid", "source": f"capture/lab/{base}/10-burn.tsv", "runs": first},
    }


def keepalive(name):
    text = lines(f"Q-network/h-keepalive/{name}/results.txt")
    tests = {}
    removed = []
    current = None
    for line in text:
        head = re.match(r"### \[(\d\d):(\d\d):([\d.]+)\] (.+)", line)
        if head:
            clock = int(head.group(1)) * 3600 + int(head.group(2)) * 60 + float(head.group(3))
            label = head.group(4)
            if "Pnone.yaml" in label:
                removed.append(clock)
            current = tests.setdefault(label, {"codes": [], "seconds": [], "new_connections": 0}) if label.startswith(("h1-http11", "h2-https")) else None
            continue
        if current is None:
            continue
        start = re.match(r"start=(\d\d):(\d\d):(\d\d)", line)
        if start:
            current["start"] = int(start.group(1)) * 3600 + int(start.group(2)) * 60 + int(start.group(3))
        row = re.match(r"(\d{3}) http=(\S+) new_conns=(\d+) lport=(\d+) t=([\d.]+)", line)
        if row:
            current["codes"].append(row.group(1))
            current["http"] = row.group(2)
            current["new_connections"] += int(row.group(3))
            current["seconds"].append(float(row.group(5)))
    out = {}
    for (label, test), gone in zip(tests.items(), removed):
        refused = test["codes"].index("403") + 1
        out[label.split("-")[0]] = {
            "test": label,
            "http": test["http"],
            "requests": len(test["codes"]),
            "new_connections": test["new_connections"],
            "ok": test["codes"].count("200"),
            "refused_403": test["codes"].count("403"),
            "first_refused_request": refused,
            "rule_removed_seconds_after_start": round(gone - test["start"], 1),
            "last_ok_seconds_after_removal": round(test["start"] + 2 * (refused - 2) - gone, 1),
            "first_refused_seconds_after_removal": round(test["start"] + 2 * (refused - 1) - gone, 1),
            "runs": {"codes": test["codes"], "seconds": rounded(test["seconds"])},
        }
    return out


def suspend_cutoff(name):
    marks = {}
    for row in rows(f"Q-network/k-suspend-cutoff/{name}/10-events.tsv"):
        marks[row[1]] = row
    begin = stamp(marks["suspend-call-start"][0])
    gone = marks["drip-log-read"][2].split(" ")[0]
    return {
        "suspend_call_seconds": round(stamp(marks["suspend-call-returned"][0]) - begin, 2),
        "upstream_saw_connection_gone_seconds": round(stamp(gone) - begin, 1),
        "state_before_resume": marks["state-before-resume"][2],
        "state_after_request": marks["resumed-by-request"][2],
    }


def table(rel):
    data = rows(rel)
    head = data[0]
    out = []
    for row in data[1:]:
        item = {}
        for key, value in zip(head, row):
            try:
                item[key] = float(value) if "." in value else int(value)
            except ValueError:
                item[key] = value
        out.append(item)
    return out


def router_ports(name):
    base = f"Q-network/m-router-ports/{name}"
    service = [int(value) for value in re.findall(r"^\s+port: (\d+)", read(f"{base}/00-service.yaml"), re.M)]
    containers = read_json(f"{base}/02-router-containers.json")
    probes = []
    for row in rows(f"{base}/10-port-probes.tsv")[1:]:
        entry = {"from": row[0], "target": row[1], "port": int(row[2])}
        for cell in row[3:]:
            match = re.match(r"([\w-]+): (\d{3}) exit=(\d+) err=([^|]*)", cell)
            if match:
                entry[match.group(1).replace("-", "_")] = {"code": match.group(2), "curl_exit": int(match.group(3)), "error": match.group(4).strip()[:120]}
        probes.append(entry)
    extra = {}
    for line in lines(f"{base}/11-port-probes-supplement.txt"):
        label, _, rest = line.partition(": ")
        parts = rest.strip().split("|")
        code = parts[0].split(" ")[0]
        entry = {"code": code}
        if label.startswith("stats") and code == "200" and len(parts) > 2 and parts[1].isdigit():
            entry["bytes"] = int(parts[1])
            if parts[2].isdigit():
                entry["metric_families"] = int(parts[2])
        elif code != "000" and len(parts) > 1 and not label.startswith("stats"):
            entry["body"] = parts[1][:80]
        extra[label.strip()] = entry
    return {
        "service_ports": service,
        "container_ports": {item["name"]: item["ports"] for item in containers},
        "probes": probes,
        "more_probes": extra,
    }


def network_x86():
    base = "Q-network"
    gateway = {}
    for name in ("agentgateway", "envoy"):
        marks = lines(f"{base}/i-model-gateway/24-marker-counts-{name}-private-ca-trusted.txt")
        counts = re.search(r"mock-a=(\d+) mock-b=(\d+)", marks[0])
        cost = "51-connection-cost-agentgateway.tsv" if name == "agentgateway" else "51-connection-cost-envoy-private-ca-trusted.tsv"
        gateway[name] = {
            "default_install_tls_gateway": next(item for item in table(f"{base}/i-model-gateway/31-latency-{name}.tsv") if item["path"] == "actor-l3-via-tls-gw"),
            "new_connection_each_request_ms": table(f"{base}/i-model-gateway/31-latency-{name}-private-ca-trusted.tsv"),
            "connection_cost_ms": table(f"{base}/i-model-gateway/{cost}"),
            "injected_credential_seen_by": {"mock-a": int(counts.group(1)), "mock-b": int(counts.group(2))},
            "placeholder_seen_by_backends": int(marks[1].rsplit(" ", 1)[1]),
        }
    levels = []
    for row in rows(f"{base}/j-log-level/10-volume.tsv"):
        fields = dict(cell.split("=", 1) for cell in row[1:])
        ok = re.search(r"(\d+) of (\d+)", fields["requests_ok"])
        levels.append({"rust_log": row[0], "lines": int(fields["lines"]), "bytes": int(fields["bytes"]), "lines_with_header_value": int(fields["lines_with_header_marker"]), "lines_with_authorization_value": int(fields["lines_with_auth_marker"]), "requests_ok": int(ok.group(1)), "requests": int(ok.group(2))})
    after = read_json(f"{base}/00-dataplane-switch-to-agentgateway/17-after-rerun-rust-log-and-roots.json")
    switches = {}
    for name in ("agentgateway", "envoy"):
        timing = re.search(r"rc=(\d+) seconds=(\d+)", lines(f"{base}/00-dataplane-switch-to-{name}/11-timing.txt")[0])
        switches[f"to_{name}"] = {"exit": int(timing.group(1)), "seconds": int(timing.group(2))}
    return {
        "machine": GUEST_Q,
        "note": "a three-node cluster on the same guest ran the node-stop tests at the same time, so read differences of a few milliseconds as noise. Each test ran once on each dataplane.",
        "sources": [
            f"capture/lab/{base}/h-keepalive/agentgateway/results.txt",
            f"capture/lab/{base}/h-keepalive/envoy/results.txt",
            f"capture/lab/{base}/k-suspend-cutoff/agentgateway/10-events.tsv",
            f"capture/lab/{base}/k-suspend-cutoff/envoy/10-events.tsv",
            f"capture/lab/{base}/j-log-level/10-volume.tsv",
            f"capture/lab/{base}/i-model-gateway/31-latency-agentgateway-private-ca-trusted.tsv",
            f"capture/lab/{base}/i-model-gateway/31-latency-envoy-private-ca-trusted.tsv",
            f"capture/lab/{base}/i-model-gateway/51-connection-cost-agentgateway.tsv",
            f"capture/lab/{base}/i-model-gateway/51-connection-cost-envoy-private-ca-trusted.tsv",
            f"capture/lab/{base}/m-router-ports/agentgateway/10-port-probes.tsv",
            f"capture/lab/{base}/m-router-ports/envoy/10-port-probes.tsv",
            f"capture/lab/{base}/00-dataplane-switch-to-agentgateway/17-after-rerun-rust-log-and-roots.json",
        ],
        "keepalive_after_rule_removal": {"note": "one curl process, 20 requests 2 s apart on one connection. The start time has a resolution of 1 s, so each time after the removal can be up to 1 s later.", "agentgateway": keepalive("agentgateway"), "envoy": keepalive("envoy")},
        "suspend_cutoff": {"note": "the upstream writes one chunk each second, so the close can be up to 1 s earlier", "agentgateway": suspend_cutoff("agentgateway"), "envoy": suspend_cutoff("envoy")},
        "egress_log_level": {"note": "100 requests at each level on agentgateway", "levels": levels, "rust_log_after_installer_rerun": after["rust_log"]},
        "model_gateway": gateway,
        "router_ports": {"agentgateway": router_ports("agentgateway"), "envoy": router_ports("envoy")},
        "dataplane_switch": switches,
    }


def step_seconds(rel):
    return {item["step"]: item for item in steps(rel)}


def agent_executor_x86():
    base = "R-agent-executor"
    cycles = {}
    failed = 0
    for row in rows(f"{base}/40-lifecycle/30-cycles.tsv")[1:]:
        if row[2] != "0":
            failed += 1
            continue
        cycles.setdefault(row[1], []).append(float(row[3]))
    watch = [row for row in rows(f"{base}/50-idle/10-idle-watch.tsv") if len(row) >= 2 and row[1].startswith("ACTOR_STATE_")]
    workspace = step_seconds(f"{base}/70-workspace/steps.tsv")
    plain = step_seconds(f"{base}/90-nodebug/steps.tsv")
    removal = step_seconds(f"{base}/99-delete/steps.tsv")
    network = step_seconds(f"{base}/80-networking/steps.tsv")
    return {
        "machine": GUEST_R,
        "agent_executor_commit": lines(f"{base}/10-install/00-ax-commit.txt")[0].split()[0],
        "model": "none. Every task ran the command sleep infinity, and no model request was sent.",
        "unit": {"seconds": "wall time of the ax command at the client, on the guest that runs the cluster"},
        "sources": [
            f"capture/lab/{base}/10-install/steps.tsv",
            f"capture/lab/{base}/40-lifecycle/30-cycles.tsv",
            f"capture/lab/{base}/50-idle/10-idle-watch.tsv",
            f"capture/lab/{base}/70-workspace/steps.tsv",
            f"capture/lab/{base}/80-networking/steps.tsv",
            f"capture/lab/{base}/90-nodebug/steps.tsv",
            f"capture/lab/{base}/99-delete/steps.tsv",
        ],
        "install_steps": steps(f"{base}/10-install/steps.tsv"),
        "cycles": {"note": "10 cycles of ax suspend task, 1 s wait, ax resume task, ax ssh, ax describe on one task with no workspace", "failed": failed, "seconds": {name: stat(values) for name, values in cycles.items()}, "runs": {name: rounded(values) for name, values in cycles.items()}},
        "idle_watch": {"note": "one running task with no request, sampled every 15 s", "samples": len(watch), "span_seconds": round(stamp(watch[-1][0]) - stamp(watch[0][0]), 1), "states": tally([row[1] for row in watch])},
        "first_resume": {
            "no_workspace": plain["03-resume"]["seconds"],
            "workspace_clone_blocked": workspace["06-resume-first"]["seconds"],
            "workspace_clone_blocked_second": workspace["17-resume-second"]["seconds"],
        },
        "router_plain_http": {"exit": network["02-in-cluster-curl-http"]["exit"], "seconds": network["02-in-cluster-curl-http"]["seconds"]},
        "delete_task_seconds": [removal["04-delete-task-nodebug"]["seconds"], removal["05-delete-task-ws"]["seconds"]],
    }


def go_seconds(text):
    units = {"h": 3600, "m": 60, "s": 1, "ms": 1e-3, "µs": 1e-6, "us": 1e-6, "ns": 1e-9}
    return sum(float(value) * units[unit] for value, unit in re.findall(r"([0-9.]+)(h|ms|µs|us|ns|m|s)", text))


def model_requests(rel, path):
    out = []
    for line in lines(rel):
        match = re.match(r"(\S+) \[GIN\] .*\| +(\d+) \| +(\S+) \|.*POST +\"" + re.escape(path), line)
        if match:
            out.append({"end": match.group(1), "code": int(match.group(2)), "seconds": round(go_seconds(match.group(3)), 3)})
    return out


def model_bench(base):
    sizes = {}
    for line in lines(f"{base}/10-model/06-list.txt")[1:]:
        fields = line.split()
        if len(fields) >= 4:
            sizes[fields[0]] = f"{fields[2]} {fields[3]}"
    bench = {}
    for row in rows(f"{base}/10-model/10-bench.tsv")[1:]:
        entry = bench.setdefault(row[0], {"tokens_per_second": [], "tool_seconds": [], "tool_results": []})
        if row[1] == "generate":
            entry["tokens_per_second"].append(float(row[8]))
        else:
            entry["tool_seconds"].append(float(row[3]))
            entry["tool_results"].append(row[9])
    return {
        name: {
            "size": sizes.get(name),
            "tokens_per_second": stat(entry["tokens_per_second"]),
            "tool_call": {"n": len(entry["tool_results"]), "correct": entry["tool_results"].count("ok"), "seconds": stat(entry["tool_seconds"])},
        }
        for name, entry in sorted(bench.items())
    }


def kagent_model_x86():
    base = "S-ax-model"
    loop = f"{base}/20-kagent/loop"
    series = {}
    for row in rows(f"{loop}/per-turn.tsv")[1:]:
        wall, model, resume, suspend = float(row[1]), float(row[4]), float(row[5]), float(row[6])
        completed = row[2] == "TASK_STATE_COMPLETED"
        series.setdefault(re.sub(r"-\d+$", "", row[0]), []).append({
            "turn": row[0],
            "wall_seconds": wall,
            "model_seconds": model,
            "model_calls": int(row[3]),
            "resume_seconds": resume,
            "suspend_seconds": suspend,
            "completed": completed,
            "clean": completed and model <= wall,
        })
    summary = {}
    for name, turns in sorted(series.items()):
        clean = [turn for turn in turns if turn["clean"]]
        summary[name] = {
            "n": len(turns),
            "completed": sum(1 for turn in turns if turn["completed"]),
            "clean": len(clean),
            "wall_seconds": stat([turn["wall_seconds"] for turn in clean]),
            "model_seconds": stat([turn["model_seconds"] for turn in clean]),
            "model_share": stat([turn["model_seconds"] / turn["wall_seconds"] for turn in clean]),
            "model_calls": tally([str(turn["model_calls"]) for turn in clean]),
            "resume_seconds": stat([turn["resume_seconds"] for turn in turns if turn["resume_seconds"] > 0]),
            "suspend_seconds": stat([turn["suspend_seconds"] for turn in turns if turn["suspend_seconds"] > 0]),
        }
    requests = model_requests(f"{loop}/ollama.excerpt.log", "/v1/chat/completions")
    longest = max(requests, key=lambda item: item["seconds"])
    generated = [int(value) for value in re.findall(r"n_gen = +(\d+)", read(f"{loop}/stuck-turn-05-ollama-runaway.log"))]
    events = {}
    for line in lines(f"{loop}/events.log"):
        fields = line.split()
        if len(fields) >= 2:
            events[fields[1]] = fields[0]
    stuck = next(turn for turns in series.values() for turn in turns if not turn["completed"])
    queued = next(turn for turns in series.values() for turn in turns if turn["completed"] and not turn["clean"])
    start = events[stuck["turn"] + "-start"]
    seen = stamp(start[:11] + lines(f"{loop}/stuck-turn-01-time.txt")[0].strip())
    state = re.search(r"^  state: (ACTOR_STATE_\w+)", read(f"{loop}/stuck-turn-02-actor.yaml"), re.M).group(1)
    return {
        "machine": GUEST_S,
        "note": "the model is a small open model on CPU, so model time here is not the model time of a GPU or of a hosted model. Every turn resumes the session actor and suspends it again. A clean turn completed and was not delayed by the turn that did not end. A resume or suspend of 0 means that the log window held no record for that turn, and it is left out of the statistics.",
        "prompt": lines(f"{loop}/prompt.txt")[0],
        "sources": [
            f"capture/lab/{base}/10-model/10-bench.tsv",
            f"capture/lab/{base}/10-model/06-list.txt",
            f"capture/lab/{loop}/per-turn.tsv",
            f"capture/lab/{loop}/timings.tsv",
            f"capture/lab/{loop}/events.log",
            f"capture/lab/{loop}/ollama.excerpt.log",
            f"capture/lab/{loop}/stuck-turn-01-time.txt",
            f"capture/lab/{loop}/stuck-turn-02-actor.yaml",
            f"capture/lab/{loop}/stuck-turn-05-ollama-runaway.log",
        ],
        "models": model_bench(base),
        "series": summary,
        "runs": series,
        "model_requests": {"n": len(requests), "codes": tally([str(item["code"]) for item in requests])},
        "turn_that_did_not_end": {
            "turn": stuck["turn"],
            "client_seconds": stuck["wall_seconds"],
            "model_request_seconds": longest["seconds"],
            "model_request_code": longest["code"],
            "tokens_generated_at_last_report": generated[-1],
            "actor_state_seen": state,
            "actor_state_seen_seconds_into_turn": round(seen - stamp(start), 1),
            "next_turn": queued["turn"],
            "next_turn_wall_seconds": queued["wall_seconds"],
            "ended_by": lines(f"{loop}/stuck-turn-06-restart-note.txt")[0],
        },
    }


def loss_run(base, folder, suspended_at):
    run = f"{base}/{folder}"
    events = {row[1].split()[0]: stamp(row[0]) for row in rows(f"{run}/21-events.tsv") if len(row) >= 2}
    changes = [(stamp(row[0]), row[1]) for row in rows(f"{run}/19-poll-changes.tsv")]
    crashed = next(when for when, state in changes if state == "ACTOR_STATE_CRASHED")
    resumed = events["ax-resume-1"]
    taken = step_seconds(f"{run}/steps.tsv")
    after = read(f"{run}/28-files-after-resume.log" if folder.endswith("durable") else f"{run}/28-ssh-after-resume.log")
    describe = read(f"{run}/23-describe-after-loss.log")
    return {
        "suspend_to_loss_seconds": round(events["delete-pod"] - suspended_at, 1),
        "durable_snapshot_at_loss": re.search(r"state: (SNAPSHOT_STORAGE_STATE_\w+)", read(f"{run}/16-actor-before.yaml")).group(1),
        "crashed_seen_after_seconds": round(crashed - events["delete-pod"], 1),
        "phase_after_loss": re.search(r"Phase: +(\w+)", describe).group(1),
        "message_after_loss": re.search(r"Ready +False +\w+ +(.+)", describe).group(1).strip(),
        "watched_with_no_command_seconds": round(resumed - events["delete-pod"], 1),
        "ax_resume_seconds": taken["26-resume-after-loss"]["seconds"],
        "ax_resume_exit": taken["26-resume-after-loss"]["exit"],
        "file_from_before_last_suspend_kept": "note-saved-by-suspend" in after,
        "file_from_after_last_suspend_kept": "unsaved.txt: No such file" not in after,
    }


def agent_executor_followups_x86():
    base = "S-ax-model"
    clone = step_seconds(f"{base}/30-ax-clone/steps.tsv")
    untrusted = [clone[name]["seconds"] for name in ("08-resume-first", "14-resume-second", "27-resume-with-passthrough", "45-resume-with-passthrough")]
    for name in ("32-cycles-https-rule-no-trust.tsv", "49-cycles-https-rule-no-trust-2.tsv"):
        untrusted += [float(row[2]) for row in rows(f"{base}/30-ax-clone/{name}")]
    after_clone = [float(row[2]) for row in rows(f"{base}/30-ax-clone/69-cycles-after-clone.tsv")]
    first_suspend = [stamp(json.loads(line)["time"]) for line in lines(f"{base}/40-ax-worker-loss/40-ax-server.log") if '"suspending actor on Substrate","actor":"s-loss"' in line]
    durable = {row[1]: stamp(row[0]) for row in rows(f"{base}/41-ax-worker-loss-durable/12c-durable-changes.tsv")}
    second_suspend = next(stamp(row[0]) for row in rows(f"{base}/41-ax-worker-loss-durable/21-events.tsv") if row[1] == "suspended")
    second = loss_run(base, "41-ax-worker-loss-durable", second_suspend)
    second["durable_snapshot_completed_after_seconds"] = round(durable["SNAPSHOT_STORAGE_STATE_COMPLETED"] - second_suspend, 1)
    calls = rows(f"{base}/60-ax-model/12-model-calls-running.tsv")[1:]
    turns = rows(f"{base}/60-ax-model/13-turns-resume-call-suspend.tsv")[1:]
    environment = read(f"{base}/60-ax-model/10-env-in-task.log")
    image = step_seconds(f"{base}/70-agent-image/steps.tsv")
    actor_log = [json.loads(line) for line in lines(f"{base}/70-agent-image/19-actor.log") if line.startswith("{")]
    started = next(stamp(item["time"]) for item in actor_log if "started task command" in item["message"])
    ended = next(stamp(item["time"]) for item in actor_log if "task command completed" in item["message"])
    old = read(f"{base}/50-ax-v031/85-controller-final.log") + read(f"{base}/50-ax-v031/92-controller-after-label.log")
    return {
        "machine": GUEST_R + ", Ollama 0.40.16 in a container on the guest with 12 CPUs and no GPU",
        "agent_executor_commit": "a72b8ca4",
        "model": "qwen2.5:3b, a small open model on CPU. Model time on a GPU or with a hosted model will differ.",
        "unit": {"seconds": "wall time of the ax command at the client, on the guest that runs the cluster, unless a field says otherwise"},
        "sources": [
            f"capture/lab/{base}/30-ax-clone/steps.tsv",
            f"capture/lab/{base}/30-ax-clone/32-cycles-https-rule-no-trust.tsv",
            f"capture/lab/{base}/30-ax-clone/49-cycles-https-rule-no-trust-2.tsv",
            f"capture/lab/{base}/30-ax-clone/69-cycles-after-clone.tsv",
            f"capture/lab/{base}/40-ax-worker-loss/steps.tsv",
            f"capture/lab/{base}/40-ax-worker-loss/19-poll-changes.tsv",
            f"capture/lab/{base}/40-ax-worker-loss/21-events.tsv",
            f"capture/lab/{base}/40-ax-worker-loss/40-ax-server.log",
            f"capture/lab/{base}/41-ax-worker-loss-durable/steps.tsv",
            f"capture/lab/{base}/41-ax-worker-loss-durable/12c-durable-changes.tsv",
            f"capture/lab/{base}/41-ax-worker-loss-durable/19-poll-changes.tsv",
            f"capture/lab/{base}/41-ax-worker-loss-durable/21-events.tsv",
            f"capture/lab/{base}/50-ax-v031/01-tag.txt",
            f"capture/lab/{base}/50-ax-v031/85-controller-final.log",
            f"capture/lab/{base}/50-ax-v031/92-controller-after-label.log",
            f"capture/lab/{base}/60-ax-model/12-model-calls-running.tsv",
            f"capture/lab/{base}/60-ax-model/13-turns-resume-call-suspend.tsv",
            f"capture/lab/{base}/70-agent-image/steps.tsv",
            f"capture/lab/{base}/70-agent-image/19-actor.log",
            f"capture/lab/{base}/70-agent-image/22-ollama.log",
        ],
        "clone": {
            "note": "one workspace with one public Git repository. The https rule lets the gateway intercept TLS, and the template that Agent Executor generates holds no trust bundle, so git refuses the certificate and the runner tries 5 times at each resume.",
            "resume_with_https_rule": {"seconds": stat(untrusted), "runs": rounded(untrusted)},
            "update_to_passthrough_without_ports_exit": clone["41-update-egress"]["exit"],
            "resume_with_passthrough_rule_seconds": clone["65-resume-with-passthrough"]["seconds"],
            "resume_after_clone": {"seconds": stat(after_clone), "runs": rounded(after_clone)},
        },
        "worker_loss": {
            "note": "the worker pod that held the running task was deleted. Each run is one task.",
            "snapshot_pending": loss_run(base, "40-ax-worker-loss", first_suspend[-1]),
            "snapshot_durable": second,
        },
        "model_call": {
            "note": "one curl from inside a running task to the model server, through an http egress rule set on the actor with kubectl ate",
            "injected_key_in_task_environment": "GEMINI_API_KEY" in environment,
            "calls": len(calls),
            "codes": tally([row[2] for row in calls]),
            "curl_seconds": stat([float(row[3]) for row in calls]),
            "turns": {
                "note": "ax resume task, one model call through ax ssh, ax suspend task",
                "codes": tally([row[3] for row in turns]),
                "resume_seconds": stat([float(row[1]) for row in turns]),
                "call_seconds": stat([float(row[4]) for row in turns]),
                "suspend_seconds": stat([float(row[5]) for row in turns]),
                "total_seconds": stat([float(row[6]) for row in turns]),
                "runs": rounded([float(row[6]) for row in turns]),
            },
        },
        "agent_image": {
            "note": "the Claude Code example image of the repository, pointed at the local model server through its Anthropic messages route. One run with one short prompt.",
            "build_seconds": image["01-build"]["seconds"],
            "image_bytes": int(lines(f"{base}/70-agent-image/03-image.txt")[0].split()[1]),
            "agent_version": lines(f"{base}/70-agent-image/04-claude-version.txt")[0],
            "first_resume_seconds": image["16-resume"]["seconds"],
            "command_seconds": round(ended - started, 1),
            "model_requests": model_requests(f"{base}/70-agent-image/22-ollama.log", "/v1/messages"),
            "phase_after_command_ended": re.search(r"Phase: +(\w+)", read(f"{base}/70-agent-image/20-describe.log")).group(1),
        },
        "release_v0_3_1": {
            "commits_behind_head": int(lines(f"{base}/50-ax-v031/01-tag.txt")[1]),
            "first_error_is_timeout": "i/o timeout" in old,
            "second_error_is_unknown_service": "unknown service ateapi.Control" in old,
            "phase": re.search(r"Phase: +(\w+)", read(f"{base}/50-ax-v031/93-describe.log")).group(1),
        },
    }


BUILDERS = {
    "kagent-model-x86.json": kagent_model_x86,
    "agent-executor-followups-x86.json": agent_executor_followups_x86,
    "agent-executor-x86.json": agent_executor_x86,
    "node-loss-x86.json": node_loss_x86,
    "rotation-x86.json": rotation_x86,
    "cpu-limit-x86.json": cpu_limit_x86,
    "network-x86.json": network_x86,
    "dependency-loss-agw-x86.json": dependency_agw_x86,
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
