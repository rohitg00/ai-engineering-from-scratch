# Evidence: cheatsheets/docker-sandboxes.md

Abbreviations: S = manuals/docker-sandboxes-101/sections, C = manuals/docker-sandboxes-101/capture, O = manuals/docker-sandboxes-101/capture/out.

## Front matter
- pin sbx 0.47.0, docker-agent 1.149.0: manual.json lines 9-15

## What runs where (architecture, 8 nodes, 7 edges)
- sbx CLI talks to sandboxd over a socket: S/1-1-sbx-and-docker-agent.md:13, O/02-daemon-status.txt:3
- sandboxd.sock, daemon.log: O/02-daemon-status.txt:3-4, S/2-4-sandboxd-diagnose-and-reset.md:21-22
- Secret store, macOS Keychain: S/1-1-sbx-and-docker-agent.md:15, S/3-5-sbx-secret-set-import-and-set-custom.md:13
- microVM with own kernel and private Docker Engine: S/1-1-sbx-and-docker-agent.md:11, S/r-8-glossary-and-index-of-figures.md:48 (concept only)
- agent user uid 1000: S/2-2-sbx-exec-cp-and-ports.md:11
- forward proxy gateway.docker.internal:3128 via HTTPS_PROXY: S/3-4-sbx-policy-log-and-the-proxy.md:19,33
- proxy swaps key after the request leaves the VM: S/1-1-sbx-and-docker-agent.md:15
- workspace virtiofs at same absolute path: S/2-1-sbx-run-create-stop-and-rm.md:11
- allowed hosts by policy rules: S/3-4-sbx-policy-log-and-the-proxy.md:33 (both paths enforce policies)

## One request leaves the sandbox (flow, 7)
- 1 sbx create pulls the template and boots the microVM: S/2-1-sbx-run-create-stop-and-rm.md:19-31
- 2 agent sends the request to the forward proxy: S/3-4-sbx-policy-log-and-the-proxy.md:19, S/3-4-sbx-policy-log-and-the-proxy.md:33
- 3 deny wins, no matching allow is an implicit deny: S/3-3-sbx-policy-init-allow-deny-and-check-network.md:84, S/3-3-sbx-policy-init-allow-deny-and-check-network.md:118
- 4 blocked gives 403 inside TLS with approval body: S/3-4-sbx-policy-log-and-the-proxy.md:47-64
- 5 allowed host tunnels as forward-bypass: S/3-4-sbx-policy-log-and-the-proxy.md:64-66
- 6 bound secret, proxy swaps the placeholder: S/3-5-sbx-secret-set-import-and-set-custom.md:74
- 7 policy log gives one row per host with proxy type and rule: S/3-4-sbx-policy-log-and-the-proxy.md:70, S/3-4-sbx-policy-log-and-the-proxy.md:104

## Sandbox lifecycle (task-table, 7)
- create shell <path> --name: O/04-create.txt:1
- run --name re-attach: O/04-create.txt:16, S/2-1-sbx-run-create-stop-and-rm.md:58
- exec -u root sh -c: O/07-template-save.txt:1
- cp host to SANDBOX:PATH: O/06-cp.txt:1
- ports --publish 18081:8080: O/05-ports.txt:1
- stop keeps state: O/04-stop.txt:1-2
- prune --force: O/04-prune.txt:5

## Secrets, MCP and health (task-table, 7)
- secret set-custom --host --env --value: O/10-set-custom.txt:1
- secret import --dry-run: O/10-import-dry-run.txt:1
- mcp add --url: O/11-mcp-add.txt:1
- mcp load --sandbox: O/11-load.txt:1
- diagnose (13 checks): O/02-diagnose.txt:1, S/3-1-sbx-diagnose-and-the-microvm-boundary.md:9 (13 checks, not in from; count also in O/02-diagnose.txt "13 passed")
- template save --output tar: O/07-template-save.txt:14
- docker-agent run --sandbox --exec: O/27-sandbox-run.txt:1

## Clone mode round trip (annotated-code, 6 lines)
- create --clone shell --name: O/08-clone-create.txt:1. source ro at /run/sandbox/source: O/08-clone-create.txt:17
- agent commits in clone: S/3-2-clone-and-run-sandbox-source.md:39, O/08-clone-commit.txt (via S/3-2)
- git -C remote -v shows sandbox-<name>: O/08-clone-host.txt:1
- git -C fetch sandbox-<name>: O/08-clone-host.txt:25, S/3-2-clone-and-run-sandbox-source.md:58-60
- rm --force removes VM, state, scoped secrets: O/08-clone-rm.txt:1, S/2-1-sbx-run-create-stop-and-rm.md:125

