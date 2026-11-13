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
GUEST_U = "x86 server guest, 24 vCPU, 47 GB, nested KVM, one kind node, Agent Substrate from the release images, Envoy dataplane, gVisor"
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


BOUND_SERIES = {
    "A2-tok-long": ("maxTokens 128", "word"),
    "A3-time-long": ("timeout 20", "word"),
    "A1-free-long": ("none", "word"),
    "A1-next-turn": ("none", "tool"),
    "B-tok-tool": ("maxTokens 128", "tool"),
    "B-time-tool": ("timeout 20", "tool"),
    "C-free-tool": ("none", "tool"),
    "T-tok-count": ("maxTokens 128", "count"),
    "U-time-count": ("timeout 20", "count"),
    "U2-next-same-session": ("timeout 20", "tool"),
    "F-free-count": ("none", "count"),
    "F-next-turn": ("none", "tool"),
    "F-next-same-session": ("none", "tool"),
}


def bound_turns(rel):
    started = {}
    out = []
    for line in lines(rel):
        start = re.match(r"\S+ (\S+) start agent=(\S+) sid=\S+ timeout=(\S+)", line)
        if start:
            started[start.group(1)] = {"agent": start.group(2), "client_timeout": start.group(3)}
            continue
        end = re.match(r"\S+ (\S+) (?:end )?rc=(\d+) dur=([\d.]+) task=(\S*)", line)
        if not end:
            continue
        tokens = re.search(r"outputTokens=(\d+)", line)
        error = re.search(r"err=(\S.*?)\s*$", line)
        out.append({
            "turn": end.group(1),
            **started.get(end.group(1), {}),
            "exit": int(end.group(2)),
            "wall_seconds": round(float(end.group(3)), 3),
            "task_state": end.group(4) or None,
            "output_tokens": int(tokens.group(1)) if tokens else None,
            "actor_state_at_end": re.search(r"actor=(\S+)", line).group(1),
            "error": re.sub(r"session task \S+", "session task <id>", error.group(1)) if error else None,
        })
    return out


def watch_samples(rel):
    out = []
    for line in lines(rel):
        match = re.match(r"\S+ \+(\d+)s actor=(\S+) ollama_cpu=([\d.]+)%", line)
        if match:
            out.append({"seconds_after_turn": int(match.group(1)), "actor_state": match.group(2), "model_server_cpu_percent": float(match.group(3))})
    return out


def kagent_bound_x86():
    base = "W-ax-kagent-2"
    first, second = f"{base}/10-kagent-bound", f"{base}/12-kagent-bound-long"
    grouped = {}
    for turn in bound_turns(f"{first}/events.log") + bound_turns(f"{second}/events.log"):
        grouped.setdefault(re.sub(r"-\d+$", "", turn["turn"]), []).append(turn)
    series = {}
    for name, turns in grouped.items():
        bound, prompt = BOUND_SERIES[name]
        series[name] = {
            "bound": bound,
            "prompt": prompt,
            "n": len(turns),
            "completed": sum(1 for turn in turns if turn["task_state"] == "TASK_STATE_COMPLETED"),
            "exit_codes": tally([str(turn["exit"]) for turn in turns]),
            "wall_seconds": stat([turn["wall_seconds"] for turn in turns]),
            "runs": turns,
        }
    bounded = read(f"{first}/01-bounded.yaml")
    fields = [re.search(r"FIELD: (\w+)", read(f"{first}/00-explain-{name}.txt")).group(1) for name in ("maxTokens", "maxCompletionTokens", "timeout")]
    requests = model_requests(f"{second}/ollama-gin.log", "/v1/chat/completions")
    longest = max(requests, key=lambda item: item["seconds"])
    answer = re.search(r'"text":"((?:[^"\\]|\\.)*)"', read(f"{second}/T-tok-count-1.json")).group(1)
    failure = re.search(r'llm error response \(code (\w+)\): \\"([^\\]+)\\"', read(f"{second}/U-time-count-1.json"))
    direct = []
    for row in rows(f"{base}/11-long-prompt/results.tsv"):
        direct.append({"prompt": row[0], "curl_exit": int(row[1].split("=")[1]), "seconds": float(row[2].rstrip("s")), "finish": row[3].split("=")[1] or None})
    free = series["F-free-count"]["runs"][0]
    new_session = series["F-next-turn"]["runs"][0]
    same_session = series["F-next-same-session"]["runs"][0]
    return {
        "machine": GUEST_S + ". The guest had been restarted, and two containers of another experiment ran on it.",
        "note": "the model is qwen2.5:1.5b, a small open model on CPU. Each turn is the first turn of a new session unless its name says next. The word prompt asks for one word 5000 times, the count prompt asks for the numbers 1 to 3000, and the tool prompt asks for one bash call. wall_seconds is the time of the kagent client command.",
        "sources": [
            f"capture/lab/{first}/01-bounded.yaml",
            f"capture/lab/{first}/00-explain-maxTokens.txt",
            f"capture/lab/{first}/00-explain-maxCompletionTokens.txt",
            f"capture/lab/{first}/00-explain-timeout.txt",
            f"capture/lab/{first}/events.log",
            f"capture/lab/{base}/11-long-prompt/results.tsv",
            f"capture/lab/{second}/events.log",
            f"capture/lab/{second}/ollama-gin.log",
            f"capture/lab/{second}/T-tok-count-1.json",
            f"capture/lab/{second}/U-time-count-1.json",
            f"capture/lab/{second}/U-time-count-1.after.log",
            f"capture/lab/{second}/F-free-count-1.after.log",
        ],
        "modelconfig_fields": fields,
        "settings": {
            "maxTokens": int(re.search(r"maxTokens: (\d+)", bounded).group(1)),
            "timeout_seconds": int(re.search(r"timeout: (\d+)", bounded).group(1)),
        },
        "prompts": {"word": lines(f"{first}/prompt-long.txt")[0], "count": lines(f"{second}/prompt-count.txt")[0], "tool": lines(f"{second}/prompt-tool.txt")[0]},
        "direct_requests_to_the_model": direct,
        "series": series,
        "max_tokens_answer_ends_with": answer.split("\\n")[-1],
        "timeout_failure": {"code": failure.group(1), "text": failure.group(2), "after_the_turn": watch_samples(f"{second}/U-time-count-1.after.log")},
        "unbounded_turn": {
            "client_timeout": free["client_timeout"],
            "client_seconds": free["wall_seconds"],
            "client_error": free["error"],
            "after_the_client_gave_up": watch_samples(f"{second}/F-free-count-1.after.log"),
            "model_request_seconds": longest["seconds"],
            "model_request_code": longest["code"],
            "ended_by": "restart of the model server container",
            "turn_on_a_new_session_seconds": new_session["wall_seconds"],
            "turn_on_a_new_session_error": new_session["error"],
            "turn_on_the_same_session_seconds": same_session["wall_seconds"],
            "turn_on_the_same_session_error": same_session["error"],
        },
    }


def flight_run(run):
    events = {row[1].split()[0].rstrip(","): stamp(row[0]) for row in rows(f"{run}/21-events.tsv")}
    deleted = events["delete-pod"]
    changes = [(stamp(row[0]), row[1]) for row in rows(f"{run}/19-poll-changes.tsv")]
    crashed = next(when for when, state in changes if state == "ACTOR_STATE_CRASHED")
    ticks = [row for row in rows(f"{run}/20-inflight-stream.tsv") if row[1].startswith("tick")]
    stream = rows(f"{run}/20-inflight-stream.end")[0]
    sleeper = rows(f"{run}/20-inflight-sleep.end")[0]
    taken = step_seconds(f"{run}/steps.tsv")
    describe = read(f"{run}/23-describe-after-loss.log")
    after = read(f"{run}/28-files-after-resume.log")
    return {
        "suspend_to_loss_seconds": round(deleted - events["suspended"], 1),
        "durable_snapshot_at_last_suspend": re.search(r"state: (SNAPSHOT_STORAGE_STATE_\w+)", read(f"{run}/12c-actor-suspended.yaml")).group(1),
        "ticks_received": len(ticks),
        "tick_seconds_from_delete": [round(stamp(row[0]) - deleted, 2) for row in ticks],
        "stream_ended_after_delete_seconds": round(stamp(stream[0]) - deleted, 2),
        "stream_exit": int(stream[2].split("=")[1]),
        "stream_error": lines(f"{run}/20-inflight-stream.err")[0],
        "sleep_request_ended_after_delete_seconds": round(stamp(sleeper[0]) - deleted, 2),
        "sleep_request_error": lines(f"{run}/20-inflight-sleep.out")[0],
        "crashed_seen_after_seconds": round(crashed - deleted, 1),
        "phase_after_loss": re.search(r"Phase: +(\w+)", describe).group(1),
        "message_after_loss": re.search(r"Ready +False +\w+ +(.+)", describe).group(1).strip(),
        "ssh_while_failed": lines(f"{run}/25b-ssh-while-crashed.log")[0],
        "watched_with_no_command_seconds": round(events["ax-resume-1"] - deleted, 1),
        "ax_resume_seconds": taken["26-resume-after-loss"]["seconds"],
        "ax_resume_exit": taken["26-resume-after-loss"]["exit"],
        "file_from_before_last_suspend_kept": "note-saved-by-suspend" in after,
        "file_of_the_command_in_flight_kept": "progress.txt: No such file" not in after,
        "seconds_since_start_of_pid_1": float(lines(f"{run}/28-files-after-resume.log")[-1].split()[0]),
    }


def agent_command(rel):
    log = [json.loads(line) for line in lines(rel) if line.startswith("{")]
    started = next(stamp(item["time"]) for item in log if "started task command" in item["message"])
    ended = next(stamp(item["time"]) for item in log if "task command completed" in item["message"])
    said = [item["message"] for item in log if "span_id" not in item and not item["message"].startswith(("time=", "Claude Code doesn't recognize", "[claude-code:"))]
    return started, ended, said


def mcp_methods(rel, since=""):
    return tally([re.search(r"method=(\S+)", line).group(1) for line in lines(rel) if "method=" in line and line.split()[0] >= since])


def mcp_call_run(run):
    started, ended, said = agent_command(f"{run}/16-actor.log")
    call = next(line.split()[0] for line in lines(f"{run}/20-mcp-server.log") if "method=tools/call" in line)
    return {
        "first_resume_seconds": step_seconds(f"{run}/steps.tsv")["12-resume-first"]["seconds"],
        "methods_seen_by_the_server": mcp_methods(f"{run}/20-mcp-server.log"),
        "tool_call_seconds_after_command_start": round(stamp(call) - started),
        "command_seconds": round(ended - started, 1),
        "model_requests": model_requests(f"{run}/21-ollama-gin.log", "/v1/messages"),
        "final_text_is_the_tool_result": any("lab fact" in text.lower() for text in said),
    }


