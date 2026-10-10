"""Tests for the from-scratch feature store and skew checks."""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    FEATURES,
    Event,
    FeatureDefinition,
    FeatureRegistry,
    FeatureRow,
    LabelRow,
    OnlineStore,
    backfill,
    build_registry,
    detect_skew,
    legacy_serving_features,
    log_serving_requests,
    make_events,
    make_labels,
    materialize,
    naive_latest_join,
    point_in_time_join,
    serving_features,
    training_features,
)


def rows_for(entity: str, days_and_values: list[tuple[int, float]]) -> list[FeatureRow]:
    return [FeatureRow(entity, day, {"x": value}) for day, value in days_and_values]


class DefinitionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.events = [Event("u", 1, 10.0), Event("u", 5, 20.0), Event("u", 40, 5.0)]
        self.registry = build_registry()

    def test_window_excludes_the_future_and_the_left_edge(self) -> None:
        count = self.registry.get("purchases_30d")
        self.assertEqual(count.compute(self.events, 31), 1.0)
        self.assertEqual(count.compute(self.events, 30), 2.0)
        self.assertEqual(count.compute(self.events, 39), 0.0)

    def test_days_since_uses_default_without_history(self) -> None:
        days_since = self.registry.get("days_since_last_purchase")
        self.assertEqual(days_since.compute(self.events, 0), 365.0)
        self.assertEqual(days_since.compute(self.events, 12), 7.0)

    def test_registry_rejects_a_silent_redefinition(self) -> None:
        registry = FeatureRegistry()
        registry.register(FeatureDefinition("f", "user", "count", 7, 0.0))
        registry.register(FeatureDefinition("f", "user", "count", 7, 0.0))
        with self.assertRaises(ValueError):
            registry.register(FeatureDefinition("f", "user", "count", 14, 0.0))
        registry.register(FeatureDefinition("f", "user", "count", 14, 0.0, version=2))
        self.assertEqual(registry.get("f").window_days, 14)
        self.assertEqual(registry.get("f", version=1).window_days, 7)

    def test_backfill_writes_one_row_per_entity_and_day(self) -> None:
        rows = backfill(self.registry, FEATURES, self.events + [Event("v", 3, 1.0)], [7, 14])
        self.assertEqual(len(rows), 4)
        self.assertEqual({(r.entity, r.day) for r in rows}, {("u", 7), ("u", 14), ("v", 7), ("v", 14)})


class JoinTests(unittest.TestCase):
    def test_point_in_time_join_takes_latest_row_at_or_before_label(self) -> None:
        rows = rows_for("u", [(1, 10.0), (5, 50.0), (9, 90.0)])
        joined = point_in_time_join([LabelRow("u", 7, 1), LabelRow("u", 9, 0)], rows)
        self.assertEqual(joined[0].values, {"x": 50.0})
        self.assertEqual(joined[0].feature_day, 5)
        self.assertEqual(joined[1].feature_day, 9)

    def test_point_in_time_join_returns_none_before_first_row(self) -> None:
        joined = point_in_time_join([LabelRow("u", 0, 1)], rows_for("u", [(1, 10.0)]))
        self.assertIsNone(joined[0].values)

    def test_ttl_drops_rows_that_are_too_old(self) -> None:
        rows = rows_for("u", [(1, 10.0)])
        self.assertIsNone(point_in_time_join([LabelRow("u", 20, 1)], rows, ttl_days=10)[0].values)
        self.assertIsNotNone(point_in_time_join([LabelRow("u", 11, 1)], rows, ttl_days=10)[0].values)

    def test_naive_join_reads_the_future(self) -> None:
        rows = rows_for("u", [(1, 10.0), (9, 90.0)])
        joined = naive_latest_join([LabelRow("u", 3, 1)], rows)
        self.assertEqual(joined[0].feature_day, 9)
        self.assertGreater(joined[0].feature_day, joined[0].day)

    def test_missing_rows_get_registry_defaults(self) -> None:
        registry = build_registry()
        joined = point_in_time_join([LabelRow("ghost", 50, 0)], [])
        values = training_features(registry, FEATURES, joined)[0]
        self.assertEqual(values["days_since_last_purchase"], 365.0)
        self.assertEqual(values["purchases_30d"], 0.0)


