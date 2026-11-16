import json
import os
import socket
import threading
import urllib.request

from langchain.tools import ToolRuntime, tool
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.decisions import BaseDecisionModel, ClassifierResponse
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama, OllamaEmbeddings
from pydantic import Field

MODEL = "qwen3:4b-instruct-2507-q4_K_M"
REASONING_MODEL = "qwen3:8b"
EMBED_MODEL = "nomic-embed-text"
SEED = 42
NUM_CTX = 16384
NUM_PREDICT = 512
OLLAMA_URL = os.environ.get("LC101_OLLAMA_URL", "http://127.0.0.1:11434")
DEAD_URL = "http://127.0.0.1:9"
USED = set()
EMBEDDED = set()

ASK = {"messages": [{"role": "user", "content": "What is 2 + 3?"}]}


def ask(text):
    return {"messages": [{"role": "user", "content": text}]}


def thread(name):
    return {"configurable": {"thread_id": name}}


@tool
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


@tool
def lookup_order(order_id: str, runtime: ToolRuntime) -> str:
    """Look up an order by its id."""
    runtime.stream_writer({"lookup": order_id})
    context = runtime.context
    user = context.get("user", "anonymous") if isinstance(context, dict) else getattr(context, "user", "anonymous")
    return f"order {order_id}: shipped (asked by {user}, tool_call_id={runtime.tool_call_id})"


@tool
def flaky_disk(path: str) -> str:
    """Read a file from a disk that always fails."""
    raise RuntimeError("disk on fire")


def describe(m):
    if m.text:
        return f"{m.type}: {m.text[:80]}"
    calls = getattr(m, "tool_calls", None)
    if calls:
        return f"{m.type}: calls " + ", ".join(c["name"] for c in calls)
    return m.type


class Recorder(BaseCallbackHandler):
    def __init__(self, label, sink=None):
        self.label = label
        self.rows = []
        self.raw = []
        self.sink = sink

    def on_chat_model_start(self, serialized, messages, **kwargs):
        batch = messages[0]
        params = kwargs.get("invocation_params") or {}
        row = {"model": self.label, "call": len(self.rows) + 1, "messages": [describe(m) for m in batch]}
        tools = params.get("tools")
        if tools:
            row["tools"] = [t.get("function", {}).get("name") or t.get("name") for t in tools]
        shape = params.get("format") or params.get("response_format")
        if shape:
            row["format"] = shape if isinstance(shape, str) else "json schema"
        self.rows.append(row)
        self.raw.append(list(batch))
        USED.add((kwargs.get("metadata") or {}).get("ls_model_name") or params.get("model") or "unknown")
        if self.sink is not None:
            self.sink.append("  model called")


def llm(label="agent", model=MODEL, base_url=None, sink=None, **kwargs):
    return ChatOllama(
        model=model,
        base_url=base_url or OLLAMA_URL,
        temperature=0,
        seed=SEED,
        num_ctx=NUM_CTX,
        num_predict=NUM_PREDICT,
        callbacks=[Recorder(label, sink)],
        client_kwargs={"timeout": 900},
        **kwargs,
    )


def embeddings():
    EMBEDDED.add(EMBED_MODEL)
    return OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_URL)


def dead(label):
    return llm(label, base_url=DEAD_URL)


def recorder(m):
    return m.callbacks[0]


def show_log(cap, *models):
    rows = []
    for m in models:
        rows.extend(recorder(m).rows)
    cap.json(rows, "model calls, as the model received them")


def ollama_version():
    try:
        with urllib.request.urlopen(OLLAMA_URL + "/api/version", timeout=5) as response:
            return json.load(response).get("version", "unknown")
    except OSError:
        return None


class FlakyEndpoint:
    def __init__(self, fail_first):
        self.fail_first = fail_first
        self.accepted = 0
        host, port = OLLAMA_URL.split("://", 1)[1].split(":")
        self.target = (host, int(port))
        self.listener = socket.socket()
        self.listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.listener.bind(("127.0.0.1", 0))
        self.listener.listen(8)
        self.url = f"http://127.0.0.1:{self.listener.getsockname()[1]}"
        threading.Thread(target=self.serve, daemon=True).start()

    def serve(self):
        while True:
            try:
                conn, _ = self.listener.accept()
            except OSError:
                return
            self.accepted += 1
            if self.accepted <= self.fail_first:
                conn.close()
                continue
            try:
                upstream = socket.create_connection(self.target)
            except OSError:
                conn.close()
                continue
            for a, b in ((conn, upstream), (upstream, conn)):
                threading.Thread(target=self.pump, args=(a, b), daemon=True).start()

    @staticmethod
    def pump(src, dst):
        try:
            while data := src.recv(65536):
                dst.sendall(data)
        except OSError:
            pass
        finally:
            for s in (src, dst):
                try:
                    s.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass

    def close(self):
        self.listener.close()


def state_json(value):
    if isinstance(value, BaseMessage):
        out = {"type": value.type, "content": value.text}
        if getattr(value, "tool_calls", None):
            out["tool_calls"] = [{"name": c["name"], "args": c["args"]} for c in value.tool_calls]
        return out
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    return str(value)


class OllamaDecisionModel(BaseDecisionModel):
    model: str = MODEL
    log: list[dict] = Field(default_factory=list, exclude=True)

    @property
    def _provider(self):
        return "ollama"

    def _classify(self, state, questions):
        call = state.get("tool_call") if isinstance(state, dict) else None
        entry = {"questions": {key: q.model_dump(mode="json") for key, q in questions.items()}}
        if call:
            entry["tool_call"] = {"name": call.get("name"), "args": call.get("args")}
        self.log.append(entry)
        answers = {}
        chat = llm("classifier", format="json")
        for key, question in questions.items():
            spec = question.model_dump(mode="json")
            kind = spec.get("type")
            if kind == "choice":
                shape = '{"choice": "<one label>", "probabilities": {"<label>": <0..1>, ...}, "confidence": <0..1>}'
            else:
                shape = '{"probability": <0..1>}'
            prompt = [
                SystemMessage(f"You answer one classification question about the state below. Reply with JSON only, in this shape: {shape}"),
                HumanMessage(f"Question:\n{json.dumps(spec, indent=1)}\n\nState:\n{json.dumps(state, default=state_json, indent=1)[:6000]}"),
            ]
            reply = json.loads(chat.invoke(prompt).text)
            if kind == "choice":
                answers[key] = {"type": "choice", "choice": reply["choice"], "probabilities": reply.get("probabilities") or {reply["choice"]: 1.0}, "confidence": reply.get("confidence", 1.0)}
            else:
                answers[key] = {"type": "noul", "noul": float(reply["probability"])}
        entry["answers"] = answers
        return ClassifierResponse.model_validate({"model": self.model, "answers": answers})
