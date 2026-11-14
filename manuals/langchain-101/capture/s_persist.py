import os
import sqlite3
import tempfile
import warnings
from typing import Annotated, TypedDict

from langchain.agents import create_agent
from langchain.tools import ToolRuntime, tool
from langchain_core.embeddings import DeterministicFakeEmbedding
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.store.memory import InMemoryStore
from langgraph.types import Command, interrupt
from pydantic import BaseModel

from common import add, ask, model, sum_script, thread
from fake import call


def transcript(messages):
    return [f"{m.type}: {m.text}" for m in messages]


def snapshot(s):
    return {
        "step": s.metadata.get("step"),
        "source": s.metadata.get("source"),
        "next": list(s.next),
        "checkpoint_id": s.config["configurable"]["checkpoint_id"],
        "parent_checkpoint_id": (s.parent_config or {}).get("configurable", {}).get("checkpoint_id"),
        "messages": transcript(s.values.get("messages", [])),
        "tasks": [t.name for t in s.tasks],
    }


def two_turns(cap, checkpointer, name):
    fake = model(*sum_script(), AIMessage("You asked me to add 2 and 3."), label=name)
    agent = create_agent(fake, tools=[add], checkpointer=checkpointer)
    cfg = thread(name)
    agent.invoke(ask("What is 2 + 3?"), cfg)
    out = agent.invoke(ask("What did I ask you?"), cfg)
    cap.json(transcript(out["messages"]), "messages after turn 2")
    cap.json(fake.log[-1]["messages"], "what the model received on turn 2")
    return agent, cfg


def memory_saver(cap):
    cap.section("InMemorySaver: two turns on one thread")
    saver = InMemorySaver()
    agent, cfg = two_turns(cap, saver, "memory-thread")
    cap.section("get_state")
    cap.json(snapshot(agent.get_state(cfg)))
    cap.section("the raw checkpoint tuple")
    latest = saver.get_tuple(cfg)
    cap.json({"config": latest.config, "metadata": latest.metadata, "checkpoint keys": sorted(latest.checkpoint), "channel_values keys": sorted(latest.checkpoint["channel_values"]), "channel_versions": latest.checkpoint["channel_versions"], "v": latest.checkpoint["v"]})
    cap.section("checkpoints on the thread")
    cap.text(f"{len(list(saver.list(cfg)))} checkpoints")
    cap.section("another thread starts empty")
    out = create_agent(model(AIMessage("I have no history.")), checkpointer=saver).invoke(ask("What did I ask you?"), thread("other-thread"))
    cap.json(transcript(out["messages"]))
    cap.section("delete_thread")
    saver.delete_thread("memory-thread")
    cap.text(f"after delete: {len(list(saver.list(cfg)))} checkpoints")
    cap.section("a thread_id is required once a checkpointer is set")
    cap.attempt("invoke without config", lambda: create_agent(model("hi"), checkpointer=InMemorySaver()).invoke(ask("hi")))


def sqlite_saver(cap):
    root = tempfile.mkdtemp(prefix="m101-")
    path = os.path.join(root, "checkpoints.db")
    cap.section("SqliteSaver: two turns, then close the connection")
    with SqliteSaver.from_conn_string(path) as saver:
        two_turns(cap, saver, "sqlite-thread")
    cap.section("a new process opens the same file and continues the thread")
    with SqliteSaver.from_conn_string(path) as saver:
        fake = model(AIMessage("Earlier you asked what 2 + 3 is."), label="after-restart")
        agent = create_agent(fake, tools=[add], checkpointer=saver)
        out = agent.invoke(ask("Remind me again."), thread("sqlite-thread"))
        cap.json(transcript(out["messages"]))
    cap.section("what is in the file")
    conn = sqlite3.connect(path)
    tables = [r[0] for r in conn.execute("select name from sqlite_master where type='table' order by name")]
    for table in tables:
        columns = [r[1] for r in conn.execute(f"pragma table_info({table})")]
        count = conn.execute(f"select count(*) from {table}").fetchone()[0]
        cap.text(f"{table}: {count} rows, columns {columns}")
    rows = conn.execute("select thread_id, checkpoint_ns, type, json_extract(metadata, '$.step'), json_extract(metadata, '$.source') from checkpoints order by rowid").fetchall()
    cap.json([list(r) for r in rows], "checkpoints rows: thread_id, checkpoint_ns, type, step, source")
    conn.close()
    cap.text(f"database file: {path}")


