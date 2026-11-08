# docker agent --help (plugin v1.32.4, captured 2026-10-08)

```
Usage:
  docker agent
  docker agent [command]

Examples:
  docker agent run
  docker agent run ./agent.yaml
  docker agent run agentcatalog/pirate

Core Commands:
  new         Create a new agent configuration
  run         Run an agent
  share       Share agents

Advanced Commands:
  alias       Manage aliases
  eval        Run evaluations for an agent
  serve       Start an agent as a server

Additional Commands:
  version     Print the version information

Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker agent [command] --help" for more information about a command.
```

## docker agent alias
```
Usage:
  docker agent alias [command]

Examples:
  # Create an alias for a catalog agent
  docker agent alias add code agentcatalog/notion-expert

  # Create an alias for a local agent file
  docker agent alias add myagent ~/myagent.yaml

  # List all registered aliases
  docker agent alias list

  # Remove an alias
  docker agent alias remove code

Available Commands:
  add         Add a new alias
  list        List all registered aliases
  remove      Remove a registered alias

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker agent alias [command] --help" for more information about a command.
```

### docker agent alias add
```
Usage:
  docker agent alias add <alias-name> <agent-path>

Examples:
  # Create a simple alias
  docker agent alias add code agentcatalog/notion-expert

  # Create an alias that always runs in yolo mode
  docker agent alias add yolo-coder agentcatalog/coder --yolo

  # Create an alias with a specific model
  docker agent alias add fast-coder agentcatalog/coder --model openai/gpt-4o-mini

  # Create an alias with hidden tool results
  docker agent alias add quiet agentcatalog/coder --hide-tool-results

  # Create an alias with multiple options
  docker agent alias add turbo agentcatalog/coder --yolo --model anthropic/claude-sonnet-4-0

Flags:
      --hide-tool-results   Hide tool call results in the TUI
      --model string        Override agent model (format: [agent=]provider/model)
      --yolo                Automatically approve all tool calls without prompting

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker agent alias list
```
Usage:
  docker agent alias list

Aliases:
  list, ls

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker agent alias remove
```
Usage:
  docker agent alias remove <alias-name>

Aliases:
  remove, rm

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker agent docker
```
Usage:
  docker agent
  docker agent [command]

Examples:
  docker agent run
  docker agent run ./agent.yaml
  docker agent run agentcatalog/pirate

Core Commands:
  new         Create a new agent configuration
  run         Run an agent
  share       Share agents

Advanced Commands:
  alias       Manage aliases
  eval        Run evaluations for an agent
  serve       Start an agent as a server

Additional Commands:
  version     Print the version information

Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker agent [command] --help" for more information about a command.
```

## docker agent eval
```
Usage:
  docker agent eval <agent-file>|<registry-ref> [<eval-dir>|./evals]

