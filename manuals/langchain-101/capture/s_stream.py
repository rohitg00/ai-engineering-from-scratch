from langchain.agents import create_agent
from langchain.tools import ToolRuntime, tool
from langchain_core.language_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from common import ASK, add, model, sum_script
from fake import call
from record import message


def agent(**kwargs):
    return create_agent(model(*sum_script(), stream_delimiter=r"(\s)", **kwargs), tools=[add])


def short(chunk):
    if isinstance(chunk, tuple) and len(chunk) == 2 and hasattr(chunk[0], "content"):
        msg, meta = chunk
        keep = {k: meta.get(k) for k in ("langgraph_node", "langgraph_step", "langgraph_triggers", "ls_provider", "ls_model_type") if k in meta}
        return {"message": message(msg), "metadata": keep}
    return chunk


def stream_updates(cap):
    for mode in ("updates", "values"):
        cap.section(f"stream_mode={mode!r}")
        for index, chunk in enumerate(agent().stream(ASK, stream_mode=mode)):
            cap.json(short(chunk), f"chunk {index}")
    cap.section("stream_mode=None uses the graph default")
    for index, chunk in enumerate(agent().stream(ASK)):
        cap.json(sorted(chunk), f"chunk {index} keys")


def stream_messages(cap):
    cap.section("stream_mode='messages': token chunks with metadata")
    for index, chunk in enumerate(agent().stream(ASK, stream_mode="messages")):
        cap.json(short(chunk), f"chunk {index}")
    cap.section("stream_mode=['updates', 'messages'] yields (mode, data) tuples")
    for index, (mode, data) in enumerate(agent().stream(ASK, stream_mode=["updates", "messages"])):
        summary = {"mode": mode, "nodes": sorted(data)} if mode == "updates" else {"mode": mode, "chunk": message(data[0])["content"], "node": data[1]["langgraph_node"]}
        cap.json(summary, f"chunk {index}")


def stream_tasks(cap):
    for mode in ("tasks", "custom", "debug"):
        cap.section(f"stream_mode={mode!r}")
        chunks = list(agent().stream(ASK, stream_mode=mode))
        cap.text(f"{len(chunks)} chunks")
        for index, chunk in enumerate(chunks[:4]):
            cap.json(short(chunk), f"chunk {index}")


def stream_v2(cap):
    cap.section("version='v2' with stream_mode=['updates', 'messages']")
    for index, part in enumerate(agent().stream(ASK, stream_mode=["updates", "messages"], version="v2")):
        cap.json({"type": part["type"], "ns": part["ns"], "data": short(part["data"]), "keys": sorted(part)}, f"part {index}")
    cap.section("version='v2' with a single mode still yields StreamPart dicts")
    for index, part in enumerate(agent().stream(ASK, stream_mode="updates", version="v2")):
        cap.json({"type": part["type"], "ns": part["ns"], "nodes": sorted(part["data"])}, f"part {index}")
    cap.section("invoke(version='v2') returns GraphOutput")
    result = agent().invoke(ASK, version="v2")
    cap.text(f"type {type(result).__name__}", f"interrupts {result.interrupts!r}")
    cap.messages(result.value["messages"], "value['messages']")
    cap.section("dict access on GraphOutput")
    with cap.warnings():
        cap.text(f"result['messages'] has {len(result['messages'])} messages")


def stream_v3(cap):
    cap.section("stream_events(version='v3') returns a GraphRunStream")
    with cap.warnings():
        run = agent().stream_events(ASK, version="v3")
    cap.json(sorted(a for a in dir(run) if not a.startswith("_")), f"public members of {type(run).__name__}")
    events = []
    with cap.warnings():
        for event in run:
            events.append(event)
    cap.text(f"{len(events)} events")
    cap.json([f"{e['seq']} {e['method']} " + (e["params"]["data"][0].get("event", "") if e["method"] == "messages" else (e["params"]["data"].get("event", "") if isinstance(e["params"].get("data"), dict) else "")) for e in events], "seq, method, and event name")
    cap.sidecar("events.json", events)
    cap.section("run.output after the stream ends")
    output = run.output
    cap.messages(output["messages"] if isinstance(output, dict) else [], "output['messages']")
    cap.section("stream_mode is rejected under v3")
    cap.attempt("stream_events(version='v3', stream_mode='updates')", lambda: list(agent().stream_events(ASK, version="v3", stream_mode="updates")))
    cap.section("sync stream_events with version='v2'")
    cap.attempt("list(stream_events(version='v2'))", lambda: list(agent().stream_events(ASK, version="v2")))


