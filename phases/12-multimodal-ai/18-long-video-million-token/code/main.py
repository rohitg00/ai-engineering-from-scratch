"""Long-video token budget + needle-in-a-haystack simulator + agentic retrieval.

Stdlib. Prints budget tables for long videos, runs a synthetic NIH recall test,
simulates a VideoAgent-style retrieval loop.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

random.seed(5)


def tokens(duration_s: float, fps: float, per_frame: int) -> int:
    return int(duration_s * fps * per_frame)


def budget_table() -> None:
    print("\nLONG-VIDEO TOKEN BUDGETS")
    print("-" * 60)
    print(f"{'duration':<14}{'FPS':>5}{'per_frame':>12}{'tokens':>12}{'fits in':>14}")
    cases = [
        (60, 1, 81,     "32k+"),
        (300, 1, 81,    "32k"),
        (300, 2, 81,    "128k"),
        (1800, 1, 81,   "256k"),
        (3600, 1, 81,   "1M / LongVILA"),
        (7200, 1, 81,   "Gemini 2.5 only"),
        (7200, 1, 32,   "agentic retrieval"),
    ]
    for dur, fps, pf, fits in cases:
        t = tokens(dur, fps, pf)
        print(f"{dur//60}min{' ':<8}{fps:>5}{pf:>12}{t:>12,}   {fits}")


@dataclass
class Needle:
    t: float
    marker: str


def nih_trial(duration_s: float, model_recall_curve: list[tuple[float, float]]) -> dict:
    needle_t = random.uniform(0, duration_s)
    needle = Needle(t=needle_t, marker="unique sticker")
    pct_into_video = needle_t / duration_s
    for thresh, recall in model_recall_curve:
        if pct_into_video <= thresh:
            return {"needle_time": needle_t,
                    "pct_into_video": pct_into_video,
                    "recall_prob": recall}
    return {"needle_time": needle_t,
            "pct_into_video": pct_into_video,
            "recall_prob": model_recall_curve[-1][1]}


def nih_simulation() -> None:
    print("\nNEEDLE-IN-A-HAYSTACK SIMULATION (single trial per model)")
    print("-" * 60)
    models = [
        ("Qwen2.5-VL-72B @ 15min",   900,  [(0.1, 0.98), (0.5, 0.90), (1.0, 0.85)]),
        ("Qwen2.5-VL-72B @ 30min",   1800, [(0.1, 0.95), (0.5, 0.85), (1.0, 0.75)]),
        ("Gemini 2.5 Pro @ 90min",   5400, [(0.1, 0.99), (0.5, 0.99), (1.0, 0.99)]),
        ("VideoAgent (retrieval) 2h", 7200, [(0.1, 0.92), (0.5, 0.92), (1.0, 0.92)]),
    ]
    for name, dur, curve in models:
        r = nih_trial(dur, curve)
        print(f"  {name:<32}  needle@{r['needle_time']:>6.1f}s  "
              f"p(recall)={r['recall_prob']:.2f}")


def agentic_retrieval_sim(question: str, video_duration: float) -> dict:
    """Simulate VideoAgent: LLM asks for clip, tool returns timestamps, VLM reads."""
    trace = []
    trace.append(("LLM  ", f"reading question: '{question}'"))
    query = question.split()[-1].lower()
    trace.append(("LLM  ", f"calling tool: find_clips(keyword='{query}')"))
    hits = sorted([random.uniform(0, video_duration) for _ in range(3)])
    trace.append(("TOOL ", f"returned 3 clips: {[round(h,1) for h in hits]}"))
    trace.append(("VLM  ", f"encoding 3 x 30s clips (~7290 tokens total)"))
    trace.append(("LLM  ", "composing answer from clip descriptions"))
    tokens_used = 3 * 30 * 81 + 200
    return {"steps": trace, "tokens": tokens_used}


def agentic_demo() -> None:
    print("\nVIDEOAGENT-STYLE RETRIEVAL (2-hour video)")
    print("-" * 60)
    r = agentic_retrieval_sim("at what point does the cat jump", 7200)
    for role, msg in r["steps"]:
        print(f"  [{role}] {msg}")
    print(f"\n  total tokens used: ~{r['tokens']:,}")
    print(f"  vs brute context 2h @ 1 FPS: ~583,000 tokens")
    print(f"  -> 99% cheaper inference for single-event queries")


def main() -> None:
    print("=" * 60)
    print("LONG-VIDEO UNDERSTANDING (Phase 12, Lesson 18)")
    print("=" * 60)

    budget_table()
    nih_simulation()
    agentic_demo()

    print("\nSTRATEGY PICKER")
    print("-" * 60)
    print("  <15 min            : brute context (Qwen2.5-VL-72B)")
    print("  15-60 min          : LongVILA / Video-XL / Gemini 2.5")
    print("  >1h general QA     : Gemini 2.5 Pro (closed frontier)")
    print("  >1h specific query : VideoAgent (agentic retrieval)")


if __name__ == "__main__":
    main()
