"""ML system design toolkit: serving cost, baseline comparison, design-doc review.

Lesson: phases/02-ml-fundamentals/19-ml-system-design/docs/en.md
The prices in CostModel are round numbers for the exercise, not vendor quotes.
Run with no arguments for the demo, or pass a JSON design doc path to review it.
"""

from __future__ import annotations

import json
import math
import random
import sys
from dataclasses import dataclass


@dataclass(frozen=True)
class Workload:
    name: str
    entities: int
    requests_per_day: int
    peak_qps: float
    max_staleness_hours: float
    latency_budget_ms: float


@dataclass(frozen=True)
class CostModel:
    batch_dollars_per_million: float = 0.40
    batch_job_hours: float = 1.0
    lookup_dollars_per_million: float = 0.25
    lookup_latency_ms: float = 4.0
    replica_dollars_per_hour: float = 0.50
    replica_qps: float = 200.0
    min_replicas: int = 2
    online_latency_ms: float = 35.0


@dataclass(frozen=True)
class ServingPlan:
    mode: str
    feasible: bool
    dollars_per_day: float
    latency_ms: float
    worst_staleness_hours: float
    predictions_per_day: float
    reason: str


def batch_plan(workload: Workload, costs: CostModel) -> ServingPlan:
    refresh_hours = workload.max_staleness_hours - costs.batch_job_hours
    if refresh_hours <= 0:
        return ServingPlan(
            "batch", False, math.inf, costs.lookup_latency_ms, math.inf, 0.0,
            "staleness limit is shorter than one batch job",
        )
    runs_per_day = 24.0 / refresh_hours
    predictions = workload.entities * runs_per_day
    dollars = (
        predictions / 1e6 * costs.batch_dollars_per_million
        + workload.requests_per_day / 1e6 * costs.lookup_dollars_per_million
    )
    feasible = costs.lookup_latency_ms <= workload.latency_budget_ms
    reason = f"{runs_per_day:.1f} runs per day over {workload.entities:,} entities"
    if not feasible:
        reason = "key-value lookup is slower than the latency budget"
    return ServingPlan(
        "batch", feasible, dollars, costs.lookup_latency_ms,
        workload.max_staleness_hours, predictions, reason,
    )


def online_plan(workload: Workload, costs: CostModel) -> ServingPlan:
    replicas = max(costs.min_replicas, math.ceil(workload.peak_qps / costs.replica_qps))
    dollars = replicas * costs.replica_dollars_per_hour * 24.0
    feasible = costs.online_latency_ms <= workload.latency_budget_ms
    reason = f"{replicas} replicas sized for {workload.peak_qps:g} peak QPS"
    if not feasible:
        reason = "model latency is slower than the latency budget"
    return ServingPlan(
        "online", feasible, dollars, costs.online_latency_ms, 0.0,
        float(workload.requests_per_day), reason,
    )


def choose_serving(workload: Workload, costs: CostModel = CostModel()) -> tuple[ServingPlan | None, list[ServingPlan]]:
    plans = [batch_plan(workload, costs), online_plan(workload, costs)]
    feasible = [plan for plan in plans if plan.feasible]
    best = min(feasible, key=lambda plan: plan.dollars_per_day) if feasible else None
    return best, plans


def check_lengths(y_true: list, y_pred: list) -> None:
    if len(y_true) != len(y_pred):
        raise ValueError(f"y_true has {len(y_true)} values and y_pred has {len(y_pred)}")


def f1_score(y_true: list[int], y_pred: list[int]) -> float:
    check_lengths(y_true, y_pred)
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    return 0.0 if tp == 0 else 2 * tp / (2 * tp + fp + fn)


def mean_absolute_error(y_true: list[float], y_pred: list[float]) -> float:
    check_lengths(y_true, y_pred)
    return sum(abs(t - p) for t, p in zip(y_true, y_pred)) / len(y_true)


