# How this manual was made

> This page records the pin, the two machines, the lab method, each experiment with its machine and its count, and what the lab folder holds.

## The pin

The manual pins `langchain` 1.5.0, released on 2026-11-11 at commit `c2f4036e`. The same pin holds `langchain-core` 1.8.0, `langgraph` 1.2.22, `deepagents` 0.7.38, and `langsmith` 0.14.17. [Sources and conflicts](#s-ref-sources-and-conflicts) gives the commit of each package. We read the code and the docs and checked every fact on 2026-11-14.

The packages of the stack move fast, and their version numbers are not aligned. A statement in this manual is about the pin only. [Section 7.4](#s-migration-from-0-x-and-stale-advice) lists what differs in older code and older pages.

## Four kinds of evidence

Each fact carries one of four labels, and [the sources page](#s-ref-sources-and-conflicts) ranks them.

**The code:** a class, a default, or an error text read in the source at the tag. A paragraph says when we also ran it.

**A capture:** a listing from the capture kit, which drives the real stack with a scripted fake model. The model part is our script, and everything else is the stack.

**We measured:** a number from one of our lab runs. The paragraph names the machine and the number of runs.

**The documentation:** a statement from the docs at commit `04d4d4a`. We use it for paths that this edition did not run, and the text says so.

## The two machines

| Name in the manual | Machine | Software |
|---|---|---|
| the Mac | an Apple M1 Max laptop with 10 cores and 64 GiB, shared with other work | macOS 26.2, Python 3.13.12, Ollama 0.31.1, PostgreSQL 14.21 |
| the x86 server guest | a KVM guest with 32 vCPU and 48 GiB on a shared server with an AMD EPYC 7452. Its disk was in the memory of the server | Ubuntu 24.04, Python 3.13.18, PostgreSQL 16.15, Redis 7.0.15, Docker 29.1.3 |

The two machines differ, so no section sets a number from one beside a number from the other. Every time from the Mac is an upper bound for that machine, because other work ran on it during every timed run. The disk of the guest was in memory, so its write times are lower bounds for a real disk.

## The lab method

- **Real models on the Mac only.** The real models were Qwen3 models of 0.6B to 8B parameters on Ollama, and `nomic-embed-text` for embeddings. No hosted model ran, so no time in this manual is the time of a hosted model.
- **Fakes on the guest.** Every model on the x86 server guest was a fake with a fixed delay, or no delay. Those times hold the cost of the stack and the database only.
- **Local stubs.** A stub server on `127.0.0.1` stood in for a provider, a flaky service, a stream, or a LangSmith endpoint. The streaming stub stamped each send, so the lab could time each token on one clock.
- **A new process for each step.** The crash, approval, and assistant runs started each step in a new Python process, so each resume was a restart.
- **Warm-up runs left out.** A file marks its warm-up rows, and the summary leaves them out. The raw files keep them.
- **No account and no license.** We used no LangSmith account and no Agent Server license. [Section 7.6](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) lists what that left out.
- **Small samples.** Many cases ran once or three times. Each paragraph gives its count, and a result from one run is an example, not a rate.

## The experiments

| Folder | Machine | Question | n | Main result | Sections |
|---|---|---|---|---|---|
| T01 | the Mac | What does `create_agent` cost against a plain `openai` loop? | 200 runs each on a stub, 24 each on Qwen3 4B, 10 per import | 7.67 ms at the median against 4.1 ms, and the same tool schemas in each request | [2.1](#s-install-and-the-package-map), [3.1](#s-create-agent-and-the-graph-it-builds), [7.2](#s-cost-the-framework-against-a-plain-sdk-loop) |
| T02 | the Mac | Does a side effect run twice after a crash and a resume? | 450 trials at five kill points, 30 of them never killed | twice in 80 of 150 graph trials and 82 of 150 agent trials, and in 0 of 150 with a key | [4.3](#s-durability-modes-and-a-crash-between-two-steps) |
| T03 | the x86 server guest | What does a checkpoint cost as a thread grows? | 3 runs at 10 to 1,000 steps, 1 at 5,000 | a plain Postgres thread held 292.58 MB at 1,000 steps | [4.5](#s-context-engineering-and-summarization) |
| T04 | the Mac | How fast does each stream API deliver a token? | on a stub, 50 runs per API for a text reply and for a tool call, and 20 for the final text of a supervisor with a sub-agent. 20 per API on Qwen3 4B | a median first-token delay of 0.68 to 1.16 ms for a text reply on the stub, on eight of nine APIs | [4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| T05 | the Mac | How many attempts do the retry layers make? | 3 runs per cell | 9 attempts with both layers, and a timed-out tool ran up to 3 times | [2.2](#s-init-chat-model-and-model-profiles), [3.5](#s-retries-backup-models-rate-limits-and-caching) |
| T06 | the Mac | How often does each structured output strategy fail? | 600 runs on four Qwen3 models, and 20 strategy cases | `ToolStrategy` failed in 15% to 45% of runs per model, and on three models every `ProviderStrategy` failure was the union schema | [3.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) |
| T07 | the Mac | Which tool runs after each review decision? | 27 cases, 3 runs each | batched mode can switch tools and skip a review, and per-call mode refused both | [5.4](#s-interrupt-and-resume), [5.5](#s-human-in-the-loop-batched-and-per-call) |
| T08 | the Mac | Do parallel tool calls run at the same time? | 200 cells, 5 runs each | 16 calls of 200 ms took about 215 to 430 ms with no cap, and `ToolNode` under `ainvoke` ignored `max_concurrency` | [2.4](#s-tools-toolruntime-and-tool-errors), [3.1](#s-create-agent-and-the-graph-it-builds) |
| T09 | the Mac | How many prompt tokens does each harness send? | 27 runs on Qwen3 8B, and 9 request variants counted 3 times each | the prompt and tool schemas of a default deep agent were 57.6% smaller at 0.7.38 than at 0.6.12, by one tokenizer | [6.3](#s-deep-agents-0-7) |
| T10 | the x86 server guest | What does a thread of 2,000 turns do with and without a summary? | 1 run per variant, four variants | the turn time grew without a summary and stayed flat with one | [4.5](#s-context-engineering-and-summarization) |
| T11 | the Mac | What does each middleware hook cost? | 300 timed runs per cell | about 94 µs per node hook call and 20 µs per wrap hook call | [7.2](#s-cost-the-framework-against-a-plain-sdk-loop) |
| T12 | the Mac | What does each MCP failure do to a run? | 1 run per case, 50 timed calls per transport | a tool error became an error `ToolMessage`, and a server crash ended the run | [6.2](#s-mcp-with-langchain-mcp) |
| T13 | the Mac | What does the serializer rebuild, and what does a loader accept? | 29 values, and 36 loader cases, 26 with the defaults and 10 strict, 1 run each | 20 values round-tripped, and 5 cases built the lab class | [4.6](#s-serialization-of-state-and-what-does-not-round-trip), [7.3](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) |
| T14 | the Mac | Do namespaces keep the users of a store apart? | 8 users on three stores, 1 run per query | 24 of 24 searches stayed inside one user | [4.4](#s-stores-and-long-term-memory), [7.3](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) |
| T15 | the x86 server guest | What do `langgraph dev` and `langgraph up` do? | 1 run per setting, 2,550 runs of load | 1 job per worker by default, and a stop at 10007 steps | [7.1](#s-agent-server-langgraph-dev-up-and-deploy) |
| T16 | the x86 server guest | How many threads can one `AsyncPostgresSaver` serve? | 2 runs per cell, 1 to 500 threads | one connection gave 207 and 214 steps per second at 500 threads | [4.2](#s-checkpointers-and-threads) |
| T17 | the Mac | Do the recursion limits and the replays work as the docs say? | 1 run per case | a graph stopped at 10007 steps and an agent at 9999 | [1.2](#s-one-create-agent-run), [5.6](#s-time-travel-replay-update-state-and-forks), [5.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) |
| TRC | the Mac | What does tracing cost, and what happens when the endpoint fails? | 177 runs per condition, 50 runs per endpoint state | 7.56 ms at the median with tracing on, against 2.59 ms off | [6.4](#s-langsmith-tracing) |
| T18 | the Mac | What does `evaluate(upload_results=False)` send with the default client? | 5 processes per condition, five conditions | one `GET /info` in every process, and the 7 runs of an agent target in one multipart post | [6.5](#s-evaluation-with-langsmith) |
| T19 | the Mac | What does the pytest plugin of `langsmith` send? | 3 processes per condition, nine conditions | with tracking on and no environment, each run contacted the default host. With tracking and tracing off, nothing left. With tracking off and tracing on, every process sent `GET /info` and `POST /runs/multipart` | [6.5](#s-evaluation-with-langsmith) |
| T20 | the Mac | What do elicitation, an error with structured content, and progress do through `langchain.mcp`? | 3 runs per case, 27 cases | one answered question ran the tool 3 times, and an error result lost its structured content | [6.2](#s-mcp-with-langchain-mcp) |
| `sql-agent` | the Mac | Does a SQL agent answer and write only with approval? | 15 guard cases and 5 questions, 1 run on Qwen3 4B and 1 on Qwen3 8B | both models answered 5 of 5 right, and each refused delete changed no row | [8.1](#s-a-sql-agent-over-a-local-sqlite-database) |
| `retrieval-agent` | the Mac | Does a retrieval agent cite its sources? | 5 questions, 1 run per model | [Section 8.2](#s-a-retrieval-agent-over-a-local-corpus) gives each answer | [8.2](#s-a-retrieval-agent-over-a-local-corpus) |
| `assistant` | the Mac | Does an assistant survive a crash after an approved email? | 2 runs of seven steps, one per durability mode | the reviewer approved twice, and the key kept the outbox at one email | [8.3](#s-an-assistant-with-memory-and-approvals-that-survives-a-restart) |
| `deep-agent` | the Mac | What does a deep agent with a subagent send? | 1 run on Qwen3 8B | 24,300 prompt tokens in 7 model calls | [8.4](#s-a-deep-agent-with-a-subagent-and-files) |
| `failure-drill` | the Mac | What does each documented failure look like? | 1 run of seven cases | the seven cases took 26.0 s in all | [8.5](#s-a-failure-drill) |

The names follow the plan of the research, with no gap. T01 to T17 are the planned tests, and TRC is the tracing test. T18 to T20 are later runs for sections 6.2 and 6.5. The last five folders are the demos of Part 8.

## What is in the lab folder

[The lab folder](manuals/langchain-101/capture/lab) holds one folder for each row of the table above, and the folder `summary`.

- **Raw recordings.** Each experiment folder keeps the files of its run, unchanged, as JSON lines, logs, and text. A long log is kept as an excerpt whose lines are exact.
- **Scripts.** Many folders keep the lab scripts that made them, and the lab README names them. The demo folders hold the output of `run.sh` in `capture/demos/`.
- **Summaries.** `capture/run.py` computes one summary for each data set into `summary/`. Each chart reads one of the 27 summary files, and each measured number comes from one.
- **A list of changes.** The README of the lab folder names every file that we cut, left out, or changed, with the reason.

No file holds a key, a token, or the name of a person. The only host names are `127.0.0.1` and the public hosts that recorded requests and error texts name, such as `api.smith.langchain.com`. The addresses and names in the test inputs are made up.

## The capture kit

[The capture kit](manuals/langchain-101/capture) drives the stack in one Python process, offline, with no keys. It writes 44 files to `capture/out/`, and every listing in the manual is cut from one of them.

```bash
cd manuals/langchain-101
python3 capture/run.py
python3 capture/run.py --check
```

The first command writes the captures and the lab summaries. The second captures again into a temporary folder and compares each file. It then computes the summaries again and compares them, and it prints one `skipped` line for the lab runs, because they need Ollama and Postgres.

## Record it again on your machine

1. Create the virtual environment of the kit from `capture/requirements.txt` with Python 3.13.
2. Install Ollama, pull the Qwen3 models, and start PostgreSQL for the experiments that use them.
3. Run the script of one experiment, from a folder that keeps one. Each script writes the files of its own folder.
4. Run `python3 capture/run.py` from the manual directory to compute the summaries again.

Your times will differ from ours. The messages, the error texts, the checkpoints, and the order of events must not. If one of them differs at the pin, a claim of this manual depends on our machines.

Sources: manual.json (pin, sources); capture/README.md, capture/run.py, capture/requirements.txt, capture/lab/README.md, capture/lab/x86-guest-machine.txt; capture/lab/summary/overhead-mac.json, capture/lab/summary/crash-resume-mac.json, capture/lab/summary/checkpoint-cost-x86.json, capture/lab/summary/streaming-mac.json, capture/lab/summary/retries-mac.json, capture/lab/summary/structured-output-mac.json, capture/lab/summary/approvals-mac.json, capture/lab/summary/parallel-tools-mac.json, capture/lab/summary/tokens-mac.json, capture/lab/summary/long-threads-x86.json, capture/lab/summary/middleware-mac.json, capture/lab/summary/mcp-mac.json, capture/lab/summary/serde-mac.json, capture/lab/summary/stores-mac.json, capture/lab/summary/agent-server-x86.json, capture/lab/summary/concurrency-x86.json, capture/lab/summary/recursion-mac.json, capture/lab/summary/tracing-mac.json, capture/lab/summary/evaluate-mac.json, capture/lab/summary/pytest-plugin-mac.json, capture/lab/summary/mcp-edges-mac.json, capture/lab/summary/demos-mac.json; the measured paragraphs of the sections linked in each row.
