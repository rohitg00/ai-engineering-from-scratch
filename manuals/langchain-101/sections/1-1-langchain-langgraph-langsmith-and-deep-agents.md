# LangChain, LangGraph, LangSmith, and Deep Agents

> LangChain builds the agent, LangGraph runs it as a graph with checkpoints, LangSmith records it, and Deep Agents adds a harness, each in packages with their own versions.

You search for how to build an agent with LangChain and find four product names, three install commands, and code from four years. One answer imports `AgentExecutor`, another `create_react_agent`, a third `create_deep_agent`. All three import paths exist, and two of them are deprecated at the pin.

When you finish this section, you can say what each of the four projects does and which package holds it. You can also set each headline claim of the project beside what our runs showed, and find the section that proves it.

## Four projects, four version numbers

The documentation describes the stack in four lines, one for each project {{docs oss/python/langgraph/overview}}:

- Deep Agents is a harness that adds planning, subagents, file tools, and context management on top of LangGraph.
- LangChain is the framework, with the interfaces and integrations for models, tools, and the agent loop.
- LangGraph is the runtime that gives durable execution, streaming, human review, and persistence.
- LangSmith is the platform for traces, evaluations, prompts, and deployments, for any framework.

**LangChain:** the agent framework, in the packages `langchain` and `langchain-core`. `langchain` holds `create_agent`, the middleware, and `init_chat_model`. `langchain-core` holds messages, tools, the base chat model, and the fake models.

**LangGraph:** the runtime that runs an agent as a graph of nodes, in the package `langgraph`. It holds `StateGraph`, the loop that runs it, checkpoints, interrupts, and streaming.

**LangSmith:** the hosted platform for traces, evaluations, prompts, and deployments, and its client package `langsmith`. Agent Server, the server that runs a graph behind an HTTP API, belongs to LangSmith.

**Deep Agents:** a harness built on `create_agent`, in the package `deepagents`. It adds file tools, subagents, and summarization to an agent.

