---
id: docker-sandboxes
title: Docker Sandboxes for Agents
code: DS
subtitle: Run an agent in a microVM, control its network and keys, get its commits back. sbx 0.47.0, docker-agent 1.149.0.
hue: 210
sources: manuals/docker-sandboxes-101
source_hash: 27c0ba82cd494898
---

## What runs where
type: architecture
from: manuals/docker-sandboxes-101/sections/1-1-sbx-and-docker-agent.md, manuals/docker-sandboxes-101/sections/2-2-sbx-exec-cp-and-ports.md, manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md, manuals/docker-sandboxes-101/sections/3-5-sbx-secret-set-import-and-set-custom.md, manuals/docker-sandboxes-101/sections/2-4-sandboxd-diagnose-and-reset.md

```arch
node | cli | 1,1 | sbx CLI | host
node | daemon | 2,1 | sandboxd | sandboxd.sock, daemon.log
node | keys | 3,1 | Secret store | macOS Keychain
node | vm | 1,2 | Sandbox microVM | own kernel, private Docker Engine
node | agent | 2,2 | Agent | user agent, uid 1000
node | proxy | 3,2 | Forward proxy | gateway.docker.internal:3128
node | ws | 1,3 | Workspace | virtiofs, same absolute path
node | net | 3,3 | Allowed hosts | policy rules
edge | cli | daemon | socket
edge | daemon | vm | starts
edge | vm | agent | runs
edge | agent | proxy | HTTPS_PROXY
edge | keys | proxy | swap
edge | proxy | net | allowed
edge | vm | ws | mount
```

## One request leaves the sandbox
type: flow
from: manuals/docker-sandboxes-101/sections/2-1-sbx-run-create-stop-and-rm.md, manuals/docker-sandboxes-101/sections/3-3-sbx-policy-init-allow-deny-and-check-network.md, manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md, manuals/docker-sandboxes-101/sections/3-5-sbx-secret-set-import-and-set-custom.md

1. **sbx create**: sandboxd pulls the template and boots the microVM.
2. **Agent**: sends the request to the forward proxy on the host.
3. **Authorizer**: a matching deny wins. No matching allow is an implicit deny.
4. **Blocked**: the proxy answers 403 inside TLS with "Approval required".
5. **Allowed**: the proxy tunnels the host as `forward-bypass`.
6. **Bound secret**: the proxy swaps the sentinel for the stored value.
7. **policy log**: one row per host with proxy type and rule.

## Sandbox lifecycle
type: task-table
from: manuals/docker-sandboxes-101/capture/out/04-create.txt, manuals/docker-sandboxes-101/capture/out/07-template-save.txt, manuals/docker-sandboxes-101/capture/out/06-cp.txt, manuals/docker-sandboxes-101/capture/out/05-ports.txt, manuals/docker-sandboxes-101/capture/out/04-stop.txt, manuals/docker-sandboxes-101/capture/out/04-prune.txt, manuals/docker-sandboxes-101/capture/out/04-ls.txt, manuals/docker-sandboxes-101/sections/2-1-sbx-run-create-stop-and-rm.md

| Task | Code |
|---|---|
| Create on a repository | `sbx create shell <path> --name <name>` |
| Attach again | `sbx run --name <name>` |
| Run a command as root | `sbx exec -u root <name> sh -c '<cmd>'` |
| Copy a file in | `sbx cp <host-file> <name>:/tmp/in.txt` |
| Publish a port | `sbx ports <name> --publish 18081:8080` |
| Stop and keep state | `sbx stop <name>` |
| Remove stopped sandboxes | `sbx prune --force` |

## Secrets, MCP and health
type: task-table
from: manuals/docker-sandboxes-101/capture/out/10-set-custom.txt, manuals/docker-sandboxes-101/capture/out/10-import-dry-run.txt, manuals/docker-sandboxes-101/capture/out/11-mcp-add.txt, manuals/docker-sandboxes-101/capture/out/11-load.txt, manuals/docker-sandboxes-101/capture/out/02-daemon-status.txt, manuals/docker-sandboxes-101/capture/out/02-diagnose.txt, manuals/docker-sandboxes-101/capture/out/07-template-save.txt, manuals/docker-sandboxes-101/capture/out/27-sandbox-run.txt

