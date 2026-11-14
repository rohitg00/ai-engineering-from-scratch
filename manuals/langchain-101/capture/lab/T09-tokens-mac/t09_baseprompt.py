import json
import os
import sys
import warnings
from importlib.metadata import version

os.environ["LANGSMITH_TRACING"] = "false"
os.environ.setdefault("ANTHROPIC_API_KEY", "dummy-not-a-key")
warnings.filterwarnings("ignore")

import tiktoken
from deepagents import create_deep_agent
from langchain_core.messages import AIMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.utils.function_calling import convert_to_openai_tool

OUT = sys.argv[1]
captured = []


def patch(cls):
    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        captured.append({"messages": messages, "kwargs": kwargs})
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content="ok"))])

    async def _agenerate(self, messages, stop=None, run_manager=None, **kwargs):
        return _generate(self, messages, stop, run_manager, **kwargs)

    cls._generate = _generate
    cls._agenerate = _agenerate
    if hasattr(cls, "_stream"):
        cls._stream = None


def models():
    out = []
    from langchain_anthropic import ChatAnthropic
    patch(ChatAnthropic)
    out.append(("anthropic:claude-sonnet-4-6", lambda: ChatAnthropic(model_name="claude-sonnet-4-6", api_key="dummy-not-a-key")))
    try:
        from langchain_ollama import ChatOllama
        patch(ChatOllama)
        out.append(("ollama:qwen3:8b", lambda: ChatOllama(model="qwen3:8b")))
    except ImportError:
        pass
    return out


enc = {n: tiktoken.get_encoding(n) for n in ["o200k_base", "cl100k_base"]}


def count(text):
    return {n: len(e.encode(text)) for n, e in enc.items()}


def tool_dicts(kwargs):
    tools = kwargs.get("tools") or []
    out = []
    for t in tools:
        if isinstance(t, dict) and "input_schema" in t:
            out.append({"name": t["name"], "description": t.get("description", ""), "parameters": t["input_schema"]})
        elif isinstance(t, dict) and "function" in t:
            f = t["function"]
            out.append({"name": f["name"], "description": f.get("description", ""), "parameters": f.get("parameters", {})})
        else:
            f = convert_to_openai_tool(t)["function"]
            out.append({"name": f["name"], "description": f.get("description", ""), "parameters": f.get("parameters", {})})
    return out


def text_of(m):
    c = m.content
    if isinstance(c, str):
        return c
    return "".join(b.get("text", "") for b in c if isinstance(b, dict))


rows = []
for label, make in models():
    captured.clear()
    agent = create_deep_agent(model=make())
    agent.invoke({"messages": [{"role": "user", "content": "hi"}]})
    req = captured[0]
    sys_text = "\n".join(text_of(m) for m in req["messages"] if m.type == "system")
    tools = tool_dicts(req["kwargs"])
    desc_text = "\n".join(t["description"] for t in tools)
    schema_text = json.dumps(tools, separators=(",", ":"))
    param_desc = []
    for t in tools:
        for p in (t["parameters"].get("properties") or {}).values():
            if isinstance(p, dict) and p.get("description"):
                param_desc.append(p["description"])
    desc_all = desc_text + "\n" + "\n".join(param_desc)
    rows.append({
        "deepagents": version("deepagents"), "langchain": version("langchain"), "model": label,
        "n_messages": len(req["messages"]), "message_types": [m.type for m in req["messages"]],
        "tools": [t["name"] for t in tools],
        "system_chars": len(sys_text), "system_tokens": count(sys_text),
        "tool_description_tokens": count(desc_text), "tool_and_param_description_tokens": count(desc_all),
        "tool_schema_json_tokens": count(schema_text),
        "system_plus_schema_tokens": {k: count(sys_text)[k] + count(schema_text)[k] for k in enc},
        "per_tool_description_tokens_o200k": {t["name"]: len(enc["o200k_base"].encode(t["description"])) for t in tools},
        "system_prompt": sys_text, "tool_schemas": tools,
    })
    print(json.dumps({k: v for k, v in rows[-1].items() if k not in ("system_prompt", "tool_schemas")}))

with open(OUT, "w") as f:
    for r in rows:
        f.write(json.dumps(r) + "\n")
