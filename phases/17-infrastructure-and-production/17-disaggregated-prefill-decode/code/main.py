"""Colocated vs disaggregated serving simulator — stdlib Python.

Models one request through colocated (same GPU) vs disaggregated (prefill pool + decode pool + KV transfer).
Sweeps prompt length to find the crossover.
"""

from __future__ import annotations


# illustrative 2026 constants for 70B FP8 on H100 class
PREFILL_TOK_PER_MS = 40.0         # prefill throughput per GPU per ms
DECODE_TOK_PER_MS_COLOCATED = 0.10
DECODE_TOK_PER_MS_DECODE_GPU = 0.18   # memory-optimized pool (H200-like)
KV_BYTES_PER_TOKEN_70B_FP8 = 125_000
NIXL_RDMA_GB_S = 100
NIXL_TCP_GB_S = 10


def ms_colocated(prompt: int, output: int) -> float:
    prefill_ms = prompt / PREFILL_TOK_PER_MS
    decode_ms = output / DECODE_TOK_PER_MS_COLOCATED
    return prefill_ms + decode_ms


def ms_disaggregated(prompt: int, output: int, use_rdma: bool = True) -> float:
    prefill_ms = prompt / PREFILL_TOK_PER_MS
    kv_bytes = prompt * KV_BYTES_PER_TOKEN_70B_FP8
    transport = NIXL_RDMA_GB_S if use_rdma else NIXL_TCP_GB_S
    transfer_ms = (kv_bytes / 1e9) / transport * 1000
    decode_ms = output / DECODE_TOK_PER_MS_DECODE_GPU
    return prefill_ms + transfer_ms + decode_ms


def main() -> None:
    print("=" * 95)
    print("DISAGGREGATED vs COLOCATED — same request, different GPU placement")
    print("=" * 95)
    header = f"{'prompt':>7}  {'output':>7}  {'colocated (ms)':>15}  {'disagg RDMA (ms)':>17}  {'disagg TCP (ms)':>16}  Winner"
    print(header)
    print("-" * len(header))
    cases = [
        (256, 100), (512, 200), (1024, 300), (2048, 400),
        (4096, 500), (8192, 800), (16384, 1200), (32768, 2000),
    ]
    for prompt, output in cases:
        colo = ms_colocated(prompt, output)
        rdma = ms_disaggregated(prompt, output, use_rdma=True)
        tcp = ms_disaggregated(prompt, output, use_rdma=False)
        winner = "colocated" if colo < rdma else "disaggregated"
        print(f"{prompt:>7}  {output:>7}  {colo:>14.1f}  {rdma:>17.1f}  {tcp:>16.1f}  {winner}")

    print()
    print("Read: disaggregation wins at longer prompts where decode throughput improvement")
    print("on memory-optimized pool outweighs the KV transfer tax. TCP transport raises the")
    print("break-even; RDMA makes disaggregation profitable earlier.")


if __name__ == "__main__":
    main()