| Task | Code |
|---|---|
| Bind a secret to hosts | `sbx secret set-custom --host <host> --env <VAR> --value <value>` |
| Find keys in host env | `sbx secret import --dry-run` |
| Register an MCP server | `sbx mcp add <name> --url <url>` |
| Attach it to a sandbox | `sbx mcp load <name> --sandbox <sandbox>` |
| Run the 13 checks | `sbx diagnose` |
| Save a template | `sbx template save <name> <tag> --output <file>.tar` |
| Run an agent file in a sandbox | `docker-agent run --sandbox --exec <agent-file> '<prompt>'` |

## Clone mode round trip
type: annotated-code
lang: bash
from: manuals/docker-sandboxes-101/capture/out/08-clone-create.txt, manuals/docker-sandboxes-101/capture/out/08-clone-host.txt, manuals/docker-sandboxes-101/capture/out/08-clone-rm.txt, manuals/docker-sandboxes-101/sections/3-2-clone-and-run-sandbox-source.md, manuals/docker-sandboxes-101/sections/2-1-sbx-run-create-stop-and-rm.md

```bash
sbx create --clone shell <repo> \  # private clone, host repo read-only
  --name <name>  # source at /run/sandbox/source
sbx exec <name> sh -c '<edit and git commit>'  # agent commits in the clone
git -C <repo> remote -v  # sbx added sandbox-<name>
git -C <repo> fetch sandbox-<name>  # bring the commits back
sbx rm --force <name>  # VM, state and scoped secrets go
```

## Debug a blocked host
type: annotated-code
lang: bash
from: manuals/docker-sandboxes-101/capture/out/03-policy-init.txt, manuals/docker-sandboxes-101/capture/out/09-create.txt, manuals/docker-sandboxes-101/capture/out/09-blocked-by-rule.txt, manuals/docker-sandboxes-101/capture/out/09-policy-log.txt, manuals/docker-sandboxes-101/capture/out/09-allow.txt, manuals/docker-sandboxes-101/capture/out/09-rm-allow.txt, manuals/docker-sandboxes-101/capture/run.py

```bash
sbx policy init balanced  # once, before the first sandbox
sbx create shell --name m101-policy  # no workspace mount
sbx exec m101-policy sh -c \
  'curl -sS --max-time 10 https://example.com'  # Approval required
sbx policy log m101-policy  # forward, default deny
sbx policy allow network \
  --sandbox m101-policy example.com  # rule for one sandbox
sbx policy check network example.com \
  --sandbox m101-policy --verbose --json  # read allowed, rule
```

## What the agent sees inside
type: command-table
from: manuals/docker-sandboxes-101/capture/out/04-env.txt, manuals/docker-sandboxes-101/capture/out/10-env-sentinel.txt, manuals/docker-sandboxes-101/capture/out/09-policy-log.txt, manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md, manuals/docker-sandboxes-101/sections/3-3-sbx-policy-init-allow-deny-and-check-network.md

| Command | What it does |
|---|---|
| `HTTPS_PROXY=http://gateway.docker.internal:3128` | Forward proxy for HTTP and HTTPS |
| `ANTHROPIC_API_KEY=proxy-managed` | Sentinel. The real key stays on the host |
| `M101_RECV_KEY=sbx-cs-<rand>` | Custom secret placeholder |
| `SSH_AUTH_SOCK=/run/ssh-agent.sock` | Host SSH agent, forwarded by default |
| `forward-bypass` | Log proxy type. Tunnel, no inspection |
| `transparent` | Log proxy type. Other TCP, no injection |
| `"deny_kind": "explicit"` | A rule denied it. `implicit` means no allow |

## Defaults
type: defaults
from: manuals/docker-sandboxes-101/sections/r-1-sbx-commands.md, manuals/docker-sandboxes-101/sections/r-3-settings-keys-environment-variables-and-paths.md

| Setting | Default | Note |
|---|---|---|
| `--name` | `<agent>-<workdir>` | Set it, so two agents stay apart |
| `-m, --memory` | 50% of host memory | Clamped from 512 MiB to 32 GiB |
| `--pull` | `always` | Also `missing` or `never` |
| `--skills` | `readonly` | Also `off` or `readwrite` |
| `secret set --refresh` | `55m` | Refresh for a dynamic source |
| `ssh.agentForwardingEnabled` | `true` | Turn off for agents you do not trust |
| `sandbox.disk.dockerVolume` | `10g` | Size of `/var/lib/docker` |
| `kit.allowedSources` | `["docker.io/"]` | Allowed remote kit sources |