def history(cap):
    saver = InMemorySaver()
    calls_made = []

    @tool
    def charge(amount: int) -> str:
        """Charge a card."""
        calls_made.append(amount)
        return f"charged {amount}"

    script = [call("charge", {"amount": 10}), AIMessage("Charged 10."), AIMessage("Charged again after replay."), call("charge", {"amount": 99}), AIMessage("Charged 99 on the fork.")]
    fake = model(*script, label="history")
    agent = create_agent(fake, tools=[charge], checkpointer=saver)
    cfg = thread("history")
    agent.invoke(ask("Charge 10."), cfg)
    cap.section("get_state_history, newest first")
    states = list(agent.get_state_history(cfg))
    for s in states:
        cap.json(snapshot(s))
    before_tools = next(s for s in states if s.next == ("tools",))
    cap.section("replay from the checkpoint before 'tools': invoke(None, that config)")
    replay = agent.invoke(None, before_tools.config)
    cap.json(transcript(replay["messages"]), "messages")
    cap.json(calls_made, "charge calls so far (the tool ran again on replay)")
    cap.text(f"checkpoints on the thread now: {len(list(agent.get_state_history(cfg)))}")
    cap.section("update_state forks from the first model checkpoint")
    first_model = next(s for s in reversed(states) if s.next == ("model",))
    forked = agent.update_state(first_model.config, {"messages": [{"role": "user", "content": "Actually, charge 99."}]})
    cap.json(snapshot(agent.get_state(forked)), "the fork")
    out = agent.invoke(None, forked)
    cap.json(transcript(out["messages"]), "after running the fork")
    cap.json(calls_made, "charge calls")
    cap.section("update_state as_node='tools' writes a tool result without running the tool")
    fake = model(call("charge", {"amount": 5}), AIMessage("Done, per the manual entry."), label="as-node")
    agent = create_agent(fake, tools=[charge], checkpointer=InMemorySaver(), interrupt_before=["tools"])
    cfg = thread("as-node")
    agent.invoke(ask("Charge 5."), cfg)
    cap.json(list(agent.get_state(cfg).next), "paused before")
    pending = agent.get_state(cfg).values["messages"][-1].tool_calls[0]["id"]
    agent.update_state(cfg, {"messages": [{"role": "tool", "content": "charged 5 by hand", "tool_call_id": pending}]}, as_node="tools")
    out = agent.invoke(None, cfg)
    cap.json(transcript(out["messages"]))
    cap.json(calls_made, "charge calls (unchanged)")


class Counter(TypedDict):
    n: int


def counter_graph(checkpointer=None):
    def inc(state):
        return {"n": state["n"] + 1}

    graph = StateGraph(Counter)
    graph.add_node("inc", inc)
    graph.add_node("inc_again", inc)
    graph.add_edge(START, "inc")
    graph.add_edge("inc", "inc_again")
    graph.add_edge("inc_again", END)
    return graph.compile(checkpointer=checkpointer)


