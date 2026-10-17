import sys
from pathlib import Path
import unittest


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import prompt_engineering


class ModelConfigTests(unittest.TestCase):
    def setUp(self):
        self.prompt = {
            "system": "You are concise.",
            "user": "Summarize the request.",
            "temperature": 0.0,
        }

    def test_target_models_are_registered(self):
        self.assertIn("MiniMax-M3", prompt_engineering.MODEL_CONFIGS)
        self.assertIn("MiniMax-M2.7", prompt_engineering.MODEL_CONFIGS)

    def test_target_model_metadata_matches_registry(self):
        m3 = prompt_engineering.MODEL_CONFIGS["MiniMax-M3"]
        m27 = prompt_engineering.MODEL_CONFIGS["MiniMax-M2.7"]
        self.assertEqual((m3["context_window"], m3["thinking"]), (1_000_000, ("adaptive", "disabled")))
        self.assertEqual((m27["context_window"], m27["thinking"]), (204_800, ("always_on",)))

    def test_global_openai_request_url(self):
        request = prompt_engineering.format_model_request(self.prompt, "MiniMax-M3")
        self.assertEqual(request["base_url"], "https://api.minimax.io/v1")
        self.assertEqual(request["request_url"], "https://api.minimax.io/v1/chat/completions")

    def test_global_anthropic_request_url(self):
        request = prompt_engineering.format_model_request(
            self.prompt,
            "MiniMax-M3",
            protocol="anthropic",
        )
        self.assertEqual(request["base_url"], "https://api.minimax.io/anthropic")
        self.assertEqual(request["request_url"], "https://api.minimax.io/anthropic/v1/messages")

    def test_cn_endpoints_cover_both_protocols(self):
        openai_request = prompt_engineering.format_model_request(
            self.prompt,
            "MiniMax-M2.7",
            region="cn_zh",
        )
        anthropic_request = prompt_engineering.format_model_request(
            self.prompt,
            "MiniMax-M2.7",
            protocol="anthropic",
            region="cn_zh",
        )
        self.assertEqual(openai_request["base_url"], "https://api.minimaxi.com/v1")
        self.assertEqual(anthropic_request["base_url"], "https://api.minimaxi.com/anthropic")
        self.assertTrue(anthropic_request["request_url"].endswith("/anthropic/v1/messages"))


if __name__ == "__main__":
    unittest.main()
