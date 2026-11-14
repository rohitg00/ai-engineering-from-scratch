# LangChain 101

The LangChain Python stack, from the first `create_agent` call to an agent that streams, pauses for approval, survives a crash, and leaves a trace. It covers langchain 1.5.0, langchain-core 1.8.0, langgraph 1.2.22, and deepagents 0.7.38. Each decision has a recorded answer. The documentation tells you what each class and parameter does. This manual tells you what happened when we ran it, broke it, and measured it. The web edition is at [aiengineeringfromscratch.com/manual-langchain-101.html](https://aiengineeringfromscratch.com/manual-langchain-101.html), and each release of the course attaches the PDF as `aiefs-manual-langchain-101.pdf`.

## What is in it

- 43 sections in 8 parts, then ten reference sections. Part 1 puts one agent run on one page. Part 2 covers the install, models, messages, and tools. Part 3 covers `create_agent`, structured output, middleware, retries, and guardrails. Part 4 covers streaming, checkpointers, durability, stores, and long threads. Part 5 covers LangGraph itself: state, Send and Command, the functional API, interrupts, time travel, subgraphs, and recursion limits. Part 6 covers retrieval, MCP, Deep Agents, and LangSmith. Part 7 covers cost, the Agent Server, security, upgrades, and errors. Part 8 builds five agents that you can run.
- Each measured number names its machine and the number of runs. Pages that this edition does not measure yet say so, and section 7.6 lists the runs that come in the next edition.
- 56 figures and a cover plate, drawn with the figure kit. The charts read the summary files.
- 205 listings. Each one is cut from an offline capture or from the source at the pinned tag, and the audit checks it line for line.
- Section 1.1 sets each headline claim of the project site beside the result that we measured.
- The reference part holds the `create_agent` parameters, the middleware hooks and classes, the stream modes, the checkpointer and store API, the environment variables, the error strings, a glossary, and the register of 30 places where the sources disagree.

## Files

| Path | Holds |
|---|---|
| `manual.json` | the manifest: the pin, the parts, the palette, the sources, the cover plate |
| `front.md`, `sections/` | the text, one file per section |
| `figures/src/` | the figure sources, built to `figures/*.svg` |
| `capture/run.py`, `capture/s_*.py` | the capture kit: it runs offline with a scripted fake chat model and no keys, and writes the 44 files in `capture/out/` that the listings come from |
| `capture/lab/` | 21 recorded experiments, `T01-overhead-mac` to `T20-mcp-edges-mac` and `TRC-tracing-mac`, and the recorded runs of the five demos. Each folder holds its scripts and raw output, and `capture/lab/README.md` names the rows not to use |
| `capture/lab/summary/` | 27 summary files that the tables and charts read, rebuilt by `capture/labsum.py` |
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
| the Mac | an Apple M1 Max laptop with 10 cores and 64 GiB, running Ollama for the real models |
| the x86 server guest | a KVM guest with 32 vCPU and 48 GiB, running PostgreSQL 16 and the Agent Server |

The real models are Qwen3, from 0.6B to 8B, and `nomic-embed-text` for embeddings, all on Ollama. No cloud model, no API key, and no LangSmith account was used. `capture/lab/README.md` maps each experiment to its machine. Do not compare a number from one machine with a number from another.

## How to read it

Start with the front matter, "How to read this manual". It installs the stack from `capture/requirements.txt` and runs the capture kit once. Read Part 1 once and completely. After that, go to the page that answers your question. When something breaks, start at section 7.5 and the error table in R.6.

## Run the recordings again

The lab recordings need Ollama on the Mac and Postgres on an x86 machine, so they cannot run in CI. The scripts of each experiment are in its folder under `capture/lab/`, and section R.10 lists the experiments, the machines, the number of runs, and the method. The five demos in `capture/demos/` each have a README and a `run.sh`.

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
