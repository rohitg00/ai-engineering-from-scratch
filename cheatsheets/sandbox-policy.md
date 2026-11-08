---
id: sandbox-policy
title: Sandbox Policy Ladder
code: SB
subtitle: Pick the least costly isolation profile, refuse bad calls in a runner, and set sbx network, secret and safety policy.
hue: 352
sources: phases/19-capstone-projects/26-sandbox-runner-denylist, projects/sandbox-ladder, manuals/docker-sandboxes-101
source_hash: b7be4aa7c12832ae
---

## The profile ladder
type: comparison
span: 2
from: projects/sandbox-ladder/solution/stage2.rs, projects/sandbox-ladder/solution/stage4.rs

| Factor | process-fixture | filesystem-fixture | container-fixture | microvm-fixture |
|---|---|---|---|---|
| Cost | 1 | 2 | 3 | 5 |
| Filesystem control | no | yes | yes | yes |
| Network denial | no | no | yes | yes |
| Separate kernel | no | no | no | yes |
| Residual | `shared-host-kernel`, `network-not-denied` | `shared-host-kernel`, `network-not-denied` | `shared-host-kernel` | none |

## Run it
type: command-table
span: 2
from: projects/sandbox-ladder/README.md, projects/sandbox-ladder/solution/cli.py, phases/19-capstone-projects/26-sandbox-runner-denylist/docs/en.md

| Command | What it does |
|---|---|
| `python3 projects/sandbox-ladder/solution/cli.py untrusted=true,secrets=true,network=true,host_kernel=false --budget 3` | Policy simulation, JSON out |
| `... --docker-image <image>` | Adds a `docker run` preview |
| `... --docker-image <image> --execute` | Runs two probes on a local image |
| `python3 scripts/project_test.py sandbox-ladder --stage 1 --path learning-artifacts/sandbox-ladder` | Grades stage 1 of your version |
| `python3 scripts/project_test.py sandbox-ladder --all --solution --strict` | Grades the reference |
| `python3 code/main.py` | Lesson demo, allow and deny battery |
| `python3 -m pytest code/tests/ -v` | Lesson tests |

## Planner steps
type: flow
from: projects/sandbox-ladder/solution/stage1.rs, projects/sandbox-ladder/solution/stage2.rs, projects/sandbox-ladder/solution/stage3.rs, projects/sandbox-ladder/solution/stage4.rs, projects/sandbox-ladder/solution/cli.py, projects/sandbox-ladder/README.md

1. **needs**: parses `key=true` and `key=false` pairs. A repeated or unknown key fails.
2. **satisfies**: untrusted or secrets need filesystem. `network=true` needs network denial.
3. **satisfies**: `host_kernel=true` needs a separate kernel.
4. **select**: keeps profiles with cost at most the budget, then takes the lowest cost.
5. **plan**: prints the profile and each residual risk it leaves.
6. **cli.py**: wraps it as `schema_version: 1` JSON with `runtime_verified` false.

## Planner output for the sample
type: annotated-code
lang: text
from: projects/sandbox-ladder/solution/stage4.rs, projects/sandbox-ladder/solution/cli.py

```text
profile=container-fixture mode=policy-simulation os_isolation=false
residual=shared-host-kernel  # no separate kernel
verify=runtime-configuration-and-escape-tests  # always printed
# JSON wrapper keys from cli.py
"mode": "policy_simulation", "runtime_verified": false
```

## The Docker probe command
type: annotated-code
lang: bash
from: projects/sandbox-ladder/solution/cli.py, projects/sandbox-ladder/README.md

```bash
docker run --rm --pull=never \  # local image only
  --network none --read-only \  # no route, read-only root
  --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 32 --memory 64m --cpus 0.5 \
  --user 65534:65534 <image> sh -c '<probes>'  # root_write, default_route
```

## Lesson runner checks
type: architecture
from: phases/19-capstone-projects/26-sandbox-runner-denylist/code/main.py, phases/19-capstone-projects/26-sandbox-runner-denylist/docs/en.md

```arch
node | call | 1,1 | Sandbox.run() | argv, shell=False | client
node | deny | 2,1 | _check_executable_denylist | basename on denylist | process
node | interp | 3,1 | _check_argv_interpreter | -c, -e, --eval | process
node | meta | 4,1 | _check_shell_metachars | shell metachars, shell off | process
node | jail | 4,2 | _check_path_jail | realpath under root | process
node | proc | 3,2 | subprocess.run | env allowlist, timeout | process
node | res | 2,2 | SandboxResult | denied, timed_out, truncated | store
edge | call | deny |
edge | deny | interp |
edge | interp | meta |
edge | meta | jail |
edge | jail | proc | all pass
edge | proc | res | capture
```

## Lesson defaults
type: defaults
from: phases/19-capstone-projects/26-sandbox-runner-denylist/code/main.py, projects/sandbox-ladder/solution/cli.py

| Setting | Default | Note |
|---|---|---|
| `max_output_bytes` | `64 * 1024` | Then the truncation marker |
| `timeout_seconds` | 30.0 | Demo uses 2.0 |
| `DENIED_EXIT_CODE` | -100 | Any refusal |
| `TIMED_OUT_EXIT_CODE` | -101 | Wall-clock timeout |
| `env_allowlist` | `("PATH", "HOME", "LANG", "LC_ALL", "TERM")` | All other variables are dropped |
| `shell` | `False` | Metachars refused while off |
| `--budget` | 3 | Planner cost ceiling |

