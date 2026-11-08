---
id: hypervisor-is-the-boundary
title: The agent has sudo and a Docker Engine, so where is the wall
card: sandboxes
kind: concept
level: 1
roles: [agentic-ai-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, system-design]
tags: [sandbox, microvm, isolation, docker-engine, boundary]
minutes: 6
lessons: []
manuals: [docker-sandboxes-101#s-sbx-diagnose-and-the-microvm-boundary, docker-sandboxes-101#s-sbx-mcp-add-load-and-static-mcp]
practice: []
cheatsheet: [docker-sandboxes]
related: [protocols/roots-are-not-a-sandbox]
updated: 2026-11-03
---

Inside a Docker sandbox the agent runs as uid 1000 in the `sudo` and `docker` groups, and `docker version` answers with a server. A teammate concludes that the sandbox is no safer than a container running as root. Where is the wall, and what does the agent own inside it?

## Short answer

The wall is the hypervisor line under the guest kernel, not the user inside. The documentation puts it plainly: the agent is a non-root user with sudo rights inside the VM, the hypervisor boundary isolates the agent, and privilege separation inside the VM does not. Everything below that line belongs to the agent, including a private Docker Engine whose images never appear in `docker ps` on the host, and the host offers no Docker API to the sandbox at all.

## Full answer

### Five layers, read from inside

`sbx diagnose` names the platform: `kern.hv_support is 1` is hardware virtualization, and the guest runs on the host hypervisor. From inside, `uname`, `id`, `docker version` and `mount` show a guest kernel on `aarch64` with 16 KiB pages (`getconf PAGESIZE` prints 16384), user `agent` with uid 1000, a Docker Engine server with its own containerd, and the workspace as a `virtiofs` mount at the same absolute path as on the host.

The documentation names five isolation layers: hypervisor, network, Docker Engine, workspace and credential. The engine inside is the agent's. Images it builds live in the VM, and the agent cannot reach the daemon on your host. There is no Moby API from the host either, so REST clients that expect one do not work, and `sbx exec` is the way in.

### The doors through the wall

Count the lines in the guest environment that cross the line:

| Door | The guest line |
|---|---|
| mount | `host on <workspace> type virtiofs (rw,...)`, plus a read-only bind of `/etc/resolv.conf` |
| network | `HTTPS_PROXY` pointing at `gateway.docker.internal:3128` |
| secret | a provider key variable set to the sentinel `proxy-managed` |
| MCP | `MCP_GATEWAY_URL` pointing at `mcp-gateway.docker.internal/mcp` |
| SSH agent | `SSH_AUTH_SOCK=/run/ssh-agent.sock` forwarded through `gateway.docker.internal:3129` |

Each door is a place where host policy applies. Nothing the agent does with sudo changes which doors exist.

### What the teammate gets right

Inside the VM, the agent owns the filesystem, the engine and every process. A build that assumes 4 KiB pages fails on this guest. The VM has limits of its own: memory defaults to half of host memory, clamped between 512 MiB and 32 GiB, and `--cpus 0` means every host CPU, at most 16 on Linux arm64. None of that is a control; it is a budget.

### One thing that is not inside

An MCP server registered on the host with `--command` runs on the host with the permissions of your host user, outside the engine boundary and outside network policy. Only a server the agent starts inside the VM is subject to the sandbox rules.

## Follow-ups

- **Level 1:** The agent runs `docker build` and the host's `docker ps` shows nothing. Why? Expected: the engine and its image store live inside the VM; the host daemon is a different engine.
- **Level 2:** A compiled tool crashes inside with a page-size error. What is different about the guest? Expected: the guest kernel uses 16 KiB pages, which `getconf PAGESIZE` reports as 16384, and `sbx diagnose` compares the `mkfs.erofs` block size against it.
- **Level 2:** Name each path by which something from the host enters the VM. Expected: the workspace mount, the proxy for network, secret sentinels, the MCP gateway URL and the forwarded SSH agent.
- **Level 3:** Which registered MCP server is not covered by the wall? Expected: one added with `--command`, which runs on the host as your user and is not under network policy.

## Wrong answers

- "sudo inside means root on my laptop." The user inside is a guest user; the hypervisor is the control, and the docs say privilege separation inside is not.
- "The sandbox shares my Docker daemon." Each sandbox runs its own Docker Engine, and the host offers no API to the VM.
- "It needs no account because it runs without Docker Desktop." `sbx` runs without Desktop and still refuses to create a sandbox without a sign-in; the FAQ gives the reasons.

## Taught in

The [microVM boundary section](../../../manuals/docker-sandboxes-101/sections/3-1-sbx-diagnose-and-the-microvm-boundary.md) reads the guest from inside and names the five doors, and the [MCP section](../../../manuals/docker-sandboxes-101/sections/3-6-sbx-mcp-add-load-and-static-mcp.md) shows the one server that runs on the host.
