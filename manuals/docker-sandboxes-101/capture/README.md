# Docker Sandboxes and Docker Agent 101 capture kit

Every listing in the manual is cut from a file in `out/`. This kit drives the real `sbx` and `docker-agent` binaries on the host that runs it, records what they print, and masks the values that change from one run to the next. It uses the Python standard library only.

```bash
python3 run.py            # writes out/
python3 run.py --check    # captures again into a temporary directory and compares with out/
python3 run.py --tier a   # only the steps that need no daemon and no network
python3 run.py --only K09,K10   # a subset of steps, for development; earlier steps must have left their sandboxes in place
```

This subject cannot be captured offline, which the manuals standard asks for. `sbx` starts real microVMs from images on Docker Hub and needs a Docker sign-in. The kit therefore has tiers, and `run.py --check` skips with exit 0 when the host cannot run them, so the repository CI (which has neither binary) stays green.

## Tiers

| Tier | Needs | In this kit version |
|---|---|---|
| A | `docker-agent` and `sbx` installed; no daemon, no network, no model, no keys | K00 versions, K01 root help, K16 `docker-agent version`, `doctor`, `toolsets`, `models list`, `sandbox list`, `run --dry-run` |
| B | `sbx` v0.47.0 signed in, the sandboxd daemon, image pulls from Docker Hub, outbound HTTPS to `example.com` and `mcp.deepwiki.com` | everything else in `run.py`: the sandbox lifecycle, ports, cp, policy, secrets with a host receiver, MCP, kits v2 and v3, `env plan`, skills, templates, `--clone`, prune, and `docker-agent share pull` |
| C | money (Cloud Sandboxes), a GitHub token, a change to `~/.ssh/config`, a model | not implemented; `--tier abc` prints a note and runs A and B. Steps slot into `STEPS` in `run.py` with the tier letter `c` |

Tier A steps need no model: `docker-agent run --dry-run` is captured as it behaves on a host without Docker Model Runner, which is an error (`16-dry-run.txt`). Runs with a model and recorded cassettes belong to a later version of this kit.

## Prerequisites for a full run

- macOS on Apple silicon with Hypervisor.framework (`sysctl kern.hv_support` is 1).
- `sbx` v0.47.0 from the Homebrew cask, signed in (`sbx login` done by you, never by the kit), daemon healthy. The kit starts the daemon once if `sbx daemon status` fails.
- `docker-agent` v1.149.0 from Homebrew.
- Python 3.12 or later, git, curl.
- About 1.3 GiB of disk for `docker/sandbox-templates:shell-docker` and one saved template.
- Port 18080 free on the host for the secret receiver, port 18081 free for the published sandbox port.
- The global network policy either uninitialized or already `balanced`. The run that finds it uninitialized runs `sbx policy init balanced` once and records `03-policy-init.txt`. The kit never runs `sbx reset`, `sbx policy reset`, `sbx setup ssh`, `sbx login`, `sbx logout`, or anything with `--cloud`.

A full run takes about eight minutes on an M-series laptop when the template image is already present, plus the first pull.

## What the kit creates and removes

Everything is named `m101-*`: sandboxes `m101-demo`, `m101-demo-2`, `m101-secret`, `m101-mcp`, `m101-mcp-dyn`, `m101-kit`, `m101-from-tpl`, `m101-clone`; the template `m101-tpl:v1`; the MCP registration `m101-deepwiki`; custom secrets whose variables start with `M101_`. The run starts with a sweep that removes leftovers of an earlier attempt and ends with `sbx rm`, `sbx template rm`, `sbx mcp rm`, and `sbx secret rm` for all of them. Sandbox-scoped policy rules go away with their sandbox. The initialized global policy stays.

The only secret value the kit stores is the dummy `m101-dummy-receiver-0000`, and it is removed at the end of the run. No real token, key, or password is read or written.

## Fixtures

| Path | Used by |
|---|---|
| `fixtures/repo/` | generated on every run: a git repository with two commits at fixed dates, so the hashes are the same on every host |
| `fixtures/repo-clone/`, `fixtures/repo-kit/` | fresh copies of `repo/` for the `--clone` and `--kit` sandboxes |
| `fixtures/kits/hello-mixin/` | a v2 mixin (`spec.yaml`, `files/workspace/HELLO.md`) that installs `tree` and allows `example.com` |
| `fixtures/kits/env-mixin/` | a v2 mixin with one variable and one allowed host, the shape `sbx kit add` accepts |
| `fixtures/kits/hello-kit/kit.yaml` | a v3 descriptor with `# syntax=docker/sandbox-kit:3`; the v2 tooling refuses it, which `13-*` records. Its capability block is not validated by this kit, because a v3 build needs the Docker daemon |
| `fixtures/env/sbxenv.yaml` | the environment file for `sbx env plan` |
| `fixtures/agents/greeter.yaml` | the agent file for `docker-agent run --dry-run` |
| `fixtures/mcp-probe.sh` | runs inside a sandbox: `initialize`, `notifications/initialized`, `tools/list` against `$MCP_GATEWAY_URL` with the `Mcp-Session-Id` header |

The generated directories are listed in `.gitignore`. `work/` holds the template tar, the kit zip, and the pulled agent file, and is recreated on every run.

