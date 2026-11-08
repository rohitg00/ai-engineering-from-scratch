# sbx help tree, captured 2026-10-08

```
sbx version: v0.47.0 0411f50ee4700fe7bd37e6e7e3aced563e850ca9
```

# sbx
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
  prune       Remove all stopped sandboxes
  rm          Remove one or more sandboxes
  run         Run an agent in a sandbox
  stop        Stop one or more sandboxes without removing them
  ttl         Inspect or extend a cloud sandbox's TTL

Management Commands:
  daemon      Manage sandboxd daemon
  diagnose    Diagnose common issues with your sbx installation
  mcp         Manage MCP servers
  policy      Manage sandbox policies
  reset       Reset all sandboxes and clean up state
  secret      Manage stored secrets
  settings    Manage Docker Sandboxes settings
  template    Manage sandbox templates
  tui         Open the interactive TUI dashboard
  volume      Manage persistent volumes (cloud-only)

Experimental Commands:
  env         (Experimental) Manage sandboxes declaratively from an sbxenv.yaml file
  kit         (Experimental) Manage kit artifacts
  setup       (Experimental) Detect host configuration and prepare Docker Sandboxes
  skills      (Experimental) Manage skills available in sandboxes

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

## sbx attach
```
Attach an interactive terminal session to a cloud sandbox.

SANDBOX is the cloud sandbox ID (sbx_*) or name from "sbx --cloud ls".

Opens a PTY-backed exec session against the sandbox's agent process. The
sandbox must already exist; a stopped one is started first. Use
`sbx --cloud run` to create a sandbox and attach in one step.

Only supported with --cloud. See https://docs.docker.com/ai/sandboxes/ for the cloud sandbox model.

Usage:
  sbx attach SANDBOX [flags]

Examples:
  # Attach to a sandbox by ID or name
  sbx --cloud attach sbx_abc123
  sbx --cloud attach claude/my-sandbox

Flags:
      --detach-keys string   Override the detach gesture that leaves the session running (Docker-style, e.g. "ctrl-\", "ctrl-x,ctrl-d"). Default: Ctrl-\. Use this when the default collides with an agent's keymap (cloud only).
  -h, --help                 help for attach

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx cp
```
Either SRC or DST must be a sandbox path, written as SANDBOX:PATH.
The other must be a local path. Copying between two sandboxes is not supported. Or — with --cloud — the cloud sandbox
ID (sbx_*) or name from "sbx --cloud ls". Cloud transfers go through the Docker
Sandboxes Cloud file API instead of the local sandboxd.

When copying a directory, the directory itself is placed at the destination.
If the destination path does not exist it is created; if it already exists
as a directory, the source is placed inside it.

Usage:
  sbx cp [flags] SRC DST

Examples:
  # Copy a file from host to sandbox
  sbx cp ./config.json my-sandbox:/home/user/

  # Copy a file from sandbox to host
  sbx cp my-sandbox:/home/user/output.log ./

  # Copy a directory
  sbx cp ./src/ my-sandbox:/home/user/src

  # Copy to/from a cloud sandbox
  sbx --cloud cp ./config.json sbx_abc:/workspace/config.json
  sbx --cloud cp sbx_abc:/workspace/out.log ./

Flags:
  -L, --follow-link   Follow symbolic links in the source path
  -h, --help          help for cp

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx create
```
Create a sandbox with access to a host workspace for an agent.

The first positional argument may be a built-in agent name or a sandbox kit
reference. Sandbox kit references may be local directories, ZIP files, git
repositories, or OCI references. Relative local references must be explicit
paths such as ./my-kit or ../my-kit.zip.

Omit the path to create a sandbox without a workspace bind mount: the agent
then works in the container's own filesystem instead of on your files.

Use "sbx run --name SANDBOX" to attach to the agent after creation.

Available agents: claude, codex, copilot, cursor, devin, docker-agent, droid, gemini, kiro, opencode, shell

With --cloud:
Create a cloud sandbox for an agent.

Cloud sandboxes have no host workspace, so no path follows the agent. Sizing
comes from --cpus and --memory and must land on a billable shape; without them
a cloud sandbox gets 2 CPUs and 4 GiB. A template named with -t / --template
must already exist in the cloud registry.

Cloud sandboxes use cloud network policies. Host network and HTTP policies
do not apply. Set cloud account defaults with
"sbx --cloud policy init <allow-all|balanced|deny-all>".

Use "sbx --cloud run --name SANDBOX" to attach to the agent after creation.

Usage:
  sbx create [flags] AGENT|SANDBOX_KIT [PATH...]
  sbx create COMMAND

Examples:
  # Create a sandbox for Claude in the current directory
  sbx create claude .

  # Create a sandbox with a custom name
  sbx create --name my-project claude /path/to/project

  # Create with additional read-only workspaces
  sbx create claude . /path/to/docs:ro

  # Create without a workspace bind mount
  sbx create claude

  # Create from a local sandbox kit
  sbx create ../path/to/my-agent/

  # Add a mixin to a built-in agent
  sbx create claude --kit ./my-mixin/

  # Run the agent on an in-container clone of the host repo, wired back via a git-daemon
  sbx create --clone claude .

  # Create a cloud sandbox for claude
  sbx --cloud create claude

  # Create a named cloud sandbox with a mixin baked in
  sbx --cloud create --name my-project claude --kit ./my-mixin/

  # Create from a template that already exists in the cloud registry
  sbx --cloud create -t TEMPLATE

Available Commands:
  claude         Create a sandbox for claude
  codex          Create a sandbox for codex
  cursor         Create a sandbox for cursor
  devin          Create a sandbox for devin
  docker-agent   Create a sandbox for docker-agent
  gemini         Create a sandbox for gemini
  opencode       Create a sandbox for opencode
  shell          Create a sandbox for shell

Flags:
      --allow-network strings       Network pattern to allow for cloud sandbox egress (cloud only; can be specified multiple times)
      --clone                       Run the agent on a private in-container clone of the host Git repository (mounted read-only) instead of bind-mounting the workspace; the agent's commits are accessible via the sandbox-<name> git remote on the host
      --cpus int                    Number of CPUs to allocate to the sandbox (0 = auto: all host CPUs, at most 16 on Linux arm64)
      --deny-network strings        Add a per-sandbox network deny rule at creation time. Can be specified multiple times. The rule applies only to the new sandbox and can be listed or removed later with 'sbx policy ls <NAME>' or 'sbx policy rm network --sandbox <NAME> --resource <HOST>'. Safe under centralized governance because a local deny can only narrow, never widen, egress.
  -e, --env stringArray             Set an environment variable in the sandbox (can be repeated): KEY=VALUE, or a bare KEY to take the value from the current environment
      --env-file stringArray        Read environment variables from a file (can be repeated). --env wins over any file; a later file wins over an earlier one
  -h, --help                        help for create
      --image-ref string            OCI image reference for inline-mode cloud create (mutually exclusive with --template; requires --cpus and --memory)
      --kit strings                 (Experimental) Additional kit reference (must be a mixin; directory, ZIP, git, or OCI). Can be specified multiple times
      --kit-arg stringArray         (Experimental) Value for an argument the kit declares, as name=value for every kit or kit.name=value for one (can be repeated)
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides
  -m, --memory string               Memory limit in binary units (e.g., 512m, 8g). Minimum: 512 MiB. Default: 50% of host memory, clamped to 512 MiB–32 GiB. Maximum: max(75% of host memory, 512 MiB)
      --name string                 Name for the sandbox (defaults to <agent>-<workdir>; at least two characters, starting with a letter or number, containing only letters, numbers, hyphens and periods (periods are rejected with --cloud); 'default' is reserved)
      --on-timeout string           What happens when --ttl lapses: 'stop' stops the sandbox in place so it can be started again later, 'restart' keeps it running by stopping and immediately starting it, or 'delete' removes it. Omit the flag and the server stops the sandbox when it can be started again later, and deletes it otherwise. With 'restart' a supplied --ttl must be at least 1h (cloud only).
      --platform string             Target platform: linux/amd64 or linux/arm64 (cloud only). With --image-ref, omitting it lets the server resolve the platform from the image and the CLI sends the local CPU as a hint for multi-platform images. With --template, omitting it inherits the template platform. With a sandbox kit, the kit's template is built for this platform and cached apart from other platforms; omitting it keeps the server's choice.
      --profile string              Governance profile to assign to the sandbox
  -p, --publish stringArray         Publish a sandbox port to the host (can be repeated): [[HOST_IP:]HOST_PORT:]SANDBOX_PORT[/PROTOCOL]
      --pull string                 Image pull policy (always|missing|never) (default "always")
  -q, --quiet                       Suppress verbose output
      --skills string               Shared skills store mode for the agent's skills directory (e.g. ~/.claude/skills): off, readonly (store linked in read-only, directory stays writable), or readwrite (store mounted over it, writes are shared). Default: readonly, or the configured skills.defaultMode setting.
      --static-mcp strings          MCP server names that form the sandbox's fixed (static) MCP set. Accepts a comma-separated list (--static-mcp notion,atlassian), repeated flags (--static-mcp notion --static-mcp atlassian), or a mix; all forms accumulate into the same set. The set is chosen once at creation time. Local sandboxes take names registered with 'sbx mcp add'. Cloud sandboxes resolve names on the cloud MCP gateway.
  -t, --template string             Container image to use for the sandbox (default: agent-specific image)
      --ttl duration                Cloud sandbox time-to-live before it times out (e.g. 30m, 2h, 1h30m; units are case-insensitive; cloud only; default: server-side)
  -v, --volume stringArray          (Experimental) Attach an existing persistent volume, NAME:MOUNTPATH (cloud only, experimental; repeatable)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx create COMMAND --help" for more information about a command.
```

### sbx create claude
```
Create a sandbox with access to a host workspace for claude.

The workspace path is mounted inside the sandbox at the same path as on the
host. Additional workspaces can be provided as extra arguments. Append ":ro" to
mount them read-only; a read-only argument may name a single file, which holds
that one path out of reach inside a workspace the sandbox can otherwise write.

Omit the path to create a sandbox without a workspace bind mount: the agent
then works in the container's own filesystem instead of on your files.

Use "sbx run --name SANDBOX" to attach to the agent after creation.

With --cloud:
Create a cloud sandbox for claude.

Cloud sandboxes have no host workspace, so no path follows the agent. Sizing
comes from --cpus and --memory and must land on a billable shape; without them
a cloud sandbox gets 2 CPUs and 4 GiB. A template named with -t / --template
must already exist in the cloud registry.

Cloud sandboxes use cloud network policies. Host network and HTTP policies
do not apply. Set cloud account defaults with
"sbx --cloud policy init <allow-all|balanced|deny-all>".

Use "sbx --cloud run --name SANDBOX" to attach to the agent after creation.

Usage:
  sbx create claude [PATH...] [flags]

Examples:
  # Create in the current directory
  sbx create claude .

  # Create with a specific path
  sbx create claude /path/to/project

  # Create with additional read-only workspaces
  sbx create claude . /path/to/docs:ro

  # Create without a workspace bind mount
  sbx create claude

  # Create a cloud sandbox for claude
  sbx --cloud create claude

  # Create a named cloud sandbox with a mixin baked in
  sbx --cloud create --name my-project claude --kit ./my-mixin/

  # Create from a template that already exists in the cloud registry
  sbx --cloud create -t TEMPLATE

Flags:
  -h, --help   help for claude

Global Flags:
      --allow-network strings       Network pattern to allow for cloud sandbox egress (cloud only; can be specified multiple times)
      --clone                       Run the agent on a private in-container clone of the host Git repository (mounted read-only) instead of bind-mounting the workspace; the agent's commits are accessible via the sandbox-<name> git remote on the host
      --cloud                       Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
      --cpus int                    Number of CPUs to allocate to the sandbox (0 = auto: all host CPUs, at most 16 on Linux arm64)
  -D, --debug                       Enable debug logging
      --deny-network strings        Add a per-sandbox network deny rule at creation time. Can be specified multiple times. The rule applies only to the new sandbox and can be listed or removed later with 'sbx policy ls <NAME>' or 'sbx policy rm network --sandbox <NAME> --resource <HOST>'. Safe under centralized governance because a local deny can only narrow, never widen, egress.
  -e, --env stringArray             Set an environment variable in the sandbox (can be repeated): KEY=VALUE, or a bare KEY to take the value from the current environment
      --env-file stringArray        Read environment variables from a file (can be repeated). --env wins over any file; a later file wins over an earlier one
      --image-ref string            OCI image reference for inline-mode cloud create (mutually exclusive with --template; requires --cpus and --memory)
      --kit strings                 (Experimental) Additional kit reference (must be a mixin; directory, ZIP, git, or OCI). Can be specified multiple times
      --kit-arg stringArray         (Experimental) Value for an argument the kit declares, as name=value for every kit or kit.name=value for one (can be repeated)
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides
  -m, --memory string               Memory limit in binary units (e.g., 512m, 8g). Minimum: 512 MiB. Default: 50% of host memory, clamped to 512 MiB–32 GiB. Maximum: max(75% of host memory, 512 MiB)
      --name string                 Name for the sandbox (defaults to <agent>-<workdir>; at least two characters, starting with a letter or number, containing only letters, numbers, hyphens and periods (periods are rejected with --cloud); 'default' is reserved)
      --on-timeout string           What happens when --ttl lapses: 'stop' stops the sandbox in place so it can be started again later, 'restart' keeps it running by stopping and immediately starting it, or 'delete' removes it. Omit the flag and the server stops the sandbox when it can be started again later, and deletes it otherwise. With 'restart' a supplied --ttl must be at least 1h (cloud only).
      --platform string             Target platform: linux/amd64 or linux/arm64 (cloud only). With --image-ref, omitting it lets the server resolve the platform from the image and the CLI sends the local CPU as a hint for multi-platform images. With --template, omitting it inherits the template platform. With a sandbox kit, the kit's template is built for this platform and cached apart from other platforms; omitting it keeps the server's choice.
      --profile string              Governance profile to assign to the sandbox
  -p, --publish stringArray         Publish a sandbox port to the host (can be repeated): [[HOST_IP:]HOST_PORT:]SANDBOX_PORT[/PROTOCOL]
      --pull string                 Image pull policy (always|missing|never) (default "always")
  -q, --quiet                       Suppress verbose output
      --skills string               Shared skills store mode for the agent's skills directory (e.g. ~/.claude/skills): off, readonly (store linked in read-only, directory stays writable), or readwrite (store mounted over it, writes are shared). Default: readonly, or the configured skills.defaultMode setting.
      --static-mcp strings          MCP server names that form the sandbox's fixed (static) MCP set. Accepts a comma-separated list (--static-mcp notion,atlassian), repeated flags (--static-mcp notion --static-mcp atlassian), or a mix; all forms accumulate into the same set. The set is chosen once at creation time. Local sandboxes take names registered with 'sbx mcp add'. Cloud sandboxes resolve names on the cloud MCP gateway.
  -t, --template string             Container image to use for the sandbox (default: agent-specific image)
      --ttl duration                Cloud sandbox time-to-live before it times out (e.g. 30m, 2h, 1h30m; units are case-insensitive; cloud only; default: server-side)
  -v, --volume stringArray          (Experimental) Attach an existing persistent volume, NAME:MOUNTPATH (cloud only, experimental; repeatable)
```

### sbx create codex
```
Create a sandbox with access to a host workspace for codex.

The workspace path is mounted inside the sandbox at the same path as on the
host. Additional workspaces can be provided as extra arguments. Append ":ro" to
mount them read-only; a read-only argument may name a single file, which holds
that one path out of reach inside a workspace the sandbox can otherwise write.

Omit the path to create a sandbox without a workspace bind mount: the agent
then works in the container's own filesystem instead of on your files.

Use "sbx run --name SANDBOX" to attach to the agent after creation.

With --cloud:
Create a cloud sandbox for codex.

Cloud sandboxes have no host workspace, so no path follows the agent. Sizing
comes from --cpus and --memory and must land on a billable shape; without them
a cloud sandbox gets 2 CPUs and 4 GiB. A template named with -t / --template
must already exist in the cloud registry.

Cloud sandboxes use cloud network policies. Host network and HTTP policies
do not apply. Set cloud account defaults with
"sbx --cloud policy init <allow-all|balanced|deny-all>".

Use "sbx --cloud run --name SANDBOX" to attach to the agent after creation.

Usage:
  sbx create codex [PATH...] [flags]

Examples:
  # Create in the current directory
  sbx create codex .

  # Create with a specific path
  sbx create codex /path/to/project

  # Create with additional read-only workspaces
  sbx create codex . /path/to/docs:ro

  # Create without a workspace bind mount
  sbx create codex

  # Create a cloud sandbox for codex
  sbx --cloud create codex

  # Create a named cloud sandbox with a mixin baked in
  sbx --cloud create --name my-project codex --kit ./my-mixin/

  # Create from a template that already exists in the cloud registry
  sbx --cloud create -t TEMPLATE

Flags:
  -h, --help   help for codex

Global Flags:
      --allow-network strings       Network pattern to allow for cloud sandbox egress (cloud only; can be specified multiple times)
      --clone                       Run the agent on a private in-container clone of the host Git repository (mounted read-only) instead of bind-mounting the workspace; the agent's commits are accessible via the sandbox-<name> git remote on the host
      --cloud                       Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
      --cpus int                    Number of CPUs to allocate to the sandbox (0 = auto: all host CPUs, at most 16 on Linux arm64)
  -D, --debug                       Enable debug logging
      --deny-network strings        Add a per-sandbox network deny rule at creation time. Can be specified multiple times. The rule applies only to the new sandbox and can be listed or removed later with 'sbx policy ls <NAME>' or 'sbx policy rm network --sandbox <NAME> --resource <HOST>'. Safe under centralized governance because a local deny can only narrow, never widen, egress.
  -e, --env stringArray             Set an environment variable in the sandbox (can be repeated): KEY=VALUE, or a bare KEY to take the value from the current environment
      --env-file stringArray        Read environment variables from a file (can be repeated). --env wins over any file; a later file wins over an earlier one
      --image-ref string            OCI image reference for inline-mode cloud create (mutually exclusive with --template; requires --cpus and --memory)
      --kit strings                 (Experimental) Additional kit reference (must be a mixin; directory, ZIP, git, or OCI). Can be specified multiple times
      --kit-arg stringArray         (Experimental) Value for an argument the kit declares, as name=value for every kit or kit.name=value for one (can be repeated)
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides
  -m, --memory string               Memory limit in binary units (e.g., 512m, 8g). Minimum: 512 MiB. Default: 50% of host memory, clamped to 512 MiB–32 GiB. Maximum: max(75% of host memory, 512 MiB)
      --name string                 Name for the sandbox (defaults to <agent>-<workdir>; at least two characters, starting with a letter or number, containing only letters, numbers, hyphens and periods (periods are rejected with --cloud); 'default' is reserved)
      --on-timeout string           What happens when --ttl lapses: 'stop' stops the sandbox in place so it can be started again later, 'restart' keeps it running by stopping and immediately starting it, or 'delete' removes it. Omit the flag and the server stops the sandbox when it can be started again later, and deletes it otherwise. With 'restart' a supplied --ttl must be at least 1h (cloud only).
      --platform string             Target platform: linux/amd64 or linux/arm64 (cloud only). With --image-ref, omitting it lets the server resolve the platform from the image and the CLI sends the local CPU as a hint for multi-platform images. With --template, omitting it inherits the template platform. With a sandbox kit, the kit's template is built for this platform and cached apart from other platforms; omitting it keeps the server's choice.
      --profile string              Governance profile to assign to the sandbox
  -p, --publish stringArray         Publish a sandbox port to the host (can be repeated): [[HOST_IP:]HOST_PORT:]SANDBOX_PORT[/PROTOCOL]
      --pull string                 Image pull policy (always|missing|never) (default "always")
  -q, --quiet                       Suppress verbose output
      --skills string               Shared skills store mode for the agent's skills directory (e.g. ~/.claude/skills): off, readonly (store linked in read-only, directory stays writable), or readwrite (store mounted over it, writes are shared). Default: readonly, or the configured skills.defaultMode setting.
      --static-mcp strings          MCP server names that form the sandbox's fixed (static) MCP set. Accepts a comma-separated list (--static-mcp notion,atlassian), repeated flags (--static-mcp notion --static-mcp atlassian), or a mix; all forms accumulate into the same set. The set is chosen once at creation time. Local sandboxes take names registered with 'sbx mcp add'. Cloud sandboxes resolve names on the cloud MCP gateway.
  -t, --template string             Container image to use for the sandbox (default: agent-specific image)
      --ttl duration                Cloud sandbox time-to-live before it times out (e.g. 30m, 2h, 1h30m; units are case-insensitive; cloud only; default: server-side)
  -v, --volume stringArray          (Experimental) Attach an existing persistent volume, NAME:MOUNTPATH (cloud only, experimental; repeatable)
```

