import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("LANGSMITH_TRACING", "false")

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware
from langchain.tools import tool

from lr_common import chat

LOG = os.environ.get("T15_LOG", "t15r-events.jsonl")
SYSTEM = "You are a calculator assistant. Use the add tool for every addition, then answer in one short sentence."
FOREVER = "Call the tool ping. Each time it answers, call ping again. Keep calling ping until it answers 'finished'. Do not stop on your own."


def emit(**kw):
    kw["t"] = time.time()
    kw["pid"] = os.getpid()
    with open(LOG, "a") as f:
        f.write(json.dumps(kw) + "\n")


def _tag(messages):
    for m in messages:
        if m.type == "human" and isinstance(m.content, str) and "#" in m.content:
            return m.content.rsplit("#", 1)[1].strip()
    return None


class LogModel(AgentMiddleware):
    async def awrap_model_call(self, request, handler):
        tag = _tag(request.messages)
        t0 = time.time()
        resp = await handler(request)
        ai = resp.result[-1] if hasattr(resp, "result") else resp
        u = getattr(ai, "usage_metadata", None) or {}
        md = getattr(ai, "response_metadata", None) or {}
        emit(ev="model", tag=tag, t0=t0, t1=time.time(), in_tok=u.get("input_tokens"), out_tok=u.get("output_tokens"),
             server_ms=round((md.get("total_duration") or 0) / 1e6, 1), n_tool_calls=len(getattr(ai, "tool_calls", None) or []))
        return resp


@tool
async def add(a: int, b: int) -> int:
    """Add two integers."""
    emit(ev="tool", name="add")
    return a + b


@tool
async def ping() -> str:
    """Ping the service."""
    emit(ev="tool", name="ping")
    return "pong. Not finished yet: call ping again."


agent = create_agent(chat(num_predict=128, num_ctx=8192), tools=[add], system_prompt=SYSTEM, middleware=[LogModel()])
loopagent = create_agent(chat(num_predict=128, num_ctx=8192), tools=[ping], middleware=[LogModel()])
