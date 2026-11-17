import json
import os
import random
import sys
import time
import uuid
import warnings
from pathlib import Path

os.environ["LANGSMITH_TRACING"] = "false"
warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from mr_common import MODEL, RecordingProxy, block_mark, header

ROUNDS = int(sys.argv[1]) if len(sys.argv) > 1 else 32
WARM = int(sys.argv[2]) if len(sys.argv) > 2 else 2
OUT = Path(sys.argv[3]) if len(sys.argv) > 3 else HERE / "01-runs.jsonl"
PROMPT = "Use the add tool to add 2 and 3. Wait for its result, then call the multiply tool with that result and 4. Call one tool at a time. Reply with the final number only."
EXPECT_TOOLS = [["add", {"a": 2, "b": 3}], ["multiply", {"a": 5, "b": 4}]]

proxy = RecordingProxy(stamp_stream=False)
V1 = f"http://127.0.0.1:{proxy.port}/v1"
NATIVE = f"http://127.0.0.1:{proxy.port}"

from langchain_core.tools import tool


def add_impl(a, b):
    return a + b


def mul_impl(a, b):
    return a * b


@tool
def add(a: int, b: int) -> int:
    """Add two integers."""
    return add_impl(a, b)


@tool
def multiply(a: int, b: int) -> int:
    """Multiply two integers."""
    return mul_impl(a, b)


