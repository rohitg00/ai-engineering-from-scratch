#!/usr/bin/env python3
"""CLI driver for Tool Contract Migration Checker."""

import argparse
import json
import sys
from pathlib import Path

from main import (
    build_report,
    classify_changes,
    export_fixtures,
    generate_counterexamples,
    load_calls,
    load_contract,
    replay_calls,
)


def run_checker(old_path, new_path, calls_path=None, output_path=None, fixtures_path=None, strict=False):
    """Execute contract migration checks between two schema files and optional call log."""
    old_p = Path(old_path)
    new_p = Path(new_path)
    if not old_p.is_file():
        raise FileNotFoundError(f"old contract file not found: {old_path}")
    if not new_p.is_file():
        raise FileNotFoundError(f"new contract file not found: {new_path}")

    with open(old_p, "r", encoding="utf-8") as f:
        old_data = json.load(f)
    with open(new_p, "r", encoding="utf-8") as f:
        new_data = json.load(f)

    calls_data = []
    if calls_path:
        c_p = Path(calls_path)
        if not c_p.is_file():
            raise FileNotFoundError(f"calls file not found: {calls_path}")
        with open(c_p, "r", encoding="utf-8") as f:
            calls_data = json.load(f)

    old_contract = load_contract(old_data)
    new_contract = load_contract(new_data)
    calls = load_calls(calls_data)

    changes = classify_changes(old_contract, new_contract)
    counterexamples = generate_counterexamples(old_contract, new_contract)
    replay_res = replay_calls(old_contract, new_contract, calls)
    report = build_report(old_contract, new_contract, changes, counterexamples, replay_res)

    if fixtures_path:
        export_fixtures(fixtures_path, counterexamples, replay_res.get("broken", []))

    if output_path:
        p = Path(output_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

    print(json.dumps(report, indent=2))

    if strict and not report["compatible"]:
        sys.exit(1)
    return report


def main():
    """Parse command line arguments and execute the tool contract migration checker."""
    parser = argparse.ArgumentParser(description="Tool Contract Migration Checker")
    parser.add_argument("--old", required=True, help="Path to before schema JSON")
    parser.add_argument("--new", required=True, help="Path to proposed schema JSON")
    parser.add_argument("--calls", help="Path to saved agent calls JSON")
    parser.add_argument("--output", help="Path to write JSON compatibility report")
    parser.add_argument("--fixtures", help="Path to write generated migration test fixtures")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit code 1 when the contract update is incompatible (breaking changes, unresolved keywords, or broken calls)",
    )

    args = parser.parse_args()
    run_checker(
        old_path=args.old,
        new_path=args.new,
        calls_path=args.calls,
        output_path=args.output,
        fixtures_path=args.fixtures,
        strict=args.strict,
    )


if __name__ == "__main__":
    main()