def agent_executor_second_x86():
    base = "W-ax-kagent-2"
    mcp, example, attempt = f"{base}/30-ax-mcp-skills", f"{base}/40-ax-example", f"{base}/40-ax-example-attempt1"
    clone, image = f"{base}/50-ax-clone-2", f"{base}/51-ax-agent-image-2"
    inside = read(f"{mcp}/18-inside.log")
    skills = [line for line in inside.split("/.agents/skills:")[1].split("==")[0].splitlines() if line.startswith(("d", "-", "l")) and not line.endswith((" .", " .."))]
    declared = next(int(line.split()[3]) for line in lines(f"{mcp}/06b-get-workspace.log") if line.startswith("w-ws "))
    passed = json.loads(next(line for line in lines(f"{mcp}/15-claude-cmdline.txt") if line.startswith("--mcp-config=")).split("=", 1)[1])["mcpServers"]
    first_log = [json.loads(line) for line in lines(f"{mcp}/16-actor.log") if line.startswith("{")]
    skipped = [re.search(r'msg="([^"]+)" name=(\S+)', item["message"]).groups() for item in first_log if "skipping MCP server" in item["message"]]
    first_start, first_end, first_said = agent_command(f"{mcp}/16-actor.log")
    ex_steps = step_seconds(f"{example}/steps.tsv")
    ex_start, ex_end, ex_said = agent_command(f"{example}/20-actor.log")
    resumed = next(stamp(row[0]) for row in rows(f"{example}/18-events.tsv") if row[1] == "resumed")
    report_seen = next(stamp(row[0]) for row in rows(f"{example}/19-poll.tsv") if "HAS-REPORT" in row[2])
    ex_inside = read(f"{example}/22-inside.log")
    git = [line for line in ex_inside.split("== git")[1].split("== tools")[0].splitlines() if line.strip()]
    allowed = re.findall(r'"([a-z.]+\.[a-z]+)"', read(f"{example}/04-egress.yaml").split("tlsPassthrough")[1])
    hosts = tally([next(host for host in allowed if host.startswith(seen)) for seen in re.findall(r'"sni":"([a-z.]+)', read(f"{example}/26b-egress-hosts.log"))])
    cycles = rows(f"{clone}/10-cycles-after-clone.tsv")
    im_start, im_end, im_said = agent_command(f"{image}/19-actor.log")
    return {
        "machine": GUEST_R + ", Ollama 0.40.16 in a container on the guest with 12 CPUs and no GPU. The guest had been restarted, and two containers of another experiment ran on it.",
        "agent_executor_commit": "a72b8ca4",
        "model": "qwen2.5:3b, a small open model on CPU. What the model wrote or decided is a result about this model. What the task received and what the runner did is a result about Agent Executor.",
        "unit": {"seconds": "wall time of the ax command at the client, on the guest that runs the cluster, unless a field says otherwise"},
        "sources": [
            f"capture/lab/{base}/20-ax-flight/w-fl1/21-events.tsv",
            f"capture/lab/{base}/20-ax-flight/w-fl1/20-inflight-stream.tsv",
            f"capture/lab/{base}/20-ax-flight/w-fl1/28-files-after-resume.log",
            f"capture/lab/{base}/20-ax-flight/w-fl2/21-events.tsv",
            f"capture/lab/{base}/20-ax-flight/w-fl2/20-inflight-stream.tsv",
            f"capture/lab/{base}/20-ax-flight/w-fl2/28-files-after-resume.log",
            f"capture/lab/{mcp}/04-workspace.yaml",
            f"capture/lab/{mcp}/06b-get-workspace.log",
            f"capture/lab/{mcp}/15-claude-cmdline.txt",
            f"capture/lab/{mcp}/16-actor.log",
            f"capture/lab/{mcp}/18-inside.log",
            f"capture/lab/{mcp}/20-mcp-server.log",
            f"capture/lab/{base}/31-ax-mcp-call/w-mcp2/20-mcp-server.log",
            f"capture/lab/{base}/31-ax-mcp-call/w-mcp3/20-mcp-server.log",
            f"capture/lab/{example}/steps.tsv",
            f"capture/lab/{example}/08-resume-4gi.log",
            f"capture/lab/{example}/10-apply-1536mi.log",
            f"capture/lab/{example}/20-actor.log",
            f"capture/lab/{example}/22-inside.log",
            f"capture/lab/{example}/24-ollama-gin.log",
            f"capture/lab/{example}/26b-egress-hosts.log",
            f"capture/lab/{attempt}/steps.tsv",
            f"capture/lab/{clone}/steps.tsv",
            f"capture/lab/{clone}/10-cycles-after-clone.tsv",
            f"capture/lab/{image}/steps.tsv",
            f"capture/lab/{image}/19-actor.log",
            f"capture/lab/{image}/21-workspace.log",
        ],
        "worker_loss_in_flight": {
            "note": "two ax ssh commands were open when the worker pod was deleted: one prints a tick each second and writes /workspace/progress.txt, the other is sleep 120. Each run is one task.",
            "snapshot_pending": flight_run(f"{base}/20-ax-flight/w-fl1"),
            "snapshot_durable": flight_run(f"{base}/20-ax-flight/w-fl2"),
        },
        "skills": {"path": re.search(r'path: "([^"]+)"', read(f"{mcp}/04-workspace.yaml").split("skills:")[1]).group(1), "entries_in_the_directory": len(skills)},
        "mcp": {
            "note": "one Workspace with four server entries and one registry. The server named docs is a small HTTP server in the cluster with one tool.",
            "servers_counted_by_ax_get": declared,
            "servers_passed_to_the_agent": {name: entry["type"] for name, entry in sorted(passed.items())},
            "servers_skipped": [{"name": name, "warning": warning} for warning, name in skipped],
            "general_prompt": {
                "first_resume_seconds": step_seconds(f"{mcp}/steps.tsv")["12-resume-first"]["seconds"],
                "methods_seen_by_the_server": mcp_methods(f"{mcp}/20-mcp-server.log", lines(f"{mcp}/09-t0.txt")[0]),
                "command_seconds": round(first_end - first_start, 1),
                "model_requests": model_requests(f"{mcp}/21-ollama-gin.log", "/v1/messages"),
                "final_text": first_said[-1],
                "result_file_written": "mcp-result.txt: No such file" not in inside,
            },
            "prompt_that_names_the_tool": [mcp_call_run(f"{base}/31-ax-mcp-call/{name}") for name in ("w-mcp2", "w-mcp3")],
        },
        "example": {
            "note": "examples/claude-code/task.yaml with the image digest, the model name, and the provider key changed. One run.",
            "resume_with_documented_memory_exit": ex_steps["08-resume-4gi"]["exit"],
            "resume_with_documented_memory_error": re.search(r"code = (ResourceExhausted desc = .+)$", lines(f"{example}/08-resume-4gi.log")[0]).group(1),
            "worker_memory": next(line.split()[5].split("/")[1] for line in lines(f"{example}/05-workers.txt") if " ax-pool " in line),
            "second_apply_exit": ex_steps["10-apply-1536mi"]["exit"],
            "second_apply_error": re.search(r"desc = (.+)$", lines(f"{example}/10-apply-1536mi.log")[-1]).group(1),
            "first_try_resume_after_recreate_exit": step_seconds(f"{attempt}/steps.tsv")["16-resume-fresh"]["exit"],
            "resume_after_recreate_seconds": ex_steps["16-resume-fresh"]["seconds"],
            "passthrough_hosts_in_the_rule": allowed,
            "hosts_in_the_gateway_log": hosts,
            "command_seconds": round(ex_end - ex_start, 1),
            "model_requests": model_requests(f"{example}/24-ollama-gin.log", "/v1/messages"),
            "report_first_seen_seconds_after_resume": round(report_seen - resumed),
            "report_says_all_tests_passed": "all tests passed" in ex_inside,
            "last_message_names_import_errors": any("import errors" in text for text in ex_said),
            "lines_of_git_status_and_diff": len(git) - 1,
            "phase_after_command_ended": re.search(r"Phase: +(\w+)", read(f"{example}/21-describe.log")).group(1),
        },
        "clone_second_run": {
            "first_resume_with_passthrough_rule_seconds": step_seconds(f"{clone}/steps.tsv")["06-resume-first-with-clone"]["seconds"],
            "suspend_seconds": stat([float(row[1]) for row in cycles]),
            "resume_after_clone": {"seconds": stat([float(row[2]) for row in cycles]), "runs": rounded([float(row[2]) for row in cycles])},
            "commits_seen": tally([row[3] for row in cycles]),
        },
        "agent_image_second_run": {
            "first_resume_seconds": step_seconds(f"{image}/steps.tsv")["16-resume"]["seconds"],
            "command_seconds": round(im_end - im_start, 1),
            "model_requests": model_requests(f"{image}/22-ollama-gin.log", "/v1/messages"),
            "final_text": im_said[-1],
            "file_written": "agent-output.txt: No such file" not in read(f"{image}/21-workspace.log"),
            "phase_after_command_ended": re.search(r"Phase: +(\w+)", read(f"{image}/20-describe.log")).group(1),
        },
    }


DRAIN_CASES = [
    ("a", "RUNNING, one request about each second", "10-a-running.tsv", "return-a.tsv"),
    ("b", "SUSPENDED with --mode sync, no request during the drain", "20-b-suspended-sync-quiet.tsv", "return-b.tsv"),
    ("b2", "SUSPENDED with --mode sync, one request about each second from 2 s after the drain", "25-b2-suspended-sync-requests-during-drain.tsv", "return-b2.tsv"),
    ("c", "SUSPENDED in the default mode, newest snapshot still PENDING on the node", "30-c-suspended-async-pending.tsv", "return-c.tsv"),
    ("d", "RUNNING, one request of 120 s in flight", "40-d-mid-request.tsv", "return-d.tsv"),
]
ANSWER_EVENTS = ("probe", "request-1-no-revert", "request-2")


def stamped_rows(rel):
    out = []
    for row in rows(rel)[1:]:
        if len(row) >= 3:
            out.append({"at": stamp(row[0]), "event": row[2], "fields": row[3:], "text": "\t".join(row[3:])})
    return out


def group_by_event(items):
    out = {}
    for item in items:
        out.setdefault(item["event"], []).append(item)
    return out


def answer(item):
    match = re.search(r"(?:^|[ \t])(\d{3})\t([\d.]+)\t([^\t]*)", item["text"])
    if not match:
        return None
    count = re.search(r"count=(\d+)", match.group(3))
    return {"code": match.group(1), "seconds": round(float(match.group(2)), 3), "count": int(count.group(1)) if count else None, "body": match.group(3).strip()[:120], "state": actor_state(item["text"])}


def took(item):
    match = re.search(r"([\d.]+) s", item["text"])
    return float(match.group(1)) if match else None


def short_answer(item):
    reply = answer(item)
    return {key: reply[key] for key in ("code", "seconds", "count")}


def blocked_summary(blocked):
    return {"requests": len(blocked), "codes": tally(entry["code"] for entry in blocked), "seconds": stat([entry["seconds"] for entry in blocked]), "body": blocked[0]["body"], "states": tally(entry["state"] for entry in blocked)}


def resume_error(item):
    return re.search(r"code = (\w+) desc = ([^\t]+)", item["text"]).group(0).strip()


