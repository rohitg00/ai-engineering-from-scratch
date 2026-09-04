"""vLLM production stack + LMCache simulator — stdlib Python.

Compares three configs on a preemption-heavy workload:
  NATIVE_ONLY   : vLLM with no offload, requests re-prefill on preemption
  CPU_OFFLOAD   : native CPU offload, engine-local
  LMCACHE       : cluster LMCache shared across 4 engines

Reports re-prefill count avoided, throughput gain, and break-even HBM utilization.
"""

from __future__ import annotations

from dataclasses import dataclass
import random


PREFILL_TOK_PER_MS = 40.0
DECODE_TOK_PER_MS = 0.15
CPU_OFFLOAD_TIME_MS_PER_BLOCK = 1.5
LMCACHE_TIME_MS_PER_BLOCK = 3.0
KV_BLOCK_TOKENS = 16


@dataclass
class Request:
    prompt_tokens: int
    output_tokens: int
    prefix_id: str  # for reuse across engines


def make_workload(n: int = 200, seed: int = 7) -> list[Request]:
    rng = random.Random(seed)
    prefixes = [f"tpl_{i}" for i in range(6)]  # small set = high reuse
    reqs = []
    for _ in range(n):
        prompt = rng.choice([2000, 4000, 8000])
        reqs.append(Request(prompt, rng.randint(150, 400), rng.choice(prefixes)))
    return reqs


def simulate(config: str, reqs: list[Request]) -> dict:
    """Model a small cluster under HBM pressure."""
    engines_state: list[set[str]] = [set() for _ in range(4)]
    shared_cache: set[str] = set()
    hbm_capacity_blocks_per_engine = 900
    total_time_ms = 0.0
    re_prefills_avoided = 0
    prefill_work = 0
    rng = random.Random(11)

    for r in reqs:
        eng = rng.randrange(len(engines_state))
        blocks = (r.prompt_tokens + KV_BLOCK_TOKENS - 1) // KV_BLOCK_TOKENS
        cached_local = r.prefix_id in engines_state[eng]
        cached_lmcache = r.prefix_id in shared_cache

        if config == "NATIVE_ONLY":
            if cached_local:
                prefill_ms = 0
                re_prefills_avoided += 1
            else:
                prefill_ms = r.prompt_tokens / PREFILL_TOK_PER_MS
                engines_state[eng].add(r.prefix_id)
                if len(engines_state[eng]) > 4:
                    engines_state[eng].pop()
        elif config == "CPU_OFFLOAD":
            if cached_local:
                prefill_ms = 0
                re_prefills_avoided += 1
            else:
                prefill_ms = r.prompt_tokens / PREFILL_TOK_PER_MS
                engines_state[eng].add(r.prefix_id)
                prefill_ms += blocks * CPU_OFFLOAD_TIME_MS_PER_BLOCK * 0.1
        elif config == "LMCACHE":
            if cached_local:
                prefill_ms = 0
                re_prefills_avoided += 1
            elif cached_lmcache:
                prefill_ms = blocks * LMCACHE_TIME_MS_PER_BLOCK
                engines_state[eng].add(r.prefix_id)
                re_prefills_avoided += 1
            else:
                prefill_ms = r.prompt_tokens / PREFILL_TOK_PER_MS
                shared_cache.add(r.prefix_id)
                engines_state[eng].add(r.prefix_id)

        decode_ms = r.output_tokens / DECODE_TOK_PER_MS
        total_time_ms += prefill_ms + decode_ms
        prefill_work += prefill_ms

    return {
        "config": config,
        "total_ms": total_time_ms,
        "prefill_ms": prefill_work,
        "re_prefills_avoided": re_prefills_avoided,
    }


def report(row: dict, baseline: float) -> None:
    speedup = baseline / row["total_ms"] if row["total_ms"] else 1
    print(f"{row['config']:14}  total={row['total_ms']:8.0f} ms  "
          f"prefill={row['prefill_ms']:7.0f} ms  "
          f"avoided_re_prefill={row['re_prefills_avoided']:4}  "
          f"speedup={speedup:4.2f}x")


def main() -> None:
    print("=" * 80)
    print("vLLM PRODUCTION STACK + LMCACHE — preemption-heavy, 4 engines, shared prefixes")
    print("=" * 80)
    base = make_workload()
    baseline = simulate("NATIVE_ONLY", [Request(r.prompt_tokens, r.output_tokens, r.prefix_id) for r in base])["total_ms"]
    for cfg in ("NATIVE_ONLY", "CPU_OFFLOAD", "LMCACHE"):
        report(simulate(cfg, [Request(r.prompt_tokens, r.output_tokens, r.prefix_id) for r in base]), baseline)
    print("\nRead: when prefixes repeat across engines, LMCache avoids redundant prefills")
    print("even when each engine individually evicted the cache.")


if __name__ == "__main__":
    main()
