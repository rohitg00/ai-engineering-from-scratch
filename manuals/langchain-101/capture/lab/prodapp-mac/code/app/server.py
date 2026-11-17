import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres.aio import AsyncPostgresStore
from langgraph.types import Command
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from pydantic import BaseModel

from . import db
from .agent import build_agent
from .locks import ThreadLocks
from .models import make_model
from .settings import Settings
from .telemetry import event, setup_logging, setup_tracing, tracer
from .tools import Ctx


class RunIn(BaseModel):
    message: str


class ApproveIn(BaseModel):
    decision: Literal["approve", "reject"] = "approve"
    message: str | None = None


def to_events(part):
    if part["type"] == "messages":
        chunk, meta = part["data"]
        if chunk.type == "AIMessageChunk" and chunk.text and meta.get("langgraph_node") == "model":
            yield "token", {"text": chunk.text}
        return
    for node, update in part["data"].items():
        if node == "__interrupt__":
            for item in update:
                yield "interrupt", {"id": item.id, **item.value}
            continue
        if node not in ("model", "tools") or not isinstance(update, dict):
            continue
        for message in update.get("messages", []):
            if message.type == "ai":
                for tool_call in message.tool_calls:
                    yield "tool_call", {"id": tool_call["id"], "name": tool_call["name"], "args": tool_call["args"]}
            if message.type == "tool":
                yield "tool_result", {"name": message.name, "status": message.status, "content": message.text}


class Service:
    def __init__(self, agent, pool, store, locks):
        self.agent, self.pool, self.store, self.locks = agent, pool, store, locks
        self.active = {}

    async def start(self, user_id, thread_id, payload):
        if not await self.locks.acquire(thread_id):
            raise HTTPException(409, "a run is already active on this thread")
        queue = asyncio.Queue()
        task = asyncio.create_task(self.run(user_id, thread_id, payload, queue))
        self.active[thread_id] = task
        task.add_done_callback(lambda _: self.active.pop(thread_id, None))
        return queue

    async def run(self, user_id, thread_id, payload, queue):
        status, started = "cancelled", time.perf_counter()
        try:
            status = await self.traced(user_id, thread_id, payload, queue)
        finally:
            seconds = round(time.perf_counter() - started, 4)
            event("run.end", thread_id=thread_id, status=status, seconds=seconds)
            await self.locks.release(thread_id)
            queue.put_nowait(("done", {"status": status, "seconds": seconds}))
            queue.put_nowait(None)

    async def traced(self, user_id, thread_id, payload, queue):
        config = {"configurable": {"thread_id": thread_id}}
        context = Ctx(user_id=user_id, thread_id=thread_id, pool=self.pool)
        status = "done"
        with tracer.start_as_current_span("agent.run") as span:
            span.set_attribute("thread.id", thread_id)
            span.set_attribute("user.id", user_id)
            event("run.start", thread_id=thread_id, user_id=user_id)
            try:
                async for part in self.agent.astream(
                    payload, config, context=context, stream_mode=["messages", "updates"],
                    version="v2", durability="sync",
                ):
                    for name, data in to_events(part):
                        status = "interrupted" if name == "interrupt" else status
                        await queue.put((name, data))
            except Exception as exc:
                status = "error"
                span.record_exception(exc)
                await queue.put(("error", {"type": type(exc).__name__}))
            span.set_attribute("run.status", status)
        return status

    async def drain(self, seconds):
        if not self.active:
            return
        event("shutdown.drain", runs=len(self.active))
        _, pending = await asyncio.wait(list(self.active.values()), timeout=seconds)
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
        event("shutdown.done", cancelled=len(pending))


HEARTBEAT = float(os.environ.get("HEARTBEAT_SECONDS", "15"))


async def sse(queue):
    while True:
        try:
            item = await asyncio.wait_for(queue.get(), HEARTBEAT) if HEARTBEAT > 0 else await queue.get()
        except TimeoutError:
            yield ": waiting\n\n"
            continue
        if item is None:
            return
        name, data = item
        yield f"event: {name}\ndata: {json.dumps(data, default=str)}\n\n"


def stream(queue):
    return StreamingResponse(sse(queue), media_type="text/event-stream")


