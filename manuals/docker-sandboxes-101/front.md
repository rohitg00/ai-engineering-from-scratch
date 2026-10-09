# How to read this manual

> Every command output in this manual comes from one recorded run of sbx and docker-agent on one Mac, and every rule traces to a ranked source.

This manual explains Docker Sandboxes, the `sbx` CLI at v0.47.0, and Docker Agent, the `docker-agent` CLI at v1.149.0. It follows one task from start to end: run an agent you do not trust on files you do.

## Who this manual is for

You run coding agents such as Claude Code or Codex on real repositories, and you know Docker, git, and YAML. You have not used Docker Sandboxes or Docker Agent.

After the last part, you can:

- Run a coding agent inside a sandbox, give it only the files it needs, and get its commits back without giving it your credentials.
- Read one line of `sbx policy log` and say which rule allowed or blocked the connection, and what to change.
- Write an agent file that runs a team of agents over local tools and a local model, record it, and replay it from a cassette.
- Serve the same agent file over the HTTP API, MCP, ACP, and A2A, and share it as a signed OCI artifact.
- Map any command from the 2025 Docker Sandboxes plugin or the cagent material to its current form.

[The sandbox lesson](phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust) explains when a task needs a process, a container, or a microVM boundary. This manual starts where that lesson stops, with two products that build the microVM boundary.

## How it was made

The manual pins `sbx` v0.47.0 at commit `0411f50e`, released 2026-10-05, and `docker-agent` v1.149.0 at tag commit `bf4169c`, released 2026-10-07. The facts were verified on 2026-10-08. `sbx` is a proprietary binary with no public source, so its help text ranks first.

Facts come from seven sources, ranked by authority. When two of them disagree, the higher one wins and the text says so.

| Rank | Source | What the manual takes from it | Cited as |
|---|---|---|---|
| 1 | the help text of `sbx` 0.47.0 and `docker-agent` 1.149.0, as the binaries print it | every command, flag, default, and path | `help-sbx` or `help-agent` and a command |
| 2 | `agent-schema.json` at v1.149.0 | every key, type, and default of the agent file | `schema` and a definition |
| 3 | the Sandbox Kit Spec v3 at tag v3.0.0-m.8 | the kit descriptor and each capability | `kitspec` or `kitcap` and a section or a capability |
| 4 | the Docker documentation, fetched 2026-10-08 | rules and limits that the help text does not state | `docs-sbx`, `docs-agent`, `docs-dmr`, `docs-mcp`, or `docs-desktop` and a page |
| 5 | the release notes of `sbx` and the `docker-agent` changelog | when a behaviour appeared, changed, or went away | `rel-sbx` or `rel-agent` and a version |
| 6 | Docker blog posts and talks | history and positioning, never a rule | `blog` or `talk` and a date |
| 7 | the capture kit in `capture/` | every command output, file, and record shown | the capture file name |

Sources 1 to 5 are vendored under `research/sources/`, so the audit checks each quote word for word. Blog posts and talks are not vendored, and their quotes are not checked.

