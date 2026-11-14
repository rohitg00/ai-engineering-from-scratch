# Error handlers, node timeouts, and the recursion limit

> A failed node attempt goes to its `RetryPolicy` and then to its `error_handler`, a timeout counts as one failure, and the recursion limit stops an endless run.

A node calls a service that fails, and you want the graph to try again and then go on to a report. Another node waits on a service that never answers. A third loop never meets its stop condition. LangGraph has one setting for each of these, and they act in a fixed order.

When you finish this section, you can give a node a retry policy, an error handler, and a timeout. You can also predict its attempts and set a fitting recursion limit.

## RetryPolicy, then the error handler

**RetryPolicy:** the settings for running a failed node again: `max_attempts`, the wait between attempts, and `retry_on`, which decides which exceptions to retry.

**Error handler:** a function that runs after the last failed attempt of a node. It gets the state and a `NodeError`, and it returns an update or a `Command`.

The kit node `flaky` raises `ValueError` on every attempt. It has a policy of 3 attempts that retries `ValueError`, and a handler that goes to `report`:

```listing
title: a node with a retry policy and an error handler
source: capture/s_graph.py
lang: python
---
    def handler(state, error: NodeError):
        return Command(update={"status": f"recovered from {error.node}: {error.error}"}, goto="report")

    g = StateGraph(S)
    g.add_node("flaky", flaky, retry_policy=RetryPolicy(max_attempts=3, initial_interval=0.0, jitter=False, retry_on=ValueError), error_handler=handler)
```

`compile` adds a node named `__error_handler__flaky` for the handler. The run made three attempts, then the handler ran, and the graph finished:

```listing
title: three attempts, then the handler
source: capture/out/37-error-handler-timeout.txt
lang: json
---
{
  "status": "recovered from flaky: upstream failed on try 3",
  "attempts": 3
}

tries:
[
  1,
  2,
  3
]
```

`max_attempts` counts the first attempt. The fault tolerance page states the order: the retry policy decides first, and the handler runs only when no attempt is left {{docs oss/python/langgraph/fault-tolerance}}. `set_node_defaults(error_handler=...)` on the `StateGraph` gives every node the same handler. In the kit, a node that raised `KeyError` went to it, and the run ended with `default handler: KeyError in boom`.

## The default retry_on does not retry ValueError

A `RetryPolicy()` with no arguments makes 3 attempts, waits 0.5 s before the second, doubles each wait up to 128 s, and adds jitter {{code libs/langgraph/langgraph/types.py}}. Its `retry_on` is `default_retry_on`. That function retries `ConnectionError` and HTTP status errors from 500 to 599 from `httpx` and `requests`. A `requests.HTTPError` with no response is retried too. It does not retry `ValueError`, `TypeError`, `ArithmeticError`, `ImportError`, `LookupError`, `NameError`, `SyntaxError`, `RuntimeError`, `ReferenceError`, `StopIteration`, `StopAsyncIteration`, or another `OSError`. It retries every other exception {{code libs/langgraph/langgraph/_internal/_retry.py}}.

The kit gave `flaky` a policy of 2 attempts with the default `retry_on`. The node ran once, and the run raised:

```listing
title: a ValueError with the default retry_on
source: capture/out/37-error-handler-timeout.txt
lang: text
---
raised builtins.ValueError: upstream failed on try 1

tries:
[
  1
]
```

So a policy that you add for a flaky service does nothing for a parse error, and that is often what you want. `KeyError` is a `LookupError`, so it is not retried either. Name the exception types in `retry_on` when you want them retried.

A retry runs the whole node again. The fault tolerance page says that the writes of a failed attempt are dropped, and that a side effect inside the node is not {{docs oss/python/langgraph/fault-tolerance}}. Send an idempotency key with each side effect. Section 1.1 shows what such a key did in the crash lab.

## Node timeouts

**Node timeout:** the `timeout` of `add_node`, in seconds, for each attempt of an async node. When an attempt runs longer, it fails with `NodeTimeoutError`.

The kit node `slow` sleeps 2 s, with a timeout of 0.05 s. `ainvoke` raised:

```listing
title: an async node past its timeout
source: capture/out/37-error-handler-timeout.txt
lang: text
---
raised langgraph.errors.NodeTimeoutError: Node 'slow' exceeded its run timeout of 0.050s (elapsed: <seconds>).
```

