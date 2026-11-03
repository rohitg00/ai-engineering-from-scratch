---
id: clone-mode-and-the-hidden-hook
title: A clean diff and a new pre-commit hook
card: sandboxes
kind: debug
level: 2
roles: [agentic-ai-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, system-design]
tags: [sandbox, workspace, clone-mode, git, supply-chain]
minutes: 8
lessons: []
manuals: [docker-sandboxes-101#s-clone-and-run-sandbox-source]
practice: []
cheatsheet: [docker-sandboxes, coding-agents]
related: [sandboxes/hypervisor-is-the-boundary]
updated: 2026-11-03
---

You let an agent work on a repository overnight in a sandbox with the default workspace mount. In the morning `git diff` is clean and a new file sits in `.git/hooks/pre-commit`. Explain how the agent wrote a file that no diff shows, which workspace mode prevents it, and how the agent's commits still reach you under that mode.

## Short answer

The default mount is the host path mounted read-write inside the VM at the same absolute path, so the agent can edit anything in the tree, including Git hooks, CI configuration, `package.json` scripts and agent settings, and a hook under `.git/hooks` never appears in `git diff`. `--clone` at creation runs the agent on a private clone while the host repository enters the VM read-only at `/run/sandbox/source`, so a push back is refused. The commits come home through a git daemon in the VM that `sbx` publishes on a loopback port and registers as the remote `sandbox-<name>` in the host repository, so you fetch that remote before you remove the sandbox.

## Full answer

### Three workspace modes

| Mode | What the agent sees | What it can change on the host |
|---|---|---|
| direct mount | the host directory at the same path, `virtiofs`, read-write | everything in the tree, hooks included |
| mountless | the template's working directory, `/home/agent/workspace` | nothing |
| `--clone` | a private clone at the same path on its own ext4 volume, `origin` at `/run/sandbox/source` | nothing; the source mount is read-only |

Extra paths follow the first one, and `:ro` makes one read-only, even a single file. `sbx run` with no path mounts the current directory, which is the trap in the question.

### What the recorded clone run showed

Inside, `touch /run/sandbox/source/x` failed with `Read-only file system`, and a `git push` to `origin` ended with `remote unpack failed`. The git daemon listens on 9418 inside, and the CLI writes two fetch refspecs into the host's `.git/config`, so one fetch updates `refs/remotes/sandbox-<name>/<branch>` and `refs/sandboxes/<name>/<branch>`. `sbx rm` removes the remote and the daemon and prints the recovery command, and the `refs/sandboxes` copy from the earlier fetch survived the removal. `sbx stop` stops the daemon, and a restart assigns a new port and rewrites the remote URL.

### What clone mode does not do

It stops writes, not reads. An untracked `.env` under the repository is readable inside the clone, so keep secrets out of a repository you clone into a sandbox. The flag replaced `--branch` in v0.31.0 and is a no-op on re-attach, so the decision is made at `sbx create`.

## Follow-ups

- **Level 2:** Can you switch an existing sandbox to clone mode? Expected: no; the mode is fixed at creation and the flag does nothing on re-attach, so remove and recreate.
- **Level 3:** The agent committed on `main` inside. Where is that commit on the host after a fetch? Expected: on `refs/remotes/sandbox-<name>/main` and `refs/sandboxes/<name>/main`, not on the host's own `main`.
- **Level 3:** You fetched once, then removed the sandbox. What can you recover? Expected: the fetched commits; `refs/sandboxes/<name>/<branch>` survives and `git branch <local> refs/sandboxes/<name>/<branch>` recovers it. Commits made after the last fetch go with the clone, so fetch before `sbx rm`.
- **Level 4:** Which risk does clone mode leave open, and how do you close it? Expected: reading; untracked files such as `.env` are visible through the read-only mount, so keep them outside the repository or mount a narrower path.

## Wrong answers

- "`git status` would have shown the hook." Files under `.git/` are not part of the working tree; neither `status` nor `diff` lists them.
- "Mount the repository `:ro` and let the agent commit." A read-only mount blocks the agent's own commits too; clone mode gives it a writable clone and keeps the host read-only.
- "Use `--branch` so the agent works on a branch." That flag was removed and now fails with a hint to use `--clone`.

## Taught in

The [clone mode section](../../../manuals/docker-sandboxes-101/sections/3-2-clone-and-run-sandbox-source.md) records the refused push, the two refspecs and the surviving refs.
