"""Unit tests for utils/llm_provider.py."""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.llm_provider import (
    PROVIDER_DEFAULTS,
    LLMClient,
    detect_provider,
    get_llm_client,
    chat,
    list_providers,
    _clamp_temperature,
)


class TestProviderDefaults(unittest.TestCase):
    """Test provider configuration constants."""

    def test_three_providers_configured(self):
        self.assertIn("anthropic", PROVIDER_DEFAULTS)
        self.assertIn("openai", PROVIDER_DEFAULTS)
        self.assertIn("minimax", PROVIDER_DEFAULTS)

    def test_minimax_config(self):
        cfg = PROVIDER_DEFAULTS["minimax"]
        self.assertEqual(cfg["env_key"], "MINIMAX_API_KEY")
        self.assertEqual(cfg["base_url"], "https://api.minimax.io/v1")
        self.assertEqual(cfg["default_model"], "MiniMax-M2.7")
        self.assertIn("MiniMax-M2.7", cfg["models"])
        self.assertIn("MiniMax-M2.7-highspeed", cfg["models"])
        self.assertIn("MiniMax-M2.5", cfg["models"])
        self.assertIn("MiniMax-M2.5-highspeed", cfg["models"])

    def test_each_provider_has_required_keys(self):
        for name, cfg in PROVIDER_DEFAULTS.items():
            self.assertIn("env_key", cfg, f"{name} missing env_key")
            self.assertIn("default_model", cfg, f"{name} missing default_model")
            self.assertIn("max_tokens", cfg, f"{name} missing max_tokens")


class TestClampTemperature(unittest.TestCase):
    """Test MiniMax temperature clamping."""

    def test_zero_clamped(self):
        self.assertEqual(_clamp_temperature(0.0), 0.01)

    def test_negative_clamped(self):
        self.assertEqual(_clamp_temperature(-1.0), 0.01)

    def test_above_one_clamped(self):
        self.assertEqual(_clamp_temperature(1.5), 1.0)

    def test_valid_temperature_unchanged(self):
        self.assertEqual(_clamp_temperature(0.7), 0.7)

    def test_boundary_one(self):
        self.assertEqual(_clamp_temperature(1.0), 1.0)

    def test_small_positive(self):
        self.assertEqual(_clamp_temperature(0.01), 0.01)


class TestDetectProvider(unittest.TestCase):
    """Test auto-detection of provider from environment."""

    @patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}, clear=False)
    def test_detect_anthropic(self):
        # Remove other keys if present
        env = {k: v for k, v in os.environ.items()
               if k not in ("OPENAI_API_KEY", "MINIMAX_API_KEY")}
        with patch.dict(os.environ, env, clear=True):
            os.environ["ANTHROPIC_API_KEY"] = "test-key"
            self.assertEqual(detect_provider(), "anthropic")

    @patch.dict(os.environ, {"MINIMAX_API_KEY": "test-key"}, clear=True)
    def test_detect_minimax(self):
        self.assertEqual(detect_provider(), "minimax")

    @patch.dict(os.environ, {}, clear=True)
    def test_no_key_raises(self):
        with self.assertRaises(EnvironmentError):
            detect_provider()


