# docker sandbox --help (plugin v0.12.0, captured 2026-10-08)

```
Usage:  docker sandbox [OPTIONS] COMMAND

Local sandbox environments for AI agents, using Docker.

Options:
  -D, --debug   Enable debug logging

Management Commands:
  create      Create a sandbox for an agent
  network     Manage sandbox networking

Commands:
  exec        Execute a command inside a sandbox
  ls          List VMs
  reset       Reset all VM sandboxes and clean up state
  rm          Remove one or more sandboxes
  run         Run an agent in a sandbox
  save        Save a snapshot of the sandbox as a template
  stop        Stop one or more sandboxes without removing them
  version     Show sandbox version information

Run 'docker sandbox COMMAND --help' for more information on a command.
```

## docker sandbox create
```
Usage:  docker sandbox create [OPTIONS] COMMAND

Create a sandbox with access to a host workspace for an agent.

Available agents are provided as subcommands. Use "create AGENT --help" for agent-specific options.

Options:
  -D, --debug                  Enable debug logging
      --name string            Name for the sandbox (default:
                               <agent>-<workdir>, letters, numbers,
                               hyphens, underscores, periods, plus signs
                               and minus signs only)
      --pull-template string   Template image pull policy: always (always
                               pull from registry), missing (pull only if
                               not cached), never (use only cached
                               images) (default "missing")
  -q, --quiet                  Suppress verbose output
  -t, --template string        Container image to use for the sandbox
                               (default: agent-specific image)

Commands:
  cagent      Create a sandbox for cagent
  claude      Create a sandbox for claude
  codex       Create a sandbox for codex
  copilot     Create a sandbox for copilot
  gemini      Create a sandbox for gemini
  kiro        Create a sandbox for kiro
  opencode    Create a sandbox for opencode
  shell       Create a sandbox for shell

Run 'docker sandbox create COMMAND --help' for more information on a command.
```

### docker sandbox create cagent
```
Usage:  docker sandbox create cagent WORKSPACE [EXTRA_WORKSPACE...]

Create a sandbox with access to a host workspace for cagent.

The workspace path is required and will be exposed inside the sandbox at the same path as on the host.
Additional workspaces can be provided as extra arguments. Append ":ro" to mount them read-only.

Use 'docker sandbox run SANDBOX' to start cagent after creation.

Options:
  -D, --debug   Enable debug logging
```

### docker sandbox create claude
```
Usage:  docker sandbox create claude WORKSPACE [EXTRA_WORKSPACE...]

Create a sandbox with access to a host workspace for claude.

The workspace path is required and will be exposed inside the sandbox at the same path as on the host.
Additional workspaces can be provided as extra arguments. Append ":ro" to mount them read-only.

Use 'docker sandbox run SANDBOX' to start claude after creation.

Options:
  -D, --debug   Enable debug logging
```

### docker sandbox create codex
```
Usage:  docker sandbox create codex WORKSPACE [EXTRA_WORKSPACE...]

Create a sandbox with access to a host workspace for codex.

The workspace path is required and will be exposed inside the sandbox at the same path as on the host.
Additional workspaces can be provided as extra arguments. Append ":ro" to mount them read-only.

Use 'docker sandbox run SANDBOX' to start codex after creation.

Options:
  -D, --debug   Enable debug logging
```

### docker sandbox create copilot
```
Usage:  docker sandbox create copilot WORKSPACE [EXTRA_WORKSPACE...]

Create a sandbox with access to a host workspace for copilot.

The workspace path is required and will be exposed inside the sandbox at the same path as on the host.
Additional workspaces can be provided as extra arguments. Append ":ro" to mount them read-only.

Use 'docker sandbox run SANDBOX' to start copilot after creation.

Options:
  -D, --debug   Enable debug logging
```

