import json
import os
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import warnings
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

warnings.filterwarnings("ignore")

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, HumanInTheLoopMiddleware, ModelCallLimitMiddleware, ModelRetryMiddleware, hook_config
from langchain.agents.structured_output import ToolStrategy
from langchain.tools import ToolRuntime, tool
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.errors import GraphRecursionError
from pydantic import BaseModel

from fake import ScriptedChatModel, call

HERE = Path(__file__).resolve().parent
ROWS = []
ASK = {"messages": [{"role": "user", "content": "Go."}]}


def report(label, text):
    print(f"  {label:<9} {text}", flush=True)


def case(number, title, section):
    def wrap(fn):
        def run():
            print(f"\n== {number} {title} (section {section})", flush=True)
            started = time.perf_counter()
            row = fn()
            seconds = time.perf_counter() - started
            report("time", f"{seconds:.2f} s")
            ROWS.append({"case": number, "title": title, "section": section, "seconds": round(seconds, 2), **row})
        return run
    return wrap


@tool
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


class Stub500(BaseHTTPRequestHandler):
    hits = 0

    def do_POST(self):
        Stub500.hits += 1
        self.rfile.read(int(self.headers.get("content-length", 0)))
        body = json.dumps({"error": {"message": "stub is failing", "type": "server_error"}}).encode()
        self.send_response(500)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def retry_run(port, client_retries):
    from langchain_openai import ChatOpenAI
    Stub500.hits = 0
    kw = {} if client_retries is None else {"max_retries": client_retries}
    llm = ChatOpenAI(model="stub", base_url=f"http://127.0.0.1:{port}/v1", api_key="drill-no-key", **kw)
    agent = create_agent(llm, tools=[add], middleware=[ModelRetryMiddleware()])
    started = time.perf_counter()
    out = agent.invoke(ASK)
    return Stub500.hits, time.perf_counter() - started, out["messages"][-1].content


@case(1, "retry layers stack on one model call", "3.5")
def retries():
    server = ThreadingHTTPServer(("127.0.0.1", 0), Stub500)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]
    try:
        hits, secs, last = retry_run(port, None)
        report("symptom", f"one model call sent {hits} requests to a stub that always returns 500, in {secs:.1f} s")
        report("state", f"the run ended without an exception, last AIMessage: {last[:90]}")
        report("fix", "ChatOpenAI(max_retries=0), so ModelRetryMiddleware is the only retry layer")
        fixed, fixed_secs, _ = retry_run(port, 0)
        report("after", f"{fixed} requests in {fixed_secs:.1f} s")
    finally:
        server.shutdown()
    return {"requests": hits, "requests_after_fix": fixed, "run_s": round(secs, 2), "run_s_after_fix": round(fixed_secs, 2)}


def crash_child(db, sink, keyed, phase):
    from langgraph.checkpoint.sqlite import SqliteSaver

    @tool
    def charge_card(amount: int, runtime: ToolRuntime) -> str:
        """Charge the card of the customer."""
        key = runtime.tool_call_id
        lines = Path(sink).read_text().splitlines() if Path(sink).exists() else []
        if keyed and any(line.startswith(f"{key}\t") for line in lines):
            return f"already charged under key {key}"
        with open(sink, "a") as handle:
            handle.write(f"{key}\t{amount}\t{phase}\n")
            handle.flush()
            os.fsync(handle.fileno())
        if phase == "start":
            os.kill(os.getpid(), signal.SIGKILL)
        return f"charged {amount}"

    script = [call("charge_card", {"amount": 42}, "call_1"), AIMessage("Charged.")] if phase == "start" else [AIMessage("Charged.")]
    cfg = {"configurable": {"thread_id": "order-7"}}
    with SqliteSaver.from_conn_string(db) as saver:
        agent = create_agent(ScriptedChatModel(script=script), tools=[charge_card], checkpointer=saver)
        agent.invoke(ASK if phase == "start" else None, cfg, durability="sync")
        print(json.dumps({"next": list(agent.get_state(cfg).next), "messages": len(agent.get_state(cfg).values["messages"])}))


def crash_round(keyed):
    work = Path(tempfile.mkdtemp(prefix="drill-"))
    db, sink = str(work / "checkpoints.sqlite"), str(work / "charges.tsv")
    args = [sys.executable, __file__, "crash-child", db, sink, "key" if keyed else "plain"]
    first = subprocess.run(args + ["start"], capture_output=True, text=True, timeout=120)
    second = subprocess.run(args + ["resume"], capture_output=True, text=True, timeout=120)
    lines = Path(sink).read_text().splitlines()
    state = json.loads(second.stdout.strip().splitlines()[-1])
    return first.returncode, lines, state


