import json
import tempfile
import unittest
from pathlib import Path
from support import prepare_support, support_ticket, export_support


class ComposedSupportTests(unittest.TestCase):
    def test_redaction_precedes_support_state(self):
        result = support_ticket(
            {
                "id": "a",
                "text": "invoice api_key=EXAMPLE_PRIVATE_VALUE email@example.invalid",
            }
        )
        self.assertNotIn("EXAMPLE_PRIVATE_VALUE", str(result))
        self.assertNotIn("email@example.invalid", str(result))

    def test_human_route_gets_no_read_capability(self):
        result = support_ticket({"id": "a", "text": "invoice login"})
        self.assertEqual(result["session"]["state"], "escalated")
        self.assertIsNone(result["tool"])
        self.assertIsNone(result["evidence"])

    def test_authorization_happens_before_responding(self):
        with self.assertRaises(PermissionError):
            prepare_support({"id": "a", "text": "invoice"}, "read_account")

    def test_response_is_stored_and_has_source_id(self):
        result = support_ticket({"id": "a", "text": "outage error"})
        self.assertEqual(result["session"]["response"], result["evidence"]["text"])
        self.assertEqual(result["evidence"]["source_id"], "platform-status")

    def test_export_contains_useful_reply_and_escapes_ticket(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = support_ticket(
                {"id": "a", "text": "invoice <script>bad()</script>"}
            )
            export_support(result, Path(tmp))
            page = (Path(tmp) / "index.html").read_text()
            self.assertNotIn("<script>", page)
            self.assertIn("&lt;script&gt;", page)
            self.assertIn("invoice reference", page)
            self.assertEqual(
                json.loads((Path(tmp) / "support.json").read_text())["session"][
                    "state"
                ],
                "answered",
            )
