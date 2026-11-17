import json
import os
import sys
import time
import warnings

os.environ["LANGSMITH_TRACING"] = "false"
warnings.filterwarnings("ignore")

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.tools import tool
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

EXEC = []


@tool
def get_weather(city: str) -> str:
    """Get the weather for one city."""
    EXEC.append(("get_weather", city))
    return f"{city}: sunny"


@tool
def get_time(city: str) -> str:
    """Get the local time for one city."""
    EXEC.append(("get_time", city))
    return f"{city}: 10:00"


PROMPT = "In one turn, call get_weather for Paris and get_time for Tokyo at the same time, then answer in one short sentence."


def summarize(out):
    msgs = (out or {}).get("messages", [])
    first_ai = next((m for m in msgs if isinstance(m, AIMessage) and (m.tool_calls or m.invalid_tool_calls)), None)
    return {"first_ai_tool_calls": [[t["name"], t["id"], t["args"]] for t in (first_ai.tool_calls if first_ai else [])],
            "first_ai_invalid": [[t.get("name"), t.get("id"), t.get("args")] for t in (first_ai.invalid_tool_calls if first_ai else [])],
            "tool_messages": [[m.tool_call_id, m.status, str(m.content)[:40]] for m in msgs if isinstance(m, ToolMessage)],
            "n_messages": len(msgs)}


def main():
    out_path, reps = sys.argv[1], int(sys.argv[2])
    model = "qwen3:4b-instruct-2507-q4_K_M"
    llms = {"chatollama": ChatOllama(model=model, temperature=0, seed=42),
            "chatopenai_ollama_v1": ChatOpenAI(model=model, base_url="http://127.0.0.1:11434/v1", api_key="dummy", temperature=0, seed=42)}
    with open(out_path, "a") as fh:
        for rep in range(reps):
            for name, llm in llms.items():
                agent = create_agent(model=llm, tools=[get_weather, get_time])
                for how in ("invoke", "stream_messages", "stream_events_v3"):
                    EXEC.clear()
                    err = None
                    out = None
                    t0 = time.time()
                    inp = {"messages": [{"role": "user", "content": PROMPT}]}
                    try:
                        if how == "invoke":
                            out = agent.invoke(inp)
                        elif how == "stream_messages":
                            for mode, data in agent.stream(inp, stream_mode=["messages", "values"]):
                                if mode == "values":
                                    out = data
                        else:
                            run = agent.stream_events(inp, version="v3")
                            for m in run.messages:
                                for _ in m.text:
                                    pass
                            out = run.output
                    except Exception as e:
                        err = f"{type(e).__name__}: {e}"[:300]
                    rec = {"rep": rep, "llm": name, "how": how, "error": err, "executions": list(EXEC), "secs": round(time.time() - t0, 2),
                           "load": os.getloadavg(), **summarize(out)}
                    fh.write(json.dumps(rec) + "\n")
                    fh.flush()
                    print(json.dumps(rec)[:300], flush=True)


if __name__ == "__main__":
    main()
