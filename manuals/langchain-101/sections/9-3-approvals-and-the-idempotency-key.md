# HumanInTheLoopMiddleware and the idempotency key

> After a crash that follows the side effect, the approval was pending again in 20 of 20 trials, so only a key at the tool stops a second refund.

A support agent clicks Approve on a refund. The worker writes the refund row, and then the process dies before the run ends. A new worker starts, the agent opens the thread, and the same approval request is waiting again. If the agent clicks Approve a second time, the customer can get the money twice.

When you finish this section, you can say what LangGraph saves when a run resumes from an approval, and what it does not. You can put an idempotency key on a tool that moves money, and show the approver what they approve.

## The approval is an interrupt inside the tool call

The service guards `refund_order` with `HumanInTheLoopMiddleware` in `per_call` mode. In that mode the middleware raises the interrupt from `wrap_tool_call`, inside the `tools` node, just before it calls the tool {{code libs/langchain_v1/langchain/agents/middleware/human_in_the_loop.py:751}}. The run stops, and the stream sends an `interrupt` event with the tool name and its arguments.

```listing
title: the interrupt that the approver saw, from a Qwen3 14B run
source: capture/lab/prodapp-mac/runs/suite/qwen3-14b/rep-1/cases/19-new_message_while_waiting_for_approval.json
lang: json
note: One event of the stream, cut from the case record.
---
     "interrupt",
     {
      "id": "515c4354e30817f8f987572b7a06c1bb",
      "type": "tool_approval",
      "tool_call_id": "804ec90d-84f1-406c-88a0-d51eb05e480c",
      "name": "refund_order",
      "args": {
       "order_id": "ORD-e19-3",
       "amount_cents": 0,
       "reason": "Customer requested a refund."
      },
```

The approve route answers that interrupt by its id. It sends a resume map, one decision for each pending interrupt.

```listing
title: the approve route, with the two resume forms
source: capture/lab/prodapp-mac/code/app/server.py
lang: python
---
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
```

## What the resume saves

**Resume map:** a `Command(resume=...)` whose value is a dict keyed by interrupt ids. LangGraph 1.2.22 treats the two forms differently. A plain resume value is sent to `put_writes` as a pending write of the checkpoint. A resume map goes into the run config only, and its write is skipped {{code libs/langgraph/langgraph/pregel/_loop.py:1064-1091}}.

So with a resume map, the decision exists in memory until the `tools` task finishes and its writes are saved. The tool runs inside that task. A crash after the tool wrote its row loses the decision. The next reader of the thread then finds the same interrupt pending.

## A crash after the refund row

**We measured** this on the Mac with Qwen3 4B, ten trials for each resume form. Each trial asked for `ORD-crash-2` in full, with the amount and the reason in the message, so the model had no choice to make. The tool slept for 3 s after its commit. The script waited for the refund row, sent SIGKILL to the worker, and started a new one. It read the thread, sent one more approve, and read the `refunds` table.

In 10 of 10 trials with the resume map, the new worker reported `next` as `["tools"]` with the approval pending. The second approve ran the tool again, the key matched, and the tool returned `"replayed": true`. Each trial ended with one refund row of 8900 cents.

The plain form gave the same result in 10 of 10 trials: the approval was pending after the restart, and one row remained. So with either form, a client cannot tell from the state whether an approval was given before a crash. We did not check whether a plain-form decision survived in `checkpoint_writes`, or test a resume with no new decision.

```figure
id: fig-9-3
kind: timeline
title: a worker killed after the refund row, and the restart
claim: After the kill the approval was pending again, and the key at the tool turned the second approve into a replay with one refund row.
caption: The top panel is one trial, in seconds after the first approve. The bottom panel is every trial. A teal square has one refund row of 8900 cents, and an amber frame means the approval was pending again. From capture/lab/prodapp-mac/summary/crash-mac.json.
```

## The key at the tool

The refund is safe because `refund_order` checks a key before it writes.

```listing
title: the idempotency key in refund_order
source: capture/lab/prodapp-mac/code/app/tools.py
lang: python
note: The insert and the update after the check are cut.
---
    key = f"{ctx.thread_id}:{order_id}:{amount_cents}"
    async with ctx.pool.connection() as conn, conn.transaction():
        cur = await conn.execute(
            "select total_cents, refunded_cents from orders where id = %s and user_id = %s for update",
            (order_id, ctx.user_id),
        )
        order = await cur.fetchone()
        if order is None:
            return json.dumps({"error": f"no order {order_id} on this account"})
        cur = await conn.execute(
            "select refund_id, order_id, amount_cents from refunds where idempotency_key = %s", (key,)
        )
        if existing := await cur.fetchone():
            return json.dumps({**existing, "replayed": True})
        if order["refunded_cents"] + amount_cents > order["total_cents"]:
            return json.dumps({"error": "refund would exceed the order total"})
…
```

The key has three parts: the thread, the order, and the amount. The `SELECT ... FOR UPDATE` locks the order row, so two workers cannot both pass the check. The `refunds` table also has a unique index on the key. A replay returns the first refund with `"replayed": true`, and the model tells the customer that the refund exists.

The key holds because the replay sends the same arguments. After the restart, the `tools` node runs the tool call that the checkpoint saved, from the AI message that the model wrote before the interrupt. The model is not asked again. If it were, it could choose another amount, and the key would differ. The [runtime part](#s-the-checkpoint-write-path-and-durability) shows the same rule for any node: key a side effect on what the checkpoint saved.

## The approver approves what you show

An idempotency key stops a second refund. It does not stop a wrong first one. In the eval suite, Qwen3 4B and Qwen3 14B each proposed `amount_cents` 0 for `Refund ORD-e19-3`, and the test approved it. The tool wrote a refund row of 0 cents, and the model told the customer that the refund was processed. Qwen3 14B also proposed 10000 cents on orders of 12900 and 8900 cents without reading either order.

Two changes close that gap, and we did not run either one. Make the tool refuse an amount of 0 or less, as it refuses an amount over the total. Put the order total and the amount refunded so far into the approval request, next to the proposed amount.

```takeaways
- Expect a pending approval to return after a crash, and design the second approve to be safe.
- Give every tool that moves money an idempotency key built from what the checkpoint saved.
- Lock the row you check with SELECT FOR UPDATE, and back the key with a unique index.
- Validate tool arguments in the tool, and refuse a zero or negative amount.
- Show the approver the order total next to the proposed amount.
```

Sources: capture/lab/prodapp-mac/summary/crash-mac.json, capture/lab/prodapp-mac/runs/crash-map/crash-trials.json, capture/lab/prodapp-mac/runs/crash-plain/crash-trials.json, capture/lab/prodapp-mac/runs/crash-map/t01-before-kill.log.jsonl, capture/lab/prodapp-mac/runs/crash-map/t01-after-restart.log.jsonl, capture/lab/prodapp-mac/code/scripts/crash_real.py, capture/lab/prodapp-mac/code/app/server.py, capture/lab/prodapp-mac/code/app/tools.py, capture/lab/prodapp-mac/code/app/db.py, capture/lab/prodapp-mac/runs/suite/qwen3-14b/rep-1/cases/19-new_message_while_waiting_for_approval.json, capture/lab/prodapp-mac/summary/evals-mac.json; libs/langchain_v1/langchain/agents/middleware/human_in_the_loop.py at langchain==1.5.0; libs/langgraph/langgraph/pregel/_loop.py at langgraph 1.2.22.