def drain_return(rel):
    items = node_rows(f"T-drain-store/{rel}")
    watches = [item for item in items if item["event"] == "watch"]
    pods = [int(re.search(r"pool-pods-running-on-node=(\d+)", item["text"]).group(1)) for item in watches]
    placed = [re.search(r"placement=(\S+)", item["text"]).group(1) for item in watches]
    after = next(item for item in items if item["event"] == "request-after-uncordon")
    return {
        "source": f"capture/lab/T-drain-store/{rel}",
        "cordoned_seconds": float(re.search(r"after ([\d.]+) s cordoned", items[0]["text"]).group(1)),
        "watched_seconds": watches[-1]["t"],
        "pool_pods_on_node_max": max(pods),
        "new_actors_placed": len(placed),
        "new_actors_on_the_node": sum(1 for node in placed if node.endswith("worker2")),
        "request_after_uncordon": re.search(r"(\d{3})", after["text"]).group(1),
    }


def drain_case(key, title, rel, back):
    items = stamped_rows(f"T-drain-store/{rel}")
    start = next(item["at"] for item in items if item["event"] == "drain-start")
    rel_t = lambda item: round(item["at"] - start, 1)
    first = lambda name: next((item for item in items if item["event"] == name), None)
    before = [answer(item) for item in items if item["at"] < start and item["event"] in ("call", "probe")]
    probes = []
    for item in items:
        if item["at"] > start and item["event"] in ANSWER_EVENTS:
            probes.append({"t": rel_t(item), **answer(item)})
    failed = [probe for probe in probes if probe["code"] != "200"]
    revert = first("revert-1")
    after_revert = [probe for probe in probes if revert and probe["t"] > rel_t(revert) and probe["code"] == "200"]
    served = [probe for probe in probes if probe["code"] == "200"]
    crashed = next((rel_t(item) for item in items if item["at"] > start and actor_state(item["text"]) == "ACTOR_STATE_CRASHED"), None)
    settled = first("pods-settled")
    slow = first("slow-request-returned")
    sent = first("slow-request-sent")
    final = first("final") or items[-1]
    last_before = max(entry["count"] for entry in before if entry and entry["count"])
    out = {
        "case": key,
        "situation": title,
        "source": f"capture/lab/T-drain-store/{rel}",
        "drain_returned_seconds": rel_t(first("drain-returned")),
        "pods_settled_event_t": rel_t(settled),
        "requests_after_drain": len(probes),
        "ok_after_drain": len(served),
        "failed_after_drain": len(failed),
        "first_failure_t": failed[0]["t"] if failed else None,
        "last_failure_t": failed[-1]["t"] if failed else None,
        "failure_bodies": tally(re.sub(r"lab-n/\w+", "lab-n/<actor>", probe["body"])[:70] for probe in failed),
        "actor_crashed_seen_t": crashed,
        "revert": {"t": rel_t(revert), "seconds": took(revert), "first_ok_t": after_revert[0]["t"], "first_ok_seconds": after_revert[0]["seconds"], "seconds_to_first_ok": round(after_revert[0]["t"] - rel_t(revert), 1)} if revert else None,
        "first_ok_t": served[0]["t"] if served else None,
        "first_ok_seconds": served[0]["seconds"] if served else None,
        "count_before_drain": last_before,
        "first_count_after": served[0]["count"] if served else None,
        "calls_lost": last_before - (served[0]["count"] - 1) if served else None,
        "node_at_end": re.search(r"ACTOR_STATE_RUNNING\t(\S+)", final["text"]).group(1) if "ACTOR_STATE_RUNNING\t" in final["text"] else None,
        "probes": [{"t": probe["t"], "code": probe["code"], "seconds": probe["seconds"]} for probe in probes],
        "return": drain_return(back),
    }
    if slow:
        reply = answer(slow)
        out["request_in_flight"] = {"sent_t": rel_t(sent), "returned_t": rel_t(slow), "code": reply["code"], "seconds": reply["seconds"], "body": reply["body"]}
    return out


def node_drain_x86():
    cases = [drain_case(*entry) for entry in DRAIN_CASES]
    return {
        "machine": GUEST_P,
        "note": "one run for each case. t is seconds from the kubectl drain command for the node multi-worker2. Requests go through kubectl ate proxy. The actor holds a counter and 50 MB in memory. In cases a and d the revert was sent by the script after a fixed wait.",
        "command": "kubectl drain multi-worker2 --ignore-daemonsets --delete-emptydir-data --force --timeout=600s",
        "sources": [case["source"] for case in cases] + [case["return"]["source"] for case in cases] + ["capture/lab/T-drain-store/04-pdb-and-grace.txt"],
        "drain_returned_seconds": spread(case["drain_returned_seconds"] for case in cases),
        "running_actors_crashed": sum(1 for case in cases if case["actor_crashed_seen_t"] is not None),
        "suspended_actors_served_with_no_command": sum(1 for case in cases if case["revert"] is None and case["failed_after_drain"] == 0),
        "after_uncordon": {"returns": len(cases), "new_actors_placed": sum(case["return"]["new_actors_placed"] for case in cases), "new_actors_on_the_node": sum(case["return"]["new_actors_on_the_node"] for case in cases), "pool_pods_on_node_max": max(case["return"]["pool_pods_on_node_max"] for case in cases), "watched_seconds": spread(case["return"]["watched_seconds"] for case in cases)},
        "cases": cases,
    }


def full_node_run(key, rel, unblock, after_names):
    by_event = group_by_event(node_rows(f"T-drain-store/{rel}"))
    blocked = [answer(item) for name in ("request-1", "request-2", "request-new-actor-1", "request-new-actor-2") for item in by_event.get(name, [])]
    revert = by_event["revert-after-unavailable"][0]
    done = by_event[unblock][0]
    served = []
    for name in after_names:
        item = by_event[name][0]
        served.append({"event": name, "seconds_after_unblock_command": took(item), **short_answer(item)})
    return {
        "run": key,
        "source": f"capture/lab/T-drain-store/{rel}",
        "workers_unavailable_t": by_event["workers-of-stopped-node-not-active"][0]["t"],
        "revert": {"t": revert["t"], "seconds": took(revert), "ok": "Error" not in revert["text"], "state_after": actor_state(by_event["state"][0]["text"])},
        "blocked_requests": blocked_summary(blocked),
        "resume_command_error": resume_error(by_event["resume-command"][0]),
        "create_from_tag_ok": "Error" not in by_event["create-from-tag"][0]["text"],
        "unblock": {"action": unblock, "t": done["t"], "seconds": took(done)},
        "served_after_unblock": served,
        "count_at_tag": 3,
    }


def full_node_x86():
    stop_runs = [
        full_node_run("free-a-worker", "52-f1b-survivor-full-then-free-a-worker.tsv", "free-a-worker-done", ("request-after-free", "request-new-actor-after-free")),
        full_node_run("scale-the-pool", "62-f2b-survivor-full-then-scale-pool.tsv", "scale-up", ("request-after-scale", "request-new-actor-after-scale")),
    ]
    by_event = group_by_event(stamped_rows("T-drain-store/70-f3-survivor-full-no-revert-request-only.tsv"))
    blocked = [answer(by_event[name][0]) for name in ("request-pool-full-1", "request-pool-full-2")]
    freed = by_event["request-after-free-on-other-node"][0]
    log = lines("T-drain-store/78-control-plane-events.log")
    return {
        "machine": GUEST_P,
        "note": "each run once. One actor with a 1,900 Mi limit fills each worker of 1,984 Mi. In the node-stop runs t is seconds from the docker stop command of the node multi-worker2. The test actor has a tag from before the stop, made at count 3.",
        "sources": [run["source"] for run in stop_runs] + ["capture/lab/T-drain-store/70-f3-survivor-full-no-revert-request-only.tsv", "capture/lab/T-drain-store/78-control-plane-events.log"],
        "node_stopped_other_node_full": stop_runs,
        "both_nodes_up_all_workers_full": {
            "blocked_requests": blocked_summary(blocked),
            "resume_command_error": resume_error(by_event["resume-command"][0]),
            "freed_worker_on_node_without_the_local_snapshot": True,
            "served_after_free": {"seconds_after_free_command": took(freed), **short_answer(freed)},
            "node_after": re.search(r"ACTOR_STATE_RUNNING\t(\S+)", freed["text"]).group(1),
            "log_lines_with_detach_from_full_node": sum(1 for line in log if "DetachFromFullNode" in line),
        },
    }


STORE_VALID_UNTIL = "2026-11-12T16:50:45"


def store_cycles():
    groups = {}
    for row in rows("T-drain-store/90-store-cycles.tsv")[1:]:
        key = (row[1], int(row[2]), int(row[3]))
        entry = groups.setdefault(key, {"suspend": [], "resume": [], "codes": []})
        entry["suspend"].append(float(row[5]))
        entry["resume"].append(float(row[10]))
        entry["codes"].append(row[9])
    out = []
    for (store, rtt, mib), entry in groups.items():
        out.append({"store": store, "added_round_trip_ms": rtt, "mib": mib, "suspend_sync_seconds": {**stat(entry["suspend"]), "runs": rounded(entry["suspend"])}, "resume_from_store_seconds": {**stat(entry["resume"]), "runs": rounded(entry["resume"])}, "codes": tally(entry["codes"])})
    return out


def netem_round_trips():
    out = {}
    label = None
    for line in lines("T-drain-store/83-netem-rtt.txt"):
        head = re.match(r"### netem (\d+) ms", line)
        if head:
            label = head.group(1)
            continue
        connect = re.match(r"connect=([\d.]+)", line)
        if connect and label is not None:
            out.setdefault(label, []).append(float(connect.group(1)) * 1000)
    return {key: {"connect_ms": {**stat(values), "runs": rounded(values)}} for key, values in out.items()}


def store_outage():
    recorded = stamped_rows("T-drain-store/95-store-unreachable.tsv")
    dropped_create = next(item for item in recorded if item["event"] == "blackhole-request-new-actor")
    by_event = group_by_event(item for item in recorded if item["at"] < stamp(STORE_VALID_UNTIL))
    second = node_rows("T-drain-store/97-store-unreachable-recovery.tsv")
    cut = next(i for i, item in enumerate(second) if item["event"] == "refused-prepared")
    later = group_by_event(second[:cut])
    one = lambda table, name, index=0: answer(table[name][index])
    back = [answer(item) for item in by_event["refused-remote-only-after-store-back"]]
    failed_step = re.search(r"step (\w+)", by_event["refused-suspend-sync"][0]["text"])
    sync_timeout = later["blackhole-suspend-sync-running"][0]["text"]
    brief = lambda entry: {k: entry[k] for k in ("code", "seconds", "count", "state")}
    return {
        "refused": {
            "request_to_actor_only_in_store": {**brief(one(by_event, "refused-request-remote-only")), "body": one(by_event, "refused-request-remote-only")["body"]},
            "requests_after_store_back_with_no_command": {"requests": len(back), "codes": tally(entry["code"] for entry in back), "states": tally(entry["state"] for entry in back)},
            "revert_then_request": {"revert_seconds": took(later["leftover-revert-u-remote"][0]), **brief(one(later, "leftover-request-after-revert", 0))},
            "running_actor_request": brief(one(by_event, "refused-running-request")),
            "suspend_sync": {"seconds": took(by_event["refused-suspend-sync"][0]), "failed_at_step": failed_step.group(1) if failed_step else None, "state_after": actor_state(by_event["refused-state-after-suspend-sync"][0]["text"])},
            "request_after_failed_sync": brief(one(by_event, "refused-request-after-failed-sync")),
            "revert_after_failed_sync": {"revert_seconds": took(later["leftover-revert-u-run"][0]), **brief(one(later, "leftover-request-after-revert", 1))},
            "suspend_default": {"seconds": took(by_event["refused-suspend-async"][0]), "state_20s_after": actor_state(by_event["refused-state-20s-after-async"][0]["text"]), "newest_snapshot_pending": "PENDING" in by_event["refused-state-20s-after-async"][0]["text"], "next_request": brief(one(by_event, "refused-request-after-async"))},
            "create_actor": {"seconds": took(by_event["refused-create-actor"][0]), "first_request": brief(one(by_event, "refused-request-new-actor"))},
            "store_away_seconds": float(re.search(r"after ([\d.]+) s", by_event["store-back"][0]["text"]).group(1)),
        },
        "packets_dropped": {
            "request_to_actor_only_in_store": brief(one(later, "blackhole-resume-remote-only")),
            "same_actor_after_store_back_with_no_command": brief(one(later, "blackhole-remote-only-request-no-revert")),
            "calls_before": [int(value) for value in re.findall(r"count=(\d+)", later["blackhole-run-calls"][0]["text"])],
            "suspend_sync": {"seconds": took(later["blackhole-suspend-sync-running"][0]), "error": re.search(r"code = (\w+)", sync_timeout).group(1), "error_names_a_deadline": "code = DeadlineExce" in sync_timeout, "state_after": actor_state(later["blackhole-state-after-failed-suspend"][0]["text"])},
            "request_after_failed_sync": brief(one(later, "blackhole-run-request-no-revert")),
            "revert_after_failed_sync": {"revert_seconds": took(later["blackhole-run-revert"][0]), **brief(one(later, "blackhole-run-request-after-revert"))},
            "create_actor_first_request": brief(answer(dropped_create)),
            "store_away_seconds": float(re.search(r"after ([\d.]+) s", later["store-back"][0]["text"]).group(1)),
        },
    }


