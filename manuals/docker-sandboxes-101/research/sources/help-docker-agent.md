# docker-agent help tree, captured 2026-10-08

```
docker-agent version v1.149.0
Commit: Homebrew
```

# docker-agent
```
Docker AI Agent Runner.

New to docker agent? Take the hands-on tour: docker agent getting-started

Usage:
  docker-agent [flags]
  docker-agent [command]

Examples:
  docker-agent run
  docker-agent run ./agent.yaml

Core Commands:
  getting-started Learn docker agent with a hands-on interactive tour
  run             Run an agent
  setup           Interactively set up a model (built-in provider, local, custom endpoint, or Claude Code)
  share           Share agents

Diagnose Commands:
  doctor          Diagnose model and credential setup
  models          List available models
  toolsets        List built-in toolset types

Advanced Commands:
  alias           Manage aliases
  board           Orchestrate agents on a Kanban board
  debug           Debug tools
  eval            Run evaluations for an agent
  new             Create a new agent configuration
  plans           Manage shared plans
  sandbox         Manage docker-agent sandbox settings
  serve           Start an agent as a server
  sessions        Inspect recorded sessions

Additional Commands:
  completion      Generate the autocompletion script for the specified shell
  help            Help about any command
  version         Print the version information

Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
  -h, --help                help for docker-agent
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker-agent [command] --help" for more information about a command.
```

## docker-agent run
```
Run an agent with the specified configuration and prompt

Usage:
  docker-agent run [<agent-file>|<registry-ref>] [message]... [flags]

Examples:
  docker-agent run ./agent.yaml
  docker-agent run ./team.yaml --agent root
  docker-agent run # project config or built-in default agent
  docker-agent run coder # built-in coding agent
  docker-agent run ./echo.yaml "INSTRUCTIONS"
  docker-agent run ./echo.yaml "First question" "Follow-up question"
  echo "INSTRUCTIONS" | docker-agent run ./echo.yaml -
  docker-agent run ./agent.yaml --record  # Records session + generates a TUI e2e test

Flags:
  -a, --agent string                          Name of the agent to run (defaults to the team's first agent)
      --agent-picker string[="defaults"]      Show a full-screen picker to choose an agent before launching. Optional comma-separated list of agent refs; "defaults" (or no value) offers the built-in agents plus any configs in ~/.agents
      --app-name string                       Application name shown in the TUI in place of "docker agent"
      --attach string                         Attach an image file to the message
      --cloud                                 Use a cloud sandbox (implies --sandbox; no host files or credentials are uploaded)
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --disable-commands strings              Comma-separated list of slash commands to hide and disable in the TUI (e.g. /cost,/eval,/model)
      --dry-run                               Initialize the agent without executing anything
      --env-from-file strings                 Set environment variables from file
      --exec                                  Execute without a TUI
      --fake string                           Replay AI responses from cassette file (for testing)
      --fake-stream int[=15]                  Simulate streaming with delay in ms between chunks (default 15ms if no value given)
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
  -h, --help                                  help for run
      --hide-tool-calls                       Hide the tool calls in the output
      --hide-tool-results                     Hide tool call results
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --json                                  Output results in JSON format
      --kit stringArray                       Additional sandbox mixin kit reference (repeatable)
      --kit-arg stringArray                   Sandbox kit argument KEY=VALUE (repeatable)
      --last                                  Print only the final agent answer (requires --exec); with --json, emit a JSON value
      --lean                                  Use a simplified TUI with minimal chrome
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --model stringArray                     Override agent model: [agent=]provider/model (repeatable)
      --models-gateway string                 Set the models gateway address
      --no-kit                                Do not stage a docker-agent kit (skills, prompt files) when running in a sandbox
      --on-event stringArray                  Run shell command on event: --on-event <type>=<cmd> (or *=<cmd> for any). Repeatable.
      --prompt-file stringArray               Append file contents to the prompt (repeatable)
      --record string[="true"]                Record AI API interactions to cassette file and generate a TUI e2e test from the session (auto-generates filename if empty)
      --remote string                         Use remote runtime with specified address
      --safety string                         Safety mode for tool approval: strict (ask for everything), balanced (auto-approve safe calls), restricted (auto-approve safe calls, deny the rest — for unattended runs), or autonomous (approve everything)
      --sandbox                               Run the agent inside a Docker sandbox
      --sandbox-kit string                    Sandbox workload kit reference (directory, ZIP, git, or OCI; must provide docker-agent)
      --sandbox-ttl duration                  Cloud sandbox time-to-live; stopped on expiry (default 1h0m0s)
      --sbx                                   Prefer the sbx CLI backend when available (set --sbx=false to force docker sandbox) (default true)
      --session string                        Continue from a previous session by ID or relative offset (e.g., -1 for last session). An explicit ID that does not exist yet is created with that ID.
  -s, --session-db string                     Path to the session database (default: <data-dir>/session.db)
      --session-read-only                     Open the session in read-only mode (view conversation history but prevent new messages)
      --sidebar                               Show the sidebar in the TUI (set --sidebar=false to hide it) (default true)
      --template string                       Local sandbox OCI image, or cloud template name with --cloud (default "docker/docker-agent-sbx-templates:latest")
      --theme string                          Preselect a TUI theme by name, or "auto" to match the terminal's light/dark background (overrides the theme from user config; ignored outside the interactive TUI)
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)
  -w, --worktree string[="auto"]              Run the agent in a fresh git worktree of the working directory (isolates changes from your checkout). Optionally name it: --worktree=my-name
      --worktree-base string                  Branch the --worktree from this ref instead of the current HEAD (e.g. main, origin/main). A remote-tracking ref is fetched first so the worktree starts from the latest remote state.
      --worktree-pr string                    Run the agent in a git worktree checked out on an existing GitHub pull request (number or URL). Continues the PR's branch; requires the GitHub CLI (gh).
      --yolo                                  Automatically approve all tool calls without prompting (same as --safety autonomous)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker-agent setup
```
Set up a model for docker agent, interactively.

