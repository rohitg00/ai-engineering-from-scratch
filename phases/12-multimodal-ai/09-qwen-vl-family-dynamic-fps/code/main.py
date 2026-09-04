"""Qwen-VL family: M-RoPE positions + dynamic-FPS sampler + JSON tool-call parser.

Three toy implementations:
  1. M-RoPE rotation table across text, image, and video tokens.
  2. Dynamic-FPS sampler that picks frames-per-second from a target token budget.
  3. JSON-output parser for Qwen2.5-VL-style agent tool calls.

Stdlib only. The intent is a working mental model, not production code.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass


@dataclass
class MRoPEConfig:
    hidden: int
    temporal_dim: int
    height_dim: int
    width_dim: int
    base: float = 10000.0


def mrope_angles(cfg: MRoPEConfig, t: int, h: int, w: int) -> list[float]:
    """Return per-pair rotation angles for each band given a (t, h, w) position."""
    angles = []
    for dim, pos in [(cfg.temporal_dim, t), (cfg.height_dim, h), (cfg.width_dim, w)]:
        band = []
        pairs = dim // 2
        for i in range(pairs):
            theta = cfg.base ** (-2 * i / dim)
            band.append(pos * theta)
        angles.append(band)
    return angles


def mrope_rotate(cfg: MRoPEConfig, vec: list[float], t: int, h: int, w: int) -> list[float]:
    """Apply M-RoPE to a vector of length cfg.hidden."""
    out = list(vec)
    axes = [
        (cfg.temporal_dim, t, 0),
        (cfg.height_dim, h, cfg.temporal_dim),
        (cfg.width_dim, w, cfg.temporal_dim + cfg.height_dim),
    ]
    for dim, pos, start in axes:
        pairs = dim // 2
        for i in range(pairs):
            theta = cfg.base ** (-2 * i / dim)
            angle = pos * theta
            idx0 = start + 2 * i
            idx1 = start + 2 * i + 1
            c, s = math.cos(angle), math.sin(angle)
            v0, v1 = out[idx0], out[idx1]
            out[idx0] = v0 * c - v1 * s
            out[idx1] = v0 * s + v1 * c
    return out


@dataclass
class VideoPlan:
    duration_s: float
    tokens_per_frame: int
    budget: int
    motion: str

    def fps(self) -> float:
        fps_max = self.budget / (self.duration_s * self.tokens_per_frame)
        if self.motion == "high":
            candidates = [8, 4, 2, 1, 0.5, 0.25]
        elif self.motion == "medium":
            candidates = [4, 2, 1, 0.5, 0.25]
        else:
            candidates = [1, 0.5, 0.25, 0.1]
        for f in candidates:
            if f <= fps_max:
                return f
        return candidates[-1]

    def frame_times(self) -> list[float]:
        f = self.fps()
        n_frames = max(1, int(self.duration_s * f))
        step = 1.0 / f
        return [round(i * step, 3) for i in range(n_frames)]

    def total_tokens(self) -> int:
        return len(self.frame_times()) * self.tokens_per_frame


def parse_tool_call(raw: str) -> dict:
    """Qwen2.5-VL emits JSON tool calls; parse with fallback."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start:end + 1])
            except json.JSONDecodeError:
                pass
        return {"tool": "PARSE_ERROR", "raw": raw}


def demo_mrope() -> None:
    print("\nM-RoPE position rotations for hidden=48 (16 per band)")
    print("-" * 60)
    cfg = MRoPEConfig(hidden=48, temporal_dim=16, height_dim=16, width_dim=16)
    positions = [
        ("text token i=0",      0, 0, 0),
        ("text token i=12",     12, 0, 0),
        ("image patch (h=5, w=7)", 0, 5, 7),
        ("video frame t=3 (h=5, w=7)", 3, 5, 7),
    ]
    for name, t, h, w in positions:
        angles = mrope_angles(cfg, t, h, w)
        first_pair = [round(a[0], 4) for a in angles]
        print(f"  {name:<30} first-pair angles (t, h, w) = {first_pair}")


def demo_sampler() -> None:
    print("\nDYNAMIC-FPS SAMPLER (tokens_per_frame=81 after 3x pool)")
    print("-" * 60)
    videos = [
        ("30s tennis rally (high motion)",   30.0, "high"),
        ("30s recipe demo (medium motion)",  30.0, "medium"),
        ("10min security loop (low motion)", 600.0, "low"),
        ("1min UI agent replay (medium)",    60.0, "medium"),
    ]
    budget = 32768
    print(f"budget {budget} tokens per video:")
    for name, dur, motion in videos:
        plan = VideoPlan(duration_s=dur, tokens_per_frame=81, budget=budget, motion=motion)
        n_frames = len(plan.frame_times())
        print(f"  {name:<38}  fps={plan.fps()}  frames={n_frames:>4}  tokens={plan.total_tokens():>6}")


def demo_tool_parser() -> None:
    print("\nQWEN2.5-VL TOOL-CALL PARSER")
    print("-" * 60)
    examples = [
        '{"tool": "mouse_click", "coords": [1024, 512], "button": "left"}',
        'Sure, clicking at {"tool": "mouse_click", "coords": [800, 400]} now.',
        '{"tool": "type_text", "text": "hello"',
        '{"tool": "scroll", "direction": "down", "amount": 300}',
    ]
    for raw in examples:
        parsed = parse_tool_call(raw)
        print(f"  raw    : {raw}")
        print(f"  parsed : {parsed}")
        print()


def main() -> None:
    print("=" * 60)
    print("QWEN-VL FAMILY (Phase 12, Lesson 09)")
    print("=" * 60)

    demo_mrope()
    demo_sampler()
    demo_tool_parser()

    print("=" * 60)
    print("LINEAGE SUMMARY")
    print("-" * 60)
    print("  Qwen-VL   (2023) : 448 res, grounding, Q-Former")
    print("  Qwen2-VL  (2024) : M-RoPE, native res, MLP projector")
    print("  Qwen2.5-VL(2025) : dynamic FPS, abs-time tokens, JSON agent mode")
    print("  Qwen3-VL  (2025) : Qwen3 base, thinking mode, OCR scale")


if __name__ == "__main__":
    main()
