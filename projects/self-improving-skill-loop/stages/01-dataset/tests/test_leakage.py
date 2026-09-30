import unittest
from dataset import split_cases, audit_partitions


class Leakage(unittest.TestCase):
    def test_identical_content_stays_together(self):
        s = split_cases(
            [
                {"id": str(i), "text": "refund invoice", "label": "billing"}
                for i in range(10)
            ]
        )
        self.assertTrue(audit_partitions(s["development"], s["holdout"])["usable"])
        self.assertIn(0, [len(s["development"]), len(s["holdout"])])

    def test_group_and_duplicate_transitive_component(self):
        cases = [
            {"id": "a", "text": "refund", "label": "billing", "group": "one"},
            {"id": "b", "text": "invoice", "label": "billing", "group": "one"},
            {"id": "c", "text": "INVOICE", "label": "billing", "group": "two"},
        ]
        s = split_cases(cases)
        self.assertIn(3, [len(s["development"]), len(s["holdout"])])

    def test_manual_leak_is_reported(self):
        a = {"id": "a", "text": "refund", "group": "g"}
        b = {"id": "b", "text": "refund", "group": "g"}
        self.assertFalse(audit_partitions([a], [b])["usable"])
