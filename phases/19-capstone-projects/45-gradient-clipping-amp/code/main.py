"""gradient clipping と mixed-precision training step。

実装内容:
- clip_global_l2_norm, a wrapper around torch.nn.utils.clip_grad_norm_ that
  returns both the pre-clip norm and an explicit post-clip norm.
- has_non_finite_grad, a helper that scans gradients for NaN and Inf.
- AmpTrainState, a training-step orchestrator that wires an AdamW optimizer,
  autocast, and GradScaler into one safe step.
- StepLog and SkipLog, structured per-step records.

The demo at the bottom trains a small torch.nn.Linear model for 20 steps and
injects a non-finite gradient on a specific step to exercise the skip path.
Run: python3 code/main.py
"""

from __future__ import annotations

import csv
import math
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Callable, Iterable

try:
    import torch
    from torch import nn
except ImportError as exc:
    raise SystemExit(
        "この lesson には torch が必要です。Install: pip install torch"
    ) from exc


DEFAULT_MAX_NORM = 1.0
DEFAULT_DEVICE = "cpu"
NORM_TYPE = 2.0


@dataclass
class StepLog:
    """step ごとの training log の 1 行。"""

    step: int
    lr: float
    grad_l2_pre_clip: float
    grad_l2_post_clip: float
    loss: float
    skipped: bool
    skip_reason: str
    scaler_scale: float

    def to_csv_row(self) -> list[str]:
        return [
            str(self.step),
            f"{self.lr:.10f}",
            f"{self.grad_l2_pre_clip:.10f}",
            f"{self.grad_l2_post_clip:.10f}",
            f"{self.loss:.10f}",
            "1" if self.skipped else "0",
            self.skip_reason,
            f"{self.scaler_scale:.6f}",
        ]


@dataclass
class SkipLog:
    """alerting と forensics 用の skipped step record。"""

    step: int
    reason: str
    pre_clip_norm: float
    loss: float
    scaler_scale: float


def has_non_finite_grad(parameters: Iterable[torch.nn.Parameter]) -> bool:
    """NaN または Inf を含む gradient があれば True を返す。"""

    for param in parameters:
        if param.grad is None:
            continue
        grad = param.grad.detach()
        if not torch.isfinite(grad).all().item():
            return True
    return False


def compute_global_l2_norm(parameters: Iterable[torch.nn.Parameter]) -> float:
    """clipping せず全 gradient の Euclidean norm を計算する。"""

    squared_sum = 0.0
    for param in parameters:
        if param.grad is None:
            continue
        grad = param.grad.detach()
        squared_sum += float(grad.pow(2).sum().item())
    return math.sqrt(squared_sum)


def clip_global_l2_norm(
    parameters: list[torch.nn.Parameter],
    max_norm: float,
) -> tuple[float, float]:
    """gradient を max_norm に in-place clip し、(pre_clip, post_clip) を返す。

    Returns (pre_clip, post_clip). When pre_clip <= max_norm the gradients are
    untouched and post_clip == pre_clip. When pre_clip > max_norm the gradients
    are scaled by max_norm / pre_clip and post_clip == max_norm.
    """

    if max_norm <= 0:
        raise ValueError("max_norm は正でなければなりません")
    pre_clip = compute_global_l2_norm(parameters)
    if not math.isfinite(pre_clip):
        return pre_clip, pre_clip
    if pre_clip <= max_norm:
        return pre_clip, pre_clip
    scale = max_norm / (pre_clip + 1e-12)
    for param in parameters:
        if param.grad is not None:
            param.grad.detach().mul_(scale)
    return pre_clip, max_norm


