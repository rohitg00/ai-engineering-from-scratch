"""Tests for lesson 04 context lifecycle and caching."""

import copy
import pathlib
import sys
import unittest

LESSON = pathlib.Path(__file__).parents[2]
sys.path.insert(0, str(LESSON / "code"))

from main import build_context_plan, load_registry, validate_registry


class ContextRegistryTests(unittest.TestCase):
    def setUp(self):
        self.registry = load_registry(LESSON / "outputs" / "context-registry.json")

    def test_filled_registry_is_valid(self):
        self.assertEqual(validate_registry(self.registry), [])

    def test_source_ids_must_be_unique(self):
        broken = copy.deepcopy(self.registry)
        broken["sources"][1]["id"] = broken["sources"][0]["id"]
        self.assertIn("duplicate", " ".join(validate_registry(broken)))

    def test_superseded_source_cannot_be_cached(self):
        broken = copy.deepcopy(self.registry)
        broken["cachedPrefixSourceIds"].append("refund-policy-2025")
        self.assertIn("not active", " ".join(validate_registry(broken)))

    def test_dynamic_source_cannot_be_cached(self):
        broken = copy.deepcopy(self.registry)
        broken["sources"][-1]["cacheEligible"] = True
        broken["cachedPrefixSourceIds"].append("live-account-state")
        self.assertIn("stable", " ".join(validate_registry(broken)))

    def test_prompt_budget_cannot_overflow(self):
        broken = copy.deepcopy(self.registry)
        broken["promptBudget"]["retrievedEvidence"] = 50000
        self.assertIn("exceeds", " ".join(validate_registry(broken)))

    def test_lifecycle_dates_are_required(self):
        broken = copy.deepcopy(self.registry)
        broken["sources"][0]["reviewDate"] = "later"
        self.assertIn("ISO lifecycle", " ".join(validate_registry(broken)))

    def test_context_plan_separates_cached_dynamic_and_retired(self):
        plan = build_context_plan(self.registry)
        self.assertIn("refund-policy-uk", plan["cachedPrefix"])
        self.assertIn("live-account-state", plan["dynamicContext"])
        self.assertIn("refund-policy-2025", plan["retired"])


if __name__ == "__main__":
    unittest.main()