def object_store_x86():
    return {
        "machine": GUEST_P,
        "note": "the object store outside the cluster was a rustfs container on the same guest, outside the kind network. The delay was added with tc netem on the guest in one direction, so it is the added round trip. Bandwidth was not limited. atelet ran with --snapshot-upload-delay=3s and --snapshot-detach-delay=10s for these runs only. One cycle is a suspend with --mode sync, a wait for the detach, and one request. The outage cases used actors with no data in memory, each case once.",
        "sources": ["capture/lab/T-drain-store/90-store-cycles.tsv", "capture/lab/T-drain-store/83-netem-rtt.txt", "capture/lab/T-drain-store/82-atelet-args-patched.txt", "capture/lab/T-drain-store/95-store-unreachable.tsv", "capture/lab/T-drain-store/97-store-unreachable-recovery.tsv"],
        "not_recorded": ["200 MiB at 100 ms", "1,000 MiB at 100 ms", "a fifth cycle of 1,000 MiB at 20 ms", "an outage with an actor that holds data"],
        "delay_check": netem_round_trips(),
        "cycles": store_cycles(),
        "store_unreachable": store_outage(),
    }


X = "X-remote-store-pg"
X_TESTS = f"{X}/50-pg-tests"
GUEST_X = "x86 server guest, 16 vCPU, 23 GB, kind v0.33.0, Kubernetes 1.37.0, Agent Substrate v1.0.0 from the release images, Envoy dataplane, gVisor. The bucket and the Postgres ran in containers on a second guest of the same server, reached through loopback forwards of the host"


def remote_path():
    out = []
    entry = None
    for line in lines(f"{X}/13-path.txt"):
        head = re.match(r"### (.+?) (\d{4}-\d\d-\d\dT[\d:.]+Z)", line)
        if head:
            entry = {"phase": head.group(1), "connect_ms": [], "probe_codes": []}
            out.append(entry)
            continue
        probe = re.match(r"from-node connect=([\d.]+) total=[\d.]+ code=(\d+)", line)
        if probe:
            entry["probe_codes"].append(probe.group(2))
            if probe.group(2) != "000":
                entry["connect_ms"].append(float(probe.group(1)) * 1000)
            continue
        copy = re.match(r"aws s3 cp 300 MiB from the guest: upload ([\d.]+) s, download ([\d.]+) s", line)
        if copy:
            entry["copy_300_mib_seconds"] = {"upload": float(copy.group(1)), "download": float(copy.group(2))}
    for entry in out:
        codes = entry.pop("probe_codes")
        entry["connect_ms"] = {**stat(entry["connect_ms"]), "runs": rounded(entry["connect_ms"])} if entry["connect_ms"] else None
        entry["probes_with_no_answer"] = codes.count("000")
    return out


def remote_cycles():
    groups = {}
    for row in rows(f"{X}/22-store-cycles.tsv")[1:]:
        key = (row[1], int(row[2]), int(row[3]), int(row[4]))
        groups.setdefault(key, []).append(row)
    out = []
    for (store, rtt, rate, mib), items in groups.items():
        suspends = [float(row[6]) for row in items]
        first = [float(row[11]) for row in items]
        total = [float(row[13]) for row in items]
        out.append({
            "store": store,
            "added_round_trip_ms": rtt,
            "rate_mbit": rate,
            "mib": mib,
            "suspend_sync_seconds": {**stat(suspends), "runs": rounded(suspends)},
            "first_answer_codes": tally(row[10] for row in items),
            "first_answer_seconds": {**stat(first), "runs": rounded(first)},
            "requests_until_200": tally(row[12] for row in items),
            "seconds_to_first_200": {**stat(total), "runs": rounded(total)},
            "ended_with_200": sum(1 for row in items if row[15].endswith("last=200")),
        })
    return out


def remote_outage(rel):
    by_event = group_by_event(node_rows(f"{X}/{rel}"))
    one = lambda name, index=0: short_answer(by_event[name][index])
    before = [int(value) for value in re.findall(r"count=(\d+)", by_event["run-two-more-calls"][0]["text"])]
    sync = by_event["run-suspend-sync"][0]["text"]
    after_revert = one("run-request-after-revert")
    pending = lambda name: "STATE_PENDING" in by_event[name][0]["text"]
    return {
        "bucket_away_seconds": float(re.search(r"after ([\d.]+) s", by_event["store-back"][0]["text"]).group(1)),
        "actor_with_snapshot_only_in_bucket": {
            "requests_during": [{**short_answer(item), "body": answer(item)["body"][:60]} for item in by_event["rem-request-1"] + by_event["rem-request-2"]],
            "request_after_bucket_back_with_no_command": one("rem-request-no-revert"),
            "revert_seconds": took(by_event["rem-revert"][0]),
            "request_after_revert": one("rem-request-after-revert"),
        },
        "running_actor_suspend_sync": {
            "counts_before": before,
            "seconds": took(by_event["run-suspend-sync"][0]),
            "failed_at_step": re.search(r"step (\w+)", sync).group(1),
            "error_names_a_deadline": "DeadlineExceed" in sync,
            "state_after": actor_state(by_event["run-state-after-suspend-sync"][0]["text"]),
            "request_after": one("run-request-after-suspend-sync"),
            "request_after_bucket_back_with_no_command": one("run-request-no-revert"),
            "revert_seconds": took(by_event["run-revert"][0]),
            "request_after_revert": after_revert,
            "calls_lost": before[-1] - (after_revert["count"] - 1),
        },
        "default_suspend": {
            "seconds": took(by_event["async-suspend-default"][0]),
            "newest_snapshot_pending_20s_later": pending("async-state-after-20s"),
            "resume_from_node": one("async-request-local-resume"),
            "second_suspend_seconds": took(by_event["async-suspend-default-again"][0]),
            "newest_snapshot_pending_after_bucket_back": pending("async-state"),
            "node_copy_present_after_bucket_back": by_event["async-state"][0]["fields"][1] != "-",
            "request_after_bucket_back": one("async-request"),
        },
        "requests_to_a_running_actor": [one("live-request-1"), one("live-request-2")],
        "new_actor": {"create_seconds": took(by_event["new-create"][0]), "first_request": one("new-request")},
        "suspend_sync_after_bucket_back_seconds": took(by_event["live-suspend-sync"][0]),
    }


def remote_store_x86():
    cycles = remote_cycles()
    return {
        "machine": GUEST_X,
        "note": "the bucket was a rustfs container on a second guest. The path between the guests is the user-mode network of the hypervisor, so read the rows with added delay as rows of this path only. atelet ran with --snapshot-upload-delay=3s and --snapshot-detach-delay=10s for these runs only. One cycle is a suspend with --mode sync, a wait for the detach, and one request. A 504 was followed by one more request each second until the first 200, with no revert, so seconds_to_first_200 is an upper bound. The rows with store local repeat the method of experiment T, with the bucket in a container on the same guest. Each outage case ran once, with actors that hold 200 MiB.",
        "sources": [f"capture/lab/{X}/22-store-cycles.tsv", f"capture/lab/{X}/13-path.txt", f"capture/lab/{X}/10-store-run.log", f"capture/lab/{X}/19-tls-store-check.txt", f"capture/lab/{X}/30-outage-stopped.tsv", f"capture/lab/{X}/30-outage-dropped.tsv"],
        "not_used": [f"capture/lab/{X}/20-store-cycles.tsv, a first attempt in which a 504 led to a revert", "the download times of 13-path.txt under the two rate limits, because the client on the guest was not shaped on the way down"],
        "path": remote_path(),
        "cycles": cycles,
        "cycles_total": sum(item["suspend_sync_seconds"]["n"] for item in cycles),
        "cycles_ended_with_200": sum(item["ended_with_200"] for item in cycles),
        "cycles_with_504_first": sum(item["first_answer_codes"].get("504", 0) for item in cycles),
        "tls_check": lines(f"{X}/19-tls-store-check.txt")[1:],
        "bucket_unreachable": {"stopped": remote_outage("30-outage-stopped.tsv"), "packets_dropped": remote_outage("30-outage-dropped.tsv")},
    }


def pg_lifecycle(delay):
    life = read(f"{X_TESTS}/10-lifecycle-delay{delay}.txt")
    grab = lambda pattern: float(re.search(pattern, life).group(1))
    cycles = [row for row in rows(f"{X_TESTS}/11-cycles-delay{delay}.tsv") if len(row) >= 4]
    running = [row for row in rows(f"{X_TESTS}/12-running-requests-delay{delay}.tsv") if len(row) >= 3]
    suspends = [float(row[1]) for row in cycles]
    resumes = [float(row[3]) for row in cycles]
    warm = [float(row[2]) for row in running]
    return {
        "create_seconds": grab(r"create ([\d.]+) s"),
        "first_request_seconds": round(grab(r"first request: 200\t([\d.]+)"), 3),
        "suspend_default_seconds": grab(r"suspend default ([\d.]+) s"),
        "suspend_sync_seconds": {**stat(suspends), "runs": rounded(suspends)},
        "resume_seconds": {**stat(resumes), "runs": rounded(resumes)},
        "cycle_codes": tally(row[2] for row in cycles),
        "running_actor_request_seconds": {**stat(warm), "runs": rounded(warm)},
    }


def pg_round_trips():
    out = {}
    label = None
    for line in lines(f"{X_TESTS}/05-pg-round-trip.txt"):
        head = re.match(r"### added delay (\d+) ms", line)
        if head:
            label = head.group(1)
            continue
        values = [float(value) for value in re.findall(r"Time: ([\d.]+) ms", line)]
        if values and label is not None:
            out[label] = {"query_ms": {**stat(values), "runs": rounded(values)}}
    return out


