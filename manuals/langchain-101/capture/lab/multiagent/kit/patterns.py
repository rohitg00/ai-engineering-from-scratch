import operator
import sys
import time
import uuid
from pathlib import Path
from typing import Annotated, Any, Callable, Literal

BENCH_KIT = Path(__file__).resolve().parents[2] / "bench" / "kit"
sys.path.insert(0, str(BENCH_KIT))

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from pydantic import BaseModel, Field
from typing_extensions import NotRequired, TypedDict

from env import build_tools
from harnesses import SYSTEM_PROMPT
from models import Meter

RECURSION_LIMIT = 200
MY_CELLS = ("multiagent|", "sdk|", "deep9|")


def my_spend():
    from models import LEDGER
    import json
    rows = [json.loads(l) for l in LEDGER.read_text().splitlines() if l.strip()]
    return sum(r.get("cost_usd", 0.0) for r in rows if str(r.get("cell", "")).startswith(MY_CELLS))

DOMAINS = {
    "shop": {
        "desc": "catalog items (unit price, price currency, unit weight), currency exchange rates, carrier shipping rates per kg, unit conversion, and arithmetic",
        "tools": ["get_item_info", "get_exchange_rate", "get_shipping_rate", "convert_units", "calculator"],
        "guide": (
            "Each catalog item has a unit price in its own currency and a unit weight in its own unit. "
            "Look up every item with get_item_info. To change currency, get the rate with get_exchange_rate and multiply. "
            "A shipping rate is a price per kg in the carrier currency, so convert the weight to kg first. "
            "Use convert_units for units and calculator for every arithmetic step."
        ),
    },
    "orders_db": {
        "desc": "the shop SQLite database of products, customers and orders",
        "tools": ["sql_list_tables", "sql_describe", "sql_query", "calculator"],
        "guide": (
            "List the tables with sql_list_tables and read each table you need with sql_describe before you query it. "
            "Answer with one read-only SELECT through sql_query. Use COUNT, SUM, AVG and GROUP BY in SQL rather than counting rows by hand."
        ),
    },
    "docs": {
        "desc": "the Orrin Valley document collection (places, transport lines, history, local facts)",
        "tools": ["search_docs", "read_doc"],
        "guide": (
            "Search the collection with search_docs using the key nouns of the question. "
            "Open the most likely document with read_doc and take the answer from its text, not from the snippet or from memory."
        ),
    },
    "files": {
        "desc": "files and folders in the user's workspace",
        "tools": ["fs_list", "fs_read", "fs_write", "fs_rename", "fs_delete"],
        "guide": (
            "Paths are relative to the workspace root. List a folder with fs_list before you change it. "
            "Write exactly the content asked for, with no extra text. Read a file before you edit it, then write the whole new content."
        ),
    },
    "notes": {
        "desc": "the user's persistent notes store (keys and values), with a calculator",
        "tools": ["kv_set", "kv_get", "kv_delete", "kv_list", "calculator"],
        "guide": (
            "Notes are key-value pairs that persist across turns. Read a key with kv_get before you change it. "
            "Store numbers as plain digits and lists as comma-separated items. Use calculator for arithmetic."
        ),
    },
}

ALL_TOOL_NAMES = []
for _d in DOMAINS.values():
    for _n in _d["tools"]:
        if _n not in ALL_TOOL_NAMES:
            ALL_TOOL_NAMES.append(_n)

SPECIALIST_PROMPT = (
    "You are the {name} specialist. You handle {desc}. "
    "Complete the request by calling your tools. Never guess a value that a tool can provide. "
    "When you are done, reply in one or two sentences with the result and the values you found.\n\n{guide}"
)

COORDINATOR_PROMPT = (
    SYSTEM_PROMPT + "\n\nYou do not have the domain tools yourself. Delegate each part of the request to the right specialist "
    "with the task tool, and put every fact the specialist needs into the task description. "
    "Then combine their results. Specialists:\n{roster}"
)

HANDOFF_PROMPT = (
    SYSTEM_PROMPT + "\n\nYou are the {name} agent. You handle {desc}. "
    "If the request, or a part of it, needs another agent, call the transfer tool for that agent. "
    "Other agents: {others}.\n\n{guide}"
)

