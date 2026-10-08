# docker-agent commands

> Every command of docker-agent 1.149.0 in the four groups of its root help, every global flag, and every `serve` subcommand with its default listen address.

The root help of docker-agent 1.149.0 lists 19 commands in four groups: Core, Diagnose, Advanced, and Additional {{help-agent docker-agent}}. With subcommands, the vendored tree holds 47 pages. The binary is the Homebrew build. The Desktop plugin `docker agent` runs the same commands with a space in the name ([conflict C48](#s-ref-sources-and-the-conflicts-register)). The docs page `features/cli` is the only other reference, because `/reference/cli/docker/agent/` does not exist ([conflict C68](#s-ref-sources-and-the-conflicts-register)).

## Global flags

Every command accepts these flags {{help-agent docker-agent}}.

| Flag | Default | Meaning |
|---|---|---|
| `--cache-dir` | `~/Library/Caches/cagent` on macOS | Override the cache directory |
| `--config-dir` | `~/.config/cagent` | Override the config directory. The docs add that `DOCKER_AGENT_CONFIG_DIR` and the legacy `CAGENT_CONFIG_DIR` set the same path {{docs-agent features/cli}} |
| `--data-dir` | `~/.cagent`, or `DOCKER_AGENT_DATA_DIR` | Override the data directory, which holds `session.db`, worktrees, and plans {{docs-agent features/cli}} |
| `-d, --debug` | off | Enable debug logging |
| `--log-file` | `~/.cagent/cagent.debug.log` | Path of the debug log, used only with `--debug` |
| `-o, --otel` | off | Enable OpenTelemetry tracing |
| `-h, --help` | none | Print the help of the command |

## Core commands

| Command | Purpose | Flags that matter | Needs | Section |
|---|---|---|---|---|
| `getting-started` | Learn docker agent with a hands-on interactive tour {{help-agent docker-agent}} | none. The tree has no page for it ([conflict C75](#s-ref-sources-and-the-conflicts-register)). The docs describe a two minute skippable tour, also reachable as `docker agent tour` {{docs-agent features/cli}} | an interactive terminal | [§5.1](#s-docker-agent-run-new-and-doctor) |
| `run [<agent-file>\|<registry-ref>] [message]...` | Run an agent from a file, a registry reference, an alias, or the built-in default {{help-agent docker-agent run}} | see the table below | a model with a credential, Docker Model Runner, or `--fake` | [§5.1](#s-docker-agent-run-new-and-doctor) |
| `setup` | Set up a model through one of four paths: a built-in provider, Docker Model Runner, a custom OpenAI-compatible endpoint, or the Claude Code harness {{help-agent docker-agent setup}} | none | a terminal. The provider path writes `~/.config/cagent/.env` | [§5.1](#s-docker-agent-run-new-and-doctor) |
| `share push <agent-file> <registry-ref>` | Push an agent file to an OCI registry, in clear, with an optional signature or MAC in the annotations {{help-agent docker-agent share push}} | `--key` (PEM, OpenSSH, or a 16 byte secret, or `DOCKER_AGENT_ENCRYPT_KEY`), `--encrypt` | registry access | [§6.4](#s-share-push-and-share-pull) |
| `share pull <registry-ref>` | Pull an agent file and, with a key, verify or decrypt it {{help-agent docker-agent share pull}} | `--key`, `--force` | registry access | [§6.4](#s-share-push-and-share-pull) |

## The flags of run

The `run` page lists 54 flags {{help-agent docker-agent run}}. This table groups the ones the manual uses, with their defaults.

| Group | Flags |
|---|---|
| Agent and input | `-a, --agent` (the team's first agent), `--agent-picker [refs]`, `--prompt-file` (repeatable), `--attach <image>`, `-` reads the message from stdin |
| Output | `--exec` (no TUI), `--last` (only the final answer, needs `--exec`), `--json` (NDJSON events), `--hide-tool-calls`, `--hide-tool-results`, `--on-event <type>=<cmd>` |
| Approval | `--safety strict\|balanced\|restricted\|autonomous`, `--yolo` (same as `--safety autonomous`, [conflict C59](#s-ref-sources-and-the-conflicts-register)) |
| Model | `--model [agent=]provider/model` (repeatable), `--models-gateway`, `--dry-run` |
| Session | `--session <id or -1>`, `-s, --session-db` (default `<data-dir>/session.db`), `--session-read-only`, `--working-dir` |
| Record and replay | `--record [path]` (a cassette plus a TUI e2e test), `--fake <path>`, `--fake-stream [15]` ms between chunks |
| Sandbox | `--sandbox`, `--sbx` (default `true`, and `--sbx=false` forces the removed `docker sandbox` plugin, [conflict C60](#s-ref-sources-and-the-conflicts-register)), `--template` (default `docker/docker-agent-sbx-templates:latest`), `--sandbox-kit`, `--kit` (repeatable), `--kit-arg`, `--no-kit`, `--cloud` (implies `--sandbox`), `--sandbox-ttl` (default `1h0m0s`) |
| Hooks | `--hook-pre-tool-use`, `--hook-post-tool-use`, `--hook-session-start`, `--hook-session-end`, `--hook-on-user-input`, `--hook-stop`, all repeatable |
| Config | `--flavor` (repeatable, applied in order), `--env-from-file`, `--code-mode-tools`, `--mcp-oauth-redirect-uri`, `--remote <addr>` |
| Worktree | `-w, --worktree [name]` (default `auto`), `--worktree-base <ref>`, `--worktree-pr <number or URL>` (needs the GitHub CLI) |
| TUI | `--lean`, `--sidebar` (default `true`), `--theme`, `--app-name`, `--disable-commands` |

## Diagnose commands

| Command | Purpose | Flags that matter | Needs | Section |
|---|---|---|---|---|
| `doctor [agent-file]` | Report which providers have credentials, whether Docker Model Runner answers, and which model `auto` picks, and exit non-zero on an issue {{help-agent docker-agent doctor}} | `--json`, `--env-from-file`, `--models-gateway` | nothing. It runs `docker model status --json` to check the runner | [§5.1](#s-docker-agent-run-new-and-doctor) |
| `models [list\|ls]` | List the models `--model` accepts, from the gateway `/v1/models` first, then from the providers with credentials {{help-agent docker-agent models}} | `-a, --all`, `-p, --provider`, `--format table\|json`, `--models-gateway` | nothing | [§5.1](#s-docker-agent-run-new-and-doctor) |
| `toolsets` | List the 27 built-in toolset types {{help-agent docker-agent toolsets}} | `--format table\|json` | nothing | [§5.3](#s-toolsets-and-mcps) and [R.5](#s-ref-toolsets) |

## Advanced commands

| Command | Purpose | Flags that matter | Needs | Section |
|---|---|---|---|---|
| `alias add <alias-name> <agent-path>` | Save a name for an agent file or registry reference with run options {{help-agent docker-agent alias add}} | `--yolo`, `--safety` (wins over `--yolo`), `--model`, `--hide-tool-results`, `--sandbox` | nothing | [§5.1](#s-docker-agent-run-new-and-doctor) |
| `alias list\|ls`, `alias remove\|rm <alias-name>` | List or remove aliases {{help-agent docker-agent alias list}} | `--json` | nothing | [§5.1](#s-docker-agent-run-new-and-doctor) |
| `board` | Open a Kanban TUI where each card runs an agent in a tmux session on its own git worktree {{help-agent docker-agent board}} | none | tmux, git, and projects in `~/.config/cagent/config.yaml` | none |
| `debug auth` | Print the Docker token in use and where it came from {{help-agent docker-agent debug auth}} | `--json` | nothing | [R.6](#s-ref-providers-and-models) |
| `debug config <agent-file> [flavor...]` | Print the canonical form of an agent file with the flavors applied {{help-agent docker-agent debug config}} | the `debug` group flags | nothing | [§5.2](#s-agents-models-and-providers) |
| `debug oauth list\|login\|remove` | List stored OAuth tokens, log in to a remote MCP server, or remove a token {{help-agent docker-agent debug oauth}} | `--json` (list) | a browser for `login` | [§5.3](#s-toolsets-and-mcps) |
| `debug skills <agent-file>` | Show the skills an agent discovers {{help-agent docker-agent debug skills}} | `--json` | nothing | [§4.5](#s-sbx-skills-add-and-skills-true) |
| `debug title <agent-file> <question>` | Generate a session title from a question {{help-agent docker-agent debug title}} | `--model` | a model | [§5.6](#s-session-db-sessions-diff-and-eval) |
| `debug tool <agent-file> <tool-name> [parameters-json]` | Call one tool directly, with real side effects and no model turn {{help-agent docker-agent debug tool}} | `-a, --agent`, `--json`, `--no-hook` | whatever the tool needs | [§5.3](#s-toolsets-and-mcps) |
| `debug toolsets <agent-file>` | List the tools and parameter schemas of an agent {{help-agent docker-agent debug toolsets}} | `--json` | nothing | [§5.3](#s-toolsets-and-mcps) |
| `eval <agent-file> [<eval-dir>]` | Replay saved sessions in containers and score them {{help-agent docker-agent eval}} | `-c, --concurrency` (default `10`), `--judge-model` (default `openai/gpt-5.6-terra`), `--judge-type llm\|evaluator` (default `llm`), `--agent-image` (default the pinned `docker/docker-agent:<version>`), `--base-image`, `--container-runtime` (default `docker`), `-e, --env`, `--keep-containers`, `--only`, `--output` (default `<eval-dir>/results`), `--repeat` (default `1`), `--baseline`, `--regression-tolerance` ([conflict C65](#s-ref-sources-and-the-conflicts-register)) | a container runtime and a judge model | [§5.6](#s-session-db-sessions-diff-and-eval) |
| `new [description]` | Write a new agent file from a description {{help-agent docker-agent new}} | `--model` (anthropic, openai, google, dmr, or a custom provider, [conflict C66](#s-ref-sources-and-the-conflicts-register)), `--max-iterations` (default 20 for DMR, unlimited elsewhere) | a model | [§5.1](#s-docker-agent-run-new-and-doctor) |
| `plans create\|delete\|export\|get\|list\|status\|update` | Edit the shared plans of the `plan` toolset from the host, with an optimistic lock {{help-agent docker-agent plans}} | `--file` (`-` is stdin), `--title`, `--author`, `--status`, `--expected-version` (exit code 3 on conflict), `--force`, `--output`, `--json` | nothing | §5.4, whose file name the lexicon audit rejects as a link target |
| `sandbox allow <host>...` | Add hosts to the persistent allowlist of every later `--sandbox` run {{help-agent docker-agent sandbox allow}} | none | nothing | [§1.2](#s-docker-agent-run-sandbox-end-to-end) |
| `sandbox deny\|remove\|rm <host>`, `sandbox list\|ls` | Remove a host, or list the allowlist {{help-agent docker-agent sandbox}} | none | nothing | [§1.2](#s-docker-agent-run-sandbox-end-to-end) |
| `serve a2a\|acp\|api\|chat\|mcp` | Start an agent as a server {{help-agent docker-agent serve}} | see the table below | a model | [§6.1](#s-serve-api-and-serve-chat) to [§6.3](#s-serve-a2a) |
| `sessions diff <session-a> <session-b>` | Report the first tool call where two recorded sessions differ {{help-agent docker-agent sessions diff}} | `--json`, `--fail-on-divergence`, `-s, --session-db` | nothing | [§5.6](#s-session-db-sessions-diff-and-eval) |

The `debug` group shares one flag set: `--code-mode-tools`, `--env-from-file`, `--flavor`, the six `--hook-*` flags, `--mcp-oauth-redirect-uri`, `--models-gateway`, and `--working-dir` {{help-agent docker-agent debug}}. The same flags appear on `eval`, `new`, and every `serve` subcommand.

## The serve subcommands

| Subcommand | Transport | Default listen address | Session database | Auth and safety flags | Section |
|---|---|---|---|---|---|
| `serve a2a <agent-file>` | HTTP, the Agent-to-Agent protocol {{help-agent docker-agent serve a2a}} | `127.0.0.1:8082` | `<data-dir>/session.db` | `--auth-token`, `--insecure-no-auth`, `--cors-origin`, `--safety`, `-a` (the team's first agent, [conflict C64](#s-ref-sources-and-the-conflicts-register)) | [§6.3](#s-serve-a2a) |
| `serve acp <agent-file>` | stdio, the Agent Client Protocol {{help-agent docker-agent serve acp}} | none | `<data-dir>/session.db` | none | [§6.2](#s-serve-mcp-and-serve-acp) |
| `serve api <agent-file>\|<agents-dir>` | HTTP, sessions and SSE {{help-agent docker-agent serve api}} | `127.0.0.1:8080` | `session.db` in the current directory ([conflict C63](#s-ref-sources-and-the-conflicts-register)) | `--auth-token` (empty disables auth), `--max-request-size` (default `1048576`), `--session-workingdir-root`, `--pull-interval` (0 disables), `--fake`, `--record` | [§6.1](#s-serve-api-and-serve-chat) |
| `serve chat <agent-file>` | HTTP, `/v1/chat/completions` and `/v1/models` {{help-agent docker-agent serve chat}} | `127.0.0.1:8083` | no flag | `--api-key`, `--api-key-env`, `--insecure-no-auth`, `--cors-origin`, `--safety`, `--conversations-max`, `--conversation-ttl` (default `30m0s`), `--request-timeout` (default `5m0s`), `--max-idle-runtimes` (default `4`), `--max-request-size`, `-a` (all agents if not set) | [§6.1](#s-serve-api-and-serve-chat) |
| `serve mcp <agent-file>` | stdio by default, streaming HTTP with `--http` {{help-agent docker-agent serve mcp}} | `127.0.0.1:8081` with `--http` | no flag | `--auth-token`, `--insecure-no-auth`, and `--safety` only with `--http`, `--attach [latest]` to expose a running TUI, `--tool-name`, `--mcp-keepalive` (stdio only), `-a` (all agents if not set) | [§6.2](#s-serve-mcp-and-serve-acp) |

The help text names the four safety modes on `serve a2a`, `serve chat`, and `serve mcp --http`, and states no default for them. The default inside each server is therefore not documented in the help.

## Additional commands

| Command | Purpose | Flags that matter | Needs | Section |
|---|---|---|---|---|
| `completion` | Generate the autocompletion script for a shell {{help-agent docker-agent}} | its page is not in the vendored tree | nothing | none |
| `help` | Help about any command {{help-agent docker-agent}} | its page is not in the vendored tree | nothing | none |
| `version` | Print the version and the commit hash {{help-agent docker-agent version}} | none | nothing | [§1.1](#s-sbx-and-docker-agent) |

On the capture machine `docker-agent version` printed `v1.149.0` and `Commit: Homebrew` (research/sources/probes/docker-agent-version.txt).

Sources: research/sources/help-docker-agent.md (every `docker-agent` help page, docker-agent v1.149.0, Commit: Homebrew); research/sources/docs-docker-agent.md (page features/cli for `getting-started`, `--config-dir`, and `--data-dir`); research/sources/probes/docker-agent-version.txt, docker-agent-toolsets.txt; research/conflicts-register.md rows C48, C59, C60, C63, C64, C65, C66, C68, C75; manual.json (section files and ids)
