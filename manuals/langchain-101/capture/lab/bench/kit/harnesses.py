import uuid

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage

SYSTEM_PROMPT = (
    "You are a careful assistant that completes tasks by calling the provided tools. "
    "Use tools to look up facts, query data, and read or change files and notes; never guess a value that a tool can provide. "
    "When the user asks a question, call submit_answer exactly once with only the final answer value. "
    "When the user only asks you to change files or notes, make the changes with the tools and then reply in one short sentence. "
    "Do not ask the user follow-up questions."
)

RECURSION_LIMIT = 200


def system_message(provider):
    if provider == "anthropic":
        return SystemMessage(content=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}])
    return SystemMessage(content=SYSTEM_PROMPT)


class PlainLoop:
    name = "plain"

    def __init__(self, model, tools, meter, provider="ollama", **_):
        self.bound = model.bind_tools(tools)
        self.by_name = {t.name: t for t in tools}
        self.meter = meter
        self.messages = [system_message(provider)]

    def turn(self, text):
        start = len(self.messages)
        self.messages.append(HumanMessage(text))
        while True:
            ai = self.bound.invoke(self.messages, config={"callbacks": [self.meter]})
            self.messages.append(ai)
            if not ai.tool_calls:
                break
            for tc in ai.tool_calls:
                tool = self.by_name.get(tc["name"])
                if tool is None:
                    content = f"Error: {tc['name']} is not a valid tool, try one of [{', '.join(self.by_name)}]."
                else:
                    try:
                        content = tool.invoke(tc["args"])
                    except Exception as e:
                        content = f"Error invoking tool '{tc['name']}' with kwargs {tc['args']} with error:\n {e}\n Please fix the error and try again."
                self.messages.append(ToolMessage(content=str(content), tool_call_id=tc["id"], name=tc["name"]))
        return self.messages[start:], self.messages


class _GraphHarness:
    def __init__(self, graph, meter):
        self.graph = graph
        self.meter = meter
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


class CreateAgent(_GraphHarness):
    name = "create_agent"

    def __init__(self, model, tools, meter, provider="ollama", middleware=(), response_format=None, system_prompt=None, **_):
        from langchain.agents import create_agent
        from langgraph.checkpoint.memory import InMemorySaver
        mw = list(middleware)
        if provider == "anthropic":
            from langchain_anthropic.middleware import AnthropicPromptCachingMiddleware
            mw.append(AnthropicPromptCachingMiddleware())
        g = create_agent(model, tools=tools, system_prompt=system_prompt or SYSTEM_PROMPT, middleware=mw, response_format=response_format, checkpointer=InMemorySaver())
        super().__init__(g, meter)


class HandGraph(_GraphHarness):
    name = "langgraph"

    def __init__(self, model, tools, meter, provider="ollama", **_):
        from langgraph.checkpoint.memory import InMemorySaver
        from langgraph.graph import START, MessagesState, StateGraph
        from langgraph.prebuilt import ToolNode, tools_condition
        bound = model.bind_tools(tools)
        sysmsg = system_message(provider)

        def call_model(state: MessagesState):
            return {"messages": [bound.invoke([sysmsg] + state["messages"])]}

        b = StateGraph(MessagesState)
        b.add_node("model", call_model)
        b.add_node("tools", ToolNode(tools))
        b.add_edge(START, "model")
        b.add_conditional_edges("model", tools_condition)
        b.add_edge("tools", "model")
        super().__init__(b.compile(checkpointer=InMemorySaver()), meter)


class DeepAgent(_GraphHarness):
    name = "deep_agent"

    def __init__(self, model, tools, meter, provider="ollama", **_):
        from deepagents import create_deep_agent
        from langgraph.checkpoint.memory import InMemorySaver
        g = create_deep_agent(model=model, tools=tools, system_prompt=SYSTEM_PROMPT, checkpointer=InMemorySaver())
        super().__init__(g, meter)


class DeepAgentFS(_GraphHarness):
    name = "deep_agent_fs"

    def __init__(self, model, tools, meter, provider="ollama", env=None, **_):
        from deepagents import create_deep_agent
        from deepagents.backends.filesystem import FilesystemBackend
        from langgraph.checkpoint.memory import InMemorySaver
        backend = FilesystemBackend(root_dir=env.sandbox, virtual_mode=True) if env is not None and env.sandbox else None
        g = create_deep_agent(model=model, tools=tools, system_prompt=SYSTEM_PROMPT, backend=backend, checkpointer=InMemorySaver())
        super().__init__(g, meter)


HARNESSES = {h.name: h for h in (PlainLoop, CreateAgent, HandGraph, DeepAgent, DeepAgentFS)}
