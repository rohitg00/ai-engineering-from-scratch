import asyncio
import operator
from typing import Annotated, Literal, TypedDict

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage, RemoveMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.errors import GraphRecursionError, NodeError
from langgraph.func import entrypoint, task
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.graph.message import add_messages
from langgraph.managed import RemainingSteps
from langgraph.types import Command, RetryPolicy, Send, interrupt

from common import add, ask, model, thread
from fake import call


class Fanout(TypedDict):
    topic: str
    subjects: list[str]
    jokes: Annotated[list[str], operator.add]
    log: Annotated[list[str], operator.add]
    best: str


def reducers_send_command(cap):
    def plan(state):
        return {"subjects": ["cats", "dogs", "owls"], "log": ["plan"]}

    def fan_out(state):
        return [Send("write_joke", {"subject": s}) for s in state["subjects"]]

    def write_joke(arg):
        return {"jokes": [f"a joke about {arg['subject']}"], "log": [f"write_joke({arg['subject']})"]}

    def pick(state) -> Command[Literal["publish", "retry"]]:
        best = sorted(state["jokes"])[0]
        target = "publish" if "cats" in best else "retry"
        return Command(update={"best": best, "log": [f"pick -> {target}"]}, goto=target)

    def publish(state):
        return {"log": ["publish"]}

    def retry(state):
        return {"log": ["retry"]}

    graph = StateGraph(Fanout)
    graph.add_node("plan", plan)
    graph.add_node("write_joke", write_joke)
    graph.add_node("pick", pick)
    graph.add_node("publish", publish)
    graph.add_node("retry", retry)
    graph.add_edge(START, "plan")
    graph.add_conditional_edges("plan", fan_out, ["write_joke"])
    graph.add_edge("write_joke", "pick")
    graph.add_edge("publish", END)
    graph.add_edge("retry", END)
    app = graph.compile()
    cap.section("graph")
    cap.text(app.get_graph().draw_mermaid())
    cap.section("updates, one chunk per node run")
    chunks = list(app.stream({"topic": "animals", "subjects": [], "jokes": [], "log": [], "best": ""}, stream_mode="updates"))
    parallel = iter(sorted((c for c in chunks if "write_joke" in c), key=lambda c: c["write_joke"]["jokes"]))
    for chunk in chunks:
        cap.json(next(parallel) if "write_joke" in chunk else chunk)
    cap.section("final state: operator.add merged the parallel writes")
    cap.json(app.invoke({"topic": "animals", "subjects": [], "jokes": [], "log": [], "best": ""}))
    cap.section("two parallel writes to a key with no reducer")

    class Plain(TypedDict):
        value: str

    g = StateGraph(Plain)
    g.add_node("a", lambda s: {"value": "a"})
    g.add_node("b", lambda s: {"value": "b"})
    g.add_edge(START, "a")
    g.add_edge(START, "b")
    cap.attempt("invoke", lambda: g.compile().invoke({"value": ""}))
    cap.section("add_messages: append, replace by id, and remove")
    base = [HumanMessage("first", id="m1"), HumanMessage("second", id="m2")]
    cap.messages(add_messages(base, [HumanMessage("second, edited", id="m2"), HumanMessage("third", id="m3")]), "replace m2, append m3")
    cap.messages(add_messages(base, [RemoveMessage(id="m1")]), "remove m1")
    cap.section("MessagesState accepts dicts and returns messages")
    g = StateGraph(MessagesState)
    g.add_node("echo", lambda s: {"messages": [{"role": "assistant", "content": f"you said {s['messages'][-1].content}"}]})
    g.add_edge(START, "echo")
    cap.messages(g.compile().invoke({"messages": [{"role": "user", "content": "hi"}]})["messages"])


