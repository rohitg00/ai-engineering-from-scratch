# docker/sbx-releases: stable release notes

Fetched 2026-10-08 from https://api.github.com/repos/docker/sbx-releases/releases. 32 stable releases, newest first; rc, nightly, and dev builds are left out. Text is Docker Inc. release text (proprietary), quoted here as release notes.

## v0.47.0

Published 2026-10-05. https://github.com/docker/sbx-releases/releases/tag/v0.47.0

### Highlights

Docker Sandboxes v0.47.0 adds automatic cleanup after agent sessions with `sbx run --rm` and a kit capability for keeping local sandboxes running after sessions disconnect.

### What's new

### Security

- Fixed OAuth token interception when a provider hostname uses different capitalization or a trailing dot, preventing real tokens from reaching the sandbox instead of the proxy's placeholders.
- The proxy rejects unrecognized OAuth token grants and prevents their responses from replacing host-managed credentials. Supported in-sandbox sign-in flows remain available.
- The proxy returns an error when it cannot safely mask a successful Anthropic API-key creation response, instead of forwarding the unmasked response to the sandbox.
- Included since v0.46.0: fixed raw TCP connections to denied hostnames being permitted by an allow rule for the hostname's resolved IP address. This fix applies to TCP; the related UDP case with multiple tracked hostnames remains outside its scope.
- Included since v0.45.0: CLI-created cloud hostname allowlists no longer gain implicit `0.0.0.0/0` and `::/0` rules. Existing stored policies are unchanged; remove those rules or recreate the policy to apply the restriction. Explicit IP and CIDR allowances remain supported.
- The proxy rejects TLS handshakes that fill its inspection buffer before a complete ClientHello can be checked on a non-MITM CONNECT tunnel or during the transparent proxy's late handshake check.
- The proxy closes incomplete TLS handshakes on those paths after a two-minute timeout instead of retaining the connections for the sandbox's lifetime.
- Sandboxes reject UDP to multicast, link-local, and unspecified destinations, limited broadcast, and broadcast addresses derived from the host's interface prefixes, regardless of network policy. UDP to `host.docker.internal` is unaffected. Broadcast addresses configured outside that derivation and networks reachable only through routes are not covered by this check.
- Kit pulls enforce limits on registry-declared blob sizes, decompressed content, and archive entry counts.

### Sandbox lifecycle and workspaces

- `sbx run --rm` removes a local or cloud sandbox after its agent session ends. It cannot be combined with `--detached`. If a cloud session is interrupted, such as by a dropped connection, the sandbox is kept and the CLI prints the command to remove it.
- Running `sbx run -d` against an existing local sandbox keeps it running after sessions disconnect, until you stop or remove it.
- Dynamic mounts and permissions created through symlink paths can be removed without reappearing after a restart. Incompatible saved records include recovery guidance.

### Kits

- Local kit inspection, validation, and pulling require the daemon to be running.
- Kits can declare `com.docker.sandbox/long-running@1` to keep local sandboxes running after all sessions disconnect. Cloud sandboxes and `sbx kit add` cannot provide this capability: required entries are rejected, and optional entries are skipped.
- `sbx kit sign` and `sbx kit push --sign` succeed on registries that refuse manifest deletion, including GitHub Container Registry and Docker Hub, instead of reporting failure after attaching the signature.
- Adding a kit to a sandbox whose guest has stopped responding fails without leaving the sandbox unusable until the daemon restarts.

### Cloud sandboxes

- `sbx --cloud ttl` reports stopped sandboxes as stopped instead of expired. The time-to-live restarts when the sandbox resumes. JSON output includes `stopped` and `ttl_paused`; while the sandbox is resuming, only `ttl_paused` is true.
- Creating a cloud sandbox or moving a local sandbox to the cloud applies cloud policy and the kit's network rules without copying locally added network rules. Moving a sandbox with local HTTP method or path restrictions warns that those restrictions will not apply in the cloud.

### Settings and proxies

- Upstream proxy recovery no longer blocks unrelated sandboxes or deletes isolated container data when credentials are unavailable. Local host services remain reachable.
- `sbx settings set` rejects invalid upstream proxy values before saving them.

### MCP

- MCP authorization requests `offline_access` when the server advertises it and authorization uses saved defaults or resource-required scopes, so the server can issue refresh tokens. Explicit `--scope` values are unchanged. Run `sbx mcp auth` again to obtain a grant with a refresh token for existing credentials.
- Fixed MCP gateway availability in sandboxes created from the TUI and when connecting over SSH after a daemon restart or automatic sandbox creation.

### CLI and updates

- `sbx env` reports the correct file, line, and column for unrecognized keys even when another entry in the file fails custom validation. Multiple validation errors appear on separate lines.
- Help remains available when the settings directory is unwritable or local settings cannot be opened, with a warning instead of a panic.
- Host-port collisions from `sbx ports --publish` identify the occupied binding and offer a retry with an automatically allocated port when safe.
- Windows update notices appear only after WinGet confirms that the version is available in its catalog.
<!-- release-notes:end -->

## v0.46.0

Published 2026-09-28. https://github.com/docker/sbx-releases/releases/tag/v0.46.0

### What's new

### Breaking changes

- Secret commands configured with `sbx secret set --command`, `sbx secret set-custom --command`, or `secrets.<name>.command` in an environment file execute from a fresh temporary directory on the host. Relative paths such as `./credential-helper` no longer resolve from the project directory or the directory where you ran `sbx`. Store helpers and their dependencies outside writable sandbox mounts. Run helpers by name from an absolute directory on the host's `PATH`, use absolute paths, or explicitly change to their private directory in the command. For existing environments that declare secret commands, the next `sbx env run` asks you to approve a one-time plan change for the working directory. The execution change takes effect after upgrading and restarting the daemon, even before you approve that plan.

### Cloud sandboxes

- `sbx --cloud create --on-timeout restart` accepts `restart` as the timeout action. When the sandbox reaches its time limit, it stops and immediately restarts instead of remaining stopped.
- `sbx --cloud create` passes `--kit-arg` and `--kit-args-file` values to kits supplied with `--kit`.

### Kits and skills

- Kits can install files in the agent's skills directory when shared skills are read-only. The shared skills store remains read-only, while kit installation and startup commands can write their own skills without a read-only filesystem error.
- Kits added through the runtime API retain their network rules and applicable agent instructions when another kit addition recreates the sandbox container.
- `sbx kit add` warns if it cannot save the updated sandbox record. The warning explains which kit settings could be lost and whether a daemon restart or another container replacement would cause the loss.

### Agents and models

- The local model server starts and stops with the Docker Sandboxes daemon and downloads its llama.cpp runtime when the daemon starts. The macOS and Windows bundles include llmman v0.1.418, which manages the runtime download instead of relying on a separately bundled `llama-server`.
- Image paste in WSL2 falls back to the Windows clipboard when Linux clipboard tools return no image. Requires `clipboard.imagePaste` to be enabled.

### Sandbox lifecycle and workspaces

- Fixed a shutdown bug affecting templates that use dash as `/bin/sh`, including the built-in Ubuntu-based templates. The shutdown handler forwards `SIGTERM` correctly, giving sandbox processes a chance to exit gracefully instead of waiting five seconds for a forced shutdown.
- On Linux arm64 hosts, the default CPU allocation is capped at 16 CPUs per sandbox. This fixes startup failures with `VM did not connect within 15s` when several sandboxes start together on hosts with many CPU cores. Use `--cpus` to request a larger allocation.
- `sbx umount` can remove a saved mount from a stopped sandbox using the original host path even after that directory has been deleted.
- On macOS, mounting, unmounting, and restoring saved mounts consistently recognize host paths whose capitalization differs.
- If the runtime fails to mount the workspace, sandbox startup reports the mount failure and points to the daemon log for the cause instead of reporting a generic container startup error.
- Starting a second daemon against a state directory already in use fails with an error instead of disrupting the running daemon.
- `sbx reset` stops background feature-flag updates and log writes before deleting local state, preventing leftover files and recreated directories. On Windows, it also closes daemon log files before deleting them to avoid cleanup retries caused by open file handles.

### Authentication and credentials

- Removing secrets in bulk revokes credentials from running sandboxes. Failed revocations can be retried even after the stored secrets have been deleted.

### Networking and policy

- Sandboxes created with the `balanced` network policy preset can download Playwright browser binaries from `cdn.playwright.dev` over HTTPS. Existing sandboxes keep their saved policies. To use the updated preset, create a new sandbox with the `balanced` network policy.

### CLI and diagnostics

- `sbx env` reports unrecognized environment-file keys with the file, line, and column where they were declared, including when multiple files are merged.
- Canceling a batch `sbx rm` or `sbx stop` stops processing the remaining sandboxes instead of printing a cancellation error for each one.
- `sbx diagnose --upload` returns a non-zero exit status if the requested diagnostics upload fails, so scripts can detect the failure.
- `sbx diagnose` reports the socket-path length limit used by the container runtime as `runtime_socket_limit_bytes` and clarifies the meaning of the reported socket-path values.

### Packaging and installation

- Windows MSI installations include `llmman` and the guest kernel, fixing local model serving with `sbx run --model` and sandbox launches that failed with `No kernel specified`.
- Uninstalling Docker Sandboxes through the Windows MSI stops the daemon.
- Fixed the Linux static tarball failing to start on distributions with older glibc versions. The tarball is built against glibc 2.34.

## v0.45.1

Published 2026-09-22. https://github.com/docker/sbx-releases/releases/tag/v0.45.1

### Fixes and improvements

- Improved sandbox moves and support for private kit images in cloud sandboxes.

## v0.45.0

Published 2026-09-21. https://github.com/docker/sbx-releases/releases/tag/v0.45.0

### Highlights

### Compose reusable environments with v3 kits

Docker Sandboxes now supports v3 kits: OCI-based packages that combine an agent workload with reusable mixins for tools, configuration, credentials, network access, and agent instructions. Compose compatible kits directly when creating a sandbox, or publish the combination as a kit set that your team can run from a single reference.

V2 kits remain supported for built-in agents and existing customizations. V3 workloads and mixins must be used together; they can't be combined with v1 or v2 kits. [Learn more about kits](https://docs.docker.com/ai/sandboxes/customize/).

### Run agents in cloud sandboxes

