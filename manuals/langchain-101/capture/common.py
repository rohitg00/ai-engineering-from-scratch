from langchain.tools import ToolRuntime, tool
from langchain_core.messages import AIMessage

from fake import ScriptedChatModel, call

ASK = {"messages": [{"role": "user", "content": "What is 2 + 3?"}]}


def ask(text):
    return {"messages": [{"role": "user", "content": text}]}


def thread(name):
    return {"configurable": {"thread_id": name}}


@tool
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


@tool
def lookup_order(order_id: str, runtime: ToolRuntime) -> str:
    """Look up an order by its id."""
    runtime.stream_writer({"lookup": order_id})
    context = runtime.context
    user = context.get("user", "anonymous") if isinstance(context, dict) else getattr(context, "user", "anonymous")
    return f"order {order_id}: shipped (asked by {user}, tool_call_id={runtime.tool_call_id})"


@tool
def flaky_disk(path: str) -> str:
    """Read a file from a disk that always fails."""
    raise RuntimeError("disk on fire")


def model(*script, label="scripted", **kwargs):
    return ScriptedChatModel(script=list(script), label=label, **kwargs)


def sum_script():
    return [call("add", {"a": 2, "b": 3}), AIMessage(content="The sum is 5.")]


def show_log(cap, *models):
    rows = []
    for m in models:
        rows.extend(m.log)
    cap.json(rows, "model calls seen by the fake")