Four paths:
  - Built-in cloud provider: pick a provider docker agent already knows
    (Anthropic, OpenAI, Google, Groq, Hugging Face, ...) and connect it.
    Credentials vary by provider: most paste an API key or token, stored in
    the docker agent env file (~/.config/cagent/.env), while chatgpt signs
    in with your ChatGPT account in the browser instead.
  - Local model: check Docker Model Runner and pull a model. No API key needed.
  - Custom OpenAI-compatible endpoint: for endpoints that are not built in
    (vLLM, LiteLLM, a corporate gateway, ...). Register the endpoint with
    its base URL, API format, and API key variable; the provider is saved
    to your user configuration and its models become usable everywhere via
    --model <name>/<model>.
  - Claude Code harness: use your Claude subscription through the official
    'claude' CLI. Checks that the CLI is installed and logged in (offering
    'claude auth login --claudeai'), then writes a ready-to-run agent file.
    No API key needed; docker agent never reads or copies the CLI's
    credentials.

Ends with the exact command to start chatting. Secret values are never
printed. Check the result anytime with 'docker agent doctor'.

Usage:
  docker-agent setup [flags]

Examples:
  docker-agent setup

Flags:
  -h, --help   help for setup

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker-agent share
```
Share agents

Usage:
  docker-agent share [command]

Available Commands:
  pull        Pull an agent from an OCI registry
  push        Push an agent to an OCI registry

Flags:
  -h, --help   help for share

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker-agent share [command] --help" for more information about a command.
```

### docker-agent share pull
```
Pull an agent configuration file from an OCI registry.

With --key, the pulled agent YAML is verified against the protection recorded
by 'share push --key': a signature is checked with the same secret or the
matching public key; an encrypted copy (push --encrypt) is decrypted with the
same secret or the matching private key and compared to the YAML. The key is
given inline, or as a path prefixed with file:// (e.g. --key file://~/.ssh/id_ed25519.pub).
With an asymmetric key the artifact must carry a signature. The pull fails if
the artifact is unprotected or the check does not pass.

Usage:
  docker-agent share pull <registry-ref> [flags]

Flags:
      --force        Force pull even if the configuration already exists locally
  -h, --help         help for pull
      --key string   Key used to verify the agent: PEM/OpenSSH key or symmetric secret, inline or as file://<path> (or set DOCKER_AGENT_ENCRYPT_KEY)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent share push
```
Push an agent configuration file to an OCI registry.

With --key, the agent YAML is protected and the proof is stored as manifest
annotations; the YAML itself is always pushed in clear. The key is given
inline, or as a path prefixed with file:// (e.g. --key file://~/.ssh/id_ed25519).
The key kind is detected from its contents: PEM or OpenSSH keys (Ed25519,
ECDSA, RSA) are asymmetric, anything else is a raw symmetric secret of at
least 16 bytes (e.g. 'openssl rand -hex 32') that must not contain PEM or
OpenSSH key markers.

  Default (sign):  a signature (private key) or MAC (secret) is recorded.
                   Holders of the public key or secret can check integrity
                   with 'share pull --key'.
  --encrypt:       an encrypted copy of the whole YAML is recorded as well,
                   so holders of the secret or private key can also recover
                   the YAML from the annotation alone. With an asymmetric
                   key this needs the private key and still records a
                   signature, since a copy encrypted to a public key proves
                   nothing about who published it. Ed25519 cannot encrypt.

Usage:
  docker-agent share push <agent-file> <registry-ref> [flags]

Flags:
      --encrypt      Also embed an encrypted copy of the agent in the annotations (requires --key)
  -h, --help         help for push
      --key string   Key used to protect the agent: PEM/OpenSSH key or symmetric secret, inline or as file://<path> (or set DOCKER_AGENT_ENCRYPT_KEY)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker-agent doctor
