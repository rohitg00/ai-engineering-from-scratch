import argparse
import json
import os
import sys
import time
import traceback
import warnings
from pathlib import Path

os.environ["LANGSMITH_TRACING"] = "false"
sys.path.insert(0, str(Path(__file__).resolve().parent))
warnings.filterwarnings("ignore")

from langchain.agents import create_agent
from langchain.agents.structured_output import AutoStrategy, ProviderStrategy, ToolStrategy
from langchain_core.callbacks import BaseCallbackHandler
from langchain_ollama import ChatOllama
import ollama

from t06_schemas import SCHEMAS

STRATS = {"auto": AutoStrategy, "provider": ProviderStrategy, "tool": ToolStrategy}
SYSTEM = "Extract the requested information from the user's text and return it in the required structured format."


class Counter(BaseCallbackHandler):
    def __init__(self):
        self.calls = 0
        self.inp = 0
        self.out = 0
        self.bound = []

    def on_chat_model_start(self, serialized, messages, **kw):
        self.calls += 1
        inv = kw.get("invocation_params") or {}
        self.bound.append({"tools": [t.get("function", {}).get("name", t.get("name")) if isinstance(t, dict) else str(t) for t in inv.get("tools", []) or []],
                           "format": "format" in inv and inv.get("format") is not None or "response_format" in inv})
        if self.calls == 2 and messages and messages[0]:
            self.retry_msg = str(messages[0][-1].content)[:400]

    retry_msg = None
    first_out = None

    def on_llm_end(self, response, **kw):
        for gens in response.generations:
            for g in gens:
                msg = getattr(g, "message", None)
                if self.first_out is None and msg is not None:
                    self.first_out = {"content": str(msg.content)[:300], "tool_calls": [(tc["name"], json.dumps(tc["args"])[:400]) for tc in getattr(msg, "tool_calls", [])],
                                      "invalid_tool_calls": len(getattr(msg, "invalid_tool_calls", []) or [])}
                um = getattr(msg, "usage_metadata", None) or {}
                self.inp += um.get("input_tokens", 0)
                self.out += um.get("output_tokens", 0)


def check(schema_name, sr, expect):
    if sr is None:
        return None
    try:
        if schema_name == "flat":
            return sr.name.strip().lower() == expect["name"].lower() and sr.email.strip().lower() == expect["email"] and sr.age == expect["age"]
        if schema_name == "nested":
            return sr.order_id == expect["order_id"] and len(sr.items) == expect["n_items"]
        if schema_name == "union":
            return type(sr).__name__ == expect["kind"] and sr.order_id == expect["order_id"]
        if schema_name == "enum":
            return sr.priority.value == expect["priority"] and sr.category.value == expect["category"]
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", required=True)
    ap.add_argument("--schemas", nargs="+", default=list(SCHEMAS))
    ap.add_argument("--strategies", nargs="+", default=list(STRATS))
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    out = open(args.out, "a")
    for model_name in args.models:
        llm = ChatOllama(model=model_name, temperature=0, seed=42, reasoning=False, num_predict=512, client_kwargs={"timeout": 180})
        for sname in args.schemas:
            schema, gen = SCHEMAS[sname]
            inputs = gen()[: args.n]
            for strat in args.strategies:
                try:
                    agent = create_agent(llm, tools=[], system_prompt=SYSTEM, response_format=STRATS[strat](schema))
                    build_err = None
                except Exception as e:
                    agent, build_err = None, f"{type(e).__name__}: {e}"
                for i, item in enumerate(inputs):
                    row = {"model": model_name, "schema": sname, "strategy": strat, "i": i}
                    if agent is None:
                        row.update(outcome="raised", stage="create_agent", error=build_err[:500])
                        out.write(json.dumps(row) + "\n"); out.flush()
                        continue
                    cb = Counter()
                    t0 = time.perf_counter()
                    try:
                        res = agent.invoke({"messages": [{"role": "user", "content": item["text"]}]},
                                           config={"callbacks": [cb], "recursion_limit": 10})
                        sr = res.get("structured_response")
                        msgs = res["messages"]
                        if sr is None:
                            outcome = "missing"
                        elif cb.calls > 1:
                            outcome = "retried_valid"
                        else:
                            outcome = "valid"
                        row.update(outcome=outcome, correct=check(sname, sr, item["expect"]),
                                   structured=(sr.model_dump(mode="json") if hasattr(sr, "model_dump") else sr),
                                   sr_type=type(sr).__name__ if sr is not None else None,
                                   last=(msgs[-1].type, str(msgs[-1].content)[:300], [tc["name"] for tc in getattr(msgs[-1], "tool_calls", [])]),
                                   n_msgs=len(msgs))
                    except Exception as e:
                        row.update(outcome="raised", stage="invoke", error_type=type(e).__name__, error=str(e)[:500])
                    row.update(model_calls=cb.calls, in_tokens=cb.inp, out_tokens=cb.out, bound=cb.bound[:1],
                               first_out=cb.first_out, retry_msg=cb.retry_msg,
                               secs=round(time.perf_counter() - t0, 3))
                    out.write(json.dumps(row, default=str) + "\n"); out.flush()
                print(model_name, sname, strat, "done", flush=True)
        try:
            ollama.generate(model=model_name, prompt="", keep_alive=0)
        except Exception as e:
            print("unload failed", e)


if __name__ == "__main__":
    main()
