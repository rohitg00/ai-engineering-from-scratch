# Sources and the conflicts register

> Two help trees, one schema, one kit specification, the vendored docs, the release notes, and one capture kit, with a ruling for every conflict a section touches.

The pin is sbx 0.47.0 and docker-agent 1.149.0 (manual.json). The agent file schema is at version 16, and the Sandbox Kit Spec at milestone v3.0.0-m.8. The pin date is 2026-10-07, and the facts were verified on 2026-10-08. Every file named below lives under `research/sources/`, and `research/sources/README.md` records its origin, commit, line count, and license.

## The pin

| Item | Value |
|---|---|
| sbx | v0.47.0, commit `0411f50ee4700fe7bd37e6e7e3aced563e850ca9`, Homebrew cask, released 2026-10-05 |
| docker-agent | v1.149.0, Homebrew build, tag commit `bf4169cdd31229d52385410c52c3dcc59b497858`, released 2026-10-07 |
| agent file schema | version 16, the `agent-schema.json` at the v1.149.0 tag |
| Sandbox Kit Spec | v3.0.0-m.8, tag commit `129be2ff45e8f9463450eb3cf04ddcb52c2b76e5`, 2026-10-02, a pre-release |
| docs.docker.com | 252 pages served 2026-10-08, source repository docker/docs at `2c8a358489b56cd24069cc9e3a3d9a7b376dcfe7` |
| capture machine | one Mac, macOS, with the probes recorded between 06:55Z and 06:58Z on 2026-10-08 |

## The ranked sources

When two sources disagree, the higher one wins and the section says so. The table repeats the ranking of manual.json with the citation keys of `quoteSources`.

| Rank | Source | Cited as | Used for |
|---|---|---|---|
| 1 | the help text that sbx 0.47.0 and docker-agent 1.149.0 print | `help-sbx`, `help-agent` with the command | every command, flag, default, and path |
| 2 | the agent file schema at v1.149.0 | `schema` with the definition | every key, type, and default of the agent file |
| 3 | Sandbox Kit Spec v3 at tag v3.0.0-m.8 | `kitspec` with the section, `kitspec-main` for unreleased changes, `kitcap` for a capability page | the kit descriptor and each capability |
| 4 | the Docker documentation, fetched 2026-10-08 | `docs-sbx`, `docs-agent`, `docs-dmr`, `docs-mcp`, `docs-sbx-api`, `docs-desktop` with the page | rules and limits the help text does not state |
| 5 | the release notes | `rel-sbx`, `rel-agent` with the version | when a behaviour appeared, changed, or was removed |
| 6 | Docker blog posts and talks, through the research files | `blog`, `talk` with a date, declared `null` | history and positioning only, never a rule |
| 7 | the capture kit | the file under `capture/out/` | every command output, file, and record shown |

## The vendored files