@case(2, "a crash between a side effect and its checkpoint", "4.3")
def crash():
    code, lines, state = crash_round(False)
    report("symptom", f"the first process exited with {code} inside charge_card, the resume ran charge_card again: {len(lines)} charges")
    report("state", f"after the resume: next {state['next']}, {state['messages']} messages, charges {[line.split(chr(9))[2] for line in lines]}")
    report("fix", "check runtime.tool_call_id against the charges before the charge, with durability sync")
    code2, lines2, state2 = crash_round(True)
    report("after", f"exit {code2}, then the resume: {len(lines2)} charge, next {state2['next']}")
    return {"exit_code": code, "charges": len(lines), "charges_after_fix": len(lines2)}


class JumpToTools(AgentMiddleware):
    @hook_config(can_jump_to=["tools"])
    def after_model(self, state, runtime):
        if getattr(state["messages"][-1], "tool_calls", None):
            return {"jump_to": "tools"}
        return None


def approval_run(mode):
    sent = []

    @tool
    def send_email(to: str) -> str:
        """Send an email."""
        sent.append(to)
        return "sent"

    model = ScriptedChatModel(script=[call("send_email", {"to": "all-staff@example.org"}, "c1"), AIMessage("Done.")])
    agent = create_agent(model, tools=[send_email], middleware=[HumanInTheLoopMiddleware(interrupt_on={"send_email": True}, interrupt_mode=mode), JumpToTools()], checkpointer=InMemorySaver())
    cfg = {"configurable": {"thread_id": mode}}
    result = agent.invoke(ASK, cfg, version="v2")
    return sent, len(result.interrupts), list(agent.get_state(cfg).next)


@case(3, "an approval skipped by a middleware that jumps to tools", "5.5")
def approval():
    sent, interrupts, nxt = approval_run("batched")
    report("symptom", f"send_email ran {len(sent)} time before any decision, with {interrupts} interrupts")
    report("state", f"batched mode, middleware=[HumanInTheLoopMiddleware, JumpToTools], next {nxt}")
    report("fix", "interrupt_mode=\"per_call\", which pauses inside the tool call")
    sent2, interrupts2, nxt2 = approval_run("per_call")
    report("after", f"send_email ran {len(sent2)} times, {interrupts2} interrupt waits, next {nxt2}")
    return {"ran_before_decision": len(sent), "ran_after_fix": len(sent2), "interrupts_after_fix": interrupts2}


class Answer(BaseModel):
    total: int


@case(4, "a run that ends with no structured response", "3.2")
def structured():
    model = ScriptedChatModel(script=[AIMessage("The total is 5.")])
    out = create_agent(model, tools=[add], response_format=ToolStrategy(Answer)).invoke(ASK)
    response = out.get("structured_response")
    report("symptom", f"no exception, structured_response is {response!r}")
    report("state", f"{len(out['messages'])} messages, the last is plain text: {out['messages'][-1].content!r}")
    report("fix", "check structured_response for None after each run, and treat None as a failure")
    try:
        if response is None:
            raise RuntimeError("the agent returned no structured response")
        caught = "nothing"
    except RuntimeError as exc:
        caught = f"RuntimeError: {exc}"
    report("after", f"the check raised {caught}")
    return {"structured_response": None if response is None else response.model_dump(), "check": caught}


def free_port():
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


def trace_child(probe):
    from langsmith import tracing_context
    enabled = True
    if probe:
        try:
            urllib.request.urlopen(os.environ["LANGSMITH_ENDPOINT"] + "/info", timeout=1)
        except OSError:
            enabled = False
    model = ScriptedChatModel(script=[call("add", {"a": 2, "b": 3}), AIMessage("5")])
    agent = create_agent(model, tools=[add])
    started = time.perf_counter()
    with tracing_context(enabled=enabled):
        agent.invoke(ASK)
    print(json.dumps({"run_ms": round((time.perf_counter() - started) * 1000, 1), "tracing": enabled, "end": time.time()}), flush=True)


def trace_round(probe):
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LANGSMITH_", "LANGCHAIN_"))}
    env.update(LANGSMITH_TRACING="true", LANGSMITH_ENDPOINT=f"http://127.0.0.1:{free_port()}")
    started = time.time()
    proc = subprocess.run([sys.executable, __file__, "trace-child"] + (["probe"] if probe else []), capture_output=True, text=True, env=env, timeout=300)
    ended = time.time()
    child = json.loads(proc.stdout.strip().splitlines()[-1])
    failures = sum(1 for line in proc.stderr.splitlines() if "Failed to" in line)
    return child, ended - child["end"], ended - started, failures


