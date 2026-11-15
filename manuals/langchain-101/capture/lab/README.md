# Lab recordings

Each folder holds the raw files of one experiment, copied unchanged from the run, except where this file says so. One file sits beside the folders, the machine record of the x86 server guest. `labsum.py` in the folder above computes one summary for each data set into `summary/`, and `python3 capture/run.py --check` computes them again and compares. No file here was typed by hand.

| Folder | Machine | What it recorded |
|---|---|---|
| `T01-overhead-mac/` | the Mac | a plain `openai` loop against `create_agent` on a local stub (200 runs each) and on Ollama with Qwen3 4B (24 runs each), the bytes and tokens of each Ollama request, the request body diff, import times (10 runs each), install sizes |
| `T02-crash-resume-mac/` | the Mac | 450 trials of a SIGKILL at five points, for `sync`, `async`, and `exit` on `SqliteSaver` and `PostgresSaver`, then a resume in a new process. In 30 trials, `exit` mode never reached the `before_put_writes` kill point |
| `T05-retries-mac/` | the Mac | `ChatOpenAI` and an HTTP tool against a stub that returns 429, 500, 400, or sleeps past the timeout, 3 runs per cell, with the lab script `t05_retries.py` |
| `T06-structured-output-mac/` | the Mac | `ToolStrategy`, `ProviderStrategy`, and `AutoStrategy` on four Qwen3 models on Ollama with four schemas (600 runs), and 20 fake and stub cases for the strategy choice, with the lab scripts |
| `T07-approvals-mac/` | the Mac | `HumanInTheLoopMiddleware` in batched and per-call mode, parallel interrupts in a graph and a subgraph, and strict resume, 27 cases with 3 runs each, every step in a new process on `SqliteSaver` |
| `T13-serde-mac/` | the Mac | what `load()` and `JsonPlusSerializer` accept by default and with `LANGGRAPH_STRICT_MSGPACK=true`, and a round trip of 29 values through `JsonPlusSerializer` and `SqliteSaver`, one run each |
| `T14-stores-mac/` | the Mac | namespace isolation of `InMemoryStore`, `SqliteStore`, and `PostgresStore` for eight user ids, semantic search with `nomic-embed-text`, and the vector rows left after a delete, one run per query |
| `T09-tokens-mac/` | the Mac | prompt tokens of a plain `ollama` loop, `create_agent`, and `create_deep_agent` on Qwen3 8B for three tasks, 3 runs each, and the first request of a default deep agent at `deepagents` 0.6.12 and 0.7.38, counted with two tiktoken tokenizers and with Qwen3 |
| `T11-middleware-cost-mac/` | the Mac | `create_agent` with 0 to 20 no-op middlewares of five hook types, and nine setups of built-in middleware: seven single middlewares, five `PIIMiddleware` instances, and a stack of five, 300 timed runs per cell, with the lab script `t11_run.py` |
| `T04-streaming-mac/` | the Mac | nine stream APIs against a stamping SSE stub (50 runs each for text and for a tool call, 20 for a sub-agent) and against Qwen3 4B on Ollama (20 each), the langchain#38484 isolation runs (5 per pattern), and a reasoning model with two loop orders (3 each), with the lab scripts |
| `T08-parallel-tools-mac/` | the Mac | 1 to 16 parallel calls of a 200 ms tool under `create_agent` and `ToolNode`, `invoke` and `ainvoke`, five `max_concurrency` values, 5 runs per cell; tool calls with no id, duplicate tool names, and parallel calls on Ollama, with the lab scripts |
| `T12-mcp-mac/` | the Mac | `langchain.mcp` against a FastMCP server over stdio and Streamable HTTP: string targets, tool errors, a timeout, a server crash, and 50 timed calls per transport; the same server under `langchain-mcp-adapters` 0.3.2 in a separate environment |
| `TRC-tracing-mac/` | the Mac | tracing against a local recorder: 177 agent runs per condition with tracing off and on, one process of 50 runs for each endpoint state, and what `tracing_context(enabled="local")` sends |
| `T17-claims-mac/` | the Mac | the default recursion limits of `StateGraph` and `create_agent`, and replay and `update_state` forks of a graph and an agent, one run each |
| `T18-evaluate-leak-mac/` | the Mac | `evaluate(upload_results=False)` with the default client on an agent target and on the same target inside `tracing_context(enabled=False)`, with a local endpoint and with no environment, and on a plain function with a local endpoint only, five conditions of 5 processes each, with the lab scripts |
| `T19-pytest-plugin-mac/` | the Mac | the pytest plugin of `langsmith` with pytest 8.4.2, tracking off and on, with a local endpoint and with no environment, `--langsmith-output`, and tracking off with tracing on, 3 processes per condition, with the lab scripts and tests |
| `T20-mcp-edges-mac/` | the Mac | `langchain.mcp` against a FastMCP server: elicitation with an interrupt, with a checkpointer and without, with your own handler, on both protocol versions; an error result with structured content; progress; 27 cases, 3 runs each, with the lab scripts |
| `T03-checkpoint-cost-x86/` | the x86 server guest | checkpoint write time and thread storage for three savers and two channel types, up to 5,000 steps |
| `T15-agent-server-x86/` | the x86 server guest | `langgraph dev`: the recursion limit, jobs per worker, a load of 1 to 100 concurrent runs, the time floor of one run, the four double texting strategies, and the start and the license error of `langgraph up`, with the lab scripts |
| `T10-long-threads-x86/` | the x86 server guest | `create_agent` on `PostgresSaver` for 2,000 turns, without summarization and with three triggers, one run each, with a fake model with no delay |
| `T16-concurrency-x86/` | the x86 server guest | 1 to 500 threads on one `AsyncPostgresSaver` with one connection and pools of 20 and 90, two runs each, and 8 and 16 client processes |
| `T05-retries-x86/` | the x86 server guest | `ChatOpenAI` on the `/v1` path of Ollama and `ChatOllama` on its native path, with Qwen3 4B, through a relay that drops, holds, or answers 429 or 500, and against a refused port and a real 404; a tool against a refused port and PostgreSQL with a ledger table; client, middleware, and `RetryPolicy` layers; 3 runs per cell, with `t05_real.py` and `lr_common.py` |
| `T07-approvals-x86/` | the x86 server guest | `HumanInTheLoopMiddleware` with Qwen3 4B, 25 model cases with 3 runs each, every step in a new process on `SqliteSaver`, and a survey of 10 prompts per intent on Qwen3 4B and Qwen3 8B, with the lab scripts |
| `T08-parallel-tools-x86/` | the x86 server guest | how many parallel calls Qwen3 4B and Qwen3 8B make when asked for 1 to 16, the raw ids of Ollama, duplicate tool names (3 runs per case), `ToolNode` fed the real reply (5 runs per cell), and `create_agent` with the model in every run (3 runs per cell), with a 200 ms `pg_sleep` tool, with `t08_real.py` |
| `T11-middleware-cost-x86/` | the x86 server guest | `create_agent` with Qwen3 4B and 0 to 20 no-op middlewares of five hook types and nine built-in setups, 20 timed runs per cell, and 12 cases of built-in middleware set to act, 3 runs each, with `t11_real.py` |
| `T17-claims-x86/` | the x86 server guest | the agent rows of T17 with Qwen3 4B: `recursion_limit` 25 and 101, 3 runs each, one run with no limit stopped by the script at 1200 s, and the agent replay, 3 runs, with the lab scripts |
| `T18-evaluate-leak-x86/` | the x86 server guest | the conditions of T18 with a Qwen3 4B agent target, 5 processes per condition, with `t18_real.py` and `t18_summarize.py` |
| `T19-pytest-plugin-x86/` | the x86 server guest | the conditions of T19 with a Qwen3 4B agent test, 3 processes per condition, with `t19_driver_real.py` and the tests |
| `failure-drill-x86/` | the x86 server guest | the Part 8 failure drill with Qwen3 4B, seven cases, 3 runs, with `drill_real.py` and `lr_common.py` |
| `sql-agent/` | the Mac | the Part 8 SQL agent demo on a small bakery database that the script builds, 15 fixed guard cases and five questions, one run with Qwen3 4B and one with Qwen3 8B |
| `retrieval-agent/` | the Mac | the Part 8 retrieval demo over six lesson files with `nomic-embed-text`, five questions, one run with each model, and the SHA-256 of the corpus |
| `assistant/` | the Mac | the Part 8 assistant, seven steps in seven processes with a SIGKILL after an approved email, one run with default durability and one with `sync` |
| `deep-agent/` | the Mac | the Part 8 deep agent with an editor subagent on Qwen3 8B, one run, with the tokens of each model call |
| `failure-drill/` | the Mac | the Part 8 failure drill, seven cases with a scripted fake model and a local stub, one run. Superseded by `failure-drill-x86/` |

