import hashlib
import json
import os
import signal
import sqlite3
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware, SummarizationMiddleware
from langchain.tools import ToolRuntime, tool
from langchain_ollama import ChatOllama
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.store.sqlite import SqliteStore
from langgraph.types import Command

MODEL = os.environ.get("MODEL", "qwen3:4b-instruct-2507-q4_K_M")
WORK = Path(os.environ.get("WORK", "work"))
USER = "reader-1"
RUN = {"durability": os.environ["DURABILITY"]} if os.environ.get("DURABILITY") else {}


@dataclass
class Context:
    user: str


def outbox():
    conn = sqlite3.connect(WORK / "outbox.sqlite")
    conn.execute("CREATE TABLE IF NOT EXISTS sent (idempotency_key TEXT PRIMARY KEY, recipient TEXT, subject TEXT, body TEXT)")
    conn.execute("CREATE TABLE IF NOT EXISTS attempts (n INTEGER PRIMARY KEY AUTOINCREMENT, idempotency_key TEXT, pid INTEGER, outcome TEXT)")
    return conn


@tool
def remember(fact: str, runtime: ToolRuntime[Context]) -> str:
    """Save one fact about the user for later conversations."""
    key = hashlib.sha256(fact.encode()).hexdigest()[:12]
    runtime.store.put(("users", runtime.context.user, "memories"), key, {"text": fact})
    return f"saved memory {key}"


@tool
def recall(runtime: ToolRuntime[Context]) -> str:
    """Return every saved fact about the user."""
    items = runtime.store.search(("users", runtime.context.user, "memories"))
    return "\n".join(f"- {item.value['text']}" for item in items) or "no saved facts"


@tool
def send_email(to: str, subject: str, body: str, runtime: ToolRuntime[Context]) -> str:
    """Send an email. A person approves each email before it is sent."""
    key = runtime.tool_call_id
    conn = outbox()
    cur = conn.execute("INSERT OR IGNORE INTO sent VALUES (?, ?, ?, ?)", (key, to, subject, body))
    outcome = "sent" if cur.rowcount == 1 else "skipped, key already sent"
    conn.execute("INSERT INTO attempts (idempotency_key, pid, outcome) VALUES (?, ?, ?)", (key, os.getpid(), outcome))
    conn.commit()
    conn.close()
    print(f"  tool       send_email ran in this process: {outcome} (key {key})", flush=True)
    if os.environ.get("CRASH_AFTER_SEND") == "1":
        print("  crash      SIGKILL after the email and before the checkpoint of the tools step", flush=True)
        os.kill(os.getpid(), signal.SIGKILL)
    return f"email {outcome}: to {to}, subject {subject!r}"


SYSTEM_PROMPT = """You are a personal assistant for one user.

Rules:
- When the user tells you a lasting fact or preference, save it with remember.
- Before you write to someone on the user's behalf, call recall to find their address and preferences.
- Send email only with send_email. A person approves each email before it is sent.
- Keep replies to one or two sentences.
"""


def model():
    return ChatOllama(model=MODEL, temperature=0, seed=42, reasoning=False, num_ctx=16384, num_predict=512)


def build(saver, store):
    return create_agent(
        model(),
        tools=[remember, recall, send_email],
        system_prompt=SYSTEM_PROMPT,
        middleware=[
            SummarizationMiddleware(model(), trigger=("messages", 10), keep=("messages", 4)),
            HumanInTheLoopMiddleware(interrupt_on={"send_email": {"allowed_decisions": ["approve", "reject"]}}, interrupt_mode="per_call"),
        ],
        checkpointer=saver,
        store=store,
        context_schema=Context,
    )


def short(text, n=220):
    text = " ".join(str(text).split())
    return text if len(text) <= n else text[: n - 2] + " …"


