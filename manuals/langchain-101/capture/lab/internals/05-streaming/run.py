import json
import sys
import threading
import time
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))

from instrument import PIN, summarize
from real import M8B, TimedChatOllama, chat, settings, machine
from typing import ClassVar
from langchain.agents import create_agent
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.config import get_stream_writer

OUT = []
T0 = [0.0]


def now():
    return round((time.perf_counter() - T0[0]) * 1000, 1)


def out(s=""):
    OUT.append(s)
    print(s)


@tool
def get_weather(city: str) -> str:
    """Return the weather for a city."""
    get_stream_writer()({"progress": f"looking up {city}"})
    return f"{city}: sunny"


def part_a_modes():
    out(f"# A. One create_agent run, all stream modes at once, version='v2' (StreamPart dicts). model {settings()}")
    agent = create_agent(chat(), [get_weather], checkpointer=InMemorySaver())
    modes = ["values", "updates", "messages", "custom", "checkpoints", "tasks", "debug"]
    T0[0] = time.perf_counter()
    rows = []
    for part in agent.stream({"messages": [{"role": "user", "content": "What is the weather in Paris?"}]}, {"configurable": {"thread_id": "s"}}, stream_mode=modes, version="v2"):
        t = part["type"]
        d = part["data"]
        if t == "messages":
            msg, meta = d
            desc = f"{type(msg).__name__} chunk text={msg.text!r} node={meta.get('langgraph_node')} step={meta.get('langgraph_step')}"
        elif t == "updates":
            desc = f"keys={list(d)}"
        elif t == "values":
            desc = f"{len(d['messages'])} messages"
        elif t == "checkpoints":
            desc = f"step={d['metadata']['step']} next={d['next']}"
        elif t == "tasks":
            desc = f"{'result' if 'result' in d else 'start'} {d['name']}"
        elif t == "debug":
            desc = f"type={d['type']} step={d['step']}"
        else:
            desc = summarize(d)
        rows.append((now(), t, desc))
        out(f"  {now():>9} ms  {t:<11} {desc}")
    out(f"  keys of one StreamPart: {sorted(part.keys())}")
    out()


class EmitStampedOllama(TimedChatOllama):
    emitted: ClassVar[list] = []

    def _create_chat_stream(self, messages, stop=None, **kwargs):
        for part in super()._create_chat_stream(messages, stop, **kwargs):
            msg = part.get("message") if isinstance(part, dict) else getattr(part, "message", None)
            thinking = (msg.get("thinking") if isinstance(msg, dict) else getattr(msg, "thinking", None)) if msg is not None else None
            content = (msg.get("content") if isinstance(msg, dict) else getattr(msg, "content", None)) if msg is not None else None
            if thinking:
                EmitStampedOllama.emitted.append((now(), "reasoning", thinking))
            if content:
                EmitStampedOllama.emitted.append((now(), "text", content))
            yield part


PROMPT_38484 = "What is 17 times 3? Reply with two short sentences: the answer, then how you checked it."


def consume(pattern):
    EmitStampedOllama.emitted = []
    model = chat(M8B, reasoning=True, num_predict=1024, cls=EmitStampedOllama)
    agent = create_agent(model, [])
    T0[0] = time.perf_counter()
    got = []
    stream = agent.stream_events({"messages": [{"role": "user", "content": PROMPT_38484}]}, version="v3")
    for message in stream.messages:
        if pattern == "reasoning_then_text":
            for d in message.reasoning:
                got.append((now(), "reasoning", d))
            for d in message.text:
                got.append((now(), "text", d))
        elif pattern == "text_only":
            for d in message.text:
                got.append((now(), "text", d))
        elif pattern == "raw_events":
            for ev in message:
                if ev.get("event") == "content-block-delta":
                    delta = ev.get("delta", {})
                    kind = "reasoning" if delta.get("type") == "reasoning-delta" else "text"
                    got.append((now(), kind, delta.get("reasoning") or delta.get("text")))
    return list(EmitStampedOllama.emitted), got


def q(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(p * len(xs)))] if xs else None


