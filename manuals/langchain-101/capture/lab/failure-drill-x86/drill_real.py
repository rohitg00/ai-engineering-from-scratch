import json
import os
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, HumanInTheLoopMiddleware, ModelCallLimitMiddleware, ModelRetryMiddleware, hook_config
from langchain.agents.structured_output import ToolStrategy
from langchain.tools import ToolRuntime, tool
from langchain_core.callbacks import BaseCallbackHandler
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.errors import GraphRecursionError
from pydantic import BaseModel

from lr_common import Relay, chat, chat_openai, free_port, header

ROWS = []


def ask(text):
    return {"messages": [{"role": "user", "content": text}]}


class Calls(BaseCallbackHandler):
    def __init__(self):
        self.n = 0
        self.tools = None

    def on_chat_model_start(self, serialized, messages, invocation_params=None, **kw):
        self.n += 1
        if self.tools is None and invocation_params:
            self.tools = [t.get("function", t).get("name") for t in invocation_params.get("tools", [])]


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


def retry_run(client_retries):
    relay = Relay(default="drop")
    kw = {} if client_retries is None else {"max_retries": client_retries}
    agent = create_agent(chat_openai(port=relay.port, **kw), tools=[add], middleware=[ModelRetryMiddleware()])
    started = time.perf_counter()
    out = agent.invoke(ask("What is 2 + 3? Use the add tool."))
    secs = time.perf_counter() - started
    relay.close()
    return len(relay.arrivals), secs, out["messages"][-1].content


@case(1, "retry layers stack on one model call", "3.5")
def retries():
    hits, secs, last = retry_run(None)
    report("symptom", f"one model call sent {hits} requests to a relay in front of Ollama that drops every connection, in {secs:.1f} s")
    report("state", f"the run ended without an exception, last AIMessage: {last[:90]}")
    report("fix", "ChatOpenAI(max_retries=0), so ModelRetryMiddleware is the only retry layer")
    fixed, fixed_secs, _ = retry_run(0)
    report("after", f"{fixed} requests in {fixed_secs:.1f} s")
    return {"requests": hits, "requests_after_fix": fixed, "run_s": round(secs, 2), "run_s_after_fix": round(fixed_secs, 2),
            "failure_source": "relay that closes every connection before Ollama answers"}


CHARGE = "Charge the card of the customer 42 euros with the charge_card tool, then reply with the single word: Charged."


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

    cfg = {"configurable": {"thread_id": "order-7"}}
    cb = Calls()
    with SqliteSaver.from_conn_string(db) as saver:
        agent = create_agent(chat(), tools=[charge_card], checkpointer=saver)
        agent.invoke(ask(CHARGE) if phase == "start" else None, {**cfg, "callbacks": [cb]}, durability="sync")
        st = agent.get_state(cfg)
        print(json.dumps({"next": list(st.next), "messages": len(st.values["messages"]), "model_calls": cb.n,
                          "last": str(st.values["messages"][-1].content)[:80]}))


def crash_round(keyed):
    work = Path(tempfile.mkdtemp(prefix="drill-"))
    db, sink = str(work / "checkpoints.sqlite"), str(work / "charges.tsv")
    args = [sys.executable, __file__, "crash-child", db, sink, "key" if keyed else "plain"]
    first = subprocess.run(args + ["start"], capture_output=True, text=True, timeout=600)
    second = subprocess.run(args + ["resume"], capture_output=True, text=True, timeout=600)
    lines = Path(sink).read_text().splitlines() if Path(sink).exists() else []
    state = json.loads(second.stdout.strip().splitlines()[-1])
    return first.returncode, lines, state


@case(2, "a crash between a side effect and its checkpoint", "4.3")
def crash():
    code, lines, state = crash_round(False)
    report("symptom", f"the first process exited with {code} inside charge_card, the resume ran charge_card again: {len(lines)} charges")
    report("state", f"after the resume: next {state['next']}, {state['messages']} messages, charges {[line.split(chr(9))[2] for line in lines]}, last {state['last']!r}")
    report("fix", "check runtime.tool_call_id against the charges before the charge, with durability sync")
    code2, lines2, state2 = crash_round(True)
    report("after", f"exit {code2}, then the resume: {len(lines2)} charge, next {state2['next']}, last {state2['last']!r}")
    return {"exit_code": code, "charges": len(lines), "charges_after_fix": len(lines2), "resume_model_calls": state["model_calls"],
            "resume_model_calls_after_fix": state2["model_calls"]}


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

    agent = create_agent(chat(), tools=[send_email], middleware=[HumanInTheLoopMiddleware(interrupt_on={"send_email": True}, interrupt_mode=mode), JumpToTools()],
                         checkpointer=InMemorySaver())
    cfg = {"configurable": {"thread_id": mode}}
    result = agent.invoke(ask("Send an email to all-staff@example.org with the send_email tool."), cfg, version="v2")
    return sent, len(result.interrupts), list(agent.get_state(cfg).next)


