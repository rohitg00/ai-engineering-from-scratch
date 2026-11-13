# Export a Bounded HTTP Adapter and Correctness Report

> Connect the cache engine to an HTTP proxy adapter with audit headers and generate a false-hit, latency, and savings report.

**Type:** Build
**Languages:** Python
**Prerequisites:** 03-semantic-matching-and-adversarial-near-misses
**Time:** ~120 min

## Learning Objectives
- Implement an HTTP caching adapter with standard RFC 9111 audit headers
- Emulate write-through cache population on misses from upstream handlers
- Execute a comprehensive correctness benchmark measuring false hits and latency savings
- Export structured JSON audit reports and verify CI compatibility gates

## What changes

In this final stage, you wrap the verified caching store into an HTTP proxy adapter.
When an application queries the cache:
1. On a cache hit (exact or semantic), the adapter responds immediately with `X-Cache: HIT-EXACT` or `X-Cache: HIT-SEMANTIC`, attaching the similarity score and calculated latency savings.
2. On a cache miss, the adapter sets `X-Cache: MISS`, records the miss reason (such as `partition_empty`, `below_threshold`, or `adversarial_blocked`), invokes the upstream handler, and writes the fresh response back to the cache.
3. The benchmark runner processes a test suite of queries, verifying that false hits remain strictly at zero while saving latency on valid queries.

## Implement the contract

In your workspace `main.py`, implement:

1. `CacheAdapter`:
   - `handle_request(request, upstream_handler=None, threshold=0.85, current_time=0.0) -> dict`:
     Returns `{status: 200, response: str, headers: dict, cached: bool}`.
2. `run_correctness_benchmark(dataset, store=None, threshold=0.85, current_time=0.0) -> dict`:
   - Calculates `total_queries`, `exact_hits`, `semantic_hits`, `safe_misses`, `false_hits`, `near_misses_blocked`, `cross_tenant_blocks`, `accuracy_pct`, and `estimated_latency_saved_ms`.
   - Requires `false_hits == 0` for compatibility.
3. `export_report(output_path, benchmark_result)`:
   - Writes the benchmark dictionary to `output_path`.

The included `cli.py` connects your functions to command-line flags:
```bash
python3 cli.py --benchmark samples/benchmark.json --output report.json --strict
```

## Verify and inspect

Run the cumulative test suite:

```bash
python3 scripts/project_test.py semantic-cache-correctness-lab --all --path learning-artifacts/semantic-cache-correctness-lab --strict
```

## References

- [RFC 9111: HTTP Caching - Section 3: Storing Responses in Caches](https://www.rfc-editor.org/rfc/rfc9111.html#section-3)
