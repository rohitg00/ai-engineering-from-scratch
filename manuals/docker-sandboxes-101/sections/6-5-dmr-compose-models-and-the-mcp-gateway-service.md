# DMR, Compose models, and the docker/mcp-gateway service

> A local model is an unauthenticated OpenAI-compatible endpoint on port 12434, Compose binds it to a service as two variables, and four things named gateway stay distinct.

Every model call in Part 5 and in this part ran with no API key and no cloud account. The model was `ai/qwen3:4b` on Docker Model Runner, on the same Mac as the agent.

When you finish this section, you can reach the runner from the host, a container, and a sandbox, and give it to a Compose service.

## Docker Model Runner on port 12434

**Docker Model Runner (DMR):** the Docker component that pulls models from Docker Hub, an OCI registry, or Hugging Face {{docs-dmr Docker Model Runner}}. It serves them over OpenAI, Anthropic, and Ollama compatible APIs {{docs-dmr DMR REST API}}. Since Desktop 4.71.0, "Docker Model Runner is now disabled by default and must be explicitly enabled in Settings" {{docs-desktop 4.71.0}}. `docker desktop enable model-runner --tcp <port>` turns on host TCP {{docs-dmr DMR REST API}}, and the capture used port 12434.

```listing
title: the runner as docker model status --json reports it
source: capture/out/25-model-status.json
lang: json
note: The other backends are cut.
---
{
  "running": true,
  "backends": {
…
    "llama.cpp": "Running: llama.cpp b9879-metal (sha256:<digest>) 72874f5",
…
  },
  "kind": "Docker Desktop",
  "endpoint": "http://model-runner.docker.internal/v1/",
  "endpointHost": "http://localhost/exp/vDD4.40/v1/"
}
```