@case(3, "an approval skipped by a middleware that jumps to tools", "5.5")
def approval():
    sent, interrupts, nxt = approval_run("batched")
    report("symptom", f"send_email ran {len(sent)} time before any decision, with {interrupts} interrupts, to {sent}")
    report("state", f"batched mode, middleware=[HumanInTheLoopMiddleware, JumpToTools], next {nxt}")
    report("fix", "interrupt_mode=\"per_call\", which pauses inside the tool call")
    sent2, interrupts2, nxt2 = approval_run("per_call")
    report("after", f"send_email ran {len(sent2)} times, {interrupts2} interrupt waits, next {nxt2}")
    return {"ran_before_decision": len(sent), "ran_after_fix": len(sent2), "interrupts_after_fix": interrupts2}


class Answer(BaseModel):
    total: int


STRUCT_PROMPTS = ["What is 2 + 3?", "Add 2 and 3 with the add tool and give the total.", "Hello! How are you today?",
                  "Tell me a one-line joke.", "What is the total of an empty order?"]


@case(4, "a run that ends with no structured response", "3.2")
def structured():
    rows = []
    for p in STRUCT_PROMPTS:
        cb = Calls()
        out = create_agent(chat(), tools=[add], response_format=ToolStrategy(Answer)).invoke(ask(p), {"callbacks": [cb]})
        r = out.get("structured_response")
        rows.append({"prompt": p, "structured_response": None if r is None else r.model_dump(), "n_messages": len(out["messages"]),
                     "last": str(out["messages"][-1].content)[:80], "model_calls": cb.n, "bound": cb.tools})
    nones = [x for x in rows if x["structured_response"] is None]
    report("symptom", f"{len(nones)} of {len(rows)} prompts ended with no exception and structured_response None: {[x['prompt'] for x in nones]}")
    report("state", f"bound tools {rows[0]['bound']}; last messages of the None runs: {[x['last'] for x in nones][:3]}")
    report("fix", "check structured_response for None after each run, and treat None as a failure")
    caught = []
    for x in rows:
        try:
            if x["structured_response"] is None:
                raise RuntimeError("the agent returned no structured response")
            caught.append("nothing")
        except RuntimeError as exc:
            caught.append(f"RuntimeError: {exc}")
    report("after", f"the check raised on {sum(1 for c in caught if c != 'nothing')} of {len(rows)} runs")
    return {"runs": rows, "none_count": len(nones), "check": caught}


def trace_child(probe):
    from langsmith import tracing_context
    enabled = True
    if probe:
        try:
            urllib.request.urlopen(os.environ["LANGSMITH_ENDPOINT"] + "/info", timeout=1)
        except OSError:
            enabled = False
    agent = create_agent(chat(), tools=[add])
    started = time.perf_counter()
    with tracing_context(enabled=enabled):
        agent.invoke(ask("What is 2 + 3? Use the add tool."))
    print(json.dumps({"run_ms": round((time.perf_counter() - started) * 1000, 1), "tracing": enabled, "end": time.time()}), flush=True)


def trace_round(probe):
    env = {k: v for k, v in os.environ.items() if not k.startswith(("LANGSMITH_", "LANGCHAIN_")) and "proxy" not in k.lower()}
    env.update(LANGSMITH_TRACING="true", LANGSMITH_ENDPOINT=f"http://127.0.0.1:{free_port()}", LANGSMITH_API_KEY="drill-no-key")
    started = time.time()
    proc = subprocess.run([sys.executable, __file__, "trace-child"] + (["probe"] if probe else []), capture_output=True, text=True, env=env, timeout=600)
    ended = time.time()
    child = json.loads(proc.stdout.strip().splitlines()[-1])
    failures = sum(1 for line in proc.stderr.splitlines() if "Failed to" in line)
    return child, ended - child["end"], ended - started, failures


