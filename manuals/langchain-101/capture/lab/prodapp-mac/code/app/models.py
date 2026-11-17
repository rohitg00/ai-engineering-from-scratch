import os
from pathlib import Path

from .policy import SupportPolicyModel

ANTHROPIC_KEY = Path("~/.config/aiefs/anthropic.key").expanduser()


def usage_callbacks(spec):
    from .usage import UsageLog

    path = os.environ.get("USAGE_FILE")
    return [UsageLog(path, spec)] if path else []


def make_model(spec, latency=0.0):
    provider, _, name = spec.partition(":")
    if provider == "fake":
        fail_on = "#outage" if name == "primary" else None
        return SupportPolicyModel(label=spec, fail_on=fail_on, latency=latency)
    if provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(model=name, temperature=0, seed=42, num_predict=512, reasoning=False,
                          callbacks=usage_callbacks(spec))
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        from .ledger import Ledger

        cell = os.environ.get("LEDGER_CELL", f"prodapp|{name}")
        return ChatAnthropic(model=name, api_key=ANTHROPIC_KEY.read_text().strip(), max_tokens=512,
                             max_retries=1, callbacks=[Ledger(name, cell), *usage_callbacks(spec)])
    raise ValueError(f"unknown model spec {spec!r}")
