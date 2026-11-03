---
id: readonly-database-inside-the-sandbox
title: A read-only database on a read-write mount
card: scenarios
kind: incident
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, system-design]
tags: [sandbox, microvm, virtiofs, sqlite, docker-agent, mounts]
minutes: 25
lessons: []
manuals: [docker-sandboxes-101#s-docker-agent-run-sandbox-end-to-end, docker-sandboxes-101#s-docker-agent-run-new-and-doctor, docker-sandboxes-101#s-from-docker-sandbox-and-cagent-to-sbx-and-docker-agent, docker-sandboxes-101#s-ref-sources-and-the-conflicts-register]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
system:
  version: sbx v0.47.0 and docker-agent v1.149.0 on the host, with the main build of docker-agent inside the template
  model: none; the run stopped before its first model call
  hardware: one Mac with the microVM runtime
source:
  - manuals/docker-sandboxes-101/capture/out/27-sandbox-run.txt
  - manuals/docker-sandboxes-101/capture/out/27-data-dir-outside.txt
  - manuals/docker-sandboxes-101/capture/out/27-sqlite-probe.txt
  - manuals/docker-sandboxes-101/capture/out/27-inside.txt
  - manuals/docker-sandboxes-101/capture/out/27-inside-run.txt
  - manuals/docker-sandboxes-101/capture/out/27-kit-cache.txt
  - manuals/docker-sandboxes-101/sections/1-2-docker-agent-run-sandbox-end-to-end.md
  - manuals/docker-sandboxes-101/sections/5-1-docker-agent-run-new-and-doctor.md
  - manuals/docker-sandboxes-101/sections/7-3-from-docker-sandbox-and-cagent-to-sbx-and-docker-agent.md
  - manuals/docker-sandboxes-101/sections/r-7-sources-and-the-conflicts-register.md
---

## Situation

A team runs its coding agent with `--sandbox`, so that its `shell` and `filesystem` tools act inside a microVM while the model stays on the host. The first sandboxed run on a developer's Mac prints a launch summary, pulls the template image, creates the sandbox, and exits with code 1 before the agent answers. The error names the session store: its migration could not create a table, because the database was read-only. The sandbox is still listed as running.

The team splits three ways in the channel. One engineer says the template image is broken and wants to pin an older tag. One says the workspace must have been mounted read-only by mistake. One says SQLite is missing from the guest. Before the second attempt, the developer gives you the launch output, a second run with the state directories at their defaults, and a shell inside the running VM.

## Evidence

- [the sandboxed run, its state flags and the launch summary](evidence/the-command-and-its-mounts.txt)
- [the last five lines of the sandboxed run](evidence/the-error-that-ended-the-run.txt)
- [the same run with the state directories at their defaults](evidence/a-data-directory-outside-the-workspace.txt)
- [a plain SQLite write inside the VM, then the mounts of the workspace](evidence/a-sqlite-write-and-the-mounts.txt)
- [the auto-kit that docker-agent staged under the workspace](evidence/what-the-staged-kit-holds.txt)
- [the version of the agent binary inside the VM](evidence/the-agent-binary-inside.txt)
- [the same agent file started by hand inside the VM](evidence/the-run-that-worked-inside.txt)

## Questions

1. Where did the data directory sit, and which mount held it?
2. Three mounts are read-only in the summary. Does any of them explain the error?
3. What does the SQLite probe add that the error message does not?
4. Why did the second run fail before it created anything?
5. The last listing is a run that completed. What does it prove, and what does it not prove?
6. How would you run this agent in a sandbox on this host today, and what would you file?

## Walkthrough

1. **Read the state flags first.** The note after the command says that the config, data and cache directories sit under `.m101/` in the workspace. The error comes from the session store, which lives in the data directory, so the database file is on the workspace mount.
2. **Read the four workspace lines.** The workspace is `(rw)`. The agent file directory, the staged kit under `.m101/cache/sandbox-kits/<hash>` and `.m101/cfg` are `(ro)`. The data directory is none of those three paths, so the mount modes do not explain the failure.
3. **Rule out the mount flags with the probe.** Inside the VM, a plain Python `sqlite3` write under `.m101/probe/` fails with the same `attempt to write a readonly database` message. The mount table on the lines below lists the workspace as a `virtiofs` mount with `rw`. The kernel reports the mount as writable, and SQLite still cannot write a database through it. The fault sits between SQLite and this mount, not in the sandbox settings and not in a missing package: the probe imported `sqlite3` and connected without error.
4. **Read why the defaults are no escape.** The run with the default state directories was refused before it made a sandbox: `--data-dir` must be inside the writable workspace. So the launcher forces the database onto the one mount where, on this host, SQLite cannot write it.
5. **Separate the kit from the store.** The staged auto-kit holds a `manifest.json` with `agent_ref` and `built_at`, plus `prompt_files` and `skills`. Nothing in it configures a database. The template runs `docker-agent version main`, not the release the host runs, so the image tag is a second finding to record. The probe fails for any program, though, so a different agent build would not change the result.
6. **Prove the model path with the run by hand.** Started inside the VM with its three state directories under `/tmp/m101`, the guest's own filesystem and not a mount, the same agent file answered with exit 0: the README has 1 line. The provider at `host.docker.internal:12434` was reached through the proxy. So the model path, the allowlist and the agent file are sound. Only the location of the session store fails.

## Resolution

The session store could not write because SQLite cannot write a database through the `virtiofs` workspace mount on this host, although `mount` lists it as `rw`. The launcher requires the data directory inside that workspace, so a `--sandbox` launch has no supported place for the store on this machine. The sandbox itself worked: a run started by hand inside the VM, with its state under `/tmp/m101`, completed with the correct answer, and the same agent file reached the model through the proxy.

What to do:

1. On every new host, before the launcher is used with `--sandbox`, test a SQLite write inside the workspace from a shell in the VM, as the manual's checklist says.
2. Until the data directory rule changes, start the agent inside the VM by hand with `sbx exec`, with `--data-dir` on the guest filesystem, and keep the host launcher for machines where the probe passes.
3. Remove the sandbox with `sbx rm` when you are done, because the launcher leaves it running after the error.
4. File two open items: the template runs the `main` build and not the pinned release, and the run printed no safety mode, so the mode a sandboxed run uses stays unknown, which is conflict C62 in the manual.

## Wrong turns

- "The workspace was mounted read-only." The summary lists it as rw, and the mount table inside the VM agrees. The three read-only mounts are the agent file directory, the staged kit and the config directory, and the database is under none of them.
- "Pin an older template tag." The probe fails for a plain Python script with no agent involved, so the agent build is not the cause. The main build is worth a ticket, not a fix.
- "Move the data directory to the host default." The launcher refuses a data directory outside the writable workspace, before it creates anything.
- "SQLite is missing from the guest." The probe imported the module and opened the database. It failed on the first write.

## Generalize

When a program reports a permission error on a path that the system lists as writable, repeat the operation with the smallest program that performs it, on the same path, outside the product. A failure there moves the fault from the product's settings to the layer under it, and a pass narrows it to the product. Then check whether the product gives you a way around that layer, and if it does not, write down the exact rule that blocks you.

## Taught in

The manual's [end to end run](../../../manuals/docker-sandboxes-101/sections/1-2-docker-agent-run-sandbox-end-to-end.md) records this failure and the probe, [the run page](../../../manuals/docker-sandboxes-101/sections/5-1-docker-agent-run-new-and-doctor.md) explains the state flags, and [the conflicts register](../../../manuals/docker-sandboxes-101/sections/r-7-sources-and-the-conflicts-register.md) keeps conflict C62 open.