### docker sandbox create gemini
```
Usage:  docker sandbox create gemini WORKSPACE [EXTRA_WORKSPACE...]

Create a sandbox with access to a host workspace for gemini.

The workspace path is required and will be exposed inside the sandbox at the same path as on the host.
Additional workspaces can be provided as extra arguments. Append ":ro" to mount them read-only.

Use 'docker sandbox run SANDBOX' to start gemini after creation.

Options:
  -D, --debug   Enable debug logging
```

### docker sandbox create kiro
```
Usage:  docker sandbox create kiro WORKSPACE [EXTRA_WORKSPACE...]

Create a sandbox with access to a host workspace for kiro.

The workspace path is required and will be exposed inside the sandbox at the same path as on the host.
Additional workspaces can be provided as extra arguments. Append ":ro" to mount them read-only.

Use 'docker sandbox run SANDBOX' to start kiro after creation.

Options:
  -D, --debug   Enable debug logging
```

### docker sandbox create opencode
```
Usage:  docker sandbox create opencode WORKSPACE [EXTRA_WORKSPACE...]

Create a sandbox with access to a host workspace for opencode.

The workspace path is required and will be exposed inside the sandbox at the same path as on the host.
Additional workspaces can be provided as extra arguments. Append ":ro" to mount them read-only.

Use 'docker sandbox run SANDBOX' to start opencode after creation.

Options:
  -D, --debug   Enable debug logging
```

### docker sandbox create shell
```
Usage:  docker sandbox create shell WORKSPACE [EXTRA_WORKSPACE...]

Create a sandbox with access to a host workspace for shell.

The workspace path is required and will be exposed inside the sandbox at the same path as on the host.
Additional workspaces can be provided as extra arguments. Append ":ro" to mount them read-only.

Use 'docker sandbox run SANDBOX' to start shell after creation.

Options:
  -D, --debug   Enable debug logging
```

## docker sandbox exec
```
Usage:  docker sandbox exec [OPTIONS] SANDBOX COMMAND [ARG...]

Execute a command in a sandbox that was previously created with 'docker sandbox create'.

The command and any additional arguments are executed inside the sandbox container.

Options:
  -D, --debug                  Enable debug logging
  -d, --detach                 Detached mode: run command in the background
      --detach-keys string     Override the key sequence for detaching a
                               container
  -e, --env stringArray        Set environment variables
      --env-file stringArray   Read in a file of environment variables
  -i, --interactive            Keep STDIN open even if not attached
      --privileged             Give extended privileges to the command
  -t, --tty                    Allocate a pseudo-TTY
  -u, --user string            Username or UID (format:
                               <name|uid>[:<group|gid>])
  -w, --workdir string         Working directory inside the container
```

## docker sandbox ls
```
Usage:  docker sandbox ls [OPTIONS]

List all VMs managed by sandboxd with their sandboxes

Aliases:
  docker sandbox ls, docker sandbox list

Options:
  -D, --debug   Enable debug logging
      --json    Output in JSON format
  -q, --quiet   Only display VM names
```

## docker sandbox network
```
Usage:  docker sandbox network [OPTIONS] COMMAND

Manage sandbox networking

Options:
  -D, --debug   Enable debug logging

Commands:
  log         Show network logs
  proxy       Manage proxy configuration for a sandbox

Run 'docker sandbox network COMMAND --help' for more information on a command.
```

### docker sandbox network log
```
Usage:  docker sandbox network log

Show network logs

Options:
  -D, --debug       Enable debug logging
      --json        Output in JSON format
      --limit int   Maximum number of log entries to show
  -q, --quiet       Only display log entries
```

