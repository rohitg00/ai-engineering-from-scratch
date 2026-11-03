---
id: port-published-on-ipv4-only
title: A published port that answered on one loopback
card: scenarios
kind: incident
level: 1
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, debugging]
tags: [sandbox, ports, ipv6, loopback]
minutes: 15
lessons: []
manuals: [docker-sandboxes-101#s-sbx-exec-cp-and-ports, docker-sandboxes-101#s-ref-sources-and-the-conflicts-register]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
system:
  version: sbx v0.47.0
  model: none; shell commands inside the sandbox
  hardware: one Mac with the microVM runtime
source:
  - manuals/docker-sandboxes-101/capture/out/05-ports.txt
  - manuals/docker-sandboxes-101/capture/out/05-ports-curl.txt
  - manuals/docker-sandboxes-101/capture/out/05-ports-ls.txt
  - manuals/docker-sandboxes-101/capture/out/05-ports-tcp.txt
  - manuals/docker-sandboxes-101/capture/out/05-ports-unpublish.txt
  - manuals/docker-sandboxes-101/sections/2-2-sbx-exec-cp-and-ports.md
  - manuals/docker-sandboxes-101/sections/r-7-sources-and-the-conflicts-register.md
---

## Situation

A developer serves a static site from inside a sandbox on port 8080 and publishes it to the host with `sbx ports m101-demo --publish 18081:8080`. A browser on the host opens the page. A test harness on the same host reports that it could not connect, and its log shows that it tried `::1`. The developer suspects that the server inside the sandbox listens on one interface only and starts editing its configuration.

You have the publish command and its listing, the same URL fetched on both loopback addresses, the listing in `sbx ls`, a second publish with a protocol named, and the unpublish calls.

## Evidence

- [a port published without a protocol, and the listing](evidence/publish-and-list.txt)
- [the same URL on the two loopback addresses](evidence/two-loopbacks.txt)
- [the binding in the PORTS column of sbx ls](evidence/the-ports-column.txt)
- [a publish with the protocol named, and the JSON listing](evidence/a-dual-stack-publish.txt)
- [two unpublish calls and the empty listing](evidence/unpublish.txt)

## Questions

1. Which side refused the connection, the server in the sandbox or the host binding? What in the listing says so?
2. What does a publish without a protocol bind, and since which release?
3. How do you publish so that both loopbacks answer?
4. The -p flag on sbx run did not help on a re-attach. Why?
5. How do you remove a binding, and how do you check that it is gone?

## Walkthrough

1. **Read the protocol column.** The publish answered `Published 127.0.0.1:18081 -> 8080/tcp4`, and the listing shows one row with the host address `127.0.0.1` and the protocol `tcp4`. The host binding is IPv4 only. The server inside was never asked.
2. **Confirm with the two fetches.** `127.0.0.1:18081` returns 200. `[::1]:18081` fails to connect and curl exits 7. The failing side is the host loopback where nothing listens.
3. **Name the rule.** Without a protocol, publishing uses `tcp4`, so the host side is `127.0.0.1` alone. The manual dates the change to v0.42.0: a published port no longer listens on `::1` unless you name the protocol. The 2025 plugin bound both loopbacks, which conflict C39 records. `sbx ls` shows the same binding in its `PORTS` column.
4. **Publish for both families.** `--publish 8080/tcp` binds `127.0.0.1` and `[::1]` on ephemeral host ports, and `sbx ports --json` lists three records: the first `tcp4` binding and two `tcp` ones, one per address. Name a host port in the spec when the harness needs a fixed one.
5. **Remove what you no longer need.** `--unpublish 18081:8080` and `--unpublish <port>:8080/tcp` each remove their mapping, and the JSON listing ends empty. `-p` on `sbx run` applies at creation only, so later changes go through `sbx ports`.

## Resolution

The server was fine. The host binding was `tcp4`, so only `127.0.0.1` listened, and the harness's connection to `::1` found no listener. Publishing `8080/tcp` with a fixed host port gives both loopbacks a binding, and the harness connects. The edits inside the sandbox are reverted.

## Wrong turns

- "Bind the server inside the sandbox to all interfaces." The guest side already answered through the IPv4 mapping. The missing listener was on the host loopback.
- "Pass -p 18081:8080/tcp on the next sbx run." On an existing sandbox the flag is ignored. Use sbx ports.
- "Turn off IPv6 in the test harness." It works, and it hides a binding rule that the next harness will hit again.

## Generalize

When one client reaches a service and another does not, compare the addresses each one used before you touch the service. A port mapping has its own address family, and a listing that prints it saves an hour of edits in the wrong place.

## Taught in

[The ports page](../../../manuals/docker-sandboxes-101/sections/2-2-sbx-exec-cp-and-ports.md) gives the `tcp4` rule and the protocol table, and [the conflicts register](../../../manuals/docker-sandboxes-101/sections/r-7-sources-and-the-conflicts-register.md) records the change as C39.
