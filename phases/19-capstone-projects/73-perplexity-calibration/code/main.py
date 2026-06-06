"""Perplexity and calibration: ECE, Brier, reliability diagram.

Conceptual references:
- ./docs/en.md (this lesson)
- lesson 70 (task spec format)
- lesson 71 (classical metrics) for the scalar dispatch pattern

Stdlib + numpy. Run: python3 code/main.py
"""

from __future__ import annotations

import math
import sys
from dataclasses import dataclass
from typing import Sequence

import numpy as np


@dataclass
class PerplexityResult:
    perplexity: float
    avg_neg_log_likelihood: float
    total_tokens: int

    def to_dict(self) -> dict:
        return {
            "perplexity": self.perplexity,
            "avg_neg_log_likelihood": self.avg_neg_log_likelihood,
            "total_tokens": self.total_tokens,
        }

    @classmethod
    def from_token_nll(cls, neg_log_probs: Sequence[float], token_counts: Sequence[int]) -> "PerplexityResult":
        if len(neg_log_probs) != len(token_counts):
            raise ValueError("neg_log_probs and token_counts must align")
        total_nll = 0.0
        total_tokens = 0
        for nll, n in zip(neg_log_probs, token_counts):
            if nll < 0:
                raise ValueError("neg_log_probs must be non-negative (did you forget the negation?)")
            if n < 0:
                raise ValueError("token_counts must be non-negative")
            total_nll += float(nll)
            total_tokens += int(n)
        if total_tokens == 0:
            return cls(perplexity=float("nan"), avg_neg_log_likelihood=0.0, total_tokens=0)
        avg_nll = total_nll / total_tokens
        return cls(perplexity=math.exp(avg_nll), avg_neg_log_likelihood=avg_nll, total_tokens=total_tokens)


def perplexity(neg_log_probs: Sequence[float], token_counts: Sequence[int]) -> float:
    return PerplexityResult.from_token_nll(neg_log_probs, token_counts).perplexity


def _validate_probs(confidences: np.ndarray, correct: np.ndarray) -> None:
    if confidences.shape != correct.shape:
        raise ValueError("confidences and correct must have the same shape")
    if confidences.ndim != 1:
        raise ValueError("confidences must be 1-D")
    if confidences.size == 0:
        return
    if float(confidences.min()) < 0.0 or float(confidences.max()) > 1.0:
        raise ValueError("confidences must lie in [0, 1]")
    uniq = set(np.unique(correct).tolist())
    if not uniq.issubset({0, 1, 0.0, 1.0, True, False}):
        raise ValueError("correct must be 0/1 or boolean")


def _bin_indices(confidences: np.ndarray, n_bins: int) -> np.ndarray:
    edges = np.linspace(0.0, 1.0, n_bins + 1)
    idx = np.searchsorted(edges, confidences, side="right") - 1
    idx = np.clip(idx, 0, n_bins - 1)
    return idx


def expected_calibration_error(confidences: Sequence[float], correct: Sequence[int], bins: int = 10) -> tuple[float, int]:
    conf = np.asarray(confidences, dtype=np.float64)
    corr = np.asarray(correct, dtype=np.float64)
    _validate_probs(conf, corr)
    if bins <= 0:
        raise ValueError("bins must be positive")
    n = conf.size
    if n == 0:
        return (0.0, 0)
    idx = _bin_indices(conf, bins)
    total_gap = 0.0
    populated = 0
    for b in range(bins):
        mask = idx == b
        size = int(mask.sum())
        if size == 0:
            continue
        populated += 1
        avg_conf = float(conf[mask].mean())
        avg_acc = float(corr[mask].mean())
        total_gap += (size / n) * abs(avg_conf - avg_acc)
    return (float(total_gap), populated)


def brier_score(confidences: Sequence[float], correct: Sequence[int]) -> float:
    conf = np.asarray(confidences, dtype=np.float64)
    corr = np.asarray(correct, dtype=np.float64)
    _validate_probs(conf, corr)
    if conf.size == 0:
        return 0.0
    return float(np.mean((conf - corr) ** 2))


def brier_decomposition(confidences: Sequence[float], correct: Sequence[int], bins: int = 10) -> dict:
    if bins <= 0:
        raise ValueError("bins must be positive")
    conf = np.asarray(confidences, dtype=np.float64)
    corr = np.asarray(correct, dtype=np.float64)
    _validate_probs(conf, corr)
    n = conf.size
    if n == 0:
        return {"reliability": 0.0, "resolution": 0.0, "uncertainty": 0.0, "brier": 0.0}
    overall = float(corr.mean())
    idx = _bin_indices(conf, bins)
    reliability = 0.0
    resolution = 0.0
    for b in range(bins):
        mask = idx == b
        size = int(mask.sum())
        if size == 0:
            continue
        avg_conf = float(conf[mask].mean())
        avg_acc = float(corr[mask].mean())
        reliability += (size / n) * (avg_conf - avg_acc) ** 2
        resolution += (size / n) * (avg_acc - overall) ** 2
    uncertainty = overall * (1.0 - overall)
    brier = reliability - resolution + uncertainty
    return {
        "reliability": float(reliability),
        "resolution": float(resolution),
        "uncertainty": float(uncertainty),
        "brier": float(brier),
    }


