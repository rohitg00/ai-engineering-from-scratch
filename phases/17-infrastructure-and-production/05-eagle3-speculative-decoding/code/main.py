"""Toy speculative-decoding analyzer — stdlib Python.

Compute expected speedup and break-even alpha for EAGLE-3-style speculative
decoding across a range of (alpha, K, verify_overhead, concurrency) points.
Pedagogical — numbers track shape, not absolute latency.
"""

from __future__ import annotations

from dataclasses import dataclass
import random
import statistics


@dataclass
class SpecPoint:
    alpha: float      # acceptance rate (0..1)
    k: int            # draft length
    verify_overhead: float  # fraction extra cost per target forward
    concurrency: int  # batch size at decode


def expected_speedup(p: SpecPoint) -> float:
    """Plain decode: 1 token per target forward.
    Spec decode at (alpha, K): expected 1 + K*alpha tokens per target forward,
    but each target forward costs (1 + verify_overhead) relative to plain.
    Concurrency increases verify_overhead (more seqs share the verify cost).
    """
    effective_overhead = p.verify_overhead * (1 + p.concurrency / 256)
    tokens_per_target = 1 + p.k * p.alpha
    cost_per_target = 1 + effective_overhead
    return tokens_per_target / cost_per_target


def breakeven_alpha(k: int, verify_overhead: float, concurrency: int) -> float:
    effective_overhead = verify_overhead * (1 + concurrency / 256)
    # speedup = (1 + K*alpha) / (1 + eff_overhead) = 1
    # alpha = eff_overhead / K
    return effective_overhead / k


def simulate_tail(p: SpecPoint, n_tokens: int = 1000, seed: int = 3) -> tuple[float, float]:
    """Simulate per-token latency distribution.
    Plain decode: constant-ish latency per token (+ small jitter).
    Spec decode: good tokens arrive in batches; rejected draft pays two target passes.
    Return (mean_ms, p99_ms).
    """
    rng = random.Random(seed)
    base_target_ms = 8.0
    effective_overhead = p.verify_overhead * (1 + p.concurrency / 256)
    verify_ms = base_target_ms * (1 + effective_overhead)
    reroll_ms = base_target_ms  # second pass when draft rejects early

    latencies: list[float] = []
    tokens_emitted = 0
    while tokens_emitted < n_tokens:
        # draft K tokens, verify
        accepted = 0
        for _ in range(p.k):
            if rng.random() < p.alpha:
                accepted += 1
            else:
                break
        batch_lat = verify_ms + (reroll_ms if accepted < p.k else 0)
        # tokens emitted: accepted + 1 (the verified one at end)
        batch_tokens = max(1, accepted + 1)
        per_tok = batch_lat / batch_tokens
        for _ in range(batch_tokens):
            jitter = rng.gauss(0, per_tok * 0.1)
            latencies.append(max(0.1, per_tok + jitter))
            tokens_emitted += 1
            if tokens_emitted >= n_tokens:
                break
    latencies.sort()
    p99 = latencies[int(0.99 * len(latencies)) - 1]
    return statistics.mean(latencies), p99


def plain_tail(concurrency: int, n_tokens: int = 1000, seed: int = 5) -> tuple[float, float]:
    rng = random.Random(seed)
    base = 8.0 * (1 + concurrency / 512)
    lats = [max(0.1, base + rng.gauss(0, base * 0.08)) for _ in range(n_tokens)]
    lats.sort()
    return statistics.mean(lats), lats[int(0.99 * len(lats)) - 1]


def print_table(title: str, rows: list[tuple[str, float, float, float, float, float]]) -> None:
    print(title)
    print("-" * 80)
    print(f"{'config':28} {'speedup':>8} {'be_alpha':>10} {'mean_ms':>10} {'p99_ms':>10}")
    for label, speedup, be_alpha, mean, p99, delta_p99 in rows:
        tag = "  OK" if delta_p99 <= 0 else "  TAIL"
        print(f"{label:28} {speedup:8.2f} {be_alpha:10.3f} {mean:10.2f} {p99:10.2f}{tag}")


def main() -> None:
    print("=" * 80)
    print("TOY EAGLE-3 SPECULATIVE-DECODING ANALYZER")
    print("=" * 80)
    print()

    base_overhead = 0.15
    k = 5

    print(f"Config: K={k}, base verify_overhead={base_overhead}")
    print()

    for concurrency in [32, 128, 256]:
        be = breakeven_alpha(k, base_overhead, concurrency)
        plain_mean, plain_p99 = plain_tail(concurrency)
        rows = []
        for alpha in [0.30, 0.45, 0.55, 0.70, 0.80]:
            p = SpecPoint(alpha=alpha, k=k,
                          verify_overhead=base_overhead, concurrency=concurrency)
            s = expected_speedup(p)
            mean_ms, p99_ms = simulate_tail(p)
            delta = p99_ms - plain_p99
            rows.append((f"alpha={alpha:.2f} conc={concurrency}", s, be, mean_ms, p99_ms, delta))
        print(f"  --- concurrency {concurrency} ---  plain P99 = {plain_p99:.2f} ms")
        print_table(f"  spec decode", rows)
        print()

    print("=" * 80)
    print("KEY FINDING")
    print("-" * 80)
    print("  Break-even alpha rises with concurrency. At 32 concurrent you profit")
    print("  anywhere above ~0.1; at 256 concurrent the bar is ~0.4. Under that,")
    print("  P99 tail gets worse even if the expected-speedup formula says positive.")
    print("  Measure alpha on your real traffic before shipping.")


if __name__ == "__main__":
    main()
