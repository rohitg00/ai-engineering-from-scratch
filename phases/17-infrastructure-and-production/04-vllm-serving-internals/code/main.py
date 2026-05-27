"""Toy continuous-batching scheduler — stdlib Python.

Simulates four serving modes on the same workload:
  NAIVE            : one request at a time, no batching
  STATIC           : pad to batch boundary, wait for slowest
  CONTINUOUS       : iteration-level admit/release
  CONTINUOUS+CHUNK : continuous + chunked prefill (512-token slices)

Reports throughput (tok / virt-sec), mean TTFT, and P99 ITL so you can
reproduce the shape of the vLLM benchmarks without a GPU. Pedagogical:
the latency constants are illustrative, not measured.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from collections import deque
import random
import statistics


FORWARD_LATENCY_PER_TOKEN = 0.0005   # 0.5 ms per decode token in the batch
PREFILL_LATENCY_PER_TOKEN = 0.00004  # prefill ~12x cheaper per token than decode
BATCH_OVERHEAD = 0.0002              # fixed overhead per forward call
CHUNK_SIZE = 512
KV_BLOCK_SIZE = 16
KV_BLOCKS_AVAILABLE = 1800           # toy KV block budget


@dataclass
class Request:
    req_id: int
    prompt_len: int
    output_len: int
    arrived_at: float
    prefilled: int = 0
    generated: int = 0
    ttft: float | None = None
    last_token_at: float | None = None
    itl_samples: list[float] = field(default_factory=list)

    @property
    def in_prefill(self) -> bool:
        return self.prefilled < self.prompt_len

    @property
    def done(self) -> bool:
        return self.generated >= self.output_len

    def blocks_needed(self) -> int:
        total = self.prompt_len + self.output_len
        return (total + KV_BLOCK_SIZE - 1) // KV_BLOCK_SIZE


def make_workload(n: int = 60, seed: int = 7) -> list[Request]:
    rng = random.Random(seed)
    reqs = []
    now = 0.0
    for i in range(n):
        now += rng.expovariate(40.0)   # ~40 req/s arrival
        prompt_len = rng.choice([128, 256, 512, 2048, 8192])
        out_len = rng.randint(50, 300)
        reqs.append(Request(i, prompt_len, out_len, now))
    return reqs


def report(label: str, reqs: list[Request], sim_end: float) -> None:
    ttfts = [r.ttft - r.arrived_at for r in reqs if r.ttft is not None]
    itls = [dt for r in reqs for dt in r.itl_samples]
    total_out = sum(r.generated for r in reqs)
    throughput = total_out / sim_end if sim_end else 0
    mean_ttft = statistics.mean(ttfts) * 1000 if ttfts else 0
    p99_itl = sorted(itls)[int(0.99 * len(itls)) - 1] * 1000 if itls else 0
    print(f"{label:28}  throughput={throughput:6.0f} tok/s   "
          f"mean_TTFT={mean_ttft:6.1f} ms   "
          f"P99_ITL={p99_itl:5.1f} ms   finished={sum(r.done for r in reqs)}/{len(reqs)}")


def simulate_naive(reqs: list[Request]) -> float:
    """One at a time. Prefill the whole prompt, then decode until done."""
    now = 0.0
    for r in reqs:
        if now < r.arrived_at:
            now = r.arrived_at
        now += r.prompt_len * PREFILL_LATENCY_PER_TOKEN + BATCH_OVERHEAD
        r.prefilled = r.prompt_len
        r.ttft = now
        r.last_token_at = now
        for _ in range(r.output_len):
            prev = r.last_token_at
            now += FORWARD_LATENCY_PER_TOKEN + BATCH_OVERHEAD
            r.generated += 1
            r.itl_samples.append(now - prev)
            r.last_token_at = now
    return now


def simulate_static(reqs: list[Request], batch: int = 16) -> float:
    """Group into fixed batches; wait for the slowest to finish."""
    now = 0.0
    i = 0
    while i < len(reqs):
        window = reqs[i:i + batch]
        i += batch
        now = max(now, max(r.arrived_at for r in window))
        pad_prompt = max(r.prompt_len for r in window)
        pad_output = max(r.output_len for r in window)
        now += pad_prompt * PREFILL_LATENCY_PER_TOKEN + BATCH_OVERHEAD
        for r in window:
            r.prefilled = r.prompt_len
            r.ttft = now
            r.last_token_at = now
        for _ in range(pad_output):
            prev_now = now
            now += FORWARD_LATENCY_PER_TOKEN * len(window) / 16 + BATCH_OVERHEAD
            for r in window:
                if r.generated < r.output_len:
                    r.generated += 1
                    r.itl_samples.append(now - prev_now)
                    r.last_token_at = now
    return now


def simulate_continuous(reqs: list[Request], chunked: bool) -> float:
    waiting = deque(sorted(reqs, key=lambda r: r.arrived_at))
    running: list[Request] = []
    blocks_used = 0
    now = 0.0
    while waiting or running:
        if waiting and running and now < waiting[0].arrived_at and not running:
            now = waiting[0].arrived_at
        while waiting and waiting[0].arrived_at <= now:
            r = waiting[0]
            if blocks_used + r.blocks_needed() > KV_BLOCKS_AVAILABLE:
                break
            blocks_used += r.blocks_needed()
            running.append(waiting.popleft())
        if not running:
            if not waiting:
                break
            now = waiting[0].arrived_at
            continue

        batch_tokens = 0
        prefill_work = 0
        decoded: list[Request] = []
        for r in running:
            if r.in_prefill:
                remaining = r.prompt_len - r.prefilled
                take = min(CHUNK_SIZE if chunked else remaining, remaining)
                r.prefilled += take
                prefill_work += take
                if r.prefilled >= r.prompt_len:
                    r.ttft = now + prefill_work * PREFILL_LATENCY_PER_TOKEN
            else:
                decoded.append(r)
                batch_tokens += 1

        dt = (prefill_work * PREFILL_LATENCY_PER_TOKEN
              + batch_tokens * FORWARD_LATENCY_PER_TOKEN
              + BATCH_OVERHEAD)
        now += dt
        for r in decoded:
            prev = r.last_token_at or r.ttft or now
            r.generated += 1
            r.itl_samples.append(now - prev)
            r.last_token_at = now
            if r.ttft is None:
                r.ttft = now

        finished = [r for r in running if r.done]
        for r in finished:
            blocks_used -= r.blocks_needed()
            running.remove(r)
    return now


def main() -> None:
    print("=" * 80)
    print("TOY vLLM SCHEDULER — four modes on the same 60-request workload")
    print("=" * 80)

    base = make_workload()
    w1 = [Request(r.req_id, r.prompt_len, r.output_len, r.arrived_at) for r in base]
    end = simulate_naive(w1)
    report("NAIVE", w1, end)

    w2 = [Request(r.req_id, r.prompt_len, r.output_len, r.arrived_at) for r in base]
    end = simulate_static(w2)
    report("STATIC (batch=16, padded)", w2, end)

    w3 = [Request(r.req_id, r.prompt_len, r.output_len, r.arrived_at) for r in base]
    end = simulate_continuous(w3, chunked=False)
    report("CONTINUOUS (no chunk)", w3, end)

    w4 = [Request(r.req_id, r.prompt_len, r.output_len, r.arrived_at) for r in base]
    end = simulate_continuous(w4, chunked=True)
    report("CONTINUOUS + CHUNKED", w4, end)

    print()
    print("Read the CONTINUOUS+CHUNKED row. That is what vLLM ships as default.")
    print("The gap between STATIC and CONTINUOUS is the whole reason vLLM exists.")


if __name__ == "__main__":
    main()