The four sets of packages do not share version numbers. At the pin, `langchain` is 1.5.0, `langchain-core` is 1.8.0, `langgraph` is 1.2.22, `deepagents` is 0.7.38, and `langsmith` is 0.14.17. A sentence that says "LangChain 1.5" without a package name is ambiguous, because `langchain-core` 1.5.0 came out four months before `langchain` 1.5.0. [Figure 1.1](#fig-1-1) shows which package each layer is in.

```figure
id: fig-1-1
kind: layers
title: the four projects and their packages at the pin
claim: An agent from create_agent is a LangGraph graph, so every LangChain agent depends on LangGraph, and LangSmith sits beside the stack.
caption: Each band is one project, with its packages and versions at the pin. Read from the top down: each layer imports the one below it. LangSmith sits at the side because langchain-core imports its client, and tracing stays off until you turn it on. From capture/out/00-versions.txt and capture/out/05-agent-graph.txt.
```

The layers are visible in a compiled agent. `create_agent` returns a `CompiledStateGraph` from `langgraph.graph.state`, with the nodes `model` and `tools`:

```listing
title: the type and the nodes of an agent
source: capture/out/05-agent-graph.txt
lang: text
note: Cut to the node list and the type line. The edges, the Mermaid text, and the config are cut.
---
[
  "__start__",
  "model",
  "tools",
  "__end__"
]
…
type langgraph.graph.state.CompiledStateGraph
```

`langsmith` is a dependency of `langchain-core`, so it is installed with every agent {{code libs/core/pyproject.toml}}. It sends nothing until an environment variable turns tracing on {{code langsmith/utils.py}}. The capture kit sets `LANGSMITH_TRACING=false`, and a LangSmith run tree is built only in memory.

## What the stack standardizes

LangChain gives you five things with fixed names and shapes.

- **One message format.** `SystemMessage`, `HumanMessage`, `AIMessage`, and `ToolMessage`, with standard content blocks across providers. [Section 2.3](#s-messages-and-content-blocks) shows them.
- **One tool interface.** A function with type hints becomes a tool with a JSON schema. [Section 2.4](#s-tools-toolruntime-and-tool-errors) shows the schema the model sees.
- **One agent loop.** `create_agent` builds a graph that calls the model, runs the tools it asks for, and stops when the model asks for none. [Section 1.2](#s-one-create-agent-run) follows one run.
- **One checkpoint interface.** A checkpointer saves the state of the graph after each step, in memory, in SQLite, or in Postgres.
- **One set of stream modes.** `updates`, `values`, `messages`, `custom`, and four more name what a stream yields at each step.

## What it leaves to you

### The model and its package

LangChain calls no model by itself. You install a provider package, such as `langchain-openai` or `langchain-ollama`, and pass a model or a model string. Each provider package has its own version and its own retry defaults. [Section 2.2](#s-init-chat-model-and-model-profiles) counts the retries of one of them.

### Persistence

An agent keeps no conversation unless you pass a checkpointer. The release notes for v1 say that conversations persist across sessions by themselves, through built-in checkpoints {{docs oss/python/releases/langchain-v1}}. The agents page says that a thread keeps its history only with a checkpointer, which you pass yourself when you run locally {{docs oss/python/langchain/agents}}. The code agrees with the agents page: the `checkpointer` parameter of `create_agent` defaults to `None` {{code langchain/agents/factory.py}}. On Agent Server, the server provides the checkpointer.

### Side effects that run twice

A checkpointer makes a run resumable. It does not make a tool call happen once. A tool that ran before a crash can run again on the resume, and the tool must make that safe.

**We measured** this on the Mac with a three-node graph whose middle node appends one line to a file. We killed the process at five points, for three durability modes and two savers, five times in each cell. In 80 of 150 trials the line was written twice. With an idempotency key in the node, it was written twice in 0 of 150. Part 4 covers the durability modes, and section 4.3 will show each cell.

### Retries

Two layers retry a failed model call: the client of the provider package, and `ModelRetryMiddleware`. They multiply. [Section 2.2](#s-init-chat-model-and-model-profiles) shows 9 attempts at the stub for one model call with both layers at their defaults.

### The server

Agent Server, which runs a graph behind an HTTP API with a task queue, is part of LangSmith. `langgraph dev` runs it in memory on your machine with no key. The full stack under `langgraph up`, with Postgres and Redis, refused to start for us without a LangSmith API key or a license key:

```listing
title: the API container under langgraph up, with no key
source: capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt
lang: text
note: The first two lines of the error.
---
ValueError: License verification failed. Please ensure proper configuration:
- For local development, set a valid LANGSMITH_API_KEY for an account with LangGraph Cloud access in the environment defined in your langgraph.json file.
```

## What the project says, and what we measured

The project makes short statements in its documentation and on its product pages. Most have no conditions. The table sets each statement beside our result.

**We measured** every result in this table on the Mac or on the x86 server guest, or recorded it with the capture kit. Each row names its machine and the count. The two machines differ, so do not compare a number from one row with a number from another.

| The project says | Our result | Section |
|---|---|---|
| LangChain v1 is a focused foundation for agents, ready for production {{docs oss/python/releases/langchain-v1}} | We tested behaviour, not this phrase. One rule of its own release policy did not hold: `langchain` 1.5.0, a minor release, raised the Python floor to 3.11. | [2.1](#s-install-and-the-package-map) |
| Chat models retry a failed call up to 6 times for network errors, 429, and 5xx {{docs oss/python/langchain/models}} | Not at the pin for `ChatOpenAI` from `langchain-openai` 1.8.0: 3 attempts at the stub, then an error. The Mac, 3 runs for each of 429, 500, and a timeout. | [2.2](#s-init-chat-model-and-model-profiles) |
| `ModelRetryMiddleware` makes 3 attempts in total with its defaults {{docs oss/python/langchain/middleware/built-in}} | Confirmed: 3 attempts with the client retries off. With the client default left on, the layers made 9 attempts. The Mac, 3 runs each. | [2.2](#s-init-chat-model-and-model-profiles) |
| From `langgraph` 1.1.4, the default recursion limit is 10,007 steps {{docs oss/python/langgraph/graph-api}} | Confirmed for a `StateGraph`: the kit stops at 10007. `create_agent` sets its own limit of 9999, and on the Mac a looping agent made 5000 model calls and 4999 tool calls before the stop, in one run. | [1.2](#s-one-create-agent-run) |
| The default recursion limit of Agent Server is `10011` {{docs langsmith/env-var-cloud}} | Not seen. Under `langgraph dev`, a looping graph stopped at 10007 steps, in one run on the x86 server guest. | Part 7 |
| Conversations persist across sessions by themselves {{docs oss/python/releases/langchain-v1}} | Only with a checkpointer that you pass. The default of `create_agent` is no checkpointer, as the agents page says. | [1.2](#s-one-create-agent-run) |
| With `durability="sync"`, LangGraph writes each checkpoint before the run goes on {{docs oss/python/langgraph/checkpointers}} | Holds after a step: a kill after the tool step repeated the side effect in 0 of 10 graph trials. A kill after the tool returned and before its result was saved repeated it in 1 of 5 trials on SQLite and 5 of 5 on Postgres. The Mac. | Part 4 |
| With `durability="async"`, a crash has a small chance to lose checkpoints {{docs oss/python/langgraph/checkpointers}} | Confirmed. A kill after the tool step repeated the side effect in 5 of 5 graph trials on each saver. The Mac. | Part 4 |
| On a resume, the node that called `interrupt()` runs again from its first line {{docs oss/python/langgraph/interrupts}} | Confirmed in the kit: the code before `interrupt()` ran twice. | Part 5 |
| A replay runs the nodes again and does not read them from a cache {{docs oss/python/langgraph/use-time-travel}} | Confirmed in the kit: a replay from the checkpoint before the tool ran the tool again. | Part 5 |
| Structured output comes from the main loop, with no extra model call {{docs oss/python/releases/langchain-v1}} | Confirmed in the kit: one model call returned the structured response. | Part 3 |
| A queue worker runs up to `N_JOBS_PER_WORKER` runs at one time, and the default is 10 {{docs langsmith/agent-server-scale}} | Not under `langgraph dev`, whose default is 1. 20 background runs of 2 s took 41.0 s with 1 run at a time, and 5.1 s with the setting at 10. The x86 server guest, one run each. | Part 7 |
| The Postgres task queue of Agent Server runs each task exactly once {{docs langsmith/deploy-standalone-server}} | Coming in the next edition. The full server needs a license key. Our runs of the library alone showed no exactly-once side effect: 80 of 150 trials wrote twice. | section 7.6 |
| Agent Server recovers from short Redis or Postgres outages on both deployment types {{docs langsmith/cloud-platform-features}} | Coming in the next edition, for the same reason. | section 7.6 |
| A run on an interrupted worker resumes from its last checkpoint {{docs langsmith/agent-server}} | Coming in the next edition, for the same reason. | section 7.6 |
| Redis keeps no user or run data {{docs langsmith/agent-server}} | Coming in the next edition, for the same reason. | section 7.6 |
| The LangChain product page says that LangChain runs on a durable runtime with built-in persistence and checkpointing {{site langchain.com/langchain}} | Built in only when you pass a checkpointer, as above. | [1.2](#s-one-create-agent-run) |
| LangChain Academy says in its LangGraph FAQ that LangGraph adds no overhead to your code {{academy}} | It adds time, not tokens. On the Mac, `create_agent` took 7.67 ms per run of three model calls against a local stub, and a plain `openai` loop took 4.10 ms, 200 runs each. With Qwen3 4B on Ollama the medians were 1,550 ms and 1,451 ms, 24 runs each. The request bodies differed by 17 bytes. | Part 7 |

Six statements match our runs as written. Three hold only under a condition that the page does not state: a checkpointer that you pass, or the point of the crash. Five did not match at the pin. They are the retry count, the server recursion limit, the jobs default, the Python rule of the release policy, and the claim of no overhead. Four need the full Agent Server, and section 7.6 will list them with the runs planned for the next edition.

Two of these results change how you build. Count the retries of your own provider package. Make each side effect safe to repeat.

## When this is the wrong tool

LangChain fits an agent that calls tools in a loop and needs to pause, stream, or resume. It costs some Python time on each model call, and disk space.

**We measured** both on the Mac. Against a local stub, `create_agent` added about 1.2 ms for each of the three model calls of a run, from the medians of 200 runs. A fresh install of `langchain` with `langchain-openai` held 44 packages in 54,312 KiB, and `openai` alone held 14 packages in 26,356 KiB. [Section 2.1](#s-install-and-the-package-map) has the install and the import times.

If your program makes one model call with no tools and no state, the provider SDK alone does the same job with less code.

```takeaways
- Name the package with each version you write down, because the four projects number their packages apart.
- Pass a checkpointer when you need a conversation to survive a turn.
- Make every tool with a side effect safe to run twice.
- Count the retry layers of your model before you set a timeout.
- Check each claim in the table on your own provider before you depend on it.
```

Sources: docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/overview, oss/python/releases/langchain-v1, oss/python/langchain/agents, oss/python/langchain/models, oss/python/langchain/middleware/built-in, oss/python/langgraph/graph-api, oss/python/langgraph/checkpointers, oss/python/langgraph/interrupts, oss/python/langgraph/use-time-travel, langsmith/env-var-cloud, langsmith/agent-server-scale, langsmith/deploy-standalone-server, langsmith/cloud-platform-features, langsmith/agent-server); capture/out/00-versions.txt, capture/out/05-agent-graph.txt, capture/out/07-structured-output.txt, capture/out/30-state-history-forks.txt, capture/out/32-interrupt-resume.txt, capture/out/38-recursion-limit.txt; capture/lab/summary/crash-resume-mac.json, capture/lab/summary/retries-mac.json, capture/lab/summary/recursion-mac.json, capture/lab/summary/overhead-mac.json, capture/lab/summary/agent-server-x86.json, capture/lab/summary/install-size-mac.json, capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt, capture/lab/T01-overhead-mac/09-request-body-diff.txt; libs/langchain_v1/langchain/agents/factory.py, libs/core/pyproject.toml at langchain==1.5.0; src/langsmith/utils.py at langsmith v0.14.17; the product page www.langchain.com/langchain and the LangChain Academy LangGraph FAQ, read 2026-11-14.
