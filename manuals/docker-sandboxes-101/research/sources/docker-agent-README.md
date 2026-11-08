# 🤖 Docker Agent 🤖

> Build, run, and share AI agents with a declarative YAML config, rich tool ecosystem, and multi-agent orchestration.

![docker agent in action](docs/demo.gif)

## What is Docker Agent?

`docker-agent` lets you create and run intelligent AI agents that collaborate to solve complex problems — no code required.

`docker-agent` is a `docker` CLI plugin and can be run with `docker agent`.

Define agents in YAML, give them tools, and let them work.

```yaml
agents:
  root:
    model: openai/gpt-5-mini
    description: A helpful AI assistant
    instruction: |
      You are a knowledgeable assistant that helps users with various tasks.
      Be helpful, accurate, and concise in your responses.
    toolsets:
      - type: mcp
        ref: docker:duckduckgo
```

```sh
docker agent run agent.yaml
```

## Key Features

- **Multi-agent architecture** — Create teams of specialized agents that delegate tasks automatically
- **Rich tool ecosystem** — Built-in tools + any [MCP](https://modelcontextprotocol.io/) server (local, remote, or Docker-based)
- **AI provider agnostic** — OpenAI, Anthropic, Gemini, AWS Bedrock, Mistral, xAI, [Docker Model Runner](https://docs.docker.com/ai/model-runner/), and more
- **YAML configuration** — Declarative, versionable, shareable
- **Advanced reasoning** — Built-in think, todo, and memory tools
- **RAG** — Pluggable retrieval with BM25, embeddings, hybrid search, and reranking
- **Package & share** — Push agents to any OCI registry, pull and run them anywhere

## Install

**Docker Desktop** (4.63+) — docker-agent CLI plugin is pre-installed. Just run `docker agent`.

**Homebrew** — `brew install docker-agent`. Run `docker-agent` directly or symlink the binary to `~/.docker/cli-plugins/docker-agent` and run `docker agent`.

**Binary releases** — Download from [GitHub Releases](https://github.com/docker/docker-agent/releases). Symlink the `docker-agent` binary to `~/.docker/cli-plugins/docker-agent` to be able to use `docker agent`, or use `docker-agent` directly.

Set at least one API key (or use [Docker Model Runner](https://docs.docker.com/ai/model-runner/) for local models):

```sh
export OPENAI_API_KEY=sk-...        # or ANTHROPIC_API_KEY, GOOGLE_API_KEY, etc.
```

See [Set Up a Model](https://docker.github.io/docker-agent/getting-started/set-up-a-model) for the full walkthrough of both paths (cloud API key or local model).

## Quick Start

```sh
# Run the default agent
docker agent run

# Run from an OCI registry
docker agent run myorg/agent:tag

# Generate a new agent interactively
docker agent new

# Run your own config
docker agent run agent.yaml
```

More examples in the [`examples/`](examples/README.md) directory.

## Documentation

📖 **[Full documentation](https://docker.github.io/docker-agent/)**

- [Installation](https://docker.github.io/docker-agent/getting-started/installation) · [Set Up a Model](https://docker.github.io/docker-agent/getting-started/set-up-a-model) · [Quick Start](https://docker.github.io/docker-agent/getting-started/quickstart)
- [Agents](https://docker.github.io/docker-agent/concepts/agents) · [Models](https://docker.github.io/docker-agent/concepts/models) · [Tools](https://docker.github.io/docker-agent/concepts/tools) · [Multi-Agent](https://docker.github.io/docker-agent/concepts/multi-agent)
- [Configuration Reference](https://docker.github.io/docker-agent/configuration/overview)
- [TUI](https://docker.github.io/docker-agent/features/tui) · [CLI](https://docker.github.io/docker-agent/features/cli) · [MCP Mode](https://docker.github.io/docker-agent/features/mcp-mode) · [RAG](https://docker.github.io/docker-agent/tools/rag)
- [Model Providers](https://docker.github.io/docker-agent/providers/overview) · [Docker Model Runner](https://docker.github.io/docker-agent/providers/dmr)

## Contributing

Read the [Contributing guide](https://docker.github.io/docker-agent/community/contributing) to get started. We use `docker-agent` to build `docker-agent`:

```sh
docker agent run ./golang_developer.yaml
```

## Telemetry

We collect anonymous usage data to improve the tool. See [Telemetry](https://docker.github.io/docker-agent/community/telemetry).

## Community

[Docker Community Slack](http://dockr.ly/comm-slack) · [#docker-agent channel](https://dockercommunity.slack.com/archives/C09DASHHRU4)
