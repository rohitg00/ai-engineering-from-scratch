# From docker sandbox and cagent to sbx and docker-agent

> Two renames and one CLI restructure changed every command in the 2025 and early 2026 material, and this section maps each old line to its current form.

A blog post from 2026-02-23 tells you to run `docker sandbox run claude` and to point the proxy at `host.docker.internal:3128`. A talk from 2025-09-24 shows `cagent run agent.yaml` and `cagent push`. On a machine with Docker Desktop 4.94.0, sbx 0.47.0, and docker-agent 1.149.0, neither command exists. When you finish this section, you can map any command from that material to its current form and name the version that changed it.

## Two tracks and three removals

The sandbox product had four lives. The plan's timeline dates a container-based `docker sandbox run` to Docker Desktop 4.50.0 on 2025-11-06, and the preview blog followed on 2025-11-25 {{blog 2025-11-25}}. Desktop 4.58.0 replaced it with microVMs on 2026-01-26 {{docs-desktop 4.58.0}}, and Desktop 4.61.0 bundled plugin v0.12.0 on 2026-02-18 {{docs-desktop 4.61.0}}. That plugin is the one whose help this section quotes. The standalone `sbx` binary had its first public tag, v0.21.0, on 2026-03-31 {{rel-sbx v0.21.0}}. Desktop 4.80.0 then ended the plugin on 2026-06-29:

```rule
label: the removal note
source: docs-desktop 4.80.0
---
"The experimental `docker sandbox` plugin has been removed. Migrate to `docker sbx`."
```

