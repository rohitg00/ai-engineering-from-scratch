# Settings keys, environment variables, and paths

> Every key that `sbx settings list` printed on 2026-10-08, every environment variable both tools read, and every path they use on macOS, each with its source.

`sbx settings list` printed 31 keys on the capture machine, every one with SOURCE `default` (research/sources/probes/sbx-settings-list.txt). A value comes, in order, from the environment variable of the key, then a user override written with `sbx settings set`, then the built-in default {{docs-sbx Settings}}. RESTART `yes` means that daemon-side consumers that already exist need `sbx daemon restart`, while new sandboxes and supported CLI clients use the new value at once {{help-sbx sbx settings list}}. The CLI table cuts long descriptions. The Meaning column completes them from the docs settings page where the page has an entry. Where the page has none, the column says so and gives the full text of `sbx settings list --json` (capture/out/02-settings.json).

## The settings keys

| Key | Type | Default | Restart | Meaning |
|---|---|---|---|---|
| `claude.remoteControl` | bool | `false` | no | Let the `/remote-control` channel of Claude Code authenticate with its own session token instead of the proxy swapping in the host credential (docs) |
| `clipboard.imagePaste` | bool | `false` | no | Let sandboxed agents read host clipboard images, so a screenshot pastes with Ctrl+V (docs) |
| `diagnostics.autoUpload` | string | empty | no | Consent for automatic diagnostics uploads after daemon errors: `yes`, `no`, or empty for no decision yet (docs) |
| `env.rememberHostCommands` | bool | `false` | no | Ask about the host commands of an environment file only when they change, after a first approval (docs) |
| `kit.allowExtractedAgents` | bool | `true` | no | Admit the pinned kit references of agents that moved out of sbx into kits, even outside `kit.allowedSources`, and exempt them from `kit.requireSignature` (docs) |
| `kit.allowLocalKits` | bool | `true` | no | Allow kits from local directories and ZIP files (docs) |
| `kit.allowedSources` | json | `["docker.io/"]` | no | JSON array of allowed remote kit source prefixes, matched on a path segment boundary. `["*"]` allows any source (docs) |
| `kit.ignoreTransparencyLog` | bool | `false` | no | Verify keyless kit signatures without a Rekor entry, for kits signed with `--tlog-upload=false` (docs) |
| `kit.requireSignature` | bool | `false` | no | Reject unsigned kits and kits signed by an untrusted signer. ZIP kits cannot carry a signature and are rejected (docs) |
| `kit.trustedSigners` | json | identities ending in `@docker.com` through the Google issuer | no | JSON array of signer policies: a keyless identity with its issuer, or a public key file (docs) |
| `mcp.forceLocalGateway` | bool | `false` | yes | Use the local MCP gateway when the account would otherwise use the hosted one (docs) |
| `model.providers` | json | `{}` | no | JSON object of inference endpoints for `sbx run --model`, each with `url`, `wire`, and `apiKeyEnv` (docs) |
| `no_proxy` | string | empty | yes | Shared proxy exception list for sandbox, daemon, and supported CLI traffic (docs) |
| `no_proxy.daemon` | string | empty | yes | Exception list for daemon and CLI requests only. A non-empty value replaces the shared list for that scope (docs) |
| `no_proxy.sandbox` | string | empty | yes | Exception list for sandbox egress only. A non-empty value replaces the shared list for sandboxes (docs) |
| `platform.allowExperimentalFeatures` | bool | `true` | no | Allow experimental features. The CLI text is complete. The docs say the default is `false` ([conflict C18](#s-ref-sources-and-the-conflicts-register)) |
| `platform.images.registryMirror` | string | empty | no | Mirror host for template and kit references that resolve to Docker Hub, without a URL scheme (docs) |
| `platform.images.useDHI` | bool | `false` | no | Use the Docker Hardened Image variant `dhi/sbx-templates:<tag>` for the default agent templates (docs) |
| `proxy` | string | empty | yes | Upstream proxy for sandbox, daemon, and CLI traffic: an HTTP, HTTPS, or SOCKS5 URL, a PAC source, `system`, or `direct` (docs) |
| `proxy.daemon` | string | empty | yes | Upstream proxy for daemon requests and supported CLI requests only (docs) |
| `proxy.integratedAuth` | bool | `false` | yes | NTLM or Kerberos authentication with the Windows sign-in identity. No effect on macOS or Linux (docs) |
| `proxy.sandbox` | string | empty | yes | Upstream proxy for sandbox egress only. It overrides `proxy` for that scope (docs) |
| `sandbox.disk.dockerVolume` | string | `10g` | no | Size of the `/var/lib/docker` volume of a new sandbox, at least 512 MiB. Existing volumes keep their size (docs) |
| `skills.defaultMode` | string | `readonly` | no | Mode of the shared skills store when `--skills` is omitted: `readonly`, `readwrite`, or `off` (docs) |
| `ssh.agentForwardingEnabled` | bool | `true` | yes | Let clients forward an SSH agent into sandboxes. Private keys stay on the host (docs) |
| `ssh.agentSocketPath` | string | empty | yes | Fixed host SSH agent socket path. Empty uses the socket each client supplies (docs) |
| `ssh.autoCreate` | bool | `false` | yes | Create a sandbox on SSH connect when it does not exist. The docs have no entry ([conflict C20](#s-ref-sources-and-the-conflicts-register)) |
| `ssh.defaultAgent` | string | `shell` | yes | Built-in agent used for SSH auto-created sandboxes. The docs have no entry |
| `ssh.defaultTemplate` | string | empty | yes | Template image override for SSH auto-created sandboxes (agent default if empty). The docs have no entry |
| `ssh.workspaceRoot` | string | empty | yes | Host directory holding SSH auto-created sandbox workspaces (empty = mount-less, container-internal). The docs have no entry |
| `tls.allowNegativeSerial` | bool | `false` | yes | Accept server certificates with a negative serial number, as some TLS-inspecting proxies issue (docs) |

Value types are `bool`, `int`, `float`, `string`, and `json`, and an override that conflicts with an administrator constraint is rejected {{help-sbx sbx settings set}}. Most changes apply within about five seconds {{help-sbx sbx settings}}.

## Keys the docs name that the CLI did not print

The docs settings page, three guides, and one release note name keys that `sbx settings list` did not return ([conflict C19](#s-ref-sources-and-the-conflicts-register)). The manual prints them here and nowhere else.

| Key | Where the docs use it | What the docs say |
|---|---|---|
| `feature.model` | the local model guide | `sbx settings set feature.model true` after `platform.allowExperimentalFeatures true` turns on `sbx run --model` {{docs-sbx Run a local model}} |
| `feature.sandbox-gpu` | the GPU guide | the same pair of commands reveals the hidden `--gpu` flag {{docs-sbx Turn on the feature}} |
| `feature.udp-egress` | the network policy page | the same pair of commands allows `sbx policy allow network --protocol udp` {{docs-sbx Allow outbound UDP}} |
| `diagnostics.autoUploadErrorCooldownInDays` | the settings page | integer, default `1`, the number of days between automatic uploads, applied only when `diagnostics.autoUpload` is `yes` {{docs-sbx Settings}} |
| `feature.ssh` | the v0.34.0 release note | `sbx settings set feature.ssh true` enables the experimental native SSH endpoint {{rel-sbx v0.34.0}} |

## Environment variables that sbx reads

These variables configure the host side. They never set a variable inside a sandbox, and the daemon reads them only when it starts {{docs-sbx Settings}}.

| Variable | Sets | Source |
|---|---|---|
| `DOCKER_SANDBOXES_CLIPBOARD_IMAGE_PASTE` | `clipboard.imagePaste` | {{docs-sbx Settings}} |
| `DOCKER_SANDBOXES_CLAUDE_REMOTE_CONTROL` | `claude.remoteControl` | {{docs-sbx Settings}} |
| `DOCKER_SANDBOXES_USE_DHI` | `platform.images.useDHI` | {{docs-sbx Settings}} |
| `DOCKER_SANDBOXES_KIT_ALLOWED_SOURCES` | `kit.allowedSources` | {{docs-sbx Settings}} |
| `DOCKER_SANDBOXES_KIT_ALLOW_LOCAL` | `kit.allowLocalKits` | {{docs-sbx Settings}} |
| `DOCKER_SANDBOXES_KIT_ALLOW_EXTRACTED_AGENTS` | `kit.allowExtractedAgents` | {{docs-sbx Settings}} |
| `DOCKER_SANDBOXES_KIT_REQUIRE_SIGNATURE` | `kit.requireSignature` | {{docs-sbx Settings}} |
| `DOCKER_SANDBOXES_KIT_TRUSTED_SIGNERS` | `kit.trustedSigners` | {{docs-sbx Settings}} |
| `DOCKER_SANDBOXES_KIT_IGNORE_TLOG` | `kit.ignoreTransparencyLog` | {{docs-sbx Settings}} |
| `DOCKER_SANDBOXES_PROXY` | `proxy.sandbox`, sandbox traffic only | {{docs-sbx Settings}} |
| `DOCKER_SANDBOXES_NO_PROXY` | `no_proxy.sandbox`, sandbox traffic only | {{docs-sbx Settings}} |
| `DOCKER_SANDBOXES_SSH_AUTO_CREATE` | `ssh.autoCreate` | capture/out/02-settings.json, no docs entry |
| `DOCKER_SANDBOXES_SSH_DEFAULT_AGENT` | `ssh.defaultAgent` | capture/out/02-settings.json, no docs entry |
| `DOCKER_SANDBOXES_SSH_DEFAULT_TEMPLATE` | `ssh.defaultTemplate` | capture/out/02-settings.json, no docs entry |
| `DOCKER_SANDBOXES_SSH_WORKSPACE_ROOT` | `ssh.workspaceRoot` | capture/out/02-settings.json, no docs entry |
| `DOCKER_SANDBOXES_MODEL_PROVIDERS` | `model.providers` | capture/out/02-settings.json, no docs entry |
| `DOCKER_SANDBOXES_ALLOW_EXPERIMENTAL_FEATURES` | `platform.allowExperimentalFeatures` | capture/out/02-settings.json, no docs entry |
| `DOCKER_SANDBOXES_TLS_ALLOW_NEGATIVE_SERIAL` | `tls.allowNegativeSerial` | {{docs-sbx Settings}} |
| `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, and their lowercase forms | the upstream proxy when no `proxy` or `no_proxy` setting is set | {{docs-sbx Upstream proxies}} |
| `DOCKER_SANDBOXES_DOCKER_SIZE` | the Docker data disk size of one creation, such as `30g` | {{docs-sbx Settings}} |
| `DOCKER_SANDBOXES_ROOT_SIZE` | the root filesystem size of one creation, such as `40g` | {{docs-sbx Troubleshooting}} |
| `DOCKER_SANDBOXES_CLONED_WORKSPACE_SIZE` | the size of the private clone of a `--clone` sandbox | {{docs-sbx Troubleshooting}} |
| `DOCKER_SANDBOXES_ENABLE_VIRTIOFS_CACHE` | `0` turns off the virtiofs cache of the workspace mount | {{docs-sbx Troubleshooting}} |
| `SBX_NO_TELEMETRY` | `1` turns off CLI usage analytics | {{docs-sbx Troubleshooting}} |
| `DOCKER_ACCESS_TOKEN` | the Docker identity of `sbx env` commands, with a state scope per token | {{help-sbx sbx env}} |
| `SBX_MCP_URL` | `none` selects the local MCP data plane instead of the hosted gateway | {{help-sbx sbx mcp add}} |
| `SANDBOXES_STORAGE_ROOT` | not documented in the vendored sources. The research notes name it from the v0.29.0 release note, whose body the vendored release list does not keep | none |

Host lifecycle commands of an environment file receive `SBX_LIFECYCLE_PHASE`, `SBX_ENV_FILE`, `SBX_ENV_FILES`, `SBX_ENV_DIR`, `SBX_SANDBOX_NAME`, `SBX_AGENT`, and `SBX_WORKSPACE` {{docs-sbx Environment files}}. After a cloud creation they also receive `SBX_SANDBOX_ID` {{help-sbx sbx env}}.

## Environment variables that docker-agent reads

The rename of v1.30.0 changed the prefix from `CAGENT_` to `DOCKER_AGENT_`, and the old names stay accepted ([conflict C53](#s-ref-sources-and-the-conflicts-register)) {{rel-agent v1.30.0}}.

| Variable | Legacy name | Meaning | Source |
|---|---|---|---|
| `DOCKER_AGENT_DATA_DIR` | none | The data directory, the same as `--data-dir` | {{help-agent docker-agent}}, added in v1.147.0 {{rel-agent v1.147.0}} |
| `DOCKER_AGENT_CONFIG_DIR` | `CAGENT_CONFIG_DIR` | The config directory, the same as `--config-dir` | {{docs-agent Hooks}}, added in v1.100.0 {{rel-agent v1.100.0}} |
| `DOCKER_AGENT_MODELS_GATEWAY` | `CAGENT_MODELS_GATEWAY` | Route model traffic through a gateway, the same as `--models-gateway` | {{docs-agent User settings}} |
| `DOCKER_AGENT_DEFAULT_MODEL` | `CAGENT_DEFAULT_MODEL` | The model used when none is given, as `provider/model` | {{docs-agent User settings}} |
| `DOCKER_AGENT_HIDE_TELEMETRY_BANNER` | `CAGENT_HIDE_TELEMETRY_BANNER` | `1` hides the first-run telemetry notice only | {{docs-agent User settings}} |
| `TELEMETRY_ENABLED` | none, no prefix | `false` turns telemetry off ([conflict C67](#s-ref-sources-and-the-conflicts-register)) | {{docs-agent Telemetry}} |
| `DOCKER_AGENT_AUTO_UPDATE` | none | `1`, `true`, `yes`, or `on` lets a standalone release binary update itself | {{docs-agent User settings}}, added in v1.74.0 {{rel-agent v1.74.0}} |
| `DOCKER_AGENT_NO_TOKEN_EXCHANGE` | none | `1` stops the exchange of the `docker login` access token for a Docker token | {{docs-agent Secrets}} |
| `DOCKER_AGENT_HUB_LOGIN_URL` | none | Point the token exchange at a Docker staging environment, HTTPS `docker.com` URLs only | {{docs-agent User settings}} |
| `DOCKER_AGENT_AUTO_INSTALL` | none | `false` turns off automatic tool installation from the aqua registry | {{docs-agent Tools}} |
| `DOCKER_AGENT_TOOLS_DIR` | none | The directory of installed tools, default `~/.cagent/tools/` | {{docs-agent Tools}} |
| `DOCKER_AGENT_NO_SETUP` | none | `1` stops the setup wizard from being offered when no model is usable | {{docs-agent features/cli}} |
| `DOCKER_AGENT_BOARD_EDITOR` | `BOARD_EDITOR`, kept for one release | The editor the board opens a worktree in, default `code` | {{docs-agent Board}}, renamed in v1.102.0 {{rel-agent v1.102.0}} |
| `DOCKER_AGENT_PPROF_ADDR` | `CAGENT_PPROF_ADDR` | A loopback address for a Go pprof server. The docs still print the legacy name | {{rel-agent v1.139.0}}, {{docs-agent features/cli}} |
| `DOCKER_AGENT_ENCRYPT_KEY` | none | The key of `share push --key` and `share pull --key` | {{help-agent docker-agent share push}} |
| `GITHUB_TOKEN` | none | Raises the GitHub API rate limit of the auto-installer | {{docs-agent Tools}} |
| `CAGENT_ASKPASS_SOCKET`, `CAGENT_ASKPASS_TOKEN` | none, still prefixed `CAGENT_` | The sudo bridge of the `shell` toolset, set only on commands that call `sudo` | {{docs-agent Shell}} |
| `CAGENT_EXP_DEBUG_LAYOUT`, `CAGENT_HIDE_TELEMETRY` | renamed in v1.30.0 | The new names are not documented in the vendored sources | {{rel-agent v1.30.0}} |

Provider credential variables such as `ANTHROPIC_API_KEY` are listed in [R.6](#s-ref-providers-and-models).

## Paths on macOS

The capture machine runs macOS, so the table gives macOS paths first and the Linux and Windows forms where the docs state them. Replace `rohitghumare` with your user name.

| Path | Holds | Tool | Source |
|---|---|---|---|
| `~/Library/Application Support/com.docker.sandboxes/` | the sbx state directory, removed as a last resort after `sbx reset` | sbx | {{docs-sbx Removing all state}} |
| `.../com.docker.sandboxes/sandboxes/sandboxd/sandboxd.sock` | the Unix socket of `sandboxd` | sbx | research/sources/probes/sbx-daemon-status.txt |
| `.../com.docker.sandboxes/sandboxes/sandboxd/daemon.log` | the daemon log | sbx | research/sources/probes/sbx-daemon-status.txt |
| `.../com.docker.sandboxes/sandboxes/agent-skills` | the shared skills store. Linux `~/.local/state/sandboxes/sandboxes/agent-skills`, Windows `%LOCALAPPDATA%\DockerSandboxes\sandboxes\state\agent-skills` | sbx | {{docs-sbx Share agent skills}} |
| `~/Library/Logs/com.docker.sandboxes/sandboxes/auditkit/` | audit records written by the daemon. Linux `${XDG_STATE_HOME:-~/.local/state}/sandboxes/sandboxes/auditkit/`, Windows `%LOCALAPPDATA%\DockerSandboxes\sandboxes\logs\auditkit\` | sbx | {{docs-sbx Where records are stored}} |
| `~/.config/sbx/credentials.yaml` | the credential bindings file. Windows `%APPDATA%\sbx\credentials.yaml` | sbx | {{docs-sbx Credential bindings}} |
| the macOS Keychain | the secret store behind `sbx secret set`. Windows uses the Credential Manager, Linux the Secret Service, or the file `~/.config/com.docker.sandboxes` without one | sbx | {{docs-sbx Credentials}} |
| `~/.sbx/run/d/containerd/containerd.sock.ttrpc` | the containerd ttrpc socket the daemon binds at start, named in the error the capture recorded | sbx | {{help-sbx sbx kit builder history ls}} |
| `~/.sbxenv.yaml` | a base environment file merged under every project file | sbx | {{help-sbx sbx env create}} |
| `/opt/homebrew/Caskroom/sbx/0.47.0/Sbx.app/Contents/MacOS/sbx` | the CLI binary of the Homebrew cask, with `mkfs.erofs` under `Contents/libexec` | sbx | research/sources/probes/sbx-diagnose.txt |
| `~/.local/state/sandboxes/`, `~/.cache/sandboxes/`, `~/.config/sandboxes/` | the three Linux state directories, under `XDG_*` when set. Windows uses `%LOCALAPPDATA%\DockerSandboxes` | sbx | {{docs-sbx Removing all state}} |
| `~/.config/cagent/config.yaml` | user settings, aliases, global permissions and hooks, board projects | docker-agent | {{help-agent docker-agent board}} |
| `~/.config/cagent/.env` | the env file that `docker agent setup` writes provider keys into | docker-agent | {{help-agent docker-agent setup}} |
| `~/.config/cagent/hooks.d/` | hook drop-in files, loaded in lexicographic order | docker-agent | {{docs-agent Hooks}} |
| `~/.cagent/` | the data directory, which holds `session.db`, worktrees, and plans | docker-agent | {{help-agent docker-agent}}, {{docs-agent features/cli}} |
| `~/.cagent/session.db` | every session, as SQLite | docker-agent | {{docs-agent Sessions}} |
| `~/.cagent/cagent.debug.log` | the debug log, with `--debug` | docker-agent | {{help-agent docker-agent}} |
| `~/.cagent/tools/bin/` | binaries the aqua auto-installer downloads | docker-agent | {{docs-agent Tools}} |
| `~/.cagent/plans/`, `~/.cagent/session_plans/` | shared plans and per-session plans | docker-agent | {{docs-agent features/cli}} |
| `~/.cagent/memory/<config-name>/memory.db` | the default database of the `memory` toolset | docker-agent | {{docs-agent Memory}} |
| `~/.cagent/themes/<name>.yaml` | custom TUI themes | docker-agent | {{docs-agent User settings}} |
| `<data-dir>/runs/<pid>.json` | the discovery record of a run started with `--listen` | docker-agent | {{docs-agent features/cli}} |
| `~/Library/Caches/cagent/` | the cache directory on macOS | docker-agent | {{help-agent docker-agent}} |
| `~/Library/Caches/cagent/sandbox-kits/<hash>` | the kit that `run --sandbox` stages, keyed by the agent reference | docker-agent | {{docs-agent Sandbox}} |
| a private file under the cache directory | the cached Docker bearer token. Its name is not documented | docker-agent | {{docs-agent Secrets}} |
| `~/.codex/skills/`, `~/.claude/skills/`, `~/.agents/skills/`, and the project `.claude/skills/`, `.github/skills/`, `.agents/skills/` | the `SKILL.md` directories docker-agent discovers | docker-agent | {{docs-agent Sandbox}} |

The directories of docker-agent keep the name `cagent` after the rename ([conflict C54](#s-ref-sources-and-the-conflicts-register)). Nothing migrates state from the plugin-era directories `~/.docker/sandboxes/` and `~/.sandboxd/` to the sbx state directory ([conflict C17](#s-ref-sources-and-the-conflicts-register)).

Sources: research/sources/probes/sbx-settings-list.txt, sbx-daemon-status.txt, sbx-diagnose.txt; capture/out/02-settings.json (the full descriptions of the four `ssh.*` keys, and the environment variables of the `ssh.*`, `model.providers`, and `platform.allowExperimentalFeatures` keys); research/sources/help-sbx.md (`sbx settings`, `sbx settings list`, `sbx settings set`, `sbx env`, `sbx env create`, `sbx mcp add`, `sbx kit builder history ls`); research/sources/docs-sandboxes.md (pages configuration/settings, configuration/environment-files, troubleshooting, governance/audit, workflows/agent-skills, the credentials and local model and GPU and network policy guides); research/sources/sbx-releases.md (v0.34.0); research/sources/help-docker-agent.md (root, `board`, `setup`, `share push`); research/sources/docs-docker-agent.md (pages features/cli, configuration/user-settings, configuration/hooks, configuration/tools, configuration/sandbox, features/sessions, guides/secrets, tools/memory, tools/shell); research/sources/docker-agent-CHANGELOG.md (v1.30.0, v1.74.0, v1.100.0, v1.102.0, v1.139.0, v1.147.0); research/conflicts-register.md rows C17, C18, C19, C20, C53, C54, C67
