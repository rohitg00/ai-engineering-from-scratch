"""First API call via OpenRouter (OpenAI-compatible).

Drop-in replacement for first_api_call.py when Anthropic API is not available.
Uses the official OpenAI SDK pointed at OpenRouter's base URL.
"""

import json
import os
import urllib.request

from dotenv import load_dotenv
from openai import OpenAI

MODEL = "meta-llama/llama-3.2-3b-instruct"
URL = "https://openrouter.ai/api/v1/chat/completions"
PROMPT = "Что такое нейронная сеть в одном предложении?"


def call_with_sdk() -> None:
    load_dotenv()

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ["OPENROUTER_API_KEY"],
    )

    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=256,
        messages=[{"role": "user", "content": PROMPT}],
    )

    print("=== SDK response ===")
    print(response.choices[0].message.content)
    print()
    print(
        f"Tokens used: {response.usage.prompt_tokens} in, "
        f"{response.usage.completion_tokens} out"
    )
    print(f"Model returned: {response.model}")


def call_raw_http() -> None:
    load_dotenv()
    api_key = os.environ["OPENROUTER_API_KEY"]

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    body = json.dumps(
        {
            "model": MODEL,
            "max_tokens": 256,
            "messages": [{"role": "user", "content": PROMPT}],
        }
    ).encode()

    req = urllib.request.Request(URL, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())

    print("=== Raw HTTP response ===")
    print(result["choices"][0]["message"]["content"])
    print()
    print(
        f"Tokens used: {result['usage']['prompt_tokens']} in, "
        f"{result['usage']['completion_tokens']} out"
    )
    print(f"Model returned: {result['model']}")


if __name__ == "__main__":
    call_with_sdk()
    print()
    call_raw_http()
