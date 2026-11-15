import asyncio
import json
import subprocess
import sys
import time
from pathlib import Path

import httpx

from tests.procs import Server, reset_user

TURNS = [
    ("runs", {"message": "Where is my order ORD-cap-2?"}),
    ("runs", {"message": "Please refund order ORD-cap-2 in full, 8900 cents. Reason: the rain jacket leaks."}),
    ("approve", {"decision": "approve"}),
]


async def main(run_dir):
    out = Path(run_dir)
    out.mkdir(parents=True, exist_ok=True)
    reset_user("cap")
    uptime = subprocess.run(["uptime"], capture_output=True, text=True).stdout.strip()
    server = Server(out, "stream", AUTH_TOKENS="tok-cap=cap")
    lines = []
    async with httpx.AsyncClient(base_url=server.url, headers={"Authorization": "Bearer tok-cap"}, timeout=120) as http:
        thread = (await http.post("/threads")).json()["thread_id"]
        for turn, (path, body) in enumerate(TURNS, start=1):
            started, wall = time.perf_counter(), time.time()
            async with http.stream("POST", f"/threads/{thread}/{path}", json=body) as response:
                lines.append({"turn": turn, "t_ms": 0.0, "wall": wall, "kind": "request", "path": path, "body": body,
                              "status": response.status_code})
                event = None
                async for line in response.aiter_lines():
                    t_ms = round((time.perf_counter() - started) * 1000, 1)
                    if line.startswith("event: "):
                        event = line[7:]
                    elif line.startswith("data: "):
                        lines.append({"turn": turn, "t_ms": t_ms, "kind": event, "data": json.loads(line[6:])})
            state = (await http.get(f"/threads/{thread}/state")).json()
            lines.append({"turn": turn, "kind": "state", "next": state["next"],
                          "interrupts": len(state["interrupts"]), "messages": [m["type"] for m in state["messages"]]})
    server.stop()
    with open(out / "stream-events.jsonl", "w") as f:
        f.write(json.dumps({"kind": "machine", "uptime": uptime}) + "\n")
        for line in lines:
            f.write(json.dumps(line) + "\n")
    print(len(lines), "lines")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
