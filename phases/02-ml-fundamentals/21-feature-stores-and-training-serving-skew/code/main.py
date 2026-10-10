"""A feature store from scratch: registry, backfill, point-in-time join, online store, skew check.

Lesson: phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew/docs/en.md
Time is a whole number of days. Snapshots run every 7 days, like a weekly batch job.
The demo shows label leakage from a naive join and skew from a second serving code path.
"""

from __future__ import annotations

import bisect
import random
from collections import defaultdict
from dataclasses import dataclass


@dataclass(frozen=True)
class Event:
    entity: str
    day: int
    amount: float


@dataclass(frozen=True)
class FeatureDefinition:
    name: str
    entity: str
    aggregate: str
    window_days: int | None
    default: float
    version: int = 1
    owner: str = "growth-team"
    description: str = ""

    def compute(self, events: list[Event], as_of: int) -> float:
        visible = [e for e in events if e.day <= as_of]
        if self.window_days is not None:
            visible = [e for e in visible if e.day > as_of - self.window_days]
        if self.aggregate == "count":
            return float(len(visible))
        if self.aggregate == "sum":
            return round(sum(e.amount for e in visible), 2)
        if self.aggregate == "days_since_last":
            return float(as_of - max(e.day for e in visible)) if visible else self.default
        raise ValueError(f"unknown aggregate {self.aggregate!r}")


class FeatureRegistry:
    def __init__(self) -> None:
        self._definitions: dict[tuple[str, int], FeatureDefinition] = {}

    def register(self, definition: FeatureDefinition) -> None:
        key = (definition.name, definition.version)
        existing = self._definitions.get(key)
        if existing is not None and existing != definition:
            raise ValueError(f"{definition.name} v{definition.version} already exists: bump the version")
        self._definitions[key] = definition

    def get(self, name: str, version: int | None = None) -> FeatureDefinition:
        versions = [v for (n, v) in self._definitions if n == name]
        if not versions:
            raise KeyError(name)
        return self._definitions[(name, version if version is not None else max(versions))]

    def resolve(self, ref: str) -> FeatureDefinition:
        name, _, version = ref.partition("@")
        return self.get(name, int(version) if version else None)

    def names(self) -> list[str]:
        return sorted({n for (n, _) in self._definitions})

    def compute(self, names: list[str], events: list[Event], as_of: int) -> dict[str, float]:
        return {name: self.resolve(name).compute(events, as_of) for name in names}

    def fill_defaults(self, names: list[str], values: dict[str, float] | None) -> dict[str, float]:
        values = values or {}
        return {name: values.get(name, self.resolve(name).default) for name in names}


@dataclass(frozen=True)
class FeatureRow:
    entity: str
    day: int
    values: dict[str, float]


@dataclass(frozen=True)
class LabelRow:
    entity: str
    day: int
    label: int


@dataclass(frozen=True)
class JoinedRow:
    entity: str
    day: int
    label: int
    feature_day: int | None
    values: dict[str, float] | None


def group_events(events: list[Event]) -> dict[str, list[Event]]:
    grouped: dict[str, list[Event]] = defaultdict(list)
    for event in events:
        grouped[event.entity].append(event)
    return grouped


def backfill(registry: FeatureRegistry, names: list[str], events: list[Event], days: list[int]) -> list[FeatureRow]:
    rows = []
    for entity, entity_events in sorted(group_events(events).items()):
        for day in days:
            rows.append(FeatureRow(entity, day, registry.compute(names, entity_events, day)))
    return rows


def point_in_time_join(labels: list[LabelRow], rows: list[FeatureRow], ttl_days: int | None = None) -> list[JoinedRow]:
    by_entity: dict[str, list[FeatureRow]] = defaultdict(list)
    for row in rows:
        by_entity[row.entity].append(row)
    days_index = {}
    for entity, entity_rows in by_entity.items():
        entity_rows.sort(key=lambda r: r.day)
        days_index[entity] = [r.day for r in entity_rows]
    joined = []
    for label in labels:
        days = days_index.get(label.entity, [])
        pos = bisect.bisect_right(days, label.day) - 1
        match = by_entity[label.entity][pos] if pos >= 0 else None
        if match is not None and ttl_days is not None and label.day - match.day > ttl_days:
            match = None
        joined.append(JoinedRow(
            label.entity, label.day, label.label,
            match.day if match else None, match.values if match else None,
        ))
    return joined


def naive_latest_join(labels: list[LabelRow], rows: list[FeatureRow]) -> list[JoinedRow]:
    latest: dict[str, FeatureRow] = {}
    for row in rows:
        if row.entity not in latest or row.day > latest[row.entity].day:
            latest[row.entity] = row
    joined = []
    for label in labels:
        match = latest.get(label.entity)
        joined.append(JoinedRow(
            label.entity, label.day, label.label,
            match.day if match else None, match.values if match else None,
        ))
    return joined