The Mac is an Apple M1 Max with 10 cores and 64 GiB, macOS 26.2, Python 3.13.12, Ollama 0.31.1, and PostgreSQL 14.21. Other work ran on it during every timed run. The x86 server guest is a KVM guest with 32 vCPU and 48 GiB on a shared server with an AMD EPYC 7452. Its disk was in the memory of the server. It ran Ubuntu 24.04, Python 3.13.18, PostgreSQL 16.15, Redis 7.0.15, and Docker 29.1.3. `x86-guest-machine.txt` records these. In T03, T10, T15, and T16 its models are fakes with a fixed delay. The folders that end in `-x86` from T05 to T19, and `failure-drill-x86/`, use Qwen3 4B (`qwen3:4b-instruct-2507-q4_K_M`) on Ollama 0.31.1 on CPU, with temperature 0, seed 42, and a context of 8192. The counts of T07 and T08 also use Qwen3 8B with reasoning off.

## Superseded rows

The folders that end in `-x86` ran again, with a real model, the experiments that used a fake model or a stub provider on the Mac. The old folders stay, and the manual uses only their rows that involve no model.

| Old folder | Superseded by | Rows that stay valid |
|---|---|---|
| `T05-retries-mac/` | `T05-retries-x86/` | none. Every row ran against a stub |
| `T07-approvals-mac/` | `T07-approvals-x86/` | G1 and G2, the plain graphs with no model |
| `T08-parallel-tools-mac/` | `T08-parallel-tools-x86/` | the tool calls with no id in `02-idless-and-dupnames.jsonl`, because no real model at the pin sends them |
| `T11-middleware-cost-mac/` | `T11-middleware-cost-x86/` | the graph node counts |
| `T17-claims-mac/` | `T17-claims-x86/` | the `StateGraph` rows, the bound config of `create_agent`, and the graph replay and fork |
| `T18-evaluate-leak-mac/` | `T18-evaluate-leak-x86/` | `04-info-origin.txt` |
| `T19-pytest-plugin-mac/` | `T19-pytest-plugin-x86/` | none that the manual uses |
| `failure-drill/` | `failure-drill-x86/` | none |