def durability(cap):
    cap.section("each durability mode with InMemorySaver: how many checkpoints are saved")
    for mode in ("sync", "async", "exit"):
        saver = InMemorySaver()
        g = counter_graph(saver)
        out = g.invoke({"n": 0}, thread(mode), durability=mode)
        saved = list(saver.list(thread(mode)))
        cap.text(f"durability={mode}: result {out}, {len(saved)} checkpoints, steps {[c.metadata['step'] for c in saved]}")
    cap.section("no checkpointer: every mode warns; 'sync' raises (langgraph issue #9267)")
    for mode in ("async", "exit", "sync"):
        for api in ("invoke", "stream"):
            with warnings.catch_warnings(record=True) as seen:
                warnings.simplefilter("always")
                try:
                    result = counter_graph().invoke({"n": 0}, durability=mode) if api == "invoke" else list(counter_graph().stream({"n": 0}, durability=mode))
                    outcome = f"ok {result}"
                except Exception as exc:
                    outcome = f"raised {type(exc).__name__}: {exc}"
            notes = sorted({str(w.message) for w in seen})
            cap.text(f"durability={mode} {api}: {outcome}", *[f"  warning: {n}" for n in notes])
    cap.section("checkpoint_during is deprecated")
    with cap.warnings():
        counter_graph(InMemorySaver()).invoke({"n": 0}, thread("legacy"), checkpoint_during=False)


class Review(TypedDict):
    draft: str
    verdict: str
    edits: Annotated[list, lambda a, b: a + b]


def blank_review():
    return {"draft": "", "verdict": "", "edits": []}


class Verdict(BaseModel):
    approve: bool
    note: str = ""


def interrupts(cap):
    runs = []

    def write(state):
        runs.append("write")
        return {"draft": "Ship v2 on Friday."}

    def review(state):
        runs.append("review before interrupt")
        answer = interrupt({"question": "Approve this draft?", "draft": state["draft"]})
        runs.append(f"review after interrupt: {answer}")
        return {"verdict": "approved" if answer == "yes" else f"rejected: {answer}"}

    graph = StateGraph(Review)
    graph.add_node("write", write)
    graph.add_node("review", review)
    graph.add_edge(START, "write")
    graph.add_edge("write", "review")
    graph.add_edge("review", END)
    app = graph.compile(checkpointer=InMemorySaver())
    cfg = thread("review")
    cap.section("interrupt() pauses the run")
    result = app.invoke(blank_review(), cfg, version="v2")
    cap.json(result.interrupts, "interrupts")
    state = app.get_state(cfg)
    cap.json({"next": list(state.next), "task interrupts": [list(t.interrupts) for t in state.tasks]}, "state")
    cap.section("Command(resume='yes') re-runs the node from the top")
    result = app.invoke(Command(resume="yes"), cfg, version="v2")
    cap.json(result.value, "value")
    cap.json(runs, "node runs")
    cap.section("two interrupts in one node, resumed one at a time")

    def two_questions(state):
        first = interrupt("Title?")
        second = interrupt("Body?")
        return {"draft": f"{first}: {second}"}

    g2 = StateGraph(Review)
    g2.add_node("ask", two_questions)
    g2.add_edge(START, "ask")
    app2 = g2.compile(checkpointer=InMemorySaver())
    cfg2 = thread("two")
    r1 = app2.invoke(blank_review(), cfg2, version="v2")
    r2 = app2.invoke(Command(resume="Release"), cfg2, version="v2")
    r3 = app2.invoke(Command(resume="Friday"), cfg2, version="v2")
    cap.json({"first": r1.interrupts, "second": r2.interrupts, "ids differ": r1.interrupts[0].id != r2.interrupts[0].id, "final": r3.value}, "runs")
    cap.section("interrupt with a response_schema rejects a bad answer")

    def typed(state):
        answer = interrupt("Approve?", response_schema=Verdict)
        return {"verdict": f"approve={answer.approve if hasattr(answer, 'approve') else answer['approve']}"}

    g3 = StateGraph(Review)
    g3.add_node("typed", typed)
    g3.add_edge(START, "typed")
    app3 = g3.compile(checkpointer=InMemorySaver())
    cfg3 = thread("typed")
    r = app3.invoke(blank_review(), cfg3, version="v2")
    cap.json(r.interrupts, "interrupt")
    cap.attempt("resume with {'approve': 'maybe'}", lambda: app3.invoke(Command(resume={"approve": "maybe"}), cfg3))
    cap.json(list(app3.get_state(cfg3).next), "still waiting on")
    cap.json(app3.invoke(Command(resume={"approve": True}), cfg3), "resume with {'approve': True}")
    cap.section("interrupt without a checkpointer")
    result = cap.attempt("invoke", lambda: g2.compile().invoke(blank_review(), version="v2"))
    if result is not None:
        cap.json({"value": result.value, "interrupts": result.interrupts}, "returned")
    cap.section("resume a thread that is not waiting")
    result = cap.attempt("Command(resume='x') on a finished thread", lambda: app.invoke(Command(resume="x"), cfg, version="v2"))
    if result is not None:
        cap.json({"value": result.value, "interrupts": result.interrupts}, "returned")
    cap.json(runs, "node runs (unchanged)")