class OnlineStoreTests(unittest.TestCase):
    def test_read_respects_ttl(self) -> None:
        store = OnlineStore(ttl_days=10)
        store.write(FeatureRow("u", 100, {"x": 1.0}))
        self.assertEqual(store.read("u", 105), {"x": 1.0})
        self.assertIsNone(store.read("u", 111))
        self.assertIsNone(store.read("nobody", 105))

    def test_older_rows_do_not_overwrite_newer_rows(self) -> None:
        store = OnlineStore(ttl_days=30)
        store.write(FeatureRow("u", 20, {"x": 2.0}))
        store.write(FeatureRow("u", 10, {"x": 1.0}))
        self.assertEqual(store.read("u", 21), {"x": 2.0})

    def test_materialize_never_writes_future_rows(self) -> None:
        store = OnlineStore(ttl_days=30)
        written = materialize(rows_for("u", [(5, 1.0), (15, 2.0)]), store, up_to_day=10)
        self.assertEqual(written, 1)
        self.assertEqual(store.read("u", 10), {"x": 1.0})

    def test_expired_serving_features_fall_to_defaults(self) -> None:
        registry = build_registry()
        store = OnlineStore(ttl_days=10)
        store.write(FeatureRow("u", 100, {"days_since_last_purchase": 3.0, "purchases_30d": 4.0, "spend_30d": 9.0}))
        self.assertEqual(serving_features(registry, FEATURES, store, "u", 130)["days_since_last_purchase"], 365.0)


class SkewTests(unittest.TestCase):
    def test_identical_views_have_no_skew(self) -> None:
        view = {("u", 1): {"x": 1.0}, ("v", 1): {"x": 2.0}}
        report = detect_skew(view, dict(view), ["x"])[0]
        self.assertEqual(report.compared, 2)
        self.assertFalse(report.flagged)

    def test_mismatch_is_flagged(self) -> None:
        training = {("u", 1): {"x": 1.0}, ("v", 1): {"x": 2.0}}
        serving = {("u", 1): {"x": 1.0}, ("v", 1): {"x": 5.0}}
        report = detect_skew(training, serving, ["x"])[0]
        self.assertAlmostEqual(report.mismatch_rate, 0.5)
        self.assertAlmostEqual(report.mean_abs_diff, 1.5)
        self.assertTrue(report.flagged)

    def test_legacy_path_differs_on_window_edge_and_default(self) -> None:
        registry = build_registry()
        events = [Event("u", 70, 10.0)]
        self.assertEqual(legacy_serving_features(events, 100)["purchases_30d"], 1.0)
        self.assertEqual(registry.compute(FEATURES, events, 100)["purchases_30d"], 0.0)
        self.assertEqual(legacy_serving_features([], 100)["days_since_last_purchase"], -1.0)

    def test_shared_definition_has_zero_skew_end_to_end(self) -> None:
        registry = build_registry()
        events, _ = make_events(n_users=40, seed=3)
        offline = backfill(registry, FEATURES, events, list(range(7, 176, 7)))
        requests = [(f"u{i:03d}", 141 + i % 10) for i in range(40)]
        joined = point_in_time_join([LabelRow(e, d, 0) for e, d in requests], offline, 10)
        training = dict(zip(requests, training_features(registry, FEATURES, joined)))
        logged = log_serving_requests(registry, FEATURES, offline, requests, 10)
        self.assertTrue(all(not r.flagged for r in detect_skew(training, logged, FEATURES)))

    def test_labels_look_forward_from_the_label_day(self) -> None:
        events = [Event("u", 10, 1.0), Event("u", 50, 1.0)]
        labels = make_labels(events, [12, 60], horizon=30)
        self.assertEqual([(l.day, l.label) for l in labels], [(12, 1), (60, 1)])
        labels = make_labels(events, [25], horizon=30)
        self.assertEqual(labels[0].label, 0)


if __name__ == "__main__":
    unittest.main()
