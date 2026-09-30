import unittest
from email.message import EmailMessage
from main import parse_message


class ParseTests(unittest.TestCase):
    def raw(self, body="Please reserve a table.", headers=""):
        return (
            "From: Noor <noor@example.invalid>\nSubject: Seat   request\nMessage-ID: <one@example.invalid>\n"
            + headers
            + "\n"
            + body
        ).encode()

    def test_plain_headers_and_body(self):
        m = parse_message(self.raw())
        self.assertEqual(
            (m["sender"], m["subject"], m["text"]),
            ("noor@example.invalid", "Seat request", "Please reserve a table."),
        )

    def test_multipart_prefers_plain_and_ignores_attachment(self):
        m = EmailMessage()
        m["From"] = "a@example.invalid"
        m.set_content("Plain evidence")
        m.add_alternative("<b>Different HTML</b>", subtype="html")
        m.add_attachment(
            b"Not the body", maintype="text", subtype="plain", filename="notes.txt"
        )
        self.assertEqual(parse_message(m.as_bytes())["text"], "Plain evidence")

    def test_html_only_requires_manual_review(self):
        m = EmailMessage()
        m["From"] = "a@example.invalid"
        m.set_content("<b>visible</b>", subtype="html")
        parsed = parse_message(m.as_bytes())
        self.assertEqual(parsed["text"], "")
        self.assertEqual(parsed["body_status"], "no-plain-body")

    def test_missing_id_is_stable_and_body_sensitive(self):
        raw = b"From: a@example.invalid\n\nA"
        a = parse_message(raw)
        self.assertEqual(a["id"], parse_message(raw)["id"])
        self.assertNotEqual(a["id"], parse_message(raw + b"B")["id"])

    def test_reference_ids_deduplicate(self):
        m = parse_message(
            self.raw(
                headers="References: <a@example.invalid> <b@example.invalid>\nIn-Reply-To: <b@example.invalid>\n"
            )
        )
        self.assertEqual(
            m["references"], ["<a@example.invalid>", "<b@example.invalid>"]
        )

    def test_empty_missing_sender_and_oversize_rejected(self):
        for raw in (b"", b"Subject: hi\n\nBody", b"x" * 1_000_001):
            with self.subTest(size=len(raw)), self.assertRaises(ValueError):
                parse_message(raw)