def store(cap):
    st = InMemoryStore()
    cap.section("put, get, and namespaces")
    st.put(("users", "ada", "memories"), "m1", {"text": "prefers short answers"})
    st.put(("users", "ada", "memories"), "m2", {"text": "works in Pune"})
    st.put(("users", "grace", "memories"), "m1", {"text": "prefers long answers"})
    st.put(("users", "ada", "settings"), "theme", {"value": "dark"})
    cap.json(st.get(("users", "ada", "memories"), "m1"), "get")
    cap.json(st.list_namespaces(), "list_namespaces()")
    cap.json(st.list_namespaces(prefix=("users", "ada")), "list_namespaces(prefix=('users', 'ada'))")
    cap.json(st.list_namespaces(max_depth=2), "list_namespaces(max_depth=2)")
    cap.section("search is a prefix match on the namespace")
    cap.json([(i.namespace, i.key, i.value) for i in st.search(("users", "ada"))], "search(('users', 'ada'))")
    cap.json([(i.namespace, i.key, i.value) for i in st.search(("users",), filter={"text": "prefers long answers"})], "search(('users',), filter=...)")
    cap.section("delete")
    st.delete(("users", "ada", "memories"), "m2")
    cap.json(st.get(("users", "ada", "memories"), "m2"), "get after delete")
    cap.section("semantic search with an index and DeterministicFakeEmbedding")
    indexed = InMemoryStore(index={"embed": DeterministicFakeEmbedding(size=8), "dims": 8, "fields": ["text"]})
    for key, text in (("a", "prefers short answers"), ("b", "works in Pune"), ("c", "likes tea")):
        indexed.put(("ada",), key, {"text": text})
    hits = indexed.search(("ada",), query="works in Pune", limit=2)
    cap.json([{"key": h.key, "text": h.value["text"], "score": round(h.score, 6)} for h in hits])
    cap.section("a tool reads the store through ToolRuntime, scoped by context")

    @tool
    def recall(runtime: ToolRuntime) -> str:
        """Recall what is known about the current user."""
        user = runtime.context["user"]
        return "; ".join(i.value["text"] for i in runtime.store.search(("users", user, "memories")))

    for user in ("ada", "grace"):
        fake = model(call("recall", {}), AIMessage("Noted."), label=f"recall-{user}")
        out = create_agent(fake, tools=[recall], store=st).invoke(ask("What do you know about me?"), context={"user": user})
        cap.text(f"user {user}: {out['messages'][2].content}")


SCENARIOS = [
    ("checkpoint-memory", "InMemorySaver across turns", memory_saver),
    ("checkpoint-sqlite", "SqliteSaver across turns and a restart", sqlite_saver),
    ("state-history-forks", "State history, replay, and update_state forks", history),
    ("durability", "Durability modes, and sync without a checkpointer", durability),
    ("interrupt-resume", "interrupt() and Command(resume=...)", interrupts),
    ("store", "InMemoryStore: put, search, and namespaces", store),
]
