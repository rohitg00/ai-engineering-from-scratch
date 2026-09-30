import unittest
from metrics import score_report


class EvidenceContract(unittest.TestCase):
    def test_empty_report_has_no_awarded_evidence(self):
        result = score_report("", {})
        self.assertEqual(result["score"], 0)
        self.assertEqual(result["state"], "no_evidence")
        self.assertIsNone(result["recall"])

    def test_unsupported_claim_does_not_earn_fact_coverage(self):
        result = score_report(
            "Invented kernel [S1].", {"S1": "A storage system."}, ["S1"], [["kernel"]]
        )
        self.assertEqual(result["coverage"], 0)
        self.assertEqual(result["recall"], 0)

    def test_missing_labels_are_explicit(self):
        self.assertEqual(
            score_report("Kernel shared [S1].", {"S1": "Kernel shared"})["unavailable"],
            ["recall", "coverage"],
        )
