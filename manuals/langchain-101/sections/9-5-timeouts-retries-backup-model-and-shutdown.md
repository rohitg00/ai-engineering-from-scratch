# ToolRetryMiddleware, ModelFallbackMiddleware, and shutdown

> Time-limit every tool, retry only the tools that are safe to repeat, and expect the model to decide what the customer hears about a fault.

A help-center search fails once with a connection error. An order lookup hangs. The ticket system returns an error, and you cannot tell whether it wrote a row. The primary model provider is down. Each of these needs a different response, and the middleware stack of `create_agent` is where you choose it.

When you finish this section, you can order the middleware so that each tool attempt has its own time limit. You can choose which tools to retry, add a backup model, and shut a worker down without losing a run.

## The stack, from the outside in

```listing
title: the middleware stack of the service
source: capture/lab/prodapp-mac/code/app/agent.py
lang: python
---
        middleware=[
            SummarizationMiddleware(model, trigger=("messages", settings.summarize_after), keep=("messages", 6)),
            ModelCallLimitMiddleware(run_limit=settings.model_calls_per_run, exit_behavior="end"),
            ModelFallbackMiddleware(backup),
            HumanInTheLoopMiddleware(
                {"refund_order": {"allowed_decisions": ["approve", "reject"], "description": refund_description}},
                interrupt_mode="per_call",
            ),
            ToolErrorMiddleware(tool_error_message),
            ToolRetryMiddleware(tools=IDEMPOTENT, max_retries=2, initial_delay=0.1, on_failure="error"),
            Tracing(),
            ToolTimeout(settings.tool_timeout, {"refund_order": settings.refund_timeout}),
            *extra,
        ],
```

The first middleware in the list wraps all the others. For a tool call, the order from the outside in is the approval, the error text, the retry, the span, the timeout, and the tool. Three results follow from that order.

- Each attempt gets its own time limit, because the timeout is inside the retry.
- Each attempt gets its own span, because the span is inside the retry too.
- The model sees one error message after the last attempt, because `ToolErrorMiddleware` is outside the retry.

`ToolTimeout` is ours, and it is four lines of `asyncio.wait_for`. In LangChain 1.5.0 only the shell and file search middleware set time limits, and a general tool call has none. `refund_order` gets 15 s and the other tools 5 s. The tests set 0.5 s.

A timeout cancels the wait for the tool. It does not undo the effect. A refund tool can commit its row before the limit fires. After a timeout on a tool that moves money, read the order before you tell the customer that nothing happened.

