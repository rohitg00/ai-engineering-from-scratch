import json
import time
from types import SimpleNamespace

import pytest

from app.middleware import model_id
from app.models import make_model
from app.tools import Ctx, refund_order
from tests.conftest import RUN_DIR, SETTINGS

CASES = []


def case(fn):
    CASES.append(fn)
    return fn


def calls(events, name=None):
    found = [(d["name"], d["args"]) for e, d in events if e == "tool_call"]
    return [args for n, args in found if n == name] if name else [n for n, _ in found]


def results(events, name):
    return [d for e, d in events if e == "tool_result" and d["name"] == name]


def interrupts(events):
    return [d for e, d in events if e == "interrupt"]


def finished(state):
    last = state["messages"][-1]
    return state["next"] == [] and state["interrupts"] == [] and last["type"] == "ai" and not last["tool_calls"]


def named(spans, name):
    return [s for s in spans if s["name"] == name]


def failed(span):
    return span["status"]["status_code"] == "ERROR"


async def refunds(sql, order_id):
    return await sql("select amount_cents from refunds where order_id = %s", order_id)


async def refunded(sql, order_id):
    return (await sql("select refunded_cents from orders where id = %s", order_id))[0]["refunded_cents"]


@case
async def faq_return_window(c, t, x):
    events = await c.say(t, "How long do I have to return an item?")
    assert calls(events) == ["search_faq"]
    assert "returns-window" in results(events, "search_faq")[0]["content"]
    assert finished(await c.state(t))


@case
async def faq_shipping_time(c, t, x):
    events = await c.say(t, "How long does shipping take?")
    assert calls(events) == ["search_faq"]
    assert "shipping-times" in results(events, "search_faq")[0]["content"]
    assert finished(await c.state(t))


@case
async def order_status(c, t, x):
    events = await c.say(t, f"Where is my order ORD-{c.user}-2?")
    assert calls(events, "read_order") == [{"order_id": f"ORD-{c.user}-2"}]
    assert json.loads(results(events, "read_order")[0]["content"])["status"] == "shipped"
    assert finished(await c.state(t))


@case
async def order_unknown(c, t, x):
    events = await c.say(t, "Where is my order ORD-nobody-1?")
    assert calls(events, "read_order") == [{"order_id": "ORD-nobody-1"}]
    assert "error" in json.loads(results(events, "read_order")[0]["content"])
    assert calls(events, "refund_order") == []
    assert finished(await c.state(t))


@case
async def order_of_other_customer_is_hidden(c, t, x):
    events = await c.say(t, "Where is my order ORD-alice-1?")
    assert all("error" in json.loads(r["content"]) for r in results(events, "read_order"))
    assert "Trail running shoes" not in json.dumps(await c.state(t))


@case
async def refund_approved_once(c, t, x):
    order = f"ORD-{c.user}-1"
    events = await c.say(t, f"Please refund {order}")
    [pending] = interrupts(events)
    assert (pending["name"], pending["args"]["order_id"], pending["args"]["amount_cents"]) == ("refund_order", order, 12900)
    assert await refunds(x.sql, order) == []
    await c.approve(t)
    assert await refunds(x.sql, order) == [{"amount_cents": 12900}]
    assert finished(await c.state(t))


@case
async def refund_rejected_has_no_side_effect(c, t, x):
    order = f"ORD-{c.user}-1"
    await c.say(t, f"Please refund {order}")
    events = await c.approve(t, "reject")
    assert [r["status"] for r in results(events, "refund_order")] == ["error"]
    assert await refunds(x.sql, order) == []
    assert finished(await c.state(t))


@case
async def refund_asked_twice(c, t, x):
    order = f"ORD-{c.user}-2"
    await c.say(t, f"Refund {order} please")
    await c.approve(t)
    events = await c.say(t, f"Refund {order} again")
    if interrupts(events):
        await c.approve(t)
    assert await refunds(x.sql, order) == [{"amount_cents": 8900}]
    assert await refunded(x.sql, order) == 8900


@case
async def refund_tool_replay_is_idempotent(c, t, x):
    runtime = SimpleNamespace(context=Ctx(user_id=c.user, thread_id=t, pool=x.pool))
    args = {"order_id": f"ORD-{c.user}-3", "amount_cents": 2400, "reason": "replay test", "runtime": runtime}
    first = json.loads(await refund_order.coroutine(**args))
    second = json.loads(await refund_order.coroutine(**args))
    assert (first["replayed"], second["replayed"]) == (False, True)
    assert first["refund_id"] == second["refund_id"]
    assert await refunded(x.sql, f"ORD-{c.user}-3") == 2400


@case
async def ticket_for_a_human(c, t, x):
    events = await c.say(t, "I want to talk to a human about a damaged item")
    assert calls(events) == ["create_ticket"]
    assert await x.sql("select thread_id from tickets where user_id = %s", c.user) == [{"thread_id": t}]


@case
async def memory_saved_and_recalled(c, t, x):
    events = await c.say(t, "Remember that I prefer email updates")
    assert "email" in calls(events, "save_note")[0]["text"]
    other = await c.thread()
    events = await c.say(other, "What do you remember about me?")
    assert "email" in results(events, "recall_notes")[0]["content"]


@case
async def memory_of_other_user_is_invisible(c, t, x):
    events = await c.say(t, "What do you remember about me?")
    assert all(json.loads(r["content"]) == [] for r in results(events, "recall_notes"))
    assert (await c.http.get("/memories")).json()["memories"] == []


