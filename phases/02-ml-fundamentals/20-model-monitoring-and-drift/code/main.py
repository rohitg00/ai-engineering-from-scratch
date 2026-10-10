"""Drift monitoring from scratch: PSI, two-sample KS, chi-square, windows, and alerts.

Lesson: phases/02-ml-fundamentals/20-model-monitoring-and-drift/docs/en.md
KS p-values use the large-sample Kolmogorov distribution.
Chi-square p-values use the regularized upper incomplete gamma function.
The demo streams 9000 synthetic events with covariate drift and later concept drift.
"""

from __future__ import annotations

import bisect
import math
import random
from collections import deque
from dataclasses import dataclass, field


def quantile_edges(reference: list[float], bins: int = 10) -> list[float]:
    ordered = sorted(reference)
    n = len(ordered)
    edges = [ordered[min(n - 1, (n * i) // bins)] for i in range(1, bins)]
    return sorted(set(edges))


def bin_fractions(values: list[float], edges: list[float]) -> list[float]:
    counts = [0] * (len(edges) + 1)
    for value in values:
        counts[bisect.bisect_right(edges, value)] += 1
    total = len(values)
    return [c / total for c in counts]


def psi_from_fractions(expected: list[float], actual: list[float], eps: float = 1e-4) -> float:
    total = 0.0
    for e, a in zip(expected, actual):
        e, a = max(e, eps), max(a, eps)
        total += (a - e) * math.log(a / e)
    return total


def psi(reference: list[float], current: list[float], bins: int = 10) -> float:
    edges = quantile_edges(reference, bins)
    return psi_from_fractions(bin_fractions(reference, edges), bin_fractions(current, edges))


def ks_statistic(sample_a: list[float], sample_b: list[float]) -> float:
    a, b = sorted(sample_a), sorted(sample_b)
    n, m = len(a), len(b)
    i = j = 0
    d = 0.0
    while i < n and j < m:
        x = min(a[i], b[j])
        while i < n and a[i] <= x:
            i += 1
        while j < m and b[j] <= x:
            j += 1
        d = max(d, abs(i / n - j / m))
    return d


def ks_pvalue(d: float, n: int, m: int) -> float:
    effective_n = n * m / (n + m)
    lam = math.sqrt(effective_n) * d
    if lam < 1e-3:
        return 1.0
    total = 0.0
    for k in range(1, 101):
        term = 2 * (-1) ** (k - 1) * math.exp(-2 * k * k * lam * lam)
        total += term
        if abs(term) < 1e-12:
            break
    return min(1.0, max(0.0, total))


def _gamma_p_series(a: float, x: float) -> float:
    term = total = 1.0 / a
    ap = a
    for _ in range(1000):
        ap += 1
        term *= x / ap
        total += term
        if abs(term) < abs(total) * 1e-15:
            break
    return total * math.exp(-x + a * math.log(x) - math.lgamma(a))


def _gamma_q_fraction(a: float, x: float) -> float:
    tiny = 1e-300
    b = x + 1 - a
    c = 1 / tiny
    d = 1 / b
    h = d
    for i in range(1, 1000):
        an = -i * (i - a)
        b += 2
        d = an * d + b
        d = tiny if abs(d) < tiny else d
        c = b + an / c
        c = tiny if abs(c) < tiny else c
        d = 1 / d
        delta = d * c
        h *= delta
        if abs(delta - 1) < 1e-15:
            break
    return math.exp(-x + a * math.log(x) - math.lgamma(a)) * h


def chi2_sf(x: float, dof: int) -> float:
    if x <= 0:
        return 1.0
    a, y = dof / 2, x / 2
    if y < a + 1:
        return max(0.0, 1.0 - _gamma_p_series(a, y))
    return _gamma_q_fraction(a, y)


@dataclass(frozen=True)
class ChiSquareResult:
    statistic: float
    dof: int
    p_value: float
    cramers_v: float


def chi_square_test(reference_counts: dict[str, int], current_counts: dict[str, int]) -> ChiSquareResult:
    categories = [c for c in sorted(set(reference_counts) | set(current_counts))
                  if reference_counts.get(c, 0) + current_counts.get(c, 0) > 0]
    rows = [[reference_counts.get(c, 0) for c in categories], [current_counts.get(c, 0) for c in categories]]
    row_totals = [sum(r) for r in rows]
    grand = sum(row_totals)
    if len(categories) < 2 or 0 in row_totals:
        return ChiSquareResult(0.0, 0, 1.0, 0.0)
    statistic = 0.0
    for col, _ in enumerate(categories):
        col_total = rows[0][col] + rows[1][col]
        for r in range(2):
            expected = row_totals[r] * col_total / grand
            statistic += (rows[r][col] - expected) ** 2 / expected
    dof = len(categories) - 1
    return ChiSquareResult(statistic, dof, chi2_sf(statistic, dof), math.sqrt(statistic / grand))


def count_categories(values: list[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return counts


class SlidingWindow:
    def __init__(self, size: int):
        self.items: deque = deque(maxlen=size)

    def add(self, item: dict) -> None:
        self.items.append(item)

    def full(self) -> bool:
        return len(self.items) == self.items.maxlen

    def column(self, key: str) -> list:
        return [item[key] for item in self.items]


class DriftMonitor:
    def __init__(self, reference: list[dict], numeric: list[str], categorical: list[str], bins: int = 10):
        self.numeric = numeric
        self.categorical = categorical
        self.reference_values = {f: [r[f] for r in reference] for f in numeric}
        self.edges = {f: quantile_edges(v, bins) for f, v in self.reference_values.items()}
        self.expected = {f: bin_fractions(self.reference_values[f], self.edges[f]) for f in numeric}
        self.reference_counts = {f: count_categories([r[f] for r in reference]) for f in categorical}

    def check(self, window: SlidingWindow) -> dict[str, dict[str, float]]:
        report: dict[str, dict[str, float]] = {}
        for f in self.numeric:
            current = window.column(f)
            d = ks_statistic(self.reference_values[f], current)
            report[f] = {
                "psi": psi_from_fractions(self.expected[f], bin_fractions(current, self.edges[f])),
                "ks": d,
                "ks_p": ks_pvalue(d, len(self.reference_values[f]), len(current)),
            }
        for f in self.categorical:
            result = chi_square_test(self.reference_counts[f], count_categories(window.column(f)))
            report[f] = {"chi2": result.statistic, "p": result.p_value, "v": result.cramers_v}
        return report


@dataclass
class AlertPolicy:
    n_tests: int
    family_alpha: float = 0.01
    psi_warn: float = 0.10
    psi_drift: float = 0.25
    ks_drift: float = 0.10
    min_cramers_v: float = 0.10
    patience: int = 2
    streaks: dict[str, int] = field(default_factory=dict)

    @property
    def alpha(self) -> float:
        return self.family_alpha / self.n_tests

    def level(self, metrics: dict[str, float]) -> str:
        if "psi" in metrics:
            if metrics["psi"] >= self.psi_drift or (metrics["ks"] >= self.ks_drift and metrics["ks_p"] < self.alpha):
                return "drift"
            return "warn" if metrics["psi"] >= self.psi_warn else "ok"
        if metrics["p"] < self.alpha and metrics["v"] >= self.min_cramers_v:
            return "drift"
        return "warn" if metrics["p"] < self.alpha else "ok"

    def update(self, name: str, level: str) -> str | None:
        previous = self.streaks.get(name, 0)
        streak = previous + 1 if level == "drift" else 0
        self.streaks[name] = streak
        if streak == self.patience:
            return "ALERT"
        if previous >= self.patience and streak == 0:
            return "resolved"
        return None


@dataclass(frozen=True)
class Segment:
    start: int
    amount_mean: float
    amount_sd: float
    channel_mix: tuple[float, float, float]
    boundary: float


CHANNELS = ("app", "store", "web")

SEGMENTS = (
    Segment(0, 100, 20, (0.35, 0.15, 0.50), 120),
    Segment(3000, 118, 24, (0.60, 0.10, 0.30), 120),
    Segment(5000, 100, 20, (0.35, 0.15, 0.50), 120),
    Segment(6500, 100, 20, (0.35, 0.15, 0.50), 105),
)


def segment_at(t: int, segments: tuple[Segment, ...] = SEGMENTS) -> Segment:
    current = segments[0]
    for segment in segments:
        if t >= segment.start:
            current = segment
    return current


def make_stream(n: int = 9000, seed: int = 7, segments: tuple[Segment, ...] = SEGMENTS) -> list[dict]:
    rng = random.Random(seed)
    events = []
    for t in range(n):
        s = segment_at(t, segments)
        amount = rng.gauss(s.amount_mean, s.amount_sd)
        channel = rng.choices(CHANNELS, weights=s.channel_mix)[0]
        label = 1 if amount + rng.gauss(0, 6) > s.boundary else 0
        events.append({"t": t, "amount": amount, "channel": channel, "label": label})
    return events


def fit_threshold(events: list[dict]) -> float:
    candidates = sorted(e["amount"] for e in events)
    best, best_acc = candidates[0], -1.0
    for threshold in candidates[::5]:
        acc = sum((e["amount"] > threshold) == (e["label"] == 1) for e in events) / len(events)
        if acc > best_acc:
            best, best_acc = threshold, acc
    return best


def labeled_accuracy(events: list[dict], predictions: list[int], now: int, size: int, delay: int) -> float | None:
    known_end = now - delay
    start = max(0, known_end - size)
    if known_end <= start:
        return None
    hits = sum(predictions[i] == events[i]["label"] for i in range(start, known_end))
    return hits / (known_end - start)


@dataclass
class WindowRow:
    end: int
    metrics: dict[str, dict[str, float]]
    levels: dict[str, str]
    accuracy: float | None
    events: list[str]


def run_monitoring(
    events: list[dict],
    reference_size: int = 2000,
    window_size: int = 500,
    step: int = 250,
    label_delay: int = 500,
    accuracy_drop: float = 0.05,
) -> tuple[list[WindowRow], float, float]:
    reference = events[:reference_size]
    threshold = fit_threshold(reference)
    predictions = [1 if e["amount"] > threshold else 0 for e in events]
    reference_accuracy = sum(predictions[i] == events[i]["label"] for i in range(reference_size)) / reference_size
    monitor = DriftMonitor(reference, numeric=["amount"], categorical=["channel"])
    policy = AlertPolicy(n_tests=2)
    window = SlidingWindow(window_size)
    rows: list[WindowRow] = []
    for e in events[reference_size:]:
        window.add(e)
        now = e["t"] + 1
        if not window.full() or (now - reference_size) % step:
            continue
        metrics = monitor.check(window)
        levels = {name: policy.level(m) for name, m in metrics.items()}
        accuracy = labeled_accuracy(events, predictions, now, window_size, label_delay)
        if accuracy is not None:
            levels["accuracy"] = "drift" if accuracy < reference_accuracy - accuracy_drop else "ok"
        notes = []
        for name, level in levels.items():
            outcome = policy.update(name, level)
            if outcome:
                notes.append(f"{outcome} {name}")
        rows.append(WindowRow(now, metrics, levels, accuracy, notes))
    return rows, threshold, reference_accuracy


def first_alert(rows: list[WindowRow], name: str, after: int) -> int | None:
    for row in rows:
        if row.end > after and f"ALERT {name}" in row.events:
            return row.end
    return None


def main() -> None:
    events = make_stream()
    rows, threshold, reference_accuracy = run_monitoring(events)
    print("Stream: 9000 events. Reference = first 2000. Window 500, step 250, label delay 500.")
    print("Changes: covariate drift 3000-5000, normal 5000-6500, concept drift from 6500.")
    print(f"Model: predict 1 when amount > {threshold:.1f}. Reference accuracy {reference_accuracy:.3f}.\n")
    print(f"{'end':>5}  {'PSI':>5}  {'KS D':>5}  {'chi2 p':>7}  {'acc':>5}  levels (amount/channel/accuracy)  events")
    for row in rows:
        amount, channel = row.metrics["amount"], row.metrics["channel"]
        acc = "  -  " if row.accuracy is None else f"{row.accuracy:.3f}"
        levels = "/".join(row.levels.get(k, "-") for k in ("amount", "channel", "accuracy"))
        print(f"{row.end:>5}  {amount['psi']:5.3f}  {amount['ks']:5.3f}  {channel['p']:7.1e}  {acc}  "
              f"{levels:33s}  {', '.join(row.events)}")
    covariate = first_alert(rows, "amount", 3000)
    concept = first_alert(rows, "accuracy", 6500)
    quiet = [r.end for r in rows if r.end > 7000 and r.levels["amount"] != "ok"]
    print(f"\nCovariate drift injected at 3000, input alert at {covariate}.")
    print(f"Concept drift injected at 6500, accuracy alert at {concept} (labels arrive 500 events late).")
    print(f"Input monitors after 7000: {'quiet' if not quiet else 'flagged ' + str(quiet)}. Only outcomes showed the concept drift.")


if __name__ == "__main__":
    main()
