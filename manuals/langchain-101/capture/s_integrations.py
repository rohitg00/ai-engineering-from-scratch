import asyncio
import re

import requests

from langchain.agents import create_agent
from langchain.tools import tool
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter

from common import add, ask, embeddings, llm, recorder

CORPUS = {
    "checkpoints.md": "A checkpointer saves graph state after each step. InMemorySaver keeps it in a dict. SqliteSaver writes it to a file, so a thread survives a restart.",
    "stores.md": "A store holds long-term memory across threads. Items live under a namespace tuple and a key. Search matches a namespace prefix.",
    "streaming.md": "stream_mode updates yields one chunk per node. messages yields token chunks with metadata. custom yields what a tool writes.",
}


def corpus_store():
    splitter = RecursiveCharacterTextSplitter(chunk_size=80, chunk_overlap=20)
    docs = splitter.create_documents(list(CORPUS.values()), metadatas=[{"source": name} for name in CORPUS])
    store = InMemoryVectorStore(embedding=embeddings())
    store.add_documents(docs, ids=[f"doc-{i}" for i in range(len(docs))])
    return docs, store


def retrieval(cap):
    splitter = RecursiveCharacterTextSplitter(chunk_size=80, chunk_overlap=20)
    docs = splitter.create_documents(list(CORPUS.values()), metadatas=[{"source": name} for name in CORPUS])
    cap.section("RecursiveCharacterTextSplitter(chunk_size=80, chunk_overlap=20)")
    cap.json([{"source": d.metadata["source"], "chars": len(d.page_content), "text": d.page_content} for d in docs])
    emb = embeddings()
    cap.section("OllamaEmbeddings(model='nomic-embed-text'): one vector per text")
    first = emb.embed_query("checkpointer")
    cap.json({"dims": len(first), "first 4": [round(x, 6) for x in first[:4]], "repeat equal": first == emb.embed_query("checkpointer"), "other text equal": first == emb.embed_query("store")})
    store = InMemoryVectorStore(embedding=emb)
    ids = store.add_documents(docs, ids=[f"doc-{i}" for i in range(len(docs))])
    cap.section("InMemoryVectorStore.similarity_search_with_score")
    cap.json(ids, "ids")
    for query in (docs[0].page_content, "Where does long-term memory live?", "What does a checkpointer do?"):
        hits = store.similarity_search_with_score(query, k=2)
        cap.json([{"id": d.id, "source": d.metadata["source"], "score": round(s, 6), "text": d.page_content} for d, s in hits], f"query {query!r}")
    cap.section("a metadata filter")
    hits = store.similarity_search("memory", k=5, filter=lambda d: d.metadata["source"] == "stores.md")
    cap.json([d.id for d in hits])
    cap.section("delete and get_by_ids")
    store.delete(["doc-0"])
    cap.json([d.id for d in store.get_by_ids(["doc-0", "doc-1"])])
    cap.section("max_marginal_relevance_search")
    cap.json([d.id for d in store.max_marginal_relevance_search("memory", k=2, fetch_k=4)])


def retrieval_agent(cap):
    docs, store = corpus_store()
    cap.section("as_retriever(k=1), wrapped as a tool for an agent")
    retriever = store.as_retriever(search_kwargs={"k": 1})

    @tool
    def search_docs(query: str) -> str:
        """Search the local corpus."""
        return "\n".join(f"[{d.metadata['source']}] {d.page_content}" for d in retriever.invoke(query))

    m = llm("rag")
    out = create_agent(m, tools=[search_docs], system_prompt="Always call search_docs first, then answer only from what it returns.").invoke(ask("What does a checkpointer do? Search the docs."))
    cap.messages(out["messages"][1:])
    show = [d.page_content for d in docs]
    for msg in out["messages"]:
        if msg.type == "tool":
            body = msg.content.split("] ", 1)[-1]
            cap.text(f"the hit is chunk {show.index(body) if body in show else 'none'} of {len(show)}")