No `docker sbx` command exists in any help tree, and the binary is `sbx` ([conflict C1](#s-ref-sources-and-the-conflicts-register)).

The agent product had three names. It launched as cagent with a blog on 2025-09-18 {{blog 2025-09-18}}, and Desktop 4.49.0 bundled it on 2025-10-23. The Desktop notes for 4.49.0 now read "Docker Agent is now available through Docker Desktop." {{docs-desktop 4.49.0}}, under the current name. The agent docs say "In Docker Desktop versions 4.49 through 4.62, this feature was called cagent." {{docs-agent Installation}}, and the `docker agent` plugin arrived with v1.23.3 on 2026-02-16 {{rel-agent v1.23.3}}.

Version 1.23.4 restructured the commands three days later, and v1.30.0 finished the rename on 2026-03-09 {{rel-agent v1.30.0}}. The docs date Docker Agent in Desktop to 4.63, while the first release note that names it is 4.64.0 with v1.27.1 ([conflict C49](#s-ref-sources-and-the-conflicts-register)). Desktop 4.81.0 removed the deprecated `cagent` binary on 2026-07-06 {{docs-desktop 4.81.0}}. Desktop 4.94.0 bundles Docker Agent v1.144.0 {{docs-desktop 4.94.0}}, five releases behind the v1.149.0 binary this manual pins. Many Desktop notes state no bundled version at all ([conflict C50](#s-ref-sources-and-the-conflicts-register)).

```figure
id: fig-7-3
kind: timeline
title: two product tracks from 2025-09 to 2026-10
claim: Each old name survived its successor for months, and Docker Desktop removed the two of them one week apart, on 2026-06-29 and 2026-07-06.
caption: Read left to right on one date axis. Grey bars are the old names, blue and violet bars the current ones, and rose lines mark the three removals. The numbered key below names each event with its version. From research/sources/docs-desktop-release-notes.md, sbx-releases.md, and docker-agent-CHANGELOG.md.
```

## The old command trees

```listing
title: the docker sandbox plugin, v0.12.0
source: research/sources/help-legacy-docker-sandbox.md
lang: text
note: The root help and the proxy flags, recorded on 2026-10-08 from the plugin that Desktop 4.61.0 bundled. The create, exec, and save sections are cut.
---
Management Commands:
  create      Create a sandbox for an agent
  network     Manage sandbox networking

Commands:
  exec        Execute a command inside a sandbox
  ls          List VMs
  reset       Reset all VM sandboxes and clean up state
  rm          Remove one or more sandboxes
  run         Run an agent in a sandbox
  save        Save a snapshot of the sandbox as a template
  stop        Stop one or more sandboxes without removing them
  version     Show sandbox version information
…
      --bypass-cidr string   Bypass MITM proxy for an IP range in CIDR
                             notation (can be specified multiple times)
      --bypass-host string   Bypass MITM proxy for a domain or IP (can be
                             specified multiple times)
…
      --policy allow|deny    Set the default policy
```

```listing
title: the docker agent plugin, v1.32.4
source: research/sources/help-legacy-docker-agent.md
lang: text
note: The root help and three run flags, recorded on 2026-10-08. The global flags already name the cagent directories.
---
Core Commands:
  new         Create a new agent configuration
  run         Run an agent
  share       Share agents

Advanced Commands:
  alias       Manage aliases
  eval        Run evaluations for an agent
  serve       Start an agent as a server
…
      --sandbox                   Run the agent inside a Docker sandbox (requires Docker Desktop with sandbox support)
…
      --template string           Template image for the sandbox (passed to docker sandbox create -t)
…
      --yolo                      Automatically approve all tool calls without prompting
```

Beside them, the v0.47.0 tree in `capture/out/01-help-sbx.txt` groups `policy`, `secret`, `template`, and `mcp` under Management Commands, and `network` and `save` are gone. The v1.149.0 tree in `capture/out/01-help-docker-agent.txt` adds `setup`, `doctor`, `models`, `toolsets`, `sessions`, `debug`, `sandbox`, and `serve chat`, which [Part 5](#s-docker-agent-run-new-and-doctor) covers.

## The command map

| Old command or habit | Where it appears | Stopped being true | Do this now |
|---|---|---|---|
| `docker sandbox run <agent>` | Desktop docs, blogs, videos | Desktop 4.80.0, 2026-06-29 | `sbx run <agent>` |
| `docker sandbox run --mount-docker-socket kiro` | re:Invent blog, 2025-12-12 | Desktop 4.58.0, 2026-01-26 | nothing: every sandbox has a private Docker Engine |
| `--load-local-template` | Desktop 4.58 to 4.60 | Desktop 4.61, 2026-02-18 | `sbx template load FILE`, then `--pull never -t TAG` |
| `--pull-template missing`, the default | plugin v0.12.0 | v0.21.0, 2026-03-31 | `--pull always`, `missing`, or `never`, default `always` |
| `docker sandbox create cagent .` | plugin v0.12.0, blog 2026-03-11 | Desktop 4.80.0 | `sbx create docker-agent .`, and `cagent` remains an alias |
| `docker sandbox network proxy S --allow-host api.example.com` | legacy docs, blog 2026-02-23 | Desktop 4.80.0 | `sbx policy allow network api.example.com --sandbox S` |
| `--bypass-host`, `--bypass-cidr` | plugin v0.12.0 | Desktop 4.80.0 | no replacement in the v0.47.0 help, see `capture/out/09-bypass-grep.txt` |
| `docker sandbox network log --json` | legacy docs | Desktop 4.80.0 | `sbx policy log S --json` |
| `docker sandbox save S TAG` into host Docker | plugin v0.12.0, blog 2026-02-23 | Desktop 4.80.0 | `sbx template save S TAG -o FILE` into the sandbox runtime's own store |
| `docker sandbox exec -d` | plugin v0.12.0 | sbx | `sbx exec -d` is "not supported" |
| names with `_`, `+`, or `.` | plugin v0.12.0 | v0.43.0, 2026-09-15 | 2 to 63 characters, letters, digits, hyphens, periods, and no periods with `--cloud` |
| a proxy set by hand at `host.docker.internal:3128` | blogs 2026-02-23 and 2026-05-26 | sbx | nothing: the daemon sets `gateway.docker.internal:3128`, see `capture/out/04-env.txt` |
| API keys in `~/.zshrc`, then restart Desktop | tutorials before 2026-07 | v0.35.0, 2026-07-10 | `sbx secret set SERVICE` or `sbx secret import` |
| `sbx run claude --branch` | blog 2026-05-26, videos | v0.31.0, 2026-05-28 | `sbx run claude --clone` |
| kit v1 grammar, `schemaVersion: "1"`, `network.allowedDomains` | blog 2026-08-03 | v2 on 2026-09-09, v3 on 2026-09-24 | v2 `spec.yaml` for `sbx kit`, v3 `kit.yaml` with `# syntax=docker/sandbox-kit:3` |
| `sbx mcp catalog` | docs before 0.45.0 | v0.45.0, 2026-09-21 | `sbx mcp add --url URL` |
| `sbx mcp enable github-official` | product page, 2026-10-07 | never existed | `sbx mcp add`, then `--static-mcp` or `sbx mcp load` |
| `-p 3000:8080` binds IPv4 and IPv6 | before v0.42.0 | v0.42.0, 2026-09-07 | tcp4 by default, write `3000:8080/tcp` for both |
| kits from any registry | before v0.34.0 | v0.34.0, 2026-06-26 | add the prefix to `kit.allowedSources` |
| a relative `--command ./helper` secret source | docs before v0.46.0 | v0.46.0, 2026-09-28 | an absolute path outside writable sandbox mounts |
| Windows 10 | early 2026 | v0.35.0, 2026-07-10 | Windows 11 with Windows Hypervisor Platform |
| Toolkit gateway at `host.docker.internal:8811`, five manual steps | re:Invent blog, 2025-12-12 | v0.38.0, 2026-08-06 | `sbx mcp add` and `sbx mcp load`, the Toolkit gateway is separate |
| "one sandbox per workspace" | blog 2026-03-11 | sbx names default to `<agent>-<workdir>` | `--name` for a second sandbox on one directory, see `capture/out/04-second-sandbox.txt` |
| `cagent run agent.yaml`, `cagent new`, `cagent exec` | 2025 blogs and talks | v1.23.4, 2026-02-19, and Desktop 4.81.0 | `docker agent run`, `docker agent new`, `docker agent run --exec` |
| `cagent push`, `cagent pull`, `cagent acp`, `api`, `mcp`, `a2a` | 2025 blogs | v1.23.4 | `docker agent share push` and `pull`, `docker agent serve acp`, `api`, `mcp`, `a2a` |
| `cagent config`, `feedback`, `build`, `catalog` | 2025 to early 2026 | v1.23.4 | removed, and the catalog is the Hub namespace `agentcatalog/*` |
| `cagent version`, `brew install cagent` | blog 2025-11-13 | v1.30.0 and Desktop 4.81.0 | `docker agent version`, `brew install docker-agent`, `winget install Docker.Agent` |
| "Docker Agent v2.x renamed the CLI" | a third-party tutorial | never true | the latest tag is v1.149.0 |
| `docs.docker.com/ai/cagent/` | blog 2026-03-11, old links | v1.30.0 | `docs.docker.com/ai/docker-agent/` |
| `CAGENT_MODELS_GATEWAY`, `CAGENT_CONFIG_DIR`, `CAGENT_PPROF_ADDR` | older docs and issues | v1.30.0, still accepted | `DOCKER_AGENT_MODELS_GATEWAY`, `DOCKER_AGENT_CONFIG_DIR`, `DOCKER_AGENT_PPROF_ADDR` |
| `docker/sandbox-templates:cagent` | legacy agent page | the rename | `docker/sandbox-templates:docker-agent` |
| `docker cp` the agent binary into a sandbox, then `agent run dev-team.yaml` inside | blog 2026-03-11 | the `docker-agent` template | `sbx run docker-agent .` or `docker agent run --sandbox agent.yaml` |
| `--yolo` | everywhere | still accepted | `--safety autonomous`, of which `--yolo` is the alias |
| the eval judge is a paid Anthropic model | v1.32.4 help | v1.147.0, 2026-10-05 | default `openai/gpt-5.6-terra`, or any `provider/model` |
| `--sandbox` "requires Docker Desktop with sandbox support" | v1.32.4 help | sbx | `--sbx` defaults to true, and `--sbx=false` has no target after Desktop 4.80.0 |
| mcp-gateway v0.22.0 in the GitHub Action | the action's defaults | the repository is at v0.44.1 | pin the gateway version yourself |

The rows restate the register's stale-advice list S1 to S30 and the plugin rows C107 to C112, which [the sources section](#s-ref-sources-and-the-conflicts-register) prints in full.

## What kept the old name

The rename did not touch the directories. `docker-agent --help` still defaults `--data-dir` to `~/.cagent`, `--config-dir` to `~/.config/cagent`, and `--cache-dir` to `~/Library/Caches/cagent` {{help-agent docker-agent}}. The v1.32.4 plugin printed the same three values, and the debug log stays at `~/.cagent/cagent.debug.log` ([conflict C54](#s-ref-sources-and-the-conflicts-register)). The `CAGENT_*` variables are still read next to `DOCKER_AGENT_*` {{rel-agent v1.30.0}}.

The OCI annotation became `io.docker.agent.version` with the old name kept {{rel-agent v1.23.3}}. The Hub image moved from `docker/cagent` to `docker/docker-agent`, and the image keeps `cagent` as a symlink {{rel-agent v1.30.0}}. In `sbx`, `cagent` remains an alias of the `docker-agent` create subcommand {{help-sbx sbx create docker-agent}}.

Sandbox state did not migrate. The plugin kept VM state under `~/.docker/sandboxes/vm/` and an image cache under `~/.docker/sandboxes/image-cache/`, as its own `reset` help says. `sbx` keeps its socket and log under `~/Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/` (capture/out/02-daemon-status.txt), and no page describes a migration ([conflict C17](#s-ref-sources-and-the-conflicts-register)). No capture lists the leftover directories.

On Desktop 4.94.0, `docker info` still lists the plugin as `sandbox v0.13.0` (`29-docker-plugins.txt`), and each of its commands prints the removal notice:

```listing
title: docker sandbox on Docker Desktop 4.94.0
source: capture/out/29-docker-sandbox.txt
lang: text
note: docker sandbox version prints the same notice and is cut.
---
$ docker sandbox --help
"docker sandbox" is deprecated and has been removed.

Please migrate to Docker Sandboxes: https://www.docker.com/products/docker-sandboxes
[exit 1]
```

The notice names the product page, not the `docker sbx` of the 4.80.0 note. On the same host, the bundled `docker agent version` prints v1.144.0 and the Homebrew `docker-agent version` prints v1.149.0 (`29-docker-agent-plugin.txt`).

```takeaways
- Replace `docker sandbox` with `sbx` and `cagent` with `docker agent` before you follow any post from 2025 or early 2026.
- Check the date of a post against the version column before you type its command.
- Inspect `~/.docker/sandboxes/` after Desktop 4.80.0, and make a copy before you remove it, because nothing migrates it.
- Keep `~/.cagent` and `~/.config/cagent` where they are, because the rename left them alone.
```

Sources: docs-desktop 4.49.0, 4.58.0, 4.61.0, 4.64.0, 4.80.0, 4.81.0, 4.94.0 (research/sources/docs-desktop-release-notes.md); rel-agent v1.23.3, v1.23.4, v1.30.0, v1.147.0 (research/sources/docker-agent-CHANGELOG.md); rel-sbx v0.21.0, v0.31.0, v0.35.0, v0.42.0, v0.43.0, v0.45.0 (research/sources/sbx-releases.md); docs-agent Installation (research/sources/docs-docker-agent.md); help-sbx sbx create docker-agent (research/sources/help-sbx.md); help-agent docker-agent (research/sources/help-docker-agent.md); research/sources/help-legacy-docker-sandbox.md; research/sources/help-legacy-docker-agent.md; blog 2025-09-18, 2025-11-25, and research/conflicts-register.md rows C1, C17, C49, C50, C54, C107 to C112, S1 to S30; research/plan.md (the timeline); capture/out/01-help-sbx.txt, 01-help-docker-agent.txt, 02-daemon-status.txt, 04-env.txt, 04-second-sandbox.txt, 09-bypass-grep.txt, 29-docker-sandbox.txt, 29-docker-plugins.txt, 29-docker-agent-plugin.txt
