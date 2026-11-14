# Cost: the framework against a plain SDK loop

> `create_agent` costs about 1 ms of Python per model call and sends the same tokens as a plain loop, while Deep Agents, plain checkpoints, and tracing cost far more.

Your team has a plain loop on the `openai` client that works. Someone asks what LangChain would cost before you move to it. The answer has several parts: time per call, tokens, request bytes, import time, disk, checkpoints, and traces.

When you finish this section, you can say what each layer of the stack adds to a run, and choose where to spend it.

## The cost sheet

**We measured** each row of this table on one machine, and the row names the machine and the count. The Mac is an Apple M1 Max with 10 cores and 64 GiB, shared with other work. The x86 server guest has 32 vCPU and 48 GiB. The machines differ, so compare numbers inside a row, never across rows.

| Cost | Plain loop | LangChain | Machine and count | Section |
|---|---|---|---|---|
| wall time of one run of three model calls, against a stub | 4.1 ms | 7.67 ms with `create_agent` | the Mac, 200 runs each | this section |
| prompt tokens of the three calls of that run, on Qwen3 4B | 258, 297, 337 | the same | the Mac, 24 runs each | this section |
| request bytes of those three calls, on Qwen3 4B | 668, 915, 1,168 | 685, 937, 1,195 | the Mac, 24 runs each | this section |
| prompt tokens of a one-word answer, on Qwen3 8B | 28 | 28 with `create_agent`, 2,279 with `create_deep_agent` | the Mac, 3 runs each | [6.3](#s-deep-agents-0-7) |
| imports, with bytecode written | 0.329 s for `openai` | 0.831 s for `create_agent` and `ChatOpenAI` | the Mac, 10 runs each | [2.1](#s-install-and-the-package-map) |
| install | 14 packages, 26,356 KiB | 44 packages, 54,312 KiB | the Mac, one install each | [2.1](#s-install-and-the-package-map) |
| one checkpoint write on `PostgresSaver`, median of the last 10 of 5,000 steps | none | 148.65 ms plain, 1.13 ms with `DeltaChannel` | the x86 server guest, one run | [4.5](#s-context-engineering-and-summarization) |
| one agent run with tracing on, against a local recorder | none | 7.56 ms against 2.59 ms with tracing off | the Mac, 177 runs each | [6.4](#s-langsmith-tracing) |
| one middleware hook, each time it runs | none | 93.4 to 95.4 µs for a node hook, 18.7 to 20.5 µs for a wrap hook | the Mac, 300 runs per cell | this section |

The rest of this section gives the recordings behind the first three rows and the last row, which no other section shows in full.

## Time per run

The task of the recording is one question that needs two tools, `add` and then `multiply`, and three model calls. Four programs ran it against a local stub that answers each call at once, so the time is the time of the Python code. Two of them also ran against Qwen3 4B on Ollama. Every run gave the right answer, and each program called the same tools with the same arguments.

- **plain `openai` loop**: the `openai` client, a list of messages, and a loop over the tool calls.
- **`ChatOpenAI.bind_tools` loop**: the same loop, with the model of `langchain-openai` in place of the client.
- **`create_agent`**: the agent with `ChatOpenAI` and the two tools.
- **`create_agent` with `InMemorySaver`**: the same agent with a checkpointer and a thread.

```figure
id: fig-7-2
kind: chart
title: wall time of one run of three model calls against a stub
claim: Against a stub that answers at once, create_agent took 7.67 ms per run against 4.1 ms for a plain openai loop, and a checkpointer added 1.27 ms.
caption: Each dot is one run on the Mac, 200 per program, and the black line is the median. The stub answers each model call at once. From capture/lab/summary/overhead-mac.json.
```

**We measured** 200 runs of each program on the Mac, after warm-up runs that the summary leaves out. [Figure](#fig-7-2) shows each run. The medians were 4.1 ms for the plain loop, 4.46 ms for the `bind_tools` loop, 7.67 ms for `create_agent`, and 8.94 ms with the checkpointer. So the model object of `langchain-openai` added 0.36 ms per run, the agent graph added 3.21 ms more, and the checkpointer 1.27 ms more.

Per model call, the agent layer adds about 1.2 ms. Against Ollama, 24 runs each, the medians were 1,450.99 ms for the plain loop and 1,550.32 ms for `create_agent`. That gap of about 99 ms is inside the spread of the model time on a shared machine, so read it as noise. A hosted model call of hundreds of milliseconds hides 1 ms.

## Tokens and request bytes

A framework could add tokens: a system prompt of its own, extra tool fields, or a schema. `create_agent` adds none. **We measured** the usage that Ollama returned for each call, through a proxy that recorded each request, 24 runs per program on the Mac. Every run of a program had the same three calls:

| Call | Plain loop: bytes, prompt tokens, completion tokens | `create_agent`: bytes, prompt tokens, completion tokens |
|---|---|---|
| 1 | 668, 258, 25 | 685, 258, 25 |
| 2 | 915, 297, 25 | 937, 297, 25 |
| 3 | 1,168, 337, 3 | 1,195, 337, 3 |

The tokens were the same for both programs, call by call. The request of `create_agent` was 17 to 27 bytes longer on each call. Against the stub, the bodies differed by 17 bytes on every call, and the diff shows those bytes:

```listing
title: the first request body of each program, as a diff
source: capture/lab/T01-overhead-mac/09-request-body-diff.txt
lang: text
---
### request 1: a_plain_openai (643 B) vs c_create_agent (660 B)
--- a_plain_openai
+++ c_create_agent
@@ -9,3 +9,4 @@
  "seed": 42,
- "temperature": 0,
+ "stream": false,
+ "temperature": 0.0,
  "tools": [
```

`ChatOpenAI` adds `"stream": false` and writes the temperature as a float. The messages and the tool schemas are the same, byte for byte. The headers differ in two fields. The LangChain programs send `x-stainless-raw-response: true`, because `ChatOpenAI` calls the client through `with_raw_response`, and they send no `x-stainless-read-timeout` {{code libs/partners/openai/langchain_openai/chat_models/base.py}}.

The Deep Agents harness is the exception. On Qwen3 8B, `create_deep_agent` sent 2,075 to 2,251 more prompt tokens on every call than a plain loop. That was 81.4 times the tokens of a one-word answer, 10.0 times for two tool calls, and 9.1 times for a file task. [Section 6.3](#s-deep-agents-0-7) and [figure](#fig-6-3) show each call. Pay those tokens only when you use the planning, the files, or the subagents.

## Imports and disk

The cost of a process start matters for a CLI tool, a test run, and a serverless handler. [Section 2.1](#s-install-and-the-package-map) gives the import times with [figure](#fig-2-1b). With bytecode already written, the imports for `create_agent` and `ChatOpenAI` took 0.831 s at the median, against 0.329 s for `import openai`. On the first start with no bytecode, they took 2.64 s against 1.064 s. The install is about twice the size: 54,312 KiB against 26,356 KiB.

## Checkpoints

A checkpointer writes the whole state at each step, unless a channel saves only the change. [Section 4.5](#s-context-engineering-and-summarization) gives the recording with [figure](#fig-4-5b). On `PostgresSaver` with a plain message list, the median of the last 10 writes was 2.88 ms at 10 steps. At 5,000 steps it was 148.65 ms.

One thread of 5,000 steps held 7,289 MB. With `DeltaChannel`, the write stayed near 1.1 ms, and the thread held 81 MB with a snapshot every 100 steps. Summarize long threads, and measure the step count of your own threads.

## Tracing

Tracing adds a cost to each run and a cost at exit. [Section 6.4](#s-langsmith-tracing) gives both with [figure](#fig-6-4). Against a local recorder that answered at once, the median agent run took 7.56 ms with tracing on and 2.59 ms with it off. The first traced run in a process took 89 to 171 ms. A failing endpoint held the exit of the process for 72 to 81 s, and a hanging endpoint kept it alive.

## Middleware hooks

Each middleware hook is one more node of the graph or one more wrapper around a call, as [section 3.3](#s-middleware-hooks-and-their-order) shows. A node hook, such as `before_model`, adds a step of the loop each time it runs. A wrap hook, such as `wrap_model_call`, adds a function call and no node.

**We measured** the cost on the Mac with a fake model inside the process, so each run cost only Python time. A run was two model calls and one tool call through sync `invoke`, and it took 1,123.6 µs at the median with no middleware. For each hook type, an agent had 1, 3, 10, or 20 middlewares that do nothing. Each cell had 300 timed runs, in six shuffled blocks, and every run gave the right answer. The cost per hook call is the slope of the median over the middleware count, divided by the calls of that hook in one run.

| Hook | Calls in one run | Cost of each call | Median run with 20 middlewares | Graph nodes with 20 |
|---|---|---|---|---|
| `before_model` | 2 | 94.5 µs | 4,916.6 µs | 24 |
| `after_model` | 2 | 93.4 µs | 4,864.2 µs | 24 |
| `before_agent` | 1 | 95.4 µs | 3,053.8 µs | 24 |
| `wrap_model_call` | 2 | 20.5 µs | 1,973.4 µs | 4 |
| `wrap_tool_call` | 1 | 18.7 µs | 1,524.6 µs | 4 |

**We measured** nine built-in middlewares in the same way on the Mac, one at a time. Each cell had 300 runs and a history of 2 messages. None of them acted: no retry, no limit reached, no summary, no interrupt.

| Middleware, as configured | Added to a run | Graph nodes |
|---|---|---|
| `ToolRetryMiddleware()` | 41 µs | 4 |
| `ModelRetryMiddleware()` | 82 µs | 4 |
| `SummarizationMiddleware` with a trigger that never fires | 213 µs | 5 |
| `ToolCallLimitMiddleware(run_limit=1000)` | 217 µs | 5 |
| `HumanInTheLoopMiddleware` with no interrupt for the tool that ran | 268 µs | 5 |
| `PIIMiddleware("email", strategy="redact")` | 446 µs | 6 |
| `ModelCallLimitMiddleware(run_limit=1000)` | 475 µs | 6 |
| five `PIIMiddleware` instances, one per type | 2,243 µs | 14 |
| a stack of summarization, PII, a model call limit, tool retry, and review | 1,492 µs | 10 |

The cost follows the node count. The retries wrap calls and add under 0.1 ms, and each middleware with a node adds 0.2 to 0.5 ms. A history of 60 messages changed the added time by less than 0.1 ms in each row. Next to the median overhead run on Ollama, 1,450.99 ms for three model calls, even the five PII instances add 0.2%. So choose middleware for what it does, and keep node hooks out of a loop that makes thousands of fast calls.

```takeaways
- Budget about 1 ms of Python per model call for create_agent, and more with a checkpointer.
- Expect the same prompt tokens from create_agent as from your plain loop.
- Choose Deep Agents only when you need its tools, because each call carries over 2,000 more tokens.
- Use DeltaChannel or summarization when a thread runs to thousands of steps.
- Count the import time in every short-lived process, such as a CLI tool or a handler.
- Call wait_for_all_tracers() before a traced process exits.
- Prefer a wrap hook to a node hook when a middleware runs on every call of a fast loop.
```

Sources: capture/lab/summary/overhead-mac.json, capture/lab/T01-overhead-mac/02-stub-runs.jsonl, capture/lab/T01-overhead-mac/03-ollama-proxy-usage.jsonl, capture/lab/T01-overhead-mac/04-ollama-runs.jsonl, capture/lab/T01-overhead-mac/09-request-body-diff.txt; capture/lab/summary/import-times-mac.json, capture/lab/summary/install-size-mac.json, capture/lab/summary/tokens-mac.json, capture/lab/summary/checkpoint-cost-x86.json, capture/lab/summary/tracing-mac.json; capture/lab/summary/middleware-mac.json, capture/lab/T11-middleware-cost-mac/01-custom-runs.jsonl, capture/lab/T11-middleware-cost-mac/02-builtin-runs.jsonl, capture/lab/T11-middleware-cost-mac/t11_run.py; libs/partners/openai/langchain_openai/chat_models/base.py at langchain-openai 1.8.0.