def create_app(settings=None, extra_middleware=()):
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app):
        provider = setup_tracing(settings.otel_file)
        setup_logging(settings.log_file)
        kwargs = {"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row}
        locks = await ThreadLocks.connect(settings.database_url)
        async with AsyncConnectionPool(settings.database_url, max_size=settings.pool_max, kwargs=kwargs) as pool:
            checkpointer, store = AsyncPostgresSaver(pool), AsyncPostgresStore(pool)
            async with locks.exclusive("schema-setup"):
                await checkpointer.setup()
                await store.setup()
                await db.setup(pool, set(settings.tokens.values()))
            model = make_model(settings.model, settings.model_latency)
            backup = make_model(settings.backup_model, settings.model_latency)
            agent = build_agent(model, backup, checkpointer, store, settings, extra_middleware)
            app.state.svc = Service(agent, pool, store, locks)
            event("startup", model=settings.model, backup=settings.backup_model, pool_max=settings.pool_max)
            yield
            await app.state.svc.drain(settings.drain_seconds)
        await locks.close()
        provider.shutdown()

    app = FastAPI(title="support-assistant", lifespan=lifespan, telemetry={"operation_spans": False})

    def svc(request: Request) -> Service:
        return request.app.state.svc

    def user(authorization: str = Header("")) -> str:
        user_id = settings.tokens.get(authorization.removeprefix("Bearer "))
        if user_id is None:
            raise HTTPException(401, "unknown token")
        return user_id

    async def owned(thread_id: str, user_id: str = Depends(user), s: Service = Depends(svc)) -> str:
        async with s.pool.connection() as conn:
            cur = await conn.execute("select user_id from threads where thread_id = %s", (thread_id,))
            row = await cur.fetchone()
        if row is None or row["user_id"] != user_id:
            raise HTTPException(404, "thread not found")
        return thread_id

    def config(thread_id):
        return {"configurable": {"thread_id": thread_id}}

    @app.get("/healthz")
    async def healthz():
        return {"ok": True}

    @app.post("/threads")
    async def create_thread(user_id: str = Depends(user), s: Service = Depends(svc)):
        thread_id = str(uuid.uuid4())
        async with s.pool.connection() as conn:
            await conn.execute("insert into threads (thread_id, user_id) values (%s, %s)", (thread_id, user_id))
        return {"thread_id": thread_id}

    @app.post("/threads/{thread_id}/runs")
    async def create_run(body: RunIn, thread_id: str = Depends(owned), user_id: str = Depends(user),
                         s: Service = Depends(svc)):
        state = await s.agent.aget_state(config(thread_id))
        if state.interrupts:
            raise HTTPException(409, "thread is waiting for approval")
        return stream(await s.start(user_id, thread_id, {"messages": [{"role": "user", "content": body.message}]}))

    @app.post("/threads/{thread_id}/approve")
    async def approve(body: ApproveIn, thread_id: str = Depends(owned), user_id: str = Depends(user),
                      s: Service = Depends(svc)):
        state = await s.agent.aget_state(config(thread_id))
        decision = {"type": body.decision} | ({"message": body.message} if body.message else {})
        if state.interrupts and os.environ.get("RESUME_FORM") == "plain" and len(state.interrupts) == 1:
            payload = Command(resume=decision)
        elif state.interrupts:
            payload = Command(resume={item.id: decision for item in state.interrupts})
        elif state.next:
            payload = None
        else:
            raise HTTPException(409, "nothing to resume")
        return stream(await s.start(user_id, thread_id, payload))

    @app.get("/threads/{thread_id}/state")
    async def get_state(thread_id: str = Depends(owned), s: Service = Depends(svc)):
        state = await s.agent.aget_state(config(thread_id))
        messages = state.values.get("messages", [])
        return {
            "thread_id": thread_id,
            "next": list(state.next),
            "interrupts": [{"id": item.id, **item.value} for item in state.interrupts],
            "messages": [
                {"type": m.type, "content": m.text, "tool_calls": getattr(m, "tool_calls", []),
                 "name": getattr(m, "name", None), "status": getattr(m, "status", None),
                 "usage": getattr(m, "usage_metadata", None),
                 "model": m.response_metadata.get("model_name") if m.type == "ai" else None,
                 "source": m.additional_kwargs.get("lc_source")}
                for m in messages
            ],
        }

    @app.get("/memories")
    async def memories(user_id: str = Depends(user), s: Service = Depends(svc)):
        items = await s.store.asearch(("memories", user_id), limit=100)
        return {"user_id": user_id, "memories": [item.value["text"] for item in items]}

    return app
