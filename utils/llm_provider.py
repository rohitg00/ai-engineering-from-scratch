"""
Multi-provider LLM utility for AI Engineering from Scratch.

Supports Anthropic, OpenAI, and MiniMax via a unified interface.
Each provider uses its native SDK with consistent configuration.

Usage:
    from utils.llm_provider import get_llm_client, chat

    # Auto-detect provider from environment
    client = get_llm_client()
    response = chat(client, "What is a neural network?")

    # Explicit provider
    client = get_llm_client("minimax")
    response = chat(client, "Explain transformers", model="MiniMax-M2.7")
"""

import os
from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# Provider configuration
# ---------------------------------------------------------------------------

PROVIDER_DEFAULTS = {
    "anthropic": {
        "env_key": "ANTHROPIC_API_KEY",
        "default_model": "claude-sonnet-4-20250514",
        "max_tokens": 1024,
    },
    "openai": {
        "env_key": "OPENAI_API_KEY",
        "default_model": "gpt-4o",
        "max_tokens": 1024,
    },
    "minimax": {
        "env_key": "MINIMAX_API_KEY",
        "base_url": "https://api.minimax.io/v1",
        "default_model": "MiniMax-M2.7",
        "max_tokens": 1024,
        "models": [
            "MiniMax-M2.7",
            "MiniMax-M2.7-highspeed",
            "MiniMax-M2.5",
            "MiniMax-M2.5-highspeed",
        ],
    },
}


@dataclass
class LLMClient:
    """Unified LLM client wrapper."""

    provider: str
    client: object
    default_model: str
    max_tokens: int = 1024


def detect_provider() -> str:
    """Auto-detect provider from available API keys."""
    for provider, config in PROVIDER_DEFAULTS.items():
        if os.environ.get(config["env_key"]):
            return provider
    raise EnvironmentError(
        "No LLM API key found. Set one of: "
        + ", ".join(c["env_key"] for c in PROVIDER_DEFAULTS.values())
    )


def _clamp_temperature(temperature: float) -> float:
    """Clamp temperature to MiniMax's valid range (0, 1]."""
    if temperature <= 0:
        return 0.01
    if temperature > 1:
        return 1.0
    return temperature


def get_llm_client(
    provider: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> LLMClient:
    """
    Create an LLM client for the given provider.

    Args:
        provider: "anthropic", "openai", or "minimax". Auto-detected if None.
        api_key:  Override the API key (otherwise read from environment).
        model:    Override the default model.

    Returns:
        LLMClient wrapping the provider SDK.
    """
    if provider is None:
        provider = detect_provider()

    provider = provider.lower()
    if provider not in PROVIDER_DEFAULTS:
        raise ValueError(
            f"Unknown provider '{provider}'. Choose from: "
            + ", ".join(PROVIDER_DEFAULTS)
        )

    config = PROVIDER_DEFAULTS[provider]
    key = api_key or os.environ.get(config["env_key"])
    if not key:
        raise EnvironmentError(
            f"Set {config['env_key']} or pass api_key= to use {provider}"
        )

    default_model = model or config["default_model"]

    if provider == "anthropic":
        import anthropic

        client = anthropic.Anthropic(api_key=key)
    elif provider == "openai":
        import openai

        client = openai.OpenAI(api_key=key)
    elif provider == "minimax":
        import openai as openai_sdk

        client = openai_sdk.OpenAI(
            api_key=key,
            base_url=config["base_url"],
        )

    return LLMClient(
        provider=provider,
        client=client,
        default_model=default_model,
        max_tokens=config["max_tokens"],
    )


def chat(
    llm: LLMClient,
    prompt: str,
    *,
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: float = 0.7,
    system: Optional[str] = None,
) -> str:
    """
    Send a chat message and return the text response.

    Works with any provider: Anthropic, OpenAI, or MiniMax.

    Args:
        llm:         LLMClient from get_llm_client().
        prompt:      The user message.
        model:       Override the model for this call.
        max_tokens:  Override max tokens for this call.
        temperature: Sampling temperature.
        system:      Optional system prompt.

    Returns:
        The assistant's text response.
    """
    model = model or llm.default_model
    tokens = max_tokens or llm.max_tokens

    if llm.provider == "anthropic":
        kwargs = {
            "model": model,
            "max_tokens": tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            kwargs["system"] = system
        response = llm.client.messages.create(**kwargs)
        return response.content[0].text

    # OpenAI and MiniMax share the OpenAI SDK interface
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    if llm.provider == "minimax":
        temperature = _clamp_temperature(temperature)

    response = llm.client.chat.completions.create(
        model=model,
        max_tokens=tokens,
        temperature=temperature,
        messages=messages,
    )
    text = response.choices[0].message.content or ""
    # Strip MiniMax thinking tags if present
    if llm.provider == "minimax" and "<think>" in text:
        import re

        text = re.sub(r"<think>.*?</think>\s*", "", text, flags=re.DOTALL)
    return text.strip()


def list_providers() -> dict:
    """Return provider info with availability status."""
    result = {}
    for name, config in PROVIDER_DEFAULTS.items():
        result[name] = {
            "available": bool(os.environ.get(config["env_key"])),
            "env_key": config["env_key"],
            "default_model": config["default_model"],
        }
    return result


if __name__ == "__main__":
    print("=== LLM Provider Utility ===\n")
    print("Configured providers:")
    for name, info in list_providers().items():
        status = "ready" if info["available"] else "not configured"
        print(f"  {name}: {status} (model: {info['default_model']})")

    try:
        provider = detect_provider()
        print(f"\nAuto-detected provider: {provider}")
        client = get_llm_client()
        response = chat(client, "What is a neural network in one sentence?")
        print(f"Response: {response}")
    except EnvironmentError as e:
        print(f"\n{e}")
        print("Set an API key to try it out.")
