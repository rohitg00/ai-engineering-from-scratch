import unittest
from adapter import framework_qa


class FrameworkTests(unittest.TestCase):
    def test_real_splitter_and_fake_model(self):
        result = framework_qa(
            "kernel",
            {"id": "doc", "text": "Each guest owns a kernel."},
            '{"source":"doc:0","quote":"Each guest owns a kernel."}',
        )
        self.assertEqual(result["answer"], "Each guest owns a kernel.")

    def test_unseen_query_abstains(self):
        self.assertEqual(
            framework_qa(
                "socket", {"id": "doc", "text": "Each guest owns a kernel."}, "unused"
            )["state"],
            "abstained",
        )

    def test_bad_fake_model_output_rejected(self):
        with self.assertRaises(ValueError):
            framework_qa(
                "kernel", {"id": "doc", "text": "Each guest owns a kernel."}, "not json"
            )

    def test_invented_quote_rejected(self):
        with self.assertRaises(ValueError):
            framework_qa(
                "kernel",
                {"id": "doc", "text": "Each guest owns a kernel."},
                '{"source":"doc:0","quote":"A false kernel claim"}',
            )

    def test_unicode_offsets_preserved(self):
        result = framework_qa(
            "kernel",
            {"id": "doc", "text": "😀 Each guest owns a kernel."},
            '{"source":"doc:0","quote":"Each guest owns a kernel."}',
        )
        self.assertEqual(result["citations"][0]["start"], 2)