## Key concepts
type: concepts
from: manuals/docker-sandboxes-101/sections/r-8-glossary-and-index-of-figures.md, manuals/docker-sandboxes-101/sections/3-3-sbx-policy-init-allow-deny-and-check-network.md

- **Sandbox**: a microVM with its own kernel and a private Docker Engine.
- **Clone mode**: `--clone`. The agent works on a private clone. Commits return through a remote.
- **Preset**: `allow-all`, `balanced` or `deny-all`, set once with `sbx policy init`.
- **Policy scope**: `global` for all sandboxes, or one sandbox with `--sandbox`.
- **Deny wins**: a deny rule takes precedence over an allow for the same host.
- **Sentinel**: the placeholder the agent sees in place of a secret.

## Troubleshooting
type: troubleshooting
from: manuals/docker-sandboxes-101/capture/out/09-blocked.txt, manuals/docker-sandboxes-101/capture/out/05-ports-curl.txt, manuals/docker-sandboxes-101/capture/out/06-cp.txt, manuals/docker-sandboxes-101/capture/out/09-deny-conflict.txt, manuals/docker-sandboxes-101/capture/out/09-rm-allow.txt, manuals/docker-sandboxes-101/capture/out/07-template-save.txt, manuals/docker-sandboxes-101/sections/2-2-sbx-exec-cp-and-ports.md, manuals/docker-sandboxes-101/sections/3-5-sbx-secret-set-import-and-set-custom.md, manuals/docker-sandboxes-101/sections/3-2-clone-and-run-sandbox-source.md, manuals/docker-sandboxes-101/sections/2-4-sandboxd-diagnose-and-reset.md

| Symptom | Cause | Fix |
|---|---|---|
| `Approval required for example.com:443.` | No allow rule matches | `sbx policy allow network --sandbox <name> <host>` |
| curl to `::1` fails with exit 7 | Port published as `tcp4` | Publish `8080/tcp` for both families |
| `copying between sandboxes is not supported` | `cp` needs a host side | Copy through the host |
| Deny `conflicts with existing allow rule` | Allow and deny in one scope | `sbx policy rm network --id <uuid>` first |
| No API key from `~/.zshrc` | Host environment not read since v0.35.0 | `sbx secret set` or `sbx secret import` |
| `ensure daemon: daemon exited unexpectedly` | sandboxd problem | `sbx daemon status --json`, read `daemon.log` |

## Q&A
type: qa
from: manuals/docker-sandboxes-101/sections/1-1-sbx-and-docker-agent.md, manuals/docker-sandboxes-101/sections/2-1-sbx-run-create-stop-and-rm.md, manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md, manuals/docker-sandboxes-101/sections/3-5-sbx-secret-set-import-and-set-custom.md, manuals/docker-sandboxes-101/sections/3-2-clone-and-run-sandbox-source.md

- **Do I need Docker Desktop?** No. You need `sbx login`. Containers of the agent never show in host `docker ps`.
- **stop or rm?** `sbx stop` keeps state. `sbx rm` deletes the sandbox, its state and scoped secrets.
- **Does a host allow block a gist upload?** No. A host allow passes any method, path and body.
- **Does the agent see my key?** No. It sees `proxy-managed`. The proxy adds the key after the VM.

## Tips
type: tips
from: manuals/docker-sandboxes-101/sections/2-1-sbx-run-create-stop-and-rm.md, manuals/docker-sandboxes-101/sections/3-3-sbx-policy-init-allow-deny-and-check-network.md, manuals/docker-sandboxes-101/sections/3-5-sbx-secret-set-import-and-set-custom.md, manuals/docker-sandboxes-101/sections/2-4-sandboxd-diagnose-and-reset.md, manuals/docker-sandboxes-101/sections/2-2-sbx-exec-cp-and-ports.md

- Set memory, ports, skills and static MCP servers at creation. A re-attach ignores them.
- Run `sbx prune --dry-run` before a prune.
- Add narrow rules with `--sandbox`. Keep global rules for hosts every agent needs.
- Store keys with `sbx secret set`, never with `-e KEY`.
- Bind a custom secret to exact hosts. The proxy replaces the placeholder anywhere.
