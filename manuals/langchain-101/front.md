# How to read this manual

> This manual explains the LangChain Python stack at one pin, and every listing in it comes from an offline capture that you can run again yourself.

## Who this manual is for

You write Python and you have called a chat model API. You have seen LangChain code, maybe from the 0.x years, with chains, `AgentExecutor`, and `langchain_community` imports. Today `pip install langchain` on Python 3.11 gives you version 1.5.0, and most of that code no longer imports.

This manual is for the engineer who must decide if the 1.x stack fits, and then build on it. It starts with one agent run and the packages it needs. It ends with a part that builds four small programs and a drill for each documented failure.

Four projects share the LangChain name: LangChain, LangGraph, LangSmith, and Deep Agents. Their packages have their own version numbers. So this manual names the package with each version, such as `langchain` 1.5.0 and `langchain-core` 1.8.0. [Section 1.1](#s-langchain-langgraph-langsmith-and-deep-agents) says what each project does.

## What you can do after this manual

- Install the stack from a lockfile on Python 3.11 or later, and say which package each import comes from.
- Build an agent with `create_agent`, and predict each model call, tool call, and checkpoint of a run.
- Choose a structured output strategy and a set of middleware, and predict the order in which their hooks run.
- Stream a run in the mode you need, and keep a conversation across turns and restarts with a checkpointer.
- Pause a run for human approval, resume it, and say which code runs again on the resume.
- Count the attempts of each retry layer, and make a side effect safe when a crash replays it.
- Connect MCP tools, a retriever, Deep Agents, and LangSmith tracing, and find the cause of a failure from its message.

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
| 4 | LangChain Academy, the courses LangChain publishes, and their MIT repositories | the order in which LangChain teaches the stack, and the starting points of Part 8 | `academy` |
| 5 | The capture kit in `capture/` | every listing | the file name |
| 6 | The lab recordings in `capture/lab/` | every measured number | the file name |

GitHub issues and pull requests are evidence for a behaviour at the pin, and the text names each one by its number. The product pages at www.langchain.com have no open license. Section 1.1 states their claims in our words and sets each one beside our result.

The documentation site serves its main branch, and no docs tag matches a package release. A page can describe a newer or an older behaviour than the pin. Where a page and the code disagree, the code wins, and the section shows both.

## The capture kit and the lab

**Capture kit:** the program in `capture/` that drives the stack in one Python process, offline, and writes what it sees to `capture/out/`. It covers LangChain, LangGraph, Deep Agents, `langchain.mcp`, and the LangSmith SDK.

The kit uses a scripted fake chat model in place of a provider. The fake returns a fixed script of messages and tool calls, and it records what `create_agent` sent it on each call. So a listing shows the real messages, graph nodes, checkpoints, and errors of the stack, and the model part is our script. The kit needs no network and no API keys. It masks values that change on every run, such as message ids.

**Lab recording:** a run against a real model or a real database on one of our machines, kept as raw files in `capture/lab/`. `capture/run.py` computes a summary of each data set into `capture/lab/summary/`, and each chart reads one summary.

We recorded on two machines. The Mac is an Apple M1 Max with 10 cores and 64 GiB, with Ollama and PostgreSQL 14. The x86 server guest has 32 vCPU and 48 GiB, with PostgreSQL 16 and Redis 7. The two machines differ, so this manual never sets a number from one beside a number from the other.

The Mac is a shared laptop, and other work ran on it during every timed run. Read each time from the Mac as an upper bound for that machine. The real models in our runs were Qwen3 models of 0.6B to 8B parameters on Ollama on the Mac, and `nomic-embed-text` for embeddings. No model time in this manual is the time of a hosted model.

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

The check runs every scenario again into a temporary folder, compares each file with `capture/out/`, and prints `ok: 44 files match`. It then rebuilds the lab summaries from the raw recordings and compares them too. It does not record the lab runs again, because those need Ollama and Postgres.

This is the scenario behind [section 1.2](#s-one-create-agent-run). It builds an agent with one tool and a system prompt, and it asks one question:

```listing
title: the agent of the first run
source: capture/s_start.py
lang: python
note: The scenario function from the kit. The fake model, the add tool, and ASK come from capture/common.py.
---
def agent_run(cap):
    fake = model(*sum_script())
    agent = create_agent(fake, tools=[add], system_prompt="You add numbers.")
    out = agent.invoke(ASK)
```

The model is scripted to call `add` with 2 and 3 and then to say the sum. The run ends with four messages:

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
    "content": "The sum is 5.",
```

To use a real model, replace the fake with a model string such as `"ollama:qwen3:4b"` and install the provider package. [Section 2.2](#s-init-chat-model-and-model-profiles) shows how the string resolves.

## How the parts are ordered

Part 1 is LangChain on one page: each project, its claims beside our results, and one agent run from `invoke` to the last checkpoint. Part 2 installs the stack and explains the four objects of every agent: the model, the messages, the tools, and the prompt.

Part 3 is the agent that `create_agent` builds: its graph, structured output, and middleware. Part 4 is streaming and memory: stream modes, checkpointers, durability, stores, and summarization. Part 5 is LangGraph itself: state and reducers, `Send` and `Command`, the functional API, interrupts, approvals, time travel, subgraphs, and error handlers.

Part 6 connects retrieval, MCP, Deep Agents, and LangSmith. Part 7 operates and debugs: Agent Server, cost, security, migration from 0.x, symptoms, and the limits at the pin. Part 8 builds four programs and a failure drill. This edition is a draft, and the table below lists the parts that are written so far:

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

Sources: manual.json; capture/README.md, capture/run.py, capture/s_start.py, capture/common.py, capture/out/06-agent-run.txt, capture/out/03-tools.txt, capture/out/04-tool-errors.txt, capture/out/30-state-history-forks.txt, capture/out/42-langsmith.txt; capture/lab/; docs.langchain.com at docs commit 04d4d4a.