def reliability_diagram(confidences: Sequence[float], correct: Sequence[int], bins: int = 10) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    if bins <= 0:
        raise ValueError("bins must be positive")
    conf = np.asarray(confidences, dtype=np.float64)
    corr = np.asarray(correct, dtype=np.float64)
    _validate_probs(conf, corr)
    if conf.size == 0:
        return (np.zeros(bins), np.zeros(bins), np.zeros(bins, dtype=np.int64))
    idx = _bin_indices(conf, bins)
    bin_conf = np.zeros(bins)
    bin_acc = np.zeros(bins)
    bin_count = np.zeros(bins, dtype=np.int64)
    for b in range(bins):
        mask = idx == b
        size = int(mask.sum())
        bin_count[b] = size
        if size == 0:
            continue
        bin_conf[b] = float(conf[mask].mean())
        bin_acc[b] = float(corr[mask].mean())
    return (bin_conf, bin_acc, bin_count)


@dataclass
class CalibrationReport:
    ece: float
    brier: float
    populated_bins: int
    reliability: tuple
    n_samples: int

    def to_dict(self) -> dict:
        bin_conf, bin_acc, bin_count = self.reliability
        return {
            "ece": self.ece,
            "brier": self.brier,
            "populated_bins": self.populated_bins,
            "n_samples": self.n_samples,
            "reliability": {
                "bin_conf": bin_conf.tolist(),
                "bin_acc": bin_acc.tolist(),
                "bin_count": bin_count.tolist(),
            },
        }

    @classmethod
    def from_predictions(cls, confidences: Sequence[float], correct: Sequence[int], bins: int = 10) -> "CalibrationReport":
        ece, populated = expected_calibration_error(confidences, correct, bins=bins)
        brier = brier_score(confidences, correct)
        rel = reliability_diagram(confidences, correct, bins=bins)
        return cls(
            ece=ece,
            brier=brier,
            populated_bins=populated,
            reliability=rel,
            n_samples=len(confidences),
        )


def synthetic_calibrated(n: int, seed: int = 0) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    confidences = rng.uniform(0.0, 1.0, size=n)
    correct = (rng.uniform(0.0, 1.0, size=n) < confidences).astype(np.int64)
    return confidences, correct


def synthetic_overconfident(n: int, seed: int = 1) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    confidences = rng.uniform(0.7, 1.0, size=n)
    correct = (rng.uniform(0.0, 1.0, size=n) < confidences * 0.5).astype(np.int64)
    return confidences, correct


def synthetic_underconfident(n: int, seed: int = 2) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    confidences = rng.uniform(0.0, 0.3, size=n)
    correct = (rng.uniform(0.0, 1.0, size=n) < 0.5 + confidences).astype(np.int64)
    return confidences, correct


def synthetic_token_nll(seed: int = 0) -> tuple[list[float], list[int]]:
    rng = np.random.default_rng(seed)
    sequences = 12
    counts = rng.integers(20, 60, size=sequences).tolist()
    nlls = []
    for n in counts:
        avg_per_token = rng.uniform(1.5, 3.0)
        nlls.append(float(avg_per_token * n))
    return nlls, [int(c) for c in counts]


def demo() -> int:
    failures = 0
    for label, builder in [
        ("calibrated", synthetic_calibrated),
        ("overconfident", synthetic_overconfident),
        ("underconfident", synthetic_underconfident),
    ]:
        conf, corr = builder(800)
        report = CalibrationReport.from_predictions(conf, corr, bins=10)
        print(f"{label:14s} ece={report.ece:.4f} brier={report.brier:.4f} populated={report.populated_bins}")
        if label == "calibrated" and report.ece > 0.07:
            failures += 1
        if label == "overconfident" and report.ece <= 0.1:
            failures += 1

    nlls, counts = synthetic_token_nll(seed=7)
    pp = PerplexityResult.from_token_nll(nlls, counts)
    print(f"perplexity     value={pp.perplexity:.3f}  avg_nll={pp.avg_neg_log_likelihood:.3f}  tokens={pp.total_tokens}")
    if not (3.0 < pp.perplexity < 25.0):
        failures += 1

    bin_conf, bin_acc, bin_count = reliability_diagram(
        np.array([0.05, 0.15, 0.85, 0.95]),
        np.array([0, 0, 1, 1]),
        bins=10,
    )
    print(f"reliability    populated_bins={(bin_count > 0).sum()}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(demo())