### sbx create cursor
```
Create a sandbox with access to a host workspace for cursor.

The workspace path is mounted inside the sandbox at the same path as on the
host. Additional workspaces can be provided as extra arguments. Append ":ro" to
mount them read-only; a read-only argument may name a single file, which holds
that one path out of reach inside a workspace the sandbox can otherwise write.

Omit the path to create a sandbox without a workspace bind mount: the agent
then works in the container's own filesystem instead of on your files.

Use "sbx run --name SANDBOX" to attach to the agent after creation.

With --cloud:
Create a cloud sandbox for cursor.

Cloud sandboxes have no host workspace, so no path follows the agent. Sizing
comes from --cpus and --memory and must land on a billable shape; without them
a cloud sandbox gets 2 CPUs and 4 GiB. A template named with -t / --template
must already exist in the cloud registry.

Cloud sandboxes use cloud network policies. Host network and HTTP policies
do not apply. Set cloud account defaults with
"sbx --cloud policy init <allow-all|balanced|deny-all>".

Use "sbx --cloud run --name SANDBOX" to attach to the agent after creation.

Usage:
  sbx create cursor [PATH...] [flags]

Examples:
  # Create in the current directory
  sbx create cursor .

  # Create with a specific path
  sbx create cursor /path/to/project

  # Create with additional read-only workspaces
  sbx create cursor . /path/to/docs:ro

  # Create without a workspace bind mount
  sbx create cursor

  # Create a cloud sandbox for cursor
  sbx --cloud create cursor

  # Create a named cloud sandbox with a mixin baked in
  sbx --cloud create --name my-project cursor --kit ./my-mixin/

  # Create from a template that already exists in the cloud registry
  sbx --cloud create -t TEMPLATE

Flags:
  -h, --help   help for cursor

Global Flags:
      --allow-network strings       Network pattern to allow for cloud sandbox egress (cloud only; can be specified multiple times)
      --clone                       Run the agent on a private in-container clone of the host Git repository (mounted read-only) instead of bind-mounting the workspace; the agent's commits are accessible via the sandbox-<name> git remote on the host
      --cloud                       Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
      --cpus int                    Number of CPUs to allocate to the sandbox (0 = auto: all host CPUs, at most 16 on Linux arm64)
  -D, --debug                       Enable debug logging
      --deny-network strings        Add a per-sandbox network deny rule at creation time. Can be specified multiple times. The rule applies only to the new sandbox and can be listed or removed later with 'sbx policy ls <NAME>' or 'sbx policy rm network --sandbox <NAME> --resource <HOST>'. Safe under centralized governance because a local deny can only narrow, never widen, egress.
  -e, --env stringArray             Set an environment variable in the sandbox (can be repeated): KEY=VALUE, or a bare KEY to take the value from the current environment
      --env-file stringArray        Read environment variables from a file (can be repeated). --env wins over any file; a later file wins over an earlier one
      --image-ref string            OCI image reference for inline-mode cloud create (mutually exclusive with --template; requires --cpus and --memory)
      --kit strings                 (Experimental) Additional kit reference (must be a mixin; directory, ZIP, git, or OCI). Can be specified multiple times
      --kit-arg stringArray         (Experimental) Value for an argument the kit declares, as name=value for every kit or kit.name=value for one (can be repeated)
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides
  -m, --memory string               Memory limit in binary units (e.g., 512m, 8g). Minimum: 512 MiB. Default: 50% of host memory, clamped to 512 MiB–32 GiB. Maximum: max(75% of host memory, 512 MiB)
      --name string                 Name for the sandbox (defaults to <agent>-<workdir>; at least two characters, starting with a letter or number, containing only letters, numbers, hyphens and periods (periods are rejected with --cloud); 'default' is reserved)
      --on-timeout string           What happens when --ttl lapses: 'stop' stops the sandbox in place so it can be started again later, 'restart' keeps it running by stopping and immediately starting it, or 'delete' removes it. Omit the flag and the server stops the sandbox when it can be started again later, and deletes it otherwise. With 'restart' a supplied --ttl must be at least 1h (cloud only).
      --platform string             Target platform: linux/amd64 or linux/arm64 (cloud only). With --image-ref, omitting it lets the server resolve the platform from the image and the CLI sends the local CPU as a hint for multi-platform images. With --template, omitting it inherits the template platform. With a sandbox kit, the kit's template is built for this platform and cached apart from other platforms; omitting it keeps the server's choice.
      --profile string              Governance profile to assign to the sandbox
  -p, --publish stringArray         Publish a sandbox port to the host (can be repeated): [[HOST_IP:]HOST_PORT:]SANDBOX_PORT[/PROTOCOL]
      --pull string                 Image pull policy (always|missing|never) (default "always")
  -q, --quiet                       Suppress verbose output
      --skills string               Shared skills store mode for the agent's skills directory (e.g. ~/.claude/skills): off, readonly (store linked in read-only, directory stays writable), or readwrite (store mounted over it, writes are shared). Default: readonly, or the configured skills.defaultMode setting.
      --static-mcp strings          MCP server names that form the sandbox's fixed (static) MCP set. Accepts a comma-separated list (--static-mcp notion,atlassian), repeated flags (--static-mcp notion --static-mcp atlassian), or a mix; all forms accumulate into the same set. The set is chosen once at creation time. Local sandboxes take names registered with 'sbx mcp add'. Cloud sandboxes resolve names on the cloud MCP gateway.
  -t, --template string             Container image to use for the sandbox (default: agent-specific image)
      --ttl duration                Cloud sandbox time-to-live before it times out (e.g. 30m, 2h, 1h30m; units are case-insensitive; cloud only; default: server-side)
  -v, --volume stringArray          (Experimental) Attach an existing persistent volume, NAME:MOUNTPATH (cloud only, experimental; repeatable)
```

### sbx create devin
```
Create a sandbox with access to a host workspace for devin.

The workspace path is mounted inside the sandbox at the same path as on the
host. Additional workspaces can be provided as extra arguments. Append ":ro" to
mount them read-only; a read-only argument may name a single file, which holds
that one path out of reach inside a workspace the sandbox can otherwise write.

Omit the path to create a sandbox without a workspace bind mount: the agent
then works in the container's own filesystem instead of on your files.

Use "sbx run --name SANDBOX" to attach to the agent after creation.

With --cloud:
Create a cloud sandbox for devin.

Cloud sandboxes have no host workspace, so no path follows the agent. Sizing
comes from --cpus and --memory and must land on a billable shape; without them
a cloud sandbox gets 2 CPUs and 4 GiB. A template named with -t / --template
must already exist in the cloud registry.

Cloud sandboxes use cloud network policies. Host network and HTTP policies
do not apply. Set cloud account defaults with
"sbx --cloud policy init <allow-all|balanced|deny-all>".

Use "sbx --cloud run --name SANDBOX" to attach to the agent after creation.

Usage:
  sbx create devin [PATH...] [flags]

Examples:
  # Create in the current directory
  sbx create devin .

  # Create with a specific path
  sbx create devin /path/to/project

  # Create with additional read-only workspaces
  sbx create devin . /path/to/docs:ro

  # Create without a workspace bind mount
  sbx create devin

  # Create a cloud sandbox for devin
  sbx --cloud create devin

  # Create a named cloud sandbox with a mixin baked in
  sbx --cloud create --name my-project devin --kit ./my-mixin/

  # Create from a template that already exists in the cloud registry
  sbx --cloud create -t TEMPLATE

Flags:
  -h, --help   help for devin

Global Flags:
      --allow-network strings       Network pattern to allow for cloud sandbox egress (cloud only; can be specified multiple times)
      --clone                       Run the agent on a private in-container clone of the host Git repository (mounted read-only) instead of bind-mounting the workspace; the agent's commits are accessible via the sandbox-<name> git remote on the host
      --cloud                       Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
      --cpus int                    Number of CPUs to allocate to the sandbox (0 = auto: all host CPUs, at most 16 on Linux arm64)
  -D, --debug                       Enable debug logging
      --deny-network strings        Add a per-sandbox network deny rule at creation time. Can be specified multiple times. The rule applies only to the new sandbox and can be listed or removed later with 'sbx policy ls <NAME>' or 'sbx policy rm network --sandbox <NAME> --resource <HOST>'. Safe under centralized governance because a local deny can only narrow, never widen, egress.
  -e, --env stringArray             Set an environment variable in the sandbox (can be repeated): KEY=VALUE, or a bare KEY to take the value from the current environment
      --env-file stringArray        Read environment variables from a file (can be repeated). --env wins over any file; a later file wins over an earlier one
      --image-ref string            OCI image reference for inline-mode cloud create (mutually exclusive with --template; requires --cpus and --memory)
      --kit strings                 (Experimental) Additional kit reference (must be a mixin; directory, ZIP, git, or OCI). Can be specified multiple times
      --kit-arg stringArray         (Experimental) Value for an argument the kit declares, as name=value for every kit or kit.name=value for one (can be repeated)
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides
  -m, --memory string               Memory limit in binary units (e.g., 512m, 8g). Minimum: 512 MiB. Default: 50% of host memory, clamped to 512 MiB–32 GiB. Maximum: max(75% of host memory, 512 MiB)
      --name string                 Name for the sandbox (defaults to <agent>-<workdir>; at least two characters, starting with a letter or number, containing only letters, numbers, hyphens and periods (periods are rejected with --cloud); 'default' is reserved)
      --on-timeout string           What happens when --ttl lapses: 'stop' stops the sandbox in place so it can be started again later, 'restart' keeps it running by stopping and immediately starting it, or 'delete' removes it. Omit the flag and the server stops the sandbox when it can be started again later, and deletes it otherwise. With 'restart' a supplied --ttl must be at least 1h (cloud only).
      --platform string             Target platform: linux/amd64 or linux/arm64 (cloud only). With --image-ref, omitting it lets the server resolve the platform from the image and the CLI sends the local CPU as a hint for multi-platform images. With --template, omitting it inherits the template platform. With a sandbox kit, the kit's template is built for this platform and cached apart from other platforms; omitting it keeps the server's choice.
      --profile string              Governance profile to assign to the sandbox
  -p, --publish stringArray         Publish a sandbox port to the host (can be repeated): [[HOST_IP:]HOST_PORT:]SANDBOX_PORT[/PROTOCOL]
      --pull string                 Image pull policy (always|missing|never) (default "always")
  -q, --quiet                       Suppress verbose output
      --skills string               Shared skills store mode for the agent's skills directory (e.g. ~/.claude/skills): off, readonly (store linked in read-only, directory stays writable), or readwrite (store mounted over it, writes are shared). Default: readonly, or the configured skills.defaultMode setting.
      --static-mcp strings          MCP server names that form the sandbox's fixed (static) MCP set. Accepts a comma-separated list (--static-mcp notion,atlassian), repeated flags (--static-mcp notion --static-mcp atlassian), or a mix; all forms accumulate into the same set. The set is chosen once at creation time. Local sandboxes take names registered with 'sbx mcp add'. Cloud sandboxes resolve names on the cloud MCP gateway.
  -t, --template string             Container image to use for the sandbox (default: agent-specific image)
      --ttl duration                Cloud sandbox time-to-live before it times out (e.g. 30m, 2h, 1h30m; units are case-insensitive; cloud only; default: server-side)
  -v, --volume stringArray          (Experimental) Attach an existing persistent volume, NAME:MOUNTPATH (cloud only, experimental; repeatable)
```

### sbx create docker-agent
```
Create a sandbox with access to a host workspace for docker-agent.

The workspace path is mounted inside the sandbox at the same path as on the
host. Additional workspaces can be provided as extra arguments. Append ":ro" to
mount them read-only; a read-only argument may name a single file, which holds
that one path out of reach inside a workspace the sandbox can otherwise write.

Omit the path to create a sandbox without a workspace bind mount: the agent
then works in the container's own filesystem instead of on your files.

Use "sbx run --name SANDBOX" to attach to the agent after creation.

With --cloud:
Create a cloud sandbox for docker-agent.

Cloud sandboxes have no host workspace, so no path follows the agent. Sizing
comes from --cpus and --memory and must land on a billable shape; without them
a cloud sandbox gets 2 CPUs and 4 GiB. A template named with -t / --template
must already exist in the cloud registry.

Cloud sandboxes use cloud network policies. Host network and HTTP policies
do not apply. Set cloud account defaults with
"sbx --cloud policy init <allow-all|balanced|deny-all>".

Use "sbx --cloud run --name SANDBOX" to attach to the agent after creation.

Usage:
  sbx create docker-agent [PATH...] [flags]

Aliases:
  docker-agent, cagent

Examples:
  # Create in the current directory
  sbx create docker-agent .

  # Create with a specific path
  sbx create docker-agent /path/to/project

  # Create with additional read-only workspaces
  sbx create docker-agent . /path/to/docs:ro

  # Create without a workspace bind mount
  sbx create docker-agent

  # Create a cloud sandbox for docker-agent
  sbx --cloud create docker-agent

  # Create a named cloud sandbox with a mixin baked in
  sbx --cloud create --name my-project docker-agent --kit ./my-mixin/

  # Create from a template that already exists in the cloud registry
  sbx --cloud create -t TEMPLATE

Flags:
  -h, --help   help for docker-agent

Global Flags:
      --allow-network strings       Network pattern to allow for cloud sandbox egress (cloud only; can be specified multiple times)
      --clone                       Run the agent on a private in-container clone of the host Git repository (mounted read-only) instead of bind-mounting the workspace; the agent's commits are accessible via the sandbox-<name> git remote on the host
      --cloud                       Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
      --cpus int                    Number of CPUs to allocate to the sandbox (0 = auto: all host CPUs, at most 16 on Linux arm64)
  -D, --debug                       Enable debug logging
      --deny-network strings        Add a per-sandbox network deny rule at creation time. Can be specified multiple times. The rule applies only to the new sandbox and can be listed or removed later with 'sbx policy ls <NAME>' or 'sbx policy rm network --sandbox <NAME> --resource <HOST>'. Safe under centralized governance because a local deny can only narrow, never widen, egress.
  -e, --env stringArray             Set an environment variable in the sandbox (can be repeated): KEY=VALUE, or a bare KEY to take the value from the current environment
      --env-file stringArray        Read environment variables from a file (can be repeated). --env wins over any file; a later file wins over an earlier one
      --image-ref string            OCI image reference for inline-mode cloud create (mutually exclusive with --template; requires --cpus and --memory)
      --kit strings                 (Experimental) Additional kit reference (must be a mixin; directory, ZIP, git, or OCI). Can be specified multiple times
      --kit-arg stringArray         (Experimental) Value for an argument the kit declares, as name=value for every kit or kit.name=value for one (can be repeated)
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides
  -m, --memory string               Memory limit in binary units (e.g., 512m, 8g). Minimum: 512 MiB. Default: 50% of host memory, clamped to 512 MiB–32 GiB. Maximum: max(75% of host memory, 512 MiB)
      --name string                 Name for the sandbox (defaults to <agent>-<workdir>; at least two characters, starting with a letter or number, containing only letters, numbers, hyphens and periods (periods are rejected with --cloud); 'default' is reserved)
      --on-timeout string           What happens when --ttl lapses: 'stop' stops the sandbox in place so it can be started again later, 'restart' keeps it running by stopping and immediately starting it, or 'delete' removes it. Omit the flag and the server stops the sandbox when it can be started again later, and deletes it otherwise. With 'restart' a supplied --ttl must be at least 1h (cloud only).
      --platform string             Target platform: linux/amd64 or linux/arm64 (cloud only). With --image-ref, omitting it lets the server resolve the platform from the image and the CLI sends the local CPU as a hint for multi-platform images. With --template, omitting it inherits the template platform. With a sandbox kit, the kit's template is built for this platform and cached apart from other platforms; omitting it keeps the server's choice.
      --profile string              Governance profile to assign to the sandbox
  -p, --publish stringArray         Publish a sandbox port to the host (can be repeated): [[HOST_IP:]HOST_PORT:]SANDBOX_PORT[/PROTOCOL]
      --pull string                 Image pull policy (always|missing|never) (default "always")
  -q, --quiet                       Suppress verbose output
      --skills string               Shared skills store mode for the agent's skills directory (e.g. ~/.claude/skills): off, readonly (store linked in read-only, directory stays writable), or readwrite (store mounted over it, writes are shared). Default: readonly, or the configured skills.defaultMode setting.
      --static-mcp strings          MCP server names that form the sandbox's fixed (static) MCP set. Accepts a comma-separated list (--static-mcp notion,atlassian), repeated flags (--static-mcp notion --static-mcp atlassian), or a mix; all forms accumulate into the same set. The set is chosen once at creation time. Local sandboxes take names registered with 'sbx mcp add'. Cloud sandboxes resolve names on the cloud MCP gateway.
  -t, --template string             Container image to use for the sandbox (default: agent-specific image)
      --ttl duration                Cloud sandbox time-to-live before it times out (e.g. 30m, 2h, 1h30m; units are case-insensitive; cloud only; default: server-side)
  -v, --volume stringArray          (Experimental) Attach an existing persistent volume, NAME:MOUNTPATH (cloud only, experimental; repeatable)
```

### sbx create gemini
```
Create a sandbox with access to a host workspace for gemini.

The workspace path is mounted inside the sandbox at the same path as on the
host. Additional workspaces can be provided as extra arguments. Append ":ro" to
mount them read-only; a read-only argument may name a single file, which holds
that one path out of reach inside a workspace the sandbox can otherwise write.

Omit the path to create a sandbox without a workspace bind mount: the agent
then works in the container's own filesystem instead of on your files.

Use "sbx run --name SANDBOX" to attach to the agent after creation.

With --cloud:
Create a cloud sandbox for gemini.

Cloud sandboxes have no host workspace, so no path follows the agent. Sizing
comes from --cpus and --memory and must land on a billable shape; without them
a cloud sandbox gets 2 CPUs and 4 GiB. A template named with -t / --template
must already exist in the cloud registry.

Cloud sandboxes use cloud network policies. Host network and HTTP policies
do not apply. Set cloud account defaults with
"sbx --cloud policy init <allow-all|balanced|deny-all>".

Use "sbx --cloud run --name SANDBOX" to attach to the agent after creation.

Usage:
  sbx create gemini [PATH...] [flags]

Examples:
  # Create in the current directory
  sbx create gemini .

  # Create with a specific path
  sbx create gemini /path/to/project

  # Create with additional read-only workspaces
  sbx create gemini . /path/to/docs:ro

  # Create without a workspace bind mount
  sbx create gemini

  # Create a cloud sandbox for gemini
  sbx --cloud create gemini

  # Create a named cloud sandbox with a mixin baked in
  sbx --cloud create --name my-project gemini --kit ./my-mixin/

  # Create from a template that already exists in the cloud registry
  sbx --cloud create -t TEMPLATE

Flags:
  -h, --help   help for gemini

Global Flags:
      --allow-network strings       Network pattern to allow for cloud sandbox egress (cloud only; can be specified multiple times)
      --clone                       Run the agent on a private in-container clone of the host Git repository (mounted read-only) instead of bind-mounting the workspace; the agent's commits are accessible via the sandbox-<name> git remote on the host
      --cloud                       Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
      --cpus int                    Number of CPUs to allocate to the sandbox (0 = auto: all host CPUs, at most 16 on Linux arm64)
  -D, --debug                       Enable debug logging
      --deny-network strings        Add a per-sandbox network deny rule at creation time. Can be specified multiple times. The rule applies only to the new sandbox and can be listed or removed later with 'sbx policy ls <NAME>' or 'sbx policy rm network --sandbox <NAME> --resource <HOST>'. Safe under centralized governance because a local deny can only narrow, never widen, egress.
  -e, --env stringArray             Set an environment variable in the sandbox (can be repeated): KEY=VALUE, or a bare KEY to take the value from the current environment
      --env-file stringArray        Read environment variables from a file (can be repeated). --env wins over any file; a later file wins over an earlier one
      --image-ref string            OCI image reference for inline-mode cloud create (mutually exclusive with --template; requires --cpus and --memory)
      --kit strings                 (Experimental) Additional kit reference (must be a mixin; directory, ZIP, git, or OCI). Can be specified multiple times
      --kit-arg stringArray         (Experimental) Value for an argument the kit declares, as name=value for every kit or kit.name=value for one (can be repeated)
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides
  -m, --memory string               Memory limit in binary units (e.g., 512m, 8g). Minimum: 512 MiB. Default: 50% of host memory, clamped to 512 MiB–32 GiB. Maximum: max(75% of host memory, 512 MiB)
      --name string                 Name for the sandbox (defaults to <agent>-<workdir>; at least two characters, starting with a letter or number, containing only letters, numbers, hyphens and periods (periods are rejected with --cloud); 'default' is reserved)
      --on-timeout string           What happens when --ttl lapses: 'stop' stops the sandbox in place so it can be started again later, 'restart' keeps it running by stopping and immediately starting it, or 'delete' removes it. Omit the flag and the server stops the sandbox when it can be started again later, and deletes it otherwise. With 'restart' a supplied --ttl must be at least 1h (cloud only).
      --platform string             Target platform: linux/amd64 or linux/arm64 (cloud only). With --image-ref, omitting it lets the server resolve the platform from the image and the CLI sends the local CPU as a hint for multi-platform images. With --template, omitting it inherits the template platform. With a sandbox kit, the kit's template is built for this platform and cached apart from other platforms; omitting it keeps the server's choice.
      --profile string              Governance profile to assign to the sandbox
  -p, --publish stringArray         Publish a sandbox port to the host (can be repeated): [[HOST_IP:]HOST_PORT:]SANDBOX_PORT[/PROTOCOL]
      --pull string                 Image pull policy (always|missing|never) (default "always")
  -q, --quiet                       Suppress verbose output
      --skills string               Shared skills store mode for the agent's skills directory (e.g. ~/.claude/skills): off, readonly (store linked in read-only, directory stays writable), or readwrite (store mounted over it, writes are shared). Default: readonly, or the configured skills.defaultMode setting.
      --static-mcp strings          MCP server names that form the sandbox's fixed (static) MCP set. Accepts a comma-separated list (--static-mcp notion,atlassian), repeated flags (--static-mcp notion --static-mcp atlassian), or a mix; all forms accumulate into the same set. The set is chosen once at creation time. Local sandboxes take names registered with 'sbx mcp add'. Cloud sandboxes resolve names on the cloud MCP gateway.
  -t, --template string             Container image to use for the sandbox (default: agent-specific image)
      --ttl duration                Cloud sandbox time-to-live before it times out (e.g. 30m, 2h, 1h30m; units are case-insensitive; cloud only; default: server-side)
  -v, --volume stringArray          (Experimental) Attach an existing persistent volume, NAME:MOUNTPATH (cloud only, experimental; repeatable)
```

### sbx create opencode
```
Create a sandbox with access to a host workspace for opencode.

The workspace path is mounted inside the sandbox at the same path as on the
host. Additional workspaces can be provided as extra arguments. Append ":ro" to
mount them read-only; a read-only argument may name a single file, which holds
that one path out of reach inside a workspace the sandbox can otherwise write.

Omit the path to create a sandbox without a workspace bind mount: the agent
then works in the container's own filesystem instead of on your files.

Use "sbx run --name SANDBOX" to attach to the agent after creation.

With --cloud:
Create a cloud sandbox for opencode.

Cloud sandboxes have no host workspace, so no path follows the agent. Sizing
comes from --cpus and --memory and must land on a billable shape; without them
a cloud sandbox gets 2 CPUs and 4 GiB. A template named with -t / --template
must already exist in the cloud registry.

Cloud sandboxes use cloud network policies. Host network and HTTP policies
do not apply. Set cloud account defaults with
"sbx --cloud policy init <allow-all|balanced|deny-all>".

Use "sbx --cloud run --name SANDBOX" to attach to the agent after creation.

Usage:
  sbx create opencode [PATH...] [flags]

Examples:
  # Create in the current directory
  sbx create opencode .

  # Create with a specific path
  sbx create opencode /path/to/project

  # Create with additional read-only workspaces
  sbx create opencode . /path/to/docs:ro

  # Create without a workspace bind mount
  sbx create opencode

  # Create a cloud sandbox for opencode
  sbx --cloud create opencode

  # Create a named cloud sandbox with a mixin baked in
  sbx --cloud create --name my-project opencode --kit ./my-mixin/

  # Create from a template that already exists in the cloud registry
  sbx --cloud create -t TEMPLATE

Flags:
  -h, --help   help for opencode

Global Flags:
      --allow-network strings       Network pattern to allow for cloud sandbox egress (cloud only; can be specified multiple times)
      --clone                       Run the agent on a private in-container clone of the host Git repository (mounted read-only) instead of bind-mounting the workspace; the agent's commits are accessible via the sandbox-<name> git remote on the host
      --cloud                       Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
      --cpus int                    Number of CPUs to allocate to the sandbox (0 = auto: all host CPUs, at most 16 on Linux arm64)
  -D, --debug                       Enable debug logging
      --deny-network strings        Add a per-sandbox network deny rule at creation time. Can be specified multiple times. The rule applies only to the new sandbox and can be listed or removed later with 'sbx policy ls <NAME>' or 'sbx policy rm network --sandbox <NAME> --resource <HOST>'. Safe under centralized governance because a local deny can only narrow, never widen, egress.
  -e, --env stringArray             Set an environment variable in the sandbox (can be repeated): KEY=VALUE, or a bare KEY to take the value from the current environment
      --env-file stringArray        Read environment variables from a file (can be repeated). --env wins over any file; a later file wins over an earlier one
      --image-ref string            OCI image reference for inline-mode cloud create (mutually exclusive with --template; requires --cpus and --memory)
      --kit strings                 (Experimental) Additional kit reference (must be a mixin; directory, ZIP, git, or OCI). Can be specified multiple times
      --kit-arg stringArray         (Experimental) Value for an argument the kit declares, as name=value for every kit or kit.name=value for one (can be repeated)
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides
  -m, --memory string               Memory limit in binary units (e.g., 512m, 8g). Minimum: 512 MiB. Default: 50% of host memory, clamped to 512 MiB–32 GiB. Maximum: max(75% of host memory, 512 MiB)
      --name string                 Name for the sandbox (defaults to <agent>-<workdir>; at least two characters, starting with a letter or number, containing only letters, numbers, hyphens and periods (periods are rejected with --cloud); 'default' is reserved)
      --on-timeout string           What happens when --ttl lapses: 'stop' stops the sandbox in place so it can be started again later, 'restart' keeps it running by stopping and immediately starting it, or 'delete' removes it. Omit the flag and the server stops the sandbox when it can be started again later, and deletes it otherwise. With 'restart' a supplied --ttl must be at least 1h (cloud only).
      --platform string             Target platform: linux/amd64 or linux/arm64 (cloud only). With --image-ref, omitting it lets the server resolve the platform from the image and the CLI sends the local CPU as a hint for multi-platform images. With --template, omitting it inherits the template platform. With a sandbox kit, the kit's template is built for this platform and cached apart from other platforms; omitting it keeps the server's choice.
      --profile string              Governance profile to assign to the sandbox
  -p, --publish stringArray         Publish a sandbox port to the host (can be repeated): [[HOST_IP:]HOST_PORT:]SANDBOX_PORT[/PROTOCOL]
      --pull string                 Image pull policy (always|missing|never) (default "always")
  -q, --quiet                       Suppress verbose output
      --skills string               Shared skills store mode for the agent's skills directory (e.g. ~/.claude/skills): off, readonly (store linked in read-only, directory stays writable), or readwrite (store mounted over it, writes are shared). Default: readonly, or the configured skills.defaultMode setting.
      --static-mcp strings          MCP server names that form the sandbox's fixed (static) MCP set. Accepts a comma-separated list (--static-mcp notion,atlassian), repeated flags (--static-mcp notion --static-mcp atlassian), or a mix; all forms accumulate into the same set. The set is chosen once at creation time. Local sandboxes take names registered with 'sbx mcp add'. Cloud sandboxes resolve names on the cloud MCP gateway.
  -t, --template string             Container image to use for the sandbox (default: agent-specific image)
      --ttl duration                Cloud sandbox time-to-live before it times out (e.g. 30m, 2h, 1h30m; units are case-insensitive; cloud only; default: server-side)
  -v, --volume stringArray          (Experimental) Attach an existing persistent volume, NAME:MOUNTPATH (cloud only, experimental; repeatable)
```

