import os
import platform
from importlib import metadata
from typing import Annotated

from langchain.agents import create_agent
from langchain.agents.middleware import ToolErrorMiddleware
from langchain.chat_models import init_chat_model
from langchain.messages import AIMessage, AIMessageChunk, HumanMessage, SystemMessage, ToolMessage, trim_messages
from langchain.tools import tool
from langchain_core.messages import convert_to_messages
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import Field

from common import ASK, add, ask, flaky_disk, llm, lookup_order, show_log

OFFLINE_KEY = "offline-placeholder-not-a-key"


@tool
def set_volume(level: Annotated[int, Field(ge=0, le=10)]) -> str:
    """Set the speaker volume, from 0 to 10."""
    return f"volume {level}"


@tool
def subtract(a: int, b: int) -> int:
    """Subtract b from a."""
    return a - b


def versions(cap):
    cap.text(f"python {'.'.join(platform.python_version_tuple()[:2])}")
    with open(os.path.join(os.path.dirname(os.path.realpath(__file__)), "requirements.txt"), encoding="utf-8") as handle:
        names = [line.split("==")[0].strip() for line in handle if "==" in line]
    cap.text(*[f"{name}=={metadata.version(name)}" for name in names])


def init_models(cap):
    cap.section("init_chat_model with a provider prefix")
    for spec in ["openai:gpt-4.1", "anthropic:claude-sonnet-4-6", "ollama:qwen3:4b"]:
        kwargs = {} if spec.startswith("ollama") else {"api_key": OFFLINE_KEY}
        m = init_chat_model(spec, **kwargs)
        cap.text(f"{spec} -> {type(m).__module__}.{type(m).__name__}")
        cap.json(m.profile, f"{spec} profile")
    cap.section("provider inferred from a bare model name")
    for name in ["gpt-4.1-mini", "claude-haiku-4-5", "o3"]:
        m = init_chat_model(name, api_key=OFFLINE_KEY)
        cap.text(f"{name} -> {type(m).__name__}, model={getattr(m, 'model_name', None) or getattr(m, 'model', None)}")
    cap.section("a name with no known provider")
    cap.attempt("init_chat_model('qwen3:4b')", lambda: init_chat_model("qwen3:4b"))
    cap.section("a configurable model")
    m = init_chat_model(configurable_fields=("model", "model_provider"), config_prefix="llm")
    cap.text(f"type {type(m).__name__}")
    bound = m.with_config({"configurable": {"llm_model": "ollama:qwen3:4b"}})
    cap.text(f"with_config llm_model=ollama:qwen3:4b -> {type(bound).__name__}")
    cap.section("the chat model used by this kit")
    m = llm()
    cap.text(f"type {type(m).__module__}.{type(m).__name__}, _llm_type={m._llm_type}, profile={m.profile}")
    cap.json({"model": m.model, "temperature": m.temperature, "seed": m.seed, "num_ctx": m.num_ctx, "reasoning": m.reasoning}, "settings")


def messages(cap):
    cap.section("message objects and their dict form")
    convo = [
        SystemMessage("You are terse."),
        HumanMessage("What is 2 + 3?"),
        AIMessage("", tool_calls=[{"name": "add", "args": {"a": 2, "b": 3}, "id": "call_1"}]),
        ToolMessage("5", tool_call_id="call_1", name="add"),
        AIMessage("The sum is 5.", usage_metadata={"input_tokens": 12, "output_tokens": 6, "total_tokens": 18}),
    ]
    cap.messages(convo)
    cap.section("dicts and tuples coerced by convert_to_messages")
    cap.messages(convert_to_messages([{"role": "user", "content": "hi"}, ("assistant", "hello"), {"role": "system", "content": "be brief"}]))
    cap.section("content_blocks on a string message")
    cap.json(convo[4].content_blocks)
    cap.section("content_blocks on an AI message with tool calls")
    cap.json(convo[2].content_blocks)
    cap.section("multimodal human message with standard blocks")
    multi = HumanMessage(content_blocks=[
        {"type": "text", "text": "Describe this image."},
        {"type": "image", "url": "https://example.com/cat.png"},
        {"type": "file", "base64": "JVBERi0=", "mime_type": "application/pdf"},
    ])
    cap.messages([multi])
    cap.json(multi.content_blocks, "content_blocks")
    cap.section("provider-shaped content parsed into standard blocks")
    anthropic_like = AIMessage(content=[
        {"type": "thinking", "thinking": "Add the numbers.", "signature": "sig"},
        {"type": "text", "text": "The sum is 5."},
    ], response_metadata={"model_provider": "anthropic"})
    cap.json(anthropic_like.content_blocks)
    cap.text(f".text -> {anthropic_like.text!r}")
    cap.section("chunks add up")
    total = AIMessageChunk(content="The ", id="run-1") + AIMessageChunk(content="sum ", id="run-1") + AIMessageChunk(content="is 5.", id="run-1", chunk_position="last")
    cap.messages([total])
    cap.section("tool call chunks merge into a tool call")
    merged = AIMessageChunk(content="", tool_call_chunks=[{"name": "add", "args": '{"a": 2,', "id": "call_1", "index": 0}]) + AIMessageChunk(content="", tool_call_chunks=[{"name": None, "args": ' "b": 3}', "id": None, "index": 0}])
    cap.json({"tool_call_chunks": merged.tool_call_chunks, "tool_calls": merged.tool_calls})
    cap.section("trim_messages keeps the last turns that fit")
    cap.messages(trim_messages(convo, max_tokens=3, token_counter=len, strategy="last", include_system=True), "max_tokens=3, token_counter=len")
    cap.messages(trim_messages(convo, max_tokens=3, token_counter=len, strategy="last", include_system=True, start_on="human"), "the same with start_on='human'")


