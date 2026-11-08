---
id: template-or-kit-for-the-toolchain
title: Share an hour of installs as a template or as a kit
card: sandboxes
kind: tradeoff
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [sandbox, template, kit, snapshot, secrets]
minutes: 8
lessons: []
manuals: [docker-sandboxes-101#s-sbx-template-save-and-load, docker-sandboxes-101#s-sbx-cloud-run-move-and-ttl]
practice: []
cheatsheet: [docker-sandboxes]
related: [sandboxes/sentinel-is-not-the-key]
updated: 2026-11-03
---

A teammate spent an hour installing a toolchain inside a sandbox and wants everyone to start from it tomorrow. One option is `sbx template save` and a tar; the other is a kit that declares the install steps. Compare the two, and name what a template carries that a kit never does.

## Short answer

A template is a snapshot of the container filesystem stored as an image, reused with `sbx run --pull never -t TAG AGENT` and carried to another host as an OCI tar through `sbx template load`; it is fast and exact, and it is bytes nobody reviews. A kit declares install commands, files, hosts and credentials, so it is readable, signable and re-resolved at creation, and a template holds none of those runtime settings. The template does hold every file an agent wrote inside, including any key written to disk, which is why credentials belong in `sbx secret` and not in a saved sandbox.

## Full answer

### What a template holds and leaves out

Mounted filesystems are not in it: the host workspace and the engine's store are excluded, so a saved template is not a backup of the whole sandbox. Everything else in the container filesystem is in it. Agent configuration files such as the agent's settings file are rewritten every time a sandbox is created, so edits there do not survive either. The kit still supplies the runtime settings, credentials and network rules; the template supplies image content only.

### The mechanics that trip people

`sbx template save SANDBOX TAG` needs a stopped sandbox; the recorded attempt on a running one printed `cannot save a running sandbox`. The image goes to the sandbox runtime's own store, which is separate from the host daemon's store, so `docker image inspect` on the host finds nothing and `sbx template ls` is the right command. The exported tar had 24 entries in OCI layout, and `sbx template load FILE` imports it on another host with no registry involved. Name the agent the template was built for when you reuse it; a template built for one agent and run as another prints a warning that the sandbox can fail.

### The same trade in `sbx move`

Moving a sandbox to the cloud captures the filesystem as a template image and uploads it. Kit network rules and the local environment travel inside the image. The host bind mount, the secrets in the store, local policy rules, host port bindings and running processes stay behind. Credential files written by an interactive sign-in are ordinary files, so they travel unless you delete them first. Moving back to local can stage up to 32 GiB in the host's temporary directory.

### The decision

| Need | Pick |
|---|---|
| exact bytes, today, one team | template, with secrets kept out of files |
| review, signature, re-resolution, policy | kit |
| a policy or a credential | kit, because a template cannot express it |

## Follow-ups

- **Level 2:** `sbx template save` on the running sandbox failed. What is the sequence? Expected: `sbx stop`, then save with `--output` for the tar, then `sbx run --pull never -t TAG AGENT` with the same agent.
- **Level 2:** The host's `docker image ls` does not list the template. Where is it? Expected: in the sandbox runtime's image store, which the host daemon does not share; use `sbx template ls`.
- **Level 3:** An agent signed in to a service interactively inside the sandbox. What happens to that credential on `sbx move` or `template save`? Expected: it is a file in the container filesystem and travels in the image unless deleted first.
- **Level 3:** A colleague wants the same allowed hosts as the template's author. Does the template give them that? Expected: no; network rules come from a kit or a policy, and a template carries image content only.

## Wrong answers

- "A template is a backup of the sandbox." Mounted workspaces and the engine's store are excluded.
- "The template carries the allowed hosts." The kit carries runtime settings; the template carries bytes.
- "Keys inside are safe because the environment shows `proxy-managed`." The sentinel is safe; a value an agent wrote to a file is copied with the file.

## Taught in

The [template section](../../../manuals/docker-sandboxes-101/sections/2-3-sbx-template-save-and-load.md) records the refused save, the separate store and the tar, and the [cloud section](../../../manuals/docker-sandboxes-101/sections/7-1-sbx-cloud-run-move-and-ttl.md) lists what `sbx move` carries.
