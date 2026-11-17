# Retries, backup models, rate limits, and caching

> Retry layers multiply, `ToolRetryMiddleware` repeats a tool after a timeout whose request already reached the service, and a backup model takes any exception.

Your agent calls a payment tool, the reply times out after one second, and the retry middleware calls it again. The first request had arrived. The customer now has two charges, and the run reports success.

When you finish this section, you can count the attempts of each retry layer and say which failures each one retries. You can set up retries that do not repeat a side effect. You can also add a backup model and say what a rate limiter and a cache do at the pin.

## Two layers for the model, one for tools

**Retry layer:** one piece of code that calls the model or the tool again after a failure.

A model call has two retry layers. The client inside the provider package retries first, and `ModelRetryMiddleware` retries around it. [Section 3.2](#s-init-chat-model-and-model-profiles) counted them with `ChatOpenAI`. The client made 3 attempts, the middleware made 3, and both together made 9. [Figure](#fig-3-2b) shows each run. `ChatOllama` made 1 attempt, because its client does not retry. 

A `RetryPolicy` on a graph node multiplies too: 9 attempts around the client default, and 27 around an agent with the middleware inside. The 6 retries of the models page did not hold for `ChatOpenAI` at the pin.

A tool call has one layer, `ToolRetryMiddleware`. A tool that raises with no middleware ends the run, as [section 3.4](#s-tools-toolruntime-and-tool-errors) shows. Both retry middlewares take the same options, with these defaults {{code libs/langchain_v1/langchain/agents/middleware/tool_retry.py}}:

| Option | Default | Meaning |
|---|---|---|
| `max_retries` | `2` | retries after the first attempt, so 3 attempts in all |
| `retry_on` | `default_retry_on` | which exceptions get a retry |
| `on_failure` | `"continue"` | after the last attempt, return a message in place of a raise |
| `initial_delay`, `backoff_factor`, `max_delay` | `1.0`, `2.0`, `60.0` | seconds before each retry, doubled each time |
| `jitter` | `True` | a random change to each delay |
| `tools` | `None` | `ToolRetryMiddleware` only: the tools to retry, or all of them |

The kit runs a tool that fails twice and then succeeds. With `max_retries=2`, the tool ran three times with the same argument:

```listing
title: three attempts of one tool call
source: capture/out/12-mw-retries.txt
lang: json
note: The attempts the tool recorded, in the first section of the file.
---
tool attempts:
[
  "http://svc.local/a",
  "http://svc.local/a",
  "http://svc.local/a"
]
```

With `max_retries=1`, when the retries run out under `on_failure="continue"`, the model gets an error `ToolMessage` and the run goes on:

```listing
title: the ToolMessage after the retries run out
source: capture/out/12-mw-retries.txt
lang: json
---
    "content": "Tool 'flaky_fetch' failed after 2 attempts with ConnectionError: attempt 2 refused. Please try again.",
    "name": "flaky_fetch",
```

With `on_failure="error"`, the run raised `ConnectionError: attempt 2 refused`.

`ModelRetryMiddleware` retries the model call. The kit pointed `ChatOllama` at a relay that closed its first two connections and passed the third to Ollama. With `max_retries=2`, the model got three calls, and the third answered `2 + 3 = 5.`.

With `max_retries=1` and `continue`, the middleware returns an `AIMessage` with the error text in place of a raise. The kit pointed a model at a port where nothing listens. So a failed model call looks like an answer: `Model call failed after 2 attempts with ConnectError: [Errno 111] Connection refused`.

## What each layer retries

**default_retry_on:** the default `retry_on` of both middlewares. It retries every `Exception`, except a LangChain `ModelError` whose `is_retryable` is false {{code libs/langchain_v1/langchain/agents/middleware/_retry.py}}.

A provider package that raises a `ModelError` gets no retry for an error that cannot pass. So the real 404 of Ollama got 1 attempt through `ChatOpenAI`. `ChatOllama` raises the `ResponseError` of the `ollama` client, which is not a `ModelError`. With `ModelRetryMiddleware`, its 404 got 3 attempts. A tool error is a plain exception, such as an `httpx` error, so the default retries all of them. The middleware cannot know if a failed tool request reached the service.

**We measured** `ToolRetryMiddleware()` with its defaults on the x86 server guest, 3 runs for each cell. Qwen3 4B on Ollama chose the tool call. The tool wrote to PostgreSQL. For a timeout, it inserted a row into a ledger table, then ran `pg_sleep(3)` under a `statement_timeout` of 1 s. All 3 runs of each cell gave the same counts:

| Failure of the tool | No middleware | `ToolRetryMiddleware()` | Ledger rows with the middleware |
|---|---|---|---|
| connection refused once | raised, 1 execution | 2 executions, then success | 1 |
| connection refused on every call | raised, 1 execution | 3 executions, then an error `ToolMessage` | 0 |
| a missing table on every call | raised, 1 execution | 3 executions, then an error `ToolMessage` | 0 |
| timeout once | raised, 1 execution | 2 executions, then success | 2 |
| timeout on every call | raised, 1 execution | 3 executions, then an error `ToolMessage` | 3 |

Every attempt after a timeout wrote its ledger row before the timeout. So a tool whose reply was lost ran its action again, up to 3 times. Issue langchain#40688 reports this for tools that are not idempotent {{issue langchain#40688}}. It is open at the pin, and our runs reproduce it with a real database. The default also retried the missing table, which no retry can fix.

After the error `ToolMessage`, the model did not call the tool again in 9 of 9 runs. Its last message was `done`, or text that starts with `Try again`, so it read like a success. [Figure](#fig-4-7) draws the timeout case.

```figure
id: fig-4-7
kind: sequence
title: a tool call that times out three times
claim: Each of the 3 attempts wrote its ledger row before the timeout, so an action whose reply was lost ran 3 times before the model saw an error.
caption: Read the rows from top to bottom. Each dashed olive arrow is an INSERT that wrote its row, and each dashed rose arrow is the QueryCanceled after 1 s. The ledger held 3 rows in each of 3 runs. From capture/lab/summary/retries-x86.json.
```

With both middlewares on, each layer kept its own count. A dropped model connection once and a refused tool connection once gave 3 model requests and 2 tool executions, and the run succeeded. A dropped model connection on every call gave 9 model requests and never reached the tool.

## A safe configuration

Choose one retry layer for each kind of call, and retry only what is safe to repeat:

1. For the model, keep the client retries and leave out `ModelRetryMiddleware`, or set `max_retries=0` on the model and add the middleware.
2. For tools, list only idempotent tools in the `tools` option of `ToolRetryMiddleware`.
3. Pass a `retry_on` that names the errors you know are safe, such as a refused connection or a 503.
4. Give each side effect an idempotency key that the service checks. [Section 5.3](#s-durability-modes-and-a-crash-between-two-steps) shows the same need after a crash.
5. Set your timeout budget from the attempts. Three attempts of 1 s, with 1 s and 2 s of delay, take 6 s for one tool call.

This is how the lab turned off the client layer for the middleware runs:

```listing
title: one retry layer for the model
source: capture/lab/T05-retries-x86/t05_real.py
lang: python
note: Parts of the model and build functions of the lab script. The lines between them are cut at the mark.
---
    kw = {"timeout": to}
    if config in ("openai_mw_only",):
        kw["max_retries"] = 0
    return chat_openai(model=name, port=port, **kw)
…
def build(config, model, tl):
    mw = []
    if config in ("openai_mw_only", "openai_stacked", "ollama_mw", "openai_both_mw"):
        mw.append(ModelRetryMiddleware())
```

A `retry_on` tuple limits a retry to those exception types. In the kit, the refused connection raised `httpx.ConnectError`, which is not a `TimeoutError`. It got no retry and raised at once:

```listing
title: a retry_on filter
source: capture/s_middleware.py
lang: python
---
        tools=[], middleware=[ModelRetryMiddleware(max_retries=2, retry_on=(TimeoutError,), on_failure="error", **fast)])
```

## Backup models

**ModelFallbackMiddleware:** the middleware that calls the next model in its list when a model call raises.

The kit gives it a primary `ChatOllama` on a port where nothing listens, and one backup on Ollama. The primary got one call that raised `httpx.ConnectError`, and the backup answered:

```listing
title: the answer after the primary model raised
source: capture/out/13-mw-fallback-refusal.txt
lang: json
note: The message of the run.
---
    "type": "AIMessage",
    "content": "2 + 3 = 5.",
```

The middleware tries each model in order, and it takes any `Exception` {{code libs/langchain_v1/langchain/agents/middleware/model_fallback.py}}. When every model raises, the run raises the last error. The kit pointed all three models at the dead port, so the run raised `httpx.ConnectError: [Errno 111] Connection refused`. The code does not check the kind of error, so a 400 from a bad request also moves to the next model. That run is coming in the next edition, and [section 8.8](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) lists it.

A refusal is not an exception. `ModelRefusalMiddleware` raises `ModelRefusalError` only when the reply has a standard `refusal` content block, and it does not read the text {{code libs/langchain_v1/langchain/agents/middleware/model_refusal.py}}. List `ModelFallbackMiddleware` first and `ModelRefusalMiddleware` second, and a refusal block goes to the backup.

The kit asked Qwen3 4B how to pick the lock of a neighbour's door. The model refused in plain text, with `I'm sorry, but I can't assist with that.`. Ollama sends no refusal block, so the text was a normal answer in all three runs. That held with no middleware, with `ModelRefusalMiddleware`, and with both middlewares. The backup got no call. So a refusal in text needs a check of your own.

## Rate limits and caching

A chat model takes a `rate_limiter`. `InMemoryRateLimiter` is a token bucket with `requests_per_second=1` and `max_bucket_size=1` by default, in one process {{code libs/core/langchain_core/rate_limiters.py}}. The models page warns that it counts requests and not their size {{docs oss/python/langchain/models}}. Two processes each get their own bucket.

There are two caches. `set_llm_cache` caches model replies in LangChain. The `cache` argument of `create_agent` is a LangGraph node cache. We did not run either one, or the rate limiter, against a model. Those runs come in the next edition, and [section 8.8](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) lists them.

```takeaways
- Use one retry layer for model calls, and set max_retries=0 on the model if you add ModelRetryMiddleware.
- Pass tools= to ToolRetryMiddleware with only idempotent tools.
- Pass a narrow retry_on, because the default retries every tool exception, including a missing table.
- Send an idempotency key with every side effect that a retry can repeat.
- Check the last AIMessage for a failure text when ModelRetryMiddleware uses continue.
- List ModelFallbackMiddleware before ModelRefusalMiddleware to send refusal blocks to the backup, and check refusals in text yourself.
```

Sources: capture/out/12-mw-retries.txt, capture/out/13-mw-fallback-refusal.txt, capture/s_middleware.py, capture/common.py, libs/langchain_v1/langchain/agents/middleware/model_refusal.py at langchain==1.5.0; capture/lab/summary/retries-x86.json, capture/lab/T05-retries-x86/01-model-faults.jsonl, capture/lab/T05-retries-x86/02-tool-faults.jsonl, capture/lab/T05-retries-x86/03-both-faults.jsonl, capture/lab/T05-retries-x86/t05_real.py, capture/lab/T05-retries-x86/lr_common.py; issue langchain#40688; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/models, oss/python/langchain/middleware/built-in); libs/langchain_v1/langchain/agents/middleware/tool_retry.py, model_retry.py, _retry.py, and model_fallback.py at langchain==1.5.0; libs/core/langchain_core/rate_limiters.py at langchain-core 1.8.0.