## Rows not to use in the x86 folders

- `T07-approvals-x86/01-cases.jsonl`: the G3 rows. Their shape check never matched, because the parent state holds no subgraph messages while it waits. `02-g3-rerun.jsonl` holds G3, and the summary takes it from there. No time of T07 is used.
- `T08-parallel-tools-x86/04-toolnode.jsonl`: the rows with `"warmup": true`, which the summary leaves out. The reply of Qwen3 4B for 1 call held 2 identical calls, so those `ToolNode` rows are 2-call rows.
- `T18-evaluate-leak-x86/02-evaluate-noflush.jsonl`: the POST counts of `noenv:agent`, because those posts happen at exit. The summary uses 02 only for `GET /info`.
- `T19-pytest-plugin-x86/`: with tracking on, the error types come from the `{}` answers of the recorder and the guard, as on the Mac. The run names come from a rough match on the body.
- `T05-retries-x86/`: the 429 and 500 rows are statuses that the relay sent in place of the model, not errors of a provider. The manual names them so.
- `T11-middleware-cost-x86/`: the absolute microseconds depend on the load of 14 to 25. The manual uses the share of the run and the ratio of node hooks to wrap hooks.
- `T17-claims-x86/02-nolimit.jsonl`: one run, which shared Ollama for a few minutes with the G3 rerun of T07, so its pace is approximate.

