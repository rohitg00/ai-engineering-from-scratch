"""Opt-in real Messages API test. It skips unless credentials are explicit."""

import os
import pathlib
import sys
import unittest


CODE_DIR = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CODE_DIR))

from main import AnthropicMessagesHTTPTransport, run_live_wire  # noqa: E402


class LiveMessagesWireTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("ANTHROPIC_API_KEY"), "ANTHROPIC_API_KEY is not set")
    def test_real_messages_wire_contract(self):
        model = os.environ.get("ANTHROPIC_MODEL")
        if not model:
            self.skipTest("ANTHROPIC_MODEL is not set")
        transport = AnthropicMessagesHTTPTransport(os.environ["ANTHROPIC_API_KEY"])
        result = run_live_wire(transport, "Check order A-17.", model)
        self.assertEqual(result["type"], "message")
        self.assertEqual(result["role"], "assistant")
        self.assertTrue(result["message_id_present"])
        self.assertTrue(result["content_types"])


if __name__ == "__main__":
    unittest.main()
