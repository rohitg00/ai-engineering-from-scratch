"""Toy Blackwell + TRT-LLM economics calculator — stdlib Python.

Computes HBM footprint and decode throughput for a model under three stacks:
  H100 + BF16 + vLLM
  H100 + FP8 + vLLM
  B200 + NVFP4 weights / FP8 KV + TRT-LLM + Dynamo
  GB200 NVL72 + NVFP4 / FP8 + TRT-LLM + Dynamo

The decode-throughput model is memory-bandwidth-limited: tokens/sec is
proportional to HBM-bandwidth / bytes-per-token. Numbers are pedagogical
illustrations of the shape of the 2026 Blackwell economics.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Stack:
    name: str
    hbm_gb: int               # per-GPU HBM
    hbm_bw_tbs: float         # HBM bandwidth in TB/s
    weight_bits: float        # effective weight precision
    kv_bits: float            # KV cache precision
    mtp_factor: float         # 1.0 = no draft, 1.8 = MTP on
    disagg_factor: float      # additional throughput from disaggregation
    price_per_gpu_hour: float


STACKS = [
    Stack("H100 + BF16 + vLLM",           80, 3.35,  16, 16, 1.0,  1.0,  2.50),
    Stack("H100 + FP8 + vLLM",            80, 3.35,   8,  8, 1.0,  1.0,  2.50),
    Stack("H200 + FP8 + vLLM",           141, 4.80,   8,  8, 1.0,  1.0,  3.50),
    Stack("B200 + NVFP4 + FP8 + TRT-LLM", 192, 8.00,   4,  8, 1.8,  1.6,  4.80),
    Stack("GB200 NVL72 + TRT-LLM + Dyn", 192, 8.00,   4,  8, 1.8,  2.5,  6.20),
]


def hbm_footprint_gb(params_b: float, active_b: float, seq_len: int, stack: Stack) -> tuple[float, float]:
    weight_gb = params_b * stack.weight_bits / 8
    # KV cache for a typical head config: num_layers * 2 * num_kv_heads * head_dim * seq_len * bytes/element
    # Use a representative 70B shape scaled by active param size
    layers = 64 * (active_b / 35.0)**0.5
    kv_heads = 8
    head_dim = 128
    kv_gb = layers * 2 * kv_heads * head_dim * seq_len * (stack.kv_bits / 8) / 1e9
    return weight_gb, kv_gb


def decode_throughput(active_b: float, stack: Stack) -> float:
    """Tokens per second per GPU, memory-bandwidth-limited.
    Each decoded token reads `active_b * weight_bits/8` bytes of weights.
    """
    bytes_per_token = active_b * 1e9 * stack.weight_bits / 8
    raw_tokens_per_s = stack.hbm_bw_tbs * 1e12 / bytes_per_token
    return raw_tokens_per_s * stack.mtp_factor * stack.disagg_factor


def cost_per_million_tokens(active_b: float, stack: Stack) -> float:
    tps = decode_throughput(active_b, stack)
    tokens_per_hour = tps * 3600
    return stack.price_per_gpu_hour / tokens_per_hour * 1e6


def print_stack(params_b: float, active_b: float, seq_len: int = 8192) -> None:
    print(f"Model: {params_b}B total, {active_b}B active, {seq_len:,} tokens context")
    print("-" * 90)
    print(f"{'stack':40} {'W GB':>7} {'KV GB':>7} {'tok/s':>9} {'$/M tok':>10}")
    for s in STACKS:
        w, kv = hbm_footprint_gb(params_b, active_b, seq_len, s)
        tps = decode_throughput(active_b, s)
        cost = cost_per_million_tokens(active_b, s)
        fits = "" if (w + kv) <= s.hbm_gb else "  (multi-GPU)"
        print(f"{s.name:40} {w:7.1f} {kv:7.2f} {tps:9.0f} {cost:10.4f}{fits}")
    print()


def main() -> None:
    print("=" * 90)
    print("TOY BLACKWELL + TRT-LLM ECONOMICS — memory-bandwidth-limited decode")
    print("=" * 90)
    print()

    print_stack(70, 70)    # dense 70B
    print_stack(120, 36)   # GPT-OSS-120B MoE (30% active)
    print_stack(405, 405)  # Llama 3.1 405B dense
    print_stack(671, 37)   # DeepSeek-V3 scale MoE

    print("=" * 90)
    print("KEY FINDING")
    print("-" * 90)
    print("  The 7x cost gap stacks from four sources:")
    print("    1. HBM bandwidth (H100 3.35 TB/s vs B200 8.0 TB/s) ~2.4x")
    print("    2. NVFP4 weights (half the bytes per token)       ~2.0x")
    print("    3. MTP draft (~1.8x on accepted tokens)           ~1.8x")
    print("    4. Disaggregation (Dynamo: ~1.6-2.5x)             ~2.0x")
    print("  Product ~14x raw, closer to 7x after overhead and real-traffic alpha.")
    print("  Validate NVFP4 quality before migrating reasoning-heavy workloads.")


if __name__ == "__main__":
    main()
