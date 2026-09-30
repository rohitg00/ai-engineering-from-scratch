import unittest
from support import support, judge_claim


class RelationOrder(unittest.TestCase):
    def test_reversed_relation_needs_review(self):
        self.assertEqual(
            support("Alice defeated Bob", "Bob defeated Alice")["score"], 0
        )

    def test_exact_relation_passes(self):
        self.assertTrue(
            judge_claim(
                {"text": "Worker A invokes Worker B", "cites": ["S1"]},
                {"S1": "Worker A invokes Worker B"},
            )["supported"]
        )

    def test_token_subset_with_changed_order_fails(self):
        self.assertFalse(
            judge_claim(
                {"text": "worker B invokes worker A", "cites": ["S1"]},
                {"S1": "worker A invokes worker B"},
            )["supported"]
        )
