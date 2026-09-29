import io
import json
import unittest
from unittest.mock import patch
from email import policy
from email.parser import BytesParser
from main import build_draft, provider_proposal


def msg():
    return {
        "id": "<held@example.invalid>",
        "sender": "kai@example.invalid",
        "subject": "Bench labels",
        "text": "Please print two signs.\nUse green card.",
        "references": ["<parent@example.invalid>"],
        "body_status": "plain",
    }


def decision():
    return {
        "message_id": "<held@example.invalid>",
        "category": "action",
        "evidence": [{"quote": "Please", "start": 0, "end": 6}],
    }


class DraftTests(unittest.TestCase):
    def test_unsent_email_round_trips(self):
        d = build_draft(msg(), decision())
        parsed = BytesParser(policy=policy.default).parsebytes(d["eml"].encode())
        self.assertEqual(parsed["To"], "kai@example.invalid")
        self.assertEqual(parsed["X-Unsent"], "1")
        self.assertEqual(parsed["In-Reply-To"], "<held@example.invalid>")
        self.assertEqual(d["status"], "draft-only")

    def test_reply_contains_source_and_edit_placeholder(self):
        d = build_draft(msg(), decision())
        self.assertIn("Please print two signs.", d["body"])
        self.assertIn("[Write and check your response here.]", d["body"])

    def test_existing_reply_subject_not_duplicated(self):
        m = msg()
        m["subject"] = "Re: Bench labels"
        self.assertEqual(build_draft(m, decision())["subject"], m["subject"])

    def test_wrong_identity_and_fabricated_span_rejected(self):
        d = decision()
        d["message_id"] = "other"
        with self.assertRaises(ValueError):
            build_draft(msg(), d)
        d = decision()
        d["evidence"][0]["quote"] = "Urgent"
        with self.assertRaises(ValueError):
            build_draft(msg(), d)

    def test_provider_request_and_response_contract(self):
        raw = json.dumps(
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {"category": "action", "quote": "print two signs"}
                            )
                        }
                    }
                ]
            }
        ).encode()
        with patch("urllib.request.OpenerDirector.open", return_value=io.BytesIO(raw)) as opened:
            p = provider_proposal(
                msg(), "http://localhost:1234/v1/chat/completions", "test-model"
            )
            request = opened.call_args.args[0]
            payload = json.loads(request.data)
            self.assertEqual(payload["model"], "test-model")
            self.assertEqual(payload["messages"][1]["content"], msg()["text"])
            self.assertEqual(request.get_method(), "POST")
            self.assertTrue(p["review_required"])

    def test_provider_fabrication_and_endpoint_rejected(self):
        raw = json.dumps(
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {"category": "action", "quote": "Send money"}
                            )
                        }
                    }
                ]
            }
        ).encode()
        with (
            patch("urllib.request.OpenerDirector.open", return_value=io.BytesIO(raw)),
            self.assertRaises(ValueError),
        ):
            provider_proposal(msg(), "https://example.invalid/chat", "m")
        with self.assertRaises(ValueError):
            provider_proposal(msg(), "file:///tmp/data", "m")
