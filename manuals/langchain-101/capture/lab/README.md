# Lab recordings

Each folder holds the raw files of one experiment, copied unchanged from the run, except where this file says so. `labsum.py` in the folder above computes one summary for each data set into `summary/`, and `python3 capture/run.py --check` computes them again and compares. No file here was typed by hand.

| Folder | Machine | What it recorded |
|---|---|---|
| `T01-overhead-mac/` | the Mac | a plain `openai` loop against `create_agent` on a local stub (200 runs each) and on Ollama with Qwen3 4B (24 runs each), the bytes and tokens of each Ollama request, the request body diff, import times (10 runs each), install sizes |
| `T02-crash-resume-mac/` | the Mac | 450 trials of a SIGKILL at five points, for `sync`, `async`, and `exit` on `SqliteSaver` and `PostgresSaver`, then a resume in a new process |
| `T05-retries-mac/` | the Mac | `ChatOpenAI` and an HTTP tool against a stub that returns 429, 500, 400, or sleeps past the timeout, 3 runs per cell, with the lab script `t05_retries.py` |
| `T06-structured-output-mac/` | the Mac | `ToolStrategy`, `ProviderStrategy`, and `AutoStrategy` on four Qwen3 models on Ollama with four schemas (600 runs), and 20 fake and stub cases for the strategy choice, with the lab scripts |
| `T07-approvals-mac/` | the Mac | `HumanInTheLoopMiddleware` in batched and per-call mode, parallel interrupts in a graph and a subgraph, and strict resume, 27 cases with 3 runs each, every step in a new process on `SqliteSaver` |
| `T13-serde-mac/` | the Mac | what `load()` and `JsonPlusSerializer` accept by default and with `LANGGRAPH_STRICT_MSGPACK=true`, and a round trip of 29 values through `JsonPlusSerializer` and `SqliteSaver`, one run each |
| `T14-stores-mac/` | the Mac | namespace isolation of `InMemoryStore`, `SqliteStore`, and `PostgresStore` for eight user ids, semantic search with `nomic-embed-text`, and the vector rows left after a delete, one run per query |
| `T09-tokens-mac/` | the Mac | prompt tokens of a plain `ollama` loop, `create_agent`, and `create_deep_agent` on Qwen3 8B for three tasks, 3 runs each, and the first request of a default deep agent at `deepagents` 0.6.12 and 0.7.38, counted with two tiktoken tokenizers and with Qwen3 |
| `T11-middleware-cost-mac/` | the Mac | `create_agent` with 0 to 20 no-op middlewares of five hook types, and nine built-in middlewares one at a time, 300 timed runs per cell, with the lab script `t11_run.py` |
| `T04-streaming-mac/` | the Mac | nine stream APIs against a stamping SSE stub (50 runs each for text and for a tool call, 20 for a sub-agent) and against Qwen3 4B on Ollama (20 each), the langchain#38484 isolation runs (5 per pattern), and a reasoning model with two loop orders (3 each), with the lab scripts |
| `T08-parallel-tools-mac/` | the Mac | 1 to 16 parallel calls of a 200 ms tool under `create_agent` and `ToolNode`, `invoke` and `ainvoke`, five `max_concurrency` values, 5 runs per cell; tool calls with no id, duplicate tool names, and parallel calls on Ollama, with the lab scripts |
| `T12-mcp-mac/` | the Mac | `langchain.mcp` against a FastMCP server over stdio and Streamable HTTP: string targets, tool errors, a timeout, a server crash, and 50 timed calls per transport; the same server under `langchain-mcp-adapters` 0.3.2 in a separate environment |
| `TRC-tracing-mac/` | the Mac | tracing against a local recorder: 177 agent runs per condition with tracing off and on, one process of 50 runs for each endpoint state, and what `tracing_context(enabled="local")` sends |
| `T17-claims-mac/` | the Mac | the default recursion limits of `StateGraph` and `create_agent`, and replay and `update_state` forks of a graph and an agent, one run each |
| `T03-checkpoint-cost-x86/` | the x86 server guest | checkpoint write time and thread storage for three savers and two channel types, up to 5,000 steps |
| `T15-agent-server-x86/` | the x86 server guest | `langgraph dev`: the recursion limit, jobs per worker, a load of 1 to 100 concurrent runs, the time floor of one run, the four double texting strategies, and the start and the license error of `langgraph up`, with the lab scripts |
| `T10-long-threads-x86/` | the x86 server guest | `create_agent` on `PostgresSaver` for 2,000 turns, without summarization and with three triggers, one run each, with a fake model with no delay |
| `T16-concurrency-x86/` | the x86 server guest | 1 to 500 threads on one `AsyncPostgresSaver` with one connection and pools of 20 and 90, two runs each, and 8 and 16 client processes |
| `sql-agent/` | the Mac | the Part 8 SQL agent demo on the Chinook database, five questions, one run with Qwen3 4B and one with Qwen3 8B |
| `retrieval-agent/` | the Mac | the Part 8 retrieval demo over six lesson files with `nomic-embed-text`, five questions, one run with each model, and the SHA-256 of the corpus |
| `assistant/` | the Mac | the Part 8 assistant, seven steps in seven processes with a SIGKILL after an approved email, one run with default durability and one with `sync` |
| `deep-agent/` | the Mac | the Part 8 deep agent with an editor subagent on Qwen3 8B, one run, with the tokens of each model call |
| `failure-drill/` | the Mac | the Part 8 failure drill, seven cases with a scripted fake model and a local stub, one run |

The Mac is an Apple M1 Max with 10 cores and 64 GiB, macOS 26.2, Python 3.13.12, Ollama 0.31.1, and PostgreSQL 14.21. Other work ran on it during every timed run. The x86 server guest has 32 vCPU and 48 GiB, Ubuntu 24.04, Python 3.13.18, PostgreSQL 16.15, and Redis 7.0.15. All of its models are fakes with a fixed delay.

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
- `T04-streaming-mac/text-runs-excerpt.jsonl` and `text-server-excerpt.jsonl` are two exact lines each from the raw text phase: run 1 of block 2 of `astream_events_v3` and of `astream_events_v3_gather`, with their server stamps. The timeline figure reads them.
- `T04-streaming-mac/common.py` is the helper module of the lab scripts, unchanged. The smoke runs and the discarded first run of T04 are not kept.
- `T08-parallel-tools-mac/` keeps its three recordings and four scripts unchanged. Rows with `"warmup": true` in `01` are kept, and the summary leaves them out. The stub server log `02-noid-server.jsonl` is not kept.
- The Part 8 folders hold the console log and the JSON rows of each demo run, as `run.sh` in `capture/demos/` wrote them. The scripts replaced the temporary work folder with `<work>` and the repository path with nothing. The process ids in `assistant/` are the real ones. The databases and work folders of the demos are not kept.
- No file holds a key, a token, a host name other than `127.0.0.1`, or a personal name.
