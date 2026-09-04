"""Gradient accumulation from scratch.

Effective batch size = micro batch size * accumulation steps. Accumulate
gradients across several forward and backward passes, only step the
optimizer after the last micro-batch. Tracks throughput against effective
batch size so the curve is visible, not folklore.

Run: python3 code/main.py
"""

from __future__ import annotations

import argparse
import json
import math
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Callable, Iterable, List

import torch
from torch import nn


HERE = Path(__file__).parent
OUT_DIR = HERE.parent / "outputs"
LOG_PATH = OUT_DIR / "accum-curve.json"


@dataclass
class StepResult:
    step: int
    effective_batch: int
    micro_batch: int
    accum_steps: int
    loss: float
    grad_norm: float
    samples_per_sec: float
    wall_ms: float
    sync_calls: int


@dataclass
class CurvePoint:
    effective_batch: int
    accum_steps: int
    micro_batch: int
    avg_loss: float
    samples_per_sec: float
    median_step_ms: float
    sync_calls: int
    steps: int


def seed_everything(seed: int) -> None:
    torch.manual_seed(seed)


def synthetic_batch(batch_size: int, in_dim: int, out_dim: int, gen: torch.Generator) -> tuple[torch.Tensor, torch.Tensor]:
    x = torch.randn(batch_size, in_dim, generator=gen)
    target = torch.randint(low=0, high=out_dim, size=(batch_size,), generator=gen)
    return x, target


def make_model(in_dim: int, hidden: int, out_dim: int) -> nn.Module:
    return nn.Sequential(
        nn.Linear(in_dim, hidden),
        nn.GELU(),
        nn.Linear(hidden, hidden),
        nn.GELU(),
        nn.Linear(hidden, out_dim),
    )


def global_grad_norm(model: nn.Module) -> float:
    total = 0.0
    for p in model.parameters():
        if p.grad is None:
            continue
        total += float(p.grad.detach().pow(2).sum().item())
    return math.sqrt(total)


def zero_grads(model: nn.Module) -> None:
    for p in model.parameters():
        if p.grad is not None:
            p.grad.detach_()
            p.grad.zero_()


def loss_scaled_for_accum(logits: torch.Tensor, target: torch.Tensor, accum_steps: int, loss_fn: Callable[[torch.Tensor, torch.Tensor], torch.Tensor]) -> torch.Tensor:
    raw = loss_fn(logits, target)
    return raw / accum_steps


def train_one_optimizer_step(
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    micro_batches: List[tuple[torch.Tensor, torch.Tensor]],
    loss_fn: Callable[[torch.Tensor, torch.Tensor], torch.Tensor],
    *,
    no_sync_until_last: bool,
    sync_counter: List[int],
) -> tuple[float, float]:
    """Run accum_steps micro batches, accumulate grads, step once.

    Returns (total_unscaled_loss, grad_norm).
    """
    accum_steps = len(micro_batches)
    zero_grads(model)
    total = 0.0
    for i, (x, y) in enumerate(micro_batches):
        is_last = i == accum_steps - 1
        if no_sync_until_last and not is_last:
            with no_sync_context(model):
                logits = model(x)
                loss = loss_scaled_for_accum(logits, y, accum_steps, loss_fn)
                loss.backward()
        else:
            logits = model(x)
            loss = loss_scaled_for_accum(logits, y, accum_steps, loss_fn)
            loss.backward()
            sync_counter[0] += 1
        total += float(loss.detach().item()) * accum_steps
    grad_norm = global_grad_norm(model)
    optimizer.step()
    return total / accum_steps, grad_norm


class _NoSyncCtx:
    def __init__(self, model: nn.Module):
        self.model = model

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def no_sync_context(model: nn.Module):
    """Stand-in for DDP no_sync.

    In DDP this skips the all-reduce on the trailing backward. In this
    single-process demo there is no collective to skip, but we still
    surface the call site so the pattern reads the same on a real cluster.
    """
    return _NoSyncCtx(model)