def build_server():
    from fastmcp import FastMCP
    from fastmcp.exceptions import ToolError

    server = FastMCP("calc")

    @server.tool
    def multiply(a: int, b: int) -> int:
        """Multiply two integers."""
        return a * b

    @server.tool
    def divide(a: int, b: int) -> float:
        """Divide a by b."""
        if b == 0:
            raise ToolError("division by zero")
        return a / b

    @server.tool
    def stats(values: list[float]) -> dict:
        """Return the count and mean of a list."""
        return {"count": len(values), "mean": sum(values) / len(values)}

    @server.resource("docs://readme")
    def readme() -> str:
        return "calc server: multiply, divide, stats"

    return server


async def mcp_run(cap):
    with cap.warnings():
        from langchain.mcp import MCPAdapter
    server = build_server()
    async with MCPAdapter(server) as adapter:
        tools = await adapter.list_tools()
        cap.section("list_tools() on an in-process FastMCP server")
        cap.json([{"name": t.name, "description": t.description, "args": t.args, "response_format": t.response_format} for t in tools])
        cap.section("an agent calls multiply, divide by zero, and stats")
        out = await create_agent(llm("mcp"), tools=tools).ainvoke(ask("Use the calc tools: multiply 6 by 7, divide 1 by 0, and get the stats of 1, 2, 3, 4. Then report each result."))
        cap.messages(out["messages"][1:])
        cap.section("a resource, read through adapter.client (langchain.mcp has no resource API)")
        client = adapter.client
        resources = await client.list_resources()
        cap.json([{"uri": str(r.uri), "name": r.name} for r in resources], "list_resources")
        contents = await client.read_resource("docs://readme")
        cap.json([{"uri": str(c.uri), "text": getattr(c, "text", None)} for c in contents], "read_resource")
    cap.section("a string target that is not an http(s) URL")
    cap.attempt("MCPAdapter('server.py')", lambda: MCPAdapter("server.py"))
    import langchain.mcp
    cap.json(sorted(langchain.mcp.__all__), "langchain.mcp exports")


def mcp(cap):
    import logging
    logging.disable(logging.CRITICAL)
    try:
        asyncio.run(mcp_run(cap))
    finally:
        logging.disable(logging.NOTSET)


def deep_agent(cap):
    from deepagents import create_deep_agent
    m = llm("deep")
    with cap.warnings():
        agent = create_deep_agent(model=m, tools=[add], system_prompt="You keep notes.")
    cap.section("graph nodes")
    cap.json(list(agent.get_graph().nodes))
    cap.section("a run: write_file, ls, a general-purpose subagent, then the answer")
    out = agent.invoke(ask("Add 2 and 3 with the add tool. Save the result in /notes.md with write_file. Then call ls on /. Then use the task tool to have a general-purpose subagent check that 2 + 3 is 5. Then answer."), {"recursion_limit": 60})
    cap.messages(out["messages"][1:])
    cap.section("files in state")
    cap.json(out.get("files"))
    cap.section("tools bound on each model call, and what each call saw")
    rows = recorder(m).rows
    cap.json([{"call": row["call"], "tools": row.get("tools"), "first message": row["messages"][0][:120], "message count": len(row["messages"])} for row in rows])
    prompts = []
    for batch in recorder(m).raw:
        text = batch[0].text if batch and batch[0].type == "system" else ""
        if text and text not in prompts:
            prompts.append(text)
    for label, text in zip(("main system prompt", "subagent system prompt"), prompts):
        cap.section(f"{label}: {len(text)} characters, the first 600")
        cap.text(text[:600])


class RecordingSession(requests.Session):
    def __init__(self):
        super().__init__()
        self.seen = []

    def request(self, method, url, *args, **kwargs):
        path = "/" + url.split("://", 1)[-1].partition("/")[2]
        self.seen.append(f"{method} {re.sub(r'[0-9a-f-]{36}', '<run-id>', path)}")
        response = requests.Response()
        response.status_code = 200
        response._content = b"{}"
        response.headers["Content-Type"] = "application/json"
        response.url = url
        return response

    def summary(self):
        counts = {}
        for row in self.seen:
            counts[row] = counts.get(row, 0) + 1
        self.seen.clear()
        return dict(sorted(counts.items()))