@case
async def flaky_faq_is_retried(c, t, x):
    x.chaos.rules = {"search_faq": "fail_once"}
    events = await c.say(t, "How much does shipping cost?")
    assert x.chaos.attempts["search_faq"] == 2
    assert [failed(s) for s in named(x.spans(t), "tool.search_faq")] == [True, False]
    assert results(events, "search_faq")[0]["status"] == "success"


@case
async def hung_tool_times_out(c, t, x):
    x.chaos.rules = {"read_order": "hang"}
    started = time.perf_counter()
    events = await c.say(t, f"Where is my order ORD-{c.user}-1?")
    assert time.perf_counter() - started < 5
    assert [failed(s) for s in named(x.spans(t), "tool.read_order")] == [True, True, True]
    assert results(events, "read_order")[0]["status"] == "error"
    assert finished(await c.state(t))


@case
async def failed_ticket_is_not_retried(c, t, x):
    x.chaos.rules = {"create_ticket": "fail_once"}
    events = await c.say(t, "Open a ticket, I need a human")
    assert [failed(s) for s in named(x.spans(t), "tool.create_ticket")] == [True]
    assert results(events, "create_ticket")[0]["status"] == "error"
    assert await x.sql("select count(*) n from tickets where user_id = %s", c.user) == [{"n": 0}]


@case
async def primary_outage_uses_backup(c, t, x):
    x.chaos.rules = {"model": "primary_down"}
    events = await c.say(t, f"Where is my order ORD-{c.user}-1?")
    primary, backup = x.chaos.primary, model_id(make_model(SETTINGS.backup_model))
    model_spans = named(x.spans(t), "model.call")
    assert all(failed(s) for s in model_spans if s["attributes"]["gen_ai.request.model"] == primary)
    assert any(not failed(s) and s["attributes"]["gen_ai.request.model"] == backup for s in model_spans)
    assert calls(events, "read_order") == [{"order_id": f"ORD-{c.user}-1"}]
    assert finished(await c.state(t))


@case
async def runaway_loop_hits_call_limit(c, t, x):
    x.chaos.rules = {"model": "runaway"}
    events = await c.say(t, "Can you check the shipping options for me?")
    assert len(named(x.spans(t), "model.call")) == SETTINGS.model_calls_per_run
    assert calls(events).count("search_faq") == SETTINGS.model_calls_per_run
    assert events[-1][1]["status"] == "done"
    assert finished(await c.state(t))


@case
async def long_thread_is_summarized(c, t, x):
    questions = ["How long does shipping take?", "How much does shipping cost?", "Do you ship internationally?",
                 "How do I pick the right size?", "Do your products have a warranty?",
                 f"Where is my order ORD-{c.user}-2?"]
    for question in questions:
        await c.say(t, question)
    messages = (await c.state(t))["messages"]
    assert messages[0]["source"] == "summarization"
    assert sum(m["type"] == "human" and m["source"] is None for m in messages) < len(questions)
    assert max(s["attributes"]["gen_ai.request.message_count"] for s in named(x.spans(t), "model.call")) <= 14


@case
async def new_message_while_waiting_for_approval(c, t, x):
    order = f"ORD-{c.user}-3"
    events = await c.say(t, f"Refund {order}")
    assert [i["name"] for i in interrupts(events)] == ["refund_order"]
    assert await c.say(t, "Hello?") == 409
    await c.approve(t)
    assert await refunds(x.sql, order) == [{"amount_cents": 2400}]


@case
async def status_then_refund_in_one_thread(c, t, x):
    order = f"ORD-{c.user}-3"
    first = await c.say(t, f"Where is my order {order}?")
    second = await c.say(t, f"Refund {order}")
    await c.approve(t)
    assert calls(first, "read_order") == [{"order_id": order}]
    assert [i["args"]["order_id"] for i in interrupts(second)] == [order]
    assert sum(m["type"] == "human" for m in (await c.state(t))["messages"]) == 2
    assert await refunded(x.sql, order) == 2400


@pytest.mark.parametrize("number,check", list(enumerate(CASES, start=1)), ids=[f.__name__ for f in CASES])
async def test_eval(number, check, client, sql, spans, chaos, app):
    chaos.rules, chaos.attempts = {}, chaos.attempts.__class__()
    c = client(f"e{number:02d}")
    extras = SimpleNamespace(sql=sql, spans=spans, chaos=chaos, pool=app.state.svc.pool)
    outcome = "error"
    try:
        await check(c, await c.thread(), extras)
        outcome = "passed"
    except AssertionError:
        outcome = "failed"
        raise
    finally:
        chaos.rules = {}
        threads = await sql("select thread_id from threads where user_id = %s order by created_at", c.user)
        record = {"case": check.__name__, "model": SETTINGS.model, "outcome": outcome, "log": c.log,
                  "states": [await c.state(row["thread_id"]) for row in threads],
                  "refunds": await sql("select order_id, amount_cents from refunds where order_id like %s", f"ORD-{c.user}-%"),
                  "tickets": await sql("select subject from tickets where user_id = %s", c.user)}
        (RUN_DIR / "cases").mkdir(exist_ok=True)
        (RUN_DIR / "cases" / f"{number:02d}-{check.__name__}.json").write_text(json.dumps(record, indent=1, default=str))
