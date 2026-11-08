# TOC proposal: Docker Sandboxes and Docker Agent 101

Written 2026-10-08 from the corpus only. Source ids follow `05-conflicts-register.md`: `01:S16` is source S16 of `01-sandboxes.md`, `01:F63` is fact 63 there, `cli:sbx` and `cli:da` are the v0.47.0 and v1.149.0 help trees, `cli:sandbox` and `cli:agent` are the legacy plugin captures, `probe:<name>` is a file under `cli/probes/`, `C<n>` and `S<n>` are register rows, `K<nn>` is a capture in `07-capture-plan.md`. Listing sources name files that the capture kit writes under `capture/out/`.

## Summary in twelve lines

1. Seven parts, 33 body sections (32 if 4.5 folds into 4.4, see the page budget), 8 reference sections, 33 numbered figures plus figure 0.1 and the plate, 47 to 61 listings, about 106 letter pages at the standard's density.
2. Part 1 puts both products on one page: what runs where, and one complete `docker-agent run --sandbox` from the kit staging to the session row.
3. Part 2 is the sandbox lifecycle under `sbx run`: create, exec, cp, ports, stop, rm, prune, templates, the daemon, its state directory, and settings.
4. Part 3 is one section per isolation layer: the microVM, the workspace modes and `--clone`, the policy rules, the proxy and its log, the secret store and sentinels, the host-side MCP gateway.
5. Part 4 is kits and environment files: the v3 descriptor, its capabilities, the v2 artifact commands with signing, `sbxenv.yaml`, and the shared skills store.
6. Part 5 is the agent file and `docker-agent run`: the CLI, the three model blocks, toolsets, multi-agent, permissions and hooks, sessions and eval.
7. Part 6 is the served agent: `serve api` and `serve chat`, `serve mcp` and `serve acp`, `serve a2a` (which ties to A2A 101), `share push` with attestation, and the local model and Compose stack.
8. Part 7 is operation: cloud sandboxes and `sbx move`, governance and audit, the migration from the plugin and from cagent names, and the conformance checks the manual ran.
9. Every section title names a command, a file, a config key, a policy object, or a protocol surface that the reader can find in `--help` or the docs.
10. Every listing is cut from a capture file; the capture kit has an offline tier (docker-agent cassettes, kit tooling, YAML) and a networked tier (real microVMs on this Mac, DMR, a local registry) and a tier that needs approval (cloud, tokens).
11. The pin: sbx v0.47.0, docker-agent v1.149.0, agent file schema 16, Kit Spec v3 milestone 3.0.0-m.8, DMR v1.2.8, mcp-gateway v0.44.1, Compose v5.6.0, Docker Desktop 4.94.0, verified 2026-10-08.
12. The five biggest conflicts the manual settles in print: kit generations (C13), agent names and template images per launch path (C9, C61), secrets never injected from the host (C7, C34, C35), settings keys the docs and the CLI disagree on (C16 to C20), two agent binaries and the rename (C48 to C52).

## The pin

