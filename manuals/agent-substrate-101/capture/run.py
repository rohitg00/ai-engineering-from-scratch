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
MAC = "Apple silicon laptop, Docker Desktop with 10 CPU and 8 GB, kind v0.33.0, Kubernetes 1.37.0, Agent Substrate v1.0.0 from the release images"


def rows(rel):
    path = LAB / rel
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            out.append(line.split("\t"))
    return out


def stat(values):
    values = sorted(values)
    return {"median": round(statistics.median(values), 3), "min": round(values[0], 3), "max": round(values[-1], 3), "n": len(values)}


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
    return [{"x": mb, "seconds": stat(entry["ok"]), "failed": entry["failed"]} for mb, entry in sorted(group.items()) if entry["ok"]]


def snapshot_sizes():
    out = []
    for mb in (0, 50, 200, 500, 1000):
        first = (LAB / f"C-resume-vs-size/snapdir-b{mb}-1.txt").read_text(encoding="utf-8").splitlines()[0]
        kib = int(first.split()[0])
        out.append({"x": mb, "kib": kib, "mib": round(kib / 1024, 1)})
    return out


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


def section(lines, title):
    out = []
    inside = False
    for line in lines:
        if line.startswith("== "):
            inside = line.startswith(title)
            continue
        if inside:
            out.append(line)
    return out


def du_value(lines, suffix):
    for line in lines:
        parts = line.split()
        if len(parts) == 2 and parts[0].isdigit() and parts[1] == suffix:
            return int(parts[0])
    return None


def footprint_x86():
    before = (LAB / "C-resume-vs-size/20-storage-footprint.txt").read_text(encoding="utf-8").splitlines()
    after = (LAB / "C-resume-vs-size/23-storage-after-delete.txt").read_text(encoding="utf-8").splitlines()
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
    watch = watch_rows()
    actors = {}
    node = []
    for row in watch:
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
    watch = [row for row in lifecycle[start:] if len(row) > 2 and row[1] == "state"]
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
    return {
        "machine": GUEST_K,
        "note": "the model is a mock server in the cluster, so model time is near zero. Every turn resumes the session actor and suspends it again.",
        "sources": ["capture/lab/K-kagent/latency/timings.tsv", "capture/lab/K-kagent/latency/server-times.tsv", "capture/lab/K-kagent/parallel/timings.tsv", "capture/lab/K-kagent/logs/actor-state-changes.tsv"],
        "client_seconds": {key: stat(values) for key, values in sorted(client.items())},
        "server_turn_seconds": {key: stat(values) for key, values in sorted(server.items())},
        "resume_seconds": {"all": stat(resume), "turns_only": stat(turns), "note": "resuming to running in the ate-api log. The values of 5 s or more are golden snapshot builds, left out of turns_only."},
        "suspend_seconds": stat(suspend),
    }


def steps(rel):
    out = []
    for row in rows(rel):
        if len(row) >= 3 and row[1].lstrip("-").isdigit():
            out.append({"step": row[0], "exit": int(row[1]), "seconds": float(row[2])})
    return out


def install_steps():
    return {
        "note": "wall time of each install step. A step with exit 1 failed and was run again.",
        "sources": ["capture/lab/A-quickstart/02-steps.tsv", "capture/lab/G-dataplane/00-install/steps.tsv", "capture/lab/M-mac-arm64/02-steps.tsv", "capture/lab/K-kagent/install/steps.tsv"],
        "source_build": {"machine": GUEST_A, "steps": steps("A-quickstart/02-steps.tsv")},
        "release_images": {"machine": GUEST_B, "steps": steps("G-dataplane/00-install/steps.tsv")},
        "release_images_mac": {"machine": MAC, "steps": steps("M-mac-arm64/02-steps.tsv")},
        "kagent": {"machine": GUEST_K, "steps": steps("K-kagent/install/steps.tsv")},
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
