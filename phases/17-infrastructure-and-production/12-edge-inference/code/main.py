"""Edge-inference bandwidth-bound decode simulator — stdlib Python。

複数の edge target について、(weights_bytes / bandwidth_bytes_per_sec) から
theoretical decode throughput を計算します。Observed benchmarks と比較し、
edge devices では decode が compute-bound ではなく memory-bound であることを示します。
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Target:
    name: str
    bandwidth_gb_s: float
    observed_toks_per_s_llama8b_q4: float | None
    notes: str


TARGETS = [
    Target("Datacenter H100 HBM3",  3350, 170,  "reference ceiling"),
    Target("Jetson AGX Orin",        205,  45,  "edge-datacenter bridge"),
    Target("Apple M3 Max",           400,  55,  "unified memory MPS"),
    Target("Apple M4 (MacBook Air)", 120,  25,  "consumer laptop"),
    Target("Apple A18 (iPhone 16)",   60,   8,  "phone with ANE"),
    Target("Snapdragon 8 Gen 3",      77,   7,  "mid/high Android"),
    Target("Snapdragon X Elite",     135,  22,  "Windows ARM laptop"),
    Target("WebGPU on M3 Max",       400,  41,  "browser penalty ~25%"),
    Target("WebGPU on Pixel 9",       77,   6,  "mobile browser Chrome 121+"),
]


def ceiling(target: Target, model_gb: float) -> float:
    seconds_per_token = model_gb / target.bandwidth_gb_s
    return 1 / seconds_per_token


def efficiency(observed: float | None, ceiling_val: float) -> str:
    if observed is None:
        return "    -"
    return f"{observed / ceiling_val * 100:4.0f}%"


def main() -> None:
    model_name = "Llama 3.1 8B Q4"
    model_gb = 4.7
    print("=" * 95)
    print(f"EDGE DECODE CEILING — {model_name}（HBM/DRAM 内 {model_gb:.1f} GB）")
    print("=" * 95)
    header = f"{'Target':26}  {'BW (GB/s)':>9}  {'ceiling (tok/s)':>16}  {'observed':>10}  {'efficiency':>11}  Notes"
    print(header)
    print("-" * len(header))
    for t in TARGETS:
        c = ceiling(t, model_gb)
        obs = t.observed_toks_per_s_llama8b_q4
        eff = efficiency(obs, c)
        obs_display = f"{obs:>8.0f}  " if obs is not None else f"{'-':>10}  "
        print(f"{t.name:26}  {t.bandwidth_gb_s:8.0f}   {c:15.1f}   {obs_display}{eff:>11}  {t.notes}")

    print()
    print("Read: ceiling を決めるのは bandwidth です。Compute が重要なのは runtime が非効率な場合だけです。")
    print()
    print("=" * 95)
    print("QUANTIZATION IMPACT — 同じ target、異なる format")
    print("=" * 95)
    iphone_bw = 60.0
    for name, size in [("BF16", 18.8), ("INT8", 9.4), ("Q4 GGUF", 4.7), ("Q3 GGUF", 3.6)]:
        c = 1 / (size / iphone_bw)
        print(f"iPhone 16 + {name:8}  model={size:5.1f} GB  ceiling={c:6.1f} tok/s")


if __name__ == "__main__":
    main()
