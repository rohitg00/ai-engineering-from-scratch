# --clone and /run/sandbox/source

> Bind mode gives the agent your files, `:ro` and mountless modes give it less, and `--clone` gives it a private clone whose commits come back through a git remote.

You let an agent work on a repository overnight. In the morning `git diff` is clean, and a new file sits in `.git/hooks/pre-commit`, where no diff ever shows it. The three workspace modes decide how much of your tree the agent can write. With `--clone` it can write none of it.

When you finish this section, you can pick a workspace mode for a repository and fetch an agent's commits out of a clone-mode sandbox.

## Three workspace modes

**Direct mount:** the workspace path mounted inside the VM at the same absolute path, read-write {{help-sbx sbx create claude}}. In `m101-demo` the agent's `pwd` is `$CAPTURE/fixtures/repo`, the same string as on the host, and `git log` lists the host commits `c7dfd56 second` and `086df68 first` (capture/out/04-workspace.txt). The mount is virtiofs, as [the microVM boundary](#s-sbx-diagnose-and-the-microvm-boundary) showed, and the file synchronization of the legacy plugin is gone ([conflict C5](#s-ref-sources-and-the-conflicts-register)). Extra paths follow the first one, and `:ro` makes one read-only: "a read-only argument may name a single file, which holds that one path out of reach inside a workspace the sandbox can otherwise write" {{help-sbx sbx create claude}}.

