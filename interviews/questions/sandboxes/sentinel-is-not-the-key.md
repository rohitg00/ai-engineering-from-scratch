---
id: sentinel-is-not-the-key
title: The key reads proxy-managed and the agent still works
card: sandboxes
kind: concept
level: 1
roles: [agentic-ai-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, debugging]
tags: [sandbox, secrets, proxy, sentinel, credentials]
minutes: 6
lessons: []
manuals: [docker-sandboxes-101#s-sbx-secret-set-import-and-set-custom, docker-sandboxes-101#s-sbx-and-docker-agent]
practice: []
cheatsheet: [docker-sandboxes]
related: [sandboxes/hypervisor-is-the-boundary]
updated: 2026-11-03
---

An agent inside a sandbox prints its environment. The provider key variable reads `proxy-managed`, and `GH_TOKEN` looks like a real token that starts with `gho_sbxproxymanaged`. The developer had exported the real key in `~/.zshrc` and, when that failed, passed `-e KEY=value`. Explain what the agent holds, where the real value lives, and how a request still reaches the provider with a valid key.

## Short answer

The agent holds a placeholder, never the value. Three sentinel formats exist: `proxy-managed` for provider keys, a token-shaped `gho_sbxproxymanaged000000000000000000000` for `GH_TOKEN`, and `sbx-cs-<rand>` for custom secrets. The value sits in the host store, the macOS Keychain, the Windows Credential Manager or the Linux Secret Service, and the host proxy swaps the placeholder for the value after the request has left the VM, only on a request to the host the secret is bound to. The host environment is not read since v0.35.0, and `-e` passes a plain variable, not a secret.

## Full answer

### Three ways in, and one that is not

`sbx secret set` stores a value under one of 13 service names, from `-t`, stdin, `--command` or `--ref`, and `--refresh` sets a cache time with a default of 55 minutes. `sbx secret import` reads the host environment once, shows each candidate with a last-4 preview, and stores what you accept. `sbx secret set-custom` binds a value to `--host` targets and an `--env` name of your own.

`-e KEY=VALUE` is the fourth path and it is not a secret path. The variable lands in the agent session as plain text, and a `sbx template save` later copies it with every other file in the container filesystem.

### What the receiver on the host saw

The recorded run bound a custom secret to `host.docker.internal` and `localhost`, started a receiver on the host at `127.0.0.1:18080`, and sent requests from inside with the placeholder in three places. The receiver logged the real value inside `Bearer`, in an `X-Demo` header and as the whole `Authorization` value. So the swap happens on plain HTTP and it is a substring replacement anywhere in the request to a bound host.

A fourth request went to a name listed in `NO_PROXY`, so curl skipped the forward proxy. The transparent path blocked it and swapped nothing. The existing sandbox never received the new custom variable; a custom secret reaches new sandboxes only. Removal is immediate for running sandboxes.

### The one credential path that does cross

SSH agent forwarding is on by default. The guest sees `SSH_AUTH_SOCK=/run/ssh-agent.sock` with a gateway on port 3129. The private key stays on the host, and any process inside can ask that agent to sign. `ssh.agentForwardingEnabled` turns it off, followed by a daemon restart.

## Follow-ups

- **Level 1:** Why did the export in the shell profile change nothing inside? Expected: since v0.35.0 the host environment is not read; store the value with `sbx secret set` or `sbx secret import`.
- **Level 2:** What is the cost of `-e API_KEY=...` beyond convenience? Expected: the value is visible to the agent and to every template saved from that sandbox, and no proxy swap protects it.
- **Level 2:** The placeholder also appears in a query string of a request to the bound host. What arrives? Expected: the real value, because the replacement is a substring swap anywhere in the request.
- **Level 3:** Why bind a custom secret to exact hosts rather than a wide pattern? Expected: the proxy fills the placeholder on any request to a bound host, so a wide binding lets the agent deliver the value to a destination you did not intend.

## Wrong answers

- "The agent needs the real key or the provider call fails." The proxy adds the key after the request leaves the VM; the recorded run answered correctly with `proxy-managed` inside.
- "`GH_TOKEN` inside is a leaked real token." It is a sentinel shaped like a token so that tools accept it; the value stays on the host.
- "Export the key on the host and the sandbox inherits it." That path closed in v0.35.0; a tutorial that says so is out of date.

## Taught in

The [secrets section](../../../manuals/docker-sandboxes-101/sections/3-5-sbx-secret-set-import-and-set-custom.md) records the sentinels and the receiver log, and the [first section](../../../manuals/docker-sandboxes-101/sections/1-1-sbx-and-docker-agent.md) names who owns the store and the proxy.
