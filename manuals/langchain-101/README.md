# LangChain 101

The LangChain Python stack, from the decision to use it at all to an agent that streams, pauses for approval, survives a crash, and leaves a trace. It ends with a service that runs the agent in production. It covers langchain 1.5.0, langchain-core 1.8.0, langgraph 1.2.22, and deepagents 0.7.38. Each decision has a recorded answer. The documentation tells you what each class and parameter does. This manual tells you what happened when we ran it, broke it, and measured it. The web edition is at [aiengineeringfromscratch.com/manual-langchain-101.html](https://aiengineeringfromscratch.com/manual-langchain-101.html), and each release of the course attaches the PDF as `aiefs-manual-langchain-101.pdf`.

## What is in it

- 60 sections in 9 parts, then eleven reference sections. Each part opens with a position that our runs support. Part 1 is the decision: the claims beside our runs, a harness shoot-out on a 99-task suite with state checkers, and one agent run. Part 2 goes inside the runtime with traces of real runs. Part 3 covers the install, models, messages, and tools. Part 4 covers `create_agent`, structured output by provider, many tools, middleware, retries, and guardrails. Part 5 covers streaming, checkpointers, durability, stores, and long threads. Part 6 covers LangGraph control flow. Part 7 covers retrieval, MCP, Deep Agents, and LangSmith. Part 8 covers the Agent Server, Agent Chat UI, cost, security (with the file rules and store namespaces of Deep Agents), upgrades, errors, and a failure drill. Part 9 builds one FastAPI service with Postgres, approvals, spans, faults, evals, and several workers. It runs that service on Qwen3 4B, Qwen3 14B, and Claude Haiku 5.5. Five worked agents sit in the parts they apply.
- Each measured number names its machine and the number of runs. Pages that this edition does not measure yet say so, and section 8.8 lists the runs that come in the next edition.
- 94 figures and a cover plate, drawn with the figure kit. The charts read the summary files.
- 287 listings. Each one is cut from an offline capture or from the source at the pinned tag, and the audit checks it line for line.
- Section 1.1 sets each headline claim of the project site beside the result that we measured.
- The reference part holds the `create_agent` parameters, the middleware hooks and classes, the stream modes, the checkpointer and store API, the environment variables, the error strings, a glossary, the register of 32 places where the sources disagree, and the method of the task-suite bench.

## Files

| Path | Holds |
|---|---|
| `manual.json` | the manifest: the pin, the parts, the palette, the sources, the cover plate |
| `front.md`, `sections/` | the text, one file per section |
| `figures/src/` | the figure sources, built to `figures/*.svg` |
| `capture/run.py`, `capture/s_*.py` | the capture kit: it uses no keys and no fake chat model, calls Qwen3 4B on a local Ollama where a scenario needs a model, and writes the files in `capture/out/` that the listings come from |
| `capture/lab/` | 51 experiment folders: `T01-overhead-mac` to `T20-mcp-edges-mac`, `TRC-tracing-mac`, and `T21-langsmith-account-mac`, the real-model runs again in the folders that end in `-x86`, `-x86-real`, and `-mac-real`, the runtime traces in `internals/`, the task-suite bench in `bench/`, the second bench in `bench2/`, the multi-agent runs in `multiagent/`, `last-two-mac/`, the production service of Part 9 in `prodapp-mac/`, and the recorded runs of the five demos. Each folder holds its scripts and raw output, and `capture/lab/README.md` names the rows not to use |
| `capture/lab/summary/` | 48 summary files that the tables and charts read, rebuilt by `capture/labsum.py`. The bench writes its own summary, `capture/lab/bench/summary-mac.json`, with `capture/lab/bench/summarize.py`. `capture/labsum.py` also rebuilds the ten summaries in `capture/lab/prodapp-mac/summary/` and the two run summaries in `capture/lab/prodapp-mac/runs/summary/` |
| `capture/demos/` | five demos with a README and a `run.sh` each: a SQL agent, a retrieval agent, an assistant with memory, a deep agent, and a failure drill |

## The pin

| Item | Value |
|---|---|
| langchain | 1.5.0, commit `c2f4036e4c6ca45a8da8a42d8e07a25d2ea48b8f` |
| langchain-core | 1.8.0 |
| langgraph | 1.2.22, with langgraph-checkpoint 4.3.2, langgraph-prebuilt 1.1.2, and langgraph-checkpoint-postgres 3.2.1 |
| langgraph-checkpoint-sqlite | 3.1.3 |
| deepagents | 0.7.38 |
| langsmith | 0.14.17 |
| Providers | langchain-openai 1.8.0, langchain-anthropic 1.7.10, langchain-ollama 1.1.0 |
| Python | 3.11 or later |
| Verified | 2026-11-14 |

`capture/requirements.txt` holds the exact versions, and section R.8 gives the commit of each repository.

## The recording machines

| Name in the manual | Machine |
|---|---|
| the Mac | an Apple M1 Max laptop with 10 cores and 64 GiB, running Ollama for the local models, the client of the Anthropic API in the bench and in Part 9, the client of the hosted LangSmith API in T21, and the service of Part 9 with PostgreSQL 14 |
| the x86 server guest | a KVM guest with 32 vCPU and 48 GiB, running PostgreSQL 16 and the Agent Server |

The local models are Qwen3 0.6B, 1.7B, 4B, 8B, 14B, and 30B-A3B, and gpt-oss 20B, with `nomic-embed-text` for embeddings, all on Ollama. Claude Haiku 5.5 and Claude Sonnet 5.5 ran in the task-suite bench, through the Anthropic API, for $0.93. Claude Haiku 5.5 also ran the 20 evals of Part 9, in 64 calls for $0.011, and 60 attacks on the file rules of section 8.4, in 134 calls for $0.021. One run used a new LangSmith account on the free plan, from the Mac, with its ids replaced in the kept files. `capture/lab/README.md` maps each experiment to its machine. Do not compare a number from one machine with a number from another.

## How to read it

Start with the front matter, "How to read this manual". It installs the stack from `capture/requirements.txt` and runs the capture kit once. Read Part 1 once and completely. After that, go to the page that answers your question. When something breaks, start at section 8.6 and the error table in R.6.

## Run the recordings again

The lab recordings need Ollama and Postgres on the Mac and on an x86 server guest, so they cannot run in CI. The scripts of each experiment are in its folder under `capture/lab/`, and section R.10 lists the experiments, the machines, the number of runs, and the method. The five demos in `capture/demos/` each have a README and a `run.sh`.

The captures and the summaries rebuild offline:

```bash
cd manuals/langchain-101
python3 capture/run.py --check
```

The check runs the capture kit again and compares each file in `capture/out/`. It rebuilds every summary from the lab recordings and compares it with the committed file. It prints one `skipped:` line for the lab runs, because it does not start Ollama or Postgres.

## Build and check

From the repository root:

```bash
node manuals/_shared/figkit.js build manuals/langchain-101
node site/build-manuals.js
node scripts/audit_manuals.js --manual langchain-101
```

The audit must report `TOTAL 0`. See [manuals/AUTHORING.md](../AUTHORING.md) for the contract.