class OnlineStore:
    def __init__(self, ttl_days: int):
        self.ttl_days = ttl_days
        self._latest: dict[str, FeatureRow] = {}

    def write(self, row: FeatureRow) -> None:
        current = self._latest.get(row.entity)
        if current is None or row.day >= current.day:
            self._latest[row.entity] = row

    def read(self, entity: str, now: int) -> dict[str, float] | None:
        row = self._latest.get(entity)
        if row is None or row.day > now or now - row.day > self.ttl_days:
            return None
        return dict(row.values)

    def age(self, entity: str, now: int) -> int | None:
        row = self._latest.get(entity)
        return None if row is None else now - row.day


def materialize(rows: list[FeatureRow], store: OnlineStore, up_to_day: int) -> int:
    written = 0
    for row in rows:
        if row.day <= up_to_day:
            store.write(row)
            written += 1
    return written


def training_features(registry: FeatureRegistry, names: list[str], joined: list[JoinedRow]) -> list[dict[str, float]]:
    return [registry.fill_defaults(names, row.values) for row in joined]


def serving_features(registry: FeatureRegistry, names: list[str], store: OnlineStore, entity: str, now: int) -> dict[str, float]:
    return registry.fill_defaults(names, store.read(entity, now))


def log_serving_requests(
    registry: FeatureRegistry,
    names: list[str],
    offline: list[FeatureRow],
    requests: list[tuple[str, int]],
    ttl_days: int,
) -> dict[tuple[str, int], dict[str, float]]:
    store = OnlineStore(ttl_days)
    log = {}
    for entity, day in sorted(requests, key=lambda r: r[1]):
        materialize(offline, store, up_to_day=day)
        log[(entity, day)] = serving_features(registry, names, store, entity, day)
    return log


def legacy_serving_features(events: list[Event], now: int) -> dict[str, float]:
    recent = [e for e in events if now - 30 <= e.day <= now]
    past = [e.day for e in events if e.day <= now]
    return {
        "days_since_last_purchase": float(now - max(past)) if past else -1.0,
        "purchases_30d": float(len(recent)),
        "spend_30d": round(sum(e.amount for e in recent), 2),
    }


@dataclass(frozen=True)
class SkewReport:
    feature: str
    compared: int
    mismatch_rate: float
    mean_abs_diff: float
    flagged: bool


def detect_skew(
    training: dict[tuple[str, int], dict[str, float]],
    serving: dict[tuple[str, int], dict[str, float]],
    features: list[str],
    tolerance: float = 1e-6,
    max_mismatch_rate: float = 0.01,
) -> list[SkewReport]:
    if set(training) != set(serving):
        raise ValueError(f"{len(set(training) ^ set(serving))} keys are in only one view: log and compare the same requests")
    if not training:
        raise ValueError("no requests to compare")
    keys = sorted(training)
    reports = []
    for feature in features:
        diffs = [abs(training[k][feature] - serving[k][feature]) for k in keys]
        mismatches = sum(1 for d in diffs if d > tolerance)
        rate = mismatches / len(keys)
        mean_diff = sum(diffs) / len(keys)
        reports.append(SkewReport(feature, len(keys), rate, mean_diff, rate > max_mismatch_rate))
    return reports


FEATURES = ["days_since_last_purchase", "purchases_30d", "spend_30d"]


def build_registry() -> FeatureRegistry:
    registry = FeatureRegistry()
    registry.register(FeatureDefinition("purchases_30d", "user", "count", 30, 0.0, description="purchases in the last 30 days"))
    registry.register(FeatureDefinition("spend_30d", "user", "sum", 30, 0.0, description="spend in the last 30 days"))
    registry.register(FeatureDefinition("days_since_last_purchase", "user", "days_since_last", None, 365.0, description="days since the last purchase"))
    return registry


def make_events(n_users: int = 300, days: int = 180, seed: int = 11) -> tuple[list[Event], dict[str, int | None]]:
    rng = random.Random(seed)
    events, churn_day = [], {}
    for u in range(n_users):
        user = f"u{u:03d}"
        rate = rng.uniform(0.08, 0.35)
        stop = rng.randint(40, 170) if rng.random() < 0.5 else None
        churn_day[user] = stop
        for day in range(days):
            if stop is not None and day >= stop:
                break
            if rng.random() < rate:
                events.append(Event(user, day, round(rng.uniform(5, 80), 2)))
    return events, churn_day


def make_labels(events: list[Event], label_days: list[int], horizon: int = 30) -> list[LabelRow]:
    grouped = group_events(events)
    labels = []
    for user in sorted(grouped):
        for day in label_days:
            if not any(e.day <= day for e in grouped[user]):
                continue
            future = any(day < e.day <= day + horizon for e in grouped[user])
            labels.append(LabelRow(user, day, 0 if future else 1))
    return labels