def langsmith_trace(cap):
    import langsmith
    from langsmith import traceable, tracing_context
    from langsmith.run_helpers import get_current_run_tree
    from langsmith.utils import tracing_is_enabled

    seen = {}

    @traceable(run_type="tool", name="lookup")
    def lookup(key: str) -> str:
        seen["inner run tree"] = get_current_run_tree()
        return f"value-for-{key}"

    @traceable(name="pipeline", tags=["m101"], metadata={"manual": "langchain-101"})
    def pipeline(question: str) -> dict:
        return {"answer": lookup(question.split()[-1])}

    cap.section("tracing off: traceable is a plain call")
    cap.json({"tracing_is_enabled()": tracing_is_enabled(), "result": pipeline("look up alpha")})
    cap.text(f"get_current_run_tree() inside the call: {seen['inner run tree']!r}")
    cap.section("tracing_context(enabled='local'): run trees are built in memory")
    session = RecordingSession()
    client = langsmith.Client(api_url="http://langsmith.offline.invalid", api_key="offline", session=session, auto_batch_tracing=False)
    trees = []
    with tracing_context(enabled="local", client=client):
        cap.json({"tracing_is_enabled()": tracing_is_enabled()})
        pipeline("look up beta", langsmith_extra={"on_end": trees.append})

    def tree(run):
        return {
            "name": run.name,
            "run_type": run.run_type,
            "id": str(run.id),
            "trace_id": str(run.trace_id),
            "parent_run_id": str(run.parent_run_id) if run.parent_run_id else None,
            "dotted_order": run.dotted_order,
            "inputs": run.inputs,
            "outputs": run.outputs,
            "tags": run.tags,
            "metadata": {k: v for k, v in (run.extra or {}).get("metadata", {}).items() if not k.startswith(("revision_id", "ls_run_depth"))},
            "error": run.error,
            "child_runs": [tree(c) for c in run.child_runs],
        }

    cap.json(tree(trees[0]))
    cap.section("an error inside a traced call")
    errors = []

    @traceable(name="fails")
    def fails():
        raise RuntimeError("tool broke")

    with tracing_context(enabled="local", client=client):
        try:
            fails(langsmith_extra={"on_end": errors.append})
        except RuntimeError as exc:
            cap.text(f"raised {exc!r}")
    cap.json({"name": errors[0].name, "error": errors[0].error.splitlines()[0] if errors[0].error else None})
    client.flush()
    cap.json(session.summary(), "HTTP requests the client received for the traceable runs")
    cap.section("a create_agent run inside a local trace: the LangChain runs are sent to the client")
    agent_trees = []

    @traceable(name="agent_turn")
    def turn(text):
        return create_agent(llm("traced"), tools=[add]).invoke(ask(text))["messages"][-1].content

    with tracing_context(enabled="local", client=client):
        cap.text(f"answer: {turn('What is 2 + 3?', langsmith_extra={'on_end': agent_trees.append})}")
    client.flush()
    from langchain_core.tracers.langchain import wait_for_all_tracers
    wait_for_all_tracers()
    cap.json(session.summary(), "HTTP requests the client received, by method and path")

    def names(run, depth=0):
        rows = [f"{'  ' * depth}{run.run_type} {run.name}"]
        for child in run.child_runs:
            rows.extend(names(child, depth + 1))
        return rows

    cap.text(*names(agent_trees[0]))
    from langchain_core.tracers.context import collect_runs
    cap.section("tracing_context(enabled=False) with collect_runs: the LangChain runs stay in memory")
    with tracing_context(enabled="local", client=client):
        with tracing_context(enabled=False), collect_runs() as collector:
            answer = create_agent(llm("collected"), tools=[add]).invoke(ask("What is 2 + 3?"))["messages"][-1].content
    client.flush()
    wait_for_all_tracers()
    cap.text(f"answer: {answer}")
    cap.json([f"{run.run_type} {run.name}" for run in collector.traced_runs], "collect_runs().traced_runs")
    cap.json(session.summary(), "HTTP requests the client received")
    cap.text(f"langsmith {langsmith.__version__}")
    langsmith_evaluate(cap, client, session)


