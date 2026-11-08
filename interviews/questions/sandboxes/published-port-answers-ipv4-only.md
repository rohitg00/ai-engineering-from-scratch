---
id: published-port-answers-ipv4-only
title: The port that answers on one loopback and refuses the other
card: sandboxes
kind: debug
level: 2
roles: [agentic-ai-engineer, applied-ai-engineer]
rounds: [debugging, coding]
tags: [sandbox, ports, exec, cp, networking]
minutes: 6
lessons: []
manuals: [docker-sandboxes-101#s-sbx-exec-cp-and-ports]
practice: []
cheatsheet: [docker-sandboxes]
related: [sandboxes/hypervisor-is-the-boundary]
updated: 2026-11-03
---

You publish `18081:8080` with `sbx ports`. A client on the host that connects to `[::1]:18081` gets a refused connection, while `127.0.0.1:18081` answers 200. Explain the default, write the spec that fixes it, and name the two other `sbx` verbs whose rules differ from their `docker` counterparts.

## Short answer

Without a protocol in the spec, the publish command uses `tcp4`, so the host binding is `127.0.0.1` alone; that changed in v0.42.0, and the recorded `curl` to `::1` failed with exit 7. Publish `8080/tcp` to bind both loopbacks, each on an ephemeral host port, and unpublish without a protocol removes either form. The other two verbs are `sbx exec`, which runs as the `agent` user, starts a stopped sandbox and has no detached mode, and `sbx cp`, which needs one side written as `SANDBOX:PATH` and refuses a copy between two sandboxes.

## Full answer

### The address family table

| `PROTOCOL` | Host binding when `HOST_IP` is omitted |
|---|---|
| none | `127.0.0.1` as `tcp4`, or `tcp6` on `::1` when `HOST_IP` is an IPv6 address |
| `tcp`, `udp` | `127.0.0.1` and `::1`, or `127.0.0.1` alone when the sandbox is IPv4-only |
| `tcp4`, `udp4` | `127.0.0.1` |
| `tcp6`, `udp6` | `::1` |

`sbx ports SANDBOX --json` lists every binding as `host_ip`, `host_port`, `sandbox_port` and `protocol`, and `sbx ls` prints them in its `PORTS` column. `-p` on `sbx run` applies at creation only and is ignored on re-attach, so later changes go through `sbx ports`. Publishing starts a stopped sandbox first. In the cloud a published port gets a public URL and UDP is refused.

### exec and cp

`sbx exec` runs the command as uid 1000 in the `sudo` and `docker` groups, in the workspace directory, and `-u root` is how the help installs packages. `-d` appears in the help only to say that detached exec is not supported, and with `--cloud` the flags `-d`, `--user` and `--privileged` are rejected rather than ignored. Inside, `SANDBOX_NAME` and `SANDBOX_ID` name the sandbox and `WORKSPACE_DIR` names the mount.

`sbx cp SRC DST` takes one sandbox side as `SANDBOX:PATH` and one host side. The recorded copy from one sandbox to another exited 1 with `copying between sandboxes is not supported`, so such a copy goes through the host in two steps. A sandbox path is a container path, so a file under `/tmp` sits outside the workspace mount and disappears with the sandbox. Copy-out had a security history: release v0.38.0 fixed CVE-2026-17106, a flaw that let a copy-out escape its destination.

## Follow-ups

- **Level 2:** You re-attach with `-p 18081:8080` on a sandbox created without it, and nothing is published. Why? Expected: `-p` applies at creation only; use `sbx ports --publish` on the existing sandbox.
- **Level 3:** `sbx cp a:/tmp/x b:/tmp/x` fails. How do you move the file? Expected: two copies through a host path, because sandbox-to-sandbox copy is not supported.
- **Level 3:** Why does `--cloud` reject `--privileged` rather than ignore it? Expected: a silently ignored flag would let a script believe it ran privileged; refusal keeps the local and cloud behavior honest.
- **Level 4:** You bound `8080/tcp` and later unpublish `8080` with no protocol. What remains? Expected: nothing; unpublish without a protocol removes the default form and the dual-stack form alike.

## Wrong answers

- "IPv6 is turned off inside the VM." The binding family is a host-side choice made by the protocol in the spec.
- "Unpublish must repeat the protocol you published with." It removes the mapping in both cases without one.
- "`sbx exec -d` runs the command in the background." Detached exec is not supported; the flag exists in the help to say so.

## Taught in

The [exec, cp and ports section](../../../manuals/docker-sandboxes-101/sections/2-2-sbx-exec-cp-and-ports.md) records the `tcp4` binding, the two `curl` results and the refused copy.
