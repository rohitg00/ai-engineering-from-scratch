"""Leaderboard aggregation: pivot, mean, win-rate, bootstrap CI, markdown.

Conceptual references:
- ./docs/en.md (this lesson)
- lesson 71 (classical metrics) for per-task score shape
- lesson 73 (calibration) for the multi-model report pattern

Stdlib + numpy. Run: python3 code/main.py
"""

from __future__ import annotations

import json
import math
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Iterable, Sequence

import numpy as np


@dataclass
class EvalRun:
    model_id: str
    task_id: str
    metric_name: str
    score: float
    category: str = "general"
    weight: float = 1.0


@dataclass
class LeaderboardRow:
    model_id: str
    mean_score: float
    mean_ci_lo: float
    mean_ci_hi: float
    win_rate: float
    tasks_completed: int
    categories: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "model_id": self.model_id,
            "mean_score": self.mean_score,
            "mean_ci_lo": self.mean_ci_lo,
            "mean_ci_hi": self.mean_ci_hi,
            "win_rate": self.win_rate,
            "tasks_completed": self.tasks_completed,
            "categories": dict(self.categories),
        }


@dataclass
class PairwiseDiff:
    model_a: str
    model_b: str
    diff_mean: float
    ci_lo: float
    ci_hi: float
    significant: bool

    def to_dict(self) -> dict:
        return {
            "model_a": self.model_a,
            "model_b": self.model_b,
            "diff_mean": self.diff_mean,
            "ci_lo": self.ci_lo,
            "ci_hi": self.ci_hi,
            "significant": self.significant,
        }


def _validate_runs(runs: Sequence[EvalRun]) -> None:
    seen: set[tuple[str, str]] = set()
    for r in runs:
        if not (0.0 <= r.score <= 1.0):
            raise ValueError(f"score for {r.model_id}/{r.task_id} not in [0,1]: {r.score}")
        key = (r.model_id, r.task_id)
        if key in seen:
            raise ValueError(f"duplicate run for {r.model_id}/{r.task_id}")
        seen.add(key)


def _by_model(runs: Sequence[EvalRun]) -> dict[str, list[EvalRun]]:
    out: dict[str, list[EvalRun]] = defaultdict(list)
    for r in runs:
        out[r.model_id].append(r)
    return dict(out)


def _by_task(runs: Sequence[EvalRun]) -> dict[str, list[EvalRun]]:
    out: dict[str, list[EvalRun]] = defaultdict(list)
    for r in runs:
        out[r.task_id].append(r)
    return dict(out)


def bootstrap_mean_ci(
    scores: Sequence[float],
    b: int = 1000,
    alpha: float = 0.05,
    seed: int = 0,
) -> tuple[float, float]:
    if len(scores) == 0:
        return (0.0, 0.0)
    rng = np.random.default_rng(seed)
    arr = np.asarray(scores, dtype=np.float64)
    n = arr.size
    means = np.empty(b, dtype=np.float64)
    for i in range(b):
        idx = rng.integers(0, n, size=n)
        means[i] = float(arr[idx].mean())
    lo = float(np.percentile(means, 100.0 * (alpha / 2.0)))
    hi = float(np.percentile(means, 100.0 * (1.0 - alpha / 2.0)))
    return (lo, hi)


def bootstrap_pairwise_diff(
    paired_a: Sequence[float],
    paired_b: Sequence[float],
    b: int = 1000,
    alpha: float = 0.05,
    seed: int = 0,
) -> tuple[float, float, float]:
    if len(paired_a) != len(paired_b):
        raise ValueError("paired arrays must align")
    if len(paired_a) == 0:
        return (0.0, 0.0, 0.0)
    rng = np.random.default_rng(seed)
    a = np.asarray(paired_a, dtype=np.float64)
    b_arr = np.asarray(paired_b, dtype=np.float64)
    diffs = a - b_arr
    diff_mean = float(diffs.mean())
    n = diffs.size
    boots = np.empty(b, dtype=np.float64)
    for i in range(b):
        idx = rng.integers(0, n, size=n)
        boots[i] = float(diffs[idx].mean())
    lo = float(np.percentile(boots, 100.0 * (alpha / 2.0)))
    hi = float(np.percentile(boots, 100.0 * (1.0 - alpha / 2.0)))
    return (diff_mean, lo, hi)


def _win_rate(model_id: str, runs_by_task: dict[str, list[EvalRun]]) -> tuple[float, int]:
    wins = 0
    total = 0
    for task_id, runs in runs_by_task.items():
        scores = {r.model_id: r.score for r in runs}
        if model_id not in scores:
            continue
        total += 1
        best = max(scores.values())
        if math.isclose(scores[model_id], best, abs_tol=1e-12):
            wins += 1
    if total == 0:
        return (0.0, 0)
    return (wins / total, total)


def _category_means(runs: Sequence[EvalRun]) -> dict[str, float]:
    by_cat: dict[str, list[float]] = defaultdict(list)
    for r in runs:
        by_cat[r.category].append(r.score)
    return {cat: float(np.mean(scores)) for cat, scores in by_cat.items()}