def report(agent, saver, store, cfg, step, started, rows):
    snap = agent.get_state(cfg)
    messages = snap.values.get("messages", [])
    conn = outbox()
    sent = conn.execute("SELECT COUNT(*) FROM sent").fetchone()[0]
    attempts = conn.execute("SELECT idempotency_key, pid, outcome FROM attempts ORDER BY n").fetchall()
    conn.close()
    checkpoints = len(list(saver.list(cfg)))
    memories = [item.value["text"] for item in store.search(("users", USER, "memories"))]
    summary = [m for m in messages if m.type == "human" and m.additional_kwargs.get("lc_source") == "summarization"]
    pending = [{"id": i.id, "tool_call_id": i.value.get("tool_call_id"), "name": i.value.get("name"), "args": i.value.get("args")} for i in snap.interrupts]
    print(f"  state      next {list(snap.next)}, {len(messages)} messages, {checkpoints} checkpoints, {len(pending)} pending interrupts")
    if summary:
        print(f"  summary    {short(summary[0].content, 300)}")
    print(f"  store      {len(memories)} memories for {USER}")
    print(f"  outbox     {sent} sent, {len(attempts)} attempts of send_email")
    row = {"step": step, "pid": os.getpid(), "thread": cfg["configurable"]["thread_id"], "seconds": round(time.perf_counter() - started, 2), "next": list(snap.next), "messages": [[m.type, short(m.content, 300), [tc["name"] for tc in getattr(m, "tool_calls", [])], getattr(m, "tool_call_id", None)] for m in messages], "checkpoints": checkpoints, "pending": pending, "memories": memories, "sent": sent, "attempts": [list(a) for a in attempts], "summaries": len(summary)}
    rows.write(json.dumps(row) + "\n")


def show_new(messages, seen):
    for m in [m for m in messages if m.id not in seen]:
        if m.type == "ai":
            for tc in m.tool_calls:
                print(f"  call       {tc['name']}({short(json.dumps(tc['args']), 160)})")
            if m.content:
                print(f"  answer     {short(m.content, 300)}")
        elif m.type == "tool":
            print(f"  result     {short(m.content, 160)}")


def main():
    step, thread, action = sys.argv[1], sys.argv[2], sys.argv[3]
    arg = sys.argv[4] if len(sys.argv) > 4 else None
    WORK.mkdir(exist_ok=True)
    cfg = {"configurable": {"thread_id": thread}, "recursion_limit": 20}
    ctx = Context(user=USER)
    print(f"\n== {step}: process {os.getpid()}, thread {thread}, durability {RUN.get('durability', 'default')}, {action}{': ' + arg if arg and action == 'say' else ''}", flush=True)
    started = time.perf_counter()
    with SqliteSaver.from_conn_string(str(WORK / "checkpoints.sqlite")) as saver, SqliteStore.from_conn_string(str(WORK / "memory.sqlite")) as store:
        store.setup()
        agent = build(saver, store)
        before = {m.id for m in agent.get_state(cfg).values.get("messages", [])}
        if action == "say":
            result = agent.invoke({"messages": [{"role": "user", "content": arg}]}, cfg, context=ctx, version="v2", **RUN)
        elif action == "approve":
            pending = agent.get_state(cfg).interrupts
            for item in pending:
                print(f"  reviewer   approve {item.value['name']}({short(json.dumps(item.value['args']), 160)})", flush=True)
            result = agent.invoke(Command(resume={item.id: {"type": "approve"} for item in pending}), cfg, context=ctx, version="v2", **RUN)
        else:
            print(f"  resume     invoke(None) on the thread, next was {list(agent.get_state(cfg).next)}", flush=True)
            result = agent.invoke(None, cfg, context=ctx, version="v2", **RUN)
        messages = agent.get_state(cfg).values.get("messages", [])
        show_new(messages, before)
        for item in result.interrupts:
            print(f"  interrupt  {item.value['name']}({short(json.dumps(item.value['args']), 160)}), tool_call_id {item.value['tool_call_id']}")
        with open(os.environ.get("ROWS", "run.jsonl"), "a") as rows:
            report(agent, saver, store, cfg, step, started, rows)


if __name__ == "__main__":
    main()
