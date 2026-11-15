import asyncio
import json
import subprocess
import sys
import time
from pathlib import Path

from tests.procs import Http, Server

ASK = "How long does shipping take?"


def uptime():
    return subprocess.run(["uptime"], capture_output=True, text=True).stdout.strip()


def faq_answer(state):
    last = state["messages"][-1]
    faq = [m for m in state["messages"] if m["type"] == "tool" and m["name"] == "search_faq"]
    return state["next"] == [] and last["type"] == "ai" and not last["tool_calls"] and len(faq) == 1


async def trial(run_dir, mode, n, delay):
    name = f"{mode}-{n:02d}"
    graceful, drain = (20, 20) if mode == "finish" else (1, 0.05)
    server = Server(run_dir, name, graceful=graceful, AUTH_TOKENS="tok-drain=drain", DRAIN_SECONDS=drain)
    client = Http(server.url, "tok-drain")
    thread = await client.thread()
    running = asyncio.create_task(client.say(thread, ASK))
    await asyncio.sleep(delay)
    signalled = time.time()
    exit_code = await asyncio.to_thread(server.term)
    shutdown_s = time.time() - signalled
    try:
        events = await running
        client_tail = events[-1]
    except Exception as exc:
        client_tail = ["client_error", type(exc).__name__]
    server.log.close()
    log = (Path(run_dir) / f"{name}.log.jsonl").read_text().splitlines()
    shutdown = [json.loads(line) for line in log if '"shutdown.' in line]
    server = Server(run_dir, f"{name}-resume", AUTH_TOKENS="tok-drain=drain")
    client = Http(server.url, "tok-drain")
    before = await client.state(thread)
    row = {"mode": mode, "trial": n, "sigterm_after_s": delay, "exit_code": exit_code, "shutdown_s": round(shutdown_s, 3),
           "client_tail": client_tail, "shutdown_events": [e["event"] + str(e.get("cancelled", "")) for e in shutdown],
           "next_after_restart": before["next"], "messages_after_restart": [m["type"] for m in before["messages"]],
           "answered_before_restart": faq_answer(before)}
    if before["next"]:
        resumed = await client.approve(thread)
        after = await client.state(thread)
        row["resumed_last_event"] = resumed[-1]
        row["answered_after_resume"] = faq_answer(after)
    server.stop()
    row["uptime"] = uptime()
    return row


async def main(run_dir, trials="5", cancel_delay="0.3"):
    Path(run_dir).mkdir(parents=True, exist_ok=True)
    rows = []
    for mode, delay in (("finish", 0.3), ("cancel", float(cancel_delay))):
        for n in range(1, int(trials) + 1):
            row = await trial(run_dir, mode, n, delay)
            rows.append(row)
            print(json.dumps({k: row[k] for k in ("mode", "trial", "client_tail", "shutdown_events", "next_after_restart")}
                             | {"resumed": row.get("answered_after_resume"), "answered": row["answered_before_restart"]}), flush=True)
            (Path(run_dir) / "drain-trials.json").write_text(json.dumps(rows, indent=1, default=str))


if __name__ == "__main__":
    asyncio.run(main(*sys.argv[1:]))
