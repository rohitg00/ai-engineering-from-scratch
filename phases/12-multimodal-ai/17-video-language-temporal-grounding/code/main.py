"""Video VLM frame sampler + temporal-grounding evaluator — stdlib.

Three toys:
  1. Uniform frame sampler.
  2. Dynamic-FPS sampler using motion proxy (synthetic per-frame motion scalar).
  3. Temporal-grounding evaluator with IoU-style scoring.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

random.seed(4)


def uniform_sample(duration: float, n: int) -> list[float]:
    if n <= 1:
        return [duration / 2]
    step = duration / n
    return [round(step * (i + 0.5), 3) for i in range(n)]


def dynamic_sample(motion: list[float], fps_cap: int = 4,
                   total_budget: int = 32) -> list[float]:
    """Allocate samples by per-second motion; cap per second at fps_cap."""
    total_motion = sum(motion)
    if total_motion == 0:
        return uniform_sample(len(motion), total_budget)
    samples_per_sec = []
    for m in motion:
        raw = total_budget * m / total_motion
        samples_per_sec.append(min(fps_cap, max(1, round(raw))))
    times = []
    for sec_idx, count in enumerate(samples_per_sec):
        for j in range(count):
            t = sec_idx + (j + 0.5) / count
            times.append(round(t, 3))
    return times


def iou(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    inter = max(0.0, min(a_end, b_end) - max(a_start, b_start))
    union = max(a_end, b_end) - min(a_start, b_start)
    return inter / union if union > 0 else 0.0


@dataclass
class Event:
    name: str
    start: float
    end: float


def evaluate_grounding(predictions: list[Event], ground_truth: list[Event],
                       tol_iou: float = 0.3) -> dict:
    hits = 0
    details = []
    for gt in ground_truth:
        best_iou = 0.0
        best_pred = None
        for p in predictions:
            if p.name == gt.name:
                val = iou(p.start, p.end, gt.start, gt.end)
                if val > best_iou:
                    best_iou = val
                    best_pred = p
        hit = best_iou >= tol_iou
        if hit:
            hits += 1
        details.append((gt.name, best_iou, hit))
    return {"recall": hits / max(1, len(ground_truth)), "details": details}


def demo_samplers() -> None:
    print("\nFRAME SAMPLING STRATEGIES")
    print("-" * 60)
    duration = 10.0
    uni = uniform_sample(duration, 8)
    print(f"  uniform   (8 frames / 10s) : {uni}")
    motion = [0.1, 0.1, 0.8, 0.9, 0.9, 0.2, 0.1, 0.5, 0.9, 0.9]
    dyn = dynamic_sample(motion, fps_cap=4, total_budget=12)
    print(f"  motion    : {motion}")
    print(f"  dynamic (12 frames total): {dyn}")
    print("  dynamic places more frames in high-motion seconds 2-4 and 7-9")


def demo_grounding() -> None:
    print("\nTEMPORAL GROUNDING EVAL (IoU >= 0.3)")
    print("-" * 60)
    ground = [
        Event("jump", 4.0, 4.5),
        Event("turn", 6.0, 6.5),
        Event("sit",  8.5, 9.5),
    ]
    predictions = [
        Event("jump", 4.1, 4.7),
        Event("turn", 5.8, 6.2),
        Event("sit",  9.2, 9.6),
    ]
    result = evaluate_grounding(predictions, ground)
    print(f"  recall@IoU0.3 : {result['recall']:.2f}")
    for name, val, hit in result["details"]:
        tag = "HIT" if hit else "miss"
        print(f"    {name:<6} IoU={val:.2f}  {tag}")


def arch_compare() -> None:
    print("\nVIDEO VLM ARCHITECTURES")
    print("-" * 60)
    rows = [
        ("Video-LLaMA",  "Q-former / 16 frames", "fixed clip, audio branch"),
        ("Video-LLaVA",  "MLP / 8 frames",       "shared image+video encoder"),
        ("VILA-1.5",     "MLP / 8-16 frames",    "pretraining-heavy"),
        ("Qwen2.5-VL",   "TMRoPE / dynamic FPS", "absolute time, best open 2025"),
        ("LLaVA-OV-1.5", "pool / 32 frames",     "unified image+multi+video"),
    ]
    print(f"  {'model':<14}{'compressor':<24}{'note'}")
    for r in rows:
        print(f"  {r[0]:<14}{r[1]:<24}{r[2]}")


def main() -> None:
    print("=" * 60)
    print("VIDEO-LANGUAGE TEMPORAL GROUNDING (Phase 12, Lesson 17)")
    print("=" * 60)

    demo_samplers()
    demo_grounding()
    arch_compare()

    print("\nTAKEAWAY")
    print("-" * 60)
    print("  temporal tokens matter as much as the visual encoder")
    print("  dynamic FPS + TMRoPE is the 2026 open-source default")
    print("  JSON grounded output beats free-text for downstream use")


if __name__ == "__main__":
    main()