def functional(cap):
    runs = []

    @task
    def double(x: int) -> int:
        runs.append(f"double({x})")
        return x * 2

    @task
    def ask_human(total: int) -> str:
        return interrupt({"total": total, "question": "Keep it?"})

    @entrypoint(checkpointer=InMemorySaver())
    def workflow(numbers: list[int]) -> dict:
        futures = [double(n) for n in numbers]
        total = sum(f.result() for f in futures)
        answer = ask_human(total).result()
        return {"total": total, "answer": answer}

    cfg = thread("functional")
    cap.section("first run stops at the interrupt inside a task")
    result = workflow.invoke([1, 2, 3], cfg, version="v2")
    cap.json({"value": result.value, "interrupts": result.interrupts})
    cap.json(sorted(runs), "task runs")
    cap.section("resume: finished tasks are not run again")
    result = workflow.invoke(Command(resume="yes"), cfg, version="v2")
    cap.json(result.value)
    cap.json(sorted(runs), "task runs")
    cap.section("updates stream of a fresh run")
    for chunk in workflow.stream([5], thread("functional-2"), stream_mode="updates"):
        cap.json(chunk)
    cap.section("entrypoint.final returns one value and saves another")

    @entrypoint(checkpointer=InMemorySaver())
    def counter(n: int, *, previous: int | None = None) -> entrypoint.final[int, int]:
        total = (previous or 0) + n
        return entrypoint.final(value=f"added {n} to {previous}, saved {total}", save=total)

    cfg = thread("counter")
    cap.json([counter.invoke(3, cfg), counter.invoke(4, cfg), counter.invoke(5, cfg)], "three calls")
    cap.json(counter.get_state(cfg).values, "saved value")
    cap.section("graph of an entrypoint")
    cap.json(list(workflow.get_graph().nodes))


def subgraphs(cap):
    class Inner(TypedDict):
        text: str
        steps: Annotated[list[str], operator.add]

    def shout(state):
        return {"text": state["text"].upper(), "steps": ["inner.shout"]}

    def ask_ok(state):
        ok = interrupt("Is the shout fine?")
        return {"steps": [f"inner.ask_ok={ok}"]}

    inner = StateGraph(Inner)
    inner.add_node("shout", shout)
    inner.add_node("ask_ok", ask_ok)
    inner.add_edge(START, "shout")
    inner.add_edge("shout", "ask_ok")
    inner_app = inner.compile()

    outer = StateGraph(Inner)
    outer.add_node("prepare", lambda s: {"text": s["text"] + "!", "steps": ["outer.prepare"]})
    outer.add_node("inner", inner_app)
    outer.add_node("finish", lambda s: {"steps": ["outer.finish"]})
    outer.add_edge(START, "prepare")
    outer.add_edge("prepare", "inner")
    outer.add_edge("inner", "finish")
    app = outer.compile(checkpointer=InMemorySaver())
    cfg = thread("subgraph")
    cap.section("graph with xray=True")
    cap.text(app.get_graph(xray=True).draw_mermaid())
    cap.section("stream(subgraphs=True) yields (namespace, chunk)")
    for namespace, chunk in app.stream({"text": "hello", "steps": []}, cfg, stream_mode="updates", subgraphs=True):
        cap.json({"namespace": namespace, "chunk": chunk})
    cap.section("state while the subgraph waits")
    state = app.get_state(cfg, subgraphs=True)
    cap.json({"next": list(state.next), "task": state.tasks[0].name, "subgraph next": list(state.tasks[0].state.next), "subgraph values": state.tasks[0].state.values})
    cap.section("resume")
    cap.json(app.invoke(Command(resume="yes"), cfg))
    cap.json([f"{name}" for name, _ in app.get_subgraphs()], "get_subgraphs()")
    cap.section("an agent as a subgraph node")
    agent = create_agent(model(call("add", {"a": 2, "b": 3}), AIMessage("5")), tools=[add], name="adder")
    g = StateGraph(MessagesState)
    g.add_node("adder", agent)
    g.add_edge(START, "adder")
    for namespace, chunk in g.compile().stream(ask("2 + 3?"), stream_mode="updates", subgraphs=True):
        cap.json({"namespace": namespace, "nodes": sorted(chunk)})


