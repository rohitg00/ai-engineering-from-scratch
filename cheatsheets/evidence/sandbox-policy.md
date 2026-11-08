# Evidence: cheatsheets/sandbox-policy.md

Abbreviations. L = phases/19-capstone-projects/26-sandbox-runner-denylist. SL = projects/sandbox-ladder. M = manuals/docker-sandboxes-101/sections. S31 = M/3-1-sbx-diagnose-and-the-microvm-boundary.md. S33 = M/3-3-sbx-policy-init-allow-deny-and-check-network.md. S34 = M/3-4-sbx-policy-log-and-the-proxy.md. S35 = M/3-5-sbx-secret-set-import-and-set-custom.md. S55 = M/5-5-permissions-safety-and-hooks.md. S72 = M/7-2-org-policies-profiles-and-the-audit-log.md.

## Front matter
- id, title, sources: cheatsheets/topics.yaml:1586-1592

## The profile ladder (comparison)
- Cost 1, 2, 3, 5: SL/solution/stage2.rs:9, 16, 23, 30
- Filesystem control no, yes, yes, yes: SL/solution/stage2.rs:6, 13, 20, 27
- Network denial no, no, yes, yes: SL/solution/stage2.rs:7, 14, 21, 28
- Separate kernel no, no, no, yes: SL/solution/stage2.rs:8, 15, 22, 29
- residual shared-host-kernel when no kernel, network-not-denied when no network: SL/solution/stage4.rs:10-15

## Run it (command-table)
- cli.py untrusted=true,secrets=true,network=true,host_kernel=false --budget 3: SL/README.md:30, reference path swap SL/README.md:33
- --docker-image preview: SL/README.md:37, SL/solution/cli.py:41,71-76
- --execute runs probes on a local image: SL/README.md:37, SL/solution/cli.py:77-94
- --stage 1 --path learning-artifacts/sandbox-ladder: SL/README.md:15
- --all --solution --strict: SL/README.md:40
- python3 code/main.py: L/docs/en.md:89
- python3 -m pytest code/tests/ -v: L/docs/en.md:90

## Planner steps (flow)
- key=boolean pairs, Conflict on repeat, Invalid on unknown key: SL/solution/stage1.rs:10-28
- untrusted or secrets need filesystem, network needs network denial: SL/solution/stage2.rs:34-36, SL/README.md:5
- host_kernel needs kernel: SL/solution/stage2.rs:37, SL/README.md:5
- cost at most budget, lowest cost, then name: SL/solution/stage3.rs:2-8
- plan prints profile and residuals: SL/solution/stage4.rs:6-17
- schema_version 1, runtime_verified False: SL/solution/cli.py:65-70

## Planner output for the sample (annotated-code)
- profile=... mode=policy-simulation os_isolation=false: SL/solution/stage4.rs:6-8
- residual=shared-host-kernel: SL/solution/stage4.rs:10-11. container-fixture has kernel false: SL/solution/stage2.rs:19-24
- verify=runtime-configuration-and-escape-tests: SL/solution/stage4.rs:16
- "mode": "policy_simulation", "runtime_verified": False: SL/solution/cli.py:68-69
- container-fixture chosen for the sample at budget 3: derived from SL/solution/stage2.rs:34-37 and stage3.rs:5-6 (not run, cli.py compiles into a temp folder)

## The Docker probe command (annotated-code)
- docker run --rm --pull=never --network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 32 --memory 64m --cpus 0.5 --user 65534:65534 image sh -c: SL/solution/cli.py:10-32
- local image only: SL/README.md:37
- root_write and default_route probes: SL/solution/cli.py:33, SL/README.md:37

## Lesson runner checks (architecture)
- Sandbox.run argv, shell=False: L/code/main.py:262-269
- _check_executable_denylist: L/code/main.py:156-164
- _check_argv_interpreter, -c, -e, --eval: L/code/main.py:75-82,167-180
- _check_shell_metachars: L/code/main.py:84,183-193
- _check_path_jail realpath under root: L/code/main.py:215-236
- subprocess.run, env allowlist, timeout: L/code/main.py:304-321
- SandboxResult fields: L/code/main.py:96-108
- order of checks: L/code/main.py:273-293

## Lesson defaults (defaults)
- max_output_bytes 64 * 1024, truncation marker: L/code/main.py:86,88,133
- timeout_seconds 30.0, demo 2.0: L/code/main.py:87,134,438
- DENIED_EXIT_CODE -100: L/code/main.py:24
- TIMED_OUT_EXIT_CODE -101: L/code/main.py:25
- env_allowlist: L/code/main.py:139,304-308
- shell False: L/code/main.py:266,183-185
- --budget 3: SL/solution/cli.py:40

## sbx network policy tasks (task-table)
- sbx policy init balanced: S33:11,129
- sbx policy ls --wide --json: S33:129
- sbx policy allow network --sandbox ... example.com: S34:64
- --deny-network on create or run: S33:82
- sbx policy check network --sandbox NAME host:port --json: S33:132
- sbx policy log, --json: S34:70
- sbx policy rm network --sandbox --id --force: S33:86
- sbx policy ls --source org: S72:45, S33:82

## How sbx decides (concepts)
- deny wins: S33:84
- deny_kind implicit and explicit: S33:118
- check network, port 443, not method or path, exit 1: S33:92
- forward-bypass, no inspection, no credential injection: S34:66,135
- proxy-managed, sbx-cs-<rand>: S35:48
- SSH agent forwarding default on: S35:80
- governance, only org allow grants, local deny applies: S72:15
- hypervisor is the boundary: S31:72

## Safety modes for unmatched calls (comparison)
- safe label, ask, allow, allow, allow: S55:63-66
- destructive label, ask, ask, deny, allow: S55:63-66
- unknown label, ask, ask, deny, allow: S55:63-66

## Refusals and fixes (troubleshooting)
- is on the denylist: L/code/main.py:162-163, DEFAULT_DENYLIST L/code/main.py:27
- use a script file instead of -c/-e: L/code/main.py:176-179
- set shell=True to opt in: L/code/main.py:189-192
- resolves outside project root: L/code/main.py:231-235, symlink L/code/main.py:220-224
- Limit error, kernel needs cost 5: SL/solution/stage3.rs:8, SL/solution/main.rs:13, SL/solution/stage2.rs:25-30
- Docker probe cannot establish independent guest kernel: SL/solution/cli.py:72-75
- conflicts with existing allow rule, rm first: S33:86
- 403 Forbidden, 90 bytes, approval, not a network fault: S34:47-48,64,106,136

## Q&A (qa)
- network=true means denial required: SL/README.md:5
- budget 4 with all needs gives Limit, microvm cost 5: SL/solution/main.rs:12-13, SL/solution/stage2.rs:25-30
- Docker probe tests root write and default route only: SL/README.md:37, SL/solution/cli.py:93
- lesson sandbox not an OS boundary: L/docs/en.md:30,81
- permissions client-side: S55:13,121

## Tips (tips)
- --safety restricted: S55:118
- destructive commands in deny: S55:119
- sbx secret set, never -e KEY: S35:91
- ssh.agentForwardingEnabled: S35:94
- host allow passes any body, kit HTTP rule: S34:138
- production layers: L/docs/en.md:83