```
Diagnose the model and credential setup.

Reports, without ever printing secret values:
  - which model providers have credentials and where each credential comes from
  - whether Docker Model Runner is reachable and which models are pulled
  - which model the 'auto' selection would pick
  - with an agent file: the environment variables it requires and their status
  - with an agent file that uses a claude-code harness: whether the official
    'claude' CLI is installed and logged in (safe metadata only, no tokens)

Exits with a non-zero status when an issue would prevent an agent from running.

Usage:
  docker-agent doctor [agent-file]|[registry-ref] [flags]

Examples:
  docker-agent doctor
  docker-agent doctor ./agent.yaml
  docker-agent doctor --json

Flags:
      --env-from-file strings   Set environment variables from file
  -h, --help                    help for doctor
      --json                    Output in JSON format
      --models-gateway string   Set the models gateway address

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker-agent models
```
List models available for use with --model flag.

Shows models that can be passed to 'docker agent run --model' or
'docker agent new --model'. By default shows models from providers
you have credentials for. Use --all to include all providers.

Usage:
  docker-agent models [flags]
  docker-agent models [command]

Available Commands:
  list        List available models

Flags:
  -a, --all                     Include models from all providers, not just those with credentials
      --format string           Output format: table, json (default "table")
  -h, --help                    help for models
      --models-gateway string   Set the models gateway address
  -p, --provider string         Filter by provider name

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker-agent models [command] --help" for more information about a command.
```

### docker-agent models list
```
List available models

Usage:
  docker-agent models list [flags]

Aliases:
  list, ls

Examples:
  docker agent models
  docker agent models list --provider openai
  docker agent models ls --all
  docker agent models --format json

Flags:
  -a, --all               Include models from all providers, not just those with credentials
      --format string     Output format: table, json (default "table")
  -h, --help              help for list
  -p, --provider string   Filter by provider name

Global Flags:
      --cache-dir string        Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string       Override the config directory (default: ~/.config/cagent)
      --data-dir string         Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug                   Enable debug logging
      --log-file string         Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
      --models-gateway string   Set the models gateway address
  -o, --otel                    Enable OpenTelemetry tracing
```

## docker-agent toolsets
```
List the built-in toolset types available for use in an agent configuration.

Each type can be referenced under 'toolsets:' in an agent YAML file, for example:

  toolsets:
    - type: filesystem
    - type: shell

Usage:
  docker-agent toolsets [flags]

Examples:
  docker agent toolsets
  docker agent toolsets --format json

Flags:
      --format string   Output format: table, json (default "table")
  -h, --help            help for toolsets

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker-agent alias
```
Create and manage aliases for agent configurations or OCI registry references.

Usage:
  docker-agent alias [command]

Examples:
  # Create an alias for a registry agent
  docker-agent alias add code myorg/notion-expert

  # Create an alias for a local agent file
  docker-agent alias add myagent ~/myagent.yaml

  # List all registered aliases
  docker-agent alias list

  # List all registered aliases as JSON
  docker-agent alias list --json

  # Remove an alias
  docker-agent alias remove code

Available Commands:
  add         Add a new alias
  list        List all registered aliases
  remove      Remove a registered alias

Flags:
  -h, --help   help for alias

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker-agent alias [command] --help" for more information about a command.
```

### docker-agent alias add
```
Add a new alias for an agent configuration or OCI registry reference.

You can optionally specify runtime options that will be applied whenever
the alias is used:

  --yolo               Automatically approve all tool calls without prompting
  --safety             Default safety mode: strict, balanced, restricted, or autonomous
  --model              Override the agent's model (format: [agent=]provider/model)
  --hide-tool-results  Hide tool call results in the TUI
  --sandbox            Always run the agent inside a Docker sandbox

Usage:
  docker-agent alias add <alias-name> <agent-path> [flags]

Examples:
  # Create a simple alias
  docker-agent alias add code myorg/notion-expert

  # Create an alias that always runs in yolo mode
  docker-agent alias add yolo-coder myorg/coder --yolo

  # Create an alias that defaults to the balanced safety mode
  docker-agent alias add careful-coder myorg/coder --safety balanced

  # Create an alias with a specific model
  docker-agent alias add fast-coder myorg/coder --model openai/gpt-4o-mini

  # Create an alias with hidden tool results
  docker-agent alias add quiet myorg/coder --hide-tool-results

  # Create an alias that always runs in a sandbox
  docker-agent alias add safe-coder myorg/coder --sandbox

  # Create an alias with multiple options
  docker-agent alias add turbo myorg/coder --yolo --model anthropic/claude-sonnet-4-0

Flags:
  -h, --help                help for add
      --hide-tool-results   Hide tool call results in the TUI
      --model string        Override agent model (format: [agent=]provider/model)
      --safety string       Default safety mode when running the alias: strict, balanced, restricted, or autonomous (wins over --yolo)
      --sandbox             Always run the agent inside a Docker sandbox
      --yolo                Automatically approve all tool calls without prompting

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent alias list
```
List all registered aliases

Usage:
  docker-agent alias list [flags]

Aliases:
  list, ls

