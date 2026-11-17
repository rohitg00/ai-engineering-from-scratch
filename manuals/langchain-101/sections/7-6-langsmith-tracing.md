# LangSmith tracing

> On the hosted LangSmith API, tracing added about 6 ms to a real agent run, and `enabled="local"` still sent every LangChain run there.

You turn on tracing to see why an agent called the wrong tool. Later the LangSmith endpoint goes down, and your nightly script waits at exit, and never exits if the endpoint hangs. You switch to `tracing_context(enabled="local")` to keep the data on your machine, and the client still sends the agent runs to your account.

When you finish this section, you can turn tracing on and off, and read the run tree that the server stores. You can also predict what tracing costs a run, when a trace becomes readable, and what keeps a trace on your machine.

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

## The tree that the server stores

A LangChain run makes a deeper tree, with one chain run for each graph node and one leaf for each model call and tool call. [Section 1.3](#s-one-create-agent-run) draws that tree for one agent turn.

**We measured** the tree on the hosted API with a new account on the free plan, from the Mac. The agent was `create_agent` with Qwen3 4B on Ollama and one tool `add`. We read one stored trace back with the client. It held 7 runs, with the same names as the local recorder had received:

| Run | Type | Parent | Tags | Tokens |
|---|---|---|---|---|
| `LangGraph` | chain | none | none | 574 |
| `model` | chain | `LangGraph` | `graph:step:1` | 278 |
| `ChatOllama` | llm | `model` | `seq:step:1` | 278 |
| `tools` | chain | `LangGraph` | `graph:step:2` | 0 |
| `add` | tool | `tools` | `seq:step:1` | 0 |
| `model` | chain | `LangGraph` | `graph:step:3` | 296 |
| `ChatOllama` | llm | `model` | `seq:step:1` | 296 |

The root holds the sum of the tokens, 545 in and 29 out. `first_token_time` is set on the root, on each `model` run, and on each `llm` run. `total_cost` is null on every run, because the server has no price for an Ollama model.

The metadata of an `llm` run holds `ls_provider`, `ls_model_name`, `ls_temperature`, and the `langgraph_*` keys of its node. The client also copies `LANGSMITH_PROJECT` and `LANGSMITH_TRACING` into the metadata of every run. `extra.runtime` holds the SDK and library versions and the platform string of the machine.

The same tree shows in the trace view of the LangSmith web app. [Figure](#fig-7-6d) redraws one of the 30 traced runs against the hosted API that are timed below. The agent asked for `add(a=305, b=18)` and answered 323 in 6.13 s. The two model calls took 3.33 s and 2.79 s, and the tool call took less than 0.01 s.

```figure
id: fig-7-6d
kind: tree
title: one traced agent run in the LangSmith trace view
claim: One create_agent run of Qwen3 4B is a LangGraph root with 6 child runs, and its two model calls take 3.33 s and 2.79 s of 6.13 s.
caption: Read the run tree on the left from the top, and the messages of the root run on the right. Redrawn from a screenshot of the trace view on the hosted free plan. The run is row 58 of capture/lab/T21-langsmith-account-mac/02-e1-timing.jsonl.
```

## The value "local" sends LangChain runs

`tracing_context` accepts `True`, `False`, `None`, and the string `"local"` for `enabled` {{code src/langsmith/run_helpers.py}}. The docstring of `langsmith.configure` describes the four values {{code src/langsmith/run_trees.py}}. `True` traces and sends, `False` turns tracing off, `None` reads the environment, and `"local"` traces and keeps the data local. The `traceable` code of `langsmith` keeps that promise. It sends a run only when the value is `True` {{code src/langsmith/run_helpers.py}}.

LangChain code does not. The callback manager of `langchain-core` asks `tracing_is_enabled()` and treats any truthy answer as on {{code libs/core/langchain_core/callbacks/manager.py}}. The string `"local"` is truthy, so the manager adds a `LangChainTracer`, and that tracer sends each run {{code libs/core/langchain_core/tracers/context.py}}. [Figure](#fig-7-6c) follows both paths.

```figure
id: fig-7-6c
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

**We measured** the same case against the hosted API on the Mac, with `langsmith` 0.14.17 and `langchain-core` 1.8.0. The process had a key and a project name, and `LANGSMITH_TRACING` was unset. Three agent runs inside `"local"` each called a `traceable` function too. All 21 LangChain runs reached the server, in 7 multipart posts. The server created the project `aiefs-lc101-local` for them. The `traceable` function sent nothing:

```listing
title: what the server stored for three agent runs inside enabled="local"
source: capture/lab/summary/langsmith-account-mac.json
lang: json
---
  "agent_runs": 3,
  "env": [
   "LANGSMITH_API_KEY",
   "LANGSMITH_PROJECT"
  ],
  "multipart_posts": 7,
  "project": "aiefs-lc101-local",
  "project_created": true,
  "stored_runs": {
   "chain LangGraph": 3,
   "chain model": 6,
   "chain tools": 3,
   "llm ChatOllama": 6,
   "tool add": 3
  },
  "traceable_name": "t21_local_traceable",
  "traceable_stored": 0
```

So `"local"` keeps nothing local for an agent, even on a real account. We filed a report in `langchain-ai/langchain` as #41870.

**We measured** the same case earlier against a local recorder on the Mac, with no endpoint, no key, and `LANGSMITH_TRACING=false`. The agent run tried to reach the default host. We had replaced the HTTP layer, so nothing left the machine:

```listing
title: the requests of a local agent run with no environment
source: capture/lab/summary/tracing-mac-real.json
lang: json
---
   "case": "local:agent:patched-requests",
   "env": [
    "LANGSMITH_TRACING"
   ],
   "local_trees": 0,
   "request_count": 4,
   "requests": [
    "GET https://api.smith.langchain.com/info",
    "POST https://api.smith.langchain.com/runs/multipart",
    "POST https://api.smith.langchain.com/runs/multipart",
    "POST https://api.smith.langchain.com/runs/multipart"
   ],
   "tracing_is_enabled": "local"
```

So a process with no key at all still tries to send. Wrapping the agent in `traceable` did not help, because the LangChain runs below it still went out.

## What keeps a trace on your machine

At the pin, no environment variable and no value of `enabled` keeps LangChain runs local while tracing is on. Use one of these instead:

- **Turn tracing off for LangChain code.** Wrap the call in `tracing_context(enabled=False)`. The context value comes first in the order above, so it wins over an outer `"local"` context and over every variable. Leaving `LANGSMITH_TRACING` unset is not enough, because `LANGSMITH_TRACING_V2`, `LANGCHAIN_TRACING_V2`, or an outer context can still turn tracing on.
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
  "llm ChatOllama",
  "tool add",
  "llm ChatOllama",
  "chain LangGraph"
]

HTTP requests the client received:
{}
```

`traced_runs` holds the top run of each callback tree in the order they finished. The `LangGraph` run holds the node runs as its children. The client received nothing.

## What tracing costs a run

The LangSmith product page says that the SDK sends traces in the background and that application performance is never affected {{site langchain.com/langsmith/observability}}.

**We measured** the agent against the hosted API on the Mac, 30 runs with tracing on and 30 with it off, interleaved in one process. Every run answered right. We took the time outside the model: the wall time minus the time Ollama reported for its two replies. We left out the first traced run, which spent 121 ms outside the model.

- **Tracing off.** The median run spent 10.9 ms outside the model.
- **Tracing on.** The median run spent 16.9 ms outside the model.
- **The difference.** The medians differ by 5.9 ms. A bootstrap of 10,000 resamples gives a 95% interval of 3.5 to 8.6 ms.

The median wall time was 11.66 s off and 11.78 s on. Another agent used the same Ollama model during the batch, so the model time moved by seconds. Read no result from the wall time.

**We measured** the cost first against a local recorder on the Mac, which answered at once. One process ran 122 runs and turned tracing on and off on every other run. We left out the first two, which leaves 60 runs per condition. [Figure](#fig-7-6) shows each run.

```figure
id: fig-7-6
kind: chart
title: time outside the model of one agent run with tracing off and on
claim: Tracing raised the median time outside the model from 17.7 ms to 26.3 ms, 7.4 ms in pairs, about 1.1 ms for each of seven traced runs.
caption: Each dot is one agent run on the Mac, 60 per condition, interleaved in one process, and the black line is the median. The endpoint was a local recorder that answered at once. From capture/lab/summary/tracing-mac-real.json.
```

With the recorder, tracing added 7.4 ms in pairs of runs. That is close to the 5.9 ms against the hosted API. Next to a model call, 6 ms is small. It is not zero, and the first call of a short-lived process pays more.

With the recorder, the first run of six of seven traced processes spent 83 to 243 ms outside the model. In its first traced run, the client starts and asks the endpoint for its settings.

A third traced condition set `LANGCHAIN_CALLBACKS_BACKGROUND=false`, in three processes of 21 runs against the recorder. The docs say that `false` makes callbacks wait {{docs langsmith/trace-with-langchain}}, but no code in `langchain-core` 1.8.0 or `langsmith` 0.14.17 reads it. Only two packages name it. `langgraph-cli` lists it as reserved in its deploy command {{code libs/cli/langgraph_cli/deploy.py:76}}, which is line 71 in the 0.4.43 wheel. `langgraph-api` 0.18.0 sets it to `true` for its JS worker {{code langgraph_api/js/remote.py:119}}. No Python code reads it.

So that condition ran the same code as tracing on. They ran in separate processes under a load of 4.6 to 27.5, so we read no effect from their times. The register records the docs and the code as D111.

## When a trace becomes readable

`invoke` returns before the server has the trace. The client sends the runs from a background thread, and the server stores them later.

**We measured** the delay on the 30 traced runs against the hosted API. After each `invoke` returned, the script called `read_run` on the root every 0.25 s, plus the time of each read. So the resolution is set by the poll and the reads, and the numbers below are estimates:

| Event | Median | p90 | Max |
|---|---|---|---|
| the root run is readable | 1.46 s | 2.06 s | 3.57 s |
| the root has its end time and outputs | 5.63 s | 7.78 s | 10.49 s |

No poll timed out. A test that reads its own trace right after a run must wait. Poll for the end time, and allow at least 10 s.

## What the client sends

**We measured** every request of the 30 traced runs against the hosted API. The client sent only `POST /runs/multipart`, three posts per traced run, and each one got status 202. It sent no `PATCH` and no `POST /runs`. The only other requests were two `GET /info`, one for each client in the process:

```listing
title: the requests of 30 traced runs to the hosted API
source: capture/lab/summary/langsmith-account-mac.json
lang: json
---
  "requests": {
   "GET /info 200": 2,
   "POST /runs/multipart 202": 90
  },
  "responses_with_rate_limit_headers": 0,
```

Each post carried `Content-Encoding` and the headers `X-Pre-Compressed-Size` and `X-Post-Compressed-Size`. The client compresses with zstd when the `/info` of the server enables it {{code src/langsmith/_internal/_background_thread.py:572}} {{code src/langsmith/client.py:3599}}. The hosted `/info` set `zstd_compression_enabled` to true. No response carried a rate limit header.

The usage page of the docs says that the SDK batches up to 100 runs of one session into one API call {{docs langsmith/usage-and-billing}}. With the local recorder and a real model, each post held 1 to 4 runs, mostly 3 or 4. The client sent what it had while the model ran. Against a recorder that took 2 s per request, a post held up to 18 runs.

The kit turns batching off with `auto_batch_tracing=False`, so it shows one `POST /runs` and one `PATCH` for each run. The default client does not send that shape.

## When the endpoint fails

The same product page says that your agent keeps running normally during a LangSmith incident {{site langchain.com/langsmith/observability}}. The tracing docs warn that the process can end before all traces are sent {{docs langsmith/trace-with-langchain}}.

**We measured** one process of 50 agent runs of Qwen3 4B, 350 traced runs, for each state of a local recorder on the Mac. A recorder can fail on demand, and the hosted API cannot. [Figure](#fig-7-6b) shows the time from the last run to the exit of the process.

```figure
id: fig-7-6b
kind: chart
title: seconds from the last run to process exit, by endpoint
claim: Every agent run answered in every case, a failing endpoint held the exit for 9.9 to 17.1 seconds, and a hanging one kept the process alive.
caption: Each dot is one process of 50 agent runs of Qwen3 4B on the Mac. The fraction over a dot is the traced runs that reached the endpoint. The hanging endpoint is an arrow, because we killed that process at 300 s. From capture/lab/summary/tracing-mac-real.json.
```

- **The runs.** In every case, all 50 agent runs returned the right answer and raised no error. The claim holds for the runs.
- **An endpoint that is down.** The exit waited 9.9 s, and none of the 350 runs arrived.
- **An endpoint that returns 500.** The client sent 132 posts, retries included, and the exit waited 17.1 s. All 350 runs reached the endpoint, and it refused each one.
- **An endpoint that accepts and never answers.** The process did not exit on its own. We killed it after 300 s, 208 s after its last run. By then 50 of the 350 runs had reached the endpoint, in 6 posts of the same 50 runs.
- **A slow endpoint.** With 2 s per request, the exit waited 3.7 s, and all 350 runs arrived.

At the pin, the exit waited for the traces, so the warning in the docs did not apply to a working endpoint. The cost moved to the exit, where a script, a test run, or a serverless handler pays it. Call `wait_for_all_tracers()` from `langchain_core.tracers.langchain` at a point you choose. After it, the exit took 0.4 s. The flush itself took 68 ms against a working recorder and 4.0 s against a slow one.

## The limits that the account reports

The client reads its batch settings from `GET /info`, and the server also reports its limits there. **We measured** what the hosted API returned to the new account on the free plan, with GET requests only:

```listing
title: the batch settings and limits in GET /info of the hosted API
source: capture/lab/summary/langsmith-account-mac.json
lang: json
note: The batch settings, then the instance flags.
---
  "batch_ingest_config": {
   "scale_down_nempty_trigger": 4,
   "scale_up_nthreads_limit": 16,
   "scale_up_qsize_trigger": 1000,
   "size_limit": 100,
   "size_limit_bytes": 20971520,
   "use_multipart_endpoint": true
  },
…
   "max_longlived_ttl_days": 180,
   "per_project_retention_enabled": false,
   "trace_tier_duration_days": {
    "longlived": 400,
    "shortlived": 14
   },
   "trace_tree_max_runs": 1000,
```

- **A batch.** One post holds at most 100 runs and 20 MiB, and the client uses the multipart endpoint.
- **A trace.** One trace holds at most 1,000 runs. A deep agent that loops for a long time can reach it.
- **Retention.** The default tier of new traces is `shortlived`, set by the system. `/info` gives 14 days for it and 400 for `longlived`. The flag `max_longlived_ttl_days` says 180, and the allowed values go from 30 to 400. We did not find which one applies. Retention per project was off.
- **Rate limits.** No response carried a rate limit header. `/usage-limits` returned an empty list, and the rate limit fields of the organization were null.
- **The plan.** The organization allowed one workspace and one identity.

`GET /sessions` answered with a `deprecation` header and a `sunset` date of 1 July 2027, and it named `/api/v2/sessions` as the successor. The SDK warns that `list_runs` is deprecated after 31 January 2027, and the code marks `read_run` the same way {{code src/langsmith/client.py:4063}}. Code that reads or lists runs needs a new call before then. We did not send enough data to reach any of these limits.

```takeaways
- Wrap LangChain code in tracing_context(enabled=False) when its traces must stay on the machine.
- Use collect_runs to keep the runs of an agent in memory without a LangSmith endpoint.
- Call wait_for_all_tracers() before a script or a handler exits.
- Poll for the end time of a root run before a test reads its trace.
- Expect the first traced run of each new process to spend about 120 ms outside the model.
- Set a timeout on the job that runs a traced script, because a hanging endpoint blocks the exit.
```

Sources: capture/s_integrations.py, capture/out/42-langsmith.txt; capture/lab/summary/langsmith-account-mac.json, capture/lab/T21-langsmith-account-mac/02-e1-timing.jsonl, capture/lab/T21-langsmith-account-mac/02-e1-timing-requests.jsonl, capture/lab/T21-langsmith-account-mac/03-e1-tree.jsonl, capture/lab/T21-langsmith-account-mac/03b-e1-local.json, capture/lab/T21-langsmith-account-mac/01-account-probe.json, capture/lab/T21-langsmith-account-mac/_scripts/t21_e1_trace.py, capture/lab/T21-langsmith-account-mac/_scripts/t21_probe.py; capture/lab/summary/tracing-mac-real.json, capture/lab/TRC-tracing-mac-real/04-interleave-summary.jsonl, capture/lab/TRC-tracing-mac-real/03-latency-summary.jsonl, capture/lab/TRC-tracing-mac-real/01-failure-summary.jsonl, capture/lab/TRC-tracing-mac-real/02-tracing-context-local.jsonl, capture/lab/TRC-tracing-mac-real/trc_child_real.py, capture/lab/TRC-tracing-mac-real/trc_driver.py; src/langsmith/utils.py, src/langsmith/run_helpers.py, src/langsmith/run_trees.py, src/langsmith/client.py, and src/langsmith/_internal/_background_thread.py at langsmith v0.14.17; libs/core/langchain_core/callbacks/manager.py, libs/core/langchain_core/tracers/context.py, and libs/core/langchain_core/tracers/langchain.py at langchain==1.5.0; libs/cli/langgraph_cli/deploy.py at langgraph 1.2.22; langgraph_api/js/remote.py at langgraph-api 0.18.0; docs.langchain.com at docs commit 04d4d4a (langsmith/observability-quickstart, langsmith/trace-with-langchain, langsmith/usage-and-billing); the product page www.langchain.com/langsmith/observability, read 2026-11-14; issue langchain-ai/langchain#41870.
