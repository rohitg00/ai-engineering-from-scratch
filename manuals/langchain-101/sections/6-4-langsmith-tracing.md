# LangSmith tracing

> Tracing adds about 5 ms to an agent run, holds the process at exit when the endpoint fails, and sends LangChain runs even when you ask for local tracing.

You turn on tracing to see why an agent called the wrong tool. Later the LangSmith endpoint goes down, and your nightly script takes 80 seconds longer to exit. You switch to `tracing_context(enabled="local")` to keep the data on your machine, and the client still sends the agent runs to the default host.

When you finish this section, you can turn tracing on and off, and read the run tree it builds. You can also predict what tracing costs a run, what an endpoint failure does at exit, and what keeps a trace on your machine.

## How tracing turns on

**Trace:** a tree of runs for one top-level call. Each run has a name, a run type, inputs, outputs, an error, and its child runs.

**Run tree:** the in-memory object of one run, `RunTree` in `langsmith`. The client sends each run tree to the LangSmith API.

The docs turn tracing on for LangChain with two variables: `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` {{docs langsmith/observability-quickstart}}. An account outside the US also sets `LANGSMITH_ENDPOINT`. The SDK decides on each call with `tracing_is_enabled()`, in this order {{code src/langsmith/utils.py}}. It reads each variable once per process and caches it, so set the variables before the first call:

1. The value of the current `tracing_context`, when it is not `None`.
2. True when a parent run tree is active.
3. A global value set with `langsmith.configure`.
4. The variable `LANGSMITH_TRACING_V2` or `LANGCHAIN_TRACING_V2`, and when neither is set, `LANGSMITH_TRACING` or `LANGCHAIN_TRACING`. Only the exact string `true` turns tracing on.

`langsmith` is a dependency of `langchain-core`, so every agent has the SDK. With no variable set, a `traceable` function is a plain call, and no run tree exists:

```listing
title: traceable with tracing off
source: capture/out/42-langsmith.txt
lang: json
---
{
  "tracing_is_enabled()": false,
  "result": {
    "answer": "value-for-alpha"
  }
}

get_current_run_tree() inside the call: None
```

Inside `tracing_context(enabled="local")`, the same function builds a run tree. The kit gives the tree to an `on_end` callback and records it. The child run `lookup` shares the trace id of its parent, and its `dotted_order` starts with the order of the parent:

```listing
title: the child run of a local trace
source: capture/out/42-langsmith.txt
lang: json
note: The child run, cut to its identity fields.
---
      "name": "lookup",
      "run_type": "tool",
      "id": "<uuid-2>",
      "trace_id": "<uuid-1>",
      "parent_run_id": "<uuid-1>",
      "dotted_order": "<dotted-time><uuid-1>.<dotted-time><uuid-2>",
```

