import asyncio
import json
import os
import uuid
from collections import Counter
from pathlib import Path

import httpx
import pytest
from langchain.agents.middleware import AgentMiddleware, ModelResponse
from langchain_core.messages import AIMessage
from opentelemetry import trace

from app import db
from app.middleware import model_id
from app.models import make_model
from app.server import create_app
from app.settings import Settings

RUN_DIR = Path(os.environ.get("TEST_RUN_DIR", "runs/latest"))
USERS = ["alice", "bob"] + [f"e{n:02d}" for n in range(1, 21)]
SETTINGS = Settings(
    database_url=os.environ.get("DATABASE_URL", Settings.database_url),
    model=os.environ.get("MODEL", Settings.model),
    backup_model=os.environ.get("BACKUP_MODEL", Settings.backup_model),
    tokens={f"tok-{u}": u for u in USERS},
    tool_timeout=0.5,
    summarize_after=12,
    otel_file=str(RUN_DIR / "test-spans.jsonl"),
    log_file=str(RUN_DIR / "test-log.jsonl"),
)


class Chaos(AgentMiddleware):
    def __init__(self, primary):
        super().__init__()
        self.primary = primary
        self.rules = {}
        self.attempts = Counter()

    async def awrap_model_call(self, request, handler):
        rule = self.rules.get("model")
        if rule == "primary_down" and model_id(request.model) == self.primary:
            raise ConnectionError("injected model outage")
        response = await handler(request)
        if rule == "runaway":
            call = {"name": "search_faq", "args": {"query": "shipping"}, "id": f"call_{uuid.uuid4().hex[:12]}"}
            return ModelResponse(result=[AIMessage(content="", tool_calls=[call])])
        return response

    async def awrap_tool_call(self, request, handler):
        name = request.tool_call["name"]
        self.attempts[name] += 1
        rule = self.rules.get(name)
        if rule == "fail_once" and self.attempts[name] == 1:
            raise ConnectionError("injected failure")
        if rule == "hang":
            await asyncio.sleep(30)
        return await handler(request)


def parse_sse(text):
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if not line.startswith(":"))
        if not lines:
            continue
        events.append((lines["event"], json.loads(lines["data"])))
    return events


class Client:
    def __init__(self, app, user):
        transport = httpx.ASGITransport(app=app)
        self.user = user
        self.log = []
        self.http = httpx.AsyncClient(
            transport=transport, base_url="http://test", headers={"Authorization": f"Bearer tok-{user}"}, timeout=30
        )

    async def thread(self):
        return (await self.http.post("/threads")).json()["thread_id"]

    async def say(self, thread_id, text):
        response = await self.http.post(f"/threads/{thread_id}/runs", json={"message": text})
        result = parse_sse(response.text) if response.status_code == 200 else response.status_code
        self.log.append({"op": "say", "thread_id": thread_id, "text": text, "result": result})
        return result

    async def approve(self, thread_id, decision="approve"):
        response = await self.http.post(f"/threads/{thread_id}/approve", json={"decision": decision})
        result = parse_sse(response.text) if response.status_code == 200 else response.status_code
        self.log.append({"op": "approve", "thread_id": thread_id, "decision": decision, "result": result})
        return result

    async def state(self, thread_id):
        return (await self.http.get(f"/threads/{thread_id}/state")).json()


@pytest.fixture(scope="session")
def chaos():
    return Chaos(primary=model_id(make_model(SETTINGS.model)))


@pytest.fixture(scope="session")
async def app(chaos):
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    application = create_app(SETTINGS, extra_middleware=[chaos])
    async with application.router.lifespan_context(application):
        pool = application.state.svc.pool
        await db.reset(pool)
        await db.setup(pool, USERS)
        async with pool.connection() as conn:
            await conn.execute("delete from store where prefix like 'memories.%%'")
        yield application


@pytest.fixture
def client(app):
    return lambda user: Client(app, user)


@pytest.fixture
def sql(app):
    async def run(query, *params):
        async with app.state.svc.pool.connection() as conn:
            cur = await conn.execute(query, params)
            return await cur.fetchall()

    return run


@pytest.fixture
def spans(app):
    def read(thread_id):
        trace.get_tracer_provider().force_flush()
        rows = [json.loads(line) for line in Path(SETTINGS.otel_file).read_text().splitlines() if line]
        traces = {s["context"]["trace_id"] for s in rows
                  if s["name"] == "agent.run" and s["attributes"].get("thread.id") == thread_id}
        return [s for s in rows if s["context"]["trace_id"] in traces]

    return read
