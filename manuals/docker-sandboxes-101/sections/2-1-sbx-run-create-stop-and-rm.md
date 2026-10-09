# sbx run, sbx create, sbx stop, and sbx rm

> `sbx run` creates a sandbox when none exists and attaches to it, `sbx create` only creates, and `stop`, `rm`, and `prune` end a sandbox in three different ways.

You have a repository with two commits and a README, and you want a shell agent to work on it and on nothing else. The capture does that with `sbx create shell $CAPTURE/fixtures/repo --name m101-demo`, where `$CAPTURE` stands for the capture directory, and the rest of this part reuses that sandbox. When you finish this section, you can name the verb that creates, attaches, stops, removes, or prunes a sandbox, and what each one keeps.

## The agent and the workspace

**Agent:** the first positional argument of `sbx run` and `sbx create`, "a built-in agent name or a sandbox kit reference" {{help-sbx sbx run}}. The built-in names are claude, codex, copilot, cursor, devin, docker-agent, droid, gemini, kiro, opencode, and shell. A kit reference is a directory, a ZIP file, a git repository, or an OCI reference, and relative paths "must be explicit paths such as ./my-kit or ../my-kit.zip" {{help-sbx sbx run}}. So `sbx run my-kit` looks for an agent called `my-kit`, and `sbx run ./my-kit` reads a kit, as [the kit descriptor](#s-syntax-docker-sandbox-kit-3-and-kit-yaml) explains.

**Workspace:** the directory after the agent, mounted inside the microVM at the same absolute path. Inside `m101-demo`, `pwd` prints `$CAPTURE/fixtures/repo`, and `mount` lists that path as a `virtiofs` mount. `sbx run` mounts the current directory when you give no path, and `sbx create` without a path makes a sandbox with no mount, where "the agent then works in the container's own filesystem instead of on your files" {{help-sbx sbx create}}. Extra paths follow the first one, and `:ro` mounts one of them read-only. A read-only argument can name a single file, "which holds that one path out of reach inside a workspace the sandbox can otherwise write" {{help-sbx sbx run}}.

```listing
title: the create command and its summary
source: capture/out/04-create.txt
lang: text
note: Nothing is cut. The image layers are masked as <layers>.
---
$ sbx create shell $CAPTURE/fixtures/repo --name m101-demo

sandbox    m101-demo
agent      shell
workspace  $CAPTURE/fixtures/repo (rw)
image      docker/sandbox-templates:shell-docker
cpu        10
memory     32 GiB

Pulling image
  <layers>
✓ Image ready
✓ Created sandbox m101-demo

To connect to this sandbox, run:
  sbx run --name m101-demo
[exit 0]
```

```listing
title: the workspace seen from inside
source: capture/out/04-workspace.txt
lang: text
note: The directory listing and the README text are cut.
---
$ sbx exec m101-demo sh -c 'pwd; echo; ls -la; echo; cat README.md; echo; git log --oneline'
$CAPTURE/fixtures/repo
…
c7dfd56 second
086df68 first
[exit 0]
```

## Names and re-attach

**Name:** the key of a sandbox in every later command, by default `<agent>-<workdir>`, the agent name and the workspace directory name. The rule is "at least two characters, starting with a letter or number, containing only letters, numbers, hyphens and periods (periods are rejected with --cloud); 'default' is reserved" {{help-sbx sbx create}}. Since v0.43.0 the daemon also rejects "names longer than 63 characters or ending in a hyphen or period" {{rel-sbx v0.43.0}}. The 2025 plugin allowed `_` and `+` in a name, and [conflict C25](#s-ref-sources-and-the-conflicts-register) records the change.

Two sandboxes can share one workspace. The capture creates `m101-demo-2` on the same `fixtures/repo`, and `sbx ls --json` lists both as running. A blog post of 2026-03-11 said that Docker enforces one sandbox per workspace {{blog 2026-03-11}}. A talk of 2026-08-13 runs claude and codex on one workspace in two terminals {{talk 2026-08-13}}, and [S27](#s-ref-sources-and-the-conflicts-register) rules that the names decide.

`--name` on `sbx run` re-attaches to an existing sandbox, and then "the agent positional is optional when the named sandbox already exists and is read from its spec" {{help-sbx sbx run}}. Give the agent too, and `sbx run` checks it against the stored one. `sbx create` prints that re-attach command at the end of its output.

```listing
title: two sandboxes on one workspace
source: capture/out/04-second-sandbox.json
lang: json
note: Cut to the name, status, and workspace of each record. The ports of m101-demo belong to the next section.
---
{
  "sandboxes": [
    {
      "name": "m101-demo",
      …
      "status": "running",
      …
      "workspaces": [
        "$CAPTURE/fixtures/repo"
      ],
      …
    },
    {
      "name": "m101-demo-2",
      …
      "status": "running",
      …
      "workspaces": [
        "$CAPTURE/fixtures/repo"
      ],
      …
    }
  ]
}
```

## What is fixed at creation

Some flags act on every attach, and most act once, when the sandbox is created. A re-attach with a different `-p` or `--skills` changes nothing, and the help says so flag by flag.

| Flag | When it applies | Help page |
|---|---|---|
| `-e KEY=VALUE`, `--env-file FILE` | the agent session on every attach, and stored in the sandbox when this run creates it | `sbx run` |
| `--cpus N`, `-m SIZE` | at creation, memory defaults to half of host memory, between 512 MiB and 32 GiB | `sbx create` |
| `-p PORT`, `--deny-network HOST` | at creation, and `-p` is ignored when re-attaching | `sbx run` |
| `--skills MODE`, `--static-mcp NAMES`, `--profile NAME` | at creation only | `sbx run` |
| `-t IMAGE`, `--pull POLICY` | at creation, and `--pull` is `always`, `missing`, or `never`, default `always` | `sbx run` |
| `-d` | prints the sandbox id and exits without a session | `sbx run` |
| `--rm` | removes the sandbox after the agent session exits, new in v0.47.0 | `sbx run` |

The recording Mac gave `m101-demo` `cpu 10` and `memory 32 GiB`, the upper bound of the memory clamp. `--rm` "cannot be combined with --detached" {{rel-sbx v0.47.0}}, because a detached run has no session to end.

## stop, rm, and prune

`sbx stop` keeps the sandbox and ends its microVM. The capture prints `state preserved` with the restart command, and the docs list what persists: "installed packages, Docker images, configuration changes, command history, and mountless workspace files all persist across stops and restarts" {{docs-sbx usage}}. The daemon also stops a sandbox on its own. After the capture closed its last session and waited, `sbx ls` showed `m101-demo` as `stopped`, and `daemon.log` gives the reason.

```listing
title: the daemon stops an idle sandbox
source: capture/out/04-auto-stop.txt
lang: text
note: Cut to the log query and its two lines. The timestamps are masked as <ts>.
---
$ grep auto-stop daemon.log | grep m101-demo | tail -2
{"time":"<ts>","level":"INFO","msg":"auto-stop grace period expired, stopping runtime","version":"v0.47.0 0411f50ee4700fe7bd37e6e7e3aced563e850ca9","runtime":"m101-demo"}
{"time":"<ts>","level":"INFO","msg":"auto-stopped runtime after last session disconnected","version":"v0.47.0 0411f50ee4700fe7bd37e6e7e3aced563e850ca9","runtime":"m101-demo"}
```

`sbx run -d` against an existing sandbox "keeps it running after sessions disconnect, until you stop or remove it" {{docs-sbx release-notes}}, and a kit can declare `com.docker.sandbox/long-running@1` for the same effect, as [the capabilities](#s-com-docker-sandbox-capabilities) show.

`sbx rm` is the opposite of stop. For a local sandbox it "stops them, removes their containers, cleans up any Git worktrees, deletes sandbox state, and deletes secrets scoped to each removed sandbox" {{help-sbx sbx rm}}. `--force` skips the prompt and removes a sandbox with an open SSH connection, and `--all` removes every local sandbox.

`sbx prune` removes stopped sandboxes only, because "a running sandbox is never removed" {{help-sbx sbx prune}}. `--filter until=168h` keeps anything stopped within the last week, and a sandbox whose stop time the daemon cannot report is left alone. `--dry-run --json` shows both sets before you commit.

```listing
title: a dry run after one stop
source: capture/out/04-prune-dry-run.json
lang: json
note: Nothing is cut. m101-demo was still running.
---
{
  "would_remove": [
    {
      "name": "m101-demo-2",
      "agent": "shell",
      "stopped_at": "<ts>",
      "workspaces": [
        "$CAPTURE/fixtures/repo"
      ]
    }
  ],
  "skipped_unknown_stop": []
}
```

```listing
title: the prune that ends the part
source: capture/out/04-prune.txt
lang: text
note: The stop of m101-demo before the prune is cut.
---
$ sbx prune --force
Deleting sandbox m101-demo...
Sandbox 'm101-demo' removed
Deleting sandbox m101-demo-2...
Sandbox 'm101-demo-2' removed
[exit 0]

$ sbx ls --json
{
  "sandboxes": []
}
[exit 0]
```

Both `rm` and `prune` delete the secrets scoped to the sandbox, which [sbx secret](#s-sbx-secret-set-import-and-set-custom) explains. [Figure](#fig-2-1) puts the verbs on the edges of one state machine.

```figure
id: fig-2-1
kind: state
title: the four states of a local sandbox
claim: A sandbox is absent, running, stopped, or removed, and every sbx verb in this section moves it along exactly one edge.
caption: Read left to right. Dashed amber arrows are state changes, the names are the capture's two sandboxes, and the dashed box has no microVM running. From capture/out/04-create.txt, 04-stop.txt, 04-auto-stop.txt, and 04-prune.txt.
```

```takeaways
- Name every sandbox with `--name`, so two agents on one directory stay apart.
- Set memory, ports, skills, and static MCP servers at creation, because a re-attach ignores them.
- Use `sbx stop` to keep state and `sbx rm` to delete it, and run `sbx prune --dry-run` first.
```

Sources: help-sbx sbx run, sbx create, sbx stop, sbx rm, sbx prune (research/sources/help-sbx.md); rel-sbx v0.43.0 and v0.47.0 (research/sources/sbx-releases.md); docs-sbx usage and release-notes (research/sources/docs-sandboxes.md); conflicts C25, S27 (research/conflicts-register.md); capture/out/04-create.txt, 04-workspace.txt, 04-guest.txt, 04-ls.json, 04-second-sandbox.txt, 04-second-sandbox.json, 04-stop.txt, 04-auto-stop.txt, 04-prune-dry-run.json, 04-prune.txt
