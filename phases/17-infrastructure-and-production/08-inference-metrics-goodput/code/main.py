"""Toy goodput calculator — stdlib Python.

Simulate a population of LLM requests with realistic right-skewed latency,
apply a multi-constraint SLO, compute goodput, and show the GenAI-Perf
vs LLMPerf TPOT calculation divergence on the same trace.
"""

from __future__ import annotations

import random
import statistics
from dataclasses import dataclass


@dataclass
class RequestTrace:
    queue_ms: float
    prefill_ms: float
    decode_ms_per_token: list[float]      # per-token decode latency
    output_tokens: int

    @property
    def ttft_ms(self) -> float:
        return self.queue_ms + self.prefill_ms

    @property
    def e2e_ms(self) -> float:
        return self.ttft_ms + sum(self.decode_ms_per_token)

    def tpot_llmperf(self) -> float:
        """LLMPerf: include TTFT in ITL calculation."""
        return self.e2e_ms / self.output_tokens

    def tpot_genaiperf(self) -> float:
        """GenAI-Perf: ITL starts from token 2."""
        if self.output_tokens <= 1:
            return 0.0
        return sum(self.decode_ms_per_token) / (self.output_tokens - 1)


def synth_workload(n: int = 1000, seed: int = 7, tail_spike_rate: float = 0.02) -> list[RequestTrace]:
    rng = random.Random(seed)
    traces = []
    for _ in range(n):
        prompt_len = rng.choice([128, 256, 512, 2048, 8192])
        output_tokens = rng.randint(50, 300)
        queue = rng.expovariate(1 / 40.0)           # avg 40 ms queue
        prefill = prompt_len * 0.05                 # ~50 us per input token
        decode_base = 7.0                            # 7 ms mean TPOT
        decodes = []
        for _ in range(output_tokens):
            t = max(1.5, rng.gauss(decode_base, decode_base * 0.15))
            if rng.random() < tail_spike_rate:
                t *= rng.uniform(3, 8)              # tail spike
            decodes.append(t)
        traces.append(RequestTrace(queue, prefill, decodes, output_tokens))
    return traces


def percentiles(values: list[float], ps: list[float]) -> list[float]:
    s = sorted(values)
    return [s[min(len(s) - 1, int(p * len(s)))] for p in ps]


def report_latency(label: str, traces: list[RequestTrace]) -> None:
    ttft = [t.ttft_ms for t in traces]
    tpot_llm = [t.tpot_llmperf() for t in traces]
    tpot_nv = [t.tpot_genaiperf() for t in traces]
    e2e = [t.e2e_ms for t in traces]

    p50_ttft, p90_ttft, p99_ttft = percentiles(ttft, [0.5, 0.9, 0.99])
    p50_tpot, p90_tpot, p99_tpot = percentiles(tpot_nv, [0.5, 0.9, 0.99])
    p50_e2e, p90_e2e, p99_e2e = percentiles(e2e, [0.5, 0.9, 0.99])

    print(f"{label}")
    print("-" * 76)
    print(f"  TTFT (ms)     P50={p50_ttft:7.1f}  P90={p90_ttft:7.1f}  P99={p99_ttft:7.1f}  mean={statistics.mean(ttft):7.1f}")
    print(f"  TPOT (ms)     P50={p50_tpot:7.2f}  P90={p90_tpot:7.2f}  P99={p99_tpot:7.2f}  mean={statistics.mean(tpot_nv):7.2f}")
    print(f"  E2E  (ms)     P50={p50_e2e:7.1f}  P90={p90_e2e:7.1f}  P99={p99_e2e:7.1f}")
    print(f"  Tool trap     GenAI-Perf mean TPOT={statistics.mean(tpot_nv):6.2f}  "
          f"LLMPerf mean TPOT={statistics.mean(tpot_llm):6.2f}  "
          f"delta={statistics.mean(tpot_llm) - statistics.mean(tpot_nv):+5.2f} ms")


def goodput(traces: list[RequestTrace], slo_ttft: float, slo_tpot: float,
            slo_e2e: float) -> float:
    good = 0
    for t in traces:
        if t.ttft_ms <= slo_ttft and t.tpot_genaiperf() <= slo_tpot and t.e2e_ms <= slo_e2e:
            good += 1
    return good / len(traces)


def main() -> None:
    print("=" * 78)
    print("TOY GOODPUT CALCULATOR — inference SLOs and the measurement trap")
    print("=" * 78)
    print()

    traces = synth_workload(n=2000)
    report_latency("Synthetic workload (2000 requests)", traces)
    print()

    slos = [
        ("loose   TTFT<800 TPOT<25 E2E<3000", 800, 25, 3000),
        ("target  TTFT<500 TPOT<15 E2E<2000", 500, 15, 2000),
        ("tight   TTFT<300 TPOT<10 E2E<1500", 300, 10, 1500),
    ]
    print("Goodput under three SLO profiles")
    print("-" * 76)
    for label, t1, t2, t3 in slos:
        g = goodput(traces, t1, t2, t3)
        tag = "  SHIPPABLE" if g >= 0.99 else ("  DEGRADED" if g >= 0.95 else "  FAILING")
        print(f"  {label}  goodput={g:6.2%}{tag}")

    print()
    print("=" * 78)
    print("KEY FINDING")
    print("-" * 78)
    print("  Mean TPOT ~7 ms looks great. P99 TPOT ~25-40 ms tells the real story.")
    print("  Tighten the SLO and goodput collapses from 99% -> 80%+. Users feel P99.")
    print("  GenAI-Perf vs LLMPerf disagree by ~1 ms on mean TPOT — cite the tool.")


if __name__ == "__main__":
    main()
