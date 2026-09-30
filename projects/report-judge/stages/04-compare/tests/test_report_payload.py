import unittest
from cli import audit_payload


class Payload(unittest.TestCase):
    def fixture(self):
        return {
            "schema_version": 1,
            "documents": [{"id": "d", "text": "Alice defeated Bob."}],
            "snippets": {
                "S1": {
                    "doc_id": "d",
                    "start": 0,
                    "end": 19,
                    "text": "Alice defeated Bob.",
                }
            },
            "sections": [
                {"sentences": [{"text": "Bob defeated Alice.", "cites": ["S1"]}]}
            ],
        }

    def test_relation_reversal_requires_review(self):
        self.assertEqual(audit_payload(self.fixture())["state"], "needs_review")

    def test_changed_source_rejects(self):
        data = self.fixture()
        data["documents"][0]["text"] = "Bob defeated Alice."
        with self.assertRaises(ValueError):
            audit_payload(data)
