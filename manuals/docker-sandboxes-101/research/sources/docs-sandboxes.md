<!-- vendored source: Docker Sandboxes docs; origin https://docs.docker.com/ai/sandboxes/; fetched 2026-10-08; each page is the raw markdown served at the page URL with .md appended; page text is verbatim, only the page marker lines are added -->

<!-- page: https://docs.docker.com/ai/sandboxes/ fetched 2026-10-08 -->

# Docker Sandboxes


Docker Sandboxes run AI coding agents in isolated environments on your machine
or on Docker-managed cloud infrastructure. Use the `sbx` CLI to create and
manage either kind of sandbox.

The `sbx` CLI and local sandbox compute are free to use, including for commercial
work. Cloud compute uses a
[pay-as-you-go subscription](/agentic-platform/signup/#billing).
Model-provider charges are separate.

Organization admins can
[centrally manage sandbox network, filesystem, and MCP policies](/ai/sandboxes/governance/access-controls/organization/),
for local sandboxes across developer machines.
Available on a separate paid subscription.

## Get started

[Install the `sbx` CLI](/ai/sandboxes/install/) and sign in, then choose where to run your
agent:

| Environment | Use it for | Start here |
| --- | --- | --- |
| Local sandboxes | Work with files and supported hardware on your machine | [Get started locally](/ai/sandboxes/get-started/) |
| Cloud sandboxes | Run on Docker-managed compute without local virtualization | [Get started in the cloud](/ai/sandboxes/cloud/#get-started) |

The two environments have separate credentials, network policies, and lifecycle
controls. See [Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/)
before adapting a workflow.

To create and manage cloud sandboxes from your application, see
[Sandboxes API and SDK](/ai/sandboxes-api/).

## Learn more

The following guides describe local sandbox workflows. For cloud workflows,
see [Cloud sandboxes](/ai/sandboxes/cloud).

- [Agents](/ai/sandboxes/agents) — supported agents and per-agent configuration
- [Workflows](/ai/sandboxes/workflows) — patterns for Git, local development,
  authentication, agent skills, and automation
- [Configuration](/ai/sandboxes/configuration) — manage credentials, declare project
  environments, turn on GPU passthrough, and configure an upstream proxy
- [Integrations](/ai/sandboxes/integrations) — connect editors and apps like VS Code and
  Cursor to a sandbox over SSH
- [MCP gateway](/ai/sandboxes/mcp-gateway/) — register MCP servers and connect them to
  sandboxed agents
- [Kits](/ai/sandboxes/customize) — package tools and configuration into reusable
  sandbox environments
- [Architecture](/ai/sandboxes/architecture/) — microVM isolation, workspace mounting,
  networking
- [Security](/ai/sandboxes/security) — isolation model, credential handling, and
  network policies
- [CLI reference](/reference/cli/sbx/) — full list of `sbx` commands and options
- [Troubleshooting](/ai/sandboxes/troubleshooting/) — common issues and fixes
- [FAQ](/ai/sandboxes/faq/) — login requirements, telemetry, etc

## Feedback

Your feedback shapes what gets built next. If you run into a bug, hit a
missing feature, or have a suggestion, open an issue at
[github.com/docker/sbx-releases/issues](https://github.com/docker/sbx-releases/issues).

<!-- page: https://docs.docker.com/ai/sandboxes/agents/ fetched 2026-10-08 -->

# Supported agents


Docker Sandboxes runs the following agents in local sandboxes:

- [Claude Code](/ai/sandboxes/agents/claude-code)
- [Codex](/ai/sandboxes/agents/codex)
- [Copilot](/ai/sandboxes/agents/copilot)
- [Cursor](/ai/sandboxes/agents/cursor)
- [Devin](/ai/sandboxes/agents/devin)
- [Docker Agent](/ai/sandboxes/agents/docker-agent)
- [Droid](/ai/sandboxes/agents/droid)
- [Gemini](/ai/sandboxes/agents/gemini)
- [Kiro](/ai/sandboxes/agents/kiro)
- [OpenCode](/ai/sandboxes/agents/opencode)
- [Shell](/ai/sandboxes/agents/shell) — agent-less sandbox for manual setup or testing

Want to pre-install tools or customize an agent's environment?
See [Customize](/ai/sandboxes/customize).

<!-- page: https://docs.docker.com/ai/sandboxes/agents/claude-code/ fetched 2026-10-08 -->

# Claude Code


The following instructions apply to local sandboxes. For cloud authentication
and usage, see [Authenticate cloud agents](/ai/sandboxes/agents/cloud/credentials/) and
[Use cloud sandboxes](/ai/sandboxes/agents/cloud/usage/).

Official documentation: [Claude Code](https://code.claude.com/docs)

## Quick start

Launch Claude Code in a sandbox by pointing it at a project directory:

```console
$ sbx run claude ~/my-project
```

To start Claude with a specific prompt in the current directory:

```console
$ sbx run --name my-sandbox claude -- "Add error handling to the login function"
```

Everything after `--` is passed directly to Claude Code. You can also pipe in a
prompt from a file with `-- "$(cat prompt.txt)"`.

To create a [mountless sandbox](/ai/sandboxes/agents/usage/#choose-a-workspace), use
`sbx create` without a workspace path, then attach by name.

## Authentication

For the default Anthropic models, Claude Code requires either an Anthropic
API key or a Claude subscription. For other models, see
[Use a local model](#use-a-local-model).

**API key**: Store your key using
[stored secrets](/ai/sandboxes/agents/configuration/credentials/#stored-secrets):

```console
$ sbx secret set anthropic
```

**Claude subscription**: If no API key is set, use the `/login` command inside
Claude Code to authenticate via OAuth.

## Configuration

Sandboxes don't pick up user-level configuration from your host, such as
`~/.claude`. Only project-level configuration in the working directory is
available inside the sandbox. See
[Why doesn't the sandbox use my user-level agent configuration?](/ai/sandboxes/agents/faq/#why-doesnt-the-sandbox-use-my-user-level-agent-configuration)
for workarounds.

### Remote control

To use Claude Code's `/remote-control` command inside a sandbox, turn on
[`claude.remoteControl`](/ai/sandboxes/agents/configuration/settings/#clauderemotecontrol):

```console
$ sbx settings set claude.remoteControl true
```

### Default startup command

Without extra args, the sandbox runs:

```text
claude --dangerously-skip-permissions
```

Arguments after `--` are added after the default flags when the first one is
itself a flag (begins with `-`), so `--dangerously-skip-permissions` is
preserved:

```console
$ sbx run --name <sandbox-name> -- -c   # runs claude --dangerously-skip-permissions -c
```

When the first argument is a bare word, such as the `agents` subcommand, it
replaces the defaults instead.

See the [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)
for available options.

## Agents view

Claude Code's [agents view](https://code.claude.com/docs/en/agent-view)
starts background sessions that run tasks in parallel. Pair it with
[clone mode](/ai/sandboxes/agents/workflows/git/#clone-mode) to keep their changes inside the
sandbox:

```console
$ sbx run --clone claude . -- agents
```

This invocation replaces the
[default startup command](#default-startup-command), so it doesn't
include `--dangerously-skip-permissions` and you can't switch to
bypass-permissions mode inside the sandbox. To work around this, either
use Claude Code's auto mode or pass the flag explicitly:

```console
$ sbx run --clone claude . -- --dangerously-skip-permissions agents
```

Claude Code may use branches or worktrees to keep changes from its background
sessions separate. This depends on the task, Claude Code configuration, and
project instructions. The `--clone` flag doesn't control this behavior. Claude
Code creates any branches and worktrees inside the sandbox, not in your host
checkout.

To review a branch created by a session, fetch the
`sandbox-<sandbox-name>` remote from the host:

```console
$ git fetch sandbox-<sandbox-name>
$ git diff main..sandbox-<sandbox-name>/<branch>
```

See [Git workflows](/ai/sandboxes/agents/workflows/git/) for clone-mode details.

## Base image

The sandbox uses `docker/sandbox-templates:claude-code`. See
[Base images](/ai/sandboxes/customize/author/base-images/) to build your own image on top of
this base.

## Use a local model

For local models, hosted providers, and custom inference endpoints, see
[Use local and hosted models](/ai/sandboxes/agents/configuration/models/).

<!-- page: https://docs.docker.com/ai/sandboxes/agents/codex/ fetched 2026-10-08 -->

# Codex






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



This guide covers authentication, configuration, and usage of Codex in a
sandboxed environment.

Official documentation: [Codex CLI](https://developers.openai.com/codex/cli)

## Quick start

Create a sandbox and run Codex for a project directory:

```console
$ sbx run codex ~/my-project
```

`sbx run` defaults the workspace to the current directory:

```console
$ cd ~/my-project
$ sbx run codex
```

To create a [mountless sandbox](/ai/sandboxes/agents/usage/#choose-a-workspace), use
`sbx create` without a workspace path, then attach by name.

## Authentication

For the default OpenAI models, `sbx run codex` prompts you to authenticate on
your host if you haven't stored an OpenAI credential. Authentication happens
before launching the sandbox, so credentials are never exposed inside it.

To set up authentication ahead of time, choose one of the following methods.

**OAuth**: Start the OAuth flow on your host with:

```console
$ sbx secret set openai --oauth
```

This opens a browser window for authentication and stores the resulting tokens
in your OS keychain. The OAuth flow runs on the host, not inside the sandbox,
so browser-based authentication works without any extra setup.

**API key**: Store your OpenAI API key using
[stored secrets](/ai/sandboxes/agents/configuration/credentials/#stored-secrets):

```console
$ sbx secret set openai
```

See [Credentials](/ai/sandboxes/agents/configuration/credentials/) for more details.

## Model selection

To use Codex with a local model or another inference provider, see
[Use local and hosted models](/ai/sandboxes/agents/configuration/models/).

## Configuration

Sandboxes don't pick up user-level configuration from your host, such as
`~/.codex`. Only project-level configuration in the working directory is
available inside the sandbox. See
[Why doesn't the sandbox use my user-level agent configuration?](/ai/sandboxes/agents/faq/#why-doesnt-the-sandbox-use-my-user-level-agent-configuration)
for workarounds.

### Default startup command

Without extra args, the sandbox runs:

```text
codex --dangerously-bypass-approvals-and-sandbox
```

Arguments after `--` are added after the default flags when the first one is
itself a flag (begins with `-`). A bare word — such as a prompt — replaces the
defaults instead, so lead with the flag to keep bypass mode:

```console
$ sbx run --name <sandbox-name> -- --dangerously-bypass-approvals-and-sandbox "fix the build"
```

## Base image

Template: `docker/sandbox-templates:codex`

See [Customize](/ai/sandboxes/agents/customize) to pre-install tools or customize this
environment.

<!-- page: https://docs.docker.com/ai/sandboxes/agents/copilot/ fetched 2026-10-08 -->

# Copilot






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



This guide covers authentication, configuration, and usage of GitHub Copilot
in a sandboxed environment.

Official documentation: [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli)

## Quick start

Create a sandbox and run Copilot for a project directory:

```console
$ sbx run copilot ~/my-project
```

The workspace parameter is optional and defaults to the current directory:

```console
$ cd ~/my-project
$ sbx run copilot
```

## Authentication

Copilot requires a GitHub token with Copilot access. Store your token using
[stored secrets](/ai/sandboxes/agents/configuration/credentials/#stored-secrets):

```console
$ sbx secret set github --command 'gh auth token'
```

## Configuration

Sandboxes don't pick up user-level configuration from your host. Only
project-level configuration in the working directory is available inside the
sandbox. See
[Why doesn't the sandbox use my user-level agent configuration?](/ai/sandboxes/agents/faq/#why-doesnt-the-sandbox-use-my-user-level-agent-configuration)
for workarounds.

Copilot is configured to trust the workspace directory by default, so it
operates without repeated confirmations for workspace files.

### Default startup command

Without extra args, the sandbox runs:

```text
copilot --yolo
```

Arguments after `--` are added after the default flags when the first one is
itself a flag (begins with `-`), so `--yolo` is preserved:

```console
$ sbx run copilot -- -p "review this PR"   # runs copilot --yolo -p "review this PR"
```

When the first argument is a bare word — a subcommand or prompt — it replaces
the defaults instead.

## Base image

Template: `docker/sandbox-templates:copilot`

Preconfigured to trust the workspace directory.

See [Customize](/ai/sandboxes/agents/customize) to pre-install tools or customize this
environment.

<!-- page: https://docs.docker.com/ai/sandboxes/agents/cursor/ fetched 2026-10-08 -->

# Cursor






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



This guide covers authentication, configuration, and usage of Cursor in a
sandboxed environment.

Official documentation: [Cursor CLI](https://cursor.com/cli)

## Quick start

Create a sandbox and run Cursor for a project directory:

```console
$ sbx run cursor ~/my-project
```

`sbx run` defaults the workspace to the current directory:

```console
$ cd ~/my-project
$ sbx run cursor
```

To create a [mountless sandbox](/ai/sandboxes/agents/usage/#choose-a-workspace), use
`sbx create` without a workspace path, then attach by name.

## Authentication

Cursor supports two authentication methods: an API key or OAuth.

**API key**: Store your Cursor API key using
[stored secrets](/ai/sandboxes/agents/configuration/credentials/#stored-secrets):

```console
$ sbx secret set cursor
```

**OAuth**: If no API key is set, Cursor prompts you to sign in interactively
on first run. The proxy intercepts the token exchange with
`api2.cursor.sh/auth/poll`, so credentials are managed by the host and aren't
stored inside the sandbox.

## Configuration

Sandboxes don't pick up user-level configuration from your host, such as
`~/.cursor`. Only project-level configuration in the working directory is
available inside the sandbox. See
[Why doesn't the sandbox use my user-level agent configuration?](/ai/sandboxes/agents/faq/#why-doesnt-the-sandbox-use-my-user-level-agent-configuration)
for workarounds.

Cursor reads `AGENTS.md` from the workspace for agent-specific instructions.

### Default startup command

Without extra args, the sandbox runs:

```text
cursor-agent --yolo
```

Arguments after `--` are added after the default flags when the first one is
itself a flag (begins with `-`), so `--yolo` is preserved:

```console
$ sbx run --name <sandbox-name> -- -p "refactor this"   # runs cursor-agent --yolo -p "refactor this"
```

When the first argument is a bare word — a subcommand or prompt — it replaces
the defaults instead.

## Base image

Template: `docker/sandbox-templates:cursor-agent-docker`

Preconfigured with HTTP/1.1 and server-sent events for agent traffic so
requests flow through the host proxy. Authentication state is persisted across
sandbox restarts.

See [Customize](/ai/sandboxes/agents/customize) to pre-install tools or customize this
environment.

<!-- page: https://docs.docker.com/ai/sandboxes/agents/devin/ fetched 2026-10-08 -->

# Devin






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



Official documentation: [Devin CLI](https://docs.devin.ai/work-with-devin/devin-cli)

## Quick start

Create a sandbox and run Devin for a project directory:

```console
$ sbx run devin ~/my-project
```

The workspace parameter is optional and defaults to the current directory:

```console
$ cd ~/my-project
$ sbx run devin
```

## Authentication

On first run, Devin prompts you to sign in interactively inside the sandbox.
After you sign in, Docker Sandboxes manages the reusable credential on the host
and supplies it to future Devin sandboxes through the proxy.

## Configuration

Sandboxes don't pick up user-level Devin configuration from your host. Only
project-level configuration in the working directory is available inside the
sandbox. See
[Why doesn't the sandbox use my user-level agent configuration?](/ai/sandboxes/agents/faq/#why-doesnt-the-sandbox-use-my-user-level-agent-configuration)
for workarounds.

Devin reads `AGENTS.md` from the workspace for agent-specific instructions and
uses the [shared agent skills](/ai/sandboxes/agents/workflows/agent-skills/) store.

### Default startup command

Without extra args, the sandbox runs:

```text
devin --permission-mode dangerous --respect-workspace-trust=false
```

## Base image

Template: `docker/sandbox-templates:devin-docker`

See [Customize](/ai/sandboxes/agents/customize) to pre-install tools or customize this
environment.

<!-- page: https://docs.docker.com/ai/sandboxes/agents/docker-agent/ fetched 2026-10-08 -->

# Docker Agent






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



Official documentation: [Docker Agent](/ai/docker-agent/)

## Quick start

Create a sandbox and run Docker Agent for a project directory:

```console
$ sbx run docker-agent ~/my-project
```

`sbx run docker-agent` defaults the workspace to the current directory, so you
can run it from inside your project.

To create a [mountless sandbox](/ai/sandboxes/agents/usage/#choose-a-workspace), use
`sbx create` without a workspace path, then attach by name.

## Authentication

Docker Agent supports multiple providers. Store keys for the providers you want
to use with [stored secrets](/ai/sandboxes/agents/configuration/credentials/#stored-secrets):

```console
$ sbx secret set openai
$ sbx secret set anthropic
$ sbx secret set google
$ sbx secret set xai
$ sbx secret set nebius
$ sbx secret set mistral
$ sbx secret set openrouter
```

You only need to configure the providers you want to use. Docker Agent detects
available credentials and routes requests to the appropriate provider.

## Configuration

Sandboxes don't pick up user-level configuration from your host. Only
project-level configuration in the working directory is available inside the
sandbox. See
[Why doesn't the sandbox use my user-level agent configuration?](/ai/sandboxes/agents/faq/#why-doesnt-the-sandbox-use-my-user-level-agent-configuration)
for workarounds.

### Default startup command

Without extra args, the sandbox runs:

```text
docker-agent run --yolo
```

Arguments after `--` are added after the default flags when the first one is
itself a flag (begins with `-`). When the first argument is a bare word — such
as the `run` subcommand or a config file — it replaces the defaults, so include
`run --yolo` yourself:

```console
$ sbx run --name <sandbox-name> -- run --yolo agent.yml
```

## Base image

The sandbox uses `docker/sandbox-templates:docker-agent`. See
[Base images](/ai/sandboxes/customize/author/base-images/) to build your own image on top of
this base.

<!-- page: https://docs.docker.com/ai/sandboxes/agents/droid/ fetched 2026-10-08 -->

# Droid






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



This guide covers authentication, configuration, and usage of Droid, an AI
coding agent by Factory, in a sandboxed environment.

Official documentation: [Droid](https://docs.factory.ai/)

## Quick start

Create a sandbox and run Droid for a project directory:

```console
$ sbx run droid ~/my-project
```

The workspace parameter is optional and defaults to the current directory:

```console
$ cd ~/my-project
$ sbx run droid
```

## Authentication

Droid requires a [Factory account](https://factory.ai). Both authentication
methods authenticate you to Factory's service directly — unlike other agents
where you supply a model provider key, Factory manages model access through
your Factory account.

**API key**: Store your Factory API key using
[stored secrets](/ai/sandboxes/agents/configuration/credentials/#stored-secrets):

```console
$ sbx secret set droid
```

**OAuth**: If no API key is set, Droid prompts you to authenticate
interactively on first run. The proxy handles the OAuth flow, so credentials
aren't stored inside the sandbox.

## Configuration

Sandboxes don't pick up user-level configuration from your host. Only
project-level configuration in the working directory is available inside the
sandbox. See
[Why doesn't the sandbox use my user-level agent configuration?](/ai/sandboxes/agents/faq/#why-doesnt-the-sandbox-use-my-user-level-agent-configuration)
for workarounds.

### Default startup command

The sandbox runs `droid` with no implicit flags. Args after `--` are passed
straight through:

```console
$ sbx run droid -- exec "fix the build"
```

## Base image

Template: `docker/sandbox-templates:droid-docker`

Preconfigured to run without approval prompts. Authentication state is
persisted across sandbox restarts.

See [Customize](/ai/sandboxes/agents/customize) to pre-install tools or customize this
environment.

<!-- page: https://docs.docker.com/ai/sandboxes/agents/gemini/ fetched 2026-10-08 -->

# Gemini






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



This guide covers authentication, configuration, and usage of Google Gemini in
a sandboxed environment.

Official documentation: [Gemini CLI](https://geminicli.com/docs/)

## Quick start

Create a sandbox and run Gemini for a project directory:

```console
$ sbx run gemini ~/my-project
```

`sbx run` defaults the workspace to the current directory:

```console
$ cd ~/my-project
$ sbx run gemini
```

To create a [mountless sandbox](/ai/sandboxes/agents/usage/#choose-a-workspace), use
`sbx create` without a workspace path, then attach by name.

## Authentication

Gemini requires either a Google API key or a Google account with Gemini access.

**API key**: Store your key using
[stored secrets](/ai/sandboxes/agents/configuration/credentials/#stored-secrets):

```console
$ sbx secret set google
```

**Google account**: If no API key is set, Gemini prompts you to sign in
interactively when it starts. Interactive authentication is scoped to the
sandbox and doesn't persist if you remove and recreate it.

## Configuration

Sandboxes don't pick up user-level configuration from your host, such as
`~/.gemini`. Only project-level configuration in the working directory is
available inside the sandbox. See
[Why doesn't the sandbox use my user-level agent configuration?](/ai/sandboxes/agents/faq/#why-doesnt-the-sandbox-use-my-user-level-agent-configuration)
for workarounds.

The sandbox disables Gemini's built-in sandbox tool (since the sandbox itself
provides isolation).

### Default startup command

Without extra args, the sandbox runs:

```text
gemini --yolo
```

Arguments after `--` are added after the default flags when the first one is
itself a flag (begins with `-`), so `--yolo` is preserved:

```console
$ sbx run --name <sandbox-name> -- -p "explain this"   # runs gemini --yolo -p "explain this"
```

When the first argument is a bare word — a subcommand or prompt — it replaces
the defaults instead.

## Base image

Template: `docker/sandbox-templates:gemini`

Gemini is configured to disable its built-in OAuth flow. Authentication is
managed through the proxy with API keys.

See [Customize](/ai/sandboxes/agents/customize) to pre-install tools or customize this
environment.

<!-- page: https://docs.docker.com/ai/sandboxes/agents/kiro/ fetched 2026-10-08 -->

# Kiro






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



This guide covers authentication, configuration, and usage of Kiro in a
sandboxed environment.

Official documentation: [Kiro CLI](https://kiro.dev/docs/cli/)

## Quick start

Create a sandbox and run Kiro for a project directory:

```console
$ sbx run kiro ~/my-project
```

The workspace parameter is optional and defaults to the current directory:

```console
$ cd ~/my-project
$ sbx run kiro
```

On first run, Kiro prompts you to authenticate using device flow.

## Authentication

Kiro uses device flow authentication, which requires interactive login through
a web browser. This method provides secure authentication without storing API
keys directly.

### Device flow login

When you first run Kiro, it prompts you to authenticate:

1. Kiro displays a URL and a verification code
2. Open the URL in your web browser
3. Enter the verification code
4. Complete the authentication flow in your browser
5. Return to the terminal - Kiro proceeds automatically

The authentication session is persisted in the sandbox and doesn't require
repeated login unless you destroy and recreate the sandbox.

### Manual login

You can trigger the login flow manually:

```console
$ sbx run kiro --name <sandbox-name> -- login --use-device-flow
```

This command initiates device flow authentication without starting a coding
session.

### Authentication persistence

Kiro stores authentication state in `~/.local/share/kiro-cli/data.sqlite3`
inside the sandbox. This database persists as long as the sandbox exists. If
you destroy the sandbox, you'll need to authenticate again when you recreate
it.

## Configuration

Sandboxes don't pick up user-level configuration from your host. Only
project-level configuration in the working directory is available inside the
sandbox. See
[Why doesn't the sandbox use my user-level agent configuration?](/ai/sandboxes/agents/faq/#why-doesnt-the-sandbox-use-my-user-level-agent-configuration)
for workarounds.

Kiro requires minimal configuration. The agent runs with trust-all-tools mode
by default, which lets it execute commands without repeated approval prompts.

### Default startup command

Without extra args, the sandbox runs:

```text
kiro chat --trust-all-tools
```

When the first argument after `--` is a flag (begins with `-`), it's added
after the defaults — for example, `sbx run kiro -- --resume` runs
`kiro chat --trust-all-tools --resume`. When the first argument is a bare word,
it replaces the defaults, which is why `sbx run kiro -- login --use-device-flow`
runs the login subcommand on its own. To run `chat` with extra arguments of
your own, include the subcommand:

```console
$ sbx run kiro -- chat --trust-all-tools --resume
```

## Base image

Template: `docker/sandbox-templates:kiro`

Authentication state is persisted across sandbox restarts.

See [Customize](/ai/sandboxes/agents/customize) to pre-install tools or customize this
environment.

<!-- page: https://docs.docker.com/ai/sandboxes/agents/opencode/ fetched 2026-10-08 -->

# OpenCode






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



This guide covers authentication, configuration, and usage of OpenCode in a
sandboxed environment.

Official documentation: [OpenCode](https://opencode.ai/docs)

## Quick start

Create a sandbox and run OpenCode for a project directory:

```console
$ sbx run opencode ~/my-project
```

`sbx run` defaults the workspace to the current directory:

```console
$ cd ~/my-project
$ sbx run opencode
```

To create a [mountless sandbox](/ai/sandboxes/agents/usage/#choose-a-workspace), use
`sbx create` without a workspace path, then attach by name.

OpenCode launches a TUI (text user interface) where you can select your
preferred LLM provider and interact with the agent.

## Authentication

OpenCode supports multiple providers. Store keys for the providers you want to
use with [stored secrets](/ai/sandboxes/agents/configuration/credentials/#stored-secrets):

```console
$ sbx secret set openai
$ sbx secret set anthropic
$ sbx secret set google
$ sbx secret set xai
$ sbx secret set groq
$ sbx secret set aws
$ sbx secret set openrouter
```

You only need to configure the providers you want to use. OpenCode detects
available credentials and offers those providers in the TUI.

### GitHub Copilot

To use GitHub Copilot models in OpenCode, configure a
[GitHub credential](/ai/sandboxes/agents/configuration/credentials/#github-token) for an
account with Copilot access. When OpenCode starts, Docker Sandboxes configures
its GitHub Copilot provider using that credential. You don't need a separate
device login inside OpenCode.

### OpenCode Zen API keys

OpenCode Zen API keys aren't part of the built-in OpenCode credentials that
`sbx secret set` supports. To use an OpenCode Zen API key, store it as a
[custom secret](/ai/sandboxes/agents/configuration/credentials/#custom-secrets):

Set the `OPENCODE_API_KEY` environment variable on the host, then store it:

```console
$ sbx secret set-custom \
    --host opencode.ai \
    --env OPENCODE_API_KEY \
    --value "$OPENCODE_API_KEY"
```

Custom secrets keep the real key in the host secret store. The sandbox receives
`OPENCODE_API_KEY` as a placeholder, and the host-side proxy replaces that
placeholder with the real key on requests to `opencode.ai`.

OpenCode Zen also requires network access to `opencode.ai`:

```console
$ sbx policy allow network opencode.ai:443
```

If you add a global custom secret, recreate existing OpenCode sandboxes so the
new environment variable is available inside the sandbox.

## Model selection

To select a local model or inference endpoint with `sbx run --model`, see
[Use local and hosted models](/ai/sandboxes/agents/configuration/models/).

When you use `--model`, the model's supported thinking levels are available
as OpenCode variants. Press Ctrl+T to cycle through them.

## Configuration

Sandboxes don't pick up user-level configuration from your host. Only
project-level configuration in the working directory is available inside the
sandbox. See
[Why doesn't the sandbox use my user-level agent configuration?](/ai/sandboxes/agents/faq/#why-doesnt-the-sandbox-use-my-user-level-agent-configuration)
for workarounds.

OpenCode uses a TUI interface and doesn't require extensive configuration
files. The agent prompts you to select a provider when it starts, and you can
switch providers during a session.

### Default startup command

The sandbox runs `opencode` with no implicit flags. Args after `--` are passed
straight through. For example, to resume an existing session:

```console
$ sbx run --name <sandbox-name> -- -s <session-id>
```

### TUI mode

OpenCode launches in TUI mode by default. The interface shows:

- Available LLM providers (based on configured credentials)
- Current conversation history
- File operations and tool usage
- Real-time agent responses

Use keyboard shortcuts to navigate the interface and interact with the agent.

## Base image

Template: `docker/sandbox-templates:opencode`

OpenCode supports multiple LLM providers with automatic credential injection
through the sandbox proxy.

See [Customize](/ai/sandboxes/agents/customize) to pre-install tools or customize this
environment.

<!-- page: https://docs.docker.com/ai/sandboxes/agents/shell/ fetched 2026-10-08 -->

# Shell






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



`sbx run shell` drops you into a Bash login shell inside a sandbox with no
pre-installed agent binary. It's useful for installing and configuring
agents manually, testing custom implementations, or inspecting a running
environment.

```console
$ sbx run shell ~/my-project
```

`sbx run` defaults the workspace to the current directory. To run a one-off
command instead of an interactive shell, pass it after `--`:

```console
$ sbx run shell -- -c "echo 'Hello from sandbox'"
```

To create a [mountless sandbox](/ai/sandboxes/agents/usage/#choose-a-workspace), use
`sbx create` without a workspace path, then attach by name:

```console
$ sbx create --name scratch shell
$ sbx run --name scratch
```

## Default startup command

Without extra args, the sandbox runs `bash -l`. When the first argument after
`--` is a flag (begins with `-`), it's added after `-l`, so login-shell
behavior is preserved:

```console
$ sbx run shell -- -c "echo hi"   # runs bash -l -c "echo hi"
```

When the first argument is a bare word, it replaces `-l` instead.

Store credentials using [stored secrets](/ai/sandboxes/agents/configuration/credentials/#stored-secrets)
before running the sandbox. The proxy injects them into outbound API requests;
credentials are never stored inside the VM:

```console
$ sbx secret set anthropic
$ sbx secret set openai
```

Once inside the shell, you can install agents using their standard methods,
for example `npm install -g @continuedev/cli`. For complex setups, build a
[workload kit](/ai/sandboxes/customize/) instead of installing
interactively each time.

## Base image

The shell sandbox uses the `shell` base image — the common base environment
without a pre-installed agent.

<!-- page: https://docs.docker.com/ai/sandboxes/architecture/ fetched 2026-10-08 -->

# Architecture






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



This page explains how Docker Sandboxes work under the hood. For the security
properties of the architecture, see [Sandbox isolation](/ai/sandboxes/architecture/security/isolation/).

## Workspace storage

Starting with `sbx` version 0.42.0, workspace paths are optional for
`sbx create`. When you omit them, the sandbox has no host workspace bind mount.
The sandbox uses the template image's configured `WORKDIR` as its default
working directory. Docker-provided agent templates set `WORKDIR` to
`/home/agent/workspace`. A custom template can set another absolute path. If
the daemon can't resolve a usable absolute `WORKDIR` from the image config, it
falls back to `/home/agent/workspace`. Files created there stay inside the
sandbox and persist across stops and restarts.

When you pass a workspace path to `sbx create` or `sbx run`, the directory is
mounted into the sandbox through a filesystem passthrough. `sbx run` uses the
current directory when you don't pass a path. The sandbox sees your actual
host files, so changes in either direction are instant with no sync process
involved.

A directly mounted workspace appears at the same absolute path as on your
host. Preserving absolute paths means error messages, configuration files, and
build outputs all reference paths you can find on your host. The agent sees the
same directory structure, which reduces confusion when debugging or reviewing
changes.

Clone mode uses a third storage layout. The host repository is mounted
read-only at `/run/sandbox/source`, and the agent works in a private clone
inside the sandbox. See [Clone mode](/ai/sandboxes/architecture/usage/#clone-mode).

> [!WARNING]
> Avoid mounting network-attached or remote storage (network drives, SMB/NFS
> shares, or cloud-synced folders) as a workspace. The sandbox accesses
> workspaces through a filesystem passthrough, so every file read and write
> goes over the network. This adds latency and slows agent performance.

## Storage and persistence

When you create a sandbox, everything inside it persists until you remove it:
Docker images and containers built or pulled by the agent, installed packages,
agent state and history, and files in mountless or cloned workspaces. Files in
a directly mounted workspace live on the host instead.

Each sandbox maintains its own Docker daemon state, image cache, and package
installations. Multiple sandboxes don't share images or layers. The
[shared agent skills store](/ai/sandboxes/architecture/workflows/agent-skills/) is an exception:
sandboxes created for supported agents mount the same host-side store read-only
by default. Use `--skills` or
[`skills.defaultMode`](/ai/sandboxes/architecture/configuration/settings/#skillsdefaultmode)
to choose another mode at
creation. Existing sandboxes retain their mounts until recreated.

Each sandbox consumes disk space for its VM image, Docker images, container
layers, and volumes, and this grows as you build images and install packages.

Virtiofs caching is enabled by default for directly mounted workspaces on all
operating systems. File reads from the sandbox VM are cached on the host side,
reducing round-trips through the filesystem passthrough and improving
performance for read-heavy workloads such as `git status` or directory scans.
To opt out, set
`DOCKER_SANDBOXES_ENABLE_VIRTIOFS_CACHE=0` when creating the sandbox:

```console
$ DOCKER_SANDBOXES_ENABLE_VIRTIOFS_CACHE=0 sbx run <agent>
```

## Networking

All outbound TCP traffic from the sandbox routes through a proxy on your host.
Agents use a forward proxy for HTTP and HTTPS; other TCP traffic is forwarded
transparently. Both paths enforce
[network access policies](/ai/sandboxes/architecture/governance/access-controls/network/). The forward
proxy also handles [credential injection](/ai/sandboxes/architecture/configuration/credentials/). See
[Network isolation](/ai/sandboxes/architecture/security/isolation/#network-isolation) for how this
works and [Default security posture](/ai/sandboxes/architecture/security/defaults/) for what is
allowed out of the box.

### Follow an authenticated request

Step through the following diagram to see where Docker Sandboxes checks network
policy and replaces a sentinel credential with the real value. The real credential stays
outside the sandbox throughout the request.

Follow an authenticated request

Use Next and Previous to follow the request at your own pace, or select a step to jump to it.

1. The agent prepares the request: The agent sees a sentinel value instead of the real API credential.
2. The request leaves the microVM: Outbound HTTP and HTTPS traffic crosses the sandbox boundary through the host network path.
3. Network policy checks the destination: The request continues only when an active policy permits the provider domain.
4. The proxy retrieves the credential: The host-side proxy resolves the matching credential without copying it into the sandbox.
5. The proxy rewrites the header: The proxy replaces the sentinel with the real credential after the request has left the microVM.
6. The response returns: The provider response returns through the host proxy to the agent. The credential remains on the host.


### Upstream proxy

The host-side proxy makes its outbound connections using your host's network
configuration and routing. When a destination is reachable through a direct
route, traffic follows that route. When reaching a destination requires an
upstream proxy, the host-side proxy forwards the request to it. Chaining to an
upstream proxy means sandbox traffic respects the same egress controls as other
applications on your host.

By default, both sandbox traffic and the daemon's own traffic follow your OS
system proxy, so this usually works without any configuration. To set a proxy
explicitly — with a proxy URL, a PAC file, a SOCKS5 proxy, or separate settings
for sandbox and daemon traffic — see
[Configure an upstream proxy](/ai/sandboxes/architecture/configuration/upstream-proxy/). Upstream proxy support is
experimental and subject to change.

Only HTTP and HTTPS traffic can be forwarded to an upstream proxy. Other TCP
traffic can't be redirected to a proxy.

## MCP gateway

Supported agents connect to a single MCP gateway endpoint for the sandbox. The
gateway runs on the host side of the sandbox boundary and brokers access to
registered MCP servers.

Registered MCP servers can be remote endpoints, or they can be local stdio
servers launched on the host. Local stdio servers don't run inside the sandbox
VM. If a local stdio server is packaged as an OCI image, or if you register an
explicit `docker` command, it uses Docker on the host.

When MCP policies apply, enforcement happens on the MCP gateway path, separate
from the HTTP/HTTPS network proxy. Server registration is checked before the
server is stored, and governed MCP requests are checked by the gateway before
tool calls, resource reads, prompt retrieval, or gateway meta-tool execution.

## Lifecycle

`sbx run` initializes a VM for a specified agent and starts the agent. You can
stop and restart without recreating the VM, preserving installed packages,
Docker images, and in-sandbox files.

Sandboxes persist until explicitly removed. Stopping an agent doesn't delete
the VM; environment setup carries over between runs. Use `sbx rm` to delete
the sandbox, its VM, and all of its contents. If the sandbox used
[`--clone`](/ai/sandboxes/architecture/usage/#clone-mode), the `sandbox-<name>` Git remote is also
removed from your host repository.

## Comparison to alternatives

| Approach                                            | Isolation            | Docker access      | Use case           |
| --------------------------------------------------- | -------------------- | ------------------ | ------------------ |
| Sandboxes (microVMs)                                | Full (hypervisor)    | Isolated daemon    | Autonomous agents  |
| Container with socket mount                         | Partial (namespaces) | Shared host daemon | Trusted tools      |
| [Docker-in-Docker](https://hub.docker.com/_/docker) | Partial (privileged) | Nested daemon      | CI/CD pipelines    |
| Host execution                                      | None                 | Host daemon        | Manual development |

Sandboxes trade higher resource overhead (a VM plus its own daemon) for
complete isolation. Use containers when you need lightweight packaging without
Docker access. Use sandboxes when you need to give something autonomous full
Docker capabilities without trusting it with your host environment.

<!-- page: https://docs.docker.com/ai/sandboxes/cloud/ fetched 2026-10-08 -->

# Cloud sandboxes


> [!NOTE]
> Cloud sandbox support in the `sbx` CLI is experimental. Features and behavior
> may change.

Cloud sandboxes run AI agents on Docker-managed infrastructure instead of your
local machine. Use them when you need an isolated environment that doesn't
depend on the compute resources or virtualization support of your host.

Cloud sandboxes use the same `sbx` CLI as local sandboxes. Add the global
`--cloud` flag to send a supported command to the Cloud Sandboxes API:

```console
$ sbx --cloud ls
```

Cloud and local sandboxes have separate state and different capabilities. A
cloud sandbox can't mount a host workspace or use host hardware, and its
secrets, network policy, ports, and lifecycle are managed in the cloud. See
[Local and cloud differences](/ai/sandboxes/cloud/local-vs-cloud/) before adapting a local
workflow.

## Prerequisites

To use cloud sandboxes, you need:

- The [`sbx` CLI](/ai/sandboxes/install/), version 0.45.0 or later
- An active [Docker Agentic Platform subscription](/agentic-platform/signup/#activate-cloud-access)

Follow [Signup and billing](/agentic-platform/signup/) to activate
cloud access and review compute charges. Then return here to sign in from the
CLI and configure your agent.

### Sign in from the CLI

Sign in with the same Docker account you used to subscribe:

```console
$ sbx login
```

Check cloud connectivity and account access:

```console
$ sbx --cloud diagnose
```

If the check reports that your account doesn't have access, follow
[Check account access](/agentic-platform/signup/#check-account-access).

## Get started

Credentials configured for local sandboxes aren't available to cloud
sandboxes. Configure a cloud credential for your agent before launching it.
For Claude Code, store an Anthropic API key:

```console
$ sbx --cloud secret set anthropic
```

See [Authenticate cloud agents](/ai/sandboxes/cloud/credentials/) for other agents and credential
options.

Cloud sandboxes expire after one hour by default. On expiration, the service
stops sandboxes that can be resumed and deletes the rest. Check the timeout
action before relying on a sandbox to retain your work. See
[Configure expiration](/ai/sandboxes/cloud/usage/#configure-expiration).

Create a sandbox without attaching, allowing access to GitHub for this example:

```console
$ sbx --cloud create --name cloud-project --allow-network github.com:443 claude
```

Cloud sandboxes don't accept a local workspace path. Clone the public
[Welcome to Docker repository](https://github.com/docker/welcome-to-docker)
inside the sandbox:

```console
$ sbx --cloud exec cloud-project git clone \
    https://github.com/docker/welcome-to-docker.git /home/agent/workspace/project
```

Attach to the agent:

```console
$ sbx --cloud attach cloud-project
```

Ask Claude to inspect `/home/agent/workspace/project` and write a description
of the application to `/home/agent/workspace/review.md`. When the file is ready,
press `Ctrl+\` to detach and leave the agent running.

Copy the result to your machine:

```console
$ sbx --cloud cp cloud-project:/home/agent/workspace/review.md ./review.md
```

Read the result, then remove the sandbox when you're finished:

```console
$ sbx --cloud rm cloud-project
```

Removal deletes files stored only in the sandbox. For your own projects, see
[Transfer files](/ai/sandboxes/cloud/usage/#transfer-files) and
[Authenticate cloud agents](/ai/sandboxes/cloud/credentials/) before cloning private repositories.

## Learn more

- [Signup and billing](/agentic-platform/signup/) covers activation
  and compute charges
- [Local and cloud differences](/ai/sandboxes/cloud/local-vs-cloud/) compares the two execution
  environments
- [Use cloud sandboxes](/ai/sandboxes/cloud/usage/) covers creation, files, ports, and lifecycle
- [Authenticate cloud agents](/ai/sandboxes/cloud/credentials/) covers cloud-specific secrets,
  API keys, and OAuth
- [Manage cloud network policy](/ai/sandboxes/cloud/network-policy/) covers account-level and
  sandbox-level network access
- [Move a sandbox](/ai/sandboxes/cloud/move/) explains filesystem transfers between local and
  cloud environments
- [`sbx` CLI reference](/reference/cli/sbx/) lists commands and options

<!-- page: https://docs.docker.com/ai/sandboxes/cloud/credentials/ fetched 2026-10-08 -->

# Authenticate cloud agents


Cloud agents authenticate with credentials from the cloud secret store. Set up
these credentials before launching an agent so authentication doesn't depend
on files stored inside the sandbox.

## Use the cloud secret store

The following secret interfaces are separate:

- `sbx secret` manages secrets for local sandboxes
- `sbx --cloud secret` manages secrets for cloud sandboxes created by the CLI
- Docker Agentic Platform manages its own secret names through its web
  interface

A credential created through one interface isn't available through the
others. Configure a cloud credential using one of the following methods before
starting a cloud sandbox.

## Choose an authentication method

For Claude Code, use an Anthropic API key. For Codex, use an OpenAI API key or
account-scoped OpenAI OAuth credentials.

Configure your agent with the corresponding command:

| Agent or provider | Recommended command | Authentication |
| --- | --- | --- |
| Claude Code | `sbx --cloud secret set anthropic` | Prompts for an Anthropic API key |
| Codex with OpenAI OAuth | `sbx --cloud secret set openai --oauth` | Opens the OpenAI OAuth flow and stores the resulting credential at account scope |
| Service API key | `sbx --cloud secret set <service>` | Prompts for an API key or token |

For Codex, you can use OpenAI OAuth at account scope or store an OpenAI API
key with `sbx --cloud secret set openai`.

After storing an Anthropic API key, launch Claude Code:

```console
$ sbx --cloud run claude --name cloud-project
```

## Keep credentials out of the sandbox filesystem

Credentials configured with `sbx --cloud secret` stay in the cloud secret store,
outside the sandbox filesystem.

An agent's interactive sign-in can write credentials inside the sandbox.
Those files can be included in templates and `sbx move` snapshots. If you
signed in inside an agent, follow the provider's sign-out guidance and remove
those credentials before capturing or moving the sandbox.

## Set credential scope

Credentials use account scope by default. An account-scoped credential is
available to cloud sandboxes in the Docker account:

```console
$ sbx --cloud secret set github
```

Scope an API key or token to one sandbox by name:

```console
$ sbx --cloud secret set openai --sandbox cloud-project
```

A sandbox-scoped secret takes precedence over an account-scoped secret for the
same service. Set it before creating the sandbox so the CLI can include it when
the sandbox starts. OAuth credentials can't use sandbox scope.

## Service identifiers

The following table shows cloud secret support for the
[built-in services documented for local sandboxes](/ai/sandboxes/cloud/configuration/credentials/#built-in-services):

| Service | Cloud secret authentication |
| --- | --- |
| `anthropic` | API key |
| `cursor` | API key |
| `droid` | API key; cloud-managed OAuth is not supported |
| `github` | Token |
| `google` | API key |
| `groq` | API key |
| `mistral` | API key |
| `nebius` | API key |
| `openai` | API key or OAuth |
| `openrouter` | Use a [custom secret](#configure-a-custom-secret) |
| `xai` | API key |

To configure a supported service, run `sbx --cloud secret set <service>`.
For OpenAI OAuth, add `--oauth` and use account scope.

For other services, configure a [custom secret](#configure-a-custom-secret).

The cloud secret commands don't support registry credentials or dynamic
`--ref` and `--command` resolvers. An
[environment file](/ai/sandboxes/cloud/configuration/environment-files/#secrets) can resolve a
host command or vault reference once with `snapshot: true` and upload the
result as a literal cloud secret.

## Configure a custom secret

Use `set-custom` for an API that isn't a built-in service:

```console
$ sbx --cloud secret set-custom --name project-api \
    --host api.example.com --env PROJECT_API_TOKEN
```

The command prompts for the value. Sandboxes using this secret receive a
placeholder in `PROJECT_API_TOKEN`. The cloud proxy sets
`Authorization: Bearer <secret>` on requests to `api.example.com`. Unlike local
custom secrets, cloud injection sets the header based on the destination host
without requiring a matching placeholder in the request.

Use `--header` to select another header. When you specify a header, the default
value is the raw secret. Use `--format` with one `%s` placeholder to add a
prefix, for example `--header Authorization --format 'Bearer %s'`.

Each `--host` must be an exact DNS name without a scheme, port, or path. Repeat
the flag for multiple hosts. IP addresses and wildcards aren't supported.
Add `--sandbox cloud-project` to scope the secret to that sandbox, and set it
before creating the sandbox. A custom secret name can't match a built-in
service name.

## List and remove credentials

List cloud secret metadata without revealing values:

```console
$ sbx --cloud secret ls
```

Remove a credential from the matching scope:

```console
$ sbx --cloud secret rm github
$ sbx --cloud secret rm openai --sandbox cloud-project
$ sbx --cloud secret rm project-api
```

Custom secrets can also be removed by a host they serve, using
`sbx --cloud secret rm --host api.example.com`. Removal asks for confirmation.
Use `--force` in scripts. Cloud mode doesn't support removing every secret in
one operation.

<!-- page: https://docs.docker.com/ai/sandboxes/cloud/local-vs-cloud/ fetched 2026-10-08 -->

# Compare local and cloud sandboxes


Local and cloud sandboxes provide isolated environments for AI agents, but
they run against different resources and stores. This comparison helps you
choose an environment and identify workflows that need cloud-specific setup.

| Capability | Local sandbox | Cloud sandbox |
| --- | --- | --- |
| Compute | Uses resources from the host | Uses Docker-managed cloud resources |
| CPU architecture | Uses the platform supported by the local runtime | Supports `linux/amd64` and `linux/arm64`, subject to account availability; moves must retain the source platform |
| Workspace | Mounts host paths or uses a private Git clone backed by the host repository | Has no access to host paths; transfer files or clone a repository inside the sandbox |
| Hardware | Can use supported host integrations, such as GPU, USB, display, and nested virtualization | Has no access to host hardware |
| Ports | Binds sandbox ports to host addresses and ports | Exposes a sandbox port through a public HTTPS URL |
| Secrets | Reads from the local `sbx` secret store | Reads from the separate `sbx --cloud` secret store |
| Network policy | Uses local and organization policy sources supported by the local runtime | Uses separate, network-only account and sandbox policy; local policies aren't copied |
| MCP servers | Uses servers registered in the local MCP store | Uses servers connected through Docker Agentic Platform |
| Storage | Persists in the local sandbox and its attached host resources | Persists in the cloud sandbox and optional cloud volumes |
| Lifetime | Persists across stops until you remove it | Expires according to its time-to-live and timeout action |
| Billing | No metered sandbox compute charge | [Pay-as-you-go compute](/agentic-platform/signup/#billing) |

If your workflow runs Docker inside the sandbox, review the
[Docker exec and healthcheck limitation](/ai/sandboxes/cloud/local-vs-cloud/usage/#docker-exec-and-healthchecks).
It can affect container setup, debugging, and Compose service readiness.

## Host-dependent features

A cloud sandbox has no path back to the machine where you run `sbx`. The
following local features don't apply in cloud mode:

- Workspace paths, bind mounts, `--clone`, and Git worktrees created with
  `--branch`
- GPU, USB, display, and nested virtualization options
- Model selection through `--model` and `--provider`
- Host port bindings
- Host-backed agent skills and the full local MCP management workflow

The CLI rejects local-only flags used with `--cloud` instead of ignoring them.

You can use [environment files](/ai/sandboxes/cloud/configuration/environment-files/#use-a-cloud-environment)
with `sbx --cloud env`. Cloud environments support a subset of the local
configuration fields, including agents, environment variables, resource limits,
and credentials. Remove host workspace and port mappings before using a local
environment file in the cloud.

## Separate resources

Adding `--cloud` changes the backend for the command. A sandbox shown by
`sbx ls` doesn't appear in `sbx --cloud ls`, and resources created for one
backend don't automatically become available to the other.

This separation applies to sandboxes, templates, secrets, volumes, and network
policy. Use [`sbx move`](/ai/sandboxes/cloud/local-vs-cloud/move/) when you need to copy a sandbox filesystem
between backends. Moving doesn't unify the resource stores or transfer
host-mounted files or managed secrets. Credentials saved in copied files can
still travel with the sandbox.

## Network policy differences

Configure and verify [cloud network policy](/ai/sandboxes/cloud/local-vs-cloud/network-policy/) separately.
Moving a sandbox doesn't carry its local policy configuration into the cloud.
The cloud CLI supports account and sandbox network rules, but rejects local
governance profiles and the `--protocol` option.

HTTP method and path restrictions, also called L7 filtering, aren't supported
in cloud sandboxes. If these rules apply to a local sandbox, `sbx move` warns
and asks for confirmation before moving it to the cloud.

## What changes when you move

[`sbx move`](/ai/sandboxes/cloud/local-vs-cloud/move/) copies a filesystem snapshot and creates a separate
destination sandbox. It doesn't transfer running processes or memory, and it
leaves the source sandbox in place. Large images can take time to upload or
download, depending on image size and available bandwidth. For cloud-to-local
moves, also allow for [temporary disk space](/ai/sandboxes/cloud/local-vs-cloud/move/#move-from-cloud-to-local).

| State | Local to cloud | Cloud to local | What to do |
| --- | --- | --- | --- |
| Network policy | Local rules aren't copied; the CLI warns that cloud policy applies | Cloud rules aren't copied; the CLI notice explains that the host's default egress policy applies | Configure destination rules and verify allowed and blocked connections before continuing work |
| Managed secrets | Uses applicable credentials in the cloud secret store | Uses applicable credentials in the local secret store | Configure credentials in the destination store; the CLI warns that secrets aren't copied and you may need to sign in again |
| Workspace and attached storage | Host mounts and clone-mode volumes aren't copied; a workspace triggers a warning and confirmation | Cloud volumes aren't copied and no host folder is mounted | Transfer needed files separately with `sbx cp` |
| Published ports | TCP ports get cloud URLs; refused ports are skipped with a warning | Ports use local loopback bindings; cloud URLs aren't retained | Inspect destination ports and update clients |
| CPU and memory | Rounds recorded source limits up to a supported cloud size; missing limits use defaults with a warning | Uses local defaults | Check destination resources and workload performance; `sbx move` has no CPU or memory override flags |
| CPU architecture | Cloud access must support the source platform | The local runtime must support the source platform | Match platforms; the CLI checks compatibility before transfer |

The managed-secret warning doesn't itself block a move. Configure
[cloud credentials](/ai/sandboxes/cloud/local-vs-cloud/credentials/) or
[local credentials](/ai/sandboxes/cloud/configuration/credentials/) before using an agent
that needs them. Credentials written to files inside the sandbox can be
included in the snapshot; remove those files before moving if you don't want
the credentials copied.

Cloud-to-local moves display a notice and ask for confirmation. Local-to-cloud
moves ask for confirmation when workspace files or L7 filtering would be left
behind. If a confirmation is required and standard input isn't a terminal,
the move fails unless you pass `--force`. This flag skips confirmation but
retains warnings and doesn't change what transfers.

Verify the destination's files, credentials, network access, ports, and
[expiration settings](/ai/sandboxes/cloud/local-vs-cloud/usage/#configure-expiration) before removing the source.

<!-- page: https://docs.docker.com/ai/sandboxes/cloud/move/ fetched 2026-10-08 -->

# Move a sandbox


The `sbx move` command transfers a filesystem snapshot between a local sandbox
and a cloud sandbox. Use it to continue from the captured filesystem in the
other environment, not as a live migration of the running sandbox.

## Transfer behavior

A move performs the following operations:

1. Captures the source sandbox filesystem as a template image
2. Transfers the image across the local and cloud boundary
3. Creates a destination sandbox from the image

The destination gets a different sandbox ID. The source isn't deleted, so the
two sandboxes have independent state after the transfer. A local-to-cloud move
stops the local source while capturing it. A cloud-to-local move attempts to
stop the cloud source after creating the destination. This is a best-effort
operation, so the cloud source can remain running if it can't be stopped.
The move can return before the stop finishes. Check `sbx --cloud ls` for its
state. A cloud source with no agent is left running.
Remove the source separately after you verify the destination.

> [!IMPORTANT]
>
> Managed secrets aren't copied from the source secret store. Credentials
> written inside a sandbox by an agent's interactive sign-in are ordinary
> filesystem files and are included in the snapshot. Remove in-sandbox
> credentials before moving a sandbox.

Moving transfers filesystem data stored in the sandbox container. It doesn't
transfer:

- Running processes, memory, or open sockets
- Local workspace mounts, bind mounts, or clone-mode volumes
- Managed secrets from the source secret store
- Other resources attached outside the sandbox filesystem

Changes made to either sandbox after the move aren't synchronized.

The snapshot retains the source sandbox's platform. The destination must
support the same platform because `sbx move` doesn't convert between
`linux/amd64` and `linux/arm64`. For a local-to-cloud move, your cloud account
must support the local sandbox's platform. For a cloud-to-local move, create
the cloud sandbox with `--platform linux/amd64` or `--platform linux/arm64`
to match your local sandbox runtime. The CLI checks compatibility before
transferring the snapshot.

## Move from local to cloud

Move a local sandbox to the cloud:

```console
$ sbx move local-project --to cloud
```

The `move` command spans both backends, so don't add the global `--cloud` flag.
Use `--name` to set the destination name prefix. The cloud destination appends
a short unique suffix:

```console
$ sbx move local-project --to cloud --name cloud-project
```

Local workspace files are mounted outside the sandbox filesystem and don't
appear in the cloud destination. When the source has a workspace, the CLI
warns and asks for confirmation. The `--force` flag skips the prompt but
doesn't include those files.

The destination uses cloud network policy and the network rules of the
sandbox's kit, or of its built-in agent, as `sbx --cloud create` does. Network
rules you added locally don't transfer. If the local source has HTTP method or
path restrictions, the CLI warns and asks for confirmation because those
restrictions won't apply in the cloud. `--force` skips the prompt but retains
the warning.

Published TCP sandbox ports are published on the cloud destination with cloud
URLs. Ports that the cloud refuses are skipped with a warning. Host port
numbers and non-TCP mappings don't transfer.

The destination can use applicable credentials that already exist in the cloud
secret store. Credentials in the local secret store don't transfer.

The CLI rounds the source's recorded CPU and memory limits up to a supported
[cloud size](/ai/sandboxes/cloud/move/usage/#choose-resources-and-platform). Missing limits use cloud
defaults with a warning. Limits above the largest cloud size prevent the move.
The `move` command has no `--cpus` or `--memory` overrides. Resource sizing
doesn't guarantee the same performance as the source; check your workload on
the destination before removing the source.

### Set destination expiration

The cloud destination has an expiration time, even if the local source had
none. Without `--ttl`, it uses the server default, typically one hour. The
move requests that the sandbox stop on expiration when the account and sandbox
support it. Otherwise, it falls back to the server's default timeout action,
which deletes the sandbox.

Set the expiration and action explicitly when moving work you want to retain:

```console
$ sbx move local-project --to cloud --ttl 2h --on-timeout stop
```

The `stop` action preserves state. An explicit request fails if stopping is
unavailable. Use `--on-timeout delete` to delete on expiration.
These flags apply only to moves to the cloud. After the move, inspect or extend
the expiration with [`sbx --cloud ttl`](/ai/sandboxes/cloud/move/usage/#configure-expiration).

## Move from cloud to local

Move a cloud sandbox to the local runtime by ID or name:

```console
$ sbx move cloud-project --to local --name local-copy
```

The local destination starts with the host's default network policy. Cloud
network rules aren't copied back to the local runtime.

Published TCP ports are saved on the local sandbox and bound to loopback while
it runs. Host port numbers can change after a restart. Run
`sbx ports local-copy` to see the bindings.

The move doesn't create a host workspace. Use `sbx cp` to copy files from the
local sandbox to your host. Attached cloud volumes and environment variables
don't transfer. The local destination uses local CPU and memory defaults.

This direction requires a machine that meets the local sandbox requirements
because the command imports the snapshot and creates a local sandbox. The
cloud source remains available unless you remove it with `sbx --cloud rm`.

Layer reuse during download can require up to 32 GiB of temporary host disk
space in addition to the local runtime's image storage.

## Verify the result

List both backends after the move:

```console
$ sbx ls
$ sbx --cloud ls
```

Inspect the destination filesystem and verify its credentials, ports, volumes,
and other environment-specific resources before removing the source. Configure
anything that didn't carry over.

<!-- page: https://docs.docker.com/ai/sandboxes/cloud/network-policy/ fetched 2026-10-08 -->

# Manage cloud network policy


Cloud network policy controls outbound connections from cloud sandboxes. It is
a separate, network-only policy store with Docker account and individual
sandbox scopes.

> [!IMPORTANT]
>
> Local policy configuration isn't copied to cloud sandboxes. Configure cloud
> rules with `sbx --cloud policy` and verify network access using connection
> checks and policy logs.

## Understand policy scope

The cloud CLI supports account and sandbox policy scopes. Your account policy
supplies the default for cloud sandboxes you create in the Docker account. A
sandbox policy adds rules for one cloud sandbox. Matching deny rules take
precedence over allow rules across the applicable policies.

Cloud creation uses cloud account policy, network rules passed to the command,
and network access declared by the agent or kit. Both `sbx --cloud create` and
`sbx --cloud run` leave local network and organization policies on the host.
Moving a local sandbox to the cloud works the same way, except that rules you
added locally don't transfer.

Define the intended policy in the cloud store. After creation, inspect the
configured rules and [verify connection decisions](#inspect-network-policy).

## Initialize account policy

Set the account policy to `allow-all`, `balanced`, or `deny-all`:

```console
$ sbx --cloud policy init deny-all
```

The default applies to your cloud sandboxes in the Docker account. You can add
rules after initialization or specify initial rules when creating a sandbox.
A deny-all default still permits destinations allowed by applicable sandbox
or agent-kit rules.

The `balanced` preset sets deny-all as the default and adds allow rules for
common development services. To set a default for one sandbox, use
`sbx --cloud policy init deny-all --sandbox cloud-project`.

You can run `init` again to change the default. Existing allow and deny rules
remain in place. Use `reset` to remove account rules before choosing another
preset.

## Add network rules

Add an account-level exception:

```console
$ sbx --cloud policy allow network api.github.com:443
```

Scope a rule to one sandbox:

```console
$ sbx --cloud policy allow network api.anthropic.com:443 \
    --sandbox cloud-project
```

Deny rules take precedence when the same destination matches both an allow
rule and a deny rule.

Cloud rules match network destinations. HTTP method and path restrictions,
`--protocol`, and local governance profiles aren't supported.

You can also add initial rules while creating a sandbox:

```console
$ sbx --cloud create --name cloud-project \
    --allow-network api.github.com:443 \
    --deny-network example.com claude
```

## Inspect network policy

Inspect your account policy or a sandbox's configured policy:

```console
$ sbx --cloud policy ls
$ sbx --cloud policy ls cloud-project
```

The sandbox view shows its policy document, or your account default when the
sandbox has no policy document. It does not show the complete combination of
applicable rules.

To verify enforcement, attempt the connection from the sandbox, then review
the connection decisions:

```console
$ sbx --cloud exec cloud-project curl -I https://api.github.com
$ sbx --cloud policy log cloud-project
```

These records describe cloud network policy decisions. They aren't Docker AI
Governance organization audit logs.

## Remove network rules

Remove a rule by its pattern, from whichever allow or deny list contains it:

```console
$ sbx --cloud policy rm network --resource api.github.com:443
$ sbx --cloud policy rm network --sandbox cloud-project --resource api.anthropic.com:443
```

Remove the custom account policy and return to the platform default:

```console
$ sbx --cloud policy reset
```

The command asks for confirmation and prints the default stored by the server
after the reset. Use `--force` in scripts. The local daemon is unaffected.
Sandbox-specific policies remain in place and can still grant access. Inspect
those policies separately.

<!-- page: https://docs.docker.com/ai/sandboxes/cloud/usage/ fetched 2026-10-08 -->

# Use cloud sandboxes


Use the `--cloud` flag with supported `sbx` commands to create and manage
sandboxes on Docker-managed infrastructure. Cloud operations use cloud IDs,
names, resources, and lifecycle controls rather than the local sandbox daemon.

## Create a sandbox

A cloud sandbox expires after one hour by default. On expiration, the service
stops sandboxes that can be resumed and deletes the rest. See
[Configure expiration](#configure-expiration) to choose the timeout and action
before creating it.

Credentials saved for local sandboxes aren't available in cloud sandboxes.
[Configure a cloud credential](/ai/sandboxes/cloud/usage/credentials/) before launching an agent.

Create a sandbox and attach to its agent, or reuse the named sandbox if it
already exists:

```console
$ sbx --cloud run claude --name cloud-project
```

Without `--name`, an interactive run offers existing sandboxes for that agent
and an option to create another. Pass `--new` to create a fresh sandbox.
Launches that bake a kit template also create a fresh sandbox.

Reusing a sandbox keeps its creation settings. Flags such as `--cpus`,
`--memory`, `--platform`, `--ttl`, `--env`, and `--allow-network` are rejected
when resuming. Use `--new` to create a sandbox with different settings.

To create the sandbox without opening an agent session, use `create`:

```console
$ sbx --cloud create --name cloud-project claude
```

The command prints the cloud sandbox ID. Attach by ID or name:

```console
$ sbx --cloud attach cloud-project
```

Cloud sandbox names must have at least two characters, start with a letter or
number, and contain only letters, numbers, and hyphens. The name `default` is
reserved. Periods accepted in local sandbox names aren't accepted in the cloud.

Cloud creation doesn't accept workspace paths. For example,
`sbx --cloud run claude .` returns an error because `.` refers to the local
filesystem.

### Choose resources and platform

Without resource flags, a cloud sandbox starts with 2 CPUs and 4 GiB of
memory. Use `--cpus` and `--memory` to select one of these configurations:

| Size | CPUs | Memory |
| --- | --- | --- |
| micro | 1 | 2 GiB |
| small | 2 | 4 GiB |
| medium | 4 | 8 GiB |
| large | 8 | 16 GiB |
| xl | 16 | 32 GiB |

For example:

```console
$ sbx --cloud create --name cloud-project --cpus 4 --memory 8g claude
```

If you specify only CPU or memory, the CLI selects the matching value for the
other resource. Unsupported combinations are rejected.

Use `--platform linux/amd64` or `--platform linux/arm64` to select an
architecture supported by your account. This matters when you plan to
[move the sandbox to your machine](/ai/sandboxes/cloud/usage/move/): the architectures must match.

## Run without attaching

For scripts or terminals without interactive input, start the sandbox without
opening an agent session:

```console
$ sbx --cloud run --detached claude --name cloud-task
```

A detached run with `--name` reuses the named sandbox and starts it if stopped.
If the sandbox doesn't exist, or you omit `--name`, it creates a sandbox.
Use `sbx --cloud exec` to run commands and `sbx --cloud rm --force` for
unattended cleanup. An interactive agent session requires `run` or `attach`
from a terminal.

To detach from an interactive `run` or `attach` session while leaving the
agent running, press `Ctrl+\`. Reconnect with `sbx --cloud attach <sandbox-name>`.
Reconnecting joins the existing agent session. Use `--detach-keys` with `run`
or `attach` to change the detach gesture, for example `--detach-keys ctrl-x,ctrl-d`.

## List and inspect sandboxes

List cloud sandboxes separately from local sandboxes:

```console
$ sbx --cloud ls
```

Most cloud commands accept either the sandbox name or the `sbx_`-prefixed ID
shown in the output.

## Run commands

Run a command inside a cloud sandbox:

```console
$ sbx --cloud exec cloud-project pwd
```

## Connect with SSH

Configure cloud SSH access and connect with your SSH client:

```console
$ sbx --cloud setup ssh
$ ssh sbx_01abc123@sbx_cloud
```

Replace the example with `ssh <sandbox-id>@sbx_cloud`, using the
`sbx_`-prefixed ID from `sbx --cloud ls`.

## Transfer files

Use `sbx --cloud cp` to copy files or directories between the client machine
and a cloud sandbox. Use absolute sandbox paths:

```console
$ sbx --cloud cp ./src cloud-project:/home/agent/workspace/src
$ sbx --cloud cp cloud-project:/home/agent/workspace/result.json ./result.json
```

Copying creates a point-in-time transfer. It doesn't mount or synchronize the
local path. For source control workflows, you can also clone a remote
repository from inside the sandbox and push changes to the remote. Configure
[cloud credentials](/ai/sandboxes/cloud/usage/credentials/) before creating a sandbox that needs access
to a private repository. The [cloud walkthrough](/ai/sandboxes/cloud/usage/#get-started) shows a
public repository example.

## Expose a port

Expose a TCP service by specifying its sandbox port:

```console
$ sbx --cloud ports cloud-project --publish 8080
```

The command returns a public HTTPS URL assigned by the cloud control plane.
Cloud mode accepts a sandbox port number with an optional `/tcp` suffix, such
as `8080/tcp`. Host IP addresses, host port bindings, and other protocols are
rejected.

List or remove exposed ports:

```console
$ sbx --cloud ports cloud-project
$ sbx --cloud ports cloud-project --unpublish 8080
```

Treat an exposed URL as a public endpoint. Apply authentication in the service
and remove the exposure when you no longer need it.

## Configure expiration

Set the time-to-live and the action taken when it lapses during creation:

```console
$ sbx --cloud create --name cloud-project --ttl 2h --on-timeout delete claude
```

The default time-to-live is one hour. If you omit `--on-timeout`, the server
stops sandboxes that can be resumed and deletes the rest. Choose an action
explicitly when you need a particular outcome:

- `stop` preserves the sandbox so it can be started again. This requires
  support for stopping the sandbox.
- `restart` stops and immediately starts the sandbox. If you also specify
  `--ttl`, it must be at least one hour.
- `delete` removes the sandbox.

Volume-backed sandboxes require the `delete` action. Omitting `--ttl` uses
the server default. Setting `--ttl 0` is an error, not a way to disable
expiration.

Inspect or extend the expiration. Extensions cannot move expiration beyond
24 hours from creation:

```console
$ sbx --cloud ttl cloud-project
$ sbx --cloud ttl +30m cloud-project
```

A stopped sandbox has no running time-to-live, so `sbx --cloud ttl` reports
that it is stopped instead of showing an expiration time. Its time-to-live
starts again when the sandbox resumes. In `--json` output, `stopped` and
`ttl_paused` are `true`, and the expiry fields still hold the previous
deadline. While the sandbox is resuming, only `ttl_paused` is `true`.

## Stop or remove a sandbox

Stop a cloud sandbox while preserving its memory and filesystem:

```console
$ sbx --cloud stop cloud-project
```

The command returns when the stop request is accepted. Check `sbx --cloud ls`
to confirm that the sandbox has stopped. Compute isn't billed while it is
stopped.

To resume the sandbox and connect to its agent:

```console
$ sbx --cloud attach cloud-project
```

You can also use `sbx --cloud run claude --name cloud-project`, or run the agent
without `--name` and select the sandbox when prompted. Add `--detached` to a
named run to resume without attaching.

Resuming keeps the sandbox ID and state, and starts a new time-to-live
period. Check its expiration with `sbx --cloud ttl cloud-project` after
resuming.

If stop or resume reports that an existing sandbox was not found, the operation
may be disabled for your account.

Volume-backed sandboxes can't be stopped. Remove a volume-backed sandbox to end
it and save the volume snapshot.

Remove a sandbox when you no longer need its state:

```console
$ sbx --cloud rm cloud-project
```

Removal asks for confirmation, deletes the cloud sandbox, and can't be undone.
Use `--force` to skip the prompt in scripts.

### Remove a sandbox when the agent exits

Pass `--rm` to an interactive `run` to remove the sandbox when the agent
session ends:

```console
$ sbx --cloud run --rm claude
```

The detach gesture is turned off for that session, and you can't combine
`--rm` with `--detached`. If the session ends without completing, for example
because the connection drops, the sandbox is kept and the CLI prints the
command to remove it.

## Use persistent volumes

Cloud volumes are experimental and preserve data independently of a sandbox.
Create a volume, then attach it at sandbox creation:

```console
$ sbx --cloud volume create dependency-cache
$ sbx --cloud create --name cloud-project \
    --volume dependency-cache:/workspace/cache claude
```

The root directory of a newly created volume is owned by `root`. Change its
ownership after attaching it so the agent can write to it:

```console
$ sbx --cloud exec cloud-project \
    sudo chown agent:agent /workspace/cache
```

Volume data is saved as a snapshot when a sandbox exits, not continuously. If
multiple sandboxes mount the same volume at the same time, the last sandbox to
exit overwrites the stored snapshot.

## Customize a cloud sandbox

Cloud templates have their own store. A local template is not available to
`sbx --cloud` until you transfer it. To capture a running cloud sandbox and
create another sandbox from that template:

```console
$ sbx --cloud template save cloud-project cloud-template
$ sbx --cloud create --name cloud-copy --template cloud-template
```

The template supplies its CPU and memory configuration. Do not combine
`--template` with an agent name, `--cpus`, or `--memory`. To launch an OCI image
directly instead, use `--image-ref` with explicit CPU and memory values.

Snapshots include credentials written to the sandbox filesystem. Remove those
credentials before saving a template. Managed cloud secrets stay in the secret
store. See [Authenticate cloud agents](/ai/sandboxes/cloud/usage/credentials/).

Cloud sandboxes also support sandbox kits and `--kit` mixins. See
[Kits](/ai/sandboxes/cloud/customize/) for customization and
[Local and cloud differences](/ai/sandboxes/cloud/usage/local-vs-cloud/) for host-dependent features.
Configure [cloud credentials](/ai/sandboxes/cloud/usage/credentials/) before adapting a local kit.

Use `--kit-arg` or `--kit-args-file` with `sbx --cloud create` to pass
arguments to kits supplied with `--kit`.
For example, configure a v2 mixin that declares a `version` argument:

```console
$ sbx --cloud create --name cloud-tools claude \
    --kit docker.io/<NAMESPACE>/company-cli:1.0.0 \
    --kit-arg company-cli.version=1.2
```

Replace the kit reference and argument with those from your kit's
documentation. The `company-cli` prefix targets the kit by its repository
name. Built-in agents such as `claude` require v2 mixins.

To load arguments from a file, pass `--kit-args-file <FILE>` with one
`name=value` entry per line, such as `company-cli.version=1.2`. Values passed
with `--kit-arg` override values from the file.

To declare reusable cloud configuration in a file, see
[Use a cloud environment](/ai/sandboxes/cloud/configuration/environment-files/#use-a-cloud-environment).

## Load an MCP server

[Connect an MCP server in Docker Agentic Platform](/agentic-platform/mcp/)
before loading it into a cloud sandbox. Use the same Docker account you use
with `sbx`.

Load the connected server into a running cloud sandbox, using its name from
the console:

```console
$ sbx --cloud mcp load <server-name> --sandbox cloud-project
```

The server name is resolved by the MCP gateway associated with your Docker
Agentic Platform account. Cloud sandboxes don't use servers registered in the
local MCP store with `sbx mcp add`.

List servers reported by existing cloud sandbox gateways, or inspect one
sandbox's gateway:

```console
$ sbx --cloud mcp ls
$ sbx --cloud mcp ls cloud-project
```

The account listing shows servers reported by gateways, with the sandboxes
that use them. It omits unused server configurations and servers skipped by
a gateway. The sandbox view includes skipped servers.

## Diagnose cloud access

Check the CLI, Docker sign-in, cloud API connectivity, and account access:

```console
$ sbx --cloud diagnose
```

These checks don't require a local sandbox daemon. For local diagnostics,
see [Troubleshooting](/ai/sandboxes/cloud/troubleshooting/).

## Known limitations

### Docker exec and healthchecks

When running Docker inside a cloud sandbox, `docker exec` can access the
sandbox VM filesystem instead of the target container's filesystem. This also
affects `docker compose exec` and Docker healthchecks, which use the same
execution path.

Commands can fail because application files, binaries, or mounted data aren't
found. They can also succeed while reading or writing the wrong files. A
successful exit status doesn't confirm that the command used the target
container's filesystem.

Healthchecks can report incorrect results. Compose services that depend on
`condition: service_healthy` can remain blocked even when the service they
need is running.

A container's main process, started by `docker run`, uses the correct
filesystem. Where your workflow supports it, run setup or readiness checks
as a container's main command. This avoids the affected exec path for that
command but doesn't restore exec behavior or ongoing health monitoring.

<!-- page: https://docs.docker.com/ai/sandboxes/configuration/ fetched 2026-10-08 -->

# Configure Docker Sandboxes


Configure credentials and how Docker Sandboxes run for a project, host, or
network environment. These settings control sandbox creation, authentication,
and connectivity. To change the tools and agent configuration inside a
sandbox, see [Customize](/ai/sandboxes/customize).

- [Settings](/ai/sandboxes/configuration/settings/) lists host-level settings, environment variable
  equivalents, and commands to inspect and change values.
- [Credentials](/ai/sandboxes/configuration/credentials/) configures API keys, authentication
  credentials, and registry access for sandboxed agents.
- [Models](/ai/sandboxes/configuration/models/) selects local models, hosted providers, or custom
  inference endpoints for sandboxed agents.
- [Environment files](/ai/sandboxes/configuration/environment-files/) declare reusable project
  configuration in `sbxenv.yaml` for local or cloud sandboxes.
- [GPU passthrough](/ai/sandboxes/configuration/gpu-passthrough/) configures a Linux host and sandbox for
  NVIDIA GPU workloads.
- [Registry mirror](/ai/sandboxes/configuration/registry-mirror/) routes Docker Hub template, kit, and
  in-sandbox Docker image pulls through an organization's registry mirror.
- [Upstream proxy](/ai/sandboxes/configuration/upstream-proxy/) routes sandbox and daemon traffic through
  an operating system or corporate proxy.

<!-- page: https://docs.docker.com/ai/sandboxes/configuration/credentials/ fetched 2026-10-08 -->

# Manage credentials


These credential stores and authentication flows apply to local sandboxes.
Cloud credentials require separate setup: see
[Authenticate cloud agents](/ai/sandboxes/configuration/cloud/credentials/).

Most agents need an API key for their model provider. An HTTP/HTTPS proxy on
your host intercepts outbound requests from the sandbox, looks up the matching
credential on the host, and overwrites the auth header before forwarding. The
real credential stays on the host when proxy management is active; the sandbox
sees only a sentinel value. See
[Trust boundaries](/ai/sandboxes/configuration/security/#trust-boundaries) for how credential isolation
fits into the broader sandbox security model.

## How credential injection works

When a sandbox makes an outbound request, the host-side proxy decides three
things: whether the request **matches** a service the kit (or built-in agent)
declares, what **header** to write, and what **value** to inject. The kit
declares the match and the header; you provide the value on the host. For
proxy-managed credentials, the real value never enters the sandbox — the agent
sees only a sentinel like `proxy-managed`.

A kit can set OAuth `passthrough: true` to opt out of sentinel masking. This
sends the real token response into the sandbox and reduces credential isolation.
See the [`oauth` kit fields](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/capabilities/com.docker.sandbox/credential@1.md).

There are several ways to provide that value. When more than one source has a
value for the same service, the stored secret takes precedence.

| Form                                                                        | What it is                                                   | Use it when                                                                                                      |
| --------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [Stored secrets](#stored-secrets) (`sbx secret set`)                        | A value or dynamic source in your OS keychain, keyed by service | The default for any built-in or kit-declared service                                                          |
| [Custom secrets](#custom-secrets) (`sbx secret set-custom`)                 | A value keyed to a domain and environment variable           | The service model doesn't fit — the agent validates the variable's format, or the secret rides in a request body |
| OAuth                                                                       | A host-side sign-in flow; the token never enters the sandbox | The agent supports it, such as Claude Code, Codex, Cursor, or Droid                                              |
| [Registry credentials](#registry-credentials) (`sbx secret set --registry`) | Authentication for pulling images and kits                   | Pulling templates or kits from a private registry                                                                |

Providing a value and approving its use are separate steps.
[Credential bindings](#credential-bindings) record which mechanisms and domains
you authorize a kit to use. They don't store the credential value.

For multi-provider agents (OpenCode, Docker Agent), the proxy selects
credentials based on the API endpoint being called. See individual
[agent pages](/ai/sandboxes/configuration/agents) for provider-specific details.

## Stored secrets

`sbx secret set` stores credential values or dynamic secret sources in your OS
keychain, keyed on a service identifier. Built-in agents declare a fixed set of
services. Custom kits can declare their own. The same `sbx secret set` flow
works for both.

Secrets whose names start with `mcp:` are reserved for the host's
[MCP gateway](/ai/sandboxes/configuration/mcp-gateway/). See [MCP secrets](#mcp-secrets) for how
these differ from agent and provider credentials.

### Where secrets are stored

The store backing `sbx secret set` depends on your operating system:

- macOS: the system Keychain.
- Windows: the Windows Credential Manager.
- Linux: the Secret Service exposed by your desktop keyring, such as GNOME
  Keyring or KDE Wallet.

The Ubuntu package depends on GNOME Keyring, so a standard desktop install
needs no extra setup.

On Linux hosts without a running Secret Service — headless servers and some WSL
setups — `sbx` falls back to a file under your user config directory
`$XDG_CONFIG_HOME/com.docker.sandboxes`, which defaults to
`~/.config/com.docker.sandboxes` when `$XDG_CONFIG_HOME` is unset. The fallback
is automatic and needs no configuration. When you store a secret this way,
`sbx` prints a notice:

```text
No keychain detected - this secret will be stored on disk, protected by file permissions rather than a password
```

`sbx` stores the file in a directory with `0700` permissions, the same
file-permission model used for `~/.docker/config.json`. Any user or process that
can read the file can retrieve the stored credentials, so treat the directory as
sensitive. Where available, prefer a keychain, which mediates access per
application.

If you start a Secret Service on the host later, `sbx` stores new secrets in the
keychain again. For more on running sandboxes without a desktop keyring, see
[Can I use Docker Sandboxes on headless Linux?](/ai/sandboxes/configuration/faq/#can-i-use-docker-sandboxes-on-headless-linux)

### Store a secret

```console
$ sbx secret set anthropic
```

This prompts you for the secret value interactively. Service secrets are
global by default, so the secret is available to all sandboxes. To scope a
secret to a specific sandbox instead:

```console
$ sbx secret set openai --sandbox my-sandbox
```

Adding, updating, or removing a service secret takes effect in existing local
sandboxes without a restart, including secrets configured with `--command` or
`--ref`. Sandbox-scoped secrets take precedence over global secrets.

### MCP secrets

The MCP gateway uses the same host credential store for OAuth client secrets
and custom request header secrets. These records have names starting with
`mcp:` and appear in `sbx secret ls`. They stay on the host and aren't injected
into sandboxes. The gateway uses them to authenticate connections to MCP
servers on behalf of sandboxed agents.

For setup instructions, see
[OAuth client secrets](/ai/sandboxes/configuration/mcp-gateway/#use-a-pre-registered-oauth-client) and
[custom request headers](/ai/sandboxes/configuration/mcp-gateway/#custom-request-headers). Header
secrets use the global scope and have their own
[restart requirements](/ai/sandboxes/configuration/mcp-gateway/#manage-header-secrets).

### Use a dynamic secret source

Dynamic secret sources let `sbx` retrieve a credential from an authenticated
host tool when the proxy needs it. The secret store contains the reference or
command instead of the credential value. Resolution and caching happen on the
host, and the sandbox still receives only the proxy-managed placeholder.

Use `--ref` with a 1Password secret reference or an AWS Secrets Manager ARN:

```console
$ sbx secret set anthropic --ref 'op://Work/Anthropic/credential'
$ sbx secret set openai \
    --ref 'arn:aws:secretsmanager:us-west-2:123456789012:secret:openai-api-key'
```

The corresponding `op` or `aws` CLI must be installed and authenticated on the
host.

> [!NOTE]
> To resolve a reference with a specific 1Password account or AWS profile, set
> `OP_ACCOUNT` or `AWS_PROFILE` when you run `sbx secret set`. `sbx` uses that
> account or profile whenever it resolves the secret. If neither variable is
> set, the provider CLI uses its default.

Use `--command` for another host tool that prints a secret to standard output:

```console
$ sbx secret set github --command 'gh auth token'
```

`sbx` runs the command through the host shell and trims its output. The command
text is stored and replayed by the daemon. Don't embed a secret directly in the
command because the text can appear in shell history and process listings.

Secret commands run from a fresh temporary directory on the host during
verification and refresh. Relative paths such as `./credential-helper` resolve
from that temporary directory. This applies to both
`sbx secret set --command` and `sbx secret set-custom --command`.

Store helpers and any code or configuration they load outside writable
sandbox mounts. Run a helper by name from an absolute directory on the host's
`PATH`, use its absolute path, or explicitly change to its private directory
in the command. Keep the host's temporary directory outside writable sandbox
mounts as well.

By default, `sbx` verifies the source when you register it and reports an error
without exposing the resolver's standard error. Use `--no-verify` to store a
source that can't be resolved during registration. To troubleshoot an initial
verification failure, use `--show-error`. Provider error output can contain
sensitive information. You can't combine `--show-error` with `--no-verify`.

Resolved service secrets are cached for 55 minutes by default. To change the
cache duration, use `--refresh <duration>`. To resolve the source for every
credential use instead of caching it, pass `--refresh on-demand`:

```console
$ sbx secret set anthropic \
    --ref 'op://Work/Anthropic/credential' \
    --refresh 30m
$ sbx secret set github --command 'gh auth token' --refresh on-demand
```

`--ref` and `--command` are mutually exclusive. They can't be combined with
`--token`, `--oauth`, or `--registry`.

### Import from environment variables

If you already have API keys set in your shell, `sbx secret import` reads them
and stores them in the keychain without typing each value manually:

```console
$ sbx secret import
```

This scans your current session for the environment variables in the
[built-in services table](#built-in-services) below and prompts you to confirm
each one before writing. To import a single service:

```console
$ sbx secret import openai
```

Pass `--all` to import everything without prompting (new entries only; existing
entries are left unchanged), or `--force` to overwrite existing entries:

```console
$ sbx secret import --all
$ sbx secret import openai --force
```

Pass `--dry-run` to preview what would be imported without writing anything.
Run `sbx secret ls` afterwards to confirm what's stored. For setting up
credentials in CI, see [CI and headless use](/ai/sandboxes/configuration/workflows/automation/).

### Built-in services

Each built-in service name maps to the environment variables `sbx secret import`
reads and the API domains the proxy injects credentials into:

| Service      | Environment variables              | API domains                                                                                                                   |
| ------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `anthropic`  | `ANTHROPIC_API_KEY`                | `api.anthropic.com`, `console.anthropic.com`, `claude.ai`, `mcp-proxy.anthropic.com`                                          |
| `cursor`     | `CURSOR_API_KEY`                   | `api2.cursor.sh`, `api3.cursor.sh`, `repo42.cursor.sh`, `cursor.com`                                                          |
| `droid`      | `FACTORY_API_KEY`                  | `api.factory.ai`, `app.factory.ai`, `relay.factory.ai`                                                                        |
| `github`     | `GH_TOKEN`, `GITHUB_TOKEN`         | `api.github.com`, `github.com`, `raw.githubusercontent.com`, `gist.github.com`, `copilot.github.com`, `api.githubcopilot.com` |
| `google`     | `GEMINI_API_KEY`, `GOOGLE_API_KEY` | `generativelanguage.googleapis.com`, `oauth2.googleapis.com`, `aiplatform.googleapis.com`, `vertexai.googleapis.com`          |
| `groq`       | `GROQ_API_KEY`                     | `api.groq.com`                                                                                                                |
| `mistral`    | `MISTRAL_API_KEY`                  | `api.mistral.ai`                                                                                                              |
| `nebius`     | `NEBIUS_API_KEY`                   | `api.studio.nebius.com`, `api.tokenfactory.nebius.com`                                                                        |
| `openai`     | `OPENAI_API_KEY`                   | `api.openai.com`, `openai.com`, `chatgpt.com`, `www.chatgpt.com`                                                              |
| `openrouter` | `OPENROUTER_API_KEY`               | `openrouter.ai`                                                                                                               |
| `xai`        | `XAI_API_KEY`                      | `api.x.ai`                                                                                                                    |

When you store a secret with `sbx secret set <service>`, the proxy injects
it into requests to the listed API domains.

### Services declared by kits

Use the service identifier from the kit's documentation when storing its
credential. For a kit that declares `my-service`, run:

```console
$ sbx secret set my-service
```

There's no separate registration step. The stored value and the kit's request
use the same identifier. Approve the kit's credential request when prompted.
See [Credential bindings](#credential-bindings).

When authoring a kit, declare how it uses that service. V3 uses a credential
capability, and v2 uses a top-level `credentials` list. Both examples declare the
service and permit access to its API host:

**v3**



```yaml
capabilities:
  - type: com.docker.sandbox/network-policy@1
    config:
      runtime:
        allow: [api.my-service.com]
  - type: com.docker.sandbox/credential@1
    config:
      service: my-service
      phase: runtime
      apiKey:
        name: MY_SERVICE_TOKEN
        proxyManaged: true
        inject:
          - domain: api.my-service.com
            header: Authorization
            format: "Bearer %s"
```

For API keys, specify both the HTTP header and its value format, as in this
example. `sbx` doesn't use `apiKey.inject[].scheme` in v3 kits.

For OAuth, use JSON credential files and a provider that returns the refresh
token in `refresh_token`. `sbx` doesn't support TOML credential files or a
different refresh-token field.

Credentials declared for the install phase are available during install hooks.
Add the domains that receive these credentials to the network policy's
`install.allow` list. An entry in `runtime.allow` alone doesn't grant access
during installation. If a hook reads a credential environment variable,
include that name in its `env` list.

In `sbx`, the proxy stops injecting credentials into install-only domains
before the agent launches. A domain remains available for credential injection
if any runtime credential targets it, even under a different service name.
If you declare the same service for both phases, `sbx` uses the runtime
declaration's credential settings in both phases.

**v2**



```yaml
credentials:
  - service: my-service
    apiKey:
      name: MY_SERVICE_TOKEN
      proxyManaged: true
      inject:
        - domain: api.my-service.com
          scheme: bearer

permissions:
  network:
    allow: [api.my-service.com]
```



Each service declares `apiKey`, `oauth`, or both. When both resolve at runtime,
the API key takes precedence and OAuth acts as the fallback. For complete
kit-side configuration, see
[V3 credential definition](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/capabilities/com.docker.sandbox/credential@1.md)
or [V2 credentials](/ai/sandboxes/configuration/customize/kits-v2/#credentials).

### List and remove secrets

List all stored secrets:

```console
$ sbx secret ls
SCOPE      TYPE      NAME      SECRET
(global)   service   github    gho_GCaw4o****...****43qy
```

Remove a secret:

```console
$ sbx secret rm github
```

To remove a sandbox-scoped secret, pass `--sandbox`:

```console
$ sbx secret rm github --sandbox my-sandbox
```

Removing a sandbox-scoped secret restores the global secret for that service,
if one is available.

> [!NOTE]
> Running `sbx reset` deletes all stored secrets along with all sandbox state.
> You'll need to re-add your secrets after a reset.

### GitHub token

The `github` service gives the agent access to the `gh` CLI inside the
sandbox. Resolve your existing GitHub CLI token on the host:

```console
$ sbx secret set github --command 'gh auth token'
```

The daemon refreshes the token from the host command after the default cache
period. This is useful for agents that create pull requests, open issues, or
interact with GitHub APIs on your behalf.

### SSH agent

SSH agent forwarding is enabled by default. When `SSH_AUTH_SOCK` is set,
Docker Sandboxes uses the value from the client that creates, starts, or joins
each sandbox. It forwards that agent into the sandbox and sets `SSH_AUTH_SOCK`
there.

If your agent exposes a stable socket path, such as the 1Password SSH agent,
configure that path for every sandbox:

```console
$ sbx settings set ssh.agentSocketPath "$SSH_AUTH_SOCK"
```

An empty [`ssh.agentSocketPath`](/ai/sandboxes/configuration/credentials/settings/#sshagentsocketpath), which is the
default, uses each client's current `SSH_AUTH_SOCK` instead. Use
[`ssh.agentForwardingEnabled`](/ai/sandboxes/configuration/credentials/settings/#sshagentforwardingenabled) to turn
forwarding on or off.

After changing forwarding or the socket selection, restart the daemon so
existing sandboxes use the new configuration:

```console
$ sbx daemon restart
```

The private keys stay on your host. Processes inside the sandbox can request
signatures from the forwarded agent, but they can't read or copy a private key.

Use SSH agent forwarding for Git operations over SSH and SSH-based commit
signing. The signing key must be loaded in the host SSH agent for sandboxed
commit signing to work. Outbound SSH connections are still subject to sandbox
network policy. For details, see
[Commit signing](/ai/sandboxes/configuration/workflows/git/#commit-signing).

## Custom secrets

> [!IMPORTANT]
> Custom secrets are experimental. Behavior, flags, and the placeholder format may
> change without notice.

For credentials that don't fit the service-identifier model — for example,
when an agent validates the environment variable format at boot, or when the
credential lands in a request body rather than a header — use
`sbx secret set-custom`. The secret is keyed on one or more target domains, an
environment variable name, and an optional placeholder string, instead of a
service identifier.

Prefer the [service-based flow](#stored-secrets) whenever it's an option —
the kit handles the wiring; you only provide the value.

### Set a custom secret

Custom secrets are global by default. Pass `--sandbox` to scope one to a
specific sandbox.

```console
$ sbx secret set-custom \
    --host api.example.com \
    --env API_KEY \
    --value <secret>
```

> [!WARNING]
> Passing the secret as `--value <secret>` records it in your shell history
> and exposes it to other processes running as your user. Avoid pasting
> real credentials inline — read the value from a variable that's already
> in your environment, and clear shell history if a real secret was passed
> on the command line.

Inside the sandbox, `API_KEY` is set to a generated placeholder (for example,
`sbx-cs-<rand>`). When a sandboxed process sends a request to any of the
configured hosts and the placeholder appears anywhere in the request, the
proxy replaces it with the real value. The agent never sees the real secret.

### Target multiple hosts

Repeat `--host` to cover multiple domains with the same secret — useful when
an API is split across related hostnames or when two unrelated endpoints share
a credential:

```console
$ sbx secret set-custom \
    --host api.example.com \
    --host uploads.example.com \
    --env API_KEY \
    --value <secret>
```

A `--host` value can also use wildcards, with the same syntax as
[network rules](/ai/sandboxes/configuration/governance/concepts/#network-rules): `*` matches a
single label (`*.example.com` covers `api.example.com`) and `**` matches any
number (`**.example.com` covers `api.example.com` and `v2.api.example.com`).

### Resolve custom secrets dynamically

Custom secrets also accept [dynamic secret sources](#use-a-dynamic-secret-source).
Replace `--value` with either `--ref` or `--command`:

```console
$ sbx secret set-custom \
    --host api.example.com \
    --env API_KEY \
    --ref 'op://Work/Example/credential'
```

Dynamic custom secrets resolve on demand by default. Pass `--refresh` with a
duration to cache the resolved value. The verification and error-output flags
work the same as they do for service secrets. `--ref` and `--command` can't be
combined with `--value` or `--token`.

### Install npm packages from GitHub Packages

The built-in `github` service doesn't inject credentials into requests to
`npm.pkg.github.com`. To install private npm packages from GitHub Packages,
add a custom secret for that host.

On the host, authenticate the GitHub CLI with a token that can read the package.
GitHub documents a personal access token (classic) with at least `read:packages`
scope for this use. See
[Authenticating to GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages).
Then register the token source, replacing `my-sandbox` with your sandbox's name:

```console
$ sbx secret set-custom \
    --sandbox my-sandbox \
    --host npm.pkg.github.com \
    --env NODE_AUTH_TOKEN \
    --command 'gh auth token'
```

The command prints a generated placeholder. For an existing sandbox, set
`NODE_AUTH_TOKEN` to that placeholder using `sbx run -e` for an agent session,
or `/etc/sandbox-persistent.sh` for future sessions. See
[Set environment variables](/ai/sandboxes/configuration/usage/#set-environment-variables).
Use the placeholder, not the actual GitHub token.

Inside the sandbox, add the following entries to your project's `.npmrc`,
replacing `@my-org` with the package's scope. Keep `${NODE_AUTH_TOKEN}` literal
so npm reads the environment variable:

```ini
@my-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Install the package inside the sandbox:

```console
$ npm install @my-org/my-package
```

Replace `@my-org/my-package` with your package name. npm sends the placeholder
to `npm.pkg.github.com`, and the proxy replaces it with the token retrieved by
`gh auth token` on the host.

## Credential bindings

A credential bindings file records which credential mechanisms and domains
you've approved for each service. It lives at
`~/.config/sbx/credentials.yaml`, or `%APPDATA%\sbx\credentials.yaml` on
Windows.

Third-party kits require an approved binding for each credential they use,
regardless of schema version. `sbx` creates one interactively the first time you
run such a kit (see [First-run approval](#first-run-approval)); you can also
write entries by hand. Credentials requested only by the built-in kits shipped
with `sbx` don't need a binding.

Each entry under `bindings` is keyed by a
[service identifier](#built-in-services) and approves one or both credential
mechanisms:

- `apiKey` — approves injecting the service's stored API key. The value comes
  from the [secret store](#stored-secrets) (`sbx secret set <service>`); the
  binding records approval, it doesn't hold or locate the value.
- `oauth` — approves the OAuth flow for the service. You sign in on the host,
  and the proxy handles token refresh and routing. OAuth domains include the
  token endpoint host and any resource hosts declared by the kit.

Each mechanism takes a `domains` list that records the domains you approved.
`sbx` asks for approval when a kit requests domains that the existing binding
doesn't cover.

```yaml
bindings:
  anthropic:
    apiKey:
      domains: [api.anthropic.com]
  github:
    apiKey:
      domains: [api.github.com, github.com]
```

A binding is only an approval record: the presence of `apiKey` or `oauth`
authorizes that mechanism. Declining a credential writes no entry at all.
The real credential isn't stored in this file.

### First-run approval

When a third-party kit needs a credential that has no binding, `sbx` walks you
through approving one. For an API key, you can use a value already in the secret
store or enter one at the prompt. For OAuth, you approve the sign-in flow. In
both cases, you approve the domains declared by the kit. `sbx` writes the entry
to `credentials.yaml`.

In non-interactive contexts (CI or `--detached`), there's no one to answer the
prompt. In `sbx`, the sandbox starts with the credential withheld when no
binding exists. For a required credential, `sbx` prints a warning rather than
failing sandbox creation. This is a limitation of `sbx` enforcement: kit authors
shouldn't rely on a required credential being available merely because the
sandbox started.

Pre-create the binding by running the kit interactively once or by writing
`credentials.yaml` directly before running unattended.

The bindings file gates whether a third-party kit can use a service
credential. The kit's credential injection rules and network permissions still
constrain which requests can carry the credential.

### Kits that require a binding

Third-party kits require your approval to use credentials, regardless of
schema version. The built-in kits shipped with `sbx` can use credentials they
request without a binding. If a third-party v2 kit extends a built-in agent,
you must approve its use of the inherited credentials. You must also approve
a third-party kit that requests the same service itself.

## Registry credentials

Registry credentials authenticate to private OCI registries when pulling
[templates](/ai/sandboxes/configuration/usage/#load-a-template) or [kits](/ai/sandboxes/customize/), and can
also let the agent pull and push images from inside the sandbox through the
host-side proxy. Use `sbx secret set --registry <host>` to store them. For
Docker Hub, `sbx` reuses your `sbx login` session — no registry secret needed.
For other registries (GitHub Container Registry, ECR, ACR, self-hosted Nexus,
and so on), store credentials with `sbx secret set --registry`.

Choose the scope by adding `--all-sandboxes`, adding `--sandbox SANDBOX`, or
passing neither:

```text
sbx secret set [--all-sandboxes | --sandbox SANDBOX] --registry HOST
```

- **Host-only** (no scope flag): the `sbx` CLI uses it to pull templates
  and kits when creating a sandbox. The credential stays on the host and is
  never available inside the sandbox.
- **All sandboxes** (`--all-sandboxes`): same as host-only, plus the proxy
  authenticates registry login requests from sandboxes. The credential stays
  on the host and is never written to the sandbox filesystem. Use it when
  agents build and publish container images.
- **Sandbox-scoped** (`--sandbox SANDBOX`): same proxy behavior as
  `--all-sandboxes`, but only for the named sandbox. Use it when only one
  sandbox needs registry access.

### Store registry credentials

Pipe a token from stdin and target the registry hostname:

```console
$ gh auth token | sbx secret set --registry ghcr.io --password-stdin
```

For registries that require a username (for example, ACR with an admin
account), add `--username`:

```console
$ echo "$ACR_PASSWORD" | sbx secret set \
    --registry myregistry.azurecr.io \
    --username myuser \
    --password-stdin
```

Add `--all-sandboxes` to make the credential available to every new sandbox:

```console
$ gh auth token | sbx secret set --all-sandboxes --registry ghcr.io --password-stdin
$ sbx run claude
```

Store all-sandboxes registry credentials before creating a sandbox. Existing
sandboxes don't pick up all-sandboxes registry credentials added later. To add
registry access to an existing sandbox, use a sandbox-scoped credential instead.

To scope the credential to a single sandbox, store it under that sandbox's name:

```console
$ gh auth token | sbx secret set --sandbox my-app --registry ghcr.io --password-stdin
```

For v2 kits on Docker Hub, `sbx kit pull` and `sbx kit push` use the session from
`sbx login`. For other registries, both commands use these credentials. Both
commands fall back to the Docker credential store, so credentials from
`docker login` also work. V3 kits are
[published with Docker Buildx](/ai/sandboxes/customize/author/distribute/#publish-an-image),
which uses the credentials from `docker login`.

### Trust a private registry authentication endpoint

Use `--registry-auth-endpoint` with `--registry` when a self-hosted registry
authenticates sandbox requests through a separate host. For example, a
self-hosted GitLab registry at
`registry.example.com` might advertise `https://gitlab.example.com/jwt/auth`
as the `realm` in its Registry v2 `WWW-Authenticate: Bearer` challenge.

Store the credential and trust that endpoint for a specific sandbox:

```console
$ echo "$GITLAB_PAT" | sbx secret set --sandbox my-app \
    --registry registry.example.com \
    --username "$GITLAB_USER" \
    --registry-auth-endpoint https://gitlab.example.com/jwt/auth \
    --password-stdin
```

Replace the example hosts with your registry and authentication hosts, and set
`GITLAB_USER` and `GITLAB_PAT` to your GitLab username and personal access token.

This authorizes the proxy to send the stored registry credential to
`https://gitlab.example.com/jwt/auth` to exchange it for a registry token. The
advertised realm must use HTTPS and match the configured host and path exactly.
Other paths on that host, including `/jwt/auth/`, aren't covered. The endpoint
URL must contain no embedded credentials, query string, or fragment. Token
requests can still include protocol parameters such as `service` and `scope`.

Without this flag, the proxy accepts authentication endpoints on the registry's
own host and built-in registry relationships, such as Docker Hub's authentication
host. Other authentication hosts require explicit configuration.

### Remove registry credentials

Remove both the host-only and all-sandboxes entries for a registry:

```console
$ sbx secret rm --registry ghcr.io -f
```

To remove only the all-sandboxes entry and leave the host-only credential in
place, pass `--all-sandboxes`:

```console
$ sbx secret rm --all-sandboxes --registry ghcr.io -f
```

To remove a sandbox-scoped credential, pass the sandbox name:

```console
$ sbx secret rm --sandbox my-sandbox --registry ghcr.io -f
```

## Best practices

- Use [stored secrets](#stored-secrets) to provide credentials. The OS keychain
  protects them at rest; on Linux hosts without a keychain they are held in a
  permission-protected file instead. See
  [Where secrets are stored](#where-secrets-are-stored).
- Don't set API keys manually inside the sandbox. Sandbox agents are
  pre-configured to use proxy-managed credentials.
- Registry credentials stay on the host and are injected by the proxy when a
  sandbox authenticates to the registry. Reserve them for sandboxes that need
  registry access, and prefer sandbox scope over `--all-sandboxes` to limit
  exposure.
- Several agents support OAuth as another secure option: the flow runs on the
  host, so the token is never exposed inside the sandbox. If you haven't stored
  a credential, the agent prompts you to authenticate — Codex prompts on the
  host from `sbx run codex`, while Claude Code, Cursor, and Droid prompt
  interactively inside the sandbox. To authenticate ahead of time, run
  `sbx secret set openai --oauth` for Codex or use `/login` inside Claude
  Code; Cursor and Droid have no ahead-of-time option, so their sign-in prompt
  appears when the agent starts. See the individual [agent pages](/ai/sandboxes/configuration/agents)
  for each agent's flow.
- If you store credentials in 1Password or AWS Secrets Manager, see
  [Sourcing credentials from 1Password](/ai/sandboxes/configuration/workflows/authentication/#source-credentials-from-1password)
  and [Sourcing credentials from AWS Secrets Manager](/ai/sandboxes/configuration/workflows/authentication/#source-credentials-from-aws-secrets-manager).

## Custom templates and placeholder values

When building custom templates or installing agents manually in a shell
sandbox, some agents require environment variables like `OPENAI_API_KEY` to be
set before they start. Set these to placeholder values (e.g. `proxy-managed`)
if needed. The proxy injects actual credentials regardless of the environment
variable value.

<!-- page: https://docs.docker.com/ai/sandboxes/configuration/environment-files/ fetched 2026-10-08 -->

# Sandbox environment files


A sandbox environment file captures the setup for a local or cloud sandbox in a
`sbxenv.yaml` file. Share the file with project contributors so they use the
same agent, tools, resources, and credentials without reproducing CLI flags and
setup steps.

> [!NOTE]
> `sbx env` is experimental. The command interface and file format may change.

The examples on this page use local sandboxes unless stated otherwise. For
cloud configuration and lifecycle differences, see
[Use a cloud environment](#use-a-cloud-environment).

## Start an environment

Keep the environment file outside the directories you mount into the sandbox.
That includes the primary workspace and every `additionalWorkspaces` mount.
For example, place it beside your project:

```text
web-app-env/
├── sbxenv.yaml
└── web-app/
```

Create `web-app-env/sbxenv.yaml`. This example gives the agent a shared
environment variable and the Playwright browser-testing tools. It also
publishes the application's development port:

```yaml
schemaVersion: "1"
name: web-app
agent: claude
workspace: ./web-app

kits:
  - docker.io/sbx/playwright-kit:latest

env:
  NODE_ENV: test

ports:
  - sandbox: 3000
    host: 3000
```

From `web-app-env`, run the environment:

```console
$ sbx env run
```

`sbx` shows an environment plan and asks you to approve it. If you approve the
plan, the `web-app` directory becomes the workspace, while `sbxenv.yaml` remains
outside the sandbox. If the environment doesn't exist, `sbx` creates a sandbox
named `web-app`, installs Playwright and Chromium, and publishes sandbox port
`3000` on the host. It then attaches to the agent. Later runs attach to the
existing sandbox.

This placement keeps the environment file outside the agent's writable
workspace. If you later add `additionalWorkspaces`, keep `sbxenv.yaml`
outside those directories too. See the [`workspace` guidance](#workspace)
for details.

## Commands

| Command                                                                       | Description                                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `sbx env plan [PATH...]`                                                       | Shows what applying the environment would change without changing or approving it    |
| [`sbx env run`](/reference/cli/sbx/env/run/) `[PATH...]`                      | Applies the approved plan, creates the environment if needed, and attaches            |
| [`sbx env create`](/reference/cli/sbx/env/create/) `[PATH...]`                | Applies the approved plan and creates the environment without attaching              |
| [`sbx env exec`](/reference/cli/sbx/env/exec/) `[PATH...] -- COMMAND [ARG...]` | Runs a command in an existing environment without running lifecycle commands         |
| [`sbx env rm`](/reference/cli/sbx/env/rm/) `[PATH...]`                        | Shows a destroy plan, then removes the sandbox and resources named in the plan        |

To use an environment file, pass its path to `sbx env`. If you pass a
directory, `sbx` looks for `sbxenv.yaml` inside it. If you don't pass a path,
`sbx` looks in the directory you run the command from and loads your
[user defaults](#set-user-defaults), if present.

Every `sbx env` subcommand accepts `--name`. This flag sets the sandbox name
for that command, overriding the `name` field in the file or the automatically
generated name:

```console
$ sbx env create --name web-app-test
$ sbx env exec --name web-app-test -- npm test
$ sbx env rm --name web-app-test
```

Use the same file paths for each command. If you set `--name`, use that same
name for every command that manages the sandbox.

### Set user defaults

Create `~/.sbxenv.yaml` to share settings across your projects. For example,
this file selects Claude as the agent and mounts the directory you run
`sbx env` from:

```yaml
schemaVersion: "1"
agent: claude
workspace: ${{ env.projectDir }}
```

With this file saved in your home directory, run:

```console
$ cd /projects/web-app
$ sbx env run
```

The sandbox mounts `/projects/web-app` as its workspace. Run the same command
from `/projects/api`, and it mounts `/projects/api` instead. You don't need a
separate `sbxenv.yaml` in either project.

If the project has a `sbxenv.yaml`, `sbx` combines it with your user defaults.
Project settings override individual default values. Lists such as `ports`
and `mcp.servers` combine entries from both files. If you pass a file or
directory path to the command, `sbx` skips `~/.sbxenv.yaml`.

In `~/.sbxenv.yaml`, you can set `workspace` to `${{ env.projectDir }}` or a
subdirectory such as `${{ env.projectDir }}/src`. Other workspace paths
aren't accepted in this file.

The user defaults file cannot set `name`. Set the sandbox name in a project
environment file or with `--name`.

### Reference directories

You can use `${{ env.projectDir }}` and `${{ env.fileDir }}` in environment
files to insert absolute directory paths. They refer to directories on the
host.

#### Project directory

`${{ env.projectDir }}` is the absolute path to your project directory.
`sbx` chooses this directory from the command you run:

- `sbx env run`: the directory you run the command from.
- `sbx env run /projects/web-app`: `/projects/web-app`.
- `sbx env run /projects/web-app/custom.yaml`: `/projects/web-app`, the
  directory containing the file.

If you pass several paths, the first one sets the project directory. Every
file loaded by that command uses the same value for `env.projectDir`.

Use this reference in shared settings that need to point to each project's
files. For example, `workspace: ${{ env.projectDir }}/src` mounts the `src`
directory in whichever project you select.

#### File directory

`${{ env.fileDir }}` is the absolute path to the directory containing the
environment file where you write the reference. For example, inside
`/shared/environment.yaml`, its value is `/shared`.

Use this reference when an environment file needs to locate files stored
alongside it. For example, suppose your setup script is
`/shared/scripts/setup.sh`. Add this [lifecycle command](#lifecycle) to
`/shared/environment.yaml` to run the script from `/shared`:

```yaml
lifecycle:
  initialize:
    - command: ./scripts/setup.sh
      workdir: ${{ env.fileDir }}
```

The command runs from `/shared`, even if you use this environment file with
a project in another directory.

Relative workspace paths already use the directory containing the environment
file. For example, `workspace: ./src` in `/shared/environment.yaml` mounts
`/shared/src`.

Both directory references can appear in YAML values, but not in field names
or inside the `args` block.

### Parameterize an environment

Declare inputs in a top-level `args` block when values need to vary between
uses of the same environment file. Each argument must have exactly one of
`default` or `required: true`:

```yaml
schemaVersion: "1"
name: web-app
agent: claude

args:
  channel:
    default: stable
    description: Release channel
    enum:
      - stable
      - beta
  endpoint:
    required: true
    description: API endpoint
  cpus:
    default: "4"
    pattern: "[1-9][0-9]*"

env:
  RELEASE_CHANNEL: ${{ env.args.channel }}
  API_ENDPOINT: ${{ env.args.endpoint }}

sandboxOptions:
  cpus: ${{ env.args.cpus }}
```

Reference a declared argument as `${{ env.args.NAME }}` anywhere a YAML value
can appear. References can't be used in field names or within the `args` block.
An unquoted reference is interpreted as a YAML value after substitution, so
the `cpus` value in this example becomes an integer. Quote a reference to
preserve it as a string.

All `sbx env` commands accept repeatable `--env-arg NAME=VALUE` flags. Values
provided with a flag replace defaults from the environment file:

```console
$ sbx env run --env-arg endpoint=https://api.example.com --env-arg channel=beta
```

Use `--env-args-file` to load values from a file. Each non-empty, non-comment
line must have the form `NAME=VALUE`:

```text
# production.args
channel=beta
endpoint=https://api.example.com
```

```console
$ sbx env run --env-args-file production.args
```

You can pass multiple argument files. Later files take precedence over earlier
files, and `--env-arg` flags take precedence over every argument file.
Values can contain `=`, and values in an argument file are read literally
rather than expanded by a shell.

Argument references and the two directory references are the only variable
expressions expanded in an environment file. Shell-style expressions such as
`${VAR}` aren't expanded from the host environment. Other dollar signs remain
literal, so a value such as `$PATH:/opt/bin` is passed unchanged.
Use `$${{ env.args.NAME }}` to produce the literal text `${{ env.args.NAME }}`. Substituted values aren't expanded a
second time.

## Common workflows

The following examples combine environment file fields into configurations you
can adapt for a project.

### Combine team defaults and personal settings

Keep the shared configuration in a version-controlled environment directory
outside the mounted workspace. Put machine-specific settings in a file excluded
from version control. For example, commit `base.sbxenv.yaml` beside the
`web-app` directory:

```yaml
schemaVersion: "1"
name: web-app
agent: claude
workspace: ./web-app

env:
  NODE_ENV: development

sandboxOptions:
  cpus: 4
  memory: 8g
```

Add `local.sbxenv.yaml` to `.gitignore`, then use it for personal settings:

```yaml
env:
  LOG_LEVEL: debug

sandboxOptions:
  memory: 12g
```

Pass both files in merge order:

```console
$ sbx env run base.sbxenv.yaml local.sbxenv.yaml
```

Nested mappings merge by key, lists concatenate, and values from later files
replace earlier scalar values. In this example, the sandbox has four CPUs,
12 GB of memory, and both environment variables. Each relative workspace path
resolves from the directory of the file that declares it.

### Work across multiple repositories

Mount related repositories alongside the primary project when the agent needs
to coordinate changes or consult shared code and documentation:

```yaml
# sbxenv.yaml in the directory above the repositories
schemaVersion: "1"
name: web-platform
agent: codex

workspace: ./web-app

additionalWorkspaces:
  - path: ./shared-components
  - path: ./architecture-docs
    readOnly: true
```

The agent starts in `web-app`, can modify `shared-components`, and can read
`architecture-docs` without changing it. The environment file stays outside all
three workspaces. Relative paths resolve from the directory of the
environment file that declares them. Additional workspaces are mounted directly
even when the primary workspace uses clone mode.

### Reuse an environment in automation

Use the same committed environment for interactive development and automated
tasks. Developers attach to the agent with `run`:

```console
$ sbx env run
```

Automation can create the sandbox without attaching, run commands in it, and
remove it afterward:

```console
$ sbx env create --auto-approve
$ sbx env exec -- npm test
$ sbx env rm --force
```

`--auto-approve` approves the plan for that invocation without recording
consent for later invocations. Use the flag for each unattended `create` or
`run`. The `--force` flag approves the destroy plan and removes the sandbox even
when it is in use.

Commands and vault references under `secrets` resolve on the host, so the
automation runner must provide the referenced tools and authentication. The
secret values remain outside the environment file.

### Use a cloud environment

Use `sbx --cloud env` to manage a cloud sandbox from an environment file. For
account and CLI requirements, see [Cloud sandboxes](/ai/sandboxes/configuration/cloud/).

Save this as `cloud.sbxenv.yaml`:

```yaml
schemaVersion: "1"
name: cloud-project
agent: shell

env:
  PROJECT_NAME: example

sandboxOptions:
  cpus: 2
  memory: 4g
```

Review the plan, create the sandbox without attaching, and run a command:

```console
$ sbx --cloud env plan ./cloud.sbxenv.yaml
$ sbx --cloud env run --detached ./cloud.sbxenv.yaml
$ sbx --cloud env exec ./cloud.sbxenv.yaml -- printenv PROJECT_NAME
```

Cloud environments support agents and kits, environment variables, CPU and
memory limits, credentials for supported providers, and host lifecycle commands.
Resource limits must match a [cloud size](/ai/sandboxes/configuration/cloud/usage/#choose-resources-and-platform).
Lifecycle commands still run on your machine with your privileges.

Remove `workspace`, `additionalWorkspaces`, clone options, `ports`, `registries`,
and MCP server definitions from a local file before using it in cloud mode.
Cloud environments also reject local sandbox options such as GPU, USB,
display, shared skills, templates, and governance profiles. These checks run
before host commands or provisioning. Transfer project files with
[`sbx --cloud cp`](/ai/sandboxes/configuration/cloud/usage/#transfer-files) or clone a repository inside
the sandbox.

The plan shows inherited cloud credentials. Sandbox-scoped credentials override
account defaults, and credentials declared in `secrets` override both. Declare
literal values or use [`snapshot: true`](#secrets) to resolve a host command or
vault reference once. Dynamic secret sources and custom credential providers
aren't supported. Credential bindings require cloud support for kit credentials
and explicit approval of the kit's injection domains.

Changes to secrets and bindings require recreating the sandbox. Updated `env`
values apply to subsequent sessions. Rejoining a running agent keeps that
process's environment.

Use the same machine, Docker identity, cloud endpoint, and ordered file paths
for later commands. `sbx login` keeps environment state associated with your
Docker identity. With `DOCKER_ACCESS_TOKEN`, changing the token starts a separate
state scope.

Remove the environment when you're finished:

```console
$ sbx --cloud env rm ./cloud.sbxenv.yaml
```

Removal deletes the sandbox and only the secrets provisioned by this
environment. Inherited secrets remain. Global bindings remain unless you pass
`--prune-bindings`. For unattended runs, use `--auto-approve` with `create` or
`run`, and `--force` with `rm`.

If creation is interrupted, retry the same command and unchanged declaration
within 23 hours. Unresolved requests prevent removal. Follow the recovery
message and retain its journal until the original requests are resolved.

## Review an environment plan

`sbx env create`, `sbx env run`, and `sbx env rm` show the changes an
environment makes outside its sandbox and ask for approval before applying
them. The plan includes host commands, credentials, bindings, MCP
registrations, directories, kits, published ports, sandbox options, and
environment variables.

Run `sbx env plan` to inspect the apply plan without changing, approving, or
recording anything:

```console
$ sbx env plan
```

The plan compares the environment file with the environment's last applied
state and the resources on the host. It omits resources that are unchanged and
already approved. Literal secret values appear as SHA-256 digests. Secret
references, host commands, environment variables, ports, paths, and binding
domains remain visible so you can review them.

Interactive approval is recorded for the environment under the `sbx` state
directory. Plans without host commands apply silently on later invocations until
the environment changes or a resource is missing. An approval provided with
`--auto-approve` applies only to that invocation.

## Update an environment

For an existing sandbox, `sbx env run` applies updated `env` values to the new
agent session and reconciles declared MCP servers. Changes to workspaces, kits,
ports, secrets, bindings, and `sandboxOptions` take effect only when the
sandbox is next created. Remove the environment with `sbx env rm`, then create
it again to apply those changes.

## Remove an environment

Secrets and registry credentials are sandbox-scoped. Credential bindings and
MCP server registrations are host-global and can be shared by multiple
sandboxes.

`sbx env rm` builds a destroy plan from the resources on the host. The plan
includes all credentials stored at the sandbox's scope, including credentials
that the environment file no longer declares. After approval, `sbx` removes
only the resources named in the plan.

Global credential bindings remain unless you pass `--prune-bindings`. MCP
registrations remain available to other sandboxes.

### Clean up after a failed create

Secret provisioning, binding updates, and MCP server registration occur before
the sandbox is created. If sandbox creation fails, scoped secrets remain, and
bindings and MCP registrations may also remain. Run `sbx env rm` with the same
paths to remove the scoped secrets. Pass `--prune-bindings` if you also want to
remove the declared global bindings. MCP registrations are host-global and
remain after cleanup.

## File reference

### Top-level fields

| Field                  | Type             | Required | Default                        | Description                                                                     |
| ---------------------- | ---------------- | -------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `schemaVersion`        | string           | Yes      | None                           | Schema version. The supported value is `"1"`                                   |
| `name`                 | string           | No       | `<agent>-<workspace-basename>` | Sandbox name, overridden by `--name`                                                                    |
| `agent`                | string           | Yes      | None                           | Built-in agent or the name of an agent kit                                      |
| `args`                 | map              | No       | None                           | Environment arguments. See [`args`](#args)                                      |
| `kits`                 | list             | No       | None                           | Kits to install at creation. See [`kits`](#kits)                                 |
| `workspace`            | string or object | No       | No host mount                  | Primary workspace. See [`workspace`](#workspace)                                |
| `additionalWorkspaces` | list             | No       | None                           | Extra directories to mount. See [`additionalWorkspaces`](#additionalworkspaces) |
| `env`                  | map of strings   | No       | None                           | Environment variables for the sandbox                                           |
| `sandboxOptions`       | object           | No       | None                           | Creation options. See [`sandboxOptions`](#sandboxoptions)                        |
| `secrets`              | map              | No       | None                           | Service credentials. See [`secrets`](#secrets)                                  |
| `bindings`             | map              | No       | None                           | Credential injection approvals. See [`bindings`](#bindings)                     |
| `registries`           | map              | No       | None                           | Registry pull credentials. See [`registries`](#registries)                      |
| `mcp`                  | object           | No       | None                           | MCP servers. See [`mcp`](#mcp)                                                  |
| `ports`                | list             | No       | None                           | Port mappings. See [`ports`](#ports)                                            |
| `lifecycle`            | object           | No       | None                           | Host commands. See [`lifecycle`](#lifecycle)                                    |

### `args`

`args` maps argument names to their declarations. Names must start with a
letter or underscore and can contain letters, numbers, underscores, and
hyphens. Each declaration must set exactly one of `default` or `required:
true`.

| Field         | Type            | Default | Description                                                       |
| ------------- | --------------- | ------- | ----------------------------------------------------------------- |
| `default`     | string          | None    | Value used when the command doesn't supply the argument           |
| `required`    | boolean         | `false` | Require the command to supply the argument                         |
| `description` | string          | None    | Explanation shown in command output                               |
| `enum`        | list of strings | None    | Values accepted for the argument                                  |
| `pattern`     | string          | None    | Go (`RE2`) expression matched against the complete argument value |

`enum` and `pattern` can't be used together.

### `kits`

`kits` accepts local directories, ZIP archives, OCI registry references, and
Git URLs prefixed with `git+https://` or `git+ssh://`. Kits can install tools,
configure the sandbox, and give the agent project-specific instructions.
The examples on this page pair built-in agents with v2 mixins. See
[Kits v2](/ai/sandboxes/customize/kits-v2/) for that format, or
[Version compatibility](/ai/sandboxes/customize/#version-compatibility)
when selecting v3 kits.

An environment file selects kits and configures a sandbox's host resources.
A kit descriptor defines the package itself. The environment file's
`schemaVersion` is independent of the schema version in a kit descriptor.

Explicit relative paths resolve from the directory of the environment file
that declares them. These include `.`, `..`, paths that start with `./` or
`../`, and relative paths that end in `.zip`. Bare references such as
`organization/kit` remain registry references.

Use an object entry to pass arguments to a kit. Set `source` to the kit
reference and map the kit's argument names to values under `args`:

```yaml
kits:
  - source: ./kits/tool
    args:
      version: ${{ env.args.channel }}
```

Remote kit sources must match the
[`kit.allowedSources`](/ai/sandboxes/configuration/environment-files/settings/#kitallowedsources) setting. Docker Hub is
allowed by default. To use Git kits from `docker/sbx-kits-contrib`, add its
source:

```console
$ sbx settings set kit.allowedSources '["docker.io/","github.com/docker/"]'
```

The setting replaces the complete allowlist, so include any existing sources
you want to keep. For reproducible setup, pin Git kits with the `ref` URL
parameter and OCI kits with an immutable tag or digest.

### `workspace`

When specified as a string, `workspace` is the path. Use the object form for
clone mode. Omit `workspace` to create a sandbox without a host bind mount. Set
`workspace: .` to mount the directory that contains the environment file
that declares it.

`sbx` mounts the environment file read-only inside the sandbox. Keep the file
outside direct-mounted workspaces or directly in a workspace root.

| Field   | Type    | Required | Default | Description                                                     |
| ------- | ------- | -------- | ------- | --------------------------------------------------------------- |
| `path`  | string  | Yes      | None    | Workspace directory. Relative paths resolve from the declaring file's directory |
| `clone` | boolean | No       | `false` | Use a private clone, equivalent to `sbx create --clone`          |

You can override `workspace.clone` for one `create` or `run` invocation with
`--clone` or `--clone=false`.

### `additionalWorkspaces`

Each additional workspace is mounted after the primary workspace. Relative
paths resolve from the directory of the environment file that declares them.

| Field      | Type    | Required | Default | Description                   |
| ---------- | ------- | -------- | ------- | ----------------------------- |
| `path`     | string  | Yes      | None    | Directory to mount            |
| `readOnly` | boolean | No       | `false` | Mount the directory read-only |

### `sandboxOptions`

| Field         | Type            | Default  | Description                                           |
| ------------- | --------------- | -------- | ----------------------------------------------------- |
| `template`    | string          | None     | Custom sandbox template image                         |
| `memory`      | string          | None     | Memory limit, such as `8g` or `512m`                   |
| `cpus`        | integer         | `0`      | Number of CPUs. `0` selects the host default            |
| `pullPolicy`  | string          | `always` | Image pull policy: `always`, `missing`, or `never`     |
| `profile`     | string          | None     | Governance profile name                               |
| `skills`      | string          | Daemon default | Shared agent skills store access: `off`, `readonly`, or `readwrite` |
| `display`     | boolean         | `false`  | Provision a display socket for graphical applications |
| `gpu`         | boolean         | `false`  | Pass the host GPU through to the sandbox               |
| `usb`         | list of strings | None     | USB device selectors to pass through to the sandbox   |

For local sandboxes, `cpus: 0` allocates all host CPUs, except on Linux arm64
hosts, where the default is capped at 16. Set `cpus` to an explicit count to
request a larger allocation, up to the number of available host CPUs. When creating a sandbox directly with
`sbx create` or `sbx run`, use `--cpus` for the same override. Cloud resource
limits must match a [cloud size](/ai/sandboxes/configuration/cloud/usage/#choose-resources-and-platform).

`skills` controls access to the shared [agent skills](/ai/sandboxes/configuration/workflows/agent-skills/)
store. Set it to `off` to omit the mount, `readonly` to mount the store read-only,
or `readwrite` to let the sandbox modify shared skills. If omitted, it uses the
daemon's default, which is `readonly` unless your organization overrides it.

### `lifecycle`

The `lifecycle` block declares commands that run on the host with your user
privileges. Use lifecycle commands for work that must happen outside the
sandbox, such as creating a workspace, seeding fixtures, or archiving state.

```yaml
lifecycle:
  initialize:
    - name: Prepare workspace
      command: test -d web-app || git clone https://github.com/example/web-app
      timeout: 5m
  postCreate:
    - command: ./scripts/seed-fixtures.sh
      workdir: web-app
  preRemove:
    - command: ./scripts/archive-state.sh
```

Lifecycle phases run at the following points:

| Phase        | Timing                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `initialize` | Before other create or run actions. Runs for every `create` and `run`                                             |
| `postCreate` | After a new sandbox is created. For `run`, before attachment. Does not run when attaching to an existing sandbox   |
| `preRemove`  | After you approve removal and before `sbx` deletes resources. A failure produces a warning and removal continues  |

`sbx env exec` doesn't run lifecycle commands. Commands within a phase run in
order and stop at the first failure. Make `initialize` commands safe to run
more than once.

After `preRemove` commands finish, `sbx` generates the destroy plan again.
Removal stops if the commands introduced changes that weren't included in the
approved plan.

Each command requires `command` and accepts the following fields:

| Field     | Type   | Default           | Description                                                                    |
| --------- | ------ | ----------------- | ------------------------------------------------------------------------------ |
| `name`    | string | Command text      | Label shown in progress and plan output                                        |
| `command` | string | None              | Command passed to the user's shell                                             |
| `workdir` | string | Project directory | Host working directory. Relative paths resolve from the first file's directory |
| `timeout` | string | None              | Maximum runtime, such as `90s` or `5m`                                         |

Commands inherit the environment of the `sbx` process and receive the following
variables:

- `SBX_LIFECYCLE_PHASE`
- `SBX_ENV_FILE` and `SBX_ENV_FILES`
- `SBX_ENV_DIR`
- `SBX_SANDBOX_NAME`
- `SBX_AGENT`
- `SBX_WORKSPACE`

The environment file's `env` values and resolved secrets aren't passed to host
commands.

Plans containing lifecycle commands or credential `command` sources require
approval for every invocation by default, even when the command text hasn't
changed. Approve one invocation with `--auto-approve`, skip lifecycle commands
with `--skip-host-commands`, or turn on
[`env.rememberHostCommands`](/ai/sandboxes/configuration/environment-files/settings/#envrememberhostcommands) to remember
approval until the commands change:

```console
$ sbx settings set env.rememberHostCommands true
```

### `secrets`

`secrets` maps service names to secret sources. Each entry must set exactly one
of `value`, `ref`, or `command`. The secret is stored at the sandbox scope when
the environment is created.

| Field      | Type    | Default | Description                                                                  |
| ---------- | ------- | ------- | ---------------------------------------------------------------------------- |
| `value`    | string  | None    | Literal secret value                                                         |
| `ref`      | string  | None    | Vault URI, such as `op://Vault/Item/field`                                    |
| `command`  | string  | None    | Host shell command whose standard output becomes the secret                   |
| `snapshot` | boolean | `false` | Resolve `ref` or `command` once on the host and store the result as a literal |
| `refresh`  | string  | None    | Resolution policy for `ref` or `command`, such as `on-demand` or `55m`        |
| `backend`  | string  | Automatic | Resolver for `ref`: `sdk` or `cli`                                          |
| `noVerify` | boolean | `false` | Skip verifying that a `ref` or `command` resolves during provisioning          |

> [!WARNING]
> A literal `value` is visible to anyone with read access to the file. Use a
> vault URI with `ref` or obtain the value at runtime with `command`.

```yaml
secrets:
  anthropic:
    ref: op://Private/Anthropic/api-key
    refresh: 55m
  github:
    command: gh auth token
```

Secret commands execute from a fresh temporary directory on the host. Relative
helper paths resolve from that directory. Keep helpers and their dependencies
outside writable sandbox mounts. Use an absolute path, an absolute host
`PATH` entry, or an explicit change to the helper's private directory. See
[dynamic secret sources](/ai/sandboxes/configuration/environment-files/credentials/#use-a-dynamic-secret-source).

For a cloud environment, set `snapshot: true` on a `ref` or `command` source:

```yaml
secrets:
  github:
    command: gh auth token
    snapshot: true
```

The command runs on the host after plan approval. The resolved value is stored
as a literal secret and doesn't refresh. Recreate the environment to rotate
it. Snapshots also work with local environments. A snapshot can't set
`refresh` or `noVerify`. Cloud snapshots use CLI resolvers for vault references
and don't support `backend: sdk`.

### `bindings`

`bindings` approves credential injection domains for each service. The
environment merges these approvals into the user's global
`credentials.yaml`. Each service can contain an `apiKey` block, an `oauth`
block, or both. Each block contains a `domains` list:

```yaml
bindings:
  github:
    apiKey:
      domains:
        - api.github.com
```

`sbx env rm` preserves global bindings by default. Pass `--prune-bindings` to
remove every service binding declared by the environment file.

> [!WARNING]
> `--prune-bindings` deletes the complete global binding entry for every
> service declared in the environment file. This can affect other sandboxes
> that share those service bindings.

### `registries`

`registries` maps registry hostnames to pull credentials. Each entry requires
`secret` and accepts an optional `username`. Both fields accept a secret source
with exactly one of `value`, `ref`, or `command`.

When `username` is omitted, `sbx` stores a token-only credential. Registries
such as GHCR and GitLab accept token-only credentials.

```yaml
registries:
  ghcr.io:
    secret:
      command: gh auth token
```

### `mcp`

The `mcp.servers` list registers servers with the built-in
[MCP gateway](/ai/sandboxes/configuration/mcp-gateway/) and adds them to the sandbox. MCP registrations
are host-global and remain after `sbx env rm`.

| Field     | Type            | Required | Default | Description                                                     |
| --------- | --------------- | -------- | ------- | --------------------------------------------------------------- |
| `name`    | string          | Yes      | None    | Server name                                                     |
| `url`     | string          | No       | None    | Remote server URL, registry reference, or OCI reference          |
| `command` | string          | No       | None    | Command for a local stdio server                                 |
| `args`    | list of strings | No       | None    | Arguments passed to `command`                                   |

Each server must set exactly one of `url` or `command`.

### `ports`

`ports` publishes sandbox ports when the environment is created. Ports exposed
by a kit but omitted from this list receive an ephemeral host port.

| Field      | Type    | Required | Default                              | Description                                     |
| ---------- | ------- | -------- | ------------------------------------ | ----------------------------------------------- |
| `sandbox`  | integer | Yes      | None                                 | Sandbox port from 1 through 65535               |
| `host`     | integer | No       | Ephemeral                            | Host port from 1 through 65535                  |
| `protocol` | string  | No       | `tcp4`, or `tcp6` for IPv6 `hostIP` | `tcp`, `tcp4`, `tcp6`, `udp`, `udp4`, or `udp6` |
| `hostIP`   | string  | No       | Loopback                             | Host interface to bind                          |

Set `protocol: tcp` to bind both IPv4 and IPv6. Leave `hostIP` unset for a
dual-stack binding because an explicit address binds only its own IP family.

If a port can't be published, sandbox creation fails and removes the new
sandbox.

<!-- page: https://docs.docker.com/ai/sandboxes/configuration/gpu-passthrough/ fetched 2026-10-08 -->

# Enable NVIDIA GPU passthrough


> [!IMPORTANT]
> GPU passthrough is experimental. The `--gpu` flag, the driver bundle, and the
> setup steps on this page are subject to change.

GPU passthrough in local Docker Sandboxes runs workloads on a physical NVIDIA
GPU.

GPU passthrough in Docker sandboxes works via [VFIO](https://www.kernel.org/doc/html/latest/driver-api/vfio.html), a Linux feature
that assigns a PCI device directly to a virtual machine. The GPU is
bound to VFIO instead of the host's driver, and the sandboxed workload
drives the hardware itself.

## Requirements

VFIO-based GPU passthrough is supported only on `x86_64` Linux hosts (not Arm)
with NVIDIA GPUs, and requires a GPU that nothing else is using: a headless
host with a GPU, or an additional GPU.

The host also needs IOMMU turned on in its BIOS, and the `iommufd` and
`vfio_pci` kernel modules loaded:

```console
sudo modprobe -a iommufd vfio_pci
```

For the sandbox to drive the GPU, it requires:

- The `nvidia` and `nvidia-uvm` kernel modules, built for the Docker Sandboxes
  guest kernel
- The NVIDIA userspace driver libraries and firmware

Docker Sandboxes looks for these dependencies, packaged as an EROFS image, at
`/usr/libexec/nerdbox-nvidia-bundle.erofs`. This bundle isn't included with
Docker Sandboxes. To build it, see [Build the bundle](#build-the-bundle).

## Turn on the feature

The `--gpu` flag is hidden until you turn on experimental features and the GPU
feature flag:

```console
sbx settings set platform.allowExperimentalFeatures true
sbx settings set feature.sandbox-gpu true
```

## Build the bundle

A zip archive containing all the components required to build the bundle is
published with each Docker Sandboxes release, as
`nerdbox-nvidia-modules-x86_64.zip`. The archive contains the kernel modules
(`nvidia.ko` and `nvidia-uvm.ko`), the driver version they were built against
(`VERSION`), and a build script.

The build script runs a `linux/amd64` container that downloads the matching
NVIDIA driver, assembles the bundle, and installs it to
`/usr/libexec/nerdbox-nvidia-bundle.erofs`. Writing to that path requires root,
hence the `sudo` in the following commands.

Prerequisites:

- Network access to `download.nvidia.com`
- Docker

Download and unpack the archive, then run the script from the unpacked
directory:

```console
curl -fSLO https://github.com/docker/sbx-releases/releases/latest/download/nerdbox-nvidia-modules-x86_64.zip
unzip nerdbox-nvidia-modules-x86_64.zip -d nvidia-modules
cd nvidia-modules
sudo ./prepare-nvidia-bundle.sh
```

If the script can't write to the output path, it leaves the bundle in the
current directory and prints the `install` command that finishes the job.

Two environment variables override the script's default behavior:

| Variable                | Default                                    | Purpose                                                                       |
| ----------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| `OUTPUT`                | `/usr/libexec/nerdbox-nvidia-bundle.erofs` | Where the finished bundle is written.                                         |
| `ACCEPT_NVIDIA_LICENSE` | None                                       | Set to `1` to accept the NVIDIA license non-interactively, for scripts or CI. |

For example, the following command writes the finished bundle to
`/mnt/some-place/nerdbox-nvidia-bundle.erofs`:

```console
OUTPUT=/mnt/some-place/nerdbox-nvidia-bundle.erofs ./prepare-nvidia-bundle.sh
```

## Install the bundle

If you ran the script on the `x86_64` Linux host that runs your GPU sandboxes,
and you didn't override `OUTPUT`, the bundle is already in place. If you built
it elsewhere, copy the `nerdbox-nvidia-bundle.erofs` file it produced into that
host's `/usr/libexec` directory.

## Run a sandbox with a GPU

To run a sandbox with GPU passthrough, pass the `--gpu` flag:

```console
sbx create --gpu claude .
```

The `sbx run` command takes the same flag:

```console
sbx run --gpu claude
```

The flag takes effect when the sandbox is created. Passing it when you
re-attach to an existing sandbox has no effect.

> [!IMPORTANT]
> Each Docker Sandboxes release uses a specific guest kernel. The NVIDIA 
> kernel modules in your bundle must match that kernel. After upgrading
> Docker Sandboxes, download the new release's `nerdbox-nvidia-modules-x86_64.zip`
> archive and run the script again to rebuild the bundle.

## Troubleshooting

### The script reports `... not found in the driver download`

The extracted driver didn't contain an expected library or firmware file.
Confirm that the download completed. If a library is named differently in your
driver version, adjust `DRIVER_LIB_FAMILIES` in the script.

### GPU workloads fail after a Docker Sandboxes upgrade

The guest kernel or the pinned driver version likely changed. Download the new
release's archive, re-run the script, and reinstall the bundle.

<!-- page: https://docs.docker.com/ai/sandboxes/configuration/models/ fetched 2026-10-08 -->

# Use local and hosted models


Use `sbx run --model` to choose the model and service that answer your agent's
requests. The agent runs inside a local sandbox. The model can run on your
host, at a hosted provider, or at an inference endpoint you configure.

This page covers the built-in `claude`, `codex`, and `opencode` agents. Choose
a model that supports the tool calls and context length your agent needs.
`--model` isn't supported with cloud sandboxes or v3 kits.

> [!NOTE]
> Model selection is experimental. Enable it before following these examples.

## Bundled model service

Docker Sandboxes includes `llmman`, a model management tool installed alongside
`sbx`. It serves local models and forwards requests to hosted providers or
custom endpoints. You don't need to install it separately.

The Docker Sandboxes daemon starts `llmman` on your host and stops it when
the daemon stops. At startup, `llmman` downloads its llama.cpp runtime if
needed, so the first startup requires network access for that download. The service starts even if you haven't used `--model`.

The service keeps running after a sandbox or CLI exits. Sandboxes share its
model store and loaded models.

On Linux, `llmman` first tries Docker or Podman to run the inference server
in a container. If neither is usable, it tries a downloaded binary, then
`llama-server` on the host's `PATH`.

## Enable model selection

Run these commands on your host:

```console
$ sbx settings set platform.allowExperimentalFeatures true
$ sbx settings set feature.model true
```

The `--provider` flag selects where the model runs:

| Provider | Model destination |
| --- | --- |
| Omitted, or `llmman` | A local model managed by `llmman` |
| `ollama` | An existing Ollama installation on your host |
| A hosted provider ID | A provider supported by `llmman`, such as `openai` or `anthropic` |
| An ID from `model.providers` | An endpoint you configure |

## Run a local model

Pass a GGUF model reference or short name to `--model`:

```console
$ sbx run --model gemma4 claude
```

Docker Sandboxes downloads the model if needed. The model runs on the host,
so its memory and compute requirements are separate from the sandbox's
resource limits. Replace `claude` with `codex` or `opencode` to use another
agent with the same model.

### Use Ollama

Install and start Ollama on your host, then select it with `--provider`:

```console
$ sbx run --model gemma4 --provider ollama claude
```

Docker Sandboxes connects to Ollama at `localhost:11434`. It doesn't install,
start, or manage the Ollama process.

For Docker Model Runner, see
[Run Claude Code in a Docker Sandbox with Docker Model Runner](/guides/claude-code-sandbox-model-runner/).

## Use a hosted provider

Select a provider supported by `llmman` and a model available from that
provider. For example, to run Codex with an OpenAI model, export `OPENAI_API_KEY`
in your host shell, restart the daemon to pick it up, then run:

```console
$ sbx daemon restart
$ sbx run --provider openai --model gpt-5-nano codex
```

The host's `llmman` service forwards requests to the provider. It doesn't
download or run the hosted model. For available providers and their API-key
variable names, see the [llmman provider documentation](https://github.com/llmmanorg/llmman/blob/main/docs/providers.md).

### Provider authentication

Make the provider's API key available in the host shell that starts the
Docker Sandboxes daemon. For a custom endpoint, choose the variable name
with [`apiKeyEnv`](#connect-a-custom-endpoint).

`llmman` inherits the daemon's environment. After setting or changing a key,
run `sbx daemon restart` from the shell containing the updated variable.
This restarts the model service and interrupts model requests from sandboxes
using it. Setting a variable only in the shell where you run `sbx run --model`
doesn't update an already-running service.

Provider authentication for this route is handled by `llmman` on the host.
Credentials stored with `sbx secret set` aren't automatically supplied to it.
For the agents' default authentication flows, see
[Manage credentials](/ai/sandboxes/configuration/models/credentials/).

## Connect a custom endpoint

Use `model.providers` to connect to an OpenAI- or Anthropic-compatible
inference endpoint, such as an internal GPU server. The endpoint must be
reachable from your host.

The setting is a JSON object keyed by provider ID. Check its existing value
before changing it:

```console
$ sbx settings get model.providers
```

For an OpenAI-compatible endpoint, define a provider named `company`:

```console
$ sbx settings set model.providers '{"company":{"url":"https://inference.example.com/v1","wire":"openai","apiKeyEnv":"COMPANY_API_KEY"}}'
```

Replace the URL with your endpoint's base URL. Setting `model.providers`
replaces the whole object, so include any existing providers you want to keep.

| Field | Description |
| --- | --- |
| `url` | Required HTTP or HTTPS base URL, usually ending in `/v1`. Use the base URL, without `/chat/completions` or `/messages`. |
| `wire` | The endpoint's API format: `openai` (default) or `anthropic`. This describes the endpoint, regardless of which agent you run. |
| `apiKeyEnv` | Name of the host environment variable containing the API key. Omit it for an endpoint that doesn't require a key. |
| `name` | Optional display name. Defaults to the provider ID. |

Export `COMPANY_API_KEY` in your host shell as described in
[Provider authentication](#provider-authentication), then select the provider
and a model served by that endpoint:

```console
$ sbx run --provider company --model <MODEL_NAME> claude
```

Docker Sandboxes applies the provider configuration when you run with
`--model`. You can use the same provider with `codex` or `opencode`.

## Change an existing sandbox's model

Pass the sandbox name and your model selection:

```console
$ sbx run --name <SANDBOX_NAME> --model <MODEL_NAME> --provider <PROVIDER_ID>
```

Changing the model recreates the sandbox container. The workspace and
kit-owned volumes persist. Omit `--provider` to select a local model managed
by `llmman`.

## Use another provider for larger requests

Pair a local model with another provider to handle requests that exceed the
local model's context capacity:

```console
$ sbx run --model gemma4 \
    --overflow-provider openai --overflow-model gpt-5-nano claude
```

Configure [provider authentication](#provider-authentication) before starting
the model service. You can also use a provider defined in `model.providers`.
Both overflow flags are required, and the local model must use the default
`llmman` provider. This option can't be combined with `--provider ollama` or
a hosted provider selected with `--provider`.

Requests that fit the local model stay local. Requests routed to the overflow
provider send their contents to that endpoint and can incur provider charges.

<!-- page: https://docs.docker.com/ai/sandboxes/configuration/registry-mirror/ fetched 2026-10-08 -->

# Configure a registry mirror






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



A registry mirror routes Docker Hub pulls for sandbox templates and OCI kits
through your organization's registry infrastructure. If the mirror meets
Docker Engine's requirements, Docker inside the sandbox uses it too.

## Configure the mirror

Set [`platform.images.registryMirror`](/ai/sandboxes/configuration/registry-mirror/settings/#platformimagesregistrymirror)
to the mirror host. Include a port when needed, but omit the URL scheme:

```console
$ sbx settings set platform.images.registryMirror registry.example.com
```

You can include a path prefix for registries that store mirrored Docker Hub
content below a repository path:

```console
$ sbx settings set platform.images.registryMirror registry.example.com/docker-remote
```

Docker Sandboxes redirects image references that resolve to Docker Hub and
preserves their repository path, tag, and digest. References that explicitly
name another registry remain unchanged.

If the mirror requires authentication, configure
[registry credentials](/ai/sandboxes/configuration/registry-mirror/credentials/#registry-credentials) for the mirror
host.

## Mirror Docker pulls inside the sandbox

Docker Sandboxes configures Docker Engine inside a sandbox to use the same
mirror when the setting contains a non-loopback host without a path prefix.

| Mirror setting                         | Template and OCI kit pulls | Docker pulls inside the sandbox |
| -------------------------------------- | -------------------------- | ------------------------------- |
| `registry.example.com`                 | Mirrored                   | Mirrored                        |
| `registry.example.com:5000`            | Mirrored                   | Mirrored                        |
| `registry.example.com/docker-remote`   | Mirrored                   | Not mirrored                    |
| `localhost:5000` or `127.0.0.1`        | Mirrored                   | Not mirrored                    |

Loopback addresses refer to the sandbox itself from inside its network
namespace, so Docker Sandboxes doesn't add them to the sandbox's Docker Engine
configuration. A path prefix is also excluded because Docker Engine interprets
mirror URL paths differently from image repository prefixes.

Docker Engine connects to the mirror over HTTPS, so the sandbox must trust the
certificate that the mirror presents. For a mirror that uses an internal
certificate authority, add the CA to the sandbox's system trust store. See
[Install an internal CA certificate](/ai/sandboxes/configuration/customize/kits-v2/#install-an-internal-ca-certificate).

Template and kit pulls use the changed setting immediately. Existing sandboxes
retain the Docker Engine mirror configuration with which they were created.
Recreate a sandbox to apply a changed mirror to Docker inside it.

## Disable the mirror

Unset the setting to disable mirroring:

```console
$ sbx settings unset platform.images.registryMirror
```

An empty setting value also disables mirroring. Recreate existing sandboxes to
remove a mirror from their Docker Engine configuration.

<!-- page: https://docs.docker.com/ai/sandboxes/configuration/settings/ fetched 2026-10-08 -->

# Docker Sandboxes settings


Use `sbx settings` to configure Docker Sandboxes on your host, including
clipboard access, kit sources, and defaults for sandbox creation. Settings
apply across your local sandboxes. For project-specific configuration, use
[environment files](/ai/sandboxes/configuration/settings/environment-files/).

The commands read and write settings through the local daemon, starting it if
necessary. Overrides persist across CLI invocations and daemon restarts.

## View settings

List settings with their effective value, type, source, and description:

```console
$ sbx settings list
```

Long values and descriptions are truncated in the table. Use
`sbx settings list --no-trunc` for complete text, or `sbx settings list --json`
for JSON output. The JSON records also include defaults and environment
variable names where available.

To inspect one setting:

```console
$ sbx settings get clipboard.imagePaste
false
$ sbx settings get clipboard.imagePaste --json
```

Without `--json`, `get` prints only the effective value. With `--json`, it
prints the complete setting record, including the source and default.

## Change a setting

Set an override by passing the setting key and a value of the required type.
For example, allow sandboxed agents to read images from your host clipboard:

```console
$ sbx settings set clipboard.imagePaste true
```

For JSON values, quote the argument so your shell passes it intact. This
example permits kits from Docker Hub and your organization's GitHub repositories:

```console
$ sbx settings set kit.allowedSources '["docker.io/","github.com/myorg/"]'
```

JSON arrays and objects replace the whole value. Include any entries you want
to keep.

Remove an override with `unset`:

```console
$ sbx settings unset clipboard.imagePaste
```

The setting falls back to its environment variable, if set, or its default.
Setting a value equal to its built-in default also removes the stored override.

### Value precedence

For each setting, the first available value wins:

1. The setting's environment variable, if it has one
2. A user override written with `sbx settings set`
3. The built-in default

The `SOURCE` column in `sbx settings list` identifies the selected source as
`envvar`, `override`, or `default`. If an environment variable takes precedence,
`set` still updates the stored override and reports why the effective value
hasn't changed. `unset` removes only the stored override, not the environment
variable.

### When changes take effect

Most changes take effect within about five seconds. Settings marked `yes` in
the `RESTART` column require a daemon restart for existing daemon-side consumers:

```console
$ sbx daemon restart
```

The `set` and `unset` commands print a restart reminder when needed. Some
settings apply only when creating a sandbox: changing a template default or disk
size doesn't update existing sandboxes. Proxy settings have separate timing for
CLI requests, daemon traffic, and sandbox traffic. See
[When proxy changes take effect](/ai/sandboxes/configuration/settings/upstream-proxy/#when-changes-take-effect).

## Environment variables

Some settings have an environment variable equivalent, listed in the reference
entries below. These variables configure Docker Sandboxes on the host. They
don't set environment variables inside a sandbox.

The daemon inherits environment variables when it starts. Export a variable
before the first `sbx` command, or restart an existing daemon from the shell
where you set it. For example:

```console
$ export DOCKER_SANDBOXES_CLIPBOARD_IMAGE_PASTE=true
$ sbx daemon restart
$ sbx settings get clipboard.imagePaste
true
```

Changing your shell environment doesn't change the environment of a running
daemon, even for settings that normally take effect without a restart. To
return to a stored override or default, remove the variable and restart:

```console
$ unset DOCKER_SANDBOXES_CLIPBOARD_IMAGE_PASTE
$ sbx daemon restart
```

CLI operations that read settings locally use their own environment on each
invocation. Keep the CLI and daemon environments consistent when using these
variables. A persistent override with `sbx settings set` avoids needing to
export a variable in each shell.

## Settings reference

Each entry lists its built-in default, before overrides. An environment
variable appears only when the setting has a direct equivalent. Use
`sbx settings list` to inspect the values supported by your installed version.

### Agents and host access

#### clipboard.imagePaste {.wrap-anywhere}


- Type: boolean
- Default: false
- Environment variable: `DOCKER_SANDBOXES_CLIPBOARD_IMAGE_PASTE`



Turn this on to paste screenshots and other host clipboard images into agents
such as Claude Code and Codex with `Ctrl+V`. Text paste doesn't need this setting.

```console
$ sbx settings set clipboard.imagePaste true
```

This grants sandboxed processes access to host clipboard images. The change
applies to running sandboxes without recreating them. Set it to `false` to
withdraw that access. See [image paste](/ai/sandboxes/configuration/faq/#can-i-paste-images-into-an-agent)
for supported behavior.

#### claude.remoteControl {.wrap-anywhere}


- Type: boolean
- Default: false
- Environment variable: `DOCKER_SANDBOXES_CLAUDE_REMOTE_CONTROL`



Turn this on before using Claude Code's `/remote-control` command inside a
sandbox:

```console
$ sbx settings set claude.remoteControl true
```

The remote-control connection must authenticate with its own session token.
This setting lets it do so instead of having the sandbox proxy replace that
token with the host credential. Set it to `false` to restore credential
replacement on that connection. Changes apply to requests from running
sandboxes. See [Claude Code remote control](/ai/sandboxes/configuration/agents/claude-code/#remote-control).

#### env.rememberHostCommands {.wrap-anywhere}


- Type: boolean
- Default: false



Use this when you repeatedly run a trusted environment file and want to
approve its host commands once, until those commands change:

```console
$ sbx settings set env.rememberHostCommands true
```

The first approval is still required. Commands run on your host with your
permissions, outside the sandbox. Leave the setting at `false` to require
approval on every invocation, or use `--auto-approve` to approve only one
invocation. See [environment lifecycle commands](/ai/sandboxes/configuration/settings/environment-files/#lifecycle).

#### ssh.agentForwardingEnabled {.wrap-anywhere}


- Type: boolean
- Default: true



Set this to `false` when sandboxes should not be able to request signatures
from your host SSH agent, including for Git authentication and commit signing:

```console
$ sbx settings set ssh.agentForwardingEnabled false
$ sbx daemon restart
```

Restarting the daemon applies the change to existing forwarders. When forwarding
is enabled, the private keys remain on the host, but sandboxed processes can
ask the agent to use them. See [SSH agent credentials](/ai/sandboxes/configuration/settings/credentials/#ssh-agent).

#### ssh.agentSocketPath {.wrap-anywhere}


- Type: string
- Default: Empty string



Use a fixed path when every sandbox should use the same host SSH agent, such
as a password manager's agent, regardless of which shell starts the sandbox:

```console
$ sbx settings set ssh.agentSocketPath "$SSH_AUTH_SOCK"
$ sbx daemon restart
```

Run this from a shell whose `SSH_AUTH_SOCK` points to the intended agent. The
command stores that path, not a reference to the variable. With an empty value,
Docker Sandboxes uses the socket supplied by each client instead. Remove the
fixed path with `sbx settings unset ssh.agentSocketPath` and restart the daemon
to update existing forwarders.

### Images and storage

#### platform.images.registryMirror {.wrap-anywhere}


- Type: string
- Default: Empty string



Use this when your organization routes Docker Hub pulls through a registry
mirror. Specify a host, optionally with a port and path prefix, without a URL
scheme:

```console
$ sbx settings set platform.images.registryMirror registry.example.com/docker-remote
```

The mirror applies to template and kit references that resolve to Docker Hub.
References to other registries stay unchanged. An empty value disables
mirroring.

A bare, non-loopback host can also configure Docker pulls inside sandboxes
created after the change. A mirror with a path prefix doesn't configure those
pulls. See [registry mirrors](/ai/sandboxes/configuration/settings/registry-mirror/) for authentication, certificate
requirements, and how to apply changes to existing sandboxes.

#### platform.images.useDHI {.wrap-anywhere}


- Type: boolean
- Default: false
- Environment variable: `DOCKER_SANDBOXES_USE_DHI`



Turn this on to use Docker Hardened Image variants when creating sandboxes
with default agent templates:

```console
$ sbx settings set platform.images.useDHI true
```

For example, the default template `docker/sandbox-templates:claude-code-docker`
becomes `dhi/sbx-templates:claude-code-docker`. The image tag stays the same.
An explicit `--template` or a custom kit image takes precedence.

Existing sandboxes keep their template. Create a sandbox after changing the
setting to use the selected image variant.

#### sandbox.disk.dockerVolume {.wrap-anywhere}


- Type: string
- Default: 10g



Increase this default if sandboxes need more room for Docker images,
containers, and volumes under `/var/lib/docker`. The minimum is 512 MiB:

```console
$ sbx settings set sandbox.disk.dockerVolume 20g
```

The size applies when creating a sandbox. It doesn't resize existing volumes
or increase the size of the sandbox workspace.

To choose a size for one sandbox without changing the default:

```console
$ DOCKER_SANDBOXES_DOCKER_SIZE=30g sbx create claude ~/my-project
```

This variable applies to that creation command. It doesn't change the value
reported by `sbx settings get sandbox.disk.dockerVolume`.

### Kits

#### kit.allowedSources {.wrap-anywhere}


- Type: JSON
- Default: ["docker.io/"]
- Environment variable: `DOCKER_SANDBOXES_KIT_ALLOWED_SOURCES`



Add a publisher here before installing its kits from a remote registry or Git
repository. The value replaces the entire allowlist, so retain any sources you
still need:

```console
$ sbx settings set kit.allowedSources '["docker.io/","github.com/myorg/"]'
```

Prefixes match on a path-segment boundary: `github.com/myorg/` permits that
organization's repositories, but not `github.com/myorg-other/`. The value
`["*"]` permits any remote source. Local directories and ZIP files are controlled
by [kit.allowLocalKits](#kitallowlocalkits), and pinned agent kits have the
[kit.allowExtractedAgents](#kitallowextractedagents) exception.

See [restrict kit sources](/ai/sandboxes/configuration/customize/use-kits/#restrict-kit-sources) for source
formats and examples.

#### kit.allowLocalKits {.wrap-anywhere}


- Type: boolean
- Default: true
- Environment variable: `DOCKER_SANDBOXES_KIT_ALLOW_LOCAL`



Set this to `false` to require kits to come from a remote source instead of a
local directory or ZIP file:

```console
$ sbx settings set kit.allowLocalKits false
```

Remote sources must still satisfy [kit.allowedSources](#kitallowedsources).
Keep this enabled while developing kits locally. Allowing local kits doesn't
exempt them from signature requirements when
[kit.requireSignature](#kitrequiresignature) is enabled.

#### kit.allowExtractedAgents {.wrap-anywhere}


- Type: boolean
- Default: true
- Environment variable: `DOCKER_SANDBOXES_KIT_ALLOW_EXTRACTED_AGENTS`



Some agents that previously shipped inside Docker Sandboxes are distributed
as kits. By default, Docker Sandboxes permits the exact pinned references it
uses for those agents even if their sources aren't in `kit.allowedSources`,
and exempts them from `kit.requireSignature`.

To apply your source and signature requirements to those kits too:

```console
$ sbx settings set kit.allowExtractedAgents false
```

After this change, launching one of those agents can fail unless you allow its
source and, when signatures are required, it has a signature from a trusted
signer. The default exception applies only to the pinned references, not to
other kits from the same publisher.

#### kit.requireSignature {.wrap-anywhere}


- Type: boolean
- Default: false
- Environment variable: `DOCKER_SANDBOXES_KIT_REQUIRE_SIGNATURE`



Turn this on to reject unsigned kits and kits whose signatures don't match
your trusted signers. Configure [kit.trustedSigners](#kittrustedsigners) first,
then require signatures:

```console
$ sbx settings set kit.requireSignature true
```

The check applies when installing kits from local directories, Git, or OCI
registries. ZIP kits can't carry verifiable signatures and are rejected.
Pinned agent kits remain exempt while
[kit.allowExtractedAgents](#kitallowextractedagents) is `true`.

A signature covers the kit's `spec.yaml` and `files/` content. It doesn't pin
image tags or verify downloads performed by the kit's commands. See
[sign and verify kits](/ai/sandboxes/configuration/customize/kits-v2/#sign-and-verify-kits).

#### kit.trustedSigners {.wrap-anywhere}


- Type: JSON
- Default: Docker employee identities
- Environment variable: `DOCKER_SANDBOXES_KIT_TRUSTED_SIGNERS`



Set the identities or public keys whose kit signatures you trust. The value is
a JSON array. Each entry describes either a keyless signer or a public key, and
a signature can match any entry.

For a keyless signer, specify both the identity and its OpenID Connect issuer:

```console
$ sbx settings set kit.trustedSigners \
    '[{"identity":"release-bot@example.com","issuer":"https://accounts.google.com"}]'
```

For a public key:

```console
$ sbx settings set kit.trustedSigners '[{"key":"/path/to/cosign.pub"}]'
```

Each command replaces the whole list. To trust both, include both objects in
one array. The default policy trusts Docker employee identities ending in
`@docker.com`, attested by Google's issuer. Setting trusted signers alone
doesn't require signatures: also enable
[kit.requireSignature](#kitrequiresignature).

#### kit.ignoreTransparencyLog {.wrap-anywhere}


- Type: boolean
- Default: false
- Environment variable: `DOCKER_SANDBOXES_KIT_IGNORE_TLOG`



Use this for private kits whose keyless signatures were created with
`--tlog-upload=false`, so verification doesn't require a public Rekor
transparency log entry:

```console
$ sbx settings set kit.ignoreTransparencyLog true
```

Signature and signer verification still apply. These signatures must provide a
timestamp from a timestamp authority instead of a transparency log timestamp.
Leave this at `false` when your signing workflow uses the public transparency
log. It has no effect on signatures verified with a public key.

### MCP gateway

#### mcp.forceLocalGateway {.wrap-anywhere}


- Type: boolean
- Default: false



Set this to `true` to use the local MCP gateway when your account would
otherwise use the SaaS gateway:

```console
$ sbx settings set mcp.forceLocalGateway true
$ sbx daemon restart
```

The daemon caches its gateway selection, so a restart is required after changing
this setting. It doesn't override a gateway selected by organization governance.
Set it back to `false` and restart to return to automatic selection. See
[MCP gateway](/ai/sandboxes/configuration/mcp-gateway/) for server registration and agent setup.

### Diagnostics

#### diagnostics.autoUpload {.wrap-anywhere}


- Type: string
- Default: Empty string



Choose whether Docker Sandboxes may automatically upload diagnostic bundles
after eligible daemon errors:

- `yes`: Consent to automatic uploads.
- `no`: Decline automatic uploads and suppress further consent prompts.
- Empty string: No recorded decision. Docker Sandboxes may prompt for consent,
  but doesn't automatically upload without it.

For example, decline automatic uploads:

```console
$ sbx settings set diagnostics.autoUpload no
```

Use `sbx settings unset diagnostics.autoUpload` to clear the decision. Read
[automatic diagnostics uploads](/ai/sandboxes/configuration/troubleshooting/#enable-automatic-diagnostics-uploads)
for what bundles contain before opting in. This controls automatic uploads,
not an explicit `sbx diagnose --upload` request.

#### diagnostics.autoUploadErrorCooldownInDays {.wrap-anywhere}


- Type: integer
- Default: 1



Increase this value to upload automatic diagnostic bundles less frequently.
For example, allow at most one automatic upload per seven days:

```console
$ sbx settings set diagnostics.autoUploadErrorCooldownInDays 7
```

The cooldown applies across all eligible errors, not separately to each error
type. Values below one are treated as one day. This setting doesn't grant
upload consent: [diagnostics.autoUpload](#diagnosticsautoupload) must be `yes`.

### Upstream proxies and TLS

Upstream proxy support is experimental. Use these settings to control how
outbound traffic reaches the network. See [upstream proxies](/ai/sandboxes/configuration/settings/upstream-proxy/)
for setup and [when changes take effect](/ai/sandboxes/configuration/settings/upstream-proxy/#when-changes-take-effect).

The standard `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` variables and their
lowercase forms are fallbacks for proxy selection, not direct overrides of the
`proxy` and `no_proxy` settings.

#### proxy {.wrap-anywhere}


- Type: string
- Default: Empty string



Set a shared upstream proxy when both sandbox traffic and host-side Docker
Sandboxes traffic should pass through it:

```console
$ sbx settings set proxy http://proxy.corp:3128
$ sbx daemon restart
```

The value can be an HTTP, HTTPS, or SOCKS5 proxy URL, a PAC source, `system` to
use the operating system's proxy, or `direct` to bypass upstream proxies. An
empty value falls back to the standard proxy environment variables and then the
operating system's proxy settings.

The scope-specific settings below take precedence over this shared value.
See [proxy value formats](/ai/sandboxes/configuration/settings/upstream-proxy/#set-a-proxy-manually) and
[proxy precedence](/ai/sandboxes/configuration/settings/upstream-proxy/#precedence).

#### proxy.sandbox {.wrap-anywhere}


- Type: string
- Default: Empty string
- Environment variable: `DOCKER_SANDBOXES_PROXY`



Use this when traffic from inside sandboxes needs a different route from the
daemon and CLI. For example, send sandbox traffic through a SOCKS5 proxy:

```console
$ sbx settings set proxy.sandbox socks5h://proxy.corp:1080
$ sbx daemon restart
```

With `socks5h://`, the proxy resolves destination names. Use `direct` to bypass
the shared proxy for sandbox traffic, or unset this setting to inherit `proxy`.
It doesn't affect daemon traffic. Sandboxes created after the change use the
updated value; existing sandbox proxies require a daemon restart.

#### proxy.daemon {.wrap-anywhere}


- Type: string
- Default: Empty string



Use this to route the daemon's requests, such as image pulls, separately from
sandbox traffic. Supported host CLI requests, including `sbx login` and
`sbx diagnose --upload`, also use this scope.

For example, keep a shared proxy for sandbox traffic while letting the daemon
connect directly:

```console
$ sbx settings set proxy.daemon direct
$ sbx daemon restart
```

Unset this setting to inherit `proxy`. Supported CLI requests use changes on
the next invocation; the daemon's own requests require a restart.

#### no_proxy {.wrap-anywhere}


- Type: string
- Default: Empty string



List destinations that should bypass the selected upstream proxy. Use a
comma-separated string of hosts, domain suffixes, IP addresses, or CIDR ranges:

```console
$ sbx settings set no_proxy "registry.internal,10.0.0.0/8"
$ sbx daemon restart
```

This shared list applies to sandbox and daemon traffic unless a scope-specific
list replaces it. A value of `*` bypasses the upstream proxy for all destinations.
Proxy exclusions don't grant network access: sandbox requests must still pass
[network policy](/ai/sandboxes/configuration/governance/access-controls/network/).

#### no_proxy.sandbox {.wrap-anywhere}


- Type: string
- Default: Empty string
- Environment variable: `DOCKER_SANDBOXES_NO_PROXY`



Use this when only sandbox traffic should bypass the upstream proxy for a set
of destinations. For example, connect directly to cluster services:

```console
$ sbx settings set no_proxy.sandbox "*.svc.cluster.local"
$ sbx daemon restart
```

A non-empty value replaces the shared `no_proxy` list for sandbox traffic; it
doesn't append to it. Include any shared exclusions that sandboxes still need.
Unset it to inherit `no_proxy` again. Existing sandbox proxies require a daemon
restart.

#### no_proxy.daemon {.wrap-anywhere}


- Type: string
- Default: Empty string



Use this when the daemon and supported CLI requests need different proxy
exclusions from sandbox traffic. For example, pull images directly from an
internal registry:

```console
$ sbx settings set no_proxy.daemon "registry.internal"
$ sbx daemon restart
```

A non-empty value replaces the shared `no_proxy` list for this scope. It doesn't
change sandbox exclusions. Unset it to inherit `no_proxy` again. Supported CLI
requests use changes on the next invocation; daemon requests require a restart.

#### proxy.integratedAuth {.wrap-anywhere}


- Type: boolean
- Default: false



Turn this on when a corporate proxy requires NTLM or Kerberos authentication
using your Windows sign-in identity:

```console
$ sbx settings set proxy.integratedAuth true
$ sbx daemon restart
```

It applies to both sandbox and daemon proxy traffic. Authentication happens on
the host, so the Windows credentials don't enter the sandbox. It has no effect
on macOS or Linux. For cross-platform authentication with credentials in a
proxy URL, see [proxy authentication](/ai/sandboxes/configuration/settings/upstream-proxy/#authentication).

#### tls.allowNegativeSerial {.wrap-anywhere}


- Type: boolean
- Default: false
- Environment variable: `DOCKER_SANDBOXES_TLS_ALLOW_NEGATIVE_SERIAL`



Use this compatibility setting when HTTPS requests fail with
`x509: negative serial number` because a TLS-inspecting proxy issues
certificates with negative serial numbers:

```console
$ sbx settings set tls.allowNegativeSerial true
$ sbx daemon restart
```

It relaxes certificate validation to accept those serial numbers. It doesn't
make an untrusted certificate authority trusted or resolve other certificate
errors. For an untrusted internal CA, see
[certificate troubleshooting](/ai/sandboxes/configuration/troubleshooting/#api-calls-fail-with-a-certificate-error).

### Shared agent skills

Shared agent skills are experimental.

#### skills.defaultMode {.wrap-anywhere}


- Type: string
- Default: readonly



Choose how future sandboxes use the shared agent skills store when you omit
`--skills`:

- `readonly`: Agents can read shared skills but can't change the store.
- `readwrite`: Agents can read and modify skills used by other sandboxes.
- `off`: Don't mount the shared store.

For example, omit the shared store by default:

```console
$ sbx settings set skills.defaultMode off
```

An explicit `--skills` value or environment-file `skills` value overrides this
default. Existing sandboxes retain their mounts: recreate them to change their
access mode. See [share agent skills](/ai/sandboxes/configuration/workflows/agent-skills/) for setup
and the consequences of sharing a writable store.

## Command reference

### sbx settings list

List settings. Alias: `sbx settings ls`.

Use `--json` for complete records as JSON, or `--no-trunc` for full text. These
options are mutually exclusive.

### sbx settings get \<KEY\>

Print one effective value.

Use `--json` for the complete setting record.

### sbx settings set \<KEY\> \<VALUE\>

Write a user override.

Values are parsed as `bool`, `int`, `float`, `string`, or `json`, according to
the setting's type.

### sbx settings unset \<KEY\>

Remove a user override.

Use `sbx settings <COMMAND> --help` for command help.

<!-- page: https://docs.docker.com/ai/sandboxes/configuration/upstream-proxy/ fetched 2026-10-08 -->

# Configure an upstream proxy


This page describes proxy settings for local sandboxes and the local daemon.
For cloud sandbox egress controls, see
[Cloud network policy](/ai/sandboxes/configuration/cloud/network-policy/).

> [!IMPORTANT]
> Upstream proxy support is experimental. Everything described on this page —
> proxy URLs, PAC files, SOCKS5, use of the OS system proxy, proxy
> authentication, and the settings that configure them — is subject to change.
> Share feedback and bug reports in the
> [docker/sbx-releases](https://github.com/docker/sbx-releases) repository.

An upstream proxy is the corporate or network proxy that Docker Sandboxes
forwards outbound traffic through on its way to the internet. This is separate
from the [network policy](/ai/sandboxes/configuration/governance/access-controls/network/), which decides
_which_ destinations are allowed. The upstream proxy decides _how_ allowed
traffic reaches them.

Docker Sandboxes sends two kinds of outbound traffic, and you can proxy them
independently:

- Sandbox traffic — network access from inside your sandboxes.
- Daemon traffic — the `sbx` daemon's own access, including image pulls,
  telemetry, and feature flags. CLI requests for `sbx login` and
  `sbx diagnose --upload` also use this scope.

## Default behavior

By default, both kinds of traffic use your operating system's proxy settings,
including any PAC URL configured there. You don't need to configure anything. On
macOS and Windows, `sbx` tracks the OS proxy setting while it runs, so a change
to your network, VPN, or PAC configuration is picked up without a restart. If
your OS has no proxy configured, traffic goes direct.

## Set a proxy manually

Use [`sbx settings set`](/ai/sandboxes/configuration/upstream-proxy/settings/#change-a-setting) to override the default
for one or both kinds of traffic:

```console
$ sbx settings set proxy http://proxy.corp:3128          # both kinds of traffic
$ sbx settings set proxy.sandbox socks5://proxy.corp:1080 # sandbox traffic only
$ sbx settings set proxy.daemon direct                    # daemon traffic only
```

A proxy value can be any of the following:

| Value                                                                                  | Meaning                                                                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| _(unset)_                                                                              | Fall back to the wider scope, then environment variables, then the OS system proxy (the default) |
| `http://host:port` or `https://host:port`                                              | An HTTP or HTTPS proxy                                                                           |
| `socks5://host:port` or `socks5h://host:port`                                          | A SOCKS5 proxy                                                                                   |
| `pac+http://host/proxy.pac`, `pac+https://host/proxy.pac`, or `file:///path/proxy.pac` | A PAC (proxy auto-config) file                                                                   |
| `system`                                                                               | Force the use of the OS system proxy                                                             |
| `direct`                                                                               | Force a direct connection with no proxy                                                          |

With `socks5://`, DNS is resolved locally before the connection is handed to the
proxy. With `socks5h://`, DNS resolution is delegated to the proxy.

### Exclude destinations from the proxy

Exclusion lists mirror the same scopes. Each takes a comma-separated list of
hosts, domain suffixes, IP addresses, or CIDR ranges, or `*` to bypass the
proxy entirely:

```console
$ sbx settings set no_proxy "*.internal.corp,10.0.0.0/8"    # both kinds of traffic
$ sbx settings set no_proxy.sandbox "*.svc.cluster.local"   # sandbox traffic only
$ sbx settings set no_proxy.daemon "registry.internal"      # daemon traffic only
```

## Environment variables

Because `sbx` runs from your shell, it also honors the standard and legacy proxy
environment variables, so existing setups keep working without migration:

- `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` (and their lowercase forms) — the
  standard variables. They apply to both kinds of traffic when no `proxy` or
  `no_proxy` setting is configured.
- `DOCKER_SANDBOXES_PROXY` and `DOCKER_SANDBOXES_NO_PROXY` — the environment
  form of `proxy.sandbox` and `no_proxy.sandbox`. They apply to sandbox traffic
  only and never affect daemon traffic.

For how to apply environment variable changes to the CLI and daemon, see
[Settings environment variables](/ai/sandboxes/configuration/upstream-proxy/settings/#environment-variables).

## Precedence

For each kind of traffic, the first match wins:

1. The scope-specific value:
   - `proxy.sandbox` or `DOCKER_SANDBOXES_PROXY` for sandbox traffic
   - `proxy.daemon` for daemon traffic
2. The `proxy` setting
3. `HTTP_PROXY` or `HTTPS_PROXY` from the shell
4. The OS system proxy (the default)
5. Direct

The matching exclusion list (`no_proxy.<scope>`, then `no_proxy`) applies to the
chosen proxy, and the standard `NO_PROXY` variable still applies on the
environment path.

For example, if `proxy` specifies a shared proxy and `proxy.sandbox` is set to
`direct`, sandbox traffic connects directly while daemon traffic uses the
shared proxy. If no proxy setting is configured, `HTTP_PROXY` takes precedence
over the OS system proxy.

## When changes take effect

Proxy settings take effect at different times depending on the consumer:

- Sandbox scope (`proxy.sandbox`, `no_proxy.sandbox`, and the sandbox side of
  `proxy` and `no_proxy`) is resolved when a sandbox network proxy is created.
  Sandboxes you create after a change use the updated settings. Existing
  sandboxes retain their selected upstream proxy until `sbx daemon restart`
  rebuilds their network proxies. Restarting a sandbox alone is insufficient.
- Daemon scope (`proxy.daemon`, `no_proxy.daemon`, and the daemon side of
  `proxy` and `no_proxy`) is resolved once when the daemon starts. Changes to
  the daemon's own traffic require `sbx daemon restart`.
- Supported CLI clients read daemon-scoped settings on each invocation,
  including `sbx login` and `sbx diagnose --upload`. Changes apply on the next
  invocation without a daemon restart.

The `DOCKER_SANDBOXES_*` environment variables are a separate case. They control
sandbox traffic only, as described in
[Environment variables](#environment-variables), but `sbx` reads them from the
daemon's environment as the daemon starts, so changing one also requires a
daemon restart. If one of these variables overrides a stored setting, unset
the variable and restart the daemon for the stored setting to take effect.

When a `system` or PAC proxy is in use, `sbx` still tracks OS-level proxy changes
(such as switching networks, connecting a VPN, or updated PAC contents) live.

## Authentication

If the upstream proxy requires you to authenticate to it, `sbx` supports two
mechanisms.

### Credentials in the proxy URL

Put the credentials in the proxy URL: `http://user:pass@host:port` for an HTTP
or HTTPS proxy, or `socks5://user:pass@host:port` for SOCKS5. This works on all
platforms and covers proxies that challenge with Basic authentication.

### Integrated Windows authentication

Proxies that answer `CONNECT` with a `407` challenge and accept only integrated
schemes — NTLM or Kerberos/Negotiate — can instead authenticate you with your
Windows sign-in identity. This is opt-in and off by default:

```console
$ sbx settings set proxy.integratedAuth true
```

The setting isn't scoped: it applies to both sandbox and daemon traffic. If the
proxy offers several schemes, the strongest one is used, preferring Negotiate
over NTLM. Changes follow the same
[schedule as other proxy settings](#when-changes-take-effect): on the next
invocation for supported CLI clients, when you create a sandbox, and after
`sbx daemon restart` for daemon traffic and existing sandbox proxies.

Your identity stays on the host. Authentication to the upstream proxy happens
on the host side of the sandbox boundary, after network policy has already been
applied, so no credential enters the sandbox and nothing about which
destinations a sandbox may reach changes.

This depends on Windows SSPI, so it has no effect on macOS or Linux. On those
platforms, credentials in the proxy URL remain the only option.

## Related pages

- [Network isolation](/ai/sandboxes/configuration/security/isolation/) — how traffic leaves a sandbox and
  the network policy it passes through
- [Troubleshooting: API calls fail with a certificate error](/ai/sandboxes/configuration/troubleshooting/#api-calls-fail-with-a-certificate-error)
  — installing an internal root CA when your proxy inspects HTTPS traffic

<!-- page: https://docs.docker.com/ai/sandboxes/customize/ fetched 2026-10-08 -->

# Kits




Kits let you shape a sandbox around the way you work. Use a custom base image,
add the tools your project needs, and give your agent instructions for using
them. You also control which services the sandbox can access, how it
authenticates, and what runs when the sandbox starts.

A kit can define the whole environment or add something to an existing one,
such as a toolchain or your team's shared configuration. Package those choices
once, then reuse them across projects and share them with your team.

This page covers v3 kits, which require `sbx` v0.45 or later. See
[Version compatibility](#version-compatibility) for compatibility with earlier
kit formats.

## What is a kit?

A kit packages software and configuration for a sandbox. A YAML file, called
its descriptor, tells Docker Sandboxes what the kit needs: network access,
credentials, setup commands, or instructions for the agent. You publish the
kit as a container image containing its files and descriptor.

You identify a published kit by its container image reference, such as
`me/my-kit:latest`. When you use the kit, `sbx` prepares its files and applies
its settings. You can use one kit for a complete environment or combine kits
that contribute different parts.

## What kits can do

Use kits to:

- Package a custom agent, or configure an existing agent for your team's
  projects.
- Include the tools the agent needs, such as linters, language runtimes,
  test runners, and compilers.
- Share linter rules, editor settings, helper scripts, and reference material.
  Give the agent instructions and skills for using them.
- Connect the agent to services through network rules and credentials,
  including internal APIs and private package registries.
- Initialize each sandbox and run supporting services when it starts, such
  as a development server for previewing the agent's work.

## Workloads and mixins

Kits have two roles in a sandbox: a workload supplies the base environment
and launch command, and mixins add tools or behavior to it.

| Kind | What it supplies | How you use it |
| --- | --- | --- |
| `workload` | The environment and command to run, such as an agent or a shell | Pass it to `sbx run` or `sbx create` |
| `mixin` | Additional tools, configuration, or runtime behavior | Add it with `--kit` |

For example, this command runs a workload with a mixin:

```console
$ sbx run me/my-agent-kit:latest --kit me/my-mixin:latest
```

The workload supplies the environment and launch command. The mixin adds its
tools and configuration to that environment.

## Kit sets

A kit set combines kits into a single kit that you can publish and reuse.
Use it to package a workload with the mixins you need, so you and your team
can run the environment from one reference.

The set specifies which kits and versions to combine. It can also add setup
commands, agent instructions, network access, and other settings for the
combined environment.

If the set includes a workload, you run the published kit with `sbx run`.
If it contains only mixins, you add it to a workload with `--kit`.

To share a combination without publishing another kit, list the workload and
mixins in a [sandbox environment file](/ai/sandboxes/configuration/environment-files/).
Docker Sandboxes composes those kits when it creates the sandbox. An environment
file can also configure the workspace and host resources. Choose a set when you
want one published reference with a fixed list of components; the set records
their image digests when you build it. You can also use a set in an environment
file.

See [Use kits](/ai/sandboxes/customize/use-kits/) for how to run kits
and add mixins. To customize and publish your own combination, see
[Compose a kit set](/ai/sandboxes/customize/author/kit-sets/).

## Version compatibility

V3 kits cannot be combined with v1 or v2 kits in the same sandbox. To use
v3, select a v3 workload and use v3 for every mixin you add.

The built-in agent names, such as `claude` and `codex`, select v2 kits.
You can't add a v3 mixin to these built-ins. For example,
`sbx run claude --kit ./some-v3-mixin` fails because it mixes kit versions.
Instead, select a v3 workload by its published image, local path, or Git
reference, as shown in [Run a kit](/ai/sandboxes/customize/use-kits/#run-a-kit).

V2 remains supported, including the built-in agents and
existing v2 customizations. See [Kits v2](/ai/sandboxes/customize/kits-v2/) for maintenance
and migration guidance.

## Choose your next step

- [Use kits](/ai/sandboxes/customize/use-kits/) to run a published environment or combine
  a workload with mixins.
- [Author kits](/ai/sandboxes/customize/author/) to build an agent environment,
  package a tool, or combine kits into a set to share with your team.
- Explore the [sandbox-kit-spec repository](https://github.com/docker/sandbox-kit-spec)
  for the authoritative v3 specification, build frontend, and examples.

For the earlier format used by built-in agents, see [Kits v2](/ai/sandboxes/customize/kits-v2/).
To save an environment you've configured inside a sandbox,
see [Save a sandbox as a template](/ai/sandboxes/usage/#saving-a-sandbox-as-a-template).

<!-- page: https://docs.docker.com/ai/sandboxes/customize/author/ fetched 2026-10-08 -->

# Author kits




Build a kit to give your team a repeatable sandbox environment. You can
package an agent, add a tool to use with different agents, or combine existing
kits into one kit your team can run. The guides in this section walk through
each approach.

> [!NOTE]
> Select a v3 workload and v3 mixins together.
> Built-in shortcuts such as `claude` and `codex` use v2 and can't be combined
> with v3 mixins. See [Version compatibility](/ai/sandboxes/customize/#version-compatibility)
> or the [v2 reference](/ai/sandboxes/customize/kits-v2/).

## Choose what to author

- [Compose a kit set](/ai/sandboxes/customize/author/kit-sets/) to combine
  kits you've published or chosen from a registry. A set can also add network
  access, setup commands, and agent instructions, and let users choose settings
  such as which model to use.
- [Build a tool mixin](/ai/sandboxes/customize/author/tool-mixins/) to
  package a reusable tool with its network access and credentials.
- [Build an agent workload](/ai/sandboxes/customize/author/build-an-agent/)
  to control the base environment, agent installation, and launch command.
  You can also [use an existing agent image](/ai/sandboxes/customize/author/base-images/#use-an-image-in-a-v3-workload).

For complete kits you can study and adapt, see
[Kit examples](https://github.com/docker/sandbox-kit-spec/tree/main/examples)
in the Docker Sandbox Kit Specification repository.

## Directory and build layout

Keep each kit's source in its own directory. A kit usually starts with two
files:

- A YAML descriptor identifies the kit as a workload, mixin, or set and
  declares its settings and requirements.
- A Dockerfile installs software and copies files into the image.

Use the kit's name for the directory and descriptor. If the kit has a
Dockerfile, use the same filename stem as the descriptor: `my-kit.yaml`
pairs with `my-kit.dockerfile`.

For example:

```text
my-kit/
├── my-kit.yaml
├── my-kit.dockerfile
├── context.md
└── files/
    └── settings.json
```

Organize supporting files in whatever way suits your kit. This example keeps
agent instructions in `context.md` and configuration files under `files/`.

### How the files work together

The Dockerfile defines what goes into the image, such as installed tools
and configuration files. For a workload, it also sets the command to launch.
The YAML descriptor defines the kit's settings and requirements, such as
network access, credentials, and agent instructions.

The descriptor starts with a syntax declaration:

```yaml
# syntax=docker/sandbox-kit:3
```

This selects the kit build frontend, which reads the descriptor and its
matching Dockerfile. The build produces a container image containing the
software, supporting files, and validated descriptor.

A kit set uses the descriptor's `kits:` list to combine published kits.

### Build and use the kit

When building with Docker Buildx, pass the YAML descriptor to `-f` and
the source directory as the build context:

```console
$ docker buildx build -f my-kit/my-kit.yaml -t my-kit:dev my-kit/
```

You can also give `sbx` a reference to a local kit directory. It builds the kit
when creating the sandbox. After publishing the image to a registry, you can
use its image reference instead.

For build options and publishing instructions, see
[Build and distribute kits](/ai/sandboxes/customize/author/distribute/).

### Other source layouts

The separate descriptor and Dockerfile are one way to organize a kit.
You can also write a Dockerfile inline under `build: |`, select one with
`dockerfile:`, or embed the descriptor in a Dockerfile comment.

See [Authoring forms](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/SPEC-v3.md#3-authoring-forms)
for the syntax.

## Capabilities

Installing a tool is often only part of the job. The tool might also need to
reach an API, authenticate with a credential, or run a setup command before
the agent starts. Describe those needs in the descriptor's `capabilities`
list. Each entry asks Docker Sandboxes to provide one of these features.

A kit's Dockerfile defines how its image is built. Its capabilities describe
what Docker Sandboxes needs to do when preparing and running the sandbox.
For example, a tool mixin can install an API client through its Dockerfile
and use a network capability to request access to that API. Building or
running the image with Docker alone doesn't apply these capability settings.

You can add capabilities to a workload, mixin, or set. Keep each request with
the kit that needs it, so a tool's access rules follow it when you use it with
another agent.

Each capability entry identifies the feature in `type`. Capabilities that
need settings take them in `config`. For example, `com.docker.sandbox/network-policy@1`
requests network access, and its `config` lists the domains to allow.

The `@1` identifies the capability's version. It is independent of the kit
format version and the `sbx` release. The
[upstream capability definitions](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/SPEC-v3.md#72-well-known-types)
describe the available capabilities and their settings.

> [!NOTE]
> `sbx` doesn't apply `usb-device@1`, `privileged@1`, or `agent-sessions@1`
> requests. Its capability enforcement can let sandbox creation succeed even
> when a required capability is unsupported. Don't rely on this behavior:
> choose capabilities supported by the runtime where your kit will run.
> The `kit-registry@1` capability is restricted to approved OCI builder kits;
> local and Git kit sources don't receive it.

The guides here show how to use capabilities with Docker Sandboxes. For all
descriptor fields and the rules for combining kits, see the
[upstream v3 specification](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/SPEC-v3.md).

## Choose when setup runs

Install tools and copy static files during the image build so you can reuse
them in every sandbox. Some setup needs to wait until the sandbox exists. For
example, a mixin can bring a CA certificate, but it needs the workload's tools
to register that certificate. Use a lifecycle capability to run commands or
generate files at the right point:

| Where to put the work | When it runs in `sbx` | Example |
| --- | --- | --- |
| Dockerfile `RUN` and `COPY` | Image build | Install a tool and copy its default configuration |
| Lifecycle `install` hooks | Once during sandbox creation, before the agent launches | Register a CA or populate a mounted directory |
| Lifecycle `files` | During creation, after install hooks and before the agent launches | Generate settings from kit arguments |
| Lifecycle `startup` hooks | Every sandbox start, alongside the agent | Start a background service or refresh state after a restart |

Lifecycle hooks are commands that run during sandbox creation or startup.
Make startup hooks safe to run more than once. In `sbx`, they run alongside
the agent, so the agent might start before they finish. If a command must
finish before every agent launch, put it in the workload's entrypoint instead.

### Pass environment variables to hooks

In `sbx`, install hooks receive a limited set of environment variables:
basic process variables, proxy settings, and certificate paths. If your command needs another
variable, name it in the hook's `env` list. For example, `env: [WORKSPACE_DIR]`
gives the command the mounted workspace's path. In `sbx`, startup hooks receive
the sandbox's environment without this filtering.

See [Kit authoring patterns](/ai/sandboxes/customize/author/patterns/#run-setup-after-combining-kits)
for setup examples and the upstream
[lifecycle definition](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/capabilities/com.docker.sandbox/lifecycle@1.md)
for the fields.

### Generated files

In lifecycle `files` content, write `${{ kit.env.NAME }}` to insert a
container environment variable. For example, write
`${{ kit.env.WORKSPACE_DIR }}` for the workspace path. Plain `$VAR` and
`${VAR}` are written unchanged, without substituting their values. In hook
commands, use shell syntax such as `$WORKSPACE_DIR` instead.

Docker Sandboxes substitutes `${{ kit.env.NAME }}` once, when it creates the
sandbox. `kit.env` reads the final container environment, independently of a
hook's `env` list.

## Set workload compute requirements

Set the workload's default CPU and memory allocation with the
[`resources@1` capability](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/capabilities/com.docker.sandbox/resources@1.md)
in its descriptor. Use a whole number of CPU cores. Anyone running the kit
can override these defaults with `--cpus` and `--memory` when creating a sandbox.

Put these settings on the workload. `sbx` ignores resource settings on
mixins added separately, and it doesn't use the capability's `gpu` field
to select GPUs.

## Keep the sandbox running after sessions end

By default, a local sandbox stops automatically shortly after its last session
disconnects. A kit that runs a service, such as a development server on a
published port, can ask the sandbox to keep running instead. Declare the
[`long-running@1` capability](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/capabilities/com.docker.sandbox/long-running@1.md),
which takes no `config`:

```yaml
capabilities:
  - type: com.docker.sandbox/long-running@1
```

A sandbox created with this kit behaves like one started with
[`sbx run --detached`](/ai/sandboxes/usage/#keep-a-sandbox-running-in-the-background):
it keeps running until someone stops or removes it, including after you attach
to it and disconnect. When a workload, mixin, or set declares the capability,
it applies to the whole sandbox.

A kit that declares the capability runs only where the runtime can provide it.
If the kit also works when the sandbox stops after its sessions end, set
`optional: true` on the entry. A runtime that can't provide the capability
then skips it instead of refusing the kit. In `sbx`, two cases can't provide
it:

- Cloud sandboxes can't provide this capability. `sbx --cloud` refuses a kit
  that requires it and skips an optional entry.
- `sbx kit add` can't apply the capability to a running sandbox. A required
  entry fails, and an optional entry is skipped with a warning. Recreate the
  sandbox with the kit to apply it.

<!-- page: https://docs.docker.com/ai/sandboxes/customize/author/base-images/ fetched 2026-10-08 -->

# Base images for sandbox workloads




A base image gives your workload its operating system and starting set of
tools. Docker provides images with agents already installed. You can also start
from another Linux image and prepare it yourself. Choose the base image in your
workload's Dockerfile. Use the kit descriptor to configure network access,
credentials, and other sandbox behavior. A kit set uses the base image from its
workload.

To save and reuse an environment you've configured interactively, see
[Save a sandbox as a template](/ai/sandboxes/usage/#saving-a-sandbox-as-a-template).

## Docker-provided images

Docker's sandbox templates are published as
`docker/sandbox-templates:<variant>`. They are based on Ubuntu and run as a
non-root `agent` user with sudo access. Most variants include Git, Docker
CLI, and common development tools like Node.js, Python, Go, and Java.

| Variant               | Agent                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `claude-code`         | [Claude Code](https://claude.ai/download)                            |
| `claude-code-minimal` | Claude Code with a minimal toolset (no Node.js, Python, Go, or Java) |
| `codex`               | [OpenAI Codex](https://github.com/openai/codex)                      |
| `copilot`             | [GitHub Copilot](https://github.com/github/copilot-cli)              |
| `cursor-agent`        | [Cursor](https://cursor.com/cli)                                     |
| `devin`               | [Devin CLI](https://docs.devin.ai/work-with-devin/devin-cli)         |
| `docker-agent`        | [Docker Agent](https://github.com/docker/docker-agent)               |
| `droid`               | [Droid](https://www.factory.ai)                                      |
| `gemini`              | [Gemini CLI](https://github.com/google-gemini/gemini-cli)            |
| `kiro`                | [Kiro](https://kiro.dev)                                             |
| `opencode`            | [OpenCode](https://opencode.ai)                                      |
| `shell`               | No agent pre-installed. Use for manual agent setup.                  |

## Use an image in a v3 workload

Start your workload's Dockerfile with `FROM`, then add the tools and
configuration you need. Install system packages as `root`, and switch back
to `agent` before installing tools in the agent's home directory. Running
those installers as `root` puts files under `/root/`, where the agent can't
use them.

### What the base image provides

`FROM` inherits the image's files and settings. If the image is also a
published kit, its capabilities don't carry over. Declare network access,
credentials, storage, and hooks in your own descriptor. To keep an existing
kit's capabilities and add tools, [compose a kit set](/ai/sandboxes/customize/author/kit-sets/).

Your descriptor determines the kit format version. A v3 descriptor creates
a v3 kit, including when you use a Docker template image as its base. See
[Version compatibility](/ai/sandboxes/customize/#version-compatibility).

### Package an existing agent image

This example packages Docker's OpenCode image as a v3 workload. The image
already has an agent installed, so you only need to choose its launch command
and describe what it needs to run. You can run the resulting kit directly or
include it in a set with additional tools.

Create a directory with these two files:

```text
opencode-workload/
├── opencode-workload.yaml
└── opencode-workload.dockerfile
```

The Dockerfile selects the base image and tells Docker Sandboxes to run
OpenCode as the `agent` user:

```dockerfile {title="opencode-workload/opencode-workload.dockerfile"}
FROM docker/sandbox-templates:opencode
USER agent
ENTRYPOINT ["opencode"]
CMD []
```

The template supplies OpenCode, Python, uv, and the `agent` user. Create a
YAML descriptor to identify this as a workload and declare what OpenCode
needs: network access, an Anthropic API key, and instructions about its
environment:

```yaml {title="opencode-workload/opencode-workload.yaml"}
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
kind: workload

capabilities:
  - type: com.docker.sandbox/sbx@1
  - type: com.docker.sandbox/network-policy@1
    config:
      runtime:
        allow:
          - api.anthropic.com
          - opencode.ai
          - models.dev
          - registry.npmjs.org
          - pypi.org
          - files.pythonhosted.org
  - type: com.docker.sandbox/credential@1
    config:
      service: anthropic
      phase: runtime
      apiKey:
        name: ANTHROPIC_API_KEY
        proxyManaged: true
        inject:
          - domain: api.anthropic.com
            header: x-api-key
            format: "%s"
  - type: com.docker.sandbox/agent-context@1
    config:
      filename: AGENTS.md
      content: |
        OpenCode runs as the agent user. Python and uv are available.
        Use the project's environment and dependency configuration.
```

The credential entry names the service and describes how to authenticate API
requests. Store the actual API key on your host.

`sbx` can build this directory when you create a sandbox. The result is a
container image with the kit's files and descriptor, which you can also
publish to a registry for others to use.

## Use your own Linux image

If you need a different operating system or set of packages, start from a
Linux image of your choice. You'll need to add the tools and user account
that Docker Sandboxes expects, then install your agent.

The following requirements help you prepare that image. For a step-by-step
example, follow [Build an agent workload](/ai/sandboxes/customize/author/build-an-agent/).

### Base image requirements

Prepare your image with the following:

- Tools: Include `curl`, `git`, and trusted CA certificates for accessing
  source repositories and making HTTPS requests.
- Shells: Provide executable `/bin/sh` and `/bin/bash` files for setup commands
  and agent launch.
- User account: Create a non-root `agent` account with UID 1000 and home
  directory `/home/agent`. Add the account to `/etc/passwd` and set `USER
  agent` in the image.
- Launch command: Set `ENTRYPOINT` or `CMD` to the agent or shell you want the
  sandbox to launch.

Docker Sandboxes uses the account's entry in `/etc/passwd` to determine
the user ID, group ID, and home directory when running commands and writing
files.

For a sandbox with a mounted workspace, `WORKDIR` doesn't choose the mount
location. For a sandbox without a mounted workspace, `sbx` uses the image's
absolute `WORKDIR` as the working directory. If the image doesn't specify a
usable absolute path, `sbx` falls back to `/home/agent/workspace`.

### Declare the agent launch contract

`sbx` keeps the sandbox running and starts the agent as a separate process,
using the image's launch command. The `com.docker.sandbox/sbx@1` capability
declares that your workload is prepared to run this way:

```yaml
capabilities:
  - type: com.docker.sandbox/sbx@1
```

This capability takes no `config` and doesn't request extra permissions. It
lets the upstream conformance tests check that your image meets the shell and
user account requirements before you publish.

The host launches the agent through non-interactive Bash. To load persistent
environment settings at launch, set `BASH_ENV` to an absolute path and include
that file in the image. Bash reads this file instead of login profiles or
`.bashrc`.

For the complete contract, see the upstream
[`sbx@1` definition](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/capabilities/com.docker.sandbox/sbx@1.md).

<!-- page: https://docs.docker.com/ai/sandboxes/customize/author/build-an-agent/ fetched 2026-10-08 -->

# Build an agent workload




Build a kit that runs Claude Code on a Linux base image of your choice.
You'll install the agent, give it access to the Anthropic API, and add model
settings and instructions for your team. The result is a v3 workload kit you
can run locally or publish for others to use. You can follow the same steps
for other agents or your organization's own base images.

This tutorial prepares the whole environment, from system packages to the
command that starts the agent. If you already have a suitable agent image,
see [Package an existing agent image](/ai/sandboxes/customize/author/base-images/#package-an-existing-agent-image).
To combine a published agent kit with tools, [author a kit set](/ai/sandboxes/customize/author/kit-sets/).

If you're starting with kits, read [Author kits](/ai/sandboxes/customize/author/)
for an introduction to the files you'll create. Field definitions are in the
[upstream v3 specification](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/SPEC-v3.md).

## Prepare the kit directory

You need `sbx`, Docker with Buildx, and an Anthropic
API key. Create a directory beside the project you want the agent to work on:

```console
$ mkdir claude-team
```

The completed directory contains three files:

```text
claude-team/
├── claude-team.yaml
├── claude-team.dockerfile
└── context.md
```

The Dockerfile installs the agent and sets the command to run it. The YAML
file, called the descriptor, tells Docker Sandboxes what the agent needs to
run, such as network access and credentials. The Markdown file contains
instructions for the agent. Give the YAML file and Dockerfile the same name
before the extension so the build can find both files.

This kit uses v3 and is independent of the built-in `claude` kit, which uses
v2. Any mixins you add must also use v3. To customize the built-in kit, see
[Kits v2](/ai/sandboxes/customize/kits-v2/).

## Use your own base image

This tutorial starts from Red Hat Universal Base Image (UBI) 9. The following
steps add the tools, user account, and certificates the sandbox needs. You can
use another Linux image, including one maintained by your organization.
Adjust the package and account commands for that image, following the same
[base image requirements](/ai/sandboxes/customize/author/base-images/#base-image-requirements).

### Install the system packages

Create `claude-team/claude-team.dockerfile` with the base image and packages:

```dockerfile {title="claude-team/claude-team.dockerfile"}
FROM registry.access.redhat.com/ubi9/ubi:9.8

USER root
RUN dnf install -y bash ca-certificates curl-minimal git shadow-utils tar gzip \
    && dnf clean all
```

Bash runs shell commands, Git accesses source repositories, and curl uses
the CA certificates to make HTTPS requests. The remaining packages create
the agent's user account and unpack its installer. Add any compilers,
libraries, or other tools your projects need here.

### Create the agent account

The sandbox needs a non-root `agent` user with UID 1000 and home directory
`/home/agent`. Append the following to the Dockerfile to create that account
and writable directories for its workspace, configuration, and state:

```dockerfile {title="Append to claude-team/claude-team.dockerfile"}
RUN groupadd --gid 1000 agent \
    && useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash agent \
    && mkdir -p /home/agent/workspace /home/agent/.local/bin \
        /home/agent/.local/share /home/agent/.local/state \
        /home/agent/.config/claude-team /home/agent/.docker/sandbox/locks \
    && chown -R agent:agent /home/agent
```

Creating these directories during the build makes the agent their owner
before Docker Sandboxes mounts the workspace and storage. The agent runs
without `sudo` in this example, so install system packages in the Dockerfile.
Use install hooks for setup that depends on an individual sandbox.

### Prepare certificate trust

HTTPS requests from the sandbox go through a proxy. Docker Sandboxes adds
the proxy's certificate authority (CA) to the sandbox's trusted certificates
when it starts. UBI keeps its certificates at a different path from the one
`sbx` uses. Copy them to the expected path, then tell tools to use that file
so they trust both public certificates and the proxy:

```dockerfile {title="Append to claude-team/claude-team.dockerfile"}
RUN update-ca-trust \
    && mkdir -p /usr/local/share/ca-certificates /etc/ssl/certs \
    && cp /etc/pki/tls/certs/ca-bundle.crt /etc/ssl/certs/ca-certificates.crt

ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt \
    REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
```

If you add corporate CA certificates during the build, add them to
`/etc/pki/ca-trust/source/anchors/` before running `update-ca-trust` and
copying the bundle. For another distribution, use its certificate management
command and source bundle path.

### Prepare the shell environment

An environment variable exported in one shell isn't automatically available
in another. Give the agent a file where it can save variables for later
shell sessions. The following lines create that file and arrange for login,
interactive, and non-interactive Bash shells to read it:

```dockerfile {title="Append to claude-team/claude-team.dockerfile"}
RUN touch /etc/sandbox-persistent.sh \
    && chown agent:agent /etc/sandbox-persistent.sh \
    && chmod 0644 /etc/sandbox-persistent.sh \
    && printf '%s\n' '. /etc/sandbox-persistent.sh' \
        > /etc/profile.d/sandbox-persistent.sh \
    && printf '%s\n' '. /etc/sandbox-persistent.sh' >> /home/agent/.bashrc

ENV HOME=/home/agent \
    PATH="/home/agent/.local/bin:${PATH}" \
    BASH_ENV=/etc/sandbox-persistent.sh
```

`BASH_ENV` tells non-interactive Bash to read the file. You'll include
instructions for the agent to use it later in the tutorial.

## Build the agent into the image

Append the following to the Dockerfile to install Claude Code as `agent` and
set its launch command:

```dockerfile {title="Append to claude-team/claude-team.dockerfile"}
USER agent
ENV CLAUDE_ENV_FILE=/etc/sandbox-persistent.sh \
    IS_SANDBOX=1
ARG CLAUDE_VERSION
RUN curl -fsSL https://claude.ai/install.sh -o /tmp/install-claude.sh \
    && bash /tmp/install-claude.sh "${CLAUDE_VERSION}" \
    && rm /tmp/install-claude.sh

WORKDIR /home/agent/workspace
ENTRYPOINT ["claude", "--settings", "/home/agent/.config/claude-team/settings.json"]
CMD []
```

Installing as `agent` puts Claude Code under `/home/agent/`, where that user
can access it. `CLAUDE_ENV_FILE` points Claude Code to the file you prepared
for persistent environment variables. You'll set `CLAUDE_VERSION` in the
descriptor in the next step.

The Dockerfile also sets the user, working directory, environment variables,
and launch command. `CMD []` clears any arguments inherited from the base
image. The `--settings` option loads the model you choose for each sandbox.
You'll create its settings file in [Write the model settings](#write-the-model-settings).

Each sandbox created from this image gets the same Claude Code binary.
The next steps configure how Docker Sandboxes runs it. Any mixins you add
must use v3 and contain tools compatible with this workload's operating
system and architecture.

## Describe the workload and its inputs

Create `claude-team/claude-team.yaml`. Start by identifying the workload and
declaring two arguments:

- `version` selects the Claude Code version to install during the image build.
- `model` selects the model to use when creating a sandbox.

```yaml {title="claude-team/claude-team.yaml"}
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
kind: workload
displayName: Team Claude Code
description: Claude Code with team defaults and API-key authentication

args:
  version:
    default: "2.1.278"
    pattern: '^[0-9]+\.[0-9]+\.[0-9]+$'
    buildArg: CLAUDE_VERSION
  model:
    default: sonnet
    enum: [sonnet, opus, haiku]

provides: ["claude@${{ kit.args.version }}"]
```

`version` sets the Dockerfile's `CLAUDE_VERSION` build argument. The build
checks the version against `pattern`, then includes it in `provides` so
other kits can check which Claude Code version is installed.

`model` lets you choose a model when creating each sandbox. The choice goes
into a settings file, so it doesn't change the installed agent.

## Allow access to the API

With the agent installed, the next step is to give it access to the Anthropic
API. Add a `capabilities` list at the top level of `claude-team.yaml`, after
`provides`:

```yaml {title="Add to claude-team/claude-team.yaml"}
capabilities:
  - type: com.docker.sandbox/sbx@1
  - type: com.docker.sandbox/network-policy@1
    config:
      runtime:
        allow:
          - api.anthropic.com:443
```

The network rule permits HTTPS requests to the Anthropic API while the
sandbox runs. Downloading Claude Code in the Dockerfile uses the builder's
network, so it doesn't need a rule here.

The `sbx@1` entry declares that the workload is prepared for `sbx` to manage
the agent's launch. See [Declare the agent launch contract](/ai/sandboxes/customize/author/base-images/#declare-the-agent-launch-contract)
for the shells and user account that this requires.

## Declare the credential

Claude Code can reach the API, but it also needs to authenticate. Add a
credential capability to tell Docker Sandboxes which key to use and how to
include it in requests. You'll store the key on your host, outside the kit.

Append this entry to the same `capabilities` list:

```yaml {title="Append under capabilities"}
  - type: com.docker.sandbox/credential@1
    description: Anthropic API access
    config:
      service: anthropic
      phase: runtime
      apiKey:
        name: ANTHROPIC_API_KEY
        proxyManaged: true
        inject:
          - domain: api.anthropic.com
            header: x-api-key
            format: "%s"
```

The sandbox receives a placeholder in `ANTHROPIC_API_KEY`. When Claude Code
makes a request to `api.anthropic.com`, the host proxy inserts the real API
key into the `x-api-key` header. The key stays on the host. You'll supply
its value and approve its use when launching the kit.

## Write the model settings

The Dockerfile's launch command reads
`/home/agent/.config/claude-team/settings.json`. Use the lifecycle capability
to create that file with the model chosen for the sandbox.

Append this entry to `capabilities`:

```yaml {title="Append under capabilities"}
  - type: com.docker.sandbox/lifecycle@1
    config:
      files:
        - path: /home/agent/.config/claude-team/settings.json
          content: |
            {"model": "${{ kit.args.model }}"}
          mode: "0644"
```

Docker Sandboxes fills in the chosen `model` and writes the file before
Claude Code starts. Creating the file at this point lets each sandbox use a
different model with the same image.

Docker Sandboxes writes these files as UID 1000 after running install hooks.
Use an absolute path the agent can write to, as in this example. Shell
variables such as `$HOME` aren't expanded in the path.

## Add agent instructions

The kit can also give Claude Code instructions about the environment. Save the
following Markdown alongside the descriptor and Dockerfile:

```markdown {title="claude-team/context.md"}
## Team workflow

Read the project's README before changing code. Run the project's checks
before reporting a task complete, and report any checks you couldn't run.

Claude Code is installed in this sandbox. Its additional settings are at
`/home/agent/.config/claude-team/settings.json`.

Use `/etc/sandbox-persistent.sh` for environment exports needed by later
Bash commands. Keep shell completion scripts out of that file because
non-interactive commands also source it.
```

Append an agent-context entry to `capabilities` to include these instructions:

```yaml {title="Append under capabilities"}
  - type: com.docker.sandbox/agent-context@1
    config:
      filename: CLAUDE.md
      contentFile: ./context.md
```

The build includes `context.md` in the image. When the sandbox runs, `sbx`
writes a `CLAUDE.md` file in the parent directory of the mounted workspace.
That file points Claude Code to your `context.md`. A `CLAUDE.md` in your
project stays in place.

Use `contentFile`, as in this example, to keep longer instructions in a
separate Markdown file. You can also write instructions directly in the
workload's descriptor using `content` instead of `contentFile`.
For how instructions from multiple kits work together, see
[Runtime access and instructions](/ai/sandboxes/customize/use-kits/#runtime-access-and-instructions).

## Store the key and run

Store your Anthropic API key on the host:

```console
$ sbx secret set anthropic
```

From the directory containing `claude-team`, launch the kit:

```console
$ sbx run --name claude-team ./claude-team
```

`sbx` builds the kit, mounts your current directory as the workspace, and
launches Claude Code. To work on another project, append its path to the command.
When prompted, approve the kit's request to use your stored key, then follow
Claude Code's first-run prompts. The agent needs both the stored key and your
approval to use it. See
[Credential bindings](/ai/sandboxes/configuration/credentials/#credential-bindings).

Choose a different model when creating a sandbox:

```console
$ sbx run --name claude-team-opus ./claude-team \
    --kit-arg claude-team.model=opus
```

The `claude-team` prefix matches the local kit directory's name. Docker
Sandboxes checks that `opus` is one of the choices in `enum`, then writes it
to the settings file before Claude Code starts.

## Iterate and publish

Edit the descriptor, Dockerfile, or context file and create another sandbox
with a different name to test the changes:

```console
$ sbx run --name claude-team-test-2 ./claude-team
```

Restarting an existing sandbox won't pick up your edits. To try another
agent version locally, update `args.version.default` in the descriptor and
create another sandbox.

`sbx` reuses the local build when the source files and kit arguments are
unchanged. Changing either can trigger a build, even for arguments such as
`model` that only affect sandbox setup. BuildKit can still reuse unchanged
image layers.

### Publish the workload

When the kit is ready to share, sign in to Docker Hub, then build and push it
with Docker Buildx. Replace `<NAMESPACE>` with a Docker Hub namespace you can
push to:

```console
$ docker login
$ docker buildx build ./claude-team \
    --file ./claude-team/claude-team.yaml \
    --tag docker.io/<NAMESPACE>/claude-team:1.0.0 \
    --push
```

The `--file` option tells Buildx to read the descriptor. Its `syntax` line
selects the kit frontend, which reads the companion Dockerfile and includes
the descriptor in the published image. To publish a different agent version,
add `--build-arg version=<CLAUDE_VERSION>`. This flag uses the kit argument
name, `version`, which the descriptor maps to the Dockerfile's `CLAUDE_VERSION`.

Run the published kit by its image reference:

```console
$ sbx run --name claude-team-shared docker.io/<NAMESPACE>/claude-team:1.0.0
```

For multi-platform images and distribution details, see
[Build and distribute kits](/ai/sandboxes/customize/author/distribute/).
To learn how to package a tool separately from its workload, see
[Build a tool mixin](/ai/sandboxes/customize/author/tool-mixins/).
That tutorial also packages Claude Code, so use its mixin with a shell workload.
Combining it with this workload would give two kits that provide `claude`,
which Docker Sandboxes rejects.
You can also include the published workload in a
[kit set](/ai/sandboxes/customize/author/kit-sets/) and add settings
and instructions there. The workload still defines how to prepare the base
image, install the agent, and launch it.

<!-- page: https://docs.docker.com/ai/sandboxes/customize/author/distribute/ fetched 2026-10-08 -->

# Build and distribute kits




Once you've [authored a kit](/ai/sandboxes/customize/author/),
share it by publishing an image to a registry or its source to Git.
Publishing an image saves others from building the kit themselves. Sharing
the source lets them build it when they create a sandbox. Either way, `sbx`
reads the kit's descriptor to configure the sandbox.

This page shows how to publish and sign v3 kits. To run a kit someone else has
shared, see [Use kits](/ai/sandboxes/customize/use-kits/).

## Publish an image

Use Docker Buildx to build and publish your kit as an OCI image. Pass the YAML
descriptor with `-f` and the source directory as the build context:

```console
$ docker login
$ docker buildx build ./my-kit -f ./my-kit/my-kit.yaml \
    -t docker.io/<NAMESPACE>/my-kit:1.0.0 --push
```

Replace `<NAMESPACE>` with a Docker Hub namespace you can push to. Buildx
uses your `docker login` credentials to push the image.

Push the image before running it by its registry reference. `sbx` pulls the
published image. It can't use images stored only in your host's Docker image
store. During development, you can pass a local source directory to `sbx`
instead. For private images, configure
[registry credentials](/ai/sandboxes/configuration/credentials/#registry-credentials)
for your sandbox.

Use Buildx for v3 kits. The `sbx kit pack`, `push`, and `pull` commands are
for v1 and v2 kits.

### Support both Linux architectures

To share the kit with people who use different machines, build for both
supported Linux architectures:

```console
$ docker buildx build ./my-kit -f ./my-kit/my-kit.yaml \
    --platform linux/amd64,linux/arm64 \
    -t docker.io/<NAMESPACE>/my-kit:1.0.0 --push
```

## Publish a kit set

Publish a set with the same Buildx command, passing its YAML descriptor with
`-f`. The build fetches the published images listed in `kits:`, checks whether
their declarations are compatible, and combines their files and settings into
one image. See
[Compose a kit set](/ai/sandboxes/customize/author/kit-sets/) for a complete example.

The result is a workload or mixin image that people can use directly. It
records each component's manifest digest, which identifies the exact image
used in the build. Updating a component's tag doesn't change a published
set. To share the update, rebuild the set and publish another version.
If you want rebuilds to use the same component images, add a `digest` beside
each `ref` in `kits:`.

## Share source through Git

Commit the kit's source directory to a Git repository, then share a reference
in this format. Use `dir` to select the kit directory and `ref` to select the
commit:

```text
git+https://github.com/<ORG>/<REPOSITORY>.git#ref=<COMMIT>&dir=my-kit
```

When someone creates a sandbox from that reference, `sbx` builds the kit
from the selected commit.

## Sign and verify kits

Sign your published image so others can verify who signed it:

```console
$ sbx kit sign docker.io/<NAMESPACE>/my-kit:1.0.0
$ sbx kit verify docker.io/<NAMESPACE>/my-kit:1.0.0 \
    --certificate-identity <SIGNER_IDENTITY> \
    --certificate-oidc-issuer <ISSUER_URL>
```

These commands use Sigstore signatures, which are compatible with Cosign.
The example signs without a key, so verification needs the signer's certificate
identity and OpenID Connect issuer. To sign with a key instead, pass
`--key cosign.key` to `sign` and `--key cosign.pub` to `verify`.

To require a valid signature before using a kit, see
[Verify kit signatures](/ai/sandboxes/customize/use-kits/#verify-kit-signatures).

V3 kits shared as source directories or Git references can't be signed.
If you need signatures, publish and sign an OCI image.

## Published format

A published kit image contains both the kit's content and its descriptor.
Docker image tools can inspect and distribute it, and Docker Sandboxes reads
the descriptor when creating the sandbox.

You can also inspect the descriptor inside the sandbox, under
`/usr/share/sandbox/kit/<stem>/`.
For the image annotations and file layout, see
[Published image format](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/SPEC-v3.md#10-the-oci-layout).

Use `sbx` to run a workload with the settings and hooks declared in its kit
descriptor. Running it with `docker run` uses only the image configuration,
so those settings and hooks aren't applied.

<!-- page: https://docs.docker.com/ai/sandboxes/customize/author/kit-sets/ fetched 2026-10-08 -->

# Compose a kit set




A kit set gives your team one kit to run, with the tools and versions you've
chosen. You list the kits to include, add any settings the combined environment
needs, and publish the result. A set can also run setup commands, supply agent
instructions, and offer choices such as which model to use.

Use a set when you want to share a combination of kits and manage its
settings in one place. The components can be kits your team publishes or
kits from other publishers. You need Docker Buildx and a registry namespace
you can push to when publishing the set.

## Choose the components

A set can contain one workload and any number of mixins. Together, they
provide a complete sandbox environment. You can also make a set of only
mixins, to share tools and settings that users add to a workload with `--kit`.

Choose v3 kits that work together. For example, you could combine an agent
workload with a linter mixin and a mixin that adds your team's configuration.
To package a tool of your own, see
[Build a tool mixin](/ai/sandboxes/customize/author/tool-mixins/).

You can try a workload and mixins together with `sbx run` and `--kit`
before composing a set. See
[Add mixins](/ai/sandboxes/customize/use-kits/#add-mixins).
If one kit depends on another, Docker Sandboxes applies the dependency first.
Changing the order of `--kit` flags or entries in a set doesn't change that
order.

## Write the set descriptor

A set descriptor uses `kind: set` and lists its components under `kits:`.
For example, this descriptor combines Docker's Codex workload with a
mixin:

```yaml {title="codex-tools/codex-tools.yaml"}
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
kind: set
displayName: Codex with tools
version: "1.0.0"

kits:
  - ref: docker.io/docker/sbx-kit-codex:0.155.1
  - ref: <MIXIN_REFERENCE>
```

Replace `<MIXIN_REFERENCE>` with a published v3 mixin's full image reference.
Choose a different workload reference to use another agent or environment.
The components supply their own network rules and credential requests, so
the set doesn't need to repeat them.

The set gets its software and files from the `kits:` list. It doesn't have a
Dockerfile, a `dockerfile:` field, or a `build:` block. To include more software
or static files, package them in a workload or mixin, publish that kit, and
add it to the list.

Every `ref` must be a published registry reference. Local paths and Git URLs
aren't accepted as components, even when building the set from local source.

## Add runtime access to the set

You can give the combined environment access to services beyond those its
components request. For example, to let the agent download packages from an
internal registry, add this network capability to the set's descriptor:

```yaml
capabilities:
  - type: com.docker.sandbox/network-policy@1
    config:
      runtime:
        allow:
          - packages.company.example:443
```

Replace the example domain with your registry's host. The rule permits access
as long as the sandbox's policy allows it. If the registry also requires
authentication, add a credential request. See
[Services declared by kits](/ai/sandboxes/configuration/credentials/#services-declared-by-kits).

Keep access required by a tool in that tool's kit, so its access rules follow
it when used with another workload. Put settings shared by the combined
environment on the set, such as access to your team's package registry.
You can also add setup commands, generate configuration files, provide
instructions, and define arguments on the set.

## Build and publish the set

Before publishing, [check for file conflicts](#check-for-file-conflicts)
between the components.

Build and publish a set by passing its descriptor to Docker Buildx.
For a descriptor at `codex-tools/codex-tools.yaml`:

```console
$ docker login
$ docker buildx build ./codex-tools -f ./codex-tools/codex-tools.yaml \
    -t docker.io/<NAMESPACE>/codex-tools:1.0.0 --push
```

Replace the paths with your set's source directory and descriptor, and
`<NAMESPACE>` with a Docker Hub namespace you can push to.

The build pulls the listed kits, checks their declared requirements, and
combines their files and settings. It fails if a dependency is missing, two
kits declare the same feature in `provides`, or more than one kit is a workload.

A set that includes a workload publishes as `kind: workload`.
A set containing only mixins publishes as `kind: mixin`.
Your team can use the result like any other workload or mixin. The published
kit records each component's exact image digest in `kits:`. Only the source
descriptor uses `kind: set`.

## Run the set

Run a published set that contains a workload by passing its image reference
to `sbx run`, as you would for an individual workload:

```console
$ sbx run <SET_REFERENCE> --name my-project
```

The sandbox includes the workload and all the mixins packaged in the set.
You don't need to list those mixins separately with `--kit`.

For a set containing only mixins, add it to a workload with `--kit`:

```console
$ sbx run <WORKLOAD_REFERENCE> --kit <SET_REFERENCE> --name my-project
```

Authentication depends on the kits in the set. Check their documentation for
required credentials, store those credentials on the host, and approve access
when prompted. See
[Credential configuration](/ai/sandboxes/configuration/credentials/)
for authentication options and preparing unattended runs.

To control the agent's base image or launch command, see
[Build an agent workload](/ai/sandboxes/customize/author/build-an-agent/).

## Configure component arguments

You can let your team change a setting without changing which kits are
included. For example, they might need to choose whether a linter checks or
fixes files while using the linter version you've selected.

A set controls which component arguments users can change. You can fix an
argument's value when publishing the set, or expose it as an argument on the
set so users can choose a value when creating a sandbox.

After changing the argument definitions in the descriptor, rebuild and publish
the set.

### Fix an argument's value

Suppose you have a linter kit with a `mode` argument that users normally set
when creating a sandbox. Add it to the set with a fixed value of `check`:

```yaml
kits:
  - ref: docker.io/my-org/linter-kit:1.0.0
    args:
      mode: check
```

This excerpt fixes the linter's `mode` to `check` when you publish the set.
Use your linter's image reference and argument name. Other components in the
set can have their own argument values.

### Let users choose a value

To let users choose the mode when creating a sandbox, define an argument on
the set and pass its value to the linter:

```yaml
args:
  lint_mode:
    default: check
    enum: [check, fix]

kits:
  - ref: docker.io/my-org/linter-kit:1.0.0
    args:
      mode: ${{ kit.args.lint_mode }}
```

This example assumes the linter defines `mode` with the same default and
allowed values. The set must preserve those constraints. Users can then pass
`--kit-arg lint_mode=fix` when running the published set. They can change only
arguments defined on the set, not other arguments on its components.
See [Set merge rules](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/SPEC-v3.md#95-merging-a-set)
for the argument rules.

### Change a build argument

Arguments used to build a component, such as the tool version to install,
are fixed in its published image. To change one, rebuild and publish the
component, then update its reference in the set.

## Review and update the composition

### Check for file conflicts

Before sharing a set, check that its components work together. Give each
component's files separate paths: if two components include the same path,
the file from the later image layer replaces the earlier one. The build
orders layers by kit dependencies, so reordering `kits:` doesn't choose
which file wins. Inspect the built image for unintended replacements.
When you combine kits with `--kit` instead, Docker Sandboxes rejects files
that collide when it creates the sandbox.

### Check combined settings

The set includes each component's network rules and agent instructions.
Lifecycle hooks run in dependency order, but startup hooks run alongside
the agent. The agent might start before those hooks finish.

Use install hooks for setup that must finish during sandbox creation. For
setup that must finish before every agent launch, use the workload's
entrypoint.

The workload chooses the instruction filename. If you add instructions with
an `agent-context` capability on the set, leave out the filename.

### Update a component

Change the component's reference, rebuild the set, and publish another
version. Create another sandbox to try the updated set. Existing sandboxes
keep the kit configuration they were created with.

A published set keeps the files and settings it was built with, even if a
component's tag later points to a different image. To use those same images
when rebuilding, add a `digest` beside each `ref` in the source.

For signing and multi-platform builds, see
[Build and distribute kits](/ai/sandboxes/customize/author/distribute/).

<!-- page: https://docs.docker.com/ai/sandboxes/customize/author/patterns/ fetched 2026-10-08 -->

# Kit authoring patterns




When you package a tool as a kit, aim to make it work wherever you add it.
These patterns show how to include the access it needs, prepare it for each
sandbox, and give your team useful options without asking them to assemble
the environment themselves.

## Keep runtime access with the tool

Keep a tool's network rules and credential request in the mixin that installs
it. For example, a Claude Code mixin can package the executable, allow access
to the Anthropic API, and request the API key. Those requirements follow the
tool when you add it to another workload.

The user still needs to supply the credential and approve access. See
[Build a tool mixin](/ai/sandboxes/customize/author/tool-mixins/)
for a complete example.

## Leave build tools out of the mixin

Build a tool in one Dockerfile stage, then copy the executable into an empty
stage. Each sandbox gets the tool without also getting its compiler and
source code:

```yaml {title="gojq/gojq.yaml"}
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
kind: mixin
provides: ["gojq@0.12.17"]

build: |
  FROM golang:1.25 AS build
  RUN CGO_ENABLED=0 go install github.com/itchyny/gojq/cmd/gojq@v0.12.17

  FROM scratch
  COPY --from=build /go/bin/gojq /usr/local/bin/gojq
```

`CGO_ENABLED=0` builds gojq without a dependency on the workload's C libraries.
`FROM scratch` starts the final stage empty, so it contains only the binary
you copy. The `provides` entry tells other kits which gojq version this mixin
installs.

## Run setup after combining kits

Some setup needs tools or files from the workload. Package what you can in the
mixin, then use an install hook to finish setup once all the kits' files are
in place. For example, bring an internal certificate authority (CA) certificate
in the mixin and register it in the workload's trust store:

```yaml {title="internal-ca/internal-ca.yaml"}
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
kind: mixin

build: |
  FROM scratch
  COPY internal-ca.crt /usr/local/share/ca-certificates/team-internal-ca.crt

capabilities:
  - type: com.docker.sandbox/lifecycle@1
    config:
      install:
        - command: update-ca-certificates
          user: "0"
```

Save your PEM-encoded CA as `internal-ca.crt` beside the descriptor and use the
mixin with a workload that supplies `update-ca-certificates`, such as Docker's
shell kit. The hook updates the workload's trust store as root, after all kit
files are present and before the agent launches.

```console
$ sbx run docker.io/docker/sbx-kit-shell:1.0.0 --kit ./internal-ca
```

## Seed storage after it is mounted

Mounting storage at a path hides any files the image already has there. To
give a tool some initial data, keep that data elsewhere in the image and
copy it to the mounted directory in an install hook. Check whether the
destination file exists first so you preserve any changes the user has made:

```yaml {title="tool-state/tool-state.yaml"}
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
kind: mixin

build: |
  FROM scratch
  COPY defaults.json /usr/share/company-cli/defaults.json

capabilities:
  - type: com.docker.sandbox/volume@1
    config:
      path: /home/agent/.company-cli
      size: 1g
  - type: com.docker.sandbox/lifecycle@1
    config:
      install:
        - command: |
            set -eu
            chown 1000:1000 /home/agent/.company-cli
            if [ ! -e /home/agent/.company-cli/config.json ]; then
              install -o 1000 -g 1000 -m 0644 /usr/share/company-cli/defaults.json /home/agent/.company-cli/config.json
            fi
          user: "0"
```

Save your tool's initial configuration as `defaults.json` beside the descriptor.
Use a workload with `chown` and `install`, such as Docker's shell kit. The hook
makes the directory and configuration file writable by the agent. If the
volume already has a configuration file, the hook leaves its contents intact.

### Configure the volume

The volume keeps the tool's data across sandbox restarts. A replacement
sandbox gets its own volume. This example allocates `1g` of space. If you
omit `size`, `sbx` allocates `512m`.

Use an install hook to set ownership and permissions for persistent volumes,
as this example does. The volume capability's `mode` setting applies only
to tmpfs mounts. See the upstream
[volume definition](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/capabilities/com.docker.sandbox/volume@1.md)
for storage options.

To copy initial files into a mounted workspace instead, use
`WORKSPACE_DIR` as the destination and
[declare it in the hook's environment](/ai/sandboxes/customize/author/#choose-when-setup-runs).

## Publish fixed components with configurable options

Choose compatible agent and tool versions for your team, then publish them
as a set. Expose arguments for settings users can change without replacing
those components, such as a model or linter mode. Keep version choices fixed
in the published images.

For the argument syntax and constraints, see
[Configure component arguments](/ai/sandboxes/customize/author/kit-sets/#configure-component-arguments).

<!-- page: https://docs.docker.com/ai/sandboxes/customize/author/tool-mixins/ fetched 2026-10-08 -->

# Build a tool mixin




A tool mixin adds an executable and the settings it needs to an existing
workload. This tutorial packages Claude Code as a mixin, adds it to a shell
workload, and tests a request to the Anthropic API. The sandbox starts a shell,
and you choose when to run Claude Code.

The example adapts the upstream
[Claude Code mixin](https://github.com/docker/sandbox-kit-spec/tree/main/examples/claude-mixin)
to use API-key authentication. The upstream example also includes OAuth,
session storage, and MCP configuration.

You need `sbx`, Docker with Buildx, and an Anthropic API key. To publish the
mixin, you also need a registry namespace you can push to. Use a v3 workload
with this mixin. Built-in shortcuts such as `shell` and `claude` use v2. See
[Version compatibility](/ai/sandboxes/customize/#version-compatibility).

## Package the executable

Create a `claude-mixin` directory with a Dockerfile and YAML descriptor:

```text
claude-mixin/
├── claude-mixin.dockerfile
└── claude-mixin.yaml
```

The Dockerfile downloads the native Claude Code executable in a build stage,
then copies it into an empty image:

```dockerfile {title="claude-mixin/claude-mixin.dockerfile"}
FROM debian:trixie-slim AS build
ARG CLAUDE_VERSION
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates
RUN case "$TARGETARCH" in \
      amd64) platform=linux-x64 ;; \
      arm64) platform=linux-arm64 ;; \
      *) echo "unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
    esac \
    && mkdir -p /out/usr/local/bin \
    && curl -fsSL "https://downloads.claude.ai/claude-code-releases/${CLAUDE_VERSION}/${platform}/claude" \
        -o /out/usr/local/bin/claude \
    && chmod 0755 /out/usr/local/bin/claude

FROM scratch
COPY --from=build /out/ /
```

BuildKit supplies `TARGETARCH` to select the download for the image's Linux
architecture. You'll set `CLAUDE_VERSION` in the descriptor. The final stage
contains only the executable, so the mixin doesn't add Debian or the download
tools to the workload.

Docker Sandboxes adds the mixin's files to the workload's environment. The
workload keeps its own startup command, user, and working directory. This
example uses Docker's shell workload. When choosing another workload, check
that it supplies the Linux libraries and shell your tool needs.

A mixin includes only the files its Dockerfile adds or changes. If you use
a larger base image instead of `scratch`, the mixin won't include that
image's unchanged files.

## Declare runtime access

Create the descriptor with the version to install and the API access Claude
Code needs:

```yaml {title="claude-mixin/claude-mixin.yaml"}
# syntax=docker/sandbox-kit:3
schemaVersion: "3"
kind: mixin
displayName: Claude Code mixin

args:
  version:
    default: "2.1.278"
    pattern: '^[0-9]+\.[0-9]+\.[0-9]+$'
    buildArg: CLAUDE_VERSION

provides: ["claude@${{ kit.args.version }}"]

capabilities:
  - type: com.docker.sandbox/network-policy@1
    config:
      runtime:
        allow:
          - api.anthropic.com:443
  - type: com.docker.sandbox/credential@1
    config:
      service: anthropic
      phase: runtime
      apiKey:
        name: ANTHROPIC_API_KEY
        proxyManaged: true
        inject:
          - domain: api.anthropic.com
            header: x-api-key
            format: "%s"
```

The `version` argument supplies `CLAUDE_VERSION` to the Dockerfile. The
`provides` entry identifies the installed Claude Code version so other kits
can check their requirements.

The network rule permits HTTPS requests to the Anthropic API. The credential
entry requests the key stored under `anthropic` on your host. Inside the
sandbox, `ANTHROPIC_API_KEY` contains a placeholder. The host proxy inserts
the real key into the `x-api-key` header when Claude Code calls the API.

Network access and credential access are separate: declaring a credential
doesn't allow connections to its service. This example pairs `phase: runtime`
with `runtime.allow`. The download in the Dockerfile uses the builder's
network and doesn't need a rule in the descriptor.

Keep the tool's access requirements in the mixin so they follow it when you
use it with another workload. Access shared by a project's tools, such as a
package registry, can go in a
[kit set](/ai/sandboxes/customize/author/kit-sets/).

## Try the mixin

Store your Anthropic API key on the host:

```console
$ sbx secret set anthropic
```

From the directory containing `claude-mixin`, add the mixin to Docker's
published shell workload:

```console
$ sbx run docker.io/docker/sbx-kit-shell:1.0.0 --name claude-mixin-test \
    --kit ./claude-mixin
```

Approve the mixin's credential request when prompted. `sbx` builds the mixin,
adds its executable to the workload, and opens a shell. The mixin doesn't
replace the workload's launch command.

Inside the sandbox, check that Claude Code runs:

```console
$ claude --version
```

Then send a request to check network access and authentication. This command
uses the Anthropic API and incurs usage charges:

```console
$ claude -p "Reply with the word hello."
```

A response confirms that Claude Code can reach the API and authenticate with
your stored key. If authentication fails, check that you stored the key and
approved the kit's request to use it. See
[Credential bindings](/ai/sandboxes/configuration/credentials/#credential-bindings).
Network requests must also meet the sandbox's
[network policy](/ai/sandboxes/governance/concepts/#precedence).

Run `claude` without arguments to start an interactive session. Follow its
first-run prompts. Exit Claude Code and the shell to return to your host.

After editing the kit's files, create a sandbox with a different name to test
your changes. Reopening an existing sandbox uses the kits it was created with.

## Publish the mixin

Build and publish the mixin so others can use it without building from source:

```console
$ docker login
$ docker buildx build ./claude-mixin -f ./claude-mixin/claude-mixin.yaml \
    -t docker.io/<NAMESPACE>/claude-mixin:1.0.0 --push
```

Replace `<NAMESPACE>` with a Docker Hub namespace you can push to. Use the
published reference with `--kit` in place of `./claude-mixin`.

Choose a workload that doesn't already provide Claude Code. Two kits that
declare the same feature in `provides` conflict. To share the shell workload
and this mixin as one kit, see
[Compose a kit set](/ai/sandboxes/customize/author/kit-sets/).

## More source examples

The [sandbox-kit-spec examples](https://github.com/docker/sandbox-kit-spec/tree/main/examples)
contain complete kits you can study and adapt:

- [Claude Code mixin](https://github.com/docker/sandbox-kit-spec/tree/main/examples/claude-mixin)
  includes additional authentication options, session storage, and agent
  instructions.
- [GitHub CLI](https://github.com/docker/sandbox-kit-spec/tree/main/examples/gh)
  packages `gh` and its dependencies with network rules, credentials, and
  agent instructions.
- [Message of the day](https://github.com/docker/sandbox-kit-spec/tree/main/examples/motd)
  uses an inline Dockerfile and a build argument in a single-file mixin.

For examples of building a tool from source, running setup scripts, and other
reusable approaches, see
[Kit authoring patterns](/ai/sandboxes/customize/author/patterns/).

<!-- page: https://docs.docker.com/ai/sandboxes/customize/kits-v2/ fetched 2026-10-08 -->

# Kits v2




V2 kits remain supported. This page covers v2 usage, configuration, and the
specification. For new kit development with the `sbx` CLI, use
[v3 kits](/ai/sandboxes/customize/).

Built-in shortcuts such as `claude` and `codex` select v2 kits and still work
with v2 mixins. V3 workloads and mixins can't be combined with v1 or v2 kits.
V1 also remains supported.

## Use existing kits

A v2 kit contains `spec.yaml` with `schemaVersion: "2"` and an optional `files/`
tree. A sandbox kit defines the agent environment. A mixin adds tools or
configuration to it. Pass a sandbox kit in place of the agent name and add
mixins with `--kit`:

```console
$ sbx run ./my-agent --name my-project --kit ./team-config
$ sbx run claude --name claude-project --kit ./team-config
```

`sbx run` uses your current directory as the workspace. Append a project path
to use another directory. To create without launching the agent, use
`sbx create`; include a workspace path or `.` to mount a directory.
References can be local directories, ZIP files, OCI artifacts, or Git URLs.
Start relative paths with `./` or `../`. For Docker Hub kits, you can omit
`docker.io/` and use `<NAMESPACE>/<KIT>:<TAG>`. In Git URLs, `ref` selects a
revision and `dir` the kit directory. Quote URLs containing `&`:

```console
$ sbx run "git+https://github.com/<ORG>/<REPOSITORY>.git#ref=<COMMIT>&dir=my-agent"
```

`git+ssh://` URLs work with your local SSH agent and Git credentials.
For private registries, see
[Registry credentials](/ai/sandboxes/customize/configuration/credentials/#registry-credentials).

Kit selection with `--kit` applies at creation. Recreate the sandbox to change
its kit set, except for the limited updates supported by
[`sbx kit add`](#execution-order). That command restarts the sandbox while
preserving packages, images, volumes, and agent history. Kits can't be
removed from a running sandbox.

### Restrict kit sources

See [Restrict kit sources](/ai/sandboxes/customize/use-kits/#restrict-kit-sources)
for source policies. `kit.allowLocalKits` also governs v2 ZIP files.

## Image overrides for built-in agents

Use `--template` to replace a built-in agent's image while keeping its
configuration and launch command. The replacement image must support the
same agent. For example, an image used with `claude` must have Claude Code
installed.

To define an environment with its own launch command and sandbox settings,
see [Build an agent workload](/ai/sandboxes/customize/author/build-an-agent/)
for the v3 workflow.

### Choose a template

Docker publishes agent images as `docker/sandbox-templates:<variant>`.
Choose the variant that matches your agent. See
[Base images](/ai/sandboxes/customize/author/base-images/)
for the available variants.

Variants with a `-docker` suffix, such as `claude-code-docker`, include
Docker Engine for building and running containers inside the sandbox.
Built-in agents use these variants by default when you don't specify a
custom template.

If you don't need Docker inside the sandbox, select a variant without
the suffix. It uses fewer resources and doesn't require privileged mode:

```console
$ sbx run claude --template docker.io/docker/sandbox-templates:claude-code
```

Include the registry domain in `--template` image references. Unlike kit
references, template references don't automatically expand to include
`docker.io`.

### Build a custom template

Building a custom template requires
[Docker Desktop](/desktop/).

Extend the Docker-provided image for the agent you plan to run. For example,
this Dockerfile adds Rust and protocol buffer tools to the Claude Code image:

```dockerfile
FROM docker/sandbox-templates:claude-code
USER root
RUN apt-get update && apt-get install -y protobuf-compiler
USER agent
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```

Install system packages as `root`, then switch back to `agent` before
installing tools in the agent's home directory.

Build the image and push it to a registry. Replace `<NAMESPACE>` with a
Docker Hub namespace you can push to:

```console
$ docker build -t docker.io/<NAMESPACE>/my-template:v1 --push .
```

For registry credentials and loading a locally built image, see
[Load a template](/ai/sandboxes/usage/#load-a-template).

Run the sandbox with your image:

```console
$ sbx run claude --template docker.io/<NAMESPACE>/my-template:v1
```

Because this image extends `claude-code`, use it with `claude`. For an
image based on `codex`, use `codex`. For one based on `shell`, use `shell`
to open Bash without an agent.

If your added tools need network access, allow the domains they use in
the sandbox's network policy, unless you use the `allow-all` policy:

```console
$ sbx policy allow network "*.example.com:443,example.com:443"
```

## Kit kinds

### `kind: mixin`

A mixin layers capabilities onto an existing sandbox. It must not declare a
`sandbox:` block, `extends:`, or `mixins:`. A mixin can declare `requires:` to
pin the base agent it is designed for:

```yaml
schemaVersion: "2"
kind: mixin
name: github-tools
requires:
  agent: claude
```

`requires.agent` takes one base-agent name. It is validated as a kit name and
enforced during composition.

### `kind: sandbox`

A sandbox kit defines a full agent. A root sandbox must declare a `sandbox:`
block. A sandbox that uses `extends:` can inherit the parent image and omit its
own `sandbox:` block:

```yaml
schemaVersion: "2"
kind: sandbox
name: claude-safe
extends: claude
```

`extends:` is sandbox-only. The parent must resolve to a sandbox kit. `mixins:`
is also sandbox-only and accepted by the parser, but runtime composition support
is pending.

## Top-level fields

For the normative grammar, see the
[v2 specification](https://github.com/docker/sbx-kits-contrib/blob/main/spec/SPEC-v2.md).

| Field           | Required | Description                                                                                     |
| --------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `schemaVersion` | Yes      | Spec schema version. Use `"2"` for this grammar.                                                |
| `kind`          | Yes      | `mixin` for kits that extend an agent; `sandbox` for kits that define one.                      |
| `name`          | Yes      | Unique identifier. Lowercase alphanumeric with hyphens, 1 to 64 characters.                     |
| `version`       | No       | Kit version.                                                                                    |
| `displayName`   | No       | Human-readable name.                                                                            |
| `description`   | No       | Short description.                                                                              |
| `sourceURL`     | No       | Source repository or documentation URL.                                                         |
| `licenses`      | No       | SPDX license identifiers.                                                                       |
| `locked`        | No       | Dotted paths child kits may not override.                                                       |
| `security`      | No       | Container security settings. `security.privileged: true` runs the container in privileged mode. |
| `args`          | No       | Arguments supplied when the kit is loaded. Schema v2 only.                                      |

A kit also declares behavior blocks such as `agentInstructions`,
`permissions`, `ports`, `credentials`, `environment`, `setup`, and `volumes`.

## Arguments

A schema v2 kit can declare arguments and reference them anywhere in
`spec.yaml` or under `files/` as `${{ kit.args.<name> }}`. Substitution happens
before the spec is decoded.

```yaml
args:
  version:
    default: latest
    description: Tool version to install
    pattern: '^(latest|[0-9]+\.[0-9]+\.[0-9]+)$'
  channel:
    default: stable
    enum: [stable, beta, nightly]
  target:
    required: true
    description: Build target

environment:
  variables:
    TOOL_VERSION: "${{ kit.args.version }}"
```

Don't use kit arguments for API tokens, passwords, or other secrets. Use
[Credentials](/ai/sandboxes/customize/configuration/credentials/) to provide sensitive values to
a sandbox.

| Field         | Description                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| Argument name | Starts with a letter or underscore and contains only letters, digits, underscores, and hyphens.             |
| `default`     | String to use when the caller supplies no value. Mutually exclusive with `required: true`.                   |
| `required`    | Set to `true` when the caller must supply a value. Mutually exclusive with `default`.                        |
| `description` | Optional help text shown when a required value is missing.                                                   |
| `enum`        | Optional list of accepted values. Mutually exclusive with `pattern`.                                         |
| `pattern`     | Optional Go RE2 regular expression matched against the complete value. Mutually exclusive with `enum`.       |

Each argument must declare either `default`, including an empty-string
default, or `required: true`.

Argument values are strings, but substitution happens before YAML decoding.
Quote a placeholder in a string-valued field so a value such as `1.20` isn't
decoded as a number.

### Pass arguments to kits

Use `--kit-arg name=value` for every kit declaring that argument, or prefix
with the kit's `name` to target one kit. Scoped values override shared values:

```console
$ sbx run ./my-agent --kit ./my-mixin --kit-arg channel=stable \
    --kit-arg my-mixin.channel=beta
```

`--kit-args-file <FILE>` reads `name=value` entries, ignoring blank lines and
`#` comments. Later files override earlier files; `--kit-arg` overrides files.
For repeated CLI keys, the last value wins. Missing required values, unknown
arguments, undeclared placeholders, and invalid values fail before creation.
Pass the same flags to `sbx kit validate` or `sbx kit inspect` when needed.
Argument values can remain in shell history and are stored unencrypted in
argument files.

## Sandbox block

```yaml
sandbox:
  image: <image-ref>
  build:
    context: .
    dockerfile: Dockerfile
    args:
      AGENT_VERSION: "1.0.0"
    target: runtime
    platforms:
      - linux/amd64
  entrypoint: [my-agent, "--flag"]
  command:
    default: ["--task-mode"]
    interactive: []
  resources:
    cpu: 2
    memory: 4g
    gpu: "1"
```

| Field                | Required | Description                                                                                                     |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `sandbox.image`      | When `extends:` is omitted | Docker image reference.                                                                                         |
| `sandbox.build`      | No       | Build configuration. Runtime support is pending, so a kit with `build:` must also set `image:`.                 |
| `sandbox.entrypoint` | No       | Fixed process prefix as a string array. The first element is the agent binary.                                  |
| `sandbox.command`    | No       | Mode-specific argument tail. Use a list shorthand for `default`, or a mapping with `default` and `interactive`. |
| `sandbox.resources`  | No       | Optional CPU, memory, and GPU constraints. Memory uses byte-size strings such as `4096m` or `4g`.               |

The effective command is `entrypoint` plus `command.default` for non-interactive
launches, and `entrypoint` plus `command.interactive` for TTY sessions. If
`interactive` is omitted, it falls back to `default`.

For a kit that uses `extends:`, `sandbox.command` replaces the full inherited
argument tail, including flags after the binary in the parent's
`sandbox.entrypoint`. It doesn't append to that tail. Define every argument the
child needs. For example, a child of `claude` that adds `--settings` must also
include `--dangerously-skip-permissions` to preserve that behavior.

The agent's container image must provide:

- A non-root `agent` user at UID 1000 with passwordless sudo.
- A `/home/agent/` home directory owned by `agent`.
- HTTP proxy environment variables (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`) preserved across sudo.
- The agent binary, either baked in or installed with [`setup.install`](#setup).

Build on top of `docker/sandbox-templates:shell-docker` to get these base
requirements.

## Agent instructions

Declare these fields under `agentInstructions`:

| Field      | Description                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `filename` | AI profile filename. Meaningful for `kind: sandbox`; ignored with a warning for `kind: mixin`.      |
| `content`  | Markdown instructions. For a sandbox, inlined into the profile. For a mixin, written to kit memory. |

For mixins, the engine writes `content` to
`<dir-of-AI-file>/kits-memory/<kit-name>.md` and adds a `## Kits` pointer
section to the base AI file. This keeps each mixin's instructions in a separate
file.

The generated profile lives in the parent directory of the mounted workspace
inside the sandbox. It sits outside the mount and doesn't replace an
instruction file in the project. The sandbox kit's inline instructions go
directly into that profile.

## Credentials

A kit declares the credentials it needs and how the proxy injects them into
outbound requests. It does not declare a host discovery source. The user
provides the value through the secret store or the first-run prompt, and a
[credential binding](/ai/sandboxes/customize/configuration/credentials/) authorizes its use. A kit
can't read arbitrary host environment variables or files.

`credentials` is a list; each entry names a `service` and configures one or more
auth mechanisms.

| Field         | Description                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `service`     | Credential identifier, matched against the value stored with `sbx secret set`. Lowercase kebab-case.                                        |
| `description` | Optional. Shown to the user when approving a [binding](/ai/sandboxes/customize/configuration/credentials/#credential-bindings).                                     |
| `required`    | Marks the credential as essential to the agent. If it has no binding, `sbx` warns and starts with the credential withheld. Default `false`. |
| `provider`    | Reserved for a provider registry. Accepted with a warning and no runtime effect.                                                            |
| `apiKey`      | API-key injection (see [apiKey](#apikey)).                                                                                                  |
| `oauth`       | OAuth interception (see [oauth](#oauth)).                                                                                                   |

Each service must declare `apiKey`, `oauth`, or both. When both resolve at
runtime, the API key takes precedence and OAuth acts as the fallback.

### `apiKey`

| Field               | Description                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`              | Environment variable name for the credential (for example, `ANTHROPIC_API_KEY`).                                                                  |
| `proxyManaged`      | If `true`, `sbx` sets `name` inside the container to the `proxy-managed` sentinel. Default `false`.                                               |
| `inject[].domain`   | Domain to inject the credential into. Must also be allowed in [`permissions.network`](#network).                                                  |
| `inject[].header`   | HTTP header the proxy sets (for example, `x-api-key`, `Authorization`).                                                                           |
| `inject[].format`   | Header value format, with one `%s` placeholder (for example, `"%s"` or `"Bearer %s"`). Mutually exclusive with `scheme`.                          |
| `inject[].scheme`   | Shorthand for common auth schemes. `bearer` expands to `Authorization: Bearer %s`; `basic` requires `username`. Mutually exclusive with `format`. |
| `inject[].username` | Username for HTTP Basic auth, for example `x-access-token` for Git over HTTPS.                                                                    |

### `oauth`

For agents that authenticate with OAuth (for example, Claude Code), the proxy
intercepts token responses and replaces real tokens with sentinels, then swaps
the real token back in on outbound requests. By default, the token never enters
the sandbox. Setting `passthrough: true` opts out of sentinel masking and sends
the real token response into the sandbox.

| Field                                    | Description                                                                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokenEndpoint.host` / `path`            | The OAuth token endpoint the proxy intercepts.                                                                                                                                                    |
| `sentinels.accessToken` / `refreshToken` | Sentinel values written into the container in place of the real tokens.                                                                                                                           |
| `credentialFile.path`                    | Where to write the credential file inside the container (`~` expands).                                                                                                                            |
| `credentialFile.structure`               | Declarative JSON shape. Supports `{{.AccessToken}}`, `{{.RefreshToken}}`, `{{.ExpiresAt}}`, and `{{.Scopes}}`.                                                                                   |
| `credentialFile.template`                | Go template. Supports `{{.AccessToken}}`, `{{.RefreshToken}}`, `{{.ExpiresAt}}`, `{{.Scopes}}`, and `{{.ScopesJSON}}`.                                                                          |
| `resourceHosts`                          | API hosts where the proxy attaches the token on outbound requests, distinct from the token endpoint host.                                                                                         |
| `skipIfEnv`                              | Accepted for compatibility, but ignored for schema v2. A v2 binding is authoritative instead of host environment variables.                                                                       |
| `responseFields`                         | Overrides the default field names the proxy reads from the token response.                                                                                                                        |
| `passthrough`                            | If `true`, the proxy passes the token response through unchanged instead of replacing the tokens with sentinels.                                                                                  |

`credentialFile.structure` provides a declarative alternative to
`credentialFile.template`. The engine renders it as well-formed JSON. If both
fields are set, `structure` takes precedence.

## Network

Network egress is declared under `permissions.network`. Credentials no longer carry
their own domain mapping — the proxy injects a credential only into the domains
its [`apiKey.inject`](#apikey) lists, and every domain the
sandbox reaches must be allowed here.

| Field                       | Description                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `permissions.network.allow` | Domains the sandbox can reach.                                                                                  |
| `permissions.network.deny`  | Domains the sandbox is blocked from reaching. Deny takes precedence over allow, including across composed kits. |

Allow and deny patterns:

| Pattern               | Example                  | Status                      |
| --------------------- | ------------------------ | --------------------------- |
| Exact host            | `api.example.com`        | Enforced                    |
| Exact host and port   | `api.example.com:8080`   | Enforced                    |
| Single-label wildcard | `*.example.com`          | Enforced                    |
| Multi-label wildcard  | `**.example.com`         | Parsed; enforcement pending |
| Port range            | `api.example.com:80-443` | Parsed; enforcement pending |
| Port wildcard         | `api.example.com:*`      | Parsed; enforcement pending |
| CIDR                  | `10.0.0.0/8`             | Parsed; enforcement pending |

In v1 this was the `network:` block (`allowedDomains` / `deniedDomains`, plus
`serviceDomains` / `serviceAuth`). In v2, those fields are decode errors.

## Ports

Declare `ports` as a list of entries to expose sandbox services to the host:

| Field       | Description                                                         |
| ----------- | ------------------------------------------------------------------- |
| `container` | Container port, 1 to 65535.                                         |
| `protocol`  | `tcp` or `udp`. Empty publishes one family; see below.              |
| `name`      | Optional label surfaced by tools that list published port bindings. |

Host ports are allocated ephemerally. Leave `protocol` empty unless the service
listens on IPv6: an empty value publishes IPv4 only (`127.0.0.1`), which is what
a service bound to `0.0.0.0` needs, while `tcp` publishes both `127.0.0.1` and
`::1` — and a client arriving over `::1` is accepted and then reset if nothing
in the sandbox is listening there. Users can pin host ports with
`sbx ports --publish <host>:<container>`.

## Environment

| Field       | Description                                    |
| ----------- | ---------------------------------------------- |
| `environment.variables` | Key-value pairs set directly in the container. |

Do not set `DASH_`, `SBX_`, or `DOCKER_` variables, and avoid overriding
`HOME`, `USER`, `SHELL`, `PATH`, `LD_PRELOAD`, and `LD_LIBRARY_PATH`. The
runtime reserves these names and may override them.

## Setup

`setup.install`, `setup.startup`, and `setup.files` are lists of commands or
files with the fields described here.

### Execution order

When a sandbox is created, kit content is applied in this order:

1. Network permissions and environment variables.
2. Static files under `files/home/`.
3. `setup.install` commands, in declaration order.
4. `setup.files` entries.
5. `setup.startup` commands are registered for each sandbox start.
6. Static files under `files/workspace/`, after the workspace is ready. With
   `--clone`, this means after the repository has been cloned.

For stacked kits, entries in each stage are applied in `--kit` order. An install
command can consume a bundled file from `files/home/`, but not one from
`files/workspace/` or `setup.files`, because those files land later.

`sbx kit add` recreates the sandbox rather than modifying it in place. It
supports mixin kits limited to
`environment.variables`, `setup.install`, and `permissions.network.allow`,
which follow the same order as sandbox creation. It rejects a kit that declares
static files, `setup.startup`, or `setup.files`. To use those fields, recreate
the sandbox with the kit.

### install

Runs synchronously when a kit is applied, either during sandbox creation or
through `sbx kit add`. Shell strings are passed to `sh -c`.

Kit install commands start in the template image's configured `WORKDIR`.
Docker-provided templates use `/home/agent/workspace`, which isn't necessarily
the primary workspace in a direct-mounted or clone-mode sandbox. Don't rely on
the current directory to locate workspace files. Use absolute paths for bundled
assets from `files/home/`.

| Field         | Default | Description                   |
| ------------- | ------- | ----------------------------- |
| `command`     | —       | Shell command string.         |
| `user`        | `"0"`   | User to run as. `"0"` = root. |
| `description` | —       | Human-readable description.   |

### startup

Runs at every sandbox start. String array, not interpreted by a shell. A
`$WORKSPACE_DIR` reference in the array is passed unchanged. To expand it, run
the command through a shell, for example `["sh", "-c", "..."]`.

| Field         | Default  | Description                         |
| ------------- | -------- | ----------------------------------- |
| `command`     | —        | Command and args as a string array. |
| `user`        | `"1000"` | User to run as. `"1000"` = agent.   |
| `background`  | `false`  | Block later startup commands until this command finishes. Set to `true` to let later commands run without waiting. |
| `description` | —        | Human-readable description.         |

Startup commands are non-interactive. They run before the agent
attaches, with no terminal connected, so they can't prompt the user
(for example, an interactive `aws login` will hang or fail). They also
don't gate the agent's entrypoint: the agent launches once startup
commands have been dispatched, regardless of `background`. A value of
`false` waits within the startup dispatcher before it runs the next command;
it doesn't delay the agent entrypoint. Use startup commands
for work that can run alongside the agent. Use `setup.files` for any value that
needs to land on disk before the agent runs.

Startup commands must be idempotent. They run on every sandbox start
and replay on container restarts, so a command that fails or
misbehaves on a second invocation breaks the restart path. Guard
work with existence checks, use upserts instead of inserts, and
prefer commands that converge to the same end state regardless of
how many times they run.

### files

Files written at sandbox start, with runtime substitution.

| Field           | Default  | Description                                               |
| --------------- | -------- | --------------------------------------------------------- |
| `path`          | —        | Absolute container path.                                  |
| `content`       | —        | File content. Write `${WORKDIR}` for the workspace path. |
| `mode`          | `"0644"` | File permissions in octal.                                |
| `onlyIfMissing` | `false`  | Skip if the file already exists.                          |

The runtime writes these files as the agent user with UID 1000. The target
path must be writable by that user. To write to a root-owned path such as
`/etc`, use an `install` command, which runs as root by default. Set ownership
in the install command if the agent needs to modify the file later.

Write `${WORKDIR}` in `content` and `$WORKSPACE_DIR` in commands. Three names
look alike and mean different things:

| Name            | What it is                                                    | Where it applies                                 |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| `${WORKDIR}`    | Placeholder for the workspace path                            | `setup.files[].content` only                     |
| `WORKSPACE_DIR` | Environment variable set by the runtime to the workspace path | Shell commands, and the agent                    |
| `WORKDIR`       | The template image's Dockerfile working directory             | Where commands start, see [install](#install)    |

The runtime replaces `${WORKDIR}` when it creates the sandbox, only inside
`content`, never in `path` or in commands. `WORKSPACE_DIR` is an environment
variable, so a `$WORKSPACE_DIR` reference expands only when a shell runs the
command. `install` strings run through `sh -c`. `startup` arrays run without a
shell. A Dockerfile `WORKDIR` doesn't define an environment variable.

### Shell initialization and service logs

With Docker templates, append shell initialization to
`/etc/sandbox-persistent.sh` in an install command. Keep existing content and
omit completion scripts: interactive and non-interactive Bash commands source
this file. For a background service, redirect startup output to a file and
read it with `sbx exec`. Use `background: true` instead of a trailing `&`.

## Static files

```text
my-kit/files/
├── home/       → /home/agent/
└── workspace/  → primary workspace path
```

| Kit path           | Container destination                   |
| ------------------ | --------------------------------------- |
| `files/home/`      | `/home/agent/` (config files, dotfiles) |
| `files/workspace/` | The primary workspace path              |

Parent directories are created automatically. Existing files are
overwritten. Absolute paths and path-traversal sequences (`../../`) are
rejected.

Static files can supply linter settings, helper scripts, or agent skills.
For example, a Claude Code project skill belongs at
`files/workspace/.claude/skills/<NAME>/SKILL.md`.

## Volumes

Declare `volumes` as a list of mounts with these fields:

| Field  | Description                                                         |
| ------ | ------------------------------------------------------------------- |
| `path` | Required absolute container path.                                   |
| `type` | Empty for a block-backed volume, or `tmpfs` for RAM-backed storage. |
| `size` | Optional byte-size string.                                          |
| `mode` | Optional octal permissions.                                         |

Volumes are applied only when a sandbox is created. `sbx kit add` cannot attach
volumes to a running container.

## Fork an existing agent

Sandbox kits (`kind: sandbox`) define a full agent from scratch. The most
common variant is a fork of a built-in agent. Use `extends:` to inherit the
parent's complete configuration and declare only the fields you want to change.
This example replaces the built-in `claude` entrypoint so Claude Code uses
manual permission mode instead of bypassing approval prompts:

```yaml {title="claude-safe/spec.yaml"}
schemaVersion: "2"
kind: sandbox
name: claude-safe
displayName: Claude Code (with approval prompts)
description: Claude Code in manual permission mode

extends: claude

sandbox:
  entrypoint: [claude, "--permission-mode", "manual"]
```

The child inherits the built-in image, credentials, network permissions,
persistent volumes, settings, MCP integration, agent instructions, setup
entries, and environment variables. Its `sandbox.entrypoint` replaces the
inherited entrypoint.

Launch by passing the sandbox kit in place of a built-in agent name:

```console
$ sbx run ./claude-safe
```

## Install an internal CA certificate

Put each PEM-encoded root certificate under `files/home/` with a `.crt`
extension. For `files/home/internal-ca.crt`, use:

```yaml {title="internal-ca/spec.yaml"}
schemaVersion: "2"
kind: mixin
name: internal-ca
setup:
  install:
    - command: "install -m 0644 /home/agent/internal-ca.crt /usr/local/share/ca-certificates/internal-ca.crt && update-ca-certificates"
      user: "0"
```

This updates the system trust store. For several CAs, install every
certificate before running `update-ca-certificates`.

## Sandbox-managed agent configuration

Built-in agent kits reserve the following paths for sandbox setup. Treat these
paths as sandbox-managed, even if a file is only needed for a particular
feature. Don't target them with static files, `setup.files`, or install
commands. Later setup can replace your content or depend on settings that your
file removes. In this table, `~` is `/home/agent`.

| Built-in agent kit | Managed configuration paths |
| ------------------ | --------------------------- |
| `claude` | `~/.claude.json`, `~/.claude/settings.json`, `~/.claude/.config.json` |
| `codex` | `~/.codex/config.toml` |
| `copilot` | `~/.copilot/config.json` |
| `cursor` | `~/.cursor/cli-config.json` |
| `devin` | `~/.config/devin/config.json`, `~/.config/devin/mcp_config.json` |
| `gemini` | `~/.gemini/settings.json` |
| `kiro` | `~/.kiro/settings/mcp.json` |
| `opencode` | `~/.config/opencode/opencode.json` |

Use separate settings files when supported: Claude Code accepts `--settings`,
and OpenCode reads `OPENCODE_CONFIG`. Don't use `setup.startup` for settings
the agent must read during initialization; startup commands don't gate the
entrypoint.

## Packaging and distribution

The `sbx kit` subcommands validate, inspect, and publish kits:

- `sbx kit validate <path>` — check that a kit directory or ZIP is
  well-formed.
- `sbx kit inspect <path>` — display kit details. Add `--json` for
  machine-readable output.
- `sbx kit pack <path> -o <file.zip>` — package a directory as a ZIP file
  for sharing.
- `sbx kit push <path> <ref>` — publish to an OCI registry (for example,
  `ghcr.io/myorg/my-kit:1.0`).
- `sbx kit pull <ref>` — download a kit from a registry as a ZIP file to
  the working directory.

For Docker Hub, `sbx kit pull` and `sbx kit push` use the session from
`sbx login`. For other registries, they prefer credentials stored with
[`sbx secret set --registry`](/ai/sandboxes/customize/configuration/credentials/#registry-credentials).
Both commands fall back to the Docker credential store, so credentials from
`docker login` also work.

## Sign and verify kits

Use cosign-compatible Sigstore signatures to verify who approved a kit and
that its signed content hasn't changed. Signing is keyless by default. Verify a
keyless signature with the certificate identity and OpenID Connect (OIDC)
issuer:

```console
$ sbx kit sign ./my-kit/
$ sbx kit verify \
    --certificate-identity user@example.com \
    --certificate-oidc-issuer https://accounts.google.com \
    ./my-kit/
```

For key-based signing, use an ECDSA P-256 key pair:

```console
$ sbx kit sign --key cosign.key ./my-kit/
$ sbx kit verify --key cosign.pub ./my-kit/
```

For a local directory, `sbx kit sign` writes a `kit.sig.bundle` file next to
`spec.yaml`. Commit this file so consumers can verify a kit loaded from the Git
repository. For an OCI kit, the signature is stored as an OCI referrer. You can
sign an OCI kit after pushing it, or push and sign it in one step:

```console
$ sbx kit push ./my-kit/ ghcr.io/myorg/my-kit:1.0 --sign
```

ZIP kits can't carry verifiable signatures.

### Require signed kits

Set [`kit.trustedSigners`](/ai/sandboxes/customize/configuration/settings/#kittrustedsigners) to
the identities or keys you trust before requiring signatures. Otherwise, `sbx` uses the default policy, which trusts
Docker employee identities attested by Google's OpenID Connect issuer. A
keyless policy must specify both the certificate identity and its OpenID
Connect issuer:

```console
$ sbx settings set kit.trustedSigners \
    '[{"identity":"release-bot@example.com","issuer":"https://accounts.google.com"}]'
$ sbx settings set kit.requireSignature true
```

To trust a key-based signature, set the policy to the public key path:

```console
$ sbx settings set kit.trustedSigners '[{"key":"/path/to/cosign.pub"}]'
$ sbx settings set kit.requireSignature true
```

When `kit.requireSignature` is `true`, `sbx` rejects unsigned kits, signatures
that don't match `kit.trustedSigners`, and ZIP kits. This policy applies when a
kit is loaded from a local directory, Git repository, or OCI registry.

The signature covers `spec.yaml` and the kit's `files/` content, but not mutable
dependencies such as image tags or content downloaded by install and startup
commands. Pin those dependencies by digest or checksum when they must remain
immutable.

## Schema versions

Schema v2 is supported starting with Docker Sandboxes version 0.36. Use
`schemaVersion: "2"` for the syntax on this page. Version `"1"` also remains
accepted. V3 is a separate format for environments built entirely
with v3 workloads and mixins. V3 kits can't compose with v1 or v2 kits.
See [Kits v3](/ai/sandboxes/customize/) for that workflow.

When migrating to `schemaVersion: "2"`, replace v1 fields with their v2
equivalents:

| v1                                          | v2                                       |
| ------------------------------------------- | ---------------------------------------- |
| `credentials.sources.<id>`                  | `credentials:` list entry with `service` |
| `network.allowedDomains` / `deniedDomains`  | `permissions.network.allow` / `deny`     |
| `network.serviceDomains` / `serviceAuth`    | `credentials[].apiKey.inject`            |
| `network.publishedPorts` / `publishedPorts` | top-level `ports`                        |
| standalone `oauth:` block                   | `credentials[].oauth`                    |
| `oauth.skipIfEnv`                           | Accepted but ignored                     |
| `environment.proxyManaged`                  | `credentials[].apiKey.proxyManaged`      |
| `memory` / `agentContext`                   | `agentInstructions.content`              |
| `kind: agent` / `agent:` block              | `kind: sandbox` / `sandbox:` block       |
| `sandbox.aiFilename`                        | `agentInstructions.filename`             |
| `sandbox.entrypoint.run`                    | `sandbox.entrypoint`                     |
| `sandbox.entrypoint.args`                   | `sandbox.command.default`                |
| `sandbox.entrypoint.ttyArgs`                | `sandbox.command.interactive`            |
| `tmpfs:`                                    | `volumes:` entries with `type: tmpfs`    |
| `volumes:` (mapping form)                   | `volumes:` sequence (`- path: <path>`)   |
| `commands:` / `commands.initFiles`          | `setup:` / `setup.files`                 |
| `settings:` / `kitDir` / `persistence`      | Removed                                  |

Credential discovery also moved out of the kit in v2: a kit declares which
credentials it needs and how to inject them, but where each value comes from is
controlled by the user through
[credential bindings](/ai/sandboxes/customize/configuration/credentials/#credential-bindings).

> [!NOTE]
> `mixins` and `sandbox.build` are accepted by the parser, but runtime support
> is pending. A kit that sets `sandbox.build` must also set `sandbox.image`.

## Move an environment to v3

Select a v3 workload, convert or replace its mixins, and create a separate
sandbox with a different `--name`. Use the explicit workload reference in
place of the built-in shortcut. Every selected kit must use v3.

Changing `schemaVersion` alone doesn't convert a kit. Separate reusable image
content from sandbox initialization, and declare runtime capabilities:

| V2 surface | V3 equivalent |
| --- | --- |
| `kind: sandbox` | `kind: workload` with a Dockerfile recipe |
| `sandbox.image` | Dockerfile `FROM` |
| `sandbox.entrypoint`, `sandbox.command`, `environment.variables` | Dockerfile `ENTRYPOINT`, `CMD`, and `ENV` |
| `extends` | A mixin for composition, or a derived workload image with its own descriptor |
| `setup.install` | Dockerfile `RUN` for reusable content; lifecycle `install` for sandbox initialization |
| `setup.startup` and `setup.files` | Lifecycle capability `startup` and `files` |
| `setup.files[].onlyIfMissing: true` | Lifecycle `files[].overwrite: false` |
| Automatic `files/home/` and `files/workspace/` injection | Dockerfile `COPY`, with lifecycle hooks for destinations provided by runtime mounts |
| `permissions.network` and `credentials` | Network-policy and credential capabilities |
| `agentInstructions` | Agent-context capability |
| `${WORKDIR}` in `setup.files[].content` | `${{ kit.env.WORKSPACE_DIR }}` in lifecycle [`files` content](/ai/sandboxes/customize/author/#generated-files) |

Follow the [v3 authoring guidance](/ai/sandboxes/customize/author/)
when converting runtime setup and capability declarations.
Use a [kit set](/ai/sandboxes/customize/author/kit-sets/) to combine
published v3 components with your settings. To rebuild the agent environment
from a base image, follow [Build an agent workload](/ai/sandboxes/customize/author/build-an-agent/).
Running an existing sandbox keeps its recorded configuration. It doesn't
migrate the kit composition.

<!-- page: https://docs.docker.com/ai/sandboxes/customize/use-kits/ fetched 2026-10-08 -->

# Use kits




If you've run `sbx run claude` or `sbx run codex`, you've already used a kit.
The built-in agents are kits that package an environment, tools, and runtime
settings. You run kits you build yourself or get from another publisher in the
same way: give `sbx` a reference, and Docker Sandboxes prepares the environment
and applies the kit's settings.

This page shows how to run published kits, combine them with mixins, and
customize their settings.

## Run a kit

The built-in agent names are shortcuts for kit references. To run another kit,
replace the agent name with that kit's reference. For example, run Docker's
published v3 Codex workload:

```console
$ sbx run docker.io/docker/sbx-kit-codex:0.155.1 --name codex-v3-kit
```

This starts Codex using a v3 kit from Docker Hub. The built-in `codex`
shortcut uses a v2 kit to preserve compatibility with existing customizations.

### Choose a kit source

The previous example uses a published image from Docker Hub. You can also
run a kit from a local directory or a Git repository. The same source types
work for mixins added with `--kit`:

| Source | Example reference |
| --- | --- |
| Published image | `docker.io/my-org/agent-kit:1.0.0` |
| Local directory | `./my-agent` |
| Git repository | `git+https://github.com/<ORG>/<REPOSITORY>.git#ref=<COMMIT>&dir=my-agent` |

For Git sources, `ref` selects a revision and `dir` selects the kit's
subdirectory. Quote Git URLs in shell commands because they can contain `&`:

```console
$ sbx run "git+https://github.com/<ORG>/<REPOSITORY>.git#ref=<COMMIT>&dir=my-agent"
```

`sbx` pulls published images and builds local or Git sources when creating
the sandbox. Builds with unchanged source content and supplied kit arguments
reuse cached results.

By default, remote kit sources are limited to Docker Hub. To use a Git
source or another registry, see [Restrict kit sources](#restrict-kit-sources).
For private images, see
[Registry credentials](/ai/sandboxes/configuration/credentials/#registry-credentials).

## Reuse a sandbox

A sandbox keeps the kit configuration it was created with. To return to the
sandbox from the previous example, specify its name:

```console
$ sbx run --name codex-v3-kit
```

You don't need to specify the kit reference again. To try a different workload,
mixin combination, or argument value, create a sandbox with a different name
or recreate the existing one. To add a mixin to an existing sandbox, see
[Add mixins](#add-mixins).

## Runtime access and instructions

A kit can request access to the services it needs. For example, the Codex
workload needs to reach OpenAI and authenticate. If you use an API key,
store it on your host and approve the kit's request to use it. These are
separate steps: storing a secret doesn't give a third-party kit permission to
use it. See
[Credential bindings](/ai/sandboxes/configuration/credentials/#credential-bindings)
for preparing unattended runs.

Check the kit's documentation for the services it contacts, the credentials
it needs, and the commands it runs at startup. For proxy-managed credentials,
the kit's credential binding tells the proxy which credential to add to
requests to the service. Once you approve the binding, the proxy adds the
credential to outgoing requests. The credential value stays on your host
and isn't exposed inside the sandbox.

Network requests must also meet your sandbox's network policy. Kit allow rules
can't grant access beyond your organization's policy. If a connection fails,
check the [policy log](#debug-kits) to see which rule blocked it.

Kits can also give the agent instructions for using their tools. The workload
chooses the instruction file, and mixins add their guidance to it. Docker
Sandboxes writes that file outside your workspace, leaving your project's
instructions intact.

## Add mixins

Mixins add tools and configuration to a workload. Use `--kit` to add a mixin
when creating a sandbox. For v3 kits, both the workload and the mixin must
use v3.

For example, an internal CLI mixin can package your company's executable
along with network rules and a credential request for its API:

```console
$ sbx run docker.io/docker/sbx-kit-codex:0.155.1 --name codex-tools \
    --kit docker.io/<NAMESPACE>/company-cli:1.0.0
```

Replace the mixin reference with one your organization has published.
To build your own, see
[Build a tool mixin](/ai/sandboxes/customize/author/tool-mixins/).
Store the credential requested by the mixin on the host and approve access
when prompted.

Codex starts with `company-cli` available to use. Docker Sandboxes
applies the files and settings from both the workload and the mixin.

Built-in shortcuts such as `claude` and `codex` use v2 kits and require
[v2 mixins](/ai/sandboxes/customize/kits-v2/).
See [Version compatibility](/ai/sandboxes/customize/#version-compatibility)
for details.

### Combine multiple mixins

Repeat `--kit` to add more mixins. You can also add compatible mixins to a
published workload set, or pass a set containing only mixins with `--kit`.

Avoid adding a kit that's already in the set. If two kits provide the same
feature, Docker Sandboxes can reject the combination.

To publish your combination as one reference, see
[Compose a kit set](/ai/sandboxes/customize/author/kit-sets/).
To keep the kits separate in a shared sandbox configuration, list them in a
[sandbox environment file](/ai/sandboxes/configuration/environment-files/).
Give each published kit its own image repository name. Different tags of the
same repository have the same kit name, and Docker Sandboxes rejects duplicate
names in a composition.

### Change a sandbox's mixins

For v3 kits, you choose the mixins when you create the sandbox. To use a
different combination, create another sandbox with a different name.
Specify the workload and all the mixins you want to include.

The `sbx kit add` command can't add mixins to an existing v3 sandbox.

The new sandbox doesn't inherit changes or kit volume data from the previous sandbox.

## Compose kits

Some mixins need a tool another kit supplies. For example, a mixin whose
scripts call `gojq` can declare that dependency:

```yaml
requires: [gojq]
```

The [gojq mixin example](/ai/sandboxes/customize/author/patterns/#leave-build-tools-out-of-the-mixin)
declares the feature it provides:

```yaml
provides: ["gojq@0.12.17"]
```

Include both mixins when you create the sandbox. Docker Sandboxes applies
the gojq mixin before the mixin whose scripts need it, regardless of the order
of your `--kit` flags. If you leave out gojq, sandbox creation fails.

A `requires` entry tells Docker Sandboxes what a kit needs. You still choose
and include the kit that provides it. Docker Sandboxes doesn't download a
kit for you based on this entry. A kit can also require a minimum feature
version or rule out incompatible kits.

With `--kit`, Docker Sandboxes checks and combines the kits when it creates
the sandbox. For a set, this happens when the publisher builds it. The
published kit includes a record of the exact components used, identified by
their image digests.

To declare these relationships in your own kits, see
[Composition fields](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/SPEC-v3.md#5-provides-requires-integrates-conflicts).

## Pass arguments to kits

Kits can expose arguments for settings such as a linter's mode. Check the
kit's documentation for argument names, defaults, and accepted values.
Use `--kit-arg name=value` to set an argument:

```console
$ sbx run docker.io/<NAMESPACE>/codex-tools:1.0.0 \
    --name codex-tools-fix --kit-arg lint_mode=fix
```

This example uses a workload set that exposes a `lint_mode` argument.
Replace the image reference with your set's published reference. To expose
arguments in your own set, see
[Configure component arguments](/ai/sandboxes/customize/author/kit-sets/#configure-component-arguments).

Argument values are plain text and can be recorded in shell history and
sandbox state. Use
[stored credentials](/ai/sandboxes/configuration/credentials/)
for secrets.

### Target a specific kit

An argument without a kit prefix applies to every selected kit that declares
it. To target one kit, use `--kit-arg <HANDLE>.<ARGUMENT>=<VALUE>`:

```console
$ sbx run docker.io/<NAMESPACE>/codex-tools:1.0.0 \
    --name codex-tools-fix --kit-arg codex-tools.lint_mode=fix
```

The handle identifies the kit and comes from its reference:

| Kit source | Handle |
| --- | --- |
| Published image | Final part of the repository name, such as `codex-tools` |
| Local directory | Directory name |
| Git repository | Selected subdirectory name, or repository name if no subdirectory is selected |

A value targeted at one kit overrides a value supplied to all kits.

### Load arguments from a file

Use `--kit-args-file <FILE>` to load arguments from a reusable file.
Write one `name=value` entry per line. You can prefix names with a kit
handle, as with `--kit-arg`.

Values passed with `--kit-arg` override those in the file.

### Which settings can you change?

For a kit set, you can change only the arguments the author has exposed.
Other component arguments are fixed when the set is published.

Settings chosen during the image build, such as a tool's version, require
rebuilding the image.

## Restrict kit sources

[`kit.allowedSources`](/ai/sandboxes/customize/configuration/settings/#kitallowedsources) controls
permitted remote kit sources. Its default permits
Docker Hub. To include a Git publisher, set the complete list of prefixes you
want to permit:

```console
$ sbx settings set kit.allowedSources '["docker.io/","github.com/docker/"]'
```

Prefixes match at path-segment boundaries. Local source directories are
controlled separately by `kit.allowLocalKits`, which defaults to `true`:

```console
$ sbx settings set kit.allowLocalKits false
```

For defaults and environment variable equivalents, see the
[kit settings reference](/ai/sandboxes/customize/configuration/settings/#kits).

## Verify kit signatures

To verify a published kit against its author's signing identity:

```console
$ sbx kit verify docker.io/<NAMESPACE>/my-kit:1.0.0 \
    --certificate-identity <SIGNER_IDENTITY> \
    --certificate-oidc-issuer <ISSUER_URL>
```

For key-based signatures, use `--key cosign.pub` instead of the certificate
identity and issuer options. Obtain the expected identity or public key from
the publisher.

To require trusted signatures when loading kits, configure the trusted signer
policy, then turn on the requirement:

```console
$ sbx settings set kit.trustedSigners \
    '[{"identity":"release-bot@example.com","issuer":"https://accounts.google.com"}]'
$ sbx settings set kit.requireSignature true
```

V3 source directories and Git sources don't support the source-signing
workflow. Use a signed OCI image when signatures are required.

## Debug kits

When a tool is missing or a request fails, inspect the running sandbox:

```console
$ sbx exec <SANDBOX> -- which <TOOL>
$ sbx exec <SANDBOX> -- cat /home/agent/.config/<TOOL>/settings.json
$ sbx policy log
```

The policy log shows outbound requests and the rules they matched. Use it to
find blocked package registries or API hosts. If downloads fail after adding a kit that requests
credentials, ask its author to check that credential injection targets only
the service hosts that need it.

To try an updated v3 kit, create a sandbox with a different name. Reusing
an existing sandbox keeps its recorded kit configuration.

<!-- page: https://docs.docker.com/ai/sandboxes/faq/ fetched 2026-10-08 -->

# FAQ


Host integration and workspace instructions on this page describe local
sandboxes. See [Local and cloud differences](/ai/sandboxes/faq/cloud/local-vs-cloud/) before
adapting those workflows to the cloud.

## Is Docker Sandboxes free? Can I use it commercially?

The `sbx` CLI and local sandbox compute are free to use, including for
commercial and professional work. Cloud sandbox compute uses a
[pay-as-you-go subscription](/agentic-platform/signup/#billing).
Model-provider charges are separate from sandbox compute.

Organization governance for local sandboxes includes centrally managed network,
filesystem, and MCP policies,
[sign-in enforcement](/ai/sandboxes/faq/governance/monitor-and-enforce/sign-in-enforcement/),
and [audit logs](/ai/sandboxes/faq/governance/audit). These
[organization governance features](/ai/sandboxes/faq/governance) require a separate paid
subscription —
[contact Docker Sales](https://www.docker.com/products/ai-governance/#contact-sales)
to get started.

## Why do I need to sign in?

Docker Sandboxes is built around the idea that you and your agents are a team.
Signing in gives each sandbox a verified identity, which lets Docker:

- **Tie sandboxes to a real person.** Governance matters when agents can build
  containers, install packages, and push code. Your Docker identity is the
  anchor.
- **Enable team features.** Team-scale features like
  [organization governance](/ai/sandboxes/faq/governance), shared environments, and audit logs
  need a concept of "who," and adding that later would be worse for everyone.
- **Authenticate against Docker infrastructure.** Sandboxes pull images, run
  daemons, and talk to Docker services. A Docker account authenticates those
  requests.

Your Docker account email is only used for authentication, not marketing.

## Can I enforce sandbox policies across my organization?

Yes. Admins can centrally manage network, filesystem, and MCP policies. These
controls apply to local sandboxes in the organization. When organization
governance is active, only organization allow rules grant access: local allow
rules set with `sbx policy` are no longer evaluated, while local deny rules
still apply on top.

See [Organization policies](/ai/sandboxes/faq/governance/access-controls/organization/). This
feature requires a separate paid subscription —
[contact Docker Sales](https://www.docker.com/products/ai-governance/#contact-sales)
to get started.

Cloud sandboxes use separate network policy configuration.
See [Cloud network policy](/ai/sandboxes/faq/cloud/network-policy/) for cloud controls.

## Which domains do I need to allow for Docker Sandboxes to work?

If your organization restricts outbound network access with a firewall or
proxy, add the following domains to your allowlist so that `sbx` can
authenticate, pull images, and report diagnostics for local sandboxes.
Cloud operations also connect to `https://api.sandboxes-cloud.docker.com`.

| Domain                                             | Description             |
| -------------------------------------------------- | ----------------------- |
| https://login.docker.com                           | Authentication          |
| https://hub.docker.com                             | Docker Hub              |
| https://api.docker.com                             | Docker API              |
| https://marlin-2.docker.com                        | Telemetry               |
| https://marlin-api.docker.com                      | Telemetry               |
| https://registry-1.docker.io                       | Docker pull/push        |
| https://auth.docker.io                             | Registry authentication |
| https://dhi.io                                     | Docker Hardened Images  |
| https://sbx-diagnostics.s3.us-east-1.amazonaws.com | Diagnostics upload      |

## Does the CLI collect telemetry?

The `sbx` CLI collects basic usage data about CLI invocations:

- Which command you ran
- Whether it succeeded or failed
- How long it took
- If you're signed in, your Docker username is included

CLI usage telemetry does not include your prompts or code. Cloud sandboxes
execute on Docker-managed infrastructure, so files you transfer to them are
stored in the cloud.

To opt out of CLI usage analytics, set the `SBX_NO_TELEMETRY` environment variable:

```console
$ export SBX_NO_TELEMETRY=1
```

## How do I set custom environment variables inside a sandbox?

Starting with `sbx` version 0.39.0, use `-e`/`--env` or `--env-file` with
`sbx run` and `sbx create`. See
[Set environment variables](/ai/sandboxes/faq/usage/#set-environment-variables) for syntax,
precedence rules, persistent configuration for an existing sandbox, and
guidance for credentials.

Variables in `/etc/sandbox-persistent.sh` are available to interactive sessions
and agents started with `sbx run`. A variable only takes effect for sessions
and agents started after it's added. Restart a running agent, or stop and start
the sandbox, to pick up the new value.

## Why do agents run without approval prompts?

The sandbox itself is the safety boundary. Because agents run inside an
isolated microVM with [network policies](/ai/sandboxes/faq/governance/access-controls/network/),
[credential isolation](/ai/sandboxes/faq/security/isolation/#credential-isolation), and no access to your host
system outside explicitly shared paths, the usual reasons for approval prompts
(preventing destructive commands, network access, file modifications) are
handled by the sandbox isolation layers instead.

If you prefer to re-enable approval prompts, change the permission mode
inside the session. Most agents let you switch permission modes after
startup. In Claude Code, use the `/permissions` command to change the mode
interactively.

To make approval prompts the default for every session, create a v2 sandbox
kit that extends the built-in agent and changes its launch options. See
[Fork an existing agent](/ai/sandboxes/faq/customize/kits-v2/#fork-an-existing-agent)
for a complete example.

For an environment built entirely with v3 kits, set the launch command in
the workload's Dockerfile. See [Build a v3 agent kit](/ai/sandboxes/customize/author/build-an-agent/).

## How do I know if my agent is running in a sandbox?

Ask the agent. The agent can see whether or not it's running inside a sandbox.
In Claude Code, use the `/btw` slash command to ask without interrupting an
in-progress task:

```text
/btw are you running in a sandbox?
```

## Why doesn't the sandbox use my user-level agent configuration?

Local sandboxes don't import your complete user-level agent configuration. Hooks,
settings, and other files under directories such as `~/.claude` remain on the
host. Project-level configuration in the working directory remains available
inside the sandbox.

Shared agent skills are the exception. Use `sbx skills add` to install skills
from a Git repository, or run `sbx skills import` to copy skills from supported
host directories. `sbx` keeps the skills in a persistent store shared with
sandboxes. See [Share agent skills](/ai/sandboxes/faq/workflows/agent-skills/) for repository
management, supported host directories, mount behavior, and per-sandbox
opt-out.

Keep project-specific skills and other agent configuration in the project
itself. This versions the configuration alongside the code. Don't use symlinks
to host paths because a sandboxed agent can't follow them outside the sandbox.

## Can I paste images into an agent?

In local sandboxes, image paste is off by default. Text paste works because the
terminal sends it directly. Pasting an image or screenshot with `Ctrl+V` is different:
the agent reads it from your host clipboard, and the sandbox blocks that access
unless you opt in.

Turn on [`clipboard.imagePaste`](/ai/sandboxes/faq/configuration/settings/#clipboardimagepaste):

```console
$ sbx settings set clipboard.imagePaste true
```

`Ctrl+V` then pastes host images into agents that read the clipboard, including
Claude Code and Codex. The setting takes effect within a few seconds, even for
running sandboxes.

This is opt-in because it relaxes the sandbox's isolation: when enabled, a process
inside the sandbox can read your host clipboard through the host-side proxy. The
exposure is narrow — reads happen only on a paste, return image data only
(`image/png`), and clipboard content is never cached or logged — but it's still
host data crossing into the sandbox, so it stays off until you turn it on.

To turn it back off:

```console
$ sbx settings set clipboard.imagePaste false
```

## Can I use Docker Sandboxes on headless Linux?

Yes. For local sandboxes on Linux, `sbx` stores secrets in the Secret Service
exposed by your desktop keyring, such as GNOME Keyring or KDE Wallet. Headless servers and some
WSL setups have no running Secret Service, so `sbx` falls back to a file under
`$XDG_CONFIG_HOME/com.docker.sandboxes`, which defaults to
`~/.config/com.docker.sandboxes` when `$XDG_CONFIG_HOME` is unset. No setup is
required. When you store a secret on such a host, `sbx` prints a notice:

```text
No keychain detected - this secret will be stored on disk, protected by file permissions rather than a password
```

`sbx` stores the file in a directory with `0700` permissions, the same
file-permission model used for `~/.docker/config.json`. Any user or process that
can read the file can retrieve the stored credentials, so treat the directory as
sensitive. Where available, prefer a keychain, which mediates access per
application.

To keep secrets in a keyring instead, run a Secret Service on the host before
storing them: install `gnome-keyring` and start `dbus-run-session`, or run the
keyring daemon under a login session that unlocks it. Once a working Secret
Service is available, `sbx` stores new
secrets in the keychain again. For where each platform keeps secrets, see
[Where secrets are stored](/ai/sandboxes/faq/configuration/credentials/#where-secrets-are-stored).

<!-- page: https://docs.docker.com/ai/sandboxes/get-started/ fetched 2026-10-08 -->

# Get started with local Docker Sandboxes


This walkthrough uses local sandboxes. For cloud credentials and a first cloud
session, see [Get started with cloud sandboxes](/ai/sandboxes/get-started/cloud/#get-started).

Docker Sandboxes run AI coding agents in isolated microVM sandboxes. Each
sandbox gets its own Docker daemon, filesystem, and network — the agent can
build containers, install packages, and modify files without accessing host
resources beyond those you share.

This page walks through your first session: run an agent in a sandbox, see how
the sandbox isolates it, control what it can reach on the network, and clean
up.

## Prerequisites

- [Install the `sbx` CLI](/ai/sandboxes/get-started/install/) and sign in to Docker
- Configure an authentication method for the agent you want to use. Most agents
  require an API key for their model provider. See the [agent pages](/ai/sandboxes/get-started/agents)
  for provider-specific instructions.

## Authenticate your agent

For Claude Code with a Claude subscription (Max, Team, or Enterprise), no
upfront setup is needed — use the `/login` command inside the sandbox to sign
in with OAuth. The session token stays on your host and is never stored inside
the sandbox.

If you prefer to authenticate with an API key, see
[Credentials](/ai/sandboxes/get-started/configuration/credentials/) for how to store one with
`sbx secret set`.

To give the agent access to GitHub for creating pull requests or interacting
with repositories:

```console
$ sbx secret set github --command 'gh auth token'
```

## Run your first sandbox

Pick a project directory and launch an agent with
[`sbx run`](/reference/cli/sbx/run/):

```console
$ cd ~/my-project
$ sbx run --name my-sandbox claude
```

The first time you run a sandbox, the CLI prompts you to choose a default
network preset:

```plaintext
Initialize the global network policy for your sandboxes:

  Applies to all sandboxes, current and future — change it later with
  "sbx policy allow/deny/rm". Kits, including built-in agent kits, may
  also add per-sandbox rules.

     1. Open         — All network traffic allowed, no restrictions.
  ❯  2. Balanced     — Default deny, with common dev sites allowed.
     3. Locked Down  — All network traffic blocked unless you allow it.

  Use ↑/↓ or 1–3 to navigate, Enter to confirm, Esc to cancel.
```

**Balanced** is a good starting point — it permits traffic to common
development services while blocking everything else. You can adjust individual
rules later. See [Local policy](/ai/sandboxes/get-started/governance/access-controls/local/) for a full
description of each option.

Replace `claude` with the agent you want to use — see [Agents](/ai/sandboxes/get-started/agents) for the
full list.

The first run takes a little longer while the agent image is pulled. Subsequent
runs reuse the cached image and start in seconds.

This attaches you to the agent running inside the sandbox. Give it a real
task — ask it to add a feature, install a dependency, or build and run your
project. The agent has a full Linux environment with its own Docker daemon, so
it can install packages, build images, and start containers on its own while it
works.

## See what the agent can touch

From another terminal, list your sandboxes:

```console
$ sbx ls
SANDBOX       AGENT    STATUS    PORTS   WORKSPACE
my-sandbox    claude   running           ~/my-project
```

Each row shows a sandbox's name, the agent running in it, its status, any
[published ports](/ai/sandboxes/get-started/usage/#publish-ports), and its
workspace — the host directory shared into the sandbox. That workspace is the
one part of your machine the agent can see.

When you run `sbx run` from a project directory without passing a workspace
path, the current directory is mounted read-write. The agent and your host see
the same files. Edits the agent makes to your project appear in your working
tree as it writes them, and you review them as an ordinary Git diff before
committing.

Everything else runs inside the microVM, isolated from your host:

- The agent has its own filesystem, Docker daemon, and network.
- Packages it installs, images it pulls, and containers it starts stay inside
  the sandbox. Your host system is untouched, and removing the sandbox discards
  them.

If you'd rather the agent not touch your working tree at all — for example,
when running several agents on one repository — use
[clone mode](/ai/sandboxes/get-started/usage/#clone-mode), which gives it a private clone instead.

## Control what the agent can reach

Isolation isn't only about the filesystem. You also control what the sandbox
can reach on the network. You chose a default policy before the sandbox
started, and you can inspect or adjust it at any time.

Check which rules are in effect:

```console
$ sbx policy ls
```

To allow a specific host:

```console
$ sbx policy allow network registry.npmjs.org
```

With **Locked Down**, even your model provider API is blocked unless you
explicitly allow it. With **Balanced**, common development services are
permitted by default. See
[local policy](/ai/sandboxes/get-started/governance/access-controls/local/) for the full rule set
and how to customize it.

## Clean up

Sandboxes persist after the agent exits, so you can stop one and pick up where
you left off later:

```console
$ sbx stop my-sandbox
```

Installed packages, Docker images, and configuration changes are preserved
across restarts. When you're done with a sandbox, remove it to reclaim disk
space:

```console
$ sbx rm my-sandbox
```

Removing a sandbox deletes everything inside it — installed packages, Docker
images, and the in-sandbox Git clone if you used clone mode. Files in your
host working tree are unaffected.

## What's next

You've run an agent, seen how the sandbox isolates it, and controlled its
network access. A few directions from here.

Run `sbx` with no arguments to open the interactive dashboard: a live view of
every sandbox where you can attach to agents, open shells, and manage network
rules from one place.

![The interactive dashboard showing sandbox status, resource usage, and network governance controls.](/ai/sandboxes/get-started/images/sbx-dashboard.png)

Then explore:

- [Usage guide](/ai/sandboxes/get-started/usage/) — basic commands, reconnecting, workspaces, and port
  publishing.
- [Workflow patterns](/ai/sandboxes/get-started/workflows) — Git strategies, local services, CI, and
  authenticated tools.
- [Sandbox environment files](/ai/sandboxes/get-started/configuration/environment-files/) — declare and share
  repeatable local sandbox configurations with `sbxenv.yaml`.
- [Customize with kits](/ai/sandboxes/get-started/customize) — package an agent, its tools, and its
  network rules into a reusable definition you launch with a single flag.
- [Agents](/ai/sandboxes/get-started/agents) — the full list of supported agents and how to configure
  each one.
- [Governance](/ai/sandboxes/get-started/governance) — centrally manage network, filesystem, and MCP
  policies across a team.

<!-- page: https://docs.docker.com/ai/sandboxes/governance/ fetched 2026-10-08 -->

# Governance


The governance described here applies to local sandboxes. Cloud sandboxes
use separate network policy configuration. See
[Cloud network policy](/ai/sandboxes/cloud/network-policy/) for cloud controls.

Sandbox governance covers the policy system that controls what sandboxes can
access over the network, on the filesystem, and through MCP. For MCP setup and
server registration, see [MCP gateway](/ai/sandboxes/mcp-gateway/). Governance operates
at two layers:

**Local policy** is configured per machine using the `sbx policy` CLI. It
lets individual developers customize which domains their sandboxes can reach.
See [Local policy](/ai/sandboxes/governance/access-controls/local/).

**Organization policy** is configured centrally in Docker Home. Network and
filesystem policies can also be managed via the
[Governance API](/reference/api/ai-governance/). Controls defined at the org
level apply uniformly across every local sandbox in the organization. Organization
governance can also include MCP policies for sandbox MCP activity. When
organization governance is active, only organization allow rules grant access:
local `sbx policy` allow rules are no longer evaluated, while local deny rules
still apply on top. See
[Organization policies](/ai/sandboxes/governance/access-controls/organization/).

Alongside this access-control policy, admins can require developers to sign in
as members of their organization before using sandboxes at all.
[Sign-in enforcement](/ai/sandboxes/governance/monitor-and-enforce/sign-in-enforcement/) is deployed
through endpoint management and ensures developers can't bypass organization
policy by using a personal account.

> [!NOTE]
> Organization governance is available on a separate paid subscription.
> [Contact Docker Sales](https://www.docker.com/products/ai-governance/#contact-sales)
> to request access.

## Learn more

Start with [Policy concepts](/ai/sandboxes/governance/concepts/) for the resource model, rule syntax,
MCP policy basics, evaluation, and precedence.

### Access controls

- [Local policy](/ai/sandboxes/governance/access-controls/local/): configure network rules on your
  machine with the `sbx policy` CLI.
- [Organization policies](/ai/sandboxes/governance/access-controls/organization/): centrally manage
  sandbox policies across your organization.
- [Network access policies](/ai/sandboxes/governance/access-controls/network/): control outbound network
  access from sandboxes, by host or by HTTP method and path.
- [Filesystem access policies](/ai/sandboxes/governance/access-controls/filesystem/): control which
  host paths sandboxes can mount as workspaces.
- [MCP access policies](/ai/sandboxes/governance/access-controls/mcp/): control MCP server registration,
  tool calls, resources, prompts, and approval gates.

### Monitor and enforce

- [Monitoring policies](/ai/sandboxes/governance/monitor-and-enforce/monitoring/): inspect active
  rules and monitor sandbox network traffic with `sbx policy ls` and
  `sbx policy log`.
- [Audit logs](/ai/sandboxes/governance/audit): view, configure, export, and collect governance audit
  records.
- [Sign-in enforcement](/ai/sandboxes/governance/monitor-and-enforce/sign-in-enforcement/): require
  developers to sign in as organization members, enforced through endpoint
  management.

### Reference

- [AI Governance API](/reference/api/ai-governance/): manage network and
  filesystem org policies programmatically.
- [MCP policy reference](/ai/sandboxes/governance/reference/mcp-policy/): look up Docker MCP policy
  actions, resources, attributes, context fields, and approval behavior.

<!-- page: https://docs.docker.com/ai/sandboxes/governance/access-controls/ fetched 2026-10-08 -->

# Access controls


Access controls are expressed as policies. Local and organization pages
describe where policies apply. Network and filesystem pages describe the rules
inside those policies. MCP policies use Cedar statements instead of the network
and filesystem rule format.

## Policy scope

- [Local policy](/ai/sandboxes/governance/access-controls/local/): configure network rules on a developer machine with
  the `sbx policy` CLI.
- [Organization policies](/ai/sandboxes/governance/access-controls/organization/): manage centralized policies for an
  organization or team.

## Access surfaces

- [Network access policies](/ai/sandboxes/governance/access-controls/network/): control outbound network access from
  sandboxes, by host or by HTTP method and path.
- [Filesystem access policies](/ai/sandboxes/governance/access-controls/filesystem/): control which host paths
  sandboxes can mount as workspaces.
- [MCP access policies](/ai/sandboxes/governance/access-controls/mcp/): control MCP server registration, tool calls,
  resources, prompts, and approval gates with Cedar policy.

<!-- page: https://docs.docker.com/ai/sandboxes/governance/access-controls/filesystem/ fetched 2026-10-08 -->

# Filesystem access policies


Filesystem access policies control which host paths a sandbox can mount as a
workspace. Each policy contains one or more rules that restrict sandbox
workspaces to approved directories.

Filesystem access is managed with [organization policies](/ai/sandboxes/governance/access-controls/filesystem/organization/). When
organization governance is active, organization rules determine which paths a
sandbox can mount, and the local filesystem allow rules from the default preset
become inactive. `sbx policy deny` applies to network access only, so there are
no local filesystem deny rules to layer on top. See
[Precedence](/ai/sandboxes/governance/access-controls/concepts/#precedence).

## Rule syntax

Filesystem rules use the actions `read` and `write`. Resources are host path
patterns.

A writable workspace mount must be allowed by both a `read` rule and a `write`
rule. A read-only workspace needs only `read`.

Examples:

- `~/**`
- `/data/project/**`
- `C:\data\project\**`
- `\\wsl.localhost\<distro>\data\project\**`

Use `**` to match a directory tree recursively. A single `*` matches only one
path segment. For exact path matching behavior across macOS, Linux, Windows,
and WSL, see [Filesystem rules](/ai/sandboxes/governance/access-controls/concepts/#filesystem-rules).

## Organization filesystem rules

Organization filesystem rules belong to policies that can apply to the whole
organization or to selected teams. For setup steps and team scoping, see
[Organization policies](/ai/sandboxes/governance/access-controls/filesystem/organization/).

Filesystem policy is checked when a workspace is mounted, which happens when a
sandbox is created. To apply a filesystem policy change to a running workflow,
remove the sandbox and create a new one.

## Troubleshooting

### Sandbox cannot mount workspace

If a sandbox fails to mount with a `mount policy denied` error, verify that the
filesystem allow rule uses `**` rather than `*`. A single `*` doesn't match
across directory separators.

<!-- page: https://docs.docker.com/ai/sandboxes/governance/access-controls/local/ fetched 2026-10-08 -->

# Local policy


The `sbx policy` command manages the local policy on your machine. The local
policy contains network access rules. Rules apply to all sandboxes on the
machine when you use the global scope, or to a single sandbox when scoped by
name.

Local policy interacts with organization governance as follows:

- **No org governance**: the local policy controls what sandboxes can access.
- **Org governance active**: only organization allow rules grant access, so
  local allow rules are inactive and can't expand what the organization permits.
  Local deny rules are still evaluated, so you can restrict access further than
  the organization policy does. To list inactive rules, run
  `sbx policy ls --include-inactive`. See
  [Monitoring](/ai/sandboxes/governance/access-controls/monitor-and-enforce/monitoring/#showing-inactive-rules).

See [Organization policies](/ai/sandboxes/governance/access-controls/local/organization/) for how organization governance
works.

For domain patterns, wildcards, CIDR ranges, and filesystem path syntax, see
[Policy concepts](/ai/sandboxes/governance/access-controls/concepts/#rule-syntax).

## Default preset

Outbound TCP traffic passes through a proxy on your host, which enforces access
rules on every connection. Non-HTTP TCP traffic, including SSH, can be allowed
with a hostname rule (for example, `sbx policy allow network "myhost:22"`) or an
address-based rule. UDP requires the experimental feature and policy rules
described in [Allow outbound UDP](#allow-outbound-udp). ICMP is blocked.

If you haven't chosen a default preset, the CLI prompts you before it runs a
sandbox. Running `sbx policy reset` clears the preset and prompts you to choose
again:

```plaintext
Initialize the global network policy for your sandboxes:

  Applies to all sandboxes, current and future — change it later with
  "sbx policy allow/deny/rm". Kits, including built-in agent kits, may
  also add per-sandbox rules.

     1. Open         — All network traffic allowed, no restrictions.
  ❯  2. Balanced     — Default deny, with common dev sites allowed.
     3. Locked Down  — All network traffic blocked unless you allow it.

  Use ↑/↓ or 1–3 to navigate, Enter to confirm, Esc to cancel.
```

| Preset      | Description                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open        | All outbound TCP traffic is allowed. Equivalent to adding a wildcard allow rule with `sbx policy allow network "**"`. |
| Balanced    | Default deny, with a baseline allowlist covering AI provider APIs, package managers, code hosts, container registries, and common cloud services. |
| Locked Down | No baseline allow rules. Destinations need an allow rule from you or a kit. |

Presets initialize the global policy. Built-in agent kits and other kits can
add per-sandbox allow rules, including under **Locked Down** (`deny-all`). The
preset isn't an explicit deny rule that overrides those allowances.

Under **Balanced** and **Locked Down**, a sandbox request that no rule matches
is blocked and asks for your approval instead of being denied outright, so you
can open access to each destination as a sandbox needs it. See
[Approval-required access](/ai/sandboxes/governance/access-controls/local/network/#approval-required-access).

To inspect the rules a kit adds to a sandbox, run:

```console
$ sbx policy ls my-sandbox --source kit --type network --wide
```

To block a destination allowed by a kit, add an explicit deny rule:

```console
$ sbx policy deny network --sandbox my-sandbox openrouter.ai
```

Deny rules take precedence over allow rules. See
[Policy precedence](/ai/sandboxes/governance/access-controls/concepts/#precedence).

The **Balanced** preset's baseline allowlist is a good starting point for most
workflows. Run `sbx policy ls` to see exactly which rules it includes.

> [!NOTE]
> If your organization manages sandbox policies centrally, organization rules
> take precedence over the preset you select here. See
> [Organization policies](/ai/sandboxes/governance/access-controls/local/organization/).

### Non-interactive environments

In non-interactive environments such as CI pipelines or headless servers, the
interactive prompt can't be displayed. Use `sbx policy init` to set the
preset before running any other `sbx` commands:

```console
$ sbx policy init balanced
```

Available values are `allow-all`, `balanced`, and `deny-all`.

## Managing rules

A rule covers a destination host. It can also name HTTP methods and paths to
narrow the match to part of that host.

### Network rules

Use [`sbx policy allow`](/reference/cli/sbx/policy/allow/) and
[`sbx policy deny`](/reference/cli/sbx/policy/deny/) to add or restrict access
on top of the active preset. Changes take effect immediately. Rules apply to
all sandboxes by default:

```console
$ sbx policy allow network api.anthropic.com
$ sbx policy deny network ads.example.com
```

Pass `--sandbox <name>` to scope a rule to one sandbox:

```console
$ sbx policy allow network --sandbox my-sandbox api.example.com
$ sbx policy deny network --sandbox my-sandbox ads.example.com
```

As of v0.38.0, you can also set per-sandbox deny rules at creation time with
`--deny-network` on `sbx create` or `sbx run`, instead of adding them after the
fact:

```console
$ sbx create --deny-network ads.example.com claude .
$ sbx run --deny-network ads.example.com claude
```

Pass the flag multiple times to deny more than one host. Rules added this way
appear in `sbx policy ls <name>` and can be removed with
`sbx policy rm network --sandbox <name> --resource <host>`.

Specify multiple hosts in one command with a comma-separated list:

```console
$ sbx policy allow network "api.anthropic.com,*.npmjs.org,*.pypi.org"
```

Remove a rule by resource or by rule ID:

```console
$ sbx policy rm network --resource ads.example.com
$ sbx policy rm network --id 2d3c1f0e-4a73-4e05-bc9d-f2f9a4b50d67
```

To remove a sandbox-scoped rule, pass `--sandbox <name>`:

```console
$ sbx policy rm network --sandbox my-sandbox --resource api.example.com
```

### HTTP method and path rules

Add `--method` to an allow or deny rule to match specific HTTP methods on a
host, and `--path` to restrict it to part of the host's URL space:

```console
$ sbx policy allow network api.github.com --method GET --path '/repos/org/project/**'
```

Quote the path so your shell doesn't expand the wildcard. Pass several methods
as a comma-separated list:

```console
$ sbx policy allow network api.github.com --method GET,HEAD
```

`--method ANY` matches every HTTP method, and `--path` defaults to `/**` when
you omit it:

```console
$ sbx policy allow network api.github.com --method ANY
```

`ANY` can't be combined with specific methods, and a path without a method is
rejected. Pass a method, or use `ANY` when you mean every method.

Method names are case-insensitive. The accepted values are `GET`, `HEAD`,
`POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `CONNECT`, and `TRACE`.

A path must start with `/` and be canonical. It can't contain a query string, a
fragment, percent-encoding, control characters, surrounding whitespace,
repeated or trailing slashes, or dot segments such as `.` and `..`. Each rule
takes one path. Repeating `--path` keeps only the last value, and a comma is
read as part of the path, so add a separate rule for each path:

```console
$ sbx policy allow network api.github.com --method GET --path '/repos/**'
$ sbx policy allow network api.github.com --method GET --path '/users/**'
```

Hosts follow the same patterns as network rules and can include a port. Write
the host on its own, without a scheme, so an HTTP rule takes `api.example.com`
rather than `https://api.example.com`.

A local HTTP rule takes a hostname. To match an IP address or a CIDR range,
add a plain network rule for that destination instead.

Deny rules take the same flags, which is the usual way to carve a method or
path out of a broader allow:

```console
$ sbx policy allow network api.example.com
$ sbx policy deny network api.example.com --method POST --path '/admin/**'
```

For how the two layers combine, see
[HTTP rules](/ai/sandboxes/governance/access-controls/concepts/#http-method-and-path).

Remove an HTTP rule by naming the same qualifiers you added it with, or by
rule ID:

```console
$ sbx policy rm network --resource api.github.com --method GET --path '/repos/org/project/**'
$ sbx policy rm network --id 7f3a1c2e-4a73-4e05-bc9d-f2f9a4b50d67
```

List HTTP rules with `--type http`, or see them alongside network rules in a
wide listing, where the `METHOD` and `PATH` columns are empty for rules that
match a whole host:

```console
$ sbx policy ls --wide
TYPE      METHOD   PATH
network   -        -
http      GET      /repos/org/project/**
```

> [!NOTE]
> `sbx policy check network` and `sbx policy log` don't evaluate or display
> HTTP methods and paths. A check reports the decision for the host, which can
> differ from the decision for a specific method and path on that host.

## Inspecting rules

To inspect which policies are active and where they come from, use
`sbx policy ls`. Use `--source` to filter by origin (`local`, `org`, `kit`),
`--decision` to filter by outcome (`allow`, `deny`), and `--wide` for
rule-level detail including rule IDs. To inspect a single policy or rule in
full, use `sbx policy inspect`. See
[Monitoring](/ai/sandboxes/governance/access-controls/monitor-and-enforce/monitoring/).

### Allow outbound UDP

Outbound UDP is experimental and disabled by default. Turn on experimental
features and UDP egress before adding UDP allow rules:

```console
$ sbx settings set platform.allowExperimentalFeatures true
$ sbx settings set feature.udp-egress true
$ sbx policy allow network --protocol udp api.example.com:443
```

Local allow rules apply to TCP by default. Use `--protocol udp` for UDP or
`--protocol tcp,udp` for both. Deny rules apply to both protocols by default.
Use `--protocol` to restrict a deny rule to one protocol.

UDP follows the same organization and local policy precedence as TCP. It is
refused when the destination requires an HTTP, SOCKS5, system, or PAC-selected
proxy, because those proxies can't carry UDP. ICMP remains blocked.

UDP to local-network destinations is blocked before any policy is evaluated,
so no allow rule can permit it, including one that allows all hosts. This
covers multicast, link-local, and unspecified addresses, `255.255.255.255`,
and the broadcast addresses of the host's networks. As a result, discovery
protocols that use multicast, such as mDNS and SSDP, don't work from a
sandbox. UDP to `host.docker.internal` isn't affected. The network log records
these connections under the rule `<udp local network boundary>`.

Inspect UDP rules or check a destination:

```console
$ sbx policy ls --protocol udp
$ sbx policy check network --protocol udp api.example.com:443
```

The CLI warns if you save a UDP rule while UDP egress is disabled.

## Testing policy

Before running a sandbox, you can check whether the current policy would allow
a network request with `sbx policy check network`:

```console
$ sbx policy check network api.anthropic.com
Allowed: api.anthropic.com

$ sbx policy check network blocked.example.com
Denied: blocked.example.com
```

The target can be a hostname, a `host:port` pair, an IP address, or a URL.
Bare hostnames and IP addresses are evaluated against port 443. This is useful
for verifying custom rules or checking what the Locked Down preset blocks
before you start an agent.

A check never creates an approval request. A destination that a sandbox would
ask you to approve shows as `Denied:`, with a `Reason:` line of
`no matching allow rule (default deny)`, or `approval required by policy` under
organization governance.

To check policy in the context of a specific sandbox:

```console
$ sbx policy check network --sandbox my-sandbox api.example.com
```

### Resetting

To remove all custom rules and start fresh with a new preset, use
`sbx policy reset`:

```console
$ sbx policy reset
```

This deletes the local policy store, restarts the daemon, and prompts you to
choose a new preset. Running sandboxes stop when the daemon shuts down. Pass
`--force` to skip the confirmation prompt:

```console
$ sbx policy reset --force
```

## Troubleshooting

### Local allow rules have no effect

If rules you add with `sbx policy allow` don't change sandbox behavior, your
organization likely has governance enabled. Run `sbx policy ls` to check: if
the output starts with a `Governance:` status line showing `Managed by <org>`,
org governance is active. When it's active, local allow rules are inactive.
You can't use them to loosen restrictions the org policy imposes.

Inactive allow rules are hidden from `sbx policy ls` by default; run
`sbx policy ls --include-inactive` to see them with an `inactive` status in
the `STATUS` column.

When organization governance is active, only organization allow rules can grant
access. Ask your admin to update the organization policy if you need access to
an additional resource. Local deny rules remain active, so you can use
`sbx policy deny` to restrict access further.

### A domain is still blocked after adding an allow rule

If a domain remains blocked after you add a local allow rule, your organization
likely enforces governance, which makes local allow rules inactive. Run `sbx
policy ls` to check whether org governance is active; if the output starts with
a `Governance:` status line showing `Managed by <org>`, it is. Add
`--include-inactive` to confirm your rule shows an `inactive` status. If so,
the block can only be lifted by updating the org policy in Docker Home or via
the [API](/reference/api/ai-governance/).

### An HTTP method or path is blocked on an allowed host

A host that a network rule allows can still have individual methods or paths
denied by an HTTP rule. Run `sbx policy ls --type http` to see which HTTP rules
apply. `sbx policy check network` reports the decision for the host only, so it
shows a host as allowed even when the specific request is denied. See
[HTTP method and path rules](#http-method-and-path-rules).

### A request is blocked with "Approval required"

The destination needs your confirmation. Either no allow or deny rule matches
it and your machine isn't under organization governance, or an organization
policy allows it but requires approval first.

Run `sbx policy approval ls` to see the pending request and respond to it with
`sbx policy approval respond`. Approving applies to later requests, not the one
that was blocked, so run the operation again afterward. See
[Respond to an approval request](/ai/sandboxes/governance/access-controls/local/network/#respond-to-an-approval-request).

<!-- page: https://docs.docker.com/ai/sandboxes/governance/access-controls/mcp/ fetched 2026-10-08 -->

# MCP access policies


MCP access policies let organization administrators control which Model
Context Protocol (MCP) servers developers can register and what agents can do
through Docker's MCP gateway. Use these policies to approve trusted servers,
withdraw access to a server, require approval for tool calls, and restrict
host-run servers. To register MCP servers and connect them to sandboxes, see
[MCP gateway](/ai/sandboxes/governance/mcp-gateway/).

MCP access policies apply only to server registration and requests handled by
Docker's MCP gateway. They don't govern an MCP server that an agent or MCP
client configures and connects to directly from inside the sandbox. A direct
connection to a remote MCP server is outbound sandbox traffic, so
[network access policy](/ai/sandboxes/governance/access-controls/mcp/network/) determines whether the sandbox can reach
the server. To prevent access through both paths, block the server in MCP
access policy and block its network destination in network access policy.

Unlike [network access policies](/ai/sandboxes/governance/access-controls/mcp/network/) and
[filesystem access policies](/ai/sandboxes/governance/access-controls/mcp/filesystem/), MCP policies are organization
policies written in Cedar. Docker defines the `MCP` namespace, including the
actions, resource types, attributes, and approval behavior that policies can
match. This page focuses on representative access patterns. For Docker's exact
policy surface, see the [MCP policy reference](/ai/sandboxes/governance/access-controls/reference/mcp-policy/). For
Cedar syntax and language semantics, see the
[Cedar documentation](https://docs.cedarpolicy.com/).

## Govern the server lifecycle

MCP policy applies at two points in a server's lifecycle. A rule for one point
doesn't automatically govern the other.

| Admin decision                             | Evaluation point                            | Match with                                                                 |
| ------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------- |
| Whether a server can be registered         | When a developer runs `sbx mcp add`         | The registered name and resolved server attributes, such as `identityURL`  |
| What agents can do through the MCP gateway | When the gateway handles a governed request | The registered server name, tool annotations, resource URI, or prompt name |

Registration rules affect future registrations. They don't remove a saved
registration or prevent an existing registration from being loaded with
`sbx mcp load`. Use-time rules govern tool calls, resource reads, and prompt
retrieval from servers that are already registered or loaded.

Server names are chosen during registration. Registration rules can match the
chosen name and resolved server identity together. At use time, tools,
resources, and prompts are associated with the registered name, so rules for an
existing server must match every name under which it was registered.

Built-in gateway tools, such as `mcp-add`, `code-mode`, and OAuth authorization
helpers, are also governed at use time. They are `MCP::Primordial` resources
rather than tools associated with a registered server. For details, see
[Built-in gateway tools](/ai/sandboxes/governance/mcp-gateway/#built-in-gateway-tools).

Use-time policy doesn't hide or remove existing registrations. Tool and
resource listings can also include entries that policy denies when an agent
tries to use them.

## Choose an access posture

When MCP policy enforcement is active for a user, registration and governed MCP
requests are denied unless a matching `permit` allows them. A matching `forbid`
overrides any `permit`, including a permit with `@requireApproval`.

Use permits for an allowlist policy. For a blocklist policy that grants MCP
activity except for explicit restrictions, start with an actionless permit:

```plaintext
permit (principal, action, resource);
```

This statement permits every MCP action that reaches Cedar evaluation. Add
`forbid` statements for the restrictions the policy must enforce.

Policy scope supplies the principal. Use organization or team scope instead of
matching users, teams, tenants, or roles in Cedar. If MCP policy enforcement
isn't active for a user, the gateway doesn't evaluate Cedar policy and permits
MCP activity. MCP doesn't have a local preset equivalent to network policy.

## Approve a server

For an allowlist, approve both the server registration and its use-time
capabilities. The following policy approves a remote server only when it is
registered as `example` with the expected identity URL. It permits read-only
tool calls, resource reads, and prompt retrieval from that registered server:

```plaintext
// Permit registration with the expected name and identity URL.
permit (principal, action == MCP::Action::"register", resource)
when {
  resource in MCP::Server::"example" &&
  resource.identityURL == "https://mcp.example.com/mcp"
};

// Permit read-only tool calls.
permit (principal, action == MCP::Action::"invokeTool", resource)
when {
  resource in MCP::Server::"example" &&
  resource.readOnly == true
};

// Permit resource reads.
permit (principal, action == MCP::Action::"readResource", resource)
when { resource in MCP::Server::"example" };

// Permit prompt retrieval.
permit (principal, action == MCP::Action::"getPrompt", resource)
when { resource in MCP::Server::"example" };
```

Matching both the name and identity URL establishes a canonical registration.
It prevents a developer from registering another endpoint under the approved
name or registering the approved endpoint under another name. Remove the
resource or prompt permit if users don't need that capability.

## Require confirmation with MCP elicitation

Use `@requireApproval` to require per-request confirmation through MCP. When a
request matches the annotated `permit`, the gateway sends an
`elicitation/create` request to the same MCP client session that made the
governed request. In a human-driven client, the person operating the agent sees
the prompt and decides whether to proceed.

The following policy requires confirmation for non-read-only tools on a server
registered as `example`. Use it alongside any permits needed to register the
server or use its other capabilities. The annotation string becomes the reason
shown in the elicitation:

```plaintext
@requireApproval("non-read-only tool call")
permit (principal, action == MCP::Action::"invokeTool", resource)
when {
  resource in MCP::Server::"example" &&
  resource.readOnly == false
};
```

Tool annotations are supplied by the server and are advisory. `readOnly`
defaults to `false` for tools that don't declare it, so this pattern requires
confirmation for unannotated tools.

The gateway handles a matching request as follows:

```mermaid
flowchart TD
  request["Agent sends a governed MCP request"] --> evaluate["Gateway evaluates MCP policy"]
  evaluate -->|"Normal permit"| forward["Forward request"]
  evaluate -->|"No permit or matching forbid"| deny["Deny request"]
  evaluate -->|"Permit with @requireApproval"| elicit["Send MCP elicitation to connected client"]
  elicit --> confirm{"Client returns explicit confirmation?"}
  confirm -->|"No, unsupported, or error"| deny
  confirm -->|"Yes"| reevaluate["Re-evaluate with approval digest"]
  reevaluate -->|"Allowed"| forward
  reevaluate -->|"Denied or changed"| deny
```

The prompt identifies the server or gateway tool and includes the annotation
reason. It doesn't include raw tool arguments. Each matching request requires a
new confirmation. After confirmation, the gateway re-evaluates the request with
a digest that binds the response to the evaluated authorization request.

Use this mechanism as a confirmation guardrail for human-driven clients. It
doesn't create administrator approval or separation of duties. An autonomous
MCP client can respond to an in-protocol elicitation programmatically. Use
`forbid` for operations that must never run.

The request is denied if the originating client session can't handle MCP
elicitation, the user declines, the elicitation fails, or re-evaluation doesn't
allow the request. `sbx mcp add` can't present an elicitation, so a registration
permit with `@requireApproval` results in a denial. Tool calls made from an
execution context that can't relay an elicitation, including calls from inside
`code-mode`, are also denied.

## Withdraw server access

To withdraw access from a server that broader rules permit, block it at
registration and at use time. Registration policy controls future `sbx mcp add`
operations, while use-time policy controls requests from servers that are
already registered or loaded.

Prevent future registrations of the server by matching its identity URL:

```plaintext
forbid (principal, action == MCP::Action::"register", resource)
when { resource.identityURL == "https://mcp.example.com/mcp" };
```

Deny use-time requests for each registered name that refers to the server:

```plaintext
forbid (principal, action == MCP::Action::"invokeTool", resource)
when { resource in MCP::Server::"example" };

forbid (principal, action == MCP::Action::"readResource", resource)
when { resource in MCP::Server::"example" };

forbid (principal, action == MCP::Action::"getPrompt", resource)
when { resource in MCP::Server::"example" };
```

The registration remains saved and can still be listed or loaded. These rules
prevent another registration for the identity URL and deny governed use under
the registered name. If the server was registered under other names, add
use-time rules for those names as well.

An OAuth authorization helper is a built-in gateway tool, not a child of the
registered server. To prevent agents from starting authorization for the
server, govern the helper separately:

```plaintext
forbid (principal, action == MCP::Action::"invokePrimordial", resource)
when { resource in MCP::Primordial::"example-authorize" };
```

## Restrict host-run servers

Local stdio servers run on the host, outside the sandbox VM. This includes
explicit host commands and OCI-packaged stdio servers started with host Docker.
For details about this boundary, see
[Docker Engine isolation](/ai/sandboxes/governance/security/isolation/#docker-engine-isolation).

In a blocklist policy that otherwise permits registration, deny the host-run
server type:

```plaintext
forbid (principal, action == MCP::Action::"register", resource)
when { resource.type == "local-stdio" };
```

`local-stdio` covers explicit commands, including commands that start a Docker
container, and OCI-packaged stdio servers resolved from registry or manifest
metadata with `--local`.

## Related information

- [MCP policy concepts](/ai/sandboxes/governance/access-controls/concepts/#mcp-policies): policy model and rule
  evaluation.
- [MCP policy reference](/ai/sandboxes/governance/access-controls/reference/mcp-policy/): exact action, resource,
  attribute, context, and approval behavior.
- [Organization policies](/ai/sandboxes/governance/access-controls/mcp/organization/): policy creation and scope.
- [MCP policy audit logs](/ai/sandboxes/governance/access-controls/audit): policy decision
  records.

<!-- page: https://docs.docker.com/ai/sandboxes/governance/access-controls/network/ fetched 2026-10-08 -->

# Network access policies


The governance described here applies to local sandboxes. Cloud sandboxes
use separate network policy configuration. See
[Cloud network policy](/ai/sandboxes/governance/cloud/network-policy/) for cloud controls.

Network access policies control outbound connections from sandboxes. Each
policy contains one or more rules that allow the domains, IP ranges, and ports a
workflow needs, or block destinations that should stay unavailable. Rules can
also match the HTTP method and path of a request, so a policy can allow part of
an API without allowing all of it.

You can configure network access in two places:

- [Local policy](/ai/sandboxes/governance/access-controls/network/local/), which applies to sandboxes on one developer machine
  when organization governance is not active.
- [Organization policies](/ai/sandboxes/governance/access-controls/network/organization/), which apply centrally across an
  organization or to selected teams.

When organization governance is active, only organization allow rules grant
network access. Local allow rules are inactive until organization governance no
longer applies, while local deny rules still apply on top of the organization
policy. See [Precedence](/ai/sandboxes/governance/access-controls/concepts/#precedence).

## Rule syntax

Network rules use `connect:tcp` for TCP and `connect:udp` for UDP. Resources are
hostnames, CIDR ranges, ports, or hostnames with ports. UDP requires
[experimental outbound UDP](/ai/sandboxes/governance/access-controls/network/local/#allow-outbound-udp). ICMP is blocked.

Examples:

- `api.example.com`
- `*.example.com`
- `**.example.com`
- `example.com:443`
- `10.0.0.0/8`

For exact wildcard behavior and CIDR support, see
[Network rules](/ai/sandboxes/governance/access-controls/concepts/#network-rules).

## HTTP method and path rules

A network rule matches a destination, so it allows or blocks everything a
sandbox sends there. An HTTP rule narrows the match to specific HTTP methods
and URL paths on that destination, which lets a policy allow reads from an API
without allowing writes to it.

HTTP rules layer on top of network rules. A network allow is the baseline for
a destination and HTTP rules carve into it, while a network deny blocks the
destination outright and no HTTP allow can reopen it. For the pattern syntax
and the full matching table, see
[HTTP rules](/ai/sandboxes/governance/access-controls/concepts/#http-method-and-path).

Configure them in either place:

- Organization policies, in the network rule composer in Docker Home. Set the
  rule **Type** to **HTTP**, then select the methods and path patterns. See
  [Add a network rule](/ai/sandboxes/governance/access-controls/network/organization/#add-a-network-rule).
- Local policies, with `--method` and `--path` on `sbx policy`. See
  [HTTP method and path rules](/ai/sandboxes/governance/access-controls/network/local/#http-method-and-path-rules).

## Local network rules

Use `sbx policy allow network` and `sbx policy deny network` to manage local
network rules:

```console
$ sbx policy allow network api.example.com
$ sbx policy deny network ads.example.com
```

For presets, sandbox-scoped rules, testing, and troubleshooting, see
[Local policy](/ai/sandboxes/governance/access-controls/network/local/).

## Organization network rules

Organization network rules belong to policies that can apply to the whole
organization or to selected teams. For setup steps and team scoping, see
[Organization policies](/ai/sandboxes/governance/access-controls/network/organization/).

Use [Monitoring policies](/ai/sandboxes/governance/access-controls/monitor-and-enforce/monitoring/) to inspect
which network rules are active on a developer machine.

## Approval-required access

An organization network policy can require approval instead of granting access
outright. Destinations the policy allows aren't reachable until the developer
confirms them, which keeps an allowlist broad enough to be usable while still
putting a person in front of each destination an agent reaches for.

Without organization governance, a request with no matching allow or deny rule
also asks for approval rather than being denied outright, so access opens up as
the developer approves each destination.

Under organization governance, approval is a property of the policy rather
than of individual rules, so turning it on applies it to every allow rule in
that policy. A destination stays directly reachable only when no policy that
allows it requires approval. If a policy that requires approval also matches,
the request needs approval regardless of what the other policies allow.

Only a destination the developer has already approved satisfies the
requirement. Preset rules,
[kit-defined rules](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/capabilities/com.docker.sandbox/network-policy@1.md),
and rules the developer added with `sbx policy allow network` don't answer it.
An approval also can't reach a destination the organization doesn't allow at
all, and it can't override a deny rule. To withdraw a destination, add a deny
rule, which takes precedence over any approval already recorded.

To require approval on an organization policy, see
[Organization policies](/ai/sandboxes/governance/access-controls/network/organization/#require-approval-for-a-network-policy).

### Respond to an approval request

When a destination needs approval, a sandbox can't reach it until you confirm
it. The request is blocked and the sandbox receives a message naming the
destination:

```plaintext
Approval required for api.example.com.

Review and respond with:
  sbx policy approval ls
```

If your organization
[configures a support message](/ai/sandboxes/governance/access-controls/network/organization/#configure-a-support-message), it
appears after the approval instructions.

The request that triggers the prompt doesn't wait for an answer. It's denied,
and approving the destination affects later requests. Agents that retry a
failed request pick up the new access on their next attempt. For others, run
the operation again.

List the destinations waiting for a response:

```console
$ sbx policy approval ls
APPROVAL                                              SANDBOX      TITLE                 DETAIL                                                                              OPTIONS
network:cWtN-4xUrNjxh4ouezcstgjrky6Rg57QfeRe3WEkyyY   my-sandbox   api.example.com:443   Protocol: TCP Resource type: domain approval required by policy "default network"   allow (Allow), dismiss (Dismiss)
```

Each entry names the destination, the sandbox that asked for it, and why it
needs approval. Under organization governance that reason names the policy, as
shown. Without it, the reason is that no matching allow rule covers the
destination. A request that an HTTP rule matches also shows the method and
path, such as `GET api.example.com:443/v1/data`.

To inspect a single entry, pass its ID to `sbx policy approval inspect`:

```console
$ sbx policy approval inspect network:cWtN-4xUrNjxh4ouezcstgjrky6Rg57QfeRe3WEkyyY
APPROVAL network:cWtN-4xUrNjxh4ouezcstgjrky6Rg57QfeRe3WEkyyY  (sandbox: my-sandbox)
  api.example.com:443
  Protocol: TCP
  Resource type: domain
  approval required by policy "default network"

  OPTION    LABEL
  allow     Allow
  dismiss   Dismiss
```

Respond by selecting one of the options the entry offers:

```console
$ sbx policy approval respond network:cWtN-4xUrNjxh4ouezcstgjrky6Rg57QfeRe3WEkyyY --option allow
Recorded: Allow
```

Choosing `allow` grants access to that destination. Choosing `dismiss` leaves
it blocked, and the destination is requested again the next time the sandbox
tries to reach it. Repeated attempts collapse into a single entry, so a sandbox
retrying in a loop leaves one request to answer, not a queue of duplicates.

#### What approving grants

Approving records a rule that allows the destination the sandbox actually
asked for, scoped to the sandbox that asked. Three things follow from that:

- The rule covers one destination, not the pattern the policy rule used. A
  policy that allows `*.example.com` with approval asks about
  `api.example.com` and `cdn.example.com` separately.
- A destination includes its port, so `api.example.com:443` and
  `api.example.com:8443` are approved separately.
- Another sandbox reaching the same destination asks again.

When an [HTTP rule](/ai/sandboxes/governance/access-controls/concepts/#http-method-and-path) in the policy matches
the request, approving covers the method and exact path the sandbox requested
rather than the whole destination. `GET /v1/data` and `POST /v1/data` on the
same host are approved separately. A request whose method or path can't be
recorded as a rule, such as a path with percent-encoding, is blocked without an
entry to respond to.

Approved destinations stay allowed until the rule is removed. List them with
`sbx policy ls --wide --created-via approval`, and remove one the same way as
any other local rule, with [`sbx policy rm network`](/ai/sandboxes/governance/access-controls/network/local/#managing-rules).

Approvals live in the local policy store, so [`sbx policy reset`](/ai/sandboxes/governance/access-controls/network/local/#resetting)
removes all of them along with your other local rules. Each destination is
requested again the next time a sandbox reaches it.

> [!NOTE]
> To manage Model Context Protocol (MCP) server registration and requests
> through Docker's MCP gateway, use [MCP access policies](/ai/sandboxes/governance/access-controls/network/mcp/). These
> policies apply only to the gateway. Direct MCP connections from a sandbox
> don't use the gateway, but you can control access to remote MCP servers with
> network policy.

<!-- page: https://docs.docker.com/ai/sandboxes/governance/access-controls/organization/ fetched 2026-10-08 -->

# Organization policies


The governance described here applies to local sandboxes. Cloud sandboxes
use separate network policy configuration. See
[Cloud network policy](/ai/sandboxes/governance/cloud/network-policy/) for cloud controls.

[Local policies](/ai/sandboxes/governance/access-controls/organization/local/) give individual developers control over what their
sandboxes can access. Organization policy moves that control to the admin level:
organization policies apply to local sandboxes across the organization, either to
every member or to specific teams. When organization governance is active, only
organization allow rules grant access: local `sbx policy` allow rules are no
longer evaluated and can't expand what the organization permits. Local network
deny rules remain active, so developers can restrict access further but never
loosen it.

Admins can manage organization policies through the Docker Home UI. For
programmatic management of network and filesystem policies, use the
[Governance API](/reference/api/ai-governance/).

By default, only organization
[owners](/security/roles-and-permissions/core-roles/) can
view and manage AI Governance policies. To let someone other than an owner
manage policies, create a
[custom role](/security/roles-and-permissions/custom-roles/)
with the **Governance** permissions and assign it to a user or team.

> [!NOTE]
> Sandbox organization governance is available on a separate paid
> subscription.
> [Contact Docker Sales](https://www.docker.com/products/ai-governance/#contact-sales)
> to request access.

## Create a policy

Manage policies from the **AI Platform** section in the left-hand navigation
of [Docker Home](https://app.docker.com).

To create a policy:

1. Sign in to [Docker Home](https://app.docker.com) and select your
   organization.
1. In the left-hand navigation, expand **AI Platform** and select
   **Network access**, **Filesystem access**, or **MCP access**.
1. Select **Create policy**.
1. Enter a **Policy name**.
1. Set the **Scope** to **Organization** or **Teams**. If you select **Teams**,
   choose the teams the policy applies to. See
   [Scope policies to teams](#scope-policies-to-teams).
1. Define the policy rules.
   - Network and filesystem policies: select **Add rule** for each rule. For a
     network policy, see [Add a network rule](#add-a-network-rule).
   - MCP policies: enter Cedar statements in the policy editor. See
     [MCP access policies](/ai/sandboxes/governance/access-controls/organization/mcp/).
1. For a network policy, set **Require approval before access** if developers
   should confirm each destination before a sandbox can reach it. See
   [Require approval for a network policy](#require-approval-for-a-network-policy).

Existing policies are listed with their name, scope, rule count, and last
update. Use the action menu (⋮) to edit or delete a policy.

### Add a network rule

Each rule has an optional **Rule name**, a **Type** that decides what the rule
matches, and a **Decision** of **Allow** or **Deny**.

- **HTTP** matches only HTTP requests with the methods and paths you specify.
  - In **Destination**, enter the host or IP address the rule covers. It
    matches any port unless you add one. Enter the destination with no scheme
    and no path, so `api.github.com` rather than
    `https://api.github.com/repos`. A local HTTP rule accepts only a host.
  - Under **HTTP methods**, select the methods the rule applies to. Use
    **Select all** to select every method, or **Read-only** to select `GET`,
    `HEAD`, and `OPTIONS`. A rule saved with no methods selected matches every
    method the composer lists. The composer doesn't list `CONNECT` or
    `TRACE`, which differs from the CLI, where `--method ANY` matches every
    HTTP method.
  - Under **Path patterns**, add one or more paths the rule covers, such as
    `/repos/*` and `/v1/**`. Leave it empty to match any path.
- **All traffic** matches every request to the destinations you list, on any
  port, method, and path.
  - Under **Protocols**, select **TCP**, **UDP**, or **Both**.
  - Under **Destinations**, add the hosts, IP addresses, or CIDR ranges the
    rule covers. A destination matches any port unless you add one, such as
    `example.com:8080`.

An HTTP rule's paths all belong to its one destination, so to cover paths on a
second host, add a second rule. For the pattern syntax and how HTTP rules
combine with **All traffic** rules, see
[HTTP rules](/ai/sandboxes/governance/access-controls/concepts/#http-method-and-path).

### Require approval for a network policy

Turning on **Require approval before access** means the destinations a network
policy allows aren't reachable until the developer confirms each one. For how
approval behaves and what satisfies it, see
[Approval-required access](/ai/sandboxes/governance/access-controls/organization/network/#approval-required-access).

To set it on an existing policy:

1. Sign in to [Docker Home](https://app.docker.com) and select your
   organization.
1. In the left-hand navigation, expand **AI Platform** and select
   **Network access**.
1. In the policy list, open the policy's action menu (⋮) and select **Edit**.
1. Turn on **Require approval before access**.
1. Select **Save**.

The policy's detail page reports approval as **Required** or **Not required**.
Editing a policy replaces it in full, so turning the setting off removes the
requirement from every rule in that policy.

## Configure a support message

Admins can add an optional support message that appears after the policy denial
details when a sandbox action is blocked by organization governance. Use it to
point members to an internal support channel, ticket queue, or security contact.

To set the message:

1. Sign in to [Docker Home](https://app.docker.com) and select your
   organization.
1. In the left-hand navigation, expand **AI Platform** and select **Manage**.
1. In **Support message**, enter up to 500 characters.
1. Select **Save changes**.

Docker shows the message only for denials caused by organization governance
policy and for requests an
[approval-required policy](/ai/sandboxes/governance/access-controls/organization/network/#approval-required-access) blocks. If you
leave it blank, Docker shows the policy denial without additional contact text.

## Choose a policy type

Organization policies are managed by access surface. Use the access-control
pages for syntax, examples, and enforcement details:

- [Network access policies](/ai/sandboxes/governance/access-controls/organization/network/): control outbound network access from
  sandboxes, by host or by HTTP method and path.
- [Filesystem access policies](/ai/sandboxes/governance/access-controls/organization/filesystem/): control which host paths
  sandboxes can mount as workspaces.
- [MCP access policies](/ai/sandboxes/governance/access-controls/organization/mcp/): control MCP server registration, tool calls,
  resources, prompts, and approval gates with Cedar policy.

When organization governance is active, local and kit-defined allow rules are
not evaluated, while deny rules from those sources still apply. See
[Precedence](/ai/sandboxes/governance/access-controls/concepts/#precedence). To see which rules are active on a
developer machine, use
[Monitoring policies](/ai/sandboxes/governance/access-controls/monitor-and-enforce/monitoring/).

## Scope policies to teams

An organization can have more than one policy, and each policy applies either
to the whole organization or to specific teams. Scoping lets you apply different
rules to different parts of the organization.

A policy's [**Scope**](#create-a-policy) controls who it applies to. Set it to
**Organization** to apply the policy to every member, or to **Teams** to apply
it only to members of the teams you select.

### Before you start

Team scoping targets your organization's existing
[teams](/accounts/organization/manage/manage-a-team/), so a team must
exist before you can scope a policy to it. Create teams and manage their members
in one of two ways:

- Manually, in Docker Home.
- Automatically, by using
  [group mapping](/security/provisioning/scim/group-mapping/)
  to synchronize your identity provider's groups with the teams in your
  organization. Group mapping creates teams that don't already exist and keeps
  their membership in step with your IdP groups.

Because policies apply by team, a user's policies update automatically as their
team membership changes, including changes synced from your IdP.

### How scoped policies combine

A user is governed by all of their
[effective policies](/ai/sandboxes/governance/access-controls/concepts/#policy-scope): every org-wide policy, plus
the team-scoped policies for the teams they belong to. Use org-wide policies
for guardrails that must apply everywhere, and team-scoped policies for access
that only some teams need.

For precedence between local and organization policies, and for how allow and
deny rules combine, see [Policy concepts](/ai/sandboxes/governance/access-controls/concepts/).

## Troubleshooting

### Policy changes not taking effect

After updating organization policies, changes take up to 5 minutes to
propagate to developer machines. To apply changes immediately, users can run
`sbx policy reset`, which stops the daemon and forces it to pull the latest
organization policies on the next `sbx` command.

> [!WARNING]
> `sbx policy reset` deletes all locally configured policy rules, including any
> destinations the developer has approved under an
> [approval-required policy](/ai/sandboxes/governance/access-controls/organization/network/#approval-required-access). Those
> destinations are requested again the next time a sandbox reaches them. The
> command prompts for confirmation before proceeding.

#### Enforcement timing by policy type

Policy types differ in when a change takes effect after it reaches the
developer machine:

- Network policy is evaluated on every outbound request. Once a policy
  change has synced to the developer's machine (up to 5 minutes), it applies
  immediately to subsequent requests. HTTP rules are evaluated per request in
  the same way.

- An approval requirement applies from the point the policy change syncs.
  Destinations a developer already approved stay reachable, because the
  approval is recorded on the developer's machine. To withdraw one, add a deny
  rule. A deny takes precedence over a recorded approval.

- Filesystem policy is only checked when a workspace is mounted — that
  is, when a sandbox is created. Once a sandbox is running, changing the
  filesystem policy has no effect on that sandbox. The sandbox continues to
  access the previously allowed path until it is removed and a new one is
  created.

- MCP registration policy is evaluated when a server is registered with
  `sbx mcp add`. Changing registration rules doesn't remove existing
  registrations or stop an already-loaded server by itself.

- MCP use-time policy is evaluated by the MCP gateway when a sandbox makes a
  governed MCP request, such as a tool call, resource read, prompt retrieval,
  or built-in gateway tool call. Once a policy change has synced, use-time
  rules apply to subsequent governed MCP requests through the gateway.

To apply a filesystem policy change immediately, remove the running sandbox
and create a new one. To prevent use of an MCP server that is already registered
or loaded, add use-time rules for the registered server name. For examples, see
[Withdraw server access](/ai/sandboxes/governance/access-controls/organization/mcp/#withdraw-server-access).

<!-- page: https://docs.docker.com/ai/sandboxes/governance/audit/ fetched 2026-10-08 -->

# AI Governance Audit Logs




The Docker Sandboxes coverage on this page applies to local sandboxes.
Docker Cloud delivery stores their audit records in the cloud; it does not add
cloud sandbox coverage. For cloud network decisions, see
[Cloud policy logs](/ai/sandboxes/cloud/network-policy/#inspect-network-policy).

AI Governance Audit Logs record Docker AI Governance activity for your
organization. Each record captures the principal, action, target, decision, and
time for a governance event. Records contain metadata only. They don't contain
prompt content, agent output, or parameter values.

Audit logs are exposed when AI Governance is enabled for your organization.
Docker Sandboxes send audit records only for signed-in users who have an AI
Governance license and are governed by an enforced centralized [organization
policy](/ai/sandboxes/governance/access-controls/organization/). Docker Sandboxes users without both
don't send audit data to audit logs.

> [!NOTE]
> AI Governance Audit Logs are part of Docker AI Governance and require a
> separate paid subscription.
> [Contact Docker Sales](https://www.docker.com/products/ai-governance/#contact-sales)
> to request access.

## Requirements

To use AI Governance Audit Logs, your organization needs:

- A Docker [AI Governance plan](/subscription-billing/plans/ai-governance/)
- An enforced organization governance policy
- A Docker organization account
- An organization owner, or a user with a [custom role](/security/roles-and-permissions/custom-roles/) that includes AI Governance audit permissions, to configure delivery and view hosted events

> [!NOTE]
> Other Docker subscriptions are not sufficient on their own to use AI Governance
> Audit Logs. Users without an AI Governance license and an enforced organization
> policy will not generate audit data and will not appear in audit events or SIEM
> forwarding output. Personal accounts are not supported.

## Coverage

AI Governance Audit Logs cover Docker Sandboxes policy decisions and sandbox
session events. Other Docker AI sources can emit records through the same schema
as they become available.

## Delivery modes

Docker supports two delivery modes for audit records:

- **Local disk**: the sandbox daemon writes JSON Lines (`.jsonl`)
  files on each host. Use this mode for host-local retention, air-gapped
  collection, or collection through your own log shipper.
- **Docker Cloud**: Docker stores audit records in Docker Cloud. Cloud
  delivery powers the hosted audit log view, CSV export, and SIEM streaming from
  app.docker.com. Cloud delivery is on by default when AI Governance is enabled.
  Organization owners can disable it in [audit delivery settings](/ai/sandboxes/governance/audit/configure/).

Organization owners and users with a [custom role](/security/roles-and-permissions/custom-roles/) that includes AI Governance audit permissions can configure local disk, Docker Cloud, or both.

The hosted audit log view, CSV export, and SIEM forwarding all require Docker Cloud delivery to be enabled. Local delivery alone does not power these features.

Organizations that used local audit logging before hosted audit logs were
available start with cloud delivery off until an owner opts in from
[audit delivery settings](/ai/sandboxes/governance/audit/configure/).

## Data handling

When Docker Cloud delivery is enabled, Docker stores audit records in Docker
Cloud for the retention window configured by your organization. For legal and
privacy terms that govern Docker services, see Docker's [Terms of
Service](https://www.docker.com/legal/docker-terms-service/) and [Privacy
Policy](https://www.docker.com/legal/privacy/).

## Learn more

- [Local audit logs](/ai/sandboxes/governance/audit/local/)
- [Configure audit delivery](/ai/sandboxes/governance/audit/configure/)
- [View and export audit events](/ai/sandboxes/governance/audit/view-export/)
- [SIEM forwarding](/ai/sandboxes/governance/audit/siem/)
- [Audit record reference](/ai/sandboxes/governance/audit/record-reference/)

<!-- page: https://docs.docker.com/ai/sandboxes/governance/audit/configure/ fetched 2026-10-08 -->

# Configure audit delivery


Organization owners and users with a [custom role](/security/roles-and-permissions/custom-roles/) that includes AI Governance audit permissions can configure where Docker writes audit events.
Two delivery destinations are available and can be used independently or
together:

- **Local disk**: The sandbox daemon writes audit events to the local disk
  on each host.
- **Docker Cloud**: Audit events are sent to Docker's cloud platform, enabling
  the hosted log view, CSV export, and SIEM forwarding.

## Before you begin

Your organization needs:

- A Docker [AI Governance plan](/subscription-billing/plans/ai-governance/)
- An enforced organization governance policy
- Organization owner access, or a [custom role](/security/roles-and-permissions/custom-roles/) with AI Governance audit permissions

Only users who have an AI Governance license and are governed by the enforced
organization policy send Docker Sandboxes audit data.

## Configure delivery

To configure audit delivery:

1. Sign in to [Docker Home](https://app.docker.com/).
2. Open your organization.
3. Go to **AI Platform** > **Audit logs**.
4. Open **Audit Delivery**.
5. Choose one or both delivery modes:
   - **Local disk** writes audit records to JSON Lines files on each host.
   - **Docker Cloud** stores audit records in Docker Cloud for hosted search,
     CSV export, and SIEM forwarding.
6. Save your changes.

Cloud delivery is on by default when AI Governance is enabled. To keep records
local to your hosts, turn off **Docker Cloud** and keep **Local disk** on.

Organizations that used local audit logging before hosted audit logs were
available start with cloud delivery off until an owner opts in.

## Configure retention

When **Docker Cloud** is selected, you can also configure how long cloud-stored
events are retained:

| Field                          | Description                                                        | Default |
| ------------------------------ | ------------------------------------------------------------------ | ------- |
| Searchable retention (days)    | How long events stay searchable in the hosted audit log view.      | 90 days |
| Archive retention (days)       | How long events are kept in long-term archive storage.             | 90 days |

Archive retention must be greater than or equal to searchable retention.

Retention reductions apply going forward. They don't delete records that were
already retained under a longer retention window.

## Audit delivery change history

Docker keeps a record of every change made to your organization's audit delivery
settings. Each entry captures the timestamp, the user who made the change, and
the delivery configuration that was set. Use this history to audit configuration
changes and verify when delivery modes or retention windows were modified.

Open **History** to review delivery and retention changes for your organization.
History entries show who made the change, when it happened, and the before and
after values.

<!-- page: https://docs.docker.com/ai/sandboxes/governance/audit/local/ fetched 2026-10-08 -->

# Local audit logs


The sandbox daemon writes local audit records as JSON Lines (`.jsonl`) files.
Local audit logs stay on the host that produced them and can be collected by
your own log shipper. Local delivery is independent of
[cloud delivery](/ai/sandboxes/governance/audit/local/configure/), so you can use local files with cloud delivery
on or off.

The sandbox daemon writes local audit records only for signed-in users who have
an AI Governance license and are governed by an enforced centralized
[organization policy](/ai/sandboxes/governance/audit/access-controls/organization/). Docker Sandboxes
users without both do not send audit data to audit logs. To confirm governance
is active, run `sbx policy ls`. The output includes a `Governance: Managed by
<org>` line when an organization policy is in effect.

## What gets recorded

The daemon writes two categories of local record:

- Evaluation records capture each policy decision: the resource, the action,
  the verdict, and the reason for a denial.
- Session lifecycle records mark the start and end of each daemon run.
  Evaluation records share the run's `audit_session_id`, so you can correlate
  every decision back to a daemon session.

Records contain metadata only. They don't contain prompt content, agent output,
or parameter values. For field details, see
[Audit record reference](/ai/sandboxes/governance/audit/local/record-reference/).

A network evaluation record looks like this:

```json
{
  "audit_event_id": "95e7257f-93c9-4f29-bde7-88830e2dae80",
  "timestamp": "2026-05-28T19:15:00.728933Z",
  "schema_version": "1.82.0",
  "category": "AUDIT_CATEGORY_EVALUATION",
  "decision": "AUDIT_DECISION_DENY",
  "username": "jordandoe",
  "user_email": "jordandoe@example.com",
  "org_id": "9f8e7d6c-5b4a-3210-fedc-ba9876543210",
  "org_name": "Acme Inc",
  "audit_session_id": "8a3bc076-79d0-4502-baf3-cc6ad35fb578",
  "resource_id": "example.com:443",
  "os": "macos",
  "app_version": "v0.31.0",
  "client_name": "sbx",
  "hostname": "host-machine",
  "deny_reason": [
    "no applicable policies for op(action=net:connect:tcp, resource=net:domain:example.com:443)"
  ],
  "action_type": "network_egress",
  "network_egress": { "protocol": "tcp" },
  "agent": "claude"
}
```

## Where records are stored

The daemon writes audit records, not the CLI. Running a command such as
`sbx create` sends a request to the daemon, and the daemon emits the resulting
record to its own audit directory.

The default location depends on your operating system:

| OS      | Default path                                                      |
| ------- | ----------------------------------------------------------------- |
| macOS   | `~/Library/Logs/com.docker.sandboxes/sandboxes/auditkit/`         |
| Linux   | `${XDG_STATE_HOME:-~/.local/state}/sandboxes/sandboxes/auditkit/` |
| Windows | `%LOCALAPPDATA%\DockerSandboxes\sandboxes\logs\auditkit\`         |

The directory layout differs by platform because each operating system places
application logs in its own conventional location.

Files are named `audit-<utc-timestamp>-<process-uuid>-<seq>.jsonl`.

The daemon writes in-progress records to a temporary `.tmp` file and
finalizes it into a `.jsonl` file by atomic rename. Finalization happens at a
rotation threshold: by default, 5 minutes, 1000 events, or 50 MiB, whichever
comes first. Finalization also happens when the daemon shuts down cleanly. Only
`.jsonl` files are complete. Treat `.tmp` files as incomplete and don't collect
them.

Sandboxes never delete `.jsonl` files. Retention and cleanup are the
responsibility of your log shipper or your own housekeeping.

## Collect records with a SIEM

Point your log shipper at the audit directory and configure it to collect
`.jsonl` files only. Tools such as the Splunk Universal Forwarder,
Filebeat, and CrowdStrike Falcon LogScale read the directory and forward each
line as an event. Because in-progress records live in `.tmp` files until they
are finalized, collectors never see partial records.

<!-- page: https://docs.docker.com/ai/sandboxes/governance/audit/record-reference/ fetched 2026-10-08 -->

# Audit record reference


Docker AI Governance audit records use one schema across delivery modes. Local
JSON Lines files and cloud-delivered records contain the same metadata fields.

Records capture metadata only. They don't contain prompt content, agent output,
or parameter values. Parameter keys may appear when they help identify an
action.

## Common fields

| Field              | Description                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `audit_event_id`   | Unique ID for the audit event.                                                                                   |
| `timestamp`        | UTC time when Docker recorded the event.                                                                         |
| `schema_version`   | Version of the record schema. Pin SIEM field mappings to this value.                                             |
| `category`         | Event category, such as `AUDIT_CATEGORY_MANAGEMENT`, `AUDIT_CATEGORY_EVALUATION`, or `AUDIT_CATEGORY_EXECUTION`. |
| `decision`         | Governance decision for evaluation records.                                                                      |
| `username`         | The signed-in Docker user's Docker Hub username.                                                                 |
| `user_email`       | The signed-in Docker user's email address.                                                                       |
| `org_id`           | ID of the organization whose governance policy is in effect.                                                     |
| `org_name`         | Display name of the organization whose governance policy is in effect.                                           |
| `audit_session_id` | Identifies the daemon session that produced the record.                                                          |
| `resource_id`      | Target of the evaluation, such as a host and port, file path, or tool.                                           |
| `os`               | Operating system that produced the record.                                                                       |
| `app_version`      | Version of the Docker component that produced the record.                                                        |
| `client_name`      | Source component, such as `sbx` for Docker Sandboxes.                                                            |
| `hostname`         | Hostname of the machine that produced the record.                                                                |
| `deny_reason`      | Why a denied request was blocked. Present on deny decisions.                                                     |
| `enforcement_mode` | Governance mode in effect when Docker evaluated the request. See [Enforcement modes](#enforcement-modes).        |
| `approval`         | Approval details. Present when the decision involves an approval. See [Approval fields](#approval-fields).       |
| `action_type`      | Payload discriminator that identifies the action-specific object in the record.                                  |
| `agent`            | AI agent associated with the event, when Docker knows it.                                                        |

## Categories

| Category                    | Description                                                   |
| --------------------------- | ------------------------------------------------------------- |
| `AUDIT_CATEGORY_MANAGEMENT` | Session lifecycle, policy sync, and configuration events.     |
| `AUDIT_CATEGORY_EVALUATION` | Governance policy decisions, such as allow, deny, or consent. |
| `AUDIT_CATEGORY_EXECUTION`  | Outcomes after an evaluated action runs.                      |

## Decisions

| Decision                           | Description                                       |
| ---------------------------------- | ------------------------------------------------- |
| `AUDIT_DECISION_ALLOW`             | Docker allowed the action.                        |
| `AUDIT_DECISION_DENY`              | Docker denied the action.                         |
| `AUDIT_DECISION_APPROVAL_REQUIRED` | The policy requires a user to approve the action. |
| `AUDIT_DECISION_APPROVAL_ALLOW`    | A user approved a pending request.                |
| `AUDIT_DECISION_APPROVAL_DENY`     | A user denied a pending request.                  |

## Enforcement modes

The `enforcement_mode` field shows how governance applied to the request when
Docker evaluated it.

| Mode      | Description                                                                     |
| --------- | ------------------------------------------------------------------------------- |
| `enforce` | Your organization's governance policy is enforced.                              |
| `audit`   | Docker records the decision for observability but doesn't enforce policy.       |
| `off`     | Governance isn't active. Docker still writes the record to the local audit log. |

A record that resolves a network approval doesn't include `enforcement_mode`,
and neither does the record of a declined MCP approval. An approved MCP request
is evaluated again, so its record includes `enforcement_mode`.

## Approval fields

When network access requires approval, Docker blocks the request and writes an
`AUDIT_DECISION_APPROVAL_REQUIRED` record. If the user approves, Docker writes
a second record with `AUDIT_DECISION_APPROVAL_ALLOW`. Both records carry the
same `approval.approval_request_id`, so you can join them to reconstruct the
full approval. The approval applies to later requests from the sandbox. It
doesn't retry the request that was blocked. If the user dismisses the request,
it isn't resolved, so no second record is written and the destination is
requested again the next time the sandbox reaches it. For how approval works,
see [Approval-required access](/ai/sandboxes/governance/audit/access-controls/network/#approval-required-access).

For MCP approvals, an approved request is evaluated again and recorded with
`AUDIT_DECISION_APPROVAL_ALLOW`, and a declined request is recorded with
`AUDIT_DECISION_APPROVAL_DENY`. Neither record includes
`approval.approval_request_id` or `approval.grant_scope`.

| Field                          | Description                                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `approval.reason_codes`        | Policy reasons for requiring approval. Present on `AUDIT_DECISION_APPROVAL_REQUIRED` records when the policy supplies reasons, and on declined MCP approvals when reasons are available. |
| `approval.approval_request_id` | ID that links an approval required record to the record that resolves it.                                                                                                                |
| `approval.grant_scope`         | Scope the user accepted. Present only on `AUDIT_DECISION_APPROVAL_ALLOW` records.                                                                                                        |
| `approval.context_digest`      | SHA-256 digest of the request that was resolved, which shows it matches the request that was held. Present only on declined MCP approvals.                                               |

For network approvals, Docker Sandboxes records `approval.grant_scope` as
`AUDIT_APPROVAL_GRANT_SCOPE_PERSISTENT`, which means that the approval applies
to later requests.

If a user approves a request but Docker can't apply the grant, the record has
an `AUDIT_DECISION_DENY` decision and includes the `approval` object.

## Action types

The `action_type` field identifies the action-specific payload in the record.

| Action type                  | Description                                                                 |
| ---------------------------- | --------------------------------------------------------------------------- |
| `session`                    | Sandbox daemon session lifecycle event.                                     |
| `network_egress`             | Network access evaluation.                                                  |
| `http_request`               | HTTP request evaluation. See [HTTP request payload](#http-request-payload). |
| `filesystem_mount`           | Filesystem mount or path access evaluation.                                 |
| `tool_invocation`            | Tool invocation evaluation.                                                 |
| `resource_read`              | Resource read evaluation.                                                   |
| `server_registration`        | Server registration event.                                                  |
| `prompt`                     | Prompt-related metadata event.                                              |
| `network_egress_execution`   | Outcome of a network action.                                                |
| `filesystem_mount_execution` | Outcome of a filesystem action.                                             |
| `tool_execution`             | Outcome of a tool invocation.                                               |
| `resource_read_execution`    | Outcome of a resource read.                                                 |
| `prompt_execution`           | Outcome of a prompt request.                                                |
| `policy_sync`                | Policy synchronization event.                                               |
| `pii_detection`              | Metadata event for a data detection result.                                 |
| `c_score_report`             | Metadata event for a C-score report.                                        |
| `policy_action`              | Policy configuration or policy action event.                                |

## HTTP request payload

When a network policy requires each HTTP request to be authorized, Docker
evaluates the request method and path in addition to the network connection.
These evaluations produce records with an `action_type` of `http_request`,
separate from the `network_egress` record for the connection.

| Field                 | Description                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| `http_request.method` | HTTP method, such as `HTTP_METHOD_GET` or `HTTP_METHOD_POST`.               |
| `http_request.host`   | Destination hostname or IP address. IPv6 addresses appear without brackets. |
| `http_request.port`   | Destination port.                                                           |
| `http_request.path`   | URL path, without the query string or fragment.                             |

## Sample record

```json
{
  "audit_event_id": "95e7257f-93c9-4f29-bde7-88830e2dae80",
  "timestamp": "2026-05-28T19:15:00.728933Z",
  "schema_version": "1.82.0",
  "category": "AUDIT_CATEGORY_EVALUATION",
  "decision": "AUDIT_DECISION_DENY",
  "username": "jordandoe",
  "user_email": "jordandoe@example.com",
  "org_id": "9f8e7d6c-5b4a-3210-fedc-ba9876543210",
  "org_name": "Acme Inc",
  "audit_session_id": "8a3bc076-79d0-4502-baf3-cc6ad35fb578",
  "resource_id": "example.com:443",
  "os": "macos",
  "app_version": "v0.31.0",
  "client_name": "sbx",
  "hostname": "host-machine",
  "deny_reason": [
    "no applicable policies for op(action=net:connect:tcp, resource=net:domain:example.com:443)"
  ],
  "action_type": "network_egress",
  "network_egress": { "protocol": "tcp" },
  "agent": "claude"
}
```

The following sample shows a user approving an HTTP request that required
approval:

```json
{
  "audit_event_id": "3c1f6a2e-8b47-4d0a-9e55-2f7b1d6c9a04",
  "timestamp": "2026-09-25T17:42:08.114502Z",
  "schema_version": "1.216.0",
  "category": "AUDIT_CATEGORY_EVALUATION",
  "decision": "AUDIT_DECISION_APPROVAL_ALLOW",
  "username": "jordandoe",
  "user_email": "jordandoe@example.com",
  "org_id": "9f8e7d6c-5b4a-3210-fedc-ba9876543210",
  "org_name": "Acme Inc",
  "audit_session_id": "8a3bc076-79d0-4502-baf3-cc6ad35fb578",
  "resource_id": "api.example.com:443",
  "os": "macos",
  "app_version": "v0.46.0",
  "client_name": "sbx",
  "hostname": "host-machine",
  "approval": {
    "approval_request_id": "b7e2c9d1-4f60-4a8e-93c2-5d1e8f7a6b30",
    "grant_scope": "AUDIT_APPROVAL_GRANT_SCOPE_PERSISTENT"
  },
  "action_type": "http_request",
  "http_request": {
    "method": "HTTP_METHOD_POST",
    "host": "api.example.com",
    "port": "443",
    "path": "/v1/items"
  },
  "agent": "claude"
}
```

<!-- page: https://docs.docker.com/ai/sandboxes/governance/audit/siem/ fetched 2026-10-08 -->

# SIEM forwarding




Docker can forward audit events to your security information and event
management (SIEM) system, letting you centralize Docker governance data
alongside other security signals. Docker verifies the endpoint is reachable
with the supplied credential before saving.

## Supported destinations

| Destination                      | Description                                                     |
| -------------------------------- | --------------------------------------------------------------- |
| Splunk Cloud (HEC)               | Hosted Splunk using the HTTP Event Collector                    |
| Dynatrace                        | Dynatrace Log Management using the Log Ingest API               |
| Datadog                          | Datadog Logs using the HTTP log intake API                      |
| Sumo Logic                       | Sumo Logic using an HTTP Source                                 |

## Before you begin

SIEM forwarding requires Docker Sandboxes
[0.39.0](/ai/sandboxes/release-notes/) or later. Earlier versions
don't deliver audit records to a SIEM destination, even when forwarding is
configured. Update Docker Sandboxes before enabling a new destination.

SIEM forwarding requires Docker Cloud delivery to be enabled for your
organization. If you haven't already, enable it under **AI Platform** >
**Audit logs** > **Audit delivery** before configuring a SIEM destination. See
[Configure audit delivery](/ai/sandboxes/governance/audit/siem/configure/).

Gather credentials from your SIEM before configuring forwarding:

- **Splunk Cloud**: HEC ingest URL and an HEC token. Optionally, a Splunk index
  name. See [Splunk documentation](https://docs.splunk.com/).
- **Dynatrace**: Log Ingest API URL and an API token with the `logs.ingest`
  scope. See [Dynatrace documentation](https://docs.dynatrace.com/).
- **Datadog**: Logs intake URL for your Datadog site and an API key. See
  [Datadog documentation](https://docs.datadoghq.com/).
- **Sumo Logic**: HTTP Source URL and an auth token from an HTTP Logs &
  Metrics source. See [Sumo Logic documentation](https://www.sumologic.com/help/).

## Add a SIEM destination

1. Sign in to [Docker Home](https://app.docker.com/).
1. Open your organization.
1. Go to **AI Platform** > **Audit logs**.
1. Open **Export & Connectors**.
1. Select **Add destination**.
1. Select your destination and complete the form.
1. Select **Save**.

If verification fails, check that the URL and credential are correct and that
the endpoint is accessible from the internet.

## Manage destinations

From the **SIEM forwarding** list, select the menu next to a destination to
edit or delete it. The edit form lets you update credentials and toggle
forwarding on or off for that destination. Deleting a destination permanently
removes the endpoint and its stored credential and cannot be undone.

<!-- page: https://docs.docker.com/ai/sandboxes/governance/audit/view-export/ fetched 2026-10-08 -->

# View and export audit events


Cloud delivery stores AI Governance audit records in Docker Cloud and makes
them available in the hosted audit log UI. Use the hosted view to investigate
policy decisions or export events to CSV.

## View audit events

To view audit events:

1. Sign in to [Docker Home](https://app.docker.com/).
1. Open your organization.
1. Go to **AI Platform** > **Audit logs**.
1. Open **Audit Events**.

The **Audit Events** view includes summary tiles for total events, allowed
events, denied events, and consent-required events. The event table includes:

| Column    | Description                                                   |
| --------- | ------------------------------------------------------------- |
| Time      | When Docker recorded the event.                               |
| Event     | The event type or policy action.                              |
| Principal | The Docker user associated with the event.                    |
| Resource  | The target resource, such as a domain, file path, or tool.    |
| Decision  | The governance decision, such as allow, deny, or consent.     |
| Agent     | The AI agent associated with the event, when Docker knows it. |

## Filter and search events

Use the audit log filters to narrow the event table by decision and time range.
Use search to find events by principal, resource, event type, or agent.

The event table uses cursor pagination for large result sets.

## Export events to CSV

Use CSV export when you need an offline copy of filtered audit events:

1. Open **Audit Events**.
1. Apply the filters and search terms for the events you want to export.
1. Select **Export**.
1. Download the generated CSV file from the link Docker provides.

CSV exports include up to 1 000 000 rows. Download links expire after 24 hours.

<!-- page: https://docs.docker.com/ai/sandboxes/governance/concepts/ fetched 2026-10-08 -->

# Policy concepts


The governance described here applies to local sandboxes. Cloud sandboxes
use separate network policy configuration. See
[Cloud network policy](/ai/sandboxes/governance/cloud/network-policy/) for cloud controls.

## Resource model

Docker sandbox governance is built around two resource types: **policies** and
**rules**.

A **policy** is a named collection of rules that controls sandbox access.
Policies exist at two levels:

- **Local**: configured per machine using the `sbx policy` CLI. Applies to
  sandboxes on that machine only.
- **Organization**: configured in Docker Home. Network and filesystem policies
  can also be managed via the
  [Governance API](/reference/api/ai-governance/). Applies to sandboxes across
  the organization. An organization can have several policies, each applying
  either org-wide or to specific teams. See [Policy scope](#policy-scope).

When organization governance is active, only organization allow rules can grant
access. Local and kit-defined deny rules still apply on top. See
[Precedence](#precedence).

A **rule** is the unit of access control within a policy. Each rule has:

- **Name**: a human-readable label
- **Actions**: the type of access the rule controls
- **Resources**: the targets the rule matches against
- **Decision**: `allow` or `deny`

Rules are grouped by domain. Network and filesystem rules in a policy must
share the same domain, either `network` or `filesystem`. MCP policies use Cedar
statements written in the `MCP` namespace instead of the network and filesystem
rule format.

An organization network policy can also require approval, which turns every
allow in that policy into a request the developer must confirm before access is
granted. Approval is set on the policy rather than on individual rules, so it
applies to all of the policy's allow rules at once. Without organization
governance, a request with no matching allow or deny rule also asks for
approval. See
[Approval-required access](/ai/sandboxes/governance/concepts/access-controls/network/#approval-required-access).

Network approval is separate from the MCP `@requireApproval` annotation. An MCP
approval confirms a single call within the session and creates no rule, while
an approved network destination stays allowed until you remove the rule. See
[MCP access policies](/ai/sandboxes/governance/concepts/access-controls/mcp/).

### Limits

Organization policies have the following limits, which help ensure fair usage
and resource availability across organizations:

| Limit                     | Value                                               |
|---------------------------|-----------------------------------------------------|
| Policies per organization | 100                                                 |
| Rules per policy          | 250                                                 |
| Policy size               | 400 KB total, shared across all of a policy's rules |

Typical policies use only a small fraction of the policy size limit. Domain
and file path values have no separate length limit beyond valid format.

If these limits don't fit your organization's needs,
[contact Docker Sales](https://www.docker.com/products/ai-governance/#contact-sales)
to discuss options.

## Policy scope

Each organization policy applies either across the whole organization or only
to specific teams:

- Org-wide: with no teams assigned, the policy applies to every member of the
  organization.
- Team-scoped: with one or more teams assigned, the policy applies only to
  members of those teams.

Teams are the same [teams](/accounts/organization/manage/manage-a-team/)
you manage for your organization; Docker matches a policy's teams against each
user's team membership. Because an organization can mix org-wide and team-scoped
policies, a single user is often subject to several at once. The policies that
apply to a given user are their _effective policies_: every org-wide policy,
plus every team-scoped policy for a team they belong to. See
[Rule evaluation](#rule-evaluation) for how a user's effective policies combine.

## Rule syntax

### Network rules

Network rules use `connect:tcp` for TCP and `connect:udp` for UDP. Resources are
hostnames, CIDR ranges, or ports. UDP requires
[experimental outbound UDP](/ai/sandboxes/governance/concepts/access-controls/local/#allow-outbound-udp).
ICMP is blocked.

**Hostname patterns**

| Pattern               | Example           | Matches                                                      |
| --------------------- | ----------------- | ------------------------------------------------------------- |
| Exact hostname        | `example.com`     | `example.com` on any port, not subdomains                     |
| Single-level wildcard | `*.example.com`   | One subdomain level, any port: `api.example.com`              |
| Multi-level wildcard  | `**.example.com`  | Any depth, any port: `api.example.com`, `v2.api.example.com`  |
| Hostname with port    | `example.com:443` | `example.com` on port 443 only                                |

`example.com` and `*.example.com` don't cover each other. Specify both if you
need to match the root domain and its subdomains.

**CIDR ranges**

Both IPv4 and IPv6 notation are supported: `10.0.0.0/8`, `192.168.1.0/24`,
`2001:db8::/32`.

#### HTTP method and path

A network rule matches a destination host on its own. An HTTP rule is a network
rule that also names an HTTP method and URL path, so a policy can allow reads
from an API without allowing writes to it.

An HTTP rule names one or more methods, a destination, and path patterns. What
each part accepts depends on where you configure the rule:

| Part        | Organization policy                        | Local policy                      |
| ----------- | ------------------------------------------ | --------------------------------- |
| Method      | One or more listed methods                 | `ANY`, or one or more methods     |
| Destination | A host or IP address                       | A host                            |
| Path        | One or more absolute path patterns         | One absolute path pattern         |

A destination can include a port, and a path pattern looks like `/api/**`.

A local rule doesn't accept an IP address or a CIDR range. Use a plain network
rule for those destinations. To cover a second path in a local policy, add a
second rule.

Every rule applies to at least one method. On the CLI, `--method ANY` covers
every HTTP method. In the composer, a rule with no methods selected covers
every method the composer lists. For the methods you can select individually, see
[Add a network rule](/ai/sandboxes/governance/concepts/access-controls/organization/#add-a-network-rule) for an
organization policy and
[HTTP method and path rules](/ai/sandboxes/governance/concepts/access-controls/local/#http-method-and-path-rules)
for a local one.

Path patterns follow the same wildcard rules as filesystem paths, where `*`
matches within one path segment and `**` matches any depth. A pattern without a
wildcard matches that path exactly, so `/repos` matches `/repos` and nothing
below it. Every pattern must start with `/` and can't contain a query string, a
fragment, or a `..` segment. A local rule's path must also be canonical, so it
can't contain percent-encoding, control characters, repeated or trailing
slashes, or a `.` segment. For the full list, see
[HTTP method and path rules](/ai/sandboxes/governance/concepts/access-controls/local/#http-method-and-path-rules).

HTTP requests are evaluated against both layers. A network rule sets the
baseline for a host, and HTTP rules adjust individual methods and paths within
it:

| Rules that cover the host   | Result for an HTTP request                                              |
| --------------------------- | ----------------------------------------------------------------------- |
| Network allow only          | Allowed at any method and path                                          |
| HTTP allow only             | Allowed only where a rule matches the method and path. Anything else is denied |
| Network allow and HTTP deny | The denied methods and paths are blocked. The rest stay allowed          |
| Network deny                | Blocked. An HTTP allow can't reopen a denied host                        |

A network deny is therefore a floor that HTTP rules can't raise, while a
network allow is a ceiling that HTTP rules can carve into.

When a rule requires a method and path decision, the sandbox HTTP proxy
evaluates each request separately instead of deciding once per connection.

Those requests have to go through the proxy. A connection it can't inspect,
such as one it handles transparently, is blocked rather than evaluated.
Traffic that isn't HTTP, such as SSH, carries no method or path, so HTTP rules
never match it. Control those destinations with network rules.

For local and organization policy configuration, see
[Network access policies](/ai/sandboxes/governance/concepts/access-controls/network/).

### Filesystem rules

Filesystem rules use the actions `read` and `write`. Resources are host paths
that sandboxes can mount as workspaces.

A workspace mounted with write access must be allowed by both a `read` and a
`write` rule; a read-only workspace needs only `read`. When default deny blocks
a mount, the denial reason names whether read or write access was missing.

`~` expands to the user's home directory on every platform, including Windows,
where it resolves to `%USERPROFILE%`. A single `~/**` rule therefore matches
each user's home tree on macOS, Linux, and Windows. The policy engine expands
only `~`: it does not expand environment variables, so a pattern such as
`%USERPROFILE%\**` or `$HOME/**` matches nothing.

For a path outside the home directory, write it in the format the user's
operating system uses. A rule matches only the format it's written in, so a
location that several platforms share needs a rule for each:

| Operating system | Example path                               |
| ---------------- | ------------------------------------------ |
| macOS, Linux     | `/data/project/**`                         |
| Windows          | `C:\data\project\**`                       |
| WSL              | `\\wsl.localhost\<distro>\data\project\**` |

On Windows, `*:` matches any drive letter, so `*:\data\**` matches the path on
any drive.

Wildcards behave the same way in every path format:

| Pattern            | Example    | Matches                                                    |
| ------------------ | ---------- | ---------------------------------------------------------- |
| Exact path         | `/data`    | `/data` only                                               |
| Segment wildcard   | `/data/*`  | `/data/project`, one path segment only, not subdirectories |
| Recursive wildcard | `/data/**` | `/data/project`, `/data/project/src`, any depth            |

Use `**` to match a directory tree recursively. A single `*` matches within one
path segment and won't cross a path separator. For example, `~/**` matches all
paths under the home directory, while `~/*` matches only its direct children.

For organization policy configuration and enforcement details, see
[Filesystem access policies](/ai/sandboxes/governance/concepts/access-controls/filesystem/).

### MCP policies

MCP policies control Model Context Protocol activity made available to a
sandbox through Docker's [MCP gateway](/ai/sandboxes/governance/mcp-gateway/). They are
organization policies written in Cedar using the `MCP` namespace, rather than
the network and filesystem rule format.

MCP policy applies when a developer registers a server and when an agent uses
the MCP gateway. Registration rules control future `sbx mcp add` operations.
Use-time rules control tool calls, gateway meta-tools, resource reads, and
prompt retrieval from servers that are already registered or loaded.

Governed MCP activity is default deny: a request is blocked unless a matching
`permit` allows it. A matching `forbid` overrides any `permit`, including a
permit that requires approval. Policy scope supplies the principal, so use
organization or team scope instead of matching users, teams, tenants, or roles
in Cedar.

For representative policies, see [MCP access policies](/ai/sandboxes/governance/concepts/access-controls/mcp/).
For exact action, resource, context, and approval behavior, see the
[MCP policy reference](/ai/sandboxes/governance/concepts/reference/mcp-policy/).

## Rule evaluation

When organization governance is active, the rules from all of a user's
[effective policies](#policy-scope) are combined and evaluated together against
each request, following two principles:

- Deny wins: if any rule matches with `decision: deny`, the request is denied,
  regardless of any matching allow rules.
- Default deny: anything an allow rule doesn't match is blocked. Outbound
  network traffic is blocked unless a network rule allows the destination, and a
  host path can't be mounted unless a filesystem rule allows it. MCP activity is
  blocked unless an MCP `permit` allows it.

Because every effective policy feeds the same evaluation, allows are additive (a
request is allowed if any effective policy allows it) and denies are absolute (a
request is blocked if any effective policy denies it). A deny rule in an
org-wide policy therefore applies to everyone and can't be overridden by a
team-scoped policy, which makes org-wide deny rules useful as guardrails.

Local and kit-defined allow rules take no part in this evaluation. Deny rules
from those sources do still apply. See [Precedence](#precedence).

A request that an approval-required policy allows produces a third outcome.
Rather than being allowed outright, it's held back until the developer confirms
the destination, and the confirmation governs later requests to it. This holds
even when another policy allows the same request without requiring approval. A
matching deny still wins, so a denied destination is blocked without asking.
See [Approval-required access](/ai/sandboxes/governance/concepts/access-controls/network/#approval-required-access).

## Precedence

What applies depends on whether your organization has governance enabled:

- No organization governance: local rules and any kit-defined network rules
  determine what sandboxes can access.
- Organization governance active: organization policy determines what access can
  be granted. Only organization allow rules grant access, so local and
  kit-defined allow rules are inactive and can't expand what the organization
  permits. Deny rules apply from every source, so a local or kit-defined deny
  can still restrict access further.

For kit-defined rules, see
[Network policies](https://github.com/docker/sandbox-kit-spec/blob/main/docs/spec/capabilities/com.docker.sandbox/network-policy@1.md)
in the kit specification.

Precedence is decided by a rule's decision rather than its source:

| Rule                | Evaluated under organization governance |
| ------------------- | --------------------------------------- |
| Organization allow  | Yes                                     |
| Organization deny   | Yes                                     |
| Local allow         | No                                      |
| Local deny          | Yes                                     |
| Kit-defined allow   | No                                      |
| Kit-defined deny    | Yes                                     |

Local and kit-defined rules cover network access only, so a deny that layers on
top of organization policy is always a network deny. `sbx policy ls` hides
inactive rules by default. See
[Monitoring](/ai/sandboxes/governance/concepts/monitor-and-enforce/monitoring/#showing-inactive-rules) for how
to list them.

A local deny takes precedence over an organization approval requirement as
well, so the request is blocked and no approval is requested. Rules that a
developer gains by approving a request are the one exception to local allow
rules being inactive, because they record an answer to the organization's own
approval requirement rather than granting new access. See
[Approval-required access](/ai/sandboxes/governance/concepts/access-controls/network/#approval-required-access).

When organization governance is active, a user's organization policies are
evaluated together, as described in [Rule evaluation](#rule-evaluation).

<!-- page: https://docs.docker.com/ai/sandboxes/governance/monitor-and-enforce/ fetched 2026-10-08 -->

# Monitor and enforce


After policies are configured, use monitoring, audit records, and sign-in
enforcement to verify how governance behaves across developer machines.

- [Monitoring policies](/ai/sandboxes/governance/monitor-and-enforce/monitoring/): inspect active policy rules and monitor
  sandbox network traffic.
- [Audit logs](/ai/sandboxes/governance/audit): view, configure, export, and collect governance audit
  records.
- [Sign-in enforcement](/ai/sandboxes/governance/monitor-and-enforce/sign-in-enforcement/): require users to sign in as
  members of approved Docker organizations.

<!-- page: https://docs.docker.com/ai/sandboxes/governance/monitor-and-enforce/monitoring/ fetched 2026-10-08 -->

# Monitoring policies


`sbx policy ls` and `sbx policy log` give you a combined view of all active
policy rules and sandbox network activity, regardless of whether those rules
come from local configuration or organization governance. They're useful both
for verifying rules you've written and for debugging why a request is being
blocked or allowed.

## Listing rules

Use `sbx policy ls` to see all active policies and their current status:

```console
$ sbx policy ls
POLICY                                 SOURCE   APPLIES TO          SUMMARY
local-policy                           local    all                 network: 42 allow, 1 deny; filesystem read: 1 allow; filesystem write: 1 allow
1b2633ea-e604-48bb-a5e6-3ac86ba383fe   kit      sandbox:my-sandbox  network: 3 allow
```

The columns are:

- `POLICY`: the policy name.
- `SOURCE`: where the policy came from. `local` means your local configuration
  — a preset or rules you added with `sbx policy`. `kit` means a
  [kit](/ai/sandboxes/governance/concepts/#precedence). `org` means your
  organization.
- `APPLIES TO`: which sandboxes the policy applies to. `all` means the policy
  is global. `sandbox:<name>` scopes it to a single sandbox; a profile name
  scopes it to sandboxes using that profile.
- `SUMMARY`: a count of rule entries by type and decision, for example
  `network: 5 allow, 1 deny`. A rule that names several destinations
  contributes one entry per destination. When the listing includes rules that
  match an HTTP method and path, the network count labels each part `(L4)` or
  `(L7)`. See [HTTP rules](#http-rules).

To see full rule-level detail including rule IDs and resources, pass `--wide`.
To inspect a single policy or rule, use `sbx policy inspect`:

```console
$ sbx policy inspect Balanced
```

Use `--source` to filter by origin (`local`, `org`, or `kit`) and `--decision`
to filter by outcome (`allow` or `deny`).

Use `--protocol tcp` or `--protocol udp` to filter network rules.

Use `--created-via` to filter by how a rule was created. Pass `default` for
preset rules, `added` for rules you added yourself, `provisioned` for rules a
kit or application added, or `approval` for rules recorded when you approved a
destination. A wide listing shows the same information per rule:

```console
$ sbx policy ls --wide --created-via approval
```

See [Approval-required access](/ai/sandboxes/governance/monitor-and-enforce/access-controls/network/#approval-required-access).

A `STATUS` column also appears when you pass `--include-inactive`; see
[Showing inactive rules](#showing-inactive-rules).

When organization governance is active, the output starts with a summary line
showing which organization manages the policy, the sync state, and how many
inactive rules are hidden:

```console
$ sbx policy ls
Governance: Managed by my-org | Sync: OK, last synced 08:21:01 | Hidden: 9 inactive rules. Show with: sbx policy ls --include-inactive

POLICY               SOURCE   APPLIES TO   SUMMARY
default filesystem   org      all          filesystem read: 2 allow; filesystem write: 7 allow, 2 deny
default network      org      all          network: 38 allow, 4 deny
```

`Governance` shows which organization manages the policy, and `Sync` confirms
the daemon has pulled the latest rules. If the sync state shows an error or a
stale timestamp, the daemon may not have the most recent org policy. Run
`sbx policy reset` to force a fresh pull. `Hidden` reports how many inactive
rules are suppressed and how to reveal them.

If Docker can't determine which organization governs your account, policy
output shows `Governance: Unresolved`, and the dashboard shows the same
unresolved state. For example, this happens when your account belongs to
multiple organizations with governance enabled. Policy enforcement fails closed
until the conflict is resolved, so local allow rules can't grant access. Contact
an administrator for the affected organizations to resolve the conflicting
governance configuration.

### Showing inactive rules

When organization governance is active, local and kit-defined allow rules are
not evaluated, so `sbx policy ls` hides them by default. To list them too — for
example, to confirm which allow rules the organization policy overrides — pass
`--include-inactive`. This adds a `STATUS` column:

```console
$ sbx policy ls --include-inactive
Governance: Managed by my-org | Sync: OK, last synced 08:41:06

POLICY                       SOURCE   APPLIES TO   SUMMARY                                                    STATUS
default filesystem           org      all          filesystem read: 2 allow; filesystem write: 7 allow, 2 deny   active
default network              org      all          network: 38 allow, 4 deny                                   active
default-fs-read-allow-all    local    all          filesystem read: 1 allow                                    inactive
default-fs-write-allow-all   local    all          filesystem write: 1 allow                                   inactive
```

Inactive policies show `inactive` in the `STATUS` column. They have no effect
while organization governance is active. Local and kit-defined deny rules stay
active and aren't hidden, because a deny still applies on top of the
organization policy. See [Precedence](/ai/sandboxes/governance/monitor-and-enforce/concepts/#precedence).

Use `--type network`, `--type filesystem`, or `--type http` to show only
policies of that type. Without a sandbox argument, `sbx policy ls` shows every
policy across all sandboxes. Pass a sandbox name to filter to global policies
and those scoped to that sandbox:

```console
$ sbx policy ls my-sandbox
```

### Filesystem rules

`sbx policy ls` lists filesystem policies alongside network policies. Filesystem
rules control which host paths a sandbox can mount as a workspace. Pass
`--type filesystem` to show only them:

```console
$ sbx policy ls --type filesystem
POLICY         SOURCE   APPLIES TO   SUMMARY
local-policy   local    all          filesystem read: 1 allow; filesystem write: 1 allow
```

A writable workspace mount must be allowed by both a `filesystem:read` and a
`filesystem:write` rule; a read-only mount needs only `filesystem:read`. The
default local policy allows read and write access to all paths, shown as the
two `default-fs-*` rules above. For the rule syntax and path patterns, see
[Policy concepts](/ai/sandboxes/governance/monitor-and-enforce/concepts/#filesystem-rules).

### HTTP rules

Rules that match an HTTP method and path are listed as type `http`. Pass
`--wide` to see the `METHOD` and `PATH` columns alongside network rules:

```console
$ sbx policy ls --wide
TYPE      METHOD   PATH
network   -        -
http      GET      /repos/org/project/**
http      POST     /admin/**
```

Rules that match a whole destination show `-` in both columns. To list only
HTTP rules, pass `--type http`.

HTTP rules are counted as network rules in the `SUMMARY` column, with each part
labeled by the network layer it matches on. `L4` counts entries that match a
whole destination, and `L7` counts those that also match an HTTP method and
path:

```console
$ sbx policy ls
POLICY         SOURCE   APPLIES TO   SUMMARY
local-policy   local    all          network: 2 allow (L4), 1 deny (L7)
```

When the same decision has entries at both layers, each layer gets its own
count, L4 first. Two host allows and one HTTP allow read
`network: 2 allow (L4), 1 allow (L7)`.

The labels appear when the current listing includes at least one HTTP rule.
Because filters and hidden inactive rules change what the listing contains, a
filtered listing with no HTTP rules shows an unlabeled count, such as
`network: 42 allow`.

For the rule syntax, see
[HTTP method and path](/ai/sandboxes/governance/monitor-and-enforce/concepts/#http-method-and-path).

## Monitoring traffic

Use `sbx policy log` to see which hosts your sandboxes have contacted and
which rules matched:

```console
$ sbx policy log
Blocked requests:
SANDBOX      TYPE     HOST                   PROXY        RULE            REASON         LAST SEEN        COUNT
my-sandbox   network  blocked.example.com    transparent  domain-blocked  default-deny   10:15:25 29-Jan  1

Allowed requests:
SANDBOX      TYPE     HOST                   PROXY          RULE             REASON   LAST SEEN        COUNT
my-sandbox   network  api.anthropic.com      forward        domain-allowed            10:15:23 29-Jan  42
my-sandbox   network  registry.npmjs.org     forward-bypass domain-allowed            10:15:20 29-Jan  18
my-sandbox   network  app.example.com        browser-open                             10:15:10 29-Jan  1
```

The `PROXY` column shows how the request left the sandbox:

| Value            | Description                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `forward`        | Routed through the forward proxy. Supports [credential injection](/ai/sandboxes/governance/configuration/credentials/).              |
| `forward-bypass` | Routed through the forward proxy without credential injection.                                                 |
| `transparent`    | Intercepted by the transparent proxy. Policy is enforced but credential injection is not available.            |
| `network`        | Non-HTTP traffic. TCP and experimental UDP egress follow network policy. ICMP is blocked. |
| `browser-open`   | A sandbox process requested opening a URL in the host browser. Policy is enforced before opening the URL.      |

The `RULE` column identifies the policy rule that matched the request. The
`REASON` column includes extra context when the daemon records one.

Filter by sandbox name by passing it as an argument:

```console
$ sbx policy log my-sandbox
```

Use `--limit N` to show only the last `N` entries, `--json` for
machine-readable output, or `--type network` to filter by policy type.
`sbx policy log` records network traffic only; filesystem mount decisions
aren't available in the log yet.

<!-- page: https://docs.docker.com/ai/sandboxes/governance/monitor-and-enforce/sign-in-enforcement/ fetched 2026-10-08 -->

# Sign-in enforcement


Sign-in enforcement restricts Docker Sandboxes to users who are members of
specific Docker organizations. An administrator deploys an enforcement
configuration to managed endpoints, and `sbx login` verifies organization
membership after the user authenticates. If the check fails, credentials are
immediately revoked and the user can't run sandboxes.

Without this enforcement, a developer can sign in with a personal account and
bypass organization [governance policies](/ai/sandboxes/governance/monitor-and-enforce/access-controls/organization/).
Sign-in enforcement closes that gap at the endpoint, where users can't override
it.

> [!NOTE]
> Sign-in enforcement is part of Docker's AI Governance offering.
> [Contact Docker Sales](https://www.docker.com/products/ai-governance/#contact-sales)
> to learn more.

## How it works

1. An administrator deploys an enforcement configuration to managed endpoints
   through MDM, Group Policy, or configuration management, specifying one or
   more allowed Docker organization slugs.
2. When a user runs `sbx login`, they authenticate with Docker. Credentials
   are saved temporarily, then Docker Sandboxes calls the Docker API to
   verify organization membership.
3. If the user belongs to at least one allowed organization, login succeeds and
   the credentials are kept.
4. If not, Docker Sandboxes immediately revokes the saved credentials and the
   user receives an [error message](#error-messages) listing the required
   organizations.

`sbx login` and `sbx logout` always run regardless of organization membership.
Other commands require a valid signed-in session, so they fail after a denied
login until the user signs in with an allowed account.

## Enforcement configuration

All platforms express the same logical schema. The canonical JSON
representation:

```json
{
  "allowedOrgs": ["docker", "acme-corp"],
  "adminEmail": "it-security@acme-corp.com",
  "adminURL": "https://acme-corp.atlassian.net/servicedesk/it",
  "adminName": "ACME IT Security Team"
}
```

| Field         | Type            | Required | Description                                                                                         |
| ------------- | --------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `allowedOrgs` | list of strings | Yes      | Docker organization slugs. The user must be a member of at least one. Matching is case-insensitive. |
| `adminName`   | string          | No       | Administrator or team display name shown in the denial message.                                     |
| `adminEmail`  | string          | No       | Contact email shown in the denial message.                                                          |
| `adminURL`    | string          | No       | Help desk or access-request URL shown in the denial message.                                        |

If `allowedOrgs` is empty or missing, enforcement is inactive and any
authenticated user can use Docker Sandboxes.

The optional `adminName`, `adminEmail`, and `adminURL` fields give denied users
a path to resolution. Include the contact details your organization uses for
access requests.

## Deploy the configuration

Use your existing endpoint management tooling to deploy the configuration. Each
platform reads it from a native location that ordinary users can't modify.

**macOS**



On macOS, the configuration is a managed preferences domain, `com.docker.sbx`.

Deploy it through any MDM solution, such as Jamf or Intune, as a custom
configuration profile. MDM-deployed profiles take precedence over user-level
preferences and can only be removed by removing the device from MDM management,
so users can't override them.

The following `.mobileconfig` payload sets the allowed organization and admin
contact details:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.ManagedClient.preferences</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadIdentifier</key>
      <string>com.docker.sbx.policy</string>
      <key>PayloadUUID</key>
      <string><!-- generate a UUID --></string>
      <key>PayloadEnabled</key>
      <true/>
      <key>PayloadDisplayName</key>
      <string>Docker Sandboxes Policy</string>
      <key>PayloadContent</key>
      <dict>
        <key>com.docker.sbx</key>
        <dict>
          <key>Forced</key>
          <array>
            <dict>
              <key>mcx_preference_settings</key>
              <dict>
                <key>allowedOrgs</key>
                <array>
                  <string>acme-corp</string>
                </array>
                <key>adminEmail</key>
                <string>it-security@acme-corp.com</string>
                <key>adminURL</key>
                <string>https://acme-corp.atlassian.net/servicedesk/it</string>
                <key>adminName</key>
                <string>ACME IT Security</string>
              </dict>
            </dict>
          </array>
        </dict>
      </dict>
    </dict>
  </array>
</dict>
</plist>
```

To test the configuration locally without MDM, write to the user preferences
domain:

```console
$ defaults write com.docker.sbx allowedOrgs -array "acme-corp"
$ defaults write com.docker.sbx adminEmail "it@acme.com"
```

To remove the test configuration:

```console
$ defaults delete com.docker.sbx
```

`defaults write` uses the user preferences domain, not the managed-preferences
domain. On a managed device, the MDM profile is authoritative and user-level
settings in the same domain are ignored.

**Windows**



Deploy it through Group Policy, Intune, or any endpoint management tool that can
write registry values.

| Value name    | Type           | Description                                         |
| ------------- | -------------- | --------------------------------------------------- |
| `allowedOrgs` | `REG_MULTI_SZ` | Multi-string list, one organization slug per string |
| `adminName`   | `REG_SZ`       | Administrator or team name (optional)               |
| `adminEmail`  | `REG_SZ`       | Contact email (optional)                            |
| `adminURL`    | `REG_SZ`       | Help desk URL (optional)                            |

To test the configuration locally, run the following in an elevated PowerShell
session. Use `New-ItemProperty` to create values with an explicit type;
`Set-ItemProperty` doesn't create new values.

```powershell
New-Item -Path "HKLM:\SOFTWARE\Policies\Docker\SBX" -Force

New-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Docker\SBX" `
  -Name "allowedOrgs" -Value @("acme-corp") -PropertyType MultiString -Force
New-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Docker\SBX" `
  -Name "adminEmail" -Value "it@acme.com" -PropertyType String -Force
```

To remove the configuration:

```powershell
Remove-Item -Path "HKLM:\SOFTWARE\Policies\Docker\SBX" -Recurse -Force
```

**Linux**



On Linux, the configuration is a root-owned JSON file at
`/etc/docker-sbx/config.json`.

Deploy it through configuration management such as Ansible, Puppet, Chef, or
Salt. The file must be owned by root with `644` permissions.

```json
{
  "allowedOrgs": ["acme-corp"],
  "adminEmail": "it-security@acme-corp.com",
  "adminURL": "https://acme-corp.atlassian.net/servicedesk/it",
  "adminName": "ACME IT Security"
}
```

To deploy and set ownership:

```console
$ sudo mkdir -p /etc/docker-sbx
$ sudo tee /etc/docker-sbx/config.json <<'EOF'
{"allowedOrgs": ["acme-corp"], "adminEmail": "it@acme.com"}
EOF
$ sudo chown root:root /etc/docker-sbx/config.json
$ sudo chmod 644 /etc/docker-sbx/config.json
```

To remove the configuration:

```console
$ sudo rm -f /etc/docker-sbx/config.json
```

The Linux loader fails closed if the file is a symlink, isn't a regular file,
isn't owned by root, or is writable by group or other. Any deviation is treated
as a configuration error and `sbx login` is denied with a descriptive message.
Deploying with the commands above passes these checks.



## Error messages

When a user signs in with an account that isn't a member of an allowed
organization, they're signed out and shown a denial message. Only the contact
fields you configure appear: if only `adminEmail` is set, the URL line is
omitted.

When no admin contact details are configured:

```text
Access denied: Your administrator requires you to be logged into an account
that is a member of one of the following Docker organizations:
  - acme-corp

Sign in with an account that belongs to one of these organizations, or
contact your administrator for access.
```

When admin contact details are configured:

```text
Access denied: Your administrator requires you to be logged into an account
that is a member of one of the following Docker organizations:
  - acme-corp

For access, contact ACME IT Security:
  Email: it-security@acme-corp.com
  URL:   https://acme-corp.atlassian.net/servicedesk/it
```

## Related pages

- [Organization policies](/ai/sandboxes/governance/monitor-and-enforce/access-controls/organization/): centrally manage
  sandbox network, filesystem, and MCP access controls from the Docker Admin
  Console
- [Governance overview](/ai/sandboxes/governance/monitor-and-enforce/): how local and organization governance fit
  together
- [Enforce sign-in for Docker Desktop](/desktop/enterprise/enforce-sign-in/):
  the equivalent control for Docker Desktop

<!-- page: https://docs.docker.com/ai/sandboxes/governance/reference/ fetched 2026-10-08 -->

# Reference


Use reference material when you need API details or exact policy syntax.

- [Policy concepts](/ai/sandboxes/governance/concepts/): resource model, rule syntax, policy
  evaluation, and precedence.
- [AI Governance API](/reference/api/ai-governance/): HTTP API reference for
  network and filesystem organization policies.
- [MCP policy reference](/ai/sandboxes/governance/reference/mcp-policy/): Docker MCP policy actions, resources,
  attributes, context fields, and approval behavior.

<!-- page: https://docs.docker.com/ai/sandboxes/governance/reference/mcp-policy/ fetched 2026-10-08 -->

# MCP policy reference


MCP policies are organization policies written in Cedar using Docker's `MCP`
namespace. This reference defines the Docker-specific policy surface for Model
Context Protocol (MCP) activity made available to sandboxes through Docker's
[MCP gateway](/ai/sandboxes/governance/mcp-gateway/).

Use this reference with [MCP access policies](/ai/sandboxes/governance/reference/access-controls/mcp/) for
common policy patterns. For the Cedar language, see the
[Cedar documentation](https://docs.cedarpolicy.com/).

## Evaluation model

Cedar evaluates MCP requests against a principal, action, resource, and context.
For Docker MCP policies, policy scope supplies the principal. Write policies
against the action, resource, and context. Clauses that reference principal
attributes, such as `principal in ...`, `principal.role`, or
`principal.tenant`, don't match.

Governed MCP activity is default deny. A request is blocked unless a matching
`permit` allows it. A matching `forbid` overrides any `permit`, including a
permit annotated with `@requireApproval`.

For details about when Docker Sandboxes evaluates MCP policies for a user, see
[Govern the server lifecycle](/ai/sandboxes/governance/reference/access-controls/mcp/#govern-the-server-lifecycle).

An actionless `permit` matches every MCP action that reaches Cedar evaluation:

```plaintext
permit (principal, action, resource);
```

## Actions

| Action              | Governs                   | Notes                                                                                                          |
| ------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `register`          | MCP server registration   | Server registration needs an explicit `permit`. Use server attributes to scope registration.                   |
| `invokeTool`        | MCP tool calls            | Most tool access policies target this action.                                                                  |
| `invokePrimordial`  | Gateway meta-tool calls   | Applies to built-in gateway tools such as `mcp-exec`, `mcp-add`, `code-mode`, and OAuth authorization helpers. |
| `readResource`      | MCP resource reads        | Rules match `MCP::Resource` and `resource.uri`.                                                                |
| `getPrompt`         | MCP prompt retrieval      | Rules match `MCP::Prompt` and `resource.name`.                                                                 |
| `listTools`         | MCP tool listing          | Defined in the schema but not Cedar-gated. Tool listings can include tools denied at invocation.               |
| `listResources`     | MCP resource listing      | Defined in the schema but not Cedar-gated. Resource listings can include resources denied by policy.           |
| `subscribeResource` | MCP resource subscription | Defined in the schema but not Cedar-gated.                                                                     |

## Resources

Match resources with the MCP entity type and attributes for the request.

| Entity            | Match with             | Notes                                                                                                                            |
| ----------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `MCP::Server`     | Registered server name | The canonical server identity is the `resource.identityURL` attribute, not the entity ID.                                        |
| `MCP::Tool`       | Bare tool name         | Use `resource.name`. Display prefixes aren't included. A bare-name match applies to every server exposing a tool with that name. |
| `MCP::Resource`   | Resource URI           | Use `resource.uri`.                                                                                                              |
| `MCP::Prompt`     | Prompt name            | Use `resource.name`.                                                                                                             |
| `MCP::Primordial` | Gateway meta-tool name | Match a specific primordial with an entity reference.                                                                            |

Examples:

```plaintext
resource in MCP::Server::"notion"
resource.name == "move_file"
resource.uri like "*/docs/*"
resource in MCP::Primordial::"code-mode"
```

## Resource attributes

Tool annotation attributes come from MCP tool annotations or catalog metadata
and are advisory.

| Attribute                  | Applies to        | Notes                                                                                                                                                 |
| -------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resource.name`            | Tools and prompts | For tools, this is the bare tool name, not a display-prefixed name.                                                                                   |
| `resource.uri`             | Resources         | Use with string operators such as `like`.                                                                                                             |
| `resource.readOnly`        | Tools             | Defaults to `false` when a tool doesn't declare it.                                                                                                   |
| `resource.destructive`     | Tools             | Defaults to `true` when a tool doesn't declare it.                                                                                                    |
| `resource.idempotent`      | Tools             | Defaults to `false` when a tool doesn't declare it.                                                                                                   |
| `resource.openWorld`       | Tools             | Defaults to `true` when a tool doesn't declare it.                                                                                                    |
| `resource.type`            | Servers           | Use for server registration rules. See [Server type values](#server-type-values).                                                                     |
| `resource.identityURL`     | Servers           | Canonical server identity. The value depends on the registration type. See [Server identity values](#server-identity-values).                         |
| `resource.requiresOAuth`   | Servers           | Use for server registration rules.                                                                                                                    |
| `resource.requiresNetwork` | Servers           | Use for server registration rules.                                                                                                                    |
| `resource.command`         | Servers           | Local stdio server command, such as `npx` or `docker`, when available. Empty for remote servers and registrations that don't include command details. |
| `resource.args`            | Servers           | Local stdio server arguments when available. This is a set, so `.contains()` can match values. Empty when no command details are available.           |

Use `like` for string attributes. In Cedar, `like` uses `*` as its wildcard,
matches the full string, treats `?` as a literal character, and treats `\*` as
a literal asterisk.

Use `.contains()` only on set attributes, such as `resource.args`. On string
attributes, use `like`.

### Server type values

Local gateway registrations use these values:

- `local-stdio`: a host-run stdio server. This includes explicit commands and
  OCI-packaged stdio servers resolved from metadata with `--local`.
- `container-stdio`: an OCI-packaged server resolved from metadata without
  `--local`. This value can appear in `register` decisions, but the local
  gateway can't attach or run this server type.
- `remote-dcr`: a remote endpoint that doesn't require OAuth or supports OAuth
  Dynamic Client Registration.
- `remote-no-dcr`: a remote OAuth endpoint that doesn't support Dynamic Client
  Registration.

### Server identity values

For a remote server, `resource.identityURL` is the endpoint URL. For an explicit
local command, it is the resolved executable path on the host. For a `--local`
metadata registration, it is `local://stdio/<name>`, not the registry or
manifest URL.

## Context fields

| Field                  | Notes                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `context.request_time` | Bound for tool calls, built-in gateway tool calls, resource reads, and prompt retrieval. Registration requests don't include it.            |
| `context.args`         | Arguments for `invokeTool` and `invokePrimordial` requests evaluated by the gateway. Present when arguments are available as a JSON object. |

A registration `permit` conditioned on `context.request_time` doesn't match,
so the registration falls to default deny.

Guard tool-call argument rules with `context has args` and a field check:

```plaintext
permit (principal, action == MCP::Action::"invokeTool", resource)
when {
  resource.name == "approve_expense" &&
  context has args &&
  context.args has amount &&
  context.args.amount <= 500
};
```

A `permit` gated on missing arguments doesn't match, so the request falls to
default deny. A `forbid` gated on missing arguments doesn't match, so it
doesn't block the request.

Only object-shaped tool arguments are represented in `context.args`.
Unsupported or malformed arguments are omitted.

## Approval annotation

Use `@requireApproval("reason")` on a `permit` statement to require in-session
confirmation through MCP elicitation before a matching request runs:

```plaintext
@requireApproval("write tool call")
permit (principal, action == MCP::Action::"invokeTool", resource)
when { resource.readOnly == false };
```

When a request matches the annotated `permit` and no `forbid` overrides it, the
policy engine returns an approval-required outcome. The annotation string is
shown as the elicitation reason. An approval-required outcome takes precedence
over a normal `permit`. A matching `forbid` denies the request without an
elicitation.

For the request flow and trust model, see
[Require confirmation with MCP elicitation](/ai/sandboxes/governance/reference/access-controls/mcp/#require-confirmation-with-mcp-elicitation).

Approval requires a client session that can present an MCP elicitation request
to the user. If the request can't be presented for approval, the request is
denied. Approval is an in-session confirmation, not an out-of-band approval
workflow. Each confirmation applies to one authorization request. After the
client confirms, the gateway re-evaluates the request with an approval digest.

`sbx mcp add` can't present an elicitation request. A registration permit with
`@requireApproval` therefore results in a denial.

Only the exact annotation name `@requireApproval` applies approval behavior.
Other annotation names, such as `@requireConsent` or `@requireConfirmation`,
don't require approval.

## Limitations

- Tool and resource listing actions aren't Cedar-gated. Listings can include
  entries that a policy denies when the sandbox tries to use them.
- Approval-gated requests are denied when the execution context can't relay an
  MCP elicitation to the originating client. This includes tool calls made from
  inside `code-mode`.
- Registration policy is evaluated when a server is registered. It doesn't
  remove existing registrations or stop an already-loaded server by itself.
  Govern existing registrations with use-time rules such as `invokeTool`,
  `readResource`, and `getPrompt`.
- Server command and argument rules using `resource.command` or `resource.args`
  apply only when the resolved server registration includes local stdio command
  details. Remote servers and metadata-resolved local servers can have empty
  values for those attributes. Use `resource.type == "local-stdio"` to match
  host-run servers independently of command details.
- Principal-based rules don't take effect. Use organization and team policy
  scope to target users.
- Server groups aren't supported in MCP policy. Reference servers individually.

<!-- page: https://docs.docker.com/ai/sandboxes/install/ fetched 2026-10-08 -->

# Install Docker Sandboxes


Install the `sbx` CLI to run AI coding agents in local or cloud sandboxes. You
don't need Docker Desktop or Docker Engine to use `sbx`. Cloud sandboxes require
version 0.45.0 or later for the workflows in these guides.

## Prerequisites

The operating system and processor requirements apply to the CLI installation.
Hypervisor and KVM setup is required only to run local sandboxes. For cloud
account requirements, see [Cloud sandboxes](/ai/sandboxes/install/cloud/#prerequisites).

### macOS

- macOS Sonoma version 14 or later
- Apple silicon

### Windows

- Windows 11
- A 64-bit Intel or AMD processor
- Windows Hypervisor Platform for local sandboxes

To run local sandboxes, open an elevated PowerShell prompt and turn on Windows
Hypervisor Platform:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All
```

### Linux

- Ubuntu 24.04 or later
- A 64-bit Intel or AMD processor, or a 64-bit Arm processor
- For local sandboxes, KVM hardware virtualization supported and turned on by
  the CPU, and your user account in the `kvm` group

To run local sandboxes inside a virtual machine or virtual desktop
infrastructure environment, the environment must support nested virtualization.
Cloud sandboxes don't require this setup.

For local sandboxes, verify that KVM is available:

```console
$ lsmod | grep kvm
```

A working setup shows `kvm_intel`, `kvm_amd`, `kvm_arm64`, or `kvm` in the
output. If the output is empty, run `kvm-ok` for diagnostics. The local sandbox
runtime requires KVM to start.

Add your user to the `kvm` group:

```console
$ sudo usermod -aG kvm $USER
```

Sign out and back in, or run `newgrp kvm`, for the group change to take effect.

## Install on macOS

Install `sbx` using Homebrew:

```console
$ brew trust docker/tap
$ brew install docker/tap/sbx
```

## Install on Windows

### Install for the current user

Install `sbx` using Windows Package Manager:

```powershell
winget install -h Docker.sbx
```

WinGet installs the per-user `DockerSandboxes.msi` package in
`%LOCALAPPDATA%\DockerSandboxes` and adds its `bin` directory to your user
`PATH`. You can install it without administrator privileges.

### Install for all users

For administrator-managed deployments, download
`DockerSandboxesMachine.msi` from the
[Docker Sandboxes releases](https://github.com/docker/sbx-releases/releases).
From an elevated PowerShell prompt, install the package silently:

```powershell
msiexec.exe /i DockerSandboxesMachine.msi /quiet
```

The machine-wide package installs in `%ProgramFiles%\DockerSandboxes` and adds
its `bin` directory to the system `PATH`.

A machine-wide upgrade might require restarting Windows if an `sbx` daemon in
another user's session is using the installed files.

## Install on Ubuntu

> [!NOTE]
>
> Docker does not test or support Docker Sandboxes on Ubuntu derivatives, such
> as Linux Mint and Pop!_OS. The convenience script can configure an incorrect
> package repository on these distributions.

You can install `sbx` with Docker Engine or install only the `sbx` package.

### Install Docker Engine and SBX

Run Docker's convenience script with `SBX=1` to install Docker Engine and the
`docker-sbx` package together:

```console
$ curl -fsSL https://get.docker.com | sudo SBX=1 sh
```

### Install SBX only

To install `sbx` without Docker Engine on the host, add Docker's `apt`
repository and install the `docker-sbx` package:

```console
$ curl -fsSL https://get.docker.com | sudo REPO_ONLY=1 sh
$ sudo apt install docker-sbx
```

## Install from release artifacts

To install `sbx` from a package or archive, follow the
[manual installation instructions](https://github.com/docker/sbx-releases#manual-install-from-release-artifacts).
The availability of a Linux release artifact does not indicate that Docker
tests or supports the corresponding distribution.

## Sign in

Sign in to Docker:

```console
$ sbx login
```

The command opens a browser for Docker OAuth. See the [FAQ](/ai/sandboxes/install/faq/) for why
sign-in is required and how Docker handles your data.

After signing in, [run your first local sandbox](/ai/sandboxes/install/get-started/) or
[get started with cloud sandboxes](/ai/sandboxes/install/cloud/#get-started).

<!-- page: https://docs.docker.com/ai/sandboxes/integrations/ fetched 2026-10-08 -->

# Editor and app integrations




These integrations use local sandbox SSH access. Cloud sandboxes use a
different SSH configuration and address: see
[Connect with SSH](/ai/sandboxes/cloud/usage/#connect-with-ssh).

You can connect an external editor or desktop app to a running sandbox over
SSH. This lets you use the tools you already know — VS Code, Cursor, Claude
Desktop, and others — while your code runs, builds, and executes inside the
isolated sandbox instead of on your host.

Each sandbox is reachable at `<name>.sbx`, where `<name>` is the sandbox name.
Once SSH is set up, `<name>.sbx` behaves like any other SSH host, so any tool
that supports remote development over SSH can connect to it.

## Prerequisites

- The `sbx` CLI installed and signed in. See [Get started](/ai/sandboxes/get-started/).
- An SSH client. macOS and most Linux distributions include OpenSSH. On
  Windows, install the OpenSSH client.
- The editor or app you want to connect, with its remote-over-SSH support
  installed.

## Enable SSH access

Run the SSH setup command once:

```console
$ sbx setup ssh
```

The command starts the Docker Sandboxes daemon if needed and configures your
SSH client. You can re-run it at any time.

## Create or identify a sandbox

SSH connections require an existing sandbox. To create a named shell sandbox
for the current directory:

```console
$ sbx create --name demo shell .
```

To identify an existing sandbox, list your sandboxes:

```console
$ sbx ls
```

## Connect to a sandbox over SSH

Use the sandbox name with the `.sbx` suffix. For example, to connect to a
sandbox named `demo`:

```console
$ ssh demo.sbx
```

## Select the workspace folder

Connecting an app to a sandbox selects the remote environment, but it might not
open the primary workspace automatically. The initial folder depends on the
client. A remote folder picker might open at the sandbox user's home directory,
`/home/agent`, while an interactive `ssh` shell might start in
`/home/agent/workspace`. Select the intended folder explicitly instead of
relying on the initial location.

For a sandbox with a primary workspace, each workspace path appears inside the
sandbox at the same absolute path as on the host. For example, if you pass
`/Users/bob/src/my-project`, select that path in the remote folder picker. For
a mountless sandbox that uses a Docker-provided agent template, select
`/home/agent/workspace`.

## Connect a specific tool

- [VS Code](/ai/sandboxes/integrations/vscode/)
- [Cursor](/ai/sandboxes/integrations/cursor/)
- [Claude Desktop](/ai/sandboxes/integrations/claude-desktop/)
- [ChatGPT](/ai/sandboxes/integrations/chatgpt/)
- [T3 Code](/ai/sandboxes/integrations/t3-code/)

## How SSH connections work

### Managed SSH configuration

`sbx setup ssh` writes a managed block to your SSH config: `~/.ssh/config` on
macOS and Linux, or `%USERPROFILE%\.ssh\config` on Windows. The block is similar
to the following:

```text
# >>> docker sandboxes (managed) >>>
Host *.sbx
    User _default_user_
    ProxyCommand "sbx" ssh proxy %n
    IdentityAgent none
    IdentityFile /dev/null
    IdentitiesOnly yes
    ControlMaster no
    ControlPath none
    UserKnownHostsFile "~/.ssh/sbx_known_hosts"
    KnownHostsCommand "sbx" ssh known-hosts %H
    StrictHostKeyChecking yes
# <<< docker sandboxes (managed) <<<
```

You don't edit this block by hand. Its key entries work as follows:

- `Host *.sbx` maps sandbox hostnames to the sandbox daemon. Application host
  pickers don't discover individual sandbox names from this wildcard, so enter
  the hostname, such as `demo.sbx`, manually when you configure an integration.
- `User _default_user_` tells the daemon to use the sandbox image's default
  user, so your host username is never sent.

### Connection and authentication

Connections don't use a network port or an SSH key:

- A `ProxyCommand` relays the SSH stream to the daemon over its local socket
  (a Unix domain socket on macOS and Linux, a named pipe on Windows).
- The daemon accepts the connection only while you have an active Docker login.
  Authentication is tied to your login, not to a stored key.
- The host key is verified on every connection, so a rotated daemon key never
  triggers a host-key mismatch.

Because SSH terminates at the daemon, no SSH server runs inside the sandbox.
The sandbox must already be created. If it is stopped, connecting to
`<name>.sbx` starts it automatically.

### Environment variables

SSH connections don't forward client environment variables into the sandbox.
The daemon acknowledges SSH environment requests for compatibility but ignores
their names and values.

### Port forwarding

SSH clients can use local port forwarding to make a service listening on the
sandbox's loopback interface available on the host. For example, a remote
development client can map `127.0.0.1:4321` in the sandbox to
`127.0.0.1:55565` on the host, choosing an available host port automatically.
Traffic passes through the SSH connection instead of a published Docker port.

The sandbox daemon accepts forwarded connections only to loopback addresses in
the sandbox, including `localhost`, `127.0.0.0/8`, and `::1`. The SSH client
chooses the bind address for the listener on the host. A listener bound to
`127.0.0.1` or `::1` is reachable only from the host. A client configured to
bind to a non-loopback address can make the forwarded service reachable from
other machines, subject to the host's network and firewall configuration.

<!-- page: https://docs.docker.com/ai/sandboxes/integrations/chatgpt/ fetched 2026-10-08 -->

# Connect ChatGPT to a sandbox




These connection instructions use a local sandbox. For cloud SSH setup, see
[Connect with SSH](/ai/sandboxes/integrations/cloud/usage/#connect-with-ssh).

Connect the ChatGPT desktop app to a sandbox over SSH so Codex works inside the
isolated environment instead of on your host.

> [!NOTE]
> This page covers running Codex in the ChatGPT desktop app connected to a
> sandbox over SSH. To run the Codex CLI inside a sandbox directly, see
> [Codex](/ai/sandboxes/integrations/agents/codex/).

## Prerequisites

- SSH access set up. See [Editor and app integrations](/ai/sandboxes/integrations/chatgpt/#enable-ssh-access).
- The ChatGPT desktop app installed.

ChatGPT's remote server requires the `codex` command in the sandbox. The Codex
sandbox template used in the following section includes this command.

## Connect

Create a named Codex sandbox for the current directory if you don't already
have one:

```console
$ sbx create --name demo codex .
```

Confirm that you can connect to the sandbox from a terminal:

```console
$ ssh demo.sbx
```

In the ChatGPT desktop app, open **Settings > Connections** and add an SSH
connection manually. Enter the sandbox hostname, such as `demo.sbx`, as the
host, then use the remote folder picker to
[select the mounted workspace](/ai/sandboxes/integrations/chatgpt/#select-the-workspace-folder) as the
remote project.

For more connection options, see the OpenAI instructions to
[connect to an SSH host](https://learn.chatgpt.com/docs/remote-connections#connect-to-an-ssh-host).

## Full access still prompts for approval

ChatGPT controls Codex permissions separately from the Docker Sandbox. To run
commands without Codex approval prompts, select **Full access** from the
permissions menu for the remote chat. Enabling **Full access** under
**Settings > General** only adds the mode to the permissions menu. It doesn't
change an existing chat.

If the chat continues to request approval while showing **Full access**, update
the ChatGPT desktop app, then stop and restart the active task. Approval prompts
that return after reconnecting can indicate a
[Codex remote-permission synchronization issue](https://github.com/openai/codex/issues/29054).

## Related

- [Editor and app integrations](/ai/sandboxes/integrations/chatgpt/) — how SSH access works and how to
  set it up
- [Codex](/ai/sandboxes/integrations/agents/codex/) — run the Codex CLI inside a sandbox

<!-- page: https://docs.docker.com/ai/sandboxes/integrations/claude-desktop/ fetched 2026-10-08 -->

# Connect Claude Desktop to a sandbox




These connection instructions use a local sandbox. For cloud SSH setup, see
[Connect with SSH](/ai/sandboxes/integrations/cloud/usage/#connect-with-ssh).

Claude Desktop can run Claude Code on a remote machine over SSH. Point it at a
sandbox so the agent works inside the isolated environment instead of on your
host.

> [!NOTE]
> This page covers Claude Desktop connecting to a sandbox over SSH. To run the
> Claude Code CLI inside a sandbox directly, see
> [Claude Code](/ai/sandboxes/integrations/agents/claude-code/).

## Prerequisites

- SSH access set up. See [Editor and app integrations](/ai/sandboxes/integrations/claude-desktop/#enable-ssh-access).
- Claude Desktop installed.

Use a sandbox created with the Claude agent type. The Claude sandbox template
configures Anthropic credentials and network access for the remote Claude Code
session.

## Connect

> [!WARNING]
> Connecting Claude Desktop to a sandbox over SSH transmits Anthropic
> credentials into the Claude Code process within the sandbox, reducing
> isolation guarantees.

Create a named Claude sandbox for the current directory if you don't already
have one:

```console
$ sbx create --name demo claude .
```

Confirm that you can connect to the sandbox from a terminal:

```console
$ ssh demo.sbx
```

In Claude Desktop, open the environment drop-down before starting a session and
select **+ Add SSH connection**. Enter a name for the connection and enter the
sandbox hostname, such as `demo.sbx`, in **SSH Host**. Leave **SSH Port** and
**Identity File** empty because the managed SSH config supplies them.

Select the connection from the environment drop-down, then use the remote
folder picker to
[select the mounted workspace](/ai/sandboxes/integrations/claude-desktop/#select-the-workspace-folder). The
picker might initially open at `/home/agent`.

For more connection options, see the Claude Desktop instructions for
[SSH sessions](https://code.claude.com/docs/en/desktop#ssh-sessions).

## Troubleshoot a broken SSH connection after token refresh

The SSH connection drops when the Anthropic token expires and needs to be
refreshed. To work around this, run the sandbox manually from your host:

```console
$ sbx run --name <sandbox-name>
```

## Troubleshoot SSH connection timeouts on Windows

Claude Desktop requires Git on Windows. If an SSH connection times out and the
Claude Desktop logs include `ProxyCommand error: spawn sh ENOENT`, install
[Git for Windows](https://git-scm.com/download/win).

If Git is already installed, verify that `sh.exe` is available on your `PATH`:

```powershell
PS> where.exe sh
```

If the command doesn't find `sh.exe`, add the Git `bin` directory to your user
`Path`. The default directory is `C:\Program Files\Git\bin`. Quit and restart
Claude Desktop after updating `Path`.

## Related

- [Editor and app integrations](/ai/sandboxes/integrations/claude-desktop/) — how SSH access works and how to
  set it up
- [Claude Code](/ai/sandboxes/integrations/agents/claude-code/) — run the Claude Code CLI inside a
  sandbox

<!-- page: https://docs.docker.com/ai/sandboxes/integrations/cursor/ fetched 2026-10-08 -->

# Connect Cursor to a sandbox




These connection instructions use a local sandbox. For cloud SSH setup, see
[Connect with SSH](/ai/sandboxes/integrations/cloud/usage/#connect-with-ssh).

Cursor is built on VS Code, so it connects to a sandbox the same way, using
Remote - SSH. Your editor stays on your host while files, terminals, and
extensions run in the isolated sandbox.

> [!NOTE]
> This page covers the Cursor editor connecting to a sandbox over SSH. To run
> the Cursor agent CLI inside a sandbox instead, see
> [Cursor agent](/ai/sandboxes/integrations/agents/cursor/).

## Prerequisites

- SSH access set up. See [Editor and app integrations](/ai/sandboxes/integrations/cursor/#enable-ssh-access).
- Cursor's Remote - SSH support installed.

## Connect

Confirm that you can connect to the sandbox from a terminal:

```console
$ ssh demo.sbx
```

1. Open the Command Palette and run **Remote-SSH: Connect to Host**.
2. Enter the sandbox host manually as `<name>.sbx`.
3. Cursor opens a new window connected to the sandbox. Use the remote folder
   picker to [select the mounted workspace](/ai/sandboxes/integrations/cursor/#select-the-workspace-folder).

## Notes

- The first connection installs the editor server inside the sandbox, so it
  can take a moment. Later connections are faster.

## Related

- [Editor and app integrations](/ai/sandboxes/integrations/cursor/) — how SSH access works and how to
  set it up
- [Cursor agent](/ai/sandboxes/integrations/agents/cursor/) — run the Cursor CLI inside a sandbox

<!-- page: https://docs.docker.com/ai/sandboxes/integrations/t3-code/ fetched 2026-10-08 -->

# Connect T3 Code to a sandbox




These connection instructions use a local sandbox. For cloud SSH setup, see
[Connect with SSH](/ai/sandboxes/integrations/cloud/usage/#connect-with-ssh).

T3 Code's SSH integration lets the desktop app drive coding agents inside a
sandbox. T3 Code has no dedicated Docker Sandboxes integration — it treats the
sandbox as an ordinary SSH host, connects to it, and starts a T3 server inside
that tunnels back to the app.

## Prerequisites

- SSH access set up. See [Editor and app integrations](/ai/sandboxes/integrations/t3-code/#enable-ssh-access).
- T3 Code installed.

The first connection installs the T3 server in the sandbox, which needs a
build toolchain. T3 depends on `node-pty`, which ships prebuilt binaries only
for macOS and Windows. On a Linux sandbox, `node-pty` compiles from source and
the build fails without `make`, `python3`, and a compiler such as `g++`.

The [`t3code` kit](https://github.com/docker/sbx-kits-contrib/tree/main/t3code)
prepares a sandbox for T3 Code: it installs the build toolchain and the `t3`
npm package when the sandbox is created, so the first connection starts a
pre-installed server instead of building `node-pty` from source. Pair it with
any agent whose base image ships Node.js 18 or later, which all standard
agent templates do:

```console
$ sbx run claude --kit docker.io/sbx/t3code-kit:latest
```

For an existing sandbox, install the toolchain manually:

```console
$ sbx exec <sandbox> -- sudo apt-get update
$ sbx exec <sandbox> -- sudo DEBIAN_FRONTEND=noninteractive apt-get install -y g++ make python3
```

Verify the toolchain is in place:

```console
$ sbx exec <sandbox> -- sh -lc 'command -v g++ && command -v make && command -v python3'
```

A manual install lasts only until the sandbox is recreated, and the first
connection still builds `node-pty` from source. For a setup that persists,
recreate the sandbox with the [v2 kit](/ai/sandboxes/integrations/customize/kits-v2/) or a custom
[template](/ai/sandboxes/customize/author/base-images/).

## Connect

Confirm that you can connect to the sandbox from a terminal:

```console
$ ssh demo.sbx
```

In T3 Code, add an SSH environment and enter the sandbox hostname, such as
`demo.sbx`, as the host. The first connection installs the T3 server inside
the sandbox unless the `t3code` kit pre-installed it, so it can take a
moment. Later connections are faster.

Then add a new project, select the SSH environment from the list, and
[choose the mounted workspace](/ai/sandboxes/integrations/t3-code/#select-the-workspace-folder) as the
project directory inside the sandbox.

## Troubleshoot a server that never becomes ready

T3 Code can fail to connect with an error like the following, wrapped here
for readability. It concatenates the connection failure with npm's install
output from inside the sandbox into a single error dialog:

```text
Could not prepare the SSH environment: ... SshCommandError: Connecting to
sandbox "sandboxes"… Remote T3 server did not become ready on
127.0.0.1:3773. npm WARN EBADENGINE Unsupported engine { package:
'ini@7.0.0', required: { node: '^22.22.2 || ^24.15.0 || >=26.0.0' },
current: { node: 'v22.22.1', npm: '9.2.0' } }
```

The `npm WARN EBADENGINE` lines warn about the transitive `ini` dependency
and are separate from the failure: npm enforces engine requirements only
when `engine-strict` is set, which is off by default, so this warning alone
still lets the install proceed.

The most common causes are a missing C++ toolchain and a full disk, and both
produce this identical error. Get npm's actual output to tell them apart:

```console
$ sbx exec <sandbox> -- sh -lc \
  'rm -rf /tmp/t3probe && mkdir -p /tmp/t3probe && cd /tmp/t3probe \
   && npm init -y >/dev/null && npm install t3@latest 2>&1 | tail -40'
```

A missing compiler fails the native `node-pty` build with `Error 127` from
`make`:

```text
npm ERR! make: g++: No such file or directory
npm ERR! make: *** [pty.target.mk:115: Release/obj.target/pty/src/unix/pty.o] Error 127
npm ERR! gyp ERR! build error
npm ERR! gyp ERR! stack Error: `make` failed with exit code: 2
```

Install the build toolchain as described in [Prerequisites](#prerequisites).

A full disk fails with `ENOSPC`, and no gyp output appears at all because npm
fails before the native build starts:

```text
npm ERR! code ENOSPC
npm ERR! nospc ENOSPC: no space left on device
```

Check free disk space:

```console
$ sbx exec <sandbox> -- df -h /
```

A sandbox can have both problems at once. Fixing one still leaves the same
top-level error, so check both the toolchain and disk space before
concluding the sandbox is ready. Free up space or install the toolchain as
needed, then reconnect.

## Troubleshoot `turn/setPermissionMode failed`

If your organization manages Claude Code with a policy file, a local T3 Code
thread can fail to start with `turn/setPermissionMode failed`. T3 Code's
default runtime mode is Full access, which maps to the Claude Agent SDK's
`bypassPermissions` mode. A managed policy that disables that mode rejects
the request.

On macOS, check whether this applies to you:

```console
$ cat "/Library/Application Support/ClaudeCode/managed-settings.json"
```

If `permissions.disableBypassPermissionsMode` is set to `disable`, switch T3
Code to a different runtime mode, such as Supervised, Auto-accept edits, or
Auto, then start a new thread. The permission mode is captured once when a
thread starts, so switching modes in an already-failing thread doesn't
recover it.

This restriction applies to the host running Claude Code, not to a sandbox.
A thread connected to a sandbox isn't subject to the host's managed policy,
so Full access works normally there.

## Related

- [Editor and app integrations](/ai/sandboxes/integrations/t3-code/) — how SSH access works and how to
  set it up

<!-- page: https://docs.docker.com/ai/sandboxes/integrations/vscode/ fetched 2026-10-08 -->

# Connect VS Code to a sandbox




These connection instructions use a local sandbox. For cloud SSH setup, see
[Connect with SSH](/ai/sandboxes/integrations/cloud/usage/#connect-with-ssh).

Use the Remote - SSH extension to open a VS Code window that runs inside a
sandbox. Your editor stays on your host while files, terminals, and extensions
run in the isolated sandbox.

## Prerequisites

- SSH access set up. See [Editor and app integrations](/ai/sandboxes/integrations/vscode/#enable-ssh-access).
- The [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)
  extension (`ms-vscode-remote.remote-ssh`) installed in VS Code.

## Connect

Confirm that you can connect to the sandbox from a terminal:

```console
$ ssh demo.sbx
```

In VS Code, open the Command Palette and run **Remote-SSH: Connect to Host...**.
Enter the sandbox hostname, such as `demo.sbx`, manually. After VS Code
connects, use the remote folder picker to
[select the mounted workspace](/ai/sandboxes/integrations/vscode/#select-the-workspace-folder).

For more connection options, see the VS Code instructions to
[connect to a remote host](https://code.visualstudio.com/docs/remote/ssh#_connect-to-a-remote-host).

## Notes

- The first connection installs the VS Code server inside the sandbox, so it
  can take a moment. Later connections are faster.

### Reconnect loop on macOS

Affected versions of VS Code can enter an infinite reconnect loop on macOS. If
this happens, set `remote.SSH.useLocalServer` to `false` in your VS Code user
settings:

```json
{
  "remote.SSH.useLocalServer": false
}
```

For details, see
[microsoft/vscode-remote-release#11672](https://github.com/microsoft/vscode-remote-release/issues/11672).

### SSH host key verification fails

VS Code can leave duplicate or malformed `Host *.sbx` blocks in your SSH
config after you add an SSH host. If a VS Code connection reports a
`KnownHostsCommand` error or `Host key verification failed`, remove every SSH
config block marked `docker sandboxes (managed)`, including the marker
comments:

```diff
-# >>> docker sandboxes (managed) >>>
-Host *.sbx
-    User _default_user_
-    ProxyCommand "sbx" ssh proxy %n
-    ...
-    UserKnownHostsFile "~/.ssh/sbx_known_hosts"
-    KnownHostsCommand "sbx" ssh known-hosts %H
-    StrictHostKeyChecking yes
-# <<< docker sandboxes (managed) <<<
```

Then regenerate the managed block:

```console
$ sbx setup ssh
```

Reconnect to the sandbox from VS Code.

## Related

- [Editor and app integrations](/ai/sandboxes/integrations/vscode/) — how SSH access works and how to
  set it up

<!-- page: https://docs.docker.com/ai/sandboxes/mcp-gateway/ fetched 2026-10-08 -->

# MCP gateway


This page describes the local MCP gateway. Cloud sandboxes use MCP servers
configured in Docker Agentic Platform: see
[Load an MCP server](/ai/sandboxes/mcp-gateway/cloud/usage/#load-an-mcp-server).

Docker Sandboxes includes an MCP gateway for connecting agents to Model Context
Protocol servers. The gateway gives the agent inside the sandbox one MCP
endpoint, while `sbx` manages the registered servers, OAuth credentials, and
sandbox lifecycle on the host.

This is different from configuring an MCP server directly in an agent such as
Claude Code. Direct MCP setup configures that agent's own MCP client. With
Docker Sandboxes, you register MCP servers once on the host, and the sandbox
gateway exposes them to supported agents inside isolated sandboxes. That
host-managed gateway provides a single path for credentials, explicit server
loading, live updates, and organization governance.

> [!NOTE]
> The Docker Sandboxes MCP gateway is separate from the Docker Desktop MCP
> Toolkit. You don't need the Docker Desktop MCP Toolkit to use `sbx mcp`, and
> MCP Toolkit server settings aren't shared with Docker Sandboxes.

## Prerequisites

- Sign in with `sbx login`.
- Use an agent integration that configures MCP at startup: Claude Code, Codex,
  Devin, Gemini, Kiro, or OpenCode.
- For remote servers that require OAuth without Dynamic Client Registration,
  register an OAuth client with the server provider.
- For `--local --url` registrations that resolve to OCI packages, use a host
  with Docker installed and running. Docker is also required for explicit
  `--command docker ...` registrations.

## Quick start

Start by registering one MCP server on the host:

```console
$ sbx mcp add notion --url https://mcp.notion.com/mcp
```

If the server requires OAuth, `sbx` opens an authorization flow before it stores
the registration. After registration, verify that the server is registered:

```console
$ sbx mcp ls
NAME                 TYPE     URL/COMMAND
notion               remote   https://mcp.notion.com/mcp
```

Then start a sandbox and expose the registered server:

```console
$ sbx run claude --name mcp-demo --static-mcp notion
```

The sandbox starts with an MCP gateway and pre-loads the `notion` server. The
registration remains on the host and can be reused by other sandboxes.

## Register an MCP server

`sbx mcp add` registers an MCP server by name. The registration records the
server definition on the host. It doesn't attach the server to a sandbox by
itself. To expose a registered server to a sandbox, pass it with
[`--static-mcp`](#use-static-mode) when you create the
sandbox, or use [`sbx mcp load`](#add-a-server-to-a-running-sandbox) for a
sandbox that's already running.

Server names can contain letters, numbers, dots, hyphens, and underscores.

The `--url` flag can point to different kinds of input. The execution location
depends on what you register:

- A remote endpoint URL identifies a running MCP server. The server runs
  remotely, and the sandbox gateway connects to it.
- A metadata URL with `--local` returns a registry entry, `server.json`, or
  `server.yaml` that describes an OCI-packaged stdio server. `sbx` resolves the
  image and runs it on the host with Docker.
- An explicit command runs on the host as a stdio MCP server.

Local stdio servers run on the host, not inside the sandbox. The agent inside
the sandbox connects only to the MCP gateway.

If a `--url` hostname resolves to a private, loopback, link-local, or cloud
metadata address, `sbx` registers the server but warns you about the resolved
address. Register only URLs you trust. Fetching a manifest from an untrusted
URL can expose internal services or cloud metadata, and DNS rebinding can
redirect a hostname after it has been checked.

OAuth metadata discovery also warns and continues when it encounters these
addresses, including redirect destinations.
For a trusted internal server, pass `--skip-ssrf-check` to skip both the MCP
URL check and the OAuth metadata discovery checks and suppress their warnings.
Use the flag only when you trust the MCP host, OAuth provider, and all metadata
redirect destinations.

### Remote endpoint URL

For a remote MCP endpoint, pass the server URL:

```console
$ sbx mcp add notion --url https://mcp.notion.com/mcp
$ sbx mcp add linear --url https://mcp.linear.app/mcp
```

If requests to a remote server stall, see
[MCP server streams stall](/ai/sandboxes/mcp-gateway/troubleshooting/#mcp-server-streams-stall).

#### Custom request headers

Use `--header 'Name: value'` to send custom HTTP headers to a remote MCP
endpoint, for example to authenticate with an API key. Repeat the flag for
each header, using each header name once:

```console
$ sbx mcp add acme --url https://mcp.acme.com/mcp \
  --header 'Authorization: Bearer ${api-key}' \
  --header 'Accept: application/json, text/event-stream'
$ sbx secret set mcp:acme:api-key
```

Replace the example URL with your MCP endpoint. The `sbx secret set` command
prompts for the API key and stores it in the
[host credential store](/ai/sandboxes/mcp-gateway/configuration/credentials/#where-secrets-are-stored).
The `${api-key}` placeholder stays in the registration. When a sandbox
connects, the gateway reads the secret and substitutes its value in the header.
Use single quotes around header values so your shell preserves placeholders.
Placeholders name stored secrets, not environment variables: `${api-key}`
reads `mcp:acme:api-key`, regardless of your shell environment.

Store each placeholder with `sbx secret set mcp:<server>:<placeholder>`.
Credential headers such as `Authorization` must use a secret placeholder.
An explicit `Authorization` header takes precedence over an OAuth access token.

After storing the secret, expose the server to a sandbox:

```console
$ sbx run claude --name acme-demo --static-mcp acme
```

Custom headers require a remote HTTP endpoint and can't be used with
`--command` or `--local`. They also require the host to connect to the server.
The hosted gateway rejects these registrations unless you supply
`--oauth-authorization-server`, which routes the connection through the host.

#### Manage header secrets

Header secrets use the global scope on the host. Set them with
`sbx secret set mcp:<server>:<placeholder>` without `--sandbox`.
Header secrets require a stored value and don't support `--ref` or `--command`
dynamic sources.
To check the header templates and whether their secrets are set, run
`sbx mcp inspect acme`. The command doesn't display resolved secret values.

The secret store also contains an automatically managed `:endpoint` record,
such as `mcp:acme:api-key:endpoint`. This metadata binds the secret to the
registered server's URLs so the gateway can detect an endpoint change before
sending the secret. You don't need to set this record yourself. If you change
the server's endpoint, follow the CLI guidance to set the secret again for
that endpoint.

To rotate a header secret, run `sbx secret set` with the same name. After
setting, changing, or removing a header secret, stop and restart the sandbox
or restart `sandboxd` to apply the change to an existing gateway. An existing
connection keeps its previous value, and a server skipped because its secret
was missing isn't retried automatically.

Removing a registration with `sbx mcp rm` keeps its header secrets and prints
commands to remove them. To remove the example secret:

```console
$ sbx secret rm mcp:acme:api-key
```

### Local stdio server

Some MCP servers communicate over stdio instead of exposing a remote HTTP
endpoint. Use a local stdio server when `sbx` should launch the MCP server on
the host. You can provide a metadata URL or an explicit command.

#### From registry or manifest metadata

Use `--local --url` when you have an MCP community registry URL or a URL that
returns a `server.json` or `server.yaml` document. The registry entry or
manifest must describe an OCI package that uses stdio transport. `sbx` doesn't
launch non-OCI package types, such as `npm`, from metadata. To use those
servers, register an explicit command.

This path resolves the image from the metadata and starts it on the host with
Docker, so Docker must be installed and running on the host.

```console
$ sbx mcp add fetch --local \
  --url https://registry.modelcontextprotocol.io/v0/servers/fetch-mcp/versions/latest
```

If the entry doesn't publish an OCI stdio package, `sbx` rejects the
registration instead of starting it locally.

A server manifest describes the MCP server package and how to start it. It can
be hosted on a GitHub raw URL, internal HTTP server, or CDN.

```console
$ sbx mcp add opine --local --url https://example.com/mcp/opine/server.yaml
```

#### From an explicit command

Use `--command` when you already know the executable and arguments, or when you
need custom Docker flags. The command can be a package runner such as `npx` or
a Docker container command:

```console
$ sbx mcp add playwright --command npx --args @playwright/mcp@latest
$ sbx mcp add local-image-server --command docker \
  --args "run,-i,--rm,your/image"
```

To set the working directory for the host process, pass `--dir`. This flag is
only valid with `--command`:

```console
$ sbx mcp add local-fs --command node --args server.js --dir /srv/data
```

Use registry or manifest metadata when you have a published server definition
and don't need to customize `docker run`. Use `--command` for local
development, private servers, or custom container flags.

> [!WARNING]
> Local stdio servers run on the host, outside sandbox isolation. If the command
> starts a Docker container, that container uses host Docker isolation, not
> sandbox isolation. The process or container can access host files, host
> network resources, and credentials made available to it. Use trusted commands
> and images, and avoid mounting host paths or passing credentials unless the
> server needs them.

## Authorize OAuth-backed servers

If a registered remote server requires OAuth, `sbx mcp add` starts the
authorization flow by default:

```console
$ sbx mcp add notion --url https://mcp.notion.com/mcp
Resolving MCP server "notion"...
Open this URL to authorize MCP server "notion":
https://api.notion.com/v1/oauth/authorize?...
MCP server "notion" authorized
MCP server "notion" registered (type: remote)
```

OAuth credentials stay on the host. In local gateway mode, `sbx` stores tokens
in the host operating system's credential store.

To register an OAuth-backed server without authorizing it, pass `--skip-auth`:

```console
$ sbx mcp add notion --url https://mcp.notion.com/mcp --skip-auth
```

### Use a pre-registered OAuth client

In local gateway mode, you can register a remote OAuth server that doesn't
support Dynamic Client Registration. If the server publishes OAuth metadata,
pass the client ID that you registered with the server provider:

```console
$ sbx mcp add slack --url https://slack.example.com/mcp \
  --client-id <CLIENT_ID>
```

If the server doesn't publish OAuth metadata, pass
`--oauth-authorization-server` with the client ID. The flag accepts a local
file path or an HTTP or HTTPS URL to an RFC 8414 authorization server metadata
document. The document must define `authorization_endpoint` and
`token_endpoint`:

```console
$ sbx mcp add serverx --url https://mcp.serverx.example/mcp \
  --oauth-authorization-server ./serverx-authorization-server.json \
  --client-id <CLIENT_ID>
```

These flags are only valid with `--url`.

For a confidential OAuth client, store the client secret before registering
the server. There is no `--client-secret` flag:

```console
$ sbx secret set mcp:slack:client_secret
$ sbx mcp add slack --url https://slack.example.com/mcp \
  --client-id <CLIENT_ID>
```

The client secret stays in the host credential store and isn't
written to the MCP registration. If the server requires a confidential client
and no secret is stored, registration succeeds but authorization is skipped.
Store the secret, then run `sbx mcp auth <server>`.

MCP OAuth client secrets use the name `mcp:<server>:client_secret`. The store
also maintains a `mcp:<server>:client_secret:identity` record that binds the
secret to the OAuth client. For secrets stored by a version that used
`mcp:<server>.client_secret`, set the secret again using the colon-separated
name.

### Set OAuth scopes

Use the repeatable `--scope` flag to record the default scopes requested during
authorization:

```console
$ sbx mcp add serverx --url https://mcp.serverx.example/mcp \
  --scope read --scope write
```

The `sbx mcp auth` command accepts `--scope` to override the recorded defaults
for one authorization:

```console
$ sbx mcp auth serverx --scope read
```

Unless you pass `--no-scope`, `sbx` requests the first available scope set in
the following order:

1. Scopes passed to `sbx mcp auth --scope`
2. Default scopes recorded by `sbx mcp add --scope`
3. Scopes that the protected resource says it requires
4. Whichever of `openid`, `email`, `profile`, and `offline_access` the
   authorization server advertises

If none of these provide a scope set, `sbx` omits the OAuth `scope` parameter so
the authorization server applies its default grant. Other advertised scopes
aren't included in the fallback.

When `sbx` uses recorded defaults or resource-required scopes, it also
requests `offline_access` if the authorization server advertises it. The
server can then issue a refresh token, so you don't have to authorize again
when the access token expires. Scopes passed to `sbx mcp auth --scope` are
requested exactly as given, without `offline_access`. Existing credentials
issued without a refresh token aren't upgraded; run `sbx mcp auth` again to
request a new grant.

Pass `--no-scope` to suppress the recorded defaults, resource-required scopes,
and advertised scope fallback for one authorization, without changing the
stored defaults:

```console
$ sbx mcp auth serverx --no-scope
```

You can't combine `--no-scope` with `--scope`. Scopes you choose are checked
against the authorization server's advertised scopes and the resource's
required scopes. If either source publishes scopes, a scope present in neither
produces a warning but is still requested. The authorization server can still
refuse an advertised scope for a particular
client. For a local authorization flow that requested scopes, `sbx` lists the
requested, advertised, and refused scopes and suggests a retry command. If the
server identifies the refused scopes, the command removes them. Otherwise, it
uses `--no-scope`.
`sbx` never retries automatically.

For each OAuth-backed remote server exposed to a sandbox, the gateway exposes a
helper tool named `<server>-authorize`, such as `notion-authorize`. The agent can
call the tool to authorize or reauthorize the server. If the server isn't
authorized, the helper is the only tool exposed for that server.

You can manage OAuth credentials from the host:

```console
$ sbx mcp auth status notion
$ sbx mcp auth notion
$ sbx mcp auth rm notion
```

Use `--all` to apply `auth`, `auth status`, or `auth rm` to all registered
OAuth-backed servers. The `auth status` output reports the scopes granted by the
authorization server, the defaults recorded with `sbx mcp add --scope`, and the
scopes the server supports. It collapses duplicate scope names and highlights
granted scopes that weren't requested or are no longer in the supported set.
Use `--json` for machine-readable output:

```console
$ sbx mcp auth status notion --json
```

## Choose an MCP mode

Every sandbox starts an MCP gateway. When the sandbox starts, supported agent
integrations read the gateway URL and register it with the agent.

Whether you pass `--static-mcp` when you create the sandbox determines its MCP
mode:

- Static mode pre-loads the specified servers and doesn't expose dynamic
  discovery tools to the agent.
- Dynamic mode pre-loads no servers and lets the agent find and attach
  registered servers.

This choice persists across sandbox restarts.

### Use static mode

Pass `--static-mcp` to pre-load registered MCP servers:

```console
$ sbx mcp add notion --url https://mcp.notion.com/mcp
$ sbx mcp add linear --url https://mcp.linear.app/mcp
$ sbx run claude --name my-session --static-mcp notion,linear
```

You can pass `--static-mcp` as a comma-separated list or repeat the flag:

```console
$ sbx run claude --name my-session \
  --static-mcp notion --static-mcp linear
```

Every name in the static set must already be registered with `sbx mcp add`. The
gateway doesn't expose `mcp-find`, `mcp-add`, or `mcp-config-set` to the agent.

You can't replace the initial set by passing `--static-mcp` when reconnecting to
an existing sandbox. To attach another server from the host, use
[`sbx mcp load`](#add-a-server-to-a-running-sandbox).

### Use dynamic mode

Omit `--static-mcp` to use dynamic mode. The gateway pre-loads no servers and
exposes `mcp-find`, `mcp-add`, and `mcp-config-set` to the agent. The agent can
search the registered server catalog and attach servers during the session.

If you run `sbx mcp add` after a dynamic sandbox starts, its gateway refreshes
the searchable catalog. The agent can then find and attach the new registration
without restarting. The `sbx mcp add` command doesn't attach the server by
itself.

## Add a server to a running sandbox

To attach an already-registered server to a running sandbox, use
`sbx mcp load`. This works in both static and dynamic modes:

```console
$ sbx mcp add linear --url https://mcp.linear.app/mcp
$ sbx mcp load linear --sandbox my-session
MCP server "linear" loaded into sandbox "my-session" (live)
```

Connected agent sessions receive a tool-list update, so the added tools become
visible without reconnecting. The loaded server remains attached across sandbox
restarts.

## Built-in gateway tools

The local MCP gateway exposes a small set of built-in tools. These tools belong
to the gateway itself, not to a registered MCP server. Agents can see and call
them on the same MCP connection as server tools, so they can appear in agent
tool lists, logs, policy decisions, audit logs, or approval prompts.

You don't need to call these tools directly for normal setup. Use `sbx mcp`
commands to register servers and manage credentials from the host. The tools
matter because agents can call them during a session, and admins can govern
them separately from tools provided by registered MCP servers.

| Tool                 | Description                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `mcp-exec`           | Executes a tool by name through the gateway.                                               |
| `code-mode`          | Creates an ephemeral JavaScript tool that can call selected tools through the MCP gateway. |
| `mcp-find`           | Searches the registered server catalog without changing sandbox state. Dynamic mode only.  |
| `mcp-add`            | Attaches a registered server to the sandbox. Dynamic mode only.                            |
| `mcp-config-set`     | Sets per-session configuration overrides for an attached server. Dynamic mode only.        |
| `<server>-authorize` | Starts or restarts OAuth authorization for an exposed OAuth-backed remote server.          |

Servers attached with `mcp-add` remain attached across sandbox restarts. The
gateway exposes `<server>-authorize` for OAuth-backed remote servers, even when
they already have a valid token. Local stdio servers don't expose this helper.
If `code-mode` creates a generated tool, the tool is shared by clients connected
to the sandbox's gateway and disappears when the gateway is replaced or stops.

In MCP access policies, built-in gateway tools are `MCP::Primordial` resources
and use the `invokePrimordial` action. Tools from registered MCP servers are
`MCP::Tool` resources and use the `invokeTool` action. For details, see the
[MCP policy reference](/ai/sandboxes/mcp-gateway/governance/reference/mcp-policy/).

## Manage registrations

List registered servers:

```console
$ sbx mcp ls
```

Inspect a registered server:

```console
$ sbx mcp inspect notion
```

Remove a registered server:

```console
$ sbx mcp rm notion
```

For OAuth-backed servers, `sbx mcp rm` removes the OAuth access token before it
removes the server registration. A client secret for a pre-registered OAuth
client and its identity binding remain in the host credential store so you can
reuse them when you re-add the same client. The command prints the
`sbx secret rm` commands for removing them. To remove only the OAuth access
token, use `sbx mcp auth rm`.

## Governance

Organizations with AI Governance can use
[MCP access policies](/ai/sandboxes/mcp-gateway/governance/access-controls/mcp/) to control MCP server
registration, tool calls, gateway meta-tools, resources, prompts, and approval
requirements. MCP access policies are organization policies written in Cedar.

<!-- page: https://docs.docker.com/ai/sandboxes/release-notes/ fetched 2026-10-08 -->

# Docker Sandboxes release notes


This page lists changes in recent stable releases of Docker Sandboxes. For
the full release history, including pre-releases and downloads, see the
[Docker Sandboxes releases on GitHub](https://github.com/docker/sbx-releases/releases).

<!-- BEGIN GENERATED RELEASES -->

## 0.47.0

<em class="text-gray-400 italic dark:text-gray-500">2026-10-05</em>


[GitHub release](https://github.com/docker/sbx-releases/releases/tag/v0.47.0)

### Highlights

Docker Sandboxes v0.47.0 adds automatic cleanup after agent sessions with `sbx run --rm` and a kit capability for keeping local sandboxes running after sessions disconnect.

### What's new

#### Security

- Fixed OAuth token interception when a provider hostname uses different capitalization or a trailing dot, preventing real tokens from reaching the sandbox instead of the proxy's placeholders.
- The proxy rejects unrecognized OAuth token grants and prevents their responses from replacing host-managed credentials. Supported in-sandbox sign-in flows remain available.
- The proxy returns an error when it cannot safely mask a successful Anthropic API-key creation response, instead of forwarding the unmasked response to the sandbox.
- Included since v0.46.0: fixed raw TCP connections to denied hostnames being permitted by an allow rule for the hostname's resolved IP address. This fix applies to TCP; the related UDP case with multiple tracked hostnames remains outside its scope.
- Included since v0.45.0: CLI-created cloud hostname allowlists no longer gain implicit `0.0.0.0/0` and `::/0` rules. Existing stored policies are unchanged; remove those rules or recreate the policy to apply the restriction. Explicit IP and CIDR allowances remain supported.
- The proxy rejects TLS handshakes that fill its inspection buffer before a complete ClientHello can be checked on a non-MITM CONNECT tunnel or during the transparent proxy's late handshake check.
- The proxy closes incomplete TLS handshakes on those paths after a two-minute timeout instead of retaining the connections for the sandbox's lifetime.
- Sandboxes reject UDP to multicast, link-local, and unspecified destinations, limited broadcast, and broadcast addresses derived from the host's interface prefixes, regardless of network policy. UDP to `host.docker.internal` is unaffected. Broadcast addresses configured outside that derivation and networks reachable only through routes are not covered by this check.
- Kit pulls enforce limits on registry-declared blob sizes, decompressed content, and archive entry counts.

#### Sandbox lifecycle and workspaces

- `sbx run --rm` removes a local or cloud sandbox after its agent session ends. It cannot be combined with `--detached`. If a cloud session is interrupted, such as by a dropped connection, the sandbox is kept and the CLI prints the command to remove it.
- Running `sbx run -d` against an existing local sandbox keeps it running after sessions disconnect, until you stop or remove it.
- Dynamic mounts and permissions created through symlink paths can be removed without reappearing after a restart. Incompatible saved records include recovery guidance.

#### Kits

- Local kit inspection, validation, and pulling require the daemon to be running.
- Kits can declare `com.docker.sandbox/long-running@1` to keep local sandboxes running after all sessions disconnect. Cloud sandboxes and `sbx kit add` cannot provide this capability: required entries are rejected, and optional entries are skipped.
- `sbx kit sign` and `sbx kit push --sign` succeed on registries that refuse manifest deletion, including GitHub Container Registry and Docker Hub, instead of reporting failure after attaching the signature.
- Adding a kit to a sandbox whose guest has stopped responding fails without leaving the sandbox unusable until the daemon restarts.

#### Cloud sandboxes

- `sbx --cloud ttl` reports stopped sandboxes as stopped instead of expired. The time-to-live restarts when the sandbox resumes. JSON output includes `stopped` and `ttl_paused`; while the sandbox is resuming, only `ttl_paused` is true.
- Creating a cloud sandbox or moving a local sandbox to the cloud applies cloud policy and the kit's network rules without copying locally added network rules. Moving a sandbox with local HTTP method or path restrictions warns that those restrictions will not apply in the cloud.

#### Settings and proxies

- Upstream proxy recovery no longer blocks unrelated sandboxes or deletes isolated container data when credentials are unavailable. Local host services remain reachable.
- `sbx settings set` rejects invalid upstream proxy values before saving them.

#### MCP

- MCP authorization requests `offline_access` when the server advertises it and authorization uses saved defaults or resource-required scopes, so the server can issue refresh tokens. Explicit `--scope` values are unchanged. Run `sbx mcp auth` again to obtain a grant with a refresh token for existing credentials.
- Fixed MCP gateway availability in sandboxes created from the TUI and when connecting over SSH after a daemon restart or automatic sandbox creation.

#### CLI and updates

- `sbx env` reports the correct file, line, and column for unrecognized keys even when another entry in the file fails custom validation. Multiple validation errors appear on separate lines.
- Help remains available when the settings directory is unwritable or local settings cannot be opened, with a warning instead of a panic.
- Host-port collisions from `sbx ports --publish` identify the occupied binding and offer a retry with an automatically allocated port when safe.
- Windows update notices appear only after WinGet confirms that the version is available in its catalog.
<!-- release-notes:end -->

## 0.46.0

<em class="text-gray-400 italic dark:text-gray-500">2026-09-28</em>


[GitHub release](https://github.com/docker/sbx-releases/releases/tag/v0.46.0)

### What's new

#### Breaking changes

- Secret commands configured with `sbx secret set --command`, `sbx secret set-custom --command`, or `secrets.<name>.command` in an environment file execute from a fresh temporary directory on the host. Relative paths such as `./credential-helper` no longer resolve from the project directory or the directory where you ran `sbx`. Store helpers and their dependencies outside writable sandbox mounts. Run helpers by name from an absolute directory on the host's `PATH`, use absolute paths, or explicitly change to their private directory in the command. For existing environments that declare secret commands, the next `sbx env run` asks you to approve a one-time plan change for the working directory. The execution change takes effect after upgrading and restarting the daemon, even before you approve that plan.

#### Cloud sandboxes

- `sbx --cloud create --on-timeout restart` accepts `restart` as the timeout action. When the sandbox reaches its time limit, it stops and immediately restarts instead of remaining stopped.
- `sbx --cloud create` passes `--kit-arg` and `--kit-args-file` values to kits supplied with `--kit`.

#### Kits and skills

- Kits can install files in the agent's skills directory when shared skills are read-only. The shared skills store remains read-only, while kit installation and startup commands can write their own skills without a read-only filesystem error.
- Kits added through the runtime API retain their network rules and applicable agent instructions when another kit addition recreates the sandbox container.
- `sbx kit add` warns if it cannot save the updated sandbox record. The warning explains which kit settings could be lost and whether a daemon restart or another container replacement would cause the loss.

#### Agents and models

- The local model server starts and stops with the Docker Sandboxes daemon and downloads its llama.cpp runtime when the daemon starts. The macOS and Windows bundles include llmman v0.1.418, which manages the runtime download instead of relying on a separately bundled `llama-server`.
- Image paste in WSL2 falls back to the Windows clipboard when Linux clipboard tools return no image. Requires `clipboard.imagePaste` to be enabled.

#### Sandbox lifecycle and workspaces

- Fixed a shutdown bug affecting templates that use dash as `/bin/sh`, including the built-in Ubuntu-based templates. The shutdown handler forwards `SIGTERM` correctly, giving sandbox processes a chance to exit gracefully instead of waiting five seconds for a forced shutdown.
- On Linux arm64 hosts, the default CPU allocation is capped at 16 CPUs per sandbox. This fixes startup failures with `VM did not connect within 15s` when several sandboxes start together on hosts with many CPU cores. Use `--cpus` to request a larger allocation.
- `sbx umount` can remove a saved mount from a stopped sandbox using the original host path even after that directory has been deleted.
- On macOS, mounting, unmounting, and restoring saved mounts consistently recognize host paths whose capitalization differs.
- If the runtime fails to mount the workspace, sandbox startup reports the mount failure and points to the daemon log for the cause instead of reporting a generic container startup error.
- Starting a second daemon against a state directory already in use fails with an error instead of disrupting the running daemon.
- `sbx reset` stops background feature-flag updates and log writes before deleting local state, preventing leftover files and recreated directories. On Windows, it also closes daemon log files before deleting them to avoid cleanup retries caused by open file handles.

#### Authentication and credentials

- Removing secrets in bulk revokes credentials from running sandboxes. Failed revocations can be retried even after the stored secrets have been deleted.

#### Networking and policy

- Sandboxes created with the `balanced` network policy preset can download Playwright browser binaries from `cdn.playwright.dev` over HTTPS. Existing sandboxes keep their saved policies. To use the updated preset, create a new sandbox with the `balanced` network policy.

#### CLI and diagnostics

- `sbx env` reports unrecognized environment-file keys with the file, line, and column where they were declared, including when multiple files are merged.
- Canceling a batch `sbx rm` or `sbx stop` stops processing the remaining sandboxes instead of printing a cancellation error for each one.
- `sbx diagnose --upload` returns a non-zero exit status if the requested diagnostics upload fails, so scripts can detect the failure.
- `sbx diagnose` reports the socket-path length limit used by the container runtime as `runtime_socket_limit_bytes` and clarifies the meaning of the reported socket-path values.

#### Packaging and installation

- Windows MSI installations include `llmman` and the guest kernel, fixing local model serving with `sbx run --model` and sandbox launches that failed with `No kernel specified`.
- Uninstalling Docker Sandboxes through the Windows MSI stops the daemon.
- Fixed the Linux static tarball failing to start on distributions with older glibc versions. The tarball is built against glibc 2.34.

## 0.45.1

<em class="text-gray-400 italic dark:text-gray-500">2026-09-22</em>


[GitHub release](https://github.com/docker/sbx-releases/releases/tag/v0.45.1)

### Fixes and improvements

- Improved sandbox moves and support for private kit images in cloud sandboxes.

## 0.45.0

<em class="text-gray-400 italic dark:text-gray-500">2026-09-21</em>


[GitHub release](https://github.com/docker/sbx-releases/releases/tag/v0.45.0)

### Highlights

#### Compose reusable environments with v3 kits

Docker Sandboxes now supports v3 kits: OCI-based packages that combine an agent workload with reusable mixins for tools, configuration, credentials, network access, and agent instructions. Compose compatible kits directly when creating a sandbox, or publish the combination as a kit set that your team can run from a single reference.

V2 kits remain supported for built-in agents and existing customizations. V3 workloads and mixins must be used together; they can't be combined with v1 or v2 kits. [Learn more about kits](https://docs.docker.com/ai/sandboxes/customize/).

#### Run agents in cloud sandboxes

Run AI agents on Docker-managed cloud infrastructure with `sbx --cloud`. Cloud support is experimental and requires an active Docker Agentic Platform subscription. See [Get started with cloud sandboxes](https://docs.docker.com/ai/sandboxes/cloud/).

### What's new

#### Breaking changes

- `sbx mcp catalog` has been removed. To authorize a remote MCP server, register it with `sbx mcp add` before running `sbx mcp auth`.
- `sbx secret rm` now returns an error on stderr when the requested secret doesn't exist.
- `sbx mcp rm` now returns an error when the requested MCP server isn't registered.

#### Security

- Fixed an issue where revoking a sandbox's OAuth or API-key credential could leave its running proxy authorized until the sandbox was recreated.

#### Kits

- V3 kits introduce separate workload and mixin roles. A workload supplies the base environment and command to run; mixins add tools, configuration, and runtime behavior. Dependencies and compatibility declarations determine composition order.
- Kit sets let authors combine a workload and mixins, pin their component versions, and publish the result as a single OCI reference. Sets can also add capabilities, lifecycle hooks, instructions, and arguments of their own.
- V3 kits can scope network access by HTTP method and path, declare install-phase network access and credential use, and specify where an agent reads shared skills.
- Multiple OAuth-backed agents can be composed in the same sandbox with credentials scoped to the kits that request them.
- HTTP Basic credentials declared by a kit now produce the expected `Authorization: Basic` header. Composition fails when kits declare conflicting ownership of a Basic-auth service instead of silently dropping the username.
- `sbx kit validate` now rejects malformed API-key declarations, including invalid names, missing injection domains, invalid format placeholders, and Basic-auth usernames containing a colon. It also warns about declarations that have no effect or target domains outside the kit's network allowlist.
- Reusing an unchanged local kit no longer rebuilds its composed image.
- Adding a mixin to an existing sandbox through the daemon API now writes the mixin's agent instructions as expected.

#### Agents and models

- `sbx run --model` can use any OpenAI- or Anthropic-compatible endpoint configured in the new `model.providers` setting.
- `sbx run opencode --model` now exposes the model's supported thinking levels as OpenCode variants, selectable with <kbd>Ctrl</kbd>+<kbd>T</kbd>.
- The OpenCode kit now configures GitHub Copilot from the account's stored GitHub credential, so Copilot models work without a separate device login.
- Codex sandboxes now install Codex with its native installer instead of npm.

#### CLI and output

- MCP server, secret, skill, template, volume, and policy-profile list commands now support `--quiet` (`-q`) for name-only output.
- List commands now use consistent table formatting, and errors use a consistent format with clearer recovery guidance.
- Commands that remove resources now ask for confirmation. Use `--force`, or `--yes`/`-y` for `sbx kit builder history rm`, in non-interactive workflows. Declining a destructive-action or required-restart prompt now returns a non-zero exit code.
- Running `sbx secret rm` without a service opens a picker showing existing local secrets and their scope, type, and name.
- Unsupported detached execution with `sbx exec -d` or `--detach` now fails immediately instead of running in the foreground.
- `sbx settings` now appears in `sbx --help` and the CLI reference.
- `sbx ls --json` now includes `created_at`. `sbx ls --json` and `sbx inspect --json` also report recorded CPU and memory limits for local sandboxes.
- The updater no longer asks to switch channels when the requested version is already installed.
- `sbx env rm` now warns about data loss for a cloned workspace before asking for confirmation.
- `sbx logout` no longer warns about stopped sandboxes when the daemon isn't running.

#### Sandbox lifecycle and workspaces

- Sandboxes now recover when the guest kernel crashes instead of becoming permanently unusable. If a guest stops responding, affected operations fail with an explanation, held proxy connections are released, and `sbx ls` and `sbx inspect` report the unresponsive state.
- Dynamic mounts are restored after a sandbox restart. Startup fails clearly if a saved mount can't be restored, and `sbx umount` can remove a saved mount while the sandbox is stopped. A missing unmount target no longer disrupts existing mounts.
- Clone-mode sandboxes restore their host Git remotes on every restart, preserve complete remote configuration during concurrent lifecycle operations, and provide recovery instructions if configuration fails.
- Newly created or recreated sandboxes have a writable `/etc/hosts` file.
- Image pulls retry transient registry network failures before sandbox creation fails.
- Cached-image recovery is reported as successful without also showing a registry error, and mount-policy evaluation failures are distinguished from access denials.
- Container swaps remove obsolete registry-mirror allowances even if saving the previous swap state fails.
- Updated containerd to fix image layers being dropped.

#### Authentication and credentials

- Adding, updating, or removing global service secrets now updates existing local sandboxes without a restart while preserving sandbox-specific credentials. Sandbox-scoped command and reference secrets also take effect immediately.
- Registry and service-secret revocation failures are now reported and can be retried, including after a stored OAuth token has been deleted.
- OAuth refreshes are coordinated across sandboxes that share credentials, preventing simultaneous refreshes from forcing another sign-in.

#### Networking and policy

- Network policy now treats hostnames with a trailing dot the same as their canonical form for routing, interception, credential injection, and `host.docker.internal` handling. The policy log also records cleartext HTTP requests whose `Host` header differs from the connection destination.
- Experimental outbound UDP now follows sandbox network policy. New local allow rules cover TCP by default; select UDP explicitly with `--protocol` in the CLI or the TCP+UDP option in the TUI. UDP is refused when the destination requires an HTTP, SOCKS5, system, or PAC-selected proxy, because those proxies can't carry it.
- Reverse-DNS lookups are now allowed only for destination IPs already authorized by policy, including IP, CIDR, and allow-all rules. This closes the previous policy bypass without blocking PTR lookups for permitted addresses.
- DNS resolution is no longer allowed when no network rule permits it.
- Connections allowed only by a CIDR rule no longer wait for hostname detection before connecting, improving protocols such as SSH where the server speaks first.
- Network and filesystem access now fail closed with accurate errors when policy evaluation fails, governance can't be resolved, a policy snapshot is stale, or a request is malformed.
- `sbx policy allow network`, `sbx policy deny network`, `--allow-network`, and `--deny-network` now reject malformed patterns before saving them.
- `sbx policy ls` now shows how each rule was created and supports filtering with `--created-via`.
- Fixed excessive daemon CPU use caused by reading the settings file for every blocked UDP packet.
- The governance-rules table no longer reserves space for a hidden profile column, keeping host values readable in narrow terminals.

#### MCP

- Fixed gateway creation failures caused by parentheses or other sandbox-ID punctuation in generated gateway names.
- MCP gateways now recover correctly after a daemon restart when using `sbx exec` or `sbx env run`.
- Internal MCP discovery and OAuth informational logs no longer appear in normal command output.
- OAuth authorization errors now suggest explicit scopes when the authorization server rejects a request without scopes.
- OAuth metadata discovery for private addresses now warns and continues by default. `--skip-ssrf-check` remains available to suppress the warning for trusted providers and their discovery destinations.
- `sbx mcp add --disable-http2` disables HTTP/2 for a remote MCP transport, providing a workaround for servers whose HTTP/2 handling stalls long-lived streams.

#### Packaging and installation

- macOS distributions now contain a single signed `Sbx.app` bundle. Homebrew and tarball PATH installs continue to work through a symlink into the bundle.

<!-- END GENERATED RELEASES -->

## Earlier releases

For older versions, see the
[Docker Sandboxes releases on GitHub](https://github.com/docker/sbx-releases/releases).

<!-- page: https://docs.docker.com/ai/sandboxes/security/ fetched 2026-10-08 -->

# Security model






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



Docker Sandboxes run AI agents in microVMs so they can execute code, install
packages, and use tools without accessing host resources beyond those you
share. Multiple isolation layers protect your host system.

## Trust boundaries

The primary trust boundary is the microVM. The agent has full control inside
the VM, including sudo access. The VM boundary prevents the agent from reaching
anything on your host except what is explicitly shared.

What crosses the boundary into the VM:

- **Host workspace directory:** shared when you pass a workspace path or use
  `sbx run`, which defaults to the current directory. A direct mount is
  read-write, so the agent edits your working tree in place. With
  [`--clone`](/ai/sandboxes/usage/#clone-mode), your repository is mounted read-only and
  the agent works on a private clone. A mountless sandbox doesn't share a host
  workspace.
- **Credentials:** the host-side proxy injects authentication headers into
  outbound HTTP requests. The raw credential values never enter the VM.
- **Network access:** outbound TCP connections to destinations allowed by
  [network policy](/ai/sandboxes/security/defaults) are proxied through the host.
- Shared agent skills: sandboxes created for supported agents mount a
  persistent host-side store read-only by default at the agent's skills
  directory. Use `--skills` or
  [`skills.defaultMode`](/ai/sandboxes/configuration/settings/#skillsdefaultmode)
  to choose another mode at
  creation. Existing sandboxes retain their mounts until recreated.
- **MCP gateway traffic:** supported agents connect to a host-side MCP gateway
  endpoint. The gateway brokers access to registered MCP servers.

What crosses the boundary back to the host:

- **Workspace file changes:** visible on your host in real time when you use a
  direct mount.
- **Outbound TCP connections:** sent to allowed destinations through the host
  proxy.
- Shared skill changes: sandboxes with `readwrite` access can write to the
  host-side store. These changes are visible to other sandboxes that share it.

Outside the workspace and shared skills store, the agent cannot access your
host filesystem. It also cannot access your host Docker daemon, your host
network directly, or any destination not allowed by network policy. Sandboxes
cannot communicate directly over the network. Outbound UDP is blocked unless
you turn on the [experimental UDP feature](/ai/sandboxes/governance/access-controls/local/#allow-outbound-udp)
and allow it through network policy. ICMP is blocked.

MCP servers are an explicit integration point. Remote MCP servers run outside
Docker Sandboxes, and local stdio MCP servers run on the host, not inside the
sandbox VM. An agent can invoke the tools those servers expose through the MCP
gateway, subject to MCP policies when organization governance is active. Treat
local MCP servers as trusted host integrations.

### MicroVM isolation

This topology shows what is private to the microVM, what is explicitly mounted,
and which host resources remain outside the agent's reach.

Explore the microVM isolation boundary

Select a component or labeled connection to inspect what is private, mounted, or unreachable.



To follow an outbound request through network policy and credential injection,
see [Architecture](/ai/sandboxes/architecture/#follow-an-authenticated-request).

## Isolation layers

The sandbox security model has five layers. See
[Isolation layers](/ai/sandboxes/security/isolation) for technical details on each.

- **Hypervisor isolation:** separate kernel per sandbox. No shared memory or
  processes with the host.
- **Network isolation:** outbound TCP traffic is proxied through the host and
  governed by a [deny-by-default policy](/ai/sandboxes/security/defaults). Experimental UDP egress
  also follows network policy. ICMP is blocked.
- **Docker Engine isolation:** each sandbox has its own Docker Engine with no
  path to the host daemon.
- **Workspace isolation:** a mountless sandbox has no host workspace mount.
  Clone mode gives the agent a private in-VM clone and mounts your repository
  read-only. Direct mode shares your working tree read-write.
- **Credential isolation:** API keys are injected into HTTP headers by the
  host-side proxy. Credential values never enter the VM.

## What the agent can do inside the sandbox

Inside the VM, the agent has full privileges: sudo access, package installation,
a private Docker Engine, and read-write access to its in-sandbox filesystem and
configured workspace. Installed packages, Docker images, and other VM state
persist across restarts. See
[Default security posture](/ai/sandboxes/security/defaults) for the full breakdown of what is
permitted and what is blocked.

## Security considerations

The sandbox isolates the agent from your host system, but the agent's actions
can still affect you through explicitly shared resources and allowed network
channels.

In direct mode, workspace changes are live on your host. The agent edits the
same files you see on your host. This includes files that execute implicitly
during normal development: Git hooks, CI configuration, IDE task configs, AI
project configuration and settings, `Makefile`, `package.json` scripts, and
similar build files. Review changes before running any modified code. Note that
Git hooks live inside `.git/` and do not appear in `git diff` output — check
them separately. See
[Workspace isolation](/ai/sandboxes/security/isolation#workspace-isolation) for the full list and
for the alternative clone-mode boundary.

The default allowed domains include broad wildcards. Some defaults like
`*.googleapis.com` cover many services beyond AI APIs. Run `sbx policy ls` to
see the full list of active rules, and remove entries you don't need. See
[Default security posture](/ai/sandboxes/security/defaults).

Kits run install commands with root privileges inside the sandbox. To limit
supply-chain risk, `sbx` restricts kit installs to an allowlist of sources
that defaults to Docker Hub only. See
[Restrict kit sources](/ai/sandboxes/customize/use-kits/#restrict-kit-sources).

Shared agent skills create a narrow exception to cross-sandbox isolation. The
store can be mounted with `readwrite` access, so one sandbox can modify
instructions or scripts that an agent later uses in another sandbox, including
one with `readonly` access. This doesn't expose the rest of
the host filesystem or create a direct network path between sandboxes, but it
does put participating sandboxes in the same trust boundary. See
[Share agent skills](/ai/sandboxes/workflows/agent-skills/) for details and the
per-sandbox opt-out.

Local stdio MCP servers run outside the sandbox VM. If you register a local MCP
server that starts a host process or host Docker container, that process or
container uses host permissions and host isolation, not sandbox isolation. See
[MCP gateway](/ai/sandboxes/mcp-gateway/).

## Organization-wide control

On a single developer's machine, security and policy are configured locally —
for example, network and filesystem rules set with `sbx policy`. Admins can
move these controls to the organization level so that security, policy, and
access apply consistently across every developer's sandboxes, rather than
depending on local configuration.

See [Governance](/ai/sandboxes/governance) for the controls available to organization
admins.

## Learn more

- [Isolation layers](/ai/sandboxes/security/isolation): how hypervisor, network, Docker,
  workspace, and credential isolation work
- [Default security posture](/ai/sandboxes/security/defaults): what a fresh sandbox permits and
  blocks
- [Manage credentials](/ai/sandboxes/configuration/credentials/): provide and manage API
  keys while keeping their values outside the sandbox
- [Governance](/ai/sandboxes/governance): configure network, filesystem, and MCP access
  controls locally or across your organization

<!-- page: https://docs.docker.com/ai/sandboxes/security/defaults/ fetched 2026-10-08 -->

# Default security posture






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



A sandbox created with `sbx run claude` and no additional flags has the
following security posture.

## Network defaults

All outbound TCP traffic, including HTTP, HTTPS, and SSH, is blocked unless an
explicit rule allows the destination. Outbound UDP is disabled by default. To
use it, turn on the [experimental UDP feature](/ai/sandboxes/security/governance/access-controls/local/#allow-outbound-udp)
and add UDP allow rules. ICMP is blocked. DNS queries use the sandbox's internal
resolver, which enforces network policy.

Run `sbx policy ls` to see the active network rules for your installation.
Rules can be customized per machine with the `sbx policy` CLI, or managed
centrally across your organization. Org-level rules take precedence over local
rules. See
[Network access policies](/ai/sandboxes/security/governance/access-controls/network/).

## Workspace defaults

`sbx run` mounts the current directory when you don't pass a workspace path.
The agent can read, write, and delete any file within that directory, including
hidden files, configuration files, build scripts, and Git hooks.

When you omit the workspace path from `sbx create`, the sandbox doesn't mount a
host workspace. The agent uses the sandbox template's default working
directory. Docker-provided agent templates use `/home/agent/workspace`. If the
template doesn't define a usable absolute working directory, the daemon uses
that path. Files in this directory persist across stops and restarts and are
deleted when you remove the sandbox. See
[Workspace isolation](/ai/sandboxes/security/defaults/isolation/#workspace-isolation) for the available
workspace modes and what to review after a direct-mount session.

## Shared skills defaults

Sandboxes created for supported agents mount a persistent shared skills store
read-only by default. The
[`skills.defaultMode`](/ai/sandboxes/security/configuration/settings/#skillsdefaultmode) setting
can change this default,
and `--skills` overrides it for a sandbox at creation. A sandbox with `readwrite` access can change skills that other
participating sandboxes load, including those with `readonly` access. Use
`--skills=off` when creating a sandbox to omit the shared store. Existing
sandboxes retain their mounts until recreated. See
[Share agent skills](/ai/sandboxes/security/workflows/agent-skills/).

## Credential defaults

No credentials are available to the sandbox unless you provide them using
`sbx secret` or environment variables. When credentials are provided, the
host-side proxy injects them into outbound HTTP headers. The agent cannot
read the raw credential values.

See [Credentials](/ai/sandboxes/security/configuration/credentials/) for setup instructions.

## Agent capabilities inside the sandbox

The agent runs with full control inside the sandbox VM:

- `sudo` access (the agent runs as a non-root user with sudo privileges)
- A private Docker Engine for building images and running containers
- Package installation through `apt`, `pip`, `npm`, and other package managers
- Full read and write access to the VM filesystem

Everything the agent installs or creates inside the VM, including packages,
Docker images, mountless workspace files, and configuration changes, persists
across stop and restart cycles. When you remove the sandbox with `sbx rm`, the
VM and its contents are deleted. Direct-mounted workspace files and the shared
skills store remain on the host, as do repositories used as clone sources.

## What is blocked by default

The following are blocked for all sandboxes and cannot be changed through
policy configuration:

- Host filesystem access outside explicitly mounted workspaces and the shared
  skills store
- Host Docker daemon
- Direct network communication between sandboxes
- Direct external ICMP connections

Outbound TCP to destinations not in the allow list is also blocked by default,
but you can add allow rules with `sbx policy allow`.

<!-- page: https://docs.docker.com/ai/sandboxes/security/isolation/ fetched 2026-10-08 -->

# Isolation layers






This page describes local sandboxes. For cloud behavior and limitations, see
[Compare local and cloud sandboxes](/ai/sandboxes/cloud/local-vs-cloud/).



AI coding agents need to execute code, install packages, and run tools on
your behalf. Docker Sandboxes run each agent in its own microVM. Five
isolation layers protect your host: hypervisor, network, Docker Engine,
workspace, and credential proxy.

## Hypervisor isolation

Every sandbox runs inside a lightweight microVM with its own Linux kernel.
Unlike containers, which share the host kernel, a sandbox VM cannot access host
processes, files, or resources outside its defined boundaries.

- **Process isolation:** separate kernel per sandbox; processes inside the VM
  are invisible to your host and to other sandboxes
- **Filesystem isolation:** a host workspace is shared when you pass a
  workspace path or use `sbx run`, which defaults to the current directory.
  For supported agents that haven't opted out, the dedicated
  [shared skills store](/ai/sandboxes/security/workflows/agent-skills/) is also shared with the
  host. The rest of the VM filesystem persists across restarts but is removed
  when you delete the sandbox. Symlinks pointing outside the workspace scope
  are not followed.
- **Full cleanup:** when you remove a sandbox with `sbx rm`, the VM and
  everything inside it is deleted

The agent runs as a non-root user with sudo privileges inside the VM. The
hypervisor boundary is the isolation control, not in-VM privilege separation.

Processes in a local sandbox can write text to your host clipboard, but can't
read existing clipboard text. Host clipboard image reads are a separate,
opt-in feature. After running untrusted code, check clipboard contents before
pasting them on the host.

## Network isolation

Each sandbox has its own isolated network. Sandboxes cannot communicate
directly with each other or share a network with your host. To reach a service
running on the host through a policy-controlled connection, see
[Accessing host services from a sandbox](/ai/sandboxes/security/workflows/development/#accessing-host-services-from-a-sandbox).

All outbound TCP traffic passes through a proxy on your host that enforces the
[network access policy](/ai/sandboxes/security/governance/access-controls/network/). The sandbox
routes traffic through either a forward proxy or a transparent proxy depending
on the client's configuration. Both enforce the network policy. Only the
forward proxy [injects credentials](/ai/sandboxes/security/configuration/credentials/) for AI services.

Outbound UDP is disabled by default. When you turn on
[experimental UDP egress](/ai/sandboxes/security/governance/access-controls/local/#allow-outbound-udp),
network policy controls its destinations. ICMP is blocked. DNS queries use the
sandbox's internal resolver, which enforces network policy. TCP connections
are allowed only when a policy rule matches the destination.

For the default set of allowed domains, see
[Default security posture](/ai/sandboxes/security/isolation/defaults/). To forward allowed traffic through a
corporate or upstream proxy, see
[Configure an upstream proxy](/ai/sandboxes/security/configuration/upstream-proxy/).

## Docker Engine isolation

Agents often need to build images, run containers, and use Docker Compose.
Mounting your host Docker socket into a container would give the agent full
access to your environment.

Docker Sandboxes avoid this by running a separate [Docker
Engine](/engine/) inside the sandbox environment, isolated from
your host. When the agent runs `docker build` or `docker compose up`, those
commands execute against that engine. The agent has no path to your host Docker
daemon.

This Docker Engine boundary applies to processes running inside the sandbox VM.
It doesn't apply to local stdio MCP servers registered through the
[MCP gateway](/ai/sandboxes/security/mcp-gateway/). Those servers run on the host, outside the
sandbox VM. If a local MCP server starts a Docker container, it uses Docker on
the host.

Each sandbox VM runs its own Docker Engine. The agent runs inside the VM,
alongside that engine, and drives it to create containers, all within the
VM:

```mermaid
flowchart TB
  subgraph host["Host system"]
    subgraph hostd["Host Docker daemon"]
      hc["Your containers and images"]
    end
    subgraph vm["Sandbox (microVM)"]
      a["Agent"]
      subgraph e["Sandbox Docker engine"]
        c["Containers created by agent"]
      end
      a -->|"docker build / compose up"| e
    end
  end
  style host fill:#3b82f622,stroke:#3b82f6
```

## Workspace isolation

When you create a sandbox, choose how the agent receives a workspace:

- **Mountless** (no path to `sbx create`): the sandbox doesn't receive a host
  workspace. The agent works in the sandbox's own filesystem.
- **Direct mount** (a path such as `.`): the agent has read-write access to
  your working tree. There is no boundary between the agent's edits and your
  host filesystem.
- **Clone mode** (`--clone` and a Git path): your repository is mounted
  read-only into the VM and the agent works on a private clone inside the VM.
  The agent's edits never reach your host until you fetch them.

See [Git workflows](/ai/sandboxes/security/workflows/git/) for direct-mount and clone-mode
workflows.

### Mountless

Omit the workspace path from `sbx create` to create a mountless sandbox, then
attach by name:

```console
$ sbx create --name scratch claude
$ sbx run --name scratch
```

The agent uses the sandbox template's default working directory.
Docker-provided agent templates use `/home/agent/workspace`. If the template
doesn't define a usable absolute working directory, the daemon uses that path.
Files there stay within the sandbox, persist across stops and restarts, and are
deleted when you remove the sandbox. A mountless sandbox doesn't expose a host
project directory, but separately configured host resources such as the shared
skills store can still be mounted.

### Direct mount

Pass a workspace path to share it into the VM as a read-write mount. The agent
and the host see the same files, and changes the agent makes appear on your
host as soon as they're written. `sbx run` mounts the current directory when
you don't pass a path:

```console
$ sbx run claude
```

Direct mounts enforce access by path. If a workspace file is a hard link to a
file outside the workspace, the agent can read and modify the underlying file
through the workspace path. Changes affect every hard link to that file,
including links outside the authorized workspace. Filesystem access policies
do not block this access because they evaluate the workspace path rather than
other paths to the same file. [Clone mode](#clone-mode) prevents writes through
the primary workspace by mounting the host repository read-only.

Direct mount gives the agent broad write access to your workspace. The agent
can create, modify, or delete workspace files, including:

- Source code and configuration files
- Build files (`Makefile`, `package.json`, `Cargo.toml`)
- Git hooks (`.git/hooks/`)
- CI configuration (`.github/workflows/`, `.gitlab-ci.yml`)
- IDE configuration (`.vscode/tasks.json`, `.idea/` run configurations)
- AI project configuration and settings (`.claude/`, `.codex/`, `.gemini/`)
- Hidden files, shell scripts, and executables

Some of these files execute code when you trigger normal development
actions — committing, pushing, building, or opening the project in an IDE.
Review them after any agent session before performing those actions:

- Git hooks (`.git/hooks/`) run on commit, push, and other Git actions.
  These are inside `.git/` and don't appear in `git diff` output —
  check them separately with `ls -la .git/hooks/`.
- CI configuration (`.github/workflows/`, `.gitlab-ci.yml`) runs on
  push.
- Build files (`Makefile`, `package.json` scripts, `Cargo.toml`) run
  during build or install steps.
- IDE configuration (`.vscode/tasks.json`, `.idea/`) can run tasks
  when you open the project.
- AI project configuration and settings (`.claude/settings.json`, `.codex/config.toml`,
  `.gemini/settings.json`) can define hooks and startup commands that
  execute automatically.

#### Sandbox environment files

Sandbox environment files can declare lifecycle and credential commands that
run on the host with your privileges. Before running these commands, `sbx`
shows them in an environment plan and asks for approval. Review the plan before
you approve host commands.

For file placement and read-only protection, see
[Sandbox environment files](/ai/sandboxes/security/configuration/environment-files/#workspace).

> [!WARNING]
> Treat sandbox-modified workspace files the same way you would treat a pull
> request from an untrusted contributor: review before you trust them on
> your host.

### Clone mode

When you start a sandbox with [`--clone`](/ai/sandboxes/security/usage/#clone-mode), the agent
never works directly against your host repository. Even with full root
inside the VM, it cannot modify your `.git` directory, your working tree,
or any tracked file on your host.

> [!IMPORTANT]
> Clone mode protects your host repository from modification, **not from
> inspection**. Your repository is still mounted read-only into the sandbox,
> including untracked files and files excluded by `.gitignore`. Files such as
> `.env` remain readable by the agent. Store secrets outside your working
> directory or use [credential isolation](#credential-isolation) instead.

```mermaid
flowchart LR
  subgraph host["Host repository (untouched)"]
    direction TB
    repo[".git/ + working tree"]
    remote["remote sandbox-&lt;name&gt;"]
  end
  subgraph vm["Sandbox VM"]
    direction TB
    mount["/run/sandbox/source<br/>(read-only bind mount)"]
    clone["private clone (RW)<br/>agent edits here"]
    daemon["git-daemon"]
  end
  repo -->|"read-only bind mount"| mount
  mount -->|"git clone"| clone
  clone --> daemon
  daemon -->|"git fetch"| remote
```

How the boundary is enforced:

- Your repository's Git root is mounted at `/run/sandbox/source` as
  read-only. The mount covers your entire working directory, including
  untracked files and files excluded by `.gitignore`. Nothing the agent
  does inside the VM can write back through that mount, but all files
  under the Git root are readable inside the sandbox. This includes
  credential files not tracked by Git, such as `.env`.
- The agent works on a private clone that lives inside the sandbox. The
  clone has its own index, its own refs, and its own working tree. Writes
  to the clone never reach your host.
- The sandbox publishes the clone over a Git daemon bound to localhost on
  the host. The CLI wires it up as a `sandbox-<sandbox-name>` Git remote on
  your host repository. Fetching from that remote uses the same trust
  model as fetching from any third-party remote — nothing is integrated
  until you explicitly merge or check out the fetched refs.

The practical guarantees:

- The agent cannot modify any tracked file or any byte under `.git/` on
  your host. A compromised or buggy agent cannot drop a
  `.git/hooks/pre-commit`, alter `.github/workflows/`, or sneak changes
  into your working tree.
- Concurrent `git` commands on the host and inside the sandbox cannot
  race on a shared `.git/index` or shared refs — there is no shared
  writable Git state.
- Credentials, signing keys, and any settings in your repository's
  `.git/config` stay on the host. The agent's clone has its own
  independent configuration.

Use clone mode whenever you want a strong boundary between the agent's
Git activity and your host repository — for example when running an
unfamiliar agent, running multiple agents on the same repository at once,
or keeping your working tree clean while the agent works.

## Credential isolation

Most agents need API keys for their model provider. Rather than passing keys
into the sandbox, the host-side proxy intercepts outbound API requests and
injects authentication headers before forwarding each request.

Credential values are never stored inside the VM. They are not available as
environment variables or files inside the sandbox unless you explicitly set
them. This means a compromised sandbox cannot read API keys from the local
environment.

SSH agent forwarding is enabled by default. Private keys stay on the host, but
any process inside the sandbox can ask the forwarded agent to authenticate or
sign data. Docker Sandboxes forwards only sockets it recognizes as SSH agents.
A sandbox receives no SSH agent when forwarding is disabled, the configuration
is unavailable, or the selected socket can't be used.

For how to store and manage credentials, see [Credentials](/ai/sandboxes/security/configuration/credentials/).

<!-- page: https://docs.docker.com/ai/sandboxes/troubleshooting/ fetched 2026-10-08 -->

# Troubleshooting


The following diagnostics and recovery steps apply to local sandboxes. Use
[`sbx --cloud diagnose`](/ai/sandboxes/troubleshooting/cloud/usage/#diagnose-cloud-access) to check cloud
connectivity and account access. For cloud files, expiration, and network access, see
[Cloud sandboxes](/ai/sandboxes/troubleshooting/cloud). Local daemon restarts and `sbx reset` do not repair
cloud sandbox state.

## Run diagnostics

Before digging into a specific issue, run
[`sbx diagnose`](/reference/cli/sbx/diagnose/) to check for common problems
with your installation, such as a missing CLI binary, daemon reachability
problems, a CLI/daemon version mismatch, missing storage directories, or
broken authentication.

```console
$ sbx diagnose
```

The command prints a summary of checks that passed, warned, or failed, along
with suggested fixes. Use `--output json` to get machine-readable output, or
`--output github-issue` to generate a Markdown snippet suitable for pasting
into a GitHub issue.

## Restart the sandbox daemon

If sandbox commands hang, fail to connect to the daemon, or keep returning
daemon errors, restart the sandbox daemon before resetting sandbox state:

```console
$ sbx daemon restart
```

Then retry the command that failed. Restarting the daemon doesn't delete
sandbox data. If the issue persists or state is corrupted, use
[`sbx reset`](/reference/cli/sbx/reset/).

## Resetting sandboxes

If you hit persistent issues or corrupted state, run
[`sbx reset`](/reference/cli/sbx/reset/) to stop all VMs and delete all sandbox
data. Create fresh sandboxes afterwards.

## Sandbox doesn't contain my project files

Starting with `sbx` version 0.42.0, the workspace path is optional for
`sbx create`. When you omit it, the command creates a mountless sandbox. For
example, these commands create and attach to a sandbox without mounting your
host project files:

```console
$ sbx create --name <sandbox-name> <agent>
$ sbx run --name <sandbox-name>
```

By contrast, `sbx run` mounts the current directory when you don't pass a
workspace path:

```console
$ sbx run <agent>
```

A sandbox's workspace configuration is fixed when the sandbox is created. To
reuse the name of an existing mountless sandbox, first
[copy out any files you want to keep](/ai/sandboxes/troubleshooting/usage/#copy-files-between-host-and-sandbox),
then remove and recreate it with a workspace path:

```console
$ sbx rm <sandbox-name>
$ sbx run --name <sandbox-name> <agent>
```

See [Choose a workspace](/ai/sandboxes/troubleshooting/usage/#choose-a-workspace) for mountless, direct,
and clone-mode behavior.

## Kiro, Copilot, or Droid shorthand fails

In Docker Sandboxes v0.42, `sbx run kiro`, `sbx run copilot`, and
`sbx run droid` fail because these agents moved from built-in agents to
public kits and their shorthand names aren't resolved in this release.

[Upgrade Docker Sandboxes](/ai/sandboxes/troubleshooting/install/) to v0.43.0 or later to launch
these agents by name again. If you need to stay on v0.42, use the full kit
reference for your agent:

```console
$ sbx run docker.io/sbx/kiro-kit:latest
$ sbx run docker.io/sbx/copilot-kit:latest
$ sbx run docker.io/sbx/droid-kit:latest
```

## Agent can't install packages or reach an API

Sandboxes use [network access rules](/ai/sandboxes/troubleshooting/governance/access-controls/network/) to
control outbound traffic.
If the agent fails to install packages or call an external API, the target
domain is likely not in the allow list. Check which requests are being blocked:

```console
$ sbx policy log
```

Then allow the domains your workflow needs:

```console
$ sbx policy allow network "*.npmjs.org,*.pypi.org,files.pythonhosted.org"
```

To allow all outbound traffic instead:

```console
$ sbx policy allow network "**"
```

If `sbx policy allow` doesn't unblock the request, your organization may
manage sandbox policies centrally and take precedence over local rules. See
[Organization policies](/ai/sandboxes/troubleshooting/governance/access-controls/organization/).

## Kit fails to install: source not in allowlist

If loading a kit fails with a message like its source is not in your
allowlist:

```console
$ sbx run claude --kit "git+https://github.com/docker/sbx-kits-contrib.git#dir=vale"
ERROR: resolve kits: kit "git+https://github.com/docker/sbx-kits-contrib.git#dir=vale" cannot be installed — its source is not in your allowlist.
```

`sbx` restricts kit installs to an allowlist of sources, which defaults to
Docker Hub (`docker.io/`) only. Add the kit's publisher to the
[`kit.allowedSources`](/ai/sandboxes/troubleshooting/configuration/settings/#kitallowedsources) setting,
keeping the entries you want to retain:

```console
$ sbx settings set kit.allowedSources '["docker.io/","github.com/docker/"]'
```

Then run the command again. For details, including how to allow local kits or
any remote source, see [Restrict kit sources](/ai/sandboxes/customize/use-kits/#restrict-kit-sources).

## SSH and other non-HTTP connections fail

Non-HTTP TCP connections such as SSH can be allowed by adding a policy rule for
the destination. Hostname rules work for these connections because the sandbox
recovers the hostname from its DNS resolver when the protocol doesn't include
one:

```console
$ sbx policy allow network "myhost:22"
```

If the destination is reached by IP address without a DNS lookup, the hostname
can't be recovered. Use an address-based rule in that case:

```console
$ sbx policy allow network "10.1.2.3:22"
```

UDP requires [experimental UDP egress](/ai/sandboxes/troubleshooting/governance/access-controls/local/#allow-outbound-udp)
and UDP allow rules. ICMP is blocked and can't be unblocked with policy rules.

For Git operations over SSH, you can either add an allow rule for the Git
server's hostname or IP address, or use HTTPS URLs instead:

```console
$ git clone https://github.com/owner/repo.git
```

## Can't reach a service running on the host

If a request to `127.0.0.1` or a local network IP returns "connection refused"
from inside a sandbox, the address is not reachable from within the sandbox VM.
See [Accessing host services from a sandbox](/ai/sandboxes/troubleshooting/workflows/development/#accessing-host-services-from-a-sandbox).

## Docker authentication failure

If you see a message like `You are not authenticated to Docker`, your login
session has expired. In an interactive terminal, the CLI prompts you to sign in
again. In non-interactive environments such as scripts or CI, run `sbx login`
to re-authenticate.

## Agent authentication failure

If the agent can't reach its model provider or you see API key errors, the key
is likely invalid, expired, or not configured. Verify it's set in your shell
configuration file and that you sourced it or opened a new terminal.

For agents that use the [credential proxy](/ai/sandboxes/troubleshooting/configuration/credentials/), make sure
you haven't set the API key to an invalid value inside the sandbox — the proxy
injects credentials automatically on outbound requests.

If credentials are configured correctly but API calls still fail, check
`sbx policy log` and look at the **PROXY** column. Requests routed through
the `transparent` proxy don't get credential injection. This can happen when a
client inside the sandbox (such as a process in a Docker container) isn't
configured to use the forward proxy. See
[Monitoring network activity](/ai/sandboxes/troubleshooting/governance/monitor-and-enforce/monitoring/)
for details.

## MCP server streams stall

If a remote MCP server's HTTP/2 handling stalls long-lived streams, register
it with `--disable-http2` to use HTTP/1.1:

```console
$ sbx mcp add acme --url https://mcp.acme.com/mcp --disable-http2
```

Replace the example URL with your MCP endpoint. The setting applies to later
connections to this server. The flag requires `--url` and can't be used with
`--command` or `--local`. For registration options, see
[Register an MCP server](/ai/sandboxes/troubleshooting/mcp-gateway/#register-an-mcp-server).

## API calls fail with a certificate error

If your organization uses a proxy that inspects HTTPS traffic, agent requests
can fail with a certificate error such as
`SSL certificate problem: self-signed certificate in certificate chain`. Install
your organization's internal root CA inside the sandbox so the agent and its
SDKs trust certificates signed by the proxy. Certificate errors can stop a
request before the credential proxy can inject credentials.

For repeatable setup with a built-in agent, create a
[v2 mixin kit](/ai/sandboxes/troubleshooting/customize/kits-v2/) that installs the CA when the
sandbox is created. See
[Install an internal CA certificate](/ai/sandboxes/troubleshooting/customize/kits-v2/#install-an-internal-ca-certificate)
for an example kit.

Use a PEM-encoded certificate with a `.crt` extension. If traffic can be signed
by more than one internal proxy, install each proxy's root CA before running
`update-ca-certificates`.

Create a sandbox with the kit:

```console
$ sbx run claude --kit ./internal-ca/
```

To update an existing sandbox, copy the certificate into the sandbox and update
the trust store:

```console
$ sbx cp ./internal-ca.crt <sandbox-name>:/tmp/internal-ca.crt
$ sbx exec <sandbox-name> -- sudo install -m 0644 /tmp/internal-ca.crt /usr/local/share/ca-certificates/internal-ca.crt
$ sbx exec <sandbox-name> -- sudo update-ca-certificates
```

> [!IMPORTANT]
> Install the CA into the system trust store with `update-ca-certificates`, as
> shown above. Don't override the sandbox's TLS trust variables (such as
> `SSL_CERT_FILE`) to point at only your internal CA. Doing so replaces the
> system bundle
> and breaks the trust the credential proxy depends on, so requests on the
> `forward` egress path fail.

If API calls still fail after installing the CA, run `sbx policy log` and check
the egress path in the **PROXY** column:

- `forward`: the credential proxy terminates TLS and presents its own
  certificate, which the sandbox already trusts. Requests on this path don't
  need the internal CA, and overriding the sandbox's trust variables breaks
  them, as described above.
- `forward-bypass` and `transparent`: the proxy forwards packets to the
  upstream proxy without terminating TLS, so the sandbox sees your
  organization's certificate directly. These paths are where installing the
  internal CA applies. The only difference between them is whether the client
  knows it's talking to a proxy.

### Certificate errors during Docker builds

Containers started by the sandbox's Docker Engine have their own trust stores.
They don't inherit the sandbox's installed certificates. If an HTTPS download
in a Dockerfile fails with `self signed certificate in certificate chain`,
install the proxy CA in the build image before the download.

From a shell inside the sandbox, write its proxy CA into your build context:

```console
$ printf '%s' "$PROXY_CA_CERT_B64" | base64 -d > sbx-proxy-ca.crt
```

For a Debian-based image with `ca-certificates` installed, copy the certificate
and update the trust store before commands that make HTTPS requests:

```dockerfile
FROM python:3.13-slim
COPY sbx-proxy-ca.crt /usr/local/share/ca-certificates/sbx-proxy-ca.crt
RUN update-ca-certificates
```

Build inside the sandbox, passing its proxy settings to the build:

```console
$ docker build --build-arg HTTP_PROXY --build-arg HTTPS_PROXY --build-arg NO_PROXY -t my-app .
```

If your organization also inspects TLS, install its root CA in the build image
as a separate `.crt` file before `update-ca-certificates`. Keep the system CA
bundle intact so the image trusts both proxies and public certificate
authorities. The earlier [certificate troubleshooting](#api-calls-fail-with-a-certificate-error)
explains which proxy paths need each CA.

Keep the generated proxy certificate out of version control. Regenerate it and
rebuild the image if the sandbox proxy CA changes.

## Sandbox runs out of disk space

The sandbox root (`/`) filesystem defaults to 20 GB. To increase it, set
`DOCKER_SANDBOXES_ROOT_SIZE` before creating the sandbox:

```console
$ DOCKER_SANDBOXES_ROOT_SIZE=40g sbx run claude
```

`DOCKER_SANDBOXES_ROOT_SIZE` controls the root filesystem size. The Docker data
disk at `/var/lib/docker` is independent and defaults to 10 GB. To change the
Docker data disk size for a sandbox, set `DOCKER_SANDBOXES_DOCKER_SIZE` when you
create it:

```console
$ DOCKER_SANDBOXES_DOCKER_SIZE=20g sbx run claude
```

The Docker data disk must be at least 512 MiB. The environment variable doesn't
resize existing volumes.

For a [clone-mode sandbox](/ai/sandboxes/troubleshooting/usage/#clone-mode), set
`DOCKER_SANDBOXES_CLONED_WORKSPACE_SIZE` before creating the sandbox to
configure the cloned workspace volume capacity. The variable accepts
human-readable size strings such as `100g`:

```console
$ DOCKER_SANDBOXES_CLONED_WORKSPACE_SIZE=100g sbx run --clone claude .
```

## Filesystem operations are slow in large repositories

Filesystem operations such as `git status`, `git log`, or directory scans can
be noticeably slow when you pass a workspace path and use direct mode.
Virtiofs caching speeds up these workloads. Clone-mode sandboxes always enable
it, so this tuning applies only to direct mode.

Virtiofs caching is enabled by default on all operating systems. If you
experience Git index corruption or unexpected file content, disable caching
with the kill switch and recreate the sandbox:

```console
$ DOCKER_SANDBOXES_ENABLE_VIRTIOFS_CACHE=0 sbx run <agent>
```

## Clone mode reports "not in a Git repository" on WSL

On Windows, running [`sbx run --clone`](/ai/sandboxes/troubleshooting/usage/#clone-mode) against a
repository on a WSL filesystem (a `\\wsl.localhost\...` path) can fail even
though the directory is a valid Git repository:

```console
> sbx run --clone claude \\wsl.localhost\Ubuntu\home\you\repo
ERROR: --clone requires a Git repository, but \\wsl.localhost\Ubuntu\home\you\repo is not in a Git repository
```

The cause is Git's dubious ownership check. When Git on Windows accesses a
repository owned by a different user across the WSL boundary, it refuses to
operate on it, so the underlying repository detection fails:

```console
> git -C \\wsl.localhost\Ubuntu\home\you\repo rev-parse --show-toplevel
fatal: detected dubious ownership in repository at '//wsl.localhost/Ubuntu/home/you/repo'
```

Add the repository to Git's `safe.directory` list to allow access, then run
the command again:

```console
> git config --global --add safe.directory '%(prefix)///wsl.localhost/Ubuntu/home/you/repo'
> sbx run --clone claude \\wsl.localhost\Ubuntu\home\you\repo
✓ Git repository detected: \\wsl.localhost\Ubuntu\home\you\repo
```

## SSH agent socket is missing

If `SSH_AUTH_SOCK` is set inside a sandbox but `ssh-add -L` reports
`No such file or directory`, check whether your custom template includes
`socat`. Docker Sandboxes uses it to create the socket that forwards requests
to your host SSH agent. Installing OpenSSH client tools alone isn't enough.

For an Ubuntu-based custom template, add `socat` to the packages installed as
root in your Dockerfile, then rebuild the template and create a sandbox from
it. Docker-provided sandbox templates already include `socat`.

If the socket exists but forwarding still fails, check the
[SSH agent settings](/ai/sandboxes/troubleshooting/configuration/credentials/#ssh-agent).

## Sandbox commits aren't signed

Docker Sandboxes can sign Git commits with SSH keys from your host agent.
For setup steps, see [Commit signing](/ai/sandboxes/troubleshooting/workflows/git/#commit-signing).

Forwarding is enabled by default. Check
[`ssh.agentForwardingEnabled`](/ai/sandboxes/troubleshooting/configuration/settings/#sshagentforwardingenabled)
and [`ssh.agentSocketPath`](/ai/sandboxes/troubleshooting/configuration/settings/#sshagentsocketpath) to
confirm that forwarding is enabled and inspect the socket selection:

```console
$ sbx settings get ssh.agentForwardingEnabled
$ sbx settings get ssh.agentSocketPath
```

If you use each client's current `SSH_AUTH_SOCK`, reconnect from a shell where
it points to the intended agent. If `ssh.agentSocketPath` returns a path,
confirm that it points to an active host agent. After changing forwarding or
the socket selection, run `sbx daemon restart`.

If `ssh-add -L` prints `The agent has no identities.`, the sandbox can reach
the forwarded agent, but the host agent doesn't have a loaded key. Load the
signing key into your host SSH agent:

```console
$ ssh-add ~/.ssh/id_ed25519
```

If commit signing works on the host but fails in a sandbox, check whether Git
is configured to sign with a host file path such as
`/Users/me/.ssh/id_ed25519.pub`. The sandbox uses the forwarded SSH agent, not
the host key file path. Use the inline public key form instead:

```console
$ git config --global gpg.format ssh
$ git config --global user.signingkey "key::$(ssh-add -L | head -n 1)"
```

If Git reports that `ssh-keygen` is missing, use a sandbox template that
includes OpenSSH client tools.

If `git log --show-signature` reports that `gpg.ssh.allowedSignersFile` needs
to be configured, Git can't verify the SSH signature locally. This verification
config isn't required to create signed commits. GitHub uses the SSH signing
keys configured in your GitHub account to verify commits.

GPG and S/MIME signing keys aren't available inside the sandbox. If your
repository or organization requires GPG or S/MIME signatures, or if SSH signing
isn't configured, use one of these workarounds:

- Commit outside the sandbox. Let the agent make changes without committing,
  then commit and sign from your host terminal.

- Sign after the fact. Let the agent commit inside the sandbox, then re-sign
  the commits on your host:

  ```console
  $ git rebase --exec 'git commit --amend --no-edit -S' origin/main
  ```

  This replays each commit on the branch and re-signs it with your local
  signing key.

## Daemon fails to start after downgrading

If you downgrade `sbx` to a version older than the one that last managed your
local state, the daemon may fail to start with a database version mismatch:

```text
ERROR: failed to start backend in-process: start backend: creating containerd
server: ... database is at major version 6, but this binary only supports up
to major version 1
```

A newer version of `sbx` upgraded the local database to a schema that older
binaries don't understand. To recover, reset all sandbox state:

```console
$ sbx reset --preserve-secrets
```

This stops all VMs and deletes all sandbox data. You'll need to create new
sandboxes afterwards. The `--preserve-secrets` flag keeps any secrets you've
set so you don't have to reconfigure them.

## Removing all state

As a last resort, if `sbx reset` doesn't resolve your issue, you can remove the
`sbx` state directory entirely. This deletes all sandbox data, configuration, and
cached images. Stop all running sandboxes first with `sbx reset`.

**macOS**



```console
$ rm -rf ~/Library/Application\ Support/com.docker.sandboxes/
```

**Windows**



```powershell
> Remove-Item -Recurse -Force "$env:LOCALAPPDATA\DockerSandboxes"
```

**Linux**



Sandbox state on Linux follows the XDG Base Directory specification and is
spread across three directories:

```console
$ rm -rf ~/.local/state/sandboxes/
$ rm -rf ~/.cache/sandboxes/
$ rm -rf ~/.config/sandboxes/
```

If you have set custom `XDG_STATE_HOME`, `XDG_CACHE_HOME`, or
`XDG_CONFIG_HOME` environment variables, replace `~/.local/state`,
`~/.cache`, and `~/.config` with the corresponding values.



## Enable automatic diagnostics uploads

To opt in to automatic diagnostics uploads after certain daemon errors, set
[`diagnostics.autoUpload`](/ai/sandboxes/troubleshooting/configuration/settings/#diagnosticsautoupload) to
`yes`:

```console
$ sbx settings set diagnostics.autoUpload yes
```

Automatic bundles include basic system information and client, daemon, crash,
and MCP logs. Docker Sandboxes redacts recognized identity values and
credential patterns, but collected logs can still contain user content. Failed
uploads remain in a local queue for a later retry.

## Report an issue

If you've exhausted the steps above and the problem persists, file a GitHub
issue at [github.com/docker/sbx-releases/issues](https://github.com/docker/sbx-releases/issues).

To help Docker investigate, generate a diagnostics bundle and share it when
reporting the issue:

```console
$ sbx diagnose --upload
```

The bundle contains daemon logs, diagnostic check results, and basic system
information. When `--upload` is confirmed, the bundle is uploaded to Docker
support and the command prints a diagnostics ID. Include this ID in your
issue so the team can correlate it with the uploaded bundle.

<!-- page: https://docs.docker.com/ai/sandboxes/usage/ fetched 2026-10-08 -->

# Usage


This page describes local sandboxes. For cloud commands, file transfers, ports,
and expiration, see [Use cloud sandboxes](/ai/sandboxes/usage/cloud/usage/).

Use this page as a command-oriented guide to day-to-day `sbx` operations. For
scenario-based recommendations, see [Workflow patterns](/ai/sandboxes/usage/workflows).

## Sign in

Sign in from a terminal:

```console
$ sbx login
```

For scripts or CI runners where a browser isn't available, see
[CI and headless use](/ai/sandboxes/usage/workflows/automation/).

## Start, stop, and remove

The basic workflow is [`run`](/reference/cli/sbx/run/) to start,
[`ls`](/reference/cli/sbx/ls/) to check status,
[`stop`](/reference/cli/sbx/stop/) to pause, and
[`rm`](/reference/cli/sbx/rm/) to clean up:

```console
$ sbx run claude                    # start an agent in the current directory
$ sbx ls                            # see what's running
$ sbx stop my-sandbox               # pause it
$ sbx rm my-sandbox                 # delete it entirely
```

`sbx rm` asks for confirmation before deleting a sandbox. Use `--force` to
skip the prompt. This flag also permits removal when the sandbox has an active
session — an open attach, SSH connection, or in-flight SFTP transfer:

```console
$ sbx rm --force my-sandbox
```

If you need a clean slate, remove the sandbox and run it again:

```console
$ sbx stop my-sandbox
$ sbx rm my-sandbox
$ sbx run claude
```

To remove all stopped local sandboxes, use `sbx prune`. Running sandboxes are
never removed. Preview the sandboxes that would be removed, or filter out
sandboxes stopped within the last week:

```console
$ sbx prune --dry-run
$ sbx prune --filter until=168h
```

The `until` filter uses the time the sandbox stopped. It accepts a duration
such as `168h`, an RFC 3339 timestamp, or a Unix timestamp. The older
`since=<duration>` filter remains supported.

Run `sbx prune` without flags to confirm and remove all stopped sandboxes.

### Remove a sandbox when the agent exits

Pass `--rm` to `sbx run` for a throwaway session. The sandbox is removed when
the agent exits, without a confirmation prompt:

```console
$ sbx run --rm claude
```

The sandbox is removed however the agent exits, and `sbx run` exits with the
agent's exit status. If `sbx run` created the sandbox and the agent fails
to start, the sandbox is also removed. If you reattach to an existing sandbox
with `--rm`, that sandbox is removed only after its agent session finishes.

`--rm` needs an attached agent session to know when to remove the sandbox, so
you can't combine it with `--detached` or `--detach-keys`.

## Choose a workspace

`sbx run` mounts the current directory when you don't pass a workspace path.
Pass a path to mount another directory instead:

```console
$ sbx run claude
$ sbx run claude ~/my-project
```

The first workspace path is the primary workspace. The agent starts there, and
`sbx exec` uses it as the default working directory. The host directory is
mounted at the same absolute path inside the sandbox. When you don't pass a
path to `sbx run`, the current directory is the primary workspace.

Starting with `sbx` version 0.42.0, workspace paths are optional for
`sbx create`. Omit them to create a mountless sandbox without a host workspace
bind mount, then attach to the sandbox by name:

```console
$ sbx create --name scratch claude
$ sbx run --name scratch
```

In a mountless sandbox, the agent starts in the template image's working
directory. Docker-provided templates use `/home/agent/workspace`. Files there
persist across stops and restarts but are deleted when you remove the sandbox.
Assign the sandbox a name so you can reconnect to it, and use
[`sbx cp`](#copy-files-between-host-and-sandbox) to transfer files between the
sandbox and the host.

## Reconnect and name sandboxes

Sandboxes persist after the agent exits. Running the same workspace path again
reconnects to the existing sandbox rather than creating another sandbox:

```console
$ sbx run claude ~/my-project  # creates sandbox
$ sbx run claude ~/my-project  # reconnects to same sandbox
```

Use `--name` to give a sandbox an explicit identity:

```console
$ sbx run --name my-project claude
```

Once a named sandbox exists, reattach from any working directory with
`sbx run --name`. You can omit the agent name when reattaching:

```console
$ sbx run --name my-project        # re-attaches from anywhere
$ sbx run claude --name my-project # same, with agent confirmed
```

To run multiple sandboxes against the same workspace, give each a distinct
name:

```console
$ sbx run claude --name feature ~/my-project
$ sbx run claude --name spike ~/my-project
```

## Create without attaching

[`sbx run`](/reference/cli/sbx/run/) creates the sandbox and attaches you to the
agent. To create a sandbox with the current directory mounted, without
attaching to it:

```console
$ sbx create --name my-project claude .
```

Omit the path to create a mountless sandbox instead. Attach later with
`sbx run --name`:

```console
$ sbx create --name scratch claude
$ sbx run --name scratch
```

After `sbx create` finishes, the local sandbox stops automatically when no
sessions keep it running. Its files and configuration persist. Running
`sbx run --name <sandbox-name>` starts it again and attaches you to the agent.

### Keep a sandbox running in the background

To keep a sandbox running after every session ends, for example to serve an
application on a [published port](#publish-ports), start it with
`sbx run --detached` (`-d`). The command starts the sandbox, prints its ID,
and returns without opening an agent session:

```console
$ sbx run -d --name my-project claude .
```

A detached sandbox keeps running until you stop it with `sbx stop` or remove
it with `sbx rm`. You can attach to it with `sbx run --name` or run commands
with `sbx exec`, and it keeps running after those sessions end.

Running `sbx run -d --name <sandbox-name>` against an existing sandbox, such
as one created with `sbx create`, switches it to detached mode permanently. To
return to the default behavior, remove the sandbox and create it again.

## Set environment variables

> [!NOTE]
> The `-e`/`--env` and `--env-file` flags require `sbx` version 0.39.0 or
> later.

Pass `-e` or `--env` to `sbx run` or `sbx create` to set an environment
variable in the sandbox:

```console
$ sbx run -e LOG_LEVEL=debug claude
```

Specify a variable name without a value to copy its value from the host
environment:

```console
$ export API_URL=https://api.example.com
$ sbx run -e API_URL claude
```

To load multiple variables, pass one or more environment files:

```console
$ sbx create --name my-project --env-file .env.sandbox claude .
```

The flags follow `docker run` precedence rules. Values passed with `-e`
override values from environment files. When you pass multiple environment
files, a value in a later file overrides the same variable in an earlier file.

When either command creates a sandbox, the variables are stored with the
sandbox. They are also available to the agent session started by `sbx run`.
When `sbx run` re-attaches to an existing sandbox, the variables apply to that
agent session without changing the sandbox's stored environment. To set
variables for one command instead, use `sbx exec -e` or
`sbx exec --env-file`.

To persist a variable across future sessions of an existing sandbox, append an
export to `/etc/sandbox-persistent.sh`:

```console
$ sbx exec <sandbox-name> bash -c "echo 'export INTERNAL_API_URL=https://api.example.com' >> /etc/sandbox-persistent.sh"
```

The `bash -c` wrapper ensures the `>>` redirect runs inside the sandbox instead
of on your host. The file is sourced when Bash starts inside the sandbox,
including for interactive sessions and agents started with `sbx run`. A command
passed directly to `sbx exec` doesn't start a shell. Wrap that command in
`bash -c` if it needs variables from the persistent environment file.

A variable added to the file only takes effect for sessions and agents started
afterward. Restart a running agent, or stop and start the sandbox, to pick up
the new value.

Environment variables are readable by processes inside the sandbox. For API
keys and other credentials, use [`sbx secret set`](/ai/sandboxes/usage/configuration/credentials/#store-a-secret)
for a supported service or the experimental
[`sbx secret set-custom`](/ai/sandboxes/usage/configuration/credentials/#custom-secrets) for a
credential sent to known hosts. The host-side proxy can then inject the real
value without exposing it to the agent.

## Run commands inside a sandbox

To get a shell inside a running sandbox, use [`sbx exec`](/reference/cli/sbx/exec/):

```console
$ sbx exec -it <sandbox-name> bash
```

Without `--workdir`, the command starts in the sandbox's primary workspace. In
a mountless sandbox, it starts in the container image's working directory.

`sbx exec` runs commands in the foreground. Detached execution (`-d` or
`--detach`) isn't supported.

## Interactive mode

Running `sbx` with no subcommands opens an interactive terminal dashboard:

```console
$ sbx
```

The dashboard shows all your sandboxes as cards with live status, CPU, and
memory usage. From here you can:

- **Create** a sandbox (`c`).
- **Start or stop** a sandbox (`s`).
- **Attach** to an agent session (`Enter`), same as `sbx run`.
- **Open a shell** inside the sandbox (`x`), same as `sbx exec`.
- **Remove** a sandbox (`r`).

The dashboard also includes a network governance panel where you can monitor
outbound connections made by your sandboxes and manage network rules. Use `tab`
to switch between the sandboxes panel and the network panel.

From the network panel you can browse connection logs, allow or block specific
hosts, and add custom network rules. Press `?` to see all keyboard shortcuts.

## Git workspace modes

When your primary workspace is a Git repository, choose how the sandbox receives
it when you create the sandbox:

- Direct mode is the default for `sbx run`. It also applies when you pass a
  workspace path to `sbx create`. The agent has read-write access to your
  working tree, and changes appear on your host immediately.
- [Clone mode](#clone-mode) uses `--clone`. The agent edits a separate Git clone
  inside the sandbox. Its changes stay there until you fetch them or the agent
  pushes them. Your host repository is also available at
  `/run/sandbox/source`, but only with read access.

For guidance on branch strategy, fetching work from a sandbox, and parallel
agent workflows, see [Git workflows](/ai/sandboxes/usage/workflows/git/). For the
security model behind each mode, see
[Workspace isolation](/ai/sandboxes/usage/security/isolation/#workspace-isolation).

### Clone mode

To create a clone-mode sandbox, pass `--clone` when you run or create it:

```console
$ sbx run --clone claude .
```

You can also create the sandbox in the background and attach later:

```console
$ sbx create --clone --name my-sandbox claude .
$ sbx run --name my-sandbox
```

Clone mode has a few create-time constraints:

- Clone mode is fixed at create time. To switch an existing sandbox to clone
  mode, remove it and recreate it with `sbx create --clone`.
- The clone follows whichever ref your host repository has checked out at create
  time. No branch is created automatically.
- The primary workspace must be a Git repository. Omit `--clone` for non-Git
  workspaces.
- Clone mode is rejected from inside a Git worktree other than the main one. The
  read-only bind mount can't resolve the worktree's `.git` pointer file. Run
  `sbx create --clone <agent> .` from the main repository checkout instead.
- Removing a clone-mode sandbox drops the in-sandbox clone. Fetch or push any
  commits you want to keep before you remove it.

## Multiple workspaces

You can mount extra directories into a sandbox alongside the main workspace.
The first path is the primary workspace — the agent starts here, and the
sandbox's in-container Git clone is populated from this directory if you
use `--clone`. Extra workspaces are always mounted directly.

Each workspace path appears inside the sandbox at the same absolute path as on
the host. Append `:ro` to mount an extra workspace read-only — useful for
reference material or shared libraries the agent shouldn't modify:

```console
$ sbx run claude ~/project-a ~/shared-libs:ro ~/docs:ro
```

You can also run separate projects side-by-side. Remove unused sandboxes when
you're done to reclaim disk space:

```console
$ sbx run claude ~/project-a
$ sbx run claude ~/project-b
$ sbx rm <sandbox-name>       # when finished
```

## Copy files between host and sandbox

Use [`sbx cp`](/reference/cli/sbx/cp/) to copy files or directories between
your host and a sandbox. This is useful for one-off files that aren't part of a
mounted workspace, such as generated output, logs, or setup files. The sandbox
path must be absolute. `sbx cp` doesn't resolve relative paths such as `.`
against the sandbox's default working directory.

For example, copy files to or from the default working directory used by a
Docker-provided agent template:

```console
$ sbx cp ./config.json my-sandbox:/home/agent/workspace/
$ sbx cp my-sandbox:/home/agent/workspace/output.log ./
$ sbx cp ./src/ my-sandbox:/home/agent/workspace/src
```

One side of the copy must use `SANDBOX:PATH`. Copying directly between two
sandboxes isn't supported.

## Publish ports

Sandboxes are [network-isolated](/ai/sandboxes/usage/security/isolation/) — your browser or local
tools can't reach a server running inside one by default. A port mapping of
`8080:3000` publishes sandbox port 3000 on host port 8080.

If you know which ports you need, publish them when you create the sandbox:

```console
$ sbx run --publish 8080:3000 --name my-sandbox claude
```

For an existing sandbox, use [`sbx ports`](/reference/cli/sbx/ports/) to
forward traffic from your host. Publishing a port on a stopped local sandbox
starts it first:

```console
$ sbx ports my-sandbox --publish 8080:3000
$ open http://localhost:8080
```

To let the OS pick a free host port instead of choosing one yourself, specify
only the sandbox port. Then use `sbx ports` to check which host port was
assigned:

```console
$ sbx ports my-sandbox --publish 3000
$ sbx ports my-sandbox
```

`sbx ls` shows active port mappings alongside each sandbox. `sbx ports` lists
them in detail.

```console
$ sbx ls
SANDBOX         AGENT   STATUS   PORTS                    WORKSPACE
my-sandbox      claude  running  127.0.0.1:8080->3000/tcp4 /home/user/proj
```

To stop forwarding a port:

```console
$ sbx ports my-sandbox --unpublish 8080:3000
```

When `sbx run` re-attaches to an existing sandbox, it ignores `--publish`. Use
`sbx ports` to publish ports on that sandbox. For dev server and host-service
recipes, see
[Local services](/ai/sandboxes/usage/workflows/development/#local-services).

## What persists

While a sandbox exists, installed packages, Docker images, configuration
changes, command history, and mountless workspace files all persist across
stops and restarts. When you remove a sandbox, everything inside is deleted.
Host workspace files, including repositories used as clone sources, and the
[shared agent skills store](/ai/sandboxes/usage/workflows/agent-skills/) remain on your host. To
capture changes in the container filesystem, [save a template](#saving-a-sandbox-as-a-template).
For a reproducible environment defined in source,
[author a kit](/ai/sandboxes/customize/author/).

## Saving a sandbox as a template

Save a sandbox's container filesystem as a reusable template image after
setting up tools or configuration interactively. A template contains image
content; the agent kit still supplies runtime settings such as credentials
and network rules. The examples here reuse templates with built-in agents.

A saved template isn't a backup of the whole sandbox. Mounted filesystems,
including host workspaces and the Docker store at `/var/lib/docker`, aren't
included. Save any data from those mounts separately.

> [!WARNING]
> Saving a sandbox captures files in its container filesystem, including any
> secrets stored there. If you manually added API keys, tokens, or other
> credentials to the sandbox, they're embedded in the saved template and
> shared with anyone you distribute it to. To keep credentials out of
> templates, manage them with `sbx secret set` instead — the proxy injects
> them at runtime so they're never written to the filesystem. For more
> information, see [Manage credentials](/ai/sandboxes/usage/configuration/credentials/).

### Save and reuse

Stop the sandbox (or let the CLI prompt you), then save it with a name and
tag:

```console
$ sbx template save my-sandbox my-template:v1
```

The image is stored in the sandbox runtime's local image store. Create a
new sandbox from it with the `-t` flag:

```console
$ sbx run -t my-template:v1 claude
```

### List and remove templates

List all saved templates:

```console
$ sbx template ls
```

Remove a template you no longer need:

```console
$ sbx template rm my-template:v1
```

### Export and import

To share a saved template or move it to another machine, export it as a
tar file:

```console
$ sbx template save my-sandbox my-template:v1 --output my-template.tar
```

On the other machine, load the tar file and use it:

```console
$ sbx template load my-template.tar
$ sbx run -t my-template:v1 claude
```

### Limitations

Agent configuration files are always recreated when a sandbox is created.
Changes to user-level agent configuration files, such as
`/home/agent/.claude/settings.json` and `/home/agent/.claude.json`, do not
persist in saved templates.

If the saved template was built for a different agent than the one you
specify in `sbx run`, you get a warning. For example, saving a Claude
sandbox and running it with `codex` produces:

```text
⚠ WARNING: template "my-template:v1" was built for the "claude" agent but you are using "codex".
  The sandbox may not work correctly. Consider using: sbx run -t my-template:v1 claude
```

## Load a template

To create a sandbox from a template image in a registry, pass its full image
reference to `--template`. Use the agent the image was prepared for:

```console
$ sbx run --template docker.io/my-org/my-template:v1 claude
```

Unlike Docker commands, `sbx` doesn't automatically add the Docker Hub domain
(`docker.io`) to image references. For available images and the built-in agent
workflow, see [Base images](/ai/sandboxes/customize/author/base-images/).

> [!NOTE]
> The Docker daemon used by Docker Sandboxes pulls templates from a
> registry directly; it doesn't share the image store of your local Docker
> daemon on the host. To route Docker Hub image pulls through your
> organization's registry infrastructure, configure a
> [registry mirror](/ai/sandboxes/usage/configuration/registry-mirror/).

> [!IMPORTANT]
> For Docker Hub, `sbx` reuses your `sbx login` session to pull private
> images. For other registries (GitHub Container Registry, ECR, ACR, a
> self-hosted Nexus, and so on), store pull credentials with
> [`sbx secret set --registry`](/ai/sandboxes/usage/configuration/credentials/#registry-credentials)
> before running the sandbox:
>
> ```console
> $ gh auth token | sbx secret set --registry ghcr.io --password-stdin
> ```
>
> Without stored credentials, pulls from non-Docker Hub registries are
> anonymous and private images fail to pull.

For locally-built images, save the image to a tar and load it directly
into the sandbox runtime instead of pulling from a registry:

```console
$ docker image save my-org/my-template:v1 -o my-template.tar
$ sbx template load my-template.tar
$ sbx run --template my-org/my-template:v1 claude
```

`sbx template load` imports the tar into the sandbox runtime's image
store, so the image doesn't need to be reachable from a registry at
sandbox creation time.

### Template caching

When creating a sandbox, `sbx` checks the registry for the template image by
default and downloads missing or updated layers. If the pull fails and the
image is cached locally, it can use the cached image. Cached images persist
across sandbox creation and deletion, and are cleared when you run `sbx reset`.

### Updating agents

Agent templates include an agent version, which can differ from the agent's
latest release. Updating the `sbx` CLI or pulling an updated template doesn't
update agents inside existing sandboxes.

To update an installed agent, run its documented update command inside the
sandbox, either from a sandbox shell or with `sbx exec`. Restart the agent
session to use the updated version. The update persists across sandbox stops
and starts, but is deleted when you remove the sandbox. To reuse the updated
agent in other sandboxes, [save a template](#saving-a-sandbox-as-a-template).

<!-- page: https://docs.docker.com/ai/sandboxes/workflows/ fetched 2026-10-08 -->

# Workflow patterns


Choose a workflow based on how you want to develop, authenticate tools, or run
local sandboxes in automation. For command syntax and lifecycle basics, see
[Usage](/ai/sandboxes/usage/).

## Choose how code moves

Your workspace strategy determines when an agent's changes appear on the host.
Direct mode edits the host working tree in place. Clone mode keeps changes in a
private clone until you fetch or push them. Host worktrees provide branch
isolation while keeping Git operations on the host. See [Git workflows](/ai/sandboxes/workflows/git/)
to choose a strategy for single or parallel tasks.

## Develop in the sandbox

Each sandbox has a private Docker daemon and runtime for building images,
installing dependencies, and running tests. You can publish services from the
sandbox or connect to services on the host. See
[Develop and test locally](/ai/sandboxes/workflows/development/).

Tools inside the sandbox can use credentials configured on the host without
copying secret values into the VM. See
[Authenticate command-line tools](/ai/sandboxes/workflows/authentication/) for GitHub CLI, registry,
and external secret-provider workflows.

## Reuse and automate workflows

Sandbox environment files work like Compose files for sandboxes: they capture
project configuration in a versioned YAML file. Use `sbxenv.yaml` to define
the agent, workspaces, tools, resources, credentials, and ports so contributors
can start a consistent environment without reproducing CLI flags and setup
steps. See [Sandbox environment files](/ai/sandboxes/configuration/environment-files/).

You can also add skills from Git repositories or import them from supported
host agents into a persistent store shared with new sandboxes. See
[Share agent skills](/ai/sandboxes/workflows/agent-skills/).

For unattended jobs, use headless authentication and manage the sandbox
lifecycle from scripts. See [Run sandboxes in CI](/ai/sandboxes/workflows/automation/).

<!-- page: https://docs.docker.com/ai/sandboxes/workflows/agent-skills/ fetched 2026-10-08 -->

# Share agent skills


Shared agent skills let you install skills from Git repositories or import
skills from supported agents on your host for use in local sandboxes. `sbx`
keeps installed skills in a persistent store that survives sandbox deletion
and is shared by default with new sandboxes that run a supported agent.

> [!NOTE]
> Shared agent skills are experimental.

## Add skills from a repository

Add every skill from a Git repository:

```console
$ sbx skills add anthropics/skills
```

The repository must contain one or more valid `SKILL.md` files. You can use
GitHub `owner/repository` shorthand or a Git URL, including HTTPS and SSH URLs.

To add specific skills, use `--skill` with each name or pass a comma-separated
list:

```console
$ sbx skills add https://github.com/anthropics/skills --skill frontend-design --skill pdf
```

When a skill with the same name is already installed, `sbx` prompts before
replacing it. Use `--force` to replace existing skills without prompts.

## Manage installed skills

List the skills in the shared store:

```console
$ sbx skills ls
```

Update every skill installed from a repository:

```console
$ sbx skills update
```

To update specific skills, pass one or more names:

```console
$ sbx skills update frontend-design pdf
```

`sbx skills update` only refreshes skills installed with `sbx skills add`. To
refresh a skill imported from the host, run `sbx skills import` again. To manage
it with `sbx skills update`, install it from a repository instead.

Remove one or more installed skills:

```console
$ sbx skills rm frontend-design pdf
```

`sbx` asks for confirmation before removing skills that running agents may be
using. Use `--force` to skip confirmation in scripts.

## Import skills from the host

Preview the skills that `sbx` finds without copying them:

```console
$ sbx skills import --dry-run
```

The command scans the following directories in order and copies each skill
subdirectory into the shared store. When the sandbox starts, `sbx` mounts the
store at the path the agent reads inside the sandbox.

| Agent       | Host source         | Sandbox mount target          |
| ----------- | ------------------- | ----------------------------- |
| Claude Code | `~/.claude/skills`  | `/home/agent/.claude/skills`  |
| Codex and Devin | `~/.agents/skills` | `/home/agent/.agents/skills` |
| Copilot     | `~/.copilot/skills` | `/home/agent/.copilot/skills` |
| Cursor      | `~/.cursor/skills`  | `/home/agent/.cursor/skills`  |
| Droid       | `~/.factory/skills` | `/home/agent/.factory/skills` |

All imported skills go into the same store, regardless of their source. If
more than one source contains a skill with the same directory name, the skill
from the first source in the table wins and `sbx` warns about the others.

Import the skills:

```console
$ sbx skills import
```

The final output reports the shared store path. The default locations are:

| Platform | Shared store path                                                           |
| -------- | --------------------------------------------------------------------------- |
| macOS    | `~/Library/Application Support/com.docker.sandboxes/sandboxes/agent-skills` |
| Linux    | `~/.local/state/sandboxes/sandboxes/agent-skills`                           |
| Windows  | `%LOCALAPPDATA%\DockerSandboxes\sandboxes\state\agent-skills`               |

On Linux, `sbx` uses `$XDG_STATE_HOME/sandboxes/sandboxes/agent-skills` when
`XDG_STATE_HOME` is set.

When a skill already exists in the store, `sbx` prompts before replacing it.
Use `--force` to replace existing skills without prompts. Importing replaces
the complete skill directory rather than merging files. Run the import command
again when you want to copy updates from the host. If an import replaces a
repository-installed skill, `sbx` no longer associates that skill with its
repository, so `sbx skills update` won't refresh it.

## Shared store behavior

Running `sbx reset` clears the shared store.

Sandboxes created for a supported agent mount the shared store read-only by
default. These sandboxes mount the contents of the store each time they start,
so you can install skills before or after creating them.

Use `--skills` with `sbx run` or `sbx create` to choose the access mode when
creating a sandbox:

- `readonly`: Mount the store so the agent can read skills but cannot modify them.
- `readwrite`: Mount the store so the agent can read and modify shared skills.
- `off`: Omit the shared store mount.

For example, create a sandbox without the shared store:

```console
$ sbx run --skills=off claude
```

To change the default for future sandboxes, set
[`skills.defaultMode`](/ai/sandboxes/workflows/configuration/settings/#skillsdefaultmode) to `off`,
`readonly`, or `readwrite`:

```console
$ sbx settings set skills.defaultMode readonly
```

The mode is applied only when a sandbox is created. Upgrading `sbx` or changing
`skills.defaultMode` leaves existing sandbox mounts unchanged. Remove and
recreate a sandbox to change its mode. Sandboxes created without shared skills
also need to be recreated to mount the store.

> [!WARNING]
> A sandbox with `readwrite` access can modify skills that other sandboxes load,
> including sandboxes with `readonly` access. Read-only access prevents writes
> from that sandbox but does not isolate it from changes to the store. The store
> is dedicated sandbox state, so this does not by itself execute modified skills
> on your host. Use `--skills=off` when creating a sandbox to keep it outside
> this shared trust boundary.

Some agents scan for skills when a session starts. If installed skills don't
appear in an existing session, start another agent session.

<!-- page: https://docs.docker.com/ai/sandboxes/workflows/authentication/ fetched 2026-10-08 -->

# Authenticate command-line tools


These workflows resolve credentials on the host for local sandboxes. For
cloud secret setup, see [Authenticate cloud agents](/ai/sandboxes/workflows/cloud/credentials/).

The sandbox proxy handles API credentials for model providers automatically,
but agents often also need credentials for tools like `gh`, `docker`, or a
secrets manager. Configure the credential source on your host, and the proxy
injects the resolved value into matching requests from the sandbox. Dynamic
secret sources can retrieve a value from an authenticated host CLI without
copying the value into the secret store.

For secret scope and how changes apply to existing sandboxes, see
[Store a secret](/ai/sandboxes/workflows/configuration/credentials/#store-a-secret).

## GitHub CLI

Store your GitHub token as a sandbox secret. The proxy injects it into
outbound requests, so `gh` works inside the sandbox without any additional
configuration:

```console
$ sbx secret set github --command 'gh auth token'
```

The daemon runs `gh auth token` on the host and caches its output for 55 minutes
by default. After the cache expires, it runs the command again, so token updates
from `gh` don't need to be copied into `sbx` manually. Use `--refresh on-demand`
to run the command for every credential use.

The agent can then create pull requests, open issues, comment on PRs, and
interact with the GitHub API the same way it would from your host:

```console
# Inside the sandbox
$ gh pr create --title "feat: my feature" --body "..."
$ gh issue list
```

The token is never stored in plaintext inside the sandbox. See
[GitHub token](/ai/sandboxes/workflows/configuration/credentials/#github-token) for details.

## Docker registry

When using Docker Hub, authentication is handled automatically; `sbx` reuses
your existing login session. For other registries, you need to configure
credentials for `sbx` so it can pull private [templates](/ai/sandboxes/workflows/usage/#load-a-template)
and kits when creating a sandbox:

```console
$ gh auth token | sbx secret set --all-sandboxes --registry ghcr.io \
    --username <github-username> --password-stdin
$ echo "$ACR_PASSWORD" | sbx secret set --all-sandboxes \
    --registry myregistry.azurecr.io \
    --username myuser --password-stdin
```

Add `-g` or a sandbox name when the agent needs to run authenticated
`docker pull` or `docker push` commands from inside the sandbox. The host-side
proxy handles the registry login without writing the credential into the
sandbox.

Images and containers built inside the sandbox run on the sandbox's private
Docker daemon, not your host's. They're deleted when the sandbox is removed.

For information on how registry credentials differ from other secrets,
per-registry username requirements, and all-sandbox versus per-sandbox scoping, see
[Registry credentials](/ai/sandboxes/workflows/configuration/credentials/#registry-credentials).

## Source credentials from 1Password

Install the 1Password CLI, sign in on the host, and pass an `op://` reference to
`sbx secret set`. The secret store records the reference, and the daemon uses
`op read` on the host when the proxy needs the credential:

```console
$ sbx secret set github --ref 'op://Work/GitHub/token'
$ sbx secret set anthropic --ref 'op://Work/Anthropic/credential'
```

The real value stays on your host, and the sandbox sees the proxy-managed
placeholder. Service secrets are cached for 55 minutes by default. To retrieve
the value from 1Password for every credential use, set the refresh policy:

```console
$ sbx secret set anthropic \
    --ref 'op://Work/Anthropic/credential' \
    --refresh on-demand
```

## Source credentials from AWS Secrets Manager

Install and authenticate the AWS CLI on the host, then register the secret's
ARN. The daemon calls AWS Secrets Manager when the proxy needs the value:

```console
$ sbx secret set anthropic \
    --ref 'arn:aws:secretsmanager:us-west-2:123456789012:secret:anthropic-api-key'
```

See [Use a dynamic secret source](/ai/sandboxes/workflows/configuration/credentials/#use-a-dynamic-secret-source)
for refresh policies, verification options, custom secrets, and provider
account or profile selection.

<!-- page: https://docs.docker.com/ai/sandboxes/workflows/automation/ fetched 2026-10-08 -->

# Run sandboxes in CI


This page describes local sandboxes in CI. For cloud execution without local
virtualization, see [Run without attaching](/ai/sandboxes/workflows/cloud/usage/#run-without-attaching).

For CI environments and scripts where a browser isn't available, authenticate
with a Docker Personal Access Token (PAT):

```console
$ echo "$DOCKER_PAT" | sbx login --username <your-docker-id> --password-stdin
```

Generate a PAT from your
[Docker account settings](https://app.docker.com/settings/personal-access-tokens)
with at least **Read** scope.

Create the sandbox in the background with `sbx create`, run agent tasks with
`sbx exec`, and remove the sandbox when finished:

```console
$ sbx create --name ci-task --clone claude .
$ sbx run --name ci-task  # attach and give instructions, or use sbx exec for one-off commands
$ git fetch sandbox-ci-task
$ sbx rm --force ci-task
```

Agent credentials (API keys, GitHub token) can be preconfigured as global
secrets so they're available to any sandbox the CI runner creates. If the
relevant environment variables are already set in the CI environment (see the
[built-in services table](/ai/sandboxes/workflows/configuration/credentials/#built-in-services) for which
variables each service reads), import them all at once:

```console
$ sbx secret import --all
```

To overwrite an existing stored entry, add `--force`. To pass a value from your
CI provider's secret store, use `-t`. For example, in a GitHub Actions step:

```yaml
- run: sbx secret set anthropic -t "${{ secrets.ANTHROPIC_API_KEY }}"
```

## Cleanup and exit codes

Use `--force` to skip confirmation when removing resources in scripts.
Declining a removal or required-restart prompt returns a non-zero exit code.
Treat this as an incomplete operation when deciding whether to continue a
script.

For repeatable cleanup, check which resources exist before removing them. For
example, use `sbx mcp ls` before `sbx mcp rm`, which fails for an unregistered
server even with `--force`.

<!-- page: https://docs.docker.com/ai/sandboxes/workflows/development/ fetched 2026-10-08 -->

# Develop and test locally


This page describes local sandboxes, host services, and local port mappings.
For cloud endpoints, see [Expose a port](/ai/sandboxes/workflows/cloud/usage/#expose-a-port).

Use a sandbox's private runtime to build images, run tests, and connect local
tools to development services across the sandbox boundary.

## Build and test inside a sandbox

Agents have sudo access inside the sandbox, so they can install packages,
start databases, run test dependencies, and prepare the environment they need.
Installed packages persist for the sandbox's lifetime. For repeated setup, use
[Customize](/ai/sandboxes/workflows/customize) to package the environment as a template or kit.

Agents can also build Docker images, run containers, and use
[Compose](/compose/). Everything runs inside the sandbox's
private Docker daemon, so containers started by the agent never appear in your
host's `docker ps`. When you remove the sandbox, all images, containers, and
volumes inside it are deleted with it.

This pattern works well for tasks where the agent needs to run the project's
test suite or inspect a service it started. If you need to reach that service
from your host, publish the port when you create the sandbox, or publish it
later with `sbx ports`.

## Local services

Use this workflow when a sandboxed agent starts a dev server, or when the agent
needs to call a service running on your host.

### Accessing services in the sandbox

Sandboxes are [network-isolated](/ai/sandboxes/workflows/security/isolation/) — your browser or local
tools can't reach a server running inside one by default. A port mapping of
`8080:3000` publishes sandbox port 3000 on host port 8080.

If you know which ports you need, publish them when you create the sandbox:

```console
$ sbx run --publish 8080:3000 --name my-sandbox claude
```

For an existing sandbox, use [`sbx ports`](/reference/cli/sbx/ports/) to
forward traffic from your host. Publishing a port on a stopped local sandbox
starts it first.

The common case: an agent has started a dev server or API, and you want to open
it in your browser or run tests against it.

```console
$ sbx ports my-sandbox --publish 8080:3000
$ open http://localhost:8080
```

To let the OS pick a free host port instead of choosing one yourself, specify
only the sandbox port. Then use `sbx ports` to check which host port was
assigned:

```console
$ sbx ports my-sandbox --publish 3000
$ sbx ports my-sandbox
```

`sbx ls` shows active port mappings alongside each sandbox, and `sbx ports`
lists them in detail:

```console
$ sbx ls
SANDBOX         AGENT   STATUS   PORTS                    WORKSPACE
my-sandbox      claude  running  127.0.0.1:8080->3000/tcp4 /home/user/proj
```

To stop forwarding a port:

```console
$ sbx ports my-sandbox --unpublish 8080:3000
```

For a service to be reachable, it must listen on all interfaces inside the
sandbox, not only `127.0.0.1`. Bind it to `0.0.0.0` for IPv4 or `[::]` for both
IPv4 and IPv6. Most dev servers need a flag like `--host 0.0.0.0` to do this.

On the host, a published port binds IPv4 (`127.0.0.1`) unless you name another
protocol, so `http://localhost:<port>/` reaches a service listening on IPv4
whichever address your resolver picks for `localhost`. Naming an explicit IPv6
host address, such as `--publish [::1]:8080:3000`, defaults the protocol to
`tcp6` instead. To publish on both families use `--publish 8080:3000/tcp`, and
for IPv6 alone `/tcp6`. Both of
those require the sandboxed service to listen on IPv6 as well — bind it to
`[::]` — or a client arriving over `::1` has its connection accepted and then
reset.

Published ports survive restarts: `sbx` re-publishes them when the sandbox or
the daemon restarts. Explicit host ports are reused, while a port published with
an OS-assigned host port, such as `--publish 3000`, gets a different host port
on each start. Check `sbx ports my-sandbox` to find it. If an explicit host port
is already in use at restart, the CLI or the dashboard prompts you to choose
another. Removing the sandbox releases its ports.

When `sbx run` re-attaches to an existing sandbox, it ignores `--publish`. Use
`sbx ports` to publish ports on that sandbox. To stop forwarding,
`--unpublish 8080:3000` removes a single mapping, and `--unpublish 3000`
removes every host port mapped to sandbox port 3000.

### Accessing host services from a sandbox

Services running on your host are reachable from inside a sandbox using the
hostname `host.docker.internal`. Use this instead of `127.0.0.1` or your
machine's local network IP address, which are not reachable from inside the
sandbox.

The sandbox proxy translates `host.docker.internal` to `localhost` before
forwarding the request, so you must add the `localhost` address with the
specific port to your network policy allowlist:

```console
$ sbx policy allow network localhost:11434
```

Then use `host.docker.internal` in any configuration or request that points at
the host service. For example, to verify connectivity from a sandbox shell:

```console
$ curl http://host.docker.internal:11434
```

<!-- page: https://docs.docker.com/ai/sandboxes/workflows/git/ fetched 2026-10-08 -->

# Use Git with sandboxes


These workspace modes apply to local sandboxes. In cloud sandboxes,
[transfer files or clone a remote repository](/ai/sandboxes/workflows/cloud/usage/#transfer-files).
To copy a sandbox filesystem between environments, see
[Move a sandbox](/ai/sandboxes/workflows/cloud/move/). Host mounts and clone-mode volumes are not
included in that snapshot.

Sandboxes support three approaches for working with Git repositories. The
right choice depends on whether you want branch isolation and whether you
plan to run tasks in parallel:

|                           | Direct mode      | Clone mode (`--clone`)       | Host worktree                 |
| ------------------------- | ---------------- | ---------------------------- | ----------------------------- |
| Branch management         | You, on the host | Agent, inside the clone      | You, on the host              |
| Changes visible on host   | Immediately      | After fetch or agent push    | Immediately                   |
| Agent can use Git         | Yes              | Yes                          | No                            |
| Parallelism               | No               | Multiple agents, one sandbox | One sandbox per parallel task |
| Mode fixed at create time | No               | Yes                          | —                             |

## Direct mode

The simplest approach. The sandbox mounts your host working tree directly —
the agent edits files in place and changes appear immediately. You manage
branches yourself.

1. Check out the branch you want to work on:

   ```console
   $ git checkout -b feat/my-feature
   ```

2. Start the sandbox. No special flags needed:

   ```console
   $ sbx run claude
   ```

3. The agent edits files in your working tree. Review diffs, stage, and
   commit as you normally would:

   ```console
   $ git diff
   $ git add -p
   $ git commit
   $ git push -u origin feat/my-feature
   ```

Because the sandbox mounts your working tree, switching branches on the host
also changes what the agent sees. This makes direct mode well-suited for
focused, single-branch work where you're collaborating with the agent
turn-by-turn.

## Clone mode

In clone mode, `sbx` creates a separate Git clone inside the sandbox. The agent
edits this clone instead of your host working tree. Its changes stay inside the
sandbox until you fetch a branch or the agent pushes one to a remote. Your host
repository is also available at `/run/sandbox/source`, but only with read
access. The sandbox clone is not a Git worktree linked to your host checkout.

A single clone-mode sandbox can hold multiple branches and worktrees for
parallel tasks. The `--clone` flag creates the clone, but it doesn't separate
one task from another. To keep parallel tasks isolated, instruct your agent tool
to create a separate branch or worktree for each task.

> [!NOTE]
> `--clone` is a create-time flag and cannot be changed on an existing
> sandbox. To change a sandbox from clone mode to direct mode, remove and
> recreate it. To run both modes against the same repository, create separate
> sandboxes with distinct names.

### Sandbox remote behavior

The CLI copies Git remotes from your host repository, such as `origin` and
`upstream`, into the in-sandbox clone. Local-path remotes, such as `file://`
URLs and filesystem paths, aren't copied because they aren't reachable from
inside the sandbox.

The Git daemon that exposes the in-sandbox clone runs as part of the sandbox.
It's only reachable while the sandbox is running:

- `sbx stop` shuts down the daemon. `git fetch sandbox-<name>` fails until the
  sandbox starts again.
- Restarting the sandbox assigns another ephemeral port to the daemon. The CLI
  updates the `sandbox-<name>` remote URL in your host repository's Git config,
  so fetching continues without manual reconfiguration.
- `sbx rm` removes the sandbox, the daemon, the published port, and the
  `sandbox-<name>` remote entry from your host repository.

### Single task

1. Start a clone-mode sandbox:

   ```console
   $ sbx run --clone claude .
   ```

2. Ask the agent to create a branch before it starts editing:

   > Create a branch `feat/my-feature` and make the changes.

3. Fetch the agent's branch when it's done:

   ```console
   $ git fetch sandbox-<name>
   $ git log sandbox-<name>/feat/my-feature
   $ git diff main..sandbox-<name>/feat/my-feature
   ```

4. Pull the branch to the host and push, or ask the agent to push directly:

   ```console
   # Pull to host, then push
   $ git checkout -b feat/my-feature sandbox-<name>/feat/my-feature
   $ git push -u origin feat/my-feature
   $ gh pr create

   # Or ask the agent
   # "Push feat/my-feature to origin and open a PR."
   ```

### Parallel tasks

1. Start a clone-mode sandbox and open the
   [agents view](/ai/sandboxes/workflows/agents/claude-code/#agents-view):

   ```console
   $ sbx run --clone claude .
   ```

2. Dispatch each independent task to a separate background session. Your agent
   tool may use branches or worktrees to keep their changes separate. If it
   doesn't, add a project instruction such as:

   ```markdown
   Always start each task on its own git branch before making changes.
   ```

3. Fetch all branches when the agents are done:

   ```console
   $ git fetch sandbox-<name>
   $ git log sandbox-<name>/feat/task-a
   $ git log sandbox-<name>/feat/task-b
   ```

4. Check out the branches you want to keep and open PRs as normal.

## Host worktree

You can create a Git worktree on your host and point the sandbox at it. The
agent edits files directly in the worktree — but because the sandbox mounts
only the worktree directory (not the parent repository), it can't resolve the
`.git` pointer file and has no Git access. The agent can read and write files,
but can't commit, branch, or check status.

This is useful when you want branch isolation without the create-time
commitment of clone mode, and you're comfortable committing from the host
yourself after reviewing the changes.

1. Create the worktree on the host:

   ```console
   $ git worktree add -b feat/my-feature ../my-feature-work
   ```

2. Start the sandbox with the worktree as the workspace:

   ```console
   $ sbx run claude ../my-feature-work
   ```

3. The agent edits files. When it's done, commit and push from the host:

   ```console
   $ cd ../my-feature-work
   $ git diff
   $ git add -p && git commit
   $ git push -u origin feat/my-feature
   $ gh pr create
   ```

## Commit signing

SSH agent forwarding is enabled by default. When `SSH_AUTH_SOCK` is set,
sandboxes forward your host SSH agent into the sandbox, so the agent can sign
commits with your SSH key without the private key ever leaving your host. If
you turned off forwarding or use a fixed SSH agent socket, see
[SSH agent configuration](/ai/sandboxes/workflows/configuration/credentials/#ssh-agent).

1. Make sure the signing key is loaded in your host SSH agent:

   ```console
   $ ssh-add ~/.ssh/id_ed25519
   $ ssh-add -L  # confirm the key appears
   ```

2. Inside the sandbox, configure Git to sign with SSH. Use the forwarded key
   directly rather than a file path, since host paths don't exist inside the
   sandbox:

   ```console
   $ git config --global gpg.format ssh
   $ git config --global user.signingkey "key::$(ssh-add -L | head -n 1)"
   ```

3. Sign commits as usual:

   ```console
   $ git commit -S -m "feat: my change"
   ```

To apply this configuration automatically to every sandbox, use the
[`git-ssh-sign`](https://github.com/docker/sbx-kits-contrib/tree/main/git-ssh-sign)
community kit, which handles all of the above setup. For using it with the
built-in agents, see [Kits v2](/ai/sandboxes/workflows/customize/kits-v2/).

For troubleshooting, see
[Sandbox commits aren't signed](/ai/sandboxes/workflows/troubleshooting/#sandbox-commits-arent-signed).

