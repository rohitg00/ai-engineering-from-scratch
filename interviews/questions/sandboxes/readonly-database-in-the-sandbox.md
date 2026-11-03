---
id: readonly-database-in-the-sandbox
title: Three failures in one sandboxed agent run
card: sandboxes
kind: debug
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, coding]
tags: [sandbox, agent-runtime, virtiofs, sqlite, allowlist]
minutes: 10
lessons: []
manuals: [docker-sandboxes-101#s-docker-agent-run-sandbox-end-to-end, docker-sandboxes-101#s-sbx-and-docker-agent]
practice: []
cheatsheet: [docker-sandboxes, agent-harness]
related: [sandboxes/blocked-host-reads-as-timeout, sandboxes/sentinel-is-not-the-key]
updated: 2026-11-03
---

`docker-agent run --sandbox agent.yaml` prints a launch summary, creates the VM, and dies with `Error: creating session store: migration failed even after database reset: failed to create migrations table: attempt to write a readonly database (1032)`. An earlier attempt was refused for `--data-dir` pointing at the home directory, and the very first model call of the day returned `403 Blocked by network policy`. Explain all three, and say what the launch summary should have told you before the run.

## Short answer

Three causes, none of them the agent file. With `--sandbox`, a data directory outside the workspace is refused, because only the workspace is writable from the VM. The 403 means the model host was not on the persistent allowlist: `docker-agent sandbox allow localhost:12434` fixes it, and the port is `localhost` because the proxy rewrites `host.docker.internal` to `localhost` before it checks the rule. The readonly database is SQLite failing to write through the `virtiofs` workspace mount on this host, although `mount` lists it `rw`; a plain Python `sqlite3` write on the same mount fails the same way, and the VM stays running after the error, so you remove it yourself.

## Full answer

### Read the launch summary first

The summary names everything the run will trust: `Models gateway: none configured`, the catalog host allowlisted for the proxy, the user allowlist with the hosts you added, then the sandbox name, the mounts with their modes, the image, and the resources. In the recorded run the workspace was `rw`, and the agent file's directory, the staged kit under `.m101/cache/sandbox-kits/<hash>` and the config directory were `ro`. The image was `docker/docker-agent-sbx-templates:latest`, with `cpu 10` and `memory 32 GiB`. Every later failure is explained by one of those rows.

### The data directory

The capture kit keeps the runtime out of `~/.cagent` with `--data-dir`, `--cache-dir` and `--config-dir`. With `--sandbox`, the refusal reads `--data-dir must be inside the sandbox's writable workspace`, so all three went under `.m101/` in the workspace. That put the session database on the mount, which is where the third failure comes from.

### The model host and the proxy

Inside the VM, `127.0.0.1` is the VM, so the agent file's provider points at `host.docker.internal:12434`. The request leaves through `HTTP_PROXY` at `gateway.docker.internal:3128`, because that host is not in `NO_PROXY`, and the sandbox proxy translates the name to `localhost`. The rule must therefore say `localhost:12434`. The in-VM allowlist reads empty, because allowed hosts arrive as proxy rules on the host, not as a list inside. The provider keys inside read `proxy-managed`.

### The readonly database

The data directory sits on the workspace mount, listed as `rw`. SQLite could not create its migrations table there, and a Python `sqlite3` probe on the same mount failed identically, so the fault is the write path through `virtiofs` on this host, not the agent. The capture proved the rest of the path by starting the same agent file inside the VM by hand with state under `/tmp/m101`: the model call went out through the proxy and the answer was correct. The runtime exits on the error and does not stop or remove the VM; `sbx ls` still shows it `running`, and `sbx rm --force` ends it. A later run from the same workspace reuses the VM unless the set of mounts changed.

## Follow-ups

- **Level 3:** Why does `127.0.0.1:12434` in the agent file fail inside while it works on the host? Expected: loopback inside the VM is the VM; use `host.docker.internal`, and allow `localhost:12434` because the proxy rewrites the name.
- **Level 3:** You allowed a host and the agent inside prints an empty allowlist. Is the rule missing? Expected: no; the rule lives in the host proxy, and the in-VM list is not where enforcement happens.
- **Level 4:** How do you prove the SQLite error is the mount? Expected: a Python `sqlite3` write on the same mount fails identically, `mount` still shows `rw`, and the same agent runs with state under `/tmp` inside.
- **Level 4:** What does the failed run leave behind, and what cleans it? Expected: a running VM that the runtime neither stops nor removes; `sbx rm` the sandbox, or expect the next run to reuse it.

## Wrong answers

- "The workspace is read-only, so change its permissions." The mount is `rw`; the failure is SQLite's write path through the mount, which a direct probe reproduces.
- "Point `--data-dir` at the home directory like the help suggests." With `--sandbox` that is refused; only the workspace is writable.
- "Allow `host.docker.internal:12434`." The proxy translates the name to `localhost` before the check, so the rule must name `localhost`.

## Taught in

The [end-to-end run section](../../../manuals/docker-sandboxes-101/sections/1-2-docker-agent-run-sandbox-end-to-end.md) records all three failures and the launch summary, and the [first section](../../../manuals/docker-sandboxes-101/sections/1-1-sbx-and-docker-agent.md) names the two launch paths.