def tools(cap):
    cap.section("schema the model sees for @tool add")
    cap.text(f"name={add.name} description={add.description!r}")
    cap.json(add.tool_call_schema.model_json_schema())
    cap.section("lookup_order: the ToolRuntime parameter is hidden from the model")
    cap.json(sorted(lookup_order.args), "lookup_order.args")
    cap.json(lookup_order.tool_call_schema.model_json_schema(), "tool_call_schema")
    cap.section("invoke a tool with a ToolCall dict")
    cap.messages([add.invoke({"name": "add", "args": {"a": 2, "b": 3}, "id": "call_9", "type": "tool_call"})])
    cap.section("invoke a ToolRuntime tool outside an agent")
    cap.attempt("lookup_order.invoke({'order_id': 'A-17'})", lambda: lookup_order.invoke({"order_id": "A-17"}))


def tool_runtime_agent(cap):
    cap.section("ToolRuntime inside create_agent, with context and the custom stream")
    agent = create_agent(llm("tools"), tools=[lookup_order])
    for mode, chunk in agent.stream(ask("Where is order A-17?"), context={"user": "ada"}, stream_mode=["custom", "updates"]):
        if mode == "custom":
            cap.json(chunk, "custom")
        else:
            for node, update in chunk.items():
                cap.messages(update["messages"], f"updates {node}")


def tool_errors(cap):
    cap.section("a tool raises, no middleware: the run raises")
    agent = create_agent(llm("raises"), tools=[flaky_disk])
    cap.attempt("invoke", lambda: agent.invoke(ask("Read /etc/motd with the flaky_disk tool.")))
    cap.section("the model sends bad arguments: ToolNode returns an error ToolMessage and the loop continues")
    out = create_agent(llm("bad-args"), tools=[add]).invoke(ask("What is 2.5 + 3? Use the add tool."))
    cap.messages(out["messages"])
    cap.section("a tool argument outside the schema: the model asks for volume 11 on a 0 to 10 tool")
    out = create_agent(llm("bad-range"), tools=[set_volume]).invoke(ask("Set the volume to 11."))
    cap.messages(out["messages"])
    cap.section("a tool raises, ToolErrorMiddleware turns it into a ToolMessage")
    handler = ToolErrorMiddleware(on_error=lambda exc, request: f"{type(exc).__name__} in {request.tool_call['name']}: {exc}")
    out = create_agent(llm("handled"), tools=[flaky_disk], middleware=[handler]).invoke(ask("Read /etc/motd with the flaky_disk tool."))
    cap.messages(out["messages"])
    cap.section("ToolErrorMiddleware with no handler")
    cap.attempt("ToolErrorMiddleware()", lambda: ToolErrorMiddleware())
    cap.section("an unknown tool name from the model")
    m = llm("unknown-tool")
    prompt = "Besides add, you have a tool named subtract that takes a and b. Use subtract for every subtraction."
    out = create_agent(m, tools=[add], system_prompt=prompt).invoke(ask("What is 5 - 3? Use the subtract tool."))
    cap.messages(out["messages"][1:])
    show_log(cap, m)
    cap.section("a tool removed between two deploys: the saved call names a tool the new agent lacks")
    saver = InMemorySaver()
    cfg = {"configurable": {"thread_id": "removed-tool"}}
    old = create_agent(llm("old-deploy"), tools=[add, subtract], checkpointer=saver, interrupt_before=["tools"])
    old.invoke(ask("What is 5 - 3? Use the subtract tool."), cfg)
    cap.json(list(old.get_state(cfg).next), "the old agent paused before")
    new = create_agent(llm("new-deploy"), tools=[add], checkpointer=saver)
    out = new.invoke(None, cfg)
    cap.messages(out["messages"][1:])


def agent_graph(cap):
    agent = create_agent(llm(), tools=[add], system_prompt="You add numbers.")
    graph = agent.get_graph()
    cap.section("nodes")
    cap.json(list(graph.nodes))
    cap.section("edges")
    cap.json([f"{e.source} -> {e.target}" + (" (conditional)" if e.conditional else "") for e in graph.edges])
    cap.section("mermaid")
    cap.text(graph.draw_mermaid())
    cap.section("config and defaults on the compiled graph")
    cap.json(agent.config, "agent.config")
    cap.text(f"agent.stream_mode = {agent.stream_mode!r}", f"type {type(agent).__module__}.{type(agent).__name__}")
    cap.section("a graph with no tools")
    cap.json(list(create_agent(llm()).get_graph().nodes))


def agent_run(cap):
    m = llm()
    agent = create_agent(m, tools=[add], system_prompt="You add numbers.")
    out = agent.invoke(ASK)
    cap.section("final state")
    cap.json(sorted(out), "keys")
    cap.messages(out["messages"])
    cap.section("what the model received on each call")
    show_log(cap, m)


SCENARIOS = [
    ("versions", "Package versions at the pin", versions, False),
    ("init-chat-model", "init_chat_model and model profiles", init_models, False),
    ("messages", "Messages and content blocks", messages, False),
    ("tools", "Tools, schemas, and ToolRuntime", tools, False),
    ("tool-errors", "A tool that raises, bad arguments, and ToolErrorMiddleware", tool_errors, True),
    ("agent-graph", "The graph create_agent builds", agent_graph, False),
    ("agent-run", "One full create_agent run", agent_run, True),
]

LATE = [
    ("tool-runtime-agent", "ToolRuntime inside create_agent", tool_runtime_agent, True),
]
