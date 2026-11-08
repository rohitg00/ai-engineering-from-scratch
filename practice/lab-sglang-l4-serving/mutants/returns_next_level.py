import numpy as np

from support import LOAD, MIXED, SLO, column


def gains(ys):
    values = np.asarray(ys, dtype=float)
    return values[1:] / values[:-1] - 1.0


def saturation_point(xs, ys, min_gain=0.05):
    steps = gains(ys)
    for i, gain in enumerate(steps):
        if gain < min_gain:
            return xs[i + 1]
    return xs[-1]


def largest_within(xs, ys, limit):
    best = None
    for x, y in zip(xs, ys):
        if y <= limit and (best is None or x > best):
            best = x
    return best


def pct_change(new, old):
    return 100.0 * (new - old) / old


def ranges_overlap(a, b):
    return a["min"] <= b["max"] and b["min"] <= a["max"]


def answers():
    default = LOAD["default"]
    fp8 = LOAD["fp8"]
    xs = column(default, "concurrency")
    base = MIXED["default"]
    chunk = MIXED["chunk-1024"]
    goodput = column(default, "goodput_rps")
    ttft_changes = [pct_change(c["median_ttft_ms"]["median"], b["median_ttft_ms"]["median"]) for b, c in zip(base, chunk)]
    throughput_changes = [pct_change(c["output_throughput"]["median"], b["output_throughput"]["median"]) for b, c in zip(base, chunk)]
    return {
        "saturation_default": float(saturation_point(xs, column(default, "output_throughput"))),
        "saturation_fp8": float(saturation_point(column(fp8, "concurrency"), column(fp8, "output_throughput"))),
        "slo_concurrency_default": float(largest_within(xs, column(default, "p99_ttft_ms"), SLO["ttft_ms"])),
        "best_goodput_concurrency_default": float(xs[int(np.argmax(goodput))]),
        "fp8_speedup_c32": fp8[5]["output_throughput"] / default[5]["output_throughput"],
        "chunk_ttft_change_pct": float(np.mean(ttft_changes)),
        "chunk_throughput_change_pct": float(np.mean(throughput_changes)),
        "chunk_overlap_rates": float(sum(ranges_overlap(b["median_ttft_ms"], c["median_ttft_ms"]) for b, c in zip(base, chunk))),
    }
