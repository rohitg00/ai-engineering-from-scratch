"""Repair a disposable copy of a trusted Python workspace using observed failures."""

import argparse, json, shutil
from pathlib import Path
from main import drive, proposal_planner


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workspace")
    parser.add_argument("proposals")
    parser.add_argument("--copy-to", required=True)
    parser.add_argument("--max-steps", type=int, default=6)
    parser.add_argument("--out")
    args = parser.parse_args()
    source = Path(args.workspace).resolve()
    target = Path(args.copy_to).resolve()
    if target.exists() or target.is_relative_to(source):
        parser.error("copy destination must be new and outside source")
    if any(p.is_symlink() for p in source.rglob("*")):
        parser.error("source must not contain symlinks")
    shutil.copytree(source, target)
    result = {
        "schema_version": 1,
        "workspace": str(target),
        **drive(
            target,
            proposal_planner(json.loads(Path(args.proposals).read_text())),
            args.max_steps,
        ),
    }
    payload = json.dumps(result, indent=2)
    if args.out:
        Path(args.out).write_text(payload + "\n")
    print(payload)
    return 0 if result["state"] == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