Run AI agents on Docker-managed cloud infrastructure with `sbx --cloud`. Cloud support is experimental and requires an active Docker Agentic Platform subscription. See [Get started with cloud sandboxes](https://docs.docker.com/ai/sandboxes/cloud/).

### What's new

### Breaking changes

- `sbx mcp catalog` has been removed. To authorize a remote MCP server, register it with `sbx mcp add` before running `sbx mcp auth`.
- `sbx secret rm` now returns an error on stderr when the requested secret doesn't exist.
- `sbx mcp rm` now returns an error when the requested MCP server isn't registered.

### Security

- Fixed an issue where revoking a sandbox's OAuth or API-key credential could leave its running proxy authorized until the sandbox was recreated.

### Kits

- V3 kits introduce separate workload and mixin roles. A workload supplies the base environment and command to run; mixins add tools, configuration, and runtime behavior. Dependencies and compatibility declarations determine composition order.
- Kit sets let authors combine a workload and mixins, pin their component versions, and publish the result as a single OCI reference. Sets can also add capabilities, lifecycle hooks, instructions, and arguments of their own.
- V3 kits can scope network access by HTTP method and path, declare install-phase network access and credential use, and specify where an agent reads shared skills.
- Multiple OAuth-backed agents can be composed in the same sandbox with credentials scoped to the kits that request them.
- HTTP Basic credentials declared by a kit now produce the expected `Authorization: Basic` header. Composition fails when kits declare conflicting ownership of a Basic-auth service instead of silently dropping the username.
- `sbx kit validate` now rejects malformed API-key declarations, including invalid names, missing injection domains, invalid format placeholders, and Basic-auth usernames containing a colon. It also warns about declarations that have no effect or target domains outside the kit's network allowlist.
- Reusing an unchanged local kit no longer rebuilds its composed image.
- Adding a mixin to an existing sandbox through the daemon API now writes the mixin's agent instructions as expected.

### Agents and models

- `sbx run --model` can use any OpenAI- or Anthropic-compatible endpoint configured in the new `model.providers` setting.
- `sbx run opencode --model` now exposes the model's supported thinking levels as OpenCode variants, selectable with <kbd>Ctrl</kbd>+<kbd>T</kbd>.
- The OpenCode kit now configures GitHub Copilot from the account's stored GitHub credential, so Copilot models work without a separate device login.
- Codex sandboxes now install Codex with its native installer instead of npm.

### CLI and output

- MCP server, secret, skill, template, volume, and policy-profile list commands now support `--quiet` (`-q`) for name-only output.
- List commands now use consistent table formatting, and errors use a consistent format with clearer recovery guidance.
- Commands that remove resources now ask for confirmation. Use `--force`, or `--yes`/`-y` for `sbx kit builder history rm`, in non-interactive workflows. Declining a destructive-action or required-restart prompt now returns a non-zero exit code.
- Running `sbx secret rm` without a service opens a picker showing existing local secrets and their scope, type, and name.
- Unsupported detached execution with `sbx exec -d` or `--detach` now fails immediately instead of running in the foreground.
- `sbx settings` now appears in `sbx --help` and the CLI reference.
- `sbx ls --json` now includes `created_at`. `sbx ls --json` and `sbx inspect --json` also report recorded CPU and memory limits for local sandboxes.
- The updater no longer asks to switch channels when the requested version is already installed.
- `sbx env rm` now warns about data loss for a cloned workspace before asking for confirmation.
- `sbx logout` no longer warns about stopped sandboxes when the daemon isn't running.

### Sandbox lifecycle and workspaces

- Sandboxes now recover when the guest kernel crashes instead of becoming permanently unusable. If a guest stops responding, affected operations fail with an explanation, held proxy connections are released, and `sbx ls` and `sbx inspect` report the unresponsive state.
- Dynamic mounts are restored after a sandbox restart. Startup fails clearly if a saved mount can't be restored, and `sbx umount` can remove a saved mount while the sandbox is stopped. A missing unmount target no longer disrupts existing mounts.
- Clone-mode sandboxes restore their host Git remotes on every restart, preserve complete remote configuration during concurrent lifecycle operations, and provide recovery instructions if configuration fails.
- Newly created or recreated sandboxes have a writable `/etc/hosts` file.
- Image pulls retry transient registry network failures before sandbox creation fails.
- Cached-image recovery is reported as successful without also showing a registry error, and mount-policy evaluation failures are distinguished from access denials.
- Container swaps remove obsolete registry-mirror allowances even if saving the previous swap state fails.
- Updated containerd to fix image layers being dropped.

### Authentication and credentials

- Adding, updating, or removing global service secrets now updates existing local sandboxes without a restart while preserving sandbox-specific credentials. Sandbox-scoped command and reference secrets also take effect immediately.
- Registry and service-secret revocation failures are now reported and can be retried, including after a stored OAuth token has been deleted.
- OAuth refreshes are coordinated across sandboxes that share credentials, preventing simultaneous refreshes from forcing another sign-in.

### Networking and policy

- Network policy now treats hostnames with a trailing dot the same as their canonical form for routing, interception, credential injection, and `host.docker.internal` handling. The policy log also records cleartext HTTP requests whose `Host` header differs from the connection destination.
- Experimental outbound UDP now follows sandbox network policy. New local allow rules cover TCP by default; select UDP explicitly with `--protocol` in the CLI or the TCP+UDP option in the TUI. UDP is refused when the destination requires an HTTP, SOCKS5, system, or PAC-selected proxy, because those proxies can't carry it.
- Reverse-DNS lookups are now allowed only for destination IPs already authorized by policy, including IP, CIDR, and allow-all rules. This closes the previous policy bypass without blocking PTR lookups for permitted addresses.
- DNS resolution is no longer allowed when no network rule permits it.
- Connections allowed only by a CIDR rule no longer wait for hostname detection before connecting, improving protocols such as SSH where the server speaks first.
- Network and filesystem access now fail closed with accurate errors when policy evaluation fails, governance can't be resolved, a policy snapshot is stale, or a request is malformed.
- `sbx policy allow network`, `sbx policy deny network`, `--allow-network`, and `--deny-network` now reject malformed patterns before saving them.
- `sbx policy ls` now shows how each rule was created and supports filtering with `--created-via`.
- Fixed excessive daemon CPU use caused by reading the settings file for every blocked UDP packet.
- The governance-rules table no longer reserves space for a hidden profile column, keeping host values readable in narrow terminals.

### MCP

- Fixed gateway creation failures caused by parentheses or other sandbox-ID punctuation in generated gateway names.
- MCP gateways now recover correctly after a daemon restart when using `sbx exec` or `sbx env run`.
- Internal MCP discovery and OAuth informational logs no longer appear in normal command output.
- OAuth authorization errors now suggest explicit scopes when the authorization server rejects a request without scopes.
- OAuth metadata discovery for private addresses now warns and continues by default. `--skip-ssrf-check` remains available to suppress the warning for trusted providers and their discovery destinations.
- `sbx mcp add --disable-http2` disables HTTP/2 for a remote MCP transport, providing a workaround for servers whose HTTP/2 handling stalls long-lived streams.

### Packaging and installation

- macOS distributions now contain a single signed `Sbx.app` bundle. Homebrew and tarball PATH installs continue to work through a symlink into the bundle.

## v0.43.0

Published 2026-09-15. https://github.com/docker/sbx-releases/releases/tag/v0.43.0

### What's New

### Breaking changes

- `shareSkills` in `sbxenv.yaml` ([experimental feature](https://docs.docker.com/ai/sandboxes/configuration/environment-files/)) has been replaced with `skills`, `skills` may be set to `off|readonly|readwrite`.

- MCP OAuth client secrets are renamed to `mcp:<server>:client_secret` (was `mcp:<server>.client_secret`), matching the header-secret naming; a secret stored under the old name is no longer read and must be re-set with `sbx secret set mcp:<server>:client_secret`.

### Environment files

- Environment files can reference `${{ env.projectDir }}` and `${{ env.fileDir }}`, the user-level `~/.sbxenv.yaml` can mount each project's own directory by declaring `workspace: ${{ env.projectDir }}`, relative workspace paths now resolve against the file that declares them, and every `sbx env` subcommand accepts `--name` to override the sandbox name.
- `sbx env run`, `sbx env create`, and `sbx env rm` detect name conflicts with sandboxes created outside `sbx env` and provide guidance instead of treating them as environment-managed sandboxes.

### Agents and models

- Formerly built-in agents that moved to public kits (kiro, copilot, droid) can be launched by name again — `sbx run kiro` resolves the pinned replacement kit and its stored credentials work without extra approval steps.
- `sbx run --provider` now accepts hosted models.dev providers, served through llmman.
- `sbx run --model` gains `--overflow-provider`/`--overflow-model` to pair a local model with a hosted one for oversized requests; `--provider` now works with codex for providers lacking the Responses API; codex sandboxes no longer spend seconds retrying WebSocket connections to the local model server.
- Claude Code sandboxes started with `sbx run --model` now use the model you selected instead of the harness's own default model.
- A slow first launch of the bundled llmman no longer fails `sbx run --model`.

### Kits and skills

- `sbx create`/`sbx run` now share skills read-only by default via a new tri-state `--skills=off|readonly|readwrite` flag; the retired `--no-share-skills` flag still works as a deprecated alias for `--skills=off`. There is also a new `skills.defaultMode` to set the desired default behaviour.
- Commit-pinned git kits now resolve offline from a local content-addressed cache, and every cache hit verifies the checkout against a per-file manifest, so a tampered cache entry is quarantined and refetched instead of being served.
- Signed git kits now verify on every host: a kit checkout is materialized from the commit's blobs alone, so smudge filters, line-ending conversion, LFS, hooks, and other host git configuration can no longer alter the checked-out bytes.
- Fixed kit-argument (`${{ kit.args.* }}`) substitution silently not applying when a kit reference is a symlinked directory.
- Kits can now be installed through registry mirrors configured with an explicit port.
- Hardened git kit cloning against command-line config injection (`GIT_CONFIG_PARAMETERS` and its numbered counterparts) carried in the inherited environment.

### Sandbox lifecycle and workspaces

- Add a last-used timestamp to `sbx ls --json` and Docker-style `until` filtering to `sbx prune`.
- Sandboxes created with `sbx create` now stop automatically after becoming idle.
- The minimum memory for a sandbox has been decreased to 512 MiB. Note: This is only suitable for shell use cases.
- Sandbox names are now validated to reject names longer than 63 characters or ending in a hyphen or period.
- `daemon inspect` and `inspect` will now show mount information.
- Clone-mode sandboxes now support shallow Git repositories.
- Fixed an issue where the `sbx` CLI could select the wrong repository during Git-related setup tasks, such as loading kits or configuring workspaces, when Git environment variables were set on the host.
- Fix UNC path resolution on Windows so that the same folder is identified correctly.
- SSH connections now remain bound to the original sandbox identity while preserving existing sandboxes during UUID migration.
- Windows clients can now connect to `sandboxd` through filesystem `AF_UNIX` sockets.
- The local daemon now verifies connecting operating-system users on Unix sockets and Windows named pipes.

### Authentication and credentials

- Docker sign-in now explains how to recover when macOS Keychain denies access to stored credentials.
- Fixed a bug where a single Docker Hub sign-in timeout could permanently lock the daemon out of Docker Hub, requiring a manual sign-in to recover.
- Concurrent sandbox creates now reuse one Docker Hub authentication request.
- Private registries can use an explicitly trusted cross-host authentication endpoint for sandbox pulls.
- `sbx secret rm --sandbox` now immediately revokes the removed credential from the sandbox proxy.
- Prevent `sbx exec` from synchronizing credentials that were not configured for the sandbox.
- Credential-binding consent now defaults to decline and clearly identifies when API-key secrets will be sent to new domains.
- Fixed the OAuth credential gate so a third-party kit re-declaring a built-in agent's OAuth service can no longer inherit that agent's trust and receive a real token without an explicit binding; sandboxes created before this fix now self-heal on the next daemon restart or kit add instead of requiring a manual recreate.
- Unrelated credentials no longer switch Claude sandboxes into Anthropic API-key mode.
- `sbx secret import` and `sbx secret ls` now list copilot's GitHub credential correctly.

### Networking and policy

- The CLI honors configured proxy settings for host-side HTTP requests, including login, diagnostic uploads, and update checks.
- Fix HTTP/2 upstream responses without bodies being incorrectly framed as chunked by the sandbox proxy.
- Hardened credential handling in the sandbox egress proxy so a client-supplied credential the proxy did not issue is not forwarded to managed provider hosts.
- Network allow rules for IP-literal targets (for example `sbx policy allow network [::1]:8080` or CIDR rules such as `10.0.0.0/8`) are enforced correctly again; the proxy no longer blocks them with a default-deny after the governance approval-callback migration.
- Fixed: agents no longer suggest `sbx policy allow` for a host blocked by an org-governed default-deny policy — it now reads as `Blocked by org policy`, same as an explicit org deny rule.
- The `balanced` policy preset now allows access to the NodeSource APT repository.
- Claude sandboxes can now access the Claude Code documentation.

### MCP

- `sbx mcp add` can now send custom request headers to remote MCP servers via `--header`, with header values substituted from the local secret vault.
- MCP authorization supports private OAuth discovery with `--skip-ssrf-check`, falls back to advertised common OIDC scopes, and honors `--no-scope` for local OAuth registrations.

### CLI, diagnostics, and updates

- Local `sbx` commands no longer wait on slow or unreachable update services before exiting.
- Plain `sbx version` invocations now return embedded version information without full CLI startup.
- `sbx diagnose` checks whether `mkfs.erofs` is usable and warns if its default block size exceeds the sandbox kernel's page size.
- `sbx diagnose` no longer reports a missing SSH `ProxyCommand` in Git Bash when the Windows OpenSSH configuration is healthy.
- The `tls.allowNegativeSerial` setting no longer prints an informational log line on every `sbx` command while remaining visible in daemon diagnostics.
- Terminal output now uses default text colors when the background theme cannot be detected.
- Fix terminal cursor flickering issue on Windows.
- Nightly and development builds now report a version based on the latest stable release instead of a release-candidate tag.
- `sbx@rc` brew users on macOS will be updated to the latest stable build when it is released.

## v0.42.1

Published 2026-09-07. https://github.com/docker/sbx-releases/releases/tag/v0.42.1

### What's New

### Bug Fixes
- Fix HTTP/2 upstream responses without bodies being incorrectly framed as chunked by the sandbox proxy.

## v0.42.0

Published 2026-09-07. https://github.com/docker/sbx-releases/releases/tag/v0.42.0

### Highlights

- BREAKING: `sbx ports --publish` and kit-declared ports now default to `tcp4` instead of dual-stack `tcp`, so a published port no longer listens on `::1` unless you name the protocol explicitly (`--publish 8080:3000/tcp`); this makes `http://localhost:<port>/` reach a sandbox service that listens only on IPv4.
- `sbx run` and `sbx create` now accept sandbox kit references as the agent positional: `sbx run <sandbox-kit-ref>`. The old form `sbx run <sandbox-kit-name> --kit <sandbox-kit-ref>` is deprecated; use the `--kit` flag for mixins.
- Sandboxes can now be created without a workspace bind mount by omitting the path in `sbx create`. Note that this only affects the `create` command; `sbx run` still defaults to mounting the current directory as the primary workspace.

### Security

- Fixed [CVE-2026-77179](https://www.cve.org/cverecord?id=CVE-2026-77179), a symlink vulnerability in the virtio-fs host server on macOS that could let a malicious guest read or modify arbitrary host files outside the shared workspace, potentially leading to code execution on the host.
- Fixed [CVE-2026-79994](https://www.cve.org/cverecord?id=CVE-2026-79994), a symlink race in the guest-to-host Unix domain socket relay that could let a malicious guest connect to arbitrary host Unix sockets outside the shared workspace, exposing data or host-side capabilities.

### What's New

### CLI
- Read-only `sbx` commands including `secret ls`, `version`, `mcp ls`, `skills ls`, `policy inspect` and the `kit` verification commands now accept `--json` for machine-readable output.
- Clipboard commands inside local sandboxes can now copy text to the host clipboard.
- Add, update, list, and remove sandbox skills directly from Git repositories with `sbx skills`.

### Environment files
- `sbx env` now reads a non-hidden `sbxenv.yaml` from a project directory and no longer falls back to a hidden `.sbxenv.yaml` there; it merges a `.sbxenv.yaml` from your home directory beneath the project file as defaults shared across projects.
- `sbx env` now shows a plan of everything an environment file changes on the host — host `lifecycle:` commands, credentials, bindings, MCP servers, workspaces, kits, ports and the sandbox itself — asks before applying it and asks again for every run of a command on this machine unless `env.rememberHostCommands` is set, binds the environment file read-only into the sandbox it describes, and reads a directory for `sbxenv.yaml` alone with `~/.sbxenv.yaml` as the user-level base beneath it.
- `sbx env`: an environment file that declares no `workspace:` now creates a sandbox with no workspace bind mount instead of mounting the directory holding the file; write `workspace: .` to mount the project directory.
- Environment files can now declare their own arguments in an `args:` block, referenced as `${{ env.args.NAME }}` and supplied with `sbx env --env-arg`; `${VAR}` interpolation in `.sbxenv.yaml` is no longer expanded.
- Relative kit paths in an environment file now resolve against the file's directory instead of the directory `sbx` was run from.
- `sbx env create` now shares imported skills by default and accepts display, GPU, and USB options in `sbxenv.yaml`.

### Daemon
- Sandboxes now get a 10 GB Docker volume instead of 50 GB, which significantly reduces host disk usage; set `DOCKER_SANDBOXES_DOCKER_SIZE` to change it.

### Agents
- Added Devin as a built-in agent.

### Kits
- Kits can now declare their arguments in an `args:` block and receive values with `--kit-arg name=value`, or `--kit-arg kit.name=value` to target a single kit.
- A `kits:` entry in sbxenv.yaml carries the arguments for that kit under `kits[].args`.

### Bug fixes
- Docker Sandboxes no longer opens the setup wizard automatically; run `sbx setup` to launch it explicitly.
- Fixed a vulnerability where a sandboxed process could get the daemon to open a host D-Bus transport and execute an arbitrary command on the host.
- On macOS, sbx now accepts a workspace path whose casing differs from the spelling on disk instead of failing to create the sandbox.
- Fixed a rare case where a spotty network right after your computer woke
from sleep could cause an unexpected Docker Hub sign-out.
- Agent crashes now identify the terminating signal and provide scoped recovery guidance.
- Fixed a vulnerability where a malicious sandbox could hijack another sandbox's OAuth login by pre-claiming its callback port.
- Removing or pruning a local sandbox now also deletes its sandbox-scoped secrets.
- `sbx secret ls` no longer prints a stored secret unmasked when its value happens to match one of the status labels the listing displays.
- `sbx` now warns when a stored credential is not sent to a sandbox because no binding authorizes it, instead of starting the sandbox and failing later with an authentication error.
- Fixed several MCP-related bugs.
- Standardized error message formatting for `sbx rm`, `sbx stop`, MCP authorization, and `sbx reset`.
- Sandbox and agent not-found errors now use one sentence pattern and quote style across commands: sandbox '<name>' not found.
- Docker Hub template pulls created through the TUI now use your Docker Sandboxes login credentials.
- `sbx ports --publish` now automatically starts stopped local sandboxes before publishing ports.
- Docker volume sizes below 512 MiB are now rejected before sandbox creation.
- Creating a sandbox from a Docker Hardened Image template no longer results in a delay.
- Fixed OAuth authentication for custom agent kits that declare resource hosts without a fallback API key.
- Kits can now set a sandbox's CPU and memory limits through the `sandbox.resources` block in their spec.
- Fixed SSH connections from editors by keeping non-interactive probes quiet and delivering their exit status before closing the channel.
- Deleting a sandbox now reliably reclaims its disk volumes, and creating a new sandbox that reuses a deleted sandbox's name no longer inherits its files, Docker images, or agent session history.
- Running `sbx setup` explicitly no longer causes the setup screen to appear again on the next interactive command.
- Fixed sandbox connections to a server that sends data first — including passive FTP transfers and a serial console relayed to the host — failing with a timeout instead of receiving the server's output.
- `sbx kit push` no longer uploads an empty payload layer for kits that ship no files.
- `sbx kit push` now authenticates from the sbx credential store, so a single `sbx login` or `docker login` is enough for pushing, signing, and attaching provenance.
- Kits using `extends:` now inherit the parent's setup commands, credentials, network allowlist, volumes, and environment variables instead of replacing them when the child declares its own.
- Fixed Docker Hub credential refresh retrying without backoff after a rate limit, and a non-interactive login discarding the stored OAuth refresh token.
- Nightly Homebrew installs no longer fail with checksum mismatches while a nightly publish is in flight: the sbx@nightly cask now downloads from immutable per-build release URLs.

### Other
- Docker Sandboxes now provides a machine-wide Windows MSI for administrator-managed installations.
- A declined `@requireApproval` prompt on a local MCP server now gets its own audit record, with policy attribution and a context digest, instead of leaving the original approval-required decision as the only trace of the exchange.
- A registry mirror configured with `platform.images.registryMirror` is now also used by Docker running inside a sandbox, when the value is a bare host (no path prefix) that is not a loopback or wildcard address.
- `sbx version --json` now reports a `server.state` of `running` or `unavailable`, so scripts can check whether the backend was reachable without parsing the error text.
- SSH agent forwarding can be explicitly disabled and use either each client's current agent socket or a fixed socket path.
- `sbx` terminal output now adapts colors for light terminal backgrounds and
uses a distinct pink spinner glyph; CJK and combining-mark column widths in
table output are now measured correctly; piped and JSON output is unchanged
for ASCII-only content.
- `sbx mcp add` now accepts `--skip-auth` (the old `--skip_auth` still works), and a `--url` on a private, loopback, or cloud-metadata address is resolved and registered with a warning instead of being rejected.
- On Linux hosts without an available OS keychain, newly stored secrets are now read and written much faster; secrets already on disk keep their previous cost until they are next written.
- Fixed a gateway defect where a remote MCP server's reconnect could silently wipe its tool routing, causing the server's tools to disappear from agents and be denied by organization MCP policy as unrecognized built-in tools until the daemon was restarted.
- Docker Sandboxes can now upload a diagnostics bundle automatically when the daemon hits an error, after you opt in.
- Governance resolution issues are now shown in sbx policy output and the dashboard.
- `sbx mcp auth` now requests only the scopes you chose (or the set the resource itself requires, suppressible with the new `--no-scope` flag) instead of every scope a server advertises, explains which scopes a server refused along with a narrower retry command, and reports the scope sets of an existing grant in `sbx mcp auth status`: what was granted, what was requested, and what the server supports — with scopes sorted, duplicates collapsed, and differences such as unrequested or no-longer-advertised grants called out.
- Sandbox listing and creation output now share one rendering package; on a terminal, `sbx ls` column headers are now styled bold.
- Sandbox agent instruction files no longer include generic language-specific development guidance.
- The sandboxd runtime state directory left behind by versions before v0.25.0 is now migrated to its current name instead of being used in place.

## v0.39.0

Published 2026-08-19. https://github.com/docker/sbx-releases/releases/tag/v0.39.0

### Highlights

**Declarative sandbox environments.** Define a complete, reproducible sandbox in a `.sbxenv.yaml` file, including the agent, workspace, kits, environment variables, secrets, registry credentials, ports, and resource limits. Commit the file with your project so contributors can launch the same environment with `sbx env run`. This feature is experimental.

### What's New

### Sandbox environments
- Use `sbx env run` to provision an environment from `.sbxenv.yaml` and open an interactive session.
- Use `sbx env create`, `sbx env exec`, and `sbx env rm` to manage the environment lifecycle.
- Combine multiple environment files for shared configuration and local overrides.
- Reference host environment variables in environment files for machine-specific paths and credentials.
- See the [sandbox environment files documentation](https://docs.docker.com/ai/sandboxes/sandbox-environments/).

### CLI
- Add an experimental `--usb` flag to `sbx create` behind the `DOCKER_SANDBOXES_FEATURE_SANDBOX_USB` environment variable to re-attach the specified USB devices. They will be available inside a sandbox via usbfs. Linux x86_64/ARM64 only.
- sbx run --model now selects the Ollama backend via a new `--provider ollama` flag instead of an `ollama/` prefix on the model name.
- Stopped sandboxes can now be cleaned up in bulk with `sbx prune`, which never removes a running sandbox and can filter on how long each has been stopped.
- `sbx run` and `sbx create` now accept `-e`/`--env` and `--env-file` to set environment variables in a sandbox, following `docker run` precedence rules.

### Secrets
- `sbx secret set` and `sbx secret set-custom` can now configure dynamic secrets that resolve values from a reference or command, with options to control refreshing, verification, and error output.
- On Linux hosts without an available OS keychain, newly stored secrets are now read and written much faster; secrets already on disk keep their previous cost until they are next written.

### Daemon
- Sandboxes now expose their own identity as `SANDBOX_NAME` and `SANDBOX_ID` environment variables, matching the name and id shown by `sbx ls --json`; the older `SANDBOX_VM_ID` still carries the sandbox name but is deprecated.

### Networking
- Claude Code's `/remote-control` can now be used inside sandboxes by enabling `claude.remoteControl` setting: `sbx settings set claude.remoteControl true`.

### Bug Fixes
- sandboxd now removes the sandbox container immediately when container startup fails, so an interrupted `sbx create`/`sbx run` is less likely to leave the sandbox name unusable.
- Agent kits that declare a persistent volume without a size now get a 512 MB volume instead of a 50 GB one, which significantly reduces sandbox disk usage on the host.
- `sbx` now reports a clear error for an unrecognized command, subcommand, or `sbx help` topic instead of printing help and succeeding, and reports a mistyped command without first asking an unauthenticated user to sign in.
- Claude sandboxes now use around 3.9 GB less disk space on the host.
- Claude sandboxes can connect to required Anthropic services when using the locked-down network policy.
- `sbx kit inspect` now describes kits using kit-spec v2 field names and lists any deprecated fields a kit still relies on, and `sbx kit validate` now rejects OAuth credentials missing sentinels, a service, or a credential-file body.
- DNS lookups in a sandbox now succeed for any host that network policy allows on any port, including hosts allowed only on a non-standard port such as `myhost:2222`.
- `sbx template load` now fails with an error when an image import does not complete, instead of reporting success.
- Correct the `sbx create --name` help text and CLI reference, which incorrectly listed plus signs as valid sandbox-name characters and omitted the leading-alphanumeric and two-character-minimum rules.
- `sbx reset` now removes the Docker Sandboxes-managed block from `~/.ssh/config`.
- `sbx` now reports the exit code when a sandbox container dies at startup, and rejects a template image built for a different CPU architecture with a clear message instead of failing after a 30-second wait.
- Signing in to Claude Code with an Anthropic Console API key now succeeds on repeat logins instead of failing with a 401 error.
- Fixed `sbx cp` failing on Windows when the local path has no directory component (e.g. `sbx cp file.txt sandbox:/tmp/`).
- `sbx daemon restart` now starts the daemon again after a stop that reports a failure but leaves no daemon running.

### Other
- `sbx diagnose` now reports free disk space on the volume holding sandbox data, and diagnostics bundles include host disk totals.
- `sbx diagnose` now detects broken, shadowed, or stale SSH client configuration.
- Add a `platform.images.registryMirror` setting that redirects Docker Hub-resolving sandbox template and kit images to an organization's registry mirror.
- Filesystem policy denials now include the organization's support contact message, matching network denials.
- sbx now reports when the host cannot provide a hypervisor — including a Windows installation running inside a virtual machine without nested virtualization — instead of a generic "failed to run sandbox container" error, and `sbx diagnose` now checks host virtualization support.
- Kits can now be signed and verified with cosign-compatible Sigstore signatures via `sbx kit sign` / `sbx kit verify`, with optional policy enforcement at load time.
- OAuth kits can declare their credential file with the declarative `credentialFile.structure` form, rendered to well-formed JSON, instead of a free-form Go template.
- Ubuntu 25.10 packages are no longer published; Ubuntu 25.10 is end-of-life.

## v0.38.0

Published 2026-08-06. https://github.com/docker/sbx-releases/releases/tag/v0.38.0

### Highlights

**Kit spec v2.** A new schema is available for authoring kits, with a clearer structure for setup, permissions, agent instructions, networking, and credentials. Use `schemaVersion: "2"` for new kits; existing v1 kits continue to load through the legacy path. See the [kit spec reference](https://docs.docker.com/ai/sandboxes/customize/kit-reference/#schema-versions) for migration details.

**MCP management is now a first-class feature.** Register remote or local MCP servers once with `sbx mcp`, then reuse them across supported agents and sandboxes through a built-in MCP gateway. OAuth credentials stay on the host, and organizations can govern server registration and tool calls with Cedar policies. See the [MCP gateway documentation](https://docs.docker.com/ai/sandboxes/mcp-gateway/).

### What's new

### CLI

- `sbx create` and `sbx run` show detailed structured progress during startup, including environment files loaded, resources provisioned, and each kit command's outcome; kit-install progress streams live during `sbx create --kit`.
- Added `sbx daemon restart` to stop and restart the sandboxd daemon in the background.
- `sbx inspect` now displays custom secrets configured for a sandbox.
- `DOCKER_SANDBOXES_CLONED_WORKSPACE_SIZE` configures the size of the cloned workspace volume.
- `sbx setup ssh` warns when `ssh` is missing from PATH, and on Windows when `sh` (required by Claude Desktop's SSH ProxyCommand) is missing.
- Port publishing failures now identify the affected host port and explain when the OS requires extra daemon privileges.

### MCP

- The `sbx mcp` subcommand is now available for managing MCP servers.
- Includes dynamic MCP tools (`mcp-find`, `mcp-add`, `mcp-config-set`) for attaching registered servers to sandboxes.
- Govern MCP servers and tools for your organization using Cedar policies.

### Networking & policy

- `--deny-network HOST` on `sbx run` and `sbx create` records per-sandbox network deny rules at creation time, with layer-aware egress messages.
- `sbx policy allow network` reports a clear "managed by your organization" error when org governance overrides the local allow, and failed rule removals now explain what went wrong using a single rule identifier.
- Signing in refreshes organization policies in the running daemon immediately instead of waiting for the next polling interval.
- IP-literal destinations denied by a CIDR rule fail fast with a policy message instead of timing out.
- Blocked HTTPS proxy connections appear in `sbx policy log` even when the client aborts the TLS handshake.

### Secrets & credentials

- Service and custom secrets are global by default, with `--sandbox` for sandbox scope; legacy positional and `--global` forms are deprecated with warnings.
- Sandbox-scoped GitHub credentials added after creation now work without recreating the sandbox.
- Pressing Ctrl+C while entering a secret cancels the command without saving it.

### Agents

- Docker Agent and OpenCode sandboxes can authenticate GitHub Copilot requests with proxy-managed GitHub credentials.
- Codex sandboxes created from the TUI prefer stored OpenAI OAuth credentials over API keys; kit environment variables now reach cloud agents, and git no longer hangs Codex startup prompting for credentials.
- Shared agent skills: directory symlinks under the skills folder are resolved and their contents imported.

### Kits & templates

- Kit specs use the new v2 grammar.
- Kits using `extends` correctly inherit and override the base image or build source of their parent.
- Kit install commands can consume static files from `files/home`, including binary files.

### Packaging

- Homebrew installs from a stapled `.dmg` artifact rather than a `.tar.gz` archive, improving Gatekeeper compatibility on macOS.
- Windows: the running sandboxd daemon is stopped during a WinGet/MSI upgrade so client and server end up on the same version.

### Security

- Claude Desktop SSH sessions no longer expose Desktop OAuth access tokens inside sandboxes.
- Fixed a destination-escape flaw in `sbx cp` copy-out (CVE-2026-17106).
- The daemon's loopback egress proxy only serves the daemon's own traffic, preventing other local users on a multi-user host from reaching the configured upstream proxy through it.

### Bug fixes

- Fixed a hang where sandboxd stopped answering all endpoints and could not be stopped without SIGKILL after a crash; fatal daemon tracebacks are now included in `sbx diagnose --upload` bundles.
- Fixed intermittent sandboxd startup failures when a running daemon was slow to answer its health check.
- Fixed `sbx daemon stop` hanging when an idle SSH session (for example, Claude Desktop) was connected to a sandbox.
- sandboxd automatically repairs a corrupted local image cache by re-pulling the image, and otherwise reports a clear "run `sbx daemon reset`" error.
- Fixed recreate failures ("base image not found") after daemon restarts when swapping a sandbox's container via `sbx kit add`; recreates self-heal by recomposing from the sandbox's template.
- Fixed reverse DNS (PTR) lookups from sandboxes returning NXDOMAIN for container-resolved addresses.
- Fixed a goroutine and network-endpoint leak from hijacked HTTP CONNECT tunnels that could eventually stall sandbox creation after many delete/recreate cycles.
- Fixed an intermittent 500 error when deleting a sandbox while its network endpoints were being torn down.
- The daemon restores saved sandboxes' network proxies in parallel on restart, speeding up startup with several sandboxes and fixing a potential crash during first-run policy application.
- Fixed host `.git/config` corruption when creating a sandbox for repositories using `includeIf` directives in `~/.gitconfig`; the sandbox now writes git identity only to the container's gitconfig.
- `sbx skills` shows a single usage form and clearer help for importing shared agent skills.
- sbx no longer reports that a stored credential was not injected when the daemon injects it.

### Experimental features

### Enterprise networking

Settings-driven upstream-proxy configuration with separate sandbox and daemon scopes, integrated NTLM/Kerberos proxy authentication on Windows.

- Configure separate proxy settings for sandbox and daemon traffic using `proxy`, `proxy.sandbox`, `proxy.daemon`, and the matching `no_proxy` settings. These default to the host operating system's proxy settings. The daemon's own traffic, including image pulls and telemetry, also uses the configured proxy.
- On Windows, sbx can authenticate to upstream proxies that require integrated NTLM or Kerberos/Negotiate authentication. Enable this behavior with the `proxy.integratedAuth` setting.
- If a TLS-inspecting proxy issues certificates with negative serial numbers, enable compatibility with `sbx settings set tls.allowNegativeSerial true`, then restart the daemon.

### GPU passthrough

Run a sandbox with NVIDIA VFIO GPU passthrough on Linux using `sbx run --gpu`. Enable this feature with `sbx settings set feature.sandbox-gpu true`.

### Local models

Run Claude Code against a local GGUF model with `sbx run --model <name> claude`. To use a model from an existing Ollama installation, prefix the model name with `ollama/`. See [Claude Code > Use a local model](https://docs.docker.com/ai/sandboxes/agents/claude-code/#use-a-local-model).

## v0.37.1

Published 2026-07-29. https://github.com/docker/sbx-releases/releases/tag/v0.37.1

### Highlights

This patch release stops SSH sessions from **forwarding credential environment variables into sandboxes by default**. Variables such as `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `GH_TOKEN` are no longer sent from the client to the sandbox unless explicitly allowed via the `ssh.acceptEnv` setting.

### What's New

### Bug Fixes
- SSH sessions no longer forward credential environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GH_TOKEN`, ...) from the client into the sandbox by default; use the `ssh.acceptEnv` setting to opt back in for specific variables

## v0.37.0

Published 2026-07-24. https://github.com/docker/sbx-releases/releases/tag/v0.37.0

### Highlights

**SSH access to sandboxes (experimental).** Docker Sandboxes can now be used as SSH targets. After enabling SSH access, run `sbx setup ssh` once, then connect to an existing sandbox by name with `ssh my-sandbox.sbx`. Use the connection for interactive shells, one-shot commands, and SSH-based remote development.

**Shared agent skills.** Docker Sandboxes can now import skills from supported host agents into a persistent store shared across sandboxes. Run sbx skills import to import them. New sandboxes mount the store read-write by default; use --no-share-skills to opt out.

### What's New

### SSH

- `sbx setup ssh` adds a managed `*.sbx` entry to your SSH config, making existing sandboxes available at `<name>.sbx`.
- SSH connections start the local Docker Sandboxes daemon and the target sandbox automatically when needed.
- Connect using OpenSSH-compatible clients and remote-development tools such as VS Code, Cursor, Claude Desktop, and ChatGPT.

### Shared skills

- `sbx skills import` discovers and imports skills from the host and makes them available to sandboxed agents. Use `--dry-run` to preview imports and `--force` to replace existing skills.
- Imported skills persist after sandbox deletion and are mounted into new sandboxes for supported agents.
- Pass `--no-share-skills` to `sbx run` or `sbx create` when creating a sandbox to opt out.

### CLI
- `sbx create` and `sbx run` accept `-p/--publish` to publish sandbox ports at creation time.

### Networking & Policy
- `DOCKER_SANDBOXES_PROXY=system` routes sandbox egress through the host operating system's proxy configuration (macOS/Windows), including any PAC auto-config URL.
- Governance-policy denials can now display an organization-configured support message (for example, who to contact).

### Security & Audit
- Audit now emits execution-outcome records for network egress (per allowed connection) and filesystem mounts (per allowed path) — success, latency, and error class — alongside the policy-attributed decision records.
- sandboxd excludes itself from Windows Error Reporting so daemon crash dumps cannot capture in-memory credentials.

### Performance
- `sbx secret ls` and sandbox startup are faster on Linux hosts without an OS keychain — stored secrets are no longer all decrypted just to list or resolve credentials.

### Bug Fixes
- Fixed sandboxd failing to start on Linux hosts without an OS keychain, where the on-disk secret store's key derivation could peg a CPU during startup and the CLI would kill the still-starting daemon.
- Fixed an intermittent "failed to fully delete sandbox" error when removing a running sandbox, caused by a network-teardown race with the engine's endpoint cleanup.

## v0.35.0

Published 2026-07-10. https://github.com/docker/sbx-releases/releases/tag/v0.35.0

### Notice

There are no Linux/ARM64 builds for v0.35.x due to stability issues that were encountered during this release. We plan to bring them back for the next release.

### Highlights

- **Host environment variables are no longer used for authentication.** Previous versions automatically detected API keys in predefined environment variables (such as `ANTHROPIC_API_KEY`) and injected them into model provider requests. Starting with this release, sandboxes only authenticate using credentials you've explicitly stored, or OAuth for agents that support it. If you relied on environment variables, run the new `sbx secret import` command once to move your keys into the keychain. See the [credentials documentation](https://docs.docker.com/ai/sandboxes/security/credentials/) for details.
- Policy commands are revamped with a more concise `sbx policy ls`, a new `sbx policy inspect`, and a `sbx policy check network` command for testing whether the current policy would allow an access request before you run. 
- Networking gains a **SOCKS5 upstream-proxy transport**.  

### What's New

### Networking & Proxy
- The sandbox proxy can chain upstream egress through a SOCKS5 proxy (`socks5://` / `socks5h://`, with optional auth) via `DOCKER_SANDBOXES_PROXY`, `HTTP_PROXY`, or `HTTPS_PROXY`.
- Add `DOCKER_SANDBOXES_NO_PROXY` to exclude destinations from `DOCKER_SANDBOXES_PROXY`, using standard `NO_PROXY` matching semantics.
- Droid OAuth credentials are now proxy-managed: real tokens stay on the host and never land in the sandbox.
- Faster sandbox startup: the TLS-proxy CA is installed by merging into the trust bundle instead of running `update-ca-certificates`, saving several hundred milliseconds.

### Policy
- Simplify `sbx policy ls` and add `--wide`, `--source`, and `--decision` filters
- Add `sbx policy check` to test whether the current policy would allow an access request
- Balanced network preset now allows VS Code domains, Azure Blob Storage (`*.blob.core.windows.net`), and `dhi.io` over HTTP.

### Kits
- `sbx kit add` now recreates the sandbox container with the augmented kit set instead of injecting at runtime. State is preserved with the re-creation.
- `sbx kit add` applies the added kit's network allow/deny rules and composed policy on the running sandbox.
- Re-attaching to a sandbox created from a custom `--kit` agent now works with `sbx run --name <name>` without re-passing `--kit`.
- Kits can inject the user's Docker login token into requests to docker.com hosts via a credential with service `sbx-login`.

### CLI
- `sbx rm` now won't delete an active session unless `--force` is passed.
- `sbx inspect` now lists the sandbox's kits, injected secrets, and sandbox information.
- Added `sbx daemon` command (`start`, `stop`, `status`, `log-level`)

### Secrets
- `sbx secret import` imports credential env vars into the keychain; `sbx secret ls` flags env-only and OAuth-shadowed entries. Host env vars no longer auto-inject at runtime — use `sbx secret import` to migrate.

### Runtime & images
- Enable virtiofs caching by default on all operating systems by default for faster filesystem performance (`DOCKER_SANDBOXES_ENABLE_VIRTIOFS_CACHE=0` to opt out).

### Bug Fixes
- Fix "container not found" errors when copying files with `sbx cp` on a sandbox that has had a kit added.
- Enforce the one-credential-per-service rule on credential capture paths so a stale API key no longer shadows a newly captured credential.
- Fix `sbx login` failing with "The specified item already exists in the keychain" when signing back into a previously used account; logout now clears all stored Docker credentials.
- Restarted sandboxes keep GitHub access by rehydrating the stored `github` credential on daemon restart.
- Fix a custom kit clearing the proxy's built-in GitHub auth header mapping for the whole daemon until a restart.
- Tunnel plain-HTTP forward traffic (e.g. `apt`, port 80) via CONNECT when the upstream proxy only supports CONNECT.
- Sandbox egress through an upstream proxy identifies as `sbx-proxy` on the CONNECT handshake.
- Fix IPv6 policy allow rules using bracket notation (e.g. `[fdcb::1]:22`) not matching.
- Fix `sbx` connecting to the wrong Docker daemon when `DOCKER_HOST` is set in the environment.
- Serialize Docker Hub token refresh across the CLI and daemon so sign-in sessions aren't unexpectedly lost.

### Platform support
- Block installation on Windows versions older than Windows 11 (the only currently supported version).

## v0.34.0

Published 2026-06-26. https://github.com/docker/sbx-releases/releases/tag/v0.34.0

### Highlights

Kit installs are now restricted to an allowlist of sources, defaulting to Docker Hub only — a **breaking change** if you install kits from a Git URL or another registry.

This release also renames `sbx policy set-default` to `sbx policy init`, restores published ports when a sandbox restarts, fixes a number of bugs, and adds two experimental previews: a native SSH endpoint and an `sbx setup` command for smoother first-time onboarding.

### What's New

### SSH
- Add an experimental native SSH endpoint in sandboxd: connect with `ssh <sandbox-name>@127.0.0.1 -p 2222` (publickey auth, connect-to-create, interactive shell and exec; no SFTP yet). Enable with `sbx settings set feature.ssh true`.

### Setup & Onboarding
- Add an experimental `sbx setup` command that imports agent credentials from environment variables.

### Agents
- Cursor sandboxes no longer show the workspace trust prompt on launch.

### Kits
- Add OCI v2 kit artifact streaming that decompresses the layer once to a cache directory and uses seek-based random access, so file content is not held in memory between reads.
- Restrict kit installs to an allowlist of sources, defaulting to Docker Hub (`docker.io/`) only.

  **Breaking:** installing a kit from another registry or a Git URL fails until you add its prefix with `sbx settings set kit.allowedSources`. See [Docs: Restrict kit sources](https://docs.docker.com/ai/sandboxes/customize/kits#restrict-kit-sources) for details.

### CLI & Behavior Changes
- Rename `sbx policy set-default` to `sbx policy init`; the old name keeps working as a hidden, deprecated alias.
- Published sandbox ports are restored on restart, and the CLI/TUI can recover explicit host-port conflicts by choosing a new host port.

### Bug Fixes
- Fix a daemon hang where a slow or stuck sandbox creation/deletion blocked `sbx ls`, the TUI, and new sessions until the daemon was restarted.
- Fix a kit mixin regression where adding `network.serviceDomains` for a service already provided by the base agent failed with a "credential … defined in both" error.
- Reject `+` in sandbox names with a clear validation error instead of panicking.
- Fix the interactive host-port conflict recovery prompt not appearing on Windows when restarting a sandbox whose published port is already in use.

## v0.33.0

Published 2026-06-17. https://github.com/docker/sbx-releases/releases/tag/v0.33.0

### Highlights

`sbx run --name <sandbox>` now re-attaches to an existing sandbox by name. You can now also create multiple sandboxes of the same agent type and workspace by specifying unique sandbox names with `--name`.

Consequently, re-attaching to existing sandboxes with `sbx run <name>` is deprecated; the preferred form is `sbx run --name <name>`. The positional argument for `sbx run` should be an agent (e.g. `claude`, or `codex`). Sandbox name as the positional argument for run is still supported but will be removed in a future release.

This release also improves network isolation and policy enforcement. Sandbox DNS is now gated on network policy (closing a DNS-based exfiltration channel), ICMP egress is blocked across daemon restarts, and the MITM proxy publishes a CRL so revocation-strict clients keep working.

### What's New

### Sandbox Identity & CLI
- `sbx run --name` now identifies a sandbox independent of the working directory: run multiple independently-named sandboxes in the same workspace, re-attach from any directory (agent may be omitted), and re-run a create command to re-enter. It no longer auto-creates numbered sibling sandboxes, prompts before entering a same-named sandbox from a different workspace, and errors when the requested agent doesn't match the named sandbox. The TUI follows the same rules.
- `sbx run <sandbox>` now prints a deprecation warning when re-attaching to an existing sandbox; use `sbx run --name <sandbox>` instead.
- `sbx ls --json` now reports a stable per-sandbox `id`.
- `sbx create` now fails with a clear missing-agent error when run without arguments.
- `sbx exec` now uses the same working directory as `sbx run`.
- `sbx cp -L` now follows symlinks in the source path for sandbox-to-host copies.
- Daemon inspect output is now included in the diagnostics bundle.

### Networking & Proxy
- Sandbox DNS lookups are now gated on the network policy: a sandboxed process can no longer resolve domains that policy denies, closing a DNS-based data-exfiltration channel. Loopback names (e.g. `localhost`) are exempt to avoid breaking local OAuth callback flows. [CVE-2026-12039](https://www.cve.org/CVERecord?id=CVE-2026-12039)
- Outgoing ICMP from sandboxes is now blocked across daemon restarts. [CVE-2026-12539](https://www.cve.org/CVERecord?id=CVE-2026-12539)
- CIDR subnet allow rules (e.g. `sbx policy allow network 10.10.14.0/24`) now correctly permit traffic to IP addresses within the subnet.
- The MITM proxy now publishes a CRL and embeds a CRL distribution point in generated certificates, fixing clients that require certificate revocation checking (e.g. .NET `CheckCertificateRevocationList=true`).
- Removed the bracketed `[::1]` entry from the sandbox `NO_PROXY` default, fixing credential injection for HTTP clients that mis-parsed it.
- Claude connectors (Slack, Gmail, Notion, Atlassian, etc.) now work inside sandboxed Claude Code without manual policy overrides.

### Secrets & Credentials
- `sbx secret set-custom --host`, and `serviceDomains` in kits, now accept wildcard host patterns (`*` matches one label, `**` matches any number) and is repeatable, so one custom secret can cover multiple subdomains/domains.

### Agents
- Cursor OAuth is now supported

### Platform & Performance
- The virtiofs cache is now enabled by default on macOS and Linux.
- Build packages for `linux/arm64` are now produced.
- On Linux, the keychain backend now falls back to the encrypted on-disk store when `dbus-launch` is unavailable, fixing headless/server hosts.

### Bug Fixes
- Suppress a misleading warning when saving OAuth credentials while the daemon is not running.
- Fixed a TTY sizing issue on Windows.
- Keep agent entrypoint flags when arguments after `--` are themselves flags.
- Inject git identity from subdirectories and `[include]`d Git config when cloning.
- Proxy service detection now supports middle-position wildcards.
- Sandboxes blocked by mount policies are no longer filtered out on daemon startup.

## v0.32.0

Published 2026-06-09. https://github.com/docker/sbx-releases/releases/tag/v0.32.0

### Highlights

**[Audit logging](https://docs.docker.com/ai/sandboxes/governance/audit/)**: Sandboxes now emit structured JSONL audit records for policy decisions. Records are written to a per-OS log directory and can be forwarded to any SIEM platform for enterprise compliance workflows. Requires a Docker AI Governance subscription.

**[Sign-in enforcement](https://docs.docker.com/ai/sandboxes/governance/sign-in-enforcement/)**: Administrators can now require Docker organization membership verification. Enforcement is deployed via standard endpoint management tooling: configuration profiles on macOS, the registry on Windows, and a JSON policy file on Linux. This closes the gap for organizations that need to ensure only authenticated, authorized users run AI coding agents.

### What's New

### CLI
- Offer an interactive "Sign in with ChatGPT" OAuth flow on the first `sbx create`/`sbx run codex` when no Codex credentials are configured.
- Pre-select `balanced` as the highlighted default in the first-run network policy prompt, so pressing Enter accepts the recommended policy.
- Make global the default scope for `policy network allow|deny` and `policy rm`; add `--sandbox` to target a specific sandbox and drop the `-g/--global` flag.
- Simplify `sbx version` to a single line by default; gate detailed information behind `-D/--debug`.
- Unhide `sbx secret set-custom`, a command for [setting custom secrets](https://docs.docker.com/ai/sandboxes/security/credentials/#custom-secrets), and mark it as experimental.

### Secrets
- Add OpenRouter as a built-in service provider, so `sbx secret set <sandbox> openrouter` works without `set-custom` and the proxy injects `Authorization: Bearer <token>` automatically.
- Fall back to an encrypted on-disk secrets store on Linux/WSL hosts where no working keychain is available, with a one-time warning on secret-writing paths including `sbx login`.
- Substitute custom-secret sentinels inside HTTP Basic auth payloads, so credentials referenced in `Basic` Authorization headers are resolved like other sentinel shapes.

### Networking
- Hide inactive governed policy rules by default in `sbx policy ls` and the TUI Network Rules view, with governance/sync status, hidden-rule indicators, and an `--include-inactive` flag (TUI `i` toggle) to reveal them.
- Route OAuth/browser-open requests to the caller's graphical session, fixing `/login` opening on the host's display instead of the SSH terminal that invoked it.

### Kits
- Support the v2 OCI kit artifact format end-to-end, so kits are standard OCI images that registries and OCI tooling (Hub, `oras`, `crane`, `skopeo`) can introspect without kit-specific knowledge.
- Write `files/workspace/<path>` kit entries correctly when `sbx run --clone` is used; previously the file hook fired before the in-container clone populated the workspace and failed the sandbox start.

### Performance
- Keep virtiofs caching enabled for sandboxes using `--clone`, avoiding a FUSE round-trip on every `stat()` and speeding up `git status`, `grep -r`, and tree walks inside the sandbox.

### Packaging
- Require the system keyring dependency in Linux packages so credential storage works out of the box.

### Documentation
- Replace stale `--branch`/worktree guidance in generated agent guidance (CLAUDE.md/AGENTS.md) with `--clone`, including how to sync host commits via `/run/sandbox/source`.

### Bug Fixes
- Fix an issue with `sbx secret set <sandbox> <service>` silently dropping credentials while reporting success.
- Migrate stale runtime `SocketPath` references on daemon restart, so sandboxes upgraded from v0.31.0 stay visible to `sbx ls` after `/tmp` is cleaned.
- Keep non-interactive `sbx exec` output intact by not tearing down the attach-exec bridge on stdin EOF (no more spurious empty output with exit code 0).
- Clear stale pending status in the TUI when a network deny rule is deleted, so a host no longer shows as Blocked after its rule is removed.
- Bind MCP gateway state to the daemon-assigned runtime instance so a same-name sandbox recreate cannot leave Claude pointed at a stale gateway port.
- Set the default network policy before launching the TUI to avoid spurious 412 errors from policy-rule requests.
- Stop counting expected `rm`/`stop`/list-ports "not found" 404s as analytics failures, so routine existence checks no longer inflate error dashboards.
- Require a daemon restart (instead of failing with `405 Method Not Allowed`) when downgrading the CLI below a newer running daemon.

## v0.31.3

Published 2026-06-03. https://github.com/docker/sbx-releases/releases/tag/v0.31.3

### Bug Fixes

- Fix a failure to start sandboxes that were created with older versions of the CLI.
- Fix a file descriptor leak on Linux. Each credential lookup left a session
  D-Bus socket open, so long-running processes (such as the daemon) could
  gradually accumulate open file descriptors and eventually hit the session
  bus's connection limit, failing with "The maximum number of active
  connections has been reached." Connections are now closed after each
  operation. macOS and Windows were not affected.

## v0.31.2

Published 2026-06-01. https://github.com/docker/sbx-releases/releases/tag/v0.31.2

### Highlights

This patch release resolves two reliability issues. It **fixes a Windows issue** where odd default sandbox memory values could lead to startup timeouts. It also includes a **daemon-compatibility fix** that prevents a silent failure (`405 Method Not Allowed`) when the `sbx` CLI is downgraded while a newer `sandboxd` daemon is still running — the CLI now requires a daemon restart instead.

### What's New

### Bug Fixes
- Fix a Windows issue where odd default sandbox memory values could lead to startup timeouts.
- Require a daemon restart when downgrading the CLI below a running daemon, instead of silently proceeding into a `405 Method Not Allowed` error.

## v0.31.1

Published 2026-05-29. https://github.com/docker/sbx-releases/releases/tag/v0.31.1

### Bug fixes

- Fixes a bug introduced in v0.31.0 where sandboxes from earlier versions were not listed by sbx ls and could fail to run. Upgrading to v0.31.1 restores them.

## v0.31.0

Published 2026-05-28. https://github.com/docker/sbx-releases/releases/tag/v0.31.0

### Highlights

### Clone mode: `--clone`

The `--branch` flag has been removed in favor of `--clone` (clone mode). Using `--branch` now fails with:

```console
$ sbx run claude --branch foo
ERROR: --branch is no longer supported; use --clone instead
```

Clone mode does not create a branch or worktree on your behalf — instead of a host-side worktree, the sandbox now runs against an in-container read-only clone.

- Your source repository is mounted into the sandbox read-only, and the shallow clone sets that mount as a Git remote. The agent only ever writes to the in-container clone, never to your working tree or .git/
- The clone lives on the sandbox's filesystem and is exposed back to the host as a `sandbox-<name>` Git remote served by `git-daemon` (no more `.sbx/<name>-worktrees/...` on the host).
- Forge remotes (`origin`, `upstream`, etc.) on the host are propagated into the in-container clone, so the agent can `git push origin` directly, the same way you would. Local-path remotes are skipped.
- Fetched sandbox refs are mirrored into `refs/sandboxes/<name>/*` on the host and persist after the sandbox is removed. Restore a branch from a removed sandbox with `git branch <local-name> refs/sandboxes/<name>/<branch>`. Commits that were never fetched, or uncommitted changes, are still lost on `sbx rm`.
- The `sandbox-<name>` remote is added to your host on `sbx create --clone` / `sbx run --clone` and removed on `sbx rm`, including across stop and restart.

### What's New

### CLI
- `sbx create` auto-starts the daemon when it isn't already running.
- `sbx logout` now stops the daemon and running sandboxes.
- Unify terminal environment variables across `sbx run` and `sbx exec`.

### Policies
- Show policy and rule names in CLI list output and TUI details.
- Add filters to the policies listing.

### Kits
- Mark kits as experimental.
- Verbose error reporting for kit apply failures.

### Sandboxes
- Opt a sandbox into virtiofs caching at create time via `DOCKER_SANDBOXES_ENABLE_VIRTIOFS_CACHE=1` (off by default; the choice is persisted in the spec and survives daemon restarts).

### Networking
- Allow public-CA CRL/OCSP/AIA endpoints in the balanced proxy preset. Applies to new installations or after `sbx policy reset` (which removes any user-added rules).

### Telemetry
- Surface `port_publish_failed` inner error detail.

### Secrets
- Store container-registry pull credentials with `sbx secret set --registry`, so `sbx run --template` and `sbx run --kit` can pull from private registries (GHCR, ACR, ECR, Quay, …) without a `docker login`. Manage entries with `sbx secret ls` and remove them with `sbx secret rm --registry <host>`.

> [!WARNING]
> By default the credential is stored **host-side only** and is used just for pulling templates/kits. It is never placed inside a sandbox. If you pass `-g` (or scope it to a sandbox name), the credential is **injected into the sandbox in plaintext**, where the agent and any code running there can read it. Only use `-g`/sandbox scope when the sandbox itself needs to pull from the registry; otherwise omit `-g` to keep it host-only.

### Bug Fixes
- Sort `template ls` output by repository, then tag.
- Retry `ExecResize` to keep the agent TUI in sync.
- Set `TERM=xterm-256color` when exec'ing with `-t`.
- Move the state directory symlink from `/tmp` to `~/.sbx/run/`.
- Stop `storageRootsGone` from locking the storagekit singleton.
- Use `engineError` and add retry debug logging in sandboxd.
- Retry transient shim start closures.
- Make Cursor session bootstrap proxy-local.
- Add bracketed `[::1]` to `NO_PROXY` for IPv6 loopback.
- Backdate proxy CA `NotBefore` to match the goproxy leaf cert window.

## v0.30.0

Published 2026-05-19. https://github.com/docker/sbx-releases/releases/tag/v0.30.0

### Highlights

The CLI gets **non-interactive Docker Hub login** for scripted workflows, and sandboxes now have **a configurable grace period before auto-stopping** when the last session exits. Plus a wave of fixes covering Linux packaging, macOS worktree compatibility, Windows installer paths, network isolation, and recoverable sandbox state when host directories vanish.

### What's New

### Governance & Policy
- Allow `sbx policy` setup before login

### Kits & Agents
- Re-run `commands.startup` on every container start so init hooks are idempotent across restarts
- Per-kit memory files for progressive disclosure
- Enumerate installed kits in the AI memory file's Kits section

### CLI & Auth
- Add non-interactive Docker Hub login for scripted workflows
- Migrate `/reset` to `/daemon/reset`; state-dir wipe is now daemon-side
- Print "Git repository detected" once when using `--branch`
- Skip implicit run options when the user provides explicit args

### Networking & Sandboxd
- Bind both loopback stacks by default when publishing ports
- Allow raw TCP to `host.docker.internal` when localhost is allowed in policy
- Add grace period before auto-stopping a sandbox when the last session exits

### Bug Fixes
- Build sailor's `ffi` crate instead of `ffi-krun` for packaged Linux release artifacts
- Keep sandboxes recoverable when workspace or worktree is deleted on the host
- Add macOS `/private` path compatibility for worktrees
- Probe canonical socket path for `sun_path` budget — fixes `krun_start_enter failed` on macOS with long usernames
- Namespace gVisor socket dir and auth/secret stores by `--app-name` so concurrent daemons don't collide
- Sanitize runtime ID when looking up gVisor network
- Check database version before starting the daemon; surface an instructive error instead of crashing
- Report Docker daemon startup time instead of the pre-start message in DinD
- Harden `BuildFileCredential` to check more than just file existence
- Open a sentinel connection in `cp` and `kit add` to prevent auto-stop race
- Remove redundant `ContainerKill` before `ContainerRemove` in sandboxlib
- Use a safe Windows `start` invocation for `OpenURL` in the TUI
- Rename WiX install directory id to `INSTALLFOLDER`

### Documentation
- Warn agents about worktree path traps with `--branch`
- Improve consistency and wording in CLI help strings

## v0.29.0

Published 2026-05-13. https://github.com/docker/sbx-releases/releases/tag/v0.29.0

### Highlights

This release brings **per-sandbox network policies**, giving callers fine-grained control over which domains each sandbox can reach, including an explicit `deniedDomains` list and allowance for binary TCP protocols like SSH. Sandboxes now carry **daemon-assigned UUIDs**, enabling reliable identification across restarts and telemetry. Several **agent improvements** land in this release: Gemini gets SSO browser relay, Codex auth is more robust, and the OpenAI OAuth flow now auto-opens the browser. A round of **bug fixes** improves daemon robustness on macOS (long-username `sun_path` overflow), gVisor isolation under `--app-name`, and database-version handling.

### What's New

### Networking & Policy
- Support per-sandbox scoped network policies
- Add `deniedDomains` to network kit policy
- Allow binary TCP protocols (e.g. SSH) through domain allow rules
- Pipe in policykit error handler for better diagnostics

### Sandboxes
- Add daemon-assigned UUID to sandbox runtimes

### Agents
- Enable SSO browser relay for Gemini
- Auto-open browser during OpenAI OAuth flow
- Skip auth.json placeholder for Codex when no host credentials
- Expose Claude guidance to Codex sandboxes

### CLI
- Require confirmation for `sbx rm <name>` to prevent accidental deletion
- Unhide `kit` command in help output

### Bug Fixes
- Namespace gVisor socket dir by `--app-name` so concurrent daemons don't share state
- Probe canonical socket path for `sun_path` budget — fixes `krun_start_enter failed` for macOS users with long usernames
- Check database version before starting the daemon and surface an instructive error instead of crashing
- Route gVisor sockets to a persistent, sandboxd-owned location
- Delete stranded tracker after failed auto-stop with no active sessions
- Clean up DinD volume even when container inspect fails
- Apply `SANDBOXES_STORAGE_ROOT` override to storage config
- Report running binary (not first `sbx` on PATH) in `diagnose`
- Explain how to configure OpenAI credentials in no-creds warning
- Allow MCR layer-blob CDN in default-code-and-containers policy
- Improve empty state of `sbx ls` with actionable guidance

## v0.28.3

Published 2026-04-29. https://github.com/docker/sbx-releases/releases/tag/v0.28.3

(no body)

## v0.28.2

Published 2026-04-29. https://github.com/docker/sbx-releases/releases/tag/v0.28.2

### What's New

### CLI
- Auto-open browser during login flow

### Templates
- Install `ssh-add` and SSH client tools in the `main` template

### Bug Fixes
- Prefer Codex OAuth over discovered API-key credentials 
- Propagate host TTY size when running `sbx exec -it`
- Reveal trailing characters in masked secrets

## v0.28.1

Published 2026-04-28. https://github.com/docker/sbx-releases/releases/tag/v0.28.1

### Highlights

A small release that wires **custom agent kits** through the CLI — discoverable in `--help` and invocable via `--kit` — and brings
**in-process sandbox run/exec** with launch-mode and settings dialogs to the TUI. Two bug fixes round it out: private Docker Hub image pulls work again via `--template`, and the secrets-masking path is tightened.

### What's New

### CLI
- Make custom agent kits invocable and surface `--kit` in help
- TUI: in-process sandbox run/exec with launch mode dialog, settings dialog + misc fixes

### Bug Fixes
- Enable private Docker Hub image pulls via `--template`
- Tighten secrets masking and emphasize `set-custom` warning

## v0.28.0

Published 2026-04-27. https://github.com/docker/sbx-releases/releases/tag/v0.28.0

### Highlights

This release introduces **kits** — a first-class way to define and ship sandbox agents and plugins, with community-maintained kits living in [`sbx-kits-contrib`](https://github.com/docker/sbx-kits-contrib). Alongside that, **`sbx cp`** brings host↔container file copying to the CLI, **host SSH agent forwarding** lets agents use your existing SSH keys, and **`.worktreeinclude`** lets you opt specific gitignored files into worktree-backed sandbox branches. **500-level telemetry errors** are now classified into specific categories instead of disappearing into `unknown`. A wave of kit fixes — covering Codex, Copilot, docker-agent, and droid — improves agent reliability across the board.

### What's New

### CLI
- Add `sbx cp` command for host-container file copy
- Forward host SSH agent into sandboxes
- Check for updated templates on create/run
- Inform the user that sandboxes are being deleted instead of being reset
- Rename `secret set-custom --target` to `--host` and improve help text
- Hint users to run `policy ls` before `policy rm network`
- Restore kitty keyboard protocol on TUI suspend/resume

### Sandboxes & Worktrees
- Support `.worktreeinclude` for copying gitignored files into sandbox branches
- Gracefully signal agents on container stop
- Add `tini` as init process to reap zombie processes, with fallback when missing

### Kits & Agents
- Default droid agent to high autonomy
- Make Copilot CLI fully work in sandboxes
- Use `docker-agent-docker` template for docker-agent
- Pre-create `CODEX_HOME` directory for Codex
- Install optional native dependency for Codex on linux-x64
- Apply `initFiles` mode when writing files
- Scope service discovery to the active agent
- Propagate kit `ServiceDomains`, `ServiceAuth`, and credential sources to proxy
- Close credential discovery gaps between CLI, library, and TUI paths

### Daemon & Networking
- Classify 500-level server errors into specific telemetry categories
- Surface implicit deny baseline in `policy ls`
- Update kaemon-stdlib-go to fix policy scoping issue
- Dedupe domains within input in `AllowNewNetworkDomains`
- Update default allow-list to include new Docker Hub domain
- Use context deadlines instead of client timeout for HTTP requests

### Bug Fixes
- Use forward slashes when writing paths inside the container on Windows

## v0.27.0

Published 2026-04-20. https://github.com/docker/sbx-releases/releases/tag/v0.27.0

### Highlights

This release brings **Linux TUI support** across popular terminal emulators (kitty, wezterm, alacritty, ghostty, and more), **governance UX improvements** that surface the controlling organization name and remote sync status in both `sbx policy ls` and the TUI governance tab, and the Factory-ai agent renamed to **droid**. `sbx reset` now works reliably when logged out.

### What's New

### CLI
- Add support for removing template images by image ID in addition to tags

### Governance
- Surface active organization name and remote sync status in `sbx policy ls` output and the TUI governance tab

### Agents
- Rename Factory-ai agent as "droid"

### TUI
- Add Linux terminal spawning support for kitty, wezterm, alacritty, ghostty, gnome-terminal, konsole, xfce4-terminal, and xterm

### Bug Fixes
- Fix `sbx reset` to work when logged out
- Fix TUI cursor positioning issues by disabling ONLCR to prevent `\r\r\n` sequences that caused byte-count drift

## v0.26.1

Published 2026-04-17. https://github.com/docker/sbx-releases/releases/tag/v0.26.1

### Highlights

This release introduces **`sbx diagnose`**, a new command for gathering and uploading diagnostic information when troubleshooting sandbox issues. **Factory.ai** joins the roster of supported agents with a dedicated template. Agents that use OAuth flows now benefit from an **xdg-open shim and localhost OAuth callback**, enabling browser-based auth redirects to work seamlessly inside sandboxes. Template management is expanded with **`sbx template save`, `load`, `ls`, and `rm`** commands, plus a warning when loading a template built for a different agent. The daemon now supports **log rotation** and improved logging in foreground and debug modes.

On the networking front, Claude's download domains (`downloads.claude.ai`, `claude.com`) are now on the default proxy allow list, and domain-allow rules now correctly override implicit CIDR denies for IP literals.

### What's New

### CLI
- Warn when a template was built for a different agent

### Daemon
- Add log rotation for daemon logs
- Fix daemon logging in foreground and debug modes

### Templates
- Add `sbx template save`, `load`, `ls`, and `rm` commands

### Networking
- Add `downloads.claude.ai` and `claude.com` to Claude's proxy allow list
- Domain-allow rules now override implicit CIDR deny for IP address literals
- Add `**.hashicorp.com` to the default allow list

### Diagnose
- Add `sbx diagnose` command for collecting and uploading diagnostic data

### Agents
- Add support for Factory.ai
- Add xdg-open shim and localhost callback to support OAuth redirects inside sandboxes

### Bug Fixes
- Fix stopped sandbox disappearing from list when a prefix-named sandbox is running
- Fix new session being killed by an in-progress auto-stop
- Fix exec "command not found" detection from stdout and stderr
- Fix Ghostty launch on macOS to use file-based launch
- Detect terminal background color instead of system appearance
- Improve accuracy and detail of policy denial log messages

## v0.25.0

Published 2026-04-13. https://github.com/docker/sbx-releases/releases/tag/v0.25.0

### Highlights

This release introduces **upstream proxy support** for routing sandbox traffic through corporate proxies, a **`--cpus` flag** for controlling sandbox CPU allocation, and **PID file-based daemon recovery** so `sbx daemon stop` works even when the daemon socket is unresponsive. Linux users also get **native package manager update prompts** via apt and dnf.

### What's New

### CLI
- Add `--cpus` flag to `create` and `run` commands for sandbox CPU allocation
- Add apt and dnf update prompts for Linux installations
- Expand OAuth secret `ls`/`rm` handling for Anthropic
- Hint users to use `sbx run <agent>` for unknown agent commands
- Return non-zero exit code when user cancels prompts

### Daemon
- Add PID file fallback for daemon stop when socket is unresponsive, with platform-specific identity verification
- Add daemon OAuth reload endpoint and harden Codex token sync
- Recover from analytics kit panic during shutdown
- Fail daemon startup if mount policy engine cannot be created

### Networking
- Add upstream proxy support for routing sandbox traffic through corporate proxies
- Guard against nil `req.URL` in OAuth URL matcher
- Log allow decisions at DEBUG level, deny at INFO
- Wait for proxy goroutines to exit during teardown

### Governance
- Show rule origin and status for policykit rules
- Skip mount policy eviction when default rules are not set

## v0.24.2

Published 2026-04-08. https://github.com/docker/sbx-releases/releases/tag/v0.24.2

### Highlights

This patch release brings a **revamped TUI experience** with a new sandbox info dialog, improved notifications, and better error visibility when the daemon becomes unreachable. It also includes several **CLI stability fixes** including proper terminal restoration after agent crashes, correct `--` separator handling in exec, and graceful handling of invalid sandbox names.

### What's New

### CLI & TUI

- Add sandbox info dialog for viewing sandbox details
- Show explanatory action when creating a new sandbox
- Improve TUI notification system with better styling and behavior
- Show error in TUI when daemon becomes unreachable
- Bypass login check and network policy setup when running "reset"

### Bug Fixes

- Strip leading `--` separator in exec command args
- Use full terminal reset after agent crash to restore terminal state
- Gracefully handle invalid/duplicate sandbox names in the TUI and CLI
- Use `--disable-interactivity` flag for Windows winget to avoid interactive prompt

## v0.24.1

Published 2026-04-06. https://github.com/docker/sbx-releases/releases/tag/v0.24.1

### Highlights

This patch release improves the **TUI interaction experience** with nicer confirmation dialogs and better support for long network hostnames. It also fixes a **network creation race condition** in the daemon and expands **packaging support** for newer Ubuntu versions.

### What's New

### CLI

- Style confirmation dialogs as buttons with full mouse click support and keyboard navigation
- Add horizontal scrolling for long hostnames and rule values in expanded network detail views

### Packaging

- Add Ubuntu 25.10 and 26.04 deb package builds

### Bug Fixes

- Retry network creation on stale network conflict in daemon

## v0.23.0

Published 2026-04-02. https://github.com/docker/sbx-releases/releases/tag/v0.23.0

### Highlights

This release brings **OpenAI OAuth support for Codex sandboxes**, allowing users to authenticate via OAuth flow instead of API keys. It also improves session lifecycle management with **auto-stop on disconnect** — sessions now track active connections via reference counting and automatically stop when all agents and exec sessions have disconnected (detached sandboxes are unaffected).

### What's New

### Agents
- Add OpenAI OAuth flow for Codex sandboxes, including `--oauth-login` flag for `create`/`run` commands

### Daemon
- Auto-stop sessions when the agent has been disconnected using reference counting; detached sandboxes are excluded

### Documentation
- Add `AGENTS.md` for standalone distribution pipeline overview

## v0.21.0

Published 2026-03-31. https://github.com/docker/sbx-releases/releases/tag/v0.21.0

### Highlights

This release brings **network policy improvements** including rule deduplication and default policy selection during sandbox creation. **Linux packaging** is now available as a standalone binary, and the **TUI** gets consistent styling, animations, and better terminal support (including Warp). **Worktree handling** is enhanced with the new `--branch` flag for multiple worktrees, and several **proxy and credential fixes** improve reliability across agents.

### What's New

### Policy & Networking
- Deduplicate network domain rules and create one rule per domain
- Add default network policy selection during sandbox creation
- Add `policy reset` command to restore default policies
- Add dl-cdn.alpinelinux.org:443 to balanced preset
- Remove `*.googleapis.com` wildcard from service detector
- Remove codex allowedDomains leaking into all sandboxes
- Skip CIDR check for allowed domain hosts in governance engine
- Point SSL_CERT_FILE, NODE_EXTRA_CA_CERTS, REQUESTS_CA_BUNDLE at full CA bundle

### CLI
- Add `rm --all` to remove all sandboxes
- Add `reset --preserve-credentials` and rename to `--preserve-secrets`
- Improve sbx CLI UX — policy selector, policy ls, and spacing
- Return exit code 127 for missing binary in `sbx exec`
- Prevent sandbox reuse when directories share the same basename
- Prevent double policy prompt on `policy reset` after sign-out
- Handle Ctrl+Z to suspend sbx process
- Allow non-release versions to be compatible with each other

### Worktrees
- Support multiple worktrees in a sandbox using `--branch` flag
- Use branch name as worktree

### TUI
- More consistent TUI styling
- Add reusable dialog open/close/resize animations
- Better support for Warp terminal and refactored terminal spawn logic
- Fix mouse hitboxes in credential creation dialog
- Set NoWorktree as default in TUI
- Terminal cleanup

### Sandbox & Daemon
- Support configurable Docker volume size via env-var for DinD
- Expose internal error details in API error responses
- Support dots in sandbox names by sanitizing Docker network names
- Generic OAuth for blueprint agents
- Silence spurious warning when setting secret with daemon stopped
