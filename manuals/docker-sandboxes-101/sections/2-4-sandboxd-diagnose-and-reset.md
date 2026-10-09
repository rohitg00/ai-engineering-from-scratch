# sandboxd, sbx diagnose, and sbx reset

> One daemon owns every sandbox, its socket and log live under one state directory, and two commands check that daemon and wipe it.

`sbx ls` hangs, or a command fails with `ensure daemon: daemon exited unexpectedly`, and you need to know which process answers, where it writes, and how to start over. Every verb in this part talks to one host daemon, `sandboxd`, over a Unix socket. When you finish this section, you can find the socket and the log, read the thirteen checks of `sbx diagnose`, and say what `sbx reset` deletes.

## sandboxd

**sandboxd:** the host daemon behind every local `sbx` verb, managed with `sbx daemon start`, `stop`, `restart`, `status`, and `log-level set`. The settings commands "use the local daemon to read evaluated values and manage overrides, starting it if necessary" {{help-sbx sbx settings}}, and the first probe of `sbx settings list` printed `Starting sandboxd daemon...` before its table. `sbx daemon start -d` runs it in the background. `--policy allow-all`, `balanced`, or `deny-all` initializes the global network policy at the same time, which [sbx policy init](#s-sbx-policy-init-allow-deny-and-check-network) covers. `sbx daemon log-level set TARGET LEVEL` changes one log category, `proxy`, `general`, or `all`.

`sbx daemon status --json` names the socket and the log, both under `~/Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/` on the recording Mac, where `$HOME` is a capture mask.

```listing
title: where the daemon listens and writes
source: capture/out/02-daemon-status.json
lang: json
note: Nothing is cut.
---
{
  "status": "running",
  "socket": "$HOME/Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/sandboxd.sock",
  "logs": "$HOME/Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/daemon.log"
}
```

The log is JSON lines with `time`, `level`, `msg`, `version`, and often a `runtime`, the sandbox name, and [the lifecycle section](#s-sbx-run-create-stop-and-rm) reads two of them. Since v0.43.0 "The local daemon now verifies connecting operating-system users on Unix sockets and Windows named pipes" {{rel-sbx v0.43.0}}, and since v0.46.0 "Starting a second daemon against a state directory already in use fails with an error instead of disrupting the running daemon" {{docs-sbx release-notes}}.

## The state directory

**State directory:** the tree where sandboxd keeps sandboxes, images, policies, and its socket. On macOS it is `~/Library/Application Support/com.docker.sandboxes/`, on Windows `%LOCALAPPDATA%\DockerSandboxes`, and on Linux the state "is spread across three directories" {{docs-sbx Removing all state}}: `~/.local/state/sandboxes/`, `~/.cache/sandboxes/`, and `~/.config/sandboxes/`. Release v0.29.0 added the `SANDBOXES_STORAGE_ROOT` override {{rel-sbx v0.29.0}}, and v0.31.0 moved "the state directory symlink from /tmp to ~/.sbx/run/" {{rel-sbx v0.31.0}}. The daemon binds its containerd socket under that symlink. The `sbx kit builder history` help pages, captured in a shell that could not bind sockets, end in "failed to create unix socket on $HOME/.sbx/run/d/containerd/containerd.sock.ttrpc" {{help-sbx sbx kit builder history}}.

Two more trees matter: the shared skills store at `sandboxes/agent-skills` under the state directory {{docs-sbx agent-skills}}, and the audit log under `~/Library/Logs/com.docker.sandboxes/sandboxes/auditkit/`, where "Files are named audit-<utc-timestamp>-<process-uuid>-<seq>.jsonl" {{docs-sbx audit}}. The 2025 plugin kept its VMs under `~/.docker/sandboxes/vm/` and its images under `~/.docker/sandboxes/image-cache/`, which [the migration section](#s-from-docker-sandbox-and-cagent-to-sbx-and-docker-agent) maps. [Figure](#fig-2-3) draws the macOS tree, and [the settings table](#s-ref-settings-keys-environment-variables-and-paths) lists every path for the three systems.

```figure
id: fig-2-3
kind: tree
title: the sandboxd state directory on macOS
claim: Everything sandboxd owns on macOS sits under one Application Support directory, with the audit log under Logs and a symlink at ~/.sbx/run.
caption: Read top down. Solid lines are containment, the dashed line is the symlink, and the grey dashed box is the 2025 plugin's tree, deleted by docker sandbox reset. From capture/out/02-daemon-status.json, research/sources/docs-sandboxes.md, help-sbx.md, and sbx-releases.md.
```

## sbx diagnose

`sbx diagnose` runs thirteen checks in four groups and prints a pass, a warning, or a failure for each. Installation finds the binary, its version, the daemon, and a diagnostics bundle. Platform confirms `kern.hv_support is 1` and finds `mkfs.erofs` with its default block size and the guest kernel page size. Storage checks the state directory, its permissions, and the free space. Connection checks the version match, the socket, the SSH client config, and the sign-in.

The page-size check exists because v0.43.0 made diagnose warn "if its default block size exceeds the sandbox kernel's page size" {{rel-sbx v0.43.0}}. On the recording Mac the block size is 4096 bytes and the guest page size is 16384 bytes, which `getconf PAGESIZE` inside `m101-demo` confirms.

```listing
title: the two platform checks and the summary
source: capture/out/02-diagnose.json
lang: json
note: Cut to the Virtualization and mkfs.erofs checks and the summary. The byte counts are masked as <n>.
---
{
  "version": "1.0",
  "checks": [
    …
    {
      "name": "Virtualization",
      "status": "pass",
      "message": "supported",
      "detail": "kern.hv_support is 1",
      "hint": ""
    },
    {
      "name": "mkfs.erofs",
      "status": "pass",
      "message": "found",
      "detail": "/opt/homebrew/Caskroom/sbx/0.47.0/Sbx.app/Contents/libexec/mkfs.erofs, default block size <n> bytes, guest kernel page size <n> bytes",
      "hint": ""
    },
    …
  ],
  "summary": {
    "pass": 13,
    "warn": 0,
    "fail": 0,
    "skip": 0
  }
}
```

`--json` gives a `version`, a `checks` array with `name`, `status`, `message`, `detail`, and `hint`, and a `summary` with `pass`, `warn`, `fail`, and `skip` counts. `-o github-issue` formats the same report for a bug report, and `--upload` sends a bundle to Docker support. `diagnostics.autoUpload` in [sbx settings list](#s-sbx-settings-list) is the consent for automatic uploads.

## sbx reset

`sbx reset` returns the install to a freshly installed state, and the help lists the steps {{help-sbx sbx reset}}:

- stop running sandboxes, with a 30 s timeout
- clear the image cache and the internal registries
- delete all sandbox state and all policies
- remove the managed SSH configuration
- clear "the Gordon assistant's sessions and history" {{help-sbx sbx reset}}
- delete stored secrets, unless `--preserve-secrets`
- sign out, stop the daemon, and remove the state, cache, and config directories

The docs give Gordon no role in a sandbox, so this manual quotes that line and claims nothing more, as [conflict C33](#s-ref-sources-and-the-conflicts-register) rules. The docs reach for the command after an upgrade: "A newer version of sbx upgraded the local database to a schema that older binaries don't understand" {{docs-sbx sbx reset}}, and `--preserve-secrets` keeps your secrets through that. The last resort is to delete the state directory by hand after `sbx reset`. Your workspaces stay where they are. The docs say host workspace files "remain on your host" when a sandbox is removed, and `sbx reset` lists only state, cache, and config directories. Commands that help text names but the help tree does not list, such as `sbx mount`, are collected in [sbx settings list](#s-sbx-settings-list).

```takeaways
- Run `sbx daemon status --json` first, and open the `daemon.log` it names.
- Read `sbx diagnose --json` before you file an issue, and attach the `-o github-issue` output.
- Run `sbx reset --preserve-secrets` after a schema upgrade, and expect every sandbox and policy to go.
```

Sources: help-sbx sbx daemon, sbx daemon start, sbx daemon log-level set, sbx diagnose, sbx reset, sbx settings, sbx kit builder history (research/sources/help-sbx.md); rel-sbx v0.29.0, v0.31.0, v0.43.0 (research/sources/sbx-releases.md); docs-sbx release-notes, Removing all state, agent-skills, audit, usage (research/sources/docs-sandboxes.md); research/sources/probes/sbx-diagnose.txt, sbx-settings-list.txt; help-legacy-docker-sandbox.md (docker sandbox reset); conflict C33 (research/conflicts-register.md); capture/out/02-daemon-status.json, 02-daemon-status.txt, 02-diagnose.json, 02-diagnose.txt, 04-auto-stop.txt, 04-guest.txt