def pg_outage(suffix):
    at = marks(f"{X_TESTS}/30-timeline{suffix}.tsv")
    stopped, ready, end = at["pg-stop-begin"], at["pg-ready-on-its-guest"], at["end"]
    probes = [probe for probe in stream(f"{X_TESTS}/33-probe{suffix}.tsv") if probe["code"] != "404"]
    summary = {}
    for name in ("running", "suspended"):
        whole = [probe for probe in probes if probe["stream"] == name]
        failed = [probe for probe in whole if probe["code"] != "200"]
        ok_after = [probe for probe in whole if probe["code"] == "200" and probe["at"] > ready]
        summary[name] = {
            "requests_in_run": len(whole),
            "failed_in_run": len(failed),
            "codes_in_run": tally(probe["code"] for probe in whole),
            "first_failure_t": round(failed[0]["at"] - stopped, 1),
            "last_failed_request_sent_seconds_after_ready": round(failed[-1]["at"] - ready, 1),
            "first_ok_seconds_after_ready": round(ok_after[0]["at"] - ready, 1) if ok_after else None,
        }
    return {
        "postgres_away_seconds": round(ready - at["pg-stopped"], 1),
        "stop_command_to_ready_seconds": round(ready - stopped, 1),
        "watched_after_ready_seconds": round(end - ready, 1),
        "summary": summary,
    }


def pg_stuck_actor():
    first = read(f"{X_TESTS}/37-follow-up.txt")
    recovery = read(f"{X_TESTS}/41-x-run-recovery.txt")
    restart = read(f"{X_TESTS}/42-x-run-router-restart.txt")
    coded = lambda pattern, text: [{"code": code, "seconds": round(float(seconds), 3)} for code, seconds in re.findall(pattern, text)]
    x_run = r"request x-run[^:]*: (\d{3})\t([\d.]+)"
    after = re.search(r"request x-run after the router restart: (\d{3})\t([\d.]+)\tcount=(\d+)", restart)
    stuck = coded(x_run, first) + coded(r"request[^:\n]*: (504)\t([\d.]+)", recovery) + coded(x_run, restart)[:1]
    return {
        "requests_while_stuck": {"requests": len(stuck), "codes": tally(item["code"] for item in stuck), "seconds": stat([item["seconds"] for item in stuck])},
        "state_in_the_api": re.search(r"x-run state: .*?(ACTOR_STATE_\w+)", first).group(1),
        "other_running_actors": coded(r"request to a running [\w-]+: (\d{3})\t([\d.]+)", first),
        "router_access_log_duration_ms": [int(value) for value in re.findall(r'"POST / HTTP/2" 504 - 0 0 (\d+) ', first)],
        "resume_command_seconds": float(re.search(r"resume command: ([\d.]+) s", recovery).group(1)),
        "suspend_sync_command_seconds": float(re.search(r"suspend command: ([\d.]+) s", recovery).group(1)),
        "seconds_after_ready_at_router_check": int(re.search(r"router check, (\d+) s after", restart).group(1)),
        "router_restart_seconds": float(re.search(r"restart took ([\d.]+) s", restart).group(1)),
        "request_after_router_restart": {"code": after.group(1), "seconds": round(float(after.group(2)), 3), "count": int(after.group(3))},
        "run_2_requests_after_outage": coded(r"request y-run: (\d{3})\t([\d.]+)", read(f"{X_TESTS}/43-run2-follow-up.txt")),
    }


def pg_worker_cache():
    log = lines(f"{X_TESTS}/47-worker-cache-lines.txt")
    times = lambda needle: [stamp(re.search(r'"time":"([^"]+)"', line).group(1)) for line in log if needle in line]
    closed = times("watch channel closed")[0]
    tries = times('"msg":"worker cache resync failed"')
    synced = times('"msg":"worker cache synced"')[0]
    ready = marks(f"{X_TESTS}/30-timeline-run2.tsv")["pg-ready-on-its-guest"]
    return {
        "failed_tries_seconds_after_the_watch_closed": [round(value - closed, 1) for value in tries],
        "seconds_between_failed_tries": [round(later - earlier, 1) for earlier, later in zip(tries, tries[1:])],
        "synced_seconds_after_last_failed_try": round(synced - tries[-1], 1),
        "synced_seconds_after_ready": round(synced - ready, 1),
    }


def remote_postgres_x86():
    base = f"{X}/40-pg-install"
    objects = read(f"{base}/51-ate-system-objects.txt")
    steps = {row[0]: int(row[2]) for row in rows(f"{base}/steps.tsv") if len(row) == 3}
    return {
        "machine": GUEST_X,
        "note": "one install on a new kind cluster with one node, with Postgres 18 in a container on the second guest over TLS and password logins. Bucket cycles of the other part ran on the same guest during the install. The delay was added with tc netem toward Postgres only. Each outage is one run. In an outage, t is seconds from the docker stop command for the Postgres container, and the ready mark was taken on the guest of the database.",
        "sources": [f"capture/lab/{base}/steps.tsv", f"capture/lab/{base}/30-pg-setup.log", f"capture/lab/{base}/39-deploy-diff.txt", f"capture/lab/{base}/51-ate-system-objects.txt", f"capture/lab/{base}/10-pg-reach.txt", f"capture/lab/{X_TESTS}/05-pg-round-trip.txt", f"capture/lab/{X_TESTS}/10-lifecycle-delay0.txt", f"capture/lab/{X_TESTS}/11-cycles-delay0.tsv", f"capture/lab/{X_TESTS}/11-cycles-delay20.tsv", f"capture/lab/{X_TESTS}/30-timeline.tsv", f"capture/lab/{X_TESTS}/33-probe.tsv", f"capture/lab/{X_TESTS}/33-probe-run2.tsv", f"capture/lab/{X_TESTS}/37-follow-up.txt", f"capture/lab/{X_TESTS}/41-x-run-recovery.txt", f"capture/lab/{X_TESTS}/42-x-run-router-restart.txt", f"capture/lab/{X_TESTS}/47-worker-cache-lines.txt"],
        "install": {
            "deploy_seconds": steps["40-deploy-ate-system"],
            "setup_sql_with_single_transaction_exit": int(re.search(r"rc=(\d+)", read(f"{base}/30-pg-setup.log")).group(1)),
            "tls_versions": tally(re.findall(r"TLSv[\d.]+", read(f"{base}/10-pg-reach.txt"))),
            "postgres_statefulset_deployed": "statefulset.apps/postgres" in objects,
            "postgres_networkpolicy_deployed": "networkpolicy.networking.k8s.io/postgres" in objects,
        },
        "round_trip": pg_round_trips(),
        "lifecycle": {"0": pg_lifecycle(0), "20": pg_lifecycle(20)},
        "outages": {"run_1": pg_outage(""), "run_2": pg_outage("-run2")},
        "stuck_actor_run_1": pg_stuck_actor(),
        "worker_cache_run_2": pg_worker_cache(),
    }


U = "U-pg-upgrade-scale"


def marks(rel):
    out = {}
    for row in rows(rel):
        if len(row) >= 3:
            out.setdefault(row[2], float(row[0]))
    return out


def stream(rel):
    out = []
    for row in rows(rel):
        if len(row) >= 5 and row[0].isdigit():
            out.append({"at": int(row[0]), "stream": row[1], "code": row[3], "seconds": round(float(row[4]), 3), "body": row[5][:90] if len(row) > 5 else ""})
    return out


def attempts(rel):
    out = [[]]
    for line in lines(rel):
        if line.startswith("--- attempt"):
            out.append([])
        elif "\t" in line:
            name, code, seconds = line.split("\t")
            out[-1].append({"step": name, "exit": int(code), "seconds": int(seconds)})
    return out


def external_postgres_x86():
    base = f"{U}/10-extpg-install"
    tests = f"{U}/20-extpg-tests"
    tries = attempts(f"{base}/steps.tsv")
    objects = read(f"{base}/41-ate-system-objects.txt")
    connections = [line for line in lines(f"{base}/43-pg-connections-and-tables.txt") if "TLSv" in line]
    life = read(f"{tests}/10-lifecycle.txt")
    grab = lambda pattern: float(re.search(pattern, life).group(1))
    resumes = re.findall(r"resume request: 200\t([\d.]+)", life)
    cycles = [row for row in rows(f"{tests}/11-cycles.tsv") if len(row) >= 4]
    suspends = [float(row[1]) for row in cycles]
    resume_runs = [float(row[3]) for row in cycles]
    at = marks(f"{tests}/30-timeline.tsv")
    stopped, ready, end = at["pg-stop-begin"], at["pg-ready"], at["end"]
    ready_t = ready - stopped
    all_probes = stream(f"{tests}/33-probe.tsv")
    streams = {}
    for probe in all_probes:
        if probe["at"] >= stopped - 10:
            streams.setdefault(probe["stream"], []).append({"t": round(probe["at"] - stopped, 1), "code": probe["code"], "seconds": probe["seconds"]})
    summary = {}
    for name, items in streams.items():
        failed = [item for item in items if item["code"] != "200"]
        ok_after = [item for item in items if item["code"] == "200" and item["t"] > ready_t]
        whole = [probe for probe in all_probes if probe["stream"] == name]
        summary[name] = {
            "requests_in_run": len(whole),
            "failed_in_run": sum(1 for probe in whole if probe["code"] != "200"),
            "codes_in_run": tally(probe["code"] for probe in whole),
            "first_failure_t": failed[0]["t"] if failed else None,
            "last_failure_t": failed[-1]["t"] if failed else None,
            "last_failure_seconds_after_ready": round(max(item["t"] + item["seconds"] for item in failed) - ready_t, 1) if failed else None,
            "last_failed_request_sent_seconds_after_ready": round(failed[-1]["t"] - ready_t, 1) if failed else None,
            "first_ok_seconds_after_ready": round(ok_after[0]["t"] - ready_t, 1),
            "failure_bodies": tally(re.sub(r"u-lab/[\w-]+", "u-lab/<actor>", probe["body"])[:60] for probe in whole if probe["code"] != "200"),
        }
    log = lines(f"{tests}/34-api-server-log.excerpt.txt")
    synced = next(json.loads(line)["time"] for line in log if "worker cache synced" in line)
    return {
        "machine": GUEST_U,
        "note": "one install and one outage. Postgres 18 ran as a container on the guest, outside the kind network, with TLS and password logins. Another install ran on the guest during the ten cycles. In the outage, t is seconds from the docker stop command for the Postgres container.",
        "sources": [f"capture/lab/{base}/steps.tsv", f"capture/lab/{base}/20-pg-setup-attempt2-no-transaction.log", f"capture/lab/{base}/20-pg-setup.log", f"capture/lab/{base}/29-deploy-diff.txt", f"capture/lab/{base}/41-ate-system-objects.txt", f"capture/lab/{base}/43-pg-connections-and-tables.txt", f"capture/lab/{tests}/10-lifecycle.txt", f"capture/lab/{tests}/11-cycles.tsv", f"capture/lab/{tests}/30-timeline.tsv", f"capture/lab/{tests}/33-probe.tsv", f"capture/lab/{tests}/34-api-server-log.excerpt.txt"],
        "install": {
            "deploy_attempts": [attempt[-1] for attempt in tries],
            "setup_sql_without_transaction_error": next(line for line in lines(f"{base}/20-pg-setup-attempt2-no-transaction.log") if line.startswith("ERROR")),
            "setup_sql_with_single_transaction_exit": int(re.search(r"setup.sql rc=(\d+)", read(f"{base}/20-pg-setup.log")).group(1)),
            "tls_connections": len(connections),
            "tls_versions": tally(re.search(r"TLSv[\d.]+", line).group(0) for line in connections),
            "postgres_statefulset_deployed": "statefulset.apps/postgres" in objects,
            "postgres_networkpolicy_deployed": "networkpolicy.networking.k8s.io/postgres" in objects,
            "install_record_holds_connection_string": "postgresql://" in read(f"{base}/45-install-record.yaml"),
        },
        "lifecycle": {
            "create_seconds": grab(r"create ([\d.]+) s"),
            "first_request_seconds": round(grab(r"first request: 200\t([\d.]+)"), 3),
            "suspend_sync_seconds": grab(r"suspend sync ([\d.]+) s"),
            "resume_after_sync_seconds": round(float(resumes[0]), 3),
            "suspend_default_seconds": grab(r"suspend default ([\d.]+) s"),
            "resume_after_default_seconds": round(float(resumes[1]), 3),
            "counts": [int(value) for value in re.findall(r"count=(\d+)", life)],
        },
        "cycles": {
            "suspend_sync_seconds": {**stat(suspends), "runs": rounded(suspends)},
            "resume_seconds": {**stat(resume_runs), "runs": rounded(resume_runs)},
            "codes": tally(row[2] for row in cycles),
        },
        "outage": {
            "postgres_away_seconds": round(ready - at["pg-stopped"], 1),
            "stop_command_to_ready_seconds": round(ready - stopped, 1),
            "watched_after_ready_seconds": round(end - ready, 1),
            "summary": summary,
            "worker_cache_synced_seconds_after_ready": round(stamp(synced) - ready, 1),
            "log_lines_with_worker_cache_not_ready": sum(1 for line in log if "worker cache not ready" in line),
            "per_second": streams,
        },
    }


