"""Cache-aware multi-region router simulator — stdlib Python.

Three strategies on the same workload:
  ROUND_ROBIN : blind, ignores KV cache state
  REGIONAL    : cache-aware within region; round-robin across regions
  GLOBAL      : cache-aware globally; considers network RTT

Reports cache hit rate, TTFT P50/P99, and cross-region bill.
Pedagogical: timings are illustrative.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import random
import statistics


REGIONS = ["us-east-1", "us-west-2", "eu-west-1"]
REPLICAS_PER_REGION = 4
CACHE_HIT_MS = 80
CACHE_MISS_MS = 800
CROSSREGION_RTT = {
    ("us-east-1", "us-west-2"): 65,
    ("us-east-1", "eu-west-1"): 75,
    ("us-west-2", "eu-west-1"): 130,
}
CROSSREGION_COST_PER_REQ = 0.0004


def rtt(a: str, b: str) -> int:
    if a == b:
        return 0
    key = (a, b) if (a, b) in CROSSREGION_RTT else (b, a)
    return CROSSREGION_RTT.get(key, 200)


@dataclass
class Replica:
    region: str
    idx: int
    prefix_cache: set = field(default_factory=set)
    queue_depth: int = 0


@dataclass
class Request:
    origin_region: str
    prefix_hash: str
    served_by: Replica | None = None
    ttft_ms: float = 0
    crossregion: bool = False


def make_replicas() -> list[Replica]:
    return [Replica(r, i) for r in REGIONS for i in range(REPLICAS_PER_REGION)]


def make_workload(n: int = 1000, seed: int = 7) -> list[Request]:
    rng = random.Random(seed)
    reqs = []
    hot_prefixes = [f"prefix_{i}" for i in range(40)]
    for _ in range(n):
        origin = rng.choice(REGIONS)
        prefix = rng.choice(hot_prefixes)
        reqs.append(Request(origin_region=origin, prefix_hash=prefix))
    return reqs


def simulate(strategy: str, reqs: list[Request]) -> dict:
    replicas = make_replicas()
    rng = random.Random(11)
    hits = 0
    ttfts: list[float] = []
    crossregion_count = 0

    for i, r in enumerate(reqs):
        chosen: Replica | None = None
        cross = False

        if strategy == "ROUND_ROBIN":
            chosen = replicas[i % len(replicas)]
        elif strategy == "REGIONAL":
            local = [rep for rep in replicas if rep.region == r.origin_region]
            matches = [rep for rep in local if r.prefix_hash in rep.prefix_cache]
            if matches:
                chosen = min(matches, key=lambda x: x.queue_depth)
            else:
                chosen = min(local, key=lambda x: x.queue_depth)
        elif strategy == "GLOBAL":
            matches = [rep for rep in replicas if r.prefix_hash in rep.prefix_cache]
            best_cost = float("inf")
            for rep in matches:
                c = CACHE_HIT_MS + rtt(r.origin_region, rep.region)
                if c < best_cost:
                    best_cost = c
                    chosen = rep
            if chosen is None or best_cost > CACHE_MISS_MS:
                local = [rep for rep in replicas if rep.region == r.origin_region]
                chosen = min(local, key=lambda x: x.queue_depth)

        cross = chosen.region != r.origin_region
        hit = r.prefix_hash in chosen.prefix_cache
        if hit:
            hits += 1
            r.ttft_ms = CACHE_HIT_MS + rtt(r.origin_region, chosen.region)
        else:
            r.ttft_ms = CACHE_MISS_MS + rtt(r.origin_region, chosen.region)
            chosen.prefix_cache.add(r.prefix_hash)
            if len(chosen.prefix_cache) > 12:
                chosen.prefix_cache.pop()
        chosen.queue_depth = max(0, chosen.queue_depth + (1 if rng.random() < 0.4 else 0) - 1)
        r.served_by = chosen
        r.crossregion = cross
        ttfts.append(r.ttft_ms)
        if cross:
            crossregion_count += 1

    ttfts.sort()
    p50 = ttfts[len(ttfts) // 2]
    p99 = ttfts[int(len(ttfts) * 0.99) - 1]
    return {
        "strategy": strategy,
        "hit_rate": hits / len(reqs),
        "mean_ttft": statistics.mean(ttfts),
        "p50_ttft": p50,
        "p99_ttft": p99,
        "crossregion": crossregion_count,
        "crossregion_cost": crossregion_count * CROSSREGION_COST_PER_REQ,
    }


def report(row: dict) -> None:
    print(f"{row['strategy']:13}  hit={row['hit_rate']*100:5.1f}%  "
          f"mean={row['mean_ttft']:5.0f}ms  P50={row['p50_ttft']:5.0f}ms  "
          f"P99={row['p99_ttft']:5.0f}ms  cross={row['crossregion']:4}  "
          f"cross_cost=${row['crossregion_cost']:.3f}")


def main() -> None:
    print("=" * 80)
    print("MULTI-REGION LLM ROUTING — three strategies, 1000 requests")
    print("=" * 80)
    base = make_workload()
    header = f"{'Strategy':13}  hit         mean     P50      P99      cross   cost"
    print(header)
    print("-" * len(header))
    for strategy in ("ROUND_ROBIN", "REGIONAL", "GLOBAL"):
        reqs = [Request(origin_region=r.origin_region, prefix_hash=r.prefix_hash) for r in base]
        report(simulate(strategy, reqs))

    print("\nRead: REGIONAL beats ROUND_ROBIN on cache hit. GLOBAL is")
    print("only better when prefill cost dominates network latency.")


if __name__ == "__main__":
    main()