| File | Origin | Commit, tag, or version |
|---|---|---|
| `help-sbx.md`, `help-sbx-cloud.md` | the full `sbx --help` tree and `sbx --cloud --help`, program output | sbx v0.47.0 `0411f50ee4700fe7bd37e6e7e3aced563e850ca9` |
| `help-docker-agent.md` | the full `docker-agent --help` tree | docker-agent v1.149.0, Commit: Homebrew |
| `help-legacy-docker-sandbox.md`, `help-legacy-docker-agent.md` | the `docker sandbox` and `docker agent` plugin trees, kept for comparison | plugin v0.12.0 `f13b3c1a96a8be40b06473bb3db0c26dbfe1878c`, plugin v1.32.4 `bd55840ec12b55874dd9fccf88912f9b6bb3e3f3` |
| `agent-schema.json` | docker/docker-agent `agent-schema.json` | tag v1.149.0 `bf4169cdd31229d52385410c52c3dcc59b497858` |
| `docker-agent-CHANGELOG.md` | docker/docker-agent `CHANGELOG.md`, newest entry v1.149.0, no v1.146.0 entry | tag v1.149.0 `bf4169cdd31229d52385410c52c3dcc59b497858` |
| `docker-agent-README.md` | docker/docker-agent `README.md` | main `7a69c316f03c635d8d1951bc4677c59b47beedc7` |
| `SPEC-v3-at-v3.0.0-m.8.md` | docker/sandbox-kit-spec `docs/spec/SPEC-v3.md` at the tag | tag v3.0.0-m.8 `129be2ff45e8f9463450eb3cf04ddcb52c2b76e5` |
| `SPEC-v3.md`, `kit-capabilities.md`, `kit-spec-extras.md`, `kit.schema.json` | the same specification on main, 20 capability pages, the README and governance files, and the kit schema | main `4be7f4dff4d647f10c51dcdb392ce3fa18dc3e96`, 2026-10-07 |
| `docs-sandboxes.md` | 79 pages under `/ai/sandboxes/` | docker/docs main `2c8a358489b56cd24069cc9e3a3d9a7b376dcfe7`, served 2026-10-08 |
| `docs-docker-agent.md` | 108 pages under `/ai/docker-agent/` | the same |
| `docs-model-runner.md`, `docs-mcp.md`, `docs-compose-models.md`, `docs-sandboxes-api.md`, `docs-desktop-release-notes.md` | 8, 10, 3, 44 pages, and the Desktop release notes to 4.94.0 | the same |
| `sbx-releases.md` | the GitHub releases of docker/sbx-releases, stable tags v0.21.0 to v0.47.0 only, bodies not kept | API read 2026-10-08, repository main `2329d12106fee653c0890152947fdd827e00cfd0` |
| `mcp-gateway-README.md`, `model-runner-README.md`, `compose-for-agents-README.md` | the README of each repository | main `a34df45d4ec0e941a9853ad768c4f6cd818966b3`, `ed3e67a8205b8d068b9c65b30d3708132a231bba`, `bfd4fe952591495af757a1a737c7eacc78c75c15` |
| `probes/` | 21 read-only command runs with timestamps and exit codes | sbx v0.47.0, docker-agent v1.149.0, 2026-10-08 |

The sbx help text and release notes are proprietary program output of Docker Inc., quoted as short quotations. The repositories docker/docker-agent, docker/sandbox-kit-spec, docker/docs, and docker/model-runner are Apache-2.0. The repository docker/mcp-gateway is MIT, and docker/compose-for-agents is Apache-2.0 or MIT (research/sources/LICENSES.md).

## The conflicts register

`research/conflicts-register.md` holds 112 conflicts, C1 to C112, in nine groups, and 30 pieces of stale advice, S1 to S30. The table below keeps every C row that a section entry of the plan cites or whose ruling names a section. That is 84 rows, each with the ruling the manual follows. The 28 rows that no section uses are cut to keep the table short, and the next table names them by group. Their substance appears in the S rows below or in the register itself. Kind is the register's own label.

| Group | Rows cut |
|---|---|
| A, sbx | C1, C2, C3, C5, C6, C8, C10, C11, C14, C22, C23, C24, C30 |
| B, docker-agent | C55, C57, C74 |
| C, Docker Model Runner | C78, C80, C81, C82, C85 |
| D, MCP gateway and Toolkit | C86, C87 |
| E, Compose | C94, C95, C97 |
| F, Offload | C100 |
| G, Cloud Sandboxes | C102 |

