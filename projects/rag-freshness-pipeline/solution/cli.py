"""A complete-corpus ingestion contract, with durable POSIX snapshots."""

import argparse, json
from pathlib import Path
from changes import diff
from snapshot import read_snapshot, commit
from retrieve import retrieve


def ingest(path, documents, expected_version=None):
    previous = read_snapshot(path)
    plan = diff(previous["documents"], documents)
    version = previous["version"] if expected_version is None else expected_version
    state = commit(path, plan["documents"], version)
    return {
        "schema_version": 1,
        "version": state["version"],
        "changes": {k: v for k, v in plan.items() if k != "documents"},
    }


def query(path, text, now, max_age=3600, k=3):
    state = read_snapshot(path)
    hits = retrieve(state["documents"], text, now, max_age, k)
    return {
        "schema_version": 1,
        "snapshot_version": state["version"],
        "query": text,
        "matches": [
            {**hit, "text": state["documents"][hit["id"]]["text"]} for hit in hits
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    load = commands.add_parser("ingest")
    load.add_argument("snapshot")
    load.add_argument("documents")
    load.add_argument("--expected-version", type=int)
    find = commands.add_parser("query")
    find.add_argument("snapshot")
    find.add_argument("text")
    find.add_argument("--now", type=int, required=True)
    find.add_argument("--max-age", type=int, default=3600)
    find.add_argument("--k", type=int, default=3)
    args = parser.parse_args()
    result = (
        ingest(
            args.snapshot,
            json.loads(Path(args.documents).read_text()),
            args.expected_version,
        )
        if args.command == "ingest"
        else query(args.snapshot, args.text, args.now, args.max_age, args.k)
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