def part_b_v3_38484(n=5):
    out("# B. stream_events(version='v3'): reading message.reasoning before message.text (langchain#38484), real reasoning model")
    out(f"model {settings(M8B, reasoning=True, num_predict=1024)}; through create_agent (no tools); prompt {PROMPT_38484!r}; n={n} runs per consumer pattern, patterns interleaved")
    out("emit time = when the Ollama HTTP stream yielded the part (ChatOllama._create_chat_stream); receive time = when the consumer loop got the delta; both ms from the start of stream_events")
    runs = {p: [] for p in ("reasoning_then_text", "text_only", "raw_events")}
    for i in range(n):
        for pattern in runs:
            emitted, got = consume(pattern)
            em = {k: [t for t, kk, _ in emitted if kk == k] for k in ("reasoning", "text")}
            rx = {k: [t for t, kk, _ in got if kk == k] for k in ("reasoning", "text")}
            text_lags = [round(r - e, 1) for r, e in zip(rx["text"], em["text"])]
            reas_lags = [round(r - e, 1) for r, e in zip(rx["reasoning"], em["reasoning"])]
            row = {
                "run": i, "pattern": pattern,
                "emitted": {k: len(v) for k, v in em.items()}, "received": {k: len(v) for k, v in rx.items()},
                "reasoning_emit_ms": [em["reasoning"][0], em["reasoning"][-1]] if em["reasoning"] else None,
                "text_emit_ms": [em["text"][0], em["text"][-1]] if em["text"] else None,
                "text_receive_ms": [rx["text"][0], rx["text"][-1]] if rx["text"] else None,
                "text_emit_spread_ms": round(em["text"][-1] - em["text"][0], 1) if em["text"] else None,
                "text_receive_spread_ms": round(rx["text"][-1] - rx["text"][0], 1) if rx["text"] else None,
                "text_lag_ms_median_max": [q(text_lags, 0.5), max(text_lags)] if text_lags else None,
                "reasoning_lag_ms_median_max": [q(reas_lags, 0.5), max(reas_lags)] if reas_lags else None,
                "first_text_lag_ms": text_lags[0] if text_lags else None,
                "series": {"emit": emitted, "receive": got},
            }
            runs[pattern].append(row)
            out(f"  run {i} {pattern:<20} emitted r/t={row['emitted']['reasoning']}/{row['emitted']['text']} received r/t={row['received']['reasoning']}/{row['received']['text']} "
                f"text emit {row['text_emit_ms']} spread {row['text_emit_spread_ms']} ms; text receive {row['text_receive_ms']} spread {row['text_receive_spread_ms']} ms; "
                f"text lag median/max {row['text_lag_ms_median_max']}; reasoning lag median/max {row['reasoning_lag_ms_median_max']}")
    out()
    summary = {}
    for pattern, rows in runs.items():
        lags = [l for r in rows for l in [rr - ee for (ee, _, _), (rr, _, _) in zip([x for x in r["series"]["emit"] if x[1] == "text"], [x for x in r["series"]["receive"] if x[1] == "text"])]]
        first = [r["first_text_lag_ms"] for r in rows if r["first_text_lag_ms"] is not None]
        rspread = [r["text_receive_spread_ms"] for r in rows if r["text_receive_spread_ms"] is not None]
        espread = [r["text_emit_spread_ms"] for r in rows if r["text_emit_spread_ms"] is not None]
        rlags = [l for r in rows for l in [rr - ee for (ee, _, _), (rr, _, _) in zip([x for x in r["series"]["emit"] if x[1] == "reasoning"], [x for x in r["series"]["receive"] if x[1] == "reasoning"])]]
        summary[pattern] = {
            "n_runs": len(rows),
            "text deltas received / emitted": [sum(r["received"]["text"] for r in rows), sum(r["emitted"]["text"] for r in rows)],
            "text lag ms median, p90, max (all deltas)": [round(q(lags, 0.5), 1), round(q(lags, 0.9), 1), round(max(lags), 1)] if lags else None,
            "first text delta lag ms per run": first,
            "text receive spread ms per run": rspread,
            "text emit spread ms per run": espread,
            "reasoning lag ms median, max": [round(q(rlags, 0.5), 1), round(max(rlags), 1)] if rlags else None,
        }
        out(f"## {pattern}: {json.dumps(summary[pattern])}")
    (HERE / "v3_38484.json").write_text(json.dumps({"settings": settings(M8B, reasoning=True, num_predict=1024), "prompt": PROMPT_38484, "summary": summary, "runs": runs}, indent=1))
    out()


def part_c_who_produces():
    out("# C. Producer of each mode (call stack at the moment the item is put on the stream queue)")
    import traceback
    from langgraph.pregel import main as pmain
    from langgraph._internal import _queue
    seen = {}
    orig = _queue.SyncQueue.put

    def put(self, item, *a, **k):
        mode = item[1] if isinstance(item, tuple) and len(item) == 3 else "?"
        if mode not in seen:
            st = [f for f in traceback.extract_stack()[:-1] if "site-packages" in f.filename]
            seen[mode] = [f"{f.filename.split('site-packages/')[-1]}:{f.lineno} {f.name}" for f in st[-4:]]
        return orig(self, item, *a, **k)

    _queue.SyncQueue.put = put
    try:
        agent = create_agent(chat(), [get_weather], checkpointer=InMemorySaver())
        list(agent.stream({"messages": [{"role": "user", "content": "What is the weather in Paris?"}]}, {"configurable": {"thread_id": "c"}}, stream_mode=["values", "updates", "messages", "custom", "checkpoints", "tasks"]))
    finally:
        _queue.SyncQueue.put = orig
    for mode, frames in seen.items():
        out(f"## {mode}")
        for f in frames:
            out(f"   {f}")
    out()


def main():
    out(f"# Streaming production, real models. pin {PIN}. {machine()}")
    out()
    part_a_modes()
    part_c_who_produces()
    part_b_v3_38484(int(sys.argv[1]) if len(sys.argv) > 1 else 5)
    (HERE / "trace.txt").write_text("\n".join(OUT) + "\n")


if __name__ == "__main__":
    main()