| Id | Kind | What disagrees | Ruling |
|---|---|---|---|
| C4 | talk vs docs | libkrun or Firecracker as the VMM, against a VMM Docker wrote | A VMM Docker wrote, on Hypervisor.framework, WHP, and KVM. libkrun stays unverified |
| C7 | removed | API keys exported in the shell, against the secret store since v0.35.0 | Secrets come from the secret store. `-e KEY` is a plain variable, not a secret |
| C9 | docs vs CLI | five to nine agent names in blogs, against 11 in `sbx run --help` | The 11 names of the help, the 8 `create` subcommands, and `cagent` as an alias |
| C12 | docs vs repo | a 512 MB default kit volume, against 20 GiB in the spec docs | Both numbers with their sources, no single default |
| C13 | docs vs CLI | v1, v2, and v3 kits, against `sbx kit` commands that name only v1 and v2 | The `sbx kit` artifact commands are v1 and v2 tooling. A v3 kit is an OCI image built with Docker tooling |
| C15 | community vs docs | no Docker Desktop needed, against a required sign-in | Both true. No Desktop, but a Docker account sign-in |
| C16 | undocumented | `sbx mount`, `sbx ssh proxy`, `sbx policy approval`, `--model`, `--provider`, `--usb` in text, absent from the tree | Only what `--help` prints, and one note on the hidden names |
| C17 | undocumented | plugin-era state directories, against the sbx state directory | No state migration exists |
| C18 | docs vs CLI | `platform.allowExperimentalFeatures` default `false` in the docs, `true` in the CLI | The value and SOURCE column from the capture |
| C19 | docs vs CLI | `feature.*` keys in the docs, absent from `sbx settings list` | Only keys the CLI returns, plus a note on the documented ones |
| C20 | undocumented | four `ssh.*` keys in the CLI, absent from the docs: `ssh.autoCreate`, `ssh.defaultAgent`, `ssh.defaultTemplate`, and `ssh.workspaceRoot` | Included, with the full descriptions of `sbx settings list --json` |
| C21 | docs vs CLI | 11 built-in secret services in the docs, 13 in the CLI | 13 services |
| C25 | renamed | the plugin name rule, against the sbx rule | The sbx rule: 2 to 63 characters, letters, digits, hyphens, periods, `default` reserved |
| C26 | undocumented | `host.docker.internal:3128` or `gateway.docker.internal:3128`, against docs with no address | The address and variables the capture shows |
| C27 | blog stale | UDP and ICMP blocked for good, against UDP behind `feature.udp-egress` | UDP rules exist behind the experimental flag. ICMP is blocked. DNS is policy-controlled |
| C28 | experimental | filesystem policies in `ls` and audit, against `policy log` that does not support them | Filesystem rules list but do not log in v0.47.0 |
| C29 | talk vs docs | near-instant start, against seconds | The manual's own timing on one machine, no vendor number |
| C31 | removed | `docker sandbox exec -d`, against `sbx exec -d` not supported | Said so in 2.2 |
| C32 | renamed | `docker sandbox save` into the host daemon, against the runtime image store | Said so in 2.3 and the migration table |
| C33 | undocumented | Gordon runs on the host, against `sbx reset` clearing Gordon sessions | The help line, nothing more |
| C34 | community vs docs | header matching rules for custom secrets, against `--header` and `--format` cloud only | The captured request on the receiver. `--header` and `--format` cloud only |
| C35 | docs vs CLI | `proxy-managed` sentinels, against `GHO_SBX_PROXY_MANAGED` and `docker-placeholder-value` | The captured values |
| C36 | docs vs docs | cloud needs 0.45.0, against 0.45.1 | 0.45.1 |
| C37 | undocumented | audit JSONL needs 0.39.0, against no word on subscriptions | What the directory holds after the runs |
| C38 | removed | relative `--command` helpers, against a fresh temporary directory since v0.46.0 | Absolute helper paths outside writable mounts |
| C39 | removed | `-p` binds both loopbacks, against `tcp4` since v0.42.0 | The `tcp4` rule |
| C40 | removed | kits from any registry, against `kit.allowedSources` since v0.34.0 | The setting is changed for a local registry and the error without it is shown |
| C41 | removed | global rules only, against per-sandbox policies since v0.29.0 | The two scopes `global` and `local` |
| C42 | docs vs CLI | `ssh <name>.sbx` through a managed block, against `sbx setup ssh` details | The help text facts |
| C43 | docs vs CLI | templates and kits as different things, against a kit as the positional agent | Three words defined once in 2.1 |
| C44 | undocumented | the TUI as the dashboard, against `sbx` with no command | Both entry points |
| C45 | community vs docs | 16K guest pages, against the `sbx diagnose` line | The diagnose line |
| C46 | docs vs CLI | `sbx kit ls`, against `unknown command` | The ten `sbx kit` subcommands the help lists |
| C47 | docs vs CLI | the same verbs with `--cloud`, against hidden and cloud-only verbs | Each verb marked local, cloud, or both |
| C48 | docs vs CLI | plugin v1.32.4, against the Homebrew v1.149.0 | v1.149.0 from Homebrew, both versions captured |
| C49 | docs vs docs | Docker Agent in Desktop 4.63, against the first release note at 4.64.0 | 4.63 per the docs, first note 4.64.0 |
| C50 | undocumented | a stated bundle per Desktop release, against releases that state none | A footnote in 7.3 |
| C51 | renamed | `cagent` commands and docs, against `docker agent` and `/ai/docker-agent/` | Migration rows S5 to S9 |
| C52 | removed | `cagent config`, `feedback`, `build`, `catalog`, `exec`, against the v1.23.4 restructure | Migration rows S6 and S7 |
| C53 | renamed | `CAGENT_*` variables, against `DOCKER_AGENT_*` since v1.30.0 | The new names with the legacy aliases |
| C54 | renamed | a complete rename, against directories still named `cagent` | The paths as they are |
| C56 | docs vs repo | `handoff` and `transfer_task` as types, against 27 types without them | Not a type. Separate rows marked implicit |
| C58 | renamed | `fireworks`, `together`, `moonshot`, `opencode-zen`, against canonical ids | Canonical ids with an alias column |
| C59 | renamed | `--yolo` as the way, against `--safety autonomous` | `--safety autonomous`, with `--yolo` as its alias |
| C60 | docs vs CLI | `--sandbox` needs Desktop, against `--sbx` default true | `--sbx=false` has no working target on Desktop 4.80.0 or later |
| C61 | docs vs docs | `docker/docker-agent-sbx-templates:latest`, against `docker/sandbox-templates:docker-agent` | Two images for two launch paths |
| C62 | undocumented | `--yolo` inside `--sandbox`, against a cut default | The captured mode |
| C63 | docs vs CLI | `<data-dir>/session.db`, against `session.db` in the current directory for `serve api` | Both defaults |
| C64 | renamed | `serve a2a -a` defaults to `root`, against the team's first agent | The v1.149.0 text |
| C65 | docs vs CLI | `eval -c` as the CPU count and an Anthropic judge, against 10 and `openai/gpt-5.6-terra` | 10 and `openai/gpt-5.6-terra` |
| C66 | docs vs CLI | `new --model` with 30 providers, against four named in the help | `new` auto-selects among those, `run --model` takes any provider |
| C67 | docs vs repo | telemetry off through `DOCKER_AGENT_*`, against `TELEMETRY_ENABLED=false` | Both printed |
| C68 | undocumented | a CLI reference at `/reference/cli/docker/agent/`, against a 404 | The features page and the help tree |
| C69 | undocumented | N hook built-ins, against eight confirmed names | Only the confirmed built-ins |
| C70 | docs vs docs | `serve a2a` as full A2A, against listed limitations | The captured card and each limitation the capture shows |
| C71 | undocumented | the card at `/.well-known/agent-card.json`, against no stated path | The path that answered and the `protocolVersion` field |
| C72 | undocumented | Gordon as separate, against `docker ai` calling Docker Agent | One sentence in 1.1 |
| C73 | undocumented | `ref: docker:<name>` through the gateway, against no word on the Toolkit | Both outcomes |
| C75 | undocumented | `docker agent` with no arguments runs `run`, against `getting-started` listed first | What its help says |
| C76 | docs vs docs | served agents forward budgets, against no forwarding | Budgets do not apply to served agents |
| C77 | docs vs CLI | `docker model configure`, against a missing command | Whichever exists. Docker Agent sets `context_size` through `_configure` |
| C79 | docs vs docs | `/anthropic/v1/messages`, against `/v1/messages` | The one that answered 200 |
| C83 | undocumented | `context_size` applied, against issue #4522 | The request body the runner received |
| C84 | docs vs docs | no key needed, against an unauthenticated API | The same fact, said in 6.5 |
| C88 | docs vs repo | an invite-only gateway, against an MIT gateway | Two things share a name, separated in 6.5 |
| C89 | docs vs repo | no default for `--verify-signatures`, against `true` | The default from the help |
| C90 | docs vs repo | registry references as supported, against partly implemented | Marked partly implemented in the Toolkit |
| C91 | docs vs docs | one gateway for everything, against a separate sandbox gateway | Three gateways named |
| C92 | undocumented | a known bundled gateway version, against 0.42.2 last stated | Both outputs |
| C93 | docs stale | the Action installs v0.22.0, against v0.44.1 | One sentence in 7.3 |
| C96 | community vs docs | Compose starts sandboxes, against no such feature | One sentence in 6.5 |
| C98 | blog stale | 300 free GPU minutes, against no public price | Offload is out of scope |
| C99 | docs vs docs | Offload as the cloud path, against `sbx --cloud` | Said so in 7.1 |
| C101 | docs vs docs | prices documented, against prices in a blog and `template load --help` | Shapes from the help, prices from the blog with its date |
| C103 | docs vs docs | pay-as-you-go on a Personal account, against Personal and Pro | Personal or Pro, the rest unverified |
| C104 | docs vs docs | `docker exec` and healthchecks work in the cloud, against the VM filesystem being reached instead | A documented limitation |
| C105 | talk vs docs | Warp Oz on Docker cloud sandboxes, against no confirmation | Omitted |
| C106 | blog stale | the sandbox primitive inside Kubernetes, against no other mention | Omitted |
| C107 | removed | the plugin still in Desktop, against removal in 4.80.0 | The error text the capture shows |
| C108 | removed | `--mount-docker-socket`, `--load-local-template`, `--pull-template`, against none in sbx | Migration rows S1 to S4 |
| C109 | renamed | `network proxy` flags, against `policy` subcommands with no bypass | Migration rows S10 and S11, bypass with no replacement found |
| C110 | removed | the legacy default allowed hosts, against three presets | The legacy list only in 7.3 |
| C111 | removed | `cagent` in Desktop, against removal in 4.81.0 | Migration row S8 |
| C112 | removed | keys from the daemon environment and state under `~/.docker/sandboxes/`, against the sbx store | One table in 7.3 |

