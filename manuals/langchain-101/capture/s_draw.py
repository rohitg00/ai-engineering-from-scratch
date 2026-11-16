import inspect
import os
import sys
import types
from contextlib import contextmanager

from langchain.agents import create_agent
from langchain_core.runnables.graph import Graph, MermaidDrawMethod

from common import add, llm
from s_agents import Traced
from s_graph import functional_workflow, joke_graph, subgraph_app

PRODAPP = os.path.join(os.path.dirname(os.path.realpath(__file__)), "lab", "prodapp-mac", "code")


def edges(graph):
    return [f"{e.source} -> {e.target}" + (" (conditional)" if e.conditional else "") for e in graph.edges]


def drawings(cap, graph, label="get_graph()"):
    cap.section(f"{label}: nodes")
    cap.json(list(graph.nodes))
    cap.section(f"{label}: edges")
    cap.json(edges(graph))
    cap.section(f"{label}.draw_mermaid()")
    cap.text(graph.draw_mermaid())
    cap.section(f"{label}.draw_ascii()")
    ascii_art = cap.attempt("draw_ascii()", graph.draw_ascii)
    if ascii_art is not None:
        cap.text(ascii_art)


def draw_agent(cap):
    agent = create_agent(llm(), tools=[add], system_prompt="You add numbers.")
    graph = agent.get_graph()
    cap.section("get_graph() returns")
    cap.text(f"{type(graph).__module__}.{type(graph).__name__}")
    cap.json({node_id: {"name": node.name, "data": type(node.data).__name__, "metadata": node.metadata} for node_id, node in graph.nodes.items()}, "graph.nodes")
    cap.json([{"source": e.source, "target": e.target, "data": e.data, "conditional": e.conditional} for e in graph.edges], "graph.edges")
    drawings(cap, graph)
    cap.section("draw_mermaid_png() defaults at the pin")
    params = inspect.signature(Graph.draw_mermaid_png).parameters
    cap.json({name: params[name].default for name in ("draw_method", "base_url", "max_retries", "output_file_path")}, "keyword defaults")
    cap.json([m.name for m in MermaidDrawMethod], "MermaidDrawMethod members")
    cap.text("draw_mermaid_png() is not called here: both of its draw methods reach the network.")


def draw_middleware(cap):
    agent = create_agent(llm("order"), tools=[add], middleware=[Traced("A", []), Traced("B", []), Traced("C", [])])
    drawings(cap, agent.get_graph())


def draw_fanout(cap):
    drawings(cap, joke_graph().get_graph())


def draw_functional(cap):
    drawings(cap, functional_workflow([]).get_graph())


def draw_subgraph(cap):
    app = subgraph_app()
    drawings(cap, app.get_graph())
    drawings(cap, app.get_graph(xray=True), "get_graph(xray=True)")


def draw_deep_agent(cap):
    from deepagents import create_deep_agent
    with cap.warnings():
        agent = create_deep_agent(model=llm("deep"), tools=[add], system_prompt="You keep notes.")
    drawings(cap, agent.get_graph())
    cap.section("get_graph(xray=True): nodes")
    cap.json(list(agent.get_graph(xray=True).nodes))


@contextmanager
def prodapp_modules():
    class Span:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def set_attribute(self, *args):
            pass

    telemetry = types.ModuleType("app.telemetry")
    telemetry.event = lambda *args, **kwargs: None
    telemetry.tracer = types.SimpleNamespace(start_as_current_span=lambda name: Span())
    before = set(sys.modules)
    sys.path.insert(0, PRODAPP)
    try:
        import app
        sys.modules["app.telemetry"] = telemetry
        app.telemetry = telemetry
        from app.agent import build_agent
        from app.settings import Settings
        yield build_agent, Settings
    finally:
        sys.path.remove(PRODAPP)
        for name in set(sys.modules) - before:
            if name == "app" or name.startswith("app."):
                del sys.modules[name]


def draw_service_agent(cap):
    with prodapp_modules() as (build_agent, Settings):
        settings = Settings()
        agent = build_agent(llm("primary"), llm("backup"), None, None, settings)
        cap.text(
            "build_agent from capture/lab/prodapp-mac/code/app/agent.py, with the default Settings,",
            "ChatOllama models that are never called, no checkpointer, and no store.",
            "app.telemetry is replaced by a stand-in, because the kit pin has no OpenTelemetry SDK.",
            "Tracing and ToolTimeout have only wrap hooks, so the stand-in changes no node.",
        )
        drawings(cap, agent.get_graph())


LATE = [
    ("draw-agent", "Drawing the create_agent graph", draw_agent, False),
    ("draw-middleware", "Drawing an agent with middleware=[A, B, C]", draw_middleware, False),
    ("draw-fanout", "Drawing the joke graph of Send and Command", draw_fanout, False),
    ("draw-functional", "Drawing an entrypoint of the functional API", draw_functional, False),
    ("draw-subgraph", "Drawing a parent graph with a subgraph, with and without xray", draw_subgraph, False),
    ("draw-deep-agent", "Drawing a Deep Agents 0.7 graph", draw_deep_agent, False),
    ("draw-service-agent", "Drawing the agent of the production service", draw_service_agent, False),
]
