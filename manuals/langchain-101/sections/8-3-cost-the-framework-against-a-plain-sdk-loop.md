# Cost: the framework against a plain SDK loop

> `create_agent` adds about 5 ms per model call and no tokens to a plain loop, while Deep Agents, long plain threads, and a failing trace endpoint cost far more.

Your team has a plain loop on the `openai` client that works. Someone asks what LangChain would cost before you move to it. The answer has several parts: time per call, tokens, request bytes, import time, disk, checkpoints, and traces.

When you finish this section, you can say what each layer of the stack adds to a run, and choose where to spend it.

## The cost sheet

**We measured** each row of this table on one machine, and the row names the machine and the count. The Mac is an Apple M1 Max with 10 cores and 64 GiB, shared with other work. The x86 server guest has 32 vCPU and 48 GiB. The machines differ, so compare numbers inside a row, never across rows.

| Cost | Plain loop | LangChain | Machine and count | Section |
|---|---|---|---|---|
| time beyond the model in one run of three Qwen3 4B calls | 25.1 ms (1.3% of the run) | 37.6 ms with `create_agent` (2.3%), 15.6 ms more in the same round | the Mac, 40 runs each | this section |
| prompt tokens of the three calls of that run, on Qwen3 4B | 261, 300, 340 | the same | the Mac, 40 runs each | this section |
| request bytes of those three calls, on Qwen3 4B | 679, 936, 1,199 | 696, 948, 1,206 | the Mac, 40 runs each | this section |
| prompt tokens of a one-word answer, on Qwen3 8B | 28 | 28 with `create_agent`, 2,279 with `create_deep_agent` | the Mac, 3 runs each | [7.4](#s-deep-agents-0-7) |
| imports, with bytecode written | 0.329 s for `openai` | 0.831 s for `create_agent` and `ChatOpenAI` | the Mac, 10 runs each | [3.1](#s-install-and-the-package-map) |
| install | 14 packages, 26,356 KiB | 44 packages, 54,312 KiB | the Mac, one install each | [3.1](#s-install-and-the-package-map) |
| one checkpoint write on `PostgresSaver`, median of the last 10 of 5,000 steps | none | 148.65 ms plain, 1.13 ms with `DeltaChannel` | the x86 server guest, one run | [5.5](#s-context-engineering-and-summarization) |
| time outside the model of one Qwen3 4B agent run with tracing on, against a local recorder | none | 26.3 ms against 17.7 ms with tracing off, 0.5% of the run | the Mac, 60 interleaved runs each | [7.6](#s-langsmith-tracing) |
| one middleware hook, each time it runs | none | 183 to 190 µs node hook, 45 to 50 µs wrap hook, 0.2 to 0.5% of a real Qwen3 4B run | the x86 server guest under load 14 to 25, 20 runs per cell | this section |

The rest of this section gives the recordings behind the first three rows and the last row, which no other section shows in full. [Section 9.7](#s-workers-the-advisory-lock-and-cost) prices a whole support conversation from measured tokens: $0.61 for 1,000 conversations on Claude Haiku 5.5.

## Time per run

The task of the recording is one question that needs two tools, `add` and then `multiply`, and three model calls. Eight programs ran it against Qwen3 4B on Ollama, five on the `/v1` path and three on the native path. A proxy timed each model call. Every run gave the right answer, and each program called the same tools with the same arguments.

**Time outside the model:** the wall time of a run minus the time of its model calls at the proxy. It holds the HTTP client and the proxy hop too, so a plain loop also has some.

- **plain `openai` loop**: the `openai` client, a list of messages, and a loop over the tool calls.
- **`ChatOpenAI.bind_tools` loop**: the same loop, with the model of `langchain-openai` in place of the client.
- **`create_agent`**: the agent with `ChatOpenAI` and the two tools.
- **`create_agent` with `InMemorySaver`**: the same agent with a checkpointer and a thread.
- **hand-built `StateGraph`**: a model node, a `ToolNode`, and `tools_condition`, the same graph as `create_agent` written by hand.
- **native programs**: a plain `ollama` loop, `create_agent` with `ChatOllama`, and the hand-built `StateGraph` with `ChatOllama`, all on `/api/chat`.

```figure
id: fig-8-3
kind: chart
title: time beyond the model in one run of three Qwen3 4B calls
claim: In a real run of 1.8 s, create_agent spent 37.6 ms outside the model against 25.1 ms for a plain openai loop, and a hand-built StateGraph 36.7 ms.
caption: Each dot is one run on the Mac, 40 per program, in shuffled rounds, and the black line is the median. From capture/lab/summary/overhead-mac-real.json.
```

**We measured** 40 runs of each program on the Mac, in 40 shuffled rounds after 2 warm-up rounds. [Figure](#fig-8-3) shows each run. Every run gave 20 after `add(2, 3)` and `multiply(5, 4)`. The median time outside the model was 25.1 ms for the plain loop and 29.3 ms for the `bind_tools` loop. It was 37.6 ms for `create_agent`, 37.6 ms with `InMemorySaver`, and 36.7 ms for the hand-built `StateGraph`. Against the plain loop in the same round, they added 6.6, 15.6, 12.2, and 11.5 ms.

On the native path, the plain `ollama` loop spent 11.7 ms outside the model. `create_agent` with `ChatOllama` spent 29.0 ms, 13.0 ms more, and the `StateGraph` 22.2 ms, 7.8 ms more.

Per model call, the agent layer adds about 4 to 5 ms, and 3 ms of CPU. On the `/v1` path, the time outside the model was 1.3 to 2.3% of a run of 1.7 to 2.0 s. The model time moved from 1.2 s to 3.7 s per run with the other load on the machine. So compare the time outside the model, not the wall time.

## Tokens and request bytes

A framework could add tokens: a system prompt of its own, extra tool fields, or a schema. `create_agent` adds none. **We measured** the usage that Ollama returned for each call, through a proxy that recorded each request, 40 runs per program on the Mac. Every run of a program had the same three calls:

| Call | Plain loop: bytes, prompt tokens, completion tokens | `create_agent`: bytes, prompt tokens, completion tokens |
|---|---|---|
| 1 | 679, 261, 25 | 696, 261, 25 |
| 2 | 936, 300, 25 | 948, 300, 25 |
| 3 | 1,199, 340, 3 | 1,206, 340, 3 |

The tokens were the same for both programs, call by call. The request of `create_agent` was 7 to 17 bytes longer on each call.

**We captured** the raw request bodies of both programs at the proxy, 5 runs each, and compared them call by call. Every byte of the difference is in this ledger:

```listing
title: the bytes that create_agent adds to each request
source: capture/lab/last-two-mac/03-request-body-diff.txt
lang: text
note: Cut to the ledger of each request. The other bytes are the same keys and values in another order.
---
### request 1: a_plain_openai (679 B) vs c_create_agent (696 B), round 1, raw bodies as sent
…
  +15 B  "stream":false added
  +2 B  "temperature":0 -> "temperature":0.0
  ledger sum +17 B; measured +17 B
### request 2: a_plain_openai (936 B) vs c_create_agent (948 B), round 1, raw bodies as sent
…
  +15 B  "stream":false added
  +2 B  "temperature":0 -> "temperature":0.0
  +2 B  assistant turn 1: "content":"" -> "content":null
  +3 B  assistant turn 1: arguments {"a":2,"b":3} -> {"a": 2, "b": 3}
  -10 B  assistant turn 1: "index":0 dropped
  ledger sum +12 B; measured +12 B
### request 3: a_plain_openai (1199 B) vs c_create_agent (1206 B), round 1, raw bodies as sent
…
  +2 B  assistant turn 2: "content":"" -> "content":null
  +3 B  assistant turn 2: arguments {"a":5,"b":4} -> {"a": 5, "b": 4}
  -10 B  assistant turn 2: "index":0 dropped
  ledger sum +7 B; measured +7 B
```

`ChatOpenAI` adds `"stream": false` and writes the temperature as a float, 17 bytes on every call. For each earlier tool call in the history, it sends `"content": null` where the plain loop echoed the empty string of Ollama. It writes the arguments again with spaces, and it leaves out the `"index": 0` that the plain loop copied from `model_dump()`. That is 5 bytes fewer per turn. The tool schemas are equal as JSON but not as bytes: `create_agent` writes `"type": "object"` after `"required"`, and `"content"` before `"role"` in each message.

The headers differ in two fields. The LangChain programs send `x-stainless-raw-response: true`, because `ChatOpenAI` calls the client through `with_raw_response` {{code libs/partners/openai/langchain_openai/chat_models/base.py}}. In the recorded requests they also had no `x-stainless-read-timeout`, which the plain loop sent.

The Deep Agents harness is the exception. On Qwen3 8B, `create_deep_agent` sent 2,075 to 2,251 more prompt tokens on every call than a plain loop. That was 81.4 times the tokens of a one-word answer, 10.0 times for two tool calls, and 9.1 times for a file task. [Section 7.4](#s-deep-agents-0-7) and [figure](#fig-7-4) show each call. Pay those tokens only when you use the planning, the files, or the subagents.

The task suite of [section 1.2](#s-do-you-need-langchain) gives the same picture at scale. The deep agent sent 3.6 to 4.3 times the prompt tokens of the plain loop. On Claude Haiku 5.5 that was about 3,570 more per call. Prompt caching changes the bill. On Claude the deep agent cost 1.16 to 1.24 times the plain loop, and 3.10 to 3.14 times at list price with no cache.

## Imports and disk

The cost of a process start matters for a CLI tool, a test run, and a serverless handler. [Section 3.1](#s-install-and-the-package-map) gives the import times with [figure](#fig-3-1b). With bytecode already written, the imports for `create_agent` and `ChatOpenAI` took 0.831 s at the median, against 0.329 s for `import openai`. On the first start with no bytecode, they took 2.64 s against 1.064 s. The install is about twice the size: 54,312 KiB against 26,356 KiB.

## Checkpoints

A checkpointer writes the whole state at each step, unless a channel saves only the change. [Section 5.5](#s-context-engineering-and-summarization) gives the recording with [figure](#fig-5-5b). On `PostgresSaver` with a plain message list, the median of the last 10 writes was 2.88 ms at 10 steps. At 5,000 steps it was 148.65 ms.

One thread of 5,000 steps held 7,289 MB. With `DeltaChannel`, the write stayed near 1.1 ms, and the thread held 81 MB with a snapshot every 100 steps. Summarize long threads, and measure the step count of your own threads.

## Tracing

Tracing adds a cost to each run and a cost at exit. [Section 7.6](#s-langsmith-tracing) gives both with [figure](#fig-7-6). Against a local recorder that answered at once, tracing added 7.4 ms to a 1.6 s agent run on Qwen3 4B. In six of seven processes, the first traced run spent 83 to 243 ms outside the model. A failing endpoint held the exit for 10 to 17 s, and a hanging endpoint kept the process alive.

[Section 9.4](#s-opentelemetry-spans-with-langsmith-off) traces a service with its own OpenTelemetry spans. With `LANGSMITH_TRACING` false or unset, a recorder got no request.

## Middleware hooks

Each middleware hook is one more node of the graph or one more wrapper around a call, as [section 4.5](#s-middleware-hooks-and-their-order) shows. A node hook, such as `before_model`, adds a step of the loop each time it runs. A wrap hook, such as `wrap_model_call`, adds a function call and no node.

**We measured** the cost on the x86 server guest with Qwen3 4B on Ollama. Framework time is wall time minus time inside the model call. A run of two model calls and one tool call took 2.61 s, of which 5.88 ms was framework. Cells had 1, 10, or 20 middlewares, 20 timed runs each in shuffled rounds. Every run gave the right answer, and the middlewares did nothing. The cost per hook call is the slope of the median over the middleware count, divided by the calls of that hook in one run.

| Hook | Calls in one run | Cost of each call | Framework time with 20 middlewares | Graph nodes with 20 |
|---|---|---|---|---|
| `before_model` | 2 | 183 µs | 13.2 ms | 24 |
| `after_model` | 2 | 190 µs | 13.5 ms | 24 |
| `before_agent` | 1 | 187 µs | 9.6 ms | 24 |
| `wrap_model_call` | 2 | 45 µs | 7.7 ms | 4 |
| `wrap_tool_call` | 1 | 50 µs | 6.9 ms | 4 |

The framework share of the run was 0.2% with no middleware and 0.5% with 20 node hooks. The load average was 14 to 25, because Ollama used every core. So read the shares and the ratio of node hooks to wrap hooks, not the microseconds.

**We measured** nine setups of built-in middleware in the same way on the x86 server guest with Qwen3 4B, 20 runs per cell. Seven held one middleware, one held five `PIIMiddleware` instances, and one held a stack of five. None of them acted: no retry, no limit reached, no summary, no interrupt.

| Middleware, as configured | Added to a run | Graph nodes |
|---|---|---|
| `ToolRetryMiddleware()` | 0.14 ms | 4 |
| `ModelRetryMiddleware()` | 0.15 ms | 4 |
| `SummarizationMiddleware` with a trigger that never fires | 0.36 ms | 5 |
| `ToolCallLimitMiddleware(run_limit=1000)` | 0.75 ms | 5 |
| `HumanInTheLoopMiddleware` with no interrupt for the tool that ran | 0.86 ms | 5 |
| `ModelCallLimitMiddleware(run_limit=1000)` | 1.30 ms | 6 |
| `PIIMiddleware("email", strategy="redact")` | 1.36 ms | 6 |
| five `PIIMiddleware` instances, one per type | 4.77 ms | 14 |
| a stack of summarization, PII, a model call limit, tool retry, and review | 3.39 ms | 10 |

The cost follows the node count. The retries wrap calls and add under 0.2 ms, and each middleware with a node adds 0.4 to 1.4 ms. The five PII instances added 4.8 ms to a 2.64 s run of Qwen3 4B, 0.4%. So choose middleware for what it does, and keep node hooks out of a loop that makes thousands of fast calls.

```takeaways
- Budget about 5 ms per model call for create_agent beyond the model, under 3% of a local model run.
- Expect the same prompt tokens from create_agent as from your plain loop.
- Choose Deep Agents for its tools, and turn on prompt caching, because each call carries thousands more tokens.
- Use DeltaChannel or summarization when a thread runs to thousands of steps.
- Count the import time in every short-lived process, such as a CLI tool or a handler.
- Call wait_for_all_tracers() before a traced process exits.
- Prefer a wrap hook to a node hook when a middleware runs on every call of a fast loop.
```

Sources: capture/lab/summary/overhead-mac-real.json, capture/lab/T01-overhead-mac-real/01-runs.jsonl, capture/lab/T01-overhead-mac-real/t01_real.py, capture/lab/T01-overhead-mac-real/mr_common.py, capture/lab/last-two-mac/02-request-bodies.jsonl, capture/lab/last-two-mac/03-request-body-diff.txt, capture/lab/last-two-mac/lt2_body_diff.py, capture/lab/last-two-mac/lt2_diff.py, capture/lab/last-two-mac/lt_common.py; capture/lab/bench/summary-mac.json, capture/lab/bench/runs/main.jsonl, capture/lab/bench/runs/cost-ledger.jsonl; capture/lab/summary/import-times-mac.json, capture/lab/summary/install-size-mac.json, capture/lab/summary/tokens-mac.json, capture/lab/summary/checkpoint-cost-x86.json, capture/lab/summary/tracing-mac-real.json; capture/lab/summary/middleware-x86.json, capture/lab/T11-middleware-cost-x86/01-cost.jsonl, capture/lab/T11-middleware-cost-x86/t11_real.py; capture/lab/summary/middleware-mac.json; libs/partners/openai/langchain_openai/chat_models/base.py at langchain-openai 1.8.0.
