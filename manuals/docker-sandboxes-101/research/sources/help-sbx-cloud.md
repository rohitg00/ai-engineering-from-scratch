# sbx --cloud --help, captured 2026-10-08 (v0.47.0)
```
Docker Sandboxes creates isolated sandbox environments for AI agents, powered by Docker.

Run without a command to launch interactive mode, or pass a command for CLI usage.

Usage:
  sbx COMMAND

Sandbox Commands:
  attach      Attach to a cloud sandbox, starting it first if it is stopped
  cp          Copy files or directories between a sandbox and the host
  create      Create a sandbox for an agent
  exec        Execute a command inside a sandbox
  ls          List sandboxes
  move        Move a sandbox between local and cloud
  ports       Manage sandbox port publishing
  rm          Remove one or more sandboxes
  run         Run an agent in a sandbox
  stop        Stop one or more sandboxes without removing them
  ttl         Inspect or extend a cloud sandbox's TTL

Management Commands:
  diagnose    Diagnose common issues with your sbx installation
  mcp         Manage MCP servers
  policy      Manage sandbox policies
  reset       Reset all sandboxes and clean up state
  secret      Manage stored secrets
  template    Manage sandbox templates
  tui         Open the interactive TUI dashboard
  volume      Manage persistent volumes (cloud-only)

Experimental Commands:
  env         (Experimental) Manage sandboxes declaratively from an sbxenv.yaml file
  kit         (Experimental) Manage kit artifacts
  setup       (Experimental) Detect host configuration and prepare Docker Sandboxes

Other Commands:
  completion  Generate the autocompletion script for the specified shell
  help        Help about any command
  login       Sign in to Docker
  logout      Stop running local sandboxes and sign out of Docker
  version     Show Docker Sandboxes version information

Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
  -h, --help    help for sbx

Use "sbx COMMAND --help" for more information about a command.
```

## Network calls during --help

Every `sbx ... --help` invocation attempted outbound TLS to login.docker.com:443 and, about once per 15 calls, marlin-2.docker.com:443 (observed 2026-10-08 under the macOS Seatbelt sandbox, which denied them; help text still printed). Verify online whether the help output changes when the call succeeds, and whether `sbx settings` has a telemetry switch.