## Stale advice

The migration section prints every row. The last column is what the register says to do now.

| Id | The advice as printed | Stopped being true | Do this instead |
|---|---|---|---|
| S1 | `docker sandbox run <agent>` | Desktop 4.80.0, 2026-06-29 | `sbx run <agent>` |
| S2 | `docker sandbox run --mount-docker-socket kiro` | Desktop 4.58.0, 2026-01-26 | Every sandbox has a private Docker Engine |
| S3 | `--load-local-template` | Desktop 4.61, 2026-02-18 | `sbx template load FILE`, then `--pull never -t TAG` |
| S4 | `--pull-template missing` | v0.21.0, 2026-03-31 | `--pull always`, `missing`, or `never`, default `always` |
| S5 | `docker sandbox create cagent .` | Desktop 4.80.0 | `sbx create docker-agent .`, with `cagent` kept as an alias |
| S6 | `cagent run agent.yaml`, `cagent new`, `cagent exec` | v1.23.4, 2026-02-19, and Desktop 4.81.0 | `docker agent run`, `docker agent new`, `docker agent run --exec` |
| S7 | `cagent push`, `pull`, `acp`, `api`, `mcp`, `a2a` | v1.23.4 | `docker agent share push` or `pull`, `docker agent serve acp`, `api`, `mcp`, `a2a` |
| S8 | `cagent version`, `brew install cagent` | v1.30.0, 2026-03-09, and Desktop 4.81.0 | `docker agent version`, `brew install docker-agent`, `winget install Docker.Agent` |
| S9 | `cagent config`, `feedback`, `build`, `catalog` | v1.23.4 | Removed. The catalog is the Hub namespace `agentcatalog/*` |
| S10 | `docker sandbox network proxy S --allow-host api.example.com` | Desktop 4.80.0 | `sbx policy allow network api.example.com [--sandbox S]` |
| S11 | `docker sandbox network log --json` | Desktop 4.80.0 | `sbx policy log [S] --json` |
| S12 | `docker sandbox save S TAG` into host Docker | Desktop 4.80.0 | `sbx template save S TAG [-o FILE]` into the runtime store |
| S13 | a proxy set by hand at `host.docker.internal:3128` | sbx, where the daemon configures the proxy | Nothing. The capture prints what the sandbox sees |
| S14 | API keys in `~/.zshrc` and a Desktop restart | v0.35.0, 2026-07-10 | `sbx secret set SERVICE` or `sbx secret import` |
| S15 | `sbx run claude --branch` | v0.31.0, 2026-05-28 | `sbx run claude --clone` |
| S16 | the kit v1 grammar with `schemaVersion: "1"` | v2 recommended 2026-09-09, v3 published 2026-09-24 | v2 `spec.yaml` for `sbx kit` artifacts, v3 `kit.yaml` with `# syntax=docker/sandbox-kit:3` for OCI kits |
| S17 | `sbx mcp catalog` | v0.45.0, 2026-09-21 | `sbx mcp add --url <registry or manifest URL>` |
| S18 | `sbx mcp enable github-official --sandbox my-project` | never in a help tree | `sbx mcp add`, then `--static-mcp` or `sbx mcp load` |
| S19 | Docker Agent v2.x renamed the CLI | never true | The latest is v1.149.0 |
| S20 | `docs.docker.com/ai/cagent/` | the v1.30.0 rename | `docs.docker.com/ai/docker-agent/` |
| S21 | `CAGENT_MODELS_GATEWAY`, `CAGENT_CONFIG_DIR`, `CAGENT_PPROF_ADDR` | v1.30.0, still accepted | `DOCKER_AGENT_MODELS_GATEWAY`, `DOCKER_AGENT_CONFIG_DIR`, `DOCKER_AGENT_PPROF_ADDR` |
| S22 | `docker/sandbox-templates:cagent` | the rename | `docker/sandbox-templates:docker-agent` |
| S23 | a `--command` helper written as `./helper` or `cat token` | v0.46.0, 2026-09-28 | An absolute path outside writable sandbox mounts |
| S24 | `-p 3000:8080` binds IPv4 and IPv6 | v0.42.0, 2026-09-07 | Default `tcp4`. Write `3000:8080/tcp` for both |
| S25 | kits from any registry | v0.34.0, 2026-06-26 | Add the prefix to `kit.allowedSources` |
| S26 | `docker cp` of the agent binary and `agent run dev-team.yaml` inside | sbx and the `docker-agent` template | `sbx run docker-agent .` or `docker agent run --sandbox agent.yaml` |
| S27 | one sandbox per workspace | names default to `<agent>-<workdir>` | Name sandboxes with `--name` |
| S28 | Windows 10 is supported | v0.35.0, 2026-07-10 | Windows 11 with the Windows Hypervisor Platform |
| S29 | the Toolkit gateway at `host.docker.internal:8811` in five steps | v0.38.0, 2026-08-06 | `sbx mcp add` and `sbx mcp load`. The Toolkit gateway is separate |
| S30 | a paid Anthropic judge model for `eval` | v1.147.0, 2026-10-05 | Default `openai/gpt-5.6-terra`, any `provider/model` works |

Sources: manual.json (pin, sources, quoteSources); research/sources/README.md (origins, commits, tags, versions, and the trim of 2026-10-08); research/sources/LICENSES.md; research/conflicts-register.md (rows C1 to C112 and S1 to S30, with the plan's citations in research/plan.md used to pick the rows); research/sources/probes/ (the probe timestamps)