**Mountless:** no path on `sbx create`, so the VM has no host bind mount. The agent works in the template's working directory, `/home/agent/workspace` for Docker's templates {{docs-sbx Workspace isolation}}. `m101-policy` was created that way, and `sbx create` printed `workspace none · no workspace bind mount` (capture/out/09-create.txt). `sbx run` without a path mounts the current directory instead, which [sbx run, create, stop, and rm](#s-sbx-run-create-stop-and-rm) warns about.

Direct mode needs a review step. The docs list what the agent can edit, including Git hooks, CI configuration, `package.json` scripts, and `.claude/settings.json`, and they warn that hooks "don't appear in `git diff` output" {{docs-sbx Workspace isolation}}. A Docker Captain described this covert channel on 2026-05-26, and it is the reason clone mode exists {{blog 2026-05-26 B16}}.

## Clone mode

**--clone:** a create-time flag that makes the agent "Run the agent on a private in-container clone of the host Git repository (mounted read-only)" {{help-sbx sbx create}}. It replaced `--branch` in v0.31.0, and `--branch` now fails with `--branch is no longer supported; use --clone instead` {{rel-sbx v0.31.0}} ([conflict C6](#s-ref-sources-and-the-conflicts-register)). The flag is a no-op when you re-attach to an existing clone-mode sandbox {{help-sbx sbx run}}. The capture created `m101-clone` with it:

```listing
title: creating a clone-mode sandbox
source: capture/out/08-clone-create.txt
lang: text
note: The image pull and the second sbx ls row are cut.
---
$ sbx create --clone shell $CAPTURE/fixtures/repo-clone --name m101-clone
✓ Git repository detected: $CAPTURE/fixtures/repo-clone
…
  Git daemon: git://127.0.0.1:<port>/repo-clone
  Remote: sandbox-m101-clone
✓ Created sandbox m101-clone
  mount  $CAPTURE/fixtures/repo-clone → /run/sandbox/source (ro, source)
…
SANDBOX      AGENT   STATUS    PORTS                        WORKSPACE
m101-clone   shell   running   127.0.0.1:<port>->9418/tcp4   $CAPTURE/fixtures/repo-clone
```

Inside, three facts stand out (capture/out/08-clone-inside.txt). The clone sits at the same path, `$CAPTURE/fixtures/repo-clone`, on `/dev/vde`, an ext4 volume, and its `origin` is `/run/sandbox/source`. The source mount is `host on /run/sandbox/source type virtiofs (ro,nosuid,nodev,relatime)`, and `touch /run/sandbox/source/x` fails with `Read-only file system`. A commit made inside, `81e11df from sandbox`, cannot be pushed to `origin` either: `git push` ends with `remote unpack failed: unable to create temporary object directory` (capture/out/08-clone-commit.txt). The docs name the limit: clone mode "protects your host repository from modification" {{docs-sbx Clone mode}}, and inspection stays open, so an untracked `.env` under the repository is readable inside.

## Getting commits back

The git-daemon in the VM listens on 9418, and sbx publishes it on a loopback port. The CLI then writes a remote into the host repository's `.git/config`:

```listing
title: the sandbox remote on the host, before and after a fetch
source: capture/out/08-clone-host.txt
lang: text
note: The core.* config lines, the ls-remote output, and the fetch warning are cut.
---
$ git -C $CAPTURE/fixtures/repo-clone remote -v
sandbox-m101-clone	git://127.0.0.1:<port>/repo-clone (fetch)
sandbox-m101-clone	git://127.0.0.1:<port>/repo-clone (push)
…
file:.git/config	remote.sandbox-m101-clone.fetch=+refs/heads/*:refs/remotes/sandbox-m101-clone/*
file:.git/config	remote.sandbox-m101-clone.fetch=+refs/heads/*:refs/sandboxes/m101-clone/*
…
$ git -C $CAPTURE/fixtures/repo-clone fetch sandbox-m101-clone
…
   c7dfd56..81e11df  main       -> sandbox-m101-clone/main
   c7dfd56..81e11df  main       -> refs/sandboxes/m101-clone/main
…
81e11df from sandbox
c7dfd56 second
086df68 first
```

Two fetch refspecs mean one fetch updates two places: `refs/remotes/sandbox-m101-clone/main` and `refs/sandboxes/m101-clone/main`. `sbx rm` removes the remote and the daemon and prints the recovery command `git branch <local-name> refs/sandboxes/m101-clone/<branch>`. In the capture, `refs/sandboxes/m101-clone/main` survived the removal (capture/out/08-clone-rm.txt). `sbx stop` stops the daemon, and a restart assigns a new port and rewrites the remote URL {{docs-sbx Use Git with sandboxes}}. The `/root/.config/git/attributes` warning in the fetch output comes from the daemon's user inside the VM and changes nothing. `sbx kit add` keeps the clone "via a named workspace volume" {{help-sbx sbx kit add}}, which is the ext4 device above, and `sbx rm` "cleans up any Git worktrees" {{help-sbx sbx rm}}.

[Figure](#fig-3-2) follows one commit from the clone to the host refs.

```figure
id: fig-3-2
kind: flow
title: one commit from the clone to the host
claim: The host repository enters the VM read-only at /run/sandbox/source, the agent commits to a private clone, and git-daemon serves that clone back as a host remote.
caption: Read from the host repository across to the clone and back down to the host refs. Solid teal arrows are the fetch that writes two refs. The dashed rose arrow is the push that the read-only mount refuses. From capture/out/08-clone-inside.txt, 08-clone-commit.txt, and 08-clone-host.txt.
```

```takeaways
- Use `--clone` for any agent you would not trust with `.git/hooks` and build scripts.
- Decide the mode at `sbx create`, because `--clone` cannot be added to an existing sandbox.
- Fetch `sandbox-<name>` before `sbx rm`, or recover branches from `refs/sandboxes/<name>/*`.
- Keep `.env` out of a cloned repository, because the read-only mount still exposes it.
```

Sources: help-sbx sbx create, sbx create claude, sbx run, sbx rm, sbx kit add (research/sources/help-sbx.md); docs-sbx Isolation layers, Architecture, Use Git with sandboxes, Usage (research/sources/docs-sandboxes.md); rel-sbx v0.31.0 (research/sources/sbx-releases.md); research/conflicts-register.md rows C5, C6; blog B16 (2026-05-26) from research/plan.md; capture/out/04-workspace.txt, 08-clone-create.txt, 08-clone-inside.txt, 08-clone-commit.txt, 08-clone-host.txt, 08-clone-rm.txt, 09-create.txt
