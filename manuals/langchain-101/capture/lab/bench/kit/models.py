import json
import os
import subprocess
import time
from pathlib import Path

from langchain_core.callbacks import BaseCallbackHandler

from env import BENCH

LEDGER = BENCH / "cost-ledger.jsonl"
KEY_FILE = Path.home() / ".config" / "aiefs" / "anthropic.key"
BUDGET_USD = 40.0

PRICES = json.loads((BENCH / "data" / "anthropic-prices.json").read_text()) if (BENCH / "data" / "anthropic-prices.json").exists() else {}

OLLAMA_DEFAULTS = {"temperature": 0.0, "seed": 42, "num_ctx": 16384, "num_predict": 1024, "keep_alive": "60m"}
THINK_SETTING = {"gpt-oss:20b": "low", "qwen3:30b-a3b": True}
PREDICT_SETTING = {"qwen3:30b-a3b": 4096, "gpt-oss:20b": 4096}


class StepLimit(Exception):
    pass


class BudgetExceeded(Exception):
    pass


def ollama_meta(tag):
    out = subprocess.run(["ollama", "show", tag], capture_output=True, text=True).stdout
    meta = {"tag": tag}
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[0] in ("parameters", "quantization", "architecture"):
            meta[parts[0]] = parts[1]
        if line.strip().startswith("context length"):
            meta["context_length"] = parts[-1]
    lst = subprocess.run(["ollama", "list"], capture_output=True, text=True).stdout
    for line in lst.splitlines():
        if line.split() and line.split()[0] == tag:
            meta["digest"] = line.split()[1]
    return meta


def ledger_total():
    if not LEDGER.exists():
        return 0.0
    return sum(json.loads(l).get("cost_usd", 0.0) for l in LEDGER.read_text().splitlines() if l.strip())


def anthropic_cost(model, usage):
    p = PRICES["models"][model]
    details = usage.get("input_token_details", {}) or {}
    cr = details.get("cache_read", 0) or 0
    cw = details.get("cache_creation", 0) or 0
    plain = usage.get("input_tokens", 0) - cr - cw
    return (plain * p["input"] + cw * p["input"] * PRICES["cache_write_multiplier"] + cr * p["input"] * PRICES["cache_read_multiplier"]
            + usage.get("output_tokens", 0) * p["output"]) / 1e6


def make_model(spec, max_tokens=None, overrides=None):
    provider, name = spec.split(":", 1)
    if provider == "ollama":
        from langchain_ollama import ChatOllama
        think = THINK_SETTING.get(name, False)
        kw = dict(OLLAMA_DEFAULTS)
        if name in PREDICT_SETTING:
            kw["num_predict"] = PREDICT_SETTING[name]
        kw.update(overrides or {})
        m = ChatOllama(model=name, reasoning=think, **kw)
        return m, {"provider": "ollama", **ollama_meta(name), **kw, "think": think}
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        if not KEY_FILE.exists():
            raise FileNotFoundError("anthropic key file missing")
        key = KEY_FILE.read_text().strip()
        m = ChatAnthropic(model=name, api_key=key, temperature=None, max_tokens=max_tokens or 512, max_retries=1, default_request_timeout=60)
        import anthropic
        import certifi
        import httpx2
        import ssl
        ctx = ssl.create_default_context(cafile=certifi.where())
        m.__dict__["_client"] = anthropic.Anthropic(api_key=key, max_retries=3, timeout=90, http_client=httpx2.Client(verify=ctx, timeout=60))
        del key
        return m, {"provider": "anthropic", "model": name, "temperature": "omitted (API rejects temperature for this model: 400 Extra inputs are not permitted)", "max_tokens": max_tokens or 512, "seed": "not supported"}
    raise ValueError(spec)


class Meter(BaseCallbackHandler):
    raise_error = True

    def __init__(self, max_calls_per_turn, provider="ollama", model_name=None, cell=None, cell_token_cap=None, run_token_cap=None, run_tokens_so_far=0):
        self.max_calls = max_calls_per_turn
        self.provider = provider
        self.model_name = model_name
        self.cell = cell
        self.cell_token_cap = cell_token_cap
        self.run_token_cap = run_token_cap
        self.run_tokens_so_far = run_tokens_so_far
        self.turn_calls = 0
        self.calls = []
        self._start = {}

    def new_turn(self):
        self.turn_calls = 0

    def tokens(self):
        return sum(c.get("in", 0) + c.get("out", 0) for c in self.calls)

    def on_chat_model_start(self, serialized, messages, *, run_id, **kw):
        self.turn_calls += 1
        if self.turn_calls > self.max_calls:
            raise StepLimit(f"more than {self.max_calls} model calls in one turn")
        if self.provider == "anthropic":
            total = ledger_total()
            if total >= BUDGET_USD - 0.05:
                raise BudgetExceeded(f"ledger total ${total:.4f} at cap")
            if self.cell_token_cap and self.tokens() >= self.cell_token_cap:
                raise BudgetExceeded("cell token cap reached")
            if self.run_token_cap and self.run_tokens_so_far + self.tokens() >= self.run_token_cap:
                raise BudgetExceeded("run token cap reached")
        self._start[run_id] = time.perf_counter()

    def on_llm_end(self, response, *, run_id, **kw):
        dt = time.perf_counter() - self._start.pop(run_id, time.perf_counter())
        rec = {"dt": dt}
        try:
            msg = response.generations[0][0].message
            u = getattr(msg, "usage_metadata", None) or {}
            rec.update({"in": u.get("input_tokens", 0), "out": u.get("output_tokens", 0)})
            if self.provider == "anthropic":
                cost = anthropic_cost(self.model_name, u)
                rec["cost"] = cost
                row = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "model": self.model_name, "cell": self.cell,
                       "input_tokens": u.get("input_tokens", 0), "output_tokens": u.get("output_tokens", 0),
                       "cache_read": (u.get("input_token_details") or {}).get("cache_read", 0),
                       "cache_creation": (u.get("input_token_details") or {}).get("cache_creation", 0),
                       "cost_usd": round(cost, 6), "price_source": PRICES.get("source")}
                with open(LEDGER, "a") as f:
                    f.write(json.dumps(row) + "\n")
        except Exception as e:
            rec["meter_error"] = repr(e)
        self.calls.append(rec)

    def on_llm_error(self, error, *, run_id, **kw):
        dt = time.perf_counter() - self._start.pop(run_id, time.perf_counter())
        self.calls.append({"dt": dt, "error": repr(error)[:300]})
