"""AdamW with cosine learning-rate schedule and linear warmup.

Implements:
- CosineWithWarmup, a stateless schedule whose lr(step) honors warmup, peak,
  and decay boundaries exactly.
- TrainState, which wires an AdamW optimizer to the schedule and runs one
  training step at a time, logging the learning rate and gradient L2 norm.
- plot_schedule_ascii and write_schedule_csv, deterministic helpers that
  produce a text plot and a CSV the rest of the pipeline can read.

The demo at the bottom builds a tiny torch.nn.Linear model, trains for 20
steps on a fixed batch, prints a per-step log, and renders the schedule.
Run: python3 code/main.py
"""

from __future__ import annotations

import csv
import dataclasses
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterable

try:
    import torch
    from torch import nn
except ImportError as exc:
    raise SystemExit(
        "torch is required for this lesson. Install with: pip install torch"
    ) from exc


PLOT_HEIGHT = 12
PLOT_WIDTH = 60


@dataclass
class CosineWithWarmup:
    """Stateless cosine-with-warmup learning-rate schedule.

    Step indexing convention: step zero is the very first training update. At
    step zero the rate is exactly zero (the warmup ramp starts there). At
    step warmup_steps the rate is exactly lr_max. At step total_steps the
    rate is exactly lr_min. Past total_steps the rate stays at lr_min.
    """

    warmup_steps: int
    total_steps: int
    lr_max: float
    lr_min: float = 0.0

    def __post_init__(self) -> None:
        if self.warmup_steps < 0:
            raise ValueError("warmup_steps must be non-negative")
        if self.total_steps <= 0:
            raise ValueError("total_steps must be positive")
        if self.warmup_steps >= self.total_steps:
            raise ValueError("warmup_steps must be less than total_steps")
        if self.lr_max <= 0:
            raise ValueError("lr_max must be positive")
        if self.lr_min < 0:
            raise ValueError("lr_min must be non-negative")
        if self.lr_min > self.lr_max:
            raise ValueError("lr_min must not exceed lr_max")

    def lr(self, step: int) -> float:
        if step < 0:
            raise ValueError(f"step must be non-negative, got {step}")
        if self.warmup_steps > 0 and step <= self.warmup_steps:
            return self.lr_max * (step / self.warmup_steps)
        if step >= self.total_steps:
            return self.lr_min
        decay_span = max(1, self.total_steps - self.warmup_steps)
        progress = (step - self.warmup_steps) / decay_span
        cosine = 0.5 * (1.0 + math.cos(math.pi * progress))
        return self.lr_min + (self.lr_max - self.lr_min) * cosine

    def points(self, num_steps: int | None = None) -> list[tuple[int, float]]:
        upper = self.total_steps if num_steps is None else num_steps
        if upper <= 0:
            return []
        return [(step, self.lr(step)) for step in range(upper + 1)]


@dataclass
class StepLog:
    """One row of the per-step training log."""

    step: int
    lr: float
    grad_l2_norm: float
    loss: float

    def to_csv_row(self) -> list[str]:
        return [
            str(self.step),
            f"{self.lr:.10f}",
            f"{self.grad_l2_norm:.10f}",
            f"{self.loss:.10f}",
        ]


def gradient_l2_norm(parameters: Iterable[torch.nn.Parameter]) -> float:
    """Return the L2 norm of the concatenated gradient vector.

    Mirrors `torch.nn.utils.get_total_norm` for the gradient case so the lesson
    does not depend on a particular PyTorch version that may or may not expose
    that helper.
    """

    squared_sum = 0.0
    for param in parameters:
        if param.grad is None:
            continue
        grad = param.grad.detach()
        squared_sum += float(grad.pow(2).sum().item())
    return math.sqrt(squared_sum)


