"""CLI runner for Semantic Cache Correctness Lab.

Executes correctness benchmarks, threshold sensitivity analysis, and exports audit receipts.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from main import (
    CacheAdapter,
    CacheEntry,
    SemanticCacheStore,
    analyze_threshold_sensitivity,
    export_report,
    run_correctness_benchmark,
)


def build_parser() -> argparse.ArgumentParser:
    """Construct command-line argument parser."""
    parser = argparse.ArgumentParser(
        description="Run semantic cache correctness benchmark, sensitivity profiling, and verification gate."
    )
    parser.add_argument(
        "--benchmark",
        required=True,
        help="Path to JSON benchmark dataset file.",
    )
    parser.add_argument(
        "--output",
        default="report.json",
        help="Path to write JSON benchmark report.",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.85,
        help="Cosine similarity threshold for semantic cache hits (default: 0.85).",
    )
    parser.add_argument(
        "--sensitivity",
        action="store_true",
        help="Run threshold sensitivity profiling across 0.65 - 0.95 cutoffs.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with status 1 if any false cache hits occur.",
    )
    return parser


def main() -> int:
    """Execute the CLI interface."""
    parser = build_parser()
    args = parser.parse_args()

    benchmark_path = Path(args.benchmark)
    if not benchmark_path.exists():
        sys.stderr.write(f"Error: benchmark file not found: {args.benchmark}\n")
        return 2

    with open(benchmark_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    seed_entries = data.get("seed_cache", [])
    test_queries = data.get("queries", [])

    store = SemanticCacheStore()
    for raw in seed_entries:
        store.put(CacheEntry.from_dict(raw))

    results = run_correctness_benchmark(
        dataset=test_queries,
        store=store,
        threshold=args.threshold,
    )

    if args.sensitivity:
        curve = analyze_threshold_sensitivity(
            dataset=test_queries,
            store=store,
        )
        results["sensitivity_curve"] = curve

    export_report(args.output, results)

    print("==================================================")
    print("Semantic Cache Correctness Benchmark Report")
    print("==================================================")
    print(f"Total Queries Evaluated:    {results['total_queries']}")
    print(f"Exact Matches:              {results['exact_hits']}")
    print(f"Safe Semantic Matches:      {results['semantic_hits']}")
    print(f"Safe Misses Enforced:       {results['safe_misses']}")
    print(f"Adversarial Near-Misses Blocked: {results['near_misses_blocked']}")
    print(f"Cross-Tenant Blocks:        {results['cross_tenant_blocks']}")
    print(f"False Hits (Critical):      {results['false_hits']}")
    print(f"Accuracy Rate:              {results['accuracy_pct']}%")
    print(f"Estimated Latency Saved:    {results['estimated_latency_saved_ms']} ms")

    if args.sensitivity and "sensitivity_curve" in results:
        print("\nThreshold Sensitivity Analysis:")
        print(" Threshold | Semantic Hits | False Hits | Accuracy")
        print("-----------+---------------+------------+---------")
        for pt in results["sensitivity_curve"]:
            print(f"   {pt['threshold']:.2f}    |       {pt['semantic_hits']:<7} |     {pt['false_hits']:<6} | {pt['accuracy_pct']:.1f}%")

    print(f"\nReport exported to:         {args.output}")
    print("==================================================")

    if args.strict and (results["false_hits"] > 0 or not results["compatible"]):
        print("CI Gate: FAILED - Unsafe cache hits or accuracy below threshold.")
        return 1

    print("CI Gate: PASSED - All identity boundaries and near-misses preserved.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