### sbx create shell
```
Create a sandbox with access to a host workspace for shell.

The workspace path is mounted inside the sandbox at the same path as on the
host. Additional workspaces can be provided as extra arguments. Append ":ro" to
mount them read-only; a read-only argument may name a single file, which holds
that one path out of reach inside a workspace the sandbox can otherwise write.

Omit the path to create a sandbox without a workspace bind mount: the agent
then works in the container's own filesystem instead of on your files.

Use "sbx run --name SANDBOX" to attach to the agent after creation.

With --cloud:
Create a cloud sandbox for shell.

Cloud sandboxes have no host workspace, so no path follows the agent. Sizing
comes from --cpus and --memory and must land on a billable shape; without them
a cloud sandbox gets 2 CPUs and 4 GiB. A template named with -t / --template
must already exist in the cloud registry.

Cloud sandboxes use cloud network policies. Host network and HTTP policies
do not apply. Set cloud account defaults with
"sbx --cloud policy init <allow-all|balanced|deny-all>".

Use "sbx --cloud run --name SANDBOX" to attach to the agent after creation.

Usage:
  sbx create shell [PATH...] [flags]

Examples:
  # Create in the current directory
  sbx create shell .

  # Create with a specific path
  sbx create shell /path/to/project

  # Create with additional read-only workspaces
  sbx create shell . /path/to/docs:ro

  # Create without a workspace bind mount
  sbx create shell

  # Create a cloud sandbox for shell
  sbx --cloud create shell

  # Create a named cloud sandbox with a mixin baked in
  sbx --cloud create --name my-project shell --kit ./my-mixin/

  # Create from a template that already exists in the cloud registry
  sbx --cloud create -t TEMPLATE

Flags:
  -h, --help   help for shell

Global Flags:
      --allow-network strings       Network pattern to allow for cloud sandbox egress (cloud only; can be specified multiple times)
      --clone                       Run the agent on a private in-container clone of the host Git repository (mounted read-only) instead of bind-mounting the workspace; the agent's commits are accessible via the sandbox-<name> git remote on the host
      --cloud                       Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
      --cpus int                    Number of CPUs to allocate to the sandbox (0 = auto: all host CPUs, at most 16 on Linux arm64)
  -D, --debug                       Enable debug logging
      --deny-network strings        Add a per-sandbox network deny rule at creation time. Can be specified multiple times. The rule applies only to the new sandbox and can be listed or removed later with 'sbx policy ls <NAME>' or 'sbx policy rm network --sandbox <NAME> --resource <HOST>'. Safe under centralized governance because a local deny can only narrow, never widen, egress.
  -e, --env stringArray             Set an environment variable in the sandbox (can be repeated): KEY=VALUE, or a bare KEY to take the value from the current environment
      --env-file stringArray        Read environment variables from a file (can be repeated). --env wins over any file; a later file wins over an earlier one
      --image-ref string            OCI image reference for inline-mode cloud create (mutually exclusive with --template; requires --cpus and --memory)
      --kit strings                 (Experimental) Additional kit reference (must be a mixin; directory, ZIP, git, or OCI). Can be specified multiple times
      --kit-arg stringArray         (Experimental) Value for an argument the kit declares, as name=value for every kit or kit.name=value for one (can be repeated)
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides
  -m, --memory string               Memory limit in binary units (e.g., 512m, 8g). Minimum: 512 MiB. Default: 50% of host memory, clamped to 512 MiB–32 GiB. Maximum: max(75% of host memory, 512 MiB)
      --name string                 Name for the sandbox (defaults to <agent>-<workdir>; at least two characters, starting with a letter or number, containing only letters, numbers, hyphens and periods (periods are rejected with --cloud); 'default' is reserved)
      --on-timeout string           What happens when --ttl lapses: 'stop' stops the sandbox in place so it can be started again later, 'restart' keeps it running by stopping and immediately starting it, or 'delete' removes it. Omit the flag and the server stops the sandbox when it can be started again later, and deletes it otherwise. With 'restart' a supplied --ttl must be at least 1h (cloud only).
      --platform string             Target platform: linux/amd64 or linux/arm64 (cloud only). With --image-ref, omitting it lets the server resolve the platform from the image and the CLI sends the local CPU as a hint for multi-platform images. With --template, omitting it inherits the template platform. With a sandbox kit, the kit's template is built for this platform and cached apart from other platforms; omitting it keeps the server's choice.
      --profile string              Governance profile to assign to the sandbox
  -p, --publish stringArray         Publish a sandbox port to the host (can be repeated): [[HOST_IP:]HOST_PORT:]SANDBOX_PORT[/PROTOCOL]
      --pull string                 Image pull policy (always|missing|never) (default "always")
  -q, --quiet                       Suppress verbose output
      --skills string               Shared skills store mode for the agent's skills directory (e.g. ~/.claude/skills): off, readonly (store linked in read-only, directory stays writable), or readwrite (store mounted over it, writes are shared). Default: readonly, or the configured skills.defaultMode setting.
      --static-mcp strings          MCP server names that form the sandbox's fixed (static) MCP set. Accepts a comma-separated list (--static-mcp notion,atlassian), repeated flags (--static-mcp notion --static-mcp atlassian), or a mix; all forms accumulate into the same set. The set is chosen once at creation time. Local sandboxes take names registered with 'sbx mcp add'. Cloud sandboxes resolve names on the cloud MCP gateway.
  -t, --template string             Container image to use for the sandbox (default: agent-specific image)
      --ttl duration                Cloud sandbox time-to-live before it times out (e.g. 30m, 2h, 1h30m; units are case-insensitive; cloud only; default: server-side)
  -v, --volume stringArray          (Experimental) Attach an existing persistent volume, NAME:MOUNTPATH (cloud only, experimental; repeatable)
```

## sbx exec
```
Execute a command in a sandbox. If the sandbox is stopped, it is started first. Or — with --cloud — the cloud sandbox
ID (sbx_*) or name from "sbx --cloud ls".

Flags match the behavior of "docker exec", except detached exec (-d/--detach)
is not supported. Some flags (-d, --user, --privileged)
are not supported with --cloud and are rejected rather than silently ignored.
--detach-keys applies only to an interactive (-i/-t) cloud exec.

Usage:
  sbx exec [flags] SANDBOX COMMAND [ARG...]

Examples:
  # Open a shell inside a sandbox
  sbx exec -it my-sandbox bash

  # Run as root
  sbx exec -u root my-sandbox apt-get update

  # Cloud: run a command in a cloud sandbox by ID or name
  sbx --cloud exec -it sbx_abc123 bash
  sbx --cloud exec -it claude/my-sandbox bash

Flags:
  -d, --detach                 Detached mode (not supported)
      --detach-keys string     Override the key sequence for detaching a container
  -e, --env stringArray        Set environment variables
      --env-file stringArray   Read in a file of environment variables
  -h, --help                   help for exec
  -i, --interactive            Keep STDIN open even if not attached
      --privileged             Give extended privileges to the command
  -t, --tty                    Allocate a pseudo-TTY
  -u, --user string            Username or UID (format: <name|uid>[:<group|gid>])
  -w, --workdir string         Working directory inside the container

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx ls
```
List all sandboxes with their agent, status, published ports, and workspace.

Usage:
  sbx ls [flags]

Aliases:
  ls, list

Flags:
  -h, --help    help for ls
      --json    Output in JSON format
  -q, --quiet   Only display sandbox names

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx move
```
Move a sandbox between the local host and Docker's hosted Sandboxes service.

Move captures the sandbox's filesystem as a container image and starts a new
sandbox from it on the destination. Running processes and in-memory state do
not travel. The destination sandbox gets a new ID; name it with --name.

Neither direction deletes the source. Moving to cloud stops the local
sandbox; restart it with 'sbx run --name <name>'. Moving to local asks the
cloud source to stop; a refused or unconfirmed stop warns without failing
the move, and the stop may still be finishing when the move returns.
'sbx --cloud ls' shows it. A cloud sandbox with no agent is left running.
A stopped cloud source keeps its ID and state: 'sbx --cloud run <id>'
resumes it, 'sbx --cloud rm <id>' deletes it.

A failed or cancelled move restores what it can. It restarts a local source
that was running and removes the transfer templates it created. The restart
re-runs the entrypoint; processes you started by hand are not revived. If a
cleanup step fails, the output names what is left and the command that
recovers it.

What does not travel:
  - The workspace bind mount and other host mounts. Files moved to local
    stay inside the sandbox at the image's working directory; copy them out
    with 'sbx cp'.
  - Secrets managed by sbx. The destination picks its own secrets, so
    you may need to sign in again. Credentials saved in copied files
    still travel.
  - Volumes and environment variables attached to a cloud sandbox, when
    moving to local. A local sandbox's environment is part of its image
    and travels to the cloud.
  - Network rules you added locally. The sandbox's kit network rules do
    travel: moving to cloud applies them, as 'sbx create --cloud' does. If
    the kit can't be resolved, move warns and the account's cloud policy
    applies. Moving to local starts with the host's default policy. Active
    local L7 (HTTP) rules prompt before a move to cloud; --force skips the
    prompt but keeps the warning.
  - Cloud URLs and host port bindings. Moving to cloud republishes TCP
    ports under new cloud URLs; a port the cloud refuses is skipped with a
    warning. Moving to local saves the published TCP ports and binds them
    on loopback while the sandbox runs. Host ports can change on restart;
    'sbx ports SANDBOX' shows them. A cloud port published with an
    explicit host binding stops a move to local.

Sizing and disk:
  - Moving to cloud rounds recorded CPU and memory limits up to a cloud
    shape. Missing limits use cloud defaults with a warning. Limits above
    the largest shape stop the move before anything is captured. Moving to
    local uses local defaults.
  - Moving to local stages downloaded layers in the host's temporary
    directory. Reusing local layers can take up to 32 GiB in addition to
    the local runtime's image storage. If reuse fails, the layers are
    downloaded. If staging runs out of space, the move falls back to the
    export stream.

The cloud sandbox a move creates expires. The default is the server's TTL,
typically 1h: stopped in place on expiry when the account and sandbox
support it, deleted otherwise. Choose with --ttl and --on-timeout.
Extend later with 'sbx --cloud ttl'.

Usage:
  sbx move SANDBOX [flags]

Examples:
  # Move a cloud sandbox down to the local host
  sbx move sbx_abc123 --to local

  # Move a local sandbox up to the cloud
  sbx move my-sandbox --to cloud

  # Give the destination sandbox a custom name
  sbx move sbx_abc123 --to local --name big-refactor

Flags:
  -f, --force               Skip the move confirmation prompt
  -h, --help                help for move
      --name string         Name for the destination sandbox (default: 'moved-' + the source name; a cloud destination always adds a short unique suffix, a local one only when that name is already taken)
      --on-timeout string   What happens to the destination cloud sandbox when its TTL lapses: 'stop' stops it in place so it can be started again later, or 'delete' removes it. Not every sandbox supports 'stop', and an explicit request the server refuses fails the move. Default: stop when the sandbox supports it, else the server default (delete). Only with --to cloud
      --to string           Destination of the move: 'local' (cloud to local) or 'cloud' (local to cloud)
      --ttl duration        Time-to-live for the destination cloud sandbox (15s to 24h, e.g. 30m, 2h; only with --to cloud; default: server-side)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx ports
```
Manage sandbox port publishing.

List, publish, or unpublish sandbox ports. Publishing a local port starts a
stopped sandbox before creating the host binding. Without --publish or
--unpublish flags, lists all published ports.

Port spec format: [[HOST_IP:]HOST_PORT:]SANDBOX_PORT[/PROTOCOL]
If HOST_PORT is omitted, an ephemeral port is allocated automatically.
If HOST_IP is omitted, the port is bound on loopback, expanded based on
PROTOCOL and the sandbox's address families: tcp/udp binds both 127.0.0.1
and ::1 (or only 127.0.0.1 if the sandbox is IPv4-only); tcp4/udp4 binds
only 127.0.0.1; tcp6/udp6 binds only ::1.
Supported protocols: tcp, tcp4, tcp6, udp, udp4, udp6.

When publishing without a PROTOCOL, tcp4 is used — so a sandbox service
listening only on IPv4 is reachable without a host client having to avoid
::1 — or tcp6 when HOST_IP is an IPv6 address. Publish tcp explicitly to
bind both families.

When unpublishing without a PROTOCOL, the mapping is removed whether it was
published with that same default or as dual-stack tcp. Name the protocol to
remove a tcp6 or udp mapping; anything left behind is reported.

With --cloud:
Manage the exposed ports of a cloud sandbox.

List, publish, or unpublish ports on a cloud sandbox given by ID (sbx_*) or
name. Without --publish or --unpublish flags, lists the exposed ports.

A port is the sandbox port number alone or with a /tcp suffix; UDP and host
bindings are refused. The cloud control plane assigns a publicly reachable URL
for each exposed port.

Usage:
  sbx ports SANDBOX [flags]

Examples:
  # List published ports
  sbx ports my-sandbox

  # Publish sandbox port 8080 to an ephemeral host port
  sbx ports my-sandbox --publish 8080

  # Publish with a specific host port
  sbx ports my-sandbox --publish 3000:8080

  # Unpublish a port
  sbx ports my-sandbox --unpublish 3000:8080

  # Expose port 8080 on a cloud sandbox
  sbx --cloud ports sbx_abc123 --publish 8080

  # Remove an exposed port from a cloud sandbox
  sbx --cloud ports sbx_abc123 --unpublish 8080

Flags:
  -h, --help                    help for ports
      --json                    Output in JSON format (for port listing)
      --publish stringArray     Publish a port (can be repeated): [[HOST_IP:]HOST_PORT:]SANDBOX_PORT[/PROTOCOL] (local) or SANDBOX_PORT[/tcp] (cloud)
      --unpublish stringArray   Unpublish a port (can be repeated): [HOST_IP:]HOST_PORT:SANDBOX_PORT[/PROTOCOL] (local) or SANDBOX_PORT[/tcp] (cloud)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx prune
```
Remove all stopped sandboxes and their associated resources.

Only stopped sandboxes are candidates — a running sandbox is never removed,
which makes this safe to run habitually. Stop a sandbox first with
"sbx stop" if you want it pruned. To remove a specific sandbox regardless of
state, use "sbx rm SANDBOX".

Use --filter until=TIMESTAMP to narrow the set to sandboxes that stopped before
TIMESTAMP. The value can be an RFC 3339 timestamp, Unix timestamp, or Go duration
relative to now (e.g. until=168h keeps anything stopped within the last week).
A sandbox whose stop time the daemon cannot report is left alone, since how long
it has been stopped cannot be established.

Use --dry-run to list what would be removed without removing anything, and
--json with it for machine-readable output.

Pruning requires confirmation; use --force to skip the confirmation prompt
(for non-interactive scripts) and to remove a sandbox that is in use (e.g. an
open SSH connection). This action cannot be undone.

Secrets scoped to each successfully pruned sandbox are also deleted.

Local-only: cloud sandboxes expire via their TTL.

Usage:
  sbx prune [flags]

Flags:
      --dry-run              List the sandboxes that would be removed without removing them
      --filter stringArray   Filter candidates (supported: until=TIMESTAMP — stopped before TIMESTAMP)
  -f, --force                Skip confirmation prompts and remove even if in use (e.g. an open SSH connection)
  -h, --help                 help for prune
      --json                 Output the --dry-run listing in JSON format

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx rm
```
Remove one or more sandboxes and all associated resources. Or — with --cloud — the cloud sandbox
ID (sbx_*) or name from "sbx --cloud ls".

For local sandboxes, stops them, removes their containers, cleans up any Git
worktrees, deletes sandbox state, and deletes secrets scoped to each removed
sandbox. This action cannot be undone. With --cloud, deletes
the sandbox in Docker Sandboxes Cloud. This action cannot be undone. Once the
server accepts the request, rm waits up to 60 seconds per sandbox for the
deletion. A removal still completing after that exits 0. Verify it later with
"sbx --cloud ls".

Removal requires confirmation; use --force to skip confirmation prompts
(for non-interactive scripts) and to delete a sandbox that is in use
(e.g. an open SSH connection). Use --all to remove every sandbox. With --cloud, --all is
intentionally disabled as a safety gate — the blast radius covers every
sandbox the credential can see, which may include shared or production
workloads. Pass IDs explicitly in --cloud mode.

Usage:
  sbx rm [SANDBOX...] [flags]

Aliases:
  rm, remove, delete

Flags:
      --all     Remove all sandboxes
  -f, --force   Skip confirmation prompts and delete even if in use (e.g. an open SSH connection)
  -h, --help    help for rm

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx run
```
Run an agent in a sandbox, creating the sandbox if it does not already exist.

The first positional argument identifies the agent to run. It may be a built-in
agent name or a sandbox kit reference. Sandbox kit references may be local
directories, ZIP files, git repositories, or OCI references. Relative local
references must be explicit paths such as ./my-kit or ../my-kit.zip; bare values
retain their agent or sandbox-name meaning. To re-attach to an existing sandbox
by name, use --name; the agent positional is optional when the named sandbox
already exists and is read from its spec.

Pass agent arguments after the "--" separator. Additional workspaces can be
provided as extra arguments. Append ":ro" to mount them read-only; a read-only
argument may name a single file, which holds that one path out of reach inside a
workspace the sandbox can otherwise write.

Omit the path to mount the current directory. Pass a path to mount a different
workspace.

To create a sandbox without attaching, use "sbx create" instead, or
pass --detached (-d) to print the sandbox ID and exit without opening an
interactive session.

Available agents: claude, codex, copilot, cursor, devin, docker-agent, droid, gemini, kiro, opencode, shell

With --cloud:
Run an agent in a cloud sandbox, creating the sandbox if it does not already exist.

The first positional argument identifies the agent to run: a built-in agent
name or a sandbox kit reference (a local directory, ZIP file, git repository,
or OCI reference). Relative local references must be explicit paths such as
./my-kit or ../my-kit.zip. Cloud sandboxes have no host workspace, so no path
follows the agent. Pass agent arguments after the "--" separator.

Running an agent that has existing sandboxes, running or stopped, prompts you
to pick one to reuse or to create a new one. Pass --new to skip the prompt and
always create a fresh sandbox. --name NAME reuses and restarts the sandbox of
that name when it exists and creates it otherwise. A launch that bakes a kit
template (a sandbox kit or a mixin with build content) always creates fresh.
--detached skips the prompt: with --name it restarts that sandbox when it
exists, otherwise it creates a new one. A non-interactive run without
--detached is refused, so scripts pass --detached (e.g.
sbx --cloud run -d claude && sbx --cloud exec ...).

Sizing comes from --cpus and --memory and must land on a billable shape; without
them a cloud sandbox gets 2 CPUs and 4 GiB. A template named with -t / --template
must already exist in the cloud registry; the CLI does not upload it. See
https://docs.docker.com/ai/sandboxes/ for the cloud sandbox model.

Usage:
  sbx run [flags] [AGENT|SANDBOX_KIT] [PATH...] [-- AGENT_ARGS...]

Examples:
  # Create and run a sandbox with claude in the current directory
  sbx run claude

  # Create and run from a local sandbox kit
  sbx run ../path/to/my-agent/

  # Create and run from an OCI sandbox kit
  sbx run ghcr.io/foo/my-agent:latest

  # Add a mixin to a built-in agent
  sbx run claude --kit ./my-mixin/

  # Create and run with additional workspaces (read-only)
  sbx run claude . /path/to/docs:ro

  # Re-attach to an existing sandbox by name (agent read from its spec)
  sbx run --name existing-sandbox

  # Re-attach to an existing sandbox by name and verify the expected agent
  sbx run claude --name existing-sandbox

  # Run a sandbox with agent arguments
  sbx run claude -- --continue

  # Run claude in a new cloud sandbox
  sbx --cloud run claude

  # Create a cloud sandbox non-interactively and print its ID
  sbx --cloud run --detached claude

  # Reuse the cloud sandbox of that name, creating it when it does not exist
  sbx --cloud run --name my-project claude

  # Run with agent arguments
  sbx --cloud run claude -- --continue

Flags:
      --allow-network strings       Network pattern to allow for cloud sandbox egress (cloud only; can be specified multiple times)
      --clone                       Run the agent on a private in-container clone of the host Git repository; must be set at sandbox creation time (no-op when re-attaching to an existing clone-mode sandbox)
      --cpus int                    Number of CPUs to allocate to the sandbox (0 = auto: all host CPUs, at most 16 on Linux arm64)
      --deny-network strings        Add a per-sandbox network deny rule at creation time. Can be specified multiple times. The rule applies only to the new sandbox and can be listed or removed later with 'sbx policy ls <NAME>' or 'sbx policy rm network --sandbox <NAME> --resource <HOST>'. Safe under centralized governance because a local deny can only narrow, never widen, egress.
      --detach-keys string          Override the detach gesture that leaves the session running (Docker-style, e.g. "ctrl-\", "ctrl-x,ctrl-d"). Default: Ctrl-\. Use this when the default collides with an agent's keymap (cloud only).
  -d, --detached                    Start the sandbox and print its ID without opening an agent session
  -e, --env stringArray             Set an environment variable in the sandbox (can be repeated): KEY=VALUE, or a bare KEY to take the value from the current environment. Applies to the agent session, so it takes effect on a re-attach too; also baked into the sandbox when this run creates it
      --env-file stringArray        Read environment variables from a file (can be repeated). --env wins over any file; a later file wins over an earlier one. Applies to the agent session, so it takes effect on a re-attach too; also baked into the sandbox when this run creates it
  -h, --help                        help for run
      --image-ref string            OCI image reference for inline-mode cloud create (mutually exclusive with --template; requires --cpus and --memory)
      --kit strings                 (Experimental) Additional kit reference (must be a mixin; directory, ZIP, git, or OCI). Can be specified multiple times
      --kit-arg stringArray         (Experimental) Value for an argument the kit declares, as name=value for every kit or kit.name=value for one (can be repeated)
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides
  -m, --memory string               Memory limit in binary units (e.g., 512m, 8g). Minimum: 512 MiB. Default: 50% of host memory, clamped to 512 MiB–32 GiB. Maximum: max(75% of host memory, 512 MiB)
      --name string                 Name for the sandbox (default: <agent>-<workdir>)
      --new                         Always create a new cloud sandbox instead of prompting to reuse an existing one (cloud only)
      --on-timeout string           What happens when --ttl lapses: 'stop' stops the sandbox in place so it can be started again later, 'restart' keeps it running by stopping and immediately starting it, or 'delete' removes it. Omit the flag and the server stops the sandbox when it can be started again later, and deletes it otherwise. With 'restart' a supplied --ttl must be at least 1h (cloud only).
      --platform string             Target platform: linux/amd64 or linux/arm64 (cloud only). With --image-ref, omitting it lets the server resolve the platform from the image and the CLI sends the local CPU as a hint for multi-platform images. With --template, omitting it inherits the template platform. With a sandbox kit, the kit's template is built for this platform and cached apart from other platforms; omitting it keeps the server's choice.
      --profile string              Governance profile to assign to the sandbox
  -p, --publish stringArray         Publish a sandbox port to the host (can be repeated): [[HOST_IP:]HOST_PORT:]SANDBOX_PORT[/PROTOCOL]. Applied when the sandbox is created; ignored when re-attaching (use "sbx ports")
      --pull string                 Image pull policy (always|missing|never) (default "always")
      --rm                          Remove the sandbox after the agent session exits
      --skills string               Shared skills store mode for the agent's skills directory (e.g. ~/.claude/skills): off, readonly (store linked in read-only, directory stays writable), or readwrite (store mounted over it, writes are shared). Default: readonly, or the configured skills.defaultMode setting. Can only be used when creating a new sandbox.
      --static-mcp strings          MCP server names that form the sandbox's fixed (static) MCP set. Accepts a comma-separated list (--static-mcp notion,atlassian), repeated flags (--static-mcp notion --static-mcp atlassian), or a mix; all forms accumulate into the same set. The set is chosen once at creation time and cannot be changed when re-attaching to an existing sandbox. Local sandboxes take names registered with 'sbx mcp add'. Cloud sandboxes resolve names on the cloud MCP gateway.
  -t, --template string             Container image to use for the sandbox (default: agent-specific image)
      --ttl duration                Cloud sandbox time-to-live before it times out (e.g. 30m, 2h, 1h30m; units are case-insensitive; cloud only; default: server-side)
  -v, --volume stringArray          (Experimental) Attach an existing persistent volume, NAME:MOUNTPATH (cloud only, experimental; repeatable)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx stop
```
Stop one or more running sandboxes without removing them. Or — with --cloud — the cloud sandbox
ID (sbx_*) or name from "sbx --cloud ls".