class AmpTrainState:
    """mixed precision と gradient clipping を使う training step。

    Wires together a model, an AdamW optimizer, a GradScaler, and an autocast
    device. Exposes step(inputs, targets) which:

      1. Forward pass under autocast.
      2. Loss finiteness check; non-finite loss skips backward.
      3. Backward through scaler.scale(loss).
      4. scaler.unscale_(optimizer).
      5. Gradient finiteness check; non-finite grad skips optimizer step.
      6. Clip to max_norm.
      7. scaler.step(optimizer); scaler.update().
    """

    def __init__(
        self,
        model: nn.Module,
        lr: float = 1e-2,
        max_norm: float = DEFAULT_MAX_NORM,
        device_type: str = DEFAULT_DEVICE,
        weight_decay: float = 0.01,
        amp_dtype: torch.dtype | None = None,
    ) -> None:
        if max_norm <= 0:
            raise ValueError("max_norm は正でなければなりません")
        if device_type not in ("cpu", "cuda"):
            raise ValueError(f"device_type must be 'cpu' or 'cuda', got {device_type}")
        self.model = model
        self.max_norm = max_norm
        self.device_type = device_type
        self.optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=lr,
            weight_decay=weight_decay,
        )
        scaler_enabled = device_type == "cuda"
        self.scaler = torch.amp.GradScaler(device_type, enabled=scaler_enabled)
        if amp_dtype is None:
            amp_dtype = torch.bfloat16 if device_type == "cpu" else torch.float16
        self.amp_dtype = amp_dtype
        self.global_step = 0
        self._log: list[StepLog] = []
        self._skip_log: list[SkipLog] = []
        self._loss_fn: Callable[[torch.Tensor, torch.Tensor], torch.Tensor] = nn.functional.mse_loss

    @property
    def log(self) -> list[StepLog]:
        return list(self._log)

    @property
    def skip_log(self) -> list[SkipLog]:
        return list(self._skip_log)

    @property
    def skip_count(self) -> int:
        return len(self._skip_log)

    def set_loss_fn(self, fn: Callable[[torch.Tensor, torch.Tensor], torch.Tensor]) -> None:
        self._loss_fn = fn

    def set_lr(self, lr: float) -> None:
        for group in self.optimizer.param_groups:
            group["lr"] = lr

    def _current_lr(self) -> float:
        return float(self.optimizer.param_groups[0]["lr"])

    def step(
        self,
        inputs: torch.Tensor,
        targets: torch.Tensor,
        gradient_corruptor: Callable[[nn.Module], None] | None = None,
    ) -> StepLog:
        """test 用に optional gradient corruption 付きで training step を 1 回実行する。

        `gradient_corruptor` lets the demo inject a non-finite gradient after
        backward and before the unscale step. Production callers leave it as
        None; tests pass a closure that writes Inf into one parameter's grad.
        """

        self.model.train()
        self.optimizer.zero_grad(set_to_none=True)

        with torch.amp.autocast(device_type=self.device_type, dtype=self.amp_dtype):
            predictions = self.model(inputs)
            loss = self._loss_fn(predictions, targets)

        if not torch.isfinite(loss).all().item():
            # Skip without touching scaler.update(): we never called
            # scaler.scale(loss).backward() for this step, so calling update()
            # here would violate GradScaler's required call ordering.
            return self._record_skip(
                loss_value=float(loss.detach().cpu().item()),
                reason="non_finite_loss",
                pre_clip=0.0,
                update_scaler=False,
            )

        self.scaler.scale(loss).backward()
        if gradient_corruptor is not None:
            gradient_corruptor(self.model)
        self.scaler.unscale_(self.optimizer)

        if has_non_finite_grad(self.model.parameters()):
            scale_before = float(self.scaler.get_scale())
            self.scaler.update()
            record = StepLog(
                step=self.global_step,
                lr=self._current_lr(),
                grad_l2_pre_clip=float("inf"),
                grad_l2_post_clip=float("inf"),
                loss=float(loss.detach().item()),
                skipped=True,
                skip_reason="non_finite_grad",
                scaler_scale=scale_before,
            )
            self._log.append(record)
            self._skip_log.append(
                SkipLog(
                    step=self.global_step,
                    reason="non_finite_grad",
                    pre_clip_norm=float("inf"),
                    loss=float(loss.detach().item()),
                    scaler_scale=scale_before,
                )
            )
            self.global_step += 1
            return record

        pre_clip, post_clip = clip_global_l2_norm(list(self.model.parameters()), self.max_norm)

        self.scaler.step(self.optimizer)
        self.scaler.update()
        record = StepLog(
            step=self.global_step,
            lr=self._current_lr(),
            grad_l2_pre_clip=pre_clip,
            grad_l2_post_clip=post_clip,
            loss=float(loss.detach().item()),
            skipped=False,
            skip_reason="",
            scaler_scale=float(self.scaler.get_scale()),
        )
        self._log.append(record)
        self.global_step += 1
        return record

    def _record_skip(
        self,
        loss_value: float,
        reason: str,
        pre_clip: float,
        update_scaler: bool = True,
    ) -> StepLog:
        record = StepLog(
            step=self.global_step,
            lr=self._current_lr(),
            grad_l2_pre_clip=pre_clip,
            grad_l2_post_clip=pre_clip,
            loss=loss_value,
            skipped=True,
            skip_reason=reason,
            scaler_scale=float(self.scaler.get_scale()),
        )
        self._log.append(record)
        self._skip_log.append(
            SkipLog(
                step=self.global_step,
                reason=reason,
                pre_clip_norm=pre_clip,
                loss=loss_value,
                scaler_scale=float(self.scaler.get_scale()),
            )
        )
        self.global_step += 1
        if update_scaler:
            self.scaler.update()
        return record


