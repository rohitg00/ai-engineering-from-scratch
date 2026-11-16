import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))

from instrument import PIN, Recorder, instrument
from real import TimedChatOllama, chat, settings, machine
from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, hook_config
from langchain_core.messages import AIMessage
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.errors import GraphRecursionError
from langgraph.types import interrupt
from pydantic import BaseModel

OUT = []


def out(s=""):
    OUT.append(s)
    print(s)


@tool
def get_weather(city: str) -> str:
    """Return the weather for a city."""
    return f"{city}: sunny"


@tool(return_direct=True)
def lookup(q: str) -> str:
    """Look something up and return it directly."""
    return "direct answer"


class Audit(AgentMiddleware):
    name = "Audit"

    def before_agent(self, state, runtime):
        return None

    def after_agent(self, state, runtime):
        return None


class Guard(AgentMiddleware):
    name = "Guard"

    def __init__(self, stop_after=99):
        super().__init__()
        self.calls = 0
        self.stop_after = stop_after

    @hook_config(can_jump_to=["end"])
    def before_model(self, state, runtime):
        self.calls += 1
        if self.calls == self.stop_after + 1:
            return {"jump_to": "end"}
        return None

    def after_model(self, state, runtime):
        return None

    def wrap_model_call(self, request, handler):
        return handler(request)


class Answer(BaseModel):
    city: str
    weather: str


def describe(label, agent):
    out(f"## {label}")
    builder = agent.builder
    out(f"  nodes: {list(agent.nodes)}")
    for e in agent.get_graph().edges:
        out(f"  edge {e.source} -> {e.target}{'  (conditional)' if e.conditional else ''}")
    for src, br in builder.branches.items():
        for name, b in br.items():
            out(f"  branch on {src}: fn={name} ends={sorted(b.ends) if b.ends else None}")
    chans = {k: type(v).__name__ for k, v in agent.channels.items()}
    out(f"  channels: {chans}")
    out(f"  trigger_to_nodes: {dict(agent.trigger_to_nodes)}")
    out(f"  config: recursion_limit={agent.config.get('recursion_limit')} metadata={agent.config.get('metadata')}")
    out()


def part_a_topologies():
    out("# A. Compiled topology per configuration")
    m = lambda: chat()
    describe("no tools, no middleware", create_agent(m(), []))
    describe("tools, no middleware", create_agent(m(), [get_weather]))
    describe("tools incl. return_direct", create_agent(m(), [get_weather, lookup]))
    describe("tools + Audit(before/after_agent) + Guard(before/after_model, wrap_model_call)", create_agent(m(), [get_weather], middleware=[Audit(), Guard()]))
    describe("structured output (ToolStrategy via response_format), no tools", create_agent(m(), [], response_format=Answer))


def part_b_jump_to():
    out("# B. jump_to: Guard.before_model returns {'jump_to': 'end'} on its 2nd call")
    n0 = len(TimedChatOllama.calls)
    agent = create_agent(chat(), [get_weather], middleware=[Guard(stop_after=1)], checkpointer=InMemorySaver())
    rec = Recorder()
    with instrument(rec):
        r = agent.invoke({"messages": [{"role": "user", "content": "Rome?"}]}, {"configurable": {"thread_id": "j"}})
    for e in rec.events:
        if e["event"] == "tick" and e["returns"]:
            out(f"  step={e['step']} run={[t['name'] for t in e['tasks_to_run']]}")
        elif e["event"] == "loop.put_writes":
            out(f"      {e['task']} wrote {[c for c, _ in e['writes']]}{'  jump_to=' + str(dict(e['writes']).get('jump_to')) if 'jump_to' in dict(e['writes']) else ''}")
        elif e["event"] == "apply_writes" and "jump_to" in e["versions_changed"]:
            out(f"      jump_to version {e['versions_changed']['jump_to']}; available after update: {'jump_to' in e['channels_available']}")
    out(f"  model calls made: {len(TimedChatOllama.calls) - n0} (tool calls per call {[c['n_tool_calls'] for c in TimedChatOllama.calls[n0:]]}); last message: {r['messages'][-1].type}: {r['messages'][-1].text!r}")
    st = agent.get_state({"configurable": {"thread_id": "j"}})
    ck = agent.checkpointer.get_tuple({"configurable": {"thread_id": "j"}}).checkpoint
    out(f"  final checkpoint channel_values has jump_to={ck['channel_values'].get('jump_to')!r}; state.next={st.next}")
    n1 = len(TimedChatOllama.calls)
    rec2 = Recorder()
    with instrument(rec2):
        r2 = agent.invoke({"messages": [{"role": "user", "content": "again"}]}, {"configurable": {"thread_id": "j"}})
    steps2 = [(e['step'], [t['name'] for t in e['tasks_to_run']]) for e in rec2.events if e['event'] == 'tick' and e['returns']]
    out(f"  next turn on the same thread: {steps2}; model calls {len(TimedChatOllama.calls) - n1}; last={r2['messages'][-1].type}: {r2['messages'][-1].text[:100]!r}")
    out()