def langsmith_evaluate(cap, client, session):
    import contextlib
    import datetime
    import io
    import uuid
    from langsmith import evaluate, schemas, tracing_context
    from langchain_core.tracers.langchain import wait_for_all_tracers

    created = datetime.datetime(2026, 11, 14, tzinfo=datetime.timezone.utc)
    dataset = uuid.UUID(int=101)
    sums = [schemas.Example(id=uuid.UUID(int=i + 1), dataset_id=dataset, inputs={"a": a, "b": b}, outputs={"sum": a + b}, created_at=created) for i, (a, b) in enumerate([(2, 3), (4, 4), (1, 1)])]

    def adder(inputs: dict) -> dict:
        return {"sum": inputs["a"] + inputs["b"] + (1 if inputs["a"] == 4 else 0)}

    def exact(outputs: dict, reference_outputs: dict) -> dict:
        return {"key": "exact", "score": outputs["sum"] == reference_outputs["sum"]}

    def accuracy(outputs: list, reference_outputs: list) -> dict:
        hits = sum(o["sum"] == r["sum"] for o, r in zip(outputs, reference_outputs))
        return {"key": "accuracy", "score": hits / len(outputs)}

    def run(target, data, evaluators, summary=()):
        printed = io.StringIO()
        with cap.warnings(), contextlib.redirect_stdout(printed):
            results = evaluate(target, data=data, evaluators=evaluators, summary_evaluators=list(summary), upload_results=False, client=client)
            rows = list(results)
        wait_for_all_tracers()
        client.flush()
        cap.text("stdout: " + re.sub(r"(experiment: %s )\S+", r"\1<experiment-name>", printed.getvalue().strip()))
        cap.json([{"inputs": row["example"].inputs, "outputs": row["run"].outputs, "reference": row["example"].outputs, "scores": {r.key: r.score for r in row["evaluation_results"]["results"]}} for row in rows], "rows")
        if summary:
            cap.json({r.key: r.score for r in results._summary_results["results"]}, "summary evaluators")
        cap.json(session.summary(), "HTTP requests the client received")

    cap.section("evaluate(upload_results=False) on a plain function, three examples")
    run(adder, sums, [exact], [accuracy])
    cap.section("evaluate(upload_results=False) on a create_agent target: the LangChain runs are sent")
    question = [schemas.Example(id=uuid.UUID(int=11), dataset_id=dataset, inputs={"question": "What is 2 + 3?"}, outputs={"answer": "The sum is 5."}, created_at=created)]

    def agent_target(inputs: dict) -> dict:
        return {"answer": create_agent(llm("evaluated"), tools=[add]).invoke(ask(inputs["question"]))["messages"][-1].content}

    def same_answer(outputs: dict, reference_outputs: dict) -> dict:
        return {"key": "same_answer", "score": outputs["answer"] == reference_outputs["answer"]}

    run(agent_target, question, [same_answer])
    cap.section("evaluate(upload_results=False) with the agent inside tracing_context(enabled=False)")

    def quiet_target(inputs: dict) -> dict:
        with tracing_context(enabled=False):
            return agent_target(inputs)

    run(quiet_target, question, [same_answer])


SCENARIOS = [
    ("retrieval", "Splitter, OllamaEmbeddings, and InMemoryVectorStore", retrieval, True),
    ("mcp", "langchain.mcp with an in-process FastMCP server", mcp, True),
    ("deep-agent", "A Deep Agents 0.7 run", deep_agent, True),
    ("langsmith", "langsmith traceable with tracing off and local run trees", langsmith_trace, True),
]

LATE = [
    ("retrieval-agent", "A retriever wrapped as a tool for an agent", retrieval_agent, True),
]
