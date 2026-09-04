"""Toy quantization memory and throughput calculator — stdlib Python.

For a set of quantization formats and model sizes, compute:
  - weight memory
  - KV cache memory (separate, scales with concurrency and context)
  - activations memory (approximate)
  - relative decode throughput (memory-bandwidth-limited shape)

Formats are represented by effective weight bits and KV bits. Pedagogical.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Format:
    name: str
    weight_bits: float
    kv_bits: float
    engine: str
    notes: str


FORMATS = [
    Format("BF16 baseline (vLLM)",       16, 16, "vLLM",     "reference"),
    Format("GGUF Q5_K_M (llama.cpp)",     5, 16, "llama.cpp", "CPU/edge"),
    Format("GGUF Q4_K_M (llama.cpp)",     4, 16, "llama.cpp", "CPU/edge, default"),
    Format("GPTQ-Int4 + Marlin (vLLM)",   4, 16, "vLLM",     "multi-LoRA support"),
    Format("AWQ-Int4 + Marlin (vLLM)",    4, 16, "vLLM",     "best Pass@1 at INT4"),
    Format("FP8 (vLLM / TRT-LLM)",        8,  8, "multi",    "safe default reasoning"),
    Format("NVFP4 + FP8 KV (TRT-LLM)",    4,  8, "TRT-LLM",  "Blackwell aggressive"),
]


def memory_breakdown(params_b: float, fmt: Format,
                     concurrency: int = 128, ctx: int = 2048) -> dict:
    weight_gb = params_b * fmt.weight_bits / 8
    # KV cache approximation: num_layers * 2 * kv_heads * head_dim * ctx * bytes/element
    layers = 64 * (params_b / 70.0)**0.5
    kv_heads = 8
    head_dim = 128
    per_seq_kv_gb = layers * 2 * kv_heads * head_dim * ctx * (fmt.kv_bits / 8) / 1e9
    kv_total = per_seq_kv_gb * concurrency
    activations_gb = 0.05 * params_b       # rough constant
    return {
        "weight": weight_gb,
        "kv": kv_total,
        "act": activations_gb,
        "total": weight_gb + kv_total + activations_gb,
    }


def relative_throughput(fmt: Format) -> float:
    """Decode is memory-bandwidth-limited. Fewer weight bytes per token = higher throughput.
    Normalize to BF16 = 1.0."""
    return 16 / fmt.weight_bits


def gpu_check(total_gb: float) -> str:
    if total_gb <= 80:
        return "H100 80GB"
    if total_gb <= 141:
        return "H200 141GB"
    if total_gb <= 192:
        return "B200 192GB"
    return "MULTI-GPU"


def print_scenario(params_b: float, concurrency: int, ctx: int) -> None:
    print(f"Model: {params_b}B params  |  concurrency {concurrency}  |  ctx {ctx}")
    print("-" * 98)
    print(f"{'format':36} {'W GB':>7} {'KV GB':>7} {'Act GB':>7} "
          f"{'Total':>7} {'fits on':>14} {'rel tput':>10}")
    for f in FORMATS:
        m = memory_breakdown(params_b, f, concurrency, ctx)
        tput = relative_throughput(f)
        print(f"{f.name:36} {m['weight']:7.1f} {m['kv']:7.1f} {m['act']:7.1f} "
              f"{m['total']:7.1f} {gpu_check(m['total']):>14} {tput:10.2f}x")
    print()


def main() -> None:
    print("=" * 98)
    print("TOY QUANTIZATION CALCULATOR — memory and relative throughput by format")
    print("=" * 98)
    print()

    print_scenario(params_b=7, concurrency=128, ctx=2048)
    print_scenario(params_b=70, concurrency=128, ctx=2048)
    print_scenario(params_b=70, concurrency=256, ctx=8192)
    print_scenario(params_b=405, concurrency=128, ctx=2048)

    print("=" * 98)
    print("KEY FINDINGS")
    print("-" * 98)
    print("  1. KV cache grows linearly with concurrency x context.")
    print("     At 256 conc / 8k ctx on 70B, KV alone dwarfs weight savings.")
    print("  2. AWQ vs GPTQ = same 4-bit footprint; choice is about LoRA support and kernels.")
    print("  3. NVFP4 + FP8 KV stacks: shrink weights AND KV ; Blackwell-only.")
    print("  4. For reasoning workloads, FP8 is the safe default despite higher memory.")
    print("  5. GGUF wins on CPU ; ~93 tok/s in vLLM is not a bug, it is the wrong engine.")


if __name__ == "__main__":
    main()
