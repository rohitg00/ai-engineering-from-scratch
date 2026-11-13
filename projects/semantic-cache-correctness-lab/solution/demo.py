"""Self-terminating offline demonstration for Semantic Cache Correctness Lab."""

from __future__ import annotations

import json
from pathlib import Path
import sys

from main import CacheEntry, SemanticCacheStore, run_correctness_benchmark


def main() -> int:
    """Run an illustrative cache verification workflow and print audit results."""
    sample_file = Path(__file__).parent / "samples" / "benchmark.json"
    with open(sample_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    store = SemanticCacheStore()
    for item in data.get("seed_cache", []):
        store.put(CacheEntry.from_dict(item))

    results = run_correctness_benchmark(
        dataset=data.get("queries", []),
        store=store,
        threshold=0.85,
    )

    print("=== Semantic Cache Correctness Lab Demo ===")
    print(f"Evaluated {results['total_queries']} queries across exact, semantic, and adversarial cases.")
    print(f"Exact Hits:                 {results['exact_hits']}")
    print(f"Safe Semantic Hits:         {results['semantic_hits']}")
    print(f"Safe Misses Enforced:       {results['safe_misses']}")
    print(f"Adversarial Blocks:         {results['near_misses_blocked']}")
    print(f"Cross-Tenant Blocks:        {results['cross_tenant_blocks']}")
    print(f"False Hits:                 {results['false_hits']} (Zero tolerance)")
    print(f"Overall Accuracy:           {results['accuracy_pct']}%")
    print("Demo completed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