def rolling_skip_rate(log: Iterable[StepLog], window: int = 1000) -> list[float]:
    """各 step について直近 `window` step の rolling skip rate を返す。"""

    if window <= 0:
        raise ValueError("window は正でなければなりません")
    rows = list(log)
    rates: list[float] = []
    skipped: list[int] = []
    for row in rows:
        skipped.append(1 if row.skipped else 0)
        if len(skipped) > window:
            skipped = skipped[-window:]
        rates.append(sum(skipped) / len(skipped))
    return rates


def write_step_log_csv(log: Iterable[StepLog], path: Path) -> None:
    """canonical training-step CSV を書く。

    Columns: step, lr, grad_l2_pre_clip, grad_l2_post_clip, loss, skipped,
    skip_reason, scaler_scale.
    """

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            [
                "step",
                "lr",
                "grad_l2_pre_clip",
                "grad_l2_post_clip",
                "loss",
                "skipped",
                "skip_reason",
                "scaler_scale",
            ]
        )
        for row in log:
            writer.writerow(row.to_csv_row())


def build_toy_model(
    in_dim: int = 16,
    out_dim: int = 4,
    seed: int = 7,
) -> tuple[nn.Module, torch.Tensor, torch.Tensor]:
    torch.manual_seed(seed)
    model = nn.Sequential(nn.Linear(in_dim, 32), nn.GELU(), nn.Linear(32, out_dim))
    inputs = torch.randn(8, in_dim)
    targets = torch.randn(8, out_dim)
    return model, inputs, targets


def inject_inf_into_first_grad(model: nn.Module) -> None:
    """test 専用: 最初の parameter gradient に +Inf を書き込む。"""

    for param in model.parameters():
        if param.grad is not None:
            param.grad.data[...] = float("inf")
            return


def run_demo() -> int:
    """20 step 学習し、既知の step で non-finite gradient を注入する。"""

    model, inputs, targets = build_toy_model()
    state = AmpTrainState(model=model, lr=1e-2, max_norm=1.0, device_type="cpu")
    for index in range(20):
        corruptor: Callable[[nn.Module], None] | None = None
        if index == 5:
            corruptor = inject_inf_into_first_grad
        record = state.step(inputs, targets, gradient_corruptor=corruptor)
        marker = "SKIP" if record.skipped else "STEP"
        print(
            f"{marker} step={record.step:>3} lr={record.lr:.6f} "
            f"pre_clip={record.grad_l2_pre_clip:>10.6f} "
            f"post_clip={record.grad_l2_post_clip:>10.6f} "
            f"loss={record.loss:.6f} scale={record.scaler_scale:.1f} "
            f"reason={record.skip_reason or '-'}"
        )
    print()
    print(
        f"skip_count={state.skip_count} "
        f"final_skip_rate={rolling_skip_rate(state.log, window=10)[-1]:.4f}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