def upgrade_x86():
    old = f"{U}/30-upgrade-v0.6.0/00-install-v0.6.0"
    base = f"{U}/30-upgrade-v1.0.0-rc.3"
    up = f"{base}/20-upgrade"
    roll = f"{base}/40-worker-roll-on-v1.0.0"
    timeline = [row for row in rows(f"{up}/00-timeline-steps.tsv") if len(row) >= 3]
    zero = float(timeline[0][0])
    steps = []
    begun = {}
    for at, _, text in timeline:
        name = text.split(" ")[0]
        if text.endswith(" begin"):
            begun[name] = float(at)
        ended = re.search(r"end rc=(\d+) seconds=([\d.]+)", text)
        if ended and name in begun:
            steps.append({"step": name, "begin_t": round(begun[name] - zero, 1), "end_t": round(float(at) - zero, 1), "seconds": float(ended.group(2)), "exit": int(ended.group(1))})
    patch = next(float(at) for at, _, text in timeline if text.startswith("23-step3-patch begin"))
    new_image = next(float(at) for at, _, text in timeline if "has-new-image" in text)
    steps.append({"step": "23-step3-workerpool-image-patch", "begin_t": round(patch - zero, 1), "end_t": round(new_image - zero, 1), "seconds": round(new_image - patch, 1), "exit": 0})
    steps.sort(key=lambda step: step["begin_t"])
    cycles = []
    for row in rows(f"{up}/02-cycle-stream.tsv"):
        code = re.search(r"resume: (\d{3})", row[3]).group(1)
        suspend_error = next((name for name in ("Checkpoint", "atelet conn") if name in row[2]), None)
        cycles.append({"t": round(int(row[0]) - zero, 1), "ok": code == "200" and "Error" not in row[2], "suspend_error": suspend_error})
    bad = [cycle for cycle in cycles if not cycle["ok"]]
    next_ok = next(cycle["t"] for cycle in cycles if cycle["ok"] and cycle["t"] > bad[-1]["t"])
    api = [row for row in rows(f"{up}/03-api-stream.tsv") if len(row) >= 3]
    running = stream(f"{up}/05-running-stream.tsv")
    watch = [row for row in rows(f"{up}/23d-roll-watch.tsv") if row[0].isdigit()]
    crashed = next(int(row[0]) for row in watch if row[1] == "ACTOR_STATE_CRASHED")
    after = {}
    for line in lines(f"{base}/30-after/10-actors-after.txt"):
        found = re.match(r"(a-[\w-]+)\s+\((.+?)\): (\d{3})\t([\d.]+)\t(.*)", line)
        if found and found.group(1) not in after:
            count = re.search(r"count=(\d+)", found.group(5))
            after[found.group(1)] = {"before": found.group(2), "code": found.group(3), "seconds": round(float(found.group(4)), 3), "count": int(count.group(1)) if count else None}
    revert = read(f"{roll}/01-revert-a-run.txt")
    sig = [row for row in rows(f"{roll}/10-watch.tsv")[1:] if row[0].isdigit()]
    plain_crashed = next(int(row[0]) for row in sig if row[1] == "ACTOR_STATE_CRASHED")
    trap = [(int(row[0]), row[5], row[6]) for row in sig]
    marks_roll = [row for row in rows(f"{roll}/00-timeline.tsv") if len(row) >= 3]
    trap_after = read(f"{roll}/14-after.txt")
    deploy_old = read(f"{old}/20-deploy-ate-system.log")
    return {
        "machine": GUEST_U,
        "note": "one upgrade, from v1.0.0-rc.3 to v1.0.0, by the steps of the upgrade guide. t is seconds from the start of step 1. A stream suspended and resumed one actor about each 3.5 s, a second stream listed actors each 2 s, and a third sent one request each second to a RUNNING actor. The worker pool had 8 pods on one node.",
        "sources": [f"capture/lab/{up}/00-timeline-steps.tsv", f"capture/lab/{up}/02-cycle-stream.tsv", f"capture/lab/{up}/03-api-stream.tsv", f"capture/lab/{up}/05-running-stream.tsv", f"capture/lab/{up}/23d-roll-watch.tsv", f"capture/lab/{base}/30-after/10-actors-after.txt", f"capture/lab/{roll}/01-revert-a-run.txt", f"capture/lab/{roll}/10-watch.tsv", f"capture/lab/{roll}/14-after.txt", f"capture/lab/{old}/51-ghcr-release-tags.txt", f"capture/lab/{old}/20-deploy-ate-system.log"],
        "release_tags_in_registry": json.loads(lines(f"{old}/51-ghcr-release-tags.txt")[0].split(": ", 1)[1]),
        "install_of_v0_6_0_from_release_images": {"exit": attempts(f"{old}/steps.tsv")[0][-1]["exit"], "error_is_404": "v0.6.0: unexpected status code 404" in deploy_old},
        "steps": steps,
        "first_step_begin_to_last_step_end_seconds": round(max(step["end_t"] for step in steps), 1),
        "suspend_resume_stream": {
            "cycles": len(cycles),
            "ok": len(cycles) - len(bad),
            "failed": len(bad),
            "first_failure_t": bad[0]["t"],
            "last_failure_t": bad[-1]["t"],
            "next_ok_t": next_ok,
            "failed_window_seconds": round(next_ok - bad[0]["t"], 1),
            "suspend_errors": tally(cycle["suspend_error"] or "none" for cycle in bad),
            "per_cycle": [{"t": cycle["t"], "ok": cycle["ok"]} for cycle in cycles],
        },
        "list_actors_stream": {"calls": len(api), "answered": sum(1 for row in api if "actors listed" in row[2])},
        "running_actor": {
            "crashed_seen_seconds_after_pool_patch": round(crashed - patch, 1),
            "requests": len(running),
            "codes": tally(item["code"] for item in running),
            "first_failure_t": round(next(item["at"] for item in running if item["code"] != "200") - zero, 1),
            "revert_seconds": float(re.search(r"revert ([\d.]+) s", revert).group(1)),
            "count_after_revert": int(re.search(r"count=(\d+)", revert).group(1)),
            "per_second": [{"t": round(item["at"] - zero, 1), "code": item["code"]} for item in running],
        },
        "actors_after_upgrade": after,
        "schema_migrations_unchanged": lines(f"{base}/10-before/15-schema-migrations-before.txt")[:2] == lines(f"{up}/33-schema-migrations-after.txt")[:2],
        "substrate_images_after": tally(re.search(r":(v[\w.-]+)@", line).group(1) for line in lines(f"{up}/30-images-after.txt") if "agent-substrate/substrate/" in line and re.search(r":(v[\w.-]+)@", line)),
        "worker_roll_on_v1_0_0": {
            "actor_without_sigterm_handler_crashed_seen_t": plain_crashed,
            "actor_with_sigterm_handler": {
                "samples": len(trap),
                "running_samples": sum(1 for _, state, _ in trap if state == "ACTOR_STATE_RUNNING"),
                "ok_requests": sum(1 for _, _, code in trap if code == "200"),
                "watched_seconds": trap[-1][0],
                "suspend_sync_seconds": float(re.search(r"after ([\d.]+) s", marks_roll[2][2]).group(1)),
                "request_after_roll": {"code": re.search(r"t-trap after the roll: (\d{3})", trap_after).group(1), "count": int(re.search(r"t-trap after the roll: .*count=(\d+)", trap_after).group(1))},
            },
        },
    }


Y = "Y-reruns-rollback-scale"
Y_OUT = f"{Y}/10-outages"
Y_UP = f"{Y}/20-upgrade"
Y_OLD = f"{Y}/40-v060"
GUEST_Y = GUEST_U + ", bundled Postgres"


def first_marks(rel):
    out = {}
    for row in rows(rel):
        if len(row) >= 3:
            out.setdefault(row[2].split(" ")[0], float(row[0]))
    return out


def mark_value(rel, name, key):
    for row in rows(rel):
        if len(row) >= 3 and row[2].startswith(name):
            found = re.search(rf"{key}=([\w.]+)", row[2])
            if found:
                return found.group(1)
    return None


def outage_stream(items, gone, ready):
    failed = [item for item in items if item[1] != "200"]
    during = [item for item in items if gone <= item[0] < ready]
    ok_after = [item for item in items if item[1] == "200" and item[0] >= ready]
    slow = [item[2] for item in failed if item[1] == "503"]
    return {
        "requests_in_run": len(items),
        "failed_in_run": len(failed),
        "codes_of_failures": tally(item[1] for item in failed),
        "requests_during_outage": len(during),
        "ok_during_outage": sum(1 for item in during if item[1] == "200"),
        "last_failure_sent_seconds_after_ready": round(failed[-1][0] - ready, 1) if failed else None,
        "first_ok_sent_seconds_after_ready": round(ok_after[0][0] - ready, 1) if ok_after else None,
        "seconds_of_503": stat(slow) if slow else None,
        "failure_bodies": tally(re.sub(r"y-lab/[\w-]+", "y-lab/<actor>", item[3])[:60] or "<empty>" for item in failed),
    }


