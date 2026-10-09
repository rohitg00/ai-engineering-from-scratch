# docker-agent run --sandbox, one run end to end

> One recorded `docker-agent run --sandbox` shows the kit, the sandbox, and the allowlist, and one `sbx exec` into the same VM shows the model call through the proxy.

You have an agent file with the `filesystem` and `shell` toolsets, and its model is `ai/qwen3:4b` on Docker Model Runner on your Mac. On the host, `shell` runs with your permissions. `--sandbox` moves the tools into a microVM and leaves the model on the host.

This section follows the recorded run in capture/out/27-*, step by step, and [figure](#fig-1-3) draws it. When you finish this section, you can read the launch summary of a sandboxed run and explain the two failures this run met.

```figure
id: fig-1-3
kind: sequence
title: one docker-agent run --sandbox, step by step
claim: docker-agent stages a kit, has sbx create the VM, and opens two hosts on the proxy, and the model call from inside then leaves through that proxy.
caption: Read top to bottom, one numbered row per step, and row 8 is the failure that ends the run. Rows 1 to 8 come from capture/out/27-sandbox-allow.txt, 27-sandbox-run.txt, and 27-kit-cache.txt. Rows 9 to 15 come from 27-inside-run.txt and 27-sbx-rm.txt, and the chunk name in row 12 is the stream format of the cassette 18-files.
```

## The agent file

The agent file differs from the host version only in its provider. Your host's `127.0.0.1` is "not reachable from inside the sandbox" {{docs-sbx Accessing host services from a sandbox}}, so the provider points at `host.docker.internal`:

```listing
title: the provider block of the sandboxed agent file
source: capture/fixtures/agents/files-sandbox.yaml
lang: yaml
note: Cut to the version, the provider, and the model. The agent, its instruction, and its two toolsets are cut.
---
version: "16"

providers:
  host-runner:
    provider: dmr
    base_url: http://host.docker.internal:12434/engines/llama.cpp/v1

models:
  local:
    provider: host-runner
    model: ai/qwen3:4b
    temperature: 0
…
```

## Step 1: allow the model host

**Persistent allowlist:** the hosts that `docker-agent sandbox allow` stores, which "are added to the sandbox proxy's allow rules on every subsequent --sandbox run" {{help-agent docker-agent sandbox allow}}. The help names it the fix for a `Blocked by network policy` 403. The proxy translates `host.docker.internal` to `localhost`, so the capture allows `localhost:12434` before the run:

```listing
title: one host added to the persistent allowlist
source: capture/out/27-sandbox-allow.txt
lang: text
note: The welcome banner and the telemetry notice of the first run are cut, and so is the second command.
---
$ docker-agent sandbox allow localhost:12434  (--config-dir, --data-dir, --cache-dir under fixtures/repo-sandbox/.m101, inside the workspace)
…
Added 1 host(s) to the persistent sandbox allowlist:
  + localhost:12434
[exit 0]
…
```

## Step 2: keep the state directories in the workspace

The capture kit keeps docker-agent out of `~/.cagent` with `--data-dir`, `--cache-dir`, and `--config-dir`. With `--sandbox`, a data directory outside the workspace is refused, and the help gives only the default, `~/.cagent` {{help-agent docker-agent run}}. The capture kit therefore puts all three under `.m101/` in the workspace:

```listing
title: a data directory outside the workspace
source: capture/out/27-data-dir-outside.txt
lang: text
note: The command line is cut.
---
…
Error: --data-dir must be inside the sandbox's writable workspace $CAPTURE/fixtures/repo-sandbox
[exit 1]
```

## Step 3: the launch summary

```listing
title: the launch summary of docker-agent run --sandbox
source: capture/out/27-sandbox-run.txt
lang: text
note: The command line and the image pull progress are cut. The rest of the output follows in step 5.
---
…
Models gateway: none configured
Models catalog: allowlisting models.dev in the sandbox proxy
User sandbox allowlist: allowlisting 1 host(s) from `docker agent sandbox allow`:
  - localhost:12434

sandbox    docker-agent-<hash>
agent      docker-agent
workspace  $CAPTURE/fixtures/repo-sandbox (rw)
           $CAPTURE/fixtures/agents (ro)
           $CAPTURE/fixtures/repo-sandbox/.m101/cache/sandbox-kits/<hash> (ro)
           $CAPTURE/fixtures/repo-sandbox/.m101/cfg (ro)
image      docker/docker-agent-sbx-templates:latest
cpu        10
memory     32 GiB
…
✓ Created sandbox docker-agent-<hash>
```

The run set no `--models-gateway`. It allows `models.dev`, because "without it the first catalog lookup fails with a `403 Blocked by network policy` error" {{docs-agent Auto-Kit}}. The next line repeats the host from step 1.

**Auto-kit:** a directory that docker-agent stages on the host, "bind-mounted read-only into the VM at the same path" {{docs-agent Auto-Kit}}. Here it is `.m101/cache/sandbox-kits/<hash>`, and its `manifest.json` holds only `agent_ref` and `built_at` (capture/out/27-kit-cache.txt). The workspace is read-write, and the agent file's directory, the kit, and the config directory are read-only.

## Step 4: an ordinary sandbox

During the run, `sbx ls` lists `docker-agent-<hash>` with the agent `docker-agent`, the status `running`, and the same four workspaces, three of them `:ro` (capture/out/27-sbx-ls.txt). The sandbox is an ordinary one, and `sbx` lists and removes it like any other.

## Step 5: the session store fails

Inside the VM, the run stopped before any model call:

```listing
title: the end of the sandboxed run
source: capture/out/27-sandbox-run.txt
lang: text
note: The two self-update warnings before the error are cut.
---
…
Error: creating session store: migration failed even after database reset: failed to create migrations table: attempt to write a readonly database (1032)
Error: 
[exit 1]
```

The data directory sits on the `virtiofs` workspace mount, which `mount` lists as `rw`. A Python `sqlite3` write on the same mount fails the same way (capture/out/27-sqlite-probe.txt), so on this host SQLite cannot write through that mount. The run printed no safety mode, so [conflict C62](#s-ref-sources-and-the-conflicts-register) stays open. Docker Agent "exits but does not stop or remove the sandbox VM" {{docs-agent Sandbox Mode}}, and the VM stayed `running`.

## Step 6: the model call from inside

```listing
title: the agent binary and the proxy settings inside the VM
source: capture/out/27-inside.txt
lang: text
note: Cut to the version, four environment lines, and the in-VM allowlist. The other variables and the self-update warnings are cut.
---
docker-agent version main
Commit: 154b78f2d517dae1397866dfb7586c4a302a3151
…
ANTHROPIC_API_KEY=proxy-managed
…
HTTP_PROXY=http://gateway.docker.internal:3128
…
NO_PROXY=localhost,127.0.0.1,::1,gateway.docker.internal
OPENAI_API_KEY=proxy-managed
…
Persistent sandbox allowlist is empty.
```

The template runs `docker-agent version main`, not v1.149.0, although the docs build `:latest` from "The most recent `v*` release" {{docs-agent Sandbox Mode}}. The provider keys read `proxy-managed`. The in-VM allowlist is empty, because the allowed hosts arrive as proxy rules from the host.

The capture then runs the same agent file inside, with its state in `/tmp/m101`:

```listing
title: the model call from inside the VM
source: capture/out/27-inside-run.txt
lang: text
note: The command line is cut after the state flags, and the two self-update warnings are cut.
---
$ sbx exec docker-agent-<hash> sh -c 'docker-agent --config-dir /tmp/m101 --data-dir /tmp/m101 --cache-dir /tmp/m101 run --exec --last …
…
The working directory contains README.md with 1 line.
[exit 0]
```

The request to `host.docker.internal:12434` leaves through `HTTP_PROXY`, because that host is not in `NO_PROXY`. "The sandbox proxy translates `host.docker.internal` to `localhost` before forwarding the request" {{docs-sbx Accessing host services from a sandbox}}, and the rule from step 1 admits it. The answer is correct: the capture kit copies the same README into every workspace, and it holds the one line `hello` (capture/out/04-workspace.txt).

## Step 7: remove the sandbox

```listing
title: the removal
source: capture/out/27-sbx-rm.txt
lang: text
note: Nothing is cut.
---
$ sbx rm --force docker-agent-<hash>
Deleting sandbox docker-agent-<hash>...
Sandbox 'docker-agent-<hash>' removed
[exit 0]
```

A later run from the same workspace reuses the VM, and creates a new one "only when the mount set has changed" {{docs-agent Sandbox Mode}}.

```takeaways
- Allow each host service with `docker-agent sandbox allow localhost:PORT` before the first sandboxed run.
- Keep `--data-dir`, `--cache-dir`, and `--config-dir` inside the workspace when you use them with `--sandbox`.
- Read the launch summary for each mount mode, the image, and every allowed host.
- Remove the sandbox with `sbx rm` when you no longer need it, because docker-agent leaves it running.
```

Sources: help-agent docker-agent run, docker-agent sandbox allow (research/sources/help-docker-agent.md); docs-agent Sandbox Mode, Auto-Kit (research/sources/docs-docker-agent.md); docs-sbx Accessing host services from a sandbox (research/sources/docs-sandboxes.md); research/conflicts-register.md rows C61, C62; capture/README.md; capture/fixtures/agents/files-sandbox.yaml; capture/out/27-sandbox-allow.txt, 27-data-dir-outside.txt, 27-sandbox-run.txt, 27-kit-cache.txt, 27-sbx-ls.txt, 27-sqlite-probe.txt, 27-inside.txt, 27-inside-run.txt, 27-sbx-rm.txt, 04-workspace.txt; capture/cassettes/18-files.yaml.gz