Stopped sandboxes retain their state and can be restarted with "sbx run".

With --cloud, stop suspends each sandbox in place: its full state (memory +
disk) is preserved, the host is released, and the sandbox keeps its ID. Stop
returns once the request is accepted. Watch the sandbox reach the stopped
state with "sbx --cloud ls".
Restart it — same ID — with "sbx --cloud attach SANDBOX", with
"sbx --cloud run AGENT --name NAME" (also non-interactively with --detached),
or by running its agent again and picking it from the prompt.

Stop does not create a template and does not delete the sandbox. To capture
a durable, shareable template from a running sandbox instead, use
"sbx --cloud template save SANDBOX TAG" (which leaves the sandbox
running).

Usage:
  sbx stop SANDBOX [SANDBOX...]

Flags:
  -h, --help   help for stop

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx ttl
```
Inspect or extend a cloud sandbox's TTL.

With one argument, prints the current expiration and the maximum
remaining time before the sandbox's hard 24h-from-creation ceiling.

With two arguments — a duration prefixed with '+' followed by a sandbox
ID or name — extends the TTL by that amount, subject to the server-enforced
ceiling. The server cannot shorten an expiration, so DURATION must be
positive. Units are Go's duration units (h, m, s, ms, us, ns), in either
case (+2h, +2H, +1h30m).

SANDBOX may be given by ID (sbx_*) or name, as shown by "sbx --cloud ls".

Cloud-only: local sandboxes are not TTL-managed.

Usage:
  sbx ttl [+DURATION] SANDBOX

Flags:
  -h, --help   help for ttl
      --json   Output as JSON

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx daemon
```
Manage sandboxd daemon

Usage:
  sbx daemon COMMAND

Available Commands:
  log-level   Inspect or change sandboxd's per-category log levels
  restart     Restart the sandboxd daemon
  start       Start the sandboxd daemon
  status      Check sandboxd daemon status
  stop        Stop the sandboxd daemon

Flags:
  -h, --help   help for daemon

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx daemon COMMAND --help" for more information about a command.
```

### sbx daemon log-level
```
Inspect or change sandboxd's per-category log levels

Usage:
  sbx daemon log-level [COMMAND]

Available Commands:
  set         Set a category's log level (target: proxy, general, or all)

Flags:
  -h, --help   help for log-level

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx daemon log-level COMMAND --help" for more information about a command.
```

#### sbx daemon log-level set
```
Set a category's log level (target: proxy, general, or all)

Usage:
  sbx daemon log-level set <target> <level> [flags]

Flags:
  -h, --help   help for set

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx daemon restart
```
Restart the sandboxd daemon

Usage:
  sbx daemon restart [flags]

Flags:
  -h, --help   help for restart

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx daemon start
```
Start the sandboxd daemon

Usage:
  sbx daemon start [flags]

Flags:
  -d, --detach          Run daemon in background
  -h, --help            help for start
      --policy string   Initialize the global network policy: "allow-all", "balanced", or "deny-all"

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx daemon status
```
Check sandboxd daemon status

Usage:
  sbx daemon status [flags]

Flags:
  -h, --help   help for status
      --json   Output as JSON

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx daemon stop
```
Stop the sandboxd daemon

Usage:
  sbx daemon stop [flags]

Flags:
  -h, --help   help for stop

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx diagnose
```
Diagnose common issues with your sbx installation

Usage:
  sbx diagnose

Flags:
  -h, --help            help for diagnose
      --json            Output in JSON format (alias for --output json)
  -o, --output string   Output format: "json" or "github-issue"
      --upload          Upload diagnostics to Docker support

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx mcp
```
Register and manage MCP servers for use with sandbox sessions.

Usage:
  sbx mcp COMMAND

Available Commands:
  add         Register an MCP server
  auth        Authorize MCP servers
  inspect     Show MCP server details
  load        Load an already-registered MCP server into a running sandbox
  ls          List MCP servers
  rm          Remove a registered MCP server

Flags:
  -h, --help   help for mcp

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx mcp COMMAND --help" for more information about a command.
```

### sbx mcp add
```
Register an MCP server by name. The server is validated and its
specification is stored for use with sbx create/run --static-mcp.

This command only registers the server. To attach an already-registered
server to a running sandbox, use 'sbx mcp load'.