| Item | Value | Source |
|---|---|---|
| Subject | Docker Sandboxes (`sbx`) and Docker Agent (`docker-agent`) | 01:S1, 02:S1 |
| sbx | v0.47.0, commit `0411f50ee4700fe7bd37e6e7e3aced563e850ca9`, released 2026-10-05, installed from `/opt/homebrew/Caskroom/sbx/0.47.0/Sbx.app` | probe:sbx-version, probe:sbx-diagnose, 01:S25 |
| sbx source | `https://github.com/docker/sbx-releases` (release artifacts only; proprietary license; the binary's source is not public) | 01:S20 |
| docker-agent | v1.149.0, released 2026-10-07, Homebrew build; `https://github.com/docker/docker-agent` (Apache-2.0); commit to be read from the tag at capture time | probe:docker-agent-version, 02:S17 |
| Agent file schema | version 16, `agent-schema.json` on main | 02:S13, 02:S3 |
| Sandbox Kit Spec | v3, milestone 3.0.0-m.8 (2026-10-02), frontend `docker/sandbox-kit:3` (tag moved 2026-10-03), Go module `github.com/docker/sandbox-kit-spec/v3`, Apache-2.0 | 01:S21 |
| Docker Model Runner | docker/model-runner v1.2.8 (2026-08-12); the CLI version printed by `docker model version` after the Desktop update is the pinned one | 03:S61, C81 |
| MCP gateway | docker/mcp-gateway v0.44.1 (2026-09-23, prerelease); `docker mcp version` after the Desktop update | 03:S60, C86 |
| Compose | v5.6.0 (2026-10-02); `models` needs 2.38.0+ | 03:S64, 03:S16 |
| Docker Desktop | 4.94.0 (2026-10-05), bundles Docker Agent v1.144.0 and Offload v0.6.53 | 03:S41 |
| Legacy captures | `docker sandbox` plugin v0.12.0 (Desktop 4.61 era), `docker agent` plugin v1.32.4 (2026-03-16) | cli:sandbox, cli:agent |
| Host | macOS on Apple silicon, `kern.hv_support is 1`, guest kernel page size 16384 bytes | probe:sbx-diagnose |
| Verified | 2026-10-08 | this file |

Sources, ranked, as `manual.json` will list them: (1) the shipped help trees of sbx v0.47.0 and docker-agent v1.149.0, cited as `help` and a command; (2) `agent-schema.json` at the pinned commit, cited as `schema` and a definition name; (3) `docs.docker.com/ai/sandboxes/` and `/ai/docker-agent/` as fetched 2026-10-08, cited as `docs` and a page; (4) `docker/sandbox-kit-spec` SPEC-v3.md and the capability pages, cited as `kitspec` and a section; (5) release notes of docker/sbx-releases and the docker-agent CHANGELOG, cited as `rel` and a version; (6) Docker blog posts and talks, cited as `blog` or `talk` with a date, only for history and positioning; (7) the capture kit, cited by file. Vendor the help trees, the schema, SPEC-v3.md, and the capability pages under `research/sources/` (Apache-2.0 for the spec and the agent repo; the help text is quoted as program output).

## Part 1: The two products on one page

Thesis: `sbx` runs any agent inside a microVM it owns, `docker-agent` runs an agent file, and `docker-agent run --sandbox` joins them through a kit and the proxy.

Accent: blue.

### 1.1 sbx and docker-agent

- Thesis: Each binary owns one thing: sbx owns the microVM, its proxy, and its secret store, and docker-agent owns the loop between a model, tools, and sub-agents.
- Facts the section must state:
  1. `sbx` is a standalone CLI; no Docker Desktop or Engine is needed, a Docker account sign-in is (01:F1, 01:F15, C15).
  2. A sandbox is a microVM with its own Linux kernel and a private Docker Engine; the agent is a container inside it; sandboxes do not appear in `docker ps` (01:F19, 01:F27).
  3. The host daemon is `sandboxd`, reached over a Unix socket under `~/Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/` (probe:sbx-daemon-status, 01:F25).
  4. The 11 agent names `sbx run` accepts, the 8 `create` subcommands, and the `cagent` alias (C9, cli:sbx).
  5. `docker-agent` is "to AI agents what `docker run` is to containers": a YAML or HCL file in, a TUI, CLI, HTTP API, MCP server, A2A server, or OCI artifact out (02:F17).
  6. Two launch paths exist: `sbx run docker-agent .` runs `docker-agent run --yolo` on `docker/sandbox-templates:docker-agent`; `docker-agent run --sandbox agent.yaml` drives `sbx` with `docker/docker-agent-sbx-templates:latest` (03:S9, cli:da `run --template`, C61).
  7. Two agent binaries can coexist on one machine: the Desktop plugin `docker agent` and the Homebrew `docker-agent`; Desktop 4.94.0 bundles v1.144.0 (C48).
  8. Gordon (`docker ai`) is a separate assistant built on the same runtime and is out of scope (03:(e)1, C72).
- Figures:
  - fig-1-1, kind layers: the stack from the host (`sbx`, `sandboxd`, keychain, proxy) through Hypervisor.framework into the guest (kernel, containerd, private `dockerd`, agent container, bind mount at the same path), with `docker-agent` drawn as the process inside the container. Static.
  - fig-1-2, kind comparison: the two launch paths side by side with their real image names, default flags, and which binary reads the secret. Static.
- Listings:
  - `sbx --help` command groups, cut to the four groups (capture/out/01-help-sbx.txt).
  - `docker-agent --help` command groups (capture/out/01-help-docker-agent.txt).
- Open questions to settle by running: K00 (which `sbx version --json` runtime components are named), K34 (both agent binaries' versions on this host).

### 1.2 docker-agent run --sandbox, one run end to end

- Thesis: One `docker-agent run --sandbox --exec` shows the kit staged, the sandbox created, the allowlist built, the model called, and the session stored.
- Facts:
  1. `--sandbox` orchestrates the installed `sbx` CLI (`--sbx` default true); `--cloud` implies `--sandbox` with `--sandbox-ttl` default 1h (cli:da `run`).
  2. An auto-kit stages skills and prompt files under `~/Library/Caches/cagent/sandbox-kits/<hash>`, bound read-only; `--no-kit` skips it (03:S33, 03:5.5 URLs row).
  3. The network allowlist is the union of the template defaults, aqua-resolved tool hosts, `models.dev`, the `--models-gateway`, `runtime.network_allowlist`, and `docker-agent sandbox allow` entries (03:S33, cli:da `sandbox allow`).
  4. A blocked host answers "Blocked by network policy" with HTTP 403; the fix is `docker agent sandbox allow <host>` (cli:da `sandbox allow`).
  5. The model call leaves the VM through the proxy; with `dmr/ai/qwen3` it reaches the host at port 12434 only when policy allows `localhost:12434` (03:S36, K31).
  6. The session is written to `<data-dir>/session.db` on the host side of the run (cli:da `run -s`).
  7. The safety mode inside the VM is captured, not assumed (C62).
- Figures:
  - fig-1-3, kind sequence: operator, `docker-agent`, `sbx`, `sandboxd`, the VM, the proxy, DMR, `session.db`, numbered from the kit hash to the stored session. Animates.
- Listings:
  - the launch summary with the kit path and the "resulting allowlist" lines (capture/out/30-sandbox-launch.txt).
  - the 403 and the `sandbox allow` fix (capture/out/30-blocked-403.txt, 30-sandbox-allow.txt).
  - the NDJSON events of the run, cut to `stream_started`, one `tool_call`, `stream_stopped` (capture/out/30-run.ndjson).
- Open questions: K30 (safety default inside, exact allowlist line format, whether DMR on the host is reachable from inside without a policy change).

## Part 2: sbx run

Thesis: A sandbox has a name, a workspace, a template, and a lifecycle that seven verbs and one daemon control.

Accent: violet.

### 2.1 sbx run, sbx create, sbx stop, and sbx rm

- Thesis: `sbx run` creates when needed and attaches, `sbx create` only creates, and `stop`, `rm`, and `prune` end a sandbox in three different ways.
- Facts:
  1. The first positional is an agent name or a kit reference (directory, ZIP, git, OCI); relative kit paths must be explicit, such as `./my-kit` (cli:sbx `run`).
  2. PATH is the workspace, mounted at the same absolute path; extra PATHs may carry `:ro`; a read-only argument may name one file; omit PATH on `create` for a mountless sandbox (cli:sbx `create`, 01:F34, 01:F35).
  3. Names default to `<agent>-<workdir>`, 2 to 63 characters, letters, digits, hyphens, periods; `default` is reserved (cli:sbx, C25).
  4. `--name` re-attaches; the agent positional is then optional and verified against the spec (cli:sbx `run`).
  5. `-e KEY=VALUE` and `--env-file` apply to the session and are baked in at creation; `--pull` defaults to `always`; `--rm` removes after the session; `-d` prints the id and exits (cli:sbx `run`, 01:F41).
  6. `--cpus`, `--memory` (default 50% of host, clamp 512 MiB to 32 GiB), `--deny-network`, `-p`, `--skills`, `--static-mcp`, `--profile` are set at creation (cli:sbx `create`).
  7. `stop` keeps state; `rm` deletes containers, worktrees, state, and sandbox-scoped secrets; `prune` removes stopped sandboxes only, with `--filter until=` (cli:sbx `stop`, `rm`, `prune`).
  8. Two agents on one directory are two sandboxes (S27, 04:T21).
- Figures:
  - fig-2-1, kind state: absent, created, running, stopped, removed, with the verb on each edge and the names `shell-capture` and `claude-capture` from the capture. Static.
- Listings:
  - `sbx create shell . --name demo` output and `sbx ls --json` (capture/out/04-create.txt, 04-ls.json).
  - `sbx prune --dry-run --json` after `stop` (capture/out/04-prune-dry-run.json).
- Open questions: K04 (what `ls --json` holds: id, status, ports, workspace fields).

### 2.2 sbx exec, sbx cp, and sbx ports

- Thesis: Three verbs reach into a running sandbox: a command, a file, and a port, and each has one rule that differs from `docker`.
- Facts:
  1. `exec` starts a stopped sandbox first; `-d` is not supported; `-u`, `--privileged` are rejected with `--cloud` (cli:sbx `exec`, C31).
  2. `cp` needs exactly one `SANDBOX:PATH` side; sandbox to sandbox is unsupported; `-L` follows links; CVE-2026-17106 was fixed in v0.38.0 (cli:sbx `cp`, 01:F40).
  3. `ports` lists, publishes, and unpublishes; publishing starts a stopped sandbox (cli:sbx `ports`).
  4. A port without a protocol binds tcp4 on 127.0.0.1; `tcp` binds both families; `HOST_PORT` omitted means ephemeral (cli:sbx `ports`, C39).
  5. `SANDBOX_NAME` and `SANDBOX_ID` are set inside (01:F84).
  6. `sbx exec -u root` is how the capture inspects the guest (cli:sbx `exec` example).
- Figures: none (the port rule is a table).
- Listings:
  - `sbx ports demo --publish 18081:8080` then `sbx ports demo --json` and the host `curl` (capture/out/05-ports.json, 05-ports-curl.txt).
  - `sbx cp` in and out (capture/out/06-cp.txt).
- Open questions: K05 (the JSON field names of a published port).

### 2.3 sbx template save and sbx template load

- Thesis: A template is a snapshot in the sandbox runtime's image store, reused with `--pull never -t TAG`, exported as a tar, and loaded elsewhere.
- Facts:
  1. `template save SANDBOX TAG` stores in the runtime's image store; `-o FILE` also exports a tar; `template load FILE` imports (cli:sbx `template`).
  2. Reuse is `sbx run --pull never -t TAG AGENT [WORKSPACE]` (cli:sbx `template`).
  3. `template ls --json`, `template rm TAG|ID`; `template inspect` is cloud-only in v1 (cli:sbx).
  4. Cloud templates need `--cpus` and `--memory-mib` naming a billable shape and `--capture-mode disk|all` (cli:sbx `template load`).
  5. Default templates are `docker/sandbox-templates:<agent>` with `*-0.7.0` tags and `-docker` variants; `platform.images.useDHI` swaps to `dhi/sbx-templates:*` (01:F72, 01:F73, 01:F79).
  6. The legacy `docker sandbox save` loaded into the host daemon (C32).
- Figures:
  - fig-2-2, kind flow: running sandbox, `template save`, image store, tar file, `template load` on another host, `run --pull never -t`. Static.
- Listings:
  - `template save demo demo-tpl:v1 -o out/demo-tpl.tar` and `template ls --json` (capture/out/07-template-save.txt, 07-template-ls.json).
  - a run from the template (capture/out/07-template-run.txt).
- Open questions: K07 (image id format in `template ls --json`).

### 2.4 sandboxd, sbx diagnose, and sbx reset

- Thesis: One daemon owns every sandbox, its socket and log live under one state directory, and two commands check it and wipe it.
- Facts:
  1. `sbx daemon start|stop|restart|status|log-level set <proxy|general|all> <level>`; `start --policy` initializes the global policy (cli:sbx `daemon`).
  2. Socket and log paths on macOS: `.../sandboxes/sandboxd/sandboxd.sock` and `daemon.log` (probe:sbx-daemon-status).
  3. State directories per OS and `SANDBOXES_STORAGE_ROOT`; `~/.sbx/run/` is a symlink; the daemon also uses `~/.sbx/run/d/containerd/containerd.sock.ttrpc` (01:F30, cli:sbx `kit builder history` error text).
  4. `sbx diagnose` prints 13 checks incl. `kern.hv_support`, `mkfs.erofs`, guest page size 16384, storage, socket, authentication; `-o json|github-issue`, `--upload` (probe:sbx-diagnose, cli:sbx).
  5. `sbx reset` stops sandboxes (30 s), clears caches and registries, removes policies, SSH config, secrets unless `--preserve-secrets`, signs out, stops the daemon (cli:sbx `reset`).
  6. Hidden or absent commands: `sbx mount`, `sbx ssh proxy`, `sbx policy approval`, `--model`, `--provider`, `--usb` (C16).
  7. The `sbx reset` help names Gordon sessions (C33).
- Figures:
  - fig-2-3, kind tree: the macOS state directory with `sandboxd/`, `agent-skills/`, `auditkit/` (under Logs), the `~/.sbx/run` symlink, and the plugin-era directories greyed out. Static.
- Listings:
  - `sbx diagnose` (capture/out/02-diagnose.json cut to the Platform block).
  - `sbx daemon status --json` (capture/out/02-daemon-status.json).
- Open questions: K02 (the JSON shape of diagnose; whether the hidden commands answer `--help`).

### 2.5 sbx settings list

- Thesis: Every setting has a default, an environment alias, a user override, and a RESTART flag, and `sbx settings list --json` is the only complete list.
- Facts:
  1. SOURCE is `default`, `envvar`, or `override`; environment variables win over overrides; most changes apply within about five seconds (cli:sbx `settings list`, `settings set`).
  2. RESTART=yes keys need `sbx daemon restart`: `mcp.forceLocalGateway`, `proxy*`, `no_proxy*`, `ssh.*`, `tls.allowNegativeSerial` (probe:sbx-settings-list).
  3. Keys the docs do not list: `ssh.autoCreate`, `ssh.defaultAgent` (`shell`), `ssh.defaultTemplate`, `ssh.workspaceRoot` (C20).
  4. Keys the docs list and the CLI did not print: `feature.model`, `feature.sandbox-gpu`, `feature.udp-egress`, `feature.ssh`, `diagnostics.autoUploadErrorCooldownInDays` (C19).
  5. `platform.allowExperimentalFeatures` printed `true` as a default (C18).
  6. `kit.allowedSources` default `["docker.io/"]`, `kit.trustedSigners` trusts `@docker.com` through the Google issuer, `kit.requireSignature` false (probe:sbx-settings-list).
  7. Value types bool, int, float, string, json; administrator constraints reject conflicting overrides (cli:sbx `settings set`).
- Figures: none (R.3 holds the table).
- Listings:
  - `sbx settings list --json` cut to five records (capture/out/02-settings.json).
  - `sbx settings get --json platform.allowExperimentalFeatures` (capture/out/02-settings-experimental.json).
- Open questions: K02 (C18, C19).

## Part 3: sbx policy, sbx secret, sbx mcp

Thesis: Five layers isolate the agent, and each layer has one command surface: the hypervisor, the workspace, the policy, the proxy, and the secret store, with the MCP gateway as the fifth door.

Accent: green.

### 3.1 sbx diagnose and the microVM boundary

- Thesis: The agent runs as a container inside a guest kernel on the host hypervisor, with a private Docker Engine, and nothing it does reaches the host daemon.
- Facts:
  1. Hypervisor.framework, WHP, KVM; Docker wrote the VMM; it is not Firecracker (01:F20, 01:F21, C4).
  2. Each VM has its own kernel and Docker Engine; the agent is root with sudo inside by design (01:F19, 04:B16).
  3. `kern.hv_support is 1` and guest page size 16384 bytes (probe:sbx-diagnose, C45).
  4. Internal names: `sandboxd`, `nerdbox`, `containerd-shim-nerdbox-v1`, EROFS, virtiofs (01:F22).
  5. Memory and CPU limits per sandbox (01:F28).
  6. No Moby API is exposed from the host side; Testcontainers over the REST API does not work transparently (04:T06 [07:30]).
  7. Inside the VM `docker ps` lists only the sandbox's own containers (04:B20).
- Figures:
  - fig-3-1, kind layers: host hypervisor, guest kernel, containerd, private `dockerd`, agent container, with the four entry points (bind mount, network, secret injection, MCP) drawn as doors (04:T02 [07:30]). Static.
- Listings:
  - `uname -a`, `/etc/os-release`, `docker info --format '{{.ServerVersion}}'`, `getconf PAGESIZE`, `mount | grep virtiofs` from inside (capture/out/04-guest.txt).
- Open questions: K04 (kernel version, OS, containerd and engine versions inside).

### 3.2 --clone and /run/sandbox/source

- Thesis: Bind mode gives the agent your files, `:ro` and mountless modes give it less, and `--clone` gives it a private clone whose commits come back through a git remote.
- Facts:
  1. Bind at the same path; extra paths; `:ro` on a path or a single file (cli:sbx `create claude`).
  2. Mountless: omit PATH on `create` (01:F35).
  3. `--clone` mounts the host repo read-only at `/run/sandbox/source` and runs the agent on a private clone; commits reach the host through the `sandbox-<name>` remote served by git-daemon under `refs/sandboxes/<name>/*` (01:F36, cli:sbx `create --clone`).
  4. `--clone` must be set at creation; it is a no-op on re-attach (cli:sbx `run --clone`).
  5. The shared workspace is a covert channel (git hooks, `package.json` scripts), which is why clone mode exists (04:B16, 04:T02 [13:30]).
  6. `sbx kit add` keeps a clone's working tree through a named workspace volume (cli:sbx `kit add`).
  7. `sbx rm` cleans up git worktrees (cli:sbx `rm`).
- Figures:
  - fig-3-2, kind flow: host repo, `/run/sandbox/source` (read-only), private clone in the VM, git-daemon, `sandbox-clone-demo` remote, `refs/sandboxes/clone-demo/*`, `git fetch`. Static.
- Listings:
  - inside: `git remote -v` and the clone's HEAD (capture/out/08-clone-inside.txt).
  - host: `git remote -v`, `git ls-remote sandbox-clone-demo`, `git fetch` (capture/out/08-clone-host.txt).
- Open questions: K08 (exact ref names, whether the remote is added to the host `.git/config` or served another way, how a commit made inside appears on the host).

### 3.3 sbx policy init, allow network, deny network, and check network

- Thesis: A global preset plus allow and deny rules in two scopes decide every connection, deny wins, and `check network` asks the same authorizer without sending anything.
- Facts:
  1. `policy init allow-all|balanced|deny-all` is one-time before the first sandbox; `policy reset` starts over; `daemon start --policy` does the same (cli:sbx `policy init`, probe:sbx-policy-ls).
  2. Rule grammar: exact domain, `*.example.com`, `**.example.com`, `api?.example.com`, `api[12].example.com`, IPv4, CIDR, `[2001:db8::1]:443`, `**` for all; a bare `*` is rejected (cli:sbx `policy allow network`).
  3. Allow applies to TCP by default, deny to TCP and UDP; `--protocol` selects (cli:sbx).
  4. Deny beats allow; an allowed hostname is not re-checked against CIDR rules (cli:sbx `policy deny`).
  5. Scopes: global and `local` (`--sandbox`); `--deny-network` at create can only narrow (cli:sbx `create`, C41).
  6. `policy ls` overview rows with `--source local|org|kit`, `--decision`, `--type`, `--created-via default|added|provisioned|approval`, `--wide` for RULE_ID, `--json` (cli:sbx `policy ls`).
  7. `policy inspect <policy-or-rule>`, `policy rm network --id|--resource [--sandbox]` (cli:sbx).
  8. `policy check network TARGET [--sandbox] [--protocol] [--verbose] [--json]` evaluates host and port only, not method or path (cli:sbx `policy check network`).
- Figures:
  - fig-3-3, kind decision: a request to `example.com:443` walks per-sandbox deny, org deny, kit allow, local allow, preset default, with the captured rule ids on the branches. Static.
- Listings:
  - `sbx policy ls --wide --json` after `init balanced`, cut to the AI services and package registries groups (capture/out/03-policy-balanced.json).
  - `sbx policy check network example.com --verbose --json` before and after `allow` (capture/out/09-check-verbose.json).
  - `sbx policy inspect <rule-id> --json` (capture/out/09-inspect-rule.json).
- Open questions: K03 (the balanced list on v0.47.0), K09 (what `created-via` a CLI-added rule gets).

### 3.4 sbx policy log and the proxy

- Thesis: All egress leaves through a host-side forward proxy and a transparent proxy, the proxy signs TLS with its own CA, and `policy log` shows every allowed and blocked host with the rule that matched.
- Facts:
  1. Raw TCP and UDP are blocked by default; UDP egress is experimental behind `feature.udp-egress`; DNS is policy-gated since v0.33.0; ICMP is blocked (01:F42, 01:F51, C27).
  2. The proxy performs TLS interception with a CA trusted inside the sandbox; bypass tunnels without inspection and cannot inject credentials (01:F55).
  3. `policy log [SANDBOX] [--json] [--limit] [--type all|network]` shows host, decision, rule, PROXY type (`forward`, `forward-bypass`, `transparent`, `network`, `browser-open`), count (01:F47, cli:sbx `policy log`).
  4. Filesystem logs are "not supported yet" (C28).
  5. L7 rules on method and path come from kit `network-policy@2`; `check network` does not evaluate them; a kit can deny `DELETE /repos/**` (04:B05, cli:sbx `policy check`).
  6. An allowed host is an exfiltration channel: a gist on github.com or an issue body passes; Docker says so (04:HN01, 04:T05 [47:00], 04:B16).
  7. The first prototype used a proxy environment variable and the agent bypassed it with `no_proxy` (04:T01 [33:30]).
  8. Upstream corporate proxies: `proxy`, `proxy.sandbox`, `proxy.daemon`, `no_proxy*`, SOCKS5 since v0.35.0 (01:F56).
- Figures:
  - fig-3-4, kind sequence: `curl https://example.com` inside, transparent proxy, policy authorizer, denial, the `policy log` row with its rule, then the `allow` and the second request through the forward proxy with the MITM CA. Animates.
  - fig-3-5, kind comparison: left, an allowed `api.github.com` carrying data in an issue body; right, a kit L7 rule denying `DELETE /repos/**`; what each stops. Static.
- Listings:
  - the blocked `curl` inside and `sbx policy log demo --json` (capture/out/09-blocked.txt, 09-policy-log.json).
  - the proxy variables and CA path inside (capture/out/04-env.txt cut to proxy lines).
- Open questions: K04 and K09 (proxy address and variables inside, exact log JSON fields, whether a kit L7 deny shows in the log with method and path), C26.

### 3.5 sbx secret set, sbx secret import, and sbx secret set-custom

- Thesis: A secret never enters the VM: the agent sees a sentinel, the host keychain holds the value, and the proxy swaps it into requests to the bound host.
- Facts:
  1. 13 services: anthropic, copilot, cursor, devin, droid, github, google, groq, mistral, nebius, openai, openrouter, xai (cli:sbx `secret set`, C21).
  2. Sources: `-t`, stdin, `--ref op://…` or an AWS Secrets Manager ARN, `--command CMD` (absolute path, fresh temp dir), `--oauth` (openai only locally), `--refresh` default 55m (cli:sbx `secret set`, C38).
  3. Scope: global by default, `--sandbox` for one; `secret ls -g|--sandbox|--service|--json`; `secret rm --all|--placeholder|--registry` (cli:sbx).
  4. `secret import [SERVICE] [--all|--force|--dry-run]` reads host env vars with a last-4 preview; OAuth-configured services are skipped (cli:sbx `secret import`).
  5. Registry credentials are host-only unless `--all-sandboxes` or `--sandbox`; `--registry-auth-endpoint` for a cross-host realm (cli:sbx `secret set`).
  6. `set-custom --host H --env VAR --value|--command|--ref [--placeholder sk-{rand}]`; `--header` and `--format "Bearer %s"` are cloud-only (cli:sbx `set-custom`, C34).
  7. Storage: keychain on macOS and Windows, an encrypted store with mode 0700 on Linux; bindings in `~/.config/sbx/credentials.yaml` (01:F59, 01:F66).
  8. MCP client secrets and header placeholders live under `mcp:<server>:client_secret` and `mcp:<server>:<placeholder>` (01:F67, cli:sbx `mcp add`).
- Figures:
  - fig-3-6, kind sequence: `sbx secret set-custom`, keychain, `DEMO_API_KEY=<placeholder>` in the agent's env, the request to the bound host, the proxy's header rewrite, the receiver's log. Animates.
- Listings:
  - `env | grep DEMO_API_KEY` inside and the receiver's logged Authorization header (capture/out/10-env-sentinel.txt, 10-receiver.log).
  - `sbx secret ls --json` and `sbx secret import --dry-run` (capture/out/10-secret-ls.json, 10-import-dry-run.txt).
  - the GitHub sentinel `GHO_SBX_PROXY_MANAGED…` and a `gh api user` inside (capture/out/10-github-sentinel.txt, needs approval).
- Open questions: K10 (does the swap happen on plain HTTP to a host-side receiver, or only on HTTPS; exact placeholder format; whether `host.docker.internal` is a legal `--host` value), C34, C35.

### 3.6 sbx mcp add, sbx mcp load, and --static-mcp

- Thesis: MCP servers are registered on the host, served to the sandbox through one gateway endpoint, and either fixed at creation or loaded live with a `tools/list_changed` notice.
- Facts:
  1. `--url` accepts a remote endpoint, a community-registry URL, a `server.json` or `server.yaml` manifest URL, or a `dhi.io/` image ref; other image refs are rejected; `--local` runs a registry OCI server on the host with `docker run` (cli:sbx `mcp add`).
  2. `--command` runs on the host outside the sandbox with the user's full permissions; the help warns (cli:sbx `mcp add`).
  3. OAuth: RFC 9728 and 8414 discovery, `--oauth-authorization-server`, `--client-id`, DCR per RFC 7591, scopes precedence, RFC 8707 `--resource`, `--callback-port`, `sbx mcp auth [server|--all]`, `auth status`, `auth rm` (cli:sbx `mcp add`, `mcp auth`).
  4. `--header 'Name: ${placeholder}'` with the value in the secret store; rejected on the hosted gateway (cli:sbx `mcp add`).
  5. Static set at creation with `--static-mcp a,b`; dynamic loading with `sbx mcp load NAME --sandbox S`; dynamic mode exposes `mcp-find`, `mcp-add`, `mcp-config-set`, `mcp-exec`, `code-mode`, `<server>-authorize`; static mode removes discovery tools (03:S24, 04:T23).
  6. `mcp ls` GATEWAY column names where each server runs and who controls it; `mcp.forceLocalGateway` and `SBX_MCP_URL=none` select the local data plane (cli:sbx `mcp ls`, 01:F105).
  7. The sbx gateway is separate from the Desktop MCP Toolkit; network policy does not apply to host-registered servers (03:S24, 04:T02 [09:30]).
  8. Supported agents read the gateway URL at start: Claude Code, Codex, Devin, Gemini, Kiro, OpenCode; Docker Agent is not in that list (03:S24, C42).
  9. Governance evaluates Cedar policies at the gateway; `sbx mcp catalog` was removed in v0.45.0 (01:F117, 01:F105).
- Figures:
  - fig-3-7, kind flow: the host MCP store, the per-sandbox gateway endpoint, a static server fixed at `create`, a dynamic server attached by `load`, the `tools/list_changed` notification to the agent, and the OAuth leg to the authorization server. Static.
- Listings:
  - `sbx mcp add echo --command node --args capture/mcp-echo.mjs` and `sbx mcp ls --json` (capture/out/11-mcp-add.txt, 11-mcp-ls.json).
  - `sbx mcp inspect echo --json` (capture/out/11-mcp-inspect.json).
  - the gateway's `tools/list` answer from inside before and after `sbx mcp load` (capture/out/11-gateway-tools.json).
- Open questions: K11 (the in-sandbox gateway URL and the variable that carries it per agent; whether a local stdio server reaches a `shell` sandbox; the GATEWAY column value for this account), C40, C41, C42.

## Part 4: Kits and sbxenv.yaml

Thesis: A kit declares what a sandbox contains and what it may reach, and an environment file declares a sandbox and its secrets so a plan can be approved before anything runs.

Accent: olive.

### 4.1 # syntax=docker/sandbox-kit:3 and kit.yaml

- Thesis: A v3 kit is an ordinary OCI image whose manifest annotation carries a strict YAML descriptor that `sbx run` resolves at creation.
- Facts:
  1. The descriptor starts with `# syntax=docker/sandbox-kit:3` and `schemaVersion: "3"`; `kind` is `workload`, `mixin`, or `set` (01:F87, 04:B05).
  2. It is built with `docker buildx build -f kit.yaml` and published as an OCI image with annotation `vnd.docker.sandbox.kit.descriptor`; `vnd.docker.sandbox.kit.built-by` names the frontend (01:F87, 01:F90).
  3. The frontend `docker/sandbox-kit:3` floats to the highest stable `v3.*`; milestones 3.0.0-m.2 (2026-09-16) to m.8 (2026-10-02); the spec is "experimental, final targeted Q4 2026" (01:F90, 01:S21).
  4. Unknown top-level fields and unknown capability keys are rejected; a capability version moves when its config schema changes; `schemaVersion` moves only for grammar changes (01:F89).
  5. `sbx run ./hello --kit ./gh .` is the spec's own try-it line; a kit can be the positional agent since v0.42.0 (04:B05, 01:S25).
  6. `kit-tck validate|inspect` is the conformance tool; "Docker Sandboxes is the first conforming runtime" (01:F90, 04:B05).
  7. Docker's v3 kits are `docker/sbx-kit-*` (102 repos); contrib v2 kits are `sbx/<kit>-kit`; `kit.allowedSources` defaults to `docker.io/` (01:F91, C40).
  8. The kit volume default is in dispute (C12).
- Figures:
  - fig-4-1, kind structure: the `kit.yaml` of the capture's `hello-kit` beside the OCI manifest with its `vnd.docker.sandbox.kit.descriptor` annotation and digest, arrows from field to annotation. Static.
- Listings:
  - `kits/hello-kit/kit.yaml` (capture/kits/hello-kit/kit.yaml).
  - the manifest with the annotation from `docker buildx imagetools inspect --raw` (capture/out/13-manifest.json).
- Open questions: K13 (whether `sbx run ./kits/hello-kit` accepts a v3 descriptor directly from a directory, what the frontend emits, whether `kit-tck` runs on macOS).

### 4.2 com.docker.sandbox/* capabilities

- Thesis: A kit grants itself nothing; each capability it declares is versioned, the resolver unions the grants of one workload and its mixins, and any widening on upgrade stops for approval.
- Facts:
  1. The 20 published capabilities: agent-context@1, agent-interactive-sessions@1, agent-sessions@1, agent-skill@1, agent-skills@1, credential@1, git-identity@1, host-mount@1, kit-registry@1, lifecycle@1, long-running@1, network-policy@1, network-policy@2, port@1, privileged@1, resources@1, sbx@1, ssh-agent@1, usb-device@1, volume@1 (01:F88).
  2. `network-policy@2` adds method and path rules; the gh mixin allows github.com and api.github.com and denies `DELETE /repos/**`; deny wins (04:B05).
  3. `credential@1` declares `proxyManaged` header injection (04:B05).
  4. Resolver: exactly one workload, duplicate provides fail, rules union, `kind: set` groups kits (04:B05).
  5. Update gating works on the normalized grant set; removing a deny counts as widening (04:B05).
  6. `long-running@1` arrived with v0.47.0 (01:S25).
  7. Capabilities are addressed as `com.docker.sandbox/<name>@N` and the Go module is `github.com/docker/sandbox-kit-spec/v3` (01:F88, 01:F90).
- Figures:
  - fig-4-2, kind tree: `shell` workload plus `gh` mixin plus the capture's `hello-mixin`, resolving into one grant set with `network-policy@2` rules listed and one widening branch marked "stops and asks". Static.
- Listings:
  - `sbx kit inspect docker/sbx-kit-gh:<tag> --json` cut to its capabilities (capture/out/13-kit-inspect.json; the tag is read at capture time).
- Open questions: K13 (the JSON shape of `kit inspect` for a v3 kit; which `docker/sbx-kit-*` tag is current).

### 4.3 sbx kit pack, sbx kit push --sign, and sbx kit verify

- Thesis: The `sbx kit` commands package, sign, push, verify, and show provenance for v1 and v2 artifacts, and `kit add` appends a mixin to a running sandbox.
- Facts:
  1. `pack DIR [-o name.zip]` validates `spec.yaml` plus `files/`; `validate REFERENCE [--kit-arg]` checks a directory, ZIP, or git ref (cli:sbx `kit pack`, `kit validate`, C46).
  2. `push DIR REF [--sign] [--key PEM] [--tlog-upload=false]` selects the artifact form from `schemaVersion` "1" (ZIP) or "2" (tar+gzip with the spec in the config blob); every push attaches SLSA provenance (cli:sbx `kit push`, C13).
  3. `sign` is keyless by default (Fulcio and Rekor) with an OIDC token from CI or a browser login, never from `SIGSTORE_ID_TOKEN`; `--key` for PEM; a local directory gets `kit.sig.bundle` beside `spec.yaml` (cli:sbx `kit sign`).
  4. `verify --key PUB | --certificate-identity … --certificate-oidc-issuer …` and `--insecure-ignore-tlog` for private keyless signatures; `provenance REF` prints UNSIGNED or VERIFIED (cli:sbx `kit verify`, `kit provenance`).
  5. `kit.requireSignature`, `kit.trustedSigners`, `kit.ignoreTransparencyLog`, `kit.allowedSources`, `kit.allowLocalKits` gate what a sandbox accepts (probe:sbx-settings-list).
  6. `kit add SANDBOX REF [--kit-arg]` recreates the container with the mixin appended and keeps kit-owned volumes; sandboxes created before the recreate-aware label are refused (cli:sbx `kit add`).
  7. Source-form builds run in the `sbx-kit-builder` sandbox; `kit builder status|rm|history …` passes through to `docker buildx history` (cli:sbx `kit builder`).
  8. `pull REF` needs an HTTPS registry (cli:sbx `kit pull`).
- Figures:
  - fig-4-3, kind flow: `spec.yaml` and `files/`, `validate`, `pack` (ZIP), `sign --key` (bundle), `push --sign` (manifest, signature referrer, provenance referrer), `verify --key`, `provenance`. Static.
- Listings:
  - `kits/hello-mixin/spec.yaml` (capture/kits/hello-mixin/spec.yaml).
  - `sbx kit validate … --json`, `sbx kit sign --key`, `sbx kit verify --key … --json` (capture/out/12-validate.json, 12-sign.txt, 12-verify.json).
  - `sbx run shell . --kit ./kits/hello-mixin` and `which jq` inside (capture/out/12-run-kit.txt).
- Open questions: K12 (key format accepted by `--key`; whether a local HTTP registry is refused for `push`; `kit add` on a fresh v0.47.0 sandbox), C12.

### 4.4 sbxenv.yaml and sbx env plan

- Thesis: An environment file declares the agent, kits, workspace, secrets, ports, MCP servers, and host commands, and `sbx env plan` prints what would change before `create` or `run` applies it.
- Facts:
  1. Keys: `agent`, `kits` (with `args`), `workspace`, `additionalWorkspaces`, `clone`, `env`, `secrets` (`command`, `ref`, `snapshot: true`), bindings, `ports`, `mcp.servers`, `lifecycle.initialize|postCreate|preRemove`, `args`, `name`, `sandboxOptions.writableEnvFiles` (01:F99, cli:sbx `env`).
  2. Placeholders `${{ env.args.NAME }}`, `${{ env.projectDir }}`, `${{ env.fileDir }}`; nothing else expands (cli:sbx `env create`).
  3. The plan symbols: `+` add, `~` change, `-` destroy, `>` run, `!` forget; literal secret values appear as a `sha256:` digest (cli:sbx `env`).
  4. Host commands run with the user's privileges from the project directory; `initialize` runs on every create and run; the plan asks on every invocation that declares one; `--skip-host-commands`; `env.rememberHostCommands` (cli:sbx `env`).
  5. Approved state is recorded per environment under the state directory, not next to the file; a home `.sbxenv.yaml` merges underneath; the hidden project `.sbxenv.yaml` is no longer read (cli:sbx `env create`).
  6. Several PATHs deep-merge like `docker compose -f`; lists such as `ports` concatenate (cli:sbx `env create`).
  7. `env rm` removes sandbox-scoped secrets; `--prune-bindings` also removes bindings from `credentials.yaml` (cli:sbx `env rm`).
  8. With `--cloud` host mounts, host ports, MCP definitions, and dynamic secret sources are rejected (cli:sbx `env`).
- Figures:
  - fig-4-4, kind flow: `sbxenv.yaml`, `sbx env plan`, the plan with its margin symbols, approval, `create`, the state record, a second `plan` that shows only what moved. Static.
- Listings:
  - `env/sbxenv.yaml` (capture/env/sbxenv.yaml).
  - the first `sbx env plan` and the second after one edit (capture/out/14-env-plan.txt, 14-env-plan-2.txt).
- Open questions: K14 (where the state record is written; the exact plan text for `lifecycle` and `secrets` with `snapshot`).

### 4.5 sbx skills add and skills: true

- Thesis: One shared skills store serves every sandbox read-only by default, and the same `SKILL.md` directories are what `docker-agent` discovers with `skills: true`.
- Facts:
  1. `sbx skills add <repo> [-s name]`, `import` (from `~/.agents/skills`, `~/.claude/skills`, `~/.config/opencode/skills`, `~/.copilot/skills`, `~/.cursor/skills`, `~/.factory/skills`), `ls`, `rm`, `update` (cli:sbx `skills`).
  2. The store is `.../sandboxes/agent-skills`; entries are linked read-only into the agent's skills directory at container start; `--skills off|readonly|readwrite`; `skills.defaultMode` (probe:sbx-skills-ls, cli:sbx `skills`).
  3. Imported skills reach Claude, Codex, Copilot, Cursor, Droid, OpenCode (cli:sbx `skills import`).
  4. `docker-agent` discovers `SKILL.md` under `~/.codex/skills/`, `~/.claude/skills/`, `~/.agents/skills/`, project `.claude/skills/`, `.github/skills/`, `.agents/skills/`; GitHub sources since v1.149.0; `context: fork` runs a skill as a sub-agent (02:F38).
  5. The auto-kit of `docker-agent run --sandbox` copies skills into `kit/skills/<name>/` (03:S33).
  6. `docker/skills` is Docker's own catalog; `sbx skills add docker/skills` (03:S38).
- Figures: none (one table of directories).
- Listings:
  - `sbx skills add anthropics/skills --skill pdf` and `sbx skills ls --json` (capture/out/15-skills-add.txt, 15-skills-ls.json).
  - `ls -l ~/.claude/skills` inside a `--skills readonly` sandbox (capture/out/15-skills-inside.txt).
- Open questions: K15 (the link form inside; whether `shell` sandboxes get a skills directory).

## Part 5: docker-agent run and the agent file

Thesis: An agent file is `agents`, `models`, `toolsets`, and the rules between them, and `docker-agent run` drives the loop, records it, and replays it.

Accent: plum.

### 5.1 docker-agent run, docker-agent new, and docker-agent doctor

- Thesis: `run` takes a file, an OCI ref, an alias, or nothing, `new` writes a file from a description, and `doctor` says which model `auto` would pick and why.
- Facts:
  1. Reference forms: `./agent.yaml|.hcl`, `myorg/agent:tag`, an alias, an HTTP URL, nothing (project `docker-agent.yaml|yml|hcl`, else built-in `default`; `coder` is a second built-in) (02:ref forms, cli:da `run`).
  2. `--exec` headless, `-` reads stdin, several messages are turns, `--last` prints only the final answer, `--json` emits NDJSON events (cli:da `run`).
  3. `--record [path]` writes a cassette and a TUI e2e test; `--fake path` replays; `--fake-stream [15]` simulates streaming (cli:da `run`).
  4. `--model [agent=]provider/model`, `--models-gateway`, `--flavor`, `--prompt-file`, `--working-dir`, `-w/--worktree`, `--worktree-base`, `--worktree-pr`, `--hook-*` flags, `--on-event type=cmd` (cli:da `run`).
  5. `setup` has four paths: a built-in provider key into `~/.config/cagent/.env`, DMR pull, a custom OpenAI-compatible endpoint, the Claude Code harness; `DOCKER_AGENT_NO_SETUP=1` (cli:da `setup`, 02:S8).
  6. `doctor` reports credentials per provider, DMR reachability, the `auto` pick, required env vars, and exits non-zero on an issue; on this host it picked `dmr/ai/qwen3:latest` and found no usable model (probe:docker-agent-doctor).
  7. `models list` queries the gateway `/v1/models` first; `toolsets` prints 27 types (cli:da, probe:docker-agent-toolsets).
  8. `new --model` names anthropic, openai, google, dmr, or a custom provider; `--max-iterations` default 20 for DMR (cli:da `new`, C66).
- Figures:
  - fig-5-1, kind flow: the agent file, `run`, the loop (model, tools, sub-agents), the event stream, the TUI or `--exec` output, with the cassette written by `--record` and read by `--fake` drawn as a side store. Static.
- Listings:
  - `docker-agent doctor` after the DMR update (capture/out/16-doctor.txt).
  - `docker-agent run --exec --last agents/pirate.yaml "…"` and the same with `--json` cut to three events (capture/out/17-run-last.txt, 17-run-json.ndjson).
  - the `--fake` replay of the cassette (capture/out/17-fake-replay.txt).
- Open questions: K16 and K17 (the cassette file format and name; whether `--fake` replays without a reachable provider; what `new` writes), C75.

### 5.2 agents:, models:, and providers:

- Thesis: `agents` is the only required block, a model reference is `provider/model` or a name from `models`, and `providers` defines reusable endpoints such as DMR.
- Facts:
  1. Minimum file: `agents.root` with `model`, `description`, `instruction`; unknown top-level keys are rejected; `version` is a string "0" to "16"; older files migrate, newer syntax fails with a hint (02:F18, 02:F19).
  2. Agent keys: `instruction` or `instruction_file`, `add_date`, `add_environment_info`, `add_prompt_files`, `max_iterations` (0 unlimited; 20 to 50 advised for shell agents), `max_consecutive_tool_calls` 5, `redact_secrets` true, `welcome_message`, `structured_output`, `cache`, `harness` (02:agent keys table).
  3. Model references: inline `provider/model`, a `models` name, `auto` (first provider with credentials, then a pulled DMR model), an alloy `a,b`, `first_available: […]` (02:F29).
  4. Model keys: `temperature`, `max_tokens`, `thinking_budget` (string effort or integer tokens), `task_budget`, `fallback`, `cost`, `capabilities`, `provider_opts`, `bypass_models_gateway` (02:model keys).
  5. DMR provider: `dmr`, `model: ai/qwen3`, base URL `http://localhost:12434/engines/llama.cpp/v1`, in-container `http://model-runner.docker.internal/engines/v1`, `provider_opts.context_size`, `keep_alive`, `speculative_*`, `_configure` and `_unload` (02:F31, 03:S32).
  6. Custom providers: `providers.<name>` with `provider` (default openai), `api_type openai_chatcompletions|openai_responses`, `base_url`, `token_key`, `auth.type workload_identity_federation` (02:F32).
  7. `flavors` are YAML patches applied by `--flavor`; `debug config FILE [flavor…]` prints the canonical form (02:F36, cli:da `debug config`).
  8. Provider ids are canonical models.dev names with legacy aliases (C58).
- Figures:
  - fig-5-2, kind structure: the capture's `agents/pirate.yaml` and `agents/team.yaml` blocks with arrows from `agents.root.model` to `models.local` to `providers.dmr`, and the `auto` decision drawn as a small ladder. Static.
- Listings:
  - `agents/pirate.yaml` (capture/agents/pirate.yaml).
  - `docker-agent debug config agents/pirate.yaml cheap` (capture/out/16-debug-config-flavor.yaml).
- Open questions: K16 (what `debug config` adds, such as `version: "16"` and defaults), C83.

### 5.3 toolsets: and mcps:

- Thesis: A toolset is one `type` from a fixed list of 27, shared keys filter and defer its tools, and the `mcp` type reaches a server by Docker ref, by command, or by URL.
- Facts:
  1. The 27 types from `docker-agent toolsets` (probe:docker-agent-toolsets); `transfer_task` and `handoff` are not types (C56).
  2. Shared keys: `instruction`, `tools` (allow-list), `defer` (exposes `search_tool` and `add_tool`), `readonly`, `model`, `env`, `post_edit`, `timeout`, `allowed_domains`, `blocked_domains`, `allow_private_ips`, `lifecycle` (profile, `startup_timeout`, restart policy, backoff) (02:toolset keys).
  3. `mcp` forms: `ref: docker:<name>` through the MCP Gateway, `command`/`args`/`env` stdio with aqua auto-install into `~/.cagent/tools/bin`, `remote.url` with `transport_type streamable|sse`, headers, OAuth DCR and a callback on 127.0.0.1 (02:F20, 02:toolsets table).
  4. `mcps:` at top level holds reusable definitions referenced by `{type: mcp, ref: <name>}` (02:top-level table).
  5. `mcp_catalog` uses an embedded streamable-http subset of the Docker MCP Catalog without the gateway (03:S34).
  6. `debug toolsets FILE --json` lists tools and schemas; `debug tool FILE TOOL '{json}'` calls one tool with no model turn and real side effects (cli:da `debug tool`).
  7. `filesystem` respects `.agentsignore`; `shell` runs a fresh session per call with `timeout` 30 and needs approval unless allowed (02:toolsets table).
  8. v1.148.0 bounds complete tool results to 50 KiB; `max_tool_result_tokens` truncates middle-out (02:F34).
- Figures:
  - fig-5-3, kind flow: one agent with three `mcp` toolsets, `ref: docker:duckduckgo` through `docker mcp gateway run`, `command: node capture/mcp-echo.mjs` as a child process, `remote.url` to a streamable endpoint, each with the tool names that arrive. Static.
- Listings:
  - `docker-agent toolsets --format json` cut to five rows (capture/out/16-toolsets.json).
  - `docker-agent debug tool agents/files.yaml read_file '{"path":"README.md"}' --json` (capture/out/16-debug-tool.json).
- Open questions: K16 and K29 (whether `ref: docker:` works without Desktop's Toolkit), C73.

### 5.4 sub_agents, handoffs, and background_agents

- Thesis: Delegation runs a child in a clean sub-session and returns a result, a handoff moves the whole session to another agent, and background agents fan out in parallel.
- Facts:
  1. `sub_agents: [names or refs]` injects `transfer_task(agent, task, expected_output)`; the child runs in a sub-session with a clean task; the parent blocks; always auto-approved; depth capped at 10; cycles rejected (02:F22).
  2. `handoffs: [names]` injects `handoff(agent)`; the next agent sees the full history; the previous one leaves the loop; `force_handoff` routes deterministically after a final response (02:F22).
  3. `background_agents` gives `run_background_agent`, `list_…`, `view_…`, `stop_…`, `wait_background_agents` (timeout 300, max 3600); targets must be in `sub_agents` (02:toolsets table).
  4. Hook routing since v1.147.0: `routing.allowed_agents`, `routing.default_agent`, `before_agent_run` and `after_agent_complete` hooks, `routing_decision` items, `agent_route` events (02:F23).
  5. External refs work as sub-agents (`name:ref`, pin with `@sha256:`) (02:F42).
  6. The `plan` toolset is a shared scratchpad under `~/.cagent/plans/`; `docker-agent plans` edits it from the host with `--expected-version` and exit code 3 (02:toolsets table, cli:da `plans`).
  7. Known bugs: handoff output discarded (#4242), `transfer_task` race (#4156) (04:GH-AGENT).
- Figures:
  - fig-5-4, kind sequence: `root` calls `transfer_task` to `writer` (sub-session, result returned), then `handoff` to `reviewer` (same session, root leaves), with the real tool call ids from the capture. Animates.
- Listings:
  - `agents/team.yaml` (capture/agents/team.yaml).
  - the `transfer_task` call and its result, and the `handoff` call, from `--json` (capture/out/18-transfer-task.json, 18-handoff.json).
- Open questions: K18 (whether `ai/qwen3` emits the tool calls; if not, the fallback in 07).

### 5.5 permissions:, --safety, and hooks:

- Thesis: Four safety modes, three pattern lists, and a fixed hook order decide whether a tool call runs, and the docs say this is not a security boundary.
- Facts:
  1. Modes: `strict`, `balanced`, `restricted`, `autonomous`; `--yolo` equals `autonomous`; precedence `--safety` > `--yolo` > alias > `settings.safety` > `agents.<n>.safety` > `runtime.safety` > historical default; resumed sessions keep their mode (02:F24, cli:da).
  2. Patterns: `allow`, `ask`, `deny` with globs and argument matching such as `shell:cmd=ls*` and `write_file:path=/etc/*`; deny > allow > ask > mode; agent-level and `settings.permissions` merge (02:F25).
  3. Order: `tool_input_transform`, `tool_guard`, `preempt_yolo` `pre_tool_use`, deny, allow, ask, safety mode, `pre_tool_use`, user confirmation (02:F26).
  4. 33 hook events; types `command` (JSON on stdin and stdout, exit 2 blocks), `builtin`, `model`, `evaluator`; options `timeout` 60, `on_error`, `strict_output`; merge order agent YAML, `settings.hooks`, `hooks.d/*.yaml`, `--hook-*` flags (02:F27).
  5. `redact_secrets: true` is the default and installs the builtin on three phases with the portcullis ruleset (02:F28).
  6. Issue #4476: `shell:cmd=ls*` allow rules approve chained commands; permissions are "enforced client-side"; `--sandbox` is the boundary (02:F25).
  7. `serve mcp --http`, `serve a2a`, `serve chat` default to `restricted` (cli:da).
- Figures:
  - fig-5-5, kind decision: one `shell` call walks the nine stages with the capture's deny pattern stopping it, and a second call reaching the `restricted` mode gate. Static.
- Listings:
  - `agents/guarded.yaml` with `permissions` and one `command` hook (capture/agents/guarded.yaml).
  - the hook's stdin JSON and the denied call in the NDJSON (capture/out/19-hook-stdin.json, 19-deny.ndjson).
- Open questions: K19 (the exact `permission_decision` JSON the hook must return; what `restricted` prints when it denies).

### 5.6 session.db, sessions diff, and docker-agent eval

- Thesis: Every run is rows in one SQLite file, `sessions diff` finds the first tool call where two runs differ, and `eval` replays saved sessions in containers and scores them.
- Facts:
  1. `session.db` under `~/.cagent` (`DOCKER_AGENT_DATA_DIR`, `--data-dir`, `-s`); `--session -1` resumes the newest; `--session-read-only`; titles from `title_model`; costs from models.dev with `cost:` overrides (02:F48).
  2. Compaction at 90% (`compaction_threshold`, `compaction_model`), `max_tool_result_tokens`, `num_history_items`; `budget.max_cost|max_tokens|max_time` checked at turn boundaries (02:F34, 02:F35).
  3. `sessions diff A B [--json] [--fail-on-divergence]` compares tool-call sequences, not prose, and stops at the first divergence (cli:da `sessions diff`).
  4. `eval FILE [./evals]` runs JSON session files in containers with `docker/docker-agent:<cli version>` injected; metrics Tool Calls F1, Relevance (judge), Size, Assertions; `/eval` in the TUI saves a session as an eval (02:F46).
  5. `-c` default 10, `--judge-model` default `openai/gpt-5.6-terra`, `--judge-type llm|evaluator`, `--repeat`, `--baseline` with `--regression-tolerance`, `--output <eval-dir>/results` (cli:da `eval`, C65).
  6. `-w/--worktree` runs in `<data-dir>/worktrees/<name>` on branch `worktree-<name>` (02:F51).
  7. Budgets are not forwarded by served agents (C76).
- Figures:
  - fig-5-6, kind timeline: two sessions on one axis of tool calls with the first divergent call marked, and the eval scores for the same agent under it. Static.
- Listings:
  - `docker-agent sessions diff -1 -2 --json` (capture/out/20-sessions-diff.json).
  - `evals/greet.json` and the `eval` run summary (capture/evals/greet.json, capture/out/21-eval.txt).
- Open questions: K20 and K21 (does `eval` run with `--judge-model dmr/ai/qwen3`; the results JSON shape; the eval file schema).

## Part 6: docker-agent serve and share

Thesis: One agent file answers over REST and SSE, an OpenAI-compatible endpoint, MCP, ACP, and A2A, travels as a signed OCI artifact, and runs on a local model.

Accent: indigo.

### 6.1 serve api and serve chat

- Thesis: `serve api` is the full control plane with sessions and SSE on port 8080, and `serve chat` is the OpenAI-compatible subset on port 8083.
- Facts:
  1. `serve api <file|dir|ref>` on 127.0.0.1:8080; `--auth-token`; `--max-request-size` 1 MiB; `-s` defaults to `session.db` in the current directory; `--session-workingdir-root`; `--pull-interval`; `--fake` and `--record` (cli:da `serve api`, C63).
  2. Endpoints: `GET /api/agents`, `POST /api/sessions`, `GET /api/sessions/:id/events` with `Last-Event-ID` and `?since=`, `POST /api/sessions/:id/agent/:agent` (SSE run), `/steer`, `/followup` with Idempotency-Key, `/elicitation`, `/fork`, `GET /api/ping`, `POST /api/mcp-oauth/callback` (02:F41).
  3. Event types: `stream_started`, `agent_choice`, `tool_call`, `tool_call_confirmation`, `tool_call_response`, `plan_changed`, `stream_stopped`, `error` (02:F41).
  4. `serve chat` on 127.0.0.1:8083: `/v1/chat/completions` and `/v1/models`; model id is the agent name; `--api-key`, `--api-key-env`, `--insecure-no-auth`, `--conversations-max` keyed by `X-Conversation-Id`, `--conversation-ttl` 30m, `--request-timeout` 5m, `--max-idle-runtimes` 4, `--safety` default restricted (cli:da `serve chat`).
  5. Non-loopback binding requires a token unless `--insecure-no-auth` (02:F40).
  6. An interactive run can expose the same control plane with hidden `--listen`; discovery record `<data-dir>/runs/<pid>.json` (02:F41).
- Figures:
  - fig-6-1, kind sequence: client, `serve api`, `POST /api/sessions`, `POST …/agent/pirate`, the SSE frames `stream_started` to `stream_stopped`, with real session id prefix. Animates.
- Listings:
  - the `curl` sequence and the SSE frames (capture/out/22-api-session.json, 22-api-events.sse).
  - `GET /v1/models` and one `POST /v1/chat/completions` (capture/out/23-chat-models.json, 23-chat-completion.json).
- Open questions: K22 and K23 (SSE frame shape; whether `--fake` works under `serve api` for the capture).

### 6.2 serve mcp and serve acp

- Thesis: `serve mcp` turns an agent into one MCP tool over stdio or streaming HTTP, and `serve acp` speaks JSON-RPC to an editor over stdio.
- Facts:
  1. `serve mcp FILE` stdio by default; `--http` on 127.0.0.1:8081 (stateless streaming HTTP per the MCP spec revision 2026-07-28); `-a` one agent, else all; `--tool-name` renames; `--attach [pid|address|session]` exposes a running TUI; `--mcp-keepalive` stdio only; `--safety` and `--auth-token` with `--http` only (cli:da `serve mcp`, 02:F40).
  2. Add it to a client with `claude mcp add … -- docker agent serve mcp …` (02:capture 13).
  3. `serve acp FILE` over stdio: `initialize`, `session/new`, `session/prompt`, `session/load`; Zed `agent_servers` entry `["agent","serve","acp","./agent.yaml"]` (02:F40, 02:S22).
  4. ACP elicitation bridging and session deletion arrived in the last 90 days (02:gap 16).
  5. Issue #4420: the ACP permission prompt shows only "Shell" (04:GH-AGENT).
  6. Budgets are not forwarded (C76).
- Figures:
  - fig-6-2, kind flow: the agent file served two ways, stdio lines to an editor (ACP) and HTTP POSTs to port 8081 (MCP), with the method names on each path. Static.
- Listings:
  - stdio MCP: the `initialize`, `tools/list`, `tools/call` lines (capture/out/24-mcp-stdio.jsonl).
  - ACP: `initialize` and `session/new` (capture/out/25-acp.jsonl).
- Open questions: K24 and K25 (the MCP `initialize` result fields; the ACP response shapes).

### 6.3 serve a2a

- Thesis: `serve a2a` publishes an agent card on port 8082 and answers `SendMessage`, and the limitations the docs list show in the task it returns.
- Facts:
  1. `serve a2a FILE` on 127.0.0.1:8082; `-a` defaults to the team's first agent; `--auth-token`, `--cors-origin`, `--insecure-no-auth`, `--safety` default restricted, `-s` session db (cli:da `serve a2a`, C64).
  2. The card path and the protocol version are captured, not assumed (C71).
  3. Limitations: tool calls are not A2A events, no artifacts, no memory, multi-agent "needs further work" (02:S6, C70).
  4. The `a2a` toolset is the client side: one tool per remote skill, `url`, `name` prefix, `headers`, `allow_private_ips` (02:toolsets table).
  5. A2A 101 (`manuals/a2a-101`) defines the card fields, `SendMessage`, and task states this section reuses; the capture compares the served card against R.2 of that manual (a2a-101 manual.json).
  6. Docker's own position in 2025: "we don't currently have a solution" for A2A (04:T18 [25:00]); `serve a2a` exists since the v1.23.4 restructure (02:S14).
- Figures:
  - fig-6-3, kind sequence: client reads the card, `SendMessage`, the agent's model call through DMR, the `Task` or `Message` reply, `GetTask`, drawn with the arrow styles A2A 101 uses. Animates.
- Listings:
  - the agent card (capture/out/26-agent-card.json).
  - one `SendMessage` request and reply (capture/out/26-send-message.http).
- Open questions: K26 (card path, `protocolVersion`, whether the reply is a `Message` or a `Task`, whether `GetTask` works, the JSON-RPC method names).

### 6.4 share push --key and share pull --key

- Thesis: An agent file travels as an OCI artifact whose manifest annotations carry the version, the tags, and a DSSE attestation, and `--key` lets a puller verify or decrypt it.
- Facts:
  1. `share push FILE REF [--key] [--encrypt]`; the YAML is always pushed in clear; the key is PEM or OpenSSH (Ed25519, ECDSA, RSA) or a 16-byte-plus secret; `--encrypt` embeds an encrypted copy; Ed25519 cannot encrypt (cli:da `share push`).
  2. `share pull REF [--force] [--key]` verifies the signature or MAC and fails on an unprotected artifact when a key is given; `DOCKER_AGENT_ENCRYPT_KEY` substitutes (cli:da `share pull`).
  3. Annotations: `io.docker.agent.version`, `io.docker.cagent.version` (legacy), `io.docker.agent.tags`, `io.docker.agent.attestation` (DSSE over in-toto Statement v1), `in-toto.io/predicate-type` with predicateType `https://docker.com/docker-agent/share/publication/v1` (02:F42).
  4. `docker-agent run myorg/agent@sha256:…` runs from a registry; `sub_agents` can be refs; configs from OCI or HTTP are capped at 32 MiB (02:F42).
  5. `agentcatalog/*` is Docker's Hub namespace with `content_types: ["agent"]`; `docker run` on such an artifact fails (02:F43, 04:T09 [12:30]).
  6. `instruction_file` is inlined on push (02:agent keys).
- Figures:
  - fig-6-4, kind structure: the pushed manifest with its config, one layer, and the annotation block, the DSSE envelope opened one level, and the `share pull --key` check. Static.
- Listings:
  - `share push agents/pirate.yaml localhost:5000/pirate:1 --key file://capture/keys/ed25519` and the manifest from `imagetools inspect --raw` (capture/out/27-share-push.txt, 27-manifest.json).
  - `share pull --key` and `run localhost:5000/pirate:1` (capture/out/27-share-pull.txt, 27-run-ref.txt).
- Open questions: K27 (does `share push` accept a plain HTTP local registry; the exact media types).

### 6.5 dmr/ai/qwen3, Compose models:, and the docker/mcp-gateway service

- Thesis: A local model is a provider at port 12434, a Compose file binds that model and an MCP gateway to a service, and three gateways with one name stay distinct.
- Facts:
  1. DMR base URLs: host `http://localhost:12434`, Desktop containers `http://model-runner.docker.internal`, Engine containers `http://172.17.0.1:12434`; OpenAI paths under `/engines/v1/`, Anthropic under `/anthropic/v1/messages` or `/v1/messages`, Ollama under `/api/`; no key (03:(b)4, 03:(b)5, C79).
  2. DMR is disabled by default since Desktop 4.71.0; `docker desktop enable model-runner --tcp 12434`; models are OCI artifacts in the `ai/` namespace; idle unload after about 5 minutes (03:(b)2, 03:(b)9, 03:(b)10).
  3. `docker model status --json`, `pull`, `ls`, `requests --model M -f`, `unload`; `docker model configure` is in dispute (03:S50, C77).
  4. Compose `models: { llm: { model: ai/qwen3, context_size, runtime_flags } }` and `services.x.models: [llm]` inject `LLM_URL` and `LLM_MODEL`; long syntax `endpoint_var` and `model_var`; the injected URL is `http://model-runner.docker.internal/engines/v1/` on Desktop (03:(c)1 to (c)3).
  5. The gateway service: `image: docker/mcp-gateway`, `use_api_socket: true`, `command: [--transport=streaming, --servers=duckduckgo]`, consumers read `http://mcp-gateway:8811` (03:(c)6, 03:(a)7).
  6. Three gateways: the sbx host-side gateway (`sbx mcp`), the Toolkit gateway (`docker mcp gateway run`, 16 clients, 1 CPU and 2 GB per server container), the hosted governed gateway ("invite-only") (C88, C91).
  7. `docker-agent` reaches a catalog server with `ref: docker:<name>` through the Toolkit gateway; the Docker Agent sandbox template ships `docker-mcp` from `docker/mcp-gateway:v2` (03:S34, 03:S55).
  8. Compose cannot start sandboxes; Compose inside a sandbox runs on the private engine (C96, 03:(c)10).
- Figures:
  - fig-6-5, kind structure: the DMR address map with the five base URLs and the three engine subpaths, each labelled with who calls it. Static.
  - fig-6-6, kind flow: the capture's `compose.yaml`: `agent` service, `mcp-gateway` service with the API socket, DMR behind `model-runner.docker.internal`, the injected variables named. Static.
- Listings:
  - `docker model status --json` and `curl localhost:12434/engines/v1/models` (capture/out/28-model-status.json, 28-models.json).
  - `compose/compose.yaml` and `docker compose config` cut to the injected variables (capture/compose/compose.yaml, capture/out/29-compose-config.yaml).
  - `docker mcp gateway run --transport streaming --servers duckduckgo` and `docker mcp tools ls` (capture/out/29-gateway-tools.txt).
- Open questions: K28 and K29 (the DMR version after the Desktop update; `configure`; the mcp-gateway version; `:v2` tag), C77, C89, C92.

## Part 7: Operating it

Thesis: The same sandbox moves to the cloud by the second, an organization narrows it with policies and reads its audit log, old commands map to new ones, and the claims can be checked.

Accent: teal.

### 7.1 sbx --cloud run, sbx move, and sbx ttl

- Thesis: A cloud sandbox is the same microVM on Docker's compute, billed by the second in five shapes, with a TTL ceiling of 24 hours and separate secrets and policies.
- Facts:
  1. `sbx --cloud` dispatches to the Cloud Sandboxes API; cloud hides `daemon`, `prune`, `settings`, `skills`; `attach`, `ttl`, `volume` are cloud-only; `rm --all` is disabled (cli:sbx-cloud, C47).
  2. Shapes: micro 1 vCPU/2048 MiB, small 2/4096 (default), medium 4/8192, large 8/16384, xl 16/32768; prices $0.07, $0.14, $0.28, $0.56, $1.12 per hour, metered per second, paused costs nothing; $250 promotional credit (cli:sbx `template load`, 03:S70, C101).
  3. TTL default 1h, hard 24h ceiling from creation, `sbx ttl +2h NAME`, `--on-timeout stop|restart|delete`; v0.47.0 added the stopped state (cli:sbx `ttl`, `create`, 01:F109).
  4. No host workspace; `--image-ref` inline create; templates must already exist in the cloud registry; `attach` with `Ctrl-\` detach; `ssh <sbx_id>@sbx_cloud`; public HTTPS URLs for TCP ports; volumes are snapshot-on-exit, last writer wins (cli:sbx `attach`, `volume`, 01:F110).
  5. `sbx move NAME --to cloud|local`: captures the filesystem as an image; secrets, host mounts, local rules, running processes do not travel; kit rules do; moving to local stages up to 32 GiB; default name `moved-<source>` (cli:sbx `move`).
  6. `sbx --cloud policy init` sets an account or sandbox default and can be rerun; host policies do not apply (cli:sbx `policy init`).
  7. Needs sbx 0.45.1+, a pay-as-you-go plan on a Personal or Pro account; the console is agentic-platform.docker.com; quotas 10 concurrent, 50 stored, 100 volumes, 100 secrets (C36, C103, 03:(g)5).
  8. Offload is a different product (a remote daemon for Desktop) and is not a sandbox path (C98, C99).
- Figures:
  - fig-7-1, kind flow: `sbx move --to cloud` with what travels (filesystem image, kit rules, TCP ports as URLs) and what stays (secrets, host mounts, local rules, processes), and the TTL clock on the destination. Static.
- Listings:
  - `sbx --cloud run -d shell --name cloud-demo --ttl 15m --on-timeout delete`, `sbx --cloud ls --json`, `sbx ttl cloud-demo --json` (capture/out/33-cloud-run.txt, 33-cloud-ls.json, 33-ttl.json; needs approval, costs money).
  - `sbx move demo --to cloud` output (capture/out/33-move.txt; needs approval).
- Open questions: K33 (all of it; approval required), C104.

### 7.2 sbx policy ls --source org, --profile, and the audit JSONL

- Thesis: An organization writes policies in Docker Home, the daemon pulls them every five minutes, local rules can only narrow, and every decision lands in a rotating JSONL file.
- Facts:
  1. Org policies: authored in Docker Home under a separate AI Governance subscription, synced every 5 minutes, limits 100 policies, 250 rules, 400 KB; "a local deny can only narrow, never widen" (01:F114, cli:sbx `create --deny-network`).
  2. `sbx policy ls --source org`, `--include-inactive`, `--profile`; `sbx policy profile ls` lists profiles from remote governance; `create --profile` assigns one (cli:sbx `policy ls`, `policy profile`, `create`).
  3. Four control surfaces: network, filesystem, credentials, MCP tools; MCP policies are Cedar with `MCP::Primordial` and `MCP::Tool` resources and `@requireApproval` (04:B15, 03:S27).
  4. Audit: `audit-<utc>-<uuid>-<seq>.jsonl` under `~/Library/Logs/com.docker.sandboxes/sandboxes/auditkit/` (macOS), rotation every 5 minutes, 1000 events, or 50 MiB; 90-day retention in Docker Home; CSV export; SIEM guides (01:F115).
  5. Sign-in enforcement: `com.docker.sbx` managed preferences, `HKLM\SOFTWARE\Policies\Docker\SBX`, `/etc/docker-sbx/config.json` with `allowedOrgs` (01:F116).
  6. Audit events name the client (sbx) and hostname; gh-aw runs produce them (04:B14).
  7. Local use is free; governance is paid; this capture has no org, so `--source org` is empty (03:(g)4).
- Figures:
  - fig-7-2, kind flow: Docker Home policy, 5-minute pull, `sandboxd`, the merge with local rules (narrow only), the proxy decision, the JSONL file, rotation, upload, SIEM. Static.
- Listings:
  - `ls` of the auditkit directory and the first lines of one file (capture/out/32-auditkit-ls.txt, 32-audit-head.jsonl).
  - `sbx policy ls --source org` and `sbx policy profile ls` with no org (capture/out/32-policy-org.txt, 32-policy-profile.txt).
- Open questions: K32 (whether local audit files exist without a subscription; their fields), C37.

### 7.3 From docker sandbox and cagent to sbx and docker agent

- Thesis: Two renames and one CLI restructure changed every command in the 2025 and early 2026 material, and this section maps each old line to its replacement.
- Facts:
  1. Timeline: Desktop 4.50.0 container sandboxes (2025-11-06), 4.58.0 microVMs (2026-01-26), v0.21.0 standalone (2026-03-31), 4.80.0 removes the plugin (2026-06-29); cagent v0.5.0 (2025-09-01), v1.23.4 restructure (2026-02-19), v1.30.0 rename (2026-03-09), 4.81.0 removes `cagent` (2026-07-06) (01:timeline, 02:timeline).
  2. The plugin v0.12.0 command tree versus sbx v0.47.0: `create cagent` to `create docker-agent` (alias kept), `network proxy` to `policy allow|deny network`, `network log` to `policy log`, `save` to `template save`, `--pull-template` to `--pull`, `ls` "List VMs" to `ls` (cli:sandbox, cli:sbx, C108, C109).
  3. The `docker agent` plugin v1.32.4 versus `docker-agent` v1.149.0: added `setup`, `doctor`, `models`, `toolsets`, `board`, `plans`, `sessions`, `debug`, `sandbox`, `getting-started`, `serve chat`; added `--safety`, `--last`, `--flavor`, `--worktree*`, `--sbx`, `--kit*`, `--cloud`, `share --key` (cli:agent, cli:da, 02:conflict 1).
  4. The cagent to docker-agent map: commands, env vars, docs URL, install names, Hub images `docker/cagent` to `docker/docker-agent`, annotation `io.docker.cagent.version` kept (02:F12, 02:F44).
  5. The stale-advice list S1 to S30 (05-conflicts-register.md).
  6. State directories: legacy `~/.docker/sandboxes/`, `~/.sandboxd/`; nothing migrates (C17).
  7. The paths `~/.cagent`, `~/.config/cagent`, `~/Library/Caches/cagent` keep the old name (C54).
- Figures:
  - fig-7-3, kind timeline: two tracks, sandboxes and agent, from 2025-09 to 2026-10 with the versions and the three Desktop removals marked. Static.
- Listings:
  - `docker sandbox version` on Desktop 4.94.0 and `docker agent version` beside `docker-agent version` (capture/out/34-docker-sandbox.txt, 34-plugin-version.txt).
  - `sbx create cagent --help` showing the alias (capture/out/34-cagent-alias.txt).
- Open questions: K34, C107.

### 7.4 kit-tck, sbx diagnose, and the claims this manual checked

- Thesis: Five claims from Docker's own pages can be checked on one laptop, and this section says which ones the captures confirmed, which the community disputes, and which stay unverified.
- Facts:
  1. Checked by capture: the sentinel in the environment and the swap at the proxy (K10), a blocked request in the log (K09), the private engine (K04), `--clone` commits through a remote (K08), a kit signature that verifies (K12), a local model with no key (K17, K28).
  2. `kit-tck validate|inspect` is the spec's conformance suite with artifact and runtime halves (01:F90).
  3. `sbx diagnose` is the only self-check; `--output github-issue` prepares a report (cli:sbx `diagnose`).
  4. Community findings with dates: mandatory login (HN01 2026-08-10, #321), closed-source VMM, macOS `sbx ls` hang (#163), Windows start failures (#350), Pi agent (#34), allowed-host exfiltration (HN01, T05), MITM proxy (#12), SSH agent forwarding surprise (#121), performance (W01, #31) (04:community findings).
  5. Unverified claims the manual does not print as fact: libkrun, a microVM HTTP API, Kubernetes runtime, Warp Oz, start-time numbers (C4, C29, C105, C106).
  6. No third-party audit of the microVM boundary exists in the corpus (04:T24).
  7. `docker-agent sessions diff --fail-on-divergence` is the regression check the capture kit uses for the agent runs (cli:da).
- Figures:
  - fig-7-4, kind comparison: left, the claims with the capture file that confirmed each; right, the claims the manual leaves unverified with their source. Static.
- Listings:
  - `kit-tck validate ./kits/hello-kit` (capture/out/13-kit-tck.txt).
  - the timing table from three creates (capture/out/35-timing.txt).
- Open questions: K13 (kit-tck availability on macOS), K35.

## Reference

Accent: grey. Thesis: Lookup tables for every name in the manual.

### R.1 sbx commands

Every command of the v0.47.0 help tree (97 entries): command, purpose, flags with defaults, local or cloud or both, experimental flag. Source: cli:sbx, cli:sbx-cloud, probe:sbx-kit-ls. Includes the hidden-command note (C16).

### R.2 docker-agent commands

Every command of the v1.149.0 help tree (47 entries incl. `getting-started`): command, purpose, flags with defaults, which need Docker, which need a model. Source: cli:da, probe files.

### R.3 sbx settings keys, environment variables, and paths

The `sbx settings list --json` keys with type, default, RESTART, description (capture K02); the `DOCKER_SANDBOXES_*`, `SBX_*`, `SANDBOXES_STORAGE_ROOT` variables (01:4c, 01:4d); the `DOCKER_AGENT_*` variables with legacy aliases (02:env vars); file paths on macOS, Windows, Linux for both products (01:4e, 02:files table). Marks documented keys the CLI did not list (C19).

### R.4 Agent file keys

Top-level keys (16), `agents.<name>` keys, `models.<name>` keys, `providers.<name>` keys, shared toolset keys, hook definition keys, `permissions`, `budget`, `flavors`, `evaluators`, `runtime` (02:reference extraction, 02:S13). One row per key with type, default, and the section that uses it.

### R.5 Toolsets

The 27 types from `docker-agent toolsets` with the tools each exposes and its notable options; a separate row for the implicit `transfer_task` and `handoff` (02:toolsets table, probe:docker-agent-toolsets, C56).

### R.6 Providers and models

The 31 provider ids with their credential variables, canonical and legacy ids, `auth` schemes, and DMR `provider_opts`; the thinking-budget forms per provider; the `--models-gateway` token exchange (02:F30, 02:F33, probe:docker-agent-doctor).

### R.7 Sources and the conflicts register

The pin, the vendored files, the ranked sources, and the register from `05-conflicts-register.md` condensed to one row per conflict with the section that discusses it and the status after the captures. Includes the stale-advice table S1 to S30 in short form.

### R.8 Glossary and index of figures

One row per term with its meaning in this manual and the section that defines it (sandbox, template, kit, mixin, workload, capability, workspace, clone mode, sentinel, policy scope, preset, proxy type, gateway, static set, agent file, toolset, sub-agent, handoff, safety mode, session, cassette, eval, flavor, alloy, shape, TTL, profile), followed by the `figure-index` block.

## Figure index (33 numbered figures, plus figure 0.1 and the plate)

| id | section | kind | one line | animates |
|---|---|---|---|---|
| fig-0-1 | front | sequence | the arrow grammar on the sentinel swap: call, reply, durable write, state change, model call, effect, stream, failure | yes |
| plate | cover | sequence | `docker-agent run --sandbox` from the kit hash to the stored session, in lanes | no |
| fig-1-1 | 1.1 | layers | host, hypervisor, guest kernel, containerd, private dockerd, agent container, docker-agent process | no |
| fig-1-2 | 1.1 | comparison | the two launch paths with their image names and default flags | no |
| fig-1-3 | 1.2 | sequence | one `--sandbox --exec` run, operator to session.db | yes |
| fig-2-1 | 2.1 | state | absent, created, running, stopped, removed, with the verbs | no |
| fig-2-2 | 2.3 | flow | template save, image store, tar, load, `--pull never -t` | no |
| fig-2-3 | 2.4 | tree | the macOS state directory, socket, log, symlink, legacy dirs greyed | no |
| fig-3-1 | 3.1 | layers | the microVM boundary with four doors: mount, network, secret, MCP | no |
| fig-3-2 | 3.2 | flow | `--clone`: `/run/sandbox/source`, private clone, git-daemon, `sandbox-<name>` remote | no |
| fig-3-3 | 3.3 | decision | the policy ladder for `example.com:443` with captured rule ids | no |
| fig-3-4 | 3.4 | sequence | a blocked request, its log row, the allow, the second request through the MITM proxy | yes |
| fig-3-5 | 3.4 | comparison | an allowed host carrying data vs a kit L7 deny on `DELETE /repos/**` | no |
| fig-3-6 | 3.5 | sequence | the sentinel in the env, the proxy swap, the receiver's log | yes |
| fig-3-7 | 3.6 | flow | the host MCP store, the per-sandbox gateway, static vs loaded servers, `tools/list_changed`, OAuth | no |
| fig-4-1 | 4.1 | structure | `kit.yaml` beside its OCI manifest annotation | no |
| fig-4-2 | 4.2 | tree | workload plus mixins resolving to one grant set, widening stops | no |
| fig-4-3 | 4.3 | flow | validate, pack, sign, push, verify, provenance with referrers | no |
| fig-4-4 | 4.4 | flow | `sbxenv.yaml`, plan, approve, create, state, second plan | no |
| fig-5-1 | 5.1 | flow | the run loop with the cassette store for record and replay | no |
| fig-5-2 | 5.2 | structure | `agents`, `models`, `providers` blocks of the capture files with the `auto` ladder | no |
| fig-5-3 | 5.3 | flow | three `mcp` toolset forms: docker ref, command, remote | no |
| fig-5-4 | 5.4 | sequence | `transfer_task` to a sub-session, then `handoff` in the same session | yes |
| fig-5-5 | 5.5 | decision | one shell call through the nine approval stages | no |
| fig-5-6 | 5.6 | timeline | two sessions, the first divergent tool call, the eval scores | no |
| fig-6-1 | 6.1 | sequence | `serve api`: create session, run agent, SSE frames | yes |
| fig-6-2 | 6.2 | flow | one file served as MCP over HTTP and as ACP over stdio | no |
| fig-6-3 | 6.3 | sequence | `serve a2a`: card, `SendMessage`, model call, reply, `GetTask` | yes |
| fig-6-4 | 6.4 | structure | the agent artifact manifest with its annotations and DSSE envelope | no |
| fig-6-5 | 6.5 | structure | the DMR address map | no |
| fig-6-6 | 6.5 | flow | the capture's Compose stack: agent, mcp-gateway, DMR, injected variables | no |
| fig-7-1 | 7.1 | flow | `sbx move --to cloud`: what travels, what stays, the TTL | no |
| fig-7-2 | 7.2 | flow | org policy pull, narrow-only merge, decision, audit JSONL, rotation, SIEM | no |
| fig-7-3 | 7.3 | timeline | two product tracks 2025-09 to 2026-10 with the three Desktop removals | no |
| fig-7-4 | 7.4 | comparison | claims confirmed by capture vs claims left unverified | no |

Seven animate on the web with a Replay control (figure 0.1, fig-1-3, fig-3-4, fig-3-6, fig-5-4, fig-6-1, fig-6-3); print and reduced motion show the final frame. The plate is static.

## Listing index (47 listings)

| n | section | title | source file |
|---|---|---|---|
| 1 | 1.1 | `sbx --help` command groups | capture/out/01-help-sbx.txt |
| 2 | 1.1 | `docker-agent --help` command groups | capture/out/01-help-docker-agent.txt |
| 3 | 1.2 | the `--sandbox` launch summary and allowlist | capture/out/30-sandbox-launch.txt |
| 4 | 1.2 | the 403 and `sandbox allow` | capture/out/30-blocked-403.txt, 30-sandbox-allow.txt |
| 5 | 1.2 | three events of the sandboxed run | capture/out/30-run.ndjson |
| 6 | 2.1 | `sbx create` and `sbx ls --json` | capture/out/04-create.txt, 04-ls.json |
| 7 | 2.1 | `sbx prune --dry-run --json` | capture/out/04-prune-dry-run.json |
| 8 | 2.2 | `sbx ports --publish` and the host curl | capture/out/05-ports.json, 05-ports-curl.txt |
| 9 | 2.2 | `sbx cp` in and out | capture/out/06-cp.txt |
| 10 | 2.3 | `template save` with `-o` and `template ls --json` | capture/out/07-template-save.txt, 07-template-ls.json |
| 11 | 2.3 | a run from the saved template | capture/out/07-template-run.txt |
| 12 | 2.4 | `sbx diagnose` Platform block | capture/out/02-diagnose.json |
| 13 | 2.4 | `sbx daemon status --json` | capture/out/02-daemon-status.json |
| 14 | 2.5 | five settings records | capture/out/02-settings.json |
| 15 | 2.5 | one setting with its source | capture/out/02-settings-experimental.json |
| 16 | 3.1 | the guest: kernel, OS, engine, page size, mounts | capture/out/04-guest.txt |
| 17 | 3.2 | the clone inside: remotes and HEAD | capture/out/08-clone-inside.txt |
| 18 | 3.2 | the host side: remote, ls-remote, fetch | capture/out/08-clone-host.txt |
| 19 | 3.3 | the balanced allowlist as rules | capture/out/03-policy-balanced.json |
| 20 | 3.3 | `policy check network --verbose --json` before and after | capture/out/09-check-verbose.json |
| 21 | 3.3 | `policy inspect <rule-id> --json` | capture/out/09-inspect-rule.json |
| 22 | 3.4 | the blocked curl and `policy log --json` | capture/out/09-blocked.txt, 09-policy-log.json |
| 23 | 3.4 | proxy variables and CA path inside | capture/out/04-env.txt |
| 24 | 3.5 | the sentinel inside and the receiver's header | capture/out/10-env-sentinel.txt, 10-receiver.log |
| 25 | 3.5 | `secret ls --json` and `secret import --dry-run` | capture/out/10-secret-ls.json, 10-import-dry-run.txt |
| 26 | 3.5 | the GitHub sentinel and `gh api user` inside (approval) | capture/out/10-github-sentinel.txt |
| 27 | 3.6 | `sbx mcp add` and `sbx mcp ls --json` | capture/out/11-mcp-add.txt, 11-mcp-ls.json |
| 28 | 3.6 | `sbx mcp inspect --json` | capture/out/11-mcp-inspect.json |
| 29 | 3.6 | `tools/list` from inside before and after `load` | capture/out/11-gateway-tools.json |
| 30 | 4.1 | `kit.yaml` of hello-kit | capture/kits/hello-kit/kit.yaml |
| 31 | 4.1 | the manifest with `vnd.docker.sandbox.kit.descriptor` | capture/out/13-manifest.json |
| 32 | 4.2 | `kit inspect` of a Docker v3 kit, capabilities only | capture/out/13-kit-inspect.json |
| 33 | 4.3 | `spec.yaml` of hello-mixin | capture/kits/hello-mixin/spec.yaml |
| 34 | 4.3 | validate, sign, verify | capture/out/12-validate.json, 12-sign.txt, 12-verify.json |
| 35 | 4.3 | a run with `--kit` and `which jq` | capture/out/12-run-kit.txt |
| 36 | 4.4 | `sbxenv.yaml` | capture/env/sbxenv.yaml |
| 37 | 4.4 | two plans, before and after an edit | capture/out/14-env-plan.txt, 14-env-plan-2.txt |
| 38 | 4.5 | `skills add` and `skills ls --json` | capture/out/15-skills-add.txt, 15-skills-ls.json |
| 39 | 5.1 | `docker-agent doctor` | capture/out/16-doctor.txt |
| 40 | 5.1 | `run --exec --last` and three `--json` events | capture/out/17-run-last.txt, 17-run-json.ndjson |
| 41 | 5.2 | `agents/pirate.yaml` and its canonical form with a flavor | capture/agents/pirate.yaml, capture/out/16-debug-config-flavor.yaml |
| 42 | 5.3 | `toolsets --format json` and `debug tool read_file` | capture/out/16-toolsets.json, 16-debug-tool.json |
| 43 | 5.4 | `team.yaml` and the `transfer_task` and `handoff` calls | capture/agents/team.yaml, capture/out/18-transfer-task.json, 18-handoff.json |
| 44 | 5.5 | `guarded.yaml`, the hook stdin, the denied call | capture/agents/guarded.yaml, capture/out/19-hook-stdin.json, 19-deny.ndjson |
| 45 | 5.6 | `sessions diff --json` and the eval summary | capture/out/20-sessions-diff.json, 21-eval.txt |
| 46 | 6.1 | the API session and SSE frames; `/v1/models` and one completion | capture/out/22-api-session.json, 22-api-events.sse, 23-chat-*.json |
| 47 | 6.2 to 7.4 | MCP stdio lines, ACP lines, the A2A card and `SendMessage`, `share push` manifest and pull, DMR status and models, `compose.yaml` and `config`, gateway tools, cloud run and move (approval), auditkit listing, `docker sandbox version`, `cagent` alias, `kit-tck`, timing | capture/out/24-*, 25-*, 26-*, 27-*, 28-*, 29-*, 33-*, 32-*, 34-*, 13-kit-tck.txt, 35-timing.txt |

Row 47 stands for 15 listings numbered 47 to 61 in the sections 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4 as listed in each section above; the count of listings in the manual is 61 at most and 47 at least, depending on which approval-gated captures run.

## Page budget

33 body sections at 450 to 650 words with one to three figures and one to three listings each come to about 90 pages; the front matter is 4 pages; the 8 reference sections are about 14 pages; total about 108 letter pages. If the count must fall to 32 or below, fold 4.5 into 4.4 first (one section, no figure), then 6.2 into 6.1 (one section, one figure).
