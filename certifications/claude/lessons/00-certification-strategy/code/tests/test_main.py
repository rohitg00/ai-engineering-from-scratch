"""Tests for lesson 00 readiness planning."""

import copy
import json
import pathlib
import sys
import unittest

LESSON = pathlib.Path(__file__).parents[2]
sys.path.insert(0, str(LESSON / "code"))

from main import build_report, load_plan, rank_domains, validate_plan


class ReadinessPlanTests(unittest.TestCase):
    def setUp(self):
        self.plan = load_plan(LESSON / "outputs" / "readiness-plan.json")

    def test_filled_plan_is_valid(self):
        self.assertEqual(validate_plan(self.plan), [])

    def test_weights_must_total_one_hundred(self):
        broken = copy.deepcopy(self.plan)
        broken["domains"][0]["weight"] = 99
        self.assertIn("weights", " ".join(validate_plan(broken)))

    def test_hours_must_reconcile(self):
        broken = copy.deepcopy(self.plan)
        broken["totalHours"] = 9
        self.assertIn("allocated hours", " ".join(validate_plan(broken)))

    def test_every_domain_needs_two_decisions(self):
        broken = copy.deepcopy(self.plan)
        broken["domains"][1]["decisions"] = ["one"]
        self.assertIn("two decisions", " ".join(validate_plan(broken)))

    def test_dated_https_guide_is_required(self):
        broken = copy.deepcopy(self.plan)
        broken["guide"]["verifiedOn"] = "next week"
        broken["guide"]["officialSource"] = "http://example.test"
        errors = " ".join(validate_plan(broken))
        self.assertIn("ISO date", errors)
        self.assertIn("HTTPS", errors)

    def test_ranking_prioritizes_weighted_weakness(self):
        order = rank_domains(self.plan)
        self.assertEqual(order[0], "output-evaluation-validation")
        self.assertEqual(set(order), {item["id"] for item in self.plan["domains"]})

    def test_practice_protocol_requires_all_stages(self):
        broken = copy.deepcopy(self.plan)
        broken["practiceProtocol"]["stages"].pop()
        self.assertIn("orient", " ".join(validate_plan(broken)))

    def test_practice_protocol_requires_distinct_error_types(self):
        broken = copy.deepcopy(self.plan)
        broken["practiceProtocol"]["errorTaxonomy"].remove("sequence-error")
        self.assertIn("errorTaxonomy", " ".join(validate_plan(broken)))

    def test_report_is_json_serializable(self):
        self.assertTrue(json.loads(json.dumps(build_report(self.plan)))["valid"])


if __name__ == "__main__":
    unittest.main()
