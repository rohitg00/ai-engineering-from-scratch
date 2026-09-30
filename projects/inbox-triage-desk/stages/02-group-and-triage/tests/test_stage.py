import unittest
from main import group_threads, triage


def msg(id, text="Please reserve the west table.", refs=None):
    return {
        "id": id,
        "sender": "a@example.invalid",
        "subject": "Same subject",
        "text": text,
        "references": refs or [],
        "body_status": "plain",
    }


class TriageTests(unittest.TestCase):
    def test_transitive_thread_and_unrelated_subject(self):
        result = group_threads(
            [msg("c", refs=["b"]), msg("x"), msg("b", refs=["a"]), msg("a")]
        )
        self.assertEqual([len(t["messages"]) for t in result], [3, 1])
        self.assertEqual(result[0]["id"], "a")

    def test_duplicate_and_conflicting_identity(self):
        self.assertEqual(len(group_threads([msg("a"), msg("a")])[0]["messages"]), 1)
        with self.assertRaises(ValueError):
            group_threads([msg("a"), msg("a", "Changed")])

    def test_cycles_and_missing_reference(self):
        self.assertEqual(
            len(group_threads([msg("a", refs=["b"]), msg("b", refs=["a", "missing"])])),
            1,
        )

    def test_action_evidence_uses_original_spans(self):
        m = msg("a", "Before: PLEASE reserve a chair.")
        d = triage(m)
        self.assertEqual(d["category"], "action")
        self.assertEqual(d["priority"], 0)
        for e in d["evidence"]:
            self.assertEqual(m["text"][e["start"] : e["end"]], e["quote"])

    def test_conflicts_and_unmatched_are_uncertain(self):
        self.assertEqual(
            triage(msg("a", "Please confirm. For your information, seats changed."))[
                "reason"
            ],
            "conflicting rules",
        )
        self.assertEqual(triage(msg("b", "A bench is here."))["category"], "uncertain")

    def test_word_boundary_and_invalid_rule(self):
        self.assertEqual(triage(msg("a", "I am displeased."))["category"], "uncertain")
        with self.assertRaises(ValueError):
            triage(msg("a"), {"action": [""]})
        with self.assertRaises(ValueError):
            triage(msg("a"), {"send": ["please"]})

    def test_custom_phrase_can_classify_information(self):
        d = triage(
            msg("a", "Inventory updated this morning."),
            {"information": ["inventory updated"]},
        )
        self.assertEqual(d["category"], "information")
        self.assertTrue(d["review_required"])