**Idempotent tool:** a tool that gives the same result and the same side effects when you call it twice with the same arguments. Only `read_order`, `search_faq`, and `recall_notes` are on the retry list. `create_ticket` and `save_note` write a row with a new id on each call, so a retry after a lost reply would write two. `refund_order` has its own key, which [section 9.3](#s-approvals-and-the-idempotency-key) explains.

The error text tells the model what to do with the failure.

```listing
title: the text that the model reads after a failed tool
source: capture/lab/prodapp-mac/code/app/middleware.py
lang: python
---
def tool_error_message(exc, request):
    event("tool.error", tool=request.tool_call["name"], error=type(exc).__name__)
    if isinstance(exc, TimeoutError):
        return f"{request.tool_call['name']} timed out. Tell the customer and do not guess."
    return f"{request.tool_call['name']} failed with {type(exc).__name__}. Tell the customer and do not guess."
```

## Five faults on three models

The eval suite injects each fault with a test middleware that sits inside the timeout, where the tool would be. **We measured** each fault once per model on the Mac, in the first run of the suite. The service did the same thing on every model. The models differed in whether they called the tool at all, and in what they told the customer.

| Fault | What the service did, from the spans | Qwen3 4B | Qwen3 14B | Claude Haiku 5.5 |
|---|---|---|---|---|
| `search_faq` fails once | 2 attempts, the first an error span | did not call `search_faq` | 2 attempts, then the right answer | 2 attempts, then the right answer |
| `read_order` hangs | 3 attempts, each cut at about 0.50 s | 3 attempts, then told the customer that the order was not found | 3 attempts, then said it could not look the order up now | 3 attempts, then said the order system timed out |
| `create_ticket` fails | 1 attempt, no retry, 0 ticket rows | said it could not open a ticket | said it could not open a ticket | said it could not open a ticket |
| primary model down | each primary call an error span, then the backup answered | backup Qwen3 8B, 2 calls | backup Qwen3 4B, 2 calls | backup Qwen3 4B, 2 calls |
| model asks for `search_faq` forever | stopped at 8 model calls and 8 tool calls | run took 29.61 s | run took 151.34 s | run took 20.89 s |

[Figure 9.5](#fig-9-5) lays the same runs out as one decision table.

```figure
id: fig-9-5
kind: decision
title: five faults, what the middleware did, and what each model said
claim: The middleware handled each fault the same way on every model, and only the reply to the customer differed.
caption: Read each row left to right: the fault, the attempts from the spans, and the reply of each model. A rose reply misled the customer or skipped the tool. From capture/lab/prodapp-mac/summary/faults-mac.json.
```

The row to remember is the hung order lookup on Qwen3 4B. The tool message said `read_order timed out. Tell the customer and do not guess.` The model told the customer `I couldn't find your order. Please check the order ID and try again`. That reply is false, and it sends the customer to fix an order id that was right. No middleware can stop it. Check the reply to a timeout in your evals, and choose a model that passes that check.

## The backup model

`ModelFallbackMiddleware` tries the next model when a call raises. **We measured** the primary outage on the Mac: every primary call raised a `ConnectionError` and left an error span, and the backup made the call. The backup ran on each model call of the turn, so the primary was tried and failed twice. Nothing remembers that the primary is down. A circuit breaker that skips a failed provider for a while is code that you add.

A backup on another provider is an option. For the Claude Haiku 5.5 runs the backup was Qwen3 4B on the Mac.

The same Haiku run had one fault that we did not inject. While the backup model loaded, one `read_order` attempt took 0.70 s and hit the 0.5 s limit of the tests. The retry returned in 0.06 s, and the customer got the order status. So the retry on an idempotent tool also covered an ordinary slow moment of the machine.

## A loop that does not end

`ModelCallLimitMiddleware` with `run_limit=8` and `exit_behavior="end"` ended the runaway runs after the eighth model call, on every model. The run ended with status `done` and a final AI message, so the client saw a normal end. The limit counts model calls in one run, so set it from the longest honest task in your evals.

## Shutdown

Uvicorn waits for open connections when it gets SIGTERM, up to `--timeout-graceful-shutdown`. Then the FastAPI lifespan exits, and the service waits up to `DRAIN_SECONDS` for each run task and cancels the rest. A cancelled run keeps the checkpoints that `durability="sync"` already wrote.

**We measured** both cases with Qwen3 14B on the Mac, five trials each. Each trial asked a FAQ question, sent SIGTERM to the worker during the run, and read the thread from a new worker.

| Case | Settings | Client | Thread after the restart |
|---|---|---|---|
| finish | SIGTERM at 0.3 s, uvicorn 20 s, drain 20 s | `done` in 8.28 to 9.16 s in 4 of 5 trials | answered in 5 of 5 |
| cancel | SIGTERM at 0.3 s, uvicorn 1 s, drain 0.05 s | stream closed with an error in 5 of 5 | `next` was `["model"]`, with the human message only, in 5 of 5 |

In the first finish trial, the first model call took 14.96 s, because Qwen3 14B loaded after the 4B trials. At 20 s uvicorn logged `Cancel 1 running task(s), timeout graceful shutdown exceeded` and closed the stream. The run task went on, and it finished during the drain at 21.58 s. The thread had its answer, and the client never saw `done`. The suite showed the same thing twice with a 10 s limit.

The Mac was loaded for these trials, with a load average of 15.6 to 28.7, so read the seconds as upper bounds. The counts are the result.

After each cancel, a new worker resumed the thread with `/approve` and no decision. The run finished in 7.27 to 9.10 s and answered from the FAQ, in 5 of 5 trials.

So a run outlives its stream when the uvicorn timer is shorter than the drain timer. Set the uvicorn graceful timeout above your longest run, and tell clients to read the thread state after a dropped stream.

```takeaways
- Put a timeout inside the retry, so each attempt has its own limit and its own span.
- Retry only tools that are safe to call twice, and give a writing tool an idempotency key.
- Tell the model in the error text what to say, and test what it says.
- Add a backup model, and add a circuit breaker if a dead primary costs you time.
- Set the model call limit from your longest honest task.
- Give runs time to finish on SIGTERM, and resume a cancelled run from its checkpoint.
```

Sources: capture/lab/prodapp-mac/code/app/agent.py, capture/lab/prodapp-mac/code/app/middleware.py, capture/lab/prodapp-mac/code/app/tools.py, capture/lab/prodapp-mac/code/app/server.py, capture/lab/prodapp-mac/code/tests/conftest.py, capture/lab/prodapp-mac/code/tests/test_evals.py, capture/lab/prodapp-mac/code/scripts/drain_real.py, capture/lab/prodapp-mac/summary/faults-mac.json, capture/lab/prodapp-mac/summary/drain-mac.json, capture/lab/prodapp-mac/runs/drain/drain-trials.json, capture/lab/prodapp-mac/runs/drain/finish-01.server.log, capture/lab/prodapp-mac/runs/drain/finish-01.log.jsonl, capture/lab/prodapp-mac/runs/suite/qwen3-4b/rep-1/cases/14-hung_tool_times_out.json; libs/langchain_v1/langchain/agents/middleware/tool_retry.py, model_fallback.py, model_call_limit.py, and tool_error.py at langchain==1.5.0.