## Masks

Files are masked when they are written, so `out/` holds no username, no ids, and no timestamps, and `--check` compares byte for byte. The rules are the `MASKS` table and the per-line rules in `mask_text` in `run.py`:

| Pattern | Token |
|---|---|
| the absolute path of this directory | `$CAPTURE` |
| the home directory, then the user name | `$HOME`, `$USER` |
| the Docker Hub user shown by `sbx mcp ls` | `<docker-user>` |
| the per-run suffix of `m101-policy-<6hex>` and `m101-secret-<6hex>` (fresh names, because the daemon keeps `sbx policy log` per sandbox name across `sbx rm`) | `m101-policy`, `m101-secret` |
| UUIDs (sandbox ids, policy and rule ids, `SANDBOX_ID`) | `<uuid>` |
| 12-hex image and layer ids, `kit-<hash>`, swap container names | `<id>`, `-swap-<id>` |
| 64-hex digests and container ids | `sha256:<digest>`, `<sha256>` |
| RFC 3339 timestamps, the policy log `LAST SEEN` column, HTTP `Date` headers | `<ts>`, `<http-date>` |
| ephemeral host ports 49152 to 65535 after `127.0.0.1:`, `[::1]:`, `::1:`, or `"host_port":` | `<port>` |
| `Mcp-Session-Id` values and SSE event ids | `<session>`, `<event-id>` |
| custom secret placeholders `sbx-cs-…` and `sk-…` | `sbx-cs-<rand>`, `sk-<rand>` |
| `PROXY_CA_CERT_B64` | `<base64>` |
| kit install durations, diagnostics byte counts, free disk space, request counts, image sizes, `ls -la` dates, `df` columns, "N days ago" | `<dur>`, `<n>`, `<date>`, `<age>`, `<size>` and friends |
| the pull progress block of `sbx create` (downloaded on the first run, already present after) | `<layers>` |

The `sbx policy log` captures are filtered and sorted before they are written. The daemon keeps that log per sandbox name and keeps it across `sbx rm`, so a second run on the same machine sees rows left by the first one, and it orders rows by time. The kit keeps only the rows for the hosts it contacted itself (`example.com:443`, the receiver on `localhost:18080` and `gateway.docker.internal:18080`, and the two hosts the template reaches at every start, `ports.ubuntu.com:80` and `download.docker.com:443`), sorted by host. The sets are `DEMO_HOSTS` and `SECRET_HOSTS` in `run.py`.

`03-policy-init.txt` is written only by the run that initializes the global policy and is not compared by `--check`. On the recording host the policy was initialized by hand with the same command, `sbx policy init balanced`, a few hours before the kit's first run, so the file in `out/` holds that command's output as it was printed then, in the kit's own format.

## Recorded with

- sbx v0.47.0 (revision 0411f50ee4700fe7bd37e6e7e3aced563e850ca9, API 0.38.0), template `docker/sandbox-templates:shell-docker` image id 1560168ac5fb (Ubuntu 26.04.1, kernel 7.0.14, Docker Engine 29.8.1)
- docker-agent v1.149.0 (Homebrew)
- macOS 26.2 (25C56) on arm64, Python 3.14

The exact lines are the top of `out/README.md`, which `run.py` writes from `sbx version` and `docker-agent version` on every run.

## What the recorded run showed that the docs or the plan did not say

- A sandbox with no attached session stops on its own 30 seconds after the last session ends (`04-auto-stop.txt`, daemon log: "auto-stop grace period expired"). `sbx exec`, `sbx cp`, and `sbx ports --publish` start it again. The kit runs `sbx exec NAME true` before each recorded command so the "started successfully" line does not appear at random.
- `sbx policy deny` on a host that already has an `allow` rule in the same scope is refused as a conflict (`09-deny-conflict.txt`). The help text says deny takes precedence; the daemon does not store the pair.
- `sbx template save` refuses a running sandbox outside a terminal and asks for `sbx stop` first (`07-template-save.txt`). `sbx template inspect` is cloud-only in this version (`07-template-inspect.txt`).
- `sbx kit validate` and `sbx kit pack` refuse a v3 source kit; `sbx kit inspect` tries to build it through the Docker daemon (`13-*`). The `sbx kit` artifact commands are v1 and v2 tooling.
- `sbx kit add` refuses a mixin that declares static files and accepts one limited to variables, install commands, and network allows (`12-kit-add-files.txt`, `12-kit-add.txt`).
- The help's own registry example `https://registry.modelcontextprotocol.io/v0/servers/fetch-mcp/versions/latest` answers 404 (`11-mcp-add-registry.txt`).
- A custom secret reaches sandboxes created after it; an existing sandbox does not get the variable, as the command's own note says (`10-env-existing.txt`, `10-env-sentinel.txt`). The proxy swaps the placeholder in any header, with or without `Bearer`, for a request to a bound host (`10-receiver.log`).
- Inside the sandbox the proxy is `gateway.docker.internal:3128`, the MCP gateway is `MCP_GATEWAY_URL=http://mcp-gateway.docker.internal/mcp`, and `host.docker.internal` reaches the host through a rule such as `localhost:18080` (`04-env.txt`, `04-guest.txt`, `10-*`).