SKILLS_PROMPT = SYSTEM_PROMPT + (
    "\n\nThe domain tools appear only after you load their skill with load_skill. Available skills:\n{roster}"
)

ROUTER_PROMPT = (
    "You route a user request to specialist agents. Pick the fewest agents that can complete it. "
    "Give each picked agent a self-contained sub-request with every fact it needs from the conversation. "
    "Agents:\n{roster}"
)

SOLO_PROMPT = SYSTEM_PROMPT + "\n\nYou are the {name} agent. You handle {desc}.\n\n{guide}"

SYNTH_PROMPT =SYSTEM_PROMPT + "\n\nSpecialist agents already did the work. Combine their results into the final answer."


def roster():
    return "\n".join(f"- {n}: {d['desc']}" for n, d in DOMAINS.items())


def single_prompt():
    return SYSTEM_PROMPT + "\n\n" + "\n\n".join(f"About {n} ({d['desc']}): {d['guide']}" for n, d in DOMAINS.items())


def domain_tools(env, name):
    return build_tools(env, DOMAINS[name]["tools"])


def caching(provider):
    if provider == "anthropic":
        from langchain_anthropic.middleware import AnthropicPromptCachingMiddleware
        return [AnthropicPromptCachingMiddleware()]
    return []


class TraceMeter(Meter):
    def __init__(self, *a, task_cap_usd=None, ledger_start=None, **kw):
        super().__init__(*a, **kw)
        self.t0 = time.perf_counter()
        self.trace = []
        self._open = {}
        self.task_cap_usd = task_cap_usd
        self.ledger_start = ledger_start

    @staticmethod
    def lane(metadata):
        md = metadata or {}
        ns = md.get("checkpoint_ns") or md.get("langgraph_checkpoint_ns") or ""
        return {"agent": md.get("lc_agent_name"), "node": md.get("langgraph_node"), "ns": ns.split("|")[0].split(":")[0] if ns else ""}

    def on_chat_model_start(self, serialized, messages, *, run_id, metadata=None, **kw):
        if self.provider == "anthropic" and self.task_cap_usd is not None:
            from models import BudgetExceeded
            spent = my_spend()
            if spent >= self.task_cap_usd:
                raise BudgetExceeded(f"task cap ${self.task_cap_usd} reached (spent ${spent:.4f})")
        super().on_chat_model_start(serialized, messages, run_id=run_id, **kw)
        self._open[run_id] = {"kind": "model", **self.lane(metadata), "t0": time.perf_counter() - self.t0, "n_msgs": len(messages[0]) if messages else 0}

    def on_llm_end(self, response, *, run_id, **kw):
        super().on_llm_end(response, run_id=run_id, **kw)
        ev = self._open.pop(run_id, None)
        if ev is not None:
            c = self.calls[-1]
            calls = []
            try:
                calls = [tc["name"] for tc in response.generations[0][0].message.tool_calls]
            except Exception:
                pass
            ev.update({"t1": time.perf_counter() - self.t0, "in": c.get("in", 0), "out": c.get("out", 0), "asks": calls})
            self.trace.append(ev)

    def on_llm_error(self, error, *, run_id, **kw):
        super().on_llm_error(error, run_id=run_id, **kw)
        ev = self._open.pop(run_id, None)
        if ev is not None:
            ev.update({"t1": time.perf_counter() - self.t0, "error": repr(error)[:120]})
            self.trace.append(ev)

    def on_tool_start(self, serialized, input_str, *, run_id, metadata=None, **kw):
        name = (serialized or {}).get("name") or kw.get("name")
        self._open[run_id] = {"kind": "tool", "name": name, **self.lane(metadata), "t0": time.perf_counter() - self.t0}

    def on_tool_end(self, output, *, run_id, **kw):
        ev = self._open.pop(run_id, None)
        if ev is not None:
            ev["t1"] = time.perf_counter() - self.t0
            self.trace.append(ev)

    def on_tool_error(self, error, *, run_id, **kw):
        ev = self._open.pop(run_id, None)
        if ev is not None:
            ev.update({"t1": time.perf_counter() - self.t0, "error": repr(error)[:120]})
            self.trace.append(ev)


