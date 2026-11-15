import asyncio
import json
import time

from tests.conftest import RUN_DIR
from tests.procs import Http, Server, reset_user, sql


def report(name, data):
    (RUN_DIR / f"{name}.json").write_text(json.dumps(data, indent=2, default=str))


async def wait_for(check, timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if check():
            return True
        await asyncio.sleep(0.05)
    return False


def answered_from_faq(state):
    last = state["messages"][-1]
    faq = [m for m in state["messages"] if m["type"] == "tool" and m["name"] == "search_faq"]
    return state["next"] == [] and last["type"] == "ai" and not last["tool_calls"] and len(faq) == 1


def server_log(name):
    return (RUN_DIR / f"{name}.server.log").read_text()


def refunds(order_id):
    return sql("select refund_id, amount_cents, idempotency_key from refunds where order_id = %s", order_id)


async def test_kill_mid_refund_then_resume_refunds_once():
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    env = {"AUTH_TOKENS": "tok-crash=crash", "REFUND_CONFIRM_DELAY": 3}
    server = Server(RUN_DIR, "crash-1", **env)
    reset_user("crash")
    client = Http(server.url, "tok-crash")
    thread = await client.thread()
    first = await client.say(thread, "Please refund ORD-crash-2")
    approving = asyncio.create_task(client.approve(thread))
    committed = await wait_for(lambda: refunds("ORD-crash-2"))
    killed_at = time.time()
    exit_code = server.kill()
    approve_error = None
    try:
        await approving
    except Exception as exc:
        approve_error = type(exc).__name__
    server.log.close()

    server = Server(RUN_DIR, "crash-2", AUTH_TOKENS="tok-crash=crash")
    client = Http(server.url, "tok-crash")
    after_restart = await client.state(thread)
    resumed = await client.approve(thread)
    final = await client.state(thread)
    server.stop()

    rows = refunds("ORD-crash-2")
    order = sql("select total_cents, refunded_cents from orders where id = 'ORD-crash-2'")[0]
    tool_results = [m for m in final["messages"] if m["type"] == "tool" and m["name"] == "refund_order"]
    report("crash-test", {
        "first_run_last_event": first[-1], "refund_committed_before_kill": committed,
        "kill_exit_code": exit_code, "killed_at": killed_at, "approve_client_error": approve_error,
        "after_restart_next": after_restart["next"], "after_restart_interrupts": after_restart["interrupts"],
        "resumed_events": resumed, "refund_rows": rows, "order": order,
        "refund_tool_messages": tool_results, "final_answer": final["messages"][-1]["content"],
    })
    assert committed and exit_code == -9
    assert after_restart["next"] == ["tools"]
    assert resumed[-1][1]["status"] == "done"
    assert len(rows) == 1 and order["refunded_cents"] == 8900
    assert [json.loads(m["content"])["replayed"] for m in tool_results] == [True]


async def test_sigterm_lets_in_flight_run_finish():
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    name = "drain-finish"
    server = Server(RUN_DIR, name, AUTH_TOKENS="tok-drain=drain", MODEL_LATENCY=1.0)
    client = Http(server.url, "tok-drain")
    thread = await client.thread()
    running = asyncio.create_task(client.say(thread, "How long does shipping take?"))
    await asyncio.sleep(0.3)
    started = time.time()
    exit_code = await asyncio.to_thread(server.term)
    events = await running
    shutdown_seconds = time.time() - started
    server.log.close()
    server = Server(RUN_DIR, "drain-finish-check", AUTH_TOKENS="tok-drain=drain")
    state = await Http(server.url, "tok-drain").state(thread)
    server.stop()
    report("graceful-finish", {"exit_code": exit_code, "shutdown_seconds": shutdown_seconds,
                               "last_event": events[-1], "next": state["next"],
                               "final_answer": state["messages"][-1]["content"]})
    assert exit_code == -15
    assert "Application shutdown complete" in server_log(name)
    assert events[-1][1]["status"] == "done"
    assert answered_from_faq(state)


async def test_sigterm_past_deadline_checkpoints_and_resumes():
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    env = {"AUTH_TOKENS": "tok-drain2=drain2", "MODEL_LATENCY": 3.0, "DRAIN_SECONDS": 0.2}
    name = "drain-cancel"
    server = Server(RUN_DIR, name, graceful=1, **env)
    client = Http(server.url, "tok-drain2")
    thread = await client.thread()
    running = asyncio.create_task(client.say(thread, "How long does shipping take?"))
    await asyncio.sleep(3.5)
    exit_code = await asyncio.to_thread(server.term)
    try:
        events = await running
    except Exception as exc:
        events = [("client_error", type(exc).__name__)]
    server.log.close()
    server = Server(RUN_DIR, "drain-cancel-resume", AUTH_TOKENS="tok-drain2=drain2")
    client = Http(server.url, "tok-drain2")
    before = await client.state(thread)
    resumed = await client.approve(thread)
    after = await client.state(thread)
    server.stop()
    report("graceful-cancel", {"exit_code": exit_code, "client_events_tail": events[-3:],
                               "next_after_restart": before["next"],
                               "messages_after_restart": [m["type"] for m in before["messages"]],
                               "resumed_last_event": resumed[-1], "final_answer": after["messages"][-1]["content"]})
    assert exit_code == -15
    assert "Application shutdown complete" in server_log(name)
    assert before["next"] != []
    assert resumed[-1][1]["status"] == "done"
    assert answered_from_faq(after)
