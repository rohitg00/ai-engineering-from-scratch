"""AI gateway routing + fallback simulator — stdlib Python.

Models a gateway fronting OpenAI, Anthropic, and self-hosted. Injects 429/5xx
errors per provider. Compares fallback strategies.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import random


@dataclass
class Provider:
    name: str
    base_latency_ms: float
    error_rate: float
    overhead_ms: float


PROVIDERS = [
    Provider("OpenAI",       180, 0.03, 0),
    Provider("Anthropic",    220, 0.02, 0),
    Provider("Self-hosted",  100, 0.05, 0),
]

GATEWAY_OVERHEAD = {
    "LiteLLM": 10,
    "Portkey": 30,
    "Kong":      5,
    "Cloudflare": 2,
}


def call_provider(p: Provider, rng: random.Random) -> tuple[bool, float]:
    if rng.random() < p.error_rate:
        return False, p.base_latency_ms * 0.3  # half-done before error
    return True, p.base_latency_ms


def simulate_fallback(gateway: str, n: int = 1000, seed: int = 7) -> dict:
    rng = random.Random(seed)
    success = 0
    total_latency = 0.0
    retries = 0
    fallback_hits = 0
    gw_ovh = GATEWAY_OVERHEAD[gateway]

    for _ in range(n):
        req_latency = gw_ovh
        done = False
        for attempt, p in enumerate(PROVIDERS):
            ok, ms = call_provider(p, rng)
            req_latency += ms
            if attempt > 0:
                fallback_hits += 1
            if ok:
                success += 1
                done = True
                break
            retries += 1
        total_latency += req_latency

    return {
        "gateway": gateway,
        "success_rate": success / n,
        "mean_latency": total_latency / n,
        "retries": retries,
        "fallback_hits": fallback_hits,
    }


def report(row: dict) -> None:
    print(f"{row['gateway']:12}  success={row['success_rate']*100:5.1f}%  "
          f"mean_latency={row['mean_latency']:6.0f}ms  "
          f"retries={row['retries']:4}  fallbacks={row['fallback_hits']:4}")


def main() -> None:
    print("=" * 80)
    print("AI GATEWAY FALLBACK — 3-provider chain under error injection")
    print("=" * 80)
    header = f"{'Gateway':12}  {'Success':>7}         {'mean latency':>12}  retries  fallbacks"
    print(header)
    print("-" * len(header))
    for gw in ("LiteLLM", "Portkey", "Kong", "Cloudflare"):
        report(simulate_fallback(gw))

    print("\nNotes: a single-provider target at 3% error rate → 97% success.")
    print("Two-provider fallback → 99.94% success (complement of 0.03 × 0.02).")
    print("Three-provider fallback → 99.997% success. Latency rises on fallback.")


if __name__ == "__main__":
    main()
