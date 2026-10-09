# sbx commands

> Every verb of sbx 0.47.0 in the four groups of `sbx --help`, with its purpose, the flags that matter, its scope, and the section that explains it.

The root help of sbx 0.47.0 lists 31 commands in four groups: Sandbox, Management, Experimental, and Other {{help-sbx sbx}}. The vendored tree holds 115 help pages, one for each command and subcommand that answered `--help`. The tables below keep the order of the root help. Scope says where a verb runs: local sandboxes through `sandboxd`, cloud sandboxes through `sbx --cloud`, or both. `sbx --cloud --help` hides `daemon`, `prune`, `settings`, and `skills`, and `attach`, `ttl`, and `volume` run only with `--cloud` ([conflict C47](#s-ref-sources-and-the-conflicts-register)).

Three flags apply to every command {{help-sbx sbx}}.

| Global flag | Meaning |
|---|---|
| `--cloud` | Dispatch to the Docker Cloud Sandboxes API instead of the local `sandboxd` |
| `-D, --debug` | Enable debug logging |
| `-h, --help` | Print the help of the command |

## Sandbox commands

| Command | Purpose | Flags that matter | Scope | Section |
|---|---|---|---|---|
| `attach SANDBOX` | Attach a terminal to a cloud sandbox, and start it first when it is stopped {{help-sbx sbx attach}} | `--detach-keys` (default `Ctrl-\`) | cloud only | [§7.1](#s-sbx-cloud-run-move-and-ttl) |
| `cp SRC DST` | Copy a file or a directory between a sandbox and the host, with one side written as `SANDBOX:PATH` {{help-sbx sbx cp}} | `-L, --follow-link` | both | [§2.2](#s-sbx-exec-cp-and-ports) |
| `create AGENT\|SANDBOX_KIT [PATH...]` | Create a sandbox for one of the 11 agents or from a kit reference, without attaching {{help-sbx sbx create}} | `--name` (default `<agent>-<workdir>`), `--clone`, `--cpus` (0 is auto), `-m, --memory` (default 50% of host memory, 512 MiB to 32 GiB), `-e, --env`, `--env-file`, `--deny-network`, `-p, --publish`, `--pull always\|missing\|never` (default `always`), `--skills off\|readonly\|readwrite` (default `readonly`), `--static-mcp`, `-t, --template`, `--profile`, `--kit` (experimental), `--kit-arg`, `--kit-args-file`, `-q` | both | [§2.1](#s-sbx-run-create-stop-and-rm) |
| `create <agent> [PATH...]` | The eight subcommands `claude`, `codex`, `cursor`, `devin`, `docker-agent`, `gemini`, `opencode`, `shell`, with the same flags, and `cagent` as an alias of `docker-agent` {{help-sbx sbx create docker-agent}} | the flags of `create` | both | [§2.1](#s-sbx-run-create-stop-and-rm) |
| `create` with `--cloud` | Create a cloud sandbox with no host workspace, 2 CPUs and 4 GiB unless sized {{help-sbx sbx create}} | `--allow-network`, `--image-ref`, `--on-timeout stop\|restart\|delete`, `--platform`, `--ttl`, `-v, --volume` (experimental) | cloud only | [§7.1](#s-sbx-cloud-run-move-and-ttl) |
| `exec SANDBOX COMMAND` | Run a command inside a sandbox, and start a stopped one first {{help-sbx sbx exec}} | `-i`, `-t`, `-u, --user`, `-w, --workdir`, `-e`, `--env-file`, `--privileged`, `--detach-keys`. `-d` is not supported. `-d`, `--user`, and `--privileged` are rejected with `--cloud` | both | [§2.2](#s-sbx-exec-cp-and-ports) |
| `ls` | List sandboxes with agent, status, published ports, and workspace {{help-sbx sbx ls}} | `--json`, `-q` | both | [§2.1](#s-sbx-run-create-stop-and-rm) |
| `move SANDBOX` | Move a sandbox between the host and the cloud as a filesystem image {{help-sbx sbx move}} | `--to local\|cloud`, `--name` (default `moved-` plus the source name), `--ttl` (15s to 24h), `--on-timeout stop\|delete`, `-f` | both | [§7.1](#s-sbx-cloud-run-move-and-ttl) |
| `ports SANDBOX` | List, publish, or unpublish sandbox ports {{help-sbx sbx ports}} | `--publish`, `--unpublish`, `--json`. A port without a protocol binds `tcp4` | both | [§2.2](#s-sbx-exec-cp-and-ports) |
| `prune` | Remove all stopped sandboxes and their sandbox-scoped secrets {{help-sbx sbx prune}} | `--dry-run`, `--filter until=TIMESTAMP`, `-f`, `--json` | local only | [§2.1](#s-sbx-run-create-stop-and-rm) |
| `rm [SANDBOX...]` | Remove sandboxes, their containers, git worktrees, state, and scoped secrets {{help-sbx sbx rm}} | `--all` (disabled with `--cloud`), `-f` | both | [§2.1](#s-sbx-run-create-stop-and-rm) |
| `run [AGENT\|SANDBOX_KIT] [PATH...] [-- AGENT_ARGS...]` | Run an agent and create the sandbox when it does not exist {{help-sbx sbx run}} | the flags of `create`, plus `-d, --detached`, `--rm`, `--name` to re-attach, `--new` (cloud), `--detach-keys` (cloud). `--clone` works only at creation | both | [§2.1](#s-sbx-run-create-stop-and-rm) |
| `stop SANDBOX...` | Stop sandboxes and keep their state {{help-sbx sbx stop}} | none | both | [§2.1](#s-sbx-run-create-stop-and-rm) |
| `ttl [+DURATION] SANDBOX` | Print or extend the TTL of a cloud sandbox under its 24 hour ceiling {{help-sbx sbx ttl}} | `--json` | cloud only | [§7.1](#s-sbx-cloud-run-move-and-ttl) |

The 11 agent names that `run` and `create` accept are claude, codex, copilot, cursor, devin, docker-agent, droid, gemini, kiro, opencode, and shell {{help-sbx sbx run}}. Only eight of them have a `create` subcommand, because copilot, droid, and kiro are public kits ([conflict C9](#s-ref-sources-and-the-conflicts-register)).

## Management commands

| Command | Purpose | Flags that matter | Scope | Section |
|---|---|---|---|---|
| `daemon start` | Start `sandboxd` {{help-sbx sbx daemon start}} | `-d, --detach`, `--policy allow-all\|balanced\|deny-all` | local only | [§2.4](#s-sandboxd-diagnose-and-reset) |
| `daemon stop`, `daemon restart` | Stop or restart `sandboxd` {{help-sbx sbx daemon}} | none | local only | [§2.4](#s-sandboxd-diagnose-and-reset) |
| `daemon status` | Print the daemon state, its socket, and its log path {{help-sbx sbx daemon status}} | `--json` | local only | [§2.4](#s-sandboxd-diagnose-and-reset) |
| `daemon log-level set <target> <level>` | Set the log level of `proxy`, `general`, or `all` {{help-sbx sbx daemon log-level set}} | none | local only | [§2.4](#s-sandboxd-diagnose-and-reset) |
| `diagnose` | Run the 13 installation checks {{help-sbx sbx diagnose}} | `--json`, `-o json\|github-issue`, `--upload` | both | [§2.4](#s-sandboxd-diagnose-and-reset) and [§7.4](#s-kit-tck-diagnose-and-the-claims-this-manual-checked) |
| `mcp add <name> (--url \| --command)` | Register an MCP server from a remote endpoint, a registry URL, a manifest URL, a `dhi.io` image, or a host command {{help-sbx sbx mcp add}} | `--url`, `--command`, `--args`, `--dir`, `--local`, `--header`, `--client-id`, `--oauth-authorization-server`, `--scope`, `--no-scope`, `--resource`, `--callback-port`, `--skip-auth`, `--skip-ssrf-check`, `--disable-http2` | both | [§3.6](#s-sbx-mcp-add-load-and-static-mcp) |
| `mcp auth [server-name]` | Authorize or reauthorize remote servers through the hosted control plane {{help-sbx sbx mcp auth}} | `--all`, `--scope`, `--no-scope`, `--verbose`, `--format text\|json`, `--json` | both | [§3.6](#s-sbx-mcp-add-load-and-static-mcp) |
| `mcp auth rm`, `mcp auth status` | Remove hosted OAuth credentials, or show their status without starting OAuth {{help-sbx sbx mcp auth status}} | `--all`, `-f` (rm only), `--format`, `--json` | both | [§3.6](#s-sbx-mcp-add-load-and-static-mcp) |
| `mcp inspect <name>` | Show one registration, its headers, and the effective `resource` value {{help-sbx sbx mcp inspect}} | `--json` | both | [§3.6](#s-sbx-mcp-add-load-and-static-mcp) |
| `mcp load <name> --sandbox S` | Attach a registered server to a running sandbox, with a `tools/list_changed` notification to the agent {{help-sbx sbx mcp load}} | `--sandbox` (required) | both | [§3.6](#s-sbx-mcp-add-load-and-static-mcp) |
| `mcp ls` | List registered servers under the gateway that serves them {{help-sbx sbx mcp ls}} | `--json`, `-q` | both | [§3.6](#s-sbx-mcp-add-load-and-static-mcp) |
| `mcp rm <name>` | Remove a registration {{help-sbx sbx mcp rm}} | `-f` | both | [§3.6](#s-sbx-mcp-add-load-and-static-mcp) |
| `policy init <allow-all\|balanced\|deny-all>` | Set the global network policy once, before the first sandbox {{help-sbx sbx policy init}} | `--sandbox` (cloud only) | both | [§3.3](#s-sbx-policy-init-allow-deny-and-check-network) |
| `policy allow network RESOURCES` | Add an allow rule for hosts, domains, IP addresses, or CIDR prefixes, TCP by default {{help-sbx sbx policy allow network}} | `--sandbox`, `--protocol tcp\|udp` | both | [§3.3](#s-sbx-policy-init-allow-deny-and-check-network) |
| `policy deny network RESOURCES` | Add a deny rule, TCP and UDP by default, which wins over allow {{help-sbx sbx policy deny network}} | `--sandbox`, `--protocol tcp\|udp` | both | [§3.3](#s-sbx-policy-init-allow-deny-and-check-network) |
| `policy check network TARGET` | Ask the daemon authorizer whether a host and port is allowed, without sending anything {{help-sbx sbx policy check network}} | `--sandbox`, `--protocol`, `--verbose`, `--json` | both | [§3.3](#s-sbx-policy-init-allow-deny-and-check-network) |
| `policy inspect <policy-or-rule>` | Show one policy or one rule with its `RULE_ID` and removal command {{help-sbx sbx policy inspect}} | `--json` | both | [§3.3](#s-sbx-policy-init-allow-deny-and-check-network) |
| `policy log [SANDBOX]` | Show which hosts the proxy allowed or blocked, with rule, proxy type, and count {{help-sbx sbx policy log}} | `--json`, `--limit`, `-q`, `--type all\|network\|filesystem` (filesystem logs are not supported yet) | both | [§3.4](#s-sbx-policy-log-and-the-proxy) |
| `policy ls [SANDBOX]` | List policies, one overview row per policy, or the rules of one sandbox {{help-sbx sbx policy ls}} | `--wide`, `--json`, `--source local\|org\|kit`, `--decision allow\|deny`, `--type`, `--created-via default\|added\|provisioned\|approval`, `--profile`, `--protocol`, `--include-inactive` | both | [§3.3](#s-sbx-policy-init-allow-deny-and-check-network) and [§7.2](#s-org-policies-profiles-and-the-audit-log) |
| `policy profile ls` | List the profiles that remote governance policies provide {{help-sbx sbx policy profile ls}} | `--json`, `-q` | both | [§7.2](#s-org-policies-profiles-and-the-audit-log) |
| `policy reset` | Delete the local policy store and stop the daemon, or delete the cloud account policy {{help-sbx sbx policy reset}} | `-f` | both | [§3.3](#s-sbx-policy-init-allow-deny-and-check-network) |
| `policy rm network` | Remove a rule by `RULE_ID` or by resource {{help-sbx sbx policy rm network}} | `--id`, `--resource`, `--sandbox`, `-f` | both | [§3.3](#s-sbx-policy-init-allow-deny-and-check-network) |
| `reset` | Return sbx to a freshly installed state, including secrets and the sign-in {{help-sbx sbx reset}} | `-f`, `--preserve-secrets` | local only | [§2.4](#s-sandboxd-diagnose-and-reset) |
| `secret set [SERVICE]` | Store a service secret for one of 13 services, a dynamic source, or a registry credential {{help-sbx sbx secret set}} | `-t`, stdin, `--ref`, `--command`, `--refresh` (default `55m`), `--no-verify`, `--show-error`, `--oauth` (openai only locally), `--sandbox`, `-f`, `--registry`, `--username`, `--password-stdin`, `--registry-auth-endpoint`, `--all-sandboxes` | both | [§3.5](#s-sbx-secret-set-import-and-set-custom) |
| `secret import [SERVICE]` | Import secrets found in host environment variables, with a last four character preview {{help-sbx sbx secret import}} | `--all`, `--force`, `--dry-run` | both | [§3.5](#s-sbx-secret-set-import-and-set-custom) |
| `secret ls` | List stored secrets across global and sandbox scopes {{help-sbx sbx secret ls}} | `-g`, `--sandbox`, `--service`, `--json`, `-q` | both | [§3.5](#s-sbx-secret-set-import-and-set-custom) |
| `secret rm [SERVICE]` | Remove a secret, a registry credential, or every secret {{help-sbx sbx secret rm}} | `--sandbox`, `--all`, `--all-sandboxes`, `--registry`, `-f`. The examples also show `--placeholder`, which the flag list omits | both | [§3.5](#s-sbx-secret-set-import-and-set-custom) |
| `secret set-custom` | Store a secret for a service sbx does not know, behind a placeholder the proxy swaps {{help-sbx sbx secret set-custom}} | `--host` (repeatable), `--env`, `--value`, `-t`, `--command`, `--ref`, `--placeholder` (`{rand}` suffix), `--refresh`, `--sandbox`. Cloud only: `--header`, `--format`, `--name` | both, experimental | [§3.5](#s-sbx-secret-set-import-and-set-custom) |
| `settings get <key>` | Print one evaluated value {{help-sbx sbx settings get}} | `--json` | local only | [§2.5](#s-sbx-settings-list) |
| `settings list` | List every setting with value, type, source, restart flag, and description {{help-sbx sbx settings list}} | `--json`, `--no-trunc` | local only | [§2.5](#s-sbx-settings-list) and [R.3](#s-ref-settings-keys-environment-variables-and-paths) |
| `settings set <key> <value>`, `settings unset <key>` | Write or remove a user override {{help-sbx sbx settings set}} | none | local only | [§2.5](#s-sbx-settings-list) |
| `template save SANDBOX TAG` | Save a snapshot into the sandbox runtime image store {{help-sbx sbx template save}} | `-o, --output` (also export a tar), `--capture-mode disk\|all` (cloud), `-d, --description` (cloud) | both | [§2.3](#s-sbx-template-save-and-load) |
| `template load FILE [NAME]` | Load a tar into the image store, or upload it as a cloud template {{help-sbx sbx template load}} | `--cpus` and `--memory-mib` (required with `--cloud`, must name a billable shape), `--capture-mode`, `--description` | both | [§2.3](#s-sbx-template-save-and-load) |
| `template ls`, `template rm TAG\|ID\|NAME` | List or remove template images {{help-sbx sbx template ls}} | `--json`, `-q`, `-f` | both | [§2.3](#s-sbx-template-save-and-load) |
| `template inspect NAME\|ID` | Show the full metadata of one cloud template {{help-sbx sbx template inspect}} | `--json` | cloud only in v1 | [§2.3](#s-sbx-template-save-and-load) |
| `tui` | Open the interactive dashboard {{help-sbx sbx tui}} | none | both | [§1.1](#s-sbx-and-docker-agent) |
| `volume create\|inspect\|ls\|rm` | Manage persistent cloud volumes, saved as a snapshot when a sandbox exits {{help-sbx sbx volume}} | `--json`, `-q`, `-f` | cloud only | [§7.1](#s-sbx-cloud-run-move-and-ttl) |

`sbx` with no command opens interactive mode, and `sbx tui` opens the dashboard by name ([conflict C44](#s-ref-sources-and-the-conflicts-register)) {{help-sbx sbx}}.

## Experimental commands

Each of these prints the line `EXPERIMENTAL: this command may change or be removed in future releases.` at the top of its help {{help-sbx sbx kit}}.

| Command | Purpose | Flags that matter | Scope | Section |
|---|---|---|---|---|
| `env create [PATH...]` | Provision the secrets and bindings of an `sbxenv.yaml` and create the sandbox {{help-sbx sbx env create}} | `-y, --auto-approve`, `--clone`, `--env-arg`, `--env-args-file`, `--kit-arg`, `--kit-args-file`, `--name`, `--skip-host-commands` | both, experimental | [§4.4](#s-sbxenv-yaml-and-sbx-env-plan) |
| `env run [PATH...]` | Create when needed, then attach to the environment sandbox {{help-sbx sbx env run}} | the flags of `env create`, plus `-d, --detached` | both, experimental | [§4.4](#s-sbxenv-yaml-and-sbx-env-plan) |
| `env plan [PATH...]` | Print what applying the file would change, and change nothing {{help-sbx sbx env plan}} | `--clone`, `--env-arg`, `--kit-arg`, `--name`, `--skip-host-commands` | both, experimental | [§4.4](#s-sbxenv-yaml-and-sbx-env-plan) |
| `env exec [PATH...] -- COMMAND` | Run a command in the environment sandbox {{help-sbx sbx env exec}} | the flags of `exec`, plus `--env-arg`, `--env-args-file`, `--name` | both, experimental | [§4.4](#s-sbxenv-yaml-and-sbx-env-plan) |
| `env rm [PATH...]` | Remove the environment sandbox and the secrets it provisioned {{help-sbx sbx env rm}} | `-f`, `--prune-bindings`, `--env-arg`, `--name`, `--skip-host-commands` | both, experimental | [§4.4](#s-sbxenv-yaml-and-sbx-env-plan) |
| `kit add SANDBOX REFERENCE` | Recreate a sandbox with a mixin appended to its kit list {{help-sbx sbx kit add}} | `--kit-arg`, `--kit-args-file` | both, experimental | [§4.3](#s-sbx-kit-pack-push-sign-and-verify) |
| `kit builder status\|rm` | Show or remove the `sbx-kit-builder` sandbox and its build cache {{help-sbx sbx kit builder}} | `-f` (rm) | local, experimental | [§4.3](#s-sbx-kit-pack-push-sign-and-verify) |
| `kit builder history export\|inspect\|logs\|ls\|rm\|trace` | Run the matching `docker buildx history` command inside the builder sandbox {{help-sbx sbx kit builder history}} | pass-through | local, experimental | [§4.3](#s-sbx-kit-pack-push-sign-and-verify) |
| `kit inspect REFERENCE` | Load and display a kit from a directory, ZIP, OCI reference, or git repository {{help-sbx sbx kit inspect}} | `--json`, `--kit-arg`, `--kit-args-file` | both, experimental | [§4.2](#s-com-docker-sandbox-capabilities) |
| `kit pack DIRECTORY` | Validate a `spec.yaml` directory and package it as a ZIP {{help-sbx sbx kit pack}} | `-o, --output` (default `<name>.zip`) | both, experimental | [§4.3](#s-sbx-kit-pack-push-sign-and-verify) |
| `kit provenance REFERENCE` | Print the SLSA provenance attached to an OCI kit, `UNSIGNED` or `VERIFIED` {{help-sbx sbx kit provenance}} | `--key`, `--certificate-identity`, `--certificate-identity-regexp`, `--certificate-oidc-issuer`, `--certificate-oidc-issuer-regexp`, `--insecure-ignore-tlog`, `--json` | both, experimental | [§4.3](#s-sbx-kit-pack-push-sign-and-verify) |
| `kit pull REFERENCE` | Pull a v1 ZIP or v2 tar.gz kit artifact from an HTTPS registry {{help-sbx sbx kit pull}} | `-o, --output` | both, experimental | [§4.3](#s-sbx-kit-pack-push-sign-and-verify) |
| `kit push DIRECTORY REFERENCE` | Package and push a `spec.yaml` kit, and attach SLSA provenance as an OCI referrer {{help-sbx sbx kit push}} | `--sign`, `--key`, `--identity-token`, `--identity-token-file`, `--tlog-upload` (default `true`) | both, experimental | [§4.3](#s-sbx-kit-pack-push-sign-and-verify) |
| `kit sign REFERENCE` | Sign a kit with a cosign-compatible Sigstore signature, keyless by default {{help-sbx sbx kit sign}} | `--key`, `--identity-token`, `--identity-token-file`, `--tlog-upload` | both, experimental | [§4.3](#s-sbx-kit-pack-push-sign-and-verify) |
| `kit validate REFERENCE` | Check that a directory, ZIP, or git reference is a valid kit {{help-sbx sbx kit validate}} | `--json`, `--kit-arg`, `--kit-args-file` | both, experimental | [§4.3](#s-sbx-kit-pack-push-sign-and-verify) |
| `kit verify REFERENCE` | Verify a signature on a directory, a git reference, or an OCI kit {{help-sbx sbx kit verify}} | `--key`, the four `--certificate-*` flags, `--insecure-ignore-tlog`, `--json` | both, experimental | [§4.3](#s-sbx-kit-pack-push-sign-and-verify) |
| `setup` | Detect agent secrets in the host environment and import the accepted ones {{help-sbx sbx setup}} | none | local, experimental | [§3.5](#s-sbx-secret-set-import-and-set-custom) |
| `setup ssh`, `setup ssh remove` | Write or remove the SSH client config that makes `ssh <name>.sbx` work {{help-sbx sbx setup ssh}} | `--alias` (default `*.sbx`) | local, experimental | [§2.4](#s-sandboxd-diagnose-and-reset) |
| `skills add <repository>` | Install skills from a git repository or `owner/repo` shorthand into the shared store {{help-sbx sbx skills add}} | `-s, --skill`, `-f` | local, experimental | [§4.5](#s-sbx-skills-add-and-skills-true) |
| `skills import` | Import skills from six agent directories on the host {{help-sbx sbx skills import}} | `--dry-run`, `-f` | local, experimental | [§4.5](#s-sbx-skills-add-and-skills-true) |
| `skills ls`, `skills rm <skill>...`, `skills update [skill]...` | List, remove, or refresh installed skills {{help-sbx sbx skills ls}} | `--json`, `-q`, `-f` | local, experimental | [§4.5](#s-sbx-skills-add-and-skills-true) |

`sbx kit ls` is not a command, and the probe answered `unknown command` ([conflict C46](#s-ref-sources-and-the-conflicts-register)). The six `kit builder history` pages in the vendored tree hold an error instead of help text. The daemon could not bind its socket under the capture sandbox {{help-sbx sbx kit builder history ls}}.

## Other commands

| Command | Purpose | Flags that matter | Scope | Section |
|---|---|---|---|---|
| `completion` | Generate the autocompletion script for a shell {{help-sbx sbx}} | its help page is not in the vendored tree | both | none |
| `help` | Help about any command {{help-sbx sbx}} | its help page is not in the vendored tree | both | none |
| `login` | Sign in to Docker {{help-sbx sbx login}} | `--username`, `--password-stdin` | both | [§1.1](#s-sbx-and-docker-agent) |
| `logout` | Stop running local sandboxes and sign out {{help-sbx sbx logout}} | `-y, --yes` | local only | [§1.1](#s-sbx-and-docker-agent) |
| `version` | Print the CLI version, and with `--json` the server and runtime component versions {{help-sbx sbx version}} | `--json` | both | [§2.4](#s-sandboxd-diagnose-and-reset) |

## Names that appear in text but not in the tree

The help of `secret set` names `sbx mount`, and the docs name `sbx ssh proxy`, `sbx policy approval`, `--model`, `--provider`, and `--usb` ([conflict C16](#s-ref-sources-and-the-conflicts-register)). None of them has a page in the vendored tree. The manual documents only what `--help` prints, and [§2.4](#s-sandboxd-diagnose-and-reset) names the hidden commands once. Every `sbx ... --help` call also tried to open a TLS connection to `login.docker.com:443` during the capture. The capture sandbox refused the connection, and the printed text did not change (research/sources/help-sbx-cloud.md).

Sources: research/sources/help-sbx.md (every `sbx` help page, 115 pages, sbx v0.47.0 0411f50ee4700fe7bd37e6e7e3aced563e850ca9); research/sources/help-sbx-cloud.md (`sbx --cloud --help` and the network note); research/sources/probes/sbx-kit-ls.txt, sbx-version.txt; research/conflicts-register.md rows C9, C16, C44, C46, C47; manual.json (section files and ids)