class _Threaded:
    def __init__(self, graph, meter):
        self.graph = graph
        self.cfg = {"configurable": {"thread_id": str(uuid.uuid4())}, "callbacks": [meter], "recursion_limit": RECURSION_LIMIT}
        self.seen = 0

    def turn(self, text):
        out = self.graph.invoke({"messages": [HumanMessage(text)]}, self.cfg)
        msgs = out["messages"]
        new = msgs[self.seen:]
        self.seen = len(msgs)
        return new, msgs

    def state_messages(self):
        try:
            return self.graph.get_state(self.cfg).values.get("messages", [])
        except Exception:
            return []


class Single(_Threaded):
    name = "single"
    extra_tools = set()

    def __init__(self, model, env, meter, provider):
        from langchain.agents import create_agent
        from langgraph.checkpoint.memory import InMemorySaver
        tools = build_tools(env, ALL_TOOL_NAMES + ["submit_answer"])
        g = create_agent(model, tools=tools, system_prompt=single_prompt(), middleware=caching(provider), checkpointer=InMemorySaver(), name="single")
        super().__init__(g, meter)


class Subagents(_Threaded):
    name = "subagents"
    extra_tools = {"task", "write_todos", "ls", "read_file", "write_file", "edit_file", "glob", "grep", "execute", "delete"}

    def __init__(self, model, env, meter, provider):
        from deepagents import create_deep_agent
        from langgraph.checkpoint.memory import InMemorySaver
        subs = [{"name": n, "description": f"Specialist for {d['desc']}.", "system_prompt": SPECIALIST_PROMPT.format(name=n, **d), "tools": domain_tools(env, n)}
                for n, d in DOMAINS.items()]
        g = create_deep_agent(model=model, tools=build_tools(env, ["submit_answer"]), system_prompt=COORDINATOR_PROMPT.format(roster=roster()),
                              subagents=subs, checkpointer=InMemorySaver(), name="coordinator")
        super().__init__(g, meter)


def _handoff_tool(target, desc):
    from langchain.tools import ToolRuntime, tool
    from langgraph.types import Command

    @tool(f"transfer_to_{target}", description=f"Transfer the conversation to the {target} agent, which handles {desc}.")
    def transfer(runtime: ToolRuntime) -> Command:
        last_ai = next(m for m in reversed(runtime.state["messages"]) if isinstance(m, AIMessage))
        msg = ToolMessage(content=f"Transferred to {target} agent", tool_call_id=runtime.tool_call_id)
        return Command(goto=target, update={"active_agent": target, "messages": [last_ai, msg]}, graph=Command.PARENT)
    return transfer


class Handoffs(_Threaded):
    name = "handoffs"
    extra_tools = {f"transfer_to_{n}" for n in DOMAINS}
    default_agent = "shop"

    def __init__(self, model, env, meter, provider):
        from langchain.agents import AgentState, create_agent
        from langgraph.checkpoint.memory import InMemorySaver
        from langgraph.graph import END, START, StateGraph

        class MultiAgentState(AgentState):
            active_agent: NotRequired[str]

        names = list(DOMAINS)
        b = StateGraph(MultiAgentState)
        for n, d in DOMAINS.items():
            others = [o for o in names if o != n]
            tools = domain_tools(env, n) + build_tools(env, ["submit_answer"]) + [_handoff_tool(o, DOMAINS[o]["desc"]) for o in others]
            prompt = HANDOFF_PROMPT.format(name=n, desc=d["desc"], guide=d["guide"], others="; ".join(f"{o} ({DOMAINS[o]['desc']})" for o in others))
            b.add_node(n, create_agent(model, tools=tools, system_prompt=prompt, middleware=caching(provider), name=n))

        default = self.default_agent

        def route_initial(state) -> str:
            return state.get("active_agent") or default

        def route_after(state) -> str:
            msgs = state.get("messages", [])
            if msgs and isinstance(msgs[-1], AIMessage) and not msgs[-1].tool_calls:
                return END
            return state.get("active_agent") or default

        b.add_conditional_edges(START, route_initial, names)
        for n in names:
            b.add_conditional_edges(n, route_after, names + [END])
        super().__init__(b.compile(checkpointer=InMemorySaver()), meter)