## Debug a blocked host (annotated-code, 9 lines)
- policy init balanced once: O/03-policy-init.txt:1
- create shell --name m101-policy, no mount: O/09-create.txt:1
- exec curl, Approval required: O/09-blocked-by-rule.txt:1 (command), Approval line in O/09-blocked.txt:12
- policy log: O/09-policy-log.txt:1,4 (forward, default deny)
- policy allow network --sandbox: O/09-allow.txt:1-2
- policy check network --sandbox --verbose --json: C/run.py:854

## What the agent sees inside (command-table, 7)
- HTTPS_PROXY: O/04-env.txt (proxy lines), S/3-4-sbx-policy-log-and-the-proxy.md:19
- ANTHROPIC_API_KEY=proxy-managed: O/10-env-sentinel.txt:2
- M101_RECV_KEY=sbx-cs-<rand>: O/10-env-sentinel.txt:4
- SSH_AUTH_SOCK=/run/ssh-agent.sock, on by default: O/04-env.txt, S/3-5-sbx-secret-set-import-and-set-custom.md:80
- forward-bypass, no inspection: S/3-4-sbx-policy-log-and-the-proxy.md:66,135
- transparent, no injection: S/3-4-sbx-policy-log-and-the-proxy.md:135
- deny_kind explicit vs implicit: S/3-3-sbx-policy-init-allow-deny-and-check-network.md:110,118

## Defaults (8)
- --name <agent>-<workdir>: S/r-1-sbx-commands.md:21
- -m, --memory 50% of host memory, 512 MiB to 32 GiB: S/r-1-sbx-commands.md:21
- --pull always: S/r-1-sbx-commands.md:21
- --skills readonly: S/r-1-sbx-commands.md:21
- secret set --refresh 55m: S/r-1-sbx-commands.md:63
- ssh.agentForwardingEnabled true: S/r-3-settings-keys-environment-variables-and-paths.md:35
- sandbox.disk.dockerVolume 10g: S/r-3-settings-keys-environment-variables-and-paths.md:33
- kit.allowedSources ["docker.io/"]: S/r-3-settings-keys-environment-variables-and-paths.md:17

## Key concepts (6)
- Sandbox, a microVM with its own kernel: S/r-8-glossary-and-index-of-figures.md:48
- Clone mode, --clone: S/r-8-glossary-and-index-of-figures.md:20
- Preset, allow-all, balanced or deny-all: S/r-8-glossary-and-index-of-figures.md:42
- Policy scope, global or one sandbox: S/r-8-glossary-and-index-of-figures.md:41
- Deny wins: S/3-3-sbx-policy-init-allow-deny-and-check-network.md:84
- Sentinel, placeholder in place of a secret: S/r-8-glossary-and-index-of-figures.md:51

## Troubleshooting (6)
- Approval required, no allow rule: O/09-blocked.txt:12, S/3-4-sbx-policy-log-and-the-proxy.md:106
- ::1 exit 7, tcp4 default, publish /tcp: O/05-ports-curl.txt:5-8, S/2-2-sbx-exec-cp-and-ports.md:72,115
- copying between sandboxes: O/06-cp.txt:16, S/2-2-sbx-exec-cp-and-ports.md:63
- deny conflicts with allow, rm first: O/09-deny-conflict.txt:2, S/3-3-sbx-policy-init-allow-deny-and-check-network.md:86, O/09-rm-allow.txt:1
- no key from ~/.zshrc, host env not read since v0.35.0: S/3-5-sbx-secret-set-import-and-set-custom.md:5,91
- ensure daemon error, daemon status, daemon.log: S/2-4-sandboxd-diagnose-and-reset.md:5,100

## Q&A (4)
- no Docker Desktop, sbx login, docker ps: S/1-1-sbx-and-docker-agent.md:11,13,126
- stop vs rm: S/2-1-sbx-run-create-stop-and-rm.md:110,125
- host allow passes any request, gist: S/3-4-sbx-policy-log-and-the-proxy.md:112
- agent sees proxy-managed, proxy adds key after VM: S/1-1-sbx-and-docker-agent.md:15

## Tips (5)
- set at creation, re-attach ignores: S/2-1-sbx-run-create-stop-and-rm.md:94,182
- prune --dry-run first: S/2-1-sbx-run-create-stop-and-rm.md:183
- narrow rules with --sandbox: S/3-3-sbx-policy-init-allow-deny-and-check-network.md:130
- secret set, never -e KEY: S/3-5-sbx-secret-set-import-and-set-custom.md:91
- bind custom secret to exact hosts: S/3-5-sbx-secret-set-import-and-set-custom.md:93