LOOP_PROMPT = ("You are testing a tool loop. On every turn, call get_weather for one new city that you have not asked about yet. "
               "Never answer in text. Never stop calling the tool.")


def run_until_limit(limit, durability=None):
    n0 = len(TimedChatOllama.calls)
    agent = create_agent(chat(), [get_weather], system_prompt=LOOP_PROMPT, checkpointer=InMemorySaver())
    rec = Recorder()
    cfg = {"configurable": {"thread_id": "r"}}
    if limit is not None:
        cfg["recursion_limit"] = limit
    err = None
    with instrument(rec):
        try:
            res = agent.invoke({"messages": [{"role": "user", "content": "Start the loop."}]}, cfg)
            err = f"no error: model stopped calling tools; last message {res['messages'][-1].text[:60]!r}"
        except GraphRecursionError as e:
            err = str(e).splitlines()[0]
    steps = [e["step"] for e in rec.events if e["event"] == "tick" and e["returns"]]
    new = TimedChatOllama.calls[n0:]
    return len(new), steps, err + f" | tool calls per model call {[c['n_tool_calls'] for c in new]}"


def part_c_recursion():
    out("# C. Recursion limit counting (model always calls a tool; count supersteps that ran)")
    out("  limit | supersteps run (incl. hidden __start__) | step numbers | model calls | error")
    for limit in (1, 2, 3, 4, 5, 10, 25):
        calls_, steps, err = run_until_limit(limit)
        out(f"  {limit:>5} | {len(steps):>3} | {steps[0]}..{steps[-1]} | {calls_:>3} | {err}", )
    out()
    out("  resumed thread: interrupt at a tool, then invoke(None) with recursion_limit=4")

    @tool
    def gate(x: str) -> str:
        """Ask a human."""
        return interrupt("ok?")

    gate_prompt = ("Your first action must be a call to the gate tool with x='1', alone. After the gate answers, call get_weather "
                   "for one new city on every turn. Never answer in text.")
    agent = create_agent(chat(), [gate, get_weather], system_prompt=gate_prompt, checkpointer=InMemorySaver())
    cfg = {"configurable": {"thread_id": "rr"}, "recursion_limit": 4}
    r0 = agent.invoke({"messages": [{"role": "user", "content": "go"}]}, cfg)
    out(f"  first invoke: interrupted={bool(r0.get('__interrupt__'))}; tool calls so far {[tc['name'] for m in r0['messages'] for tc in (getattr(m, 'tool_calls', None) or [])]}")
    from langgraph.types import Command
    rec = Recorder()
    err = None
    with instrument(rec):
        try:
            agent.invoke(Command(resume="yes"), cfg)
        except GraphRecursionError as e:
            err = str(e).splitlines()[0]
    steps = [e["step"] for e in rec.events if e["event"] == "tick" and e["returns"]]
    out(f"  resume with limit 4: supersteps run={len(steps)} steps={steps} error={err}")
    rec = Recorder()
    err = None
    cfg2 = {"configurable": {"thread_id": "rr"}, "recursion_limit": 4}
    with instrument(rec):
        try:
            agent.invoke({"messages": [{"role": "user", "content": "again"}]}, cfg2)
        except GraphRecursionError as e:
            err = str(e).splitlines()[0]
    steps = [e["step"] for e in rec.events if e["event"] == "tick" and e["returns"]]
    out(f"  new input on same thread with limit 4: supersteps run={len(steps)} steps={steps} error={err}")
    out()
    out("  (the Mac run also ran without a limit until its script ran out; not repeated here, because a real model would run toward 9,999 supersteps)")
    out()


def main():
    out(f"# create_agent compiled graph, real model. pin {PIN}. {machine()}")
    out(f"# model {settings()}")
    out()
    part_a_topologies()
    part_b_jump_to()
    part_c_recursion()
    (HERE / "trace.txt").write_text("\n".join(OUT) + "\n")


if __name__ == "__main__":
    main()