class Skills(_Threaded):
    name = "skills"
    extra_tools = {"load_skill"}

    def __init__(self, model, env, meter, provider):
        from langchain.agents import AgentState, create_agent
        from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse
        from langchain.tools import ToolRuntime, tool
        from langgraph.checkpoint.memory import InMemorySaver
        from langgraph.types import Command

        class SkillState(AgentState):
            skills_loaded: NotRequired[Annotated[list[str], operator.add]]

        @tool
        def load_skill(skill_name: str, runtime: ToolRuntime) -> Command:
            """Load a skill: its instructions and its tools. Call this before you work in a domain."""
            key = skill_name.strip().lower()
            if key in DOMAINS:
                d = DOMAINS[key]
                text = f"Loaded skill: {key}\nTools now available: {', '.join(d['tools'])}\n\n{d['guide']}"
                return Command(update={"messages": [ToolMessage(content=text, tool_call_id=runtime.tool_call_id)], "skills_loaded": [key]})
            return Command(update={"messages": [ToolMessage(content=f"Skill '{skill_name}' not found. Available skills: {', '.join(DOMAINS)}", tool_call_id=runtime.tool_call_id)]})

        domain_tool_objs = {n: domain_tools(env, n) for n in DOMAINS}
        submit = build_tools(env, ["submit_answer"])
        all_tools = [load_skill] + submit
        seen = set()
        for n in DOMAINS:
            for t in domain_tool_objs[n]:
                if t.name not in seen:
                    seen.add(t.name)
                    all_tools.append(t)

        class SkillMiddleware(AgentMiddleware[SkillState]):
            state_schema = SkillState

            def wrap_model_call(self, request: ModelRequest, handler: Callable[[ModelRequest], ModelResponse]) -> ModelResponse:
                loaded = set(request.state.get("skills_loaded", []) or [])
                allowed = {"load_skill", "submit_answer"} | {t for n in loaded for t in DOMAINS[n]["tools"]}
                return handler(request.override(tools=[t for t in request.tools if getattr(t, "name", None) in allowed]))

        g = create_agent(model, tools=all_tools, system_prompt=SKILLS_PROMPT.format(roster=roster()), state_schema=SkillState,
                         middleware=[SkillMiddleware()] + caching(provider), checkpointer=InMemorySaver(), name="skills")
        super().__init__(g, meter)


class Route(BaseModel):
    agent: Literal["shop", "orders_db", "docs", "files", "notes"]
    query: str = Field(description="A self-contained sub-request for this agent, with every fact it needs.")


class Routes(BaseModel):
    routes: list[Route] = Field(description="One entry per agent to call. Usually one.")


def _results_reducer(left, right):
    if right and isinstance(right[0], dict) and right[0].get("reset"):
        return []
    return (left or []) + (right or [])


def _history_text(msgs):
    out = []
    for m in msgs:
        if isinstance(m, HumanMessage):
            out.append(f"User: {m.content}")
        elif isinstance(m, AIMessage) and m.content:
            c = m.content if isinstance(m.content, str) else " ".join(b.get("text", "") for b in m.content if isinstance(b, dict))
            out.append(f"Assistant: {c}")
    return "\n".join(out)


def _text(m):
    c = m.content
    if isinstance(c, list):
        c = " ".join(b.get("text", "") for b in c if isinstance(b, dict))
    return c or ""


