"""Minimal LangGraph ReAct agent with a checkpointer, an interrupt, and time-travel.

Runs with an Anthropic API key (`ANTHROPIC_API_KEY`). The agent has two toy
tools (calculator, web_lookup). It:

1. Builds a four-node StateGraph (agent -> tools -> agent) with `add_messages`
   as the reducer for the message list.
2. Compiles with a `MemorySaver` checkpointer and an `interrupt_before` on the
   `tools` node so we pause before any side effect.
3. Runs a two-turn conversation, streaming update events.
4. Pauses before the first tool call, inspects the pending tool_calls, then
   resumes with `Command(resume=True)`.
5. Prints the checkpoint history and demonstrates time-travel by forking from
   an earlier checkpoint.

Install:
    pip install "langgraph>=0.2.50" "langchain-anthropic>=0.3.0"

Run:
    python main.py
"""

from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AnyMessage, HumanMessage
from langchain_core.tools import tool
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import Command


# State ----------------------------------------------------------------------


class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]


# Tools ----------------------------------------------------------------------


@tool
def calculator(expression: str) -> str:
    """Evaluate a Python arithmetic expression like '2 + 2 * 3'. Returns the
    result as a string."""
    allowed = set("0123456789+-*/(). ")
    if not set(expression) <= allowed:
        return "ERROR: only digits and + - * / ( ) are allowed"
    try:
        return str(eval(expression, {"__builtins__": {}}, {}))
    except Exception as exc:
        return f"ERROR: {exc!r}"


@tool
def web_lookup(query: str) -> str:
    """Fake web search. Returns canned facts for known queries and 'unknown'
    otherwise. Stand-in for a real retrieval tool."""
    facts = {
        "anthropic headquarters": "Anthropic is headquartered in San Francisco, California.",
        "python release year": "Python was first released in 1991.",
    }
    return facts.get(query.strip().lower(), "unknown")


TOOLS = [calculator, web_lookup]


# Graph ----------------------------------------------------------------------


def build_app() -> tuple:
    """Wire the four-node ReAct graph and return (compiled_app, llm_with_tools)."""
    llm = ChatAnthropic(model="claude-sonnet-4-5", temperature=0).bind_tools(TOOLS)

    def agent_node(state: State) -> dict:
        response = llm.invoke(state["messages"])
        return {"messages": [response]}

    def should_continue(state: State) -> str:
        last = state["messages"][-1]
        return "tools" if getattr(last, "tool_calls", None) else END

    tool_node = ToolNode(TOOLS)

    graph = StateGraph(State)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    app = graph.compile(
        checkpointer=MemorySaver(),
        interrupt_before=["tools"],
    )
    return app, llm


# Driver ---------------------------------------------------------------------


def pretty(msg: AnyMessage) -> str:
    kind = msg.__class__.__name__
    content = msg.content if isinstance(msg.content, str) else str(msg.content)[:200]
    tool_calls = getattr(msg, "tool_calls", None) or []
    tcs = " | ".join(f"{t['name']}({t['args']})" for t in tool_calls)
    return f"[{kind}] {content} {('-> ' + tcs) if tcs else ''}".strip()


def run() -> None:
    app, _llm = build_app()
    config = {"configurable": {"thread_id": "demo-42"}}

    # Turn 1: ask a question that should hit web_lookup.
    user = HumanMessage("Where is Anthropic headquartered?")
    for event in app.stream({"messages": [user]}, config, stream_mode="updates"):
        for node, update in event.items():
            print(f"<<{node}>>")
            for m in update.get("messages", []):
                print("   ", pretty(m))

    # We are now paused at interrupt_before=['tools'].
    pending = app.get_state(config)
    print("\nPAUSED. Pending tool calls:")
    for m in pending.values["messages"][-1:]:
        for tc in getattr(m, "tool_calls", []) or []:
            print(f"  - {tc['name']}({tc['args']})")

    # Approve and resume.
    for event in app.stream(Command(resume=True), config, stream_mode="updates"):
        for node, update in event.items():
            print(f"<<{node}>>")
            for m in update.get("messages", []):
                print("   ", pretty(m))

    # Checkpoint history.
    history = list(app.get_state_history(config))
    print(f"\nCheckpoint history: {len(history)} snapshots")
    for i, snap in enumerate(history):
        last = snap.values["messages"][-1] if snap.values.get("messages") else None
        tag = last.__class__.__name__ if last else "?"
        print(f"  {i:>2}  {tag:<15}  next={snap.next}")

    # Time-travel: fork from the earliest snapshot and ask a different question.
    if len(history) >= 3:
        earliest = history[-1].config
        print("\nTime-travel: forking from earliest checkpoint and asking a math question.")
        fork = {"messages": [HumanMessage("What is 17 * 23?")]}
        for event in app.stream(fork, earliest, stream_mode="updates"):
            for node, update in event.items():
                print(f"<<{node}>>")
                for m in update.get("messages", []):
                    print("   ", pretty(m))
        # Resume past the interrupt for the math tool.
        for event in app.stream(Command(resume=True), earliest, stream_mode="updates"):
            for node, update in event.items():
                print(f"<<{node}>>")
                for m in update.get("messages", []):
                    print("   ", pretty(m))


if __name__ == "__main__":
    run()
