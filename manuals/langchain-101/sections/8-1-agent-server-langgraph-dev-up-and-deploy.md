# Agent Server: langgraph dev, up, and deploy

> Under `langgraph dev`, the server runs one job at a time and adds 0.6 to 1 s to each run, and `langgraph up` will not start without a key.

You move an agent from a script to `langgraph dev`, and you send it 16 requests at once. The median run takes 71 s, and 66 s of it is waiting before the model starts. The docs say that a worker runs 10 jobs at a time, and the `--help` text says the same. The server ran one. With a model on CPU, ten at a time is not faster.

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

`slow` is two nodes that each sleep for half of the `seconds` in the input. `loop` is one node with an edge back to itself. Neither calls a model. The `agent` of this app had a model stand-in, and this section uses none of its numbers.

The model runs used a second app, `t15rapp/`, with two graphs. Its `agent` is a `create_agent` agent with Qwen3 4B on Ollama and an `add` tool (`t15rapp/graphs.py`). Its `loopagent` is an agent whose tool always says to call it again. Ollama ran on CPU and served one model call at a time.

On Agent Server, you do not pass a checkpointer. The agents page says that LangSmith provisions one when you deploy, and that locally you pass one yourself {{docs oss/python/langchain/agents}}. So persistence that a script needed a `SqliteSaver` for comes with the server.

## The recursion limit of the server

The env var page of Agent Server gives `10011` as the default of `LANGGRAPH_DEFAULT_RECURSION_LIMIT` {{docs langsmith/env-var-cloud}}. The config module of `langgraph-api` 0.18.0 sets the same number {{code langgraph_api/utils/config.py}}. The library default of a `StateGraph` is 10007, as [section 6.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) shows.

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

**We measured** `loopagent` with Qwen3 4B under `langgraph dev` with `{"recursion_limit": 25}`, three runs. Each run ended with the status `error` and `GraphRecursionError` after 13 model calls and 12 tool calls, in 24 s. Without a config, a run was still going after 120 s and 58 model calls, and we cancelled it.

## Jobs per worker

**Jobs per worker:** the number of runs that one queue worker of Agent Server executes at the same time. The setting is `N_JOBS_PER_WORKER`, or `--n-jobs-per-worker` for `langgraph dev`.

The sources give two defaults for `langgraph dev`. The `--help` text of the option says that the default is 10 {{code libs/cli/langgraph_cli/cli.py}}. The option itself has no default, and `langgraph-api` 0.18.0 then uses 1 {{code langgraph_api/cli.py}}. The Python tab of the CLI page gives 1, and the JS tab and the scale guide give 10 {{docs langsmith/cli}} {{docs langsmith/agent-server-scale}}. This manual records the difference as conflict D123 and follows the code.

**We measured** 20 background runs of the `slow` graph, 2 s each, on the x86 server guest, one run of each setting. With no setting, one run executed at a time, and the 20 runs took 41.0 s. With `--n-jobs-per-worker 10`, ten ran at once, and they took 5.1 s. With 100, all 20 ran at once, in 3.5 s.

With the Qwen3 4B agent, 10 background runs took 47.1 s at one job per worker and 44.4 s at 10. All 10 started at once with the setting, and Ollama then answered their model calls one at a time.

```figure
id: fig-8-1
kind: chart
title: runs per second under langgraph dev with Qwen3 4B, by concurrent clients
claim: With Qwen3 4B on CPU, throughput stayed at 0.22 runs per second from 4 clients up, with 1 or 10 jobs per worker.
caption: Each dot is one load run on the x86 server guest, with 10 runs at 1 and 4 clients and 32 runs at 16. Each run is the Qwen3 4B agent through runs.wait on a new thread. From capture/lab/summary/agent-server-x86-real.json.
```