The --url flag accepts four input formats; the type is auto-detected:

  - Remote MCP endpoint URL (https://host/mcp — talks MCP at the URL;
    OAuth metadata is discovered via RFC 9728/8414).
  - MCP community-registry URL (https://registry.modelcontextprotocol.io/v0/servers/<name>...)
    — fetches the registry envelope and resolves the OCI image.
  - Server-manifest URL (any URL returning a server.json or server.yaml
    body shaped like the MCP community-registry schema — GitHub raw URLs,
    internal HTTP servers, ad-hoc CDN links all work).
  - Docker Hardened Images (DHI) image ref (dhi.io/<name>:<tag> or
    dhi.io/<name>@sha256:... — the server.json manifest is extracted
    from the image's in-toto attestation via the OCI Referrers API).

Other image refs (inputs without "://" that are not dhi.io, e.g.
docker.io/foo:tag) are no longer accepted. Use a server manifest instead.

SSRF guard and --skip-ssrf-check:
  A --url whose host resolves to a private/RFC1918, loopback, link-local, or
  cloud-metadata address is fetched anyway, but flagged: the add proceeds and
  a warning naming the resolved address is printed (this protects against
  manifest URLs that reach internal services, cloud metadata, or
  DNS-rebinding targets by making them visible, not by blocking them). Some
  legitimate servers live on private networks (split-horizon DNS, internal
  load balancers, VPN-only endpoints, PrivateLink), so their public hostname
  resolves to a private address and the warning is expected noise for them.
  OAuth authorization-server metadata has a separate SSRF guard with the same
  warn-and-proceed posture: a disallowed address is logged, not blocked. Pass
  --skip-ssrf-check to disable both checks for this add, including OAuth
  metadata redirects (silencing the warning too), when you trust the provider
  and its discovery destinations; use it only for URLs you control.

OAuth for remote endpoints (--oauth-authorization-server / --client-id):
  Two related options configure OAuth for a remote --url server (both are
  only valid with --url):

  --oauth-authorization-server hand-supplies the authorization-server
  metadata for a server that publishes no well-known RFC 9728/8414 metadata
  (e.g. Gmail). It is a local file path or an http(s) URL to a JSON document
  conforming to the RFC 8414 oauth-authorization-server shape
  (authorization_endpoint and token_endpoint are required). --client-id is
  required alongside it UNLESS the metadata document itself advertises a
  registration_endpoint, in which case a client is registered dynamically
  (RFC 7591) and --client-id may be omitted.

  --client-id supplies a PRE-REGISTERED OAuth client. It may be given WITHOUT
  --oauth-authorization-server: the server's authorization metadata is then
  discovered normally and the supplied client is attached to it. This is the
  right mode for a server whose discoverable metadata exposes no
  registration_endpoint (so Dynamic Client Registration is impossible) but
  which accepts a client id the operator registered ahead of time.

  Client secrets (confidential clients):
    There is no --client-secret flag. The secret for a confidential client
    lives in the secret store in the global scope under the
    service name "mcp:<server>:client_secret", and is read from there
    whenever the server is used:

      sbx secret set mcp:<server>:client_secret

    Run it with no -t so the value is read from stdin instead of landing in
    your shell history. The secret is never written to the MCP registration
    on disk. Remove it later with 'sbx secret rm mcp:<server>:client_secret'.

    The stored secret is bound to the OAuth identity (client id, issuer and
    token endpoint) that first used it. Re-registering the same server name
    against a different client or authorization server therefore does NOT
    reuse it — store the secret again for the new client. To let a new
    identity claim the existing secret, drop the recorded binding with
    'sbx secret rm mcp:<server>:client_secret:identity'.

  Two rules apply on the discovered path (they do not affect a server that
  advertises a registration_endpoint, the hand-supplied
  --oauth-authorization-server path, or --command servers):

    - If the discovered authorization metadata has NO registration_endpoint,
      Dynamic Client Registration is impossible, so --client-id is REQUIRED;
      the add fails without it. This is the Slack shape (discoverable metadata,
      no DCR, a pre-registered client).
    - A stored client secret is REQUIRED when the server's advertised
      token_endpoint_auth_methods_supported (RFC 8414) does NOT include "none"
      — i.e. it accepts only confidential clients (client_secret_basic /
      client_secret_post). Registration still succeeds without one, but the
      add-time authorization is skipped; store the secret and run
      'sbx mcp auth <server>' to finish. When the list includes "none" a
      public/PKCE client is allowed and --client-id alone is enough. If the
      server advertises no token_endpoint_auth_methods_supported at all (the
      field is optional in RFC 8414), the requirement cannot be determined and
      the add proceeds as usual.

Default OAuth scopes (--scope / --no-scope):
  --scope records the DEFAULT set of scopes to request at consent time for a
  remote --url OAuth server (repeatable). Precedence at authorization time is
  --no-scope > an explicit 'sbx mcp auth --scope' > the set recorded here > the
  scope set the RESOURCE itself says it requires (from its RFC 9728
  protected-resource metadata or its WWW-Authenticate challenge) > whichever of
  openid, email, profile, and offline_access are advertised. Other advertised
  scopes are excluded from this fallback. If no scopes are selected, the scope
  parameter is omitted so the authorization server can apply its own default
  grant (RFC 6749 §3.3).

  A resource that publishes a required set therefore gets it requested with no
  flag at all, and the consent block marks that set as derived rather than
  chosen. --no-scope suppresses all scope fallbacks and requests the server's
  default grant.

  When using recorded defaults or resource scopes, sbx also requests offline_access
  if the authorization server advertises it, allowing refresh tokens. To request
  an exact set without this addition, use 'sbx mcp auth <server> --scope ...'.

  Scopes you name are checked against the union of two documents a server can
  publish: the authorization server's RFC 8414 scopes_supported and the
  resource's own RFC 9728 protected-resource metadata (some servers, e.g.
  GitHub, document their real scopes on the resource and advertise almost
  nothing over RFC 8414). A scope in neither prints a warning naming the
  offender but is still requested — a mismatch is often the server's own
  documentation gap, not a typo, and either document is allowed to be
  non-exhaustive. This is a recognition check, not a promise: a recognized
  scope can still be refused at consent time.

  Scope values may be URN-shaped (urn:ietf:params:oauth:scope:mail) or
  URL-shaped (https://www.fastmail.com/dev/mcp). Neither needs quoting — a scope
  token cannot contain a space or a quote — and both are percent-encoded
  normally on the wire. --scope applies both to a hand-supplied override and to
  a plain --url server whose OAuth metadata is discovered.

RFC 8707 resource indicator (--resource):
  Every authorization request, code exchange and token refresh names the server
  the token is for, in the 'resource' parameter the MCP authorization
  specification requires (RFC 8707). That value is normally DERIVED, and you do
  not need this flag: it comes from the server's own RFC 9728 protected-resource
  metadata when it publishes some, and otherwise from the --url endpoint
  (lowercased scheme/host, path kept, fragment dropped).

  --resource replaces that derivation with a value you supply. Use it when the
  derived one is wrong — most often a server whose published identifier is its
  bare origin (https://api.example.com) while its endpoint has a path
  (https://api.example.com/mcp), which is indistinguishable from publishing
  nothing, so the endpoint URL is what gets sent. An authorization server
  entitled to reject an unknown target answers 'invalid_target'.

  The value must be an absolute URI with a scheme and a host, and RFC 8707 §2
  forbids a fragment; a bad value fails the add rather than being repaired or
  dropped later. It is sent VERBATIM — nothing is lowercased and no path or
  trailing slash is adjusted, because the string names a server and changing it
  could name a different one. Only one value is accepted: a gateway backend
  connects to exactly one MCP endpoint.

  It outranks both the published value and the URL derivation, and also an
  authorization server advertising resource_indicators_supported=false (the add
  says so when that happens). It is recorded on the registration, so there is no
  'sbx mcp auth --resource': one value is used by the add-time authorization,
  every later 'sbx mcp auth', and every token refresh — a resource that differed
  between them is the audience mismatch this parameter exists to prevent. To
  change it, 'sbx mcp rm' the server and add it again; the existing token was
  minted for the old resource anyway.

  Not 'audience': RFC 8707 'resource' is what the MCP specification requires, and
  an 'audience' parameter on an authorization-code request is an Auth0/Okta
  vendor extension that sbx does not send. See 'sbx mcp inspect <name>' for the
  effective value and where it came from.

  Scope limit: this governs the OAuth flow sbx itself runs — a local data plane
  (SBX_MCP_URL=none), and any server registered with
  --oauth-authorization-server/--client-id. For a plain remote in hosted mode the
  control-plane gateway is the OAuth client and does not carry the field yet, so
  the value is recorded and the add warns that it is not sent for that server.

Custom request headers for remote endpoints (--header):
  --header adds an HTTP header to every request sent to a remote --url
  endpoint, written in the curl convention 'Header-Name: header value'.
  Repeat the flag for more headers; each header name may be given once.
  Headers the transport owns (Host, Content-Length, Connection, Proxy-*, …)
  are rejected.

  Only a remote endpoint can carry them: --header is refused with --command
  and --local, and an add whose --url resolves to a stdio server (a registry
  or manifest URL naming an OCI image) fails rather than dropping them.

  A header value may reference a secret with ${placeholder}. The placeholder is
  stored in the registration exactly as typed and the secret itself never is;
  the value is read from the encrypted secret store and substituted when a
  sandbox connects to the server. Store it with:

    sbx secret set mcp:<server>:<placeholder>

  For example:

    sbx mcp add acme --url https://mcp.acme.com/mcp --header 'Authorization: Bearer ${api-key}'
    sbx secret set mcp:acme:api-key

  On an OAuth-protected server an explicit Authorization header takes
  precedence over the OAuth access token.

  Header secrets are read from the LOCAL secret store, so a header-bearing
  server only works where this host connects it. Adding one while your MCP
  gateway is the hosted (SaaS) one is rejected rather than registered with
  headers that would be silently dropped — unless the server carries a
  hand-supplied OAuth override (--oauth-authorization-server), which this
  host connects directly in every gateway mode.

Alternative input — local stdio command (--command + --args):
  The command runs as a subprocess on the HOST, outside the sandbox.

  WARNING: Local servers are for ad-hoc development only. They have
  no identity, no verifiable supply chain, and no sandboxing. The
  process runs with your host user's full permissions — it can read
  your filesystem, access your network, and call any API your user
  can. Do not use --command with untrusted executables.

Usage:
  sbx mcp add <name> (--url <url> | --command <cmd>) [flags]

Examples:
  # Remote MCP endpoint (OAuth auto-detected)
  sbx mcp add notion --url https://mcp.notion.com/mcp
  sbx mcp add linear --url https://mcp.linear.app/mcp

  # MCP community-registry URL
  sbx mcp add fetch --url https://registry.modelcontextprotocol.io/v0/servers/fetch-mcp/versions/latest

  # Plain server-manifest URL (server.json / server.yaml)
  sbx mcp add opine --url https://example.com/mcp/opine/server.yaml

  # Docker Hardened Image (manifest is extracted from the image attestation)
  sbx mcp add fetch --url dhi.io/fetch-mcp:latest

  # Registry URL, local mode (runs on host via docker run; stdio packages only)
  sbx mcp add fetch --local --url https://registry.modelcontextprotocol.io/v0/servers/fetch-mcp/versions/latest

  # Private-network endpoint (host resolves to a private address) — opt out of the SSRF guard
  sbx mcp add internal --url https://private.example.com/mcp --skip-ssrf-check

  # Remote endpoint with a hand-supplied OAuth override (server publishes no
  # well-known OAuth metadata): --oauth-authorization-server is a path or
  # http(s) URL to an RFC 8414 metadata document, --client-id the OAuth client id
  sbx mcp add acme --url https://mcp.acme.com/mcp --oauth-authorization-server ./acme-as.json --client-id my-client

  # Pre-registered client on a DISCOVERABLE server that has no registration
  # endpoint — no --oauth-authorization-server needed (metadata is discovered)
  sbx mcp add slack --url https://slack.example.com/mcp --client-id my-preregistered-client

  # Confidential client — store the secret first (prompted, never in argv or
  # shell history), then register; the secret is read from the secret store
  sbx secret set mcp:slack:client_secret
  sbx mcp add slack --url https://slack.example.com/mcp --client-id my-preregistered-client

  # Record default OAuth scopes to request at consent time (a scope the
  # server's authorization metadata does not advertise warns but is still
  # requested; repeat --scope for each one)
  sbx mcp add acme --url https://mcp.acme.com/mcp --scope read --scope write

  # URN- and URL-shaped scope values are ordinary scopes and need no quoting
  sbx mcp add fastmail --url https://api.fastmail.com/mcp --scope https://www.fastmail.com/dev/mcp --scope offline_access

  # Correct the RFC 8707 'resource' indicator when the derived one is wrong (a
  # server whose published identifier is not its endpoint URL)
  sbx mcp add acme --url https://mcp.acme.com/mcp --resource https://api.acme.com/mcp

  # Remote endpoint with custom headers (curl convention; repeatable). The
  # ${api-key} value is read from the secret store when a sandbox connects
  sbx mcp add acme --url https://mcp.acme.com/mcp --header 'Authorization: Bearer ${api-key}' --header 'Accept: application/json, text/event-stream'
  sbx secret set mcp:acme:api-key

  # Local stdio command (runs on host — development only)
  sbx mcp add github --command npx --args @modelcontextprotocol/server-github
  sbx mcp add postgres --command docker --args "run,-i,--rm,mcp/postgres"

  # Local stdio command with a working directory (cwd) for the host process
  sbx mcp add local-fs --command node --args server.js --dir /srv/data

Flags:
      --args strings                        Command-line arguments for the command
      --callback-port int                   Local port to bind the OAuth callback listener to during add-time authorization (default: OS-assigned ephemeral port). Useful when the port must be pre-registered in an OAuth app's allowed redirect URIs. Applies to --url remote OAuth servers; ignored with a warning if the server turns out not to need OAuth.
      --client-id string                    OAuth client id for a pre-registered client (with --url; may be used with or without --oauth-authorization-server). A confidential client's secret comes from 'sbx secret set mcp:<server>:client_secret'
      --command string                      Executable to run for a local stdio server
      --dir string                          Working directory (cwd) for a --command host server
      --disable-http2                       Do not negotiate HTTP/2 for this remote server, leaving HTTP/1.1. Applies to --url servers.
      --header stringArray                  Custom HTTP header to send to a remote --url endpoint, in curl form 'Name: value' (repeatable). A ${placeholder} in the value is substituted at connect time from 'sbx secret set mcp:<server>:<placeholder>'
  -h, --help                                help for add
      --local                               Run registry OCI server locally via docker run
      --no-scope                            Request no scopes during add-time authorization, so the authorization server applies its own default grant. Suppresses required and OIDC fallback scopes; cannot be combined with --scope. Applies to --url remote OAuth servers.
      --oauth-authorization-server string   Path or http(s) URL to an RFC 8414 oauth-authorization-server metadata JSON document
      --resource string                     RFC 8707 resource indicator to send during OAuth: an absolute URI (scheme and host, no fragment) naming the server the token is for. Overrides the value the server publishes in its RFC 9728 metadata and the one derived from --url; set it only when that derived value is wrong. Not honoured by the hosted gateway for a plain remote yet. Applies to --url remote OAuth servers.
      --scope strings                       Default OAuth scope to request at consent time (repeatable; a scope the server's advertised metadata does not recognize prints a warning but is still requested, since advertising a scope never promised the server would grant it either). With no --scope, the scope set the resource itself requires is requested; with neither, whichever of openid, email, profile, and offline_access are advertised are requested; other advertised scopes are excluded from this fallback. Applies to --url remote OAuth servers.
      --skip-auth                           Register an OAuth server without starting the hosted OAuth flow
      --skip-ssrf-check                     Skip SSRF checks for this add, including OAuth authorization-server metadata and redirects (operator asserts the provider is trusted)
      --url string                          MCP server manifest URL, remote endpoint URL, or dhi.io image ref

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx mcp auth
```
Authorize registered remote MCP servers through the hosted MCP control plane.

Commands use the Docker Hub account from 'sbx login' as the request principal.
User and tenant identity are derived by the control plane; they are not sent in
the request body.

Running 'sbx mcp auth <server>' authorizes or reauthorizes one server. If the
stored credential is expired, sbx asks the control plane to refresh it first and
only falls back to interactive OAuth when refresh needs user consent.

Use 'sbx mcp auth status' to inspect hosted credential status without starting
OAuth, and 'sbx mcp auth rm' to remove hosted credentials without removing
local MCP server registrations.

Pass --scope (repeatable) to authorize a specific set of scopes for this run,
overriding the default recorded at 'sbx mcp add' time. Precedence is --no-scope >
an explicit --scope > the recorded default > the scope set the RESOURCE says it
requires (from its RFC 9728 metadata or its WWW-Authenticate challenge) > whichever
of openid, email, profile, and offline_access are advertised. Other advertised
scopes are excluded from this fallback. If no scopes are selected, the scope
parameter is omitted so the authorization server can apply its own default grant.

A resource that publishes a required set therefore gets it requested without any
flag, and the consent block marks that set as derived rather than chosen. Pass
--no-scope to suppress all scope fallbacks and request the server's default grant.

When using recorded defaults or resource scopes, sbx also requests offline_access
if the authorization server advertises it, allowing refresh tokens. An explicit
--scope on this command requests exactly that set, without adding offline_access.

Scopes you choose are checked against both the authorization server's RFC 8414
scopes_supported and the resource's RFC 9728 metadata. A scope present in neither
prints a warning but is still requested. If neither document publishes scopes,
the request is accepted as given.
Membership is not a promise: scopes_supported is what the server SUPPORTS, not
what it will grant this client, so an advertised scope can still be refused at
consent time. In local data-plane mode a refusal prints the requested set, the
advertised set, the scopes the server named, and a narrower retry command; the
hosted control plane reports only that authorization failed or timed out.

For an existing or freshly completed authorization, the GRANTED set — what the
authorization server actually handed over — is reported alongside the status. An
authorization server may grant less than was asked for; when it restates no set
at all, RFC 6749 §5.1 makes that the set that was requested.

Scope values may be URN-shaped (urn:ietf:params:oauth:scope:mail) or URL-shaped
(https://www.fastmail.com/dev/mcp); neither needs quoting.

Usage:
  sbx mcp auth [server-name] [flags]
  sbx mcp auth COMMAND

Examples:
  sbx mcp auth status --all
  sbx mcp auth status notion
  sbx mcp auth rm --all
  sbx mcp auth rm notion
  sbx mcp auth --all
  sbx mcp auth notion
  sbx mcp auth notion --scope read --scope write
  sbx mcp auth notion --no-scope

Available Commands:
  rm          Remove MCP server OAuth credentials
  status      Show MCP server OAuth status

Flags:
      --all             Apply to all registered OAuth servers
      --format string   Output format: "text" or "json" (default "text")
  -h, --help            help for auth
      --json            Output in JSON format (alias for --format json)
      --no-scope        Request no scopes at all for this run, so the authorization server applies its own default grant. Suppresses recorded, required, and OIDC fallback scopes; cannot be combined with --scope
      --scope strings   OAuth scope to authorize for this run (repeatable; overrides the recorded default; unrecognized scopes warn but are still requested). With no --scope and no recorded default, the scope set the resource itself requires is requested; with none of those, whichever of openid, email, profile, and offline_access are advertised are requested; other advertised scopes are excluded from this fallback
      --verbose         Print authorization polling progress

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx mcp auth COMMAND --help" for more information about a command.
```

#### sbx mcp auth rm
```
Remove hosted OAuth credentials for registered MCP servers.

This command does not remove local MCP server registrations. Use 'sbx mcp rm'
to remove a registration.

Usage:
  sbx mcp auth rm [server-name] [flags]

Examples:
  sbx mcp auth rm --all
  sbx mcp auth rm notion
  sbx mcp auth rm notion --format=json

Flags:
      --all             Apply to all registered OAuth servers
  -f, --force           Skip confirmation prompts
      --format string   Output format: "text" or "json" (default "text")
  -h, --help            help for rm
      --json            Output in JSON format (alias for --format json)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

#### sbx mcp auth status
```
Show hosted OAuth credential status for registered MCP servers.

This command does not start OAuth or refresh expired credentials.

Usage:
  sbx mcp auth status [server-name] [flags]

Examples:
  sbx mcp auth status --all
  sbx mcp auth status notion
  sbx mcp auth status --all --format=json

Flags:
      --all             Apply to all registered OAuth servers
      --format string   Output format: "text" or "json" (default "text")
  -h, --help            help for status
      --json            Output in JSON format (alias for --format json)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx mcp inspect
```
Show MCP server details

Usage:
  sbx mcp inspect <name> [flags]

Examples:
  sbx mcp inspect notion

  # Machine-readable output for scripting
  sbx mcp inspect notion --json

Flags:
  -h, --help   help for inspect
      --json   Output in JSON format

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx mcp load
```
Attach a previously-registered MCP server to a running sandbox's gateway.
Connected agents see the new server's tools immediately via the standard MCP
tools/list_changed notification — no agent restart required.

The server must already exist in the local MCP store (register first with
'sbx mcp add'). Both remote/hosted and local-stdio servers are supported.

With --cloud:
Load an MCP server into a running cloud sandbox's gateway.

There is no local registration: the cloud gateway resolves the server name
itself, and the sandbox may be given by name or sbx_ ID. Connected agents see
the new server's tools immediately.

Usage:
  sbx mcp load <name> --sandbox <sandbox> [flags]

Examples:
  # Register, then load into the running sandbox 'my-sbx'.
  sbx mcp add notion --url https://mcp.notion.com/mcp
  sbx mcp load notion --sandbox my-sbx

  # Local stdio server.
  sbx mcp add github --command npx --args @modelcontextprotocol/server-github
  sbx mcp load github --sandbox my-sbx

  # Cloud: load a gateway-known server into a cloud sandbox by name or ID
  sbx --cloud mcp load notion --sandbox my-sbx

Flags:
  -h, --help             help for load
      --sandbox string   Target sandbox name (required)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx mcp ls
```
List registered MCP servers under the gateway that serves them.

The GATEWAY column reports where each server runs, who controls it, and the
signed-in identity; each row also reports its transport and whether it is usable now.
Servers needing authorization carry the 'sbx mcp auth' next step.

A server registered with custom headers is marked as such; one whose header
placeholder has no stored value carries the 'sbx secret set' next step, and one
whose headers this gateway cannot send is flagged unsupported. Either way the
server cannot connect as it stands. Run 'sbx mcp inspect <name>' for the headers
themselves and the state of each placeholder.

Auth status is read without starting an OAuth flow — from the local token store
in local data-plane mode, otherwise from the hosted control plane.

With --cloud:
List MCP servers reported by existing cloud sandbox gateways, with the
sandboxes that reference each server. Servers skipped by a gateway are excluded.
This is not a complete inventory of configured servers: unused configurations
and gateways that do not report server names are absent, including with --quiet.

Specify a sandbox to show its gateway state and host, requested servers, and
skipped servers.

Usage:
  sbx mcp ls [flags]

Examples:
  sbx mcp ls

  # Machine-readable output for scripting
  sbx mcp ls --json

  # Cloud: list servers reported across existing sandboxes
  sbx --cloud mcp ls

  # Cloud: show a cloud sandbox's gateway by name or sbx_ ID
  sbx --cloud mcp ls my-sbx

Flags:
  -h, --help    help for ls
      --json    Output in JSON format
  -q, --quiet   Only display MCP server names

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx mcp rm
```
Remove a registered MCP server

Usage:
  sbx mcp rm <name> [flags]

Examples:
  sbx mcp rm notion

Flags:
  -f, --force   Skip confirmation prompts
  -h, --help    help for rm

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx policy
```
Manage persistent access policies for sandboxes.

Policies contain rules that control what sandboxes can access. Local rules
can apply globally across all sandboxes or be scoped to one sandbox. Use
subcommands to allow, deny, list, or remove rules.

Usage:
  sbx policy COMMAND

Available Commands:
  allow       Add an allow rule for sandboxes
  check       Check whether policy allows an access request
  deny        Add a deny rule for sandboxes
  init        Initialize the global network policy
  inspect     Inspect policy or rule details
  log         Show sandbox policy logs
  ls          List sandbox policies
  profile     Manage policy profiles
  reset       Reset policies to defaults
  rm          Remove a policy rule

Flags:
  -h, --help   help for policy

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx policy COMMAND --help" for more information about a command.
```

### sbx policy allow
```
Add a rule that permits sandboxes to access specified resources.

Allowed resources are accessible within the selected policy scope. If a
resource matches both an allow and a deny rule, the deny rule takes
precedence.

Usage:
  sbx policy allow COMMAND

Available Commands:
  network     Allow network access to specified hosts

Flags:
  -h, --help   help for allow

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx policy allow COMMAND --help" for more information about a command.
```

#### sbx policy allow network
```
Allow sandbox network access to the specified hosts.

RESOURCES is a comma-separated list of hostnames, domains, IP addresses, or
CIDR prefixes. Rules apply to TCP by default; use --protocol to select UDP or
both transports. Supports exact domains (example.com), wildcard subdomains
(*.example.com), multi-label wildcards (**.example.com), single-character
globs (api?.example.com), character classes (api[12].example.com,
api[!1].example.com), and optional port suffixes (example.com:443). An IPv6
address takes a port in brackets ([2001:db8::1]:443) or a CIDR prefix
(2001:db8::1/128); a bare one is refused. Use "**" to allow all hosts. A bare
"*", an escaped glob character such as "\*", and any other pattern outside
these forms are rejected rather than stored as a rule that matches nothing.

The rule applies globally to all sandboxes by default. Use --sandbox to add
the rule to policy "local" scoped to a single sandbox instead.

Usage:
  sbx policy allow network [--sandbox SANDBOX] RESOURCES [flags]

Examples:
  # Allow access to a single host (all sandboxes)
  sbx policy allow network api.example.com

  # Allow access to multiple hosts
  sbx policy allow network "api.example.com,cdn.example.com"

  # Allow a host only for a specific sandbox
  sbx policy allow network --sandbox my-sandbox api.example.com

  # Allow all subdomains of a host
  sbx policy allow network "*.npmjs.org"

  # Allow all outbound traffic on both transports
  sbx policy allow network --protocol tcp,udp "**"

Flags:
  -h, --help               help for network
      --protocol tcp|udp   Network protocol: tcp or udp; repeat or comma-separate for both
      --sandbox string     Scope the rule to a specific sandbox (default: all sandboxes)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx policy check
```
Check whether the current sandbox policy would authorize an access request.

The check is read-only and evaluates the same daemon-side policy authorizer
used by sandbox network enforcement.

Usage:
  sbx policy check COMMAND

Available Commands:
  network     Check network access to a host

Flags:
  -h, --help   help for check

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx policy check COMMAND --help" for more information about a command.
```

#### sbx policy check network
```
Check whether current policy allows network access to TARGET.

TARGET may be a hostname, host:port, IP literal, or URL. Bare hosts and IP
literals are evaluated with port 443. HTTP(S) URLs use their default ports;
other URL schemes must include an explicit port. URLs supply only their host
and port: this command evaluates network authorization, not HTTP method or path.

Usage:
  sbx policy check network [--sandbox SANDBOX] TARGET [flags]

Examples:
  # Check global network policy
  sbx policy check network api.example.com

  # Check policy in a sandbox context
  sbx policy check network --sandbox my-sandbox api.example.com:443

  # Check a pasted URL and output JSON
  sbx policy check network --json https://api.example.com/v1

Flags:
  -h, --help               help for network
      --json               Output in JSON format
      --protocol tcp|udp   Network protocol to evaluate: tcp or udp
      --sandbox string     Evaluate in a specific sandbox policy context
      --verbose            Show the exact policy request fields

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx policy deny
```
Add a rule that blocks sandboxes from accessing specified resources.

Deny rules take precedence over allow rules for the same hostname or CIDR. An
allowed hostname isn't checked against CIDR rules for its resolved IP address.

Usage:
  sbx policy deny COMMAND

Available Commands:
  network     Deny network access to specified hosts

Flags:
  -h, --help   help for deny

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx policy deny COMMAND --help" for more information about a command.
```

#### sbx policy deny network
```
Block sandbox network access to the specified hosts.

RESOURCES takes the same forms as "sbx policy allow network": exact domains,
wildcard subdomains, IP addresses, and CIDR prefixes, with optional port
suffixes. Rules apply to TCP and UDP by default; use --protocol to restrict a
rule to one transport. Deny rules take precedence over allow rules for the
same hostname or CIDR. An allowed hostname isn't checked against CIDR rules
for its resolved IP address.

The rule applies globally to all sandboxes by default. Use --sandbox to add
the rule to policy "local" scoped to a single sandbox instead.

Usage:
  sbx policy deny network [--sandbox SANDBOX] RESOURCES [flags]

Examples:
  # Block access to a host (all sandboxes)
  sbx policy deny network ads.example.com

  # Block a host only for a specific sandbox
  sbx policy deny network --sandbox my-sandbox ads.example.com

  # Block all outbound traffic, TCP and UDP
  sbx policy deny network "**"

  # Block only UDP to a host
  sbx policy deny network --protocol udp media.example.com

Flags:
  -h, --help               help for network
      --protocol tcp|udp   Restrict the rule to one protocol: tcp or udp (default tcp,udp)
      --sandbox string     Scope the rule to a specific sandbox (default: all sandboxes)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx policy init
```
Initialize the global network policy that applies to all sandboxes.

This sets the initial global network policy and must be run before adding
custom allow/deny rules or starting a sandbox for the first time. It is a
one-time setup: once initialized, use "sbx policy reset" to start over.

This is the initial global policy, not a per-sandbox default; you can change
it later. Per-sandbox rules, including those added by kits such as the
built-in agent kits, apply on top for individual sandboxes.

Available policies:
  allow-all   All outbound network traffic is allowed
  balanced    Typical development traffic is allowed, such as AI services and package registries
  deny-all    All outbound network traffic is blocked

After initializing, use "sbx policy allow/deny/rm" to change the global policy.
Use "sbx policy reset" to clear all policies and start over.

With --cloud:
Set the default network mode of the cloud policy.

There is no one-time setup: init sets the default mode for the account, or for
one sandbox with --sandbox, keeps the existing allow and deny rules, and can be
run again. balanced is deny-all plus the balanced allow list added to the scope.
Use "sbx --cloud policy reset" to clear the rules first.

Usage:
  sbx policy init <allow-all|balanced|deny-all> [flags]

Examples:
  # Initialize with the balanced policy — recommended
  sbx policy init balanced

  # Allow all traffic
  sbx policy init allow-all

  # Block everything, then allow specific sites
  sbx policy init deny-all
  sbx policy allow network api.example.com:443

  # Set the account default to balanced
  sbx --cloud policy init balanced

  # Block everything for one sandbox, keeping its allow rules
  sbx --cloud policy init deny-all --sandbox my-sandbox

Flags:
  -h, --help             help for init
      --sandbox string   Target a single cloud sandbox's policy (cloud only)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx policy inspect
```
Inspect full detail for a selected policy or rule.

The selector may be a policy ID, policy name, rule ID, or rule name.
Selecting a policy lists every resource with its decision, rule, and status,
plus a rule table showing each rule's RULE_ID, whether it is editable, and
either the exact removal command or the reason it is read-only. Selecting a
rule shows just that rule with the same editability detail. RULE_ID is the
identifier accepted by "sbx policy rm network --id" (local rules only). Use
"sbx policy ls" to find policy names and "sbx policy ls --wide" to find rule
IDs and resource values.

Usage:
  sbx policy inspect <policy-or-rule> [flags]

Examples:
  # Inspect a policy by name
  sbx policy inspect "Developer access"

  # Inspect a rule by ID
  sbx policy inspect 2d3c1f0e-4a73-4e05-bc9d-f2f9a4b50d67

  # Machine-readable output for scripting
  sbx policy inspect "Developer access" --json

Flags:
  -h, --help   help for inspect
      --json   Output in JSON format

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx policy log
```
Show policy logs for all sandboxes, or filter by a specific sandbox name.

Displays which hosts were allowed or blocked by the proxy, along with the
matching rule, proxy type, and request count. Useful for debugging connectivity
issues or auditing network activity.

Usage:
  sbx policy log [SANDBOX] [flags]

Examples:
  # Show all policy logs
  sbx policy log

  # Show logs for a specific sandbox
  sbx policy log my-sandbox

  # Output in JSON format
  sbx policy log --json

  # Show the last 20 entries
  sbx policy log --limit 20

Flags:
  -h, --help          help for log
      --json          Output in JSON format
      --limit int     Maximum number of log entries to show
  -q, --quiet         Only display log entries
      --type string   Filter logs by type: "all", "network", or "filesystem" (filesystem logs are not supported yet; default "all") (default "all")

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx policy ls
```
List active sandbox policies.

Without SANDBOX, the command shows one overview row per policy with its source,
where it applies, and a summary of decisions by resource type. With SANDBOX, it
summarizes active rules that apply to that sandbox.

Use --wide to show the detailed rule-level table with separate POLICY,
POLICY_ID, RULE, and RULE_ID columns plus resources, status, and rule
metadata. RULE_ID is the identifier accepted by "sbx policy rm network --id"
(local rules only). Use --json for the filtered daemon response.

When remote governance is active, inactive policy rules are hidden by default.
Use --include-inactive to show inactive rules for troubleshooting.
Use "sbx policy inspect <policy-or-rule>" for full detail on a selected policy or
rule.

Usage:
  sbx policy ls [SANDBOX] [flags]

Examples:
  # List all policies
  sbx policy ls

  # List the policies that apply to one sandbox
  sbx policy ls my-sandbox

  # Show detailed rule-level rows with rule IDs and resources
  sbx policy ls --wide

  # Output filtered rules as JSON
  sbx policy ls --json

  # List only network policies
  sbx policy ls --type network

  # List organization policies that deny access
  sbx policy ls --source org --decision deny

  # List persistent rules created from approval prompts
  sbx policy ls --wide --created-via approval

  # Include inactive rules hidden by remote governance
  sbx policy ls --include-inactive

Flags:
      --created-via string   Filter policies by how they were created: "default", "added", "provisioned", or "approval"
      --decision string      Filter policies by decision: "allow" or "deny"
  -h, --help                 help for ls
      --include-inactive     Show inactive policy rules hidden by remote governance
      --json                 Output filtered policy rules as JSON
      --profile string       Filter policies by governance profile
      --protocol tcp|udp     Filter network rules by protocol: tcp or udp
      --source string        Filter policies by source: "local", "org", or "kit"
      --type string          Filter policies by type: "all", "network", "filesystem" (default "all") (default "all")
      --wide                 Show detailed rule-level output with rule IDs and resources

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx policy profile
```
Manage policy profiles provided by remote governance policies.

Profiles can be selected when creating sandboxes to apply a specific policy
profile.

Usage:
  sbx policy profile COMMAND

Available Commands:
  ls          List policy profiles

Flags:
  -h, --help   help for profile

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx policy profile COMMAND --help" for more information about a command.
```

#### sbx policy profile ls
```
List all policy profiles available from remote governance policies.

Each row shows the policies attached to that profile and a summary of their
decisions by resource type. Policies that apply regardless of profile are
excluded: they are not attached to any one profile. Use
"sbx policy ls --profile PROFILE" for the full set of policies a profile
resolves to, including the profile-independent ones.

Usage:
  sbx policy profile ls [flags]

Aliases:
  ls, list

Examples:
  # List policy profiles with their attached policies
  sbx policy profile ls

  # Show every policy that applies to one profile
  sbx policy ls --profile developer

  # Machine-readable output for scripting
  sbx policy profile ls --json

Flags:
  -h, --help    help for ls
      --json    Output in JSON format
  -q, --quiet   Only display profile names

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx policy reset
```
Remove all custom policies and restart the daemon to restore defaults.

This deletes the local policy store and stops the daemon. The daemon restarts
automatically on the next command, then prompts you to initialize the global
network policy again.

If sandboxes are currently running, they will be stopped when the daemon
shuts down. You will be prompted for confirmation unless --force is used.

With --cloud, deletes the custom cloud network policy for your account and
leaves the local daemon alone. You will be prompted for confirmation unless
--force is used. Afterwards the default the server now stores is printed.

Usage:
  sbx policy reset [flags]

Examples:
  # Reset policies — prompts if sandboxes are running
  sbx policy reset

  # Reset policies without confirmation
  sbx policy reset --force

Flags:
  -f, --force   Skip confirmation prompt
  -h, --help    help for reset

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx policy rm
```
Remove a previously added allow or deny rule.

Usage:
  sbx policy rm COMMAND

Available Commands:
  network     Remove a network rule

Flags:
  -h, --help   help for rm

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx policy rm COMMAND --help" for more information about a command.
```

#### sbx policy rm network
```
Remove a network rule by rule ID, resource, or both.

--id takes the RULE_ID value shown by "sbx policy ls --wide" and
"sbx policy inspect" — the rule's identifier, not its name. Passing a rule
name fails with an error that names the actual rule ID and, for removable
rules, the exact corrected command.

The rule is removed from the global policy by default. Use --sandbox to
remove from policy "local" scoped to a single sandbox instead.

Use "sbx policy ls --wide" to see active rule IDs and resources, or
"sbx policy ls --json" for the filtered rules; network values are printed in
the form the CLI accepts back.

With --cloud:
Remove a cloud network rule by pattern.

Cloud rules have no IDs: --resource removes the pattern from both the allow
and deny lists, and the output names each list it was removed from. The rule
leaves the account policy by default; use --sandbox to scope the removal to one
sandbox. Use "sbx --cloud policy ls" to see the current rules.

Usage:
  sbx policy rm network [--sandbox SANDBOX] [flags]

Examples:
  # List rules to find the ID or resource to remove
  sbx policy ls --wide

  # Remove a global rule by resource
  sbx policy rm network --resource api.example.com

  # Remove a global rule by ID
  sbx policy rm network --id 2d3c1f0e-4a73-4e05-bc9d-f2f9a4b50d67

  # Remove a sandbox-scoped rule by resource
  sbx policy rm network --sandbox my-sandbox --resource api.example.com

  # Remove a cloud rule by pattern, from the allow or deny list it is in
  sbx --cloud policy rm network --resource api.example.com

  # Remove a pattern from one cloud sandbox's rules
  sbx --cloud policy rm network --sandbox my-sandbox --resource api.example.com

Flags:
  -f, --force             Skip confirmation prompts
  -h, --help              help for network
      --id string         Remove by rule ID
      --resource string   Remove by resource value(s), comma-separated
      --sandbox string    Scope the removal to a specific sandbox (default: global policy)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx reset
```
Reset Docker Sandboxes to a freshly-installed state.

This command will:
- Stop all running sandboxes gracefully (30s timeout)
- Clear image cache
- Clear all internal registries
- Delete all sandbox state
- Remove all policies
- Remove the managed SSH configuration
- Clear the Gordon assistant's sessions and history
- Delete all stored secrets
- Sign out of Docker Sandboxes
- Stop the daemon
- Remove all state, cache, and config directories

WARNING: This is destructive and cannot be undone.
Running agents will be terminated and their work lost.
Cached images will be deleted and recreated on next use.
Stored secrets will need to be re-entered.

Use --preserve-secrets to keep stored secrets.
By default, you will be prompted to confirm (y/N).
Use --force to skip the confirmation prompt.

Usage:
  sbx reset [flags]

Flags:
  -f, --force              Skip confirmation prompt
  -h, --help               help for reset
      --preserve-secrets   Keep stored secrets

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx secret
```
Manage stored secrets for sandbox environments.

SERVICE SECRETS (e.g. "github", "anthropic", "openai")
  When a sandbox starts, the proxy uses stored secrets to authenticate API
  requests on behalf of the agent. The secret is never exposed directly.
  Scoped globally (shared across all sandboxes) or to a specific sandbox.

REGISTRY SECRETS (e.g. "ghcr.io", "myregistry.azurecr.io")
  Used to pull private template images and kit artifacts before sandbox
  creation. Unlike service secrets, registry credentials are host-only by
  default. They are not injected into sandboxes unless --all-sandboxes or
  --sandbox is set (the credential never enters the sandbox filesystem).
  Use "sbx secret set --registry <host> --password-stdin" to store them.

Usage:
  sbx secret COMMAND

Aliases:
  secret, secrets

Available Commands:
  import      Import secrets detected in host environment variables
  ls          List stored secrets
  rm          Remove a secret
  set         Create or update a secret
  set-custom  (Experimental) Create or update a custom secret

Flags:
  -h, --help   help for secret

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx secret COMMAND --help" for more information about a command.
```

### sbx secret import
```
Import secrets that sbx detects in your host environment
variables (e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY, GH_TOKEN) into the
global keychain. Once imported, the secret is available to every
sandbox without needing the env var on each shell.

Each detected env var is offered interactively with a Y/n prompt and a
last-4-char preview of the value. Existing stored entries are never
overwritten silently:

  - Interactive mode prompts for confirmation before overwriting.
  - --all imports new entries without prompting but SKIPS overwrites
    (use --force when you actually want to replace stored values).
  - --force imports unconditionally, including overwriting.

Services that already have an OAuth token configured (e.g. anthropic
after `sbx run claude … -- auth login`) are skipped: the OAuth token
takes precedence at runtime so any api-key import would never be used.
Run `sbx secret rm <service>` first if you want to switch from
OAuth to api-key auth.

Available services: anthropic, copilot, cursor, devin, droid, github, google, groq, mistral, nebius, openai, openrouter, xai

Usage:
  sbx secret import [SERVICE] [flags]

Examples:
  # Walk every detected env var, prompting before each import
  sbx secret import

  # Import only the openai service (uses OPENAI_API_KEY)
  sbx secret import openai

  # Non-interactive: import everything detected without prompting
  sbx secret import --all

  # Overwrite an existing stored entry without confirmation
  sbx secret import openai --force

  # Preview what would be imported without writing
  sbx secret import --dry-run

Flags:
      --all       Import every detected env var without prompting
      --dry-run   Show what would be imported without writing
  -f, --force     Overwrite an existing stored entry without confirmation
  -h, --help      help for import

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx secret ls
```
List stored secrets across global and sandbox scopes.

With no scope flag, all stored secrets are shown. Use --global to show only
global secrets, or --sandbox to show only secrets scoped to one sandbox.

Usage:
  sbx secret ls [flags]

Aliases:
  ls, list

Examples:
  # List all secrets
  sbx secret ls

  # List only global secrets
  sbx secret ls -g

  # List secrets for a specific sandbox
  sbx secret ls --sandbox my-sandbox

  # Filter by service
  sbx secret ls --service github

  # Machine-readable output for scripting
  sbx secret ls --json

Flags:
  -g, --global           Only list global secrets
  -h, --help             help for ls
      --json             Output in JSON format
  -q, --quiet            Only display secret names
      --sandbox string   Only list secrets for one sandbox
      --service string   Filter by secret service name

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx secret rm
```
Remove a secret

Usage:
  sbx secret rm [SERVICE] [flags]

Aliases:
  rm, remove, delete, unset

Examples:
  # Choose an existing secret to remove with the arrow keys
  sbx secret rm

  # Remove a global secret
  sbx secret rm github

  # Remove a sandbox-scoped secret
  sbx secret rm openai --sandbox my-sandbox

  # Remove without confirmation prompt
  sbx secret rm github -f

  # Remove OpenAI or Anthropic credential(s) from global scope (OAuth and/or API key)
  sbx secret rm openai
  sbx secret rm anthropic

  # Remove custom secret by specifying the placeholder value
  sbx secret rm --placeholder docker-placeholder-value

  # Remove registry pull credentials (removes host-only and global entries)
  sbx secret rm --registry ghcr.io -f

  # Remove only the global (all-sandboxes) registry credential
  sbx secret rm --all-sandboxes --registry ghcr.io -f

  # Remove every stored secret across every scope (service secrets, custom
  # secrets, OAuth tokens, and registry credentials)
  sbx secret rm --all

  # Remove a cloud custom secret by its name, or by a host it routes
  sbx --cloud secret rm api-example-com
  sbx --cloud secret rm --host api.example.com

Flags:
      --all               Remove every stored secret across all scopes
      --all-sandboxes     Remove registry credentials injected into every sandbox (requires --registry)
  -f, --force             Delete without confirmation prompt
  -h, --help              help for rm
      --registry string   Registry hostname to remove pull credentials for
      --sandbox string    Scope the removal to one sandbox (default: all scopes when choosing interactively, global with SERVICE)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx secret set
```
Create or update a service secret or registry credential.

### Service secrets

Available services: anthropic, copilot, cursor, devin, droid, github, google, groq, mistral, nebius, openai, openrouter, xai

Service secrets apply globally by default. Use --sandbox to scope a secret to
one sandbox. When SERVICE is omitted, an interactive prompt selects it.

### Dynamic secrets

Use --ref or --command to store a secret source instead of the secret value.
sbx resolves the source on the host when needed and caches the value according
to the --refresh policy.

--ref supports 1Password op:// references and AWS Secrets Manager ARNs. The
corresponding op or aws CLI must be installed and authenticated. --command
runs a shell command and uses its standard output as the secret value.

Command secrets run from a fresh temporary directory on the host during
verification and refresh. The host temporary directory must be absolute and must
remain outside writable sandbox mounts. Relative references such as ./helper or
cat token no longer resolve against the project or daemon working directory. Use an absolute
helper path outside shared workspaces. sbx does not copy helpers, inspect their
dependencies, or confine their execution. Helpers and any code or configuration
they load must remain outside writable sandbox mounts. Explicit paths into shared
workspaces and broad mounts exposing host configuration or the host temporary
directory remain unsafe, including mounts added later with sbx mount.

### Registry credentials

Use --registry to store pull credentials for a container registry. Unlike
service secrets, registry credentials are host-only by default:

- By default, credentials are used for template and kit pulls on the host.
  They are never injected into a sandbox.
- With --all-sandboxes, credentials are used for host pulls and injected by
  the proxy into every new sandbox's registry login. The credentials never
  enter the sandbox.
- With --sandbox, credentials are injected into the specified sandbox only.

For a registry whose Bearer authentication endpoint uses a different hostname,
use --registry-auth-endpoint to trust its exact HTTPS URL.

Usage:
  sbx secret set [SERVICE] [flags]

Examples:
  # Store a GitHub token globally (available to all sandboxes)
  sbx secret set github

  # Store an OpenAI key for a specific sandbox
  sbx secret set openai --sandbox my-sandbox

  # Non-interactive via stdin (e.g., from a secret manager or env var)
  echo "$ANTHROPIC_API_KEY" | sbx secret set anthropic

  # Start OpenAI OAuth flow and store global OAuth tokens
  sbx secret set openai --oauth

  # Resolve a 1Password reference at use time (requires an authenticated op CLI)
  sbx secret set anthropic --ref 'op://Private/Anthropic/api-key'

  # Resolve an AWS Secrets Manager ARN at use time (requires an authenticated aws CLI)
  sbx secret set anthropic --ref 'arn:aws:secretsmanager:us-west-2:123456789012:secret:anthropic-api-key'

  # Resolve a secret using an arbitrary command
  sbx secret set github --command 'gh auth token'

  # Registry: host-only (template/kit pulls, not injected into sandboxes)
  gh auth token | sbx secret set --registry ghcr.io --password-stdin

  # Registry: host pulls + injected into every new sandbox
  gh auth token | sbx secret set --all-sandboxes --registry ghcr.io --password-stdin

  # Registry: specific sandbox only
  gh auth token | sbx secret set --sandbox my-sandbox --registry ghcr.io --password-stdin

  # Self-hosted registry with a cross-host authentication endpoint
  echo "$GITLAB_PAT" | sbx secret set --all-sandboxes \
    --registry registry.example.com --username "$GITLAB_USER" \
    --registry-auth-endpoint https://gitlab.example.com/jwt/auth \
    --password-stdin

Flags:
      --all-sandboxes                   Inject registry credentials into every sandbox (requires --registry)
      --command string                  Use a command's standard output as the secret value
  -f, --force                           Overwrite an existing secret when --token is used
  -h, --help                            help for set
      --no-verify                       Skip checking the --ref or --command source when storing it
      --oauth                           Start OAuth flow and store OAuth tokens (openai/global only) With --cloud: openai or anthropic, stored only in the cloud (never the local secrets-engine)
      --password-stdin                  Read registry password or token from stdin (use with --registry)
      --ref string                      Use a 1Password op:// reference or AWS Secrets Manager ARN as the secret source
      --refresh string                  Secret refresh policy: on-demand or after a duration (default: 55m)
      --registry string                 Registry hostname for pull credentials (e.g. ghcr.io)
      --registry-auth-endpoint string   Trusted HTTPS auth endpoint for a cross-host registry realm
      --sandbox string                  Scope the secret to one sandbox instead of its default scope
      --show-error                      Show resolver standard error if the initial check fails (may contain secrets)
  -t, --token string                    Secret value (less secure: visible in shell history)
      --username string                 Registry username (use with --registry; omit for token-only auth)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx secret set-custom
```
EXPERIMENTAL: this command may change or be removed in future releases.

Create or update a custom secret for a service not built into sbx.

Custom secrets work via a placeholder: the sandbox sees the placeholder value
instead of the real secret. When the sandbox makes an outbound request to the
target host, the proxy replaces the placeholder with the real secret in the
request headers — the secret never enters the sandbox directly.

--host accepts an exact host, IP address, or wildcard pattern. Repeat --host
to cover multiple unrelated domains with one secret. "*" matches a single label
and "**" matches any number of labels. For example "*.example.com" covers
"cli.example.com" and "ide.example.com" with one entry.

Custom secrets apply globally by default. Use --sandbox to scope one to a
specific sandbox.

Command secrets run from a fresh temporary directory on the host during
verification and refresh. The host temporary directory must be absolute and must
remain outside writable sandbox mounts. Relative references such as ./helper or
cat token no longer resolve against the project or daemon working directory. Use an absolute
helper path outside shared workspaces. sbx does not copy helpers, inspect their
dependencies, or confine their execution. Helpers and any code or configuration
they load must remain outside writable sandbox mounts. Explicit paths into shared
workspaces and broad mounts exposing host configuration or the host temporary
directory remain unsafe, including mounts added later with sbx mount.

With --cloud, --host takes exact DNS names only (no IP addresses or wildcards)
and the proxy sets --header on requests to those hosts instead of substituting
the placeholder.

Usage:
  sbx secret set-custom [flags]

Examples:
  # Create a global custom secret. A unique placeholder is generated automatically.
  # The sandbox env var API_KEY is set to the placeholder value; outbound requests
  # to the host have the placeholder replaced with the real secret.
  sbx secret set-custom --host api.example.com --env API_KEY --value secret123

  # Use a wildcard host to cover multiple subdomains that share one key.
  sbx secret set-custom --host '*.coderabbit.ai' --env CODERABBIT_API_KEY --value secret123

  # Use multiple --host flags to cover unrelated domains with the same key.
  sbx secret set-custom --host api.example.com --host api.other.io --env API_KEY --value secret123

  # Scope to a specific sandbox instead of globally.
  sbx secret set-custom --sandbox my-sandbox --host api.example.com --env API_KEY --value secret123

  # Custom placeholder with {rand} suffix; the CLI prints the generated value.
  sbx secret set-custom --host api.example.com --placeholder sk-{rand} --value secret123

Flags:
      --command string       Use a command's standard output as the secret value
      --env string           Set this env var in the sandbox to the placeholder value
      --format string        How the value fills the header, with one %s; default "Bearer %s" when --header is omitted (with --cloud)
      --header string        HTTP header the proxy sets to the secret on requests to --host; default Authorization (with --cloud)
  -h, --help                 help for set-custom
      --host stringArray     Host, IP, or wildcard pattern (e.g. *.example.com); repeatable; with --cloud, exact DNS names only
      --name string          Secret name; default derived from the first --host (with --cloud)
      --no-verify            Skip checking the --ref or --command source when storing it
      --placeholder string   Placeholder value; use {rand} for a random suffix (e.g. sk-{rand})
      --ref string           Use a 1Password op:// reference or AWS Secrets Manager ARN as the secret source
      --refresh string       Secret refresh policy: on-demand (default) or after a duration
      --sandbox string       Scope the secret to one sandbox (default: all sandboxes)
      --show-error           Show resolver standard error if the initial check fails (may contain secrets)
  -t, --token string         Secret value (less secure: visible in shell history)
      --value string         Secret value (less secure: visible in shell history)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx settings
```
View and manage settings for Docker Sandboxes.

Settings can come from defaults, environment variables, or user overrides.
These commands use the local daemon to read evaluated values and manage
overrides, starting it if necessary.

Most changes take effect within about five seconds. Some require a daemon
restart.

Usage:
  sbx settings COMMAND

Available Commands:
  get         Get the value of a setting
  list        List settings
  set         Set a setting override
  unset       Remove a setting override

Flags:
  -h, --help   help for settings

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx settings COMMAND --help" for more information about a command.
```

### sbx settings get
```
Print the evaluated value of a setting.

Use --json to print the complete setting record, including its source, type,
default, and description.

Usage:
  sbx settings get <key> [flags]

Examples:
  # Get a setting value
  sbx settings get proxy.daemon

  # Get in JSON format with source info
  sbx settings get --json proxy.daemon

Flags:
  -h, --help   help for get
      --json   Print the complete setting record as JSON

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx settings list
```
List known settings with their evaluated value, type, source, and description.

The SOURCE column shows where the value came from (default, envvar, or
override). RESTART identifies settings that require 'sbx daemon restart' for
existing daemon-side consumers. Long values and descriptions are truncated to
keep the table readable; use --no-trunc or --json for complete output. Use
'sbx settings get <key>' to print one value in full.

Usage:
  sbx settings list [flags]

Aliases:
  list, ls

Examples:
  # List settings as a table
  sbx settings list

  # List settings as JSON
  sbx settings list --json

Flags:
  -h, --help       help for list
      --json       Print complete setting records as JSON
      --no-trunc   Show full values and descriptions, one setting per block

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx settings set
```
Set a user override for a setting.

Administrator constraints apply to saved overrides. A conflicting value is rejected.

The value is parsed according to the setting's type:
  bool   "true" or "false"
  int    integer value
  float  floating-point value
  string plain text
  json   raw JSON

Environment variables take precedence over user overrides.

Most changes take effect within about five seconds. If a daemon restart is
required, this command tells you to run 'sbx daemon restart'.

Usage:
  sbx settings set <key> <value> [flags]

Examples:
  # Route sandbox, daemon, and CLI egress through an upstream proxy
  sbx settings set proxy http://proxy.example.com:3128

  # Pull template and kit images through a registry mirror
  sbx settings set platform.images.registryMirror artifactory.corp/docker-remote

Flags:
  -h, --help   help for set

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx settings unset
```
Remove the user override for a setting.

Administrator policy remains in effect. Otherwise, the setting evaluates from
its environment variable, remote default, or built-in default.

Usage:
  sbx settings unset <key> [flags]

Examples:
  # Remove the override for a setting
  sbx settings unset proxy.daemon

Flags:
  -h, --help   help for unset

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx template
```
Manage sandbox templates.

Templates are saved snapshots of sandboxes that can be reused to create new
sandboxes with: sbx run --pull never -t TAG AGENT [WORKSPACE]

With --cloud:
Manage cloud sandbox templates.

Reuse a saved template with: sbx --cloud run --template TEMPLATE

Cloud snapshots and loads typically produce multi-GB artifacts and take
several minutes. See https://docs.docker.com/ai/sandboxes/ for details.

Usage:
  sbx template COMMAND

Available Commands:
  inspect     Show full metadata for a single template
  load        Load an image from a tar file into the sandbox runtime
  ls          List template images
  rm          Remove a template image
  save        Save a snapshot of the sandbox as a template

Flags:
  -h, --help   help for template

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx template COMMAND --help" for more information about a command.
```

### sbx template inspect
```
Show full metadata for a single template.

NAME|ID can be either a template name (resolved to its ID via the server's
?name= filter) or a template ID (tmpl_*).

Cloud-only in v1: requires --cloud.

Usage:
  sbx template inspect NAME|ID [flags]

Examples:
  sbx --cloud template inspect my-template
  sbx --cloud template inspect tmpl_abc123

  # Output in JSON format
  sbx --cloud template inspect my-template --json

Flags:
  -h, --help   help for inspect
      --json   Output in JSON format

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx template load
```
Load an image from a tar file into the sandbox runtime's image store.

The loaded image can be used as a template for new sandboxes.
Tar files are typically created with: sbx template save SANDBOX TAG --output FILE

With --cloud:
The tar is uploaded to the cloud template registry as a new template.
Takes two arguments (FILE, NAME). NAME must be unique per account.
--cpus and --memory-mib are required, and together must name one of the
billable sandbox shapes:
  micro (1 vCPU / 2048 MiB)
  small (2 vCPU / 4096 MiB)
  medium (4 vCPU / 8192 MiB)
  large (8 vCPU / 16384 MiB)
  xl (16 vCPU / 32768 MiB)
--capture-mode controls what gets captured for the template: "disk" (default)
is faster to load and cold-boots from the filesystem; "all" captures memory +
disk + microVM checkpoint so subsequent runs resume in sub-second time at the
cost of a slower load.

Cloud loads upload your full tar to the registry; multi-GB uploads can
take several minutes. See https://docs.docker.com/ai/sandboxes/ for the snapshot/load model.

Usage:
  sbx template load FILE [NAME] [flags]

Examples:
  # Load an image from a tar file
  sbx template load /tmp/myimage.tar              # Linux/macOS
  sbx template load C:\Users\me\myimage.tar       # Windows

  # Use the loaded image as a template
  sbx run --pull never -t myimage:v1.0 claude

  # Cloud: upload a tar as a cloud-managed template (disk capture, faster load)
  sbx --cloud template load /tmp/myimage.tar my-template --cpus 2 --memory-mib 4096

  # Cloud: capture memory + disk + microVM checkpoint for sub-second resume
  sbx --cloud template load /tmp/myimage.tar my-template --cpus 2 --memory-mib 4096 --capture-mode all

  # Cloud: with a description
  sbx --cloud template load /tmp/myimage.tar my-template --cpus 2 --memory-mib 4096 --description "Nightly baseline"

Flags:
      --capture-mode string   What gets captured for this template. "disk" (default) captures only the filesystem — cold-boot from a standard OCI image, faster load. "all" captures memory + disk + microVM checkpoint — sub-second TTI on resume, slower load. Only effective with --cloud. (default "disk")
      --cpus int              vCPUs; with --memory-mib must name a billable shape (required with --cloud)
      --description string    Optional template description (--cloud only)
  -h, --help                  help for load
      --memory-mib int        Memory in MiB; --cpus/--memory-mib must name a billable shape: micro (1 vCPU / 2048 MiB), small (2 vCPU / 4096 MiB), medium (4 vCPU / 8192 MiB), large (8 vCPU / 16384 MiB), xl (16 vCPU / 32768 MiB) (required with --cloud)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx template ls
```
List all template images stored in the sandbox runtime's image store.

Usage:
  sbx template ls [flags]

Aliases:
  ls, list

Examples:
  # List all template images
  sbx template ls

  # Output in JSON format
  sbx template ls --json

Flags:
  -h, --help    help for ls
      --json    Output in JSON format
  -q, --quiet   Only display template names

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx template rm
```
Remove a template image from the sandbox runtime's image store.

The image can be identified by tag (e.g. "myimage:v1.0") or by image ID
(full or prefix, e.g. "abc123"). Use "sbx template ls" to see available
images and their IDs.

With --cloud:
The template can be identified by its tmpl_* ID or by its human name
(resolved via the server-side ?name= filter). Use "sbx --cloud template ls".

Usage:
  sbx template rm TAG|ID|NAME [flags]

Aliases:
  rm, remove, delete

Examples:
  # Remove by tag
  sbx template rm myimage:v1.0

  # Remove by image ID (prefix)
  sbx template rm abc123

  # Cloud: remove by name
  sbx --cloud template rm my-template

  # Cloud: remove by tmpl_* id
  sbx --cloud template rm tmpl_abc123

Flags:
  -f, --force   Skip confirmation prompts
  -h, --help    help for rm

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx template save
```
Save a snapshot of the sandbox as a template.

The saved image is stored in the sandbox runtime's image store and can be
used as a template for new sandboxes with:
  sbx run --pull never -t TAG AGENT [WORKSPACE]

Use --pull never to use the saved image without trying to pull it from a registry.

Use --output to also export the image to a tar file that can be shared
and loaded on another host with: sbx template load FILE

With --cloud:
Snapshot a running cloud sandbox into a cloud-managed template. The
snapshot can take several minutes for kit-sized images; the command
polls for completion. Use --description to attach a free-form description
to the saved template.

--capture-mode controls what gets captured: "disk" (default) cold-boots
from the filesystem; "all" captures memory + disk + microVM checkpoint so
subsequent runs resume in sub-second time at the cost of a slower load.

Cloud snapshots typically produce multi-GB templates and take several
minutes to complete. See https://docs.docker.com/ai/sandboxes/ for the snapshot/load model.

Usage:
  sbx template save SANDBOX TAG [flags]

Examples:
  # Save as a template for new sandboxes on this host
  sbx template save my-sandbox myimage:v1.0

  # Also export to a shareable tar file
  sbx template save my-sandbox myimage:v1.0 --output /tmp/myimage.tar

  # Cloud: snapshot a running cloud sandbox into a cloud-managed template
  sbx --cloud template save sbx_abc123 my-snap

  # Cloud: attach a description to the saved template
  sbx --cloud template save sbx_abc123 my-snap --description "nightly build"

  # Cloud: capture memory + disk + microVM checkpoint for sub-second resume
  sbx --cloud template save sbx_abc123 my-snap --capture-mode all

Flags:
      --capture-mode string   What gets captured for this template. "disk" (default) captures only the filesystem — cold-boot from a standard OCI image, faster load. "all" captures memory + disk + microVM checkpoint — sub-second TTI on resume, slower load. Only effective with --cloud. (default "disk")
  -d, --description string    Description for the template (cloud only)
  -h, --help                  help for save
  -o, --output string         Also export the image to a tar file

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx tui
```
Open the interactive TUI dashboard

Usage:
  sbx tui [flags]

Flags:
  -h, --help   help for tui

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx volume
```
Manage persistent volumes for cloud sandboxes.

Volumes provide persistent storage that survives across sandbox runs.
Data is saved as a snapshot when a sandbox exits, not continuously
synced. If multiple sandboxes mount the same volume concurrently, the
last sandbox to exit wins — its snapshot overwrites the others.

Volumes are a cloud-only feature; every subcommand requires --cloud.

Usage:
  sbx volume COMMAND

Available Commands:
  create      Create a new persistent volume
  inspect     Show details for a volume
  ls          List persistent volumes
  rm          Delete a persistent volume

Flags:
  -h, --help   help for volume

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx volume COMMAND --help" for more information about a command.
```

### sbx volume create
```
Create a new persistent volume.

The volume name must be unique per account; an attempt to create a volume
with a name already in use is rejected.

Usage:
  sbx volume create NAME [flags]

Examples:
  sbx --cloud volume create my-cache

Flags:
  -h, --help   help for create
      --json   Output in JSON format

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx volume inspect
```
Show details for a volume

Usage:
  sbx volume inspect NAME [flags]

Aliases:
  inspect, get

Examples:
  sbx --cloud volume inspect my-cache

Flags:
  -h, --help   help for inspect

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx volume ls
```
List persistent volumes

Usage:
  sbx volume ls [flags]

Aliases:
  ls, list

Examples:
  sbx --cloud volume ls

Flags:
  -h, --help    help for ls
      --json    Output in JSON format
  -q, --quiet   Only display volume names

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx volume rm
```
Delete a persistent volume by name.

Volumes attached to active sandboxes cannot be deleted; detach them
first by stopping or deleting the sandbox(es) that mount the volume.

Usage:
  sbx volume rm NAME [flags]

Aliases:
  rm, remove, delete

Examples:
  sbx --cloud volume rm my-cache

Flags:
  -f, --force   Skip confirmation prompt
  -h, --help    help for rm

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx env
```
EXPERIMENTAL: this command may change or be removed in future releases.

Manage a sandbox environment declared in an sbxenv.yaml file.

The file describes the agent, optional mixin kits, workspace mounts,
environment variables, secrets to provision, and per-service credential
bindings. Secrets are provisioned at the environment's sandbox scope so
`sbx env rm` can remove everything it created.

A secret with `command` or `ref` can set `snapshot: true` to resolve on
the host after approval and store the result as a literal. This works locally
and with --cloud. Snapshots do not refresh; recreate the environment to rotate
them. A snapshot cannot set refresh or noVerify.

Command secrets run from a fresh temporary directory on the host during
verification and refresh. The host temporary directory must be absolute and must
remain outside writable sandbox mounts. Relative references such as ./helper or
cat token no longer resolve against the project or daemon working directory. Use an absolute
helper path outside shared workspaces. sbx does not copy helpers, inspect their
dependencies, or confine their execution. Helpers and any code or configuration
they load must remain outside writable sandbox mounts. Explicit paths into shared
workspaces and broad mounts exposing host configuration or the host temporary
directory remain unsafe, including mounts added later with sbx mount.

  secrets:
    github:
      command: gh auth token
      snapshot: true

A file may declare its own inputs in an `args:` block, each with a default or
`required: true` and an optional description, enum, or pattern. Reference one
as `${{ env.args.NAME }}` anywhere a value appears and supply it with
`--env-arg NAME=VALUE`.

A `kits:` entry is either a bare reference or a mapping carrying the
arguments that kit declares, which `--kit-arg` overrides per invocation:

  kits:
    - ./mixins/base
    - source: ./mixins/tool
      args:
        version: ${{ env.args.channel }}

A kit source written as an explicit relative path — `./…`, `../…`, `.`, `..`, or one
ending in `.zip` — is resolved against the directory of the file that declares
it, so a checked-in file reaches the same kits from wherever `sbx` is run. Write a
local kit that way: a bare `kits/tool` is as much a registry reference as a
directory, so it is left as written and resolves from the current directory.

A `workspace:` names the directory mounted read/write into the sandbox. A
relative path resolves against the directory of the file that declares it — as
a relative kit source does — so `workspace: .` mounts the directory the file
sits in. ${{ env.projectDir }} names the project directory (the one holding the
first PATH, or the current directory when none is named) and ${{ env.fileDir }}
the declaring file's own, for a value that spells its anchor out. Declaring
none mounts nothing — as omitting PATH does for `sbx create` — and the agent
works in the container's own filesystem instead of on your files. Unless the file sets `name:` or --name overrides it,
the sandbox is named after the mounted directory, or after the project directory
when nothing is mounted, so an environment that mounts nothing is still the same
sandbox every time.

A `lifecycle:` block declares commands that run on the host — outside
the sandbox, with your own privileges — around the sandbox's life:

  lifecycle:
    initialize:
      - command: test -d app || git clone https://github.com/acme/app
    postCreate:
      - command: ./scripts/seed-fixtures.sh
    preRemove:
      - command: ./scripts/archive-state.sh

Each runs through your shell from the project directory — the one holding the
first PATH, or the current directory when none is named; ${{ env.projectDir }}
names the same place, and commands merged in from a file elsewhere share it.
Change it per command with `workdir:`, and cap a command's runtime with
`timeout:`.

"initialize" runs on every "create" and every "run", including one that only
attaches, so it can produce the workspace the sandbox mounts; write it to be
repeatable. "postCreate" runs once the sandbox exists, and "preRemove" after
"sbx env rm" is confirmed but before it deletes anything. Whatever stops
preRemove is only a warning, so a teardown that cannot run still cannot make an
environment unremovable; what one adds to the environment instead — a stored
credential, an approved domain — stops the removal, since what follows would
delete it without a plan row ever naming it. "sbx env exec" runs no commands at
all.

Commands appear in the environment plan with the directory each runs in, and are
approved with it before the invocation does any work. An environment that declares
any of them asks on every invocation, whether or not this one is what runs them,
since approving a command also trusts whatever it invokes, including a script
whose contents change after the answer. Use --skip-host-commands to run none of
them.

Everything an environment sets up — host commands, credentials, bindings, MCP
registrations, directories, published ports, the sandbox itself and the
variables it runs with — is shown as a plan and approved before anything runs:

  ── ENVIRONMENT PLAN
     claude-proj

     secrets:
  +    anthropic:
  +      ref: op://vault/anthropic/key
  +      refresh: 55m

     lifecycle:
       initialize:
  ~      - command: make setup -> make setup && make seed
           workdir: /Users/me/proj

     Plan: + 1 to add, ~ 1 to change, - 0 to destroy.

     Approve this plan? [y/N]

The plan is your file: the same keys, nested the same way, in the order the
blocks are declared in, so a line is looked up where it was written. What the
plan adds is the margin, and the two values a line moves between. The totals
name every symbol the margin can carry: "+ to add" and "~ to change" above,
"- to destroy" for what "sbx env rm" takes away, "> to run" for a command that
runs again — a command converges to nothing, so it runs on every apply that
reaches it — and "! to forget" for a resource this environment applied and no
longer declares. Where the file has nothing to
say, a note in the margin does: that a resource is missing, or that the work
waits for the next create, since a port, a credential, a kit or a postCreate
command comes with the sandbox, so attaching to one that already exists leaves it
for the next one that is built. A resource that is as it was, and already
approved, is left out: what is on screen is what there is to read.

An attribute shows what the environment declares, so an edited kit argument or
variable reads as what it was against what it becomes, and a "command:" or "ref:"
secret shows where the credential comes from — a command that resolves one runs on
this machine. A secret's literal "value:" is the one exception: a plan is both shown
here and written to state, so it is named and stands in as a "sha256:" digest.

     kits:
  ~    - source: ./mixins/tool
  ~      args:
  ~        version: 1.2.3 -> 1.2.4
     env:
  ~    GOFLAGS: -mod=mod -> -mod=readonly

What an attribute was is what this environment last applied here, or — for one it
approved and never applied, such as a binding or a port answered for while
attaching to a sandbox that already exists — what was approved. Either way an
edit shows the value the question is about, whatever the row itself does.

An environment file that a mount would hand over read-write — which is what
mounting the project directory holding it does — is bound read-only at its own
path inside that mount, leaving the rest of it writable. The file decides what a
later invocation runs on this machine, so an agent able to edit it decides what
the next plan asks about. Declare "sandboxOptions.writableEnvFiles: true" where an
agent is meant to edit it; the plan then says the file is writable, as it says
when a file sits below a mount's own directory, where renaming that directory
reaches it again.

What was approved is recorded per environment under sbx's state directory, not
next to the file, so a later invocation asks only about what moved — and applies
silently when nothing did. An environment that declares commands running on this
machine is asked about on every invocation, changed or not: the answer is about
the invocation, and what a command does depends on what the project holds when it
runs rather than on the text approved before. "sbx env plan" prints the plan and
changes nothing.

Use --auto-approve (-y) where there is no terminal to answer on. Where an
environment's commands are your own and run many times a day,
"sbx settings set env.rememberHostCommands true" asks about them only when
they change.

With --cloud, create, run, exec, rm and plan manage a cloud sandbox from the same
file. Supported declarations are agents and kits, sandbox environment variables,
CPU and memory sizing, literal or snapshot secrets and bindings for supported providers, and
host lifecycle commands. Kits can publish TCP ports through cloud endpoints.
Stored cloud secrets are inherited as with cloud create/run; sandbox-scoped secrets
override account defaults, and secrets declared in the file override both. The plan
shows inherited credentials. Removal deletes only secrets provisioned by this environment.

Bindings merge into the same global credentials.yaml as local environments and
are retained on removal unless --prune-bindings is passed. Cloud must advertise
kit credential support. Third-party kit domains must be approved by the binding;
creation refuses implicit provider-default routing for a bound secret. Bindings
and secrets are provisioned at creation; editing them requires recreating the sandbox.

Snapshot references use the host's supported CLI resolvers (such as op:// and AWS
Secrets Manager ARNs); the sdk backend is unsupported. An interrupted secret
upload reuses the saved value in the host credential store. If that value is
unavailable, resolution is not repeated: follow the recovery error before cleanup.

workspace, additionalWorkspaces and clone name host directories, which a cloud
sandbox cannot mount; remove them and clone the project inside the sandbox from a
kit instead. Host port bindings, registry credentials, MCP definitions, custom
credential providers, local sandbox options and dynamic secret sources are also
rejected before host commands or provisioning. Initialize commands may prepare
local kit sources; kit validation follows initialization and precedes cloud baking.

State belongs to this machine, the selected cloud endpoint, Docker identity and
ordered environment files. Use the same target and files for subsequent commands.
DOCKER_ACCESS_TOKEN uses a token-specific state scope: changing the token starts
with separate state. Use sbx login for state that survives token refresh.

If creation is interrupted, retry the same command and declaration within 23 hours.
Removal waits for unresolved writes to be recovered. Older unresolved attempts
retain their journal; the error names its path. Before deleting that journal,
confirm the original requests have finished and remove their sandbox and secrets
using ordinary cloud commands in the same account and endpoint. If the outcome
cannot be confirmed, retain the journal and contact support.

Lifecycle commands inherit the cloud endpoint and expose SBX_SANDBOX_ID after
creation. Sandbox env values apply to new sessions; rejoining a live agent keeps
that process's existing environment.

  sbx --cloud env plan ./sbxenv.yaml
  sbx --cloud env run --auto-approve --detached ./sbxenv.yaml
  sbx --cloud env exec ./sbxenv.yaml -- git status
  sbx --cloud env rm --force ./sbxenv.yaml

Usage:
  sbx env COMMAND

Available Commands:
  create      Create a sandbox environment from sbxenv.yaml
  exec        Execute a command inside a sandbox environment
  plan        Show what an environment would change outside the sandbox
  rm          Remove a sandbox environment and its scoped resources
  run         Create (if needed) and attach to a sandbox environment

Flags:
  -h, --help   help for env

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx env COMMAND --help" for more information about a command.
```

### sbx env create
```
EXPERIMENTAL: this command may change or be removed in future releases.

Read the environment file from PATH (default: current directory),
provision its declared secrets at the sandbox scope, merge its credential
bindings, and create the sandbox. Use "sbx env run" to attach.

Each PATH may be a directory (the file is <PATH>/sbxenv.yaml) or the
path to the environment file itself. Passing more than one PATH deep-merges them
in order (docker-compose `-f` semantics): later files override earlier ones.
Values may reference the arguments the file declares with ${{ env.args.NAME }},
supplied by --env-arg, plus ${{ env.projectDir }} and ${{ env.fileDir }}.
Nothing else is expanded, so a "$" is literal text.

A directory resolves to the sbxenv.yaml in it and to no other name; any
other file is read only when a PATH names it. The hidden .sbxenv.yaml was once
read as a directory's own environment too, so a project still holding one now
reads as having none.

With no PATH, an existing .sbxenv.yaml in your home directory is merged
underneath as a base layer for defaults shared across projects; naming any
PATH skips the layer. It may not set "name:", which identifies a single
project, and its "workspace:" must be rooted at ${{ env.projectDir }} — for
the base that is always the directory the invocation runs from, since naming
any PATH skips it — so the base mounts each project's own directory rather
than one directory under all of them. Changing its "agent:"
changes the derived <agent>-<directory-basename> sandbox name, leaving
sandboxes created under the previous name for "sbx env rm" to miss.

A list such as "ports" or "mcp.servers" concatenates across layers rather
than overriding, so an entry declared in both appears twice.

Usage:
  sbx env create [PATH...] [flags]

Flags:
  -y, --auto-approve                Apply the environment plan without asking
      --clone                       Override workspace.clone in sbxenv.yaml (see 'sbx create --clone')
      --env-arg stringArray         (Experimental) Value for an argument the environment file declares, as name=value (can be repeated)
      --env-args-file stringArray   (Experimental) File of name=value environment arguments, one per line (can be repeated); --env-arg overrides
  -h, --help                        help for create
      --kit-arg stringArray         (Experimental) Value for an argument a kit declares, as name=value for every kit or kit.name=value for one (can be repeated); overrides the args a kits: entry pins in sbxenv.yaml
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides
      --name string                 Name for the sandbox, overriding 'name:' in sbxenv.yaml and the derived <agent>-<directory> (every 'sbx env' command addressing this environment needs the same value)
      --skip-host-commands          Skip the host lifecycle commands the environment declares

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx env exec
```
EXPERIMENTAL: this command may change or be removed in future releases.

Run COMMAND in the sandbox declared in sbxenv.yaml. The sandbox
must already exist (see "sbx env create" and "sbx env run"); a stopped sandbox is
started first.

Arguments before `--` are environment-file paths, following the same rules as
the other "sbx env" subcommands: each PATH may be a directory (the file is
<PATH>/sbxenv.yaml) or the path to the environment file itself, and passing
more than one deep-merges them in order. Without a `--` every positional
argument forms the command and the environment file is read from the current
directory.

A directory resolves to the sbxenv.yaml in it and to no other name; any
other file is read only when a PATH names it. The hidden .sbxenv.yaml was once
read as a directory's own environment too, so a project still holding one now
reads as having none.

With no PATH, an existing .sbxenv.yaml in your home directory is merged
underneath as a base layer for defaults shared across projects; naming any
PATH skips the layer. It may not set "name:", which identifies a single
project, and its "workspace:" must be rooted at ${{ env.projectDir }} — for
the base that is always the directory the invocation runs from, since naming
any PATH skips it — so the base mounts each project's own directory rather
than one directory under all of them. Changing its "agent:"
changes the derived <agent>-<directory-basename> sandbox name, leaving
sandboxes created under the previous name for "sbx env rm" to miss.

A list such as "ports" or "mcp.servers" concatenates across layers rather
than overriding, so an entry declared in both appears twice.

Flags match the behavior of "sbx exec".

Usage:
  sbx env exec [flags] [PATH...] -- COMMAND [ARG...]

Examples:
  # Run a command in the environment declared in the current directory
  sbx env exec go test ./...

  # Open a shell
  sbx env exec -it -- bash

  # Run against explicitly merged environment files
  sbx env exec sbxenv.yaml override.yaml -- npm test

Flags:
  -d, --detach                      Detached mode (not supported)
      --detach-keys string          Override the key sequence for detaching a container
  -e, --env stringArray             Set environment variables
      --env-arg stringArray         (Experimental) Value for an argument the environment file declares, as name=value (can be repeated)
      --env-args-file stringArray   (Experimental) File of name=value environment arguments, one per line (can be repeated); --env-arg overrides
      --env-file stringArray        Read in a file of environment variables
  -h, --help                        help for exec
  -i, --interactive                 Keep STDIN open even if not attached
      --name string                 Name for the sandbox, overriding 'name:' in sbxenv.yaml and the derived <agent>-<directory> (every 'sbx env' command addressing this environment needs the same value)
      --privileged                  Give extended privileges to the command
  -t, --tty                         Allocate a pseudo-TTY
  -u, --user string                 Username or UID (format: <name|uid>[:<group|gid>])
  -w, --workdir string              Working directory inside the container

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx env plan
```
EXPERIMENTAL: this command may change or be removed in future releases.

Read the environment file from PATH (default: current directory) and print
everything applying it would set up: the host commands it runs, the credentials
and bindings it provisions, the MCP servers it registers, the directories it
creates, the ports it publishes, and the sandbox itself along with the variables
it runs with.

The plan is compared against what this environment last applied on this machine,
against what was approved where nothing applied it, and against what is there
now, so a second run shows only what moved. Nothing is applied, approved, or
recorded: use "sbx env create" or "sbx env run" for that.

Each PATH may be a directory (the file is <PATH>/sbxenv.yaml) or the
path to the environment file itself. Passing more than one PATH deep-merges them
in order, matching the other "sbx env" subcommands.

A directory resolves to the sbxenv.yaml in it and to no other name; any
other file is read only when a PATH names it. The hidden .sbxenv.yaml was once
read as a directory's own environment too, so a project still holding one now
reads as having none.

With no PATH, an existing .sbxenv.yaml in your home directory is merged
underneath as a base layer for defaults shared across projects; naming any
PATH skips the layer. It may not set "name:", which identifies a single
project, and its "workspace:" must be rooted at ${{ env.projectDir }} — for
the base that is always the directory the invocation runs from, since naming
any PATH skips it — so the base mounts each project's own directory rather
than one directory under all of them. Changing its "agent:"
changes the derived <agent>-<directory-basename> sandbox name, leaving
sandboxes created under the previous name for "sbx env rm" to miss.

A list such as "ports" or "mcp.servers" concatenates across layers rather
than overriding, so an entry declared in both appears twice.

Usage:
  sbx env plan [PATH...] [flags]

Flags:
      --clone                       Override workspace.clone in sbxenv.yaml (see 'sbx create --clone')
      --env-arg stringArray         (Experimental) Value for an argument the environment file declares, as name=value (can be repeated)
      --env-args-file stringArray   (Experimental) File of name=value environment arguments, one per line (can be repeated); --env-arg overrides
  -h, --help                        help for plan
      --kit-arg stringArray         (Experimental) Value for an argument a kit declares, as name=value for every kit or kit.name=value for one (can be repeated); overrides the args a kits: entry pins in sbxenv.yaml
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides
      --name string                 Name for the sandbox, overriding 'name:' in sbxenv.yaml and the derived <agent>-<directory> (every 'sbx env' command addressing this environment needs the same value)
      --skip-host-commands          Plan without the host lifecycle commands the environment declares

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx env rm
```
EXPERIMENTAL: this command may change or be removed in future releases.

Remove the sandbox declared in sbxenv.yaml along with the
secret values provisioned at its sandbox scope (service, custom, and registry
credentials). Global credential bindings are left in place by default since
they are user-wide and may be shared with other sandboxes; pass
--prune-bindings to also remove the bindings this environment declares.

Each PATH may be a directory (the file is <PATH>/sbxenv.yaml) or the
path to the environment file itself. Passing more than one PATH deep-merges them
in order (docker-compose `-f` semantics), so the same set used to create the
environment resolves to the same sandbox on removal.

A directory resolves to the sbxenv.yaml in it and to no other name; any
other file is read only when a PATH names it. The hidden .sbxenv.yaml was once
read as a directory's own environment too, so a project still holding one now
reads as having none.

With no PATH, an existing .sbxenv.yaml in your home directory is merged
underneath as a base layer for defaults shared across projects; naming any
PATH skips the layer. It may not set "name:", which identifies a single
project, and its "workspace:" must be rooted at ${{ env.projectDir }} — for
the base that is always the directory the invocation runs from, since naming
any PATH skips it — so the base mounts each project's own directory rather
than one directory under all of them. Changing its "agent:"
changes the derived <agent>-<directory-basename> sandbox name, leaving
sandboxes created under the previous name for "sbx env rm" to miss.

A list such as "ports" or "mcp.servers" concatenates across layers rather
than overriding, so an entry declared in both appears twice.

Usage:
  sbx env rm [PATH...] [flags]

Flags:
      --env-arg stringArray         (Experimental) Value for an argument the environment file declares, as name=value (can be repeated)
      --env-args-file stringArray   (Experimental) File of name=value environment arguments, one per line (can be repeated); --env-arg overrides
  -f, --force                       Skip confirmation prompts and delete even if in use (e.g. an open SSH connection)
  -h, --help                        help for rm
      --name string                 Name for the sandbox, overriding 'name:' in sbxenv.yaml and the derived <agent>-<directory> (every 'sbx env' command addressing this environment needs the same value)
      --prune-bindings              Also remove this environment's bindings from the global credentials.yaml
      --skip-host-commands          Skip the host lifecycle commands the environment declares

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx env run
```
EXPERIMENTAL: this command may change or be removed in future releases.

Read the environment file from PATH (default: current directory)
and drop into the sandbox shell. If the sandbox already exists it is started
and re-attached without re-provisioning; otherwise it is created first
(provisioning secrets and bindings) and then attached.

Each PATH may be a directory (the file is <PATH>/sbxenv.yaml) or the
path to the environment file itself. Passing more than one PATH deep-merges them
in order (docker-compose `-f` semantics): later files override earlier ones.
Values may reference the arguments the file declares with ${{ env.args.NAME }},
supplied by --env-arg, plus ${{ env.projectDir }} and ${{ env.fileDir }}.
Nothing else is expanded, so a "$" is literal text.

A directory resolves to the sbxenv.yaml in it and to no other name; any
other file is read only when a PATH names it. The hidden .sbxenv.yaml was once
read as a directory's own environment too, so a project still holding one now
reads as having none.

With no PATH, an existing .sbxenv.yaml in your home directory is merged
underneath as a base layer for defaults shared across projects; naming any
PATH skips the layer. It may not set "name:", which identifies a single
project, and its "workspace:" must be rooted at ${{ env.projectDir }} — for
the base that is always the directory the invocation runs from, since naming
any PATH skips it — so the base mounts each project's own directory rather
than one directory under all of them. Changing its "agent:"
changes the derived <agent>-<directory-basename> sandbox name, leaving
sandboxes created under the previous name for "sbx env rm" to miss.

A list such as "ports" or "mcp.servers" concatenates across layers rather
than overriding, so an entry declared in both appears twice.

Usage:
  sbx env run [PATH...] [flags]

Flags:
  -y, --auto-approve                Apply the environment plan without asking
      --clone                       Override workspace.clone in sbxenv.yaml (see 'sbx create --clone')
  -d, --detached                    Create/start the sandbox without attaching
      --env-arg stringArray         (Experimental) Value for an argument the environment file declares, as name=value (can be repeated)
      --env-args-file stringArray   (Experimental) File of name=value environment arguments, one per line (can be repeated); --env-arg overrides
  -h, --help                        help for run
      --kit-arg stringArray         (Experimental) Value for an argument a kit declares, as name=value for every kit or kit.name=value for one (can be repeated); overrides the args a kits: entry pins in sbxenv.yaml
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides
      --name string                 Name for the sandbox, overriding 'name:' in sbxenv.yaml and the derived <agent>-<directory> (every 'sbx env' command addressing this environment needs the same value)
      --skip-host-commands          Skip the host lifecycle commands the environment declares

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx kit
```
EXPERIMENTAL: this command may change or be removed in future releases.

Manage kit artifacts.

Kits are declarative YAML artifacts that define sandbox agents or extend them
with additional credentials, network policies, environment variables, startup
commands, and files.

Usage:
  sbx kit COMMAND

Available Commands:
  add         Add a mixin to a sandbox
  builder     Manage the kit builder sandbox
  inspect     Display details about a kit artifact
  pack        Package a directory as a kit artifact
  provenance  Show the SLSA provenance attached to a kit
  pull        Pull a kit artifact from an OCI registry
  push        Push a kit artifact to an OCI registry
  sign        Sign a kit artifact
  validate    Validate a kit artifact
  verify      Verify a kit artifact's signature

Flags:
  -h, --help   help for kit

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx kit COMMAND --help" for more information about a command.
```

### sbx kit add
```
EXPERIMENTAL: this command may change or be removed in future releases.

Add a mixin artifact to an existing sandbox.

The sandbox's container is recreated with the new kit appended to its
original kit list, preserving kit-owned volumes (e.g. agent session
state) across the swap. Workspace data is unaffected: bind-mounted
sandboxes keep their host-side mount; --clone sandboxes keep their
in-container working tree via a named workspace volume that
reattaches to the swap container.

The sandbox must already exist and must have been created with the
recreate-aware label set (sandboxes created before the kit-add recreate
feature shipped will be refused with a clear error). The reference can be
a local directory, ZIP file path, OCI registry reference, or git
repository.

Usage:
  sbx kit add SANDBOX REFERENCE [flags]

Examples:
  # Add a local mixin directory to a sandbox
  sbx kit add my-sandbox ./mcp-postgres/

  # Add a kit from a ZIP file
  sbx kit add my-sandbox ./mcp-postgres.zip

  # Add a kit from an OCI registry
  sbx kit add my-sandbox ghcr.io/myorg/mcp-postgres:1.0

  # Add a kit from a git repository
  sbx kit add my-sandbox git+https://github.com/org/kits.git#dir=mcp-postgres

  # Add a parameterized kit
  sbx kit add my-sandbox ./mcp-postgres/ --kit-arg host=db.internal

Flags:
  -h, --help                        help for add
      --kit-arg stringArray         (Experimental) Value for an argument the kit declares, as name=value for every kit or kit.name=value for one (can be repeated)
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx kit builder
```
EXPERIMENTAL: this command may change or be removed in future releases.

Manage the kit builder sandbox.

Source-form kit builds (a local directory or git reference) run inside a
shared builder sandbox named sbx-kit-builder, created on first
use. Its Docker engine store doubles as the kit build cache, so removing
the builder is how the cache is reclaimed; the next source-form build
recreates it.

Usage:
  sbx kit builder COMMAND

Available Commands:
  history     Inspect kit build history in the builder sandbox
  rm          Remove the kit builder sandbox and its build cache
  status      Show the kit builder sandbox and build-cache state

Flags:
  -h, --help   help for builder

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx kit builder COMMAND --help" for more information about a command.
```

#### sbx kit builder history
```
EXPERIMENTAL: this command may change or be removed in future releases.

Inspect kit build history in the builder sandbox.

Each subcommand runs the matching docker buildx history command inside
the builder sandbox, against the buildx instance kit builds use. Flags
and arguments pass through verbatim.

Usage:
  sbx kit builder history COMMAND

Available Commands:
  export      Export a kit build record into a bundle
  inspect     Inspect a kit build record
  logs        Print a kit build's logs
  ls          List kit build records
  rm          Remove kit build records
  trace       Show the execution trace of a kit build

Flags:
  -h, --help   help for history

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx kit builder history COMMAND --help" for more information about a command.
```

##### sbx kit builder history export
```
Starting sandboxd daemon...
error: ensure daemon: daemon exited unexpectedly: exit status 1 stderr: === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:15Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:18Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:19Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:20Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:21Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:23Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:17Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted check logs at: $HOME/Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/daemon.log
```

##### sbx kit builder history inspect
```
Starting sandboxd daemon...
error: ensure daemon: daemon exited unexpectedly: exit status 1 stderr: === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:15Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:18Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:19Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:20Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:21Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:23Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:17Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:18Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted check logs at: $HOME/Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/daemon.log
```

##### sbx kit builder history logs
```
Starting sandboxd daemon...
error: ensure daemon: daemon exited unexpectedly: exit status 1 stderr: === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:15Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:18Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:19Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:20Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:21Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:23Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:17Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:18Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:19Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted check logs at: $HOME/Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/daemon.log
```

##### sbx kit builder history ls
```
Starting sandboxd daemon...
error: ensure daemon: daemon exited unexpectedly: exit status 1 stderr: === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:15Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:18Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:19Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:20Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:21Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:23Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:17Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:18Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:19Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:21Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted check logs at: $HOME/Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/daemon.log
```

##### sbx kit builder history rm
```
Starting sandboxd daemon...
error: ensure daemon: daemon exited unexpectedly: exit status 1 stderr: : failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:18Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:19Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:20Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:21Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:23Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:17Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:18Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:19Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:21Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:22Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted check logs at: $HOME/Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/daemon.log
```

##### sbx kit builder history trace
```
Starting sandboxd daemon...
error: ensure daemon: daemon exited unexpectedly: exit status 1 stderr: : failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:19Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:20Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:21Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:53:23Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:17Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:18Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:19Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:21Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:22Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted === sbx v0.47.0 starting sandboxd at 2026-10-08T06:54:23Z === error: failed to start backend in-process: start backend: starting server: failed to get listener for main ttrpc endpoint: failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: listen unix $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc: bind: operation not permitted check logs at: $HOME/Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/daemon.log
```

#### sbx kit builder rm
```
EXPERIMENTAL: this command may change or be removed in future releases.

Remove the kit builder sandbox and its build cache

Usage:
  sbx kit builder rm [flags]

Flags:
  -f, --force   Skip confirmation prompts and delete even if in use
  -h, --help    help for rm

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

#### sbx kit builder status
```
EXPERIMENTAL: this command may change or be removed in future releases.

Show the kit builder sandbox and build-cache state

Usage:
  sbx kit builder status [flags]

Flags:
  -h, --help   help for status

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx kit inspect
```
EXPERIMENTAL: this command may change or be removed in future releases.

Load and display details about a kit artifact.

The reference can be a local directory, ZIP file path, OCI registry reference, or git repository.

Pass --kit-arg to preview how the kit resolves with a given set of
arguments; the output shows the substituted content.

Usage:
  sbx kit inspect REFERENCE [flags]

Flags:
  -h, --help                        help for inspect
      --json                        Output in JSON format
      --kit-arg stringArray         (Experimental) Value for an argument the kit declares, as name=value for every kit or kit.name=value for one (can be repeated)
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx kit pack
```
EXPERIMENTAL: this command may change or be removed in future releases.

Validate and package a kit artifact directory as a ZIP file.

The directory must contain a valid spec.yaml and an optional files/ directory.

Usage:
  sbx kit pack DIRECTORY [flags]

Flags:
  -h, --help            help for pack
  -o, --output string   Output ZIP file path (default: <name>.zip)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx kit provenance
```
EXPERIMENTAL: this command may change or be removed in future releases.

Print the SLSA provenance attestation attached to an OCI kit.

Provenance is attached by `sbx kit push` as an OCI referrer of the kit
manifest. It records the kit's content digests, the sandbox image its spec
declares, and the source git commit the kit was pushed from.

Provenance pushed without --sign is unsigned: it is printed but marked
UNSIGNED, because anyone with push access to the repository could have
written it. To verify a signed attestation, pass --key for a key-based
signature, or --certificate-identity (or --certificate-identity-regexp)
together with --certificate-oidc-issuer (or its regexp form) for a keyless
one; only attestations that verify and whose subject matches the kit's own
digest are reported as VERIFIED.

Usage:
  sbx kit provenance REFERENCE [flags]

Examples:
  # Show provenance (unsigned attestations are printed as-is)
  sbx kit provenance ghcr.io/org/my-kit:1.0

  # Verify a signed attestation before printing it
  sbx kit provenance \
    --certificate-identity user@example.com \
    --certificate-oidc-issuer https://accounts.google.com \
    ghcr.io/org/my-kit:1.0

Flags:
      --certificate-identity string             Exact keyless signer identity (certificate SAN)
      --certificate-identity-regexp string      Keyless signer identity regexp (certificate SAN)
      --certificate-oidc-issuer string          Exact keyless OIDC issuer
      --certificate-oidc-issuer-regexp string   Keyless OIDC issuer regexp
  -h, --help                                    help for provenance
      --insecure-ignore-tlog                    Do not require a Rekor transparency-log entry (for private keyless signatures)
      --json                                    Output in JSON format
      --key string                              Public key for key-based verification (PEM)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx kit pull
```
EXPERIMENTAL: this command may change or be removed in future releases.

Pull a kit artifact from an OCI registry and save its layer payload to a file.

The reference should be in the format "registry/repo:tag" or
"registry/repo@sha256:digest" (e.g., "ghcr.io/myorg/my-plugin:1.0").

The file extension is chosen automatically based on the kit's format:
  schemaVersion: "1"  → <name>.zip      (legacy ZIP archive)
  schemaVersion: "2"  → <name>.tar.gz   (standard OCI tar+gzip layer)

The registry must support HTTPS.

Authentication: sbx registry secrets (sbx secret set --registry) take priority, falling back to the Docker credential store.

Usage:
  sbx kit pull REFERENCE [flags]

Flags:
  -h, --help            help for pull
  -o, --output string   Output file path (default: derived from reference + format)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx kit push
```
EXPERIMENTAL: this command may change or be removed in future releases.

Package and push a kit artifact directory to an OCI registry.

The directory must contain a valid spec.yaml. The reference should be
in the format "registry/repo:tag" (e.g., "ghcr.io/myorg/my-plugin:1.0").

The OCI artifact format is selected from the kit's spec.yaml:
  schemaVersion: "1"  → legacy ZIP-based artifact
  schemaVersion: "2"  → v2 tar+gzip layer with the spec in the manifest
                        config blob and standard OCI annotations (so
                        distribution tooling can read kit metadata
                        without pulling layers)

With --sign, the pushed manifest is signed and the Sigstore bundle is
attached to the kit as an OCI referrer. Signing is keyless (Fulcio +
Rekor) unless --key is given for key-based signing.

Every push also attaches a SLSA provenance attestation as an OCI
referrer, recording the kit's content digests, the declared sandbox
image, and the source git commit when the directory is a working tree.
The provenance is unsigned unless --sign is given, in which case it is
signed as a DSSE in-toto attestation with the same identity or key.

Authentication: the Docker Hub session from sbx login and sbx registry
secrets (sbx secret set --registry) take priority, falling back to the
Docker credential store.

Usage:
  sbx kit push DIRECTORY REFERENCE [flags]

Flags:
  -h, --help                         help for push
      --identity-token string        OIDC identity token for keyless signing; defaults to the ambient CI provider, then an interactive browser login
      --identity-token-file string   File holding the OIDC identity token; keeps it out of the process arguments
      --key string                   Private key for key-based signing (PEM); omit for keyless signing
      --sign                         Sign the pushed kit and attach the signature as an OCI referrer
      --tlog-upload                  Upload the keyless signature to the Rekor transparency log; set false for private kits (default true)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx kit sign
```
EXPERIMENTAL: this command may change or be removed in future releases.

Sign a kit artifact with cosign-compatible Sigstore signatures.

For a local directory, a detached signature bundle is written to
kit.sig.bundle next to spec.yaml. For an OCI reference, the
signature is attached to the kit manifest as an OCI referrer.

Signing is keyless by default (Fulcio + Rekor), which requires an OIDC
identity token. In CI the token is minted automatically by the detected
platform (GitHub Actions, Buildkite, GCP, SPIFFE, or a projected
service-account token on disk). Elsewhere, supply one with
--identity-token-file or --identity-token, or complete an interactive
browser login. Prefer the file form: process arguments are readable by
other local users and are recorded in shell history. A token is never
read from SIGSTORE_ID_TOKEN, so it cannot be chosen by anything that can
set an environment variable. Use --key for key-based signing with an
unencrypted PEM private key.

For private kits whose signing event must not leak to a public log, pass
--tlog-upload=false to skip the Rekor transparency log. This only affects
keyless signing (key-based signing never uploads to Rekor) and requires
the signing config to provide a timestamp authority so the signature stays
verifiable after the short-lived certificate expires. For fully offline,
private signing, prefer key-based signing with --key.

Usage:
  sbx kit sign REFERENCE [flags]

Examples:
  # Keyless-sign a local kit directory
  sbx kit sign ./my-kit/

  # Key-based sign an OCI kit
  sbx kit sign --key cosign.key ghcr.io/org/my-kit:1.0

  # Keyless-sign without uploading to the public transparency log
  sbx kit sign --tlog-upload=false ghcr.io/org/private-kit:1.0

Flags:
  -h, --help                         help for sign
      --identity-token string        OIDC identity token for keyless signing; defaults to the ambient CI provider, then an interactive browser login
      --identity-token-file string   File holding the OIDC identity token; keeps it out of the process arguments
      --key string                   Private key for key-based signing (PEM); omit for keyless signing
      --tlog-upload                  Upload the keyless signature to the Rekor transparency log; set false for private kits (default true)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx kit validate
```
EXPERIMENTAL: this command may change or be removed in future releases.

Validate that a directory or ZIP file is a valid kit artifact.

The reference can be a local directory, ZIP file path, or git repository.

A kit that declares required arguments is invalid until they are
supplied, so pass the same --kit-arg values you would pass to sbx
create.

Usage:
  sbx kit validate REFERENCE [flags]

Flags:
  -h, --help                        help for validate
      --json                        Output in JSON format
      --kit-arg stringArray         (Experimental) Value for an argument the kit declares, as name=value for every kit or kit.name=value for one (can be repeated)
      --kit-args-file stringArray   (Experimental) File of name=value kit arguments, one per line (can be repeated); --kit-arg overrides

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx kit verify
```
EXPERIMENTAL: this command may change or be removed in future releases.

Verify a kit artifact's cosign-compatible signature.

For a local directory, the kit.sig.bundle sidecar is checked
against the kit's content. For a git reference, the repository is cloned and
its committed kit.sig.bundle sidecar is checked the same way.
For an OCI reference, signatures attached as OCI referrers are checked against
the kit manifest.

Use --key to verify a key-based signature against a PEM public key. For
keyless signatures, supply the accepted signer identity with
--certificate-identity (or --certificate-identity-regexp) and
--certificate-oidc-issuer (or --certificate-oidc-issuer-regexp).

Pass --insecure-ignore-tlog to verify a private keyless signature made
with --tlog-upload=false: it drops the requirement for a Rekor
transparency-log entry and relies on the timestamp-authority timestamp
instead. It has no effect on key-based verification.

Usage:
  sbx kit verify REFERENCE [flags]

Examples:
  # Verify a key-based signature
  sbx kit verify --key cosign.pub ghcr.io/org/my-kit:1.0

  # Verify a keyless signature by identity
  sbx kit verify \
    --certificate-identity user@example.com \
    --certificate-oidc-issuer https://accounts.google.com \
    ./my-kit/

Flags:
      --certificate-identity string             Exact keyless signer identity (certificate SAN)
      --certificate-identity-regexp string      Keyless signer identity regexp (certificate SAN)
      --certificate-oidc-issuer string          Exact keyless OIDC issuer
      --certificate-oidc-issuer-regexp string   Keyless OIDC issuer regexp
  -h, --help                                    help for verify
      --insecure-ignore-tlog                    Do not require a Rekor transparency-log entry (for private keyless signatures)
      --json                                    Output in JSON format
      --key string                              Public key for key-based verification (PEM)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx setup
```
EXPERIMENTAL: this command may change or be removed in future releases.

Detect what is already configured on your host and prepare Docker Sandboxes.

Agent secrets are detected from the built-in agent kit specs and the
env vars set on this host, and accepted secrets are imported into the global
secrets store (the same store as "sbx secret set"). When SSH_AUTH_SOCK is set,
setup can enable SSH-agent forwarding and either use each client's current
socket or persist a fixed socket path.

Usage:
  sbx setup [COMMAND]

Available Commands:
  ssh         Set up SSH client config for the sandbox endpoint

Flags:
  -h, --help   help for setup

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx setup COMMAND --help" for more information about a command.
```

### sbx setup ssh
```
EXPERIMENTAL: this command may change or be removed in future releases.

Write a generated SSH config + known_hosts and include it from
~/.ssh/config so "ssh <name>.sbx" connects with no prompts. Named app instances
use "ssh <name>.sbx-<app>" instead. Re-run any time; it's idempotent.

No SSH client key is needed — authentication is handled by the daemon's Unix
socket (OS user boundary) combined with an active Docker login. Sign in first
(sbx login).

Usage:
  sbx setup ssh [flags]
  sbx setup ssh COMMAND

Examples:
  sbx setup ssh
  ssh my-sandbox.sbx -- echo hello

Available Commands:
  remove      Remove SSH client config for the current local app instance

Flags:
      --alias string   ssh_config Host pattern to write (default "*.sbx")
  -h, --help           help for ssh

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx setup ssh COMMAND --help" for more information about a command.
```

#### sbx setup ssh remove
```
EXPERIMENTAL: this command may change or be removed in future releases.

Remove SSH client config for the current local app instance

Usage:
  sbx setup ssh remove [flags]

Flags:
  -h, --help   help for remove

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx skills
```
EXPERIMENTAL: this command may change or be removed in future releases.

Manage skills available to agents in Docker Sandboxes.

Skills are shared across sandboxes by default: the store's entries are linked
into the agent's skills directory read-only, which stays writable so kits can
install skills beside them. Linking happens at container start, so editing an
existing skill is live through the link, while adding a store entry reaches a
running sandbox only on its next start. Removing one takes effect immediately:
the link in a running sandbox stops resolving at once, and the next start is
what clears the stale link away. Use --skills=off when creating a sandbox to
opt out, or --skills=readwrite to mount the store over that directory so the
sandbox's own writes are shared.

Usage:
  sbx skills COMMAND

Available Commands:
  add         Add skills from a Git repository
  import      Import skills from supported agent directories
  ls          List installed skills
  rm          Remove installed skills
  update      Update skills added from repositories

Flags:
  -h, --help   help for skills

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging

Use "sbx skills COMMAND --help" for more information about a command.
```

### sbx skills add
```
EXPERIMENTAL: this command may change or be removed in future releases.

Install skills from a Git repository for use in Docker Sandboxes. The
repository must contain one or more valid SKILL.md files.

All discovered skills are installed when --skill is omitted. Use --skill one
or more times, or pass a comma-separated list, to install only named skills.
Replacing an installed skill requires confirmation; use --force to skip
prompts.

The repository can be specified as a Git URL or as GitHub owner/repository
shorthand. Skills installed with this command can later be refreshed with
'sbx skills update'.

Usage:
  sbx skills add <repository> [flags]

Aliases:
  add, a

Examples:
  sbx skills add https://github.com/anthropics/skills --skill frontend-design
  sbx skills add anthropics/skills --skill frontend-design --skill pdf
  sbx skills add https://github.com/anthropics/skills --force

Flags:
  -f, --force               Overwrite existing skills without prompting
  -h, --help                help for add
  -s, --skill stringArray   Add only the named skill (repeatable or comma-separated)

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx skills import
```
EXPERIMENTAL: this command may change or be removed in future releases.

Import skills already installed for supported coding agents on this
machine.

The following directories are checked in order:
  ~/.agents/skills
  ~/.claude/skills
  ~/.config/opencode/skills
  ~/.copilot/skills
  ~/.cursor/skills
  ~/.factory/skills

When the same skill appears in more than one directory, the first copy is used
and the others are skipped with a warning.

Importing a skill that is already installed replaces it completely, including
removing files that are no longer present. You will be prompted before a skill
is replaced; use --force to skip all prompts.

Symlinks at the top level are followed if they point to a directory. Symlinks
within skill folders and loose files at the top level are skipped.

Imported skills are available to Claude, Codex, Copilot, Cursor, Droid, and
OpenCode.

Usage:
  sbx skills import [flags]

Flags:
      --dry-run   Preview which skills would be imported without copying anything
  -f, --force     Overwrite existing skills without prompting
  -h, --help      help for import

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx skills ls
```
EXPERIMENTAL: this command may change or be removed in future releases.

List skills available to agents in Docker Sandboxes.

Usage:
  sbx skills ls [flags]

Aliases:
  ls, list

Flags:
  -h, --help    help for ls
      --json    Output in JSON format
  -q, --quiet   Only display skill names

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx skills rm
```
EXPERIMENTAL: this command may change or be removed in future releases.

Remove one or more installed skills from Docker Sandboxes.

Running agents may be reading installed skills. Removal cannot be undone and
requires confirmation; use --force to skip confirmation in scripts.

Usage:
  sbx skills rm <skill>... [flags]

Aliases:
  rm, remove

Flags:
  -f, --force   Skip confirmation prompts
  -h, --help    help for rm

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

### sbx skills update
```
EXPERIMENTAL: this command may change or be removed in future releases.

Download the latest versions of skills installed with 'sbx skills add'.

With no names, every skill added from a repository is updated. Specify one or
more names to update only those skills. Skills installed with 'sbx skills
import' must be added from a repository before they can be updated.

Usage:
  sbx skills update [skill]... [flags]

Aliases:
  update, upgrade

Flags:
  -h, --help   help for update

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx login
```
Sign in to Docker

Usage:
  sbx login [flags]

Flags:
  -h, --help              help for login
      --password-stdin    Read password or access token from stdin
      --username string   Docker username for non-interactive login

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx logout
```
Stop running local sandboxes and sign out of Docker

Usage:
  sbx logout [flags]

Flags:
  -h, --help   help for logout
  -y, --yes    Skip confirmation prompt

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

## sbx version
```
Show Docker Sandboxes version information

Usage:
  sbx version

Flags:
  -h, --help   help for version
      --json   Output in JSON format, including the server version and, when the backend reports them, the runtime component versions

Global Flags:
      --cloud   Dispatch to Docker Cloud Sandboxes API instead of local sandboxd (supported by a growing set of verbs — run 'sbx --cloud --help' for the current list)
  -D, --debug   Enable debug logging
```

