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


if __name__ == "__main__":
    print("=== API Calls ===\n")
    print("1. Using the SDK:")
    call_with_sdk()
    print("\n2. Using raw HTTP:")
    call_raw_http()