def state_counts(rel):
    return {parts[1]: int(parts[0]) for parts in (line.split() for line in lines(rel)) if len(parts) == 2}


def outage_run(folder, postgres):
    base = f"{Y_OUT}/{folder}"
    at = first_marks(f"{base}/00-timeline.tsv")
    begin, gone, ready = at["outage-begin"], at["dependency-gone"], at["dependency-ready"]
    probes = [row for row in rows(f"{base}/10-probe.tsv") if len(row) >= 5 and row[0].isdigit()]
    streams = {}
    for name in ("running", "running2", "suspended"):
        items = [(int(row[0]), row[3], float(row[4]), row[5] if len(row) > 5 else "") for row in probes if row[1] == name]
        streams[name] = outage_stream(items, gone, ready)
    gateway_timeouts = [{"stream": row[1], "actor": row[2], "seconds": round(float(row[4]), 3)} for row in probes if row[3] == "504"]
    checks = [line.split() for line in lines(f"{base}/11-running-after.txt") if line.strip()]
    cache = [json.loads(line) for line in lines(f"{base}/14-ateapi-worker-cache.log") if line.startswith("{")]
    synced = [stamp(item["time"]) - ready for item in cache if item["msg"] == "worker cache synced" and stamp(item["time"]) > gone]
    return {
        "command_to_gone_seconds": round(gone - begin, 1),
        "outage_seconds": round(ready - gone, 1),
        "streams": streams,
        "gateway_timeouts": gateway_timeouts,
        "running_actors_checked_after": {"actors": len({parts[1] for parts in checks}), "requests": len(checks), "ok": sum(1 for parts in checks if parts[3] == "200")},
        "stuck_line": lines(f"{base}/12-stuck.txt")[0],
        "states_before": state_counts(f"{base}/01-states-before.txt"),
        "states_after": state_counts(f"{base}/17-states-after.txt"),
        "worker_cache_synced_seconds_after_ready": round(synced[0], 1) if postgres and synced else None,
        "log_lines_with_worker_cache_not_ready": sum(1 for item in cache if "worker cache not ready" in json.dumps(item)),
    }


def dependency_reruns_x86():
    folders = {"postgres-1": "10-pg-run1", "postgres-2": "11-pg-run2", "postgres-3": "12-pg-run3", "ate-api-server-1": "20-api-run1", "kube-apiserver-1": "30-k8s-run1"}
    files = ("00-timeline.tsv", "10-probe.tsv", "11-running-after.txt", "12-stuck.txt", "14-ateapi-worker-cache.log", "01-states-before.txt", "17-states-after.txt")
    return {
        "machine": GUEST_Y + ", pool of 60 workers, template with 500 millicores and 128 MiB",
        "note": "second runs of the three outages of experiment E, in this order on one cluster. Three running actors got one request each second with a client limit of 9 s (stream running is one actor, running2 the other two). A new suspended actor got one request every 5 s with a limit of 14 s. Outage seconds run from the moment the dependency was gone to the moment it was ready. A failure in the run counts the whole window, from 30 s before the outage to 120 s after it. After each run six running actors got three requests each. In kube-apiserver-1 the suspended stream is not valid: the pool was full of running actors from the earlier runs.",
        "sources": [f"capture/lab/{Y_OUT}/{folder}/{name}" for folder in folders.values() for name in files],
        "runs": {key: outage_run(folder, key.startswith("postgres")) for key, folder in folders.items()},
        "client_limit_seconds": {"running": 9, "running2": 9, "suspended": 14},
        "not_valid": ["kube-apiserver-1 stream suspended: every failure is no worker has room for the actor"],
    }


def cycle_windows(cycles):
    windows = []
    for index, cycle in enumerate(cycles):
        if cycle["ok"]:
            continue
        if windows and windows[-1]["last_index"] == index - 1:
            window = windows[-1]
        else:
            window = {"first_t": cycle["t"], "cycles": 0, "errors": [], "last_index": index}
            windows.append(window)
        window["cycles"] += 1
        window["last_t"] = cycle["t"]
        window["last_index"] = index
        window["errors"].append(cycle["error"])
    out = []
    for window in windows:
        later = [cycle["t"] for cycle in cycles[window["last_index"] + 1:] if cycle["ok"]]
        out.append({"first_t": window["first_t"], "last_t": window["last_t"], "cycles": window["cycles"], "next_ok_t": later[0] if later else None, "errors": tally(window["errors"])})
    return out


def cycle_error(text):
    for key in ("while getting atelet conn", "atelet Checkpoint", "CheckpointWorkload", "MarkSuspending prerequisite"):
        if key in text:
            return key
    return "other"


def upgrade_direction(folder):
    base = f"{Y_UP}/{folder}"
    timeline = [row for row in rows(f"{base}/00-timeline.tsv") if len(row) >= 3]
    zero = float(timeline[1][0])
    steps = []
    begun = {}
    for at, _, text in timeline:
        name = text.split(" ")[0]
        if text.endswith(" begin") or text.startswith("pool-patch begin"):
            begun[name] = float(at)
        ended = re.search(r"end rc=(\d+) seconds=([\d.]+)", text)
        if ended and name in begun:
            steps.append({"step": name, "begin_t": round(begun[name] - zero, 1), "seconds": float(ended.group(2)), "exit": int(ended.group(1))})
    at = first_marks(f"{base}/00-timeline.tsv")
    patch = at["pool-patch"]
    cycles = []
    for row in rows(f"{base}/02-cycle-stream.tsv"):
        code = re.search(r"resume: (\d{3})", row[3]).group(1) if len(row) > 3 else "?"
        ok = code == "200" and "Error" not in row[2]
        count = re.search(r"count=(\d+)", row[-1])
        cycles.append({"epoch": int(row[0]), "t": round(int(row[0]) - zero, 1), "ok": ok, "error": None if ok else cycle_error(row[2]), "count": int(count.group(1)) if ok and count else None})
    api = lines(f"{base}/03-api-stream.tsv")
    running = [row for row in rows(f"{base}/05-running-stream.tsv") if len(row) >= 5]
    actors = {}
    for name in ("a-run", "a-term"):
        items = [row for row in running if row[2] == name]
        failed = [row for row in items if row[3] != "200"]
        actors[name] = {
            "requests": len(items),
            "failed": len(failed),
            "codes": tally(row[3] for row in failed),
            "first_failure_seconds_after_pool_patch": round(int(failed[0][0]) - patch, 1) if failed else None,
            "per_second": [{"t": round(int(row[0]) - zero, 1), "code": row[3]} for row in items],
        }
    watch = [row for row in rows(f"{base}/23d-roll-watch.tsv") if row[0].replace(".", "").isdigit()]
    crashed = [float(row[0]) - patch for row in watch if row[1] == "ACTOR_STATE_CRASHED"]
    before_crash = [float(row[0]) - patch for row in watch if row[1] != "ACTOR_STATE_CRASHED" and float(row[0]) - patch < crashed[0]]
    roll = read(f"{base}/23i-after-roll.txt")
    after = []
    seen = set()
    for line in lines(f"{base}/40-actors-after.txt"):
        found = re.match(r"(a-[\w-]+) (.*?): (\d{3})\t([\d.]+)\t(.*)", line)
        if found and (found.group(1), found.group(2)) not in seen:
            seen.add((found.group(1), found.group(2)))
            count = re.search(r"count=(\d+)", found.group(5))
            after.append({"actor": found.group(1), "label": found.group(2), "code": found.group(3), "count": int(count.group(1)) if count else None})
    return {
        "steps": steps,
        "pool_patch_t": round(patch - zero, 1),
        "first_step_begin_to_last_step_end_seconds": round(max(float(row[0]) for row in timeline if "end rc=" in row[2]) - zero, 1),
        "cycles": {"total": len(cycles), "failed": sum(1 for cycle in cycles if not cycle["ok"]), "windows": cycle_windows(cycles), "per_cycle": [{"t": cycle["t"], "ok": cycle["ok"]} for cycle in cycles]},
        "list_actors_stream": {"calls": len(api), "answered": sum(1 for line in api if "actors listed" in line)},
        "running_actors": actors,
        "actor_without_handler": {
            "crashed_first_seen_seconds_after_pool_patch": round(crashed[0], 1),
            "last_running_sample_seconds_after_pool_patch": round(before_crash[-1], 1),
            "revert_seconds": float(mark_value(f"{base}/00-timeline.tsv", "a-run-reverted", "seconds")),
            "count_after_revert": int(re.search(r"a-run after revert: 200\t[\d.]+\tcount=(\d+)", roll).group(1)),
        },
        "actor_with_handler": {
            "suspend_seconds": float(mark_value(f"{base}/00-timeline.tsv", "a-term-suspended", "seconds")),
            "after_roll": {"code": re.search(r"a-term after the roll: (\d{3})", roll).group(1), "count": int(re.search(r"a-term after the roll: .*?count=(\d+)", roll).group(1)), "sigterm_seen": int(re.search(r"sigterm_seen=(\d+)", roll).group(1))},
        },
        "actors_after": after,
        "schema_rows_after": len(lines(f"{base}/33-schema-migrations-after.txt")),
        "substrate_image_tags_after": tally(found.group(1) for found in (re.search(r"substrate/[\w-]+:(v[\w.-]+?)(?:@|\s|$)", line) for line in lines(f"{base}/30-images-after.txt")) if found),
        "_cycles": cycles,
    }


def upgrade_rerun_x86():
    up = upgrade_direction("20-upgrade")
    back = upgrade_direction("40-rollback")
    cyc_crash = next(cycle for cycle in up.pop("_cycles") if cycle["t"] > up["pool_patch_t"] and not cycle["ok"])
    back_cycles = back.pop("_cycles")
    revert_epoch = int(lines(f"{Y_UP}/40-rollback/00-manual-revert-a-cyc.txt")[0].split()[0])
    count_after = next(cycle["count"] for cycle in back_cycles if cycle["ok"] and cycle["epoch"] > revert_epoch)
    before_rows = lines(f"{Y_UP}/10-before/15-schema-migrations-before.txt")
    return {
        "machine": GUEST_Y + ", pool of 10 workers",
        "note": "a second upgrade from v1.0.0-rc.3 to v1.0.0 by the steps of the upgrade guide, then a rollback to v1.0.0-rc.3 in the reverse order, each once. t is seconds from the start of the first step of each direction. A stream suspended and resumed one actor, a-cyc, about each 3.5 s. A second stream listed actors each 2 s. A third sent one request each second to two RUNNING actors: a-run exits on SIGTERM, and a-term handles it. In the worker step the script waited for the old worker of a-term, then suspended a-term, then reverted a-run.",
        "sources": [f"capture/lab/{Y_UP}/{folder}/{name}" for folder in ("20-upgrade", "40-rollback") for name in ("00-timeline.tsv", "02-cycle-stream.tsv", "03-api-stream.tsv", "05-running-stream.tsv", "23d-roll-watch.tsv", "23i-after-roll.txt", "30-images-after.txt", "33-schema-migrations-after.txt", "40-actors-after.txt")] + [f"capture/lab/{Y_UP}/10-before/15-schema-migrations-before.txt", f"capture/lab/{Y_UP}/40-rollback/00-manual-revert-a-cyc.txt"],
        "schema_rows_before": len(before_rows),
        "upgrade": up,
        "rollback": back,
        "cycling_actor": {
            "crashed_in_upgrade_t": cyc_crash["t"],
            "crashed_seconds_after_pool_patch": round(cyc_crash["t"] - up["pool_patch_t"], 1),
            "error_of_first_failure": cyc_crash["error"],
            "manual_revert_seconds_after_crash": revert_epoch - cyc_crash["epoch"],
            "count_after_manual_revert": count_after,
        },
    }


