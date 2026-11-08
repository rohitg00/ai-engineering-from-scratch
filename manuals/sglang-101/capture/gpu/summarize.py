import json
import re
import statistics
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SLO_TTFT_S = 1.0
SLO_TPOT_S = 0.1
QUANTILES = [round(q / 50, 2) for q in range(51)]


def quantiles(values):
    ordered = sorted(values)
    if not ordered:
        return []
    return [round(ordered[min(len(ordered) - 1, int(q * (len(ordered) - 1)))] * 1000, 1) for q in QUANTILES]


def record(path):
    with path.open() as handle:
        return json.loads(handle.readline())


def per_request_tpot(row):
    tpots = []
    for itl, length in zip(row.get("itls") or [], row.get("output_lens") or []):
        if length and length > 1 and itl:
            tpots.append(sum(itl) / len(itl))
    return tpots


def goodput(row):
    met = 0
    for ttft, itl, error in zip(row.get("ttfts") or [], row.get("itls") or [], row.get("errors") or []):
        if error or ttft is None:
            continue
        tpot = sum(itl) / len(itl) if itl else 0
        if ttft < SLO_TTFT_S and tpot < SLO_TPOT_S:
            met += 1
    return met / row["duration"]


def gpu_health(path):
    if not path.exists():
        return None
    clocks, temps, throttled, samples = [], [], 0, 0
    for line in path.read_text().splitlines():
        parts = [part.strip() for part in line.split(",")]
        if len(parts) < 6:
            continue
        samples += 1
        try:
            temps.append(float(parts[1]))
            clocks.append(float(parts[3]))
        except ValueError:
            pass
        try:
            reasons = int(parts[4], 16)
        except ValueError:
            reasons = 0
        if reasons & (0x20 | 0x40 | 0x8):
            throttled += 1
    if not samples:
        return None
    return {"median_sm_mhz": statistics.median(clocks) if clocks else None, "max_temp_c": max(temps) if temps else None, "thermal_share": round(throttled / samples, 3)}


def spread(values):
    return {"median": round(statistics.median(values), 2), "min": round(min(values), 2), "max": round(max(values), 2), "n": len(values)}


def summarize(profile):
    root = HERE / "runs" / profile
    summary = {"profile": profile, "slo": {"ttft_ms": SLO_TTFT_S * 1000, "tpot_ms": SLO_TPOT_S * 1000}, "environment": json.loads((HERE / f"out-{profile}" / "environment.json").read_text()) if (HERE / f"out-{profile}" / "environment.json").exists() else None}
    for sweep_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        sweep = {}
        for config_dir in sorted(p for p in sweep_dir.iterdir() if p.is_dir()):
            groups = {}
            for path in sorted(config_dir.glob("*.jsonl")):
                match = re.fullmatch(r"([a-z])([0-9.]+)-s(\d+)", path.stem)
                if not match:
                    continue
                row = record(path)
                row["_gpu"] = gpu_health(path.with_name(path.stem + ".gpu.csv"))
                groups.setdefault(float(match.group(2)), []).append(row)
            points = []
            for x, rows in sorted(groups.items()):
                point = {
                    "x": x,
                    "output_throughput": spread([r["output_throughput"] for r in rows]),
                    "median_ttft_ms": spread([r["median_ttft_ms"] for r in rows]),
                    "p99_ttft_ms": spread([r["p99_ttft_ms"] for r in rows]),
                    "median_tpot_ms": spread([r["median_tpot_ms"] for r in rows]),
                    "p99_tpot_ms": spread([r["p99_tpot_ms"] for r in rows]),
                    "p99_itl_ms": spread([r["p99_itl_ms"] for r in rows]),
                    "median_itl_ms": spread([r["median_itl_ms"] for r in rows]),
                    "goodput_rps": spread([goodput(r) for r in rows]),
                    "request_throughput": spread([r["request_throughput"] for r in rows]),
                    "completed": [r["completed"] for r in rows],
                }
                health = [r["_gpu"] for r in rows if r["_gpu"]]
                if health:
                    point["gpu"] = {
                        "median_sm_mhz": spread([h["median_sm_mhz"] for h in health if h["median_sm_mhz"] is not None]) if any(h["median_sm_mhz"] is not None for h in health) else None,
                        "max_temp_c": max(h["max_temp_c"] for h in health if h["max_temp_c"] is not None) if any(h["max_temp_c"] is not None for h in health) else None,
                        "thermal_share": max(h["thermal_share"] for h in health),
                    }
                if rows[0].get("accept_length") is not None:
                    point["accept_length"] = spread([r["accept_length"] for r in rows])
                pooled_ttft = [t for r in rows for t in (r.get("ttfts") or []) if t is not None]
                pooled_tpot = [t for r in rows for t in per_request_tpot(r)]
                point["ttft_quantiles_ms"] = quantiles(pooled_ttft)
                point["tpot_quantiles_ms"] = quantiles(pooled_tpot)
                points.append(point)
            server_log = config_dir / "server.log"
            pool = re.search(r"#tokens: (\d+)|GPU KV cache size: ([\d,]+) tokens", server_log.read_text()) if server_log.exists() else None
            sweep[config_dir.name] = {"kv_pool_tokens": int((pool.group(1) or pool.group(2)).replace(",", "")) if pool else None, "points": points}
        summary[sweep_dir.name] = sweep
    summary["quantiles"] = QUANTILES
    return summary


if __name__ == "__main__":
    for profile in sys.argv[1:] or ["gb10", "l4"]:
        if not (HERE / "runs" / profile).exists():
            print(f"{profile}: no runs")
            continue
        target = HERE / "summary" / f"{profile}.json"
        target.parent.mkdir(exist_ok=True)
        target.write_text(json.dumps(summarize(profile), indent=1) + "\n")
        print(f"{profile}: wrote {target.relative_to(HERE)}")