Flags:
  -h, --help   help for list
      --json   Output aliases as JSON

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent alias remove
```
Remove a registered alias

Usage:
  docker-agent alias remove <alias-name> [flags]

Aliases:
  remove, rm

Flags:
  -h, --help   help for remove

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker-agent board
```
Board is a Kanban TUI for orchestrating agents. Each card launches an agent
in a tmux session on an isolated git worktree, and moving a card forward
through the pipeline (Dev → Review → Push → Done) sends the
destination column's prompt to its agent.

Projects and column prompts are stored in the global config file
(~/.config/cagent/config.yaml) and can be managed from the TUI.

Usage:
  docker-agent board [flags]

Examples:
  docker-agent board

Flags:
  -h, --help   help for board

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker-agent debug
```
Debug tools

Usage:
  docker-agent debug [command]

Available Commands:
  auth        Print Docker authentication information
  config      Print the canonical form of an agent's configuration file
  oauth       OAuth token management
  skills      Debug the skills of an agent
  title       Generate a session title from a question
  tool        Call a tool of an agent directly
  toolsets    Debug the toolsets of an agent

Flags:
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
  -h, --help                                  help for debug
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker-agent debug [command] --help" for more information about a command.
```

### docker-agent debug auth
```
Print Docker authentication information

Usage:
  docker-agent debug auth [flags]

Flags:
  -h, --help   help for auth
      --json   Output in JSON format

Global Flags:
      --cache-dir string                      Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --config-dir string                     Override the config directory (default: ~/.config/cagent)
      --data-dir string                       Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug                                 Enable debug logging
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --log-file string                       Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
  -o, --otel                                  Enable OpenTelemetry tracing
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)
```

### docker-agent debug config
```
Print the canonical form of an agent's configuration file.

When flavors are given (positionally or with --flavor), they are applied in order and the
resolved config is printed without its 'flavors' section, since the patches are already baked in.

Usage:
  docker-agent debug config <agent-file>|<registry-ref> [flavor...] [flags]

Flags:
  -h, --help   help for config

Global Flags:
      --cache-dir string                      Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --config-dir string                     Override the config directory (default: ~/.config/cagent)
      --data-dir string                       Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug                                 Enable debug logging
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --log-file string                       Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
  -o, --otel                                  Enable OpenTelemetry tracing
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)
```

### docker-agent debug oauth
```
OAuth token management

Usage:
  docker-agent debug oauth [command]

Available Commands:
  list        List all stored OAuth tokens
  login       Perform OAuth login for a remote MCP server
  remove      Remove a stored OAuth token

Flags:
  -h, --help   help for oauth

Global Flags:
      --cache-dir string                      Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --config-dir string                     Override the config directory (default: ~/.config/cagent)
      --data-dir string                       Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug                                 Enable debug logging
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --log-file string                       Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
  -o, --otel                                  Enable OpenTelemetry tracing
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)

Use "docker-agent debug oauth [command] --help" for more information about a command.
```

#### docker-agent debug oauth list
```
List all stored OAuth tokens

Usage:
  docker-agent debug oauth list [flags]

Flags:
  -h, --help   help for list
      --json   Output in JSON format

Global Flags:
      --cache-dir string                      Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --config-dir string                     Override the config directory (default: ~/.config/cagent)
      --data-dir string                       Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug                                 Enable debug logging
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --log-file string                       Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
  -o, --otel                                  Enable OpenTelemetry tracing
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)
```

#### docker-agent debug oauth login
```
Perform OAuth login for a remote MCP server

Usage:
  docker-agent debug oauth login <agent-file> <mcp-name> [flags]

Flags:
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
  -h, --help                                  help for login
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

#### docker-agent debug oauth remove
```
Remove a stored OAuth token

Usage:
  docker-agent debug oauth remove <resource-url> [flags]

Flags:
  -h, --help   help for remove

Global Flags:
      --cache-dir string                      Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --config-dir string                     Override the config directory (default: ~/.config/cagent)
      --data-dir string                       Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug                                 Enable debug logging
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --log-file string                       Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
  -o, --otel                                  Enable OpenTelemetry tracing
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)
```

### docker-agent debug skills
```
Debug the skills of an agent

Usage:
  docker-agent debug skills <agent-file>|<registry-ref> [flags]

Flags:
  -h, --help   help for skills
      --json   Output in JSON format

Global Flags:
      --cache-dir string                      Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --config-dir string                     Override the config directory (default: ~/.config/cagent)
      --data-dir string                       Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug                                 Enable debug logging
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --log-file string                       Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
  -o, --otel                                  Enable OpenTelemetry tracing
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)
```

### docker-agent debug title
```
Generate a session title from a question

Usage:
  docker-agent debug title <agent-file>|<registry-ref> <question> [flags]

Flags:
  -h, --help                help for title
      --model stringArray   Override agent model: [agent=]provider/model (repeatable)

Global Flags:
      --cache-dir string                      Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --config-dir string                     Override the config directory (default: ~/.config/cagent)
      --data-dir string                       Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug                                 Enable debug logging
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --log-file string                       Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
  -o, --otel                                  Enable OpenTelemetry tracing
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)
```

### docker-agent debug tool
```
Call a tool of an agent directly, without an LLM turn.