A LangChain run makes a deeper tree, with one chain run for each graph node and one leaf for each model call and tool call. [Section 1.2](#s-one-create-agent-run) draws that tree for one agent turn.

## The value "local" sends LangChain runs

`tracing_context` accepts `True`, `False`, `None`, and the string `"local"` for `enabled` {{code src/langsmith/run_helpers.py}}. The docstring of `langsmith.configure` describes the four values {{code src/langsmith/run_trees.py}}. `True` traces and sends, `False` turns tracing off, `None` reads the environment, and `"local"` traces and keeps the data local. The `traceable` code of `langsmith` keeps that promise. It sends a run only when the value is `True` {{code src/langsmith/run_helpers.py}}.

LangChain code does not. The callback manager of `langchain-core` asks `tracing_is_enabled()` and treats any truthy answer as on {{code libs/core/langchain_core/callbacks/manager.py}}. The string `"local"` is truthy, so the manager adds a `LangChainTracer`, and that tracer sends each run {{code libs/core/langchain_core/tracers/context.py}}. [Figure](#fig-6-4c) follows both paths.

```figure
id: fig-6-4c
kind: sequence
title: what tracing_context(enabled="local") keeps and sends
claim: A traceable function in a local context keeps its run tree, an agent in the same context sends 14 requests, and enabled=False with collect_runs sends none.
caption: Read the rows from top to bottom. Rows 1 and 2 are a traceable function, and rows 3 to 5 are an agent in the same context. Rows 6 and 7 are the agent with tracing off. From capture/out/42-langsmith.txt.
```

The kit wraps one agent turn in a local trace, with a client whose HTTP session records each request and sends nothing:

```listing
title: an agent turn inside tracing_context(enabled="local")
source: capture/out/42-langsmith.txt
lang: json
note: The requests for the traceable runs, then the requests for the agent turn.
---
HTTP requests the client received for the traceable runs:
{}
…
HTTP requests the client received, by method and path:
{
  "PATCH /runs/<run-id>": 7,
  "POST /runs": 7
}
```

**We measured** the same case on the Mac, Apple M1 Max, 10 cores, 64 GiB, with `langsmith` 0.14.17 and `langchain-core` 1.8.0. Each case ran once, in a new process. With no `LANGSMITH_*` variable at all, a `create_agent` run inside `"local"` tried to reach the default host. We had replaced the HTTP layer, so nothing left the machine:

```listing
title: the requests of a local agent run with no environment
source: capture/lab/summary/tracing-mac.json
lang: json
---
   "case": "local:agent:patched-requests",
   "env": [],
   "requests": [
    "GET https://api.smith.langchain.com/info",
    "POST https://api.smith.langchain.com/runs/multipart",
    "POST https://api.smith.langchain.com/runs/multipart"
   ],
   "tracing_is_enabled": "local"
```

With `LANGSMITH_ENDPOINT` set and `LANGSMITH_TRACING` unset, the runs went to that endpoint instead. Wrapping the agent in `traceable` did not help, because the LangChain runs below it still went out.

## What keeps a trace on your machine

At the pin, no environment variable and no value of `enabled` keeps LangChain runs local while tracing is on. Use one of these instead:

- **Turn tracing off for LangChain code.** Leave `LANGSMITH_TRACING` unset, or wrap the call in `tracing_context(enabled=False)`. The context value comes first in the order above, so it also wins over an outer `"local"` context and over the variable.
- **Collect the runs in memory.** `collect_runs()` from `langchain_core.tracers.context` adds a collector that keeps every finished run, with tracing on or off.
- **Run your own endpoint.** Set `LANGSMITH_ENDPOINT` to a LangSmith server on your own machine or network. Then the runs leave the process and stay with you.
- **Use `"local"` for `traceable` code only.** It keeps the run trees of functions that call no LangChain code.

The kit runs the agent with tracing off inside an outer `"local"` context, and collects the runs:

```listing
title: tracing_context(enabled=False) with collect_runs
source: capture/out/42-langsmith.txt
lang: json
---
collect_runs().traced_runs:
[
  "llm ScriptedChatModel",
  "tool add",
  "llm ScriptedChatModel",
  "chain LangGraph"
]

HTTP requests the client received:
{}
```

`traced_runs` holds the top run of each callback tree in the order they finished. The `LangGraph` run holds the node runs as its children. The client received nothing.

## What tracing costs a run

The LangSmith product page says that the SDK sends traces in the background and that application performance is never affected {{site langchain.com/langsmith/observability}}.

**We measured** an agent with two model calls and one tool call, seven traced runs in all, on the Mac. The endpoint was a local recorder that answered at once. Each condition ran in three processes of 60 runs, interleaved, and we left out the first run of each process. That leaves 177 runs per condition. [Figure](#fig-6-4) shows each run with tracing off and on.

```figure
id: fig-6-4
kind: chart
title: time of one agent run with tracing off and on
claim: Tracing raised the median agent run from 2.59 ms to 7.56 ms, about 0.7 ms for each of the seven traced runs.
caption: Each dot is one agent run on the Mac, 177 per condition, and the black line is the median. The endpoint was a local recorder that answered at once. From capture/lab/summary/tracing-mac.json.
```

The median run took 2.59 ms with tracing off and 7.56 ms with tracing on. The first traced run in each process took 89 to 171 ms, because the client starts and asks the endpoint for its settings. Next to a model call of hundreds of milliseconds, 5 ms is small. It is not zero, and the first call of a short-lived process pays more.

A third traced condition set `LANGCHAIN_CALLBACKS_BACKGROUND=false`, and its median was 5.82 ms. The docs say that `false` makes callbacks wait {{docs langsmith/trace-with-langchain}}, but no code in `langchain-core` 1.8.0 or `langsmith` 0.14.17 reads it. Only two packages name it. `langgraph-cli` lists it as reserved in its deploy command {{code libs/cli/langgraph_cli/deploy.py:76}}. `langgraph-api` 0.18.0 sets it to `true` for its JS worker {{code langgraph_api/js/remote.py:119}}. No Python code reads it.

So that condition ran the same code as tracing on. Its gap of 1.74 ms is not an effect of the variable, and we did not find the cause. The register records the docs and the code as D111.

## When the endpoint fails

The same product page says that your agent keeps running normally during a LangSmith incident {{site langchain.com/langsmith/observability}}. The tracing docs warn that the process can end before all traces are sent {{docs langsmith/trace-with-langchain}}.

**We measured** one process of 50 agent runs, 350 traced runs, for each state of the endpoint, on the Mac. [Figure](#fig-6-4b) shows the time from the last run to the exit of the process.

```figure
id: fig-6-4b
kind: chart
title: seconds from the last run to process exit, by endpoint
claim: Every agent run answered in every case, but a failing endpoint held the exit for 72 to 81 seconds, and a hanging one kept the process alive.
caption: Each dot is one process of 50 agent runs on the Mac. The fraction over a dot is the traced runs that reached the endpoint. The hanging endpoint is an arrow, because we killed that process at 900 s. From capture/lab/summary/tracing-mac.json.
```

- **The runs.** In every case, all 50 agent runs returned the right answer and raised no error. The claim holds for the runs.
- **An endpoint that is down.** The exit waited 80.7 s, and then the client dropped all 350 runs.
- **An endpoint that returns 500.** The client sent 96 posts, retries included, and the exit waited 72.2 s. All 350 runs reached the endpoint, and it refused each one.
- **An endpoint that accepts and never answers.** The process never exited. We killed it after 900 s, and 300 of the 350 runs had reached the endpoint.
- **A slow endpoint.** With 2 s per request, the exit waited 18.0 s, and all 350 runs arrived.

At the pin, the exit waited for the traces, so the warning in the docs did not apply to a working endpoint. The cost moved to the exit, where a script, a test run, or a serverless handler pays it. Call `wait_for_all_tracers()` from `langchain_core.tracers.langchain` at a point you choose. After it, the exit took 0.4 s. The flush itself took 71 ms against a working endpoint and 7.5 s against a slow one.

## How runs are batched

The usage page of the docs says that the SDK batches up to 100 runs of one session into one API call {{docs langsmith/usage-and-billing}}. In our runs the client posted to `/runs/multipart`, and each full post held 49 to 51 runs. In four of the nine processes, the first post held one run. In the other five, it held 50. The last post held the rest, so a latency process averaged 42 to 47 runs per post.

We never saw 100 runs in one post. The kit turns batching off with `auto_batch_tracing=False`, so it shows one `POST /runs` for each run.

The claims that need a LangSmith account are coming in the next edition. They are retention, rate limits, the limit of runs per trace, and the speed of the hosted store. [Section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) lists them.

```takeaways
- Wrap LangChain code in tracing_context(enabled=False) when its traces must stay on the machine.
- Use collect_runs to keep the runs of an agent in memory without a LangSmith endpoint.
- Call wait_for_all_tracers() before a script or a handler exits.
- Expect a first traced run of up to 171 ms in each new process.
- Set a timeout on the job that runs a traced script, because a hanging endpoint blocks the exit.
```

Sources: capture/s_integrations.py, capture/out/42-langsmith.txt; capture/lab/summary/tracing-mac.json, capture/lab/TRC-tracing-mac/03-latency-summary.jsonl, capture/lab/TRC-tracing-mac/01-failure-summary.jsonl, capture/lab/TRC-tracing-mac/02-tracing-context-local.jsonl, capture/lab/TRC-tracing-mac/03-latency-load.txt; src/langsmith/utils.py, src/langsmith/run_helpers.py, src/langsmith/run_trees.py, and src/langsmith/client.py at langsmith v0.14.17; libs/core/langchain_core/callbacks/manager.py, libs/core/langchain_core/tracers/context.py, and libs/core/langchain_core/tracers/langchain.py at langchain==1.5.0; libs/cli/langgraph_cli/deploy.py at langgraph 1.2.22; langgraph_api/js/remote.py at langgraph-api 0.18.0; docs.langchain.com at docs commit 04d4d4a (langsmith/observability-quickstart, langsmith/trace-with-langchain, langsmith/usage-and-billing); the product page www.langchain.com/langsmith/observability, read 2026-11-14.