@case(5, "a tracing endpoint that is down", "6.4")
def tracing():
    child, lag, total, failures = trace_round(False)
    report("symptom", f"the agent run took {child['run_ms']} ms, and the process exited {lag:.1f} s after it ({total:.1f} s in all)")
    report("state", f"LANGSMITH_TRACING=true, nothing listens on the endpoint, {failures} lines of upload errors on stderr")
    report("fix", "probe GET /info with a 1 s timeout at start, and run inside tracing_context(enabled=False) when it fails")
    child2, lag2, total2, failures2 = trace_round(True)
    report("after", f"tracing {child2['tracing']}, exit {lag2:.1f} s after the run ({total2:.1f} s in all), {failures2} lines of upload errors")
    return {"exit_lag_s": round(lag, 1), "exit_lag_s_after_fix": round(lag2, 1), "upload_error_lines": failures}


@case(6, "two tools with the same name", "2.4")
def duplicate():
    @tool("lookup")
    def lookup_orders(q: str) -> str:
        """Look up an order."""
        return "from the orders table"

    @tool("lookup")
    def lookup_refunds(q: str) -> str:
        """Look up a refund."""
        return "from the refunds table"

    model = ScriptedChatModel(script=[call("lookup", {"q": "order 7"}), AIMessage("Done.")])
    out = create_agent(model, tools=[lookup_orders, lookup_refunds]).invoke(ASK)
    result = next(m.content for m in out["messages"] if m.type == "tool")
    report("symptom", f"create_agent raised nothing, the model saw {len(model.bound['tools'])} tool named {model.bound['tools']}")
    report("state", f"the call to lookup ran the second function: {result!r}")
    report("fix", "check that tool names are unique before create_agent")
    names = [t.name for t in (lookup_orders, lookup_refunds)]
    dupes = sorted({n for n in names if names.count(n) > 1})
    report("after", f"the check found duplicate names {dupes}")
    return {"tools_bound": model.bound["tools"], "ran": result, "duplicates": dupes}


@case(7, "a model that calls a tool forever", "5.8")
def recursion():
    loop = ScriptedChatModel(script=[call("add", {"a": 1, "b": 1}, f"call_{i}") for i in range(50)])
    try:
        create_agent(loop, tools=[add]).invoke(ASK, {"recursion_limit": 10})
        raised = "nothing"
    except GraphRecursionError as exc:
        raised = f"GraphRecursionError: {str(exc).splitlines()[0]}"
    report("symptom", raised)
    report("state", f"the model was called {loop.position} times before the limit")
    report("fix", "ModelCallLimitMiddleware(run_limit=3, exit_behavior=\"end\"), first with the same recursion_limit of 10")
    tries = []
    for limit in (10, 25):
        loop2 = ScriptedChatModel(script=[call("add", {"a": 1, "b": 1}, f"call_{i}") for i in range(50)])
        agent = create_agent(loop2, tools=[add], middleware=[ModelCallLimitMiddleware(run_limit=3, exit_behavior="end")])
        try:
            out = agent.invoke(ASK, {"recursion_limit": limit})
            outcome = f"no exception, last message {out['messages'][-1].content[:80]!r}"
        except GraphRecursionError as exc:
            outcome = f"GraphRecursionError: {str(exc).splitlines()[0][:40]} …"
        steps = len([n for n in agent.get_graph().nodes if not n.startswith("__")])
        report("after", f"recursion_limit {limit}: {loop2.position} model calls, {outcome}")
        tries.append({"recursion_limit": limit, "model_calls": loop2.position, "outcome": outcome, "graph_nodes": steps})
    return {"raised": raised, "model_calls": loop.position, "after_fix": tries}


def main():
    if sys.argv[1:2] == ["crash-child"]:
        crash_child(sys.argv[2], sys.argv[3], sys.argv[4] == "key", sys.argv[5])
        return
    if sys.argv[1:2] == ["trace-child"]:
        trace_child(sys.argv[2:3] == ["probe"])
        return
    started = time.perf_counter()
    for run in (retries, crash, approval, structured, tracing, duplicate, recursion):
        run()
    print(f"\ntotal {time.perf_counter() - started:.1f} s")
    if len(sys.argv) > 1:
        with open(sys.argv[1], "w") as out:
            for row in ROWS:
                out.write(json.dumps(row) + "\n")


if __name__ == "__main__":
    main()
