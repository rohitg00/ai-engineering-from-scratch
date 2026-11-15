import asyncio
import json
import subprocess
import sys
import time
from pathlib import Path

import httpx

from tests.procs import Server

ASK = "How long does shipping take?"


async def trial(http, n):
    thread = (await http.post("/threads")).json()["thread_id"]
    started = time.perf_counter()
    first = None
    async with http.stream("POST", f"/threads/{thread}/runs", json={"message": ASK}) as response:
        async for line in response.aiter_lines():
            if line.startswith("event: "):
                first = line[7:]
                break
    closed_ms = round((time.perf_counter() - started) * 1000, 1)
    busy = (await http.post(f"/threads/{thread}/runs", json={"message": "Hello?"})).status_code
    deadline = time.time() + 120
    state = None
    while time.time() < deadline:
        state = (await http.get(f"/threads/{thread}/state")).json()
        last = state["messages"][-1] if state["messages"] else {}
        if state["next"] == [] and last.get("type") == "ai" and not last.get("tool_calls"):
            break
        await asyncio.sleep(0.2)
    return {"trial": n, "first_event": first, "client_closed_ms": closed_ms, "post_while_running": busy,
            "finished_after_disconnect_ms": round((time.perf_counter() - started) * 1000, 1),
            "messages": [m["type"] for m in state["messages"]], "next": state["next"],
            "tools": [m["name"] for m in state["messages"] if m["type"] == "tool"]}


async def main(run_dir, trials="5"):
    out = Path(run_dir)
    out.mkdir(parents=True, exist_ok=True)
    uptime = subprocess.run(["uptime"], capture_output=True, text=True).stdout.strip()
    server = Server(out, "disconnect", AUTH_TOKENS="tok-dc=dc")
    rows = []
    async with httpx.AsyncClient(base_url=server.url, headers={"Authorization": "Bearer tok-dc"}, timeout=120) as http:
        for n in range(1, int(trials) + 1):
            rows.append(await trial(http, n))
            print(json.dumps(rows[-1]), flush=True)
    server.stop()
    log = [json.loads(l) for l in (out / "disconnect.log.jsonl").read_text().splitlines() if l]
    ends = [e for e in log if e["event"] == "run.end"]
    (out / "disconnect-trials.json").write_text(json.dumps({"uptime": uptime, "trials": rows, "run_end_events": ends}, indent=1))


if __name__ == "__main__":
    asyncio.run(main(*sys.argv[1:]))