The sources disagree in many places. The largest are the kit generations ([conflict C13](#s-ref-sources-and-the-conflicts-register)) and the agent names and template image of each launch path ([C9 and C61](#s-ref-sources-and-the-conflicts-register)). Others are host secrets that `sbx` never injects ([C7](#s-ref-sources-and-the-conflicts-register)) and the two agent binaries on one Mac ([C48](#s-ref-sources-and-the-conflicts-register)). [The sources reference](#s-ref-sources-and-the-conflicts-register) lists every conflict with the ruling this manual prints.

## The capture kit

The capture kit drives the real `sbx`, `docker-agent`, and `docker` binaries and writes what they print to `capture/out/`. It masks the values that change on every run, uses the Python standard library only, and has three recorded tiers:

| Tier | What it needs | What it records |
|---|---|---|
| A | `sbx`, `docker-agent`, and the `docker` client installed, with no daemon, network, model, or key | versions, root help, `docker-agent doctor`, `toolsets`, `models list`, a dry run, and the legacy Desktop commands (files 00, 01, 16, 29) |
| B | `sbx` signed in, the sandboxd daemon, image pulls from Docker Hub, and HTTPS to `example.com` and `mcp.deepwiki.com` | the sandbox lifecycle, ports, `cp`, templates, `--clone`, policy, secrets, MCP, kits, `env plan`, and skills (files 02 to 15) |
| M | Docker Desktop 4.94.0 with Docker Model Runner on TCP port 12434 and `ai/qwen3:4b` pulled, plus containers, Compose, buildx, and a local registry | agent runs, teams, permissions, sessions, eval, five servers, `share`, Model Runner, Compose, `run --sandbox`, and the v3 kit build (files 17 to 28, 98) |

The kit was recorded on one Mac with macOS 26.2 on Apple silicon. It ran `sbx` v0.47.0, `docker-agent` v1.149.0, Docker Desktop 4.94.0, and Docker Model Runner with `ai/qwen3:4b`. The documented default model, `ai/qwen3:latest`, failed twice to pull on that Mac with a digest mismatch (capture/out/25-model-pull-latest.txt). Every agent file therefore names the 4B tag of the same repository.

This kit cannot run offline in CI. `sbx` starts real microVMs from images on Docker Hub after a Docker sign-in, and the agent runs need a model. Where the tools are absent, `python3 capture/run.py --check` prints `skipped` with the reason and exits 0. Tier C needs Cloud Sandboxes, a GitHub token, or a change to `~/.ssh/config`. It is not recorded, and the sections that need it cite the docs.

Most runs of tier M replay a recorded cassette with `--fake`, so a check compares like with like. The eval, three of the servers, one run with an explicit `base_url`, and `run --sandbox` call the model live with `temperature: 0`. [The kit README](manuals/docker-sandboxes-101/capture/README.md) lists what the recorded run showed that the docs did not say.

## Conventions

`docker-agent` names the Homebrew binary, v1.149.0, in every command. `docker agent` names the Docker Desktop plugin, v1.144.0 on the capture Mac, and appears only where a program prints it.

`$CAPTURE` stands for the capture directory and `$HOME` for the home directory. Values that change on every run appear as tokens such as `<uuid>`, `<hash>`, `<ts>`, and `<port>`. The command lines of tier M leave out `--config-dir`, `--data-dir`, and `--cache-dir`, which point at `capture/work/`.

Citations name a place: {{help-sbx sbx run}} a command in the help text, {{schema AgentConfig}} a definition in the schema, and {{kitspec §3.4}} a section of the kit spec. A docs citation such as {{docs-sbx Network access policies}} names a page or heading, and {{rel-sbx v0.43.0}} names a release. A listing copies lines from a capture file unchanged, and a `…` marks a cut that the note explains.

Figures animate on the web, where a Replay button runs the steps again, and print and reduced motion show the final frame.

## A first run

You need `sbx` v0.47.0, a Docker sign-in with `sbx login`, and a global network policy, which you set once. The capture set it to the balanced preset:

```listing
title: the global policy, set once
source: capture/out/03-policy-init.txt
lang: text
note: Nothing is cut.
---
$ sbx policy init balanced
Global network policy initialized to "balanced".
[exit 0]
```

Then make a scratch directory and open a shell sandbox on it:

```bash
mkdir -p ~/sbx-scratch
sbx run shell ~/sbx-scratch
```

`sbx run shell` gives you a Bash login shell in a new sandbox, named `shell-sbx-scratch` after the default `<agent>-<workdir>` {{help-sbx sbx run}}. Inside, `pwd` prints the same path as on your host. Leave the shell, then list the sandbox and remove it:

```bash
sbx ls
sbx rm --force shell-sbx-scratch
```

The capture made its own shell sandbox with `sbx create`, which prints this summary:

```listing
title: the summary of a new shell sandbox
source: capture/out/04-create.txt
lang: text
note: The image layers are masked as <layers>, and the closing hint is cut.
---
$ sbx create shell $CAPTURE/fixtures/repo --name m101-demo

sandbox    m101-demo
agent      shell
workspace  $CAPTURE/fixtures/repo (rw)
image      docker/sandbox-templates:shell-docker
cpu        10
memory     32 GiB

Pulling image
  <layers>
✓ Image ready
✓ Created sandbox m101-demo
…
```

For the agent side, turn on Docker Model Runner with host TCP on port 12434 and pull the model with `docker model pull ai/qwen3:4b`. Save this agent file as `dmr.yaml`:

```listing
title: an agent on a local model
source: capture/fixtures/agents/dmr.yaml
lang: yaml
note: Nothing is cut.
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

agents:
  root:
    model: qwen
    description: Answers with one word.
    instruction: Reply with exactly one word.
```

Run `docker-agent doctor` first. It finds the runner and the model:

```listing
title: the doctor with Model Runner reachable
source: capture/out/25-doctor.txt
lang: text
note: Cut to the Model Runner and model selection blocks.
---
…
Docker Model Runner
  Status: reachable, 1 model(s) pulled:
    - docker.io/ai/qwen3:4b

Model auto-selection
  auto -> dmr/docker.io/ai/qwen3:4b
…
```

Then run the agent without the terminal interface:

```listing
title: one answer from the local model
source: capture/out/25-run-dmr.txt
lang: text
note: Nothing is cut. The capture passes the file by its path under fixtures/agents.
---
$ docker-agent run --exec --last fixtures/agents/dmr.yaml 'Say hello.'
Hello
[exit 0]
```

Open capture/out/27-sandbox-run.txt next. It is the same kind of agent run inside a sandbox, and [the end-to-end section](#s-docker-agent-run-sandbox-end-to-end) reads it line by line.

## How the parts are ordered

Part 1 puts both products on one page. Parts 2 to 4 take `sbx` apart: the sandbox and its daemon, the isolation layers, and kits with environment files. Parts 5 and 6 take `docker-agent` apart: the agent file and its run, then the served and shared agent. Part 7 covers operation, and the Reference holds the lookup tables:

```parts
```

## Colour in figures

Each hue keeps one meaning in every figure:

```palette
```

[Figure](#fig-0-1) teaches the eight arrow styles with exchanges from the capture.

```figure
id: fig-0-1
kind: sequence
title: reading a sequence figure in this manual
claim: Each of the eight arrow styles marks one kind of exchange, and every label is a real command, rule, status, or event name from the capture.
caption: Read each numbered row from the tail of the arrow to its head, and the note under each label names the style. Rows 1 to 7 come from capture/out/09-blocked.txt, 09-allow.txt, and 09-allowed.txt. Rows 8 and 9 come from 27-inside-run.txt and the cassette 18-files, and row 10 from 04-auto-stop.txt.
```

The model call in row 8 passes through the proxy, which [figure](#fig-1-3) draws as a separate hop.

Sources: help-sbx sbx run (research/sources/help-sbx.md); manual.json; research/sources/README.md; research/plan.md; research/conflicts-register.md rows C7, C9, C13, C48, C61; capture/README.md, capture/run.py; capture/fixtures/agents/dmr.yaml; capture/cassettes/18-files.yaml.gz; capture/out/README.md, 00-versions.txt, 03-policy-init.txt, 04-auto-stop.txt, 04-create.txt, 04-workspace.txt, 09-allow.txt, 09-allowed.txt, 09-blocked.txt, 25-doctor.txt, 25-model-ls.txt, 25-model-pull-latest.txt, 25-run-dmr.txt, 27-inside-run.txt, 27-sandbox-run.txt, 29-docker-agent-plugin.txt