"The Model Runner API is not authenticated" {{docs-dmr Docker Model Runner}}. Any client that reaches the port can pull, load, and run models. The base URL depends on where the caller runs, and [figure](#fig-6-5) maps the five that this manual met:

| Caller | Base URL | Evidence |
|---|---|---|
| a process on the host | `http://localhost:12434` | capture/out/25-models.json |
| a container on Docker Desktop | `http://model-runner.docker.internal` | capture/out/26-compose-up.txt |
| a container on Docker Engine | `http://172.17.0.1:12434` | {{docs-dmr DMR REST API}}, not captured |
| a process on the host, through the Docker socket | `http://localhost/exp/vDD4.40` | capture/out/25-model-status.json, `endpointHost` |
| `docker-agent` inside a sandbox, through its proxy | `http://host.docker.internal:12434` | capture/out/27-inside-run.txt |

After the base URL, the OpenAI paths sit under `/engines/v1/`, and `/engines/llama.cpp/v1/` names the engine {{docs-dmr DMR REST API}}. The Anthropic table lists `/anthropic/v1/messages`, while its examples call `/v1/messages` ([conflict C79](#s-ref-sources-and-the-conflicts-register)). No capture tested either path. Ollama clients use `/api/`. The capture also met the `/v1/` root, which `status` reports as `endpoint`.

```figure
id: fig-6-5
kind: structure
title: five base URLs for one Docker Model Runner
claim: Five callers reach the same runner through five base URLs, and every path after them is open to any client that reaches the port.
caption: Read each row left to right, from the caller to the runner. The dashed caller comes from the docs and was not captured. The paths on the right follow any base URL. From capture/out/25-model-status.json, 25-models.json, 26-compose-up.txt, capture/fixtures/agents/files-sandbox.yaml, and research/sources/docs-model-runner.md.
```

The 8B tag `ai/qwen3:latest` failed to pull on the recording Mac, as [docker-agent run, new, and doctor](#s-docker-agent-run-new-and-doctor) explains (capture/out/25-model-pull-latest.txt). With only the 4B tag pulled, `doctor` resolves `auto` to `dmr/docker.io/ai/qwen3:4b` (capture/out/25-doctor.txt). "By default model-runner unloads idle models after a few minutes" {{docs-agent Docker Model Runner}}, and `provider_opts.keep_alive` changes that time. `provider_opts.context_size` sets the context window through the runner's `_configure` endpoint {{docs-agent Docker Model Runner}}. No capture ran `docker model configure`, so [conflict C77](#s-ref-sources-and-the-conflicts-register) stays open.

An agent file can also name the runner in a `providers:` block. `fixtures/agents/dmr.yaml` sets `base_url: http://localhost:12434/engines/llama.cpp/v1`, and its run answered `Hello` (capture/out/25-run-dmr.txt). An explicit `base_url` bypasses the `--record` proxy, so that run is live on every capture (capture/README.md).

## Compose models

```listing
title: the Compose file of the capture
source: capture/fixtures/compose/compose.yaml
lang: yaml
note: The command of printer is cut.
---
name: m101

models:
  llm:
    model: ai/qwen3:4b

services:
  mcp-gateway:
    image: docker/mcp-gateway
    use_api_socket: true
    command: ["--transport=streaming", "--port=8811"]

  printer:
    image: alpine:3.22
    depends_on: [mcp-gateway]
    models:
      llm:
        endpoint_var: LLM_URL
        model_var: LLM_MODEL
…
```

**models:** the top-level Compose element that declares a model, which a service binds by name. The short syntax derives `LLM_URL` and `LLM_MODEL` from the name `llm`, and `endpoint_var` and `model_var` choose the names. Compose v2.38 or later is required (research/sources/docs-compose-models.md). `docker compose up` pulled and configured the model before it started a container:

```listing
title: the model step and what printer saw
source: capture/out/26-compose-up.txt
lang: text
note: The container steps, the gateway log, and the exit lines are cut.
---
 llm Pulling
 llm Pulled
 llm Configuring
 llm Configured
…
printer-1 | LLM_MODEL=ai/qwen3:4b
printer-1 | LLM_URL=http://model-runner.docker.internal/v1/
printer-1 | {"object":"list","data":[{"id":"docker.io/ai/qwen3:4b","object":"model","created":0,"owned_by":"docker","dmr":{}}]}
printer-1 | wget: server returned error: HTTP/1.1 401 Unauthorized
```

Compose injected the `/v1/` root, where the plan, read from the model-runner source, expected `/engines/v1/`. `GET ${LLM_URL}models` answered from inside the container all the same. Compose cannot start sandboxes ([conflict C96](#s-ref-sources-and-the-conflicts-register)), and no capture ran `models:` on the private engine inside a sandbox ([conflict C95](#s-ref-sources-and-the-conflicts-register)).

## The docker/mcp-gateway service

The `mcp-gateway` service runs the open source MCP gateway with the host's Docker API socket, so that it can start MCP servers as containers. In the capture it found no profile and no server, listed 0 tools, and added its own management tools such as `mcp-find` and `mcp-add`. It printed `Gateway URL: http://localhost:8811/mcp` and a bearer token, and the request of `printer` without that token got 401 (capture/out/26-compose-up.txt). [Figure](#fig-6-6) draws the stack.

```figure
id: fig-6-6
kind: flow
title: the capture compose.yaml with a model and a gateway
claim: Compose pulls the model, injects two variables into printer, and runs the gateway with the API socket, which refuses a request without its bearer token.
caption: Read from the models element at the top left. Solid ink arrows are calls and the dashed rose arrow is the refused request. From capture/fixtures/compose/compose.yaml and capture/out/26-compose-config.txt and 26-compose-up.txt.
```

## Four things named gateway

| Name in this manual | What it is | Address in the captures |
|---|---|---|
| models gateway | the address set by `--models-gateway` or `DOCKER_AGENT_MODELS_GATEWAY`, to "Route all provider traffic through a models gateway URL" {{docs-agent A2A Protocol}} | `http://localhost:12434/engines`, which `--record` with `dmr` needs (capture/README.md) |
| sbx MCP gateway | one host-side gateway per sandbox, set up by `sbx mcp`, separate from the MCP Toolkit {{docs-sbx MCP gateway}} | `http://mcp-gateway.docker.internal/mcp` inside the VM |
| MCP gateway service | `docker mcp gateway run` or the `docker/mcp-gateway` image, mcp v0.44.1 on the recording host | `http://localhost:8811/mcp` inside the service |
| hosted MCP gateway | the gateway of Docker AI Governance, "an invite-only feature" {{docs-mcp MCP Gateway}} | not captured |

The Toolkit gateway runs each MCP server in its own container. "Containers for MCP tools are limited to 2 GB" {{docs-mcp MCP Toolkit}}, and each one gets 1 CPU. A docker-agent toolset with `ref: docker:<name>` takes that route, to "Run MCP servers as secure Docker containers via the MCP Gateway" {{docs-agent MCP Tool}}. The sbx MCP gateway is [sbx mcp add, sbx mcp load, and --static-mcp](#s-sbx-mcp-add-load-and-static-mcp), and [the MCP gateways lesson](phases/13-tools-and-protocols/17-mcp-gateways-and-registries) covers the pattern.

```takeaways
- Enable host TCP for Docker Model Runner before an agent on the host calls `dmr`.
- Keep port 12434 off networks you do not trust, because the runner checks no credentials.
- Read `LLM_URL` inside the service, never a path you typed by hand.
- Say which gateway you mean: models, sbx MCP, MCP service, or hosted.
```

Sources: docs-dmr Docker Model Runner, DMR REST API, Get started (research/sources/docs-model-runner.md); docs-desktop 4.71.0 (research/sources/docs-desktop-release-notes.md); docs-agent Docker Model Runner, A2A Protocol, MCP Tool (research/sources/docs-docker-agent.md); docs-mcp MCP Gateway, MCP Toolkit (research/sources/docs-mcp.md); docs-sbx MCP gateway (research/sources/docs-sandboxes.md); research/sources/docs-compose-models.md; research/sources/mcp-gateway-README.md; research/conflicts-register.md rows C77, C79, C82, C84, C88, C91, C94, C95, C96; research/plan.md, Part 6; capture/README.md; capture/fixtures/agents/dmr.yaml, files-sandbox.yaml; capture/fixtures/compose/compose.yaml; capture/out/25-model-status.json, 25-models.json, 25-model-ls.txt, 25-model-pull-latest.txt, 25-doctor.txt, 25-run-dmr.txt, 26-compose-config.txt, 26-compose-up.txt, 26-compose-down.txt, 27-inside-run.txt, 11-static-inside.txt
