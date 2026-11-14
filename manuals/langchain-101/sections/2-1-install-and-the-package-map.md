# Install and the package map

> Install `langchain` 1.5.0 on Python 3.11 or later from a lockfile, because the stack is many packages with separate versions, and a minor release can change behaviour.

You copy `from langchain.chains import LLMChain` from an older answer, and Python raises `ModuleNotFoundError`. You install `langchain-community` to get a loader, and then read that the package is sunset. You run the same `pip install` on Python 3.10 and on 3.12, and you get two different versions of `langchain`.

When you finish this section, you can say which package holds each import and install the stack at the pin. You can also say why it needs a lockfile.

## The package map

**Distribution:** a package as `pip` names it, such as `langchain-core`. Its import name has `_` in place of `-`, such as `langchain_core`.

The stack splits across these distributions at the pin:

| Distribution | Version | Import | What it holds |
|---|---|---|---|
| `langchain` | 1.5.0 | `langchain` | `create_agent`, middleware, `init_chat_model`, `langchain.mcp`, and short import paths for messages and tools |
| `langchain-core` | 1.8.0 | `langchain_core` | messages and content blocks, `BaseChatModel`, tools, callbacks, documents, retrievers, embeddings, and the fake models |
| `langgraph` | 1.2.22 | `langgraph` | `StateGraph`, the Pregel loop, `Command`, `Send`, `interrupt`, the functional API, and streaming |
| `langgraph-prebuilt` | 1.1.2 | `langgraph.prebuilt` | `ToolNode`, `ToolRuntime`, `InjectedState`, and the deprecated `create_react_agent` |
| `langgraph-checkpoint` | 4.3.2 | `langgraph.checkpoint`, `langgraph.store` | the saver interface, `InMemorySaver`, the serializers, and `InMemoryStore` |
| `langgraph-checkpoint-sqlite` | 3.1.3 | `langgraph.checkpoint.sqlite` | `SqliteSaver` and `SqliteStore` |
| `langgraph-checkpoint-postgres` | 3.2.1 | `langgraph.checkpoint.postgres` | `PostgresSaver` and `PostgresStore` |
| `langsmith` | 0.14.17 | `langsmith` | the tracing client, `traceable`, and `evaluate` |
| `deepagents` | 0.7.38 | `deepagents` | `create_deep_agent`, its backends, and its middleware |
| `langchain-text-splitters` | 1.1.3 | `langchain_text_splitters` | the text splitters |
| `langchain-classic` | 1.0.8 | `langchain_classic` | the 0.3 namespace: chains, legacy agents, the prompt hub module, and old memory classes |

Each provider has its own package, such as `langchain-openai` 1.8.0, `langchain-anthropic` 1.7.10, and `langchain-ollama` 1.1.0. They live in the same repository as `langchain`, but each is released from its own tag. At the `langchain` 1.5.0 tag, the OpenAI package in the tree is still 1.7.4 {{code libs/partners/openai/pyproject.toml}}.