Flags:
      --base-image string       Custom base Docker image for running evaluations
      --code-mode-tools         Provide a single tool to call other tools via Javascript
  -c, --concurrency int         Number of concurrent evaluation runs (default 10)
  -e, --env strings             Environment variables to pass to container (KEY or KEY=VALUE)
      --env-from-file strings   Set environment variables from file
      --judge-model string      Model to use for relevance checking (format: provider/model) (default "anthropic/claude-opus-4-5-20251101")
      --keep-containers         Keep containers after evaluation (don't use --rm)
      --models-gateway string   Set the models gateway address
      --only strings            Only run evaluations with file names matching these patterns (can be specified multiple times)
      --output string           Directory for results and logs (default: <eval-dir>/results)
      --working-dir string      Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker agent new
```
Usage:
  docker agent new [description]

Examples:
  docker agent new
  docker agent new "a web scraper that extracts product prices"
  docker agent new --model openai/gpt-4o "a code reviewer agent"

Flags:
      --code-mode-tools         Provide a single tool to call other tools via Javascript
      --env-from-file strings   Set environment variables from file
      --max-iterations int      Maximum number of agentic loop iterations to prevent infinite loops (default: 20 for DMR, unlimited for other providers)
      --model string            Model to use, optionally as provider/model where provider is one of: anthropic, openai, google, dmr. If omitted, provider is auto-selected based on available credentials or gateway
      --models-gateway string   Set the models gateway address
      --working-dir string      Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker agent run
```
Usage:
  docker agent run [<agent-file>|<registry-ref>] [message]...

Examples:
  docker agent run ./agent.yaml
  docker agent run ./team.yaml --agent root
  docker agent run # built-in default agent
  docker agent run coder # built-in coding agent
  docker agent run ./echo.yaml "INSTRUCTIONS"
  docker agent run ./echo.yaml "First question" "Follow-up question"
  echo "INSTRUCTIONS" | docker agent run ./echo.yaml -
  docker agent run ./agent.yaml --record  # Records session to auto-generated file

Flags:
  -a, --agent string              Name of the agent to run (default "root")
      --attach string             Attach an image file to the message
      --code-mode-tools           Provide a single tool to call other tools via Javascript
      --dry-run                   Initialize the agent without executing anything
      --env-from-file strings     Set environment variables from file
      --exec                      Execute without a TUI
      --fake string               Replay AI responses from cassette file (for testing)
      --fake-stream int[=15]      Simulate streaming with delay in ms between chunks (default 15ms if no value given)
      --hide-tool-calls           Hide the tool calls in the output
      --hide-tool-results         Hide tool call results
      --json                      Output results in JSON format
      --model stringArray         Override agent model: [agent=]provider/model (repeatable)
      --models-gateway string     Set the models gateway address
      --prompt-file stringArray   Append file contents to the prompt (repeatable)
      --record string[="true"]    Record AI API interactions to cassette file (auto-generates filename if empty)
      --remote string             Use remote runtime with specified address
      --sandbox                   Run the agent inside a Docker sandbox (requires Docker Desktop with sandbox support)
      --session string            Continue from a previous session by ID or relative offset (e.g., -1 for last session)
  -s, --session-db string         Path to the session database (default "$HOME/.cagent/session.db")
      --template string           Template image for the sandbox (passed to docker sandbox create -t)
      --working-dir string        Set the working directory for the session (applies to tools and relative paths)
      --yolo                      Automatically approve all tool calls without prompting

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker agent serve
```
Usage:
  docker agent serve [command]

Available Commands:
  a2a         Start an agent as an A2A (Agent-to-Agent) server
  acp         Start an agent as an ACP (Agent Client Protocol) server
  api         Start the API server
  mcp         Start an agent as an MCP (Model Context Protocol) server

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker agent serve [command] --help" for more information about a command.
```

### docker agent serve a2a
```
Usage:
  docker agent serve a2a <agent-file>|<registry-ref>

Examples:
  docker agent serve a2a ./agent.yaml
  docker agent serve a2a agentcatalog/pirate --listen 127.0.0.1:9090

Flags:
  -a, --agent string            Name of the agent to run (default "root")
      --code-mode-tools         Provide a single tool to call other tools via Javascript
      --env-from-file strings   Set environment variables from file
  -l, --listen string           Address to listen on (default "127.0.0.1:8082")
      --models-gateway string   Set the models gateway address
      --working-dir string      Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker agent serve acp
```
Usage:
  docker agent serve acp <agent-file>|<registry-ref>

Examples:
  docker agent serve acp ./agent.yaml
  docker agent serve acp ./team.yaml
  docker agent serve acp agentcatalog/pirate

Flags:
      --code-mode-tools         Provide a single tool to call other tools via Javascript
      --env-from-file strings   Set environment variables from file
      --models-gateway string   Set the models gateway address
  -s, --session-db string       Path to the session database (default "$HOME/.cagent/session.db")
      --working-dir string      Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker agent serve api
```
Usage:
  docker agent serve api <agent-file>|<agents-dir>

Flags:
      --code-mode-tools         Provide a single tool to call other tools via Javascript
      --env-from-file strings   Set environment variables from file
      --fake string             Replay AI responses from cassette file (for testing)
  -l, --listen string           Address to listen on (default "127.0.0.1:8080")
      --models-gateway string   Set the models gateway address
      --pull-interval int       Auto-pull OCI reference every N minutes (0 = disabled)
      --record string           Record AI API interactions to cassette file
  -s, --session-db string       Path to the session database (default "session.db")
      --working-dir string      Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker agent serve mcp
```
Usage:
  docker agent serve mcp <agent-file>|<registry-ref>

Examples:
  docker agent serve mcp ./agent.yaml
  docker agent serve mcp ./team.yaml
  docker agent serve mcp agentcatalog/pirate
  docker agent serve mcp ./agent.yaml --http --listen 127.0.0.1:9090

Flags:
  -a, --agent string            Name of the agent to run (all agents if not specified)
      --code-mode-tools         Provide a single tool to call other tools via Javascript
      --env-from-file strings   Set environment variables from file
      --http                    Use streaming HTTP transport instead of stdio
  -l, --listen string           Address to listen on (default "127.0.0.1:8081")
      --models-gateway string   Set the models gateway address
      --working-dir string      Set the working directory for the session (applies to tools and relative paths)

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker agent share
```
Usage:
  docker agent share [command]

Available Commands:
  pull        Pull an agent from an OCI registry
  push        Push an agent to an OCI registry

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing

Use "docker agent share [command] --help" for more information about a command.
```

### docker agent share pull
```
Usage:
  docker agent share pull <registry-ref>

Flags:
      --force   Force pull even if the configuration already exists locally

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

### docker agent share push
```
Usage:
  docker agent share push <agent-file> <registry-ref>

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```

## docker agent version
```
Usage:
  docker agent version

Global Flags:
      --cache-dir string    Override the cache directory (default: ~/Library/Caches/cagent on macOS)
      --config-dir string   Override the config directory (default: ~/.config/cagent)
      --data-dir string     Override the data directory (default: ~/.cagent)
  -d, --debug               Enable debug logging
      --log-file string     Path to debug log file (default: ~/.cagent/cagent.debug.log; only used with --debug)
  -o, --otel                Enable OpenTelemetry tracing
```
