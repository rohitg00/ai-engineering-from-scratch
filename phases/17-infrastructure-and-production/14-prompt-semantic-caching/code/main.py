"""Two-layer caching simulator — stdlib Python.

Models L1 (semantic) + L2 (prompt-prefix) caching on a mixed workload.
Reports bill, hit rates, and the parallelization penalty.
"""

from __future__ import annotations

from dataclasses import dataclass
import random


BASE_INPUT = 3.00       # $/M input tokens (Claude Sonnet-class)
BASE_OUTPUT = 15.00     # $/M output tokens
CACHED_INPUT = 0.30     # 10x cheaper read
CACHE_WRITE_5MIN = 1.25 * BASE_INPUT  # write premium 5-min TTL
CACHE_WRITE_1HR = 2.00 * BASE_INPUT   # write premium 1-hour TTL


@dataclass
class Request:
    prompt_tokens: int
    prefix_hash: str
    is_parallel_wave: bool
    arrived_at: float


@dataclass
class Config:
    l1_enabled: bool
    l2_enabled: bool
    parallel_penalty: bool  # N parallel arrivals miss cache together
    l1_threshold: float
    l1_hit_prob: float
    ttl: str                # "5min" or "1hr"


def make_workload(n: int = 500, seed: int = 7) -> list[Request]:
    rng = random.Random(seed)
    reqs = []
    prefixes = [f"prefix_{i}" for i in range(12)]
    now = 0.0
    for i in range(n):
        # 60% individual arrivals, 40% parallel waves of 5
        if rng.random() < 0.4:
            for _ in range(5):
                reqs.append(Request(rng.choice([2000, 4000, 8000]),
                                    rng.choice(prefixes), True, now))
            now += rng.uniform(0.1, 2.0)
        else:
            reqs.append(Request(rng.choice([2000, 4000, 8000]),
                                rng.choice(prefixes), False, now))
            now += rng.uniform(0.1, 2.0)
    return reqs


def simulate(reqs: list[Request], cfg: Config) -> dict:
    l2_cache: set[str] = set()
    l2_writes = 0
    l2_reads = 0
    l1_hits = 0
    cost = 0.0
    rng = random.Random(11)

    for r in reqs:
        if cfg.l1_enabled and rng.random() < cfg.l1_hit_prob:
            l1_hits += 1
            continue

        if cfg.l2_enabled:
            if r.prefix_hash in l2_cache:
                l2_reads += 1
                cost += (r.prompt_tokens / 1e6) * CACHED_INPUT
            else:
                if cfg.parallel_penalty and r.is_parallel_wave:
                    write_cost = CACHE_WRITE_5MIN if cfg.ttl == "5min" else CACHE_WRITE_1HR
                    cost += (r.prompt_tokens / 1e6) * write_cost
                    l2_writes += 1
                else:
                    write_cost = CACHE_WRITE_5MIN if cfg.ttl == "5min" else CACHE_WRITE_1HR
                    cost += (r.prompt_tokens / 1e6) * write_cost
                    l2_cache.add(r.prefix_hash)
                    l2_writes += 1
        else:
            cost += (r.prompt_tokens / 1e6) * BASE_INPUT

        cost += (200 / 1e6) * BASE_OUTPUT

    return {
        "cost": cost,
        "l1_hits": l1_hits,
        "l2_reads": l2_reads,
        "l2_writes": l2_writes,
    }


def report(label: str, cfg: Config, reqs: list[Request]) -> None:
    res = simulate(reqs, cfg)
    print(f"{label:45}  cost=${res['cost']:7.2f}  "
          f"L1={res['l1_hits']:4}  L2_reads={res['l2_reads']:4}  L2_writes={res['l2_writes']:4}")


def main() -> None:
    print("=" * 95)
    print("PROMPT + SEMANTIC CACHING — 500 requests, Claude Sonnet-class pricing")
    print("=" * 95)
    base = make_workload()
    reqs = [Request(r.prompt_tokens, r.prefix_hash, r.is_parallel_wave, r.arrived_at) for r in base]

    report("NO CACHING",
           Config(l1_enabled=False, l2_enabled=False, parallel_penalty=True, l1_threshold=0.95, l1_hit_prob=0.0, ttl="5min"),
           reqs)
    report("L2 5-min, parallel penalty active",
           Config(l1_enabled=False, l2_enabled=True, parallel_penalty=True, l1_threshold=0.95, l1_hit_prob=0.0, ttl="5min"),
           reqs)
    report("L2 5-min, parallel fixed (serialize first)",
           Config(l1_enabled=False, l2_enabled=True, parallel_penalty=False, l1_threshold=0.95, l1_hit_prob=0.0, ttl="5min"),
           reqs)
    report("L2 1-hour + L1 semantic 30%",
           Config(l1_enabled=True, l2_enabled=True, parallel_penalty=False, l1_threshold=0.95, l1_hit_prob=0.30, ttl="1hr"),
           reqs)
    report("L2 1-hour + L1 semantic 70% (structured FAQ)",
           Config(l1_enabled=True, l2_enabled=True, parallel_penalty=False, l1_threshold=0.95, l1_hit_prob=0.70, ttl="1hr"),
           reqs)

    print("\nRead: caching is a protocol. Structure your prompts and batching for it to pay off.")


if __name__ == "__main__":
    main()
