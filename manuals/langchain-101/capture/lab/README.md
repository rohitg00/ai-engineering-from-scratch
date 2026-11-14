# Lab recordings

Each folder holds the raw files of one experiment, copied unchanged from the run, except where this file says so. `labsum.py` in the folder above computes one summary for each data set into `summary/`, and `python3 capture/run.py --check` computes them again and compares. No file here was typed by hand.

| Folder | Machine | What it recorded |
|---|---|---|
| `T01-overhead-mac/` | the Mac | a plain `openai` loop against `create_agent` on a local stub (200 runs each) and on Ollama with Qwen3 4B (24 runs each), the request body diff, import times (10 runs each), install sizes |
| `T02-crash-resume-mac/` | the Mac | 450 trials of a SIGKILL at five points, for `sync`, `async`, and `exit` on `SqliteSaver` and `PostgresSaver`, then a resume in a new process |
| `T05-retries-mac/` | the Mac | `ChatOpenAI` and an HTTP tool against a stub that returns 429, 500, 400, or sleeps past the timeout, 3 runs per cell, with the lab script `t05_retries.py` |
| `T06-structured-output-mac/` | the Mac | `ToolStrategy`, `ProviderStrategy`, and `AutoStrategy` on four Qwen3 models on Ollama with four schemas (600 runs), and 20 fake and stub cases for the strategy choice, with the lab scripts |
| `T07-approvals-mac/` | the Mac | `HumanInTheLoopMiddleware` in batched and per-call mode, parallel interrupts in a graph and a subgraph, and strict resume, 27 cases with 3 runs each, every step in a new process on `SqliteSaver` |
| `T13-serde-mac/` | the Mac | what `load()` and `JsonPlusSerializer` accept by default and with `LANGGRAPH_STRICT_MSGPACK=true`, and a round trip of 29 values through `JsonPlusSerializer` and `SqliteSaver`, one run each |
| `T14-stores-mac/` | the Mac | namespace isolation of `InMemoryStore`, `SqliteStore`, and `PostgresStore` for eight user ids, semantic search with `nomic-embed-text`, and the vector rows left after a delete, one run per query |
| `T09-tokens-mac/` | the Mac | prompt tokens of a plain `ollama` loop, `create_agent`, and `create_deep_agent` on Qwen3 8B for three tasks, 3 runs each, and the first request of a default deep agent at `deepagents` 0.6.12 and 0.7.38, counted with two tiktoken tokenizers and with Qwen3 |
| `T12-mcp-mac/` | the Mac | `langchain.mcp` against a FastMCP server over stdio and Streamable HTTP: string targets, tool errors, a timeout, a server crash, and 50 timed calls per transport; the same server under `langchain-mcp-adapters` 0.3.2 in a separate environment |
| `TRC-tracing-mac/` | the Mac | tracing against a local recorder: 177 agent runs per condition with tracing off and on, one process of 50 runs for each endpoint state, and what `tracing_context(enabled="local")` sends |
| `T17-claims-mac/` | the Mac | the default recursion limits of `StateGraph` and `create_agent`, and replay and `update_state` forks of a graph and an agent, one run each |
| `T03-checkpoint-cost-x86/` | the x86 server guest | checkpoint write time and thread storage for three savers and two channel types, up to 5,000 steps |
| `T15-agent-server-x86/` | the x86 server guest | `langgraph dev`: the recursion limit, jobs per worker, and the license error of `langgraph up` |
| `T10-long-threads-x86/` | the x86 server guest | `create_agent` on `PostgresSaver` for 2,000 turns, without summarization and with three triggers, one run each, with a fake model with no delay |
| `T16-concurrency-x86/` | the x86 server guest | 1 to 500 threads on one `AsyncPostgresSaver` with one connection and pools of 20 and 90, two runs each, and 8 and 16 client processes |

The Mac is an Apple M1 Max with 10 cores and 64 GiB, macOS 26.2, Python 3.13.12, Ollama 0.31.1, and PostgreSQL 14.21. Other work ran on it during every timed run. The x86 server guest has 32 vCPU and 48 GiB, Ubuntu 24.04, Python 3.13.18, PostgreSQL 16.15, and Redis 7.0.15. All of its models are fakes with a fixed delay.

## Changes from the raw runs

- `T15-agent-server-x86/10-up-license-excerpt.txt` is lines 54 to 57 of the container log of `langgraph up`, unchanged. The rest of the log is not kept.
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
- No file holds a key, a token, a host name other than `127.0.0.1`, or a personal name.
