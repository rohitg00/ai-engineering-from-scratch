# agents, models, and providers

> `agents` is the only required block, a model reference is `provider/model` or a name from `models`, and `providers` sets a reusable endpoint such as Docker Model Runner.

You open `capture/fixtures/agents/files.yaml` and find `model: local` on the agent, a `local` entry under `models`, and `provider: dmr` inside that entry. A second file, `dmr.yaml`, adds a `providers` block with a URL, and its run never reaches the recorder.

When you finish this section, you can follow an agent's `model` value to the endpoint it calls, and predict what `auto` picks.

## The file and its schema

**Agent file:** a YAML or HCL document that matches `agent-schema.json`, the schema of Docker Agent v16. Its root allows 16 keys and requires one: "Map of agent configurations. At least one agent is required" {{schema agents}}. A misspelled top-level key fails the load, because "the parser rejects unknown top-level keys" {{docs-agent Configuration Overview}}.

`version` is a string from `"0"` to `"16"` in the schema enum. The same docs page still says "The current version is `15`" {{docs-agent Configuration Overview}}. The capture files declare `"16"` and load, so this manual follows the schema. "When you load an older config, Docker Agent automatically migrates it to the latest schema" {{docs-agent Configuration Overview}}. The agent that `share pull` fetched from `agentcatalog/pirate` declares `version: "2"` and names `openai/gpt-4.1` inline (`16-share-pull-agent.yaml`).

```listing
title: the agent file of the single-agent runs
source: capture/fixtures/agents/files.yaml
lang: yaml
note: Nothing is cut. The same file drives the runs in the session, eval, and share sections.
---
version: "16"

agents:
  root:
    model: local
    description: Lists the files of a small repository and counts lines.
    instruction: |
      You answer questions about the files in the working directory.
      Use the tools to look; never guess. Answer in one sentence that
      names the files and gives the line count.
    max_iterations: 8
    toolsets:
      - type: filesystem
      - type: shell

models:
  local:
    provider: dmr
    model: ai/qwen3:4b
    temperature: 0
```

## Agent keys

**Agent:** one entry under `agents`, named by its key. The first agent of the team runs unless `--agent` names another {{help-agent docker-agent run}}. The schema `AgentConfig` lists the keys, and these are the ones the capture files use or rely on.

| Key | In the capture | Schema rule |
|---|---|---|
| `model` | `local`, `qwen`, `dmr/ai/qwen3`, `openai/gpt-4.1` | a model name or `provider/model` {{schema AgentConfig}} |
| `instruction` | a block string in every file | the system prompt: a string, or a list joined with blank lines |
| `max_iterations` | `8` in `files.yaml`, `3` for `writer` | an integer from 0 |
| `max_consecutive_tool_calls` | not set | identical calls before the agent stops, and 0 means the default of 5 |
| `redact_secrets` | not set | `true` by default: a builtin scrubs secrets on three hook events |
| `toolsets`, `sub_agents`, `handoffs`, `hooks` | `files.yaml`, `team.yaml`, `guarded.yaml` | [toolsets](#s-toolsets-and-mcps), [delegation](#s-sub-agents-transfer-task-and-background-agents), [permissions](#s-permissions-safety-and-hooks) |

## Model references

**Model reference:** the value of `model` on an agent. It takes five forms:

- `provider/model` inline, such as `dmr/ai/qwen3` in `greeter.yaml` {{docs-agent Models}}.
- a name under `models`, such as `local`, with `provider`, `model`, and parameters such as `temperature: 0`.
- a `first_available` list: "At load time, Docker Agent selects the first candidate whose credentials are configured" {{docs-agent Models}}.
- an alloy: two references with a comma between them, which the runtime alternates in one conversation.
- `auto`: "the first cloud provider with a configured credential", then a pulled Model Runner model {{docs-agent Set Up a Model}}.

`run --model [agent=]provider/model` replaces the reference for one run {{help-agent docker-agent run}}. On the recording Mac, `doctor` resolved `auto` to `dmr/docker.io/ai/qwen3:4b` with only the 4B tag pulled (`25-doctor.txt`). With no Model Runner, it named `dmr/ai/qwen3:latest` and reported no usable model (`16-doctor.txt`).

## providers and the Model Runner endpoint

**Provider definition:** an entry under `providers` with an underlying `provider` (default `openai`), a `base_url`, a `token_key`, and defaults that its models inherit {{docs-agent Provider Definitions}}.

```listing
title: a named provider for Docker Model Runner
source: capture/fixtures/agents/dmr.yaml
lang: yaml
note: The agents block is cut.
---
version: "16"

providers:
  runner:
    provider: dmr
    base_url: http://localhost:12434/engines/llama.cpp/v1

models:
  qwen:
    provider: runner
    model: ai/qwen3:4b
    temperature: 0
…
```

`files.yaml` names `provider: dmr` with no `base_url`, and then "Docker Agent auto-discovers the DMR endpoint" {{docs-agent Docker Model Runner}}. It runs `docker model status --json`, which `16-dry-run.txt` prints inside its error when no Docker daemon answers. An eval container has no `docker` CLI, so the same discovery fails there, as [eval](#s-session-db-sessions-diff-and-eval) shows.

With an explicit `base_url`, `dmr.yaml` answered `Hello` (`25-run-dmr.txt`). That run is live in every capture, because an explicit `base_url` bypasses the `--record` proxy and leaves the cassette empty (`capture/README.md`). Set `base_url` when discovery cannot work, and leave it out when you want a cassette.

Provider ids changed too. `doctor` prints `fireworks-ai`, `togetherai`, and `moonshotai`, and the docs Models table lists `fireworks`, `together`, and `moonshot`. This manual prints the ids that `doctor` prints ([conflict C58](#s-ref-sources-and-the-conflicts-register)), and [the providers table](#s-ref-providers-and-models) has the rest. A named patch under `flavors` changes any of these blocks at run time with `--flavor` {{help-agent docker-agent run}}, and the capture ran none.

```figure
id: fig-5-2
kind: structure
title: two ways a model reference reaches Model Runner
claim: `files.yaml` resolves `local` to the `dmr` provider and finds the endpoint itself, while `dmr.yaml` resolves `qwen` through `providers.runner` to a fixed URL.
caption: Read each column top down, from the agent to the endpoint. Violet blocks are agent entries and plum blocks are model and provider entries. The bottom row is the `auto` decision as `doctor` printed it. From capture/fixtures/agents/files.yaml, capture/fixtures/agents/dmr.yaml, capture/out/16-doctor.txt, 16-dry-run.txt, and 25-doctor.txt.
```

```takeaways
- Give every agent file a `version` string and only top-level keys from the schema.
- Name models under `models` so that parameters such as `temperature` live in one place.
- Set `base_url` only when discovery cannot work, because it bypasses `--record`.
- Read the `auto` line of `docker-agent doctor` before you rely on `auto`.
```

Sources: schema agents, AgentConfig (research/sources/agent-schema.json); docs-agent Configuration Overview, Models, Set Up a Model, Provider Definitions, Docker Model Runner (research/sources/docs-docker-agent.md, pages configuration/overview, concepts/models, getting-started/set-up-a-model, providers/custom, providers/dmr); help-agent docker-agent run (research/sources/help-docker-agent.md); conflict C58 (research/conflicts-register.md); capture/README.md; capture/fixtures/agents/files.yaml, dmr.yaml, greeter.yaml; capture/out/16-doctor.txt, 16-dry-run.txt, 16-share-pull-agent.yaml, 25-doctor.txt, 25-run-dmr.txt
