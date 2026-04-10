import os
import json
import urllib.request


def call_with_sdk():
    try:
        import anthropic
    except ImportError:
        print("Install the SDK: pip install anthropic")
        return

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=256,
        messages=[{"role": "user", "content": "What is a neural network in one sentence?"}]
    )
    print(f"SDK response: {response.content[0].text}")
    print(f"Tokens used: {response.usage.input_tokens} in, {response.usage.output_tokens} out")


def call_raw_http():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Set ANTHROPIC_API_KEY environment variable first")
        return

    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    }
    body = json.dumps({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 256,
        "messages": [{"role": "user", "content": "What is a neural network in one sentence?"}],
    }).encode()

    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        print(f"Raw HTTP response: {result['content'][0]['text']}")
        print(f"Tokens used: {result['usage']['input_tokens']} in, {result['usage']['output_tokens']} out")


def call_minimax():
    """Call MiniMax API using OpenAI-compatible SDK.

    MiniMax provides an OpenAI-compatible endpoint, so you can use the
    openai Python SDK with a custom base_url. This is a common pattern
    for providers that follow the OpenAI API spec.
    """
    try:
        import openai
    except ImportError:
        print("Install the SDK: pip install openai")
        return

    api_key = os.environ.get("MINIMAX_API_KEY")
    if not api_key:
        print("Set MINIMAX_API_KEY environment variable first")
        return

    client = openai.OpenAI(
        api_key=api_key,
        base_url="https://api.minimax.io/v1",
    )
    response = client.chat.completions.create(
        model="MiniMax-M2.7",
        max_tokens=256,
        temperature=0.7,
        messages=[{"role": "user", "content": "What is a neural network in one sentence?"}],
    )
    print(f"MiniMax response: {response.choices[0].message.content}")
    print(f"Tokens used: {response.usage.prompt_tokens} in, {response.usage.completion_tokens} out")


def call_with_provider_utility():
    """Use the multi-provider utility from utils/llm_provider.py.

    This auto-detects which provider to use based on available API keys.
    """
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
    from utils.llm_provider import get_llm_client, chat, list_providers

    print("Available providers:")
    for name, info in list_providers().items():
        status = "ready" if info["available"] else "not configured"
        print(f"  {name}: {status} (model: {info['default_model']})")

    try:
        client = get_llm_client()
        print(f"\nUsing: {client.provider} ({client.default_model})")
        response = chat(client, "What is a neural network in one sentence?")
        print(f"Response: {response}")
    except EnvironmentError as e:
        print(f"\n{e}")


if __name__ == "__main__":
    print("=== API Calls ===\n")

    print("1. Anthropic SDK:")
    call_with_sdk()

    print("\n2. Anthropic raw HTTP:")
    call_raw_http()

    print("\n3. MiniMax (OpenAI-compatible SDK):")
    call_minimax()

    print("\n4. Multi-provider utility (auto-detect):")
    call_with_provider_utility()
