"""cosine-with-warmup schedule と AdamW 接続の unit tests。

実行: python3 -m unittest discover code/tests -v
"""

from __future__ import annotations

import csv
import math
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import torch
from torch import nn

from main import (
    CosineWithWarmup,
    EWMA,
    InverseSqrtWarmup,
    LinearWarmupConstant,
    StepLog,
    StepLogSummary,
    TrainState,
    build_toy_model,
    gradient_l2_norm,
    plot_schedule_ascii,
    split_decay_groups,
    summarize_step_log,
    write_schedule_csv,
    write_step_log_csv,
)


class ScheduleBoundaryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.schedule = CosineWithWarmup(
            warmup_steps=10,
            total_steps=100,
            lr_max=1.0,
            lr_min=0.1,
        )

    def test_step_zero_is_exactly_zero(self) -> None:
        self.assertEqual(self.schedule.lr(0), 0.0)

    def test_warmup_endpoint_is_exactly_lr_max(self) -> None:
        self.assertAlmostEqual(self.schedule.lr(10), 1.0, places=10)

    def test_total_endpoint_is_exactly_lr_min(self) -> None:
        self.assertAlmostEqual(self.schedule.lr(100), 0.1, places=10)

    def test_past_total_pins_at_lr_min(self) -> None:
        self.assertEqual(self.schedule.lr(101), 0.1)
        self.assertEqual(self.schedule.lr(10_000), 0.1)

    def test_negative_step_raises(self) -> None:
        with self.assertRaises(ValueError):
            self.schedule.lr(-1)


class ScheduleShapeTests(unittest.TestCase):
    def test_warmup_is_linear(self) -> None:
        schedule = CosineWithWarmup(warmup_steps=10, total_steps=100, lr_max=1.0)
        for step in range(10):
            self.assertAlmostEqual(schedule.lr(step), step / 10.0, places=10)

    def test_decay_is_monotonic_non_increasing(self) -> None:
        schedule = CosineWithWarmup(warmup_steps=10, total_steps=100, lr_max=1.0, lr_min=0.1)
        previous = schedule.lr(10)
        for step in range(11, 101):
            current = schedule.lr(step)
            self.assertLessEqual(current, previous + 1e-12)
            previous = current

    def test_zero_warmup_starts_at_peak(self) -> None:
        schedule = CosineWithWarmup(warmup_steps=0, total_steps=100, lr_max=1.0)
        self.assertAlmostEqual(schedule.lr(0), 1.0, places=10)


class ScheduleValidationTests(unittest.TestCase):
    def test_warmup_must_not_exceed_total(self) -> None:
        with self.assertRaises(ValueError):
            CosineWithWarmup(warmup_steps=200, total_steps=100, lr_max=1.0)

    def test_lr_max_must_be_positive(self) -> None:
        with self.assertRaises(ValueError):
            CosineWithWarmup(warmup_steps=0, total_steps=100, lr_max=0.0)

    def test_lr_min_must_not_exceed_lr_max(self) -> None:
        with self.assertRaises(ValueError):
            CosineWithWarmup(warmup_steps=0, total_steps=100, lr_max=1.0, lr_min=2.0)


class GradientNormTests(unittest.TestCase):
    def test_gradient_norm_matches_known_value(self) -> None:
        param_a = nn.Parameter(torch.zeros(3))
        param_a.grad = torch.tensor([3.0, 0.0, 4.0])
        param_b = nn.Parameter(torch.zeros(2))
        param_b.grad = torch.tensor([0.0, 0.0])
        self.assertAlmostEqual(gradient_l2_norm([param_a, param_b]), 5.0, places=6)

    def test_gradient_norm_ignores_none_grads(self) -> None:
        param = nn.Parameter(torch.zeros(3))
        param.grad = None
        self.assertEqual(gradient_l2_norm([param]), 0.0)


class TrainStateTests(unittest.TestCase):
    def test_train_state_drives_optimizer_with_schedule(self) -> None:
        model, inputs, targets = build_toy_model()
        schedule = CosineWithWarmup(warmup_steps=4, total_steps=10, lr_max=1e-2, lr_min=1e-4)
        state = TrainState(model, schedule, loss_fn=nn.functional.mse_loss)
        records = [state.step(inputs, targets) for _ in range(10)]
        self.assertEqual(records[0].lr, 0.0)
        self.assertAlmostEqual(records[4].lr, 1e-2, places=10)
        self.assertAlmostEqual(records[-1].lr, schedule.lr(9), places=10)

    def test_loss_decreases_across_steps(self) -> None:
        model, inputs, targets = build_toy_model()
        schedule = CosineWithWarmup(warmup_steps=4, total_steps=40, lr_max=1e-2, lr_min=1e-4)
        state = TrainState(model, schedule, loss_fn=nn.functional.mse_loss)
        first = state.step(inputs, targets).loss
        for _ in range(30):
            state.step(inputs, targets)
        last = state.step(inputs, targets).loss
        self.assertLess(last, first)


