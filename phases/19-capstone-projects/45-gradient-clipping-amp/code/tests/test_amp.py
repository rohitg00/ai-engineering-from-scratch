"""gradient clipping と mixed-precision training の unit tests。

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
    AmpTrainState,
    StepLog,
    build_toy_model,
    clip_global_l2_norm,
    compute_global_l2_norm,
    has_non_finite_grad,
    inject_inf_into_first_grad,
    rolling_skip_rate,
    write_step_log_csv,
)


def _make_param_with_grad(values: list[float]) -> nn.Parameter:
    param = nn.Parameter(torch.zeros(len(values)))
    param.grad = torch.tensor(values, dtype=torch.float32)
    return param


class GlobalNormTests(unittest.TestCase):
    def test_global_l2_norm_matches_known_value(self) -> None:
        params = [_make_param_with_grad([3.0, 0.0, 4.0])]
        self.assertAlmostEqual(compute_global_l2_norm(params), 5.0, places=6)

    def test_global_l2_norm_spans_multiple_params(self) -> None:
        params = [_make_param_with_grad([3.0, 0.0]), _make_param_with_grad([4.0])]
        self.assertAlmostEqual(compute_global_l2_norm(params), 5.0, places=6)

    def test_global_l2_norm_handles_none_grad(self) -> None:
        param = nn.Parameter(torch.zeros(3))
        param.grad = None
        self.assertEqual(compute_global_l2_norm([param]), 0.0)


class ClipTests(unittest.TestCase):
    def test_clip_no_op_when_under_max_norm(self) -> None:
        param = _make_param_with_grad([0.3, 0.4])
        pre, post = clip_global_l2_norm([param], max_norm=1.0)
        self.assertAlmostEqual(pre, 0.5, places=6)
        self.assertAlmostEqual(post, 0.5, places=6)
        self.assertAlmostEqual(float(param.grad[0]), 0.3, places=6)

    def test_clip_scales_gradients_above_max_norm(self) -> None:
        param = _make_param_with_grad([6.0, 8.0])  # norm = 10
        pre, post = clip_global_l2_norm([param], max_norm=1.0)
        self.assertAlmostEqual(pre, 10.0, places=6)
        self.assertAlmostEqual(post, 1.0, places=6)
        clipped_norm = math.sqrt(float(param.grad[0]) ** 2 + float(param.grad[1]) ** 2)
        self.assertAlmostEqual(clipped_norm, 1.0, places=6)

    def test_clip_rejects_non_positive_max_norm(self) -> None:
        with self.assertRaises(ValueError):
            clip_global_l2_norm([_make_param_with_grad([1.0])], max_norm=0.0)


class NonFiniteTests(unittest.TestCase):
    def test_has_non_finite_grad_detects_inf(self) -> None:
        param = _make_param_with_grad([1.0, float("inf")])
        self.assertTrue(has_non_finite_grad([param]))

    def test_has_non_finite_grad_detects_nan(self) -> None:
        param = _make_param_with_grad([1.0, float("nan")])
        self.assertTrue(has_non_finite_grad([param]))

    def test_has_non_finite_grad_returns_false_for_clean_grad(self) -> None:
        param = _make_param_with_grad([1.0, 2.0])
        self.assertFalse(has_non_finite_grad([param]))


class AmpTrainStateTests(unittest.TestCase):
    def test_step_clips_high_norm_gradient(self) -> None:
        model, inputs, targets = build_toy_model()
        state = AmpTrainState(model=model, lr=1e-2, max_norm=0.001, device_type="cpu")
        record = state.step(inputs, targets)
        self.assertGreater(record.grad_l2_pre_clip, record.grad_l2_post_clip)
        self.assertAlmostEqual(record.grad_l2_post_clip, 0.001, places=6)

    def test_step_skips_on_injected_inf(self) -> None:
        model, inputs, targets = build_toy_model()
        state = AmpTrainState(model=model, lr=1e-2, max_norm=1.0, device_type="cpu")
        record = state.step(inputs, targets, gradient_corruptor=inject_inf_into_first_grad)
        self.assertTrue(record.skipped)
        self.assertEqual(record.skip_reason, "non_finite_grad")
        self.assertEqual(state.skip_count, 1)

    def test_step_skips_on_non_finite_loss(self) -> None:
        model, inputs, targets = build_toy_model()
        state = AmpTrainState(model=model, lr=1e-2, max_norm=1.0, device_type="cpu")
        state.set_loss_fn(lambda preds, tgts: preds.sum() * float("inf"))
        record = state.step(inputs, targets)
        self.assertTrue(record.skipped)
        self.assertEqual(record.skip_reason, "non_finite_loss")

    def test_state_rejects_invalid_device(self) -> None:
        model, _, _ = build_toy_model()
        with self.assertRaises(ValueError):
            AmpTrainState(model=model, device_type="mars")

    def test_state_rejects_non_positive_max_norm(self) -> None:
        model, _, _ = build_toy_model()
        with self.assertRaises(ValueError):
            AmpTrainState(model=model, max_norm=0.0)


class RollingSkipRateTests(unittest.TestCase):
    def _make_log(self, skip_pattern: list[bool]) -> list[StepLog]:
        rows: list[StepLog] = []
        for index, skipped in enumerate(skip_pattern):
            rows.append(
                StepLog(
                    step=index,
                    lr=1e-2,
                    grad_l2_pre_clip=1.0,
                    grad_l2_post_clip=1.0,
                    loss=1.0,
                    skipped=skipped,
                    skip_reason="x" if skipped else "",
                    scaler_scale=1.0,
                )
            )
        return rows

    def test_rolling_skip_rate_window_is_respected(self) -> None:
        log = self._make_log([True, True, False, False, False])
        rates = rolling_skip_rate(log, window=2)
        self.assertEqual(rates[-1], 0.0)
        self.assertEqual(rates[0], 1.0)
        self.assertEqual(rates[1], 1.0)

    def test_rolling_skip_rate_rejects_zero_window(self) -> None:
        with self.assertRaises(ValueError):
            rolling_skip_rate([], window=0)


class CsvTests(unittest.TestCase):
    def test_write_step_log_csv_columns(self) -> None:
        log = [
            StepLog(
                step=0,
                lr=0.0,
                grad_l2_pre_clip=1.0,
                grad_l2_post_clip=1.0,
                loss=2.0,
                skipped=False,
                skip_reason="",
                scaler_scale=1.0,
            )
        ]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "log.csv"
            write_step_log_csv(log, path)
            with path.open("r", encoding="utf-8") as fh:
                rows = list(csv.reader(fh))
            self.assertEqual(
                rows[0],
                [
                    "step",
                    "lr",
                    "grad_l2_pre_clip",
                    "grad_l2_post_clip",
                    "loss",
                    "skipped",
                    "skip_reason",
                    "scaler_scale",
                ],
            )
            self.assertEqual(rows[1][5], "0")


if __name__ == "__main__":
    unittest.main()