A timeout is one failed attempt, so the retry policy and then the error handler see it. With a handler, the same node gave the state `NodeTimeoutError: Node 'slow' exceeded its run timeout of 0.050s (elapsed: <seconds>).` in `status`, and the run went on. [Figure](#fig-5-8) draws the path of a failure.

```figure
id: fig-5-8
kind: decision
title: the path of a failed node attempt
claim: Every failed attempt, a timeout too, goes to retry_on first, and the error handler runs only after the last attempt, or the run raises.
caption: Read from the failed attempt at the top. Each grey box is one check, with the outcome of the kit beside its arrow. The rose box is the error that leaves invoke. From capture/out/37-error-handler-timeout.txt.
```

A timeout applies only to async nodes. The code refuses a timeout on a sync node, because a sync Python function cannot be stopped from outside {{code libs/langgraph/langgraph/_internal/_timeout.py}}. The kit does not record that refusal yet. A capture of it comes in the next edition, with the other open items of [section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition).

## The recursion limit

**Recursion limit:** the number of steps after which a run raises `GraphRecursionError`. Each step of the Pregel loop counts once, whatever number of nodes run in it.

A loop with `recursion_limit=5` in the config raised after five steps:

```listing
title: a loop past its recursion limit
source: capture/out/38-recursion-limit.txt
lang: text
---
raised langgraph.errors.GraphRecursionError: Recursion limit of 5 reached without hitting a stop condition. You can increase the limit by setting the `recursion_limit` config key.
For troubleshooting, visit: https://docs.langchain.com/oss/python/langgraph/errors/GRAPH_RECURSION_LIMIT
```

Three numbers are the default limit in different places, and they are easy to mix up:

| Where | Default | What sets it |
|---|---|---|
| a compiled `StateGraph` | 10007 | `DEFAULT_RECURSION_LIMIT` in `langgraph`, or the variable `LANGGRAPH_DEFAULT_RECURSION_LIMIT` |
| a `create_agent` graph | 9999 | the config that `create_agent` binds to its graph |
| a `langchain-core` runnable config | 25 | `DEFAULT_RECURSION_LIMIT` in `langchain_core` |

The graph API page gives 10,007 since `langgraph` 1.1.4, and 10,000 between 1.0.6 and 1.1.3 {{docs oss/python/langgraph/graph-api}}. Older advice names 25 as the graph default. At the pin, 25 is the default of a `langchain_core` runnable config, and a graph does not use it {{code libs/core/langchain_core/runnables/config.py}}. Pass `recursion_limit` at the top level of the config, not under `configurable` {{docs oss/python/langgraph/graph-api}}. This manual records the different numbers as conflict D105, and [section 7.1](#s-agent-server-langgraph-dev-up-and-deploy) shows the limit of Agent Server.

**We measured** each default on the Mac, one run of each case, from the summary that [section 1.2](#s-one-create-agent-run) also uses. A plain loop stopped at 10007 steps. With the variable set to 25, or with `recursion_limit=25`, it stopped at 25. The agent with a model that always calls a tool stopped at 9999 steps, after 5000 model calls and 4999 tool calls. With `recursion_limit=25`, the agent made 13 model calls. [Figure](#fig-5-8b) shows each run.

```figure
id: fig-5-8b
kind: chart
title: steps before GraphRecursionError
claim: A plain graph stops at 10007 steps and an agent at 9999, and each agent step is one model call or one tool call.
caption: Read one dot for each run on the Mac, on a log scale. The label beside each dot names the case and the model calls it made. From capture/lab/summary/recursion-mac.json.
```

So each turn of an agent is two steps, one in `model` and one in `tools`. Parallel tool calls from one model turn run as tasks of the same `tools` step {{code libs/langchain_v1/langchain/agents/factory.py}}. An agent that needs `n` sequential rounds of tool calls and one answer needs at least `2n + 1` steps.

## RemainingSteps

**RemainingSteps:** a managed value that you declare as a key of the state. LangGraph fills it with the number of steps left before the limit, and a node or an edge can read it.

The kit loop routes to `END` when `remaining_steps` is 2 or less. With `recursion_limit=5`, the run stopped by itself with `n` at 3 and raised nothing. Use it to end a long run with a partial answer instead of an exception.

```takeaways
- Name the exception types in retry_on, because the default skips ValueError and RuntimeError.
- Add an error_handler that routes to a node that reports the failure.
- Give a slow async node a timeout, and let the retry policy treat it as one failure.
- Set recursion_limit at the top level of the config for every run.
- Allow at least 2n plus 1 steps for n sequential rounds of tool calls.
- Read RemainingSteps in a loop to stop before the limit raises.
```

Sources: capture/s_graph.py, capture/out/37-error-handler-timeout.txt, capture/out/38-recursion-limit.txt; capture/lab/summary/recursion-mac.json, capture/lab/T17-claims-mac/01-recursion-limit.jsonl; libs/langgraph/langgraph/types.py, libs/langgraph/langgraph/_internal/_retry.py, libs/langgraph/langgraph/_internal/_timeout.py, libs/langgraph/langgraph/_internal/_config.py, and libs/langgraph/langgraph/graph/state.py at langgraph 1.2.22; libs/core/langchain_core/runnables/config.py and libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/fault-tolerance, oss/python/langgraph/graph-api).
