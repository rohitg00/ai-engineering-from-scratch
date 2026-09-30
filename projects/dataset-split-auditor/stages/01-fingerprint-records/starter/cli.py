"""Audit supplied partitions or build and audit a deterministic group split."""

import argparse
import html
import json
from pathlib import Path
from main import audit, split_groups, summarize, fingerprint


def evidence(train, test):
    result = summarize(train, test)
    for kind, key in [
        ("content", lambda r: fingerprint(r["text"])),
        ("group", lambda r: r["group"]),
    ]:
        result["audit"][kind + "_evidence"] = [
            {
                "fingerprint" if kind == "content" else "group": value,
                "train_ids": [r["id"] for r in train if key(r) == value],
                "test_ids": [r["id"] for r in test if key(r) == value],
                "sources": [
                    {"id": r["id"], "source": r.get("source")}
                    for r in train + test
                    if key(r) == value
                ],
            }
            for value in result["audit"][kind + "_leaks"]
        ]
    return {"schema_version": 1, **result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, nargs="?")
    parser.add_argument("--train", type=Path)
    parser.add_argument("--test", type=Path)
    parser.add_argument("--split", type=float)
    parser.add_argument("--seed", default="course")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--html", type=Path)
    parser.add_argument(
        "--check", action="store_true", help="exit2 when the audit is not usable"
    )
    args = parser.parse_args()
    if args.train or args.test:
        if not args.train or not args.test:
            parser.error("--train and --test are required together")
        data = {
            "train": [
                json.loads(line)
                for line in args.train.read_text().splitlines()
                if line.strip()
            ],
            "test": [
                json.loads(line)
                for line in args.test.read_text().splitlines()
                if line.strip()
            ],
        }
    elif args.input:
        data = json.loads(args.input.read_text())
    else:
        parser.error("provide input.json or --train train.jsonl --test test.jsonl")
    partitions = (
        split_groups(data["records"], args.split, args.seed)
        if args.split is not None
        else data
    )
    report = evidence(partitions["train"], partitions["test"])
    report["partitions"] = partitions
    text = json.dumps(report, indent=2)
    if args.output:
        args.output.write_text(text + "\n")
    if args.html:
        args.html.write_text(
            '<!doctype html><meta charset="utf-8"><title>Split evidence</title><h1>Dataset split evidence</h1><p>Usable: '
            + str(report["usable"])
            + "</p><pre>"
            + html.escape(text)
            + "</pre>"
        )
    print(text)
    if args.check and not report["usable"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