class TrainState:
    """Bind a model, an AdamW optimizer, a schedule, and a loss function.

    The class owns the step counter so the schedule axis is the durable one.
    """

    def __init__(
        self,
        model: nn.Module,
        schedule: CosineWithWarmup,
        loss_fn: Callable[[torch.Tensor, torch.Tensor], torch.Tensor],
        weight_decay: float = 0.01,
        betas: tuple[float, float] = (0.9, 0.95),
        eps: float = 1e-8,
    ) -> None:
        self.model = model
        self.schedule = schedule
        self.loss_fn = loss_fn
        self.optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=schedule.lr(0),
            betas=betas,
            eps=eps,
            weight_decay=weight_decay,
        )
        self.global_step = 0
        self._log: list[StepLog] = []

    def set_lr(self, lr: float) -> None:
        for group in self.optimizer.param_groups:
            group["lr"] = lr

    @property
    def log(self) -> list[StepLog]:
        return list(self._log)

    def step(self, batch_inputs: torch.Tensor, batch_targets: torch.Tensor) -> StepLog:
        self.model.train()
        self.optimizer.zero_grad(set_to_none=True)
        predictions = self.model(batch_inputs)
        loss = self.loss_fn(predictions, batch_targets)
        loss.backward()
        grad_norm = gradient_l2_norm(self.model.parameters())
        rate = self.schedule.lr(self.global_step)
        self.set_lr(rate)
        self.optimizer.step()
        record = StepLog(
            step=self.global_step,
            lr=rate,
            grad_l2_norm=grad_norm,
            loss=float(loss.detach().item()),
        )
        self._log.append(record)
        self.global_step += 1
        return record


def plot_schedule_ascii(
    schedule: CosineWithWarmup,
    width: int = PLOT_WIDTH,
    height: int = PLOT_HEIGHT,
) -> str:
    """Return a text plot of the schedule across [0, total_steps]."""

    if width <= 2 or height <= 2:
        raise ValueError("width and height must be at least 3")
    total = schedule.total_steps
    step_axis = [
        int(round(i * total / max(1, width - 1))) for i in range(width)
    ]
    rates = [schedule.lr(step) for step in step_axis]
    upper = max(rates)
    if upper <= 0:
        upper = 1.0

    grid = [[" "] * width for _ in range(height)]
    for col, rate in enumerate(rates):
        row = int(round((height - 1) * (1.0 - rate / upper)))
        row = max(0, min(height - 1, row))
        grid[row][col] = "*"

    rows: list[str] = []
    for r, row in enumerate(grid):
        label = upper * (1.0 - r / max(1, height - 1))
        rows.append(f"{label:8.6f} | " + "".join(row))
    axis = " " * 10 + "+" + "-" * width
    last_label = (
        " " * 11
        + f"step 0"
        + " " * (width - len("step 0") - len(f"step {total}"))
        + f"step {total}"
    )
    return "\n".join(rows + [axis, last_label])


def write_schedule_csv(schedule: CosineWithWarmup, path: Path) -> None:
    """Write one row per step to a CSV with columns (step, lr)."""

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["step", "lr"])
        for step, rate in schedule.points():
            writer.writerow([step, f"{rate:.10f}"])


def write_step_log_csv(log: Iterable[StepLog], path: Path) -> None:
    """Write the training log to a CSV with the canonical schema."""

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["step", "lr", "grad_l2_norm", "loss"])
        for row in log:
            writer.writerow(row.to_csv_row())


@dataclass
class LinearWarmupConstant:
    """Alternative schedule: linear warmup followed by a flat lr_max plateau.

    Useful as a baseline for ablations against the cosine variant. The same
    contract: lr(0) is zero (with non-zero warmup) and the rate stays at
    lr_max for steps beyond warmup_steps.
    """

    warmup_steps: int
    lr_max: float

    def __post_init__(self) -> None:
        if self.warmup_steps < 0:
            raise ValueError("warmup_steps must be non-negative")
        if self.lr_max <= 0:
            raise ValueError("lr_max must be positive")

    def lr(self, step: int) -> float:
        if step < 0:
            raise ValueError(f"step must be non-negative, got {step}")
        if self.warmup_steps == 0:
            return self.lr_max
        if step >= self.warmup_steps:
            return self.lr_max
        return self.lr_max * (step / self.warmup_steps)


@dataclass
class InverseSqrtWarmup:
    """Linear warmup followed by an inverse-square-root decay.

    Decays as lr_max * sqrt(warmup_steps / step) for step > warmup_steps. Used
    historically in transformer training and useful as a comparison baseline.
    """

    warmup_steps: int
    lr_max: float

    def __post_init__(self) -> None:
        if self.warmup_steps <= 0:
            raise ValueError("inverse-sqrt warmup requires warmup_steps > 0")
        if self.lr_max <= 0:
            raise ValueError("lr_max must be positive")

    def lr(self, step: int) -> float:
        if step < 0:
            raise ValueError(f"step must be non-negative, got {step}")
        if step <= self.warmup_steps:
            return self.lr_max * (step / self.warmup_steps)
        return self.lr_max * math.sqrt(self.warmup_steps / step)


