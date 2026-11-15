import json
import sqlite3
import statistics
import sys
import time
from pathlib import Path
from typing import Annotated

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
from instrument import PIN, Recorder, instrument, logging_saver
from pager import SYSTEM, USER, TOOL_FN_S, make_reader
from real import TimedChatOllama, chat, machine, settings
from langchain.agents import AgentState, create_agent
from langgraph.channels.delta import DeltaChannel
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph.message import _messages_delta_reducer

K = int(sys.argv[1]) if len(sys.argv) > 1 else 100
NUM_CTX = 16384
WORK = Path.home() / "ir-work" / "growth"
WORK.mkdir(parents=True, exist_ok=True)
OUT = []


def out(s=""):
    OUT.append(s)
    print(s, flush=True)


class DState(AgentState):
    messages: Annotated[list, DeltaChannel(_messages_delta_reducer)]


def at(xs, idx=(1, 50, 100, 150, 200)):
    return [xs[i] for i in idx if i < len(xs)]


def run(label):
    rec = Recorder()
    conn = db = None
    if label == "memory":
        saver = logging_saver(InMemorySaver, rec, capture=False)
    else:
        db = WORK / f"{label}.sqlite"
        for p in (db, Path(str(db) + "-wal"), Path(str(db) + "-shm")):
            p.unlink(missing_ok=True)
        conn = sqlite3.connect(str(db), check_same_thread=False)
        saver = logging_saver(SqliteSaver, rec, capture=False, conn=conn)
    kw = {"state_schema": DState} if label == "sqlite-delta" else {}
    agent = create_agent(chat(num_ctx=NUM_CTX), [make_reader(K)], system_prompt=SYSTEM, checkpointer=saver, **kw)
    cfg = {"configurable": {"thread_id": "g"}, "recursion_limit": 4 * K + 50}
    n0 = len(TimedChatOllama.calls)
    t0 = time.perf_counter()
    with instrument(rec, capture=False):
        res = agent.invoke({"messages": [{"role": "user", "content": USER}]}, cfg, durability="sync")
    wall = time.perf_counter() - t0
    calls = TimedChatOllama.calls[n0:]
    msgs = res["messages"]
    tool_msgs = [m for m in msgs if m.type == "tool"]
    errors = sum(1 for m in tool_msgs if m.text.startswith("error"))
    multi = sum(1 for c in calls if (c["n_tool_calls"] or 0) > 1)
    puts = [round(x * 1e6) for x in rec.timings["saver.put"]]
    row = {"label": label, "wall_s": round(wall, 1), "model_calls": len(calls), "model_s_total": round(sum(c["model_s"] for c in calls), 1),
           "tool_round_trips": len(tool_msgs), "tool_errors (bad cursor)": errors, "model calls with >1 tool call": multi,
           "last_message": msgs[-1].text[:80], "messages_at_end": len(msgs),
           "prompt_tokens_last_call": calls[-1]["prompt_eval_count"] if calls else None,
           "saver_put_us_at": at(puts), "saver_put_us_all": puts, "supersteps": len(rec.timings["apply_writes"])}
    out(f"## {label}: {len(tool_msgs)} tool round trips ({errors} bad cursors, {multi} model calls with more than one tool call), {len(calls)} model calls, "
        f"{len(msgs)} messages, last {row['last_message']!r}, wall {row['wall_s']} s, model {row['model_s_total']} s, last prompt {row['prompt_tokens_last_call']} tokens")
    out(f"   saver.put us at checkpoint #1, #50, #100, #150, #200: {row['saver_put_us_at']} (sync, in the background executor, awaited)")
    if conn is not None:
        sizes = [r[0] for r in conn.execute("select length(checkpoint) from checkpoints order by checkpoint_id")]
        wrows, wbytes = conn.execute("select count(*), sum(length(value)) from writes").fetchone()
        mbytes = conn.execute("select sum(length(value)) from writes where channel='messages'").fetchone()[0]
        row.update({"row_bytes": sizes, "rows": len(sizes), "checkpoint_bytes_total": sum(sizes), "writes_rows": wrows, "writes_bytes": wbytes,
                    "writes_bytes_messages_channel": mbytes})
        out(f"   checkpoint rows={len(sizes)} total bytes={sum(sizes)}; row bytes at #1, #50, #100, #150, #200: {at(sizes)}; largest {max(sizes)}; mean {round(statistics.mean(sizes))}")
        out(f"   writes rows={wrows} bytes={wbytes} (messages channel {mbytes}); checkpoints + writes = {sum(sizes) + wbytes} bytes; checkpoints / writes = {round(sum(sizes) / wbytes, 1)}")
        for _ in range(3):
            agent.get_state({"configurable": {"thread_id": "g"}})
        reads = []
        for _ in range(30):
            t = time.perf_counter()
            st = agent.get_state({"configurable": {"thread_id": "g"}})
            reads.append((time.perf_counter() - t) * 1000)
        row["get_state_ms_median_p10_p90"] = [round(statistics.median(reads), 2), round(sorted(reads)[3], 2), round(sorted(reads)[26], 2)]
        row["get_state_messages"] = len(st.values["messages"])
        out(f"   get_state at the end, 30 reads after 3 warmups: median {row['get_state_ms_median_p10_p90'][0]} ms (p10 {row['get_state_ms_median_p10_p90'][1]}, p90 {row['get_state_ms_median_p10_p90'][2]}); {row['get_state_messages']} messages")
        conn.close()
    else:
        blobs = saver.blobs
        blob_bytes = sum(len(b) for _, b in blobs.values())
        msg_bytes = sum(len(b) for key, (_, b) in blobs.items() if key[2] == "messages")
        n_ck = sum(len(v) for ns in saver.storage.values() for v in ns.values())
        ck_bytes = sum(len(c[0][1]) for ns in saver.storage.values() for v in ns.values() for c in v.values())
        wbytes = sum(len(w[2][1]) for v in saver.writes.values() for w in v.values())
        msg_versions = sorted(((int(k[3].split(".")[0]), len(b)) for k, (_, b) in blobs.items() if k[2] == "messages"))
        row.update({"blob_entries": len(blobs), "blob_bytes": blob_bytes, "messages_blob_bytes": msg_bytes, "checkpoints": n_ck,
                    "checkpoint_bytes_without_values": ck_bytes, "writes_bytes": wbytes, "messages_blob_bytes_by_version": msg_versions})
        out(f"   InMemorySaver: {n_ck} checkpoints ({ck_bytes} bytes without channel values); blobs {len(blobs)} entries, {blob_bytes} bytes, of which messages {msg_bytes} bytes "
            f"in {len(msg_versions)} versions; messages blob at version #1, #50, #100: {[msg_versions[i][1] for i in (1, 50, 100) if i < len(msg_versions)]}, last {msg_versions[-1][1]}; writes {wbytes} bytes")
    return row


def main():
    out(f"# Checkpoint growth over {K} real tool round trips, create_agent, durability=sync. pin {PIN}.")
    out(f"# {machine()}")
    out(f"# model {settings(num_ctx=NUM_CTX)}")
    out(f"# task: read_page cursor tool, {K} pages, each page names the next cursor (a sha1 prefix), so the model must make one call per turn. system prompt: {SYSTEM!r}")
    out("# sqlite-delta: create_agent(state_schema=AgentState subclass with messages: Annotated[list, DeltaChannel(_messages_delta_reducer)]), default snapshot_frequency")
    out()
    rows = {}
    for label in ("sqlite", "memory", "sqlite-delta"):
        rows[label] = run(label)
        out()
    (HERE / "growth.json").write_text(json.dumps({"k": K, "settings": settings(num_ctx=NUM_CTX), "machine": machine(), "rows": rows}, indent=1))
    (HERE / "trace.txt").write_text("\n".join(OUT) + "\n")


if __name__ == "__main__":
    main()