class TestGetLLMClient(unittest.TestCase):
    """Test client creation for each provider."""

    @patch("openai.OpenAI")
    @patch.dict(os.environ, {"MINIMAX_API_KEY": "test-minimax-key"}, clear=False)
    def test_create_minimax_client(self, mock_openai):
        mock_openai.return_value = MagicMock()
        client = get_llm_client("minimax")
        self.assertEqual(client.provider, "minimax")
        self.assertEqual(client.default_model, "MiniMax-M2.7")
        mock_openai.assert_called_once_with(
            api_key="test-minimax-key",
            base_url="https://api.minimax.io/v1",
        )

    @patch("openai.OpenAI")
    @patch.dict(os.environ, {"OPENAI_API_KEY": "test-openai-key"}, clear=False)
    def test_create_openai_client(self, mock_openai):
        mock_openai.return_value = MagicMock()
        client = get_llm_client("openai")
        self.assertEqual(client.provider, "openai")
        self.assertEqual(client.default_model, "gpt-4o")

    @patch("anthropic.Anthropic")
    @patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-anthropic-key"}, clear=False)
    def test_create_anthropic_client(self, mock_anthropic):
        mock_anthropic.return_value = MagicMock()
        client = get_llm_client("anthropic")
        self.assertEqual(client.provider, "anthropic")
        self.assertEqual(client.default_model, "claude-sonnet-4-20250514")

    def test_unknown_provider_raises(self):
        with self.assertRaises(ValueError):
            get_llm_client("unknown_provider")

    @patch.dict(os.environ, {}, clear=True)
    def test_no_api_key_raises(self):
        with self.assertRaises(EnvironmentError):
            get_llm_client("minimax")

    @patch("openai.OpenAI")
    @patch.dict(os.environ, {"MINIMAX_API_KEY": "test-key"}, clear=False)
    def test_custom_model_override(self, mock_openai):
        mock_openai.return_value = MagicMock()
        client = get_llm_client("minimax", model="MiniMax-M2.7-highspeed")
        self.assertEqual(client.default_model, "MiniMax-M2.7-highspeed")

    @patch("openai.OpenAI")
    def test_explicit_api_key(self, mock_openai):
        mock_openai.return_value = MagicMock()
        client = get_llm_client("minimax", api_key="explicit-key")
        mock_openai.assert_called_once_with(
            api_key="explicit-key",
            base_url="https://api.minimax.io/v1",
        )

    @patch("openai.OpenAI")
    @patch.dict(os.environ, {"MINIMAX_API_KEY": "test-key"}, clear=False)
    def test_case_insensitive_provider(self, mock_openai):
        mock_openai.return_value = MagicMock()
        client = get_llm_client("MiniMax")
        self.assertEqual(client.provider, "minimax")


class TestChat(unittest.TestCase):
    """Test the chat() function across providers."""

    def _make_minimax_client(self):
        mock_sdk = MagicMock()
        return LLMClient(
            provider="minimax",
            client=mock_sdk,
            default_model="MiniMax-M2.7",
        )

    def _make_openai_client(self):
        mock_sdk = MagicMock()
        return LLMClient(
            provider="openai",
            client=mock_sdk,
            default_model="gpt-4o",
        )

    def _make_anthropic_client(self):
        mock_sdk = MagicMock()
        return LLMClient(
            provider="anthropic",
            client=mock_sdk,
            default_model="claude-sonnet-4-20250514",
        )

    def test_chat_minimax(self):
        client = self._make_minimax_client()
        mock_msg = MagicMock()
        mock_msg.content = "Neural networks are computing systems."
        mock_choice = MagicMock()
        mock_choice.message = mock_msg
        client.client.chat.completions.create.return_value = MagicMock(
            choices=[mock_choice]
        )
        result = chat(client, "What is a neural network?")
        self.assertEqual(result, "Neural networks are computing systems.")
        call_kwargs = client.client.chat.completions.create.call_args
        self.assertEqual(call_kwargs.kwargs["model"], "MiniMax-M2.7")

    def test_chat_minimax_strips_think_tags(self):
        client = self._make_minimax_client()
        mock_msg = MagicMock()
        mock_msg.content = "<think>Let me think...</think>\nThe answer is 42."
        mock_choice = MagicMock()
        mock_choice.message = mock_msg
        client.client.chat.completions.create.return_value = MagicMock(
            choices=[mock_choice]
        )
        result = chat(client, "What is the answer?")
        self.assertEqual(result, "The answer is 42.")

    def test_chat_minimax_temperature_clamped(self):
        client = self._make_minimax_client()
        mock_msg = MagicMock()
        mock_msg.content = "Response"
        mock_choice = MagicMock()
        mock_choice.message = mock_msg
        client.client.chat.completions.create.return_value = MagicMock(
            choices=[mock_choice]
        )
        chat(client, "test", temperature=0.0)
        call_kwargs = client.client.chat.completions.create.call_args
        self.assertEqual(call_kwargs.kwargs["temperature"], 0.01)

    def test_chat_openai(self):
        client = self._make_openai_client()
        mock_msg = MagicMock()
        mock_msg.content = "OpenAI response"
        mock_choice = MagicMock()
        mock_choice.message = mock_msg
        client.client.chat.completions.create.return_value = MagicMock(
            choices=[mock_choice]
        )
        result = chat(client, "test")
        self.assertEqual(result, "OpenAI response")

    def test_chat_anthropic(self):
        client = self._make_anthropic_client()
        mock_content = MagicMock()
        mock_content.text = "Anthropic response"
        client.client.messages.create.return_value = MagicMock(
            content=[mock_content]
        )
        result = chat(client, "test")
        self.assertEqual(result, "Anthropic response")

    def test_chat_with_system_prompt_minimax(self):
        client = self._make_minimax_client()
        mock_msg = MagicMock()
        mock_msg.content = "System prompt response"
        mock_choice = MagicMock()
        mock_choice.message = mock_msg
        client.client.chat.completions.create.return_value = MagicMock(
            choices=[mock_choice]
        )
        chat(client, "test", system="You are helpful")
        call_kwargs = client.client.chat.completions.create.call_args
        messages = call_kwargs.kwargs["messages"]
        self.assertEqual(messages[0]["role"], "system")
        self.assertEqual(messages[0]["content"], "You are helpful")

    def test_chat_with_system_prompt_anthropic(self):
        client = self._make_anthropic_client()
        mock_content = MagicMock()
        mock_content.text = "Response"
        client.client.messages.create.return_value = MagicMock(
            content=[mock_content]
        )
        chat(client, "test", system="You are helpful")
        call_kwargs = client.client.messages.create.call_args
        self.assertEqual(call_kwargs.kwargs["system"], "You are helpful")

    def test_chat_model_override(self):
        client = self._make_minimax_client()
        mock_msg = MagicMock()
        mock_msg.content = "Response"
        mock_choice = MagicMock()
        mock_choice.message = mock_msg
        client.client.chat.completions.create.return_value = MagicMock(
            choices=[mock_choice]
        )
        chat(client, "test", model="MiniMax-M2.7-highspeed")
        call_kwargs = client.client.chat.completions.create.call_args
        self.assertEqual(call_kwargs.kwargs["model"], "MiniMax-M2.7-highspeed")

    def test_chat_max_tokens_override(self):
        client = self._make_minimax_client()
        mock_msg = MagicMock()
        mock_msg.content = "Response"
        mock_choice = MagicMock()
        mock_choice.message = mock_msg
        client.client.chat.completions.create.return_value = MagicMock(
            choices=[mock_choice]
        )
        chat(client, "test", max_tokens=2048)
        call_kwargs = client.client.chat.completions.create.call_args
        self.assertEqual(call_kwargs.kwargs["max_tokens"], 2048)