def majority_baseline(y_train: list[int], n: int) -> list[int]:
    top = max(sorted(set(y_train)), key=y_train.count)
    return [top] * n


def mean_baseline(y_train: list[float], n: int) -> list[float]:
    return [sum(y_train) / len(y_train)] * n


def base_rate_baseline(y_train: list[int], n: int, seed: int = 0) -> list[int]:
    rate = sum(y_train) / len(y_train)
    rng = random.Random(seed)
    return [1 if rng.random() < rate else 0 for _ in range(n)]


def fit_rule(rows: list[dict], labels: list[int], feature: str) -> float:
    candidates = sorted(set(row[feature] for row in rows))
    best_threshold, best_score = candidates[0], -1.0
    for threshold in candidates:
        score = f1_score(labels, apply_rule(rows, feature, threshold))
        if score > best_score:
            best_threshold, best_score = threshold, score
    return best_threshold


def apply_rule(rows: list[dict], feature: str, threshold: float) -> list[int]:
    return [1 if row[feature] > threshold else 0 for row in rows]


@dataclass(frozen=True)
class BaselineReport:
    metric: str
    scores: dict[str, float]
    best_baseline: str
    lift: float
    min_lift: float

    @property
    def beats_baselines(self) -> bool:
        return self.lift >= self.min_lift


def compare_to_baselines(
    y_true: list,
    model_pred: list,
    baselines: dict[str, list],
    metric,
    metric_name: str,
    higher_is_better: bool = True,
    min_lift: float = 0.02,
) -> BaselineReport:
    if not baselines:
        raise ValueError("a model needs at least one baseline")
    scores = {name: metric(y_true, pred) for name, pred in baselines.items()}
    pick = max if higher_is_better else min
    best_name = pick(scores, key=scores.get)
    model_score = metric(y_true, model_pred)
    lift = model_score - scores[best_name] if higher_is_better else scores[best_name] - model_score
    return BaselineReport(metric_name, {"model": model_score, **scores}, best_name, lift, min_lift)


FEATURES = ("days_idle", "tickets", "tenure_months")


def make_churn_data(n: int, seed: int) -> tuple[list[dict], list[int]]:
    rng = random.Random(seed)
    rows, labels = [], []
    for _ in range(n):
        idle = rng.expovariate(1 / 10)
        tickets = rng.choice([0, 0, 0, 1, 1, 2, 3, 5])
        tenure = rng.uniform(1, 60)
        z = -2.6 + 0.12 * idle + 0.45 * tickets - 0.035 * tenure
        labels.append(1 if rng.random() < 1 / (1 + math.exp(-z)) else 0)
        rows.append({"days_idle": idle, "tickets": tickets, "tenure_months": tenure})
    return rows, labels


class LogisticModel:
    def __init__(self, epochs: int = 300, lr: float = 0.5):
        self.epochs = epochs
        self.lr = lr
        self.means: dict[str, float] = {}
        self.stds: dict[str, float] = {}
        self.weights = [0.0] * len(FEATURES)
        self.bias = 0.0
        self.threshold = 0.5

    def _vector(self, row: dict) -> list[float]:
        return [(row[k] - self.means[k]) / self.stds[k] for k in FEATURES]

    def fit(self, rows: list[dict], labels: list[int]) -> "LogisticModel":
        n = len(rows)
        for k in FEATURES:
            self.means[k] = sum(r[k] for r in rows) / n
            spread = math.sqrt(sum((r[k] - self.means[k]) ** 2 for r in rows) / n)
            self.stds[k] = spread or 1.0
        vectors = [self._vector(r) for r in rows]
        for _ in range(self.epochs):
            grad_w = [0.0] * len(FEATURES)
            grad_b = 0.0
            for x, y in zip(vectors, labels):
                error = self._sigmoid(x) - y
                for j, xj in enumerate(x):
                    grad_w[j] += error * xj
                grad_b += error
            self.weights = [w - self.lr * g / n for w, g in zip(self.weights, grad_w)]
            self.bias -= self.lr * grad_b / n
        probabilities = [self._sigmoid(x) for x in vectors]
        grid = [t / 100 for t in range(5, 96, 5)]
        self.threshold = max(grid, key=lambda t: f1_score(labels, [1 if p >= t else 0 for p in probabilities]))
        return self

    def _sigmoid(self, x: list[float]) -> float:
        z = sum(w * xj for w, xj in zip(self.weights, x)) + self.bias
        return 1 / (1 + math.exp(-max(-50.0, min(50.0, z))))

    def predict(self, rows: list[dict]) -> list[int]:
        return [1 if self._sigmoid(self._vector(r)) >= self.threshold else 0 for r in rows]