def error_line(rel):
    return next(line for line in lines(rel) if line.startswith("Error:"))


def v060_x86():
    install = f"{Y_OLD}/00-install"
    before = f"{Y_OLD}/10-before"
    direct = f"{Y_OLD}/20-direct-upgrade"
    again = f"{Y_OLD}/30-reinstall"
    ax = f"{Y_OLD}/40-ax031"
    at = {row[2].split(" ")[0]: row[2] for row in rows(f"{Y_OLD}/00-timeline.tsv") if len(row) >= 3}
    ended = lambda name: {key: int(value) for key, value in re.findall(r"(rc|seconds)=(\d+)", at[name])}
    crd_error = lambda rel: re.search(r"CustomResourceDefinition[^;]*", error_line(rel)).group(0)
    requests = [row for row in rows(f"{before}/02-requests.txt") if len(row) >= 3]
    after_upgrade = [line for line in lines(f"{direct}/27-requests.txt") if line.strip()]
    controller = read(f"{ax}/60-controller-after.log")
    describe = read(f"{ax}/53-describe.log")
    return {
        "machine": GUEST_Y + ", Agent Substrate v0.6.0 built from source with ko",
        "note": "one install of v0.6.0 by its README, one direct upgrade to v1.0.0 from the release images, one reinstall on the same cluster, and the release v0.3.1 of Agent Executor on a fresh v0.6.0. Each ran once.",
        "sources": [f"capture/lab/{path}" for path in (f"{install}/steps.tsv", f"{install}/20-deploy-ate-system.log", f"{install}/30-deploy-demo.log", f"{before}/pf.log", f"{before}/02-requests.txt", f"{before}/04-actors.txt", f"{before}/06-schema.txt", f"{Y_OLD}/00-timeline.tsv", f"{direct}/10-deploy.log", f"{direct}/22-schema.txt", f"{direct}/23-actors.txt", f"{direct}/27-requests.txt", f"{again}/20-deploy.log", f"{again}/29-stuck-crd.txt", f"{again}/36-atelet-crash.log", f"{again}/40-atespaces.txt", f"{again}/41-actor-rows.txt", f"{again}/33-schema.txt", f"{ax}/steps.tsv", f"{ax}/11-ax-commit.txt", f"{ax}/12-gomod.txt", f"{ax}/53-describe.log", f"{ax}/60-controller-after.log")],
        "install": {
            "steps": attempts(f"{install}/steps.tsv")[0],
            "readme_deploy_error": error_line(f"{install}/20-deploy-ate-system.log"),
            "readme_demo_command_prints_help": read(f"{install}/30-deploy-demo.log").startswith("Deploy Agent Substrate components"),
            "readme_port_forward_error": lines(f"{before}/pf.log")[0],
            "actors_made": len([line for line in lines(f"{before}/04-actors.txt")[1:] if line.strip()]),
            "request_codes_before_upgrade": tally(row[1] for row in requests),
            "schema_rows": len(lines(f"{before}/06-schema.txt")),
        },
        "direct_upgrade": {
            **ended("direct-upgrade-end"),
            "error": crd_error(f"{direct}/10-deploy.log"),
            "schema_rows_after": len(lines(f"{direct}/22-schema.txt")),
            "new_cli_error": lines(f"{direct}/23-actors.txt")[0],
            "requests_after": tally(line.rsplit("\t", 2)[1] for line in after_upgrade),
        },
        "reinstall": {
            "delete_all": ended("delete-all-end"),
            "deploy_1": ended("reinstall-deploy-end"),
            "deploy_1_error": crd_error(f"{again}/20-deploy.log"),
            "stuck_crd_finalizer": "sandboxconfig.ate.dev/workerpool-protection" in read(f"{again}/29-stuck-crd.txt"),
            "deploy_2": ended("reinstall2-deploy-end"),
            "atelet_error": json.loads(next(line for line in lines(f"{again}/36-atelet-crash.log") if "image cache" in line))["err"],
            "deploy_3": ended("reinstall3-deploy-end"),
            "actor_rows_after": int(lines(f"{again}/41-actor-rows.txt")[0]),
            "atespaces_after": len([line for line in lines(f"{again}/40-atespaces.txt") if line.strip() and not line.startswith(("NAME", "Warning"))]),
            "schema_rows_after": len(lines(f"{again}/33-schema.txt")),
        },
        "agent_executor_v0_3_1": {
            "commit": lines(f"{ax}/11-ax-commit.txt")[0].split()[0],
            "substrate_requirement": re.search(r"github.com/agent-substrate/substrate (\S+)", read(f"{ax}/12-gomod.txt")).group(1),
            "steps": attempts(f"{ax}/steps.tsv")[0],
            "task_phase": re.search(r"Phase:\s+(\w+)", describe).group(1),
            "task_condition": re.search(r"ActorCreationFailed\s+(.*)", describe).group(1).strip(),
            "template_error": re.search(r'could not create custom ActorTemplate.*?desc = (\[[^\]]*\])', controller).group(1),
        },
    }


def burst_line(text):
    grab = lambda key: re.search(rf"{key}=([\d.]+)", text).group(1)
    return {"requests": int(grab("n")), "ok": int(grab("ok")), "wall_seconds": float(grab("wall")), "per_second": float(grab("rate")), "median_seconds": float(grab("p50")), "p95_seconds": float(grab("p95")), "max_seconds": float(grab("max")), "connections": int(grab("connects"))}


def burst_times(rel):
    return sorted(round(float(row[2]), 3) for row in rows(rel) if len(row) >= 3)


def scale_x86():
    run = f"{U}/40-scale/10-run"
    setup = f"{U}/40-scale/00-setup"
    levels = {}
    for row in rows(f"{run}/20-concurrency.tsv")[1:]:
        entry = burst_line("\t".join(row[3:]))
        entry["rep"] = int(row[1])
        entry["request_seconds"] = burst_times(f"{run}/bursts/{row[2]}.tsv")
        levels.setdefault(int(row[0]), []).append(entry)
    bursts = []
    for level, reps in sorted(levels.items()):
        bursts.append({
            "at_one_time": level,
            "bursts": len(reps),
            "requests": sum(rep["requests"] for rep in reps),
            "ok": sum(rep["ok"] for rep in reps),
            "median_seconds_each_burst": [rep["median_seconds"] for rep in reps],
            "max_seconds_each_burst": [rep["max_seconds"] for rep in reps],
            "per_second_each_burst": [rep["per_second"] for rep in reps],
            "runs": reps,
        })
    single = [burst_line("\t".join(row[1:]))["median_seconds"] for row in rows(f"{run}/21-sequential.tsv")]
    waves = []
    previous = None
    for row in rows(f"{run}/10-waves.tsv")[1:]:
        text = "\t".join(row)
        entry = burst_line(text)
        tail = row[-7:]
        snap = int(tail[4])
        waves.append({
            "wave": int(row[0]),
            "actors": 150,
            "create_seconds": float(row[2]),
            "first_activation": {key: entry[key] for key in ("requests", "ok", "wall_seconds", "per_second", "median_seconds", "max_seconds")},
            "suspend_seconds": float(tail[0]),
            "suspends_per_second": round(150 / float(tail[0]), 1),
            "guest_disk_free_mb": int(tail[2]),
            "local_snapshots_mb": snap,
            "snapshot_mb_per_actor": round((snap - previous) / 150, 1) if previous is not None else None,
        })
        previous = snap
    sizes = {}
    for row in rows(f"{run}/31-resume-with-rows.tsv"):
        if row[1] == "seq":
            sizes.setdefault(int(row[0].split()[1]), []).append(burst_line("\t".join(row[3:]))["median_seconds"])
    table = []
    for row in rows(f"{run}/30-rows.tsv")[1:]:
        table.append({
            "created": int(row[1]),
            "create_seconds": float(row[2]),
            "creates_per_second": round(int(row[1]) / float(row[2]), 1),
            "failed": int(row[3]),
            "actor_rows": int(row[5]),
            "postgres_database_mb": int(row[4]),
            "list_actors_seconds": float(row[6]),
            "single_resume_seconds": {**stat(sizes[int(row[0])]), "runs": rounded(sizes[int(row[0])])},
        })
    workers = [float(re.search(r"([\d.]+)MB", line).group(1)) for line in lines(f"{run}/40-crictl-stats-all-at-stop.txt") if re.search(r"\sworker\s", line)]
    stop = [line for line in lines(f"{run}/00-run.log") if "STOP" in line]
    allocatable = read_json(f"{setup}/32-node-allocatable.json")
    return {
        "machine": GUEST_U,
        "note": "one kind node with the pod limit raised to 250 and a pool of 200 gVisor workers. The actor is a Python counter with a 128 MiB limit and memory fidelity. A burst is one curl process with --parallel in a pod, HTTP/2 over 1 or 2 connections, one request to each of N suspended actors that have their own snapshot on the node. An older cluster was idle on the same guest.",
        "sources": [f"capture/lab/{run}/20-concurrency.tsv", f"capture/lab/{run}/21-sequential.tsv", f"capture/lab/{run}/10-waves.tsv", f"capture/lab/{run}/30-rows.tsv", f"capture/lab/{run}/31-resume-with-rows.tsv", f"capture/lab/{run}/40-crictl-stats-all-at-stop.txt", f"capture/lab/{run}/00-run.log", f"capture/lab/{setup}/30-setup.log"],
        "pool": {"workers": 200, "ready_seconds": int(re.search(r"pool of 200 workers ready after (\d+) s", read(f"{setup}/30-setup.log")).group(1)), "node_pod_limit": int(allocatable["pods"]), "node_cpus": int(allocatable["cpu"])},
        "single_resume_seconds": {**stat(single), "runs": rounded(single)},
        "bursts": bursts,
        "burst_requests_ok": {"requests": sum(level["requests"] for level in bursts), "ok": sum(level["ok"] for level in bursts)},
        "waves": waves,
        "rows": table,
        "idle_worker_memory_mb": stat(workers),
        "ramp_stopped_by": stop[0].split(" ", 1)[1],
    }


BUILDERS = {
    "node-drain-x86.json": node_drain_x86,
    "full-node-x86.json": full_node_x86,
    "object-store-x86.json": object_store_x86,
    "external-postgres-x86.json": external_postgres_x86,
    "remote-store-x86.json": remote_store_x86,
    "remote-postgres-x86.json": remote_postgres_x86,
    "upgrade-x86.json": upgrade_x86,
    "dependency-reruns-x86.json": dependency_reruns_x86,
    "upgrade-rerun-x86.json": upgrade_rerun_x86,
    "v060-x86.json": v060_x86,
    "scale-x86.json": scale_x86,
    "kagent-model-x86.json": kagent_model_x86,
    "kagent-bound-x86.json": kagent_bound_x86,
    "agent-executor-second-x86.json": agent_executor_second_x86,
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