## Changes from the raw runs

- `T15-agent-server-x86/10-up-license-excerpt.txt` is lines 54 to 57 of the container log of `langgraph up`, unchanged. The rest of the log is not kept.
- `T15-agent-server-x86/08-up-start-excerpt.txt` is lines 2 to 4 of the console output of `langgraph up`, unchanged. The image build log is not kept.
- `T15-agent-server-x86/t15_drive.py` and `t15app/graphs.py` are the scripts of that run with one default changed: the event log path lost its home folder. The process lists and the server logs of the `langgraph dev` runs are not kept, because they hold home paths and are 2.4 MB each.
- The first 5 values of `walls_us` and `cpus_us` in each row of `T11-middleware-cost-mac/` are warm-up runs, marked by `"warm": 5`, and the summary leaves them out. The smoke files of T11 are not kept.
- `T01-overhead-mac/03-ollama-proxy-usage.jsonl` keeps the index, time, request and response sizes, upstream time, and usage of each request that the recording proxy saw. The headers and the bodies are not kept.
- Rows marked `"warmup": true` in `T01-overhead-mac/` are kept, and the summary leaves them out.
- The timeout rows of `T05-retries-mac/01` and `02` undercount the attempts, because the stub logged after its sleep. The summary takes the timeout cells from `04-timeouts-arrival-count.jsonl`.
- `T06-structured-output-mac/01-ollama-runs.jsonl` holds the qwen3:0.6b rows and some qwen3:1.7b rows. The 1.7b rows ran beside other processes while Ollama returned `500 Compute error`, so the summary leaves them out and takes those cells from `03-ollama-seq-n10.jsonl`, which ran them one at a time. The runs from the parallel 4b and 8b batches are not kept.
- The names and addresses in the T06 inputs are made up by the lab script `t06_schemas.py`, on `example.org` and `shop.test`.
- `T07-approvals-mac/` keeps `01-cases.jsonl` and its log. The smoke run `00-smoke.jsonl` and the per-case sink files are not kept. The interrupt ids in the rows are random hex values, and the summary masks them in error text.
- `T02-crash-resume-mac/t02_child.py` and `T13-serde-mac/t13_roundtrip.py` are the scripts of those runs, unchanged. `T03-checkpoint-cost-x86/t03_ckpt.py` is the script of that run with two defaults changed: the Postgres URL lost its user and password, and the work folder lost its home path.
- `T13-serde-mac/04-round-trip-log.txt` is the standard error of the round trip run, unchanged. The payload class and the SQLite files of T13 and T14 are not kept.
- In `T16-concurrency-x86/02-multiprocess.jsonl`, the connection counts of the two 16-process rows are not used, because Postgres refused the monitor connection there.
- `T12-mcp-mac/01-langchain-mcp.jsonl` had the home directory of the recording machine in two error messages. It is replaced with `<scripts>`. The launch marker files of T12 are not kept, because their content is that path. `03-adapters-launch-count.txt` holds their count.
- `TRC-tracing-mac/` keeps the recorder logs of the latency blocks and of three failure runs. The recorder logs of the hanging and the 500 endpoints (136 KB and 193 KB) are not kept. `01-failure-summary.jsonl` holds their counts. The `00-smoke` files of the run are not kept, as the run marked them.
- `T04-streaming-mac/*-per-run.jsonl` are the per-run rows that `t04_analyze.py` wrote from the raw recordings, unchanged. The raw token and server stamp files (16 MB) are not kept. The analysis already dropped 11 stray rows of an aborted first run from the text phase. Rows marked `"warmup": true` are kept, and the summary leaves them out.
- In the `subagent` phase of T04, `call_weather` in `t04_run.py` sends the inner agent a prompt without the run tag. So the stub logged each inner request with tag `None`, and `t04_analyze.py` dropped it. In `subagent-per-run.jsonl`, `n_requests` counts only the two supervisor requests, and no row has a `sub_*` field. The summary and the manual use no number from the inner requests.
- `T04-streaming-mac/text-runs-excerpt.jsonl` and `text-server-excerpt.jsonl` are two exact lines each from the raw text phase: run 1 of block 2 of `astream_events_v3` and of `astream_events_v3_gather`, with their server stamps. The timeline figure reads them.
- `T04-streaming-mac/common.py` is the helper module of the lab scripts, unchanged except for its paths. The smoke runs and the discarded first run of T04 are not kept.
- `T08-parallel-tools-mac/` keeps its three recordings and four scripts, unchanged except for the paths of `t08_analyze.py`. Rows with `"warmup": true` in `01` are kept, and the summary leaves them out. The stub server log `02-noid-server.jsonl` is not kept.
- The Part 8 folders hold the console log and the JSON rows of each demo run, as `run.sh` in `capture/demos/` wrote them. The scripts replaced the temporary work folder with `<work>` and the repository path with nothing. The process ids in `assistant/` are the real ones. The databases and work folders of the demos are not kept.
- After the Part 8 runs, `assistant.py` got paged reads of the store. The two saved facts give the same results with both versions.
- `T18-evaluate-leak-mac/`, `T19-pytest-plugin-mac/`, and `T20-mcp-edges-mac/` hold the raw files and the scripts of those runs, with one change: the home folder of the recording machine is replaced in paths. `<site-packages>` is the site folder of the lab environment, `<scratch-site-packages>` is the site folder of the pytest environment of T19, and `<scripts>` is the folder of the lab scripts. In the run, the scripts wrote to a sibling folder named `T18`, `T19`, or `T20`. Now they write to their own folder. The smoke files `00-smoke-n1*` of all three and the prose summaries of the run are not kept. The empty server stderr file of T20 is not kept.
- In `T18-evaluate-leak-mac/02-evaluate-noflush.jsonl`, the `noenv:agent` rows show no `POST`, because that post happens at exit, after the child wrote its row. The summary uses 02 only for `GET /info`. `03-counts.txt` is the output of `t18_summarize.py`.
- In `T19-pytest-plugin-mac/`, the recorder and the guard answered `{}`, so the errors after each request with tracking on are effects of that answer. The summary uses those runs for the request order only. The run names in `03-off-tracing-on-runs.jsonl` come from a rough match on the body, and the summary keeps only whether the `LangGraph` run was posted. The dummy key is `dummy-not-a-key`. The scratch environment of T19 is not kept. `00-scratch-venv-own-packages.txt` lists its packages, and the two freeze files show the lab environment unchanged.
- `T20-mcp-edges-mac/02-summary-table.txt` is the output of `t20_summarize.py`. `server_calls` is counted only in process. A single probe of `ctx.elicit` on a modern connection is not kept and not used.
- `x86-guest-machine.txt` is the machine record of the x86 server guest. Its `guest:` line is the note that the recording run wrote, with the name of the host server removed. The other lines are command output, unchanged.
- The `files` task of `T09-tokens-mac/t09_run.py` passes when the answer text holds `hello world`. The check does not look at the file or the tool calls. The rows show that all 9 runs of the task called `write_file` and then `read_file`, and wrote `/notes.txt`.
- The lab scripts used the paths of the research folders. Now they find their helpers and write their output relative to their own folder. They start child processes with the Python that runs them. A run in place writes over the recorded files.
- `t05_retries.py` and `t08_analyze.py` import `common.py` from `T04-streaming-mac/`. `t05_retries.py` still cannot run, because its stub server `stub_server.py` is not kept. `t19_driver.py` needs its scratch environment in `_venv/`, which is not kept. No measurement logic changed.
- No file holds a key, a token, or a personal name. The only host names are `127.0.0.1` and the public hosts that recorded requests and error texts name, such as `api.smith.langchain.com`. No request reached such a host.
- The `-x86` folders hold the raw files, the logs, and the lab scripts of those runs, unchanged except in two places. In `T05-retries-x86/10-summary.txt` and `T19-pytest-plugin-x86/10-summary.txt`, the home folder is replaced with `<lab>` in one path each. `09-summary-table.txt` and `10-summary.txt` in each folder are the notes that the run wrote, not summaries that the manual reads.
- `capture/demos/failure-drill/drill.py` is `failure-drill-x86/drill_real.py` with its import of `lr_common` changed to `real`, a cut of `lr_common.py`.