ML_TASKS = {
    "binary_classification", "multiclass_classification", "regression",
    "ranking", "forecasting", "anomaly_detection", "clustering",
}
STRONG_BASELINE_KINDS = {"heuristic", "current_system"}


def get_path(doc: dict, path: str):
    node = doc
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node


def _text(doc: dict, path: str) -> bool:
    value = get_path(doc, path)
    return isinstance(value, str) and value.strip() != ""


def _items(doc: dict, path: str) -> bool:
    value = get_path(doc, path)
    return isinstance(value, list) and len(value) > 0


def _positive(doc: dict, path: str) -> bool:
    value = get_path(doc, path)
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0


def _choice(doc: dict, path: str, allowed: set[str]) -> bool:
    value = get_path(doc, path)
    return isinstance(value, str) and value in allowed


def check_baselines(doc: dict) -> bool:
    baselines = get_path(doc, "baselines")
    if not isinstance(baselines, list):
        return False
    return any(isinstance(b, dict) and isinstance(b.get("kind"), str) and b["kind"] in STRONG_BASELINE_KINDS for b in baselines)


def check_rollout(doc: dict) -> bool:
    stages = get_path(doc, "rollout.stages")
    if not isinstance(stages, list) or not all(isinstance(stage, str) for stage in stages):
        return False
    return bool({"shadow", "canary"} & set(stages)) and _text(doc, "rollout.rollback")


def check_failure_modes(doc: dict) -> bool:
    modes = get_path(doc, "failure_modes")
    if not isinstance(modes, list) or not modes:
        return False
    return all(isinstance(m, dict) and str(m.get("default_action", "")).strip() for m in modes)


def workload_from_doc(doc: dict) -> Workload | None:
    needed = {
        "entities": "serving.entities",
        "requests_per_day": "serving.requests_per_day",
        "peak_qps": "budgets.peak_qps",
        "max_staleness_hours": "serving.max_staleness_hours",
        "latency_budget_ms": "budgets.latency_ms_p99",
    }
    values = {key: get_path(doc, path) for key, path in needed.items()}
    for value in values.values():
        if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) or value < 0:
            return None
    return Workload(name=str(get_path(doc, "title") or "design doc"), **values)


def check_serving_fit(doc: dict, costs: CostModel = CostModel()) -> bool:
    workload = workload_from_doc(doc)
    mode = get_path(doc, "serving.mode")
    budget = get_path(doc, "budgets.max_dollars_per_day")
    if workload is None or not isinstance(mode, str) or not isinstance(budget, (int, float)):
        return False
    _, plans = choose_serving(workload, costs)
    chosen = {plan.mode: plan for plan in plans}.get(mode)
    return chosen is not None and chosen.feasible and chosen.dollars_per_day <= budget


@dataclass(frozen=True)
class CheckItem:
    key: str
    weight: int
    blocking: bool
    message: str
    check: object