@case(5, "a tracing endpoint that is down", "6.4")
def tracing():
    child, lag, total, failures = trace_round(False)
    report("symptom", f"the agent run took {child['run_ms']} ms, and the process exited {lag:.1f} s after it ({total:.1f} s in all)")
    report("state", f"LANGSMITH_TRACING=true, nothing listens on the endpoint port, {failures} lines of upload errors on stderr")
    report("fix", "probe GET /info with a 1 s timeout at start, and run inside tracing_context(enabled=False) when it fails")
    child2, lag2, total2, failures2 = trace_round(True)
    report("after", f"tracing {child2['tracing']}, exit {lag2:.1f} s after the run ({total2:.1f} s in all), {failures2} lines of upload errors")
    return {"run_ms": child["run_ms"], "exit_lag_s": round(lag, 1), "exit_lag_s_after_fix": round(lag2, 1), "upload_error_lines": failures,
            "run_ms_after_fix": child2["run_ms"]}


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

    cb = Calls()
    out = create_agent(chat(), tools=[lookup_orders, lookup_refunds]).invoke(ask("Look up order 7 with the lookup tool."), {"callbacks": [cb]})
    results = [m.content for m in out["messages"] if m.type == "tool"]
    report("symptom", f"create_agent raised nothing, the model saw {len(cb.tools)} tool named {cb.tools}")
    report("state", f"the call to lookup ran: {results!r}; final answer {str(out['messages'][-1].content)[:80]!r}")
    report("fix", "check that tool names are unique before create_agent")
    names = [t.name for t in (lookup_orders, lookup_refunds)]
    dupes = sorted({n for n in names if names.count(n) > 1})
    report("after", f"the check found duplicate names {dupes}")
    return {"tools_bound": cb.tools, "ran": results, "duplicates": dupes}


@tool
def poll(job: str) -> str:
    """Poll a job for its status."""
    return f"job {job}: still running. Poll again."


FOREVER = "Poll job 7 with the poll tool until it is finished. Do not stop before it is finished."


@case(7, "a model that calls a tool forever", "5.8")
def recursion():
    cb = Calls()
    try:
        create_agent(chat(), tools=[poll]).invoke(ask(FOREVER), {"recursion_limit": 10, "callbacks": [cb]})
        raised = "nothing"
    except GraphRecursionError as exc:
        raised = f"GraphRecursionError: {str(exc).splitlines()[0]}"
    report("symptom", raised)
    report("state", f"the model was called {cb.n} times before the limit")
    report("fix", "ModelCallLimitMiddleware(run_limit=3, exit_behavior=\"end\"), first with the same recursion_limit of 10")
    tries = []
    for limit in (10, 25):
        cb2 = Calls()
        agent = create_agent(chat(), tools=[poll], middleware=[ModelCallLimitMiddleware(run_limit=3, exit_behavior="end")])
        try:
            out = agent.invoke(ask(FOREVER), {"recursion_limit": limit, "callbacks": [cb2]})
            outcome = f"no exception, last message {str(out['messages'][-1].content)[:80]!r}"
        except GraphRecursionError as exc:
            outcome = f"GraphRecursionError: {str(exc).splitlines()[0][:40]} …"
        steps = len([n for n in agent.get_graph().nodes if not n.startswith("__")])
        report("after", f"recursion_limit {limit}: {cb2.n} model calls, {outcome}")
        tries.append({"recursion_limit": limit, "model_calls": cb2.n, "outcome": outcome, "graph_nodes": steps})
    return {"raised": raised, "model_calls": cb.n, "after_fix": tries}


def main():
    if sys.argv[1:2] == ["crash-child"]:
        crash_child(sys.argv[2], sys.argv[3], sys.argv[4] == "key", sys.argv[5])
        return
    if sys.argv[1:2] == ["trace-child"]:
        trace_child(sys.argv[2:3] == ["probe"])
        return
    print(json.dumps(header("drill_real.py")), flush=True)
    started = time.perf_counter()
    for run in (retries, crash, approval, structured, tracing, duplicate, recursion):
        run()
    print(f"\ntotal {time.perf_counter() - started:.1f} s")
    if len(sys.argv) > 1:
        with open(sys.argv[1], "w") as out:
            for row in ROWS:
                out.write(json.dumps(row, default=str) + "\n")


if __name__ == "__main__":
    main()
