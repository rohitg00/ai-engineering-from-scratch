import json
import os
import sqlite3
import subprocess
import sys
import time
from pathlib import Path
from typing import Annotated, TypedDict
import operator

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))

from real import TimedChatOllama, chat, settings, machine as rmachine
from instrument import PIN, Recorder, instrument, logging_saver, short_versions, summarize
from langchain.agents import create_agent
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import START, StateGraph

OUT = []
PROMPT = {"messages": [{"role": "user", "content": "Weather in Paris and Oslo?"}]}


def out(s=""):
    OUT.append(s)
    print(s)


@tool
def get_weather(city: str) -> str:
    """Return the weather for a city."""
    return f"{city}: sunny"


def agent_with(saver):
    return create_agent(chat(), [get_weather], checkpointer=saver)


def part_a_call_sequence():
    out("# A. When put / put_writes run, per durability mode (create_agent, 2 parallel tool calls, SqliteSaver)")
    summary = {}
    for mode in ("sync", "async", "exit"):
        db = HERE / f"a_{mode}.sqlite"
        db.unlink(missing_ok=True)
        rec = Recorder()
        conn = sqlite3.connect(str(db), check_same_thread=False)
        saver = logging_saver(SqliteSaver, rec, conn=conn)
        agent = agent_with(saver)
        cfg = {"configurable": {"thread_id": mode}}
        with instrument(rec):
            agent.invoke(PROMPT, cfg, durability=mode)
        rec.dump(HERE / f"a_{mode}.trace.jsonl")
        out(f"## durability={mode}")
        for e in rec.events:
            k = e["event"]
            if k == "tick" and e["returns"]:
                out(f"  [{e['seq']:3}] tick step={e['step']} run={[t['name'] for t in e['tasks_to_run']]}")
            elif k == "loop.put_writes":
                out(f"  [{e['seq']:3}]   task done  {e['task']:<10} -> loop.put_writes {[c for c, _ in e['writes']]}")
            elif k == "saver.put_writes":
                out(f"  [{e['seq']:3}]     SAVER.put_writes ckpt=..{e['against_checkpoint']} task={e['task_id']} channels={e['channels']}")
            elif k == "loop._put_checkpoint":
                out(f"  [{e['seq']:3}]   loop._put_checkpoint source={e['source']} exiting={e['exiting']}")
            elif k == "saver.put":
                out(f"  [{e['seq']:3}]     SAVER.put id=..{e['checkpoint_id']} parent=..{e['parent_id']} step={e['step']} source={e['source']}")
        n_put = sum(1 for e in rec.events if e["event"] == "saver.put")
        n_pw = sum(1 for e in rec.events if e["event"] == "saver.put_writes")
        rows_c = conn.execute("select count(*) from checkpoints").fetchone()[0]
        rows_w = conn.execute("select count(*) from writes").fetchone()[0]
        summary[mode] = {"saver.put": n_put, "saver.put_writes": n_pw, "checkpoint rows": rows_c, "writes rows": rows_w}
        calls_ = TimedChatOllama.calls[-2:]
        summary[mode]["model calls"] = [{"s": round(c["model_s"], 2), "tool_calls": c["n_tool_calls"]} for c in calls_]
        out(f"  totals: {summary[mode]}")
        conn.close()
    out()
    out("summary: " + json.dumps(summary))
    out()


def part_b_dump_rows():
    out("# B. Row dump, durability=async SqliteSaver (a_async.sqlite)")
    conn = sqlite3.connect(str(HERE / "a_async.sqlite"))
    saver = SqliteSaver(conn)
    out("## checkpoints table")
    for cid, pid, typ, blob, meta in conn.execute("select checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata from checkpoints order by checkpoint_id"):
        ck = saver.serde.loads_typed((typ, blob))
        m = json.loads(meta)
        out(f"- id=..{cid[-12:]} parent=..{(pid or '')[-12:]} step={m['step']} source={m['source']} bytes={len(blob)} type={typ}")
        out(f"    channel_values: {json.dumps({k: summarize(v) for k, v in ck['channel_values'].items()}, default=str)[:400]}")
        out(f"    channel_versions: {short_versions(ck['channel_versions'])}")
        out(f"    versions_seen: { {k: short_versions(v) for k, v in ck['versions_seen'].items()} }")
        out(f"    updated_channels: {ck.get('updated_channels')}  v={ck['v']}")
    out("## writes table (pending writes, keyed to the checkpoint the superstep STARTED from)")
    for cid, tid, tpath, idx, ch, typ, val in conn.execute("select checkpoint_id, task_id, task_path, idx, channel, type, value from writes order by checkpoint_id, task_path, task_id, idx"):
        out(f"- ckpt=..{cid[-12:]} task={tid[:8]} path={tpath!r} idx={idx} channel={ch} value={summarize(saver.serde.loads_typed((typ, val)))}")
    conn.close()
    out()


def part_c_inmemory_layout():
    out("# C. InMemorySaver layout: storage / writes / blobs")
    saver = InMemorySaver()
    agent = agent_with(saver)
    cfg = {"configurable": {"thread_id": "m"}}
    agent.invoke(PROMPT, cfg)
    n_ck = sum(len(v) for ns in saver.storage.values() for v in ns.values())
    out(f"storage: {n_ck} checkpoints; each value = (serialized checkpoint WITHOUT channel_values, metadata, parent_id)")
    out(f"blobs: {len(saver.blobs)} entries keyed (thread, ns, channel, version):")
    for (t, ns, ch, ver), (typ, b) in sorted(saver.blobs.items(), key=lambda kv: (kv[0][2], kv[0][3])):
        out(f"   {ch:<18} v={int(ver.split('.')[0]):>2} type={typ:<8} bytes={len(b)}")
    out(f"writes: {sum(len(v) for v in saver.writes.values())} entries in {len(saver.writes)} (thread, ns, checkpoint_id) buckets")
    out("SqliteSaver.put serializes the whole checkpoint dict, channel_values included, per row (checkpoint-sqlite/.../sqlite/__init__.py:428-449); it ignores new_versions. InMemorySaver.put stores only channels in new_versions as blobs (checkpoint/.../memory/__init__.py:430-470).")
    out()


def main():
    out(f"# Checkpoint write path, real model. pin {PIN}. {rmachine()}")
    out(f"# model {settings()}; prompt {PROMPT}")
    out()
    part_a_call_sequence()
    part_b_dump_rows()
    part_c_inmemory_layout()
    (HERE / "trace.txt").write_text("\n".join(OUT) + "\n")


if __name__ == "__main__":
    main()
