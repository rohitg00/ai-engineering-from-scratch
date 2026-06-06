"""Jamba / Mamba-3 memory calculator — stdlib Python.

Computes KV cache, SSM state, and total attention-layer memory for a range
of hybrid configurations: pure Transformer, Jamba 1:7, 1:3, 1:15, and pure
SSM. Prints the comparison at 8k, 64k, 128k, 256k context.

Numbers are illustrative, not exact production memory budgets. The point is
to show why the hybrid ratio matters and where Jamba's 256k-on-80GB claim
comes from.
"""

from __future__ import annotations

from dataclasses import dataclass


BYTES_BF16 = 2
BYTES_FP8 = 1


@dataclass
class HybridConfig:
    name: str
    total_layers: int
    attn_layers: int
    hidden: int
    n_q_heads: int
    n_kv_heads: int
    head_dim: int
    ssm_state_size: int


def kv_cache_bytes(cfg: HybridConfig, ctx: int, bytes_per_elem: int) -> int:
    return (2 * cfg.attn_layers * cfg.n_kv_heads * cfg.head_dim * ctx
            * bytes_per_elem)


def ssm_state_bytes(cfg: HybridConfig, bytes_per_elem: int) -> int:
    ssm_layers = cfg.total_layers - cfg.attn_layers
    return ssm_layers * cfg.hidden * cfg.ssm_state_size * bytes_per_elem


def fmt_bytes(b: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if b < 1024:
            return f"{b:.2f}{unit}"
        b /= 1024
    return f"{b:.2f}PB"


def main() -> None:
    print("=" * 74)
    print("JAMBA HYBRID SSM-TRANSFORMER MEMORY CALCULATOR (Phase 10, Lesson 21)")
    print("=" * 74)
    print()

    configs = [
        HybridConfig(
            name="pure Transformer 32L",
            total_layers=32, attn_layers=32,
            hidden=4096, n_q_heads=32, n_kv_heads=32, head_dim=128,
            ssm_state_size=0,
        ),
        HybridConfig(
            name="pure Transformer 32L (GQA 8)",
            total_layers=32, attn_layers=32,
            hidden=4096, n_q_heads=32, n_kv_heads=8, head_dim=128,
            ssm_state_size=0,
        ),
        HybridConfig(
            name="Jamba 1:7 hybrid 32L",
            total_layers=32, attn_layers=4,
            hidden=4096, n_q_heads=32, n_kv_heads=32, head_dim=128,
            ssm_state_size=16,
        ),
        HybridConfig(
            name="Jamba 1:3 hybrid 32L",
            total_layers=32, attn_layers=8,
            hidden=4096, n_q_heads=32, n_kv_heads=32, head_dim=128,
            ssm_state_size=16,
        ),
        HybridConfig(
            name="Jamba 1:15 hybrid 32L",
            total_layers=32, attn_layers=2,
            hidden=4096, n_q_heads=32, n_kv_heads=32, head_dim=128,
            ssm_state_size=16,
        ),
        HybridConfig(
            name="pure Mamba 32L",
            total_layers=32, attn_layers=0,
            hidden=4096, n_q_heads=0, n_kv_heads=0, head_dim=128,
            ssm_state_size=16,
        ),
    ]

    contexts = [8_192, 65_536, 131_072, 262_144]

    print("-" * 74)
    print("Memory at BF16 (2 bytes per element)")
    print("-" * 74)
    header = "  " + "config".ljust(32)
    for ctx in contexts:
        header += f"{ctx // 1000}k".rjust(10)
    print(header)
    for cfg in configs:
        row = "  " + cfg.name.ljust(32)
        for ctx in contexts:
            kv = kv_cache_bytes(cfg, ctx, BYTES_BF16)
            ss = ssm_state_bytes(cfg, BYTES_BF16)
            total = kv + ss
            row += fmt_bytes(total).rjust(10)
        print(row)
    print()

    print("-" * 74)
    print("Headline savings at 256k context (BF16), vs pure Transformer full-MHA")
    print("-" * 74)
    baseline = kv_cache_bytes(configs[0], 262_144, BYTES_BF16)
    for cfg in configs:
        kv = kv_cache_bytes(cfg, 262_144, BYTES_BF16)
        ss = ssm_state_bytes(cfg, BYTES_BF16)
        total = kv + ss
        savings = (1 - total / baseline) * 100
        print(f"  {cfg.name:<32} total {fmt_bytes(total):>10}  "
              f"({savings:+.1f}% vs baseline)")
    print()

    print("-" * 74)
    print("Attention layer fraction vs memory fraction at 256k (BF16)")
    print("-" * 74)
    for cfg in configs:
        attn_frac = cfg.attn_layers / cfg.total_layers if cfg.total_layers else 0
        kv = kv_cache_bytes(cfg, 262_144, BYTES_BF16)
        ss = ssm_state_bytes(cfg, BYTES_BF16)
        mem_frac = kv / (kv + ss + 1) if (kv + ss) > 0 else 0
        print(f"  {cfg.name:<32} attn_frac={attn_frac:.3f}  "
              f"kv_frac_of_total_cache={mem_frac:.3f}")
    print()

    print("=" * 74)
    print("TAKEAWAY")
    print("-" * 74)
    print("  Pure Transformer at 256k = 67 GB just for KV cache — will not fit")
    print("  on an 80GB single-GPU deployment after you add weights and activations.")
    print("  Jamba 1:7 = 8.4 GB KV cache + ~4 MB SSM state = fits comfortably.")
    print("  That is the 256k-on-one-GPU claim from the AI21 paper, concretely.")
    print("  Mamba-3 pushes pure SSM further; hybrids will likely adopt it as")
    print("  the SSM side of the next-generation recipe.")


if __name__ == "__main__":
    main()
