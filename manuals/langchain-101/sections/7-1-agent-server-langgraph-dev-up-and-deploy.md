# Agent Server: langgraph dev, up, and deploy

> Under `langgraph dev`, the server runs one job at a time and takes about a second per run, and `langgraph up` will not start without a key.

You move an agent from a script to `langgraph dev`, and you send it 100 requests at once. Each one waits about 13 seconds. The docs say that a worker runs 10 jobs at a time, and the `--help` text of the command says the same. The server ran one.

When you finish this section, you can start `langgraph dev`, set its jobs per worker, and predict its recursion limit and time per run. You can also choose a double texting strategy from its recorded effect, and say what `langgraph up` and `langgraph deploy` need.

## The three commands

**Agent Server:** the LangSmith server that runs a compiled graph behind an HTTP API of assistants, threads, and runs. The package is `langgraph-api`, and we read its code in the installed package.

The LangGraph CLI, `langgraph-cli` 0.4.43 at the pin, starts the server in three ways {{docs langsmith/cli}}:

| Command | What it runs | What it needs |
|---|---|---|
| `langgraph dev` | one Python process with the in-memory runtime, on `127.0.0.1:2024` | `pip install -U "langgraph-cli[inmem]"` and Python 3.11 or later |
| `langgraph up` | the server image in Docker, with Postgres and Redis containers | Docker, and a LangSmith API key for local use or a license key for production |
| `langgraph deploy` | a build and a push to LangSmith, which then runs the server | a LangSmith API key, and Docker for a local build |

Each command reads `langgraph.json`, which maps a graph id to the file and the variable of a compiled graph {{docs langsmith/cli}}. The lab app has three graphs:

```listing
title: langgraph.json of the lab app
source: capture/lab/T15-agent-server-x86/t15app/langgraph.json
lang: json
---
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./graphs.py:agent",
    "slow": "./graphs.py:slow",
    "loop": "./graphs.py:loop"
  },
  "python_version": "3.13",
  "env": {}
}
```

`agent` is a `create_agent` agent with a fake model that waits 50 ms per call. `slow` is two nodes that each sleep for half of the `seconds` in the input. `loop` is one node with an edge back to itself.

On Agent Server, you do not pass a checkpointer. The agents page says that LangSmith provisions one when you deploy, and that locally you pass one yourself {{docs oss/python/langchain/agents}}. So persistence that a script needed a `SqliteSaver` for comes with the server.

## The recursion limit of the server

The env var page of Agent Server gives `10011` as the default of `LANGGRAPH_DEFAULT_RECURSION_LIMIT` {{docs langsmith/env-var-cloud}}. The config module of `langgraph-api` 0.18.0 sets the same number {{code langgraph_api/utils/config.py}}. The library default of a `StateGraph` is 10007, as [section 5.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) shows.

**We measured** the `loop` graph under `langgraph dev` on the x86 server guest, 32 vCPU and 48 GiB. It ran once with no config and once with a limit of 50:

```listing
title: a looping graph under langgraph dev, with no config
source: capture/lab/T15-agent-server-x86/02-recursion.jsonl
lang: text
note: The first row, cut to the error text and the step count.
---
{"exp": "T15", "part": "recursion_limit", "server": "dev-default", "config": null, …'Recursion limit of 10007 reached without hitting a stop condition. …"n_in_state": 10007, "run_status": "error"}
```

The run stopped at 10007 steps after 7.3 s, with the status `error`. With `{"recursion_limit": 50}` in the config, it stopped at 50. So the limit you pass wins, and the default you get under `langgraph dev` is the library default. We did not trace why the server value did not apply. This manual records the three numbers as conflict D105. Pass `recursion_limit` on every run, and you need neither default.

## Jobs per worker

**Jobs per worker:** the number of runs that one queue worker of Agent Server executes at the same time. The setting is `N_JOBS_PER_WORKER`, or `--n-jobs-per-worker` for `langgraph dev`.

The sources give two defaults for `langgraph dev`. The `--help` text of the option says that the default is 10 {{code libs/cli/langgraph_cli/cli.py}}. The option itself has no default, and `langgraph-api` 0.18.0 then uses 1 {{code langgraph_api/cli.py}}. The Python tab of the CLI page gives 1, and the JS tab and the scale guide give 10 {{docs langsmith/cli}} {{docs langsmith/agent-server-scale}}. This manual records the difference as conflict D123 and follows the code.

**We measured** 20 background runs of the `slow` graph, 2 s each, on the x86 server guest, one run of each setting. With no setting, one run executed at a time, and the 20 runs took 41.0 s. With `--n-jobs-per-worker 10`, ten ran at once, and they took 5.1 s. With 100, all 20 ran at once, in 3.5 s.

```figure
id: fig-7-1
kind: chart
title: runs per second under langgraph dev, by concurrent clients
claim: With the default of one job per worker, throughput stayed near 8 runs per second, and a setting of 10 raised it to 56 at 100 clients.
caption: Each dot is one load run on the x86 server guest: 50 runs at 1 and 10 clients, then 5 runs per client. Each run is the agent graph through runs.wait. From capture/lab/summary/agent-server-x86.json.
```

