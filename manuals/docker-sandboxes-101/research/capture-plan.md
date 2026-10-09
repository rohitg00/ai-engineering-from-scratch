# Capture plan: Docker Sandboxes and Docker Agent 101

Written 2026-10-08. Every listing in `06-toc-proposal.md` names a file this plan produces. Capture ids are `K00` to `K35`. Conflict rows are `C<n>` from `05-conflicts-register.md`. Source ids follow the same scheme as the register.

## 1. What this kit is and where it departs from the standard

The manuals standard says a capture kit "runs offline, needs no network and no keys". This subject cannot be captured that way: `sbx` starts real microVMs from images on Docker Hub and refuses to run without a Docker sign-in (C15), and Docker Model Runner needs Docker Desktop. The kit therefore has three tiers, and `manual.json` and the front matter say so.

| Tier | Needs | Determinism | `--check` behaviour |
|---|---|---|---|
| A, offline | docker-agent v1.149.0, Node, Python 3, openssl, ssh-keygen; no daemon, no network, no keys | byte-identical: cassette replay with `--fake`, local kit tooling, YAML files, help trees | compares byte for byte |
| B, networked and local | sbx v0.47.0 signed in, the sandboxd daemon, Docker Desktop 4.94.0 with DMR, a local registry, image pulls from Docker Hub and dhi.io | stable after masking ids, timestamps, durations, host paths, ports, digests | compares after masks |
| C, approval | money (Cloud Sandboxes), a GitHub token, a change to `~/.ssh/config`, a self-signed registry certificate in the system trust, an optional paid model key | run once, committed | checks presence and shape only |

`manual.json` will carry `"capture": {"run": ["python3", "capture/run.py"], "check": ["python3", "capture/run.py", "--check"]}`. `run.py --tier a` runs Tier A only; `--tier ab` adds Tier B; `--tier abc` adds Tier C after it prints the cost and asks once; `--only K09` runs one capture; `--check` reruns Tier A and Tier B into a temporary directory and compares.

## 2. Host prerequisites, in the order they must be true

