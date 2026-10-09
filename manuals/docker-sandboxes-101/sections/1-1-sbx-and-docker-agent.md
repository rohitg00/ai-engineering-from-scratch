# sbx and docker-agent

> Each binary owns one thing: sbx owns the microVM, its proxy, and its secret store, and docker-agent owns the loop between a model, tools, and sub-agents.

You want a coding agent to work on a repository, but not to read your SSH keys or call any host it likes. Docker gives you two command-line programs for that job, `sbx` and `docker-agent`. A Mac with Docker Desktop also has a third name, `docker agent`, and this section draws the line between all three.

When you finish this section, you can name the owner of each part of a sandboxed run and pick a launch path. You can also tell two agent binaries on one machine apart.

## What sbx owns

**Sandbox:** a microVM that `sbx` creates for one agent. "Every sandbox runs inside a lightweight microVM with its own Linux kernel" {{docs-sbx Isolation layers}}, and it has a private Docker Engine. Inside `m101-demo`, the capture reads Linux 7.0.14 on Ubuntu 26.04.1 and Docker Engine 29.8.1 (capture/out/04-guest.txt). The workspace appears at the same absolute path, and "containers started by the agent never appear in your host's `docker ps`" {{docs-sbx Develop and test locally}}.

**sandboxd:** the host daemon behind every local `sbx` command, reached at `$HOME/Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/sandboxd.sock` (capture/out/02-daemon-status.txt). "You don't need Docker Desktop or Docker Engine to use `sbx`" {{docs-sbx Install Docker Sandboxes}}. You do need a Docker sign-in with `sbx login`, and `sbx diagnose` reports it as `Authentication — authenticated` (capture/out/02-diagnose.txt). [Conflict C15](#s-ref-sources-and-the-conflicts-register) records why both claims hold.

The daemon also runs the proxy, and one of its two log categories is `proxy` {{help-sbx sbx daemon log-level set}}. "All outbound TCP traffic from the sandbox routes through a proxy on your host" {{docs-sbx Architecture}}. On macOS, `sbx secret set` keeps each key in the system Keychain {{docs-sbx Where secrets are stored}}. The proxy adds the key to a request after the request leaves the VM, so the VM sees only the placeholder `proxy-managed` (capture/out/04-env.txt). [The proxy](#s-sbx-policy-log-and-the-proxy) and [secrets](#s-sbx-secret-set-import-and-set-custom) take each one apart, and [figure](#fig-1-1) shows who owns what.

```figure
id: fig-1-1
kind: layers
title: what sbx owns and what docker-agent owns
claim: sbx owns every layer from the daemon to the guest kernel, and docker-agent owns its binary, its files, and the loop inside the guest.
caption: Read each column from the host band down through the dashed hypervisor line. The kernel and engine come from m101-demo in capture/out/04-guest.txt and 04-env.txt. The docker-agent column comes from the run in 27-sandbox-run.txt and 27-inside.txt.
```

```listing
title: the command groups of sbx
source: capture/out/01-help-sbx.txt
lang: text
note: Each group is cut to the commands this part names, and the other groups and the flags are cut.
---
$ sbx --help
Docker Sandboxes creates isolated sandbox environments for AI agents, powered by Docker.
…
Sandbox Commands:
…
  create      Create a sandbox for an agent
  exec        Execute a command inside a sandbox
…
  run         Run an agent in a sandbox
…
Management Commands:
  daemon      Manage sandboxd daemon
  diagnose    Diagnose common issues with your sbx installation
  mcp         Manage MCP servers
  policy      Manage sandbox policies
…
  secret      Manage stored secrets
…
```

## The agents sbx runs

`sbx run` accepts eleven agent names: claude, codex, copilot, cursor, devin, docker-agent, droid, gemini, kiro, opencode, and shell {{help-sbx sbx run}}. `sbx create` has eight of them as subcommands and leaves out copilot, droid, and kiro. Those three moved to public kits, and since v0.43.0 they "can be launched by name again" {{rel-sbx v0.43.0}}. `sbx create docker-agent` also answers to the alias `cagent` {{help-sbx sbx create docker-agent}}. `shell` gives you "a Bash login shell inside a sandbox with no pre-installed agent binary" {{docs-sbx Shell}}. [Conflict C9](#s-ref-sources-and-the-conflicts-register) lists the shorter agent lists in older posts.

## What docker-agent owns

**Agent file:** a YAML file that names agents, their models, their toolsets, and the rules between them. Docker Agent is "an open-source framework for building teams of specialized AI agents" {{docs-agent Docker Agent}}. Its `run` command drives the loop: a model call, the tool calls the model asks for, and the sub-agents it delegates to. [The agent loop lesson](phases/14-agent-engineering/01-the-agent-loop) explains that loop, and [Part 6](#p-6) serves and shares the same file.

The `docker-agent` binary isolates nothing by itself. On the host, its `shell` toolset runs commands "in the user's environment" (capture/out/16-toolsets.txt).

```listing
title: the command groups of docker-agent
source: capture/out/01-help-docker-agent.txt
lang: text
note: Cut to the core group and four of the advanced commands. The diagnose group, the other commands, and the flags are cut.
---
$ docker-agent --help
Docker AI Agent Runner.
…
Core Commands:
  getting-started Learn docker agent with a hands-on interactive tour
  run             Run an agent
  setup           Interactively set up a model (built-in provider, local, custom endpoint, or Claude Code)
  share           Share agents
…
Advanced Commands:
…
  eval            Run evaluations for an agent
…
  sandbox         Manage docker-agent sandbox settings
  serve           Start an agent as a server
  sessions        Inspect recorded sessions
…
```

## Two launch paths

`sbx run docker-agent ~/my-project` starts from sbx. The sandbox uses `docker/sandbox-templates:docker-agent` and runs `docker-agent run --yolo` when you pass no arguments {{docs-sbx Docker Agent}}. Only project-level configuration in the workspace reaches it.

`docker-agent run --sandbox agent.yaml` starts from your agent file. Here `docker-agent` "orchestrates the installed `sbx` CLI" {{docs-agent Sandbox Mode}}, and `--template` defaults to `docker/docker-agent-sbx-templates:latest` {{help-agent docker-agent run}}. Two paths use two images, as [conflict C61](#s-ref-sources-and-the-conflicts-register) rules. The capture kit recorded only the second path, and [the next section](#s-docker-agent-run-sandbox-end-to-end) follows it.

```figure
id: fig-1-2
kind: comparison
title: two ways to start docker-agent in a sandbox
claim: Both paths end with docker-agent in a microVM, but sbx run starts from a template image and docker-agent run --sandbox starts from your agent file.
caption: Read across each row. Path A comes from the docs page Docker Agent under docs-sbx, because no capture runs it. Path B comes from capture/out/27-sandbox-run.txt and 27-inside.txt.
```

## Two agent binaries on one machine

Docker Desktop 4.94.0 bundles "Docker Agent v1.144.0" {{docs-desktop 4.94.0}} as the CLI plugin `docker agent`. Homebrew installs v1.149.0 as `docker-agent`, which the docs say "can be used as a standalone binary" {{docs-agent Docker Agent}}.

```listing
title: two agent binaries on the capture Mac
source: capture/out/29-docker-agent-plugin.txt
lang: text
note: Nothing is cut.
---
$ docker agent version
docker agent version v1.144.0
Commit: 3873760f47ecf22f72f65bd776c056a337d6f35c
[exit 0]

$ docker-agent version
docker-agent version v1.149.0
Commit: Homebrew
[exit 0]
```

The hints that v1.149.0 prints still say `docker agent sandbox allow <host>` (capture/out/16-sandbox-list.txt), and on this Mac that command runs v1.144.0. This manual writes `docker-agent` in every command and pins v1.149.0, as [conflict C48](#s-ref-sources-and-the-conflicts-register) rules. A third build runs inside the sandbox template, as [the next section](#s-docker-agent-run-sandbox-end-to-end) shows.

The same plugin list holds `sandbox v0.13.0`, and `docker sandbox` prints only its removal notice (capture/out/29-docker-sandbox.txt). [The migration section](#s-from-docker-sandbox-and-cagent-to-sbx-and-docker-agent) maps its commands. The list also holds `ai v1.31.0`, the plugin behind `docker ai`, which the docs call Gordon, "Docker's built-in AI assistant" {{docs-agent Docker Agent}}. Gordon is outside this manual.

```takeaways
- Install `sbx`, sign in with `sbx login`, and run sandboxes without Docker Desktop.
- Type `docker-agent`, and check `docker agent version` before you follow a hint that names `docker agent`.
- Start with `sbx run docker-agent` for a template run, or `docker-agent run --sandbox` for your own agent file.
```

Sources: help-sbx sbx run, sbx create, sbx create docker-agent, sbx daemon log-level set (research/sources/help-sbx.md); help-agent docker-agent run (research/sources/help-docker-agent.md); docs-sbx Isolation layers, Develop and test locally, Install Docker Sandboxes, Architecture, Where secrets are stored, Shell, Docker Agent (research/sources/docs-sandboxes.md); docs-agent Docker Agent, Sandbox Mode (research/sources/docs-docker-agent.md); docs-desktop 4.94.0 (research/sources/docs-desktop-release-notes.md); rel-sbx v0.43.0 (research/sources/sbx-releases.md); research/conflicts-register.md rows C9, C15, C48, C61, C72; capture/out/01-help-sbx.txt, 01-help-docker-agent.txt, 02-daemon-status.txt, 02-diagnose.txt, 04-env.txt, 04-guest.txt, 16-sandbox-list.txt, 16-toolsets.txt, 27-sandbox-run.txt, 27-inside.txt, 29-docker-agent-plugin.txt, 29-docker-plugins.txt, 29-docker-sandbox.txt