def aggregate(
    runs: Sequence[EvalRun],
    b: int = 500,
    alpha: float = 0.05,
    seed: int = 0,
) -> list[LeaderboardRow]:
    if not runs:
        return []
    _validate_runs(runs)
    by_model = _by_model(runs)
    by_task = _by_task(runs)
    rows: list[LeaderboardRow] = []
    for model_id, model_runs in by_model.items():
        scores = [r.score for r in model_runs]
        mean_score = float(np.mean(scores))
        lo, hi = bootstrap_mean_ci(scores, b=b, alpha=alpha, seed=seed)
        wr, completed = _win_rate(model_id, by_task)
        cats = _category_means(model_runs)
        rows.append(
            LeaderboardRow(
                model_id=model_id,
                mean_score=mean_score,
                mean_ci_lo=lo,
                mean_ci_hi=hi,
                win_rate=wr,
                tasks_completed=completed if completed else len(scores),
                categories=cats,
            )
        )
    rows.sort(key=lambda r: r.mean_score, reverse=True)
    return rows


def pairwise_diffs(
    runs: Sequence[EvalRun],
    b: int = 500,
    alpha: float = 0.05,
    seed: int = 0,
) -> list[PairwiseDiff]:
    if not runs:
        return []
    _validate_runs(runs)
    by_model = _by_model(runs)
    model_ids = sorted(by_model.keys())
    common_task_scores: dict[str, dict[str, float]] = defaultdict(dict)
    for r in runs:
        common_task_scores[r.task_id][r.model_id] = r.score
    out: list[PairwiseDiff] = []
    for i in range(len(model_ids)):
        for j in range(i + 1, len(model_ids)):
            a, b_id = model_ids[i], model_ids[j]
            paired_a = []
            paired_b = []
            for task_id, ms in common_task_scores.items():
                if a in ms and b_id in ms:
                    paired_a.append(ms[a])
                    paired_b.append(ms[b_id])
            if not paired_a:
                continue
            diff_mean, lo, hi = bootstrap_pairwise_diff(paired_a, paired_b, b=b, alpha=alpha, seed=seed + i + j)
            significant = lo > 0.0 or hi < 0.0
            out.append(PairwiseDiff(
                model_a=a,
                model_b=b_id,
                diff_mean=diff_mean,
                ci_lo=lo,
                ci_hi=hi,
                significant=significant,
            ))
    return out


def render_markdown(rows: Sequence[LeaderboardRow]) -> str:
    header = "| Rank | Model | Mean | 95% CI | Win rate | Tasks |"
    sep = "|------|-------|------|--------|----------|-------|"
    out_lines = [header, sep]
    for i, row in enumerate(rows, start=1):
        model_label = row.model_id[:20]
        ci = f"{row.mean_ci_lo:.2f}-{row.mean_ci_hi:.2f}"
        out_lines.append(
            f"| {i} | {model_label} | {row.mean_score:.2f} | {ci} | {row.win_rate:.2f} | {row.tasks_completed} |"
        )
    return "\n".join(out_lines)


def render_json(rows: Sequence[LeaderboardRow]) -> str:
    return json.dumps([r.to_dict() for r in rows], indent=2)


def _synthetic_runs(seed: int = 0) -> list[EvalRun]:
    rng = np.random.default_rng(seed)
    models = ["model_a", "model_b", "model_c"]
    categories = ["arithmetic", "mcq", "code_exec", "summary"]
    runs: list[EvalRun] = []
    means = {"model_a": 0.78, "model_b": 0.72, "model_c": 0.55}
    for cat in categories:
        for t in range(3):
            task_id = f"{cat}_{t:02d}"
            for m in models:
                base = means[m]
                if cat == "code_exec":
                    base -= 0.1
                if cat == "summary" and m == "model_c":
                    base += 0.15
                noise = rng.uniform(-0.1, 0.1)
                score = float(np.clip(base + noise, 0.0, 1.0))
                metric = {"arithmetic": "exact_match", "mcq": "accuracy", "code_exec": "code_exec", "summary": "rouge_l"}[cat]
                runs.append(EvalRun(model_id=m, task_id=task_id, metric_name=metric, score=score, category=cat))
    return runs


def demo() -> int:
    runs = _synthetic_runs(seed=42)
    rows = aggregate(runs, b=300, alpha=0.05, seed=11)
    diffs = pairwise_diffs(runs, b=300, alpha=0.05, seed=11)
    print(render_markdown(rows))
    print()
    print("Pairwise comparisons (paired bootstrap):")
    for d in diffs:
        sig = "yes" if d.significant else "no"
        print(f"  {d.model_a} vs {d.model_b}: diff={d.diff_mean:+.3f} ci=[{d.ci_lo:+.3f},{d.ci_hi:+.3f}] significant={sig}")
    if not rows:
        return 1
    if rows[0].mean_score < rows[-1].mean_score:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(demo())
