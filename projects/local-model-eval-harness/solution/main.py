import math


def validate(records):
    seen = set()
    for r in records:
        if not isinstance(r.get("id"), str) or not r["id"] or r["id"] in seen:
            raise ValueError("unique prediction ids required")
        seen.add(r["id"])
        if not isinstance(r.get("answer"), str):
            raise ValueError("answer must be text")
        for key in ("confidence", "latency_ms"):
            value = r.get(key)
            if (
                not isinstance(value, (int, float))
                or isinstance(value, bool)
                or (not math.isfinite(value))
                or (value < 0)
            ):
                raise ValueError("finite nonnegative metrics required")
        if r["confidence"] > 1:
            raise ValueError("confidence in [0,1] required")
    return records


def correct(record, labels):
    return " ".join(record["answer"].casefold().split()) == " ".join(
        labels[record["id"]].casefold().split()
    )


def accuracy(records, labels):
    validate(records)
    if any((r["id"] not in labels for r in records)):
        raise ValueError("unknown prediction id")
    if any((not isinstance(v, str) for v in labels.values())):
        raise ValueError("labels must be text")
    hits = sum((correct(r, labels) for r in records))
    return {
        "correct": hits,
        "total": len(labels),
        "accuracy": hits / len(labels) if labels else 0,
        "coverage": len(records) / len(labels) if labels else 0,
    }


def calibration(records, labels, bins=5):
    accuracy(records, labels)
    if not isinstance(bins, int) or bins < 1:
        raise ValueError("positive bins required")
    groups = [[] for _ in range(bins)]
    for r in records:
        groups[min(int(r["confidence"] * bins), bins - 1)].append(r)
    evidence = []
    for i, group in enumerate(groups):
        if not group:
            continue
        confidence = sum((r["confidence"] for r in group)) / len(group)
        observed = sum((correct(r, labels) for r in group)) / len(group)
        evidence.append(
            {
                "bin": i,
                "count": len(group),
                "confidence": confidence,
                "accuracy": observed,
                "gap": abs(confidence - observed),
            }
        )
    return {
        "ece": sum((g["gap"] * g["count"] for g in evidence)) / len(records)
        if records
        else 0,
        "bins": evidence,
    }


def percentile(values, p):
    if not 0 < p <= 1 or any((not math.isfinite(v) or v < 0 for v in values)):
        raise ValueError("valid percentile and latencies required")
    return sorted(values)[max(0, math.ceil(p * len(values)) - 1)] if values else None


def scorecard(records, labels, source):
    if not isinstance(source, str) or not source.strip():
        raise ValueError("measurement source required")
    quality = accuracy(records, labels)
    return {
        **quality,
        "calibration": calibration(records, labels),
        "p50_ms": percentile([r["latency_ms"] for r in records], 0.5),
        "p95_ms": percentile([r["latency_ms"] for r in records], 0.95),
        "measured_predictions": len(records),
        "source": source,
    }