def fit_idle_rule(features: list[dict[str, float]], labels: list[int]) -> tuple[float, float]:
    best_threshold, best_acc = 0.0, -1.0
    for threshold in range(0, 120):
        preds = [1 if f["days_since_last_purchase"] > threshold else 0 for f in features]
        acc = sum(p == y for p, y in zip(preds, labels)) / len(labels)
        if acc > best_acc:
            best_threshold, best_acc = float(threshold), acc
    return best_threshold, best_acc


def rule_accuracy(threshold: float, features: list[dict[str, float]], labels: list[int]) -> float:
    preds = [1 if f["days_since_last_purchase"] > threshold else 0 for f in features]
    return sum(p == y for p, y in zip(preds, labels)) / len(labels)


SNAPSHOT_DAYS = list(range(7, 176, 7))
TTL_DAYS = 10


def main() -> None:
    registry = build_registry()
    events, _ = make_events()
    offline = backfill(registry, FEATURES, events, SNAPSHOT_DAYS)
    print("=== Feature registry ===")
    for name in registry.names():
        d = registry.get(name)
        window = f"{d.window_days}d" if d.window_days else "all"
        print(f"  {d.name:26s} v{d.version}  entity={d.entity}  window={window:4s} default={d.default:g}  {d.description}")
    print(f"  backfilled {len(offline)} rows on {len(SNAPSHOT_DAYS)} weekly snapshot days")

    print("\n=== Point-in-time join versus naive latest join ===")
    train_labels = make_labels(events, [100, 120, 140])
    y_train = [r.label for r in train_labels]
    pit = point_in_time_join(train_labels, offline, TTL_DAYS)
    naive = naive_latest_join(train_labels, offline)
    future = sum(1 for r in naive if r.feature_day is not None and r.feature_day > r.day)
    print(f"  {len(train_labels)} labels, churn rate {sum(y_train) / len(y_train):.2f}")
    print(f"  naive join used a snapshot from after the label day for {future / len(naive):.0%} of rows")
    pit_threshold, pit_acc = fit_idle_rule(training_features(registry, FEATURES, pit), y_train)
    naive_threshold, naive_acc = fit_idle_rule(training_features(registry, FEATURES, naive), y_train)
    print(f"  offline accuracy, naive join: {naive_acc:.3f} (rule: idle > {naive_threshold:g} days)")
    print(f"  offline accuracy, PIT join:   {pit_acc:.3f} (rule: idle > {pit_threshold:g} days)")
    later_labels = make_labels(events, [145])
    later = training_features(registry, FEATURES, point_in_time_join(later_labels, offline, TTL_DAYS))
    y_later = [r.label for r in later_labels]
    print(f"  accuracy on day 145, trained with naive join: {rule_accuracy(naive_threshold, later, y_later):.3f}")
    print(f"  accuracy on day 145, trained with PIT join:   {rule_accuracy(pit_threshold, later, y_later):.3f}")

    print("\n=== Online store with a TTL of 10 days ===")
    store = OnlineStore(TTL_DAYS)
    materialize(offline, store, up_to_day=145)
    user = "u001"
    print(f"  day 145: {user} row age {store.age(user, 145)} days -> {serving_features(registry, FEATURES, store, user, 145)}")
    print(f"  day 160: {user} row age {store.age(user, 160)} days -> {serving_features(registry, FEATURES, store, user, 160)} (expired, defaults)")

    grouped = group_events(events)
    rng = random.Random(5)
    users = sorted(grouped) + [f"new{i:02d}" for i in range(20)]
    requests = sorted({(rng.choice(users), rng.randint(141, 150)) for _ in range(400)})
    print(f"\n=== Skew checks on {len(requests)} logged requests, days 141 to 150 ===")
    joined = point_in_time_join([LabelRow(e, d, 0) for e, d in requests], offline, TTL_DAYS)
    training_view = dict(zip(requests, training_features(registry, FEATURES, joined)))
    store_log = log_serving_requests(registry, FEATURES, offline, requests, TTL_DAYS)
    fresh_log = {(e, d): registry.compute(FEATURES, grouped.get(e, []), d) for e, d in requests}
    legacy_log = {(e, d): legacy_serving_features(grouped.get(e, []), d) for e, d in requests}
    checks = (
        ("online store read  vs  training join (one definition, same snapshots)", training_view, store_log),
        ("fresh compute      vs  training join (staleness only)", training_view, fresh_log),
        ("second code path   vs  fresh compute (code differences only)", fresh_log, legacy_log),
    )
    for title, expected, logged in checks:
        print(f"  {title}")
        for report in detect_skew(expected, logged, FEATURES):
            flag = "SKEW" if report.flagged else "ok  "
            print(f"    {flag} {report.feature:26s} mismatch {report.mismatch_rate:6.1%}  mean |diff| {report.mean_abs_diff:7.2f}")


if __name__ == "__main__":
    main()
