import json
import os
import time
from pathlib import Path

from langchain_core.callbacks import BaseCallbackHandler

LEDGER = Path("~/.cache/aiefs-manuals-wip/langchain-research/bench/cost-ledger.jsonl").expanduser()
PRICES = json.loads((Path(__file__).parent.parent / "cost" / "prices.json").read_text())
BUDGET_USD = 40.0
SUITE_CAP_USD = float(os.environ.get("ANTHROPIC_SUITE_CAP", "1.0"))


class BudgetExceeded(Exception):
    pass


def rows():
    if not LEDGER.exists():
        return []
    return [json.loads(line) for line in LEDGER.read_text().splitlines() if line.strip()]


def total(prefix=None):
    return sum(r.get("cost_usd", 0.0) for r in rows() if prefix is None or str(r.get("cell", "")).startswith(prefix))


def cost(model, usage):
    price = PRICES["models"][model]
    return (usage.get("input_tokens", 0) * price["input"] + usage.get("output_tokens", 0) * price["output"]) / 1e6


class Ledger(BaseCallbackHandler):
    raise_error = True

    def __init__(self, model, cell):
        self.model, self.cell = model, cell

    def on_chat_model_start(self, serialized, messages, **kwargs):
        spent = total()
        if spent >= BUDGET_USD - 0.05:
            raise BudgetExceeded(f"ledger total ${spent:.4f} at cap")
        if total("prodapp") >= SUITE_CAP_USD:
            raise BudgetExceeded("prodapp suite cap reached")

    def on_llm_end(self, response, **kwargs):
        message = response.generations[0][0].message
        usage = message.usage_metadata or {}
        details = usage.get("input_token_details") or {}
        row = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "model": self.model, "cell": self.cell,
               "input_tokens": usage.get("input_tokens", 0), "output_tokens": usage.get("output_tokens", 0),
               "cache_read": details.get("cache_read", 0), "cache_creation": details.get("cache_creation", 0),
               "cost_usd": round(cost(self.model, usage), 6), "price_source": PRICES["source"]}
        LEDGER.parent.mkdir(parents=True, exist_ok=True)
        with open(LEDGER, "a") as out:
            out.write(json.dumps(row) + "\n")