def run_config(
    effective_batch: int,
    accum_steps: int,
    *,
    in_dim: int,
    hidden: int,
    out_dim: int,
    num_steps: int,
    lr: float,
    seed: int,
) -> CurvePoint:
    assert effective_batch % accum_steps == 0, "effective_batch must divide by accum_steps"
    micro_batch = effective_batch // accum_steps
    seed_everything(seed)
    gen = torch.Generator()
    gen.manual_seed(seed)
    model = make_model(in_dim, hidden, out_dim)
    optimizer = torch.optim.SGD(model.parameters(), lr=lr)
    loss_fn = nn.CrossEntropyLoss()

    losses: List[float] = []
    step_times_ms: List[float] = []
    sync_counter = [0]
    total_samples = 0
    wall_start = time.perf_counter()
    for step in range(num_steps):
        t0 = time.perf_counter()
        micro_batches = [synthetic_batch(micro_batch, in_dim, out_dim, gen) for _ in range(accum_steps)]
        avg_loss, _grad_norm = train_one_optimizer_step(
            model,
            optimizer,
            micro_batches,
            loss_fn,
            no_sync_until_last=True,
            sync_counter=sync_counter,
        )
        wall_ms = (time.perf_counter() - t0) * 1000.0
        losses.append(avg_loss)
        step_times_ms.append(wall_ms)
        total_samples += effective_batch
    total_wall = time.perf_counter() - wall_start
    sps = total_samples / max(total_wall, 1e-6)
    step_times_ms.sort()
    median_ms = step_times_ms[len(step_times_ms) // 2]
    avg_loss = sum(losses) / len(losses)
    return CurvePoint(
        effective_batch=effective_batch,
        accum_steps=accum_steps,
        micro_batch=micro_batch,
        avg_loss=avg_loss,
        samples_per_sec=sps,
        median_step_ms=median_ms,
        sync_calls=sync_counter[0],
        steps=num_steps,
    )


def sweep_effective_batches(
    *,
    micro_batch: int,
    accum_grid: Iterable[int],
    in_dim: int = 64,
    hidden: int = 128,
    out_dim: int = 16,
    num_steps: int = 25,
    lr: float = 0.05,
    seed: int = 0,
) -> List[CurvePoint]:
    points: List[CurvePoint] = []
    for accum in accum_grid:
        eff = micro_batch * accum
        pt = run_config(
            effective_batch=eff,
            accum_steps=accum,
            in_dim=in_dim,
            hidden=hidden,
            out_dim=out_dim,
            num_steps=num_steps,
            lr=lr,
            seed=seed,
        )
        points.append(pt)
    return points


def equivalence_check(
    *,
    in_dim: int = 32,
    hidden: int = 48,
    out_dim: int = 8,
    big_batch: int = 16,
    accum_steps: int = 4,
    lr: float = 0.1,
    seed: int = 7,
) -> dict:
    """One full batch step vs accum_steps micro-batches must match.

    Scaled loss is `raw / accum_steps`; the accumulated gradient equals the
    full batch gradient up to floating point noise.
    """
    assert big_batch % accum_steps == 0
    micro = big_batch // accum_steps

    seed_everything(seed)
    gen_a = torch.Generator(); gen_a.manual_seed(seed)
    x, y = synthetic_batch(big_batch, in_dim, out_dim, gen_a)

    seed_everything(seed)
    model_full = make_model(in_dim, hidden, out_dim)
    opt_full = torch.optim.SGD(model_full.parameters(), lr=lr)
    loss_fn = nn.CrossEntropyLoss()
    zero_grads(model_full)
    out = model_full(x)
    loss_full = loss_fn(out, y)
    loss_full.backward()
    full_params_before = [p.detach().clone() for p in model_full.parameters()]
    full_grads = [p.grad.detach().clone() for p in model_full.parameters()]
    opt_full.step()
    full_params_after = [p.detach().clone() for p in model_full.parameters()]

    seed_everything(seed)
    model_accum = make_model(in_dim, hidden, out_dim)
    opt_accum = torch.optim.SGD(model_accum.parameters(), lr=lr)
    zero_grads(model_accum)
    chunks_x = list(torch.split(x, micro, dim=0))
    chunks_y = list(torch.split(y, micro, dim=0))
    for cx, cy in zip(chunks_x, chunks_y):
        scaled = loss_fn(model_accum(cx), cy) / accum_steps
        scaled.backward()
    accum_grads = [p.grad.detach().clone() for p in model_accum.parameters()]
    accum_params_before = [p.detach().clone() for p in model_accum.parameters()]
    opt_accum.step()
    accum_params_after = [p.detach().clone() for p in model_accum.parameters()]

    grad_diffs = [
        float((a - b).abs().max().item())
        for a, b in zip(full_grads, accum_grads)
    ]
    param_diffs = [
        float((a - b).abs().max().item())
        for a, b in zip(full_params_after, accum_params_after)
    ]
    return {
        "max_grad_diff": max(grad_diffs),
        "max_param_diff": max(param_diffs),
        "params_init_match": all(
            torch.equal(a, b) for a, b in zip(full_params_before, accum_params_before)
        ),
    }


def write_curve(points: List[CurvePoint], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema": "accum-curve.v1",
        "points": [asdict(p) for p in points],
    }
    path.write_text(json.dumps(payload, indent=2) + "\n")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--micro-batch", type=int, default=4)
    p.add_argument("--accum-grid", type=str, default="1,2,4,8,16")
    p.add_argument("--num-steps", type=int, default=25)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--lr", type=float, default=0.05)
    p.add_argument("--no-write", action="store_true")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    accum_grid = [int(s) for s in args.accum_grid.split(",") if s.strip()]
    print("equivalence check (full batch vs accumulated)")
    eq = equivalence_check()
    print(json.dumps(eq, indent=2))
    assert eq["max_grad_diff"] < 1e-4, f"gradients diverge: {eq['max_grad_diff']}"
    assert eq["max_param_diff"] < 1e-4, f"params diverge: {eq['max_param_diff']}"
    print("equivalence holds. running sweep...")

    points = sweep_effective_batches(
        micro_batch=args.micro_batch,
        accum_grid=accum_grid,
        num_steps=args.num_steps,
        lr=args.lr,
        seed=args.seed,
    )
    header = f"{'eff_batch':>10}  {'accum':>5}  {'micro':>5}  {'sps':>10}  {'median_ms':>10}  {'syncs':>6}  {'loss':>8}"
    print(header)
    for p in points:
        print(
            f"{p.effective_batch:>10}  {p.accum_steps:>5}  {p.micro_batch:>5}  "
            f"{p.samples_per_sec:>10.1f}  {p.median_step_ms:>10.2f}  {p.sync_calls:>6}  {p.avg_loss:>8.4f}"
        )
    if not args.no_write:
        write_curve(points, LOG_PATH)
        print(f"wrote {LOG_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
