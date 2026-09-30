"""Score a reproducible recording and optionally compare it with a prior run."""

import argparse
import hashlib
import html
import json
from pathlib import Path
from main import scorecard


def measure(payload):
    manifest = payload.get("manifest", {})
    required = [
        "model",
        "model_revision",
        "prompt_revision",
        "hardware",
        "confidence_method",
    ]
    if any(
        not isinstance(manifest.get(k), str) or not manifest[k].strip()
        for k in required
    ):
        raise ValueError("manifest requires " + ", ".join(required))
    labels = payload["labels"]
    digest = hashlib.sha256(
        json.dumps(labels, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return {
        "schema_version": 1,
        "manifest": {**manifest, "dataset_sha256": digest},
        **scorecard(payload["records"], labels, payload["source"]),
    }


def compare(current, baseline):
    if current["manifest"]["dataset_sha256"] != baseline["manifest"]["dataset_sha256"]:
        raise ValueError("cannot compare different datasets")
    return {
        "accuracy_delta": current["accuracy"] - baseline["accuracy"],
        "coverage_delta": current["coverage"] - baseline["coverage"],
        "ece_delta": current["calibration"]["ece"] - baseline["calibration"]["ece"],
        "p95_delta_ms": None
        if current["p95_ms"] is None or baseline["p95_ms"] is None
        else current["p95_ms"] - baseline["p95_ms"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, nargs="?")
    parser.add_argument("--predictions", type=Path)
    parser.add_argument("--labels", type=Path)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--dataset-audit", type=Path)
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--html", type=Path)
    parser.add_argument("--min-accuracy", type=float, default=0)
    args = parser.parse_args()
    if args.predictions or args.labels:
        if not all([args.predictions, args.labels, args.manifest]):
            parser.error("predictions, labels and manifest paths required together")
        labels = [
            json.loads(line)
            for line in args.labels.read_text().splitlines()
            if line.strip()
        ]
        if len({row["id"] for row in labels}) != len(labels):
            raise ValueError("duplicate label id")
        payload = {
            "manifest": json.loads(args.manifest.read_text()),
            "source": str(args.predictions),
            "labels": {row["id"]: row["expected"] for row in labels},
            "records": [
                json.loads(line)
                for line in args.predictions.read_text().splitlines()
                if line.strip()
            ],
        }
    elif args.input:
        payload = json.loads(args.input.read_text())
    else:
        parser.error("provide a recording or predictions/labels/manifest paths")
    report = measure(payload)
    if args.dataset_audit:
        audit = json.loads(args.dataset_audit.read_text())
        if audit.get("schema_version") != 1 or audit.get("usable") is not True:
            raise ValueError("dataset audit must be usable schema version1")
        if {row["id"] for row in audit["partitions"]["test"]} != set(payload["labels"]):
            raise ValueError("labels do not match audited test partition")
        report["dataset_audit_sha256"] = hashlib.sha256(
            args.dataset_audit.read_bytes()
        ).hexdigest()
    if args.baseline:
        report["comparison"] = compare(
            report, measure(json.loads(args.baseline.read_text()))
        )
    text = json.dumps(report, indent=2)
    if args.output:
        args.output.write_text(text + "\n")
    if args.html:
        bars = "".join(
            "<tr><td>"
            + str(b["bin"])
            + "</td><td>"
            + str(b["count"])
            + "</td><td>"
            + str(round(b["confidence"], 3))
            + "</td><td>"
            + str(round(b["accuracy"], 3))
            + "</td></tr>"
            for b in report["calibration"]["bins"]
        )
        args.html.write_text(
            '<!doctype html><meta charset="utf-8"><title>Local evaluation</title><h1>Evaluation evidence</h1><table><tr><th>Bin</th><th>Count</th><th>Confidence</th><th>Accuracy</th></tr>'
            + bars
            + "</table><pre>"
            + html.escape(text)
            + "</pre>"
        )
    print(text)
    if report["accuracy"] < args.min_accuracy:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
