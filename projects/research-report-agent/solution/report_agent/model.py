"""Model interface with a replay cassette and an optional live client.

Lesson: projects/research-report-agent/stages/03-plan-the-research/docs/en.md
Tests use ReplayModel only. LiveModel talks to any chat-completions-compatible
/chat/completions endpoint and is never required. Stdlib only.
"""

import hashlib
import json
import os
import urllib.request
from pathlib import Path
from typing import Protocol


class CassetteMiss(KeyError):
    pass


class Model(Protocol):
    def complete(self, prompt: str, *, purpose: str) -> str: ...


def prompt_key(purpose, prompt):
    digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
    return f"{purpose}:{digest}"


class ReplayModel:
    def __init__(self, cassette_path):
        data = json.loads(Path(cassette_path).read_text(encoding="utf-8"))
        self.entries = {
            prompt_key(entry["purpose"], entry["prompt"]): entry["response"]
            for entry in data["entries"]
        }
        self.calls = []

    def complete(self, prompt, *, purpose):
        key = prompt_key(purpose, prompt)
        self.calls.append(key)
        if key not in self.entries:
            raise CassetteMiss(f"no recorded response for purpose={purpose!r}")
        return self.entries[key]


class LiveModel:
    def __init__(self, base_url=None, api_key=None, model=None, timeout=60):
        self.base_url = (base_url or os.environ.get("RRA_LLM_BASE_URL", "")).rstrip("/")
        self.api_key = api_key or os.environ.get("RRA_LLM_API_KEY", "")
        self.model = model or os.environ.get("RRA_LLM_MODEL", "")
        self.timeout = timeout
        if not (self.base_url and self.model):
            raise ValueError("set RRA_LLM_BASE_URL and RRA_LLM_MODEL to use LiveModel")

    def complete(self, prompt, *, purpose):
        body = json.dumps(
            {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
            }
        ).encode("utf-8")
        request = urllib.request.Request(
            self.base_url + "/chat/completions",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return payload["choices"][0]["message"]["content"]