### docker sandbox network proxy
```
Usage:  docker sandbox network proxy <sandbox> [OPTIONS]

Manage proxy configuration for a sandbox

Options:
      --allow-cidr string    Remove an IP range in CIDR notation from the
                             block or bypass lists (can be specified
                             multiple times)
      --allow-host string    Permit access to a domain or IP (can be
                             specified multiple times)
      --block-cidr string    Block access to an IP range in CIDR notation
                             (can be specified multiple times)
      --block-host string    Block access to a domain or IP (can be
                             specified multiple times)
      --bypass-cidr string   Bypass MITM proxy for an IP range in CIDR
                             notation (can be specified multiple times)
      --bypass-host string   Bypass MITM proxy for a domain or IP (can be
                             specified multiple times)
  -D, --debug                Enable debug logging
      --policy allow|deny    Set the default policy
```

## docker sandbox reset
```
Usage:  docker sandbox reset [OPTIONS]

Reset all VM sandboxes and permanently delete all VM data.

This command will:
- Stop all running VMs gracefully (30s timeout)
- Delete all VM state directories in ~/.docker/sandboxes/vm/
- Clear image cache in ~/.docker/sandboxes/image-cache/
- Clear all internal registries

The daemon will continue running with fresh state after reset.

⚠️  WARNING: This is a destructive operation that cannot be undone!
All running agents will be forcefully terminated and their work will be lost.
Cached image tars will be deleted and will need to be recreated on next use.

By default, you will be prompted to confirm (y/N).
Use --force to skip the confirmation prompt.

Options:
  -D, --debug   Enable debug logging
  -f, --force   Skip confirmation prompt
```

## docker sandbox rm
```
Usage:  docker sandbox rm SANDBOX [SANDBOX...]

Remove one or more sandboxes and all their associated resources.

This command will:
- Check if the sandbox exists
- Remove the sandbox and clean up its associated resources

Aliases:
  docker sandbox rm, docker sandbox remove

Options:
  -D, --debug   Enable debug logging
```

## docker sandbox run
```
Usage:  docker sandbox run SANDBOX [-- AGENT_ARGS...] | AGENT [WORKSPACE] [EXTRA_WORKSPACE...] [-- AGENT_ARGS...]

Run an agent in a sandbox. Create the sandbox if it does not exist.

Pass agent arguments after the "--" separator.
Additional workspaces can be provided as extra arguments. Append ":ro" to mount them read-only.

Examples:
  # Create and run a sandbox with claude in current directory
  docker sandbox run claude

  # Create and run a sandbox with claude in current directory (explicit)
  docker sandbox run claude .

  # Create and run with additional workspaces (read-only)
  docker sandbox run claude . /path/to/docs:ro

  # Run an existing sandbox
  docker sandbox run existing-sandbox

  # Run a sandbox with agent arguments
  docker sandbox run claude -- --continue

Options:
  -D, --debug                  Enable debug logging
      --name string            Name for the sandbox (default:
                               <agent>-<workdir>)
      --pull-template string   Template image pull policy: always (always
                               pull from registry), missing (pull only if
                               not cached), never (use only cached
                               images) (default "missing")
  -t, --template string        Container image to use for the sandbox
                               (default: agent-specific image)
```

## docker sandbox save
```
Usage:  docker sandbox save SANDBOX TAG

Save a snapshot of the sandbox as a template.

By default, the image is loaded into the host's Docker daemon (requires Docker to be running).
Use --output to save the image to a tar file instead.

Examples:
  # Load into host Docker (requires host Docker running)
  docker sandbox save my-sandbox myimage:v1.0

  # Save to file (works without host Docker)
  docker sandbox save my-sandbox myimage:v1.0 --output /tmp/myimage.tar

Options:
  -D, --debug           Enable debug logging
  -o, --output string   Save image to specified tar file instead of
                        loading into host Docker
```

## docker sandbox stop
```
Usage:  docker sandbox stop SANDBOX [SANDBOX...]

Stop one or more sandboxes without removing them. The sandboxes can be restarted later.

Options:
  -D, --debug   Enable debug logging
```

## docker sandbox version
```
Usage:  docker sandbox version

Show sandbox version information

Options:
  -D, --debug   Enable debug logging
```
