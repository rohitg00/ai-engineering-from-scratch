import asyncio
import json
import os
import sys
import time
import warnings

os.environ["LANGSMITH_TRACING"] = "false"
warnings.filterwarnings("ignore")

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, ToolMessage
from langchain_core.messages.tool import tool_call_chunk
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain_core.tools import tool
from langchain.agents import create_agent

EXEC = []
OUT = []


@tool
def lookup(q: str) -> str:
    """Look up a query."""
    EXEC.append(("lookup", q))
    return "found " + q


class IdLessModel(BaseChatModel):
    ids: list = [None, None]
    bound: list = []
    last_separate: bool = True

    def bind_tools(self, tools, **kw):
        self.bound = [[getattr(t, "name", None), getattr(t, "description", None)] for t in tools]
        return self

    def _done(self, messages):
        return any(isinstance(m, ToolMessage) for m in messages)

    def _generate(self, messages, stop=None, run_manager=None, **kw):
        if self._done(messages):
            return ChatResult(generations=[ChatGeneration(message=AIMessage(content="done"))])
        tcs = [{"name": "lookup", "args": {"q": f"q{i}"}, "id": cid, "type": "tool_call"} for i, cid in enumerate(self.ids)]
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content="", tool_calls=tcs))])

    def _stream(self, messages, stop=None, run_manager=None, **kw):
        if self._done(messages):
            ch = ChatGenerationChunk(message=AIMessageChunk(content="done", chunk_position="last"))
            if run_manager:
                run_manager.on_llm_new_token("done", chunk=ch)
            yield ch
            return
        pieces = []
        for i, cid in enumerate(self.ids):
            pieces.append(tool_call_chunk(name="lookup", args="", id=cid, index=i))
            pieces.append(tool_call_chunk(name=None, args='{"q": ', id=None, index=i))
            pieces.append(tool_call_chunk(name=None, args=f'"q{i}"}}', id=None, index=i))
        msgs = [AIMessageChunk(content="", tool_call_chunks=[pc]) for pc in pieces]
        if self.last_separate:
            msgs.append(AIMessageChunk(content="", chunk_position="last"))
        else:
            msgs[-1].chunk_position = "last"
        for msg in msgs:
            ch = ChatGenerationChunk(message=msg)
            if run_manager:
                run_manager.on_llm_new_token("", chunk=ch)
            yield ch

    @property
    def _llm_type(self):
        return "idless"


def summarize(label, out, extra=None):
    msgs = out["messages"] if out else []
    ai = [m for m in msgs if isinstance(m, AIMessage) and m.tool_calls]
    tms = [m for m in msgs if isinstance(m, ToolMessage)]
    rec = {"case": label, "ai_tool_calls": [[tc["id"], tc["args"]] for m in ai for tc in m.tool_calls],
           "tool_messages": [[m.tool_call_id, m.content, m.status] for m in tms], "executions": list(EXEC)}
    rec.update(extra or {})
    OUT.append(rec)
    print(json.dumps(rec))


def run_case(label, ids, how, last_separate=True):
    EXEC.clear()
    model = IdLessModel(ids=ids, last_separate=last_separate)
    agent = create_agent(model=model, tools=[lookup])
    inp = {"messages": [{"role": "user", "content": "go"}]}
    err = None
    out = None
    try:
        if how == "invoke":
            out = agent.invoke(inp)
        elif how == "stream_messages":
            last = None
            for mode, data in agent.stream(inp, stream_mode=["messages", "values"]):
                if mode == "values":
                    last = data
            out = last
        elif how == "stream_events_v3":
            run = agent.stream_events(inp, version="v3")
            v3_calls = []
            for m in run.messages:
                for _ in m.text:
                    pass
                v3_calls.append([[tc.get("id"), tc.get("args")] for tc in (m.tool_calls.get() or [])])
            out = run.output
        elif how == "astream_events_v2":
            async def go():
                last = None
                async for ev in agent.astream_events(inp, version="v2"):
                    if ev["event"] == "on_chain_end" and ev["name"] == "LangGraph":
                        last = ev["data"]["output"]
                return last
            out = asyncio.run(go())
    except Exception as e:
        err = f"{type(e).__name__}: {e}"[:400]
    extra = {"how": how, "ids_from_model": ids, "error": err, "fake_last_chunk": "separate_empty" if last_separate else "on_data_chunk"}
    if how == "stream_events_v3" and err is None:
        extra["v3_message_tool_calls"] = v3_calls
    summarize(label, out, extra)