@dataclass
class EWMA:
    """Exponentially weighted moving average of a scalar, useful for grad-norm smoothing."""

    beta: float
    value: float = 0.0
    initialized: bool = False

    def __post_init__(self) -> None:
        if not 0 < self.beta < 1:
            raise ValueError("beta must be in (0, 1)")

    def update(self, sample: float) -> float:
        if not self.initialized:
            self.value = float(sample)
            self.initialized = True
            return self.value
        self.value = self.beta * self.value + (1.0 - self.beta) * float(sample)
        return self.value


@dataclass
class StepLogSummary:
    """Reduction of a per-step log to the numbers a reviewer scans first."""

    steps: int
    lr_peak: float
    lr_final: float
    grad_l2_peak: float
    loss_initial: float
    loss_final: float
    loss_delta: float


def summarize_step_log(log: Iterable[StepLog]) -> StepLogSummary:
    rows = list(log)
    if not rows:
        raise ValueError("step log is empty")
    return StepLogSummary(
        steps=len(rows),
        lr_peak=max(row.lr for row in rows),
        lr_final=rows[-1].lr,
        grad_l2_peak=max(row.grad_l2_norm for row in rows),
        loss_initial=rows[0].loss,
        loss_final=rows[-1].loss,
        loss_delta=rows[-1].loss - rows[0].loss,
    )


def split_decay_groups(
    model: nn.Module,
    weight_decay: float = 0.01,
    no_decay_names: tuple[str, ...] = ("bias", "LayerNorm.weight", "layer_norm.weight"),
) -> list[dict[str, object]]:
    """Split model parameters into a decay and a no-decay group.

    The convention for transformer training is to apply weight decay to dense
    weight matrices but not to biases or LayerNorm gain parameters. This helper
    returns the two parameter-group dicts AdamW accepts.
    """

    decay_params: list[nn.Parameter] = []
    no_decay_params: list[nn.Parameter] = []
    for name, param in model.named_parameters():
        if not param.requires_grad:
            continue
        if any(needle in name for needle in no_decay_names):
            no_decay_params.append(param)
        else:
            decay_params.append(param)
    groups: list[dict[str, object]] = []
    if decay_params:
        groups.append({"params": decay_params, "weight_decay": weight_decay})
    if no_decay_params:
        groups.append({"params": no_decay_params, "weight_decay": 0.0})
    return groups


def build_toy_model(
    in_dim: int = 16,
    out_dim: int = 4,
    seed: int = 7,
) -> tuple[nn.Module, torch.Tensor, torch.Tensor]:
    """Tiny linear model with a fixed batch for the demo."""

    torch.manual_seed(seed)
    model = nn.Sequential(nn.Linear(in_dim, 32), nn.GELU(), nn.Linear(32, out_dim))
    inputs = torch.randn(8, in_dim)
    targets = torch.randn(8, out_dim)
    return model, inputs, targets


def run_demo() -> int:
    """Run 20 training steps on a toy model and render the schedule."""

    model, inputs, targets = build_toy_model()
    schedule = CosineWithWarmup(
        warmup_steps=4,
        total_steps=20,
        lr_max=1e-2,
        lr_min=1e-4,
    )
    state = TrainState(
        model=model,
        schedule=schedule,
        loss_fn=nn.functional.mse_loss,
    )
    for _ in range(20):
        record = state.step(inputs, targets)
        print(
            f"step={record.step:>3} lr={record.lr:.6f} "
            f"grad_l2={record.grad_l2_norm:.6f} loss={record.loss:.6f}"
        )
    print()
    print("learning rate schedule:")
    print(plot_schedule_ascii(schedule, width=40, height=10))
    summary = summarize_step_log(state.log)
    print()
    print(
        f"summary: steps={summary.steps} lr_peak={summary.lr_peak:.6f} "
        f"grad_l2_peak={summary.grad_l2_peak:.6f} loss_delta={summary.loss_delta:.6f}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
