import asyncio
import json
import subprocess
import sys
import threading
import uuid
from http.server import ThreadingHTTPServer
from pathlib import Path

from langgraph.store.postgres.aio import AsyncPostgresStore

from tests.procs import DSN, Http, Server, free_port, reset_user
from tests.test_smith_off import Recorder

REFUND = "Please refund order ORD-smith-3 in full, 2400 cents. Reason: the bottle leaks."


def uptime():
    return subprocess.run(["uptime"], capture_output=True, text=True).stdout.strip()


async def smith(run_dir):
    port = free_port()
    recorder = ThreadingHTTPServer(("127.0.0.1", port), Recorder)
    threading.Thread(target=recorder.serve_forever, daemon=True).start()
    endpoint = f"http://127.0.0.1:{port}"
    base = {"LANGSMITH_ENDPOINT": endpoint, "LANGCHAIN_ENDPOINT": endpoint, "LANGSMITH_API_KEY": "lsv2_pt_fake"}
    out = {}
    for label, flag in [("enabled_control", "true"), ("disabled", "false"), ("unset", None)]:
        reset_user("smith")
        before = len(Recorder.seen)
        server = Server(run_dir, f"smith-{label}", AUTH_TOKENS="tok-smith=smith",
                        **base, LANGSMITH_TRACING=flag, LANGCHAIN_TRACING_V2=flag)
        client = Http(server.url, "tok-smith")
        thread = await client.thread()
        first = await client.say(thread, "How long does shipping take?")
        second = await client.say(thread, REFUND)
        asked = [d for e, d in second if e == "interrupt"]
        if asked:
            await client.approve(thread, "reject")
        server.stop()
        await asyncio.sleep(1.0)
        rows = Recorder.seen[before:]
        out[label] = {"requests": len(rows), "paths": sorted({r["path"] for r in rows}),
                      "bytes": sum(r["bytes"] for r in rows), "refund_proposed": bool(asked),
                      "tool_calls": [d["name"] for e, d in first + second if e == "tool_call"]}
    recorder.shutdown()
    return out


async def isolation(run_dir):
    for user in ("alice", "bob"):
        reset_user(user)
    store_cm = AsyncPostgresStore.from_conn_string(DSN)
    async with store_cm as store:
        for user in ("alice", "bob"):
            for item in await store.asearch(("memories", user), limit=100):
                await store.adelete(("memories", user), item.key)
        await store.aput(("memories", "alice"), str(uuid.uuid4()), {"text": "door code is 4471"})
    server = Server(run_dir, "isolation", AUTH_TOKENS="tok-alice=alice,tok-bob=bob")
    alice, bob = Http(server.url, "tok-alice"), Http(server.url, "tok-bob")
    thread = await alice.thread()
    await alice.say(thread, f"Where is my order ORD-alice-1?")
    out = {
        "bob_state": (await bob.http.get(f"/threads/{thread}/state")).status_code,
        "bob_run": (await bob.http.post(f"/threads/{thread}/runs", json={"message": "hi"})).status_code,
        "bob_approve": (await bob.http.post(f"/threads/{thread}/approve", json={"decision": "approve"})).status_code,
        "bob_memories": (await bob.http.get("/memories")).json()["memories"],
        "alice_memories": (await alice.http.get("/memories")).json()["memories"],
    }
    bob_thread = await bob.thread()
    bob_events = await bob.say(bob_thread, "What do you remember about me? List every saved note.")
    alice_thread = await alice.thread()
    alice_events = await alice.say(alice_thread, "What do you remember about me? List every saved note.")
    bob_state = await bob.state(bob_thread)
    out["bob_tool_calls"] = [d["name"] for e, d in bob_events if e == "tool_call"]
    out["bob_recall_results"] = [d["content"] for e, d in bob_events if e == "tool_result" and d["name"] == "recall_notes"]
    out["bob_sees_4471"] = "4471" in json.dumps(bob_state)
    out["alice_tool_calls"] = [d["name"] for e, d in alice_events if e == "tool_call"]
    out["alice_recall_results"] = [d["content"] for e, d in alice_events if e == "tool_result" and d["name"] == "recall_notes"]
    out["alice_reply"] = "".join(d["text"] for e, d in alice_events if e == "token")
    server.stop()
    return out


async def main(run_dir):
    Path(run_dir).mkdir(parents=True, exist_ok=True)
    report = {"uptime_before": uptime(), "smith": await smith(run_dir), "isolation": await isolation(run_dir),
              "uptime_after": uptime()}
    (Path(run_dir) / "service-properties.json").write_text(json.dumps(report, indent=1))
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