CHECKLIST = [
    CheckItem("business_goal", 1, False, "state the business goal in one sentence", lambda d: _text(d, "problem.business_goal")),
    CheckItem("ml_task", 1, False, "name the ML task type", lambda d: _choice(d, "problem.ml_task", ML_TASKS)),
    CheckItem("decision", 2, True, "name the action that uses each prediction", lambda d: _text(d, "problem.decision")),
    CheckItem("why_not_rules", 1, False, "explain why a rule or lookup is not enough", lambda d: _text(d, "problem.why_not_rules")),
    CheckItem("offline_metric", 1, False, "list the offline metrics", lambda d: _items(d, "metrics.offline")),
    CheckItem("online_metric", 1, False, "list the online metrics", lambda d: _items(d, "metrics.online")),
    CheckItem("business_metric", 2, True, "list the business metric the model must move", lambda d: _items(d, "metrics.business")),
    CheckItem("guardrails", 1, False, "list guardrail metrics that must not get worse", lambda d: _items(d, "metrics.guardrails")),
    CheckItem("baselines", 2, True, "add a heuristic or current-system baseline", check_baselines),
    CheckItem("label_source", 1, False, "say where the labels come from", lambda d: _text(d, "data.label_source")),
    CheckItem("label_delay", 1, False, "give the label delay in days", lambda d: isinstance(get_path(d, "data.label_delay_days"), (int, float))),
    CheckItem("no_leakage", 2, True, "confirm every feature exists at prediction time", lambda d: get_path(d, "data.features_available_at_prediction_time") is True),
    CheckItem("budgets", 1, False, "set latency, peak QPS, and daily cost budgets", lambda d: all(_positive(d, p) for p in ("budgets.latency_ms_p99", "budgets.peak_qps", "budgets.max_dollars_per_day"))),
    CheckItem("serving_fit", 1, False, "pick a serving mode that meets the staleness, latency, and cost budgets", check_serving_fit),
    CheckItem("rollout", 2, True, "plan a shadow or canary stage and a rollback", check_rollout),
    CheckItem("feedback_loop", 1, False, "describe the feedback loop risk and its mitigation", lambda d: _text(d, "feedback_loop.risk") and _text(d, "feedback_loop.mitigation")),
    CheckItem("failure_modes", 2, True, "give every failure mode a default action", check_failure_modes),
    CheckItem("monitoring", 1, False, "list what you monitor after launch", lambda d: _items(d, "monitoring")),
]


@dataclass(frozen=True)
class Review:
    score: float
    verdict: str
    passed: list[str]
    failed: list[tuple[str, bool, str]]


def review_design_doc(doc: dict, ready_score: float = 0.85) -> Review:
    total = sum(item.weight for item in CHECKLIST)
    passed, failed, earned = [], [], 0
    for item in CHECKLIST:
        if item.check(doc):
            passed.append(item.key)
            earned += item.weight
        else:
            failed.append((item.key, item.blocking, item.message))
    score = earned / total
    blocked = any(blocking for _, blocking, _ in failed)
    verdict = "ready for review" if score >= ready_score and not blocked else "revise"
    failed.sort(key=lambda entry: (not entry[1], entry[0]))
    return Review(score, verdict, passed, failed)


WEAK_DOC = {
    "title": "Churn model v1",
    "problem": {"business_goal": "Reduce churn", "ml_task": "binary_classification"},
    "metrics": {"offline": ["AUC"]},
    "baselines": [{"name": "always predict no churn", "kind": "trivial"}],
    "data": {"label_source": "cancellations table", "features_available_at_prediction_time": False},
    "serving": {"mode": "online"},
}

