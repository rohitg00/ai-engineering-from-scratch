---
id: cloud-sandbox-clock-and-bill
title: A build that takes a day, on a sandbox that lives an hour
card: sandboxes
kind: estimate
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, applied-ai-engineer]
rounds: [system-design, screen]
tags: [sandbox, cloud, ttl, cost, capacity]
minutes: 8
lessons: []
manuals: [docker-sandboxes-101#s-sbx-cloud-run-move-and-ttl]
practice: []
cheatsheet: [docker-sandboxes]
related: [sandboxes/template-or-kit-for-the-toolchain]
updated: 2026-11-03
---

A build takes about a day of wall time, and you want it on a cloud sandbox because the laptop lid ends local runs. Estimate what happens if you accept every default, then set the clock and the shape, and give the order of magnitude of the bill with your reasoning shown.

## Short answer

With defaults the sandbox is the `small` shape, 2 vCPU and 4096 MiB, with a TTL of one hour from creation and no `--on-timeout`, so the server stops it if it can resume it and deletes it otherwise, and the build dies after an hour. Set `--ttl` up to the ceiling of 24 hours from creation with `--on-timeout stop`, extend with `sbx --cloud ttl +2h` if needed, and pick `xl`, 16 vCPU and 32768 MiB, at $1.12 per hour in the launch blog. A day on that shape is a bit over a day of hours times about a dollar, so under thirty dollars, well inside the $250 promotional credit, and a stopped sandbox is not billed for compute.

## Full answer

### The shapes

| Shape | vCPU | Memory | Price per hour, launch blog |
|---|---|---|---|
| `micro` | 1 | 2048 MiB | $0.07 |
| `small`, the default | 2 | 4096 MiB | $0.14 |
| `medium` | 4 | 8192 MiB | $0.28 |
| `large` | 8 | 16384 MiB | $0.56 |
| `xl` | 16 | 32768 MiB | $1.12 |

The pair `--cpus` and `--memory` must name one of the five shapes. Prices come from the launch blog and the docs tree prints none, so the bill is an estimate, not a quote. The blog meters compute per second, and the docs confirm only that a stopped sandbox is not billed for compute.

### The clock

The TTL is one hour by default and at most 24 hours from creation. `ttl +2h` extends under that ceiling and never shortens. `--on-timeout` chooses `stop`, `restart` or `delete`; `restart` needs a `--ttl` of at least one hour, and a volume-backed sandbox must use `delete`. A stopped sandbox reports `stopped`, and its clock restarts on resume. So a job longer than the ceiling needs a checkpoint: save a template or let the work land in a volume, which is a snapshot taken when the sandbox exits, where the last sandbox to exit overwrites it.

### Quotas and what moves

An account starts with 10 concurrent sandboxes, 50 stored sandboxes, 100 volumes, 100 secrets and 3 images in preparation. `sbx move NAME --to cloud` captures the filesystem as an image and starts a new sandbox with a new id; the build process does not move, so the agent runs the build again. Kit network rules and the local environment travel inside the image. Secrets, the host mount, local policy rules, host port bindings and running processes stay behind, and credential files written by an interactive sign-in travel unless deleted first. The cloud has its own store for secrets and policies, refuses HTTP method rules and governance profiles, and a published port becomes a public HTTPS URL that needs its own authentication. You need `sbx` 0.45.1 or later and a pay-as-you-go plan.

## Follow-ups

- **Level 3:** The build turns out to need more than a day. What do you do? Expected: split it with a checkpoint, a template save or a volume, because the TTL cannot pass 24 hours from creation.
- **Level 3:** You moved the laptop sandbox mid-build. Does the build continue in the cloud? Expected: no; only the filesystem travels, the process stays behind, and the agent reruns it.
- **Level 4:** Which files would you delete before the move? Expected: credential files from interactive sign-ins, because snapshots copy ordinary files and the secret store does not travel.
- **Level 4:** Why is your bill an estimate rather than a figure you quote to finance? Expected: prices come from a blog and not the docs, per-second metering is a blog claim, and only the stopped-not-billed rule is in the documentation.

## Wrong answers

- "The default TTL is a day." It is one hour; the day is the ceiling.
- "Shorten the TTL with a negative extension." `ttl` extends only and never shortens.
- "`sbx move` carries the running build." It carries the filesystem image, and the process is lost.

## Taught in

The [cloud section](../../../manuals/docker-sandboxes-101/sections/7-1-sbx-cloud-run-move-and-ttl.md) lists the shapes, the TTL rules, the quotas and what `sbx move` leaves behind.
