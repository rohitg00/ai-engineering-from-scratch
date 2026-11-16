import asyncio
import json

import httpx

from tests.conftest import RUN_DIR
from tests.procs import Server

TOKEN = {"Authorization": "Bearer tok-race"}


async def post_run(url, thread_id, text):
    async with httpx.AsyncClient(base_url=url, headers=TOKEN, timeout=60) as http:
        response = await http.post(f"/threads/{thread_id}/runs", json={"message": text})
        return response.status_code


async def humans(url, thread_id):
    async with httpx.AsyncClient(base_url=url, headers=TOKEN) as http:
        state = (await http.get(f"/threads/{thread_id}/state")).json()
    return sum(m["type"] == "human" for m in state["messages"])


async def new_thread(url):
    async with httpx.AsyncClient(base_url=url, headers=TOKEN) as http:
        return (await http.post("/threads")).json()["thread_id"]


async def test_two_workers_racing_on_one_thread_give_one_run_and_one_409():
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    env = {"AUTH_TOKENS": "tok-race=race", "MODEL_LATENCY": 1.0}
    a, b = Server(RUN_DIR, "race-a", **env), Server(RUN_DIR, "race-b", **env)
    report = {}
    try:
        thread = await new_thread(a.url)
        codes = await asyncio.gather(*(post_run(s.url, thread, "How long does shipping take?") for s in (a, b)))
        report["cross_worker"] = {"codes": sorted(codes), "human_messages": await humans(a.url, thread)}

        thread = await new_thread(a.url)
        codes = await asyncio.gather(*(post_run(a.url, thread, "How long does shipping take?") for _ in range(2)))
        report["same_worker"] = {"codes": sorted(codes), "human_messages": await humans(a.url, thread)}

        thread = await new_thread(a.url)
        holder = asyncio.create_task(post_run(a.url, thread, "How long does shipping take?"))
        await asyncio.sleep(0.5)
        while_held = await post_run(b.url, thread, "Hello?")
        report["killed_holder_exit"] = a.kill()
        try:
            await holder
        except httpx.HTTPError as exc:
            report["holder_client_error"] = type(exc).__name__
        report["after_holder_killed"] = await post_run(b.url, thread, "How long does shipping take?")
        report["while_held"] = while_held
    finally:
        a.stop()
        b.stop()
        (RUN_DIR / "worker-race.json").write_text(json.dumps(report, indent=2))
    assert report["cross_worker"] == {"codes": [200, 409], "human_messages": 1}
    assert report["same_worker"] == {"codes": [200, 409], "human_messages": 1}
    assert report["while_held"] == 409
    assert report["after_holder_killed"] == 200