@tool
def slow_sum(a: int, b: int, runtime: ToolRuntime) -> int:
    """Add two integers and report progress."""
    runtime.emit_output_delta({"partial": a})
    runtime.emit_output_delta({"partial": a + b})
    return a + b


def slow_sum_agent():
    return create_agent(model(call("slow_sum", {"a": 2, "b": 3}), AIMessage("The sum is 5.")), tools=[slow_sum])


def stream_tools(cap):
    cap.section("stream_mode='tools': tool lifecycle events and output deltas")
    for index, chunk in enumerate(slow_sum_agent().stream(ASK, stream_mode="tools")):
        cap.json(chunk, f"chunk {index}")
    cap.section("'tools' with 'updates', version='v2'")
    for index, part in enumerate(slow_sum_agent().stream(ASK, stream_mode=["tools", "updates"], version="v2")):
        data = part["data"] if part["type"] == "tools" else sorted(part["data"])
        cap.json({"type": part["type"], "data": data}, f"part {index}")
    cap.section("emit_output_delta outside the tools mode is a no-op")
    cap.json([sorted(c) for c in slow_sum_agent().stream(ASK, stream_mode="updates")], "updates chunks")


class BindOnlyFake(GenericFakeChatModel):
    def bind_tools(self, tools, *, tool_choice=None, **kwargs):
        return self


def stock_fake(cap):
    cap.section("the stock GenericFakeChatModel cannot bind tools")
    stock = create_agent(GenericFakeChatModel(messages=iter(sum_script())), tools=[add])
    cap.attempt("invoke", lambda: stock.invoke(ASK))
    cap.section("a subclass that only overrides bind_tools works with invoke")
    out = create_agent(BindOnlyFake(messages=iter(sum_script())), tools=[add]).invoke(ASK)
    cap.json([m.type for m in out["messages"]], "message types")
    cap.section("the same subclass with stream_mode='messages', empty content and a tool call")
    cap.attempt("stream", lambda: list(create_agent(BindOnlyFake(messages=iter(sum_script())), tools=[add]).stream(ASK, stream_mode="messages")))
    cap.section("the same subclass with stream_mode='messages', text and a tool call: the tool call is lost")
    script = [call("add", {"a": 2, "b": 3}, content="Let me add."), AIMessage("The sum is 5.")]
    chunks = list(create_agent(BindOnlyFake(messages=iter(script)), tools=[add]).stream(ASK, stream_mode="messages"))
    cap.json([short(c) for c in chunks])
    cap.section("this kit's ScriptedChatModel with the same script")
    chunks = list(create_agent(model(*script, stream_delimiter=r"(\s)"), tools=[add]).stream(ASK, stream_mode="messages"))
    cap.json([short(c) for c in chunks])


SCENARIOS = [
    ("stream-updates-values", "Streaming v1: updates, values, and the default mode", stream_updates),
    ("stream-messages", "Streaming v1: messages mode and several modes at once", stream_messages),
    ("stream-tasks-custom-debug", "Streaming v1: tasks, custom, and debug", stream_tasks),
    ("stream-v2", "Streaming v2: StreamPart dicts and GraphOutput", stream_v2),
    ("stream-events-v3", "stream_events v3", stream_v3),
    ("stream-tools-mode", "The tools stream mode", stream_tools),
    ("stream-stock-fakes", "Why the stock fakes fail under streaming", stock_fake),
]
