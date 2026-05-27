"""InternVL3-style native pretraining corpus mixer + ViR router simulator.

Three toys:
  1. Corpus mix planner — given target percentages, compute steps per modality.
  2. ViR router sim — given a query distribution, estimate avg tokens per request.
  3. DvD throughput estimate — given encoder FLOPs and LLM FLOPs, pick serving.

Stdlib only. Not a real trainer; illustrates the accounting InternVL3 runs.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class CorpusMix:
    text_pct: float
    interleaved_pct: float
    caption_pct: float
    video_pct: float

    def normalize(self) -> None:
        total = self.text_pct + self.interleaved_pct + self.caption_pct + self.video_pct
        self.text_pct /= total
        self.interleaved_pct /= total
        self.caption_pct /= total
        self.video_pct /= total

    def steps(self, total: int) -> dict:
        return {
            "text":       int(total * self.text_pct),
            "interleaved": int(total * self.interleaved_pct),
            "caption":    int(total * self.caption_pct),
            "video":      int(total * self.video_pct),
        }


@dataclass
class RouterTier:
    name: str
    tokens: int
    fraction: float


def vir_sim(tiers: list[RouterTier]) -> dict:
    avg = sum(t.tokens * t.fraction for t in tiers)
    baseline = max(t.tokens for t in tiers)
    return {"avg_tokens": avg, "baseline": baseline, "ratio": baseline / avg}


def dvd_throughput(encoder_flops: int, llm_flops: int,
                   llm_tokens: int = 128) -> dict:
    colocated = encoder_flops + llm_flops * llm_tokens
    decoupled = max(encoder_flops, llm_flops * llm_tokens)
    return {"colocated": colocated, "decoupled": decoupled,
            "speedup": colocated / decoupled}


def posthoc_vs_native_table() -> None:
    print("\nPOST-HOC vs NATIVE PRETRAINING")
    print("-" * 60)
    rows = [
        ("metric",                 "post-hoc",   "native"),
        ("-" * 22,                 "-" * 12,     "-" * 12),
        ("total GPU-hours",        "~30k",       "~300k"),
        ("base LLM reuse",         "yes",        "no"),
        ("alignment debt",         "visible",    "negligible"),
        ("MMLU regression",        "-2 to -8",   "0"),
        ("GSM8K regression",       "-3 to -10",  "0"),
        ("corpus flexibility",     "instr only", "interleaved"),
        ("base-LLM swap later",    "possible",   "impossible"),
        ("examples",               "LLaVA, Qwen-VL v1", "InternVL3, GPT-4o, Chameleon"),
    ]
    for r in rows:
        print(f"  {r[0]:<22}{r[1]:<14}{r[2]}")


def main() -> None:
    print("=" * 60)
    print("INTERNVL3 NATIVE PRETRAINING (Phase 12, Lesson 10)")
    print("=" * 60)

    mix = CorpusMix(text_pct=40, interleaved_pct=35, caption_pct=20, video_pct=5)
    mix.normalize()
    total_steps = 500_000
    steps = mix.steps(total_steps)
    print(f"\nCORPUS MIX (target {total_steps:,} training steps)")
    print("-" * 60)
    for k, v in steps.items():
        print(f"  {k:<14}: {v:>8,}  ({v * 100 / total_steps:.1f}%)")
    print("\n40% text floor keeps base LLM skills; interleaved is the key unlock")
    print("that lets the model learn multi-image reasoning during pretraining.")

    print("\nVIR ROUTING SIMULATION (production query mix)")
    print("-" * 60)
    tiers = [
        RouterTier("low-res photo QA",      256, 0.50),
        RouterTier("medium product shot",   576, 0.30),
        RouterTier("high-res doc + OCR",   2048, 0.20),
    ]
    for t in tiers:
        print(f"  {t.name:<26}  {t.tokens:>5} tok x {t.fraction * 100:>4.0f}%")
    r = vir_sim(tiers)
    print(f"\n  avg tokens/req  : {r['avg_tokens']:.0f}")
    print(f"  baseline (all high-res): {r['baseline']}")
    print(f"  speed-up vs baseline  : {r['ratio']:.2f}x")
    print("  note: 50% of real-world queries need only low-res encoding")

    print("\nDVD DEPLOYMENT — encoder vs LLM parallelism")
    print("-" * 60)
    encoder_gflops = 300
    llm_gflops_per_token = 8
    d = dvd_throughput(encoder_gflops, llm_gflops_per_token, 128)
    print(f"  encoder: {encoder_gflops} GFLOPs per image")
    print(f"  LLM    : {llm_gflops_per_token} GFLOPs per output token, 128 tokens")
    print(f"  colocated total: {d['colocated']} GFLOPs")
    print(f"  decoupled bottleneck: {d['decoupled']} GFLOPs")
    print(f"  speedup: {d['speedup']:.2f}x with DvD")

    posthoc_vs_native_table()


if __name__ == "__main__":
    main()
