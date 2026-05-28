"""mock experiment script: config JSON を読み、intermediate と final metrics を出力します。

尊重される knobs:
    k          : int    sparsity setting。大きい k は perplexity を下げる (synthetic)
    steps      : int    simulate する inner training steps 数
    sleep_s    : float  step ごとの sleep。tests で timeout を強制するために使う
    allocate_mb: int    保持する追加 MB。memory poller を強制するために使う
    __seed     : int    numpy random pass 用 deterministic seed

stdlib + numpy。この script は意図的に小さく、lesson の主役は runner です。
"""

from __future__ import annotations

import json
import os
import sys
import time

import numpy as np


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing config path"}), file=sys.stderr)
        return 2
    cfg_path = sys.argv[1]
    try:
        with open(cfg_path, "rt", encoding="utf-8") as fh:
            cfg = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": f"bad config: {exc}"}), file=sys.stderr)
        return 2

    seed = int(cfg.get("__seed", 0))
    k = int(cfg.get("k", 8))
    steps = max(1, int(cfg.get("steps", 4)))
    sleep_s = float(cfg.get("sleep_s", 0.0))
    allocate_mb = int(cfg.get("allocate_mb", 0))

    rng = np.random.default_rng(seed)
    held = None
    if allocate_mb > 0:
        held = bytearray(allocate_mb * 1024 * 1024)

    base_loss = 5.0
    losses: list[float] = []
    for step in range(steps):
        noise = float(rng.normal(0, 0.02))
        loss_step = base_loss * (0.9 ** step) - 0.05 * min(k, 32) / 32.0 + noise
        losses.append(round(loss_step, 6))
        intermediate = {
            "step": step,
            "loss": losses[-1],
            "perplexity": round(float(np.exp(losses[-1])), 6),
            "final_loss": losses[-1],
        }
        print(json.dumps(intermediate), flush=True)
        if sleep_s > 0:
            time.sleep(sleep_s)

    final = {
        "perplexity": round(float(np.exp(losses[-1])), 6),
        "final_loss": losses[-1],
        "steps_completed": steps,
        "k": k,
        "seed": seed,
    }
    print(json.dumps(final), flush=True)
    if held is not None:
        held[0] = 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