| # | Prerequisite | State on 2026-10-08 | Needs approval |
|---|---|---|---|
| 1 | macOS on Apple silicon, Hypervisor.framework available | yes: `kern.hv_support is 1` (probe:sbx-diagnose) | no |
| 2 | sbx v0.47.0 from the Homebrew cask, `sbx login` done, daemon healthy, 13 of 13 diagnose checks pass | yes (probe:sbx-diagnose, probe:sbx-daemon-status) | no |
| 3 | The global network policy is not yet initialized | yes: `sbx policy ls` says "global network policy has not been initialized" (probe:sbx-policy-ls). K03 initializes it with `balanced`. The kit never runs `sbx reset` or `sbx policy reset`. | no |
| 4 | docker-agent v1.149.0 from Homebrew | yes (probe:docker-agent-version) | no |
| 5 | Docker Desktop 4.94.0 with Docker Model Runner enabled and host TCP on 12434 | no: the daemon was not running and the plugins are stale (`model` v1.1.5, `mcp` v0.40.1, `agent` v1.32.4) (03:S50, probe:docker-agent-doctor) | yes: update Desktop, then Settings > AI > Enable Docker Model Runner and host TCP, or `docker desktop enable model-runner --tcp 12434` (03:S13) |
| 6 | One local model pulled: `docker model pull ai/qwen3` (the docs' default and the `auto` pick; size unverified, several GB). Fallback for text-only runs: `ai/smollm2` (03:S43) | no | yes: disk and download |
| 7 | Node.js 20 or later and Python 3 for the receiver, the echo MCP server, and `run.py` | assumed present | no |
| 8 | git, and `gh` signed in (for K10b only) | assumed | K10b yes |
| 9 | A local registry: `docker run -d --name aiefs-registry -p 5000:5000 registry:2`; for `sbx kit pull` and possibly `share push` an HTTPS variant with a self-signed certificate (C13, `sbx kit pull` help: "The registry must support HTTPS") | no | TLS trust change yes |
| 10 | `kit-tck` from the docker/sandbox-kit-spec releases (01:F90) | no | download yes |
| 11 | About 20 GiB free: templates (`docker/sandbox-templates:shell`, `:docker-agent`, `docker/docker-agent-sbx-templates:latest`), `docker/docker-agent:1.149.0`, `docker/mcp-gateway`, `mcp/duckduckgo`, one model | 51.73 GiB free (probe:sbx-diagnose) | no |
| 12 | Cloud Sandboxes pay-as-you-go on a Personal or Pro account, sbx 0.45.1+ (C36, C103) | unknown | yes: money (K33) |

Nothing here needs `sudo`. The kit writes only under `capture/`, `capture/work/`, and the product's own state directories.

## 3. Directory layout

```text
manuals/docker-sandboxes-101/capture/
  README.md                 what the kit does, tiers, masks, how it differs from the docs
  run.py                    the driver: steps K00..K35, --tier, --only, --check
  masks.py                  the mask table (section 4)
  receiver.mjs              HTTP receiver on 127.0.0.1:18080 that logs method, path, headers to a file
  mcp-echo.mjs              a stdio MCP server with one tool, echo, written against the JSON-RPC lines only
  agents/
    pirate.yaml             one agent, dmr/ai/qwen3, temperature 0, no tools
    files.yaml              one agent with filesystem and git toolsets, readonly
    team.yaml               root with sub_agents [writer], handoffs [reviewer], background_agents
    guarded.yaml            permissions deny shell:cmd=rm*, one command hook, safety restricted
    flavors.yaml            pirate plus a cheap flavor that swaps the model
    a2a.yaml                the agent served by K26
  cassettes/                recorded by --record in K17, K18, K19, K22; committed; replayed by --fake
  evals/
    greet.json              one eval with assertions
  hooks/
    log-hook.sh             writes its stdin JSON to out/19-hook-stdin.json and prints an allow decision
  kits/
    hello-mixin/spec.yaml   schemaVersion "2", kind mixin, installs jq, allows example.com, one file
    hello-mixin/files/workspace/HELLO.md
    hello-kit/kit.yaml      # syntax=docker/sandbox-kit:3, kind workload on docker/sandbox-templates:shell
  env/
    sbxenv.yaml             agent shell, kits [./kits/hello-mixin], lifecycle.initialize, args, one snapshot secret
  compose/
    compose.yaml            agent service, mcp-gateway service, models: llm
    Dockerfile              the agent service image: docker/docker-agent:1.149.0 plus curl
  keys/
    README.md               how run.py generates them; private keys are gitignored
    ed25519.pub, p256.pub   committed public keys
  work/                     scratch workspaces the sandboxes mount; recreated each run
  out/                      every capture file, named NN-name.ext
```

## 4. Determinism and masks

Tier A is deterministic by construction: `--fake cassettes/<name>.json` replays recorded model responses, `temperature: 0` in every agent file, and the kit tooling is pure.

Tier B outputs are masked before comparison. The mask table in `masks.py`:

| Pattern | Replacement | Where it appears |
|---|---|---|
| UUIDs | `<uuid>` | policy rule ids, session ids, `SANDBOX_ID`, audit file names |
| `sbx_[A-Za-z0-9]+`, `tmpl_[A-Za-z0-9]+` | `<sbx-id>`, `<tmpl-id>` | cloud ids |
| ISO 8601 and RFC 3339 timestamps, Unix epochs over 1.6e9 | `<ts>` | logs, JSON |
| durations such as `1.23s`, `45ms`, `1h0m0s` left as defaults | `<dur>` except literal flag defaults | timing lines |
| `/Users/<name>` | `/Users/me` | every path |
| ephemeral host ports 49152 to 65535 | `<port>` | `sbx ports` |
| `sha256:[0-9a-f]{64}` | `sha256:<digest>` | manifests, plans |
| last-4 previews in `secret import` | `****` | K10 |
| the kit hash in `sandbox-kits/<hash>` | `<kit-hash>` | K30 |
| PIDs and `runs/<pid>.json` | `<pid>` | K22 |
| the Docker username in `sbx mcp ls` GATEWAY column | `<user>` | K11 |

The masked files are compared line by line. A changed line fails `--check` and prints the diff. Tier C files are compared on their first line and their JSON keys only.

## 5. Order of runs

1. K00, K01: no side effects.
2. K02: settings and diagnose; `sbx setup ssh` writes a managed block into `~/.ssh/config` (approval; `sbx setup ssh remove` undoes it).
3. K03: `sbx policy init balanced`. One-time. Every later sandbox inherits it.
4. K04, K05, K06, K07: the `demo` shell sandbox and its template.
5. K08: the clone sandbox.
6. K09: policy deny and log, on `demo`.
7. K10: secrets, with the receiver; K10b needs the GitHub token (approval).
8. K11: MCP registration and loading.
9. K12: v2 kit tooling (Tier A) and a run with `--kit`.
10. K28: Docker Model Runner. Must precede every docker-agent run.
11. K16 to K21: docker-agent CLI, agent files, multi-agent, permissions, sessions, eval. Cassettes recorded here.
12. K22 to K27: the five servers and `share`.
13. K13: v3 kit build with buildx, local registry, `kit-tck` (needs Desktop and the registry).
14. K14, K15: `sbxenv.yaml` and skills.
15. K29: Compose and the Toolkit gateway.
16. K30, K31: the two joined paths.
17. K32, K34, K35: audit, migration, timing.
18. K33: cloud (approval, last, then `sbx --cloud rm`).
19. Cleanup: `sbx rm` every `aiefs-*` sandbox, `sbx secret rm` every capture secret, `sbx mcp rm echo fetch`, `sbx skills rm`, `sbx policy rm network --resource example.com` and the other added rules, `docker rm -f aiefs-registry`. Never `sbx reset`, never `sbx policy reset`, never `sbx secret rm --all`.

All sandboxes the kit creates are named `aiefs-<purpose>` so cleanup can list them with `sbx ls --json`.

## 6. The captures

Each entry: id, tier, cost and keys, the exact commands, what is recorded, the sections that use it, and the open questions it settles. `$W` is `capture/work`, `$O` is `capture/out`. Commands inside a sandbox run through `sbx exec`. Flag spellings come from the v0.47.0 and v1.149.0 help trees.

### K00 Versions and host

- Tier A and B. No cost.
- Commands:
  - `sbx version --json`
  - `docker-agent version`
  - `docker agent version` (the plugin)
  - `docker version --format json`
  - `docker model version`, `docker mcp version`, `docker compose version`
  - `sw_vers`, `sysctl kern.hv_support`, `uname -m`
- Records: `$O/00-versions.txt`, `$O/00-sbx-version.json`.
- Sections: front matter (the pin), 1.1, R.7.
- Settles: C4 (runtime component names if the backend reports them), C81, C86.

### K01 Help trees

- Tier A. No cost. Reuses `cli/walk_help.py` so the trees match the research capture.
- Commands:
  - `python3 cli/walk_help.py sbx` and `python3 cli/walk_help.py sbx --cloud`
  - `python3 cli/walk_help.py docker-agent`
  - `python3 cli/walk_help.py docker agent` (the plugin after the Desktop update)
  - `docker-agent getting-started --help`
  - `docker sandbox --help` (expect an error on Desktop 4.94.0)
  - `docker model --help`, `docker mcp --help`, `docker mcp gateway run --help`
- Records: `$O/01-help-sbx.txt`, `01-help-sbx-cloud.txt`, `01-help-docker-agent.txt`, `01-help-docker-agent-plugin.txt`, `01-help-getting-started.txt`, `01-help-docker-sandbox.txt`, `01-help-docker-model.txt`, `01-help-docker-mcp.txt`, `01-help-gateway-run.txt`.
- Sections: 1.1, R.1, R.2, 7.3.
- Settles: C75, C89 (the `--verify-signatures` default line), C107.
- Note: the sbx help walk makes outbound TLS attempts to login.docker.com (cli:sbx-cloud note). Record whether the help text differs online and offline by running the walk twice, once with network and once under a denied network, and diff.

### K02 Daemon, diagnose, settings, hidden commands, SSH setup

- Tier B. `sbx setup ssh` changes `~/.ssh/config`: approval.
- Commands:
  - `sbx daemon status --json`
  - `sbx diagnose --output json`
  - `sbx settings list --json`
  - `sbx settings list --no-trunc`
  - `sbx settings get --json platform.allowExperimentalFeatures`
  - `sbx settings get feature.model` and `sbx settings get diagnostics.autoUploadErrorCooldownInDays` (expect an error or a value)
  - `sbx mount --help`, `sbx ssh --help`, `sbx ssh proxy --help`, `sbx policy approval --help`, `sbx run --model x shell --help`, `sbx create --usb --help` (record each exit code and first line)
  - `sbx setup ssh` then `sed -n '/sbx/,/^$/p' ~/.ssh/config` and `ls ~/.ssh/sbx_known_hosts`
  - `sbx tui` is interactive; record only `sbx --help`'s statement that no command opens interactive mode, and grep the state directory for `gordon` (C33)
- Records: `$O/02-daemon-status.json`, `02-diagnose.json`, `02-settings.json`, `02-settings-no-trunc.txt`, `02-settings-experimental.json`, `02-settings-feature-keys.txt`, `02-hidden-commands.txt`, `02-setup-ssh.txt`, `02-ssh-config-block.txt`, `02-gordon-grep.txt`.
- Sections: 2.4, 2.5, R.3, 7.4.
- Settles: C16, C18, C19, C20, C33, C42.

### K03 Policy init and the balanced list

- Tier B. One-time.
- Commands:
  - `sbx policy init balanced`
  - `sbx policy ls`
  - `sbx policy ls --wide --json`
  - `sbx policy ls --wide --source local --decision allow`
  - `sbx policy check network api.anthropic.com --verbose --json`
  - `sbx policy check network example.com --verbose --json`
  - `sbx policy check network --protocol udp 8.8.8.8:53 --json`
- Records: `$O/03-policy-init.txt`, `03-policy-ls.txt`, `03-policy-balanced.json`, `03-policy-check-anthropic.json`, `03-policy-check-example.json`, `03-policy-check-udp.json`.
- Sections: 3.3, 3.4, 7.2.
- Settles: C23.

### K04 The lifecycle on a shell sandbox and the guest

- Tier B. Pulls `docker/sandbox-templates:shell` (network).
- Commands:
  - `mkdir -p $W/demo && printf 'hello\n' > $W/demo/README.md`
  - `sbx create shell $W/demo --name aiefs-demo`
  - `sbx ls` and `sbx ls --json`
  - `sbx exec aiefs-demo env` (record `SANDBOX_NAME`, `SANDBOX_ID`, every `*proxy*` and `*PROXY*`, every `*CA*` variable)
  - `sbx exec -u root aiefs-demo sh -c 'uname -a; cat /etc/os-release; id; getconf PAGESIZE; cat /etc/hosts; mount | grep -E "virtiofs|/run/sandbox|/Users"; ls /run/sandbox 2>/dev/null; docker info --format "{{.ServerVersion}} {{.Driver}} {{.OperatingSystem}}"; docker ps; containerd --version 2>/dev/null; cat /proc/1/cgroup | head -3'`
  - `sbx exec aiefs-demo sh -c 'ls -la $PWD; cat README.md'` (the workspace at the same path)
  - `sbx create shell $W/demo --name aiefs-demo-2` (two sandboxes on one directory, S27) then `sbx ls --json`
  - `sbx run shell $W/demo --name aiefs-rm-demo --rm -- -c 'echo from-rm-demo'` then `sbx ls --json` (confirms `--rm`; the `-- -c` form is unverified, record the error if the shell agent ignores it)
  - `sbx stop aiefs-demo-2` then `sbx ls --json`
  - `sbx prune --dry-run --json` then `sbx prune --force`
  - `sbx rm --force aiefs-demo-2` if prune left it
- Records: `$O/04-create.txt`, `04-ls.txt`, `04-ls.json`, `04-env.txt`, `04-guest.txt`, `04-workspace.txt`, `04-second-sandbox.json`, `04-rm-demo.txt`, `04-stop.json`, `04-prune-dry-run.json`, `04-prune.txt`.
- Sections: 1.1, 2.1, 2.2, 3.1, 3.4.
- Settles: C4 (kernel string), C5, C26, S13, S27.

### K05 Ports

- Tier B.
- Commands:
  - `sbx exec aiefs-demo sh -c 'nohup python3 -c "import http.server as h,socketserver as s;s.TCPServer((\"\",8080),h.SimpleHTTPRequestHandler).serve_forever()" >/tmp/srv.log 2>&1 &'`
  - `sbx ports aiefs-demo --publish 18081:8080`
  - `sbx ports aiefs-demo --json`
  - `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18081/README.md`
  - `curl -sS -o /dev/null -w '%{http_code}\n' 'http://[::1]:18081/README.md'` (expect a refusal under the tcp4 default, C39)
  - `sbx ports aiefs-demo --publish 18082:8080/tcp` then the IPv6 curl again
  - `sbx ports aiefs-demo --unpublish 18081:8080` and `--unpublish 18082:8080/tcp`
- Records: `$O/05-ports.json`, `05-ports-curl.txt`, `05-ports-v6.txt`.
- Sections: 2.2.
- Open: whether the shell template has python3 (legacy template did, 01:F76); fallback `busybox httpd -p 8080` or `node -e`.

### K06 cp

- Tier B.
- Commands:
  - `printf 'in\n' > $W/in.txt && sbx cp $W/in.txt aiefs-demo:/tmp/in.txt`
  - `sbx exec aiefs-demo sh -c 'cat /tmp/in.txt; printf out > /tmp/out.txt'`
  - `sbx cp aiefs-demo:/tmp/out.txt $W/out.txt && cat $W/out.txt`
  - `sbx cp aiefs-demo:/tmp/out.txt aiefs-demo-2:/tmp/x` (expect the "not supported" error)
- Records: `$O/06-cp.txt`.
- Sections: 2.2.

### K07 Templates

- Tier B.
- Commands:
  - `sbx exec -u root aiefs-demo sh -c 'touch /opt/marker-from-demo'`
  - `sbx template save aiefs-demo aiefs-demo-tpl:v1 --output $O/07-demo-tpl.tar` (the tar is not committed; its size and `tar tf | head` are)
  - `sbx template ls --json`
  - `sbx run --pull never -t aiefs-demo-tpl:v1 shell $W/demo --name aiefs-from-tpl -- -c 'ls -l /opt/marker-from-demo'`
  - `sbx template rm aiefs-demo-tpl:v1 --force`
- Records: `$O/07-template-save.txt`, `07-template-ls.json`, `07-template-tar-head.txt`, `07-template-run.txt`, `07-template-rm.txt`.
- Sections: 2.3.

### K08 --clone

- Tier B.
- Commands:
  - `git init -q $W/repo && git -C $W/repo -c user.name=aiefs -c user.email=aiefs@example.test commit -q --allow-empty -m "base"`
  - `sbx create --clone shell $W/repo --name aiefs-clone`
  - `sbx exec aiefs-clone sh -c 'cd $PWD; pwd; git remote -v; git log --oneline -1; ls /run/sandbox/source; git -C /run/sandbox/source log --oneline -1; touch /run/sandbox/source/x 2>&1 | head -1'`
  - `sbx exec aiefs-clone sh -c 'cd $PWD; printf hi > from-sandbox.txt; git add from-sandbox.txt; git -c user.name=agent -c user.email=agent@example.test commit -q -m "from sandbox"; git log --oneline -2; git push 2>&1 | tail -3'` (whether a push is needed or the remote serves the clone directly is unknown)
  - host: `git -C $W/repo remote -v`, `git -C $W/repo ls-remote sandbox-aiefs-clone`, `git -C $W/repo fetch sandbox-aiefs-clone 2>&1`, `git -C $W/repo for-each-ref refs/sandboxes/`, `git -C $W/repo log --oneline --all -3`
  - `sbx rm --force aiefs-clone` then `git -C $W/repo remote -v` (does `rm` remove the remote)
- Records: `$O/08-clone-inside.txt`, `08-clone-commit.txt`, `08-clone-host.txt`, `08-clone-after-rm.txt`.
- Sections: 3.2.
- Open: the ref names under `refs/sandboxes/<name>/*`, whether the remote lives in the host `.git/config`, how the daemon serves it.

### K09 Policy deny and the log

- Tier B. The allowed request reaches example.com (free).
- Commands:
  - `sbx exec aiefs-demo sh -c 'curl -sS -m 10 -I https://example.com 2>&1 | head -5; echo exit=$?'` (expect blocked under balanced)
  - `sbx policy log aiefs-demo`
  - `sbx policy log aiefs-demo --json --limit 5`
  - `sbx policy check network example.com --sandbox aiefs-demo --verbose --json`
  - `sbx policy allow network --sandbox aiefs-demo example.com`
  - `sbx policy ls aiefs-demo --wide --json`
  - the same `curl` (expect 200)
  - `sbx policy log aiefs-demo --json --limit 5` (the allowed row with its PROXY type)
  - `sbx policy deny network --sandbox aiefs-demo example.com` then `sbx policy check network example.com --sandbox aiefs-demo --json` (deny wins)
  - `sbx policy inspect <rule-id> --json` for the allow rule (id from `ls --wide`)
  - `sbx policy rm network --sandbox aiefs-demo --id <rule-id> --force` for both rules
  - `sbx policy ls aiefs-demo --wide --created-via added`
  - `sbx policy --help | grep -i bypass` (C109)
- Records: `$O/09-blocked.txt`, `09-policy-log.txt`, `09-policy-log.json`, `09-check-verbose.json`, `09-allow.txt`, `09-ls-wide.json`, `09-allowed.txt`, `09-policy-log-after.json`, `09-deny-wins.json`, `09-inspect-rule.json`, `09-rm-id.txt`, `09-created-via.txt`, `09-bypass-grep.txt`.
- Sections: 3.3, 3.4, 7.2.
- Settles: C26 (what the blocked curl prints), C109.

### K10 Secrets and the sentinel

- Tier B, with K10b in Tier C (GitHub token, free API call, approval).
- Commands:
  - `node capture/receiver.mjs --port 18080 --log $O/10-receiver.log &` (host, logs method, path, and every header)
  - `sbx policy allow network --sandbox aiefs-demo localhost:18080` (03:S23 workflows/development: host services are allowed as `localhost:<port>` and reached as `host.docker.internal`)
  - `sbx secret set-custom --sandbox aiefs-demo --host host.docker.internal --env DEMO_API_KEY --value demo-secret-0000` (if `host.docker.internal` is refused as a host pattern, repeat with `--host localhost` and with `--host 'host.docker.internal:18080'`; record each answer)
  - `sbx secret ls --json` and `sbx secret ls --sandbox aiefs-demo`
  - `sbx exec aiefs-demo sh -c 'env | grep DEMO_API_KEY'` (the sentinel; a new session reads new secrets, 04:T02 [10:30] says new global secrets reach new sandboxes only, so record whether a `sbx stop` and `sbx run --name` is needed first)
  - `sbx exec aiefs-demo sh -c 'curl -sS -m 10 -H "Authorization: Bearer $DEMO_API_KEY" http://host.docker.internal:18080/swap; echo'`
  - `sbx exec aiefs-demo sh -c 'curl -sS -m 10 -H "X-Demo: $DEMO_API_KEY" http://host.docker.internal:18080/other-header; echo'` (does the swap apply to any header or only Authorization)
  - read `$O/10-receiver.log`
  - `sbx secret import --dry-run`
  - `sbx secret set-custom --sandbox aiefs-demo --host api.example.test --env NAMED_KEY --placeholder sk-{rand} --value v` (records the generated placeholder)
  - `sbx secret rm --sandbox aiefs-demo --placeholder <printed-placeholder> -f`
  - K10b, approval: `sbx secret set github --command 'gh auth token'` (global; the kit removes it at cleanup), `sbx run shell $W/demo --name aiefs-gh -- -c 'env | grep -E "^GH_TOKEN|^GITHUB_TOKEN" | sed "s/=\\(.\\{8\\}\\).*/=\\1…/"; gh api user --jq .login'`, then `sbx secret rm github -f`, `sbx rm --force aiefs-gh`
- Records: `$O/10-set-custom.txt`, `10-secret-ls.json`, `10-env-sentinel.txt`, `10-swap-curl.txt`, `10-receiver.log`, `10-import-dry-run.txt`, `10-placeholder.txt`, `10-github-sentinel.txt` (C), `10-github-api.txt` (C).
- Sections: 3.5, 7.4.
- Settles: C34, C35.
- Open: whether the proxy rewrites plain HTTP to a host-side receiver or only HTTPS to the bound host; if only HTTPS, add a TLS receiver with a self-signed certificate on 18443 and allow `localhost:18443`.

### K11 MCP registration, static set, live load, gateway from inside

- Tier B. The registry add fetches `registry.modelcontextprotocol.io` and pulls an OCI image (network, free).
- Commands:
  - `sbx mcp add echo --command node --args capture/mcp-echo.mjs --dir $PWD` (the host path; recorded path is masked)
  - `sbx mcp add fetch --url https://registry.modelcontextprotocol.io/v0/servers/fetch-mcp/versions/latest` (the help's own example)
  - `sbx mcp ls` and `sbx mcp ls --json`
  - `sbx mcp inspect echo --json` and `sbx mcp inspect fetch --json`
  - `sbx mcp auth status --all --json`
  - `sbx create shell $W/demo --name aiefs-mcp-static --static-mcp echo`
  - `sbx exec aiefs-mcp-static sh -c 'env | grep -i mcp; ls -la ~/.claude.json ~/.codex/config.toml ~/.config 2>/dev/null'` (which variable or file carries the gateway URL; a `shell` sandbox may carry none, so repeat on a `claude` sandbox created with `--static-mcp echo` and read `~/.claude.json` without running the agent)
  - from inside, `curl -sS -X POST "$MCP_URL" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2026-07-28","capabilities":{},"clientInfo":{"name":"aiefs","version":"0"}}}'` then `tools/list` (the URL and any auth header come from the previous step; the spec revision string is the one the Docker Agent docs name, 02:F40)
  - `sbx create shell $W/demo --name aiefs-mcp-dynamic` then the same `tools/list` (expect the discovery tools `mcp-find`, `mcp-add`, `code-mode`), then `sbx mcp load echo --sandbox aiefs-mcp-dynamic`, then `tools/list` again (expect `echo`)
  - `sbx mcp rm fetch --force` at cleanup; `echo` stays until the end
- Records: `$O/11-mcp-add.txt`, `11-mcp-add-registry.txt`, `11-mcp-ls.txt`, `11-mcp-ls.json`, `11-mcp-inspect-echo.json`, `11-mcp-inspect-fetch.json`, `11-mcp-auth-status.json`, `11-static-inside.txt`, `11-gateway-initialize.json`, `11-gateway-tools-static.json`, `11-gateway-tools-dynamic-before.json`, `11-load.txt`, `11-gateway-tools-dynamic-after.json`.
- Sections: 3.6, 6.5, 7.4.
- Settles: C40, C41, C42 (when K31 runs `docker-agent` inside), C90 (the registry add).
- Open: the in-sandbox gateway URL and whether it needs a bearer token; whether a host stdio server is reachable from a `shell` sandbox.

### K12 Kit v2 tooling and a mixin run

- Tier A for validate, pack, sign, verify, inspect; Tier B for the run.
- Files: `kits/hello-mixin/spec.yaml` with `schemaVersion: "2"`, `kind: mixin`, `setup.install: [apt-get update, apt-get install -y jq]`, `permissions.network: [example.com]`, `files/workspace/HELLO.md` (grammar from 01:F86; the exact key names are confirmed against `sbx kit validate`).
- Commands:
  - `openssl ecparam -genkey -name prime256v1 -noout -out capture/keys/p256.key && openssl ec -in capture/keys/p256.key -pubout -out capture/keys/p256.pub`
  - `sbx kit validate ./capture/kits/hello-mixin --json`
  - `sbx kit inspect ./capture/kits/hello-mixin --json`
  - `sbx kit pack ./capture/kits/hello-mixin -o $O/12-hello-mixin.zip` then `unzip -l $O/12-hello-mixin.zip`
  - `sbx kit sign --key capture/keys/p256.key ./capture/kits/hello-mixin` then `ls -l capture/kits/hello-mixin/kit.sig.bundle`
  - `sbx kit verify --key capture/keys/p256.pub ./capture/kits/hello-mixin --json`
  - `sbx kit verify --key capture/keys/p256.pub ./capture/kits/hello-mixin --json` after `sed -i '' 's/example.com/evil.example/' spec.yaml` (expect a failure), then restore
  - `sbx run shell $W/demo --name aiefs-kit --kit ./capture/kits/hello-mixin -- -c 'which jq; cat HELLO.md'`
  - `sbx policy ls aiefs-kit --source kit --wide`
  - `sbx kit add aiefs-demo ./capture/kits/hello-mixin` then `sbx exec aiefs-demo which jq`
  - `sbx kit inspect docker/sbx-kit-shell:<tag> --json` where the tag is read with `crane ls` or the Hub API at capture time (01:F91), for the volume question
- Records: `$O/12-validate.json`, `12-inspect.json`, `12-pack.txt`, `12-sign.txt`, `12-verify.json`, `12-verify-tampered.json`, `12-run-kit.txt`, `12-policy-kit.txt`, `12-kit-add.txt`, `12-inspect-docker-shell.json`.
- Sections: 4.2, 4.3, 3.3.
- Settles: C12 (if the inspected kit declares a volume), C13 (which generation these commands accept), C46.

### K13 Kit v3 build, push, inspect, run, kit-tck

- Tier B, plus Tier C for the TLS registry trust and the `kit-tck` download.
- Files: `kits/hello-kit/kit.yaml`: first line `# syntax=docker/sandbox-kit:3`, `schemaVersion: "3"`, `kind: workload`, a base of `docker/sandbox-templates:shell`, one `com.docker.sandbox/network-policy@2` grant allowing `example.com` with `GET` only, one file. The field names are taken from `docs/spec/SPEC-v3.md` in the vendored source at writing time.
- Commands:
  - `docker buildx build -f capture/kits/hello-kit/kit.yaml -t localhost:5000/aiefs/hello-kit:1 --push capture/kits/hello-kit`
  - `docker buildx imagetools inspect --raw localhost:5000/aiefs/hello-kit:1 | python3 -c 'import json,sys;m=json.load(sys.stdin);print(json.dumps({k:v for k,v in m.items() if k in ("annotations","config","layers")},indent=1))'`
  - `sbx kit inspect localhost:5000/aiefs/hello-kit:1 --json` (expect the `kit.allowedSources` refusal; record it)
  - `sbx settings set kit.allowedSources '["docker.io/","localhost:5000/"]'` then the inspect again; at cleanup `sbx settings unset kit.allowedSources`
  - `sbx run localhost:5000/aiefs/hello-kit:1 $W/demo --name aiefs-v3 -- -c 'curl -sS -m 10 -I https://example.com | head -1; curl -sS -m 10 -X DELETE https://example.com -o /dev/null -w "%{http_code}\n"'` (GET allowed, DELETE denied by the L7 rule)
  - `sbx policy log aiefs-v3 --json --limit 5` (whether an L7 denial shows method and path)
  - `sbx run ./capture/kits/hello-kit $W/demo --name aiefs-v3-dir -- -c true` (a v3 directory as the positional; 04:B05 shows `sbx run ./hello --kit ./gh .`)
  - `sbx kit inspect docker/sbx-kit-gh:<tag> --json` (the spec's example mixin, for 4.2)
  - `kit-tck validate ./capture/kits/hello-kit` and `kit-tck inspect ./capture/kits/hello-kit` (binary from the spec releases; record the version)
  - `sbx kit push ./capture/kits/hello-mixin localhost:5000/aiefs/hello-mixin:1 --sign --key capture/keys/p256.key` (v2 artifact push; if HTTP is refused, repeat against the TLS registry on 5443) then `sbx kit provenance --key capture/keys/p256.pub localhost:5000/aiefs/hello-mixin:1`
- Records: `$O/13-buildx.txt`, `13-manifest.json`, `13-allowed-sources-error.txt`, `13-kit-inspect.json`, `13-run-v3.txt`, `13-policy-log-l7.json`, `13-run-v3-dir.txt`, `13-kit-inspect-gh.json`, `13-kit-tck.txt`, `13-push-v2.txt`, `13-provenance.json`.
- Sections: 4.1, 4.2, 4.3, 3.4, 7.4.
- Settles: C13, C40, C12 (if `gh` declares a volume), part of C34.
- Open: whether `sbx kit push` and `sbx kit pull` accept a plain HTTP `localhost:5000`; the field names of the v3 descriptor; whether `kit-tck` ships a macOS binary.

### K14 sbxenv.yaml

- Tier B.
- File: `env/sbxenv.yaml` with `agent: shell`, `name: aiefs-env`, `workspace: .`, `kits: [{source: ./kits/hello-mixin}]`, `args: {greeting: {default: hello}}`, `env: {GREETING: "${{ env.args.greeting }}"}`, `secrets: {github: {command: "gh auth token", snapshot: true}}` only in K10b mode, `lifecycle: {initialize: [{command: "test -d $W/env-ws || mkdir -p $W/env-ws"}], postCreate: [{command: "echo created"}]}`, `ports: [18083:8080]`.
- Commands:
  - `sbx env plan ./capture/env`
  - `sbx env create --auto-approve ./capture/env`
  - `sbx env exec ./capture/env -- sh -c 'echo $GREETING; which jq'`
  - edit `greeting` default to `hallo`, then `sbx env plan ./capture/env` (expect one `~` line)
  - `sbx env plan --env-arg greeting=servus ./capture/env`
  - `find "$HOME/Library/Application Support/com.docker.sandboxes" -path '*env*' -newer $O/02-daemon-status.json | head` (where the approved state lives)
  - `sbx env rm --force ./capture/env`
- Records: `$O/14-env-plan.txt`, `14-env-create.txt`, `14-env-exec.txt`, `14-env-plan-2.txt`, `14-env-plan-arg.txt`, `14-env-state-path.txt`, `14-env-rm.txt`.
- Sections: 4.4.
- Open: the exact plan text; the state path.

### K15 Skills

- Tier B. Clones `anthropics/skills` from GitHub (free).
- Commands:
  - `sbx skills add anthropics/skills --skill pdf`
  - `sbx skills ls --json`
  - `ls "$HOME/Library/Application Support/com.docker.sandboxes/sandboxes/agent-skills"`
  - `sbx create shell $W/demo --name aiefs-skills --skills readonly` then `sbx exec aiefs-skills sh -c 'ls -la ~/.claude/skills ~/.agents/skills 2>&1'`
  - `sbx skills import --dry-run`
  - `sbx skills rm pdf --force` at cleanup
- Records: `$O/15-skills-add.txt`, `15-skills-ls.json`, `15-skills-store.txt`, `15-skills-inside.txt`, `15-skills-import-dry-run.txt`.
- Sections: 4.5.

### K16 docker-agent diagnosis and debug

- Tier B for `doctor` with DMR up; Tier A for `debug config`, `debug toolsets`, `debug tool`, `toolsets`.
- Commands:
  - `docker-agent doctor` and `docker-agent doctor --json`
  - `docker-agent doctor capture/agents/team.yaml`
  - `docker-agent models list --format json`
  - `docker-agent toolsets --format json`
  - `docker-agent debug config capture/agents/flavors.yaml`
  - `docker-agent debug config capture/agents/flavors.yaml cheap`
  - `docker-agent debug toolsets capture/agents/files.yaml --json`
  - `docker-agent debug tool capture/agents/files.yaml read_file '{"path":"capture/work/demo/README.md"}' --json`
  - `docker-agent debug skills capture/agents/pirate.yaml --json`
  - `docker-agent alias add aiefs-pirate capture/agents/pirate.yaml --safety balanced` then `docker-agent alias list --json` then `docker-agent alias remove aiefs-pirate`
- Records: `$O/16-doctor.txt`, `16-doctor.json`, `16-doctor-team.txt`, `16-models.json`, `16-toolsets.json`, `16-debug-config.yaml`, `16-debug-config-flavor.yaml`, `16-debug-toolsets.json`, `16-debug-tool.json`, `16-debug-skills.json`, `16-alias.json`.
- Sections: 5.1, 5.2, 5.3, R.5.
- Settles: C56, C58, C66.

### K17 One agent run, recorded and replayed

- Tier B to record (DMR, no key); Tier A to replay.
- Commands:
  - `docker-agent run --exec --last capture/agents/pirate.yaml --record capture/cassettes/17-pirate.json "Explain in two sentences what a Docker volume is."`
  - `docker-agent run --exec --json --fake capture/cassettes/17-pirate.json capture/agents/pirate.yaml "Explain in two sentences what a Docker volume is."`
  - `docker-agent run --exec --last --fake capture/cassettes/17-pirate.json --fake-stream 0 capture/agents/pirate.yaml "…"`
  - `docker-agent run --exec --last capture/agents/pirate.yaml "First" "Follow-up"` recorded as `17-turns.json`
- Records: `$O/17-run-last.txt`, `17-run-json.ndjson`, `17-fake-replay.txt`, `17-turns.txt`, and the cassettes.
- Sections: 1.2, 5.1, 5.2.
- Open: the cassette format; whether `--fake` runs with no provider reachable (Tier A claim).

### K18 Multi-agent: transfer_task, handoff, background_agents

- Tier B to record; Tier A to replay. Zero paid calls if `ai/qwen3` emits the tool calls.
- File: `agents/team.yaml`: `root` with `sub_agents: [writer]`, `handoffs: [reviewer]`, a `background_agents` toolset; `writer` and `reviewer` with `think` only; all on `dmr/ai/qwen3`, `temperature: 0`, `max_iterations: 6`.
- Commands:
  - `docker-agent run --exec --json --record capture/cassettes/18-team.json capture/agents/team.yaml "Ask writer for one sentence about microVMs, then hand off to reviewer."`
  - extract the `tool_call` events for `transfer_task` and `handoff` with `jq` into separate files
  - `docker-agent run --exec --json --record capture/cassettes/18-background.json capture/agents/team.yaml "Run writer in the background and wait for it."`
- Records: `$O/18-team.ndjson`, `18-transfer-task.json`, `18-handoff.json`, `18-background.ndjson`.
- Sections: 5.4.
- Fallback, Tier C: if the local model does not call the tools in three attempts, record once with a paid key (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, approval) and replay with `--fake`. Off by default.

### K19 Permissions and hooks

- Tier B to record; Tier A to replay.
- Files: `agents/guarded.yaml` with `shell` toolset, `permissions: {deny: ["shell:cmd=rm*"], allow: ["shell:cmd=echo*"]}`, `safety: restricted`, `hooks: {pre_tool_use: [{type: command, command: capture/hooks/log-hook.sh}]}`; the hook writes stdin to `$O/19-hook-stdin.json` and prints `{"hook_specific_output":{"permission_decision":"allow"}}`; a second hook `block-hook.sh` exits 2.
- Commands:
  - `docker-agent run --exec --json --record capture/cassettes/19-guarded.json capture/agents/guarded.yaml "Run echo ok, then run rm -rf /tmp/nothing."`
  - `docker-agent run --exec --json --hook-pre-tool-use capture/hooks/block-hook.sh --fake capture/cassettes/19-guarded.json capture/agents/guarded.yaml "…"` (exit 2 blocks)
  - `docker-agent run --exec --json --safety strict --fake … capture/agents/guarded.yaml "…"` (what strict does without a terminal)
- Records: `$O/19-deny.ndjson`, `19-hook-stdin.json`, `19-block-exit2.ndjson`, `19-strict.txt`.
- Sections: 5.5.
- Open: the exact `hook_specific_output` fields the runtime reads; what `restricted` emits for a denied call.

### K20 Sessions, diff, worktree, plans

- Tier B.
- Commands:
  - `ls -l ~/.cagent/session.db`
  - `docker-agent run --exec --last --fake capture/cassettes/17-pirate.json capture/agents/pirate.yaml "…"` twice, the second with `--session -1 "and one more"`
  - `docker-agent sessions diff -1 -2 --json`
  - `docker-agent run --exec --json --fake capture/cassettes/19-guarded.json capture/agents/guarded.yaml "…"` then `docker-agent sessions diff -1 -3 --fail-on-divergence; echo exit=$?`
  - `docker-agent run --exec --last --worktree aiefs --working-dir $W/repo --fake capture/cassettes/17-pirate.json capture/agents/pirate.yaml "…"` then `git -C $W/repo worktree list` and `ls ~/.cagent/worktrees`
  - `docker-agent plans create aiefs --file capture/plans/plan.md --title "AIEFS plan" --json`, `plans list --json`, `plans status aiefs done --expected-version 1 --json`, `plans delete aiefs --force --json`
- Records: `$O/20-session-db.txt`, `20-session-resume.txt`, `20-sessions-diff.json`, `20-diff-fail.txt`, `20-worktree.txt`, `20-plans.json`.
- Sections: 5.6, 5.4.

### K21 Eval

- Tier B. Runs containers from `docker/docker-agent:1.149.0`; needs Desktop; judge on DMR.
- File: `evals/greet.json` in the format `examples/eval/evals/*.json` uses (02:S15); vendored at writing time.
- Commands:
  - `docker-agent eval capture/agents/pirate.yaml capture/evals --judge-model dmr/ai/qwen3 -c 1 --output $O/21-eval-results`
  - `docker-agent eval … --repeat 2 --output $O/21-eval-baseline`
  - `docker-agent eval … --baseline $O/21-eval-baseline/<run>.json --regression-tolerance 0.2; echo exit=$?`
- Records: `$O/21-eval.txt`, `21-eval-results/*.json`, `21-baseline.txt`.
- Sections: 5.6, 7.4.
- Open: whether the containers reach DMR at `model-runner.docker.internal`; whether a DMR judge is accepted; the results JSON shape.

### K22 serve api

- Tier A with `--fake`; Tier B to record.
- Commands:
  - `docker-agent serve api capture/agents/pirate.yaml --listen 127.0.0.1:8080 --fake capture/cassettes/17-pirate.json -s $O/22-session.db &`
  - `curl -sS http://127.0.0.1:8080/api/ping`
  - `curl -sS http://127.0.0.1:8080/api/agents`
  - `curl -sS -X POST http://127.0.0.1:8080/api/sessions -H 'Content-Type: application/json' -d '{}'` (record the id)
  - `curl -sS -N -X POST http://127.0.0.1:8080/api/sessions/$SID/agent/pirate -H 'Content-Type: application/json' -d '{"content":"…"}'` (SSE)
  - `curl -sS "http://127.0.0.1:8080/api/sessions/$SID/events?since=0"`
  - `curl -sS -X POST http://127.0.0.1:8080/api/sessions/$SID/followup -H 'Idempotency-Key: aiefs-1' -d '{"content":"more"}'`
- Records: `$O/22-api-ping.json`, `22-api-agents.json`, `22-api-session.json`, `22-api-run.sse`, `22-api-events.sse`, `22-api-followup.json`.
- Sections: 6.1.
- Open: request body field names (`content` is assumed from 02:F41; the docs page is re-read at writing time).

### K23 serve chat

- Tier B (DMR).
- Commands:
  - `docker-agent serve chat capture/agents/pirate.yaml --listen 127.0.0.1:8083 --api-key aiefs-token &`
  - `curl -sS http://127.0.0.1:8083/v1/models -H 'Authorization: Bearer aiefs-token'`
  - `curl -sS http://127.0.0.1:8083/v1/chat/completions -H 'Authorization: Bearer aiefs-token' -H 'Content-Type: application/json' -d '{"model":"pirate","messages":[{"role":"user","content":"Say ahoy."}]}'`
  - the same without the header (expect 401)
- Records: `$O/23-chat-models.json`, `23-chat-completion.json`, `23-chat-401.txt`.
- Sections: 6.1.

### K24 serve mcp

- Tier B (DMR) for the tool call; Tier A for `initialize` and `tools/list`.
- Commands:
  - stdio: `printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2026-07-28","capabilities":{},"clientInfo":{"name":"aiefs","version":"0"}}}' '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | docker-agent serve mcp capture/agents/pirate.yaml --tool-name pirate`
  - http: `docker-agent serve mcp capture/agents/pirate.yaml --http --listen 127.0.0.1:8081 --auth-token aiefs-token &` then the same three messages as POSTs with `Accept: application/json, text/event-stream`, then `tools/call` with `{"name":"pirate","arguments":{"message":"Say ahoy."}}` (argument name confirmed from `tools/list`)
- Records: `$O/24-mcp-stdio.jsonl`, `24-mcp-http-initialize.json`, `24-mcp-http-tools-list.json`, `24-mcp-http-tools-call.json`.
- Sections: 6.2.

### K25 serve acp

- Tier B (DMR).
- Commands:
  - `printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{}}}' '{"jsonrpc":"2.0","id":2,"method":"session/new","params":{"cwd":"'$W'","mcpServers":[]}}' | docker-agent serve acp capture/agents/pirate.yaml` (field names from the ACP docs page, re-read at writing time)
- Records: `$O/25-acp.jsonl`.
- Sections: 6.2.

### K26 serve a2a and the tie to A2A 101

- Tier B (DMR).
- Commands:
  - `docker-agent serve a2a capture/agents/a2a.yaml --listen 127.0.0.1:8082 &`
  - `curl -sS -i http://127.0.0.1:8082/.well-known/agent-card.json`; if 404, `curl -sS -i http://127.0.0.1:8082/.well-known/agent.json`
  - `curl -sS -i -X POST http://127.0.0.1:8082/ -H 'Content-Type: application/json' -H 'A2A-Version: 1.0' -d '{"jsonrpc":"2.0","id":1,"method":"SendMessage","params":{"message":{"messageId":"aiefs-0001","role":"ROLE_USER","parts":[{"text":"Say ahoy."}]}}}'`; if the method is unknown, repeat with the 0.3 names `message/send` and `role: "user"`, `kind: "text"`, and record both
  - `GetTask` or `tasks/get` for the returned task id, if a task came back
  - `python3 capture/a2a-compare.py $O/26-agent-card.json` which lists which fields of a2a-101 R.2 the card has and which it lacks
- Records: `$O/26-agent-card.http`, `26-agent-card.json`, `26-send-message.http`, `26-get-task.http`, `26-a2a-compare.txt`.
- Sections: 6.3, 7.4.
- Settles: C70, C71.

### K27 share push and pull with a key

- Tier B. Local registry on 5000 (HTTP) with a TLS fallback on 5443 (Tier C trust change).
- Commands:
  - `ssh-keygen -t ed25519 -N '' -f capture/keys/ed25519`
  - `docker-agent share push capture/agents/pirate.yaml localhost:5000/aiefs/pirate:1 --key file://capture/keys/ed25519`
  - `docker buildx imagetools inspect --raw localhost:5000/aiefs/pirate:1` (annotations; the DSSE envelope decoded with `base64 -d | python3 -m json.tool` is written to `27-attestation.json`)
  - `docker-agent share pull localhost:5000/aiefs/pirate:1 --key file://capture/keys/ed25519.pub --force`
  - `docker-agent share pull localhost:5000/aiefs/pirate:1 --key file://capture/keys/p256.pub --force; echo exit=$?` (wrong key)
  - `docker-agent run --exec --last --fake capture/cassettes/17-pirate.json localhost:5000/aiefs/pirate:1 "…"`
- Records: `$O/27-share-push.txt`, `27-manifest.json`, `27-attestation.json`, `27-share-pull.txt`, `27-share-pull-wrong-key.txt`, `27-run-ref.txt`.
- Sections: 6.4.
- Open: whether plain HTTP `localhost:5000` is accepted.

### K28 Docker Model Runner

- Tier B. Needs the Desktop update and the model pull (approval).
- Commands:
  - `docker model version`, `docker model status --json`
  - `docker model pull ai/qwen3` (once; the kit skips it when `docker model ls` already shows it)
  - `docker model ls`
  - `curl -sS http://localhost:12434/engines/v1/models`
  - `curl -sS http://localhost:12434/engines/llama.cpp/v1/chat/completions -H 'Content-Type: application/json' -d '{"model":"ai/qwen3","messages":[{"role":"user","content":"Say ahoy."}],"temperature":0}'`
  - `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:12434/anthropic/v1/messages -X POST -H 'Content-Type: application/json' -d '{"model":"ai/qwen3","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}'` and the same against `/v1/messages`
  - `docker run --rm curlimages/curl -sS http://model-runner.docker.internal/engines/v1/models`
  - `docker model requests --model ai/qwen3 -f > $O/28-requests.log &` during one K17 run, with a `models.local.provider_opts.context_size: 8192` set in a copy of pirate.yaml (C83)
  - `docker model configure --help; echo exit=$?`
  - `docker model unload --all`
- Records: `$O/28-model-version.txt`, `28-model-status.json`, `28-model-pull.txt`, `28-model-ls.txt`, `28-models.json`, `28-completion.json`, `28-anthropic-path.txt`, `28-in-container-models.json`, `28-requests.log`, `28-configure-help.txt`.
- Sections: 5.2, 6.5, 1.2.
- Settles: C77, C79, C81, C83.

### K29 Compose and the Toolkit gateway

- Tier B. Pulls `docker/mcp-gateway` and `mcp/duckduckgo`.
- Files: `compose/compose.yaml` with a top-level `models: {llm: {model: ai/qwen3, context_size: 4096}}`, an `agent` service built from `compose/Dockerfile` (`docker/docker-agent:1.149.0`) with `models: {llm: {endpoint_var: DOCKER_AGENT_MODELS_URL, model_var: LLM_MODEL}}` and `environment: [MCPGATEWAY_URL=http://mcp-gateway:8811]`, a `mcp-gateway` service `image: docker/mcp-gateway`, `use_api_socket: true`, `command: ["--transport=streaming","--servers=duckduckgo"]`.
- Commands:
  - `docker compose -f capture/compose/compose.yaml config`
  - `docker compose -f capture/compose/compose.yaml up -d` then `docker compose … exec agent env | grep -E 'LLM|MCPGATEWAY'` then `docker compose … exec agent curl -sS http://mcp-gateway:8811/` (record whatever answers) then `down`
  - `docker mcp version`, `docker mcp gateway run --help` (the `--verify-signatures` default line)
  - `docker mcp gateway run --transport streaming --servers duckduckgo --port 8811 &` then `docker mcp tools ls` and `docker mcp tools call search query="docker sandboxes"` (the tool name is confirmed from `tools ls`)
  - `docker run --rm docker/mcp-gateway:v2 --version`
  - `docker-agent run --exec --last capture/agents/ddg.yaml "Search for the sbx release notes."` where `ddg.yaml` uses `type: mcp, ref: docker:duckduckgo`; then stop Desktop's daemon and repeat to record the error (C73)
- Records: `$O/29-compose-config.yaml`, `29-compose-env.txt`, `29-compose-gateway.txt`, `29-mcp-version.txt`, `29-gateway-help.txt`, `29-gateway-tools.txt`, `29-gateway-call.txt`, `29-gateway-v2-version.txt`, `29-docker-ref.txt`, `29-docker-ref-no-daemon.txt`.
- Sections: 5.3, 6.5.
- Settles: C73, C86, C89, C92.

### K30 docker-agent run --sandbox

- Tier B. Pulls `docker/docker-agent-sbx-templates:latest`.
- Commands:
  - `docker-agent run --sandbox --exec --json capture/agents/pirate.yaml "Print the first line of README.md."` with `--working-dir $W/demo`; record the launch summary lines that name the kit path and the allowlist
  - `ls ~/Library/Caches/cagent/sandbox-kits/` and `find … -maxdepth 3`
  - `sbx ls --json` (the sandbox the run created, its template)
  - `docker-agent run --sandbox --exec --json capture/agents/fetch.yaml "Fetch https://example.com and print the title."` (`fetch` toolset; expect the 403 block in the output)
  - `docker-agent sandbox allow example.com`, `docker-agent sandbox list`, the run again, `docker-agent sandbox deny example.com`
  - inside the sandbox: `sbx exec <name> sh -c 'env | grep -iE "yolo|safety"; cat ~/.config/cagent/config.yaml 2>/dev/null'` and the `--json` first event that names the safety mode, if any (C62)
  - `docker-agent run --sandbox --no-kit --exec --last capture/agents/pirate.yaml "…"` (what changes without the kit)
  - the model inside: the run above uses `dmr/ai/qwen3`; record whether `localhost:12434` is in the allowlist by default or whether `sbx policy allow network localhost:12434` was needed
- Records: `$O/30-sandbox-launch.txt`, `30-run.ndjson`, `30-kit-cache.txt`, `30-ls.json`, `30-blocked-403.txt`, `30-sandbox-allow.txt`, `30-allowed.ndjson`, `30-safety-inside.txt`, `30-no-kit.txt`, `30-model-path.txt`.
- Sections: 1.2, 3.6, 5.5.
- Settles: C61, C62.

### K31 sbx run docker-agent

- Tier B. Pulls `docker/sandbox-templates:docker-agent`.
- Commands:
  - `sbx policy allow network localhost:12434`
  - `sbx create docker-agent $W/demo --name aiefs-da -e DOCKER_AGENT_MODELS_GATEWAY= ` (no gateway)
  - `sbx exec aiefs-da sh -c 'docker-agent version; docker-agent doctor; env | grep -i mcp'` (which binary and version the template ships; whether the sbx gateway URL is present for Docker Agent, C42)
  - `sbx cp capture/agents/dmr-host.yaml aiefs-da:/tmp/agent.yaml` where `dmr-host.yaml` sets `providers.dmr.base_url: http://host.docker.internal:12434/engines/llama.cpp/v1`
  - `sbx exec aiefs-da docker-agent run --exec --last /tmp/agent.yaml "Say ahoy."`
  - `sbx run docker-agent $W/demo --name aiefs-da -- --exec --last /tmp/agent.yaml "Say ahoy."` (the default command is `docker-agent run --yolo`; record how agent args are appended)
  - `sbx exec aiefs-da sh -c 'cd $PWD && docker compose -f /tmp/compose.yaml config 2>&1 | head -20'` with a `models:` file copied in (C95)
  - `sbx policy rm network --resource localhost:12434 --force` at cleanup
- Records: `$O/31-create.txt`, `31-inside-versions.txt`, `31-doctor-inside.txt`, `31-run-inside.txt`, `31-sbx-run-docker-agent.txt`, `31-compose-inside.txt`.
- Sections: 1.1, 1.2, 6.5.
- Settles: C42, C61, C95.

### K32 Audit and governance surfaces without an org

- Tier B.
- Commands:
  - `ls -la "$HOME/Library/Logs/com.docker.sandboxes/sandboxes/auditkit/"` and `head -c 4000 <newest>.jsonl | python3 -c 'import sys,json;[print(json.dumps(json.loads(l))[:300]) for l in sys.stdin if l.strip()]'`
  - `sbx policy ls --source org`, `sbx policy ls --include-inactive`, `sbx policy profile ls --json`
  - `sbx create shell $W/demo --name aiefs-profile --profile developer; echo exit=$?` (what a missing profile does)
- Records: `$O/32-auditkit-ls.txt`, `32-audit-head.jsonl`, `32-policy-org.txt`, `32-policy-inactive.txt`, `32-policy-profile.json`, `32-profile-missing.txt`.
- Sections: 7.2.
- Settles: C37.

### K33 Cloud Sandboxes (money)

- Tier C. Approval required. Estimated cost under $0.20 at $0.07 per hour for micro over at most 30 minutes, plus `sbx move` staging of a small sandbox.
- Commands:
  - `sbx --cloud --help` and `sbx --cloud policy init balanced`
  - `sbx --cloud run --detached --name aiefs-cloud --cpus 1 --memory 2g --ttl 15m --on-timeout delete shell`
  - `sbx --cloud ls --json`, `sbx ttl aiefs-cloud --json`, `sbx ttl +5m aiefs-cloud --json`
  - `sbx --cloud exec aiefs-cloud sh -c 'uname -a; docker info --format "{{.ServerVersion}}"; docker run --rm hello-world 2>&1 | head -3'` (C104)
  - `sbx --cloud ports aiefs-cloud --publish 8080` then `--json`
  - `sbx --cloud mcp ls aiefs-cloud`
  - `sbx --cloud cp capture/work/in.txt aiefs-cloud:/workspace/in.txt`
  - `sbx move aiefs-demo --to cloud --ttl 15m --on-timeout delete --force` then `sbx --cloud ls --json`, then `sbx run --name aiefs-demo -- -c true` (the local source restarts)
  - `sbx --cloud rm --force aiefs-cloud moved-aiefs-demo-*`
- Records: `$O/33-cloud-help.txt`, `33-policy-init.txt`, `33-cloud-run.txt`, `33-cloud-ls.json`, `33-ttl.json`, `33-ttl-extend.json`, `33-cloud-exec.txt`, `33-ports.json`, `33-mcp-ls.txt`, `33-cp.txt`, `33-move.txt`, `33-move-ls.json`, `33-rm.txt`.
- Sections: 7.1.
- Settles: C104; informs C102, C103.

### K34 Migration evidence

- Tier B after the Desktop update.
- Commands:
  - `docker sandbox version; echo exit=$?` (expect "not a docker command" on 4.94.0)
  - `docker agent version` and `docker-agent version` side by side; `ls -l ~/.docker/cli-plugins/`
  - `cagent version; echo exit=$?`
  - `sbx create cagent --help | head -5` (the alias)
  - `ls -la ~/.docker/sandboxes ~/.sandboxd 2>&1` (legacy state present or not)
  - `docker-agent run --exec --last --sbx=false --sandbox capture/agents/pirate.yaml "hi"; echo exit=$?` (C60)
- Records: `$O/34-docker-sandbox.txt`, `34-plugin-version.txt`, `34-cli-plugins.txt`, `34-cagent.txt`, `34-cagent-alias.txt`, `34-legacy-dirs.txt`, `34-sbx-false.txt`.
- Sections: 7.3.
- Settles: C17, C48, C60, C107, C111.

### K35 Timing, optional

- Tier B. Three runs, reported as a table with min and max; never a vendor comparison.
- Commands:
  - for i in 1 2 3: `time sbx create shell $W/demo --name aiefs-t$i` then `time sbx exec aiefs-t$i true` then `sbx rm --force aiefs-t$i`
  - optional: `time docker build --no-cache -t t -f capture/compose/Dockerfile capture/compose` inside `aiefs-demo` and on the host
- Records: `$O/35-timing.txt`.
- Sections: 7.4.
- Informs: C29, C30.

## 7. Cleanup

```text
sbx ls --json            # every aiefs-* name
sbx rm --force <each>
sbx secret rm --sandbox aiefs-demo --placeholder <each> -f
sbx secret rm github -f                       # only if K10b ran
sbx mcp rm echo --force; sbx mcp rm fetch --force
sbx skills rm pdf --force
sbx policy rm network --resource example.com --force
sbx policy rm network --resource localhost:18080 --force
sbx policy rm network --resource localhost:12434 --force
sbx settings unset kit.allowedSources
sbx setup ssh remove                          # if K02 ran it and Rohit wants it gone
docker rm -f aiefs-registry
docker model unload --all
```

The global `balanced` policy from K03 stays, because `sbx policy reset` stops every sandbox and is destructive.

## 8. What needs Rohit's approval, in one list

1. Docker Desktop update to 4.94.0, enabling Docker Model Runner with host TCP 12434, and `docker model pull ai/qwen3` (several GB; prerequisite 5 and 6; K16 to K31 depend on it).
2. K02: `sbx setup ssh` writes a managed block to `~/.ssh/config` (reversible with `sbx setup ssh remove`).
3. K10b: `gh auth token` stored as the `github` service secret for one run and removed after; one `GET /user` call.
4. K13 and K27: either trust a self-signed certificate for a TLS registry on 5443, or push to a public repository under `rohitghumare64` on Docker Hub if plain HTTP is refused.
5. Downloads: `kit-tck` from docker/sandbox-kit-spec releases; images `registry:2`, `docker/sandbox-templates:shell`, `docker/sandbox-templates:docker-agent`, `docker/docker-agent-sbx-templates:latest`, `docker/docker-agent:1.149.0`, `docker/mcp-gateway`, `mcp/duckduckgo`, `curlimages/curl`, `hello-world`; the `fetch-mcp` OCI image via the registry add in K11.
6. K33: Cloud Sandboxes, estimated under $0.20, only with a pay-as-you-go plan on the account.
7. K18 and K26 fallback only: one recording with a paid model key if `ai/qwen3` cannot drive tool calls. Off by default.

## 9. Captures that cannot run on this host

- GPU passthrough (`feature.sandbox-gpu`): Linux x86_64 NVIDIA only (01:F82). The manual cites the docs and prints no capture.
- USB (`--usb`): hidden flag, Linux (01:F83). Same.
- Windows and Linux state paths: from the docs only (01:4e).
- Organization policies, Docker Home audit retention, SIEM export: need an AI Governance subscription. The manual prints the local JSONL only (K32).
- The Sandboxes API and TypeScript SDK (`@docker/sandboxes`, 03:S29): experimental and cloud-billed; out of scope for this edition.