## sbx network policy tasks
type: task-table
span: 2
from: manuals/docker-sandboxes-101/sections/3-3-sbx-policy-init-allow-deny-and-check-network.md, manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md, manuals/docker-sandboxes-101/sections/7-2-org-policies-profiles-and-the-audit-log.md

| Task | Code |
|---|---|
| Set the global preset once | `sbx policy init balanced` |
| List rules with their ids | `sbx policy ls --wide --json` |
| Allow one host for one sandbox | `sbx policy allow network --sandbox <name> example.com` |
| Deny a host at creation | `--deny-network <host>` on `create` or `run` |
| Predict one decision | `sbx policy check network --sandbox <name> <host:port> --json` |
| Read what the proxy decided | `sbx policy log` with `--json` |
| Remove an allow rule | `sbx policy rm network --sandbox <name> --id <uuid> --force` |
| Look for organization rules | `sbx policy ls --source org` |

## How sbx decides
type: concepts
from: manuals/docker-sandboxes-101/sections/3-3-sbx-policy-init-allow-deny-and-check-network.md, manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md, manuals/docker-sandboxes-101/sections/3-5-sbx-secret-set-import-and-set-custom.md, manuals/docker-sandboxes-101/sections/7-2-org-policies-profiles-and-the-audit-log.md, manuals/docker-sandboxes-101/sections/3-1-sbx-diagnose-and-the-microvm-boundary.md

- **Deny wins**: a deny beats an allow for the same hostname or CIDR.
- **deny_kind**: `implicit` means no rule matched. `explicit` names the rule.
- **check network**: host and port only, port 443 by default. It exits 1 on a denial.
- **forward-bypass**: a tunnel with no inspection and no credential injection.
- **Secrets**: the agent sees `proxy-managed` or `sbx-cs-<rand>`, never the value.
- **SSH agent**: forwarding is on by default. Keys stay on the host.
- **Governance**: only organization allow rules grant. Local deny rules still apply.
- **Boundary**: the hypervisor, not in-VM privilege separation.

## Safety modes for unmatched calls
type: comparison
from: manuals/docker-sandboxes-101/sections/5-5-permissions-safety-and-hooks.md

| Factor | `strict` | `balanced` | `restricted` | `autonomous` |
|---|---|---|---|---|
| `safe` label | ask | allow | allow | allow |
| `destructive` label | ask | ask | deny | allow |
| `unknown` label | ask | ask | deny | allow |

## Refusals and fixes
type: troubleshooting
from: phases/19-capstone-projects/26-sandbox-runner-denylist/code/main.py, projects/sandbox-ladder/solution/cli.py, projects/sandbox-ladder/solution/stage3.rs, projects/sandbox-ladder/solution/main.rs, manuals/docker-sandboxes-101/sections/3-3-sbx-policy-init-allow-deny-and-check-network.md, manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md

| Symptom | Cause | Fix |
|---|---|---|
| `is on the denylist` | Basename of argv[0] is in `DEFAULT_DENYLIST` | Use another tool or change `denylist` |
| `use a script file instead of -c/-e` | Interpreter with an inline code flag | Write the code to a script file |
| `set shell=True to opt in` | Metachar in argv with shell off | Split the command into argv |
| `resolves outside project root` | `../`, an absolute path or a symlink out | Keep paths under `project_root` |
| `Limit` error from the planner | No sufficient profile within the budget | Raise `--budget`. A kernel needs 5 |
| `Docker probe cannot establish independent guest kernel` | `--docker-image` with `host_kernel=true` | Use the policy simulation only |
| `conflicts with existing allow rule` | Deny over an allow in one scope | `sbx policy rm network` first |
| `403 Forbidden`, 90-byte body | No rule matched, approval required | Add an allow rule. It is not a network fault |

## Q&A
type: qa
from: projects/sandbox-ladder/solution/main.rs, projects/sandbox-ladder/solution/stage2.rs, projects/sandbox-ladder/README.md, projects/sandbox-ladder/solution/cli.py, phases/19-capstone-projects/26-sandbox-runner-denylist/docs/en.md, manuals/docker-sandboxes-101/sections/5-5-permissions-safety-and-hooks.md

- **Does `network=true` grant network?** No. It means network denial is required.
- **All four needs at budget 4?** `Limit`. Only `microvm-fixture` has a kernel, at cost 5.
- **Does the Docker probe prove a microVM?** No. It tests root write and the default route only.
- **Is the lesson sandbox an OS boundary?** No. It uses no namespaces, cgroups or seccomp.
- **Are agent permissions a boundary?** No. They run client-side. Use a sandbox for isolation.

## Tips
type: tips
from: phases/19-capstone-projects/26-sandbox-runner-denylist/docs/en.md, manuals/docker-sandboxes-101/sections/5-5-permissions-safety-and-hooks.md, manuals/docker-sandboxes-101/sections/3-5-sbx-secret-set-import-and-set-custom.md, manuals/docker-sandboxes-101/sections/3-4-sbx-policy-log-and-the-proxy.md

- Run unattended agents with `--safety restricted`.
- Put destructive commands in `deny`. No mode or hook allow overrides it.
- Store keys with `sbx secret set`, never with `-e KEY`.
- Turn off `ssh.agentForwardingEnabled` for an agent you would not let sign.
- A host allow passes any body. Narrow an API with a kit HTTP rule.
- In production, add a container or microVM, drop capabilities, mount the root read-only.