def errors_timeouts(cap):
    class S(TypedDict):
        status: str
        attempts: int

    tries = []

    def flaky(state):
        tries.append(len(tries) + 1)
        raise ValueError(f"upstream failed on try {len(tries)}")

    def handler(state, error: NodeError):
        return Command(update={"status": f"recovered from {error.node}: {error.error}"}, goto="report")

    g = StateGraph(S)
    g.add_node("flaky", flaky, retry_policy=RetryPolicy(max_attempts=3, initial_interval=0.0, jitter=False, retry_on=ValueError), error_handler=handler)
    g.add_node("report", lambda s: {"attempts": len(tries)})
    g.add_edge(START, "flaky")
    g.add_edge("report", END)
    app = g.compile()
    cap.section("RetryPolicy(max_attempts=3) then a node error_handler")
    cap.json(list(app.get_graph().nodes), "nodes")
    cap.json(app.invoke({"status": "", "attempts": 0}))
    cap.json(tries, "tries")
    cap.section("no error_handler, RetryPolicy(max_attempts=2) with the default retry_on")
    tries.clear()
    g = StateGraph(S)
    g.add_node("flaky", flaky, retry_policy=RetryPolicy(max_attempts=2, initial_interval=0.0, jitter=False))
    g.add_edge(START, "flaky")
    cap.attempt("invoke", lambda: g.compile().invoke({"status": "", "attempts": 0}))
    cap.json(tries, "tries")
    cap.section("set_node_defaults(error_handler=...) covers every node")

    def boom(state):
        raise KeyError("missing")

    def default_handler(state, error: NodeError):
        return {"status": f"default handler: {type(error.error).__name__} in {error.node}"}

    g = StateGraph(S)
    g.set_node_defaults(error_handler=default_handler)
    g.add_node("boom", boom)
    g.add_edge(START, "boom")
    cap.json(g.compile().invoke({"status": "", "attempts": 0}))
    cap.section("a node timeout on an async node")

    async def slow(state):
        await asyncio.sleep(2)
        return {"status": "finished"}

    g = StateGraph(S)
    g.add_node("slow", slow, timeout=0.05)
    g.add_edge(START, "slow")
    cap.attempt("ainvoke", lambda: asyncio.run(g.compile().ainvoke({"status": "", "attempts": 0})))
    cap.section("a timeout with an error_handler")
    def timeout_handler(state, error: NodeError):
        return {"status": f"{type(error.error).__name__}: {error.error}"}

    g = StateGraph(S)
    g.add_node("slow", slow, timeout=0.05, error_handler=timeout_handler)
    g.add_edge(START, "slow")
    cap.json(asyncio.run(g.compile().ainvoke({"status": "", "attempts": 0})))


def recursion(cap):
    class Loop(TypedDict):
        n: int

    def loop_graph(steps):
        g = StateGraph(Loop)
        g.add_node("step", lambda s: {"n": s["n"] + 1})
        g.add_edge(START, "step")
        g.add_conditional_edges("step", lambda s: "step" if s["n"] < steps else END)
        return g.compile()

    cap.section("a StateGraph loop with recursion_limit=5")
    cap.attempt("invoke", lambda: loop_graph(100).invoke({"n": 0}, {"recursion_limit": 5}))
    cap.section("the default limit of a plain compiled graph, on a loop of 20000 steps")
    try:
        loop_graph(20000).invoke({"n": 0})
        cap.text("finished under the default limit")
    except GraphRecursionError as exc:
        cap.text(f"raised GraphRecursionError: {str(exc).splitlines()[0]}")
    cap.section("create_agent sets recursion_limit 9999; a model that always calls a tool, with recursion_limit=6")
    looping = model(*[call("add", {"a": i, "b": 1}, f"call_{i}") for i in range(10)])
    agent = create_agent(looping, tools=[add])
    cap.json(agent.config["recursion_limit"], "agent.config['recursion_limit']")
    cap.attempt("invoke with recursion_limit=6", lambda: agent.invoke(ask("loop"), {"recursion_limit": 6}))
    cap.text(f"model calls before the stop: {looping.position}")
    cap.section("RemainingSteps lets a node stop before the limit")

    class Guarded(TypedDict):
        n: int
        remaining_steps: RemainingSteps

    g = StateGraph(Guarded)
    g.add_node("step", lambda s: {"n": s["n"] + 1})
    g.add_edge(START, "step")
    g.add_conditional_edges("step", lambda s: END if s["remaining_steps"] <= 2 else "step")
    cap.json(g.compile().invoke({"n": 0}, {"recursion_limit": 5}))


SCENARIOS = [
    ("stategraph-reducers-send-command", "StateGraph: reducers, Send fan-out, and Command goto", reducers_send_command),
    ("functional-api", "The functional API: @entrypoint and @task", functional),
    ("subgraphs", "Subgraphs, their namespaces, and an interrupt inside one", subgraphs),
    ("error-handler-timeout", "Retry policy, node error handlers, and node timeouts", errors_timeouts),
    ("recursion-limit", "The recursion limit", recursion),
]