`langgraph`, `langgraph-prebuilt`, `langgraph-checkpoint`, and `langgraph-checkpoint-postgres` came from one commit at the pin, with four different version numbers. [Figure](#fig-2-1) shows what each package requires.

```figure
id: fig-2-1
kind: tree
title: what each package requires at the pin
claim: Installing deepagents pulls in langchain, two provider packages, and langsmith, and installing langchain pulls in langgraph, which needs langchain-core.
caption: Read each arrow as requires, with the range that the package declares. Grey boxes are outside LangChain. Dashed boxes are optional extras. From the requires_dist lists on PyPI for each version, and capture/out/00-versions.txt.
```

## What moved

Old imports moved out of `langchain` at 1.0, and three repositories were archived in 2026.

- **Chains and legacy agents.** `LLMChain`, `AgentExecutor`, the indexing API, and the hub module are in `langchain-classic`, under `langchain_classic` {{code libs/langchain/langchain_classic}}.
- **Community integrations.** `langchain-community` 0.4.2 is the last release, and its repository is archived. Its README says that the package is sunset {{issue langchain-community README}}. It still installs, and it still depends on `langchain-classic`.
- **The MCP adapter.** `langchain-mcp-adapters` is archived. The changelog says that `langchain` 1.4.0 added `langchain.mcp` in its place {{docs oss/python/releases/changelog}}. At the pin, the extra `langchain[mcp]` installs it. Do not install both in one environment, because the old adapter requires `mcp` below 2.
- **The LangSmith SDK repository.** `langsmith-sdk` is archived, and the Python client now lives in `langsmith-python`. The package name `langsmith` did not change.

`create_react_agent` from `langgraph.prebuilt` still imports, and it warns that it moved to `create_agent`. [Section 1.2](#s-one-create-agent-run) shows the agent that replaces it.

## Python 3.11

**Python floor:** the oldest Python version that a package declares in `requires-python`.

The documentation disagrees with the packages about the floor. The install page shows `pip install -U langchain` with a comment that it needs Python 3.10 or later {{docs oss/python/langchain/install}}. The changelog entry for `langchain` 1.5 says that it needs Python 3.11 or later {{docs oss/python/releases/changelog}}. The packages agree with the changelog: `langchain` 1.5.0 and `langchain-core` 1.8.0 declare Python 3.11 or later {{code libs/langchain_v1/pyproject.toml}}. `langgraph` 1.2.22 still declares 3.10.

The manual follows the package metadata, which ranks above both pages. On Python 3.10, `pip install langchain` resolves `langchain` 1.4.x, and nothing tells you that you got an older line. Use Python 3.11 or later. The capture kit uses 3.13.

The same change breaks a rule of the release policy page. That page says that the Python floor changes only in a major release {{docs oss/python/release-policy}}. `langchain` 1.5.0 is a minor release. The register of this manual lists the disagreement as conflict D101.

## A lockfile

A minor release of one package can change what your code sees. `langchain-core` 1.7.0 changed the tool call events of a stream. Its changelog entry says to pin below 1.7 to keep the old shape {{docs oss/python/releases/changelog}}. `langgraph` released 1.2.20, 1.2.21, and 1.2.22 within nine days {{code PyPI JSON of langgraph}}.

So pin every package of the stack to one exact version. The capture kit pins 25 of them in `capture/requirements.txt`, and it writes what it installed:

```listing
title: the versions the capture kit installed
source: capture/out/00-versions.txt
lang: text
note: The first fourteen lines after the Python version. The transitive pins are cut.
---
python 3.13

langchain==1.5.0
langchain-core==1.8.0
langgraph==1.2.22
langgraph-checkpoint==4.3.2
langgraph-prebuilt==1.1.2
langgraph-checkpoint-sqlite==3.1.3
deepagents==0.7.38
langsmith==0.14.17
fastmcp==4.2.0
mcp==2.3.0
langchain-text-splitters==1.1.3
langchain-openai==1.8.0
langchain-anthropic==1.7.10
langchain-ollama==1.1.0
…
```

`deepagents` 0.7.38 requires `langchain-anthropic` and `langchain-google-genai`. Its deprecated default model is Claude {{code libs/deepagents/deepagents/graph.py}}. Install it only when you use it.

For an agent with one OpenAI model, this is the install at the pin:

```bash
python3.13 -m venv .venv
.venv/bin/pip install "langchain==1.5.0" "langchain-core==1.8.0" "langgraph==1.2.22" "langchain-openai==1.8.0"
.venv/bin/pip freeze > requirements.lock
```

Then install from `requirements.lock` everywhere else, so that every machine resolves the same versions.

## Install size and import time

**We measured** two fresh installs on the Mac, with the same lockfile as constraints, before any import wrote bytecode. `openai` alone installed 14 packages in 26,356 KiB. `langchain` with `langchain-openai` installed 44 packages in 54,312 KiB.

**We measured** the import time on the Mac, 10 runs of each import in a new process. [Figure](#fig-2-1b) shows each run. With bytecode already written, `import openai` took 0.329 s at the median, and the imports for `create_agent` with `ChatOpenAI` took 0.831 s. With no bytecode, they took 1.064 s and 2.64 s. The Mac is a shared laptop, so read these as upper bounds.

```figure
id: fig-2-1b
kind: chart
title: import time of four imports, 10 runs each
claim: The imports for create_agent with ChatOpenAI take about 0.8 s warm and 2.6 s with no bytecode, about two and a half times import openai alone.
caption: Each dot is one run in a new Python process on the Mac. Each short line is the median of ten runs. The left group had bytecode on disk and the right group had none. From capture/lab/summary/import-times-mac.json.
```

An import of 2.6 s matters in a serverless function or a CLI that starts on every call. Import the stack once at start-up, and keep the bytecode in the image.

```takeaways
- Use Python 3.11 or later, because langchain 1.5.0 does not install on 3.10.
- Pin every package of the stack to an exact version in a lockfile.
- Import chains and the hub from langchain_classic only while you migrate away from them.
- Install langchain[mcp], and remove langchain-mcp-adapters from the same environment.
- Keep the bytecode in your image when start-up time matters.
```

Sources: capture/out/00-versions.txt, capture/requirements.txt; capture/lab/summary/install-size-mac.json, capture/lab/summary/import-times-mac.json, capture/lab/T01-overhead-mac/07-install-size.txt, capture/lab/T01-overhead-mac/06-import-times.jsonl; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/install, oss/python/releases/changelog, oss/python/release-policy); libs/langchain_v1/pyproject.toml, libs/partners/openai/pyproject.toml, and libs/langchain/langchain_classic at langchain==1.5.0; libs/deepagents/deepagents/graph.py at deepagents==0.7.38; the PyPI JSON of each package and the archived READMEs of langchain-community, langchain-mcp-adapters, and langsmith-sdk, read 2026-11-14.