IMPLS = {"add": add_impl, "multiply": mul_impl}
SCHEMAS = [{"type": "function", "function": {"name": n, "description": d, "parameters": {"type": "object", "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}}, "required": ["a", "b"]}}}
           for n, d in (("add", "Add two integers."), ("multiply", "Multiply two integers."))]


def build():
    import openai
    import ollama
    from langchain.agents import create_agent
    from langchain_ollama import ChatOllama
    from langchain_openai import ChatOpenAI
    from langgraph.checkpoint.memory import InMemorySaver
    from langgraph.graph import END, START, MessagesState, StateGraph
    from langgraph.prebuilt import ToolNode, tools_condition

    oai = openai.OpenAI(base_url=V1, api_key="ollama-local-no-key")
    oll = ollama.Client(host=NATIVE)
    co = ChatOpenAI(model=MODEL, base_url=V1, api_key="ollama-local-no-key", temperature=0, seed=42)
    cl = ChatOllama(model=MODEL, base_url=NATIVE, temperature=0, seed=42)

    def graph(llm):
        bound = llm.bind_tools([add, multiply])

        def model_node(state: MessagesState):
            return {"messages": [bound.invoke(state["messages"])]}

        g = StateGraph(MessagesState)
        g.add_node("model", model_node)
        g.add_node("tools", ToolNode([add, multiply]))
        g.add_edge(START, "model")
        g.add_conditional_edges("model", tools_condition, {"tools": "tools", END: END})
        g.add_edge("tools", "model")
        return g.compile()

    v = {}

    def plain_openai():
        msgs = [{"role": "user", "content": PROMPT}]
        tools_seen = []
        for _ in range(6):
            r = oai.chat.completions.create(model=MODEL, messages=msgs, tools=SCHEMAS, temperature=0, seed=42)
            m = r.choices[0].message
            if not m.tool_calls:
                return m.content, tools_seen
            msgs.append({"role": "assistant", "content": m.content, "tool_calls": [tc.model_dump() for tc in m.tool_calls]})
            for tc in m.tool_calls:
                args = json.loads(tc.function.arguments)
                tools_seen.append([tc.function.name, args])
                msgs.append({"role": "tool", "tool_call_id": tc.id, "content": str(IMPLS[tc.function.name](**args))})
        return None, tools_seen

    def plain_ollama():
        msgs = [{"role": "user", "content": PROMPT}]
        tools_seen = []
        for _ in range(6):
            r = oll.chat(model=MODEL, messages=msgs, tools=SCHEMAS, options={"temperature": 0, "seed": 42})
            m = r.message
            if not m.tool_calls:
                return m.content, tools_seen
            msgs.append(m)
            for tc in m.tool_calls:
                args = dict(tc.function.arguments)
                tools_seen.append([tc.function.name, args])
                msgs.append({"role": "tool", "tool_name": tc.function.name, "content": str(IMPLS[tc.function.name](**args))})
        return None, tools_seen

    def bind_loop(llm):
        from langchain_core.messages import HumanMessage, ToolMessage
        bound = llm.bind_tools([add, multiply])
        tmap = {"add": add, "multiply": multiply}

        def run():
            msgs = [HumanMessage(PROMPT)]
            tools_seen = []
            for _ in range(6):
                ai = bound.invoke(msgs)
                msgs.append(ai)
                if not ai.tool_calls:
                    return ai.text, tools_seen
                for tc in ai.tool_calls:
                    tools_seen.append([tc["name"], tc["args"]])
                    msgs.append(ToolMessage(str(tmap[tc["name"]].invoke(tc["args"])), tool_call_id=tc["id"]))
            return None, tools_seen
        return run

    def graph_runner(app, saver=False):
        def run():
            cfg = {"configurable": {"thread_id": uuid.uuid4().hex}} if saver else None
            res = app.invoke({"messages": [{"role": "user", "content": PROMPT}]}, cfg)
            seen = [[tc["name"], tc["args"]] for m in res["messages"] if getattr(m, "tool_calls", None) for tc in m.tool_calls]
            return res["messages"][-1].text, seen
        return run

    v["a_plain_openai"] = ("v1", plain_openai)
    v["b_bind_tools_loop"] = ("v1", bind_loop(co))
    v["c_create_agent"] = ("v1", graph_runner(create_agent(co, tools=[add, multiply])))
    v["d_create_agent_saver"] = ("v1", graph_runner(create_agent(co, tools=[add, multiply], checkpointer=InMemorySaver()), saver=True))
    v["e_stategraph"] = ("v1", graph_runner(graph(co)))
    v["f_plain_ollama"] = ("native", plain_ollama)
    v["g_create_agent_ollama"] = ("native", graph_runner(create_agent(cl, tools=[add, multiply])))
    v["h_stategraph_ollama"] = ("native", graph_runner(graph(cl)))
    return v


def main():
    fh = open(OUT, "a")
    fh.write(json.dumps(header("t01_real.py", prompt=PROMPT, rounds=ROUNDS, warmup_rounds=WARM, proxy="RecordingProxy in mr_common.py, every request of every variant",
                               variants_note="v1 = ChatOpenAI/openai on Ollama /v1; native = ChatOllama/ollama on /api/chat")) + "\n")
    variants = build()
    rng = random.Random(42)
    names = list(variants)
    for rnd in range(ROUNDS):
        block_mark(fh, f"round {rnd}")
        order = names[:]
        rng.shuffle(order)
        for name in order:
            path, fn = variants[name]
            c0 = time.process_time_ns()
            t0 = time.time_ns()
            err = None
            answer, seen = None, []
            try:
                answer, seen = fn()
            except Exception as e:
                err = f"{type(e).__name__}: {e}"[:300]
            t1 = time.time_ns()
            c1 = time.process_time_ns()
            time.sleep(0.05)
            reqs = proxy.since(t0, t1)
            row = {"kind": "run", "variant": name, "path": path, "round": rnd, "warmup": rnd < WARM, "t_start_ns": t0, "t_end_ns": t1,
                   "wall_ms": (t1 - t0) / 1e6, "cpu_ms": (c1 - c0) / 1e6, "answer": answer, "tools": seen, "error": err,
                   "ok": err is None and answer is not None and "20" in str(answer) and seen == EXPECT_TOOLS,
                   "model_calls": len(reqs),
                   "upstream_ms": sum(r["upstream_ns"] for r in reqs) / 1e6,
                   "ollama_total_ms": (sum(r["total_duration"] for r in reqs) / 1e6) if reqs and all("total_duration" in r for r in reqs) else None,
                   "ollama_load_ms": (sum(r.get("load_duration", 0) for r in reqs) / 1e6) if path == "native" else None,
                   "requests": [{k: r.get(k) for k in ("path", "status", "req_bytes", "resp_bytes", "upstream_ns", "usage", "total_duration", "load_duration",
                                                       "prompt_eval_count", "prompt_eval_duration", "eval_count", "eval_duration", "n_msgs")} for r in reqs]}
            fh.write(json.dumps(row) + "\n")
            fh.flush()
            print(name, rnd, round(row["wall_ms"], 1), round(row["upstream_ms"], 1), row["ok"], err or "", flush=True)
    block_mark(fh, "end")
    proxy.close()


if __name__ == "__main__":
    main()