**We measured** a load on the Qwen3 4B `agent` graph on the same guest. Each request created a thread and waited for one run. Each level ran once. [Figure](#fig-8-1) shows the throughput. All 104 runs (10, 10, and 32 per setting) returned the right answer and no error.

| Jobs per worker | 1 client | 4 clients | 16 clients |
|---|---|---|---|
| default, 1 | 0.185 runs/s, p50 5,420 ms | 0.222 runs/s, p50 17,635 ms | 0.223 runs/s, p50 70,680 ms |
| 10 | 0.191 runs/s, p50 5,129 ms | 0.224 runs/s, p50 17,188 ms | 0.226 runs/s, p50 56,033 ms |

With one job per worker, the queue is in the server. At 16 clients, a run waited 66 s before its first model call. With 10, the queue moved into Ollama, and the model time of a run grew from 4.4 s to 43.8 s. The model sets the throughput, about 0.45 model calls per second at 16 clients, and the setting does not change it. Set it to 10 anyway when the model can serve calls in parallel.

## About one second added to each run

At one client, a run took 5.1 to 5.5 s, and the two model calls took 4.4 s of it. **We measured** two ways to start a run of the Qwen3 4B agent on the x86 server guest. Each ran 10 times, one at a time, with each jobs setting. The last column is the client time minus the time inside the model calls:

| How the run started | Client time, p50 | Model time, p50 | Added by the server, p50 |
|---|---|---|---|
| `runs.wait`, default jobs | 5,486 ms | 4,473 ms | 1,014 ms |
| `runs.create`, then `runs.join`, default jobs | 5,443 ms | 4,429 ms | 1,015 ms |
| `runs.wait`, 10 jobs | 5,139 ms | 4,443 ms | 661 ms |
| `runs.create`, then `runs.join`, 10 jobs | 5,087 ms | 4,385 ms | 651 ms |

Almost all of the added time came before the first model call. That wait was about 1,003 ms with the default, and 641 to 651 ms with 10 jobs. Part of it is the queue of the in-memory runtime, which sleeps 0.5 s on each poll when it finds no run {{code langgraph_runtime_inmem/ops.py}}. We did not trace the rest. Read this floor as a property of `langgraph dev` at the pin. A floor for `langgraph up` with Postgres and Redis comes in the next edition.

## Double texting

**Double texting:** a second run on a thread while a first run on that thread is still running. Agent Server picks one of four multitask strategies, and `enqueue` is the default {{docs langsmith/double-texting}}.

The docs page says that double texting is a feature of the server, and that open source LangGraph does not have it {{docs langsmith/double-texting}}. [Section 5.2](#s-checkpointers-and-threads) covers threads in a script.

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

**We measured** each strategy once under `langgraph dev` on the x86 server guest. [Figure](#fig-8-1b) places each node of both runs on one time axis.

```figure
id: fig-8-1b
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

## What langgraph dev sends to LangSmith

`langgraph dev` traces each run when the environment of the app turns tracing on. **We measured** it on the Mac with a key of a LangSmith account on the free plan, in a scratch environment. The versions were `langgraph-cli` 0.4.43, `langgraph-api` 0.18.0, and `langgraph-runtime-inmem` 0.38.0. Five runs of a Qwen3 4B agent through the server all answered right.

- **The runs.** The account stored 35 runs, 7 for each server run. The root of each trace is named `agent`, the graph id, and not `LangGraph`. Its id is the run id of the server.
- **The metadata of the root.** It holds `thread_id`, `assistant_id`, `graph_id`, and `run_attempt`. It also holds `langgraph_api_version` 0.18.0, `langgraph_host` with the value `self-hosted`, and `langgraph_plan` with the value `enterprise`. `LANGSMITH_LANGGRAPH_API_VARIANT` is `local_dev`.
- **The requests.** The process contacted one host, `api.smith.langchain.com`. It sent 2 `GET /info` and 15 `POST /runs/multipart`, and no request to check a license.

```listing
title: the requests of langgraph dev for five traced runs
source: capture/lab/summary/langsmith-account-mac.json
lang: json
---
  "hosts": [
   "https://api.smith.langchain.com"
  ],
  "requests": {
   "GET /info 200": 2,
   "POST /runs/multipart 202": 15
  },
```

`langgraph-api` puts `truststore` into the SSL layer at import, so the server checks certificates with the trust store of the operating system {{code langgraph_api/server.py:11-17}}. In a sandbox that blocks that store, no trace reaches the API. `DISABLE_TRUSTSTORE=true` turns the injection off, and our recorded run used it. [Section 8.2](#s-agent-chat-ui-in-front-of-langgraph-dev) puts a chat UI in front of this server, with tracing off.

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

So the server with Postgres and Redis does not start without an account or a license, even on your own machine.

Later we had a key of a LangSmith account on the free plan. Docker was not running on the Mac, so `langgraph up` stopped with `Error: Docker not installed or not running` and exit code 2. It stopped before any check of the key.

The package `langgraph_license` from PyPI, which `langgraph-api` 0.18.0 installs, returns true from every check {{code langgraph_license/validation.py}}. The check that failed above runs only inside the server image. So we still do not know if a key of a free account passes it. The organization reported `can_use_langgraph_cloud` as false and 0 free deployments. That is a hint from the API, not a test.

The tests of the full server stack come in the next edition, and [section 8.8](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) lists them. They are a worker crash, a Redis or Postgres outage, exactly once in the task queue, and what Redis holds.

## langgraph deploy

This part comes from the docs and the code only. We did not run `langgraph deploy`. The free plan of our account reported no free deployments.

`langgraph deploy` builds the image, pushes it to a registry that LangSmith manages, and creates or updates an Agent Server in one step {{docs langsmith/cli}}. Without Docker, it asks LangSmith to build the image from an upload of your source. The docs mark the command as beta.

- **The key.** The command reads `--api-key`, or `LANGGRAPH_HOST_API_KEY`, `LANGSMITH_API_KEY`, or `LANGCHAIN_API_KEY` {{code libs/cli/langgraph_cli/deploy.py}}.
- **The type.** A new server is `serverless` unless you pass `--agent-server-type dedicated` {{code libs/cli/langgraph_cli/deploy.py:116}}. That default is in the repo tree at langgraph 1.2.22, which is newer than the 0.4.43 wheel. The wheel sets its default in the click option. The repo tree also picks `dev` on a data plane without scale to zero {{code libs/cli/langgraph_cli/deploy.py:1568-1570}}. The wheel has no such rule. It only advises `--agent-server-type dev` in an AWS 400 error. The option also accepts the older names `dev` and `prod`. The docs say that serverless scales to zero and has cold starts {{docs langsmith/cloud-platform-features}}.
- **Your own registry.** Self-hosted LangSmith needs `--push-to` for a registry you manage, or `--image-uri` with a digest {{docs langsmith/cli}}.
- **Other commands.** `langgraph deploy list`, `deploy metrics`, and `deploy listeners` read what you deployed {{code libs/cli/langgraph_cli/deploy.py}}.

Advisory GHSA-8prr-f582-jqq3 says that `langgraph deploy --verbose` printed the push token of the registry in `langgraph-cli` 0.4.15 to 0.4.31. The pin, 0.4.43, is outside that range. Keep `--verbose` out of CI logs anyway, because it prints the Docker build and push output.

Without a license, you can serve the same agent from your own FastAPI app. [Section 9.1](#s-the-run-endpoint-and-its-stream) builds that service, and [section 9.7](#s-workers-the-advisory-lock-and-cost) runs it with several workers and one Postgres lock per thread.

```takeaways
- Start langgraph dev with --n-jobs-per-worker 10, and expect no gain when the model serves one call at a time.
- Pass recursion_limit on every run, because the server default is 10007 under langgraph dev.
- Expect langgraph dev to add 0.6 to 1 s to each run, before the first model call.
- Use enqueue for chat threads, and reject when a second message must wait.
- Write nodes that can lose an unfinished write before you choose interrupt or rollback.
- Set LANGSMITH_API_KEY or LANGGRAPH_CLOUD_LICENSE_KEY before you run langgraph up.
- Search for the graph id, not LangGraph, to find the traces of a server run.
```

Sources: capture/lab/summary/langsmith-account-mac.json, capture/lab/T21-langsmith-account-mac/07-e5-dev-inspect.json, capture/lab/T21-langsmith-account-mac/07-e5-dev-netlog.jsonl, capture/lab/T21-langsmith-account-mac/07-e5-dev-runs.jsonl, capture/lab/T21-langsmith-account-mac/07-e5-up.txt, capture/lab/T21-langsmith-account-mac/07-e5-server-venv-freeze.txt, capture/lab/T21-langsmith-account-mac/01-account-probe.json, capture/lab/T21-langsmith-account-mac/_scripts/t21_e5_client.py, capture/lab/T21-langsmith-account-mac/_scripts/t21_e5_inspect.py; langgraph_api/server.py and langgraph_license/validation.py at langgraph-api 0.18.0; capture/lab/summary/agent-server-x86-real.json, capture/lab/T15-agent-server-x86-real/01-recursion.jsonl, capture/lab/T15-agent-server-x86-real/02-load.jsonl, capture/lab/T15-agent-server-x86-real/03-floor.jsonl, capture/lab/T15-agent-server-x86-real/04-workers.jsonl, capture/lab/T15-agent-server-x86-real/t15r_drive.py, capture/lab/T15-agent-server-x86-real/t15rapp/graphs.py, capture/lab/summary/agent-server-x86.json, capture/lab/T15-agent-server-x86/02-recursion.jsonl, capture/lab/T15-agent-server-x86/03-workers.jsonl, capture/lab/T15-agent-server-x86/04-double-texting.jsonl, capture/lab/T15-agent-server-x86/08-up-start-excerpt.txt, capture/lab/T15-agent-server-x86/09-up-containers.txt, capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt, capture/lab/T15-agent-server-x86/t15_drive.py, capture/lab/T15-agent-server-x86/t15app/graphs.py, capture/lab/T15-agent-server-x86/t15app/langgraph.json; libs/cli/langgraph_cli/cli.py and libs/cli/langgraph_cli/deploy.py at langgraph-cli 0.4.43; langgraph_api/utils/config.py and langgraph_api/cli.py at langgraph-api 0.18.0; langgraph_runtime_inmem/ops.py at langgraph-runtime-inmem 0.38.0; docs.langchain.com at docs commit 04d4d4a (langsmith/cli, langsmith/env-var-cloud, langsmith/agent-server-scale, langsmith/double-texting, langsmith/cloud-platform-features, oss/python/langchain/agents); advisory GHSA-8prr-f582-jqq3.