class TestListProviders(unittest.TestCase):
    """Test list_providers() utility."""

    @patch.dict(os.environ, {"MINIMAX_API_KEY": "test"}, clear=True)
    def test_shows_availability(self):
        providers = list_providers()
        self.assertTrue(providers["minimax"]["available"])
        self.assertFalse(providers["openai"]["available"])
        self.assertFalse(providers["anthropic"]["available"])

    def test_returns_all_providers(self):
        providers = list_providers()
        self.assertIn("anthropic", providers)
        self.assertIn("openai", providers)
        self.assertIn("minimax", providers)

    def test_provider_info_fields(self):
        providers = list_providers()
        for name, info in providers.items():
            self.assertIn("available", info)
            self.assertIn("env_key", info)
            self.assertIn("default_model", info)


class TestAgentLoop(unittest.TestCase):
    """Test agent loop with provider integration."""

    def test_agent_extract_tool_calls(self):
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
        # Import the agent module
        agent_path = os.path.join(
            os.path.dirname(__file__), "..",
            "phases", "14-agent-engineering", "01-the-agent-loop", "code"
        )
        sys.path.insert(0, agent_path)
        from agent_loop import SimpleAgent, TOOLS

        agent = SimpleAgent(TOOLS)
        calls = agent._extract_tool_calls(
            "TOOL_CALL: list_files(path=/tmp)"
        )
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["name"], "list_files")
        self.assertEqual(calls[0]["arguments"]["path"], "/tmp")

    def test_agent_no_tool_calls(self):
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
        agent_path = os.path.join(
            os.path.dirname(__file__), "..",
            "phases", "14-agent-engineering", "01-the-agent-loop", "code"
        )
        sys.path.insert(0, agent_path)
        from agent_loop import SimpleAgent, TOOLS

        agent = SimpleAgent(TOOLS)
        calls = agent._extract_tool_calls("Just a normal response")
        self.assertEqual(len(calls), 0)

    def test_agent_multiple_tool_calls(self):
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
        agent_path = os.path.join(
            os.path.dirname(__file__), "..",
            "phases", "14-agent-engineering", "01-the-agent-loop", "code"
        )
        sys.path.insert(0, agent_path)
        from agent_loop import SimpleAgent, TOOLS

        agent = SimpleAgent(TOOLS)
        calls = agent._extract_tool_calls(
            "TOOL_CALL: list_files(path=.) then TOOL_CALL: read_file(path=README.md)"
        )
        self.assertEqual(len(calls), 2)


if __name__ == "__main__":
    unittest.main()
