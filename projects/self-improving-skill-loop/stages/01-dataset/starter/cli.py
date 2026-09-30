"""Inspect a candidate, then promote only its exact approved digest."""

import argparse, hashlib, json, os, re, tempfile
from pathlib import Path
from dataset import split_cases, audit_partitions
from skill import evaluate
from propose import propose
from promotion import gate


def experiment(data, min_support=2):
    if "cases" in data:
        parts = split_cases(data["cases"], data.get("holdout_fraction", 0.25))
    else:
        parts = {key: data[key] for key in ("development", "holdout")}
        split_cases(parts["development"] + parts["holdout"])
    audit = audit_partitions(parts["development"], parts["holdout"])
    if not audit["usable"]:
        raise ValueError("development and holdout overlap")
    baseline = data.get("rules", [])
    candidate = propose(parts["development"], baseline, min_support)
    decision = gate(parts["holdout"], baseline, candidate, data.get("min_gain", 0.05))
    return {
        "schema_version": 1,
        "dataset_sha256": hashlib.sha256(
            json.dumps(parts, sort_keys=True).encode()
        ).hexdigest(),
        "development_cases": parts["development"],
        "holdout_cases": parts["holdout"],
        "audit": audit,
        "development_ids": [c["id"] for c in parts["development"]],
        "holdout_ids": [c["id"] for c in parts["holdout"]],
        "rules": candidate,
        "development": evaluate(parts["development"], candidate),
        "holdout": evaluate(parts["holdout"], candidate),
        "gate": decision,
    }


def atomic_write(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=".rules-")
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def promote(result, destination, approved_digest):
    digest = hashlib.sha256(
        json.dumps(result["rules"], sort_keys=True).encode()
    ).hexdigest()
    if (
        not result["gate"]["promote"]
        or digest != approved_digest
        or digest != result["gate"]["candidate_sha256"]
    ):
        raise ValueError("passing gate and exact candidate approval required")
    path = Path(destination)
    if path.exists():
        atomic_write(str(path) + ".previous", path.read_text())
    atomic_write(
        path,
        json.dumps(
            {"schema_version": 1, "candidate_sha256": digest, "rules": result["rules"]},
            indent=2,
        )
        + "\n",
    )
    return {"state": "promoted", "path": str(path), "candidate_sha256": digest}


def from_dataset_audit(data, receipt):
    if receipt.get("schema_version") != 1 or receipt.get("usable") is not True:
        raise ValueError("usable version-1 dataset audit required")
    parts = receipt["partitions"]
    return {**data, "development": parts["train"], "holdout": parts["test"]}


def export_skill(result, directory):
    root = Path(directory)
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", root.name) or len(root.name) > 64:
        raise ValueError("skill directory needs a portable lowercase name")
    if root.exists():
        raise ValueError("export destination must be new")
    root.mkdir(parents=True)
    (root / "references").mkdir()
    instructions = (
        "---\nname: "
        + json.dumps(root.name)
        + "\ndescription: "
        + json.dumps(
            "Route labeled support messages using reviewed explicit term rules."
        )
        + "\n---\n\n# Support routing candidate\n\nRead references/rules.json. Match every term in a rule against case-folded message words, in listed order. Return the first matching label, or unknown. These are candidate instructions; require human review before installation.\n"
    )
    (root / "SKILL.md").write_text(instructions)
    (root / "references/rules.json").write_text(
        json.dumps(
            {
                "schema_version": 1,
                "candidate_sha256": result["gate"]["candidate_sha256"],
                "dataset_sha256": result["dataset_sha256"],
                "rules": result["rules"],
            },
            indent=2,
        )
        + "\n"
    )
    return {"state": "draft_exported", "directory": str(root)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input")
    parser.add_argument("--out")
    parser.add_argument("--promote-to")
    parser.add_argument("--approve-digest")
    parser.add_argument("--min-support", type=int, default=2)
    parser.add_argument("--dataset-audit")
    parser.add_argument("--export-skill")
    args = parser.parse_args()
    data = json.loads(Path(args.input).read_text())
    if args.dataset_audit:
        data = from_dataset_audit(
            {k: v for k, v in data.items() if k != "cases"},
            json.loads(Path(args.dataset_audit).read_text()),
        )
    result = experiment(data, args.min_support)
    if args.export_skill:
        result["export"] = export_skill(result, args.export_skill)
    if args.promote_to:
        result["promotion"] = promote(result, args.promote_to, args.approve_digest)
    payload = json.dumps(result, indent=2)
    if args.out:
        Path(args.out).write_text(payload + "\n")
    print(payload)


if __name__ == "__main__":
    main()