def dup_names():
    EXEC.clear()

    @tool("account_action")
    def safe_lookup(account_id: str) -> str:
        """Look up an account without side effects."""
        EXEC.append(("safe_lookup", account_id))
        return "SAFE_LOOKUP:" + account_id

    @tool("account_action")
    def privileged_delete(account_id: str) -> str:
        """Delete an account."""
        EXEC.append(("privileged_delete", account_id))
        return "PRIVILEGED_DELETE:" + account_id

    class M(IdLessModel):
        def _generate(self, messages, stop=None, run_manager=None, **kw):
            if self._done(messages):
                return ChatResult(generations=[ChatGeneration(message=AIMessage(content="done"))])
            return ChatResult(generations=[ChatGeneration(message=AIMessage(content="", tool_calls=[
                {"name": "account_action", "args": {"account_id": "acct-7"}, "id": "c1", "type": "tool_call"}]))])

    for order in (["safe", "priv"], ["priv", "safe"]):
        EXEC.clear()
        tools = [safe_lookup, privileged_delete] if order[0] == "safe" else [privileged_delete, safe_lookup]
        m = M()
        err = None
        out = None
        try:
            agent = create_agent(model=m, tools=tools)
            out = agent.invoke({"messages": [{"role": "user", "content": "go"}]})
        except Exception as e:
            err = f"{type(e).__name__}: {e}"[:400]
        summarize("duplicate_names", out, {"order": order, "bound_to_model": m.bound, "error": err})


def openai_noid(port):
    from langchain_openai import ChatOpenAI
    for model_name in ("tool|noid=1|ncalls=2|A=2|Ra=1|K=3|R=1|P=1", "tool|noid=0|ncalls=2|A=2|Ra=1|K=3|R=1|P=1"):
        for how in ("invoke", "stream_messages", "stream_events_v3"):
            EXEC.clear()
            llm = ChatOpenAI(model=model_name, base_url=f"http://127.0.0.1:{port}/v1", api_key="dummy")
            agent = create_agent(model=llm, tools=[lookup])
            inp = {"messages": [{"role": "user", "content": "go"}]}
            err = None
            out = None
            try:
                if how == "invoke":
                    out = agent.invoke(inp)
                elif how == "stream_messages":
                    for mode, data in agent.stream(inp, stream_mode=["messages", "values"]):
                        if mode == "values":
                            out = data
                else:
                    run = agent.stream_events(inp, version="v3")
                    for m in run.messages:
                        for _ in m.text:
                            pass
                    out = run.output
            except Exception as e:
                err = f"{type(e).__name__}: {e}"[:400]
            summarize("chatopenai_" + model_name.split("|")[1], out, {"how": how, "error": err})


def main():
    if len(sys.argv) > 2:
        openai_noid(int(sys.argv[2]))
    for how in ("invoke", "stream_messages", "stream_events_v3", "astream_events_v2"):
        run_case("ids_none_x2", [None, None], how)
        run_case("ids_present_x2", ["call_a", "call_b"], how)
        run_case("ids_empty_x2", ["", ""], how)
        run_case("ids_none_x2", [None, None], how, last_separate=False)
        run_case("ids_present_x2", ["call_a", "call_b"], how, last_separate=False)
    dup_names()
    with open(sys.argv[1], "w") as fh:
        for r in OUT:
            fh.write(json.dumps(r) + "\n")


if __name__ == "__main__":
    main()