class PlotAndCsvTests(unittest.TestCase):
    def test_plot_has_correct_number_of_lines(self) -> None:
        schedule = CosineWithWarmup(warmup_steps=2, total_steps=10, lr_max=1.0)
        plot = plot_schedule_ascii(schedule, width=10, height=6)
        lines = plot.splitlines()
        self.assertEqual(len(lines), 6 + 2)  # rows + axis + last label

    def test_plot_rejects_tiny_dimensions(self) -> None:
        schedule = CosineWithWarmup(warmup_steps=0, total_steps=10, lr_max=1.0)
        with self.assertRaises(ValueError):
            plot_schedule_ascii(schedule, width=2, height=5)

    def test_write_schedule_csv_round_trip(self) -> None:
        schedule = CosineWithWarmup(warmup_steps=2, total_steps=10, lr_max=1.0, lr_min=0.1)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "schedule.csv"
            write_schedule_csv(schedule, path)
            with path.open("r", encoding="utf-8") as fh:
                rows = list(csv.reader(fh))
            self.assertEqual(rows[0], ["step", "lr"])
            self.assertEqual(int(rows[1][0]), 0)
            self.assertEqual(int(rows[-1][0]), 10)

    def test_write_step_log_csv_records_all_columns(self) -> None:
        log = [
            StepLog(step=0, lr=0.0, grad_l2_norm=1.0, loss=2.0),
            StepLog(step=1, lr=0.5, grad_l2_norm=0.8, loss=1.5),
        ]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "log.csv"
            write_step_log_csv(log, path)
            with path.open("r", encoding="utf-8") as fh:
                rows = list(csv.reader(fh))
            self.assertEqual(rows[0], ["step", "lr", "grad_l2_norm", "loss"])
            self.assertEqual(len(rows), 3)


class AlternativeScheduleTests(unittest.TestCase):
    def test_linear_warmup_constant_holds_at_peak(self) -> None:
        schedule = LinearWarmupConstant(warmup_steps=5, lr_max=1.0)
        self.assertEqual(schedule.lr(0), 0.0)
        self.assertAlmostEqual(schedule.lr(5), 1.0, places=10)
        self.assertEqual(schedule.lr(100), 1.0)

    def test_inverse_sqrt_warmup_decays(self) -> None:
        schedule = InverseSqrtWarmup(warmup_steps=4, lr_max=1.0)
        peak = schedule.lr(4)
        later = schedule.lr(16)
        self.assertAlmostEqual(peak, 1.0, places=10)
        self.assertAlmostEqual(later, 0.5, places=10)


class EWMATests(unittest.TestCase):
    def test_ewma_initial_sample_is_passed_through(self) -> None:
        ewma = EWMA(beta=0.9)
        self.assertAlmostEqual(ewma.update(2.0), 2.0, places=10)

    def test_ewma_converges_toward_stream_mean(self) -> None:
        ewma = EWMA(beta=0.5)
        for _ in range(50):
            ewma.update(1.0)
        self.assertAlmostEqual(ewma.value, 1.0, places=6)

    def test_ewma_rejects_invalid_beta(self) -> None:
        with self.assertRaises(ValueError):
            EWMA(beta=0.0)
        with self.assertRaises(ValueError):
            EWMA(beta=1.0)


class SummaryAndGroupTests(unittest.TestCase):
    def test_summary_extracts_peaks_and_delta(self) -> None:
        log = [
            StepLog(step=0, lr=0.0, grad_l2_norm=0.5, loss=2.0),
            StepLog(step=1, lr=0.5, grad_l2_norm=1.5, loss=1.0),
            StepLog(step=2, lr=1.0, grad_l2_norm=1.0, loss=0.5),
        ]
        summary = summarize_step_log(log)
        self.assertEqual(summary.steps, 3)
        self.assertEqual(summary.lr_peak, 1.0)
        self.assertEqual(summary.grad_l2_peak, 1.5)
        self.assertAlmostEqual(summary.loss_delta, -1.5, places=10)

    def test_summary_rejects_empty_log(self) -> None:
        with self.assertRaises(ValueError):
            summarize_step_log([])

    def test_split_decay_separates_bias_and_layernorm(self) -> None:
        model = nn.Sequential(nn.LayerNorm(8), nn.Linear(8, 4))
        groups = split_decay_groups(model, weight_decay=0.01)
        decay_params = []
        no_decay_params = []
        for group in groups:
            if group["weight_decay"] > 0:
                decay_params.extend(group["params"])
            else:
                no_decay_params.extend(group["params"])
        self.assertGreater(len(decay_params), 0)
        self.assertGreater(len(no_decay_params), 0)


if __name__ == "__main__":
    unittest.main()
