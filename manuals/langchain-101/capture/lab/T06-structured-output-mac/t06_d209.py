import json
import os
import sys
import threading
import traceback
import warnings
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

os.environ["LANGSMITH_TRACING"] = "false"
warnings.filterwarnings("ignore")
sys.path.insert(0, str(Path(__file__).resolve().parent))

from langchain.agents import create_agent
from langchain.agents.structured_output import AutoStrategy, ProviderStrategy, ToolStrategy
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import Field

from t06_schemas import Contact

OUT = Path(sys.argv[1])
rows = []


class Fake(BaseChatModel):
    replies: list[Any] = Field(default_factory=list, exclude=True)
    pos: int = Field(default=0, exclude=True)
    binds: list = Field(default_factory=list, exclude=True)
    calls: int = Field(default=0, exclude=True)

    def bind_tools(self, tools, *, tool_choice=None, **kwargs):
        names = [getattr(t, "name", None) or (t.get("name") if isinstance(t, dict) else str(t)) for t in tools]
        self.binds.append({"tools": names, "tool_choice": tool_choice, "kwargs": sorted(kwargs)})
        return self

    def _generate(self, messages, stop=None, run_manager=None, **kw):
        self.calls += 1
        r = self.replies[min(self.pos, len(self.replies) - 1)]
        self.pos += 1
        return ChatResult(generations=[ChatGeneration(message=r if isinstance(r, AIMessage) else AIMessage(content=r))])

    @property
    def _llm_type(self):
        return "fake"


def tc(name, args, i="c1"):
    return AIMessage(content="", tool_calls=[{"name": name, "args": args, "id": i, "type": "tool_call"}])


def run(label, model, fmt, limit=12, tools=()):
    row = {"case": label, "user_tools": [t.name for t in tools]}
    try:
        res = create_agent(model, tools=list(tools), response_format=fmt).invoke({"messages": [{"role": "user", "content": "Ana, 30, ana@x.org"}]}, {"recursion_limit": limit})
        sr = res.get("structured_response")
        row.update(outcome="valid" if sr is not None else "missing", structured=repr(sr), messages=[(m.type, str(m.content)[:160]) for m in res["messages"]])
    except Exception as e:
        row.update(outcome="raised", error_type=type(e).__name__, error=str(e).splitlines()[0][:300])
    row["model_calls"] = getattr(model, "calls", None)
    row["bind"] = getattr(model, "binds", [None])[:1]
    rows.append(row)
    print(json.dumps(row, default=str)[:600])


good = {"name": "Ana", "email": "ana@x.org", "age": 30}
run("fake ProviderStrategy, valid JSON text", Fake(replies=[json.dumps(good)]), ProviderStrategy(Contact))
run("fake ProviderStrategy, non-JSON text", Fake(replies=["Ana is 30."]), ProviderStrategy(Contact))
run("fake ProviderStrategy, JSON failing validation", Fake(replies=[json.dumps({"name": "Ana", "age": "thirty"})]), ProviderStrategy(Contact))
run("fake AutoStrategy (no profile), tool call", Fake(replies=[tc("Contact", good)]), AutoStrategy(Contact))
run("fake bare schema (no profile), tool call", Fake(replies=[tc("Contact", good)]), Contact)
run("fake ToolStrategy, model answers in text, no tool call", Fake(replies=["Ana, 30"]), ToolStrategy(Contact))
run("fake ToolStrategy, invalid args then valid", Fake(replies=[tc("Contact", {"name": "Ana"}), tc("Contact", good, "c2")]), ToolStrategy(Contact))
run("fake ToolStrategy, always invalid, handle_errors=True, recursion_limit=12", Fake(replies=[tc("Contact", {"name": "Ana"})]), ToolStrategy(Contact))
run("fake ToolStrategy, invalid, handle_errors=False", Fake(replies=[tc("Contact", {"name": "Ana"})]), ToolStrategy(Contact, handle_errors=False))
run("fake ToolStrategy, wrong tool name", Fake(replies=[tc("Person", good), "done"]), ToolStrategy(Contact))
from langchain_core.tools import tool


@tool
def weather(city: str) -> str:
    """Weather for a city."""
    return "sunny"


run("fake ToolStrategy + one user tool, model answers in text", Fake(replies=["Ana, 30"]), ToolStrategy(Contact), tools=[weather])
run("fake ProviderStrategy + one user tool, non-JSON text", Fake(replies=["Ana is 30."]), ProviderStrategy(Contact), tools=[weather])
run("fake ToolStrategy + one user tool, always invalid args", Fake(replies=[tc("Contact", {"name": "Ana"})]), ToolStrategy(Contact), tools=[weather])
run("fake ProviderStrategy, model emits a tool call", Fake(replies=[tc("Contact", good), "done"]), ProviderStrategy(Contact))

bodies = []


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        bodies.append({"path": self.path, "keys": sorted(body), "response_format": body.get("response_format", {}).get("type") if body.get("response_format") else None, "tools": [t["function"]["name"] for t in body.get("tools", [])]})
        if body.get("response_format"):
            data = json.dumps({"error": {"message": "response_format json_schema is not supported by this model", "type": "invalid_request_error"}}).encode()
            self.send_response(400)
        else:
            msg = {"role": "assistant", "content": None, "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "Contact", "arguments": json.dumps(good)}}]} if body.get("tools") else {"role": "assistant", "content": "hi"}
            data = json.dumps({"id": "x", "object": "chat.completion", "created": 0, "model": body["model"], "choices": [{"index": 0, "message": msg, "finish_reason": "stop"}], "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}}).encode()
            self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_port}/v1"

from langchain_openai import ChatOpenAI

for model_name in ["local-model", "gpt-4o"]:
    for label, fmt in [("ProviderStrategy", ProviderStrategy(Contact)), ("AutoStrategy", AutoStrategy(Contact)), ("ToolStrategy", ToolStrategy(Contact))]:
        n0 = len(bodies)
        m = ChatOpenAI(model=model_name, base_url=base, api_key="dummy-not-a-key", max_retries=0)
        run(f"ChatOpenAI({model_name}) {label}, server 400s on response_format", m, fmt)
        rows[-1]["requests"] = bodies[n0:]
        print("   requests:", bodies[n0:])
srv.shutdown()
OUT.write_text("\n".join(json.dumps(r, default=str) for r in rows) + "\n")