Parameters must be a JSON object (defaults to {}). Use --agent to select an agent.
Use 'debug toolsets --json' to inspect tool names and parameter schemas.

Tool input transforms, response transforms, and post-tool-use hooks run by default.
Use --no-hook to skip them.
Calls have real side effects and bypass other hooks and approval checks.
Tools that require an agent runtime are not supported. Built-in background jobs
cannot be launched because toolsets are stopped when the command exits.

Usage:
  docker-agent debug tool <agent-file>|<registry-ref> <tool-name> [parameters-json] [flags]

Examples:
  docker agent debug tool agent.yaml read_file '{"path":"README.md"}'
  docker agent debug tool agent.yaml shell '{"cmd":"pwd"}' --agent root --json

Flags:
  -a, --agent string   Name of the agent (defaults to the team's default agent)
  -h, --help           help for tool
      --json           Output the full tool result in JSON format
      --no-hook        Skip tool input transforms, response transforms, and post-tool-use hooks

Global Flags:
      --cache-dir string                      Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --config-dir string                     Override the config directory (default: ~/.config/cagent)
      --data-dir string                       Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug                                 Enable debug logging
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --log-file string                       Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
  -o, --otel                                  Enable OpenTelemetry tracing
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)
```

### docker-agent debug toolsets
```
Debug the toolsets of an agent

Usage:
  docker-agent debug toolsets <agent-file>|<registry-ref> [flags]

Flags:
  -h, --help   help for toolsets
      --json   Output in JSON format

Global Flags:
      --cache-dir string                      Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --config-dir string                     Override the config directory (default: ~/.config/cagent)
      --data-dir string                       Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug                                 Enable debug logging
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --log-file string                       Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
  -o, --otel                                  Enable OpenTelemetry tracing
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)
```

## docker-agent eval
```
Run evaluations for an agent

Usage:
  docker-agent eval <agent-file>|<registry-ref> [<eval-dir>|./evals] [flags]