**We measured** a load on the `agent` graph on the same guest. Each request created a thread and waited for one run. Each level ran once, with 50 runs or 5 per client, whichever was more. [Figure](#fig-7-1) shows the throughput. All 2,550 runs returned the right answer and no error.

| Jobs per worker | 1 client | 10 clients | 50 clients | 100 clients |
|---|---|---|---|---|
| default, 1 | 0.9 runs/s, p50 1,117 ms | 7.1 runs/s | 8.0 runs/s | 7.7 runs/s, p50 12,799 ms, p99 13,364 ms |
| 10 | 1.0 runs/s, p50 1,001 ms | 8.8 runs/s | 50.6 runs/s | 56.3 runs/s, p50 1,529 ms, p99 2,642 ms |
| 100 | 1.0 runs/s, p50 1,001 ms | 9.8 runs/s | 41.7 runs/s | 52.8 runs/s, p50 1,854 ms, p99 2,229 ms |

With one job per worker, 100 clients wait in one queue, and the median run takes 12.8 s. Set `--n-jobs-per-worker` to 10 or more for any test with more than one client. A setting of 100 was not faster than 10 at 100 clients.

## About one second for each run

At one client, every run took about one second, although the fake model waited only 100 ms in all. **We measured** four ways to start a run on the x86 server guest, 10 runs each, one at a time, with 10 jobs per worker:

| How the run started | Client time, p50 | Server time from created to updated, p50 |
|---|---|---|
| `runs.wait` on a thread | 994 ms | 990 ms |
| `runs.stream` in `values` mode | 995 ms | 989 ms |
| `runs.create`, then `runs.join` | 994 ms | 990 ms |
| `runs.wait` with no thread | 997 ms | not recorded |

The time was spent in the server, whose own record from created to updated was about 990 ms. Part of it is the queue of the in-memory runtime, which sleeps 0.5 s on each poll when it finds no run {{code langgraph_runtime_inmem/ops.py}}. We did not trace the rest. Read this floor as a property of `langgraph dev` at the pin. A floor for `langgraph up` with Postgres and Redis comes in the next edition.

## Double texting

**Double texting:** a second run on a thread while a first run on that thread is still running. Agent Server picks one of four multitask strategies, and `enqueue` is the default {{docs langsmith/double-texting}}.

The docs page says that double texting is a feature of the server, and that open source LangGraph does not have it {{docs langsmith/double-texting}}. [Section 4.2](#s-checkpointers-and-threads) covers threads in a script.

The lab script starts run A of the `slow` graph for 4 s. After 1 s, it sends run B of 2 s on the same thread, with a strategy:

```listing
title: the second run of each double texting case
source: capture/lab/T15-agent-server-x86/t15_drive.py
lang: python
note: Cut to the two runs and the wait between them.
---
        r1 = await client.runs.create(tid, "slow", input={"seconds": 4, "label": f"{strategy}-A"})
        await asyncio.sleep(1.0)
…
            r2 = await client.runs.create(tid, "slow", input={"seconds": 2, "label": f"{strategy}-B"}, multitask_strategy=strategy)
```

**We measured** each strategy once under `langgraph dev` on the x86 server guest. [Figure](#fig-7-1b) places each node of both runs on one time axis.

```figure
id: fig-7-1b
kind: timeline
title: the nodes of run A and run B under each multitask strategy
claim: reject refused run B, enqueue ran it after A, interrupt stopped A and lost its unfinished node, and rollback deleted A.
caption: Each track is one thread on the x86 server guest. A filled bar is a node of run A, and an outlined bar is a node of run B. The rose line is the moment run B was sent. From capture/lab/summary/agent-server-x86.json.
```

| Strategy | Run B | Run A | State and history at the end |
|---|---|---|---|
| `reject` | refused with HTTP 409 | finished with `success` | only the writes of A, 4 history entries |
| `enqueue` | waited, then started when A ended | finished with `success` | the writes of A, then of B, 8 history entries |
| `interrupt` | started at once | status `interrupted` | only the writes of B, 6 history entries |
| `rollback` | started at once | deleted, and a read of it raised `NotFoundError` | only the writes of B, 4 history entries |

The refusal of `reject` names the other strategies:

```listing
title: the refusal of reject
source: capture/lab/T15-agent-server-x86/04-double-texting.jsonl
lang: text
note: The first row, cut to the second run.
---
{"exp": "T15", "part": "double_texting", "server": "dev-default", "strategy": "reject", "second_run": {"accepted": false, "type": "ConflictError", "http_status": 409, "body": "{\"detail\":\"Thread is already running a task. Wait for it to finish or choose a different multitask strategy.\"}"}, …
```

The docs say that `interrupt` keeps the progress of the first run up to the point of the interrupt {{docs langsmith/double-texting}}. In our case, run A was inside its first node, so it had no finished step to keep. Its node never wrote, and the thread held only run B. A tool call that had started in that node would have no result, which the docs also warn about. Choose `enqueue` for a chat thread, and `reject` when a second message must wait for the user to retry.

## langgraph up needs a key

`langgraph up` builds the image of your app from `langchain/langgraph-api` and starts it with Postgres and Redis. Before it builds, it prints what it needs:

```listing
title: the first lines of langgraph up
source: capture/lab/T15-agent-server-x86/08-up-start-excerpt.txt
lang: text
---
Starting Agent Server...
For local dev, requires env var LANGSMITH_API_KEY with access to LangSmith Agent Server.
For production use, requires a license key in env var LANGGRAPH_CLOUD_LICENSE_KEY.
```

On the x86 server guest, with neither variable set, the image built, and both databases reported healthy. The API container exited with code 3:

```listing
title: the containers after langgraph up
source: capture/lab/T15-agent-server-x86/09-up-containers.txt
lang: text
---
t15app-langgraph-api-1 t15app-langgraph-api Exited (3) Less than a second ago
t15app-langgraph-redis-1 redis:6 Up 11 seconds (healthy)
t15app-langgraph-postgres-1 pgvector/pgvector:pg16 Up 11 seconds (healthy)
```

```listing
title: the log of the API container
source: capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt
lang: text
---
ValueError: License verification failed. Please ensure proper configuration:
- For local development, set a valid LANGSMITH_API_KEY for an account with LangGraph Cloud access in the environment defined in your langgraph.json file.
- For production, configure the LANGGRAPH_CLOUD_LICENSE_KEY environment variable with your LangGraph Cloud license key.
Review your configuration settings and try again. If issues persist, contact support for assistance.
```

So the server with Postgres and Redis does not start without an account or a license, even on your own machine. This edition does not use either. The tests of the full server stack come in the next edition, and [section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) lists them. They are a worker crash, a Redis or Postgres outage, exactly once in the task queue, and what Redis holds.

## langgraph deploy

This part comes from the docs and the code only. We did not run `langgraph deploy`, because it needs a LangSmith account.

`langgraph deploy` builds the image, pushes it to a registry that LangSmith manages, and creates or updates an Agent Server in one step {{docs langsmith/cli}}. Without Docker, it asks LangSmith to build the image from an upload of your source. The docs mark the command as beta.

- **The key.** The command reads `--api-key`, or `LANGGRAPH_HOST_API_KEY`, `LANGSMITH_API_KEY`, or `LANGCHAIN_API_KEY` {{code libs/cli/langgraph_cli/deploy.py}}.
- **The type.** A new server is `serverless` unless you pass `--agent-server-type dedicated` {{code libs/cli/langgraph_cli/deploy.py}}. The docs say that serverless scales to zero and has cold starts {{docs langsmith/cloud-platform-features}}.
- **Your own registry.** Self-hosted LangSmith needs `--push-to` for a registry you manage, or `--image-uri` with a digest {{docs langsmith/cli}}.
- **Other commands.** `langgraph deploy list`, `deploy metrics`, and `deploy listeners` read what you deployed {{code libs/cli/langgraph_cli/deploy.py}}.

Advisory GHSA-8prr-f582-jqq3 says that `langgraph deploy --verbose` printed the push token of the registry in `langgraph-cli` 0.4.15 to 0.4.31. The pin, 0.4.43, is outside that range. Keep `--verbose` out of CI logs anyway, because it prints the Docker build and push output.

```takeaways
- Start langgraph dev with --n-jobs-per-worker 10 before any test with more than one client.
- Pass recursion_limit on every run, because the server default is 10007 under langgraph dev.
- Expect about one second per run under langgraph dev, whatever the graph does.
- Use enqueue for chat threads, and reject when a second message must wait.
- Write nodes that can lose an unfinished write before you choose interrupt or rollback.
- Set LANGSMITH_API_KEY or LANGGRAPH_CLOUD_LICENSE_KEY before you run langgraph up.
```

Sources: capture/lab/summary/agent-server-x86.json, capture/lab/T15-agent-server-x86/02-recursion.jsonl, capture/lab/T15-agent-server-x86/03-workers.jsonl, capture/lab/T15-agent-server-x86/04-double-texting.jsonl, capture/lab/T15-agent-server-x86/05-load.jsonl, capture/lab/T15-agent-server-x86/08-up-start-excerpt.txt, capture/lab/T15-agent-server-x86/09-up-containers.txt, capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt, capture/lab/T15-agent-server-x86/12-latency-floor.jsonl, capture/lab/T15-agent-server-x86/t15_drive.py, capture/lab/T15-agent-server-x86/t15app/graphs.py, capture/lab/T15-agent-server-x86/t15app/langgraph.json; libs/cli/langgraph_cli/cli.py and libs/cli/langgraph_cli/deploy.py at langgraph-cli 0.4.43; langgraph_api/utils/config.py and langgraph_api/cli.py at langgraph-api 0.18.0; langgraph_runtime_inmem/ops.py at langgraph-runtime-inmem 0.38.0; docs.langchain.com at docs commit 04d4d4a (langsmith/cli, langsmith/env-var-cloud, langsmith/agent-server-scale, langsmith/double-texting, langsmith/cloud-platform-features, oss/python/langchain/agents); advisory GHSA-8prr-f582-jqq3.
