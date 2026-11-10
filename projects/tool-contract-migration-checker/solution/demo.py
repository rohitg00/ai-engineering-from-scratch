#!/usr/bin/env python3
"""Terminating demonstration for Tool Contract Migration Checker."""

from pathlib import Path
from cli import run_checker


def run_demo():
    """Run a self-terminating demonstration of the migration checker using sample catalogs."""
    root = Path(__file__).parent
    old_p = root / "samples" / "catalog_v1.json"
    new_p = root / "samples" / "catalog_v2.json"
    calls_p = root / "samples" / "saved_calls.json"
    out_p = root / "report.json"

    print("Running Tool Contract Migration Checker Demo...")
    report = run_checker(
        old_path=str(old_p),
        new_path=str(new_p),
        calls_path=str(calls_p),
        output_path=str(out_p),
        strict=False,
    )
    print(f"\nMigration Analysis Completed: Compatible = {report['compatible']}")
    print(f"Summary: {report['summary']}")


if __name__ == "__main__":
    run_demo()
