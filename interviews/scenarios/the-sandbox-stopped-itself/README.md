---
id: the-sandbox-stopped-itself
title: The sandbox stopped itself
card: scenarios
kind: incident
level: 1
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, debugging]
tags: [sandbox, lifecycle, auto-stop, daemon-log]
minutes: 15
lessons: []
manuals: [docker-sandboxes-101#s-sbx-run-create-stop-and-rm, docker-sandboxes-101#s-kit-tck-diagnose-and-the-claims-this-manual-checked]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
system:
  version: sbx v0.47.0
  model: none; shell commands inside the sandbox
  hardware: one Mac with the microVM runtime
source:
  - manuals/docker-sandboxes-101/capture/out/04-auto-stop.txt
  - manuals/docker-sandboxes-101/capture/out/04-prune.txt
  - manuals/docker-sandboxes-101/sections/2-1-sbx-run-create-stop-and-rm.md
  - manuals/docker-sandboxes-101/sections/7-4-kit-tck-diagnose-and-the-claims-this-manual-checked.md
---

## Situation

A developer opens a shell sandbox on a repository, starts a long dependency install, and closes the terminal to go to a meeting. An hour later `sbx ls` shows the sandbox with the status `stopped`. The install did not finish, and no error was printed anywhere the developer looked. They conclude that the daemon crashed or that someone removed the sandbox, and they want to recreate it from scratch.

You have the two listings, the daemon log lines for that sandbox, and the output of an explicit stop and a prune from another day.

## Evidence

- [sbx ls before and after the last session closed](evidence/running-then-stopped.txt)
- [the two auto-stop lines of the daemon log for m101-demo](evidence/the-daemon-log.txt)
- [an explicit stop, a prune, and the list after it](evidence/stop-prune-and-the-empty-list.txt)

## Questions

1. Did the sandbox crash, get removed, or stop? Which listing settles it?
2. What do the two daemon log lines say happened, and at what level?
3. What survives a stop, and what does not?
4. How do you get back into this sandbox, and what would prune have done?
5. How do you keep a job running after you disconnect?

## Walkthrough

1. **Read the status.** The first listing shows `running` and the second `stopped`. A removed sandbox is not listed. A crashed daemon could not answer `sbx ls`. The sandbox stopped.
2. **Read the daemon log.** Both lines are `INFO`, not errors. The first says that the auto-stop grace period expired and the runtime is stopping. The second says that the runtime was auto-stopped after the last session disconnected. The trigger was the closed terminal: it was the last session. Each line carries the daemon version, so you know which release did it.
3. **Know what a stop keeps.** The explicit stop prints `state preserved` and the restart command. The manual lists what persists across a stop and a restart: installed packages, Docker images, configuration changes, command history, and workspace files not on a mount. A running process is not on that list, so the install died with the microVM.
4. **Come back the right way.** `sbx run --name m101-demo` reattaches and starts the stopped sandbox. `sbx prune` would have deleted it: in the capture it removed both stopped sandboxes and left an empty list, and `rm` and `prune` also delete the secrets scoped to the sandbox.
5. **Keep it running on purpose.** `sbx run -d` against an existing sandbox keeps it running after the sessions disconnect, until you stop or remove it. A kit can declare the `long-running@1` capability for the same effect. The manual's ledger marks the auto-stop as observed and not documented, so expect no page to warn you.

## Resolution

The daemon stopped the sandbox on purpose after the last session closed and a grace period passed, and its log says so at the INFO level. Nothing crashed and nothing was removed. The developer reattaches with `sbx run --name`, finds the packages that had finished installing still there, and starts the install again. For the next long job they start the sandbox detached, so no session is the last one. Prune stays out of the runbook until a sandbox is wanted gone.

## Wrong turns

- "Run sbx prune to clean up, then create the sandbox again." Prune removes every stopped sandbox, with its state and its secrets. The sandbox you want back is exactly a stopped one.
- "The daemon crashed." It wrote two INFO lines and answered the listing. A crash would have left no second listing.
- "Create a new sandbox with the same name." The name belongs to the stopped one, and a new sandbox would lose the installed state. Reattach instead.

## Generalize

When a thing you started is gone, ask whether it stopped, failed, or was deleted, and read the log of the component that owns its lifecycle before you rebuild anything. A platform that stops idle work on its own will do so again. Find the flag or the capability that marks work as long-running and use it on purpose.

## Taught in

[The lifecycle page](../../../manuals/docker-sandboxes-101/sections/2-1-sbx-run-create-stop-and-rm.md) records the auto-stop and what a stop keeps, and [the claims ledger](../../../manuals/docker-sandboxes-101/sections/7-4-kit-tck-diagnose-and-the-claims-this-manual-checked.md) gives the behaviour the verdict observed, with no vendor page behind it.
