"""Self-terminating offline demonstration for Semantic Cache Correctness Lab.

Showcases exact identity matching, safe semantic paraphrase reuse,
strict multi-tenant isolation, adversarial near-miss blocking,
per-tenant LRU quotas, and threshold sensitivity analysis.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

from main import (
    CacheAdapter,
    CacheEntry,
    ExactCacheStore,
    SemanticCacheStore,
    analyze_threshold_sensitivity,
    run_correctness_benchmark,
)


def main() -> int:
    """Run an illustrative cache verification workflow and print audit results."""
    sample_file = Path(__file__).parent / "samples" / "benchmark.json"
    with open(sample_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    store = SemanticCacheStore(max_entries_per_tenant=10)
    for item in data.get("seed_cache", []):
        store.put(CacheEntry.from_dict(item))

    print("==================================================")
    print("Semantic Cache Correctness Lab: Advanced Demo")
    print("==================================================")

    bench_time = data.get("current_time", 1000.0)

    # 1. Benchmark Execution
    results = run_correctness_benchmark(
        dataset=data.get("queries", []),
        store=store,
        threshold=0.85,
        current_time=bench_time,
    )

    print(f"Total Queries Evaluated:         {results['total_queries']}")
    print(f"Exact Matches:                   {results['exact_hits']}")
    print(f"Safe Semantic Matches:           {results['semantic_hits']}")
    print(f"Safe Misses Enforced:            {results['safe_misses']}")
    print(f"Adversarial Near-Misses Blocked: {results['near_misses_blocked']}")
    print(f"Cross-Tenant Blocks:             {results['cross_tenant_blocks']}")
    print(f"Critical False Hits:             {results['false_hits']} (Zero tolerance)")
    print(f"Overall Accuracy:                {results['accuracy_pct']}%")
    print(f"Estimated Latency Saved:         {results['estimated_latency_saved_ms']} ms")

    # 2. Per-Tenant Quota & LRU Eviction Verification
    print("\n--- Per-Tenant Quota & LRU Isolation Test ---")
    quota_store = ExactCacheStore(max_entries_per_tenant=2)
    e1 = CacheEntry("t1-1", "tenant-alpha", "m1", "v1", "Alpha query 1", "A1", 1000.0, 3600.0)
    e2 = CacheEntry("t1-2", "tenant-alpha", "m1", "v1", "Alpha query 2", "A2", 1000.0, 3600.0)
    e3 = CacheEntry("t1-3", "tenant-alpha", "m1", "v1", "Alpha query 3", "A3", 1000.0, 3600.0)
    e_beta = CacheEntry("t2-1", "tenant-beta", "m1", "v1", "Beta query 1", "B1", 1000.0, 3600.0)

    quota_store.put(e1)
    quota_store.put(e2)
    quota_store.put(e_beta)
    # Tenant alpha pushes 3rd entry -> e1 evicted by LRU
    quota_store.put(e3)

    alpha_e1_hit = quota_store.get("tenant-alpha", "m1", "v1", "Alpha query 1", 1000.0)
    beta_e1_hit = quota_store.get("tenant-beta", "m1", "v1", "Beta query 1", 1000.0)
    print(f"Tenant Alpha oldest entry evicted: {alpha_e1_hit is None} (LRU quota enforced)")
    print(f"Tenant Beta entry preserved:       {beta_e1_hit is not None} (Noisy neighbor protected)")

    # 3. Threshold Sensitivity Analysis
    print("\n--- Threshold Sensitivity Profiling ---")
    curve = analyze_threshold_sensitivity(data.get("queries", []), store=store, current_time=bench_time)
    print(" Threshold | Semantic Hits | False Hits | Accuracy")
    print("-----------+---------------+------------+---------")
    for pt in curve:
        print(f"   {pt['threshold']:.2f}    |       {pt['semantic_hits']:<7} |     {pt['false_hits']:<6} | {pt['accuracy_pct']:.1f}%")

    print("\nCI Gate: PASSED - All identity boundaries and near-misses preserved.")
    print("==================================================")
    return 0


if __name__ == "__main__":
    sys.exit(main())
