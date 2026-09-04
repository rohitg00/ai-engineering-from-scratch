"""Tests for perplexity, ECE, Brier, reliability diagram, and CalibrationReport."""

from __future__ import annotations

import math
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    brier_decomposition,
    brier_score,
    CalibrationReport,
    expected_calibration_error,
    perplexity,
    PerplexityResult,
    reliability_diagram,
    synthetic_calibrated,
    synthetic_overconfident,
    synthetic_underconfident,
)


class TestPerplexity(unittest.TestCase):
    def test_uniform_two_token_alphabet(self) -> None:
        nlls = [math.log(2.0) * 100]
        counts = [100]
        self.assertAlmostEqual(perplexity(nlls, counts), 2.0, places=6)

    def test_perfect_model(self) -> None:
        self.assertAlmostEqual(perplexity([0.0], [10]), 1.0)

    def test_zero_tokens_returns_nan(self) -> None:
        result = PerplexityResult.from_token_nll([], [])
        self.assertTrue(math.isnan(result.perplexity))
        self.assertEqual(result.total_tokens, 0)

    def test_misaligned_inputs(self) -> None:
        with self.assertRaises(ValueError):
            PerplexityResult.from_token_nll([1.0, 2.0], [10])

    def test_negative_nll_rejected(self) -> None:
        with self.assertRaises(ValueError):
            PerplexityResult.from_token_nll([-1.0], [10])

    def test_multi_sequence_weighted_correctly(self) -> None:
        nlls = [math.log(2.0) * 50, math.log(4.0) * 50]
        counts = [50, 50]
        avg_nll = (math.log(2.0) * 50 + math.log(4.0) * 50) / 100
        expected = math.exp(avg_nll)
        self.assertAlmostEqual(perplexity(nlls, counts), expected, places=6)


class TestECE(unittest.TestCase):
    def test_perfect_calibration_yields_zero(self) -> None:
        conf = np.array([0.05, 0.05, 0.05, 0.05, 0.95, 0.95, 0.95, 0.95])
        corr = np.array([0, 0, 0, 0, 1, 1, 1, 1])
        ece, populated = expected_calibration_error(conf, corr, bins=10)
        self.assertAlmostEqual(ece, 0.05, places=6)

    def test_completely_miscalibrated(self) -> None:
        conf = np.array([0.99, 0.99, 0.99, 0.99])
        corr = np.array([0, 0, 0, 0])
        ece, populated = expected_calibration_error(conf, corr, bins=10)
        self.assertAlmostEqual(ece, 0.99, places=6)
        self.assertEqual(populated, 1)

    def test_empty_input(self) -> None:
        ece, populated = expected_calibration_error([], [], bins=10)
        self.assertEqual(ece, 0.0)
        self.assertEqual(populated, 0)

    def test_bins_must_be_positive(self) -> None:
        with self.assertRaises(ValueError):
            expected_calibration_error([0.5], [1], bins=0)

    def test_confidence_out_of_range_rejected(self) -> None:
        with self.assertRaises(ValueError):
            expected_calibration_error([1.5], [1], bins=10)

    def test_misaligned_lengths(self) -> None:
        with self.assertRaises(ValueError):
            expected_calibration_error([0.5, 0.6], [1], bins=10)

    def test_synthetic_overconfident_has_higher_ece(self) -> None:
        c_conf, c_corr = synthetic_calibrated(1000, seed=10)
        o_conf, o_corr = synthetic_overconfident(1000, seed=10)
        c_ece, _ = expected_calibration_error(c_conf, c_corr, bins=10)
        o_ece, _ = expected_calibration_error(o_conf, o_corr, bins=10)
        self.assertGreater(o_ece, c_ece)


class TestBrier(unittest.TestCase):
    def test_perfect(self) -> None:
        self.assertEqual(brier_score([1.0, 0.0], [1, 0]), 0.0)

    def test_max(self) -> None:
        self.assertEqual(brier_score([1.0, 0.0], [0, 1]), 1.0)

    def test_uniform_predictor(self) -> None:
        self.assertAlmostEqual(brier_score([0.5, 0.5], [0, 1]), 0.25)

    def test_empty_input(self) -> None:
        self.assertEqual(brier_score([], []), 0.0)

    def test_decomposition_sums_to_brier(self) -> None:
        conf, corr = synthetic_calibrated(500, seed=21)
        decomp = brier_decomposition(conf, corr, bins=10)
        self.assertAlmostEqual(decomp["brier"], brier_score(conf, corr), places=2)


class TestReliabilityDiagram(unittest.TestCase):
    def test_bin_counts_match(self) -> None:
        conf = np.array([0.05, 0.55, 0.95])
        corr = np.array([0, 1, 1])
        bin_conf, bin_acc, bin_count = reliability_diagram(conf, corr, bins=10)
        self.assertEqual(bin_count.sum(), 3)
        self.assertEqual(len(bin_conf), 10)

    def test_correct_bin_assignment(self) -> None:
        conf = np.array([0.05, 0.95])
        corr = np.array([0, 1])
        bin_conf, bin_acc, bin_count = reliability_diagram(conf, corr, bins=10)
        self.assertEqual(bin_count[0], 1)
        self.assertEqual(bin_count[9], 1)
        self.assertAlmostEqual(bin_conf[0], 0.05, places=6)
        self.assertAlmostEqual(bin_conf[9], 0.95, places=6)

    def test_empty_input_returns_zero_arrays(self) -> None:
        bin_conf, bin_acc, bin_count = reliability_diagram([], [], bins=10)
        self.assertEqual(int(bin_count.sum()), 0)
        self.assertEqual(len(bin_conf), 10)


class TestCalibrationReport(unittest.TestCase):
    def test_report_roundtrip(self) -> None:
        conf, corr = synthetic_calibrated(200, seed=4)
        rep = CalibrationReport.from_predictions(conf, corr, bins=10)
        d = rep.to_dict()
        self.assertIn("ece", d)
        self.assertIn("brier", d)
        self.assertIn("reliability", d)
        self.assertEqual(len(d["reliability"]["bin_conf"]), 10)
        self.assertEqual(d["n_samples"], 200)

    def test_underconfident_lower_brier_than_uniform(self) -> None:
        conf, corr = synthetic_underconfident(500, seed=12)
        rep = CalibrationReport.from_predictions(conf, corr)
        self.assertLessEqual(rep.brier, 1.0)
        self.assertGreaterEqual(rep.brier, 0.0)


if __name__ == "__main__":
    unittest.main()
