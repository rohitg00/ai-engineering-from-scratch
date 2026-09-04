"""Prompt caching accountant.

Simulates three provider caching regimes (Anthropic ephemeral 5m, Anthropic 1h,
OpenAI automatic, Gemini explicit) against a stream of requests and reports
write/read/miss counts plus blended cost per 1K requests.

Prices below are the April 2026 published rates for input tokens on the
provider's frontier model. Override by editing PRICES.

Run with:
    python main.py
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable


# Input-token prices, USD per 1K tokens --------------------------------------

PRICES = {
    "anthropic_claude_opus_4_7": {"base": 0.015, "cache_write_5m": 0.01875, "cache_write_1h": 0.030, "cache_read": 0.0015},
    "openai_gpt_5": {"base": 0.005, "cache_write": 0.005, "cache_read": 0.0025},
    "gemini_3_pro": {"base": 0.00125, "cache_write": 0.00125, "cache_read": 0.0003125, "storage_per_1k_per_hour": 0.0000125},
}


@dataclass
class Request:
    """A single request. `prefix_tokens` is the cacheable prefix; `suffix_tokens` is user input."""

    prefix_tokens: int
    suffix_tokens: int
    prefix_key: str


@dataclass
class CacheEntry:
    tokens: int
    written_at: int  # request index
    ttl_seconds: int


@dataclass
class ProviderStats:
    writes: int = 0
    reads: int = 0
    misses: int = 0
    input_cost: float = 0.0
    storage_cost: float = 0.0

    @property
    def total_cost(self) -> float:
        return self.input_cost + self.storage_cost


def simulate_anthropic(requests: Iterable[Request], ttl_seconds: int, seconds_between: int) -> ProviderStats:
    p = PRICES["anthropic_claude_opus_4_7"]
    write_rate = p["cache_write_1h"] if ttl_seconds > 300 else p["cache_write_5m"]
    stats = ProviderStats()
    cache: dict[str, CacheEntry] = {}
    for i, r in enumerate(requests):
        now_seconds = i * seconds_between
        entry = cache.get(r.prefix_key)
        expired = entry is None or (now_seconds - entry.written_at) >= entry.ttl_seconds
        if expired:
            stats.writes += 1
            stats.input_cost += (r.prefix_tokens / 1000) * write_rate
            cache[r.prefix_key] = CacheEntry(tokens=r.prefix_tokens, written_at=now_seconds, ttl_seconds=ttl_seconds)
        else:
            stats.reads += 1
            stats.input_cost += (r.prefix_tokens / 1000) * p["cache_read"]
        stats.input_cost += (r.suffix_tokens / 1000) * p["base"]
    return stats


def simulate_openai(requests: Iterable[Request], seconds_between: int) -> ProviderStats:
    """OpenAI's cache is automatic; we model it as always-on with 1h best-effort TTL."""
    p = PRICES["openai_gpt_5"]
    stats = ProviderStats()
    cache: dict[str, CacheEntry] = {}
    for i, r in enumerate(requests):
        now_seconds = i * seconds_between
        entry = cache.get(r.prefix_key)
        expired = entry is None or (now_seconds - entry.written_at) >= 3600
        if expired:
            stats.writes += 1
            stats.input_cost += (r.prefix_tokens / 1000) * p["cache_write"]
            cache[r.prefix_key] = CacheEntry(tokens=r.prefix_tokens, written_at=now_seconds, ttl_seconds=3600)
        else:
            stats.reads += 1
            stats.input_cost += (r.prefix_tokens / 1000) * p["cache_read"]
        stats.input_cost += (r.suffix_tokens / 1000) * p["base"]
    return stats


def simulate_gemini(requests: Iterable[Request], ttl_seconds: int, seconds_between: int) -> ProviderStats:
    p = PRICES["gemini_3_pro"]
    stats = ProviderStats()
    cache: dict[str, CacheEntry] = {}
    for i, r in enumerate(requests):
        now_seconds = i * seconds_between
        entry = cache.get(r.prefix_key)
        expired = entry is None or (now_seconds - entry.written_at) >= entry.ttl_seconds
        if expired:
            stats.writes += 1
            stats.input_cost += (r.prefix_tokens / 1000) * p["cache_write"]
            cache[r.prefix_key] = CacheEntry(tokens=r.prefix_tokens, written_at=now_seconds, ttl_seconds=ttl_seconds)
        else:
            stats.reads += 1
            stats.input_cost += (r.prefix_tokens / 1000) * p["cache_read"]
        stats.input_cost += (r.suffix_tokens / 1000) * p["base"]
    # Storage cost: each entry lives for ttl, billed per token-hour
    for entry in cache.values():
        hours = entry.ttl_seconds / 3600
        stats.storage_cost += (entry.tokens / 1000) * p["storage_per_1k_per_hour"] * hours
    return stats


def baseline_cost(requests: list[Request], provider: str) -> float:
    p = PRICES[provider]
    return sum((r.prefix_tokens + r.suffix_tokens) / 1000 * p["base"] for r in requests)


def make_traffic(n_requests: int, n_prefixes: int, prefix_size: int, suffix_size: int) -> list[Request]:
    return [
        Request(
            prefix_tokens=prefix_size,
            suffix_tokens=suffix_size,
            prefix_key=f"prefix_{i % n_prefixes}",
        )
        for i in range(n_requests)
    ]


def print_report(name: str, stats: ProviderStats, baseline: float, n: int) -> None:
    savings = 1 - (stats.total_cost / baseline) if baseline > 0 else 0
    print(f"\n{name}")
    print(f"  writes {stats.writes:>5}  reads {stats.reads:>5}  misses {stats.misses:>5}")
    print(f"  input cost  ${stats.input_cost:>7.4f}")
    if stats.storage_cost:
        print(f"  storage     ${stats.storage_cost:>7.4f}")
    print(f"  vs no-cache ${baseline:>7.4f}  ->  saves {savings*100:>5.1f}%")
    print(f"  per 1K req  ${stats.total_cost * 1000 / n:>7.4f}")


def main() -> None:
    traffic = make_traffic(n_requests=500, n_prefixes=3, prefix_size=15000, suffix_size=400)
    seconds_between = 4  # one request every 4 seconds

    anthro_5m = simulate_anthropic(traffic, ttl_seconds=300, seconds_between=seconds_between)
    anthro_1h = simulate_anthropic(traffic, ttl_seconds=3600, seconds_between=seconds_between)
    openai = simulate_openai(traffic, seconds_between=seconds_between)
    gemini = simulate_gemini(traffic, ttl_seconds=3600, seconds_between=seconds_between)

    print(f"Scenario: 500 requests, 3 rotating prefixes (15K tok each), 4s apart\n")

    print_report("Anthropic Claude Opus 4.7 (5-min TTL)", anthro_5m, baseline_cost(traffic, "anthropic_claude_opus_4_7"), len(traffic))
    print_report("Anthropic Claude Opus 4.7 (1-hour TTL)", anthro_1h, baseline_cost(traffic, "anthropic_claude_opus_4_7"), len(traffic))
    print_report("OpenAI GPT-5 (automatic)", openai, baseline_cost(traffic, "openai_gpt_5"), len(traffic))
    print_report("Gemini 3 Pro (explicit, 1-hour)", gemini, baseline_cost(traffic, "gemini_3_pro"), len(traffic))


if __name__ == "__main__":
    main()