STRONG_DOC = {
    "title": "Churn save-offer model",
    "problem": {
        "business_goal": "Cut monthly subscriber churn from 4.0 to 3.5 percent",
        "ml_task": "binary_classification",
        "decision": "Send a save offer to the 5 percent of users with the highest churn score each night",
        "why_not_rules": "The idle-days rule reaches F1 0.50 and misses churners who still log in",
    },
    "metrics": {
        "offline": ["F1 at the offer threshold", "precision at top 5 percent"],
        "online": ["offer acceptance rate", "score distribution"],
        "business": ["30-day churn rate in the treated group versus a holdout"],
        "guardrails": ["offer cost per saved user", "unsubscribe rate"],
    },
    "baselines": [
        {"name": "majority class", "kind": "trivial"},
        {"name": "days idle above a fitted threshold", "kind": "heuristic"},
    ],
    "data": {
        "label_source": "billing cancellations joined 30 days after the score date",
        "label_delay_days": 30,
        "features_available_at_prediction_time": True,
    },
    "budgets": {"latency_ms_p99": 100, "peak_qps": 40, "max_dollars_per_day": 5},
    "serving": {"mode": "batch", "entities": 2000000, "requests_per_day": 300000, "max_staleness_hours": 24},
    "rollout": {"stages": ["shadow", "canary", "ab_test"], "rollback": "Point the job back to the previous model version"},
    "feedback_loop": {
        "risk": "Users who accept offers stay, so future labels under-count churn",
        "mitigation": "Keep a 5 percent random holdout that never gets offers",
    },
    "failure_modes": [
        {"mode": "nightly job fails", "default_action": "Serve yesterday's scores for up to 48 hours"},
        {"mode": "score missing for a new user", "default_action": "Use the idle-days rule"},
    ],
    "monitoring": ["input drift on days_idle", "share of users scored", "offer acceptance rate"],
}

SCENARIOS = [
    Workload("nightly churn scores", 2_000_000, 300_000, 40, 24, 100),
    Workload("feed ranking, 2-hour freshness", 5_000_000, 2_000_000, 120, 2, 80),
    Workload("fraud check at payment", 10_000_000, 800_000, 60, 0.05, 50),
]


def print_serving(costs: CostModel = CostModel()) -> None:
    print("=== Batch versus online serving ===")
    for workload in SCENARIOS:
        best, plans = choose_serving(workload, costs)
        print(f"\n{workload.name}")
        for plan in plans:
            cost = "n/a" if math.isinf(plan.dollars_per_day) else f"${plan.dollars_per_day:,.2f}/day"
            state = "ok " if plan.feasible else "no "
            print(f"  {state}{plan.mode:7s} {cost:>14s}  {plan.latency_ms:5.0f} ms  {plan.reason}")
        print(f"  choose: {best.mode if best else 'none, change the budgets'}")


def print_baselines() -> None:
    print("\n=== Model versus baselines (churn, metric F1) ===")
    train_rows, train_y = make_churn_data(2000, seed=1)
    test_rows, test_y = make_churn_data(1000, seed=2)
    model = LogisticModel().fit(train_rows, train_y)
    threshold = fit_rule(train_rows, train_y, "days_idle")
    report = compare_to_baselines(
        test_y,
        model.predict(test_rows),
        {
            "majority class": majority_baseline(train_y, len(test_y)),
            "random at base rate": base_rate_baseline(train_y, len(test_y)),
            f"days_idle > {threshold:g}": apply_rule(test_rows, "days_idle", threshold),
        },
        f1_score,
        "F1",
    )
    for name, score in sorted(report.scores.items(), key=lambda kv: -kv[1]):
        print(f"  {name:24s} {score:.3f}")
    verdict = "beats" if report.beats_baselines else "does not beat"
    print(f"  model {verdict} the strongest baseline ({report.best_baseline}) by {report.lift:+.3f}")


def print_review(doc: dict) -> None:
    review = review_design_doc(doc)
    print(f"\n{doc.get('title', 'design doc')}: score {review.score:.2f}, verdict: {review.verdict}")
    for key, blocking, message in review.failed:
        tag = "BLOCKING" if blocking else "missing "
        print(f"  {tag} {key}: {message}")


def main(argv: list[str]) -> int:
    if len(argv) > 1:
        with open(argv[1], encoding="utf-8") as handle:
            print_review(json.load(handle))
        return 0
    print_serving()
    print_baselines()
    print("\n=== Design doc review ===")
    print_review(WEAK_DOC)
    print_review(STRONG_DOC)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
