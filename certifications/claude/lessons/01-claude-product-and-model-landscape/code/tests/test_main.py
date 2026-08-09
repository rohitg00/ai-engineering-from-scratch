"""Tests for lesson 01 product and model fit."""

import copy
import pathlib
import sys
import unittest

LESSON = pathlib.Path(__file__).parents[2]
sys.path.insert(0, str(LESSON / "code"))

from main import load_record, recommend, validate_record


class ProductFitTests(unittest.TestCase):
    def setUp(self):
        self.record = load_record(LESSON / "outputs" / "product-selection-record.json")

    def test_filled_record_is_valid(self):
        self.assertEqual(validate_record(self.record), [])

    def test_smallest_passing_surface_is_required(self):
        broken = copy.deepcopy(self.record)
        broken["selectedSurface"] = "custom-application"
        self.assertIn("smallest", " ".join(validate_record(broken)))

    def test_model_must_clear_quality_gate(self):
        broken = copy.deepcopy(self.record)
        broken["selectedModel"] = "haiku-family"
        self.assertIn("least costly passing", " ".join(validate_record(broken)))

    def test_rejected_alternative_needs_reason(self):
        broken = copy.deepcopy(self.record)
        broken["surfaceCandidates"][0]["reason"] = ""
        self.assertIn("rejected alternative", " ".join(validate_record(broken)))

    def test_dated_sources_and_owner_are_required(self):
        broken = copy.deepcopy(self.record)
        broken["verifiedOn"] = "today"
        broken["humanOwner"] = ""
        broken["officialSources"] = ["http://example.test"]
        errors = " ".join(validate_record(broken))
        self.assertIn("ISO date", errors)
        self.assertIn("humanOwner", errors)
        self.assertIn("officialSources", errors)

    def test_recommendation_is_deterministic(self):
        self.assertEqual(recommend(self.record)["surface"], "project-research")
        self.assertEqual(recommend(self.record)["model"], "sonnet-family")
        self.assertEqual(recommend(self.record)["deployment"], "microsoft-foundry")

    def test_deployment_matrix_covers_all_four_paths(self):
        paths = {candidate["id"] for candidate in self.record["deploymentMatrix"]["candidates"]}
        self.assertEqual(
            paths,
            {
                "claude-enterprise-direct",
                "amazon-bedrock",
                "google-vertex-ai",
                "microsoft-foundry",
            },
        )

    def test_validator_rejects_a_missing_deployment_path(self):
        broken = copy.deepcopy(self.record)
        broken["deploymentMatrix"]["candidates"].pop()
        self.assertIn("four deployment paths", " ".join(validate_record(broken)))

    def test_selected_deployment_must_have_the_highest_weighted_fit(self):
        broken = copy.deepcopy(self.record)
        broken["deploymentADR"]["selectedPath"] = "amazon-bedrock"
        self.assertIn("highest weighted fit", " ".join(validate_record(broken)))

    def test_deployment_score_must_reconcile(self):
        broken = copy.deepcopy(self.record)
        broken["deploymentMatrix"]["candidates"][-1]["weightedScore"] += 1
        self.assertIn("weightedScore must reconcile", " ".join(validate_record(broken)))

    def test_deployment_evidence_must_be_dated_and_official(self):
        broken = copy.deepcopy(self.record)
        broken["officialEvidence"][0]["verifiedOn"] = "last week"
        broken["officialEvidence"][0]["sourceUrl"] = "https://example.test/direct"
        errors = " ".join(validate_record(broken))
        self.assertIn("dated", errors)
        self.assertIn("official Claude docs", errors)


if __name__ == "__main__":
    unittest.main()
