# How to read this manual

> This manual explains the LangChain Python stack at one pin, and every listing in it comes from a capture of a real run that you can check yourself.

## Who this manual is for

You write Python and you have called a chat model API. You have seen LangChain code, maybe from the 0.x years, with chains, `AgentExecutor`, and `langchain_community` imports. Today `pip install langchain` on Python 3.11 gives you version 1.5.0, and most of that code no longer imports.

This manual is for the engineer who must decide if the 1.x stack fits, and then build on it. It starts with that decision, measured on a task suite with local and Claude models. Each part then opens with a position that our runs support, and most parts end with a small program that applies it.

Four projects share the LangChain name: LangChain, LangGraph, LangSmith, and Deep Agents. Their packages have their own version numbers. So this manual names the package with each version, such as `langchain` 1.5.0 and `langchain-core` 1.8.0. [Section 1.1](#s-langchain-langgraph-langsmith-and-deep-agents) says what each project does.

## What you can do after this manual

- Install the stack from a lockfile on Python 3.11 or later, and say which package each import comes from.
- Build an agent with `create_agent`, and predict each model call, tool call, and checkpoint of a run.
- Choose a structured output strategy and a set of middleware, and predict the order in which their hooks run.
- Stream a run in the mode you need, and keep a conversation across turns and restarts with a checkpointer.
- Pause a run for human approval, resume it, and say which code runs again on the resume.
- Count the attempts of each retry layer, and make a side effect safe when a crash replays it.
- Connect MCP tools, a retriever, Deep Agents, and LangSmith tracing, and find the cause of a failure from its message.
- Serve an agent from FastAPI with Postgres, approvals, spans, and evals, and size it from the model server.

## How this manual was made

We pinned the stack at the `langchain` 1.5.0 release of 2026-11-11 and checked every fact again on 2026-11-14. We read the source code of each package at its tag. We read the documentation at one commit of its repository, and we ran what both of them say.

| Package | Version | Commit |
|---|---|---|
| `langchain` | 1.5.0 | `c2f4036e` |
| `langchain-core` | 1.8.0 | `a4b4a7b9`, the same `libs/core` tree as `c2f4036e` |
| `langgraph` | 1.2.22 | `08a20169` |
| `langgraph-checkpoint`, `langgraph-prebuilt` | 4.3.2, 1.1.2 | `08a20169` |
| `langgraph-checkpoint-sqlite` | 3.1.3 | `5bd231cb` |
| `deepagents` | 0.7.38 | `c858b364` |
| `langsmith` | 0.14.17 | `15dd2a78` |
| `langchain-openai`, `langchain-anthropic`, `langchain-ollama` | 1.8.0, 1.7.10, 1.1.0 | their own tags |

The sources have a rank. When two of them disagree, the higher one wins, and the section says so.

| Rank | Source | What the manual takes from it | Cited as |
|---|---|---|---|
| 1 | The source code at the tags above | every class, parameter, default, and error text | `code` |
| 2 | The documentation at docs.langchain.com, built from commit `04d4d4a` of its repository, MIT license | the documented behaviour, in our own words | `docs` |
| 3 | The changelog and the release notes of each package | when a change came, and in which package | `docs` for the changelog page, `code` for a release |
| 4 | The capture kit in `capture/` | every listing | the file name |
| 5 | The lab recordings in `capture/lab/` | every measured number | the file name |

GitHub issues and pull requests are evidence for a behaviour at the pin, and the text names each one by its number. The product pages at www.langchain.com have no open license. Section 1.1 states their claims in our words and sets each one beside our result.

The documentation site serves its main branch, and no docs tag matches a package release. A page can describe a newer or an older behaviour than the pin. Where a page and the code disagree, the code wins, and the section shows both.

## The capture kit and the lab

**Capture kit:** the program in `capture/` that drives the stack in one Python process and writes what it sees to `capture/out/`. It covers LangChain, LangGraph, Deep Agents, `langchain.mcp`, and the LangSmith SDK.

The kit uses no fake chat model. Where a scenario needs a model, it calls Qwen3 4B Instruct, `qwen3:4b-instruct-2507-q4_K_M`, through `ChatOllama`. The settings are temperature 0, seed 42, `num_ctx` 16384, and `num_predict` 512. We recorded those captures on the x86 server guest, on CPU, on 2026-11-14. Each file names its model, its settings, the machine, and the date.

The other captures call no model, such as the versions, the messages, the graph structure, and the store. They run offline with no keys, and they give the same bytes on every run. The kit masks values that change on every run, such as message ids and the timings in each reply. A real model answers in its own words. So a listing shows what the model did on our run, even where the prompt asked for more.

**Lab recording:** a run against a real model or a real database on one of our machines, kept as raw files in `capture/lab/`. `capture/run.py` computes a summary of each data set into `capture/lab/summary/`, and each chart reads one summary.

We recorded on two machines. The Mac is an Apple M1 Max with 10 cores and 64 GiB, with Ollama and PostgreSQL 14. The x86 server guest has 32 vCPU and 48 GiB, with PostgreSQL 16, Redis 7, and Ollama 0.31.1 on CPU. The two machines differ, so this manual never sets a number from one beside a number from the other.

The Mac is a shared laptop, and other work ran on it during every timed run. Read each time from the Mac as an upper bound for that machine. The local models of the lab were Qwen3 0.6B, 1.7B, 4B, 8B, 14B, and 30B-A3B, and gpt-oss 20B, on Ollama, with `nomic-embed-text` for embeddings. The capture kit used Qwen3 4B Instruct on the x86 server guest. So did the failure drill of [section 8.7](#s-a-failure-drill) and the crash matrix of [section 5.3](#s-durability-modes-and-a-crash-between-two-steps). So did the lab runs T05, T07, T08, T11, T17, T18, and T19.

**Task-suite bench:** the 99 tasks of [section 1.2](#s-do-you-need-langchain), each checked by the state that its tools leave. Claude Haiku 5.5 (`claude-haiku-5-5`) and Claude Sonnet 5.5 (`claude-sonnet-5-5`) ran through the Anthropic API from the Mac. The budget had a cap, and every call is in a cost ledger. [The bench method](#s-ref-the-bench-method) gives the tasks, the settings, and the rows not to use.

Claude Haiku 5.5 also ran the 20 evals of the production service in [section 9.6](#s-evals-that-check-state), with every call in the same kind of ledger. It also ran 60 attacks on the file rules of [section 8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses), for $0.021. The rule matrix of that section has no model. A scripted caller drives the permission layer, and the section says so. Every other model time in this manual is the time of a local model.

## Conventions

- A citation such as `{{docs oss/python/langchain/models}}` stays in the source of a section and renders nothing. The reader view shows no file paths.
- Every source is stated in our own words. Quote marks hold only literal strings, such as output and error text.
- A citation with the key `docs` names the page path at docs.langchain.com, read at docs commit `04d4d4a`.
- A listing is cut from one capture file. `…` on its own line marks lines we cut, and the note under the title says what.
- `<uuid-1>`, `<hex-1>`, and `<time>` in a listing are masks. The same token means the same value inside one file.
- A paragraph that starts with **We measured** names the machine and the number of runs. Its numbers come from one summary file.
- A run is one call of `invoke` or `stream`. A step is one superstep of the LangGraph loop. A turn is one human message and everything up to the reply.

## A first run, offline

You need Python 3.13 for the kit, because the captures were made with it. The stack itself needs Python 3.11 or later. From the manual directory, create the virtual environment and run the check:

```bash
python3.13 -m venv capture/.venv
capture/.venv/bin/pip install -r capture/requirements.txt
python3 capture/run.py --check
```

The check runs the 19 model-free scenarios again into a temporary folder and compares each file with `capture/out/`. It checks that each of the 36 recorded files names its model. It also checks the structure that the manual relies on, such as the message types and the tool names. It then rebuilds the lab summaries from the raw recordings and compares them too. It does not call a model, so it prints one `skipped:` line for the recorded scenarios. `python3 capture/run.py --check --live` records them again when Ollama runs on your machine.

This is the scenario behind [section 1.3](#s-one-create-agent-run). It builds an agent with one tool and a system prompt, and it asks one question:

```listing
title: the agent of the first run
source: capture/s_start.py
lang: python
note: The scenario function from the kit. llm(), the add tool, and ASK come from capture/common.py.
---
def agent_run(cap):
    m = llm()
    agent = create_agent(m, tools=[add], system_prompt="You add numbers.")
    out = agent.invoke(ASK)
```

`llm()` builds `ChatOllama` on Qwen3 4B with the settings above. The model called `add` with 2 and 3 and then said the sum. The run ended with four messages:

```listing
title: the messages at the end of the first run
source: capture/out/06-agent-run.txt
lang: json
note: Each message is cut to its type and content. The ids and the tool call are cut.
---
    "type": "HumanMessage",
    "content": "What is 2 + 3?",
…
    "type": "AIMessage",
    "content": "",
…
    "type": "ToolMessage",
    "content": "5",
…
    "type": "AIMessage",
    "content": "2 + 3 = 5.",
```

To use another model, pass a model string such as `"openai:gpt-4.1"` in place of `m`, and install the provider package. [Section 3.2](#s-init-chat-model-and-model-profiles) shows how the string resolves.

## How the parts are ordered

Part 1 is the decision. It sets each project and its claims beside our results, compares harnesses on the task suite, and follows one agent run to the last checkpoint. Part 2 goes inside the runtime: supersteps, channels, the checkpoint write path, interrupts, streams, and checkpoint growth, from traces of real runs. Part 3 installs the stack and explains the model, the messages, the tools, and the prompt.

Part 4 is the agent that `create_agent` builds: its graph, structured output on each provider, many tools, and middleware. Part 5 is state, memory, and durability: streams, checkpointers, crashes, stores, long threads, and serialization. Part 6 is LangGraph control flow: state and reducers, `Send` and `Command`, the functional API, interrupts, approvals, time travel, subgraphs, and error handlers.

Part 7 connects retrieval, MCP, Deep Agents, and LangSmith. Part 8 operates and debugs: Agent Server, Agent Chat UI, cost, security, migration from 0.x, symptoms, a failure drill, and the limits at the pin. Part 9 builds one production service end to end, with FastAPI, Postgres, approvals, OpenTelemetry spans, faults, evals, and several workers. It runs that service on Qwen3 4B, Qwen3 14B, and Claude Haiku 5.5. The table below lists every part:

```parts
```

Each section ends with a short list of actions. Read those first when you need an answer today. Read the rest when you want the reason.

Four lessons go deeper into the ideas that this manual applies. [The LangGraph state machines lesson](phases/11-llm-engineering/16-langgraph-state-machines) and [the stateful graphs lesson](phases/14-agent-engineering/13-langgraph-stateful-graphs) build graphs from first principles. [The agent framework tradeoffs lesson](phases/11-llm-engineering/17-agent-framework-tradeoffs) compares frameworks. [The durable execution lesson](phases/15-autonomous-systems/12-durable-execution) explains checkpoints and replay. This manual stays with LangChain.

## Colour in figures

Each hue keeps one meaning in every figure:

```palette
```

[Figure](#fig-0-1) teaches the arrow styles with exchanges from our captures. A solid arrow is a call, and a dashed arrow in the same ink is its reply. The other six styles each mark one kind of event, and the colour of the arrow matches the table above.

```figure
id: fig-0-1
kind: sequence
title: reading a sequence figure in this manual
claim: Each arrow style marks one kind of exchange, and every label is a real name, message, or count from the capture kit.
caption: Read each numbered row from the tail of the arrow to its head. The note under each label names the style. From capture/out/06-agent-run.txt, capture/out/03-tools.txt, capture/out/04-tool-errors.txt, capture/out/30-state-history-forks.txt, and capture/out/42-langsmith.txt.
```

Sources: manual.json; capture/README.md, capture/run.py, capture/s_start.py, capture/common.py, capture/out/06-agent-run.txt, capture/out/03-tools.txt, capture/out/04-tool-errors.txt, capture/out/30-state-history-forks.txt, capture/out/42-langsmith.txt; capture/lab/, capture/lab/bench/summary-mac.json, capture/lab/bench/runs/cost-ledger.jsonl, capture/lab/prodapp-mac/runs/cost-ledger.jsonl; docs.langchain.com at docs commit 04d4d4a.