Flags:
      --agent-image string                    docker-agent image to inject into eval containers (default: pinned to this CLI's own release version, e.g. docker/docker-agent:1.2.3; falls back to docker/docker-agent:edge for dev builds); pass "none" to skip injection and trust the base image's own binary
      --base-image string                     Custom base image for running evaluations
      --baseline string                       Compare against a previously saved run JSON (<output>/<run>.json) and exit non-zero on regression
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
  -c, --concurrency int                       Number of concurrent evaluation runs (default 10)
      --container-runtime string              Container runtime executable for building and running evaluations (default "docker")
  -e, --env strings                           Environment variables to pass to container (KEY or KEY=VALUE)
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
  -h, --help                                  help for eval
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --judge-model string                    Model for relevance checking (provider/model, or a named evaluator with --judge-type evaluator) (default "openai/gpt-5.6-terra")
      --judge-type string                     Judge model type: llm or evaluator (default "llm")
      --keep-containers                       Keep containers after evaluation (don't use --rm)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
      --only strings                          Only run evaluations with file names matching these patterns (can be specified multiple times)
      --output string                         Directory for results and logs (default: <eval-dir>/results)
      --regression-tolerance float            How far an aggregate quality rate may fall before --baseline reports a regression (0-1)
      --repeat int                            Number of times to repeat each evaluation (useful for computing baselines) (default 1)
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker-agent new
```
Create a new agent configuration interactively.

The agent builder will ask questions about what you want the agent to do,
then generate a YAML configuration file you can use with 'docker-agent run'.

Optionally provide a description as an argument to skip the initial prompt.

Usage:
  docker-agent new [description] [flags]

Examples:
  docker-agent new
  docker-agent new "a web scraper that extracts product prices"
  docker-agent new --model openai/gpt-4o "a code reviewer agent"

Flags:
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
  -h, --help                                  help for new
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --max-iterations int                    Maximum number of agentic loop iterations to prevent infinite loops (default: 20 for DMR, unlimited for other providers)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --model docker agent setup              Model to use, optionally as provider/model where provider is one of: anthropic, openai, google, dmr, or a custom provider from docker agent setup. If omitted, provider is auto-selected based on available credentials or gateway
      --models-gateway string                 Set the models gateway address
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker-agent plans
```
Manage the plans agents collaborate on, from the host: the named,
versioned documents of the plan toolset, collaborated on across sessions.

Mutations guard against concurrent edits: pass --expected-version <n> (the
version from a previous get or list) to fail with exit code 3 when the plan
changed in the meantime, or pass --force to deliberately write without the
guard. The CLI never prompts.

Every subcommand accepts --json for stable machine-readable output on stdout;
failures are then reported as a single JSON object on stderr.

Usage:
  docker-agent plans [command]

Examples:
  docker-agent plans list
  docker-agent plans create release --file ./plan.md --title "Release plan"
  docker-agent plans get release
  docker-agent plans update release --file ./plan.md --expected-version 1
  docker-agent plans status release done --expected-version 2
  docker-agent plans export release --output ./plan.md
  docker-agent plans delete release --expected-version 3

Available Commands:
  create      Create a new shared plan
  delete      Delete a shared plan
  export      Write a plan's content to a file
  get         Print a plan's content and metadata
  list        List plans
  status      Set the status of an existing shared plan
  update      Replace the content of an existing shared plan

Flags:
  -h, --help   help for plans

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker-agent plans [command] --help" for more information about a command.
```

### docker-agent plans create
```
Create a new shared plan with content from --file (required; use "-" to
read stdin). The CLI never prompts for content.

Create is create-only: when a plan with the same name already exists the
command fails with a version conflict (exit code 3) instead of overwriting.

Usage:
  docker-agent plans create <name> [flags]

Examples:
  docker-agent plans create release --file ./plan.md --title "Release plan"
  cat plan.md | docker-agent plans create release --file -

Flags:
      --author string   Label identifying who wrote the plan
      --file string     File with the plan content ("-" reads stdin); required
  -h, --help            help for create
      --json            Output as JSON
      --status string   Free-form lifecycle status (e.g. draft, in-progress)
      --title string    Human-readable plan title

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent plans delete
```
Delete a shared plan. The CLI never prompts, so exactly one of
--expected-version or --force must be given: the former fails with exit
code 3 when the plan changed since it was read (leaving it in place), the
latter deletes unconditionally — which is also how a corrupt plan is
recovered.

Usage:
  docker-agent plans delete <name> [flags]

Aliases:
  delete, rm

Examples:
  docker-agent plans delete release --expected-version 3
  docker-agent plans delete release --force

Flags:
      --expected-version int   Version the plan is expected to be at; the write fails with a version conflict (exit code 3) when it changed
      --force                  Write unconditionally, without the optimistic-lock guard
  -h, --help                   help for delete
      --json                   Output as JSON

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent plans export
```
Write a plan's content, byte-exact, to --output (required). Parent
directories are created and the write is atomic, so a reader never observes
a partial export. An existing destination is refused and left untouched
unless --force is given, which replaces an existing regular file atomically.

Usage:
  docker-agent plans export <name> [flags]

Examples:
  docker-agent plans export release --output ./plan.md
  docker-agent plans export release --output ./plan.md --force

Flags:
      --force           Replace the destination file when it already exists
  -h, --help            help for export
      --json            Output as JSON
      --output string   Destination file for the plan content; required

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent plans get
```
Print a plan: its content goes to stdout and a concise metadata line goes
to stderr, so redirecting stdout captures the content alone (use export for a
byte-exact file copy).

Usage:
  docker-agent plans get <name> [flags]

Examples:
  docker-agent plans get release
  docker-agent plans get release --json

Flags:
  -h, --help   help for get
      --json   Output as JSON

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent plans list
```
List every shared plan with its metadata (content is not included).

Plans that exist but cannot be read are reported as warnings on stderr (in
the "warnings" field with --json) so they are never mistaken for missing.

Usage:
  docker-agent plans list [flags]

Aliases:
  list, ls

Flags:
  -h, --help   help for list
      --json   Output as JSON

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent plans status
```
Set a shared plan's free-form status (e.g. "in-progress", "blocked",
"done") without touching its body. Setting the status is a write and bumps
the version.

Exactly one of --expected-version or --force must be given.

Usage:
  docker-agent plans status <name> <status> [flags]

Examples:
  docker-agent plans status release done --expected-version 2
  docker-agent plans status release blocked --force

Flags:
      --expected-version int   Version the plan is expected to be at; the write fails with a version conflict (exit code 3) when it changed
      --force                  Write unconditionally, without the optimistic-lock guard
  -h, --help                   help for status
      --json                   Output as JSON

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent plans update
```
Replace the content of an existing shared plan with the contents of --file
(required; use "-" to read stdin). Update never creates a plan.

Metadata flags that are omitted keep their previous value; passing them
(including an empty value) overwrites it.

Exactly one of --expected-version or --force must be given: the former fails
with exit code 3 when the plan changed since it was read, the latter
deliberately replaces it unconditionally.

Usage:
  docker-agent plans update <name> [flags]

Examples:
  docker-agent plans update release --file ./plan.md --expected-version 1
  docker-agent plans update release --file ./plan.md --force --status in-progress

Flags:
      --author string          New author label (omit to preserve the current one)
      --expected-version int   Version the plan is expected to be at; the write fails with a version conflict (exit code 3) when it changed
      --file string            File with the new plan content ("-" reads stdin); required
      --force                  Write unconditionally, without the optimistic-lock guard
  -h, --help                   help for update
      --json                   Output as JSON
      --status string          New lifecycle status (omit to preserve the current one)
      --title string           New plan title (omit to preserve the current one)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker-agent sandbox
```
Manage persistent sandbox network allowlist entries shared across runs.

Usage:
  docker-agent sandbox [command]

Available Commands:
  allow       Add host(s) to the persistent sandbox network allowlist
  deny        Remove a host from the persistent sandbox network allowlist
  list        List the persistent sandbox network allowlist

Flags:
  -h, --help   help for sandbox

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker-agent sandbox [command] --help" for more information about a command.
```

### docker-agent sandbox allow
```
Add hosts to the user-level sandbox network allowlist.

Listed hosts are added to the sandbox proxy's allow rules on every
subsequent --sandbox run, in addition to the gateway, the kit-resolved
tool install hosts, and any runtime.network_allowlist declared by the
agent. Each entry is a hostname with an optional ":port" suffix.

This is the recommended fix for "Blocked by network policy" 403s on a
host the auto-installer can't infer (custom MCP endpoint, third-party
API, registry not covered by the aqua resolver):

  docker agent sandbox allow api.example.com

Usage:
  docker-agent sandbox allow <host> [<host>...] [flags]

Flags:
  -h, --help   help for allow

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent sandbox deny
```
Remove a host from the persistent sandbox network allowlist

Usage:
  docker-agent sandbox deny <host> [flags]

Aliases:
  deny, remove, rm

Flags:
  -h, --help   help for deny

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent sandbox list
```
List the persistent sandbox network allowlist

Usage:
  docker-agent sandbox list [flags]

Aliases:
  list, ls

Flags:
  -h, --help   help for list

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker-agent serve
```
Start an agent as a server

Usage:
  docker-agent serve [command]

Available Commands:
  a2a         Start an agent as an A2A (Agent-to-Agent) server
  acp         Start an agent as an ACP (Agent Client Protocol) server
  api         Start the API server
  chat        Start an agent as an OpenAI-compatible chat completions server
  mcp         Start an agent as an MCP (Model Context Protocol) server

Flags:
  -h, --help   help for serve

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker-agent serve [command] --help" for more information about a command.
```

### docker-agent serve a2a
```
Start an A2A server that exposes the agent via the Agent-to-Agent protocol

Usage:
  docker-agent serve a2a <agent-file>|<registry-ref> [flags]

Examples:
  docker-agent serve a2a ./agent.yaml
  docker-agent serve a2a myorg/agent:tag --listen 127.0.0.1:9090

Flags:
  -a, --agent string                          Name of the agent to run (defaults to the team's first agent)
      --auth-token string                     Bearer token required for all A2A requests
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --cors-origin string                    Allowed browser origin(s), comma-separated; empty disables CORS
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
  -h, --help                                  help for a2a
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --insecure-no-auth                      Allow unauthenticated non-loopback binding (insecure)
  -l, --listen string                         Address to listen on (default "127.0.0.1:8082")
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
      --safety string                         Tool safety policy (strict, balanced, restricted, autonomous)
  -s, --session-db string                     Path to the session database (default: <data-dir>/session.db)
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent serve acp
```
Start an ACP server that exposes the agent via the Agent Client Protocol

Usage:
  docker-agent serve acp <agent-file>|<registry-ref> [flags]

Examples:
  docker-agent serve acp ./agent.yaml
  docker-agent serve acp ./team.yaml
  docker-agent serve acp myorg/agent:tag

Flags:
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
  -h, --help                                  help for acp
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
  -s, --session-db string                     Path to the session database (default: <data-dir>/session.db)
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent serve api
```
Start the API server

Usage:
  docker-agent serve api <agent-file>|<agents-dir> [flags]

Flags:
      --auth-token string                     Bearer token required for API requests (empty = no authentication)
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --env-from-file strings                 Set environment variables from file
      --fake string                           Replay AI responses from cassette file (for testing)
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
  -h, --help                                  help for api
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
  -l, --listen string                         Address to listen on (default "127.0.0.1:8080")
      --max-request-size int                  Maximum request body size in bytes (default 1 MiB). Requests exceeding this limit are rejected with HTTP 413. (default 1048576)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
      --pull-interval int                     Auto-pull OCI reference every N minutes (0 = disabled)
      --record string                         Record AI API interactions to cassette file
  -s, --session-db string                     Path to the session database (default "session.db")
      --session-workingdir-root string        Restrict the working_dir of sessions created via POST /api/sessions to this directory and its descendants (empty = no restriction; recommended for multi-user deployments)
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent serve chat
```
Start an HTTP server that exposes the agent through an OpenAI-compatible
API at /v1/chat/completions and /v1/models. This lets tools that already
speak OpenAI's chat protocol (such as Open WebUI) drive a docker-agent
agent without any custom integration.

Usage:
  docker-agent serve chat <agent-file>|<registry-ref> [flags]

Examples:
  docker-agent serve chat ./agent.yaml
  docker-agent serve chat ./team.yaml --agent reviewer
  docker-agent serve chat myorg/agent:tag --listen 127.0.0.1:9090

Flags:
  -a, --agent string                          Name of the agent to expose (all agents if not specified)
      --api-key string                        Required Bearer token clients must present (Authorization: Bearer <token>); empty disables auth
      --api-key-env string                    Read the API key from this environment variable instead of the command line
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --conversation-ttl duration             Idle TTL after which a cached conversation is evicted (default 30m0s)
      --conversations-max int                 Cache up to N conversations server-side, keyed by X-Conversation-Id (0 disables; clients must resend full history)
      --cors-origin string                    Allowed CORS origin (e.g. https://example.com); empty disables CORS entirely
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
  -h, --help                                  help for chat
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --insecure-no-auth                      Allow unauthenticated non-loopback binding (insecure)
  -l, --listen string                         Address to listen on (default "127.0.0.1:8083")
      --max-idle-runtimes int                 Maximum number of idle runtimes pooled per agent (0 disables pooling) (default 4)
      --max-request-size int                  Maximum request body size in bytes (default 1 MiB) (default 1048576)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
      --request-timeout duration              Per-request timeout (covers model + tool calls + streaming) (default 5m0s)
      --safety string                         Tool safety policy (strict, balanced, restricted, autonomous)
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker-agent serve mcp
```
Start an MCP server that exposes the agent via the Model Context Protocol. By default, uses stdio transport. Use --http to start a streaming HTTP server instead. Use --attach to expose a running TUI's session instead of an agent file.

Usage:
  docker-agent serve mcp <agent-file>|<registry-ref> [flags]

Examples:
  docker-agent serve mcp ./agent.yaml
  docker-agent serve mcp ./team.yaml
  docker-agent serve mcp myorg/agent:tag
  docker-agent serve mcp ./agent.yaml --http --listen 127.0.0.1:9090
  docker-agent serve mcp --attach

Flags:
  -a, --agent string                          Name of the agent to run (all agents if not specified)
      --attach string[="latest"]              Attach to a running TUI run by pid, address, or session id (or empty for the most recent)
      --auth-token string                     Bearer token required for HTTP MCP requests; only valid with --http
      --code-mode-tools                       Provide a single tool to call other tools via Javascript
      --env-from-file strings                 Set environment variables from file
      --flavor stringArray                    Enable a config flavor, a YAML patch defined under the config's 'flavors' section (repeatable, applied in order)
  -h, --help                                  help for mcp
      --hook-on-user-input stringArray        Add an on-user-input hook command (repeatable)
      --hook-post-tool-use stringArray        Add a post-tool-use hook command that runs after every tool call (repeatable)
      --hook-pre-tool-use stringArray         Add a pre-tool-use hook command that runs before every tool call (repeatable)
      --hook-session-end stringArray          Add a session-end hook command (repeatable)
      --hook-session-start stringArray        Add a session-start hook command (repeatable)
      --hook-stop stringArray                 Add a stop hook command, fired when the model finishes responding (repeatable)
      --http                                  Use streaming HTTP transport instead of stdio
      --insecure-no-auth                      Allow unauthenticated non-loopback HTTP binding (insecure); only valid with --http
  -l, --listen string                         Address to listen on (default "127.0.0.1:8081")
      --mcp-keepalive duration                Interval between MCP keep-alive pings (e.g. 30s); 0 disables keep-alive; only valid when serving an agent over stdio (not --http or --attach)
      --mcp-oauth-redirect-uri redirect_uri   Public HTTPS URL to advertise as the OAuth redirect_uri for MCP servers running in unmanaged OAuth mode. When set, docker-agent drives the OAuth flow itself (PKCE + DCR + token exchange) and expects clients to return `{code, state}` via ResumeElicitation. When empty, the client is expected to perform the OAuth flow and return an access token (legacy behavior).
      --models-gateway string                 Set the models gateway address
      --safety string                         Tool safety policy (strict, balanced, restricted, autonomous); only valid with --http
      --tool-name string                      Override the MCP tool identifier clients call (defaults to agent name); only valid when exposing a single agent
      --working-dir string                    Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker-agent sessions
```
Inspect recorded sessions

Usage:
  docker-agent sessions [command]

Available Commands:
  diff        Compare the behaviour of two recorded sessions

Flags:
  -h, --help   help for sessions

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker-agent sessions [command] --help" for more information about a command.
```

### docker-agent sessions diff
```
Compare two recorded sessions and report the first point where the agent
behaved differently.

Comparison is over the sequence of tool calls, not over the assistant's prose.
Model output is nondeterministic: two runs of the same task almost always word
things differently while doing exactly the same work, so diffing text would report
a difference on every comparison. The tool calls are what changed the world, so
they are what is compared.

Reporting stops at the first divergence: everything after it is downstream of that
difference and comparing it produces noise rather than information.

Usage:
  docker-agent sessions diff <session-a> <session-b> [flags]

Examples:
  docker agent sessions diff <session-a> <session-b>
  docker agent sessions diff -1 -2
  docker agent sessions diff <a> <b> --json | jq '.divergence.turn_index'
  docker agent sessions diff <a> <b> --fail-on-divergence

Flags:
      --fail-on-divergence   Exit non-zero when the two sessions diverge
  -h, --help                 help for diff
      --json                 Emit the comparison as JSON
  -s, --session-db string    Path to the session database (default: <data-dir>/session.db)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker-agent version
```
Display the version and commit hash

Usage:
  docker-agent version [flags]

Flags:
  -h, --help   help for version

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent; env: DOCKER_AGENT_DATA_DIR)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

