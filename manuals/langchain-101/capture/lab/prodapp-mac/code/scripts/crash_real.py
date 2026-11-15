import asyncio
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from tests.procs import Http, Server, reset_user, sql

ASK = "Please refund order ORD-crash-2 in full, 8900 cents. Reason: the rain jacket leaks."


def uptime():
    return subprocess.run(["uptime"], capture_output=True, text=True).stdout.strip()


def refunds():
    return sql("select refund_id, amount_cents, idempotency_key from refunds where order_id = 'ORD-crash-2'")


async def wait_for(check, timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if check():
            return True
        await asyncio.sleep(0.05)
    return False


def interrupts_of(events):
    return [d for e, d in events if e == "interrupt"]


async def trial(run_dir, n):
    env = {"AUTH_TOKENS": "tok-crash=crash", "REFUND_CONFIRM_DELAY": 3}
    reset_user("crash")
    row = {"trial": n, "resume_form": os.environ.get("RESUME_FORM", "map"), "model": os.environ.get("MODEL"), "uptime_before": uptime()}
    marks = row["marks"] = {"start": time.time()}
    server = Server(run_dir, f"t{n:02d}-before-kill", **env)
    marks["server_up"] = time.time()
    client = Http(server.url, "tok-crash")
    thread = await client.thread()
    first = await client.say(thread, ASK)
    marks["interrupt_received"] = time.time()
    row["first_interrupts"] = interrupts_of(first)
    row["first_tool_calls"] = [d for e, d in first if e == "tool_call"]
    if not row["first_interrupts"]:
        row["outcome"] = "no refund proposed"
        row["first_reply"] = "".join(d["text"] for e, d in first if e == "token")
        server.stop()
        return row
    marks["approve_sent"] = time.time()
    approving = asyncio.create_task(client.approve(thread))
    row["refund_committed_before_kill"] = await wait_for(lambda: bool(refunds()))
    marks["refund_row_seen"] = time.time()
    row["kill_exit_code"] = server.kill()
    marks["killed"] = time.time()
    try:
        await approving
        row["approve_client_error"] = None
    except Exception as exc:
        row["approve_client_error"] = type(exc).__name__
    server.log.close()
    row["rows_after_kill"] = len(refunds())

    server = Server(run_dir, f"t{n:02d}-after-restart", AUTH_TOKENS="tok-crash=crash")
    marks["restarted"] = time.time()
    client = Http(server.url, "tok-crash")
    after = await client.state(thread)
    marks["state_read"] = time.time()
    row["after_restart_next"] = after["next"]
    row["approval_re_asked"] = bool(after["interrupts"])
    row["after_restart_interrupt_args"] = [i.get("args") for i in after["interrupts"]]
    marks["second_approve_sent"] = time.time()
    resumed = await client.approve(thread)
    marks["resumed_done"] = time.time()
    row["resumed_last_event"] = resumed[-1]
    row["resumed_tool_calls"] = [d for e, d in resumed if e == "tool_call"]
    row["resumed_interrupts"] = interrupts_of(resumed)
    final = await client.state(thread)
    server.stop()
    order = sql("select total_cents, refunded_cents from orders where id = 'ORD-crash-2'")[0]
    tool_results = [m for m in final["messages"] if m["type"] == "tool" and m["name"] == "refund_order"]
    row["refund_rows"] = refunds()
    row["refunded_cents"] = order["refunded_cents"]
    row["replayed_flags"] = [json.loads(m["content"]).get("replayed") for m in tool_results if m["content"].startswith("{")]
    row["final_answer"] = final["messages"][-1]["content"]
    row["final_next"] = final["next"]
    row["outcome"] = "one refund" if len(row["refund_rows"]) == 1 and order["refunded_cents"] == 8900 else "wrong refund count"
    row["uptime_after"] = uptime()
    return row


async def main(run_dir, trials="10"):
    Path(run_dir).mkdir(parents=True, exist_ok=True)
    rows = []
    for n in range(1, int(trials) + 1):
        row = await trial(run_dir, n)
        rows.append(row)
        print(json.dumps({k: row.get(k) for k in ("trial", "outcome", "approval_re_asked", "after_restart_next",
                                                   "replayed_flags", "refunded_cents")}), flush=True)
        (Path(run_dir) / "crash-trials.json").write_text(json.dumps(rows, indent=1, default=str))


if __name__ == "__main__":
    asyncio.run(main(*sys.argv[1:]))
