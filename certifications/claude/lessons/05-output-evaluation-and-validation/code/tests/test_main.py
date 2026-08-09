"""Tests for lesson 05 claim validation."""

import copy
import pathlib
import sys
import unittest

LESSON = pathlib.Path(__file__).parents[2]
sys.path.insert(0, str(LESSON / "code"))

from main import load_record, summarize, validate_record


class ClaimValidationTests(unittest.TestCase):
    def setUp(self):
        self.record = load_record(LESSON / "outputs" / "claim-validation-record.json")

    def test_filled_record_is_valid(self):
        self.assertEqual(validate_record(self.record), [])

    def test_claim_ids_must_be_unique(self):
        broken = copy.deepcopy(self.record)
        broken["claims"][1]["id"] = broken["claims"][0]["id"]
        self.assertIn("duplicated", " ".join(validate_record(broken)))

    def test_claim_sources_must_resolve(self):
        broken = copy.deepcopy(self.record)
        broken["claims"][0]["sourceIds"] = ["missing"]
        self.assertIn("unresolved", " ".join(validate_record(broken)))

    def test_exact_checks_need_deterministic_evaluators(self):
        broken = copy.deepcopy(self.record)
        broken["evaluatorAssignments"]["totals"] = "model-judge"
        self.assertIn("deterministic", " ".join(validate_record(broken)))

    def test_capability_diagnostic_requires_all_four_properties(self):
        broken = copy.deepcopy(self.record)
        broken["capabilityDiagnostic"]["properties"].pop()
        self.assertIn("all four", " ".join(validate_record(broken)))

    def test_capability_diagnostic_requires_targeted_fixes(self):
        broken = copy.deepcopy(self.record)
        broken["capabilityDiagnostic"]["properties"][0]["targetedFix"] = ""
        self.assertIn("targetedFix", " ".join(validate_record(broken)))

    def test_capability_diagnostic_rejects_unknown_human_competency(self):
        broken = copy.deepcopy(self.record)
        broken["capabilityDiagnostic"]["humanCompetency"] = "confidence"
        self.assertIn("humanCompetency", " ".join(validate_record(broken)))

    def test_blocker_failure_cannot_publish(self):
        broken = copy.deepcopy(self.record)
        broken["release"]["decision"] = "publish"
        self.assertIn("revise", " ".join(validate_record(broken)))

    def test_release_counts_must_match_claims(self):
        broken = copy.deepcopy(self.record)
        broken["release"]["blockerFailures"] = 0
        self.assertIn("counts", " ".join(validate_record(broken)))

    def test_summary_exposes_failed_claim(self):
        summary = summarize(self.record)
        self.assertEqual(summary["decision"], "revise")
        self.assertEqual(summary["failedClaimIds"], ["C-02"])


if __name__ == "__main__":
    unittest.main()