class Router(_Threaded):
    name = "router"
    extra_tools = set()

    def __init__(self, model, env, meter, provider):
        from langchain.agents import create_agent
        from langchain_core.messages import SystemMessage
        from langgraph.checkpoint.memory import InMemorySaver
        from langgraph.graph import END, START, StateGraph
        from langgraph.graph.message import add_messages
        from langgraph.types import Send

        class RouterState(TypedDict):
            messages: Annotated[list, add_messages]
            routes: list
            results: Annotated[list, _results_reducer]

        class AgentInput(TypedDict):
            agent: str
            query: str
            history: list
            solo: bool

        solo_agents, team_agents = {}, {}
        for n, d in DOMAINS.items():
            p = SPECIALIST_PROMPT.format(name=n, **d)
            solo_agents[n] = create_agent(model, tools=domain_tools(env, n) + build_tools(env, ["submit_answer"]),
                                          system_prompt=SOLO_PROMPT.format(name=n, **d), middleware=caching(provider), name=n)
            team_agents[n] = create_agent(model, tools=domain_tools(env, n), system_prompt=p, middleware=caching(provider), name=n)
        synth = create_agent(model, tools=build_tools(env, ["submit_answer"]), system_prompt=SYNTH_PROMPT, middleware=caching(provider), name="synthesize")
        if provider == "ollama":
            classifier = model.with_structured_output(Routes, method="json_schema")
        else:
            classifier = model.with_structured_output(Routes)
        sysmsg = SystemMessage(ROUTER_PROMPT.format(roster=roster()))

        def classify(state: RouterState):
            msgs = state["messages"]
            hist = _history_text(msgs[:-1])
            q = msgs[-1].content
            prompt = (f"Conversation so far:\n{hist}\n\n" if hist else "") + f"New user request:\n{q}"
            try:
                r = classifier.invoke([sysmsg, HumanMessage(prompt)], config={"metadata": {"lc_agent_name": "router"}})
                routes = [x.model_dump() for x in (r.routes if r else [])]
            except Exception as e:
                routes = []
            return {"routes": routes, "results": [{"reset": True}]}

        def fan_out(state: RouterState):
            routes = state.get("routes") or []
            if not routes:
                return "synthesize"
            hist = state["messages"][:-1]
            solo = len(routes) == 1
            return [Send("agent", {"agent": r["agent"], "query": r["query"], "history": hist, "solo": solo}) for r in routes]

        def agent(inp: AgentInput):
            a = (solo_agents if inp["solo"] else team_agents)[inp["agent"]]
            hist = [m for m in inp["history"] if isinstance(m, HumanMessage) or (isinstance(m, AIMessage) and not m.tool_calls and _text(m))]
            hist = [HumanMessage(_text(m)) if isinstance(m, HumanMessage) else AIMessage(_text(m)) for m in hist]
            out = a.invoke({"messages": hist + [HumanMessage(inp["query"])]})
            return {"results": [{"agent": inp["agent"], "query": inp["query"], "answer": _text(out["messages"][-1]), "solo": inp["solo"]}]}

        def synthesize(state: RouterState):
            res = state.get("results") or []
            if len(res) == 1 and res[0].get("solo"):
                return {"messages": [AIMessage(res[0]["answer"])]}
            q = state["messages"][-1].content
            hist = _history_text(state["messages"][:-1])
            body = "\n\n".join(f"[{r['agent']}] asked: {r['query']}\nresult: {r['answer']}" for r in res) or "No specialist was called."
            text = (f"Conversation so far:\n{hist}\n\n" if hist else "") + f"User request:\n{q}\n\nSpecialist results:\n{body}"
            out = synth.invoke({"messages": [HumanMessage(text)]})
            return {"messages": [AIMessage(_text(out["messages"][-1]))]}

        b = StateGraph(RouterState)
        b.add_node("classify", classify)
        b.add_node("agent", agent)
        b.add_node("synthesize", synthesize)
        b.add_edge(START, "classify")
        b.add_conditional_edges("classify", fan_out, ["agent", "synthesize"])
        b.add_edge("agent", "synthesize")
        b.add_edge("synthesize", END)
        super().__init__(b.compile(checkpointer=InMemorySaver()), meter)


class Deep9(_Threaded):
    name = "deep9"
    extra_tools = {"write_todos", "ls", "read_file", "write_file", "edit_file", "glob", "grep", "task", "execute", "delete"}

    def __init__(self, model, env, meter, provider):
        from deepagents import create_deep_agent
        from env import FAMILY_TOOLS
        from langgraph.checkpoint.memory import InMemorySaver
        g = create_deep_agent(model=model, tools=build_tools(env, FAMILY_TOOLS[env.task["family"]]), system_prompt=SYSTEM_PROMPT, checkpointer=InMemorySaver())
        super().__init__(g, meter)


PATTERNS = {p.name: p for p in (Single, Subagents, Handoffs, Skills, Router, Deep9)}
