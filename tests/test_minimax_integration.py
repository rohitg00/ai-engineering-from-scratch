"""Integration tests for MiniMax LLM provider.

These tests require a valid MINIMAX_API_KEY environment variable.
Skip with: pytest -m "not integration"
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.llm_provider import get_llm_client, chat, list_providers

MINIMAX_KEY = os.environ.get("MINIMAX_API_KEY")
SKIP_REASON = "MINIMAX_API_KEY not set"


@unittest.skipUnless(MINIMAX_KEY, SKIP_REASON)
class TestMiniMaxIntegration(unittest.TestCase):
    """Integration tests that call the real MiniMax API."""

    def test_basic_chat(self):
        client = get_llm_client("minimax")
        response = chat(client, "Reply with exactly: hello world")
        self.assertIsInstance(response, str)
        self.assertGreater(len(response), 0)

    def test_m25_model(self):
        client = get_llm_client("minimax", model="MiniMax-M2.5")
        response = chat(client, "Reply with exactly: test ok")
        self.assertIsInstance(response, str)
        self.assertGreater(len(response), 0)

    def test_system_prompt(self):
        client = get_llm_client("minimax")
        response = chat(
            client,
            "What are you?",
            system="You are a math tutor. Always mention math in your answer.",
        )
        self.assertIsInstance(response, str)
        self.assertGreater(len(response), 0)


if __name__ == "__main__":
    unittest.main()
