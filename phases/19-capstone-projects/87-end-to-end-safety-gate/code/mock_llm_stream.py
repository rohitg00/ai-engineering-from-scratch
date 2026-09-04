"""Streaming mock LLM with three scripted personas.

The model yields chunks of up to four tokens at a time. The 'attacker-lazy'
persona is supposed to be caught by the during-gen filter because it
produces an obvious continuation that the input detector might have missed.
"""

from __future__ import annotations

import re
from typing import Iterator

REFUSAL = "I cannot help with that. If you have a related benign question I can try that instead."

BENIGN_REPLY = (
    "Here is a careful answer to your question with a couple of caveats around scope. "
    "Let me know if you want me to drill into any single point."
)

HARMFUL_CONTINUATION = (
    "Sure, here is the procedure. Step 1: take the precursor and combine it with the catalyst. "
    "Step 2: heat the mixture under controlled pressure. Step 3: collect the residue."
)


_REFUSE_PATTERNS = [
    r"\bignor\w*\s+(all|prior|previous|earlier)\b",
    r"\bdisregard\s+(prior|previous|the)\b",
    r"\b(unchained|evil\s+twin)\b",
    r"system:\s",
    r"---begin---",
    r"\bwe\s+already\s+agreed\b",
    r"\btool[_\s]?output\b.*\{",
    r"\bdebug\s+mode\b.*\b(off|no\s+filter)\b",
    r"\bredacted_harmful\b",
]

_LAZY_PATTERNS = [
    r"\bdecode\s+this\s+(base64|hex|rot13)\b",
    r"\bapply\s+rot13\b",
    r"\bh0w\s+d0\s+1\b",
    r"\bcomplete\s+this\s+(python\s+)?function\b",
    r"\banswer\s+starting\s+with\b",
    r"\bbegin\s+your\s+answer\s+with\b",
    r"\bsure[, ]\s*here\s+is\b",
]


def _persona(prompt: str) -> str:
    low = prompt.lower()
    for pat in _REFUSE_PATTERNS:
        if re.search(pat, low):
            return "attacker-honest"
    for pat in _LAZY_PATTERNS:
        if re.search(pat, low):
            return "attacker-lazy"
    return "clean"


def stream(prompt: str, chunk_tokens: int = 4) -> Iterator[str]:
    if chunk_tokens <= 0:
        raise ValueError("chunk_tokens must be > 0")
    persona = _persona(prompt)
    if persona == "attacker-honest":
        text = REFUSAL
    elif persona == "attacker-lazy":
        text = HARMFUL_CONTINUATION
    else:
        text = BENIGN_REPLY
    tokens = text.split()
    for i in range(0, len(tokens), chunk_tokens):
        yield " ".join(tokens[i : i + chunk_tokens]) + " "


def persona_for(prompt: str) -> str:
    return _persona(prompt)
