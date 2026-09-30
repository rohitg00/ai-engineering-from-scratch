import json
import tempfile
import unittest
from pathlib import Path
from main import export_desk


def msg(id, text, subject="Notice"):
    return {
        "id": id,
        "sender": "sam@example.invalid",
        "subject": subject,
        "text": text,
        "references": [],
        "body_status": "plain",
    }


class ExportTests(unittest.TestCase):
    def test_prioritized_queue_and_real_draft_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            r = export_desk(
                [
                    msg("z", "For your information, arrived."),
                    msg("a", "Please reserve a seat."),
                ],
                out,
            )
            self.assertEqual(
                [e["decision"]["category"] for e in r["entries"]],
                ["action", "information"],
            )
            self.assertTrue(
                all((out / e["draft_file"]).is_file() for e in r["entries"])
            )

    def test_html_escapes_subject_body_and_reason_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            export_desk(
                [
                    msg(
                        "a",
                        "Please <script>alert(1)</script>",
                        "<img src=x onerror=alert(1)>",
                    )
                ],
                Path(tmp),
            )
            page = (Path(tmp) / "index.html").read_text()
            self.assertNotIn("<script>", page)
            self.assertIn("&lt;script&gt;", page)
            self.assertIn("&lt;img", page)

    def test_subject_cannot_control_draft_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            r = export_desk([msg("a", "hello", "../../escaped")], Path(tmp))
            name = r["entries"][0]["draft_file"]
            self.assertRegex(name, r"^[a-f0-9]{16}\.eml$")

    def test_json_preserves_source_and_method(self):
        with tempfile.TemporaryDirectory() as tmp:
            export_desk([msg("a", "Could you reserve a desk?")], Path(tmp))
            saved = json.loads((Path(tmp) / "triage.json").read_text())
            self.assertEqual(saved["schema_version"], 1)
            self.assertEqual(
                saved["entries"][0]["message"]["text"], "Could you reserve a desk?"
            )
            self.assertIn("offline", saved["method"])

    def test_empty_export_is_valid(self):
        with tempfile.TemporaryDirectory() as tmp:
            r = export_desk([], Path(tmp))
            self.assertEqual(r["entries"], [])
            self.assertTrue((Path(tmp) / "index.html").is_file())

    def test_identical_duplicates_write_one_entry(self):
        with tempfile.TemporaryDirectory() as tmp:
            m = msg("a", "hello")
            r = export_desk([m, m], Path(tmp))
            self.assertEqual(len(r["entries"]), 1)
            self.assertEqual(len(list(Path(tmp).glob("*.eml"))), 1)
