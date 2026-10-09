# Glossary and index of figures

> Each term below has one meaning across the manual and names the section that defines it, and the index lists every figure by the claim it makes.

Every term is defined once, in the section the last column names, with the sources that section cites. The meanings below come from the help text, the schema, the kit specification, and the docs named in the Sources line.

## Glossary

| Term | Meaning in this manual | Defined in |
|---|---|---|
| Agent | One entry under `agents`, with a model, an instruction, toolsets, and optional sub-agents | [5.2](#s-agents-models-and-providers) |
| Agent file | The YAML or HCL file `docker-agent run` loads, titled Docker Agent Configuration in the schema: `agents`, `models`, `providers`, `toolsets`, and the rules between them | [5.2](#s-agents-models-and-providers) |
| Alloy | A model reference of two models with a comma between them, `a,b`, that the runtime alternates between in one conversation | [5.2](#s-agents-models-and-providers) |
| Attestation | A signed statement attached to an artifact: SLSA provenance on a kit, or the DSSE publication statement on a shared agent | [4.3](#s-sbx-kit-pack-push-sign-and-verify) and [6.4](#s-share-push-and-share-pull) |
| Audit record | One JSONL line the daemon writes for each decision under the auditkit directory, rotated by time, count, and size | [7.2](#s-org-policies-profiles-and-the-audit-log) |
| Background agent | A sub-agent started by `run_background_agent` that runs while the parent continues | [sub_agents, transfer_task, and background_agents](#s-sub-agents-transfer-task-and-background-agents) |
| Binding | A record in `credentials.yaml` of the credential mechanism and the domains approved for one service | [3.5](#s-sbx-secret-set-import-and-set-custom) |
| Capability | A typed, versioned request a kit makes of the host, `com.docker.sandbox/<name>@N`, answered as granted, refused, or prompted | [4.2](#s-com-docker-sandbox-capabilities) |
| Cassette | The file `--record` writes with the model API interactions of a run, and `--fake` replays | [5.1](#s-docker-agent-run-new-and-doctor) |
| Clone mode | The `--clone` workspace mode: the host repository is mounted read-only at `/run/sandbox/source` and the agent works on a private clone, whose commits return through the `sandbox-<name>` remote | [3.2](#s-clone-and-run-sandbox-source) |
| Cloud sandbox | A sandbox run through `sbx --cloud` on Docker's compute, with no host workspace, a shape, and a TTL | [7.1](#s-sbx-cloud-run-move-and-ttl) |
| Delegation | The `transfer_task` tool: the parent sends a task to a sub-agent, which runs in a sub-session and returns a result | [sub_agents, transfer_task, and background_agents](#s-sub-agents-transfer-task-and-background-agents) |
| Environment file | `sbxenv.yaml`, which declares the agent, kits, workspace, secrets, ports, MCP servers, and host commands of one sandbox | [4.4](#s-sbxenv-yaml-and-sbx-env-plan) |
| Environment plan | The list of everything applying an environment file would set up, printed by `sbx env plan` and approved before `create` or `run` acts | [4.4](#s-sbxenv-yaml-and-sbx-env-plan) |
| Eval | A saved session that `docker-agent eval` replays in a container and scores | [5.6](#s-session-db-sessions-diff-and-eval) |
| Flavor | A named YAML patch under `flavors`, applied with `--flavor` before the file is parsed | [5.2](#s-agents-models-and-providers) |
| Forward proxy | The host proxy that HTTP and HTTPS requests from a sandbox pass through. It enforces policy and injects credentials | [3.4](#s-sbx-policy-log-and-the-proxy) |
| Gateway | The one MCP endpoint a sandbox sees, served on the host, through which every registered server is reached. The Toolkit gateway and the hosted gateway are separate things with the same name | [3.6](#s-sbx-mcp-add-load-and-static-mcp) |
| Governance profile | A named profile from remote governance policies, assigned to a sandbox with `--profile` | [7.2](#s-org-policies-profiles-and-the-audit-log) |
| `handoff` | The tool that `handoffs:` injects. It moves the whole conversation to another agent in the same session, and the previous agent leaves the loop | [sub_agents, transfer_task, and background_agents](#s-sub-agents-transfer-task-and-background-agents) |
| Harness | An external coding CLI, `claude-code`, `codex`, `pi`, or `opencode`, that runs an agent instead of a model provider | [5.1](#s-docker-agent-run-new-and-doctor) |
| Hook | A command, builtin, model, or evaluator that runs at one of the 33 lifecycle events of an agent | [5.5](#s-permissions-safety-and-hooks) |
| Kit | One OCI image whose manifest annotation `vnd.docker.sandbox.kit.descriptor` carries its declarations. For the `sbx kit` commands, a v1 or v2 artifact with a `spec.yaml` | [4.1](#s-syntax-docker-sandbox-kit-3-and-kit-yaml) |
| Kit argument | A value for an argument a kit declares, given as `--kit-arg name=value` | [4.1](#s-syntax-docker-sandbox-kit-3-and-kit-yaml) |
| Kit set | A `kind: set` descriptor that lists kits and is never published | [4.1](#s-syntax-docker-sandbox-kit-3-and-kit-yaml) |
| Mixin | A kit of `kind: mixin`: an overlay on the filesystem of a workload, zero or more per composition | [4.1](#s-syntax-docker-sandbox-kit-3-and-kit-yaml) |
| Model reference | `provider/model`, a name from `models`, `auto`, an alloy, or a `first_available` list | [5.2](#s-agents-models-and-providers) |
| Models gateway | An address set with `--models-gateway` that model traffic routes through, with a Docker token | [R.6](#s-ref-providers-and-models) |
| Permission rule | An `allow`, `ask`, or `deny` pattern on a tool name and its arguments, evaluated deny, then allow, then ask | [5.5](#s-permissions-safety-and-hooks) |
| Policy | A set of rules that controls what sandboxes can reach. Local rules apply to all sandboxes or to one | [3.3](#s-sbx-policy-init-allow-deny-and-check-network) |
| Policy scope | `global`, all sandboxes, or `local`, one sandbox named with `--sandbox` | [3.3](#s-sbx-policy-init-allow-deny-and-check-network) |
| Preset | `allow-all`, `balanced`, or `deny-all`, chosen once with `sbx policy init` | [3.3](#s-sbx-policy-init-allow-deny-and-check-network) |
| Provider | A model API docker-agent knows by id, such as `anthropic` or `dmr`, or an entry under `providers` with its own base URL | [5.2](#s-agents-models-and-providers) |
| Proxy type | The `PROXY` column of `sbx policy log`: `forward`, `forward-bypass`, `transparent`, `network`, or `browser-open` | [3.4](#s-sbx-policy-log-and-the-proxy) |
| Proxy-managed | A credential whose real value stays on the host while the proxy swaps its sentinel into outbound requests. Also the literal sentinel value `proxy-managed` | [3.5](#s-sbx-secret-set-import-and-set-custom) |
| Rule | One allow or deny entry of a policy, with a `RULE_ID`, a resource pattern, and a protocol | [3.3](#s-sbx-policy-init-allow-deny-and-check-network) |
| Safety mode | `strict`, `balanced`, `restricted`, or `autonomous`: what the runtime does with a tool call that no permission rule matched | [5.5](#s-permissions-safety-and-hooks) |
| Sandbox | A microVM with its own kernel and a private Docker Engine, in which the agent runs as a container. It has a name, a workspace, a template, and a lifecycle | [2.1](#s-sbx-run-create-stop-and-rm) |
| `sandboxd` | The host daemon that owns every local sandbox, reached over a Unix socket | [2.4](#s-sandboxd-diagnose-and-reset) |
| Secret | A value `sbx secret set` stores in the host keychain for one of 13 services, a custom host, or a registry. It never enters the sandbox | [3.5](#s-sbx-secret-set-import-and-set-custom) |
| Sentinel | The placeholder value the agent sees in place of a secret, such as `proxy-managed` | [3.5](#s-sbx-secret-set-import-and-set-custom) |
| Session | The record of one conversation in `session.db`: every message, tool call, sub-agent run, and cost | [5.6](#s-session-db-sessions-diff-and-eval) |
| Shape | A billable cloud size, `micro`, `small`, `medium`, `large`, or `xl`, from 1 vCPU and 2048 MiB to 16 vCPU and 32768 MiB | [7.1](#s-sbx-cloud-run-move-and-ttl) |
| Skills store | The shared directory of `SKILL.md` skills that sbx links into every sandbox, read-only by default | [4.5](#s-sbx-skills-add-and-skills-true) |
| Static set | The MCP servers fixed at creation with `--static-mcp`, as opposed to servers attached later with `sbx mcp load` | [3.6](#s-sbx-mcp-add-load-and-static-mcp) |
| Sub-agent | An agent listed in `sub_agents` that the parent delegates to with `transfer_task` | [sub_agents, transfer_task, and background_agents](#s-sub-agents-transfer-task-and-background-agents) |
| Template | A container image a sandbox starts from: the default `docker/sandbox-templates:<agent>` image, a saved snapshot, or a loaded tar | [2.3](#s-sbx-template-save-and-load) |
| Toolset | One entry under `toolsets` with a `type` from the 27 built-in types, which gives the agent a set of tools | [5.3](#s-toolsets-and-mcps) |
| Transparent proxy | The host proxy that intercepts TCP traffic other than HTTP and HTTPS. It enforces policy and injects nothing | [3.4](#s-sbx-policy-log-and-the-proxy) |
| TTL | The time-to-live of a cloud sandbox, 1 hour by default, under a 24 hour ceiling from creation | [7.1](#s-sbx-cloud-run-move-and-ttl) |
| Workload | A kit of `kind: workload`: the root filesystem with entrypoint, cmd, env, user, and workdir, exactly one per composition | [4.1](#s-syntax-docker-sandbox-kit-3-and-kit-yaml) |
| Workspace | The host directory a sandbox mounts at the same absolute path, read-write by default, with extra paths marked `:ro` | [2.1](#s-sbx-run-create-stop-and-rm) |

## Index of figures

Each number links to its figure, and the claim is the bold sentence that opens the caption.

```figure-index
```

Sources: the definition paragraphs of sections 2.1 to 7.2 as research/plan.md plans them; research/sources/help-sbx.md (`sbx create claude`, `sbx template`, `sbx kit`, `sbx policy`, `sbx policy init`, `sbx policy allow network`, `sbx policy log`, `sbx secret`, `sbx secret set-custom`, `sbx mcp ls`, `sbx run`, `sbx template load`, `sbx ttl`, `sbx policy profile`, `sbx daemon status`, `sbx skills`); research/sources/help-docker-agent.md (`run`, `eval`, `serve`); research/sources/agent-schema.json (`AgentConfig`, `HooksConfig`, `HarnessConfig`, `Toolset`); research/sources/SPEC-v3-at-v3.0.0-m.8.md §1, §3.4, §7; research/sources/docs-sandboxes.md (pages architecture, configuration/credentials, governance/audit); research/sources/docs-docker-agent.md (pages concepts/models, concepts/agents, configuration/flavors, configuration/permissions, features/sessions, features/cli); the figure blocks of front.md and every file under sections/
