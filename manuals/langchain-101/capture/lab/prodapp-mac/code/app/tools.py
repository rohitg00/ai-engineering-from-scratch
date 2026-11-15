import asyncio
import json
import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg
from langchain.tools import ToolRuntime, tool
from psycopg.rows import dict_row

FAQ = json.loads((Path(__file__).parent.parent / "data" / "faq.json").read_text())
WORD = re.compile(r"[a-z]+")
STOP = {"a", "an", "the", "i", "do", "my", "to", "of", "is", "it", "how", "what", "can", "you", "your", "does"}


@dataclass
class Ctx:
    user_id: str
    thread_id: str
    pool: Any


def words(text):
    return set(WORD.findall(text.lower())) - STOP


@tool
async def read_order(order_id: str, runtime: ToolRuntime[Ctx]) -> str:
    """Look up one of the customer's orders by id, for example ORD-alice-1."""
    async with runtime.context.pool.connection() as conn:
        cur = await conn.execute(
            "select id, item, status, total_cents, refunded_cents from orders where id = %s and user_id = %s",
            (order_id, runtime.context.user_id),
        )
        row = await cur.fetchone()
    return json.dumps(row or {"error": f"no order {order_id} on this account"})


@tool
async def refund_order(order_id: str, amount_cents: int, reason: str, runtime: ToolRuntime[Ctx]) -> str:
    """Refund part or all of an order to the original payment method. A human must approve it."""
    ctx = runtime.context
    key = f"{ctx.thread_id}:{order_id}:{amount_cents}"
    async with ctx.pool.connection() as conn, conn.transaction():
        cur = await conn.execute(
            "select total_cents, refunded_cents from orders where id = %s and user_id = %s for update",
            (order_id, ctx.user_id),
        )
        order = await cur.fetchone()
        if order is None:
            return json.dumps({"error": f"no order {order_id} on this account"})
        remaining = order["total_cents"] - order["refunded_cents"]
        if amount_cents <= 0:
            return json.dumps({"error": f"amount_cents must be positive; {remaining} cents can be refunded"})
        cur = await conn.execute(
            "select refund_id, order_id, amount_cents from refunds where idempotency_key = %s", (key,)
        )
        if existing := await cur.fetchone():
            return json.dumps({**existing, "replayed": True})
        if amount_cents > remaining:
            return json.dumps({"error": f"refund exceeds the {remaining} cents that can still be refunded"})
        cur = await conn.execute(
            "insert into refunds (idempotency_key, order_id, amount_cents, reason) values (%s, %s, %s, %s)"
            " returning refund_id, order_id, amount_cents",
            (key, order_id, amount_cents, reason),
        )
        refund = await cur.fetchone()
        await conn.execute(
            "update orders set refunded_cents = refunded_cents + %s where id = %s", (amount_cents, order_id)
        )
    await asyncio.sleep(float(os.environ.get("REFUND_CONFIRM_DELAY", "0")))
    return json.dumps({**refund, "replayed": False})


@tool
async def search_faq(query: str) -> str:
    """Search the help center for answers about returns, refunds, shipping, sizing, and accounts."""
    asked = words(query)
    scored = sorted(FAQ, key=lambda e: len(asked & words(e["question"] + " " + e["answer"])), reverse=True)
    hits = [e for e in scored[:2] if asked & words(e["question"] + " " + e["answer"])]
    return json.dumps([{"id": e["id"], "answer": e["answer"]} for e in hits])


@tool
async def create_ticket(subject: str, body: str, runtime: ToolRuntime[Ctx]) -> str:
    """Open a ticket for a human support agent when the customer asks for a person."""
    ctx = runtime.context
    async with ctx.pool.connection() as conn:
        cur = await conn.execute(
            "insert into tickets (user_id, thread_id, subject, body) values (%s, %s, %s, %s) returning ticket_id",
            (ctx.user_id, ctx.thread_id, subject, body),
        )
        row = await cur.fetchone()
    return json.dumps(row)


@tool
async def save_note(text: str, runtime: ToolRuntime[Ctx]) -> str:
    """Save a fact or preference about the customer for future conversations."""
    await runtime.store.aput(("memories", runtime.context.user_id), str(uuid.uuid4()), {"text": text})
    return json.dumps({"saved": True})


@tool
async def recall_notes(runtime: ToolRuntime[Ctx]) -> str:
    """List the facts and preferences saved about this customer."""
    items = await runtime.store.asearch(("memories", runtime.context.user_id), limit=20)
    return json.dumps([item.value["text"] for item in items])


def refund_description(tool_call, state, runtime):
    args = tool_call["args"]
    with psycopg.connect(runtime.context.pool.conninfo, row_factory=dict_row) as conn:
        order = conn.execute(
            "select item, total_cents, refunded_cents from orders where id = %s and user_id = %s",
            (args.get("order_id"), runtime.context.user_id),
        ).fetchone()
    if order is None:
        return f"Refund {args.get('amount_cents')} cents on {args.get('order_id')}: no such order on this account."
    remaining = order["total_cents"] - order["refunded_cents"]
    return (f"Refund {args.get('amount_cents')} cents on {args.get('order_id')} ({order['item']}). "
            f"Order total {order['total_cents']} cents, refunded so far {order['refunded_cents']}, "
            f"refundable now {remaining}. Reason: {args.get('reason')}")


TOOLS = [read_order, refund_order, search_faq, create_ticket, save_note, recall_notes]
IDEMPOTENT = ["read_order", "search_faq", "recall_notes"]
