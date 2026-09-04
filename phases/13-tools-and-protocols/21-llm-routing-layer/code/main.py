"""Phase 13 Lesson 21 - LLM routing gateway, stdlib.

OpenAI-compatible request in; priority fallback chain picks a backend; cost
tracker accumulates spend per-request. PII redaction runs pre-dispatch.

Backend providers are stubs. Switching one to "outage" shows fallback.

Run: python code/main.py
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from typing import Callable


# cost per 1M tokens (input, output); fake rates for demo
PRICES = {
    "openai/gpt-4o":           (5.0, 15.0),
    "openai/gpt-4o-mini":      (0.15, 0.60),
    "anthropic/claude-sonnet": (3.0, 15.0),
    "anthropic/claude-haiku":  (0.80, 4.0),
    "google/gemini-pro":       (1.25, 5.0),
}

OUTAGE: set[str] = set()


def provider_call(model: str, messages: list[dict]) -> dict:
    if model in OUTAGE:
        raise RuntimeError(f"simulated 5xx from {model}")
    time.sleep(0.01)
    last = messages[-1]["content"]
    out_toks = max(20, len(last) // 3)
    return {
        "id": f"resp_{model.replace('/', '_')}",
        "model": model,
        "choices": [{"message": {"role": "assistant",
                                 "content": f"[{model}] echoed: {last[:60]}"}}],
        "usage": {"prompt_tokens": len(last) // 4, "completion_tokens": out_toks},
    }


# aliases -> fallback chain
ROUTES = {
    "smart": ["openai/gpt-4o", "anthropic/claude-sonnet", "google/gemini-pro"],
    "fast":  ["openai/gpt-4o-mini", "anthropic/claude-haiku"],
}


PII_PATTERNS = [
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),  # SSN
    re.compile(r"\b\d{16}\b"),               # credit card
]


def redact_pii(text: str) -> tuple[str, bool]:
    redacted = False
    for pat in PII_PATTERNS:
        if pat.search(text):
            text = pat.sub("[REDACTED]", text)
            redacted = True
    return text, redacted


@dataclass
class Invocation:
    alias: str
    chosen_model: str = ""
    attempts: list[str] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    redacted: bool = False
    response: dict | None = None
    error: str | None = None


def route(alias: str, messages: list[dict]) -> Invocation:
    inv = Invocation(alias=alias)
    # redact pii on inputs
    new_msgs = []
    for m in messages:
        txt, r = redact_pii(m["content"])
        if r:
            inv.redacted = True
        new_msgs.append({"role": m["role"], "content": txt})
    chain = ROUTES.get(alias, [alias])
    for model in chain:
        inv.attempts.append(model)
        try:
            resp = provider_call(model, new_msgs)
            inv.chosen_model = model
            inv.response = resp
            u = resp["usage"]
            inv.input_tokens = u["prompt_tokens"]
            inv.output_tokens = u["completion_tokens"]
            in_rate, out_rate = PRICES.get(model, (0, 0))
            inv.cost_usd = (u["prompt_tokens"] * in_rate +
                            u["completion_tokens"] * out_rate) / 1_000_000
            return inv
        except RuntimeError as e:
            continue
    inv.error = "all providers failed"
    return inv


def demo() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 20 - LLM ROUTING GATEWAY")
    print("=" * 72)

    print("\n--- scenario 1: smart route, primary available ---")
    inv = route("smart", [{"role": "user", "content": "explain MCP"}])
    print(f"  chosen  : {inv.chosen_model}")
    print(f"  attempts: {inv.attempts}")
    print(f"  tokens  : in={inv.input_tokens} out={inv.output_tokens}")
    print(f"  cost    : ${inv.cost_usd:.6f}")
    print(f"  reply   : {inv.response['choices'][0]['message']['content']}")

    print("\n--- scenario 2: openai/gpt-4o OUTAGE -> falls back to Claude ---")
    OUTAGE.add("openai/gpt-4o")
    inv = route("smart", [{"role": "user", "content": "same request"}])
    print(f"  chosen  : {inv.chosen_model}")
    print(f"  attempts: {inv.attempts}")
    print(f"  cost    : ${inv.cost_usd:.6f}")
    OUTAGE.clear()

    print("\n--- scenario 3: PII in input gets redacted pre-dispatch ---")
    inv = route("fast", [{"role": "user",
                           "content": "contact me at SSN 123-45-6789 please"}])
    print(f"  redacted: {inv.redacted}")
    print(f"  reply   : {inv.response['choices'][0]['message']['content']}")

    print("\n--- scenario 4: all providers down ---")
    OUTAGE.update(ROUTES["fast"])
    inv = route("fast", [{"role": "user", "content": "help"}])
    print(f"  attempts: {inv.attempts}")
    print(f"  error   : {inv.error}")


if __name__ == "__main__":
    demo()
